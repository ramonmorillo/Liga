import { competitions, getCompetitionTrophy, resolveCompetitionKey } from '../data/trophies.js';
import { FORMATIONS, ensureLineupSlots, playerScore } from './lineups.js';
import { getTeamOffers, isPlayerMarketEligible, isTransferWindowOpen } from './transfers.js';
import { money, matchCard, positionNames, standingsTable, teamBadge, trophyCard, crestSvg, kitSvg, matchEventIcon } from './renderers.js';
import { buildPlayerStatusBadge, computePlayerStatus, ensurePlayerStatus } from './playerStatus.js';
import { contractSeasonsLeft, getTeamById } from './state.js';

export const views = {
  dashboard: 'dashboard',
  calendar: 'calendar',
  matchday: 'matchday',
  matchDetail: 'matchDetail',
  standings1: 'standings1',
  standings2: 'standings2',
  teams: 'teams',
  teamDetail: 'teamDetail',
  cupNational: 'cupNational',
  international: 'international',
  honours: 'honours',
  history: 'history',
  endSeason: 'endSeason',
};

export function renderNav(nav, activeView, onNavigate) {
  const items = [
    [views.dashboard, 'Dashboard'],
    [views.calendar, 'Calendario'],
    [views.matchday, 'Jornada'],
    [views.standings1, 'Clasificación Primera'],
    [views.standings2, 'Clasificación Segunda'],
    [views.cupNational, 'Copa Nacional'],
    [views.international, 'Comp. Internacionales'],
    [views.honours, 'Palmarés'],
    [views.teams, 'Equipos'],
    [views.history, 'Historia'],
    [views.endSeason, 'Fin de temporada'],
  ];

  nav.innerHTML = items.map(([key, label]) => `<button class="btn ${key === activeView ? 'primary' : ''}" data-view="${key}">${label}</button>`).join('');
  nav.querySelectorAll('[data-view]').forEach((btn) => btn.addEventListener('click', () => onNavigate(btn.dataset.view)));
}

const tag = (label) => `<span class="tag">${label}</span>`;

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
      <button class="btn primary" data-action="simulate">Simular fecha</button>
      <button class="btn" data-action="auto-lineups">Restaurar alineaciones óptimas</button>
    </section>
    <section class="card">
      <h2>Última semana simulada</h2>
      <p class="small">${latest ? `Semana ${latest.matchday} · Partido destacado: ${latest.bigMatch}` : 'Aún sin semanas simuladas.'}</p>
      <ul>${(latest?.matches || []).slice(0, 4).map((m) => `<li>${m.homeName} ${m.score} ${m.awayName}</li>`).join('') || '<li>Simula para generar resumen.</li>'}</ul>
    </section>
  </div>`;
}

function summaryCard(summary) {
  if (!summary) return '<section class="card"><p class="small">Sin resumen de semana todavía.</p></section>';
  return `<section class="card">
    <h3>Resumen semana ${summary.matchday}</h3>
    <p><strong>Partido más importante:</strong> ${summary.bigMatch}</p>
    <p><strong>Jugador destacado:</strong> ${summary.standoutPlayer}</p>
  </section>`;
}

function matchdayView(state) {
  const day = Math.min(state.currentMatchday, state.maxMatchday);
  const dayEvents = (state.seasonCalendar || []).filter((event) => event.dateIndex === day);
  const activeEvent = dayEvents[0];
  const leagueDay = activeEvent?.type === 'league' ? activeEvent.matchday : null;
  const round1 = leagueDay ? state.firstSchedule.find((entry) => entry.matchday === leagueDay) : null;
  const round2 = leagueDay ? state.secondSchedule.find((entry) => entry.matchday === leagueDay) : null;
  const byId = Object.fromEntries([...state.firstDivision, ...state.secondDivision].map((team) => [team.id, team]));

  return `<div class="grid">
    ${summaryCard(state.matchdaySummaries.at(-1))}
    <section class="card"><h2>Fecha ${day}</h2><p>${dayEvents.map((event) => tag(event.label || event.type)).join(' ') || 'Sin eventos'}</p></section>
    <section class="card"><h2>Primera División ${leagueDay ? `· Jornada ${leagueDay}` : ''}</h2>${(round1?.matches || []).map((match) => {
      const result = state.results.d1[leagueDay]?.[`${match.home}-${match.away}`];
      return matchCard(byId[match.home], byId[match.away], result, result?.matchId || '');
    }).join('') || '<p class="small">No hay jornada de liga en esta fecha.</p>'}</section>
    <section class="card"><h2>Segunda División ${leagueDay ? `· Jornada ${leagueDay}` : ''}</h2>${(round2?.matches || []).map((match) => {
      const result = state.results.d2[leagueDay]?.[`${match.home}-${match.away}`];
      return matchCard(byId[match.home], byId[match.away], result, result?.matchId || '');
    }).join('') || '<p class="small">No hay jornada de liga en esta fecha.</p>'}</section>
  </div>`;
}

function matchDetailView(state) {
  const match = state.matchArchive?.[state.selectedMatchId];
  if (!match) return '<section class="card"><p>Selecciona un partido desde la jornada o calendario.</p></section>';

  const eventLabel = (event) => {
    const kind = event.type === 'penalty' ? 'Penalti'
      : event.type === 'ownGoal' ? 'Autogol'
        : event.type === 'yellow' ? 'Amarilla'
          : event.type === 'red' ? 'Roja'
            : event.type === 'injury' ? 'Lesión'
              : 'Gol';
    return `<li><span>${event.minute}'</span> ${matchEventIcon(event.type)} ${event.playerName} · ${kind}</li>`;
  };

  return `<section class="card match-detail">
    <h2>${match.homeName} <span class="vs">vs</span> ${match.awayName}</h2>
    <p class="small">${match.competitionLabel}${match.round ? ` · ${match.round}` : ''} · Semana ${match.week}</p>
    <div class="hero-score">${match.homeGoals} - ${match.awayGoals}</div>
    <p class="small">Jugador del partido: <strong>${match.mvp}</strong> · Asistencia ${match.attendance?.attendance?.toLocaleString('es-ES') || '—'} (${match.attendance?.occupancy || '—'}%)</p>
    <div class="grid two">
      <div><h4>${match.homeName}</h4><ul class="timeline">${match.events.filter((e) => e.side === 'home').map(eventLabel).join('') || '<li>Sin incidencias</li>'}</ul></div>
      <div><h4>${match.awayName}</h4><ul class="timeline">${match.events.filter((e) => e.side === 'away').map(eventLabel).join('') || '<li>Sin incidencias</li>'}</ul></div>
    </div>
    <div class="grid two">
      <div>
        <h4>Estadísticas</h4>
        <ul>
          <li>Posesión: ${match.stats.possession[0]}% - ${match.stats.possession[1]}%</li>
          <li>Tiros: ${match.stats.shots[0]} - ${match.stats.shots[1]}</li>
          <li>Tiros a puerta: ${match.stats.shotsOnTarget[0]} - ${match.stats.shotsOnTarget[1]}</li>
        </ul>
        <p class="small">${match.summaryText || ''}</p>
      </div>
    </div>
  </section>`;
}

