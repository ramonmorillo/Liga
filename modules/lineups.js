import { ensurePlayerStatus } from './playerStatus.js';
import { ensureSpecificPosition, generalFromSpecific } from './positions.js';

export const FORMATIONS = {
  '4-3-3': { POR: 1, DEF: 4, MED: 3, DEL: 3 },
  '4-4-2': { POR: 1, DEF: 4, MED: 4, DEL: 2 },
  '4-2-3-1': { POR: 1, DEF: 4, MED: 5, DEL: 1 },
  '3-5-2': { POR: 1, DEF: 3, MED: 5, DEL: 2 },
};

const FORMATION_LAYOUTS = {
  '4-3-3': [
    { slotId: 'GK', role: 'POR', position: 'POR', x: 50, y: 92 },
    { slotId: 'LB', role: 'LI', position: 'DEF', x: 18, y: 74 },
    { slotId: 'LCB', role: 'DFC', position: 'DEF', x: 38, y: 78 },
    { slotId: 'RCB', role: 'DFC', position: 'DEF', x: 62, y: 78 },
    { slotId: 'RB', role: 'LD', position: 'DEF', x: 82, y: 74 },
    { slotId: 'LCM', role: 'MC', position: 'MED', x: 34, y: 56 },
    { slotId: 'CM', role: 'MCD', position: 'MED', x: 50, y: 60 },
    { slotId: 'RCM', role: 'MC', position: 'MED', x: 66, y: 56 },
    { slotId: 'LW', role: 'EI', position: 'DEL', x: 24, y: 30 },
    { slotId: 'ST', role: 'DC', position: 'DEL', x: 50, y: 24 },
    { slotId: 'RW', role: 'ED', position: 'DEL', x: 76, y: 30 },
  ],
  '4-4-2': [
    { slotId: 'GK', role: 'POR', position: 'POR', x: 50, y: 92 },
    { slotId: 'LB', role: 'LI', position: 'DEF', x: 18, y: 74 },
    { slotId: 'LCB', role: 'DFC', position: 'DEF', x: 38, y: 78 },
    { slotId: 'RCB', role: 'DFC', position: 'DEF', x: 62, y: 78 },
    { slotId: 'RB', role: 'LD', position: 'DEF', x: 82, y: 74 },
    { slotId: 'LM', role: 'MI', position: 'MED', x: 20, y: 50 },
    { slotId: 'LCM', role: 'MC', position: 'MED', x: 40, y: 56 },
    { slotId: 'RCM', role: 'MC', position: 'MED', x: 60, y: 56 },
    { slotId: 'RM', role: 'MD', position: 'MED', x: 80, y: 50 },
    { slotId: 'LS', role: 'SD', position: 'DEL', x: 42, y: 28 },
    { slotId: 'RS', role: 'DC', position: 'DEL', x: 58, y: 28 },
  ],
  '4-2-3-1': [
    { slotId: 'GK', role: 'POR', position: 'POR', x: 50, y: 92 },
    { slotId: 'LB', role: 'LI', position: 'DEF', x: 18, y: 74 },
    { slotId: 'LCB', role: 'DFC', position: 'DEF', x: 38, y: 78 },
    { slotId: 'RCB', role: 'DFC', position: 'DEF', x: 62, y: 78 },
    { slotId: 'RB', role: 'LD', position: 'DEF', x: 82, y: 74 },
    { slotId: 'LDM', role: 'MCD', position: 'MED', x: 38, y: 62 },
    { slotId: 'RDM', role: 'MCD', position: 'MED', x: 62, y: 62 },
    { slotId: 'LAM', role: 'MCO', position: 'MED', x: 28, y: 42 },
    { slotId: 'CAM', role: 'MCO', position: 'MED', x: 50, y: 38 },
    { slotId: 'RAM', role: 'MCO', position: 'MED', x: 72, y: 42 },
    { slotId: 'ST', role: 'DC', position: 'DEL', x: 50, y: 24 },
  ],
  '3-5-2': [
    { slotId: 'GK', role: 'POR', position: 'POR', x: 50, y: 92 },
    { slotId: 'LCB', role: 'DFC', position: 'DEF', x: 30, y: 76 },
    { slotId: 'CB', role: 'DFC', position: 'DEF', x: 50, y: 80 },
    { slotId: 'RCB', role: 'DFC', position: 'DEF', x: 70, y: 76 },
    { slotId: 'LWB', role: 'CAI', position: 'MED', x: 14, y: 52 },
    { slotId: 'LCM', role: 'MC', position: 'MED', x: 34, y: 56 },
    { slotId: 'CM', role: 'MCD', position: 'MED', x: 50, y: 60 },
    { slotId: 'RCM', role: 'MC', position: 'MED', x: 66, y: 56 },
    { slotId: 'RWB', role: 'CAD', position: 'MED', x: 86, y: 52 },
    { slotId: 'LS', role: 'SD', position: 'DEL', x: 42, y: 28 },
    { slotId: 'RS', role: 'DC', position: 'DEL', x: 58, y: 28 },
  ],
};

