import { firstDivisionTeams } from '../data/teams.js';
import { secondDivisionTeams } from '../data/secondDivision.js';
import { namePools, euNationalities, nonEuNationalities } from '../data/names.js';
import { competitions } from '../data/trophies.js';
import { generateDoubleRoundRobin } from './scheduler.js';
import { autoPickLineup } from './lineups.js';
import { normalizeExternalLeagueData } from './europe.js';
import { ensurePlayerStatus, computePlayerStatus } from './playerStatus.js';

export const CURRENT_STATE_VERSION = 8;
const START_YEAR = 2026;

const squadShape = [...Array(3).fill('POR'), ...Array(8).fill('DEF'), ...Array(8).fill('MED'), ...Array(5).fill('DEL')];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const moodScale = ['eufórica', 'contenta', 'expectante', 'inquieta', 'enfadada', 'muy enfadada'];
const coachStyles = ['posesión ofensiva', 'bloque medio', 'pressing intenso', 'transiciones rápidas', 'defensa táctica'];
const shirtPatterns = ['Liso', 'Rayas', 'Bandas', 'Mitad y mitad'];
const stadiumSuffix = ['Arena', 'Stadium', 'Parque', 'Coliseo', 'Metropolitano', 'Olímpico'];

function splitClubName(name) {
  return name.replace(/^(Real|Club Deportivo|Atlético|Sporting|Deportivo|Unión|CF|FC|CD|Inter|Racing)\s+/i, '').trim();
}

function coachId() {
  return `coach-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createCoachProfile() {
  const pools = namePools.España;
  return {
    id: coachId(),
    name: `${pick(pools.first)} ${pick(pools.last)}`,
    age: rand(38, 67),
    style: pick(coachStyles),
    rating: rand(60, 88),
    profile: 'Entrenador con enfoque competitivo y gestión de vestuario.',
    status: 'estable',
    pressure: 0,
    changes: [],
  };
}

function createContractEndYear(currentYear = START_YEAR) {
  return currentYear + rand(1, 5);
}

function createIdentity(raw, division) {
  const root = splitClubName(raw.name);
  return {
    stadium: {
      name: `${root} ${pick(stadiumSuffix)}`,
      capacity: rand(division === 1 ? 28000 : 14000, division === 1 ? 76000 : 36000),
      seasonAttendanceTotal: 0,
      seasonHomeMatches: 0,
      lastAttendance: null,
      lastOccupancy: null,
    },
    fanMood: 'expectante',
    supporterMomentum: 0,
    crest: {
      shape: pick(['shield', 'round', 'diamond']),
      symbol: root[0]?.toUpperCase() || raw.name[0].toUpperCase(),
    },
    kits: {
      primary: { pattern: pick(shirtPatterns), colors: [raw.colors[0], raw.colors[1] || '#ffffff'] },
      away: { pattern: pick(shirtPatterns), colors: [raw.colors[1] || '#f3f4f6', raw.colors[0]] },
    },
  };
}

function createPlayer(teamId, idx, position, base, nonEuRemaining, age = rand(17, 35), currentYear = START_YEAR) {
  const isNonEu = nonEuRemaining > 0 && Math.random() < 0.14;
  const nationality = isNonEu ? pick(nonEuNationalities) : pick(euNationalities);
  const pools = namePools[nationality] || namePools.España;
  const overall = Math.max(47, Math.min(92, Math.round(base + rand(-8, 8))));
  const potential = Math.max(overall, Math.min(95, overall + rand(1, 9)));
  const value = Math.max(250000, Math.round(overall * overall * 13500 + rand(-220000, 220000)));
  const clause = Math.round(value * rand(3, 9));

  return {
    id: `${teamId}-p-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    name: pick(pools.first),
    surname: pick(pools.last),
    age,
    nationality,
    position,
    overall,
    potential,
    form: rand(60, 90),
    energy: rand(68, 100),
    morale: rand(62, 95),
    value,
    clause,
    nonEu: isNonEu,
    seasonGoals: 0,
    seasonConceded: 0,
    contractEndYear: createContractEndYear(currentYear),
    history: { seasons: 0, clubs: [], goals: 0, titles: [] },
    previousOverall: overall,
    previousForm: null,
    previousMorale: null,
    playerStatus: { trend: 'stable', injurySeverity: null, injuryGamesRemaining: 0, current: 'stable', lastUpdatedSeason: 1 },
  };
}

