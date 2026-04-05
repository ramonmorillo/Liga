import { simulateMatch } from './matchEngine.js';
import { autoPickLineup } from './lineups.js';
import { sortStandings, getTeamById, resetSeasonStats, ageAndEvolveSquads, allTeams, moodFromMomentum, createCoachProfile } from './state.js';
import { getSeasonAwards } from './awards.js';
import { pushSeasonHistory, registerTeamTitle, archivePlayers, registerClubSeasonSnapshot } from './history.js';
import { runAiTransferWindow } from './transfers.js';
import { generateDoubleRoundRobin } from './scheduler.js';
import { simulateExternalEuropeSeason } from './europe.js';

const coachStates = ['estable', 'observado', 'en peligro', 'destituido'];
const cupRoundFormat = [
  { round: 'Octavos', slots: 1, twoLegged: false, anchors: [4] },
  { round: 'Cuartos', slots: 1, twoLegged: false, anchors: [9] },
  { round: 'Semifinal', slots: 2, twoLegged: true, anchors: [14, 15] },
  { round: 'Final', slots: 1, twoLegged: false, anchors: [19] },
];
const euroRoundFormat = [
  { round: 'Cuartos', slots: 2, twoLegged: true, anchors: [8, 9] },
  { round: 'Semifinal', slots: 2, twoLegged: true, anchors: [13, 14] },
  { round: 'Final', slots: 1, twoLegged: false, anchors: [18] },
];
const continentalRoundFormat = [
  { round: 'Octavos', slots: 2, twoLegged: true, anchors: [6, 7] },
  { round: 'Cuartos', slots: 2, twoLegged: true, anchors: [11, 12] },
  { round: 'Semifinal', slots: 2, twoLegged: true, anchors: [16, 17] },
  { round: 'Final', slots: 1, twoLegged: false, anchors: [20] },
];
const PRIZE_AMOUNTS = {
  league: 100000000,
  cup: 50000000,
  champions: 500000000,
  internationalSecondary: 200000000,
  promotion: 25000000,
};

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

function registerFinancialEvent(state, team, payload) {
  if (!team) return;
  const event = {
    id: payload.id || `fin-${state.season}-${team.id}-${Math.random().toString(36).slice(2, 8)}`,
    season: state.season,
    year: state.year,
    matchday: state.currentMatchday,
    teamId: team.id,
    teamName: team.name,
    type: payload.type,
    amount: payload.amount,
    text: payload.text,
    meta: payload.meta || {},
  };
  team.financialHistory = team.financialHistory || [];
  team.financialHistory.unshift(event);
  team.financialHistory = team.financialHistory.slice(0, 120);
  state.history.financialEvents = state.history.financialEvents || [];
  state.history.financialEvents.unshift(event);
  state.history.financialEvents = state.history.financialEvents.slice(0, 600);
}

function grantPrizeOnce(state, team, amount, typeKey, text, meta = {}) {
  if (!team) return null;
  const ledgerKey = `S${state.season}:${typeKey}:${team.id}`;
  state.prizeLedger = state.prizeLedger || {};
  if (state.prizeLedger[ledgerKey]) return null;
  state.prizeLedger[ledgerKey] = true;
  team.budget += amount;
  team.finances.prizes += amount;
  registerFinancialEvent(state, team, { id: ledgerKey, type: 'prize', amount, text, meta });
  addNews(state, 'economy', `${team.name} recibe ${Math.round(amount / 1000000)}M€ por ${text}.`, 'media');
  return { teamId: team.id, teamName: team.name, amount, text, typeKey };
}

function createMatchRecord(state, payload) {
  const id = payload.id || `S${state.season}-D${payload.dateIndex}-${payload.competition}-${payload.homeTeamId}-${payload.awayTeamId}-${Math.random().toString(36).slice(2, 6)}`;
  const record = {
    id,
    season: state.season,
    dateIndex: payload.dateIndex,
    week: payload.dateIndex,
    matchday: payload.matchday ?? null,
    division: payload.division || null,
    competition: payload.competition,
    competitionLabel: payload.competitionLabel,
    round: payload.round || null,
    leg: payload.leg || null,
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
    extraTime: payload.extraTime || false,
    penalties: payload.penalties || null,
    resolutionText: payload.resolutionText || null,
  };

  state.matchArchive[id] = record;
  return record;
}

