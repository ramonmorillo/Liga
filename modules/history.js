import { allTeams } from './state.js';

export function registerTeamTitle(state, teamId, titleKey) {
  const key = `${teamId}:${titleKey}`;
  state.history.clubTitles[key] = (state.history.clubTitles[key] || 0) + 1;
}

export function archivePlayers(state) {
  allTeams(state).forEach((team) => {
    team.squad.forEach((player) => {
      state.history.playerArchive[player.id] = {
        name: `${player.name} ${player.surname}`,
        clubs: [...new Set(player.history.clubs)],
        seasons: player.history.seasons,
        goals: player.history.goals,
        titles: player.history.titles,
      };
    });
  });
}

export function pushSeasonHistory(state, summary) {
  state.history.seasons.push(summary);
  state.history.topScorers.push({
    season: summary.season,
    year: summary.year,
    pichichi: summary.awards.pichichi,
  });
  state.lastSeasonSummary = summary;
}