export function createYouthPlayer(team, stateYear, position = 'MED') {
  const youth = createPlayer(
    team.id,
    team.squad.length + 1,
    position,
    Math.max(49, team.strength - 10),
    0,
    17,
    stateYear,
  );
  youth.potential = Math.max(youth.overall + 4, Math.min(84, youth.overall + rand(6, 12)));
  youth.contractEndYear = stateYear + 3;
  youth.history.clubs.push(team.id);
  return youth;
}

function setupTeam(raw, idx, division) {
  const id = `${division === 1 ? 'd1' : 'd2'}-${idx + 1}`;
  const team = {
    id,
    division,
    name: raw.name,
    colors: raw.colors,
    style: raw.style,
    profile: raw.profile || 'modesto',
    prestige: raw.prestige,
    strength: raw.strength,
    budget: raw.budget * 1000000,
    finances: { transferIn: 0, transferOut: 0, prizes: 0 },
    financialHistory: [],
    marketHistory: [],
    squad: [],
    tactics: { formation: '4-3-3' },
    lineup: { formation: '4-3-3', starters: [], bench: [] },
    seasonStats: { points: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0 },
    trophies: {},
    coach: createCoachProfile(),
    ...createIdentity(raw, division),
  };

  let nonEuLeft = 3;
  team.squad = squadShape.map((position, playerIndex) => {
    const p = createPlayer(team.id, playerIndex, position, team.strength, nonEuLeft);
    if (p.nonEu) nonEuLeft -= 1;
    p.history.clubs.push(team.id);
    return p;
  });

  team.lineup = autoPickLineup(team, team.tactics.formation);
  return team;
}

function standingsFromTeams(teams) {
  return teams.map((team) => ({
    teamId: team.id,
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    position: 0,
  }));
}

export function createNewGame() {
  const firstDivision = firstDivisionTeams.map((team, idx) => setupTeam(team, idx, 1));
  const secondDivision = secondDivisionTeams.map((team, idx) => setupTeam(team, idx, 2));

  const state = {
    version: CURRENT_STATE_VERSION,
    calendarVersion: 2,
    season: 1,
    year: START_YEAR,
    currentMatchday: 1,
    maxMatchday: (firstDivision.length - 1) * 2,
    winterWindowOpened: false,
    firstDivision,
    secondDivision,
    firstSchedule: generateDoubleRoundRobin(firstDivision.map((team) => team.id)),
    secondSchedule: generateDoubleRoundRobin(secondDivision.map((team) => team.id)),
    firstStandings: standingsFromTeams(firstDivision),
    secondStandings: standingsFromTeams(secondDivision),
    results: { d1: {}, d2: {} },
    userTeamId: firstDivision[0].id,
    transferWindow: 'summer',
    transferHistory: [],
    recentNews: [],
    matchdaySummaries: [],
    selectedTeamId: firstDivision[0].id,
    selectedMatchId: null,
    selectedCalendarWeek: 1,
    ui: { teamDetailTab: 'squad', selectedPlayerId: null },
    matchArchive: {},
    seasonCalendar: [],
    history: {
      seasons: [],
      clubTitles: {},
      clubTitleLog: [],
      clubSeasonStats: {},
      playerArchive: {},
      topScorers: [],
      trophies: competitions,
      europe: [],
      matchdays: [],
      transfersBySeason: {},
      coachChanges: [],
      globalBySeason: [],
      financialEvents: [],
      internationalPalmares: {},
    },
    prizeLedger: {},
    europeSlots: { champions: [], cupWinners: [], continental2: [] },
    cup: { championTeamId: null, runnerUpTeamId: null, rounds: [] },
    tournaments: {},
    europeExternal: { leagues: [], history: [] },
    lastSeasonSummary: null,
  };

  sortStandings(state.firstStandings);
  sortStandings(state.secondStandings);
  return state;
}

export function sortStandings(rows) {
  rows.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  rows.forEach((row, idx) => {
    row.position = idx + 1;
  });
}

export function allTeams(state) {
  return [...state.firstDivision, ...state.secondDivision];
}

export function getTeamById(state, teamId) {
  return allTeams(state).find((team) => team.id === teamId);
}

export function contractSeasonsLeft(player, currentYear) {
  if (!player || typeof player.contractEndYear !== 'number') return 0;
  return Math.max(0, player.contractEndYear - currentYear);
}

