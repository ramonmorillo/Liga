import { render, renderNav, views } from './modules/ui.js';
import { clearGame, ensureGame, exportGame, importGame, saveGame } from './modules/storage.js';
import { autoPickLineup, swapLineupPlayer } from './modules/lineups.js';
import { allTeams, createNewGame, getTeamById } from './modules/state.js';
import { acceptSponsorOffer, dismissCoach, hireCoach, initializeSeasonStructures, rejectSponsorOffer, simulateMatchday } from './modules/seasonEngine.js';
import { createTransferOffer, releasePlayer, resolveTransferOffer } from './modules/transfers.js';

const app = {
  view: views.dashboard,
  state: ensureGame(),
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

  root.querySelectorAll('[data-action="team-tab"]').forEach((button) => {
    button.addEventListener('click', () => {
      app.state.ui = app.state.ui || {};
      app.state.ui.teamDetailTab = button.dataset.tab;
      if (button.dataset.tab !== 'lineup') app.state.ui.selectedLineupSlot = null;
      repaint();
    });
  });
  root.querySelectorAll('[data-action="select-slot"]').forEach((button) => {
    button.addEventListener('click', () => {
      app.state.ui = app.state.ui || {};
      app.state.ui.selectedLineupSlot = button.dataset.slot;
      repaint();
    });
  });
  root.querySelectorAll('[data-action="swap-lineup"]').forEach((button) => {
    button.addEventListener('click', () => {
      const team = getTeamById(app.state, button.dataset.team);
      if (!team) return;
      const result = swapLineupPlayer(team, button.dataset.slot, button.dataset.player);
      if (!result.ok) alert(result.message);
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

  root.querySelectorAll('[data-action="intl-tab"]').forEach((button) => {
    button.addEventListener('click', () => {
      app.state.ui = app.state.ui || {};
      app.state.ui.internationalTab = button.dataset.tab;
      repaint();
    });
  });

  root.querySelectorAll('[data-action="honours-tab"]').forEach((button) => {
    button.addEventListener('click', () => {
      app.state.ui = app.state.ui || {};
      app.state.ui.honoursTab = button.dataset.tab;
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

  root.querySelectorAll('[data-action="make-offer"]').forEach((button) => {
    button.addEventListener('click', () => {
      const result = createTransferOffer(
        app.state,
        button.dataset.seller,
        app.state.userTeamId,
        button.dataset.player,
        Number(button.dataset.amount),
      );
      alert(result.message);
      repaint();
    });
  });

  root.querySelectorAll('[data-action="accept-offer"], [data-action="reject-offer"]').forEach((button) => {
    button.addEventListener('click', () => {
      const decision = button.dataset.action === 'accept-offer' ? 'accept' : 'reject';
      const result = resolveTransferOffer(app.state, button.dataset.offer, decision);
      alert(result.message);
      repaint();
    });
  });

  root.querySelectorAll('[data-action="accept-sponsor"], [data-action="reject-sponsor"]').forEach((button) => {
    button.addEventListener('click', () => {
      const isAccept = button.dataset.action === 'accept-sponsor';
      const result = isAccept
        ? acceptSponsorOffer(app.state, button.dataset.team, button.dataset.offer)
        : rejectSponsorOffer(app.state, button.dataset.team, button.dataset.offer);
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
    if (app.view === 'market') app.view = views.teams;
    alert('Partida importada correctamente');
    repaint();
  } catch (error) {
    alert(error.message);
  }
  event.target.value = '';
});

repaint();
