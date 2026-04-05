import { createInitialState } from './modules/generator.js';
import { generateDoubleRoundRobin } from './modules/scheduler.js';
import { simulateMatch } from './modules/matchEngine.js';
import { saveGame, loadGame, clearGame, exportGame, importGame } from './modules/storage.js';
import { render, renderNav, showPlayerModal, views } from './modules/ui.js';

const app = {
  view: views.dashboard,
  selectedTeamId: null,
  state: null,
};

const root = document.getElementById('view-root');
const nav = document.getElementById('main-nav');
const seasonLabel = document.getElementById('season-label');
const matchdayLabel = document.getElementById('matchday-label');
const modal = document.getElementById('player-modal');

document.getElementById('player-modal-close').addEventListener('click', () => modal.close());

document.getElementById('btn-new-game').addEventListener('click', () => {
  if (!confirm('¿Seguro que quieres iniciar una nueva partida?')) return;
  clearGame();
  boot(true);
});

document.getElementById('btn-export').addEventListener('click', () => exportGame(app.state));
document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    app.state = await importGame(file);
    saveGame(app.state);
    repaint();
  } catch (err) {
    alert(err.message);
  }
  e.target.value = '';
});

function freshState() {
  const state = createInitialState();
  state.schedule = generateDoubleRoundRobin(state.firstDivision);
  state.standings = state.firstDivision.map((t) => ({
    teamId: t.id,
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    position: 0,
  }));
  sortStandings(state);
  return state;
}

function sortStandings(state) {
  state.standings.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  state.standings.forEach((s, i) => { s.position = i + 1; });
}

function applyResult(state, homeId, awayId, result) {
  const home = state.standings.find((r) => r.teamId === homeId);
  const away = state.standings.find((r) => r.teamId === awayId);

  home.gf += result.homeGoals; home.ga += result.awayGoals;
  away.gf += result.awayGoals; away.ga += result.homeGoals;

  if (result.homeGoals > result.awayGoals) {
    home.wins += 1; home.points += 3; away.losses += 1;
  } else if (result.homeGoals < result.awayGoals) {
    away.wins += 1; away.points += 3; home.losses += 1;
  } else {
    home.draws += 1; away.draws += 1; home.points += 1; away.points += 1;
  }

  home.gd = home.gf - home.ga;
  away.gd = away.gf - away.ga;
}

function simulateCurrentMatchday() {
  if (app.state.currentMatchday > app.state.maxMatchday) return;
  const day = app.state.schedule.find((d) => d.matchday === app.state.currentMatchday);
  if (!day) return;

  const teams = Object.fromEntries(app.state.firstDivision.map((t) => [t.id, t]));
  app.state.results[day.matchday] = app.state.results[day.matchday] || {};

  day.matches.forEach((m) => {
    const key = `${m.home}_${m.away}`;
    if (app.state.results[day.matchday][key]) return;
    const result = simulateMatch(teams[m.home], teams[m.away]);
    app.state.results[day.matchday][key] = result;
    applyResult(app.state, m.home, m.away, result);
  });

  sortStandings(app.state);
  app.state.currentMatchday += 1;
  saveGame(app.state);
  repaint();
}

function repaint() {
  seasonLabel.textContent = `Temporada ${app.state.season}`;
  matchdayLabel.textContent = app.state.currentMatchday > app.state.maxMatchday ? 'Liga finalizada' : `Jornada actual: ${app.state.currentMatchday}`;

  renderNav(nav, app.view, (view) => {
    app.view = view;
    repaint();
  });

  render(root, app, {
    onSimulate: simulateCurrentMatchday,
    onTeamSelect: (teamId) => {
      app.selectedTeamId = teamId;
      app.view = views.teamDetail;
      repaint();
    },
    onPlayerSelect: (teamId, playerId) => {
      const team = [...app.state.firstDivision, ...app.state.secondDivision].find((t) => t.id === teamId);
      const player = team?.squad.find((p) => p.id === playerId);
      if (player) showPlayerModal(modal, player, team.name);
    },
  });
}

function boot(forceNew = false) {
  app.state = !forceNew ? loadGame() : null;
  if (!app.state) {
    app.state = freshState();
    saveGame(app.state);
  }
  repaint();
}

boot();