function calendarView(state) {
  const selectedDate = state.selectedCalendarWeek || 1;
  const grouped = (state.seasonCalendar || []).reduce((acc, event) => {
    acc[event.dateIndex] = acc[event.dateIndex] || [];
    acc[event.dateIndex].push(event);
    return acc;
  }, {});
  const selectedEvents = grouped[selectedDate] || [];

  return `<div class="grid two">
    <section class="card">
      <h2>Calendario maestro de temporada</h2>
      <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Competiciones</th><th>Estado</th><th></th></tr></thead><tbody>
      ${Object.keys(grouped).map(Number).sort((a, b) => a - b).map((dateKey) => {
        const events = grouped[dateKey];
        const isDone = events.every((event) => ['played', 'completed', 'idle'].includes(event.status));
        return `<tr>
          <td>${dateKey}</td>
          <td>${events.map((event) => tag(`${event.label} · ${event.round}${event.leg > 1 ? ` (V${event.leg})` : ''}`)).join(' ')}</td>
          <td>${isDone ? 'Completada' : 'Pendiente'}</td>
          <td><button class="btn" data-action="calendar-week" data-week="${dateKey}">Ver</button></td>
        </tr>`;
      }).join('')}
      </tbody></table></div>
    </section>
    <section class="card">
      <h3>Fecha ${selectedDate}</h3>
      <p>${selectedEvents.map((event) => tag(`${event.type}: ${event.competitionId}`)).join(' ') || ''}</p>
      <ul>${selectedEvents.flatMap((event) => event.matches || []).map((id) => {
        const match = state.matchArchive[id];
        if (!match) return '';
        const pens = match.penalties ? ` (p. ${match.penalties.home}-${match.penalties.away})` : '';
        return `<li>${match.competitionLabel}${match.round ? ` (${match.round})` : ''}${match.leg ? ` · V${match.leg}` : ''}: ${match.homeName} ${match.score}${pens} ${match.awayName} <button class="btn" data-action="open-match" data-match="${id}">Detalle</button></li>`;
      }).join('') || '<li>Fecha todavía no simulada.</li>'}</ul>
    </section>
  </div>`;
}

