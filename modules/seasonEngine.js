import { simulateMatch } from './matchEngine.js';
import { autoPickLineup } from './lineups.js';
import { sortStandings, getTeamById, resetSeasonStats, ageAndEvolveSquads, allTeams, moodFromMomentum } from './state.js';
import { getSeasonAwards } from './awards.js';
import { pushSeasonHistory, registerTeamTitle, archivePlayers, registerClubSeasonSnapshot } from './history.js';
import { runAiTransferWindow } from './transfers.js';
import { generateDoubleRoundRobin } from './scheduler.js';
import { simulateExternalEuropeSeason } from './europe.js';

const coachStates = ['estable', 'observado', 'en peligro', 'destituido'];

const cupRounds = ['Octavos', 'Cuartos', 'Semifinal', 'Final'];
const euroRounds = ['Cuartos', 'Semifinal', 'Final'];

function addNews(state, type, text, importance = 'media') {
  state.recentNews.unshift({
    season: state.season,
    matchday: state.currentMatchday,
    type,
    text,
    importance,
    dateLabel: `Temporada ${state.season} · Semana ${state.currentMatchday}`,
  });
  state.recentNews = state.recentNews.slice(0, 120);
}

function createMatchRecord(state, payload) {
  const id = payload.id || `S${state.season}-W${payload.week}-${payload.competition}-${payload.homeTeamId}-${payload.awayTeamId}-${Math.random().toString(36).slice(2, 6)}`;
  const record = {
    id,
    season: state.season,
    week: payload.week,
    matchday: payload.matchday ?? null,
    division: payload.division || null,
    competition: payload.competition,
    competitionLabel: payload.competitionLabel,
    round: payload.round || null,
    homeTeamId: payload.homeTeamId,
    awayTeamId: payload.awayTeamId,
    homeName: payload.homeName,
    awayName: payload.awayName,
    homeGoals: payload.result.homeGoals,
    awayGoals: payload.result.awayGoals,
    score: `${payload.result.homeGoals}-${payload.result.awayGoals}`,
    goals: payload.result.goals || [],
    cards: payload.result.cards || [],
    injuries: payload.result.injuries || [],
    events: payload.result.events || [],
    stats: {
      possession: [payload.result.homePossession, payload.result.awayPossession],
      shots: [payload.result.homeShots, payload.result.awayShots],
      shotsOnTarget: [payload.result.homeShotsOnTarget, payload.result.awayShotsOnTarget],
    },
    mvp: payload.result.mvp,
    attendance: payload.result.attendance,
    summaryText: payload.result.summaryText,
  };

  state.matchArchive[id] = record;
  return record;
}

function getCalendarWeek(state, week) {
  if (!state.seasonCalendar.length) return null;
  return state.seasonCalendar.find((entry) => entry.week === week) || null;
}

function createTournamentTemplate(key, title, roundNames, participants, weekMap) {
  const rounds = roundNames.map((name, idx) => ({
    round: name,
    week: weekMap[idx],
    matches: [],
    done: false,
  }));
  return {
    key,
    title,
    rounds,
    participants,
    championTeamId: null,
    championName: null,
    currentRound: rounds[0]?.round || null,
  };
}

