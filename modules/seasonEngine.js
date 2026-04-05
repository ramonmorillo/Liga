import { simulateMatch } from './matchEngine.js';
import { autoPickLineup } from './lineups.js';
import { sortStandings, getTeamById, resetSeasonStats, ageAndEvolveSquads, allTeams, moodFromMomentum } from './state.js';
import { getSeasonAwards } from './awards.js';
import { pushSeasonHistory, registerTeamTitle, archivePlayers } from './history.js';
import { runAiTransferWindow } from './transfers.js';
import { generateDoubleRoundRobin } from './scheduler.js';

const coachStates = ['estable', 'observado', 'en peligro', 'destituido'];

const roundsByCompetition = {
  cup: ['Octavos', 'Cuartos', 'Semifinal', 'Final'],
  champions: ['Cuartos', 'Semifinal', 'Final'],
  cupWinners: ['Cuartos', 'Semifinal', 'Final'],
  continental2: ['Octavos', 'Cuartos', 'Semifinal', 'Final'],
};

function addNews(state, type, text, importance = 'media') {
  state.recentNews.unshift({
    season: state.season,
    matchday: state.currentMatchday,
    type,
    text,
    importance,
    dateLabel: `Temporada ${state.season} · Jornada ${state.currentMatchday}`,
  });
  state.recentNews = state.recentNews.slice(0, 120);
}

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
    home.wins += 1;
    home.points += 3;
    away.losses += 1;
    homeTeam.seasonStats.wins += 1;
    awayTeam.seasonStats.losses += 1;
    homeTeam.supporterMomentum += 5;
    awayTeam.supporterMomentum -= 5;
  } else if (result.homeGoals < result.awayGoals) {
    away.wins += 1;
    away.points += 3;
    home.losses += 1;
    awayTeam.seasonStats.wins += 1;
    homeTeam.seasonStats.losses += 1;
    awayTeam.supporterMomentum += 5;
    homeTeam.supporterMomentum -= 5;
  } else {
    home.draws += 1;
    away.draws += 1;
    home.points += 1;
    away.points += 1;
    homeTeam.seasonStats.draws += 1;
    awayTeam.seasonStats.draws += 1;
    homeTeam.supporterMomentum += 1;
    awayTeam.supporterMomentum += 1;
  }

  home.gd = home.gf - home.ga;
  away.gd = away.gf - away.ga;

  homeTeam.seasonStats.points = home.points;
  awayTeam.seasonStats.points = away.points;
  homeTeam.seasonStats.gd = home.gd;
  awayTeam.seasonStats.gd = away.gd;

  result.goals.forEach((event) => {
    const team = event.side === 'home' ? homeTeam : awayTeam;
    const player = team.squad.find((item) => item.id === event.playerId);
    if (player) player.seasonGoals += 1;
  });

  homeTeam.stadium.lastAttendance = result.attendance.attendance;
  homeTeam.stadium.lastOccupancy = result.attendance.occupancy;
  homeTeam.stadium.seasonAttendanceTotal += result.attendance.attendance;
  homeTeam.stadium.seasonHomeMatches += 1;

  homeTeam.fanMood = moodFromMomentum(homeTeam.supporterMomentum);
  awayTeam.fanMood = moodFromMomentum(awayTeam.supporterMomentum);
}