function clubHistoryBlock(state, team) {
  const entries = (state.history.clubSeasonStats?.[team.id] || []).slice(-5).reverse();
  const titleLog = (state.history.clubTitleLog || []).filter((entry) => entry.teamId === team.id);
  const grouped = titleLog.reduce((acc, entry) => {
    const key = resolveCompetitionKey(entry.titleKey);
    acc[key] = acc[key] || { key, seasons: [] };
    if (!acc[key].seasons.includes(entry.season)) acc[key].seasons.push(entry.season);
    return acc;
  }, {});

  const trophies = Object.values(grouped)
    .map((item) => {
      const trophy = getCompetitionTrophy(item.key);
      return { ...item, trophy, count: item.seasons.length, seasons: [...item.seasons].sort((a, b) => a - b) };
    })
    .sort((a, b) => b.count - a.count || a.trophy.name.localeCompare(b.trophy.name));

  const all = state.history.clubSeasonStats?.[team.id] || [];
  const best = all.length ? Math.min(...all.map((x) => x.position)) : '—';
  const worst = all.length ? Math.max(...all.map((x) => x.position)) : '—';
  const div1 = all.filter((x) => x.division === 1).length;
  const div2 = all.filter((x) => x.division === 2).length;

  return `<section class="card">
    <h3>Palmarés</h3>
    ${trophies.length ? `<div class="trophy-grid compact">${trophies.map((entry) => `<article class="trophy-row" style="--accent:${entry.trophy.accent}">
      <span class="trophy-mark">${entry.trophy.icon}</span>
      <div>
        <strong>${entry.trophy.name}</strong>
        <p class="small">${entry.count} título${entry.count > 1 ? 's' : ''} · Temporadas ${entry.seasons.join(', ')}</p>
      </div>
    </article>`).join('')}</div>` : '<p class="small">Sin títulos oficiales todavía.</p>'}
    <p><strong>Mejor/Peor posición:</strong> ${best} / ${worst} · <strong>Temporadas:</strong> Primera ${div1} · Segunda ${div2}</p>
    <div class="table-wrap"><table><thead><tr><th>Temp</th><th>Div</th><th>Pos</th><th>Pts</th></tr></thead><tbody>
    ${entries.map((e) => `<tr><td>${e.season}</td><td>${e.division}</td><td>${e.position}</td><td>${e.points}</td></tr>`).join('') || '<tr><td colspan="4">Sin histórico aún</td></tr>'}
    </tbody></table></div>
  </section>`;
}

function teamsView(state) {
  const block = (title, teams) => `<section class="card"><h3>${title}</h3><div class="table-wrap"><table><thead><tr><th>Equipo</th><th>Div</th><th>Entrenador</th><th>Afición</th><th>Estadio</th><th>Presupuesto</th><th></th></tr></thead><tbody>
  ${teams.map((team) => `<tr><td>${teamBadge(team)}</td><td>${team.division}</td><td>${team.coach?.name || '<span class="danger">Vacante</span>'}</td><td>${team.fanMood}</td><td>${team.stadium.name}</td><td>${money(team.budget)}</td><td><button class="btn" data-team="${team.id}" data-action="team-detail">Ver</button></td></tr>`).join('')}
  </tbody></table></div></section>`;

  return `<div class="grid">${block('Primera División', state.firstDivision)}${block('Segunda División', state.secondDivision)}</div>`;
}