function getLayout(formation) {
  return FORMATION_LAYOUTS[formation] || FORMATION_LAYOUTS['4-3-3'];
}

function roleCompatibility(player, slot) {
  if (!player || !slot) return 0.4;
  ensureSpecificPosition(player);
  if (player.specificPosition === slot.role) return 1;
  if (player.position === slot.position) return 0.9;
  if (generalFromSpecific(player.specificPosition) === slot.position) return 0.86;
  if (slot.position === 'MED' && player.position === 'DEL') return 0.78;
  if (slot.position === 'DEL' && player.position === 'MED') return 0.82;
  if (slot.position === 'DEF' && player.position === 'MED') return 0.68;
  if (slot.position === 'MED' && player.position === 'DEF') return 0.74;
  if (slot.position === 'POR') return player.position === 'POR' ? 1 : 0.15;
  return 0.52;
}

function playerSlotScore(player, slot) {
  return playerScore(player) * roleCompatibility(player, slot);
}

export function autoPickLineup(team, formation = team.tactics?.formation || '4-3-3') {
  const resolvedFormation = FORMATIONS[formation] ? formation : '4-3-3';
  const fitPlayers = team.squad
    .filter((player) => ensurePlayerStatus(player).injuryGamesRemaining <= 0)
    .sort((a, b) => playerScore(b) - playerScore(a));
  const used = new Set();
  const starterSlots = getLayout(resolvedFormation).map((slot) => {
    const best = fitPlayers
      .filter((player) => !used.has(player.id))
      .sort((a, b) => playerSlotScore(b, slot) - playerSlotScore(a, slot))[0];
    if (best) used.add(best.id);
    return {
      ...slot,
      playerId: best?.id || null,
      adaptation: best ? roleCompatibility(best, slot) : 0,
    };
  });

  const starters = starterSlots.map((slot) => slot.playerId).filter(Boolean);
  const bench = fitPlayers
    .filter((player) => !used.has(player.id))
    .sort((a, b) => playerScore(b) - playerScore(a))
    .slice(0, 7)
    .map((player) => player.id);

  return { formation: resolvedFormation, starters, bench, starterSlots };
}

export function validateLineup(team, lineup) {
  if (!lineup?.starters?.length) return false;
  if (lineup.starters.length !== 11) return false;
  const unique = new Set(lineup.starters);
  if (unique.size !== 11) return false;
  return lineup.starters.every((id) => team.squad.some((player) => player.id === id));
}

