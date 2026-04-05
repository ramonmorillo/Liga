import { firstDivisionTeams } from '../data/teams.js';
import { secondDivisionTeams } from '../data/secondDivision.js';
import { namePools, euNationalities, nonEuNationalities } from '../data/names.js';
import { competitions } from '../data/trophies.js';
import { generateDoubleRoundRobin } from './scheduler.js';
import { autoPickLineup } from './lineups.js';

export const CURRENT_STATE_VERSION = 3;
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

function createCoach() {
  const pools = namePools.España;
  return {
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

function createPlayer(teamId, idx, position, base, nonEuRemaining, age = rand(17, 35)) {
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
    history: { seasons: 0, clubs: [], goals: 0, titles: [] },
  };
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
    squad: [],
    tactics: { formation: '4-3-3' },
    lineup: { formation: '4-3-3', starters: [], bench: [] },
    seasonStats: { points: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0 },
    trophies: {},
    coach: createCoach(),
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
    selectedMatchKey: null,
    history: {
      seasons: [],
      clubTitles: {},
      playerArchive: {},
      topScorers: [],
      trophies: competitions,
      europe: [],
      matchdays: [],
      transfersBySeason: {},
      coachChanges: [],
    },
    europeSlots: { champions: [], cupWinners: [], continental2: [] },
    cup: { championTeamId: null, runnerUpTeamId: null, rounds: [] },
    tournaments: {},
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

function enrichLegacyState(raw) {
  raw.transferHistory = raw.transferHistory || [];
  raw.recentNews = raw.recentNews || [];
  raw.matchdaySummaries = raw.matchdaySummaries || [];
  raw.selectedTeamId = raw.selectedTeamId || raw.userTeamId;
  raw.history = raw.history || {};
  raw.history.matchdays = raw.history.matchdays || [];
  raw.history.transfersBySeason = raw.history.transfersBySeason || {};
  raw.history.coachChanges = raw.history.coachChanges || [];
  raw.tournaments = raw.tournaments || {};

  allTeams(raw).forEach((team) => {
    if (!team.finances) team.finances = { transferIn: 0, transferOut: 0, prizes: 0 };
    if (!team.coach) team.coach = createCoach();
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
  });

  raw.version = CURRENT_STATE_VERSION;
  return raw;
}

export function migrateState(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.version === CURRENT_STATE_VERSION) return raw;

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
  });
}

export function ageAndEvolveSquads(state) {
  allTeams(state).forEach((team) => {
    team.squad.forEach((player) => {
      player.age += 1;
      const growth = player.age < 24 ? rand(0, 3) : player.age > 31 ? rand(-3, 0) : rand(-1, 1);
      player.overall = Math.max(45, Math.min(player.potential, player.overall + growth));
      if (player.age > 33 && Math.random() < 0.18) player.retired = true;
      player.value = Math.max(150000, Math.round(player.overall * player.overall * 13000));
      player.clause = Math.round(player.value * rand(3, 10));
      player.history.seasons += 1;
      player.history.goals += player.seasonGoals;
    });

    team.squad = team.squad.filter((player) => !player.retired);

    while (team.squad.length < 24) {
      const posPool = ['POR', 'DEF', 'DEF', 'MED', 'MED', 'DEL'];
      const position = pick(posPool);
      const youth = createPlayer(team.id, team.squad.length, position, Math.max(52, team.strength - 6), 1, rand(17, 20));
      youth.potential = Math.min(95, youth.overall + rand(4, 11));
      youth.history.clubs.push(team.id);
      team.squad.push(youth);
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