function teamDetailView(state) {
  const team = getTeamById(state, state.selectedTeamId || state.userTeamId);
  if (!team) return '<section class="card"><p>Equipo no encontrado.</p></section>';

  const sorted = [...team.squad].sort((a, b) => b.overall - a.overall);
  const avgAttendance = team.stadium.seasonHomeMatches ? Math.round(team.stadium.seasonAttendanceTotal / team.stadium.seasonHomeMatches) : 0;
  const financeRows = (team.financialHistory || []).slice(0, 8);
  const marketRows = (team.marketHistory || []).slice(0, 12);
  const freeCoaches = [...(state.freeCoaches || [])].sort((a, b) => b.rating - a.rating).slice(0, 14);

  state.ui = state.ui || { teamDetailTab: 'squad', selectedPlayerId: null };
  const tabs = [
    { key: 'squad', label: 'Plantilla' },
    { key: 'lineup', label: 'Once titular' },
    { key: 'sponsor', label: 'Patrocinio' },
    { key: 'economy', label: 'Economía' },
    { key: 'offers', label: 'Mercado' },
    { key: 'honours', label: 'Palmarés' },
  ];
  const activeTab = tabs.some((tab) => tab.key === state.ui.teamDetailTab) ? state.ui.teamDetailTab : 'squad';
  const selectedPlayer = team.squad.find((p) => p.id === state.ui.selectedPlayerId) || sorted[0] || null;
  ensureLineupSlots(team);
  const lineupSlots = team.lineup?.starterSlots || [];

  const playerRow = (player) => {
    const status = buildPlayerStatusBadge(player);
    const contractLeft = contractSeasonsLeft(player, state.year);
    const releaseAllowed = team.squad.length > 18 && player.form <= 64;
    return `<tr>
      <td><button class="btn" data-action="player-detail" data-player="${player.id}">${player.name} ${player.surname}</button></td>
      <td>${status.icon} ${status.label}</td>
      <td>${positionNames[player.position]}</td>
      <td>${player.age}</td>
      <td>${player.nationality}</td>
      <td>${player.overall}</td>
      <td>${player.potential}</td>
      <td>Hasta ${player.contractEndYear || '—'}</td>
      <td>${contractLeft} temp.</td>
      <td>${player.energy}/${player.form}/${player.morale}</td>
      <td>${player.seasonGoals}</td>
      <td>${releaseAllowed ? `<button class="btn danger" data-action="release-player" data-team="${team.id}" data-player="${player.id}">Dar carta de libertad</button>` : '<span class="small">No recomendado</span>'}</td>
    </tr>`;
  };

  const selectedStatus = selectedPlayer ? buildPlayerStatusBadge(selectedPlayer) : null;
  if (selectedPlayer) {
    ensurePlayerStatus(selectedPlayer);
    computePlayerStatus(selectedPlayer);
  }

  const squadTab = `<section class="card">
      <h3>Plantilla</h3>
      ${selectedPlayer ? `<div class="player-focus"><strong>${selectedPlayer.name} ${selectedPlayer.surname}</strong><span class="tag">${selectedStatus.icon} ${selectedStatus.label}</span><span class="small">Posición ${positionNames[selectedPlayer.position]} · Valor ${money(selectedPlayer.value)}</span></div>` : ''}
      <div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Estado</th><th>Pos</th><th>Edad</th><th>Nac.</th><th>Med</th><th>Pot</th><th>Contrato</th><th>Restante</th><th>E/F/M</th><th>Goles</th><th>Acciones</th></tr></thead><tbody>
      ${sorted.map(playerRow).join('')}
      </tbody></table></div>
    </section>`;

  const economyTab = `<section class="card">
      <h3>Economía reciente</h3>
      <p><strong>Presupuesto actual:</strong> ${money(team.budget)}</p>
      <div class="table-wrap"><table><thead><tr><th>Concepto</th><th>Importe</th><th>Temp.</th></tr></thead><tbody>
      ${financeRows.map((row) => `<tr><td>${row.text}</td><td>${money(row.amount)}</td><td>${row.season}</td></tr>`).join('') || '<tr><td colspan="3">Sin movimientos recientes.</td></tr>'}
      </tbody></table></div>
      <h3>Movimientos de mercado</h3>
      <div class="table-wrap"><table><thead><tr><th>Temp.</th><th>Operación</th><th>Jugador</th><th>Origen</th><th>Destino</th><th>Coste</th></tr></thead><tbody>
      ${marketRows.map((row) => `<tr><td>${row.season}</td><td>${row.operation || row.type}</td><td>${row.playerName || '—'}</td><td>${row.origin || row.fromTeamName || team.name}</td><td>${row.destination || row.toTeamName || team.name}</td><td>${typeof row.fee === 'number' ? money(row.fee) : typeof row.cost === 'number' ? money(row.cost) : '—'}</td></tr>`).join('') || '<tr><td colspan="6">Sin movimientos de mercado registrados.</td></tr>'}
      </tbody></table></div>
    </section>`;

  const sponsorOffers = (team.sponsorship?.offers || []).filter((offer) => ['pending', 'rechazada', 'activa'].includes(offer.status)).slice(0, 8);
  const activeSponsor = (team.sponsorship?.contracts || []).find((contract) => contract.id === team.sponsorship?.activeContractId && contract.status === 'active');
  const sponsorTab = `<section class="card">
      <h3>Patrocinio de camiseta</h3>
      <p><strong>Patrocinador activo:</strong> ${activeSponsor ? `${activeSponsor.sponsor} (hasta T${activeSponsor.endSeason})` : 'Sin patrocinador principal'}</p>
      <div class="table-wrap"><table><thead><tr><th>Marca</th><th>Importe</th><th>Duración</th><th>Inicio</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
      ${sponsorOffers.map((offer) => `<tr>
        <td>${offer.sponsor}</td>
        <td>${money(offer.amount)}/temp.</td>
        <td>${offer.seasons}</td>
        <td>${offer.startSeason}</td>
        <td>${offer.status}</td>
        <td>${offer.status === 'pending' && team.id === state.userTeamId ? `<button class="btn primary" data-action="accept-sponsor" data-team="${team.id}" data-offer="${offer.id}">Aceptar</button>
          <button class="btn danger" data-action="reject-sponsor" data-team="${team.id}" data-offer="${offer.id}">Rechazar</button>` : '<span class="small">Gestionado</span>'}</td>
      </tr>`).join('') || '<tr><td colspan="6">Sin ofertas nuevas.</td></tr>'}
      </tbody></table></div>
    </section>`;

  const slotCard = (slot) => {
    const player = team.squad.find((entry) => entry.id === slot.playerId);
    const adaptation = Math.round((slot.adaptation || 0) * 100);
    return `<button class="lineup-slot ${adaptation < 70 ? 'out-of-role' : ''}" data-action="select-slot" data-slot="${slot.slotId}" style="left:${slot.x}%;top:${slot.y}%;">
      <strong>${player ? `${player.name} ${player.surname}` : 'Vacío'}</strong>
      <span>${slot.role} · ${player ? player.position : '—'} · Ajuste ${adaptation}%</span>
    </button>`;
  };
  const selectedSlot = state.ui.selectedLineupSlot || lineupSlots[0]?.slotId;
  const lineupTab = `<section class="card">
      <h3>Once titular y táctica</h3>
      <div class="pitch">${lineupSlots.map(slotCard).join('')}</div>
      <h4>Banquillo</h4>
      <div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Pos</th><th>Nivel</th><th>Acción</th></tr></thead><tbody>
      ${(team.lineup?.bench || []).map((playerId) => {
    const player = team.squad.find((entry) => entry.id === playerId);
    if (!player) return '';
    return `<tr><td>${player.name} ${player.surname}</td><td>${player.position}</td><td>${Math.round(playerScore(player))}</td><td>
      <button class="btn" data-action="swap-lineup" data-team="${team.id}" data-slot="${selectedSlot}" data-player="${player.id}" ${selectedSlot ? '' : 'disabled'}>Entrar por slot ${selectedSlot || '—'}</button>
    </td></tr>`;
  }).join('') || '<tr><td colspan="4">Sin suplentes disponibles.</td></tr>'}
      </tbody></table></div>
    </section>`;

  const honoursTab = clubHistoryBlock(state, team);
  const incomingOffers = getTeamOffers(state, team.id);
  const playersInMarket = team.squad.filter((player) => isPlayerMarketEligible(player, state.year));
  const userTeam = getTeamById(state, state.userTeamId);
  const isSellerUserTeam = team.id === state.userTeamId;
  const canBidFromUserTeam = userTeam && userTeam.id !== team.id && isTransferWindowOpen(state);
  const offersTab = `<section class="card">
      <h3>Mercado del club</h3>
      <p class="small">Ventana actual: ${isTransferWindowOpen(state) ? state.transferWindow : 'cerrado'}.</p>
      <div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Pos</th><th>Edad</th><th>Valor</th><th>Contrato</th><th>Ofertas</th><th>Acciones</th></tr></thead><tbody>
      ${playersInMarket.map((player) => {
    const playerOffers = incomingOffers.filter((offer) => offer.playerId === player.id);
    const offerList = playerOffers.map((offer) => `${offer.buyerTeamName}: ${money(offer.amount)} (${offer.status})`).join('<br>');
    const bestAmount = Math.round(player.value * 1.08);
    return `<tr>
          <td>${player.name} ${player.surname}</td>
          <td>${positionNames[player.position]}</td>
          <td>${player.age}</td>
          <td>${money(player.value)}</td>
          <td>Hasta ${player.contractEndYear || '—'}</td>
          <td>${offerList || '<span class="small">Sin ofertas</span>'}</td>
          <td>
            ${canBidFromUserTeam ? `<button class="btn" data-action="make-offer" data-seller="${team.id}" data-player="${player.id}" data-amount="${bestAmount}">Ofertar ${money(bestAmount)}</button>` : ''}
            ${playerOffers.filter((offer) => offer.status === 'pending').map((offer) => isSellerUserTeam
      ? `<button class="btn primary" data-action="accept-offer" data-offer="${offer.id}">Aceptar</button><button class="btn danger" data-action="reject-offer" data-offer="${offer.id}">Rechazar</button>`
      : `<span class="small">${offer.status === 'pending' ? 'Pendiente (IA)' : offer.status}</span>`).join('')}
          </td>
        </tr>`;
  }).join('') || '<tr><td colspan="7">No hay jugadores en mercado para este club.</td></tr>'}
      </tbody></table></div>
    </section>`;

  return `<div class="grid two">
    <section class="card">
      <div class="club-head">${crestSvg(team, 72)}<div><h2>${team.name}</h2><p>División ${team.division} · Estilo ${team.style}</p></div></div>
      <p><strong>Entrenador:</strong> ${team.coach ? `${team.coach.name} (${team.coach.age}) · ${team.coach.style}` : '<span class="danger">Vacante abierta</span>'}</p>
      <p><strong>Estadio:</strong> ${team.stadium.name} (${team.stadium.capacity.toLocaleString('es-ES')})</p>
      <p><strong>Afición:</strong> ${team.fanMood} · Media ${avgAttendance.toLocaleString('es-ES')}</p>
      <p><strong>Formación:</strong>
      <select data-action="formation" data-team="${team.id}">${Object.keys(FORMATIONS).map((f) => `<option value="${f}" ${team.lineup.formation === f ? 'selected' : ''}>${f}</option>`).join('')}</select></p>
      <button class="btn" data-action="set-user-team" data-team="${team.id}">Controlar este equipo</button>
      <button class="btn" data-action="auto-team-lineup" data-team="${team.id}">Alineación óptima</button>
      <button class="btn danger" data-action="dismiss-coach" data-team="${team.id}" ${team.coach ? '' : 'disabled'}>Cesar entrenador</button>
      <h4>Entrenadores libres</h4>
      <div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Nac.</th><th>Estilo</th><th>Nivel</th><th>Coste anual</th><th></th></tr></thead><tbody>
      ${freeCoaches.map((coach) => `<tr><td>${coach.name}</td><td>${coach.nationality || 'España'}</td><td>${coach.style}</td><td>${coach.rating}</td><td>${money(coach.salary || 0)}</td><td><button class="btn" data-action="hire-coach" data-team="${team.id}" data-coach="${coach.id}" ${team.coach ? 'disabled' : ''}>Contratar</button></td></tr>`).join('') || '<tr><td colspan="6">No hay técnicos libres.</td></tr>'}
      </tbody></table></div>
      <div class="kit-row"><div><h5>Primera</h5>${kitSvg(team.kits.primary, 72, team.sponsorship?.currentSponsor || '')}</div><div><h5>Segunda</h5>${kitSvg(team.kits.away, 72, team.sponsorship?.currentSponsor || '')}</div></div>
      <div class="tabs">${tabs.map((tab) => `<button class="btn ${activeTab === tab.key ? 'primary' : ''}" data-action="team-tab" data-tab="${tab.key}">${tab.label}</button>`).join('')}</div>
    </section>
    ${activeTab === 'squad' ? squadTab : activeTab === 'lineup' ? lineupTab : activeTab === 'sponsor' ? sponsorTab : activeTab === 'economy' ? economyTab : activeTab === 'offers' ? offersTab : honoursTab}
  </div>`;
}

