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
  const trim = team.crest?.trim || '#f8fafc';
  const s = Number(size);
  const inner = s * 0.22;

  const body = shape === 'round'
    ? `<circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.45}" fill="${c1}" stroke="${trim}" stroke-width="${Math.max(2, s * 0.06)}"/><circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.28}" fill="${c2}"/>`
    : shape === 'diamond'
      ? `<polygon points="${s / 2},2 ${s - 2},${s / 2} ${s / 2},${s - 2} 2,${s / 2}" fill="${c1}" stroke="${trim}" stroke-width="${Math.max(2, s * 0.05)}"/><polygon points="${s / 2},${s * 0.18} ${s * 0.82},${s / 2} ${s / 2},${s * 0.82} ${s * 0.18},${s / 2}" fill="${c2}"/>`
      : shape === 'banner'
        ? `<path d="M${s * 0.1} ${s * 0.1} h${s * 0.8} v${s * 0.58} l-${s * 0.4} ${s * 0.22} l-${s * 0.4}-${s * 0.22}z" fill="${c1}" stroke="${trim}" stroke-width="${Math.max(2, s * 0.05)}"/><rect x="${s * 0.2}" y="${s * 0.26}" width="${s * 0.6}" height="${s * 0.25}" fill="${c2}" rx="3"/>`
        : shape === 'hex'
          ? `<polygon points="${s * 0.25},2 ${s * 0.75},2 ${s - 2},${s * 0.3} ${s * 0.75},${s - 2} ${s * 0.25},${s - 2} 2,${s * 0.3}" fill="${c1}" stroke="${trim}" stroke-width="${Math.max(2, s * 0.05)}"/><polygon points="${s * 0.3},${s * 0.22} ${s * 0.7},${s * 0.22} ${s * 0.82},${s * 0.45} ${s * 0.7},${s * 0.78} ${s * 0.3},${s * 0.78} ${s * 0.18},${s * 0.45}" fill="${c2}"/>`
          : `<path d="M${s * 0.12} ${s * 0.06} h${s * 0.76} v${s * 0.44} c0 ${s * 0.26} -${s * 0.2} ${s * 0.42} -${s * 0.38} ${s * 0.48} -${s * 0.18} -${s * 0.06} -${s * 0.38} -${s * 0.22} -${s * 0.38} -${s * 0.48}z" fill="${c1}" stroke="${trim}" stroke-width="${Math.max(2, s * 0.05)}"/><rect x="${s * 0.22}" y="${s * 0.2}" width="${s * 0.56}" height="${s * 0.28}" fill="${c2}" rx="3"/>`;

  return `<svg class="crest" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" aria-label="Escudo ${team.name}">${body}<text x="50%" y="${s / 2 + inner / 2}" text-anchor="middle" fill="#0b1020" font-size="${inner}" font-weight="800">${symbol}</text></svg>`;
}

export function kitSvg(kit, size = 60, sponsor = '') {
  const c1 = kit?.colors?.[0] || '#1f2937';
  const c2 = kit?.colors?.[1] || '#e5e7eb';
  const pattern = kit?.pattern || 'Liso';
  let deco = '';

  if (pattern === 'Rayas') deco = `<rect x="14" y="12" width="6" height="34" fill="${c2}"/><rect x="28" y="12" width="6" height="34" fill="${c2}"/><rect x="42" y="12" width="6" height="34" fill="${c2}"/>`;
  if (pattern === 'Bandas') deco = `<path d="M10 42 L50 12" stroke="${c2}" stroke-width="8"/>`;
  if (pattern === 'Mitad y mitad') deco = `<rect x="30" y="12" width="20" height="34" fill="${c2}"/>`;
  if (pattern === 'Chevron') deco = `<path d="M14 20 L30 34 L46 20" fill="none" stroke="${c2}" stroke-width="7"/>`;
  if (pattern === 'Franja central') deco = `<rect x="25" y="12" width="10" height="34" fill="${c2}" opacity="0.92"/>`;
  const sponsorText = sponsor ? `<rect x="16" y="28" width="28" height="8" rx="3" fill="rgba(11,16,32,0.65)"/><text x="30" y="34" text-anchor="middle" fill="#f8fafc" font-size="4.2" font-weight="700">${String(sponsor).slice(0, 12)}</text>` : '';

  return `<svg class="kit" viewBox="0 0 60 60" width="${size}" height="${size}"><path d="M12 12 L22 8 L30 14 L38 8 L48 12 L52 22 L44 25 L42 46 H18 L16 25 L8 22 Z" fill="${c1}" stroke="#0b1020" stroke-width="1.4"/>${deco}${sponsorText}</svg>`;
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

export function matchEventIcon(type) {
  if (type === 'goal') return '<span class="event-icon goal">⚽</span>';
  if (type === 'penalty') return '<span class="event-icon penalty">◎</span>';
  if (type === 'ownGoal') return '<span class="event-icon own-goal">◉</span>';
  if (type === 'yellow') return '<span class="event-icon yellow"></span>';
  if (type === 'red') return '<span class="event-icon red"></span>';
  if (type === 'injury') return '<span class="event-icon injury">✚</span>';
  return '<span class="event-icon neutral">•</span>';
}

function eventLabel(event) {
  const label = event.type === 'penalty' ? 'Penalti'
    : event.type === 'ownGoal' ? 'Autogol'
      : event.type === 'yellow' ? 'Amarilla'
        : event.type === 'red' ? 'Roja'
          : event.type === 'injury' ? 'Lesión'
            : 'Gol';
  return `<li><span>${event.minute}'</span> ${matchEventIcon(event.type)} ${event.playerName} · ${label}</li>`;
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
      <div><h5>${home.name}</h5><ul class="timeline">${result.events.filter((event) => event.side === 'home').map(eventLabel).join('') || '<li>Sin incidencias</li>'}</ul></div>
      <div><h5>${away.name}</h5><ul class="timeline">${result.events.filter((event) => event.side === 'away').map(eventLabel).join('') || '<li>Sin incidencias</li>'}</ul></div>
    </div>
    <div class="grid two">
      <div><h5>Resumen</h5><p class="small">${result.summaryText || 'Partido equilibrado.'}</p><button class="btn" data-action="open-match" data-match="${key}">Ver detalle</button></div>
    </div>
  </article>`;
}
