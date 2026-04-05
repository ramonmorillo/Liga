import { simulateMatch } from './matchEngine.js';
import { autoPickLineup } from './lineups.js';
import { sortStandings, getTeamById, resetSeasonStats, ageAndEvolveSquads } from './state.js';
import { getSeasonAwards } from './awards.js';
import { pushSeasonHistory, registerTeamTitle, archivePlayers } from './history.js';
import { runAiTransferWindow } from './transfers.js';
import { generateDoubleRoundRobin } from './scheduler.js';

function applyResult(standings, homeTeam, awayTeam, result) {
  const home = standings.find((row) => row.teamId === homeTeam.id);
  const away = standings.find((row) => row.teamId === awayTeam.id);

  home.gf += result.homeGoals;
  home.ga += result.awayGoals;
  away.gf += result.awayGoals;
  away.ga += result.homeGoals;

  homeTeam.seasonStats.gf += result.homeGoals;
  homeTeam.seasonStats.ga += result.awayGoals;
  awayTeam.seasonStats.gf += result.awayGoals;
  awayTeam.seasonStats.ga += result.homeGoals;

  if (result.homeGoals > result.awayGoals) {
    home.wins += 1; home.points += 3; away.losses += 1;
    homeTeam.seasonStats.wins += 1; awayTeam.seasonStats.losses += 1;
  } else if (result.homeGoals < result.awayGoals) {
    away.wins += 1; away.points += 3; home.losses += 1;
    awayTeam.seasonStats.wins += 1; homeTeam.seasonStats.losses += 1;
  } else {
    home.draws += 1; away.draws += 1; home.points += 1; away.points += 1;
    homeTeam.seasonStats.draws += 1; awayTeam.seasonStats.draws += 1;
  }

  home.gd = home.gf - home.ga;
  away.gd = away.gf - away.ga;

  homeTeam.seasonStats.points = home.points;
  awayTeam.seasonStats.points = away.points;
  homeTeam.seasonStats.gd = home.gd;
  awayTeam.seasonStats.gd = away.gd;

  result.events.forEach((event) => {
    const team = event.side === 'home' ? homeTeam : awayTeam;
    const player = team.squad.find((item) => item.id === event.playerId);
    if (player) player.seasonGoals += 1;
  });
}

function playDivisionMatchday(state, divisionKey) {
  const schedule = divisionKey === 'd1' ? state.firstSchedule : state.secondSchedule;
  const standings = divisionKey === 'd1' ? state.firstStandings : state.secondStandings;
  const teams = divisionKey === 'd1' ? state.firstDivision : state.secondDivision;
  const byId = Object.fromEntries(teams.map((team) => [team.id, team]));

  const day = schedule.find((entry) => entry.matchday === state.currentMatchday);
  if (!day) return;
  state.results[divisionKey][state.currentMatchday] = state.results[divisionKey][state.currentMatchday] || {};

  day.matches.forEach((match) => {
    const key = `${match.home}-${match.away}`;
    if (state.results[divisionKey][state.currentMatchday][key]) return;

    const homeTeam = byId[match.home];
    const awayTeam = byId[match.away];
    if (!homeTeam.lineup?.starters?.length) homeTeam.lineup = autoPickLineup(homeTeam, homeTeam.tactics.formation);
    if (!awayTeam.lineup?.starters?.length) awayTeam.lineup = autoPickLineup(awayTeam, awayTeam.tactics.formation);

    const result = simulateMatch(homeTeam, awayTeam, homeTeam.lineup, awayTeam.lineup);
    state.results[divisionKey][state.currentMatchday][key] = result;
    applyResult(standings, homeTeam, awayTeam, result);

    homeTeam.squad.forEach((player) => {
      if (homeTeam.lineup.starters.includes(player.id)) player.energy = Math.max(40, player.energy - 8);
      else player.energy = Math.min(100, player.energy + 4);
    });
    awayTeam.squad.forEach((player) => {
      if (awayTeam.lineup.starters.includes(player.id)) player.energy = Math.max(40, player.energy - 8);
      else player.energy = Math.min(100, player.energy + 4);
    });
  });

  sortStandings(standings);
}

function simpleKnockoutChampion(teamPool, rounds = 4) {
  let alive = [...teamPool];
  while (alive.length > 1 && rounds > 0) {
    alive = alive.sort(() => Math.random() - 0.5);
    const next = [];
    for (let i = 0; i < alive.length; i += 2) {
      const home = alive[i];
      const away = alive[i + 1] || alive[i];
      const winner = Math.random() < (home.strength + home.prestige) / ((home.strength + home.prestige) + (away.strength + away.prestige)) ? home : away;
      next.push(winner);
    }
    alive = next;
    rounds -= 1;
  }
  return alive[0];
}

