import { render, renderNav, views } from './modules/ui.js';
import { clearGame, ensureGame, exportGame, importGame, saveGame } from './modules/storage.js';
import { autoPickLineup } from './modules/lineups.js';
import { allTeams, createNewGame, getTeamById } from './modules/state.js';
import { dismissCoach, hireCoach, initializeSeasonStructures, simulateMatchday } from './modules/seasonEngine.js';
import { releasePlayer, transferPlayer } from './modules/transfers.js';

const app = {
  view: views.dashboard,
  state: ensureGame(),
  marketFilters: {},
};

initializeSeasonStructures(app.state);

const root = document.getElementById('view-root');
const nav = document.getElementById('main-nav');
const seasonLabel = document.getElementById('season-label');
const matchdayLabel = document.getElementById('matchday-label');
const statusLabel = document.getElementById('status-label');

function repaint() {
  seasonLabel.textContent = `Temporada ${app.state.season} · Año ${app.state.year}`;
  matchdayLabel.textContent = `Fecha ${app.state.currentMatchday}/${app.state.maxMatchday}`;
  statusLabel.textContent = `Mercado: ${app.state.transferWindow}`;

  renderNav(nav, app.view, (view) => {
    app.view = view;
    repaint();
  });

  render(root, app);
  bindViewActions();
  saveGame(app.state);
}

function runSimulation() {
  const output = simulateMatchday(app.state);
  if (output.done) app.view = views.endSeason;
  else app.view = views.calendar;
  alert(output.summary ? `${output.message}. Partido destacado: ${output.summary.bigMatch}` : output.message);
  repaint();
}

function bindViewActions() {
  root.querySelector('[data-action="simulate"]')?.addEventListener('click', runSimulation);
  root.querySelector('[data-action="auto-lineups"]')?.addEventListener('click', () => {
    allTeams(app.state).forEach((team) => {
      team.lineup = autoPickLineup(team, team.tactics.formation);
    });
    repaint();
  });

  root.querySelectorAll('[data-action="team-detail"]').forEach((button) => {
    button.addEventListener('click', () => {
      app.state.selectedTeamId = button.dataset.team;
      app.view = views.teamDetail;
      repaint();
    });
  });

  root.querySelectorAll('[data-action="open-match"]').forEach((button) => {
    button.addEventListener('click', () => {
      app.state.selectedMatchId = button.dataset.match;
      app.view = views.matchDetail;
      repaint();
    });
  });

  root.querySelectorAll('[data-action="calendar-week"]').forEach((button) => {
    button.addEventListener('click', () => {
      app.state.selectedCalendarWeek = Number(button.dataset.week);
      app.view = views.calendar;
      repaint();
    });
  });

  root.querySelector('[data-action="set-user-team"]')?.addEventListener('click', (event) => {
    app.state.userTeamId = event.currentTarget.dataset.team;
    repaint();
  });

  root.querySelector('[data-action="auto-team-lineup"]')?.addEventListener('click', (event) => {
    const team = getTeamById(app.state, event.currentTarget.dataset.team);
    team.lineup = autoPickLineup(team, team.tactics.formation);
    repaint();
  });

  root.querySelector('[data-action="dismiss-coach"]')?.addEventListener('click', (event) => {
    const teamId = event.currentTarget.dataset.team;
    if (!confirm('¿Confirmas el cese del entrenador?')) return;
    const result = dismissCoach(app.state, teamId);
    alert(result.message);
    repaint();
  });

  root.querySelectorAll('[data-action="hire-coach"]').forEach((button) => {
    button.addEventListener('click', () => {
      const teamId = button.dataset.team;
      const coachId = button.dataset.coach;
      const result = hireCoach(app.state, teamId, coachId);
      alert(result.message);
      repaint();
    });
  });

  root.querySelector('[data-action="formation"]')?.addEventListener('change', (event) => {
    const team = getTeamById(app.state, event.currentTarget.dataset.team);
    team.tactics.formation = event.target.value;
    team.lineup = autoPickLineup(team, event.target.value);
    repaint();
  });

  root.querySelector('[data-action="apply-filters"]')?.addEventListener('click', () => {
    const filters = {};
    root.querySelectorAll('[data-filter]').forEach((field) => {
      if (field.type === 'checkbox') {
        if (field.checked) filters[field.dataset.filter] = field.value;
      } else if (field.value) {
        filters[field.dataset.filter] = field.value;
      }
    });
    app.marketFilters = filters;
    repaint();
  });


  root.querySelectorAll('[data-action="team-tab"]').forEach((button) => {
    button.addEventListener('click', () => {
      app.state.ui = app.state.ui || {};
      app.state.ui.teamDetailTab = button.dataset.tab;
      repaint();
    });
  });

  root.querySelectorAll('[data-action="player-detail"]').forEach((button) => {
    button.addEventListener('click', () => {
      app.state.ui = app.state.ui || {};
      app.state.ui.selectedPlayerId = button.dataset.player;
      repaint();
    });
  });

  root.querySelector('[data-action="history-season"]')?.addEventListener('change', (event) => {
    app.state.ui = app.state.ui || {};
    app.state.ui.historySeason = Number(event.target.value);
    repaint();
  });

  root.querySelectorAll('[data-action="history-division"]').forEach((button) => {
    button.addEventListener('click', () => {
      app.state.ui = app.state.ui || {};
      app.state.ui.historyDivision = button.dataset.division;
      repaint();
    });
  });

  root.querySelectorAll('[data-action="release-player"]').forEach((button) => {
    button.addEventListener('click', () => {
      const team = getTeamById(app.state, button.dataset.team);
      const player = team?.squad?.find((item) => item.id === button.dataset.player);
      if (!team || !player) return;
      if (!confirm(`¿Dar carta de libertad a ${player.name} ${player.surname}?`)) return;
      const result = releasePlayer(app.state, team.id, player.id);
      alert(result.message);
      repaint();
    });
  });

  root.querySelectorAll('[data-action="buy"], [data-action="buy-clause"]').forEach((button) => {
    button.addEventListener('click', () => {
      const payClause = button.dataset.action === 'buy-clause';
      const result = transferPlayer(app.state, button.dataset.team, app.state.userTeamId, button.dataset.player, payClause);
      alert(result.message);
      repaint();
    });
  });
}

document.getElementById('btn-new-game').addEventListener('click', () => {
  if (!confirm('¿Seguro que quieres reiniciar la partida?')) return;
  clearGame();
  app.state = createNewGame();
  initializeSeasonStructures(app.state);
  app.view = views.dashboard;
  repaint();
});

document.getElementById('btn-export').addEventListener('click', () => exportGame(app.state));
document.getElementById('import-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    app.state = await importGame(file);
    initializeSeasonStructures(app.state);
    alert('Partida importada correctamente');
    repaint();
  } catch (error) {
    alert(error.message);
  }
  event.target.value = '';
});

repaint();
