import { firstDivisionTeams } from '../data/teams.js';
import { secondDivisionTeams } from '../data/second_division.js';
import { namePools, euNationalities, nonEuNationalities } from '../data/names.js';

const squadShape = [
  ...Array(3).fill('POR'),
  ...Array(8).fill('DEF'),
  ...Array(8).fill('MED'),
  ...Array(5).fill('DEL'),
];

const byStyleBoost = {
  'Posesión': { MED: 1.4 },
  'Ataque directo': { DEL: 1.5 },
  'Presión alta': { MED: 1.1, DEL: 0.8 },
  'Contraataque': { DEL: 1.2, DEF: 0.4 },
  'Bloque bajo': { DEF: 1.6 },
  'Transiciones': { MED: 0.8, DEL: 0.8 },
  'Juego físico': { DEF: 1.0, MED: 0.5 },
};

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function createPlayer(teamId, index, position, base, nonEuLeft) {
  const isNonEu = nonEuLeft > 0 && Math.random() < 0.13;
  const nationality = isNonEu ? pick(nonEuNationalities) : pick(euNationalities);
  const pool = namePools[nationality];
  const avg = Math.max(48, Math.min(91, Math.round(base + rand(-8, 8))));
  const potential = Math.max(avg, Math.min(94, avg + rand(1, 9)));
  const value = Math.max(300000, avg * avg * 13000 + rand(-200000, 200000));
  const clause = Math.round(value * rand(3, 8));
  return {
    id: `${teamId}-${index + 1}`,
    name: pick(pool.first),
    surname: pick(pool.last),
    age: rand(17, 35),
    nationality,
    position,
    overall: avg,
    potential,
    form: rand(60, 90),
    energy: rand(65, 100),
    morale: rand(60, 95),
    value,
    clause,
    nonEu: isNonEu,
  };
}

function createSquad(team) {
  let nonEuLeft = 3;
  return squadShape.map((position, i) => {
    const boost = byStyleBoost[team.style]?.[position] || 0;
    const player = createPlayer(team.id, i, position, team.strength + boost, nonEuLeft);
    if (player.nonEu) nonEuLeft -= 1;
    return player;
  });
}

function setupTeam(raw, idx, division) {
  const id = `${division}-${idx + 1}`;
  const team = {
    id,
    division,
    name: raw.name,
    prestige: raw.prestige,
    budget: raw.budget,
    style: raw.style,
    strength: raw.strength,
    colors: raw.colors,
  };
  team.squad = createSquad(team);
  return team;
}

export function createInitialState() {
  const firstDivision = firstDivisionTeams.map((t, i) => setupTeam(t, i, 1));
  const secondDivision = secondDivisionTeams.map((t, i) => setupTeam(t, i, 2));

  return {
    season: 1,
    currentMatchday: 1,
    maxMatchday: 30,
    firstDivision,
    secondDivision,
    schedule: [],
    standings: [],
    results: {},
  };
}

export function getTeamLineAverages(team) {
  const avg = (pos) => Math.round(team.squad.filter((p) => p.position === pos).reduce((a, b) => a + b.overall, 0) / team.squad.filter((p) => p.position === pos).length);
  return { POR: avg('POR'), DEF: avg('DEF'), MED: avg('MED'), DEL: avg('DEL') };
}
