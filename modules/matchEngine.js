import { lineupStrength } from './lineups.js';

const styleMap = {
  'Posesión': { attack: 1.05, control: 1.12 },
  'Ataque directo': { attack: 1.12, control: 0.96 },
  'Presión alta': { attack: 1.09, control: 1.02 },
  Contraataque: { attack: 1.04, control: 0.95 },
  'Bloque bajo': { attack: 0.92, control: 0.9 },
  Transiciones: { attack: 1.0, control: 1.0 },
  'Juego físico': { attack: 0.97, control: 0.94 },
};

const r = (min, max) => Math.random() * (max - min) + min;

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

function weightedScorers(team, lineup) {
  const starters = lineup.starters.map((id) => team.squad.find((player) => player.id === id)).filter(Boolean);
  const weights = { POR: 1, DEF: 8, MED: 20, DEL: 38 };
  return starters.flatMap((player) => Array(Math.max(1, weights[player.position] + Math.floor(player.overall / 4))).fill(player));
}

function createScorerEvents(goalCount, bag) {
  const events = [];
  for (let i = 0; i < goalCount; i += 1) {
    const player = bag[Math.floor(Math.random() * bag.length)];
    events.push({
      minute: Math.floor(r(3, 93)),
      playerId: player.id,
      playerName: `${player.name} ${player.surname}`,
    });
  }
  events.sort((a, b) => a.minute - b.minute);
  return events;
}

function pickMvp(homeTeam, awayTeam, allGoalEvents) {
  if (allGoalEvents.length) {
    const top = allGoalEvents[Math.floor(Math.random() * Math.min(2, allGoalEvents.length))];
    return top.playerName;
  }
  const allPlayers = [...homeTeam.squad, ...awayTeam.squad].sort((a, b) => b.overall - a.overall);
  const pick = allPlayers[Math.floor(Math.random() * 6)];
  return `${pick.name} ${pick.surname}`;
}

export function simulateMatch(homeTeam, awayTeam, homeLineup, awayLineup) {
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

  const homeEvents = createScorerEvents(homeGoals, weightedScorers(homeTeam, homeLineup)).map((event) => ({ ...event, side: 'home' }));
  const awayEvents = createScorerEvents(awayGoals, weightedScorers(awayTeam, awayLineup)).map((event) => ({ ...event, side: 'away' }));
  const events = [...homeEvents, ...awayEvents].sort((a, b) => a.minute - b.minute);

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
    mvp: pickMvp(homeTeam, awayTeam, events),
  };
}