function shuffled(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

function buildSeasonCalendar(state) {
  const weeks = [];
  for (let week = 1; week <= state.maxMatchday; week += 1) {
    weeks.push({ week, labels: ['Liga'], competitions: { league: { played: false, matchday: week } }, matches: [] });
  }

  const cupWeeks = [4, 9, 14, 19];
  cupWeeks.forEach((week, idx) => {
    if (!weeks[week - 1]) return;
    weeks[week - 1].labels.push('Copa');
    weeks[week - 1].competitions.cup = { played: false, round: cupRounds[idx] };
  });

  if (state.season > 1) {
    const c2Weeks = [6, 11, 16, 20];
    c2Weeks.forEach((week, idx) => {
      if (!weeks[week - 1]) return;
      weeks[week - 1].labels.push('Europa');
      weeks[week - 1].competitions.continental2 = { played: false, round: ['Octavos', ...euroRounds][idx] };
    });
    [8, 13, 18].forEach((week, idx) => {
      if (!weeks[week - 1]) return;
      weeks[week - 1].labels.push('Europa');
      weeks[week - 1].competitions.champions = { played: false, round: euroRounds[idx] };
      weeks[week - 1].competitions.cupWinners = { played: false, round: euroRounds[idx] };
    });
  }

  state.seasonCalendar = weeks;
  state.selectedCalendarWeek = Math.min(state.selectedCalendarWeek || 1, state.maxMatchday);
}

function setupSeasonTournaments(state) {
  const cupParticipants = shuffled([...state.firstDivision, ...state.secondDivision]).slice(0, 16);
  state.tournaments.cup = createTournamentTemplate('cup', 'Copa Nacional', cupRounds, cupParticipants, [4, 9, 14, 19]);

  if (state.season === 1) {
    state.tournaments.champions = null;
    state.tournaments.cupWinners = null;
    state.tournaments.continental2 = null;
    return;
  }

  const ext = state.europeExternal?.leagues || [];
  const extChampions = ext.map((league) => ({ id: `ext:${league.championTeamId}`, name: league.champion }));
  const extCup = ext.map((league) => ({ id: `ext:${league.cupChampionTeamId}`, name: league.cupChampion }));
  const extCont = ext.flatMap((league) => league.table.slice(1, 3).map((row) => ({ id: `ext:${row.teamId}`, name: row.teamName })));

  const domestic = state.europeSlots || { champions: [], cupWinners: [], continental2: [] };
  const championsParticipants = [...domestic.champions, ...extChampions].slice(0, 8);
  const cupWinnersParticipants = [...domestic.cupWinners, ...extCup].slice(0, 8);
  const contParticipants = [...domestic.continental2, ...extCont].slice(0, 16);

  state.tournaments.champions = createTournamentTemplate('champions', 'Copa de Campeones', euroRounds, championsParticipants, [8, 13, 18]);
  state.tournaments.cupWinners = createTournamentTemplate('cupWinners', 'Copa de Campeones de Copa', euroRounds, cupWinnersParticipants, [8, 13, 18]);
  state.tournaments.continental2 = createTournamentTemplate('continental2', 'Copa Continental Secundaria', ['Octavos', ...euroRounds], contParticipants, [6, 11, 16, 20]);
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

  if (was !== status && status !== 'estable') addNews(state, 'coach-pressure', `${team.name}: ${team.coach.name} está ${status}.`, 'alta');
}

function playLeagueWeek(state, divisionKey, weekEntry) {
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
    const record = createMatchRecord(state, {
      week: state.currentMatchday,
      matchday: state.currentMatchday,
      division: divisionKey,
      competition: 'league',
      competitionLabel: divisionKey === 'd1' ? 'Liga Primera' : 'Liga Segunda',
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homeName: homeTeam.name,
      awayName: awayTeam.name,
      result,
    });

    state.results[divisionKey][state.currentMatchday][key] = { ...result, matchId: record.id };
    applyResult(standings, homeTeam, awayTeam, result);
    weekEntry.matches.push(record.id);

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
  });

  sortStandings(standings);
  teams.forEach((team) => evaluateCoachStatus(team, standings, state));
  return report;
}

function getTournamentTeam(state, ref) {
  if (!ref) return null;
  if (ref.id?.startsWith('ext:')) return { id: ref.id, name: ref.name, strength: 72, prestige: 66, lineup: { starters: [], bench: [] }, squad: [] };
  return getTeamById(state, ref.id);
}

