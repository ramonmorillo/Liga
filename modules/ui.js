import { competitions } from '../data/trophies.js';
import { FORMATIONS } from './lineups.js';
import { getMarketPlayers, isTransferWindowOpen } from './transfers.js';
import { money, matchCard, positionNames, standingsTable, teamBadge, trophyCard } from './renderers.js';
import { getTeamById } from './state.js';

export const views = {
  dashboard: 'dashboard',
  matchday: 'matchday',
  standings1: 'standings1',
  standings2: 'standings2',
  teams: 'teams',
  teamDetail: 'teamDetail',
  market: 'market',
  cupEurope: 'cupEurope',
  history: 'history',
  endSeason: 'endSeason',
};

export function renderNav(nav, activeView, onNavigate) {
  const items = [
    [views.dashboard, 'Dashboard'],
    [views.matchday, 'Jornada / Partidos'],
    [views.standings1, 'Clasificación Primera'],
    [views.standings2, 'Clasificación Segunda'],
    [views.teams, 'Equipos'],
    [views.market, 'Mercado'],
    [views.cupEurope, 'Copa + Europa'],
    [views.history, 'Historia / Palmarés'],
    [views.endSeason, 'Fin de temporada'],
  ];

  nav.innerHTML = items.map(([key, label]) => `<button class="btn ${key === activeView ? 'primary' : ''}" data-view="${key}">${label}</button>`).join('');
  nav.querySelectorAll('[data-view]').forEach((btn) => btn.addEventListener('click', () => onNavigate(btn.dataset.view)));
}

function dashboardView(state) {
  const userTeam = getTeamById(state, state.userTeamId);
  return `<div class="grid two">
    <section class="card">
      <h2>Dashboard</h2>
      <p>Temporada ${state.season} · Año ${state.year}</p>
      <p>Equipo controlado: <strong>${userTeam?.name || '—'}</strong></p>
      <p>Mercado: <strong>${isTransferWindowOpen(state) ? state.transferWindow : 'cerrado'}</strong></p>
      <button class="btn primary" data-action="simulate">Simular jornada</button>
      <button class="btn" data-action="auto-lineups">Restaurar alineaciones óptimas</button>
    </section>
    <section class="card">
      <h2>Siguiente jornada</h2>
      ${nextMatches(state)}
    </section>
  </div>`;
}

function nextMatches(state) {
  const day = state.firstSchedule.find((entry) => entry.matchday === state.currentMatchday);
  const byId = Object.fromEntries([...state.firstDivision, ...state.secondDivision].map((team) => [team.id, team]));
  if (!day) return '<p class="small">No hay partidos pendientes.</p>';
  return `<ul>${day.matches.slice(0, 8).map((match) => `<li>${byId[match.home].name} vs ${byId[match.away].name}</li>`).join('')}</ul>`;
}

function matchdayView(state) {
  const day = Math.min(state.currentMatchday, state.maxMatchday);
  const round1 = state.firstSchedule.find((entry) => entry.matchday === day);
  const round2 = state.secondSchedule.find((entry) => entry.matchday === day);
  const byId = Object.fromEntries([...state.firstDivision, ...state.secondDivision].map((team) => [team.id, team]));

  return `<div class="grid">
    <section class="card"><h2>Primera División · Jornada ${day}</h2>${(round1?.matches || []).map((match) => matchCard(byId[match.home], byId[match.away], state.results.d1[day]?.[`${match.home}-${match.away}`])).join('')}</section>
    <section class="card"><h2>Segunda División · Jornada ${day}</h2>${(round2?.matches || []).map((match) => matchCard(byId[match.home], byId[match.away], state.results.d2[day]?.[`${match.home}-${match.away}`])).join('')}</section>
  </div>`;
}

