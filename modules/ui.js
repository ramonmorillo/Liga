import { getTeamLineAverages } from './generator.js';

export const views = {
  dashboard: 'dashboard',
  standings: 'standings',
  teams: 'teams',
  matchday: 'matchday',
  teamDetail: 'teamDetail',
};

const positionLabel = { POR: 'Portero', DEF: 'Defensa', MED: 'Centrocampista', DEL: 'Delantero' };

const money = (v) => `€${Math.round(v).toLocaleString('es-ES')}`;

function teamBadge(team) {
  return `<span class="team-chip"><span class="dot" style="background:${team.colors[0]}"></span>${team.name}</span>`;
}

export function renderNav(nav, activeView, onNavigate) {
  const items = [
    [views.dashboard, 'Dashboard'],
    [views.standings, 'Clasificación'],
    [views.matchday, 'Jornada'],
    [views.teams, 'Equipos'],
  ];
  nav.innerHTML = items.map(([key, label]) => `<button class="btn ${activeView === key ? 'primary' : ''}" data-view="${key}">${label}</button>`).join('');
  nav.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => onNavigate(b.dataset.view)));
}

export function render(root, app, handlers) {
  const { view, selectedTeamId, state } = app;
  if (view === views.dashboard) root.innerHTML = dashboardView(state);
  if (view === views.standings) root.innerHTML = standingsView(state.standings, state.firstDivision);
  if (view === views.teams) root.innerHTML = teamsView(state);
  if (view === views.matchday) root.innerHTML = matchdayView(state);
  if (view === views.teamDetail) {
    const team = [...state.firstDivision, ...state.secondDivision].find((t) => t.id === selectedTeamId);
    root.innerHTML = team ? teamDetailView(team) : '<p>Equipo no encontrado.</p>';
  }

  root.querySelector('#simulate-btn')?.addEventListener('click', handlers.onSimulate);
  root.querySelectorAll('[data-team]').forEach((el) => el.addEventListener('click', () => handlers.onTeamSelect(el.dataset.team)));
  root.querySelectorAll('.player-row').forEach((row) => row.addEventListener('click', () => handlers.onPlayerSelect(row.dataset.team, row.dataset.player)));
}

function dashboardView(state) {
  const top = state.standings.slice(0, 6);
  return `
  <div class="grid two">
    <section class="card">
      <h2>Estado de temporada</h2>
      <p class="small">Jornada ${state.currentMatchday} de ${state.maxMatchday}</p>
      <button id="simulate-btn" class="btn primary" ${state.currentMatchday > state.maxMatchday ? 'disabled' : ''}>Simular jornada</button>
    </section>
    <section class="card">
      <h2>Siguiente jornada</h2>
      ${nextMatchdaySnippet(state)}
    </section>
  </div>
  <section class="card" style="margin-top:.9rem">
    <h2>Clasificación resumida</h2>
    ${standingsTable(top)}
  </section>`;
}

function standingsView(standings, teams) {
  return `<section class="card"><h2>Clasificación Primera División</h2>${standingsTable(standings, teams)}</section>`;
}

function standingsTable(rows, teams = null) {
  const resolve = (id) => teams?.find((t) => t.id === id)?.name || id;
  return `<div class="table-wrap"><table><thead><tr><th>#</th><th>Equipo</th><th>Pts</th><th>V</th><th>E</th><th>D</th><th>GF</th><th>GC</th><th>DG</th></tr></thead>
  <tbody>${rows.map((r, i) => `<tr><td>${r.position || i + 1}</td><td>${resolve(r.teamId)}</td><td>${r.points}</td><td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gd}</td></tr>`).join('')}</tbody></table></div>`;
}

function teamsView(state) {
  const block = (title, teams) => `
    <section class="card"><h2>${title}</h2><div class="table-wrap"><table><thead><tr><th>Equipo</th><th>Estilo</th><th>Prestigio</th><th>Fuerza</th><th>División</th></tr></thead>
    <tbody>${teams.map((t) => `<tr><td><button class="btn" data-team="${t.id}">${teamBadge(t)}</button></td><td>${t.style}</td><td>${t.prestige}</td><td>${t.strength}</td><td>${t.division}</td></tr>`).join('')}</tbody></table></div></section>`;
  return `<div class="grid">${block('Primera División', state.firstDivision)}${block('Segunda División', state.secondDivision)}</div>`;
}