function playTournamentRound(state, tournament, weekEntry) {
  if (!tournament) return;
  const round = tournament.rounds.find((item) => item.week === state.currentMatchday && !item.done);
  if (!round) return;

  const previousRound = tournament.rounds[tournament.rounds.indexOf(round) - 1];
  let entrants = previousRound?.winners || tournament.participants;
  entrants = entrants.filter(Boolean);
  entrants = shuffled(entrants);

  const winners = [];
  const matches = [];
  for (let i = 0; i < entrants.length; i += 2) {
    const homeRef = entrants[i];
    const awayRef = entrants[i + 1];
    if (!awayRef) {
      winners.push(homeRef);
      continue;
    }

    const homeTeam = getTournamentTeam(state, homeRef);
    const awayTeam = getTournamentTeam(state, awayRef);
    const homeLineup = homeTeam?.lineup?.starters?.length ? homeTeam.lineup : { starters: [], bench: [] };
    const awayLineup = awayTeam?.lineup?.starters?.length ? awayTeam.lineup : { starters: [], bench: [] };

    const result = simulateMatch(homeTeam, awayTeam, homeLineup, awayLineup, { competitionLabel: tournament.title });
    const winnerRef = result.homeGoals === result.awayGoals ? (Math.random() < 0.5 ? homeRef : awayRef) : result.homeGoals > result.awayGoals ? homeRef : awayRef;
    winners.push(winnerRef);

    const record = createMatchRecord(state, {
      week: state.currentMatchday,
      competition: tournament.key,
      competitionLabel: tournament.title,
      round: round.round,
      homeTeamId: homeRef.id,
      awayTeamId: awayRef.id,
      homeName: homeRef.name,
      awayName: awayRef.name,
      result,
    });

    weekEntry.matches.push(record.id);
    matches.push({
      matchId: record.id,
      homeTeamId: homeRef.id,
      awayTeamId: awayRef.id,
      homeName: homeRef.name,
      awayName: awayRef.name,
      score: `${result.homeGoals}-${result.awayGoals}`,
      winnerId: winnerRef.id,
      winnerName: winnerRef.name,
    });
  }

  round.matches = matches;
  round.winners = winners;
  round.done = true;
  tournament.currentRound = round.round;

  if (winners.length === 1) {
    tournament.championTeamId = winners[0].id;
    tournament.championName = winners[0].name;
    addNews(state, 'title', `${winners[0].name} conquista ${tournament.title}.`, 'alta');
  }
}

function registerMatchdaySummary(state, allReports) {
  const topScorers = allReports.flatMap((game) => game.topScorers).slice(0, 12);
  const injuries = allReports.flatMap((game) => game.injuries).slice(0, 8);
  const cards = allReports.flatMap((game) => game.cards).slice(0, 8);
  const bigMatch = [...allReports].sort((a, b) => ((b.attendance?.occupancy || 0) + b.topScorers.length * 6) - ((a.attendance?.occupancy || 0) + a.topScorers.length * 6))[0];
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
  state.matchdaySummaries = state.matchdaySummaries.slice(-120);
  return summary;
}

function computeEuropeSlots(state, cupChampionId) {
  const taken = new Set();
  const fromLeague = (pos) => {
    const row = state.firstStandings[pos - 1];
    return row ? getTeamById(state, row.teamId) : null;
  };

  const champion = fromLeague(1);
  if (champion) taken.add(champion.id);

  let cupTeam = cupChampionId ? getTeamById(state, cupChampionId) : null;
  if (cupTeam && taken.has(cupTeam.id)) {
    cupTeam = state.firstStandings.map((row) => getTeamById(state, row.teamId)).find((team) => team && !taken.has(team.id));
  }
  if (cupTeam) taken.add(cupTeam.id);

  const continental2 = [];
  for (let i = 1; i < state.firstStandings.length && continental2.length < 3; i += 1) {
    const team = getTeamById(state, state.firstStandings[i].teamId);
    if (team && !taken.has(team.id)) {
      continental2.push({ id: team.id, name: team.name });
      taken.add(team.id);
    }
  }

  state.europeSlots = {
    champions: champion ? [{ id: champion.id, name: champion.name }] : [],
    cupWinners: cupTeam ? [{ id: cupTeam.id, name: cupTeam.name }] : [],
    continental2,
  };
}

function assignPrizeMoney(state, summary) {
  const champs = getTeamById(state, state.firstStandings[0].teamId);
  const cup = getTeamById(state, state.tournaments.cup?.championTeamId);
  if (champs) { champs.budget += 18000000; champs.finances.prizes += 18000000; }
  if (cup) { cup.budget += 9000000; cup.finances.prizes += 9000000; }
  if (summary?.championsWinner) {
    const ch = getTeamById(state, state.tournaments.champions?.championTeamId?.replace('ext:', ''));
    if (ch) { ch.budget += 12000000; ch.finances.prizes += 12000000; }
  }
}