function evaluateCoachStatus(team, standings, state) {
  const row = standings.find((item) => item.teamId === team.id);
  const total = standings.length;
  const pointsTrend = team.seasonStats.wins - team.seasonStats.losses;
  const expectedRank = Math.max(1, Math.round(total - team.prestige / 6));
  const pressure = Math.max(0, (row.position - expectedRank) * 4 - pointsTrend * 2 - team.supporterMomentum / 4);

  team.coach.pressure = pressure;
  let status = coachStates[0];
  if (pressure > 14) status = coachStates[1];
  if (pressure > 26) status = coachStates[2];

  const was = team.coach.status;
  team.coach.status = status;

  if (was !== status && status !== 'estable') {
    addNews(state, 'coach-pressure', `${team.name}: ${team.coach.name} está ${status}.`, 'alta');
  }

  if (status === 'en peligro' && Math.random() < 0.08) {
    const oldCoach = team.coach.name;
    team.coach.status = coachStates[3];
    addNews(state, 'coach-fired', `${team.name} destituye a ${oldCoach} tras la mala dinámica.`, 'alta');

    const newCoachName = `${['Sergio', 'Marcos', 'Adrián', 'Raúl', 'Iván'][Math.floor(Math.random() * 5)]} ${['Romero', 'Vega', 'Herrera', 'Lagos', 'Mena'][Math.floor(Math.random() * 5)]}`;
    team.coach = {
      name: newCoachName,
      age: 40 + Math.floor(Math.random() * 21),
      style: ['posesión ofensiva', 'pressing intenso', 'transiciones rápidas'][Math.floor(Math.random() * 3)],
      rating: 62 + Math.floor(Math.random() * 19),
      profile: 'Nuevo técnico nombrado para reconducir la temporada.',
      status: 'observado',
      pressure: 12,
      changes: team.coach.changes || [],
    };

    team.coach.changes.push({ season: state.season, matchday: state.currentMatchday, out: oldCoach, in: newCoachName });
    state.history.coachChanges.push({ season: state.season, matchday: state.currentMatchday, teamName: team.name, out: oldCoach, in: newCoachName });
    addNews(state, 'coach-hired', `${team.name} incorpora a ${newCoachName} como nuevo entrenador.`, 'media');
  }
}

function buildDivisionMatchday(state, divisionKey) {
  const schedule = divisionKey === 'd1' ? state.firstSchedule : state.secondSchedule;
  const standings = divisionKey === 'd1' ? state.firstStandings : state.secondStandings;
  const teams = divisionKey === 'd1' ? state.firstDivision : state.secondDivision;
  const byId = Object.fromEntries(teams.map((team) => [team.id, team]));
  const day = schedule.find((entry) => entry.matchday === state.currentMatchday);
  if (!day) return [];

  state.results[divisionKey][state.currentMatchday] = state.results[divisionKey][state.currentMatchday] || {};
  const report = [];

  day.matches.forEach((match) => {
    const key = `${match.home}-${match.away}`;
    if (state.results[divisionKey][state.currentMatchday][key]) return;

    const homeTeam = byId[match.home];
    const awayTeam = byId[match.away];
    if (!homeTeam.lineup?.starters?.length) homeTeam.lineup = autoPickLineup(homeTeam, homeTeam.tactics.formation);
    if (!awayTeam.lineup?.starters?.length) awayTeam.lineup = autoPickLineup(awayTeam, awayTeam.tactics.formation);

    const result = simulateMatch(homeTeam, awayTeam, homeTeam.lineup, awayTeam.lineup, { competitionLabel: 'Liga' });
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

    report.push({
      key,
      division: divisionKey,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homeName: homeTeam.name,
      awayName: awayTeam.name,
      score: `${result.homeGoals}-${result.awayGoals}`,
      topScorers: result.goals.map((goal) => ({ name: goal.playerName, minute: goal.minute, teamName: goal.side === 'home' ? homeTeam.name : awayTeam.name })),
      cards: result.cards.map((card) => ({ name: card.playerName, minute: card.minute, kind: card.type, teamName: card.side === 'home' ? homeTeam.name : awayTeam.name })),
      injuries: result.injuries.map((injury) => ({ name: injury.playerName, minute: injury.minute, teamName: injury.side === 'home' ? homeTeam.name : awayTeam.name })),
      mvp: result.mvp,
      attendance: result.attendance,
    });

    if (Math.abs(result.homeGoals - result.awayGoals) >= 4) {
      addNews(state, 'big-win', `${homeTeam.name} ${result.homeGoals}-${result.awayGoals} ${awayTeam.name}: triunfo contundente.`, 'media');
    }
    result.injuries.forEach((injury) => addNews(state, 'injury', `${injury.playerName} (${injury.side === 'home' ? homeTeam.name : awayTeam.name}) cayó lesionado al ${injury.minute}'.`, 'media'));
  });

  sortStandings(standings);
  teams.forEach((team) => evaluateCoachStatus(team, standings, state));

  return report;
}

