import { ensurePlayerStatus } from './playerStatus.js';

export const FORMATIONS = {
  '4-3-3': { POR: 1, DEF: 4, MED: 3, DEL: 3 },
  '4-4-2': { POR: 1, DEF: 4, MED: 4, DEL: 2 },
  '4-2-3-1': { POR: 1, DEF: 4, MED: 5, DEL: 1 },
};

export function autoPickLineup(team, formation = team.tactics?.formation || '4-3-3') {
  const shape = FORMATIONS[formation] || FORMATIONS['4-3-3'];
  const starters = [];
  Object.entries(shape).forEach(([position, amount]) => {
    const options = team.squad
      .filter((player) => {
        const status = ensurePlayerStatus(player);
        return player.position === position && status.injuryGamesRemaining <= 0;
      })
      .sort((a, b) => playerScore(b) - playerScore(a))
      .slice(0, amount)
      .map((player) => player.id);
    starters.push(...options);
  });

  const bench = team.squad
    .filter((player) => {
      const status = ensurePlayerStatus(player);
      return !starters.includes(player.id) && status.injuryGamesRemaining <= 0;
    })
    .sort((a, b) => playerScore(b) - playerScore(a))
    .slice(0, 7)
    .map((player) => player.id);

  return { formation, starters, bench };
}

export function validateLineup(team, lineup) {
  const shape = FORMATIONS[lineup.formation] || FORMATIONS['4-3-3'];
  if (lineup.starters.length !== 11) return false;
  const count = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
  lineup.starters.forEach((id) => {
    const player = team.squad.find((item) => item.id === id);
    if (player) count[player.position] += 1;
  });
  return Object.entries(shape).every(([position, needed]) => count[position] === needed);
}

export function lineupStrength(team, lineup) {
  const starters = lineup.starters.map((id) => team.squad.find((player) => player.id === id)).filter(Boolean);
  if (!starters.length) return team.strength;
  return starters.reduce((total, player) => total + playerScore(player), 0) / starters.length;
}

export function playerScore(player) {
  return player.overall * 0.62 + player.form * 0.18 + player.energy * 0.12 + player.morale * 0.08;
}