function listDateEvents(state, dateIndex) {
  return (state.seasonCalendar || []).filter((event) => event.dateIndex === dateIndex);
}

function createTournamentTemplate(key, title, roundFormat, participants) {
  return {
    key,
    title,
    participants,
    championTeamId: null,
    championName: null,
    currentRound: roundFormat[0]?.round || null,
    rounds: roundFormat.map((entry) => ({
      round: entry.round,
      dates: [],
      twoLegged: entry.twoLegged,
      done: false,
      pairs: [],
      matches: [],
      winners: [],
    })),
  };
}

function shuffled(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

function mapCompetitionLabel(event) {
  if (event.competitionId === 'league') return 'Liga';
  if (event.competitionId === 'cup') return 'Copa';
  return 'Internacional';
}

function buildSeasonCalendar(state) {
  const leagueRounds = (state.firstDivision.length - 1) * 2;
  state.leagueMatchdays = leagueRounds;

  const entries = [];
  for (let round = 1; round <= leagueRounds; round += 1) {
    entries.push({
      anchor: round,
      order: 0,
      event: {
        id: `S${state.season}-L${round}`,
        season: state.season,
        type: 'league',
        competitionId: 'league',
        round: `Jornada ${round}`,
        leg: 1,
        status: 'pending',
        matchday: round,
        matches: [],
        label: 'Liga',
      },
    });
  }

  const attachRoundSet = (type, competitionId, label, format) => {
    format.forEach((roundConfig) => {
      roundConfig.anchors.forEach((anchor, idx) => {
        entries.push({
          anchor,
          order: type === 'cup' ? 1 : 2,
          event: {
            id: `S${state.season}-${competitionId}-${roundConfig.round}-${idx + 1}`,
            season: state.season,
            type,
            competitionId,
            round: roundConfig.round,
            leg: roundConfig.twoLegged ? idx + 1 : 1,
            status: 'pending',
            matches: [],
            label,
          },
        });
      });
    });
  };

  attachRoundSet('cup', 'cup', 'Copa Nacional', cupRoundFormat);
  if (state.season > 1) {
    attachRoundSet('international', 'continental2', 'Copa Continental', continentalRoundFormat);
    attachRoundSet('international', 'champions', 'Copa de Campeones', euroRoundFormat);
    attachRoundSet('international', 'cupWinners', 'Copa de Campeones de Copa', euroRoundFormat);
  }

  entries.sort((a, b) => a.anchor - b.anchor || a.order - b.order);
  const events = entries.map((entry, index) => ({ ...entry.event, dateIndex: index + 1, week: index + 1 }));

  state.maxMatchday = events.length;
  state.currentMatchday = Math.min(state.currentMatchday, state.maxMatchday);
  state.seasonCalendar = events;
  state.selectedCalendarWeek = Math.min(state.selectedCalendarWeek || 1, state.maxMatchday);
  state.calendarVersion = 3;
}

function priorityByType(type) {
  return type === 'league' ? 0 : type === 'cup' ? 1 : type === 'international' ? 2 : 3;
}

function normalizeCupParticipants(participants, slots = 16) {
  const trimmed = [...participants].slice(0, slots);
  while (trimmed.length < slots) trimmed.push(null);
  return shuffled(trimmed);
}

function updateRoundDatesFromCalendar(state, tournament) {
  if (!tournament?.rounds) return;
  tournament.rounds.forEach((round) => {
    round.dates = (state.seasonCalendar || [])
      .filter((event) => event.competitionId === tournament.key && event.round === round.round)
      .map((event) => event.dateIndex)
      .sort((a, b) => a - b);
  });
}

function setupSeasonTournaments(state) {
  const cupParticipants = normalizeCupParticipants(state.firstDivision.map((team) => ({ id: team.id, name: team.name })), 16);
  state.tournaments.cup = createTournamentTemplate('cup', 'Copa Nacional', cupRoundFormat, cupParticipants);
  updateRoundDatesFromCalendar(state, state.tournaments.cup);

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

  state.tournaments.champions = createTournamentTemplate('champions', 'Copa de Campeones', euroRoundFormat, championsParticipants);
  state.tournaments.cupWinners = createTournamentTemplate('cupWinners', 'Copa de Campeones de Copa', euroRoundFormat, cupWinnersParticipants);
  state.tournaments.continental2 = createTournamentTemplate('continental2', 'Copa Continental Secundaria', continentalRoundFormat, contParticipants);
  updateRoundDatesFromCalendar(state, state.tournaments.champions);
  updateRoundDatesFromCalendar(state, state.tournaments.cupWinners);
  updateRoundDatesFromCalendar(state, state.tournaments.continental2);
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

function playLeagueDate(state, dateEvent, divisionKey) {
  const schedule = divisionKey === 'd1' ? state.firstSchedule : state.secondSchedule;
  const standings = divisionKey === 'd1' ? state.firstStandings : state.secondStandings;
  const teams = divisionKey === 'd1' ? state.firstDivision : state.secondDivision;
  const byId = Object.fromEntries(teams.map((team) => [team.id, team]));
  const day = schedule.find((entry) => entry.matchday === dateEvent.matchday);
  if (!day) return [];

  state.results[divisionKey][dateEvent.matchday] = state.results[divisionKey][dateEvent.matchday] || {};
  const report = [];

  day.matches.forEach((match) => {
    const key = `${match.home}-${match.away}`;
    if (state.results[divisionKey][dateEvent.matchday][key]) return;

    const homeTeam = byId[match.home];
    const awayTeam = byId[match.away];
    if (!homeTeam.lineup?.starters?.length) homeTeam.lineup = autoPickLineup(homeTeam, homeTeam.tactics.formation);
    if (!awayTeam.lineup?.starters?.length) awayTeam.lineup = autoPickLineup(awayTeam, awayTeam.tactics.formation);

    const result = simulateMatch(homeTeam, awayTeam, homeTeam.lineup, awayTeam.lineup, { competitionLabel: 'Liga' });
    const record = createMatchRecord(state, {
      dateIndex: dateEvent.dateIndex,
      matchday: dateEvent.matchday,
      division: divisionKey,
      competition: 'league',
      competitionLabel: divisionKey === 'd1' ? 'Liga Primera' : 'Liga Segunda',
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homeName: homeTeam.name,
      awayName: awayTeam.name,
      result,
    });

    state.results[divisionKey][dateEvent.matchday][key] = { ...result, matchId: record.id };
    applyResult(standings, homeTeam, awayTeam, result);
    dateEvent.matches.push(record.id);

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
  if (ref.id?.startsWith('ext:')) return getExternalTournamentTeam(state, ref);
  return getTeamById(state, ref.id);
}

function buildExternalPlayers(teamId) {
  const shape = [
    ['POR', 2],
    ['DEF', 6],
    ['MED', 6],
    ['DEL', 4],
  ];
  const players = [];
  shape.forEach(([position, amount]) => {
    for (let i = 0; i < amount; i += 1) {
      players.push({
        id: `${teamId}-${position}-${i + 1}`,
        name: position === 'POR' ? 'Portero' : position === 'DEF' ? 'Defensa' : position === 'MED' ? 'Medio' : 'Delantero',
        surname: `#${i + 1}`,
        position,
        overall: 68 + Math.floor(Math.random() * 12),
        form: 70 + Math.floor(Math.random() * 18),
        energy: 72 + Math.floor(Math.random() * 16),
        morale: 70 + Math.floor(Math.random() * 16),
      });
    }
  });
  return players;
}

function getExternalTournamentTeam(state, ref) {
  state._externalTournamentTeams = state._externalTournamentTeams || {};
  if (state._externalTournamentTeams[ref.id]) return state._externalTournamentTeams[ref.id];

  const teamId = ref.id;
  const squad = buildExternalPlayers(teamId);
  const starters = [];
  const fill = (position, amount) => {
    starters.push(...squad.filter((player) => player.position === position).slice(0, amount).map((player) => player.id));
  };
  fill('POR', 1);
  fill('DEF', 4);
  fill('MED', 3);
  fill('DEL', 3);

  const team = {
    id: teamId,
    name: ref.name || 'Equipo internacional',
    strength: 72 + Math.floor(Math.random() * 8),
    prestige: 64 + Math.floor(Math.random() * 14),
    style: 'Transiciones',
    colors: ['#1f2937', '#d1d5db'],
    fanMood: 'expectante',
    stadium: { name: `${ref.name || 'Internacional'} Arena`, capacity: 42000 },
    lineup: { formation: '4-3-3', starters, bench: [] },
    squad,
  };

  state._externalTournamentTeams[ref.id] = team;
  return team;
}

function ensureTieBreak(baseResult) {
  if (baseResult.homeGoals !== baseResult.awayGoals) {
    return {
      ...baseResult,
      extraTime: false,
      penalties: null,
      winnerSide: baseResult.homeGoals > baseResult.awayGoals ? 'home' : 'away',
      resolutionText: 'Tiempo reglamentario',
    };
  }

  const extraHome = Math.random() < 0.35 ? 1 : 0;
  const extraAway = extraHome === 0 && Math.random() < 0.35 ? 1 : 0;
  if (extraHome !== extraAway) {
    return {
      ...baseResult,
      homeGoals: baseResult.homeGoals + extraHome,
      awayGoals: baseResult.awayGoals + extraAway,
      score: `${baseResult.homeGoals + extraHome}-${baseResult.awayGoals + extraAway}`,
      extraTime: true,
      penalties: null,
      winnerSide: extraHome > extraAway ? 'home' : 'away',
      resolutionText: 'Resuelto en prórroga',
    };
  }

  const homePens = 3 + Math.floor(Math.random() * 3);
  const awayPens = homePens + (Math.random() < 0.5 ? 1 : -1);
  return {
    ...baseResult,
    extraTime: true,
    penalties: { home: Math.max(0, homePens), away: Math.max(0, awayPens) },
    winnerSide: homePens > awayPens ? 'home' : 'away',
    resolutionText: 'Resuelto en penaltis',
  };
}

function resolveTwoLeggedWinner(pair) {
  const [firstLeg, secondLeg] = pair.legs;
  const homeAgg = firstLeg.homeGoals + secondLeg.awayGoals;
  const awayAgg = firstLeg.awayGoals + secondLeg.homeGoals;
  if (homeAgg > awayAgg) return { winnerRef: pair.homeRef, aggregate: `${homeAgg}-${awayAgg}` };
  if (awayAgg > homeAgg) return { winnerRef: pair.awayRef, aggregate: `${homeAgg}-${awayAgg}` };

  const tie = ensureTieBreak({ ...secondLeg, homeGoals: secondLeg.homeGoals, awayGoals: secondLeg.awayGoals });
  secondLeg.extraTime = tie.extraTime;
  secondLeg.penalties = tie.penalties;
  secondLeg.resolutionText = tie.resolutionText;
  if (tie.winnerSide === 'home') return { winnerRef: pair.awayRef, aggregate: `${homeAgg}-${awayAgg}` };
  return { winnerRef: pair.homeRef, aggregate: `${homeAgg}-${awayAgg}` };
}

function getRoundByEvent(tournament, dateEvent) {
  return tournament?.rounds?.find((round) => round.round === dateEvent.round && round.dates.includes(dateEvent.dateIndex));
}

function createPairingsFromEntrants(entrants) {
  const pairs = [];
  for (let i = 0; i < entrants.length; i += 2) {
    const homeRef = entrants[i];
    const awayRef = entrants[i + 1];
    if (!homeRef && !awayRef) continue;
    if (!awayRef || !homeRef) {
      pairs.push({ homeRef, awayRef, byeWinner: homeRef || awayRef, legs: [] });
      continue;
    }
    pairs.push({ homeRef, awayRef, legs: [], winnerRef: null, aggregate: null });
  }
  return pairs;
}

function playTournamentEvent(state, tournament, dateEvent) {
  if (!tournament) return;
  const round = getRoundByEvent(tournament, dateEvent);
  if (!round || round.done) return;

  const legIndex = round.dates.indexOf(dateEvent.dateIndex) + 1;
  const isFirstLegOfRound = legIndex === 1;

  if (isFirstLegOfRound && !round.pairs.length) {
    const previousRound = tournament.rounds[tournament.rounds.indexOf(round) - 1];
    let entrants = previousRound?.winners?.length ? previousRound.winners : tournament.participants;
    entrants = shuffled((entrants || []).filter(Boolean));
    round.pairs = createPairingsFromEntrants(entrants);
    round.matches = [];
  }

  round.pairs.forEach((pair, pairIndex) => {
    if (!pair.awayRef) {
      pair.winnerRef = pair.byeWinner;
      return;
    }

    if (round.twoLegged && legIndex === 2 && !pair.legs[0]) return;

    const homeRef = !round.twoLegged || legIndex === 1 ? pair.homeRef : pair.awayRef;
    const awayRef = !round.twoLegged || legIndex === 1 ? pair.awayRef : pair.homeRef;
    const homeTeam = getTournamentTeam(state, homeRef);
    const awayTeam = getTournamentTeam(state, awayRef);
    const homeLineup = homeTeam?.lineup?.starters?.length ? homeTeam.lineup : { starters: [], bench: [] };
    const awayLineup = awayTeam?.lineup?.starters?.length ? awayTeam.lineup : { starters: [], bench: [] };

    if (!homeTeam || !awayTeam) return;
    const raw = simulateMatch(homeTeam, awayTeam, homeLineup, awayLineup, { competitionLabel: tournament.title });

    let resolved = { ...raw, extraTime: false, penalties: null, resolutionText: null };
    if (!round.twoLegged && (!round.twoLegged || round.round === 'Final')) {
      resolved = ensureTieBreak(raw);
    }

    const record = createMatchRecord(state, {
      dateIndex: dateEvent.dateIndex,
      competition: tournament.key,
      competitionLabel: tournament.title,
      round: round.round,
      leg: round.twoLegged ? legIndex : 1,
      homeTeamId: homeRef.id,
      awayTeamId: awayRef.id,
      homeName: homeRef.name,
      awayName: awayRef.name,
      result: resolved,
      extraTime: resolved.extraTime,
      penalties: resolved.penalties,
      resolutionText: resolved.resolutionText,
    });

    dateEvent.matches.push(record.id);
    pair.legs[legIndex - 1] = {
      matchId: record.id,
      homeGoals: resolved.homeGoals,
      awayGoals: resolved.awayGoals,
      homeName: homeRef.name,
      awayName: awayRef.name,
      extraTime: resolved.extraTime,
      penalties: resolved.penalties,
      resolutionText: resolved.resolutionText,
      playedAs: { homeRef, awayRef },
    };

    const existing = round.matches.find((m) => m.pairIndex === pairIndex);
    const scoreLabel = `${resolved.homeGoals}-${resolved.awayGoals}${resolved.penalties ? ` (p. ${resolved.penalties.home}-${resolved.penalties.away})` : ''}`;
    if (existing) {
      existing[`leg${legIndex}`] = { score: scoreLabel, matchId: record.id };
    } else {
      round.matches.push({
        pairIndex,
        homeTeamId: pair.homeRef.id,
        awayTeamId: pair.awayRef.id,
        homeName: pair.homeRef.name,
        awayName: pair.awayRef.name,
        leg1: legIndex === 1 ? { score: scoreLabel, matchId: record.id } : null,
        leg2: legIndex === 2 ? { score: scoreLabel, matchId: record.id } : null,
        winnerId: null,
        winnerName: null,
        aggregate: null,
      });
    }

    if (!round.twoLegged) {
      pair.winnerRef = resolved.winnerSide === 'home' ? homeRef : awayRef;
      const matchEntry = round.matches.find((m) => m.pairIndex === pairIndex);
      matchEntry.winnerId = pair.winnerRef.id;
      matchEntry.winnerName = pair.winnerRef.name;
    } else if (legIndex === 2) {
      const winnerData = resolveTwoLeggedWinner(pair);
      pair.winnerRef = winnerData.winnerRef;
      pair.aggregate = winnerData.aggregate;
      const matchEntry = round.matches.find((m) => m.pairIndex === pairIndex);
      matchEntry.winnerId = pair.winnerRef.id;
      matchEntry.winnerName = pair.winnerRef.name;
      matchEntry.aggregate = winnerData.aggregate;
    }
  });

  const roundFinished = !round.twoLegged || legIndex === 2 || round.dates.length === 1;
  if (!roundFinished) return;

  round.winners = round.pairs.map((pair) => pair.winnerRef).filter(Boolean);
  round.done = true;
  tournament.currentRound = round.round;

  if (round.winners.length === 1) {
    tournament.championTeamId = round.winners[0].id;
    tournament.championName = round.winners[0].name;
    addNews(state, 'title', `${round.winners[0].name} conquista ${tournament.title}.`, 'alta');
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

function assignSeasonPrizeMoney(state, summary, promotedTeams = []) {
  const prizeEvents = [];
  const leagueChampion = getTeamById(state, state.firstStandings[0]?.teamId);
  const cupChampion = getTeamById(state, state.tournaments.cup?.championTeamId);
  const championsWinner = getTeamById(state, state.tournaments.champions?.championTeamId);
  const cupWinnersWinner = getTeamById(state, state.tournaments.cupWinners?.championTeamId);
  const continentalWinner = getTeamById(state, state.tournaments.continental2?.championTeamId);

  const pushIf = (event) => { if (event) prizeEvents.push(event); };
  pushIf(grantPrizeOnce(state, leagueChampion, PRIZE_AMOUNTS.league, 'league-title', 'ganar la Liga', { competition: 'league' }));
  pushIf(grantPrizeOnce(state, cupChampion, PRIZE_AMOUNTS.cup, 'cup-title', 'ganar la Copa Nacional', { competition: 'cup' }));
  pushIf(grantPrizeOnce(state, championsWinner, PRIZE_AMOUNTS.champions, 'international-champions', 'ganar la Copa de Campeones', { competition: 'champions' }));
  pushIf(grantPrizeOnce(state, cupWinnersWinner, PRIZE_AMOUNTS.internationalSecondary, 'international-cupwinners', 'ganar la Copa de Campeones de Copa', { competition: 'cupWinners' }));
  pushIf(grantPrizeOnce(state, continentalWinner, PRIZE_AMOUNTS.internationalSecondary, 'international-continental2', 'ganar la Copa Continental', { competition: 'continental2' }));
  promotedTeams.forEach((team) => {
    pushIf(grantPrizeOnce(state, team, PRIZE_AMOUNTS.promotion, 'promotion', 'ascenso a Primera División', { competition: 'promotion' }));
  });
  summary.prizeEvents = prizeEvents;
  return prizeEvents;
}

function registerInternationalPalmares(state, competitionKey, competitionName, championName, runnerUpName = null) {
  if (!championName) return;
  state.history.internationalPalmares = state.history.internationalPalmares || {};
  const list = state.history.internationalPalmares[competitionKey] || [];
  list.push({
    season: state.season,
    year: state.year,
    competition: competitionName,
    champion: championName,
    runnerUp: runnerUpName || null,
  });
  state.history.internationalPalmares[competitionKey] = list;
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

  assignSeasonPrizeMoney(state, summary, promoted);

  const championsFinal = champions?.rounds?.find((r) => r.round === 'Final')?.matches?.[0];
  const cupWinnersFinal = cupWinners?.rounds?.find((r) => r.round === 'Final')?.matches?.[0];
  const continentalFinal = continental2?.rounds?.find((r) => r.round === 'Final')?.matches?.[0];
  registerInternationalPalmares(state, 'champions', 'Copa de Campeones', champions?.championName, championsFinal ? (championsFinal.winnerId === championsFinal.homeTeamId ? championsFinal.awayName : championsFinal.homeName) : null);
  registerInternationalPalmares(state, 'cupWinners', 'Copa de Campeones de Copa', cupWinners?.championName, cupWinnersFinal ? (cupWinnersFinal.winnerId === cupWinnersFinal.homeTeamId ? cupWinnersFinal.awayName : cupWinnersFinal.homeName) : null);
  registerInternationalPalmares(state, 'continental2', 'Copa Continental Secundaria', continental2?.championName, continentalFinal ? (continentalFinal.winnerId === continentalFinal.homeTeamId ? continentalFinal.awayName : continentalFinal.homeName) : null);

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

  const seasonKey = `S${state.season}`;
  const existingMoves = state.history.transfersBySeason[seasonKey] || [];
  state.history.transfersBySeason[seasonKey] = [...state.transferHistory, ...existingMoves].slice(0, 500);
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
  const needsCalendarMigration = !state.seasonCalendar?.length || !state.seasonCalendar[0]?.type || state.calendarVersion !== 3;
  if (needsCalendarMigration) buildSeasonCalendar(state);
  if (!state.tournaments?.cup || !state.tournaments.cup.rounds?.length || !Array.isArray(state.tournaments.cup.rounds[0]?.dates)) setupSeasonTournaments(state);
  repairInternationalCalendarState(state);
}

function repairInternationalCalendarState(state) {
  if (!Array.isArray(state.seasonCalendar)) return;
  const aliases = new Set(['continental', 'european', 'europe']);
  state.seasonCalendar.forEach((event) => {
    if (aliases.has(event.type)) event.type = 'international';
    if (event.type !== 'international') return;
    if (event.status === 'played') event.status = 'completed';
    if (!event.label) event.label = 'Internacional';
  });

  const hasCompositeDates = state.seasonCalendar.some((event, _, list) => list.filter((x) => x.dateIndex === event.dateIndex).length > 1);
  if (hasCompositeDates) buildSeasonCalendar(state);
}

function simulateDateByEvent(state, event, allReports) {
  if (event.type === 'league') {
    const firstReport = playLeagueDate(state, event, 'd1');
    const secondReport = playLeagueDate(state, event, 'd2');
    allReports.push(...firstReport, ...secondReport);
    event.status = 'completed';
    return;
  }

  if (event.type === 'cup') {
    playTournamentEvent(state, state.tournaments.cup, event);
    event.status = 'completed';
    return;
  }

  if (event.type === 'international') {
    playTournamentEvent(state, state.tournaments[event.competitionId], event);
    event.status = 'completed';
    return;
  }

  event.status = 'idle';
}

export function simulateMatchday(state) {
  ensureSeasonSetup(state);
  if (state.currentMatchday > state.maxMatchday) return { done: true, message: 'Temporada ya finalizada' };

  const dayEvents = listDateEvents(state, state.currentMatchday);
  const activeEvent = dayEvents[0];
  const allReports = [];
  if (activeEvent) simulateDateByEvent(state, activeEvent, allReports);

  const matchdaySummary = registerMatchdaySummary(state, allReports);

  if (!state.winterWindowOpened && state.currentMatchday >= Math.ceil(state.maxMatchday / 2)) {
    state.transferWindow = 'winter';
    state.winterWindowOpened = true;
    runAiTransferWindow(state);
    addNews(state, 'market', 'Se abre el mercado de invierno.', 'media');
  }

  const simulatedDate = state.currentMatchday;
  state.currentMatchday += 1;

  if (state.currentMatchday > state.maxMatchday) {
    finalizeSeason(state);
    return { done: true, message: 'Fin de temporada completado', summary: matchdaySummary };
  }

  state.transferWindow = state.currentMatchday < 3 ? 'summer' : state.winterWindowOpened && state.currentMatchday < Math.ceil(state.maxMatchday / 2) + 2 ? 'winter' : 'closed';
  if (state.transferWindow !== 'closed') runAiTransferWindow(state);

  const labels = activeEvent ? mapCompetitionLabel(activeEvent) : '';
  return { done: false, message: `Fecha ${simulatedDate} simulada (${labels || 'sin competición'})`, summary: matchdaySummary };
}

export function dismissCoach(state, teamId) {
  const team = getTeamById(state, teamId);
  if (!team) return { ok: false, message: 'Equipo no encontrado' };
  const previousCoach = team.coach || createCoachProfile();
  const indemnizacion = Math.max(3000000, Math.round(team.budget * 0.04));

  team.budget -= indemnizacion;
  registerFinancialEvent(state, team, {
    id: `S${state.season}:coach-dismiss:${team.id}:${previousCoach.id || previousCoach.name}`,
    type: 'coach-dismissal',
    amount: -indemnizacion,
    text: `Indemnización por cese de ${previousCoach.name}`,
    meta: { previousCoach: previousCoach.name },
  });

  const newCoach = createCoachProfile();
  newCoach.status = 'estable';
  team.coach = newCoach;
  team.coach.changes.push({ season: state.season, week: state.currentMatchday, reason: 'sustitución tras cese', previousCoach: previousCoach.name });
  state.history.coachChanges.push({
    season: state.season,
    week: state.currentMatchday,
    teamId: team.id,
    teamName: team.name,
    outCoach: previousCoach.name,
    inCoach: newCoach.name,
    compensation: indemnizacion,
  });
  addNews(state, 'coach-change', `${team.name} cesa a ${previousCoach.name}. Nuevo entrenador: ${newCoach.name}.`, 'alta');
  return { ok: true, message: `${team.name} cesa a ${previousCoach.name}. Llega ${newCoach.name}.`, compensation: indemnizacion };
}

export function initializeSeasonStructures(state) {
  ensureSeasonSetup(state);
}