function makeKnockoutTournament(state, key, title, teams, doubleLeg = false) {
  const sortedTeams = [...teams].sort((a, b) => b.strength + b.prestige - (a.strength + a.prestige));
  const rounds = roundsByCompetition[key];
  let alive = sortedTeams;
  const bracket = [];

  rounds.forEach((roundName, idx) => {
    if (alive.length < 2) return;
    const roundMatches = [];
    for (let i = 0; i < alive.length; i += 2) {
      const home = alive[i];
      const away = alive[i + 1] || alive[i];
      const firstLeg = simulateMatch(home, away, home.lineup, away.lineup, { competitionLabel: title });
      let aggregateHome = firstLeg.homeGoals;
      let aggregateAway = firstLeg.awayGoals;
      let secondLeg = null;

      if (doubleLeg && roundName !== 'Final') {
        secondLeg = simulateMatch(away, home, away.lineup, home.lineup, { competitionLabel: title });
        aggregateHome += secondLeg.awayGoals;
        aggregateAway += secondLeg.homeGoals;
      }

      const winner = aggregateHome === aggregateAway
        ? (Math.random() < 0.5 ? home : away)
        : aggregateHome > aggregateAway
          ? home
          : away;

      roundMatches.push({
        homeTeamId: home.id,
        awayTeamId: away.id,
        homeName: home.name,
        awayName: away.name,
        firstLeg: `${firstLeg.homeGoals}-${firstLeg.awayGoals}`,
        secondLeg: secondLeg ? `${secondLeg.homeGoals}-${secondLeg.awayGoals}` : null,
        aggregate: `${aggregateHome}-${aggregateAway}`,
        winnerId: winner.id,
        winnerName: winner.name,
      });
    }
    bracket.push({ round: roundName, matches: roundMatches });
    alive = roundMatches.map((item) => getTeamById(state, item.winnerId));

    if (idx === rounds.length - 1 && alive[0]) {
      addNews(state, 'title', `${alive[0].name} conquista ${title}.`, 'alta');
    }
  });

  return {
    key,
    title,
    currentRound: bracket[bracket.length - 1]?.round || rounds[0],
    championTeamId: alive[0]?.id || null,
    championName: alive[0]?.name || null,
    rounds: bracket,
  };
}

function registerMatchdaySummary(state, allReports) {
  const topScorers = allReports.flatMap((game) => game.topScorers).slice(0, 12);
  const injuries = allReports.flatMap((game) => game.injuries).slice(0, 8);
  const cards = allReports.flatMap((game) => game.cards).slice(0, 8);
  const bigMatch = [...allReports].sort((a, b) => {
    const ia = (a.attendance?.occupancy || 0) + a.topScorers.length * 6;
    const ib = (b.attendance?.occupancy || 0) + b.topScorers.length * 6;
    return ib - ia;
  })[0];
  const standoutPlayer = topScorers[0]?.name || allReports[0]?.mvp || 'Sin destacar';

  const summary = {
    season: state.season,
    matchday: state.currentMatchday,
    matches: allReports,
    topScorers,
    injuries,
    cards,
    bigMatch: bigMatch ? `${bigMatch.homeName} ${bigMatch.score} ${bigMatch.awayName}` : '—',
    standoutPlayer,
  };

  state.matchdaySummaries.push(summary);
  state.history.matchdays.push(summary);
  state.matchdaySummaries = state.matchdaySummaries.slice(-80);
  return summary;
}

function assignPrizeMoney(state, summary) {
  const champs = getTeamById(state, state.firstStandings[0].teamId);
  const cup = getTeamById(state, state.tournaments.cup?.championTeamId);
  const champions = getTeamById(state, state.tournaments.champions?.championTeamId);
  const cupWinners = getTeamById(state, state.tournaments.cupWinners?.championTeamId);
  const cont2 = getTeamById(state, state.tournaments.continental2?.championTeamId);

  if (champs) { champs.budget += 18000000; champs.finances.prizes += 18000000; }
  if (cup) { cup.budget += 9000000; cup.finances.prizes += 9000000; }
  if (champions) { champions.budget += 12000000; champions.finances.prizes += 12000000; }
  if (cupWinners) { cupWinners.budget += 7000000; cupWinners.finances.prizes += 7000000; }
  if (cont2) { cont2.budget += 6000000; cont2.finances.prizes += 6000000; }

  if (summary) addNews(state, 'prizes', 'Premios económicos de final de temporada asignados.', 'media');
}

