import { competitions } from '../data/trophies.js';
import { FORMATIONS } from './lineups.js';
import { getMarketPlayers, isTransferWindowOpen } from './transfers.js';
import { money, matchCard, positionNames, standingsTable, teamBadge, trophyCard, crestSvg, kitSvg } from './renderers.js';
import { getTeamById } from './state.js';

export const views = {
  dashboard: 'dashboard',
  calendar: 'calendar',
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
    [views.calendar, 'Calendario'],
    [views.matchday, 'Jornada'],
    [views.standings1, 'Clasificación Primera'],
    [views.standings2, 'Clasificación Segunda'],
    [views.teams, 'Equipos'],
    [views.market, 'Mercado'],
    [views.cupEurope, 'Copa y Europa'],
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
  const round1 = state.firstSchedule.find((entry) => entry.matchday === day);
  const round2 = state.secondSchedule.find((entry) => entry.matchday === day);
  const dayEvents = (state.seasonCalendar || []).filter((event) => event.dateIndex === day);
  const byId = Object.fromEntries([...state.firstDivision, ...state.secondDivision].map((team) => [team.id, team]));

  return `<div class="grid">
    ${summaryCard(state.matchdaySummaries.at(-1))}
    <section class="card"><h2>Fecha ${day}</h2><p>${dayEvents.map((event) => tag(event.label || event.type)).join(' ') || 'Sin eventos'}</p></section>
    <section class="card"><h2>Primera División · Jornada ${day}</h2>${(round1?.matches || []).map((match) => {
      const result = state.results.d1[day]?.[`${match.home}-${match.away}`];
      return matchCard(byId[match.home], byId[match.away], result, result?.matchId || '');
    }).join('')}</section>
    <section class="card"><h2>Segunda División · Jornada ${day}</h2>${(round2?.matches || []).map((match) => {
      const result = state.results.d2[day]?.[`${match.home}-${match.away}`];
      return matchCard(byId[match.home], byId[match.away], result, result?.matchId || '');
    }).join('')}</section>
  </div>`;
}