function tournamentBlock(tournament) {
  if (!tournament) return '<article class="card"><p>No disponible en esta temporada.</p></article>';
  if (tournament.skipped) return `<article class="card"><h3>${tournament.title}</h3><p class="small">No disputada: ${tournament.skipReason}.</p></article>`;
  const roundColumn = (round, idx, rounds) => `<div class="bracket-col">
    <h4>${round.round}</h4>
    ${round.matches.map((m) => {
    const isPlayed = Boolean(m.winnerId);
    const isFinalRound = idx === rounds.length - 1;
    const home = m.winnerId === m.homeTeamId ? `<strong>${m.homeName}</strong>` : m.homeName;
    const away = m.winnerId === m.awayTeamId ? `<strong>${m.awayName}</strong>` : m.awayName;
    const leg1 = m.leg1?.score ? `Ida ${m.leg1.score}` : null;
    const leg2 = m.leg2?.score ? `Vuelta ${m.leg2.score}` : null;
    const legInfo = [leg1, leg2].filter(Boolean).join(' · ');
    const aggregate = m.aggregate ? `Global ${m.aggregate}` : '';
    const statusLabel = isPlayed ? 'Completado' : 'Pendiente';
    return `<div class="bracket-match ${isPlayed ? 'played' : 'pending'} ${isFinalRound ? 'is-final' : ''}">
      <div class="bracket-teams"><span>${home}</span><span>${away}</span></div>
      <small>${[legInfo, aggregate].filter(Boolean).join(' · ') || 'Cruce pendiente'}</small>
      <span class="round-status">${statusLabel}</span>
    </div>`;
  }).join('') || '<div class="bracket-match pending"><small>Pendiente</small><span class="round-status">Pendiente</span></div>'}
  </div>`;

  return `<article class="card">
    <h3>${tournament.title}</h3>
    <p><strong>Campeón:</strong> ${tournament.championName || 'Pendiente'}</p>
    <div class="bracket">${tournament.rounds.map((round, idx, rounds) => roundColumn(round, idx, rounds)).join('')}</div>
  </article>`;
}

