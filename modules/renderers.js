export const positionNames = { POR: 'Portero', DEF: 'Defensa', MED: 'Centrocampista', DEL: 'Delantero' };

export function money(value) {
  return `€${Math.round(value).toLocaleString('es-ES')}`;
}

export function crestSvg(team, size = 34) {
  if (!team) return '';
  const c1 = team.colors?.[0] || '#4f46e5';
  const c2 = team.colors?.[1] || '#e5e7eb';
  const symbol = team.crest?.symbol || team.name?.[0] || '?';
  const shape = team.crest?.shape || 'shield';
  const s = Number(size);
  const inner = s * 0.22;

  const body = shape === 'round'
    ? `<circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.44}" fill="${c1}"/><circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.26}" fill="${c2}"/>`
    : shape === 'diamond'
      ? `<polygon points="${s / 2},2 ${s - 2},${s / 2} ${s / 2},${s - 2} 2,${s / 2}" fill="${c1}"/><polygon points="${s / 2},${s * 0.16} ${s * 0.84},${s / 2} ${s / 2},${s * 0.84} ${s * 0.16},${s / 2}" fill="${c2}"/>`
      : `<path d="M${s * 0.12} ${s * 0.06} h${s * 0.76} v${s * 0.44} c0 ${s * 0.26} -${s * 0.2} ${s * 0.42} -${s * 0.38} ${s * 0.48} -${s * 0.18} -${s * 0.06} -${s * 0.38} -${s * 0.22} -${s * 0.38} -${s * 0.48}z" fill="${c1}"/><rect x="${s * 0.22}" y="${s * 0.2}" width="${s * 0.56}" height="${s * 0.28}" fill="${c2}" rx="3"/>`;

  return `<svg class="crest" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" aria-label="Escudo ${team.name}">${body}<text x="50%" y="${s / 2 + inner / 2}" text-anchor="middle" fill="#0b1020" font-size="${inner}" font-weight="800">${symbol}</text></svg>`;
}

export function kitSvg(kit, size = 60) {
  const c1 = kit?.colors?.[0] || '#1f2937';
  const c2 = kit?.colors?.[1] || '#e5e7eb';
  const pattern = kit?.pattern || 'Liso';
  let deco = '';

  if (pattern === 'Rayas') deco = `<rect x="14" y="12" width="6" height="34" fill="${c2}"/><rect x="28" y="12" width="6" height="34" fill="${c2}"/><rect x="42" y="12" width="6" height="34" fill="${c2}"/>`;
  if (pattern === 'Bandas') deco = `<path d="M10 42 L50 12" stroke="${c2}" stroke-width="8"/>`;
  if (pattern === 'Mitad y mitad') deco = `<rect x="30" y="12" width="20" height="34" fill="${c2}"/>`;

  return `<svg class="kit" viewBox="0 0 60 60" width="${size}" height="${size}"><path d="M12 12 L22 8 L30 14 L38 8 L48 12 L52 22 L44 25 L42 46 H18 L16 25 L8 22 Z" fill="${c1}" stroke="#0b1020" stroke-width="1.4"/>${deco}</svg>`;
}

export function teamBadge(team) {
  if (!team) return '<span>Equipo</span>';
  return `<span class="team-chip">${crestSvg(team, 24)}<span>${team.name}</span></span>`;
}

export function standingsTable(rows, teamsById) {
  return `<div class="table-wrap"><table><thead><tr><th>#</th><th>Equipo</th><th>Pts</th><th>V</th><th>E</th><th>D</th><th>GF</th><th>GC</th><th>DG</th></tr></thead><tbody>
  ${rows.map((row, idx) => `<tr><td>${row.position || idx + 1}</td><td>${teamBadge(teamsById[row.teamId])}</td><td>${row.points}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.gd}</td></tr>`).join('')}
  </tbody></table></div>`;
}

export function trophyCard(title, icon, accent, winner) {
  return `<article class="trophy-card" style="--accent:${accent}"><div class="trophy-icon">${icon}</div><h4>${title}</h4><p>${winner || 'Pendiente'}</p></article>`;
}

function eventLabel(event) {
  const icon = event.type === 'goal' ? '⚽' : event.type === 'yellow' ? '🟨' : event.type === 'red' ? '🟥' : '🩹';
  return `<li>${icon} ${event.minute}' · ${event.playerName}</li>`;
}

export function matchCard(home, away, result, key = '') {
  if (!result) {
    return `<article class="card"><div class="scoreline pending"><div>${teamBadge(home)}</div><span>vs</span><div>${teamBadge(away)}</div></div><p class="small">Pendiente</p></article>`;
  }

  return `<article class="card match-card">
    <div class="scoreline">
      <div class="club-side">${teamBadge(home)}</div>
      <div><h3>${result.homeGoals} - ${result.awayGoals}</h3><p class="small">MVP: ${result.mvp}</p></div>
      <div class="club-side">${teamBadge(away)}</div>
    </div>
    <div class="stats-grid">
      <span>Posesión ${result.homePossession}% - ${result.awayPossession}%</span>
      <span>Tiros ${result.homeShots}-${result.awayShots}</span>
      <span>A puerta ${result.homeShotsOnTarget}-${result.awayShotsOnTarget}</span>
      <span>Asistencia ${result.attendance?.attendance?.toLocaleString('es-ES') || '—'} (${result.attendance?.occupancy || '—'}%)</span>
    </div>
    <div class="grid two">
      <div><h5>Cronología</h5><ul>${result.events.map(eventLabel).join('') || '<li>Sin incidencias</li>'}</ul></div>
      <div><h5>Resumen</h5><p class="small">${result.summaryText || 'Partido equilibrado.'}</p><button class="btn" data-action="open-match" data-match="${key}">Ver detalle</button></div>
    </div>
  </article>`;
}