function matchDetailView(state) {
  const match = state.matchArchive?.[state.selectedMatchId];
  if (!match) return '<section class="card"><p>Selecciona un partido desde la jornada o calendario.</p></section>';

  return `<section class="card match-detail">
    <h2>${match.homeName} <span class="vs">vs</span> ${match.awayName}</h2>
    <p class="small">${match.competitionLabel}${match.round ? ` · ${match.round}` : ''} · Semana ${match.week}</p>
    <div class="hero-score">${match.homeGoals} - ${match.awayGoals}</div>
    <p class="small">Jugador del partido: <strong>${match.mvp}</strong> · Asistencia ${match.attendance?.attendance?.toLocaleString('es-ES') || '—'} (${match.attendance?.occupancy || '—'}%)</p>
    <div class="grid two">
      <div>
        <h4>Goles</h4>
        <ul class="timeline">${match.goals.map((e) => `<li><span>${e.minute}'</span> ⚽ ${e.playerName}</li>`).join('') || '<li>Sin goles registrados</li>'}</ul>
        <h4>Tarjetas</h4>
        <ul class="timeline">${match.cards.map((e) => `<li><span>${e.minute}'</span> ${e.type === 'red' ? '🟥' : '🟨'} ${e.playerName}</li>`).join('') || '<li>Sin tarjetas</li>'}</ul>
        <h4>Lesiones</h4>
        <ul class="timeline">${match.injuries.map((e) => `<li><span>${e.minute}'</span> 🩹 ${e.playerName}${e.severity ? ` (${e.severity})` : ''}</li>`).join('') || '<li>Sin lesiones</li>'}</ul>
      </div>
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
        const isDone = events.every((event) => event.status === 'played' || event.status === 'idle');
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
  const titles = {
    league: state.history.clubTitles?.[`${team.id}:league`] || 0,
    cup: state.history.clubTitles?.[`${team.id}:cup`] || 0,
    champions: state.history.clubTitles?.[`${team.id}:champions`] || 0,
    cupWinners: state.history.clubTitles?.[`${team.id}:cupWinners`] || 0,
    continental2: state.history.clubTitles?.[`${team.id}:continental2`] || 0,
  };
  const all = state.history.clubSeasonStats?.[team.id] || [];
  const best = all.length ? Math.min(...all.map((x) => x.position)) : '—';
  const worst = all.length ? Math.max(...all.map((x) => x.position)) : '—';
  const div1 = all.filter((x) => x.division === 1).length;
  const div2 = all.filter((x) => x.division === 2).length;
  const lastTitle = [...(state.history.clubTitleLog || [])].reverse().find((x) => x.teamId === team.id);

  return `<section class="card">
    <h3>Histórico del club</h3>
    <p><strong>Títulos:</strong> Liga ${titles.league} · Copa ${titles.cup} · Int. ${titles.champions + titles.cupWinners + titles.continental2}</p>
    <p><strong>Mejor/Peor posición:</strong> ${best} / ${worst} · <strong>Temporadas:</strong> Primera ${div1} · Segunda ${div2}</p>
    <p><strong>Último título:</strong> ${lastTitle ? `${lastTitle.titleKey} (T${lastTitle.season})` : 'Ninguno'}</p>
    <div class="table-wrap"><table><thead><tr><th>Temp</th><th>Div</th><th>Pos</th><th>Pts</th></tr></thead><tbody>
    ${entries.map((e) => `<tr><td>${e.season}</td><td>${e.division}</td><td>${e.position}</td><td>${e.points}</td></tr>`).join('') || '<tr><td colspan="4">Sin histórico aún</td></tr>'}
    </tbody></table></div>
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

  return `<div class="grid two">
    <section class="card">
      <div class="club-head">${crestSvg(team, 72)}<div><h2>${team.name}</h2><p>División ${team.division} · Estilo ${team.style}</p></div></div>
      <p><strong>Entrenador:</strong> ${team.coach.name} (${team.coach.age}) · ${team.coach.style}</p>
      <p><strong>Estadio:</strong> ${team.stadium.name} (${team.stadium.capacity.toLocaleString('es-ES')})</p>
      <p><strong>Afición:</strong> ${team.fanMood} · Media ${avgAttendance.toLocaleString('es-ES')}</p>
      <p><strong>Presupuesto:</strong> ${money(team.budget)}</p>
      <p><strong>Formación:</strong>
      <select data-action="formation" data-team="${team.id}">${Object.keys(FORMATIONS).map((f) => `<option value="${f}" ${team.lineup.formation === f ? 'selected' : ''}>${f}</option>`).join('')}</select></p>
      <button class="btn" data-action="set-user-team" data-team="${team.id}">Controlar este equipo</button>
      <button class="btn" data-action="auto-team-lineup" data-team="${team.id}">Alineación óptima</button>
      <div class="kit-row"><div><h5>Primera</h5>${kitSvg(team.kits.primary, 72)}</div><div><h5>Segunda</h5>${kitSvg(team.kits.away, 72)}</div></div>
    </section>
    <section class="card">
      <h3>Plantilla</h3>
      <div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Pos</th><th>Edad</th><th>Nac.</th><th>Med</th><th>Pot</th><th>E/F/M</th><th>Goles</th></tr></thead><tbody>
      ${sorted.map((player) => `<tr><td>${player.name} ${player.surname}</td><td>${positionNames[player.position]}</td><td>${player.age}</td><td>${player.nationality}</td><td>${player.overall}</td><td>${player.potential}</td><td>${player.energy}/${player.form}/${player.morale}</td><td>${player.seasonGoals}</td></tr>`).join('')}
      </tbody></table></div>
    </section>
    ${clubHistoryBlock(state, team)}
  </div>`;
}

function marketView(state, filters) {
  const userTeam = getTeamById(state, state.userTeamId);
  const players = getMarketPlayers(state, filters).slice(0, 80);
  return `<section class="card">
    <h2>Mercado de fichajes (${isTransferWindowOpen(state) ? state.transferWindow : 'cerrado'})</h2>
    <p>Presupuesto ${userTeam.name}: <strong>${money(userTeam.budget)}</strong></p>
    <div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Club</th><th>Pos</th><th>Edad</th><th>Media</th><th>Pot</th><th>Valor</th><th>Acciones</th></tr></thead><tbody>
    ${players.map((player) => `<tr><td>${player.name} ${player.surname}</td><td>${player.teamName}</td><td>${player.position}</td><td>${player.age}</td><td>${player.overall}</td><td>${player.potential}</td><td>${money(player.value)}</td><td><button class="btn" data-action="buy" data-player="${player.id}" data-team="${player.teamId}">Oferta</button></td></tr>`).join('')}
    </tbody></table></div>
  </section>`;
}

function tournamentBlock(tournament) {
  if (!tournament) return '<article class="card"><p>No disponible en esta temporada.</p></article>';
  return `<article class="card">
    <h3>${tournament.title}</h3>
    <p><strong>Campeón:</strong> ${tournament.championName || 'Pendiente'}</p>
    ${tournament.rounds.map((round) => `<div class="round"><h4>${round.round} · Fechas ${round.dates.join(' / ')}</h4><ul>${round.matches.map((m) => {
      const home = m.winnerId === m.homeTeamId ? `<strong>${m.homeName}</strong>` : m.homeName;
      const away = m.winnerId === m.awayTeamId ? `<strong>${m.awayName}</strong>` : m.awayName;
      const legs = [m.leg1?.score, m.leg2?.score].filter(Boolean).join(' · ');
      const aggregate = m.aggregate ? ` | Global ${m.aggregate}` : '';
      return `<li>${home} vs ${away} ${legs ? `(${legs})` : ''}${aggregate}</li>`;
    }).join('') || '<li>Pendiente</li>'}</ul></div>`).join('')}
  </article>`;
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
    <div class="grid two">
      ${tournamentBlock(state.tournaments.cup)}
      ${tournamentBlock(state.tournaments.champions)}
      ${tournamentBlock(state.tournaments.cupWinners)}
      ${tournamentBlock(state.tournaments.continental2)}
    </div>
    <article class="card"><h3>Ligas europeas ficticias</h3>
    <div class="table-wrap"><table><thead><tr><th>Liga</th><th>Campeón</th><th>Campeón de copa</th></tr></thead><tbody>
    ${(state.europeExternal.leagues || []).map((l) => `<tr><td>${l.name}</td><td>${l.champion}</td><td>${l.cupChampion}</td></tr>`).join('') || '<tr><td colspan="3">Se generarán al cerrar la temporada 1.</td></tr>'}
    </tbody></table></div></article>
  </section>`;
}