function palmaresTableCard(title, editions, includeRunnerUp = false) {
  const totals = editions.reduce((acc, entry) => {
    acc[entry.champion] = (acc[entry.champion] || 0) + 1;
    return acc;
  }, {});

  return `<article class="card">
    <h4>${title}</h4>
    <p class="small">${Object.entries(totals).map(([club, count]) => `${club} (${count})`).join(' · ') || 'Sin títulos registrados.'}</p>
    <div class="table-wrap"><table><thead><tr><th>Temp.</th><th>Campeón</th>${includeRunnerUp ? '<th>Subcampeón</th>' : ''}</tr></thead><tbody>
    ${[...editions].reverse().map((entry) => `<tr><td>${entry.season}</td><td>${entry.champion}</td>${includeRunnerUp ? `<td>${entry.runnerUp || '—'}</td>` : ''}</tr>`).join('')}
    </tbody></table></div>
  </article>`;
}

function internationalPalmaresBlock(state) {
  const data = state.history.internationalPalmares || {};
  const items = Object.entries(data);
  if (!items.length) return '<article class="card"><h3>Palmarés internacional</h3><p class="small">Sin ediciones cerradas todavía.</p></article>';

  return `<section class="grid">
    ${items.map(([key, editions]) => {
      const title = editions[0]?.competition || key;
      return palmaresTableCard(title, editions, true);
    }).join('')}
  </section>`;
}

