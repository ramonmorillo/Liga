import { competitions } from '../data/trophies.js';
import { FORMATIONS } from './lineups.js';
import { getMarketPlayers, isTransferWindowOpen } from './transfers.js';
import { money, matchCard, positionNames, standingsTable, teamBadge, trophyCard, crestSvg, kitSvg } from './renderers.js';
import { getTeamById } from './state.js';

export const views = {
  dashboard: 'dashboard',
  matchday: 'matchday',
  matchDetail: 'matchDetail',
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
    [views.cupEurope, 'Competiciones'],
    [views.history, 'Historia'],
    [views.endSeason, 'Fin de temporada'],
  ];

  nav.innerHTML = items.map(([key, label]) => `<button class="btn ${key === activeView ? 'primary' : ''}" data-view="${key}">${label}</button>`).join('');
  nav.querySelectorAll('[data-view]').forEach((btn) => btn.addEventListener('click', () => onNavigate(btn.dataset.view)));
}

function dashboardView(state) {
  const userTeam = getTeamById(state, state.userTeamId);
  const latest = state.matchdaySummaries.at(-1);
  return `<div class="grid two">
    <section class="card">
      <h2>Dashboard</h2>
      <p>Temporada ${state.season} · Año ${state.year}</p>
      <p>Equipo controlado: <strong>${userTeam?.name || '—'}</strong></p>
      <p>Mercado: <strong>${isTransferWindowOpen(state) ? state.transferWindow : 'cerrado'}</strong></p>
      <p>Afición: <strong>${userTeam?.fanMood || 'expectante'}</strong> · Entrenador: <strong>${userTeam?.coach?.name || '—'}</strong> (${userTeam?.coach?.status || 'estable'})</p>
      <button class="btn primary" data-action="simulate">Simular jornada</button>
      <button class="btn" data-action="auto-lineups">Restaurar alineaciones óptimas</button>
    </section>
    <section class="card">
      <h2>Última jornada</h2>
      <p class="small">${latest ? `Jornada ${latest.matchday} · Partido destacado: ${latest.bigMatch}` : 'Aún sin jornadas simuladas.'}</p>
      <ul>${(latest?.matches || []).slice(0, 4).map((m) => `<li>${m.homeName} ${m.score} ${m.awayName}</li>`).join('') || '<li>Simula para generar resumen.</li>'}</ul>
    </section>
    <section class="card">
      <h3>Noticias recientes</h3>
      <ul>${state.recentNews.slice(0, 8).map((item) => `<li><strong>${item.dateLabel}</strong> · ${item.text}</li>`).join('') || '<li>Sin noticias por ahora.</li>'}</ul>
    </section>
    <section class="card">
      <h3>Siguiente jornada</h3>
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

function summaryCard(summary) {
  if (!summary) return '<section class="card"><p class="small">Sin resumen de jornada todavía.</p></section>';
  return `<section class="card">
    <h3>Resumen jornada ${summary.matchday}</h3>
    <p><strong>Partido más importante:</strong> ${summary.bigMatch}</p>
    <p><strong>Jugador destacado:</strong> ${summary.standoutPlayer}</p>
    <div class="grid two">
      <div><h5>Goleadores destacados</h5><ul>${summary.topScorers.slice(0, 8).map((g) => `<li>${g.minute}' ${g.name} (${g.teamName})</li>`).join('') || '<li>Sin goles</li>'}</ul></div>
      <div><h5>Incidencias relevantes</h5><ul>${[...summary.injuries.slice(0, 4).map((i) => `🩹 ${i.minute}' ${i.name} (${i.teamName})`), ...summary.cards.slice(0, 4).map((c) => `${c.kind === 'red' ? '🟥' : '🟨'} ${c.minute}' ${c.name} (${c.teamName})`)].map((txt) => `<li>${txt}</li>`).join('') || '<li>Sin incidencias graves</li>'}</ul></div>
    </div>
  </section>`;
}

function matchdayView(state) {
  const day = Math.min(state.currentMatchday, state.maxMatchday);
  const round1 = state.firstSchedule.find((entry) => entry.matchday === day);
  const round2 = state.secondSchedule.find((entry) => entry.matchday === day);
  const byId = Object.fromEntries([...state.firstDivision, ...state.secondDivision].map((team) => [team.id, team]));

  const lastSummary = state.matchdaySummaries.at(-1);

  return `<div class="grid">
    ${summaryCard(lastSummary)}
    <section class="card"><h2>Primera División · Jornada ${day}</h2>${(round1?.matches || []).map((match) => {
      const key = `${day}|d1|${match.home}-${match.away}`;
      return matchCard(byId[match.home], byId[match.away], state.results.d1[day]?.[`${match.home}-${match.away}`], key);
    }).join('')}</section>
    <section class="card"><h2>Segunda División · Jornada ${day}</h2>${(round2?.matches || []).map((match) => {
      const key = `${day}|d2|${match.home}-${match.away}`;
      return matchCard(byId[match.home], byId[match.away], state.results.d2[day]?.[`${match.home}-${match.away}`], key);
    }).join('')}</section>
    <section class="card"><h3>Histórico de jornadas</h3><div class="table-wrap"><table><thead><tr><th>Jornada</th><th>Partido clave</th><th>Jugador destacado</th></tr></thead><tbody>${state.matchdaySummaries.slice().reverse().map((item) => `<tr><td>${item.matchday}</td><td>${item.bigMatch}</td><td>${item.standoutPlayer}</td></tr>`).join('') || '<tr><td colspan="3">Sin histórico aún.</td></tr>'}</tbody></table></div></section>
  </div>`;
}

function matchDetailView(state) {
  if (!state.selectedMatchKey) return '<section class="card"><p>Selecciona un partido desde la vista de jornada.</p></section>';
  const [day, division, key] = state.selectedMatchKey.split('|');
  const [homeId, awayId] = key.split('-');
  const byId = Object.fromEntries([...state.firstDivision, ...state.secondDivision].map((team) => [team.id, team]));
  const home = byId[homeId];
  const away = byId[awayId];
  const result = state.results[division]?.[day]?.[key];
  if (!result) return '<section class="card"><p>Partido no disponible.</p></section>';

  return `<section class="card match-detail">
    <h2>${teamBadge(home)} <span class="vs">vs</span> ${teamBadge(away)}</h2>
    <div class="hero-score">${result.homeGoals} - ${result.awayGoals}</div>
    <p class="small">Jugador del partido: <strong>${result.mvp}</strong> · Asistencia ${result.attendance.attendance.toLocaleString('es-ES')} (${result.attendance.occupancy}%)</p>
    <div class="grid two">
      <div>
        <h4>Incidencias</h4>
        <ul class="timeline">${result.events.map((event) => `<li><span>${event.minute}'</span> ${event.type === 'goal' ? '⚽' : event.type === 'yellow' ? '🟨' : event.type === 'red' ? '🟥' : '🩹'} ${event.playerName} (${event.side === 'home' ? home.name : away.name})</li>`).join('')}</ul>
      </div>
      <div>
        <h4>Estadísticas comparadas</h4>
        <ul>
          <li>Posesión: ${result.homePossession}% - ${result.awayPossession}%</li>
          <li>Tiros: ${result.homeShots} - ${result.awayShots}</li>
          <li>Tiros a puerta: ${result.homeShotsOnTarget} - ${result.awayShotsOnTarget}</li>
          <li>Tarjetas: ${result.cards.filter((item) => item.side === 'home').length} - ${result.cards.filter((item) => item.side === 'away').length}</li>
          <li>Lesiones: ${result.injuries.filter((item) => item.side === 'home').length} - ${result.injuries.filter((item) => item.side === 'away').length}</li>
        </ul>
        <p class="small">${result.summaryText}</p>
      </div>
    </div>
  </section>`;
}

function teamsView(state) {
  const block = (title, teams) => `<section class="card"><h3>${title}</h3><div class="table-wrap"><table><thead><tr><th>Equipo</th><th>Div</th><th>Entrenador</th><th>Afición</th><th>Estadio</th><th>Presupuesto</th><th></th></tr></thead><tbody>
  ${teams.map((team) => `<tr><td>${teamBadge(team)}</td><td>${team.division}</td><td>${team.coach.name}</td><td>${team.fanMood}</td><td>${team.stadium.name}</td><td>${money(team.budget)}</td><td><button class="btn" data-team="${team.id}" data-action="team-detail">Ver</button></td></tr>`).join('')}
  </tbody></table></div></section>`;

  return `<div class="grid">${block('Primera División', state.firstDivision)}${block('Segunda División', state.secondDivision)}</div>`;
}

function teamDetailView(state) {
  const team = getTeamById(state, state.selectedTeamId || state.userTeamId);
  if (!team) return '<section class="card"><p>Equipo no encontrado.</p></section>';

  const sorted = [...team.squad].sort((a, b) => b.overall - a.overall);
  const avgAttendance = team.stadium.seasonHomeMatches ? Math.round(team.stadium.seasonAttendanceTotal / team.stadium.seasonHomeMatches) : 0;
  const marketNet = team.finances.transferIn - team.finances.transferOut;

  return `<div class="grid two">
    <section class="card">
      <div class="club-head">${crestSvg(team, 72)}<div><h2>${team.name}</h2><p>División ${team.division} · Estilo ${team.style}</p></div></div>
      <p><strong>Entrenador:</strong> ${team.coach.name} (${team.coach.age}) · ${team.coach.style} · Nivel ${team.coach.rating} · Estado: ${team.coach.status}</p>
      <p><strong>Perfil técnico:</strong> ${team.coach.profile}</p>
      <p><strong>Estadio:</strong> ${team.stadium.name} (${team.stadium.capacity.toLocaleString('es-ES')} espectadores)</p>
      <p><strong>Afición:</strong> ${team.fanMood} · Última asistencia ${team.stadium.lastAttendance?.toLocaleString('es-ES') || '—'} (${team.stadium.lastOccupancy || '—'}%) · Media ${avgAttendance.toLocaleString('es-ES')}</p>
      <p><strong>Presupuesto:</strong> ${money(team.budget)} · Ingresos traspasos ${money(team.finances.transferIn)} · Gastos ${money(team.finances.transferOut)} · Balance ${money(marketNet)} · Premios ${money(team.finances.prizes)}</p>
      <p><strong>Formación:</strong>
      <select data-action="formation" data-team="${team.id}">${Object.keys(FORMATIONS).map((f) => `<option value="${f}" ${team.lineup.formation === f ? 'selected' : ''}>${f}</option>`).join('')}</select></p>
      <button class="btn" data-action="set-user-team" data-team="${team.id}">Controlar este equipo</button>
      <button class="btn" data-action="auto-team-lineup" data-team="${team.id}">Alineación óptima</button>
      <div class="kit-row"><div><h5>Primera</h5>${kitSvg(team.kits.primary, 72)}<p class="small">${team.kits.primary.pattern}</p></div><div><h5>Segunda</h5>${kitSvg(team.kits.away, 72)}<p class="small">${team.kits.away.pattern}</p></div></div>
      <p class="small">Colores oficiales: <span class="dot" style="background:${team.colors[0]}"></span> ${team.colors[0]} · <span class="dot" style="background:${team.colors[1]}"></span> ${team.colors[1]}</p>
    </section>
    <section class="card">
      <h3>Plantilla</h3>
      <div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Pos</th><th>Edad</th><th>Nac.</th><th>Med</th><th>Pot</th><th>E/F/M</th><th>Goles</th></tr></thead><tbody>
      ${sorted.map((player) => `<tr><td>${player.name} ${player.surname}</td><td>${positionNames[player.position]}</td><td>${player.age}</td><td>${player.nationality}</td><td>${player.overall}</td><td>${player.potential}</td><td>${player.energy}/${player.form}/${player.morale}</td><td>${player.seasonGoals}</td></tr>`).join('')}
      </tbody></table></div>
    </section>
  </div>`;
}

function transferSummary(state) {
  const byExpense = new Map();
  const bySales = new Map();

  state.transferHistory.forEach((move) => {
    byExpense.set(move.toTeamName, (byExpense.get(move.toTeamName) || 0) + move.fee);
    bySales.set(move.fromTeamName, (bySales.get(move.fromTeamName) || 0) + move.fee);
  });

  const mostSpent = [...byExpense.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const mostSold = [...bySales.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const expensive = [...state.transferHistory].sort((a, b) => b.fee - a.fee).slice(0, 8);

  return `<div class="grid two">
    <div><h4>Fichajes más caros</h4><ul>${expensive.map((m) => `<li>${m.playerName}: ${m.fromTeamName} → ${m.toTeamName} (${money(m.fee)})</li>`).join('') || '<li>Sin movimientos.</li>'}</ul></div>
    <div><h4>Resumen de mercado</h4><p>Equipos que más gastan: ${mostSpent.map((m) => `${m[0]} (${money(m[1])})`).join(', ') || '—'}</p><p>Equipos que más venden: ${mostSold.map((m) => `${m[0]} (${money(m[1])})`).join(', ') || '—'}</p><p>Cláusulas ejecutadas: ${state.transferHistory.filter((m) => m.clauseExecuted).length}</p></div>
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
    <h3>Cierre y movimientos recientes</h3>
    ${transferSummary(state)}
    <div class="table-wrap"><table><thead><tr><th>Ventana</th><th>Jugador</th><th>Movimiento</th><th>Importe</th><th>Tipo</th></tr></thead><tbody>${state.transferHistory.slice(0, 20).map((m) => `<tr><td>${m.window}</td><td>${m.playerName}</td><td>${m.fromTeamName} → ${m.toTeamName}</td><td>${money(m.fee)}</td><td>${m.clauseExecuted ? 'Cláusula' : 'Traspaso'}</td></tr>`).join('') || '<tr><td colspan="5">Sin operaciones.</td></tr>'}</tbody></table></div>
  </section>`;
}

function tournamentBlock(tournament) {
  if (!tournament) return '<article class="card"><p>Sin datos de competición aún.</p></article>';
  return `<article class="card">
    <h3>${tournament.title}</h3>
    <p><strong>Ronda actual:</strong> ${tournament.currentRound} · <strong>Campeón:</strong> ${tournament.championName || 'Pendiente'}</p>
    ${tournament.rounds.map((round) => `<div class="round"><h4>${round.round}</h4><ul>${round.matches.map((m) => `<li>${m.homeName} vs ${m.awayName} · Ida ${m.firstLeg}${m.secondLeg ? ` · Vuelta ${m.secondLeg}` : ''} · Global ${m.aggregate} · Clasifica ${m.winnerName}</li>`).join('')}</ul></div>`).join('')}
  </article>`;
}

function cupEuropeView(state) {
  const summary = state.lastSeasonSummary;
  return `<section class="card"><h2>Competiciones</h2>
    <div class="grid two">
      ${trophyCard(competitions.league.name, competitions.league.icon, competitions.league.accent, summary?.leagueChampion)}
      ${trophyCard(competitions.cup.name, competitions.cup.icon, competitions.cup.accent, summary?.cupChampion)}
      ${trophyCard(competitions.champions.name, competitions.champions.icon, competitions.champions.accent, summary?.championsWinner)}
      ${trophyCard(competitions.cupWinners.name, competitions.cupWinners.icon, competitions.cupWinners.accent, summary?.cupWinnersWinner)}
      ${trophyCard(competitions.continental2.name, competitions.continental2.icon, competitions.continental2.accent, summary?.continental2Winner)}
    </div>
    <div class="grid two">
      ${tournamentBlock(state.tournaments.cup)}
      ${tournamentBlock(state.tournaments.champions)}
      ${tournamentBlock(state.tournaments.cupWinners)}
      ${tournamentBlock(state.tournaments.continental2)}
    </div>
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
    [views.matchDetail]: matchDetailView(app.state),
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