function historyView(state) {
  const rows = [...state.history.globalBySeason].reverse();
  return `<section class="card"><h2>Histórico global</h2>
    <div class="table-wrap"><table><thead><tr><th>Temp.</th><th>Liga</th><th>Copa</th><th>Europa clasificados</th><th>Pichichi</th><th>Zamora</th><th>Ascensos</th><th>Descensos</th></tr></thead><tbody>
    ${rows.map((item) => `<tr><td>${item.season}</td><td>${item.leagueChampion}</td><td>${item.cupChampion}</td><td>${[...item.europeQualified.champions, ...item.europeQualified.cupWinners, ...item.europeQualified.continental2].join(', ')}</td><td>${item.pichichi}</td><td>${item.zamora}</td><td>${item.promoted.join(', ')}</td><td>${item.relegated.join(', ')}</td></tr>`).join('') || '<tr><td colspan="8">Aún no hay temporadas finalizadas.</td></tr>'}
    </tbody></table></div>
  </section>`;
}

function endSeasonView(state) {
  const summary = state.lastSeasonSummary;
  if (!summary) return '<section class="card"><h2>Fin de temporada</h2><p class="small">Completa una temporada para ver el resumen.</p></section>';
  return `<section class="card"><h2>Resumen temporada ${summary.season}</h2>
    <p><strong>Campeón de Liga:</strong> ${summary.leagueChampion}</p>
    <p><strong>Campeón de Copa:</strong> ${summary.cupChampion}</p>
    <p><strong>Clasificados a Europa:</strong> ${[...summary.europeQualified.champions, ...summary.europeQualified.cupWinners, ...summary.europeQualified.continental2].join(', ')}</p>
    <p><strong>Ascensos:</strong> ${summary.promoted.join(', ')}</p>
    <p><strong>Descensos:</strong> ${summary.relegated.join(', ')}</p>
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
    [views.market]: marketView(app.state, app.marketFilters),
    [views.cupEurope]: cupEuropeView(app.state),
    [views.history]: historyView(app.state),
    [views.endSeason]: endSeasonView(app.state),
  };

  root.innerHTML = viewMap[app.view] || viewMap.dashboard;
}
