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

export function isPlayerMarketEligible(player, stateYear) {
  if (!player) return false;
  if (player.intransferible) return false;
  if (player.playerStatus?.current === 'lesión grave') return false;
  if (typeof player.contractEndYear !== 'number') return false;
  const yearsLeft = Math.max(0, player.contractEndYear - stateYear);
  return yearsLeft <= 1;
}

export function getMarketPlayers(state, filters = {}) {
  const userId = state.userTeamId;
  const players = allTeams(state)
    .filter((team) => team.id !== userId)
    .flatMap((team) => team.squad.map((player) => ({ ...player, teamId: team.id, teamName: team.name })));

  return players.filter((player) => {
    if (!isPlayerMarketEligible(player, state.year)) return false;
    if (filters.position && player.position !== filters.position) return false;
    if (filters.minOverall && player.overall < Number(filters.minOverall)) return false;
    if (filters.maxAge && player.age > Number(filters.maxAge)) return false;
    if (filters.nationality && player.nationality !== filters.nationality) return false;
    if (filters.onlyClauses === '1' && player.clause <= player.value * 2.7) return false;
    if (filters.extracom === '1' && !isNonEu(player)) return false;
    return true;
  });
}

function makeOfferId(state, sellerTeamId, buyerTeamId, playerId) {
  return `offer-${state.season}-${state.currentMatchday}-${sellerTeamId}-${buyerTeamId}-${playerId}-${Math.random().toString(36).slice(2, 7)}`;
}

function ensureOffers(state) {
  if (!Array.isArray(state.transferOffers)) state.transferOffers = [];
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
  if (!isPlayerMarketEligible(player, state.year)) return { ok: false, message: 'Jugador no disponible: no está en último año de contrato' };
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

function transferPlayerByOffer(state, fromTeamId, toTeamId, playerId, offeredAmount) {
  const fromTeam = getTeamById(state, fromTeamId);
  const toTeam = getTeamById(state, toTeamId);
  if (!fromTeam || !toTeam) return { ok: false, message: 'Equipos no válidos' };
  if (!isTransferWindowOpen(state)) return { ok: false, message: 'Mercado cerrado' };

  const player = fromTeam.squad.find((item) => item.id === playerId);
  if (!player) return { ok: false, message: 'Jugador no encontrado' };
  if (!isPlayerMarketEligible(player, state.year)) return { ok: false, message: 'Jugador no disponible: no está en último año de contrato' };
  if (countNonEu(toTeam) >= 3 && isNonEu(player)) return { ok: false, message: 'Límite de 3 extracomunitarios alcanzado' };
  if (toTeam.squad.length >= 30) return { ok: false, message: 'Plantilla compradora llena' };
  if (fromTeam.squad.length <= 18) return { ok: false, message: 'Plantilla vendedora insuficiente' };

  const transferFee = Math.max(1, Math.round(offeredAmount || player.value));
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
    clauseExecuted: false,
    notable: transferFee > 22000000,
  };
  recordMovement(state, movement);
  recordTeamMovement(toTeam, { ...movement, operation: 'Fichaje', note: `Llega desde ${fromTeam.name}`, teamId: toTeam.id, teamName: toTeam.name });
  recordTeamMovement(fromTeam, { ...movement, operation: 'Venta', note: `Sale hacia ${toTeam.name}`, teamId: fromTeam.id, teamName: fromTeam.name });

  if (movement.notable) asNews(state, `${movement.playerName} ficha por ${toTeam.name} por ${transferFee.toLocaleString('es-ES')}€.`, 'alta');
  return { ok: true, message: `Fichaje cerrado por €${transferFee.toLocaleString('es-ES')}` };
}

