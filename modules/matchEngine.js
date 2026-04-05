const styleMap = {
  'Posesión': { attack: 1.05, control: 1.12 },
  'Ataque directo': { attack: 1.12, control: 0.96 },
  'Presión alta': { attack: 1.09, control: 1.02 },
  'Contraataque': { attack: 1.04, control: 0.95 },
  'Bloque bajo': { attack: 0.92, control: 0.9 },
  'Transiciones': { attack: 1.0, control: 1.0 },
  'Juego físico': { attack: 0.97, control: 0.94 },
};

const r = (min, max) => Math.random() * (max - min) + min;

function teamMetrics(team, isHome) {
  const overall = team.squad.reduce((a, p) => a + p.overall, 0) / team.squad.length;
  const form = team.squad.reduce((a, p) => a + p.form, 0) / team.squad.length;
  const energy = team.squad.reduce((a, p) => a + p.energy, 0) / team.squad.length;
  const style = styleMap[team.style] || styleMap.Transiciones;
  const homeFactor = isHome ? 1.08 : 1;
  return {
    rating: overall * 0.6 + form * 0.22 + energy * 0.18,
    attackFactor: style.attack * homeFactor,
    controlFactor: style.control * (isHome ? 1.05 : 0.97),
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

function pickScorers(team, goals) {
  const weights = { POR: 0.02, DEF: 0.12, MED: 0.3, DEL: 0.56 };
  const bag = team.squad.flatMap((p) => Array(Math.max(1, Math.floor(weights[p.position] * 100))).fill(p));
  const scorers = [];
  for (let i = 0; i < goals; i += 1) {
    const player = bag[Math.floor(Math.random() * bag.length)];
    scorers.push(`${player.name} ${player.surname}`);
  }
  return scorers;
}

export function simulateMatch(homeTeam, awayTeam) {
  const home = teamMetrics(homeTeam, true);
  const away = teamMetrics(awayTeam, false);
  const diff = (home.rating - away.rating) / 18;
  const base = 1.2;

  const homeXg = Math.max(0.2, base + diff * home.attackFactor + r(-0.35, 0.35));
  const awayXg = Math.max(0.15, base - diff * away.attackFactor * 0.9 + r(-0.35, 0.35));

  const homeGoals = poissonLike(homeXg);
  const awayGoals = poissonLike(awayXg);

  const controlTotal = home.controlFactor * home.rating + away.controlFactor * away.rating;
  const homePossession = Math.round(((home.controlFactor * home.rating) / controlTotal) * 100);
  const awayPossession = 100 - homePossession;

  const homeShots = Math.max(homeGoals + 2, Math.round(homeXg * 5 + r(1, 6)));
  const awayShots = Math.max(awayGoals + 2, Math.round(awayXg * 5 + r(1, 6)));

  return {
    homeGoals,
    awayGoals,
    homePossession,
    awayPossession,
    homeShots,
    awayShots,
    homeShotsOnTarget: Math.min(homeShots, Math.max(homeGoals, Math.round(homeShots * r(0.35, 0.53)))),
    awayShotsOnTarget: Math.min(awayShots, Math.max(awayGoals, Math.round(awayShots * r(0.35, 0.53)))),
    homeScorers: pickScorers(homeTeam, homeGoals),
    awayScorers: pickScorers(awayTeam, awayGoals),
  };
}
