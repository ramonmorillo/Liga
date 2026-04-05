import { allTeams, createYouthPlayer, getTeamById } from './state.js';

const EU_COUNTRIES = new Set(['España', 'Francia', 'Alemania', 'Italia', 'Portugal', 'Países Bajos', 'Bélgica', 'Croacia']);

const profileTargets = {
  gigante: ['DEL', 'MED'],
  cantera: ['MED', 'DEF'],
  modesto: ['DEF', 'MED'],
  defensivo: ['POR', 'DEF'],
  ofensivo: ['DEL', 'MED'],
};

export function isTransferWindowOpen(state) {
  return state.transferWindow === 'summer' || state.transferWindow === 'winter';
}

export function isNonEu(player) {
  return player.nonEu || !EU_COUNTRIES.has(player.nationality);
}

export function countNonEu(team) {
  return team.squad.filter(isNonEu).length;
}

export function getMarketPlayers(state, filters = {}) {
  const userId = state.userTeamId;
  const players = allTeams(state)
    .filter((team) => team.id !== userId)
    .flatMap((team) => team.squad.map((player) => ({ ...player, teamId: team.id, teamName: team.name })));

  return players.filter((player) => {
    if (filters.position && player.position !== filters.position) return false;
    if (filters.minOverall && player.overall < Number(filters.minOverall)) return false;
    if (filters.maxAge && player.age > Number(filters.maxAge)) return false;
    if (filters.nationality && player.nationality !== filters.nationality) return false;
    if (filters.onlyClauses === '1' && player.clause <= player.value * 2.7) return false;
    if (filters.extracom === '1' && !isNonEu(player)) return false;
    return true;
  });
}

function recordMovement(state, payload) {
  state.transferHistory.unshift(payload);
  state.transferHistory = state.transferHistory.slice(0, 220);
}

function recordTeamMovement(team, payload) {
  team.marketHistory = team.marketHistory || [];
  team.marketHistory.unshift(payload);
  team.marketHistory = team.marketHistory.slice(0, 220);
}

function asNews(state, message, importance = 'media') {
  state.recentNews.unshift({
    season: state.season,
    matchday: state.currentMatchday,
    type: 'transfer',
    text: message,
    importance,
    dateLabel: `Temporada ${state.season} · Jornada ${state.currentMatchday}`,
  });
  state.recentNews = state.recentNews.slice(0, 120);
}

export function transferPlayer(state, fromTeamId, toTeamId, playerId, payClause = false) {
  const fromTeam = getTeamById(state, fromTeamId);
  const toTeam = getTeamById(state, toTeamId);
  if (!fromTeam || !toTeam) return { ok: false, message: 'Equipos no válidos' };
  if (!isTransferWindowOpen(state)) return { ok: false, message: 'Mercado cerrado' };

  const player = fromTeam.squad.find((item) => item.id === playerId);
  if (!player) return { ok: false, message: 'Jugador no encontrado' };
  if (countNonEu(toTeam) >= 3 && isNonEu(player)) return { ok: false, message: 'Límite de 3 extracomunitarios alcanzado' };
  if (toTeam.squad.length >= 30) return { ok: false, message: 'Plantilla compradora llena' };
  if (fromTeam.squad.length <= 18) return { ok: false, message: 'Plantilla vendedora insuficiente' };

  const marketPrice = Math.round(player.value * (1 + Math.random() * 0.18));
  const transferFee = payClause ? player.clause : marketPrice;
  if (toTeam.budget < transferFee) return { ok: false, message: 'Presupuesto insuficiente' };

  toTeam.budget -= transferFee;
  fromTeam.budget += transferFee;
  toTeam.finances.transferOut += transferFee;
  fromTeam.finances.transferIn += transferFee;

  fromTeam.squad = fromTeam.squad.filter((item) => item.id !== playerId);
  toTeam.squad.push(player);
  player.history.clubs.push(toTeam.id);

  const movement = {
    season: state.season,
    year: state.year,
    window: state.transferWindow,
    type: 'transfer',
    playerName: `${player.name} ${player.surname}`,
    fromTeamId: fromTeam.id,
    fromTeamName: fromTeam.name,
    toTeamId: toTeam.id,
    toTeamName: toTeam.name,
    origin: fromTeam.name,
    destination: toTeam.name,
    operation: 'Traspaso',
    fee: transferFee,
    clauseExecuted: payClause,
    notable: transferFee > 22000000 || payClause,
  };
  recordMovement(state, movement);
  recordTeamMovement(toTeam, {
    ...movement,
    operation: 'Fichaje',
    note: `Llega desde ${fromTeam.name}`,
    teamId: toTeam.id,
    teamName: toTeam.name,
  });
  recordTeamMovement(fromTeam, {
    ...movement,
    operation: 'Venta',
    note: `Sale hacia ${toTeam.name}`,
    teamId: fromTeam.id,
    teamName: fromTeam.name,
  });

  if (movement.notable) {
    asNews(state, `${movement.playerName} ficha por ${toTeam.name} por ${transferFee.toLocaleString('es-ES')}€${payClause ? ' (cláusula)' : ''}.`, 'alta');
  }

  return {
    ok: true,
    message: payClause ? `Cláusula pagada por €${transferFee.toLocaleString('es-ES')}` : `Fichaje cerrado por €${transferFee.toLocaleString('es-ES')}`,
  };
}

