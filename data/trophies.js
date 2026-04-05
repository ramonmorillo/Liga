export const competitions = {
  league: { key: 'league', name: 'Liga Nacional', icon: '🏆', accent: '#ffd166', type: 'league', division: 1 },
  league2: { key: 'league2', name: 'Liga Segunda', icon: '🥈', accent: '#c9d6ea', type: 'league', division: 2 },
  cup: { key: 'cup', name: 'Copa Nacional', icon: '🏅', accent: '#ff8fab', type: 'domestic-cup' },
  supercup: { key: 'supercup', name: 'Supercopa Nacional', icon: '🛡️', accent: '#f7b267', type: 'supercup' },
  champions: { key: 'champions', name: 'Copa de Campeones', icon: '⭐', accent: '#8ecae6', type: 'international-major' },
  cupWinners: { key: 'cupWinners', name: 'Copa de Campeones de Copa', icon: '👑', accent: '#bde0fe', type: 'international-secondary' },
  continental2: { key: 'continental2', name: 'Copa Imperial Europea', icon: '🌍', accent: '#caffbf', type: 'international-secondary' },
  internationalSupercup: { key: 'internationalSupercup', name: 'Supercopa Internacional', icon: '🚀', accent: '#b8f2e6', type: 'supercup-international' },
};

const keyAliases = {
  firstDivision: 'league',
  secondDivision: 'league2',
  copa: 'cup',
};

export function resolveCompetitionKey(rawKey) {
  if (!rawKey) return 'league';
  return competitions[rawKey] ? rawKey : keyAliases[rawKey] || 'league';
}

export function getCompetitionTrophy(rawKey) {
  return competitions[resolveCompetitionKey(rawKey)] || competitions.league;
}