function cupNationalView(state) {
  const summary = state.lastSeasonSummary;
  return `<section class="grid">
    <article class="card">
      <h2>Copa Nacional</h2>
      <div class="grid two">
        ${trophyCard(competitions.cup.name, competitions.cup.icon, competitions.cup.accent, summary?.cupChampion)}
        ${trophyCard(competitions.supercup.name, competitions.supercup.icon, competitions.supercup.accent, summary?.supercupWinner)}
      </div>
    </article>
    ${tournamentBlock(state.tournaments.cup)}
    ${tournamentBlock(state.tournaments.supercup)}
  </section>`;
}

const internationalTabs = [
  { key: 'champions', label: competitions.champions.name, tournamentKey: 'champions' },
  { key: 'cupWinners', label: competitions.cupWinners.name, tournamentKey: 'cupWinners' },
  { key: 'continental2', label: competitions.continental2.name, tournamentKey: 'continental2' },
  { key: 'internationalSupercup', label: competitions.internationalSupercup.name, tournamentKey: 'internationalSupercup' },
];

function internationalCompetitionsView(state) {
  state.ui = state.ui || {};
  const activeKey = internationalTabs.some((tab) => tab.key === state.ui.internationalTab)
    ? state.ui.internationalTab
    : internationalTabs[0].key;
  const active = internationalTabs.find((tab) => tab.key === activeKey) || internationalTabs[0];
  const summary = state.lastSeasonSummary;

  const winnerMap = {
    champions: summary?.championsWinner,
    cupWinners: summary?.cupWinnersWinner,
    continental2: summary?.continental2Winner,
    internationalSupercup: summary?.internationalSupercupWinner,
  };

  return `<section class="grid">
    <article class="card">
      <h2>Competiciones Internacionales</h2>
      <p class="small">Sigue cada torneo en su pestaña independiente.</p>
      <div class="tabs">${internationalTabs.map((tab) => `<button class="btn ${tab.key === activeKey ? 'primary' : ''}" data-action="intl-tab" data-tab="${tab.key}">${tab.label}</button>`).join('')}</div>
      <div class="grid two">
        ${trophyCard(competitions[active.key].name, competitions[active.key].icon, competitions[active.key].accent, winnerMap[active.key])}
      </div>
    </article>
    ${tournamentBlock(state.tournaments[active.tournamentKey])}
    <article class="card"><h3>Ligas europeas ficticias</h3>
    <div class="table-wrap"><table><thead><tr><th>Liga</th><th>Campeón</th><th>Campeón de copa</th></tr></thead><tbody>
    ${(state.europeExternal.leagues || []).map((l) => `<tr><td>${l.name}</td><td>${l.champion}</td><td>${l.cupChampion}</td></tr>`).join('') || '<tr><td colspan="3">Se generarán al cerrar la temporada 1.</td></tr>'}
    </tbody></table></div></article>
  </section>`;
}

function palmaresNationalBlock(state) {
  const rows = [...(state.history.globalBySeason || [])];
  if (!rows.length) return '<article class="card"><h3>Palmarés nacional</h3><p class="small">Sin temporadas finalizadas aún.</p></article>';

  const byCompetition = {
    [competitions.league.name]: rows.map((row) => ({ season: row.season, champion: row.leagueChampion })),
    [competitions.league2.name]: rows.map((row) => ({ season: row.season, champion: row.secondDivisionChampion })).filter((row) => row.champion),
    [competitions.cup.name]: rows.map((row) => ({ season: row.season, champion: row.cupChampion })),
    [competitions.supercup.name]: rows.map((row) => ({ season: row.season, champion: row.supercupWinner })).filter((row) => row.champion && row.champion !== 'Pendiente'),
  };

  return `<section class="grid">
    ${Object.entries(byCompetition).map(([title, editions]) => palmaresTableCard(title, editions)).join('')}
  </section>`;
}

function honoursView(state) {
  state.ui = state.ui || {};
  const active = state.ui.honoursTab === 'international' ? 'international' : 'national';
  return `<section class="grid">
    <article class="card">
      <h2>Palmarés</h2>
      <p class="small">Histórico separado de las competiciones activas.</p>
      <div class="tabs">
        <button class="btn ${active === 'national' ? 'primary' : ''}" data-action="honours-tab" data-tab="national">Palmarés nacional</button>
        <button class="btn ${active === 'international' ? 'primary' : ''}" data-action="honours-tab" data-tab="international">Palmarés internacional</button>
      </div>
    </article>
    ${active === 'national' ? palmaresNationalBlock(state) : internationalPalmaresBlock(state)}
  </section>`;
}