function teamsView(state) {
  const block = (title, teams) => `<section class="card"><h3>${title}</h3><div class="table-wrap"><table><thead><tr><th>Equipo</th><th>Div</th><th>Estilo</th><th>Perfil</th><th>Presupuesto</th><th></th></tr></thead><tbody>
  ${teams.map((team) => `<tr><td>${teamBadge(team)}</td><td>${team.division}</td><td>${team.style}</td><td>${team.profile}</td><td>${money(team.budget)}</td><td><button class="btn" data-team="${team.id}" data-action="team-detail">Ver</button></td></tr>`).join('')}
  </tbody></table></div></section>`;

  return `<div class="grid">${block('Primera División', state.firstDivision)}${block('Segunda División', state.secondDivision)}</div>`;
}

function teamDetailView(state) {
  const team = getTeamById(state, state.selectedTeamId || state.userTeamId);
  if (!team) return '<section class="card"><p>Equipo no encontrado.</p></section>';

  const sorted = [...team.squad].sort((a, b) => b.overall - a.overall);
  return `<div class="grid two">
    <section class="card">
      <h2>${team.name}</h2>
      <p>${teamBadge(team)} · División ${team.division}</p>
      <p><strong>Formación:</strong>
      <select data-action="formation" data-team="${team.id}">${Object.keys(FORMATIONS).map((f) => `<option value="${f}" ${team.lineup.formation === f ? 'selected' : ''}>${f}</option>`).join('')}</select></p>
      <button class="btn" data-action="set-user-team" data-team="${team.id}">Controlar este equipo</button>
      <button class="btn" data-action="auto-team-lineup" data-team="${team.id}">Alineación óptima</button>
      <p class="small">Titulares: ${team.lineup.starters.map((id) => {
        const player = team.squad.find((item) => item.id === id);
        return player ? `${player.name} ${player.surname}` : '';
      }).filter(Boolean).join(', ')}</p>
    </section>
    <section class="card">
      <h3>Plantilla</h3>
      <div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Pos</th><th>Edad</th><th>Nac.</th><th>Med</th><th>Pot</th><th>E/F/M</th></tr></thead><tbody>
      ${sorted.map((player) => `<tr><td>${player.name} ${player.surname}</td><td>${positionNames[player.position]}</td><td>${player.age}</td><td>${player.nationality}</td><td>${player.overall}</td><td>${player.potential}</td><td>${player.energy}/${player.form}/${player.morale}</td></tr>`).join('')}
      </tbody></table></div>
    </section>
  </div>`;
}

function marketView(state, filters) {
  const userTeam = getTeamById(state, state.userTeamId);
  const players = getMarketPlayers(state, filters).slice(0, 80);
  return `<section class="card">
    <h2>Mercado de fichajes (${isTransferWindowOpen(state) ? state.transferWindow : 'cerrado'})</h2>
    <p>Presupuesto ${userTeam.name}: <strong>${money(userTeam.budget)}</strong></p>
    <div class="filters">
      <select data-filter="position"><option value="">Posición</option><option>POR</option><option>DEF</option><option>MED</option><option>DEL</option></select>
      <input data-filter="maxAge" type="number" placeholder="Edad máx" />
      <input data-filter="minOverall" type="number" placeholder="Media mín" />
      <input data-filter="nationality" placeholder="Nacionalidad" />
      <label><input data-filter="onlyClauses" type="checkbox" value="1" /> Cláusulas</label>
      <label><input data-filter="extracom" type="checkbox" value="1" /> Extracom.</label>
      <button class="btn" data-action="apply-filters">Aplicar filtros</button>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Club</th><th>Pos</th><th>Edad</th><th>Media</th><th>Pot</th><th>Valor</th><th>Cláusula</th><th>Extrac.</th><th>Acciones</th></tr></thead><tbody>
    ${players.map((player) => `<tr><td>${player.name} ${player.surname}</td><td>${player.teamName}</td><td>${player.position}</td><td>${player.age}</td><td>${player.overall}</td><td>${player.potential}</td><td>${money(player.value)}</td><td>${money(player.clause)}</td><td>${player.nonEu ? 'Sí' : 'No'}</td><td><button class="btn" data-action="buy" data-player="${player.id}" data-team="${player.teamId}">Oferta</button> <button class="btn" data-action="buy-clause" data-player="${player.id}" data-team="${player.teamId}">Pagar cláusula</button></td></tr>`).join('')}
    </tbody></table></div>
  </section>`;
}