export function runAiTransferWindow(state) {
  const teams = allTeams(state).filter((team) => team.id !== state.userTeamId);
  teams.forEach((buyer) => {
    if (Math.random() > (state.transferWindow === 'summer' ? 0.35 : 0.17)) return;

    const positions = profileTargets[buyer.profile] || ['MED'];
    const targetPosition = positions[Math.floor(Math.random() * positions.length)];
    const market = allTeams(state)
      .filter((seller) => seller.id !== buyer.id)
      .flatMap((seller) => seller.squad.map((player) => ({ player, seller })))
      .filter(({ player, seller }) => player.position === targetPosition && seller.squad.length > 19)
      .sort((a, b) => b.player.potential - a.player.potential)
      .slice(0, 20);

    const target = market.find(({ player }) => {
      if (countNonEu(buyer) >= 3 && isNonEu(player)) return false;
      const fee = Math.min(player.clause, Math.round(player.value * 1.12));
      return fee <= buyer.budget;
    });

    if (!target) return;
    transferPlayer(state, target.seller.id, buyer.id, target.player.id, Math.random() < 0.3);
  });
}


export function releasePlayer(state, teamId, playerId) {
  const team = getTeamById(state, teamId);
  if (!team) return { ok: false, message: 'Equipo no encontrado' };

  const player = team.squad.find((item) => item.id === playerId);
  if (!player) return { ok: false, message: 'Jugador no encontrado' };

  const minimumSquad = 18;
  if (team.squad.length <= minimumSquad) return { ok: false, message: `Plantilla mínima (${minimumSquad}) alcanzada` };

  const requiredByPosition = { POR: 2, DEF: 6, MED: 6, DEL: 4 };
  const byPosition = (position) => team.squad.filter((p) => p.position === position).length;
  if (byPosition(player.position) <= requiredByPosition[player.position]) {
    return { ok: false, message: `No puedes liberar al último cupo funcional de ${player.position}` };
  }

  const remainingContractYears = Math.max(0, (player.contractEndYear || state.year) - state.year);
  const compensation = Math.round(player.value * (remainingContractYears > 0 ? 0.12 + remainingContractYears * 0.04 : 0.06));
  if (team.budget < compensation) return { ok: false, message: 'Presupuesto insuficiente para rescisión' };

  team.budget -= compensation;
  team.squad = team.squad.filter((item) => item.id !== player.id);

  const movement = {
    season: state.season,
    year: state.year,
    window: state.transferWindow,
    type: 'release',
    operation: 'Carta de libertad',
    playerName: `${player.name} ${player.surname}`,
    fromTeamId: team.id,
    fromTeamName: team.name,
    toTeamId: null,
    toTeamName: 'Libre',
    origin: team.name,
    destination: 'Agente libre',
    fee: -compensation,
    note: `Rescisión por bajo rendimiento (${player.form}/100 de forma)`,
  };

  recordMovement(state, movement);
  recordTeamMovement(team, { ...movement, teamId: team.id, teamName: team.name });
  team.financialHistory = team.financialHistory || [];
  team.financialHistory.unshift({
    id: `release-${state.season}-${team.id}-${player.id}`,
    season: state.season,
    year: state.year,
    matchday: state.currentMatchday,
    type: 'release',
    amount: -compensation,
    text: `Carta de libertad de ${player.name} ${player.surname}`,
  });
  team.financialHistory = team.financialHistory.slice(0, 120);

  const mustPromote = team.squad.length < 24 || byPosition(player.position) < requiredByPosition[player.position];
  if (mustPromote) {
    const youth = createYouthPlayer(team, state.year, player.position);
    team.squad.push(youth);
    recordTeamMovement(team, {
      season: state.season,
      year: state.year,
      type: 'youth-promotion',
      operation: 'Promoción',
      playerName: `${youth.name} ${youth.surname}`,
      origin: 'Cantera',
      destination: team.name,
      fee: 0,
      note: 'Promoción automática para cubrir baja tras carta de libertad',
    });
  }

  asNews(state, `${team.name} concede la carta de libertad a ${player.name} ${player.surname}.`, 'media');
  return { ok: true, message: `Carta de libertad ejecutada. Coste: €${compensation.toLocaleString('es-ES')}` };
}