function historyView(state) {
  const rows = [...state.history.globalBySeason].reverse();
  const finals = [...(state.history.finalStandingsBySeason || [])].sort((a, b) => b.season - a.season);
  const selectedSeason = state.ui?.historySeason || finals[0]?.season || null;
  const selectedDivision = state.ui?.historyDivision || 'd1';
  const selectedData = finals.find((item) => item.season === Number(selectedSeason)) || null;
  const selectedRows = selectedData?.[selectedDivision] || [];

  const historicalTable = `<article class="card"><h3>Clasificaciones históricas</h3>
    <div class="filters">
      <label>Temporada <select data-action="history-season">${finals.map((item) => `<option value="${item.season}" ${Number(selectedSeason) === item.season ? 'selected' : ''}>${item.season} (${item.year})</option>`).join('')}</select></label>
      <div class="tabs">
        <button class="btn ${selectedDivision === 'd1' ? 'primary' : ''}" data-action="history-division" data-division="d1">Primera</button>
        <button class="btn ${selectedDivision === 'd2' ? 'primary' : ''}" data-action="history-division" data-division="d2">Segunda</button>
      </div>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Pos</th><th>Equipo</th><th>Pts</th><th>GF</th><th>GC</th><th>DG</th><th>V</th><th>E</th><th>D</th></tr></thead><tbody>
    ${selectedRows.map((row) => `<tr><td>${row.position}</td><td>${row.teamName}</td><td>${row.points}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.gd}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td></tr>`).join('') || '<tr><td colspan="9">No hay clasificación congelada para esa temporada.</td></tr>'}
    </tbody></table></div>
  </article>`;

  return `<section class="card"><h2>Histórico global</h2>
    <div class="table-wrap"><table><thead><tr><th>Temp.</th><th>Liga</th><th>Copa</th><th>Europa clasificados</th><th>Pichichi</th><th>Zamora</th><th>Ascensos</th><th>Descensos</th></tr></thead><tbody>
    ${rows.map((item) => `<tr><td>${item.season}</td><td>${item.leagueChampion}</td><td>${item.cupChampion}</td><td>${[...item.europeQualified.champions, ...item.europeQualified.cupWinners, ...item.europeQualified.continental2].join(', ')}</td><td>${item.pichichi}</td><td>${item.zamora}</td><td>${item.promoted.join(', ')}</td><td>${item.relegated.join(', ')}</td></tr>`).join('') || '<tr><td colspan="8">Aún no hay temporadas finalizadas.</td></tr>'}
    </tbody></table></div>
    ${finals.length ? historicalTable : '<p class="small">Las clasificaciones finales se guardarán al cerrar cada temporada.</p>'}
  </section>`;
}

function endSeasonView(state) {
  const summary = state.lastSeasonSummary;
  if (!summary) return '<section class="card"><h2>Fin de temporada</h2><p class="small">Completa una temporada para ver el resumen.</p></section>';
  return `<section class="card"><h2>Resumen temporada ${summary.season}</h2>
    <p><strong>Campeón de Liga:</strong> ${summary.leagueChampion}</p>
    <p><strong>Campeón de Copa:</strong> ${summary.cupChampion}</p>
    <p><strong>Campeón Copa de Campeones:</strong> ${summary.championsWinner}</p>
    <p><strong>Campeón Copa de Campeones de Copa:</strong> ${summary.cupWinnersWinner}</p>
    <p><strong>Campeón Copa Continental:</strong> ${summary.continental2Winner}</p>
    <p><strong>Clasificados a Europa:</strong> ${[...summary.europeQualified.champions, ...summary.europeQualified.cupWinners, ...summary.europeQualified.continental2].join(', ')}</p>
    <p><strong>Ascensos:</strong> ${summary.promoted.join(', ')}</p>
    <p><strong>Descensos:</strong> ${summary.relegated.join(', ')}</p>
    <h3>Premios económicos</h3>
    <ul>${(summary.prizeEvents || []).map((event) => `<li>${event.teamName}: ${money(event.amount)} por ${event.text}</li>`).join('') || '<li>Sin premios registrados.</li>'}</ul>
  </section>`;
}

export function render(root, app) {
  const teamsById = Object.fromEntries([...app.state.firstDivision, ...app.state.secondDivision].map((team) => [team.id, team]));
  const viewMap = {
    [views.dashboard]: dashboardView(app.state),
    [views.calendar]: calendarView(app.state),
    [views.matchday]: matchdayView(app.state),
    [views.matchDetail]: matchDetailView(app.state),
    [views.standings1]: `<section class="card"><h2>Primera División</h2>${standingsTable(app.state.firstStandings, teamsById)}</section>`,
    [views.standings2]: `<section class="card"><h2>Segunda División</h2>${standingsTable(app.state.secondStandings, teamsById)}</section>`,
    [views.teams]: teamsView(app.state),
    [views.teamDetail]: teamDetailView(app.state),
    [views.cupNational]: cupNationalView(app.state),
    [views.international]: internationalCompetitionsView(app.state),
    [views.honours]: honoursView(app.state),
    [views.history]: historyView(app.state),
    [views.endSeason]: endSeasonView(app.state),
  };

  root.innerHTML = viewMap[app.view] || viewMap.dashboard;
}