function teamDetailView(team) {
  const lines = getTeamLineAverages(team);
  return `<div class="grid two">
    <section class="card">
      <h2>${teamBadge(team)} — ${team.name}</h2>
      <p><strong>División:</strong> ${team.division}</p>
      <p><strong>Prestigio:</strong> ${team.prestige}</p>
      <p><strong>Presupuesto:</strong> ${team.budget}</p>
      <p><strong>Estilo:</strong> ${team.style}</p>
      <p><strong>Medias por línea:</strong> POR ${lines.POR} · DEF ${lines.DEF} · MED ${lines.MED} · DEL ${lines.DEL}</p>
    </section>
    <section class="card">
      <h2>Plantilla (24)</h2>
      <div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Pos</th><th>Edad</th><th>Nac.</th><th>Med</th><th>Pot</th></tr></thead>
      <tbody>${team.squad.map((p) => `<tr class="player-row" data-team="${team.id}" data-player="${p.id}"><td>${p.name} ${p.surname}</td><td>${positionLabel[p.position]}</td><td>${p.age}</td><td>${p.nationality}</td><td>${p.overall}</td><td>${p.potential}</td></tr>`).join('')}</tbody></table></div>
    </section>
  </div>`;
}

function matchdayView(state) {
  const day = state.schedule.find((d) => d.matchday === Math.min(state.currentMatchday, state.maxMatchday));
  const resultSet = state.results[day?.matchday] || {};
  const teams = [...state.firstDivision, ...state.secondDivision];
  const byId = (id) => teams.find((t) => t.id === id);
  return `<section class="card"><h2>Jornada ${day?.matchday || '-'}</h2><div class="grid">
  ${(day?.matches || []).map((m) => {
    const res = resultSet[`${m.home}_${m.away}`];
    return `<article class="card"><div class="flex"><strong>${teamBadge(byId(m.home))}</strong><span>vs</span><strong>${teamBadge(byId(m.away))}</strong></div>
    ${res ? `<p><strong>${res.homeGoals} - ${res.awayGoals}</strong></p><p class="small">Posesión ${res.homePossession}%-${res.awayPossession}% · Tiros ${res.homeShots}-${res.awayShots} · A puerta ${res.homeShotsOnTarget}-${res.awayShotsOnTarget}</p>
    <p class="small">Goleadores local: ${res.homeScorers.join(', ') || '—'}</p><p class="small">Goleadores visitante: ${res.awayScorers.join(', ') || '—'}</p>` : '<p class="small">Pendiente de simulación</p>'}
    </article>`;
  }).join('')}</div></section>`;
}

function nextMatchdaySnippet(state) {
  const day = state.schedule.find((d) => d.matchday === state.currentMatchday);
  if (!day) return '<p class="small">Temporada completada.</p>';
  const teams = state.firstDivision;
  const byId = (id) => teams.find((t) => t.id === id);
  return `<ul>${day.matches.slice(0, 4).map((m) => `<li>${byId(m.home).name} vs ${byId(m.away).name}</li>`).join('')}</ul>`;
}

export function showPlayerModal(modal, player, teamName) {
  modal.querySelector('#player-modal-content').innerHTML = `
    <h3>${player.name} ${player.surname}</h3>
    <p class="small">${teamName}</p>
    <p>Edad: ${player.age} · Nacionalidad: ${player.nationality}</p>
    <p>Posición: ${positionLabel[player.position]}</p>
    <p>Media: ${player.overall} · Potencial: ${player.potential}</p>
    <p>Forma: ${player.form} · Energía: ${player.energy} · Moral: ${player.morale}</p>
    <p>Valor: ${money(player.value)} · Cláusula: ${money(player.clause)}</p>
    <p>Extracomunitario: <strong>${player.nonEu ? 'Sí' : 'No'}</strong></p>`;
  modal.showModal();
}