function enrichLegacyState(raw) {
  raw.transferHistory = raw.transferHistory || [];
  raw.recentNews = raw.recentNews || [];
  raw.matchdaySummaries = raw.matchdaySummaries || [];
  raw.selectedTeamId = raw.selectedTeamId || raw.userTeamId;
  raw.selectedMatchId = raw.selectedMatchId || null;
  raw.selectedCalendarWeek = raw.selectedCalendarWeek || 1;
  raw.ui = raw.ui || { teamDetailTab: 'squad', selectedPlayerId: null };
  if (!raw.ui.teamDetailTab) raw.ui.teamDetailTab = 'squad';
  raw.matchArchive = raw.matchArchive || {};
  raw.seasonCalendar = raw.seasonCalendar || [];
  raw.history = raw.history || {};
  raw.history.matchdays = raw.history.matchdays || [];
  raw.history.transfersBySeason = raw.history.transfersBySeason || {};
  raw.history.coachChanges = raw.history.coachChanges || [];
  raw.history.clubSeasonStats = raw.history.clubSeasonStats || {};
  raw.history.clubTitleLog = raw.history.clubTitleLog || [];
  raw.history.globalBySeason = raw.history.globalBySeason || [];
  raw.history.financialEvents = raw.history.financialEvents || [];
  raw.history.internationalPalmares = raw.history.internationalPalmares || {};
  raw.prizeLedger = raw.prizeLedger || {};
  raw.tournaments = raw.tournaments || {};
  raw.europeExternal = raw.europeExternal || { leagues: [], history: [] };
  raw.calendarVersion = raw.calendarVersion || 1;
  normalizeExternalLeagueData(raw.europeExternal);

  allTeams(raw).forEach((team) => {
    if (!team.finances) team.finances = { transferIn: 0, transferOut: 0, prizes: 0 };
    if (!team.financialHistory) team.financialHistory = [];
    if (!team.marketHistory) team.marketHistory = [];
    if (!team.coach) team.coach = createCoachProfile();
    if (!team.stadium || !team.kits || !team.crest) {
      const identity = createIdentity(team, team.division || 1);
      team.stadium = team.stadium || identity.stadium;
      team.kits = team.kits || identity.kits;
      team.crest = team.crest || identity.crest;
      team.fanMood = team.fanMood || identity.fanMood;
      team.supporterMomentum = team.supporterMomentum || 0;
    }
    if (!team.coach.changes) team.coach.changes = [];
    if (!team.coach.status) team.coach.status = 'estable';
    if (!team.coach.pressure) team.coach.pressure = 0;
    if (!team.coach.id) team.coach.id = coachId();

    team.squad.forEach((player) => {
      if (!player.history) player.history = { seasons: 0, clubs: [team.id], goals: 0, titles: [] };
      if (!Array.isArray(player.history.clubs)) player.history.clubs = [team.id];
      if (typeof player.contractEndYear !== 'number') player.contractEndYear = createContractEndYear(raw.year || START_YEAR);
      if (typeof player.previousOverall !== 'number') player.previousOverall = player.overall;
      if (typeof player.previousForm !== 'number') player.previousForm = player.form;
      if (typeof player.previousMorale !== 'number') player.previousMorale = player.morale;
      ensurePlayerStatus(player);
      computePlayerStatus(player);
    });
  });

  raw.version = CURRENT_STATE_VERSION;
  return raw;
}

export function migrateState(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.version === CURRENT_STATE_VERSION) {
    normalizeExternalLeagueData(raw.europeExternal);
    return raw;
  }

  if (raw.firstDivision && raw.secondDivision) {
    return enrichLegacyState(raw);
  }

  return null;
}

export function resetSeasonStats(team) {
  team.seasonStats = { points: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0 };
  team.stadium.seasonAttendanceTotal = 0;
  team.stadium.seasonHomeMatches = 0;
  team.stadium.lastAttendance = null;
  team.stadium.lastOccupancy = null;
  team.finances.transferIn = 0;
  team.finances.transferOut = 0;
  team.finances.prizes = 0;

  team.squad.forEach((player) => {
    player.seasonGoals = 0;
    player.seasonConceded = 0;
    player.energy = rand(76, 100);
    player.form = Math.min(100, Math.max(50, player.form + rand(-6, 6)));
    player.morale = Math.min(100, Math.max(45, player.morale + rand(-5, 7)));
    player.previousForm = player.form;
    player.previousMorale = player.morale;
    ensurePlayerStatus(player);
    computePlayerStatus(player);
  });
}