export function ensureLineupSlots(team) {
  if (!team?.lineup) {
    team.lineup = autoPickLineup(team, team?.tactics?.formation);
    return team.lineup;
  }
  const hasValidSlots = Array.isArray(team.lineup.starterSlots)
    && team.lineup.starterSlots.length === 11
    && team.lineup.starterSlots.every((slot) => slot?.slotId && 'x' in slot && 'y' in slot);
  if (hasValidSlots) return team.lineup;
  team.lineup = autoPickLineup(team, team.lineup.formation || team.tactics?.formation || '4-3-3');
  return team.lineup;
}

export function swapLineupPlayer(team, slotId, incomingPlayerId) {
  const lineup = ensureLineupSlots(team);
  const slot = lineup.starterSlots.find((entry) => entry.slotId === slotId);
  const incoming = team.squad.find((player) => player.id === incomingPlayerId);
  if (!slot || !incoming) return { ok: false, message: 'Cambio no válido' };
  if (ensurePlayerStatus(incoming).injuryGamesRemaining > 0) return { ok: false, message: 'Jugador lesionado' };

  const currentStarterId = slot.playerId;
  const outgoing = team.squad.find((player) => player.id === currentStarterId);
  const occupiedSlot = lineup.starterSlots.find((entry) => entry.playerId === incomingPlayerId);
  if (occupiedSlot) occupiedSlot.playerId = currentStarterId;
  slot.playerId = incomingPlayerId;
  slot.adaptation = roleCompatibility(incoming, slot);

  lineup.starters = lineup.starterSlots.map((entry) => entry.playerId).filter(Boolean);
  lineup.bench = team.squad
    .filter((player) => !lineup.starters.includes(player.id) && ensurePlayerStatus(player).injuryGamesRemaining <= 0)
    .sort((a, b) => playerScore(b) - playerScore(a))
    .slice(0, 9)
    .map((player) => player.id);

  return {
    ok: true,
    message: 'Cambio aplicado',
    adaptation: slot.adaptation,
    outgoingPlayerId: outgoing?.id || null,
    incomingPlayerId: incoming.id,
  };
}

export function lineupStrength(team, lineup) {
  const starters = lineup.starters.map((id) => team.squad.find((player) => player.id === id)).filter(Boolean);
  if (!starters.length) return team.strength;
  return starters.reduce((total, player) => total + playerScore(player), 0) / starters.length;
}

export function playerScore(player) {
  return player.overall * 0.62 + player.form * 0.18 + player.energy * 0.12 + player.morale * 0.08;
}

export function getCoachTacticalFit(team, lineup = team?.lineup) {
  if (!team || !lineup) return { fit: 0.75, penalty: 1, reason: 'Sin datos' };
  if (!team.coach) return { fit: 0.5, penalty: 0.86, reason: 'Sin entrenador' };

  const preferredByStyle = {
    'posesión ofensiva': ['4-3-3', '4-2-3-1'],
    'bloque medio': ['4-4-2', '4-2-3-1'],
    'pressing intenso': ['4-3-3', '3-5-2'],
    'transiciones rápidas': ['4-4-2', '3-5-2'],
    'defensa táctica': ['4-4-2', '3-5-2'],
  };
  const style = team.coach.style || 'bloque medio';
  const preferred = preferredByStyle[style] || ['4-3-3'];
  const formationFit = preferred.includes(lineup.formation) ? 1 : 0.8;
  const slots = lineup.starterSlots || [];
  const adaptationFit = slots.length ? slots.reduce((sum, slot) => sum + (slot.adaptation || 0), 0) / slots.length : 0.86;
  const cohesion = Math.min(1.02, Math.max(0.85, 0.88 + (team.coach.rating || 70) / 700));
  const fit = Math.max(0.55, Math.min(1.02, formationFit * 0.5 + adaptationFit * 0.5));
  const penalty = Math.max(0.82, Math.min(1.04, fit * cohesion));
  const reason = formationFit < 0.9
    ? 'Esquema lejos del estilo del entrenador'
    : adaptationFit < 0.78
      ? 'Alineación poco adaptada a los roles'
      : 'Alineación alineada con el entrenador';
  return { fit, penalty, reason };
}