export function createTransferOffer(state, sellerTeamId, buyerTeamId, playerId, offeredAmount) {
  ensureOffers(state);
  const seller = getTeamById(state, sellerTeamId);
  const buyer = getTeamById(state, buyerTeamId);
  if (!seller || !buyer) return { ok: false, message: 'Equipos no válidos' };
  if (!isTransferWindowOpen(state)) return { ok: false, message: 'Mercado cerrado' };
  if (seller.id === buyer.id) return { ok: false, message: 'No puedes ofertar por tu propio jugador' };

  const player = seller.squad.find((item) => item.id === playerId);
  if (!player) return { ok: false, message: 'Jugador no encontrado' };
  if (!isPlayerMarketEligible(player, state.year)) return { ok: false, message: 'Jugador no está en mercado' };
  if (countNonEu(buyer) >= 3 && isNonEu(player)) return { ok: false, message: 'Límite de 3 extracomunitarios alcanzado' };

  const amount = Math.max(1, Math.round(Number(offeredAmount) || Math.round(player.value * 1.05)));
  if (amount > buyer.budget) return { ok: false, message: 'Presupuesto insuficiente para esa oferta' };

  const duplicatePending = state.transferOffers.find((offer) => offer.status === 'pending' && offer.sellerTeamId === seller.id
    && offer.buyerTeamId === buyer.id && offer.playerId === player.id);
  if (duplicatePending) return { ok: false, message: 'Ya existe una oferta pendiente para este jugador y club' };

  const offer = {
    id: makeOfferId(state, seller.id, buyer.id, player.id),
    season: state.season,
    matchday: state.currentMatchday,
    status: 'pending',
    sellerTeamId: seller.id,
    sellerTeamName: seller.name,
    buyerTeamId: buyer.id,
    buyerTeamName: buyer.name,
    playerId: player.id,
    playerName: `${player.name} ${player.surname}`,
    playerPosition: player.position,
    playerAge: player.age,
    playerValue: player.value,
    playerContractEndYear: player.contractEndYear,
    amount,
    createdAt: Date.now(),
    resolvedAt: null,
  };
  state.transferOffers.unshift(offer);
  state.transferOffers = state.transferOffers.slice(0, 400);
  return { ok: true, message: `Oferta enviada por €${amount.toLocaleString('es-ES')}` };
}

export function resolveTransferOffer(state, offerId, decision = 'reject') {
  ensureOffers(state);
  const offer = state.transferOffers.find((item) => item.id === offerId);
  if (!offer) return { ok: false, message: 'Oferta no encontrada' };
  if (offer.status !== 'pending') return { ok: false, message: 'La oferta ya fue resuelta' };
  const seller = getTeamById(state, offer.sellerTeamId);
  if (!seller) return { ok: false, message: 'Equipo vendedor no encontrado' };

  if (decision === 'accept') {
    const result = transferPlayerByOffer(state, offer.sellerTeamId, offer.buyerTeamId, offer.playerId, offer.amount);
    if (!result.ok) return result;
    offer.status = 'accepted';
    offer.resolvedAt = Date.now();
    return { ok: true, message: result.message };
  }

  offer.status = 'rejected';
  offer.resolvedAt = Date.now();
  return { ok: true, message: 'Oferta rechazada' };
}

export function getTeamOffers(state, teamId) {
  ensureOffers(state);
  return state.transferOffers.filter((offer) => offer.sellerTeamId === teamId);
}

function shouldAiAcceptOffer(state, offer) {
  const seller = getTeamById(state, offer.sellerTeamId);
  if (!seller) return false;
  const player = seller.squad.find((item) => item.id === offer.playerId);
  if (!player) return false;
  const yearsLeft = Math.max(0, (player.contractEndYear || state.year) - state.year);
  const pressure = player.age >= 30 ? 0.08 : 0;
  const contractPressure = yearsLeft === 0 ? 0.17 : yearsLeft === 1 ? 0.08 : 0;
  const qualityPenalty = player.overall >= 84 ? 0.08 : 0;
  const ratio = offer.amount / Math.max(1, player.value);
  const threshold = 1.03 + qualityPenalty - pressure - contractPressure;
  return ratio >= threshold;
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
      .filter(({ player }) => isPlayerMarketEligible(player, state.year))
      .sort((a, b) => b.player.potential - a.player.potential)
      .slice(0, 20);

    const target = market.find(({ player }) => {
      if (countNonEu(buyer) >= 3 && isNonEu(player)) return false;
      const fee = Math.min(player.clause, Math.round(player.value * 1.12));
      return fee <= buyer.budget;
    });

    if (!target) return;
    const offeredAmount = Math.min(target.player.clause, Math.round(target.player.value * (1.02 + Math.random() * 0.2)));
    createTransferOffer(state, target.seller.id, buyer.id, target.player.id, offeredAmount);
  });

  ensureOffers(state);
  state.transferOffers
    .filter((offer) => offer.status === 'pending')
    .forEach((offer) => {
      const sellerIsUserTeam = offer.sellerTeamId === state.userTeamId;
      if (sellerIsUserTeam) return;
      const decision = shouldAiAcceptOffer(state, offer) ? 'accept' : 'reject';
      resolveTransferOffer(state, offer.id, decision);
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