function finalizeSeason(state) {
  sortStandings(state.firstStandings);
  sortStandings(state.secondStandings);

  const firstChampion = getTeamById(state, state.firstStandings[0].teamId);
  const promoted = state.secondStandings.slice(0, 2).map((row) => getTeamById(state, row.teamId));
  const relegated = state.firstStandings.slice(-2).map((row) => getTeamById(state, row.teamId));

  const cup = makeKnockoutTournament(state, 'cup', 'Copa Nacional', [...state.firstDivision, ...state.secondDivision].slice(0, 16), false);
  const champions = makeKnockoutTournament(state, 'champions', 'Copa de Campeones', state.firstDivision.slice(0, 8), true);
  const cupWinners = makeKnockoutTournament(state, 'cupWinners', 'Copa de Campeones de Copa', [...state.firstDivision.slice(4, 8), ...state.secondDivision.slice(0, 4)], true);
  const continental2 = makeKnockoutTournament(state, 'continental2', 'Copa Continental Secundaria', [...state.firstDivision.slice(1, 8), ...state.secondDivision.slice(0, 9)].slice(0, 16), true);
  state.tournaments = { cup, champions, cupWinners, continental2 };

  const awards = getSeasonAwards(state);

  const summary = {
    season: state.season,
    year: state.year,
    leagueChampion: firstChampion.name,
    cupChampion: cup.championName,
    championsWinner: champions.championName,
    cupWinnersWinner: cupWinners.championName,
    continental2Winner: continental2.championName,
    relegated: relegated.map((team) => team.name),
    promoted: promoted.map((team) => team.name),
    awards,
  };

  assignPrizeMoney(state, summary);

  registerTeamTitle(state, firstChampion.id, 'league');
  registerTeamTitle(state, cup.championTeamId, 'cup');
  registerTeamTitle(state, champions.championTeamId, 'champions');
  registerTeamTitle(state, cupWinners.championTeamId, 'cupWinners');
  registerTeamTitle(state, continental2.championTeamId, 'continental2');
  pushSeasonHistory(state, summary);

  const stayFirst = state.firstStandings.slice(0, 14).map((row) => getTeamById(state, row.teamId));
  const staySecond = state.secondStandings.slice(2).map((row) => getTeamById(state, row.teamId));

  state.firstDivision = [...stayFirst, ...promoted].map((team) => ({ ...team, division: 1 }));
  state.secondDivision = [...relegated, ...staySecond].map((team) => ({ ...team, division: 2 }));

  ageAndEvolveSquads(state);
  allTeams(state).forEach((team) => {
    resetSeasonStats(team);
    team.lineup = autoPickLineup(team, team.tactics.formation);
  });

  state.history.transfersBySeason[`S${state.season}`] = [...state.transferHistory];
  state.transferHistory = [];

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

  const firstReport = buildDivisionMatchday(state, 'd1');
  const secondReport = buildDivisionMatchday(state, 'd2');
  const matchdaySummary = registerMatchdaySummary(state, [...firstReport, ...secondReport]);

  if (!state.winterWindowOpened && state.currentMatchday >= Math.ceil(state.maxMatchday / 2)) {
    state.transferWindow = 'winter';
    state.winterWindowOpened = true;
    runAiTransferWindow(state);
    addNews(state, 'market', 'Se abre el mercado de invierno.', 'media');
  }

  state.currentMatchday += 1;

  if (state.currentMatchday > state.maxMatchday) {
    finalizeSeason(state);
    return { done: true, message: 'Fin de temporada completado', summary: matchdaySummary };
  }

  state.transferWindow = state.currentMatchday < 3 ? 'summer' : state.winterWindowOpened && state.currentMatchday < Math.ceil(state.maxMatchday / 2) + 2 ? 'winter' : 'closed';
  if (state.transferWindow !== 'closed') runAiTransferWindow(state);

  return { done: false, message: `Jornada ${state.currentMatchday - 1} simulada`, summary: matchdaySummary };
}
