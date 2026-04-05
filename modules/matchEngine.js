import { lineupStrength } from './lineups.js';

const styleMap = {
  Posesión: { attack: 1.05, control: 1.12 },
  'Ataque directo': { attack: 1.12, control: 0.96 },
  'Presión alta': { attack: 1.09, control: 1.02 },
  Contraataque: { attack: 1.04, control: 0.95 },
  'Bloque bajo': { attack: 0.92, control: 0.9 },
  Transiciones: { attack: 1.0, control: 1.0 },
  'Juego físico': { attack: 0.97, control: 0.94 },
};

const r = (min, max) => Math.random() * (max - min) + min;
const ri = (min, max) => Math.floor(r(min, max + 1));

function buildMetrics(team, lineup, homeFactor = 1) {
  const style = styleMap[team.style] || styleMap.Transiciones;
  const line = lineupStrength(team, lineup);
  return {
    rating: line * 0.64 + team.strength * 0.22 + team.prestige * 0.14,
    attack: style.attack * homeFactor,
    control: style.control,
  };
}

function poissonLike(xg) {
  const lambda = Math.max(0.1, xg);
  let goals = 0;
  let p = Math.exp(-lambda);
  let s = p;
  const u = Math.random();
  while (u > s && goals < 8) {
    goals += 1;
    p *= lambda / goals;
    s += p;
  }
  return goals;
}

function weightedPlayers(team, lineup, type = 'goal') {
  const starters = lineup.starters.map((id) => team.squad.find((player) => player.id === id)).filter(Boolean);
  const weightMaps = {
    goal: { POR: 1, DEF: 8, MED: 21, DEL: 38 },
    card: { POR: 4, DEF: 28, MED: 25, DEL: 14 },
    injury: { POR: 4, DEF: 16, MED: 18, DEL: 12 },
  };

  const weights = weightMaps[type] || weightMaps.goal;
  return starters.flatMap((player) => Array(Math.max(1, weights[player.position] + Math.floor(player.overall / 5))).fill(player));
}

function generateMinute() {
  const minute = ri(1, 90);
  if (Math.random() < 0.13) return `${minute}+${ri(1, 4)}`;
  return String(minute);
}

function minuteValue(minuteLabel) {
  return Number.parseInt(minuteLabel, 10);
}

function createScorerEvents(goalCount, bag, side) {
  const events = [];
  for (let i = 0; i < goalCount; i += 1) {
    const player = bag[Math.floor(Math.random() * bag.length)];
    events.push({
      minute: generateMinute(),
      type: 'goal',
      side,
      playerId: player.id,
      playerName: `${player.name} ${player.surname}`,
      text: `Gol de ${player.name} ${player.surname}`,
    });
  }
  return events;
}

function createDisciplineEvents(team, lineup, side) {
  const yellowCount = Math.max(0, Math.round(r(0.5, 3.1)));
  const redChance = Math.random() < 0.18;
  const bag = weightedPlayers(team, lineup, 'card');
  const events = [];

  for (let i = 0; i < yellowCount; i += 1) {
    const player = bag[Math.floor(Math.random() * bag.length)];
    events.push({ type: 'yellow', side, minute: generateMinute(), playerId: player.id, playerName: `${player.name} ${player.surname}`, text: `Amarilla para ${player.name} ${player.surname}` });
  }

  if (redChance) {
    const player = bag[Math.floor(Math.random() * bag.length)];
    events.push({ type: 'red', side, minute: generateMinute(), playerId: player.id, playerName: `${player.name} ${player.surname}`, text: `Roja para ${player.name} ${player.surname}` });
  }

  return events;
}

function createInjuryEvents(team, lineup, side) {
  const injuryCount = Math.random() < 0.22 ? 1 : 0;
  const bag = weightedPlayers(team, lineup, 'injury');
  const events = [];
  for (let i = 0; i < injuryCount; i += 1) {
    const player = bag[Math.floor(Math.random() * bag.length)];
    events.push({ type: 'injury', side, minute: generateMinute(), playerId: player.id, playerName: `${player.name} ${player.surname}`, text: `Lesión de ${player.name} ${player.surname}` });
  }
  return events;
}

function pickMvp(homeTeam, awayTeam, allEvents) {
  const goals = allEvents.filter((event) => event.type === 'goal');
  if (goals.length) return goals[Math.floor(Math.random() * Math.min(3, goals.length))].playerName;
  const allPlayers = [...homeTeam.squad, ...awayTeam.squad].sort((a, b) => b.overall - a.overall);
  const pick = allPlayers[Math.floor(Math.random() * 6)];
  return `${pick.name} ${pick.surname}`;
}

