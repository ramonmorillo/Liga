const severityMap = {
  leve: { key: 'injured', label: 'Lesión temporal', icon: '🩹', weeks: [1, 2] },
  moderada: { key: 'injured', label: 'Lesión temporal', icon: '🩹', weeks: [2, 4] },
  grave: { key: 'injured-serious', label: 'Lesión grave', icon: '🚑', weeks: [6, 12] },
};

const statusPriority = ['injured-serious', 'injured', 'declining', 'improving', 'stable'];

const statusMeta = {
  improving: { icon: '📈', label: 'Mejorando' },
  declining: { icon: '📉', label: 'Empeorando' },
  injured: { icon: '🩹', label: 'Lesión temporal' },
  'injured-serious': { icon: '🚑', label: 'Lesión grave' },
  stable: { icon: '⏺️', label: 'Estable' },
};

const ri = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function trendFromPlayer(player) {
  const current = player.overall + player.form * 0.14 + player.morale * 0.1;
  const baseline = (player.previousOverall ?? player.overall) + (player.previousForm ?? player.form) * 0.14 + (player.previousMorale ?? player.morale) * 0.1;
  const delta = current - baseline;
  if (delta >= 2.1) return 'improving';
  if (delta <= -1.5) return 'declining';
  return 'stable';
}

export function ensurePlayerStatus(player) {
  if (!player.playerStatus) {
    player.playerStatus = {
      trend: 'stable',
      injurySeverity: null,
      injuryGamesRemaining: 0,
      current: 'stable',
      lastUpdatedSeason: null,
    };
  }

  if (typeof player.playerStatus.injuryGamesRemaining !== 'number') player.playerStatus.injuryGamesRemaining = 0;
  if (!player.playerStatus.trend) player.playerStatus.trend = 'stable';
  if (!player.playerStatus.current) player.playerStatus.current = 'stable';
  return player.playerStatus;
}

export function computePlayerStatus(player) {
  const status = ensurePlayerStatus(player);
  const trend = trendFromPlayer(player);
  status.trend = trend;

  const candidates = [];
  if (status.injuryGamesRemaining > 0) {
    candidates.push(status.injurySeverity === 'grave' ? 'injured-serious' : 'injured');
  }
  if (trend === 'declining') candidates.push('declining');
  if (trend === 'improving') candidates.push('improving');
  candidates.push('stable');

  status.current = [...new Set(candidates)].sort((a, b) => statusPriority.indexOf(a) - statusPriority.indexOf(b))[0] || 'stable';
  return status.current;
}

export function applyPlayerInjury(player, severity = 'leve') {
  const status = ensurePlayerStatus(player);
  const config = severityMap[severity] || severityMap.leve;
  status.injurySeverity = severity;
  status.injuryGamesRemaining = Math.max(status.injuryGamesRemaining, ri(config.weeks[0], config.weeks[1]));
  computePlayerStatus(player);
}

export function tickInjuries(state) {
  const teams = [...(state.firstDivision || []), ...(state.secondDivision || [])];
  teams.forEach((team) => {
    team.squad.forEach((player) => {
      const status = ensurePlayerStatus(player);
      if (status.injuryGamesRemaining > 0) {
        status.injuryGamesRemaining -= 1;
        if (status.injuryGamesRemaining <= 0) {
          status.injuryGamesRemaining = 0;
          status.injurySeverity = null;
        }
      }
      computePlayerStatus(player);
    });
  });
}

export function buildPlayerStatusBadge(player) {
  const key = computePlayerStatus(player);
  const meta = statusMeta[key] || statusMeta.stable;
  return { key, ...meta };
}
