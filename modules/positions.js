const SPECIFIC_TO_GENERAL = {
  POR: 'POR',
  LI: 'DEF',
  LD: 'DEF',
  DFC: 'DEF',
  MCD: 'MED',
  MC: 'MED',
  MCO: 'MED',
  EI: 'DEL',
  ED: 'DEL',
  DC: 'DEL',
  CAI: 'MED',
  CAD: 'MED',
};

const GENERAL_TO_SPECIFIC = {
  POR: ['POR'],
  DEF: ['LI', 'DFC', 'DFC', 'LD'],
  MED: ['MCD', 'MC', 'MCO', 'MC'],
  DEL: ['EI', 'DC', 'ED'],
};

export const specificPositionNames = {
  POR: 'Portero',
  LI: 'Lateral izquierdo',
  LD: 'Lateral derecho',
  DFC: 'Defensa central',
  MCD: 'Mediocentro defensivo',
  MC: 'Mediocentro',
  MCO: 'Mediapunta',
  EI: 'Extremo izquierdo',
  ED: 'Extremo derecho',
  DC: 'Delantero centro',
  CAI: 'Carrilero izquierdo',
  CAD: 'Carrilero derecho',
};

function hashText(text = '') {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickSpecificByGeneral(general = 'MED', seed = '') {
  const pool = GENERAL_TO_SPECIFIC[general] || GENERAL_TO_SPECIFIC.MED;
  const idx = hashText(String(seed)) % pool.length;
  return pool[idx];
}

export function generalFromSpecific(specific = 'MC') {
  return SPECIFIC_TO_GENERAL[specific] || 'MED';
}

export function ensureSpecificPosition(player, fallbackSeed = '') {
  if (!player) return null;

  if (SPECIFIC_TO_GENERAL[player.position]) {
    player.specificPosition = player.position;
    player.position = SPECIFIC_TO_GENERAL[player.position];
    return player;
  }

  const general = ['POR', 'DEF', 'MED', 'DEL'].includes(player.position) ? player.position : generalFromSpecific(player.specificPosition);
  player.position = general;
  if (!player.specificPosition || !SPECIFIC_TO_GENERAL[player.specificPosition]) {
    player.specificPosition = pickSpecificByGeneral(general, `${player.id || fallbackSeed}-${player.name || ''}-${player.surname || ''}`);
  }
  return player;
}

export function createSpecificPosition(general, seed = '') {
  return pickSpecificByGeneral(general, seed);
}