export function ageAndEvolveSquads(state) {
  const marketSeasonKey = `S${state.season}`;
  state.history.transfersBySeason[marketSeasonKey] = state.history.transfersBySeason[marketSeasonKey] || [];

  const logSquadMovement = (team, payload) => {
    const move = {
      season: state.season,
      year: state.year,
      teamId: team.id,
      teamName: team.name,
      ...payload,
    };
    team.marketHistory = team.marketHistory || [];
    team.marketHistory.unshift(move);
    team.marketHistory = team.marketHistory.slice(0, 220);
    state.history.transfersBySeason[marketSeasonKey].unshift(move);
    state.history.transfersBySeason[marketSeasonKey] = state.history.transfersBySeason[marketSeasonKey].slice(0, 500);
  };

  const requiredByPosition = { POR: 2, DEF: 6, MED: 6, DEL: 4 };
  const renewalCost = (player) => Math.max(180000, Math.round(player.value * 0.04));

  allTeams(state).forEach((team) => {
    const leftByContract = [];
    team.squad.forEach((player) => {
      player.age += 1;
      player.previousOverall = player.overall;
      player.previousForm = player.form;
      player.previousMorale = player.morale;
      const growth = player.age < 24 ? rand(0, 3) : player.age > 31 ? rand(-3, 0) : rand(-1, 1);
      player.overall = Math.max(45, Math.min(player.potential, player.overall + growth));
      if (player.age > 33 && Math.random() < 0.18) player.retired = true;
      player.value = Math.max(150000, Math.round(player.overall * player.overall * 13000));
      player.clause = Math.round(player.value * rand(3, 10));
      player.history.seasons += 1;
      player.history.goals += player.seasonGoals;
      ensurePlayerStatus(player);
      computePlayerStatus(player);
      if (!player.contractEndYear || player.contractEndYear <= state.year) {
        const renewAmount = renewalCost(player);
        if (team.budget >= renewAmount) {
          team.budget -= renewAmount;
          player.contractEndYear = state.year + rand(1, 4);
        } else {
          player.leftByContract = true;
          leftByContract.push(player);
          logSquadMovement(team, {
            type: 'contract-expired',
            operation: 'Salida',
            playerName: `${player.name} ${player.surname}`,
            role: player.position,
            cost: 0,
            note: 'No renovado por falta de presupuesto',
          });
        }
      }
    });

    team.squad = team.squad.filter((player) => !player.retired && !player.leftByContract);

    leftByContract.forEach((departed) => {
      const cannotAffordMarket = team.budget < Math.max(2000000, departed.value * 0.45);
      if (!cannotAffordMarket) return;
      const promoted = createYouthPlayer(team, state.year, departed.position);
      team.squad.push(promoted);
      logSquadMovement(team, {
        type: 'youth-promotion',
        operation: 'Promoción',
        playerName: `${promoted.name} ${promoted.surname}`,
        role: promoted.position,
        cost: 0,
        note: `Ascenso juvenil automático (17 años) para cubrir baja de ${departed.name} ${departed.surname}`,
      });
    });

    const byPosition = (pos) => team.squad.filter((p) => p.position === pos).length;
    Object.entries(requiredByPosition).forEach(([position, minimum]) => {
      while (byPosition(position) < minimum) {
        const promoted = createYouthPlayer(team, state.year, position);
        team.squad.push(promoted);
        logSquadMovement(team, {
          type: 'youth-promotion',
          operation: 'Promoción',
          playerName: `${promoted.name} ${promoted.surname}`,
          role: position,
          cost: 0,
          note: 'Promoción para mantener mínimo funcional de plantilla',
        });
      }
    });

    while (team.squad.length < 24) {
      const posPool = ['POR', 'DEF', 'DEF', 'MED', 'MED', 'DEL'];
      const position = pick(posPool);
      const youth = createYouthPlayer(team, state.year, position);
      team.squad.push(youth);
      logSquadMovement(team, {
        type: 'youth-promotion',
        operation: 'Promoción',
        playerName: `${youth.name} ${youth.surname}`,
        role: position,
        cost: 0,
        note: 'Promoción de cantera para completar plantilla',
      });
    }

    team.lineup = autoPickLineup(team, team.tactics.formation);
  });
}

export function moodFromMomentum(momentum) {
  if (momentum >= 36) return moodScale[0];
  if (momentum >= 18) return moodScale[1];
  if (momentum >= 0) return moodScale[2];
  if (momentum >= -16) return moodScale[3];
  if (momentum >= -34) return moodScale[4];
  return moodScale[5];
}