function finalizeSeason(state) {
  sortStandings(state.firstStandings);
  sortStandings(state.secondStandings);

  const firstChampion = getTeamById(state, state.firstStandings[0].teamId);
  const promoted = state.secondStandings.slice(0, 2).map((row) => getTeamById(state, row.teamId));
  const relegated = state.firstStandings.slice(-2).map((row) => getTeamById(state, row.teamId));

  const cup = state.tournaments.cup;
  const champions = state.tournaments.champions;
  const cupWinners = state.tournaments.cupWinners;
  const continental2 = state.tournaments.continental2;

  computeEuropeSlots(state, cup?.championTeamId);

  const awards = getSeasonAwards(state);

  const summary = {
    season: state.season,
    year: state.year,
    leagueChampion: firstChampion.name,
    cupChampion: cup?.championName || 'Pendiente',
    championsWinner: champions?.championName || 'No disputada',
    cupWinnersWinner: cupWinners?.championName || 'No disputada',
    continental2Winner: continental2?.championName || 'No disputada',
    relegated: relegated.map((team) => team.name),
    promoted: promoted.map((team) => team.name),
    europeQualified: {
      champions: state.europeSlots.champions.map((t) => t.name),
      cupWinners: state.europeSlots.cupWinners.map((t) => t.name),
      continental2: state.europeSlots.continental2.map((t) => t.name),
    },
    awards,
  };

  assignPrizeMoney(state, summary);

  registerTeamTitle(state, firstChampion.id, 'league', state.season);
  if (cup?.championTeamId) registerTeamTitle(state, cup.championTeamId, 'cup', state.season);
  if (champions?.championTeamId && !String(champions.championTeamId).startsWith('ext:')) registerTeamTitle(state, champions.championTeamId, 'champions', state.season);
  if (cupWinners?.championTeamId && !String(cupWinners.championTeamId).startsWith('ext:')) registerTeamTitle(state, cupWinners.championTeamId, 'cupWinners', state.season);
  if (continental2?.championTeamId && !String(continental2.championTeamId).startsWith('ext:')) registerTeamTitle(state, continental2.championTeamId, 'continental2', state.season);

  [...state.firstStandings, ...state.secondStandings].forEach((row) => {
    const team = getTeamById(state, row.teamId);
    registerClubSeasonSnapshot(state, team, row, state.season, state.year);
  });

  state.history.globalBySeason.push({
    season: state.season,
    year: state.year,
    leagueChampion: summary.leagueChampion,
    cupChampion: summary.cupChampion,
    europeQualified: summary.europeQualified,
    promoted: summary.promoted,
    relegated: summary.relegated,
    pichichi: awards.pichichi,
    zamora: awards.zamora,
  });

  pushSeasonHistory(state, summary);

  const external = simulateExternalEuropeSeason(state.season);
  state.europeExternal.leagues = external.leagues;
  state.europeExternal.history.push(external);

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

  buildSeasonCalendar(state);
  setupSeasonTournaments(state);
  archivePlayers(state);
}

function ensureSeasonSetup(state) {
  if (!state.seasonCalendar?.length) buildSeasonCalendar(state);
  if (!state.tournaments?.cup) setupSeasonTournaments(state);
}

export function simulateMatchday(state) {
  ensureSeasonSetup(state);
  if (state.currentMatchday > state.maxMatchday) return { done: true, message: 'Temporada ya finalizada' };

  const weekEntry = getCalendarWeek(state, state.currentMatchday);
  const firstReport = playLeagueWeek(state, 'd1', weekEntry);
  const secondReport = playLeagueWeek(state, 'd2', weekEntry);

  playTournamentRound(state, state.tournaments.cup, weekEntry);
  playTournamentRound(state, state.tournaments.champions, weekEntry);
  playTournamentRound(state, state.tournaments.cupWinners, weekEntry);
  playTournamentRound(state, state.tournaments.continental2, weekEntry);

  if (weekEntry?.competitions?.league) weekEntry.competitions.league.played = true;
  Object.keys(weekEntry?.competitions || {}).forEach((key) => {
    if (key !== 'league' && state.tournaments[key]) {
      const round = state.tournaments[key].rounds.find((r) => r.week === state.currentMatchday);
      if (round?.done) weekEntry.competitions[key].played = true;
    }
  });

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
  return { done: false, message: `Semana ${state.currentMatchday - 1} simulada`, summary: matchdaySummary };
}

export function initializeSeasonStructures(state) {
  buildSeasonCalendar(state);
  setupSeasonTournaments(state);
}