function finalizeSeason(state) {
  sortStandings(state.firstStandings);
  sortStandings(state.secondStandings);

  const firstChampion = getTeamById(state, state.firstStandings[0].teamId);
  const cupChampion = simpleKnockoutChampion(state.firstDivision);
  const championsWinner = simpleKnockoutChampion(state.firstDivision.slice(0, 8), 3);
  const cupWinnersWinner = simpleKnockoutChampion([...state.firstDivision.slice(4, 8), ...state.secondDivision.slice(0, 4)], 3);
  const continental2Winner = simpleKnockoutChampion([...state.firstDivision.slice(1, 8), ...state.secondDivision.slice(0, 3)], 4);

  const awards = getSeasonAwards(state);

  const relegated = state.firstStandings.slice(-2).map((row) => getTeamById(state, row.teamId));
  const promoted = state.secondStandings.slice(0, 2).map((row) => getTeamById(state, row.teamId));

  const europeQualifiers = {
    champions: [firstChampion.name],
    cupWinners: [cupChampion.name],
    continental2: [],
  };

  const occupied = new Set([firstChampion.id, cupChampion.id]);
  for (const row of state.firstStandings.slice(1)) {
    if (!occupied.has(row.teamId) && europeQualifiers.continental2.length < 3) {
      const team = getTeamById(state, row.teamId);
      europeQualifiers.continental2.push(team.name);
      occupied.add(team.id);
    }
  }

  const summary = {
    season: state.season,
    year: state.year,
    leagueChampion: firstChampion.name,
    cupChampion: cupChampion.name,
    championsWinner: championsWinner.name,
    cupWinnersWinner: cupWinnersWinner.name,
    continental2Winner: continental2Winner.name,
    relegated: relegated.map((team) => team.name),
    promoted: promoted.map((team) => team.name),
    awards,
    europeQualifiers,
  };

  registerTeamTitle(state, firstChampion.id, 'league');
  registerTeamTitle(state, cupChampion.id, 'cup');
  registerTeamTitle(state, championsWinner.id, 'champions');
  registerTeamTitle(state, cupWinnersWinner.id, 'cupWinners');
  registerTeamTitle(state, continental2Winner.id, 'continental2');
  pushSeasonHistory(state, summary);

  const stayFirst = state.firstStandings.slice(0, 14).map((row) => getTeamById(state, row.teamId));
  const staySecond = state.secondStandings.slice(2).map((row) => getTeamById(state, row.teamId));

  state.firstDivision = [...stayFirst, ...promoted].map((team) => ({ ...team, division: 1 }));
  state.secondDivision = [...relegated, ...staySecond].map((team) => ({ ...team, division: 2 }));

  ageAndEvolveSquads(state);
  [...state.firstDivision, ...state.secondDivision].forEach((team) => {
    resetSeasonStats(team);
    team.lineup = autoPickLineup(team, team.tactics.formation);
  });

  state.season += 1;
  state.year += 1;
  state.currentMatchday = 1;
  state.maxMatchday = (state.firstDivision.length - 1) * 2;
  state.transferWindow = 'summer';
  state.winterWindowOpened = false;
  state.results = { d1: {}, d2: {} };
  state.firstSchedule = generateDoubleRoundRobin(state.firstDivision.map((team) => team.id));
  state.secondSchedule = generateDoubleRoundRobin(state.secondDivision.map((team) => team.id));
  state.firstStandings = state.firstDivision.map((team) => ({ teamId: team.id, points: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, position: 0 }));
  state.secondStandings = state.secondDivision.map((team) => ({ teamId: team.id, points: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, position: 0 }));
  sortStandings(state.firstStandings);
  sortStandings(state.secondStandings);

  archivePlayers(state);
}

export function simulateMatchday(state) {
  if (state.currentMatchday > state.maxMatchday) return { done: true, message: 'Temporada ya finalizada' };

  playDivisionMatchday(state, 'd1');
  playDivisionMatchday(state, 'd2');

  if (!state.winterWindowOpened && state.currentMatchday >= Math.ceil(state.maxMatchday / 2)) {
    state.transferWindow = 'winter';
    state.winterWindowOpened = true;
    runAiTransferWindow(state);
  }

  state.currentMatchday += 1;

  if (state.currentMatchday > state.maxMatchday) {
    finalizeSeason(state);
    return { done: true, message: 'Fin de temporada completado' };
  }

  state.transferWindow = state.currentMatchday < 3 ? 'summer' : state.winterWindowOpened && state.currentMatchday < Math.ceil(state.maxMatchday / 2) + 2 ? 'winter' : 'closed';
  if (state.transferWindow !== 'closed') runAiTransferWindow(state);

  return { done: false, message: `Jornada ${state.currentMatchday - 1} simulada` };
}