function makeAttendance(homeTeam, awayTeam, competitionLabel = 'Liga') {
  const moodFactor = { eufórica: 1.13, contenta: 1.06, expectante: 1, inquieta: 0.92, enfadada: 0.84, 'muy enfadada': 0.76 };
  const rivalry = homeTeam.colors[0] === awayTeam.colors[0] ? 1.08 : 1;
  const prestigeBoost = 0.82 + (homeTeam.prestige + awayTeam.prestige) / 220;
  const competitionBoost = competitionLabel === 'Liga' ? 1 : 1.12;
  const expected = homeTeam.stadium.capacity * prestigeBoost * rivalry * competitionBoost * (moodFactor[homeTeam.fanMood] || 1) * r(0.86, 1.01);
  const attendance = Math.max(3500, Math.min(homeTeam.stadium.capacity, Math.round(expected)));
  const occupancy = Math.round((attendance / homeTeam.stadium.capacity) * 100);
  return { attendance, occupancy };
}

function describeMatch(homeTeam, awayTeam, result) {
  const leader = result.homeGoals === result.awayGoals ? 'reparto de puntos' : result.homeGoals > result.awayGoals ? `victoria de ${homeTeam.name}` : `triunfo de ${awayTeam.name}`;
  return `Partido intenso con ${result.homeShots + result.awayShots} tiros totales y ${leader}. MVP: ${result.mvp}.`;
}

export function simulateMatch(homeTeam, awayTeam, homeLineup, awayLineup, context = {}) {
  const home = buildMetrics(homeTeam, homeLineup, 1.08);
  const away = buildMetrics(awayTeam, awayLineup, 1);
  const diff = (home.rating - away.rating) / 19;

  const homeXg = Math.max(0.2, 1.15 + diff * home.attack + r(-0.4, 0.45));
  const awayXg = Math.max(0.15, 1.05 - diff * away.attack + r(-0.4, 0.4));

  const homeGoals = poissonLike(homeXg);
  const awayGoals = poissonLike(awayXg);

  const homeShots = Math.max(homeGoals + 2, Math.round(homeXg * 5.5 + r(2, 7)));
  const awayShots = Math.max(awayGoals + 2, Math.round(awayXg * 5.4 + r(2, 7)));
  const homeSoT = Math.min(homeShots, Math.max(homeGoals, Math.round(homeShots * r(0.34, 0.56))));
  const awaySoT = Math.min(awayShots, Math.max(awayGoals, Math.round(awayShots * r(0.34, 0.56))));

  const controlTotal = home.control * home.rating + away.control * away.rating;
  const homePossession = Math.round(((home.control * home.rating) / controlTotal) * 100);

  const homeEvents = [
    ...createScorerEvents(homeGoals, weightedPlayers(homeTeam, homeLineup, 'goal'), 'home'),
    ...createDisciplineEvents(homeTeam, homeLineup, 'home'),
    ...createInjuryEvents(homeTeam, homeLineup, 'home'),
  ];
  const awayEvents = [
    ...createScorerEvents(awayGoals, weightedPlayers(awayTeam, awayLineup, 'goal'), 'away'),
    ...createDisciplineEvents(awayTeam, awayLineup, 'away'),
    ...createInjuryEvents(awayTeam, awayLineup, 'away'),
  ];

  const events = [...homeEvents, ...awayEvents].sort((a, b) => minuteValue(a.minute) - minuteValue(b.minute));
  const mvp = pickMvp(homeTeam, awayTeam, events);
  const attendance = makeAttendance(homeTeam, awayTeam, context.competitionLabel || 'Liga');

  return {
    homeGoals,
    awayGoals,
    homePossession,
    awayPossession: 100 - homePossession,
    homeShots,
    awayShots,
    homeShotsOnTarget: homeSoT,
    awayShotsOnTarget: awaySoT,
    events,
    goals: events.filter((event) => event.type === 'goal'),
    cards: events.filter((event) => event.type === 'yellow' || event.type === 'red'),
    injuries: events.filter((event) => event.type === 'injury'),
    mvp,
    attendance,
    summaryText: describeMatch(homeTeam, awayTeam, { homeGoals, awayGoals, homeShots, awayShots, mvp }),
  };
}