function cupEuropeView(state) {
  const summary = state.lastSeasonSummary;
  return `<section class="card"><h2>Copa y Europa</h2>
    <div class="grid two">
      ${trophyCard(competitions.league.name, competitions.league.icon, competitions.league.accent, summary?.leagueChampion)}
      ${trophyCard(competitions.cup.name, competitions.cup.icon, competitions.cup.accent, summary?.cupChampion)}
      ${trophyCard(competitions.champions.name, competitions.champions.icon, competitions.champions.accent, summary?.championsWinner)}
      ${trophyCard(competitions.cupWinners.name, competitions.cupWinners.icon, competitions.cupWinners.accent, summary?.cupWinnersWinner)}
      ${trophyCard(competitions.continental2.name, competitions.continental2.icon, competitions.continental2.accent, summary?.continental2Winner)}
    </div>
    <p class="small">Clasificación continental: campeón de liga → Copa de Campeones, campeón de copa → Copa de Campeones de Copa, 2º-4º (o siguientes elegibles) → Copa Imperial Europea.</p>
  </section>`;
}

function historyView(state) {
  const rows = [...state.history.seasons].reverse();
  return `<section class="card"><h2>Historia / Palmarés</h2>
    <div class="table-wrap"><table><thead><tr><th>Temp.</th><th>Año</th><th>Liga</th><th>Copa</th><th>Copa Campeones</th><th>Copa Camp. Copa</th><th>Copa Imperial</th><th>Pichichi</th><th>Zamora</th><th>Mejor jugador</th></tr></thead><tbody>
    ${rows.map((item) => `<tr><td>${item.season}</td><td>${item.year}</td><td>${item.leagueChampion}</td><td>${item.cupChampion}</td><td>${item.championsWinner}</td><td>${item.cupWinnersWinner}</td><td>${item.continental2Winner}</td><td>${item.awards.pichichi}</td><td>${item.awards.zamora}</td><td>${item.awards.bestPlayer}</td></tr>`).join('') || '<tr><td colspan="10">Aún no hay temporadas finalizadas.</td></tr>'}
    </tbody></table></div>
  </section>`;
}

function endSeasonView(state) {
  const summary = state.lastSeasonSummary;
  if (!summary) return '<section class="card"><h2>Fin de temporada</h2><p class="small">Completa una temporada para ver el resumen.</p></section>';
  return `<section class="card"><h2>Resumen temporada ${summary.season}</h2>
    <p><strong>Campeón de Liga:</strong> ${summary.leagueChampion}</p>
    <p><strong>Campeón de Copa:</strong> ${summary.cupChampion}</p>
    <p><strong>Ascensos:</strong> ${summary.promoted.join(', ')}</p>
    <p><strong>Descensos:</strong> ${summary.relegated.join(', ')}</p>
    <p><strong>Pichichi:</strong> ${summary.awards.pichichi}</p>
    <p><strong>Portero menos goleado:</strong> ${summary.awards.zamora}</p>
    <p><strong>Mejor jugador:</strong> ${summary.awards.bestPlayer}</p>
  </section>`;
}

export function render(root, app) {
  const teamsById = Object.fromEntries([...app.state.firstDivision, ...app.state.secondDivision].map((team) => [team.id, team]));
  const viewMap = {
    [views.dashboard]: dashboardView(app.state),
    [views.matchday]: matchdayView(app.state),
    [views.standings1]: `<section class="card"><h2>Primera División</h2>${standingsTable(app.state.firstStandings, teamsById)}</section>`,
    [views.standings2]: `<section class="card"><h2>Segunda División</h2>${standingsTable(app.state.secondStandings, teamsById)}</section>`,
    [views.teams]: teamsView(app.state),
    [views.teamDetail]: teamDetailView(app.state),
    [views.market]: marketView(app.state, app.marketFilters),
    [views.cupEurope]: cupEuropeView(app.state),
    [views.history]: historyView(app.state),
    [views.endSeason]: endSeasonView(app.state),
  };

  root.innerHTML = viewMap[app.view] || viewMap.dashboard;
}
