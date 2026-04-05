import { render, renderNav, views } from './modules/ui.js';
import { clearGame, ensureGame, exportGame, importGame, saveGame } from './modules/storage.js';
import { autoPickLineup } from './modules/lineups.js';
import { allTeams, createNewGame, getTeamById } from './modules/state.js';
import { simulateMatchday } from './modules/seasonEngine.js';
import { transferPlayer } from './modules/transfers.js';

const app = {
  view: views.dashboard,
  state: ensureGame(),
  marketFilters: {},
};

const root = document.getElementById('view-root');
const nav = document.getElementById('main-nav');
const seasonLabel = document.getElementById('season-label');
const matchdayLabel = document.getElementById('matchday-label');
const statusLabel = document.getElementById('status-label');

function repaint() {
  seasonLabel.textContent = `Temporada ${app.state.season} · Año ${app.state.year}`;
  matchdayLabel.textContent = `Jornada ${app.state.currentMatchday}/${app.state.maxMatchday}`;
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
  else app.view = views.matchday;
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
      app.state.selectedMatchKey = button.dataset.match;
      app.view = views.matchDetail;
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
  app.view = views.dashboard;
  repaint();
});

document.getElementById('btn-export').addEventListener('click', () => exportGame(app.state));
document.getElementById('import-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    app.state = await importGame(file);
    alert('Partida importada correctamente');
    repaint();
  } catch (error) {
    alert(error.message);
  }
  event.target.value = '';
});

repaint();
