export const positionNames = { POR: 'Portero', DEF: 'Defensa', MED: 'Centrocampista', DEL: 'Delantero' };

export function money(value) {
  return `€${Math.round(value).toLocaleString('es-ES')}`;
}

export function teamBadge(team) {
  if (!team) return '<span>Equipo</span>';
  return `<span class="team-chip"><span class="dot" style="background:${team.colors[0]}"></span>${team.name}</span>`;
}

export function standingsTable(rows, teamsById) {
  return `<div class="table-wrap"><table><thead><tr><th>#</th><th>Equipo</th><th>Pts</th><th>V</th><th>E</th><th>D</th><th>GF</th><th>GC</th><th>DG</th></tr></thead><tbody>
  ${rows.map((row, idx) => `<tr><td>${row.position || idx + 1}</td><td>${teamsById[row.teamId]?.name || row.teamId}</td><td>${row.points}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.gd}</td></tr>`).join('')}
  </tbody></table></div>`;
}

export function trophyCard(title, icon, accent, winner) {
  return `<article class="trophy-card" style="--accent:${accent}"><div class="trophy-icon">${icon}</div><h4>${title}</h4><p>${winner || 'Pendiente'}</p></article>`;
}

export function matchCard(home, away, result) {
  if (!result) {
    return `<article class="card"><div class="flex spread"><strong>${home.name}</strong><span>vs</span><strong>${away.name}</strong></div><p class="small">Pendiente</p></article>`;
  }

  return `<article class="card match-card">
    <div class="flex spread">
      <strong>${home.name}</strong>
      <h3>${result.homeGoals} - ${result.awayGoals}</h3>
      <strong>${away.name}</strong>
    </div>
    <p class="small">Posesión ${result.homePossession}% - ${result.awayPossession}% · Tiros ${result.homeShots}-${result.awayShots} · A puerta ${result.homeShotsOnTarget}-${result.awayShotsOnTarget}</p>
    <div class="grid two">
      <div><h5>Incidencias</h5><ul>${result.events.map((event) => `<li>${event.minute}' ${event.playerName} (${event.side === 'home' ? home.name : away.name})</li>`).join('') || '<li>Sin goles</li>'}</ul></div>
      <div><h5>MVP</h5><p>${result.mvp}</p></div>
    </div>
  </article>`;
}
