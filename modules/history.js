import { allTeams } from './state.js';

export function registerTeamTitle(state, teamId, titleKey, season = state.season) {
  const alreadyLogged = (state.history.clubTitleLog || []).some((entry) => entry.teamId === teamId && entry.titleKey === titleKey && entry.season === season);
  if (alreadyLogged) return;
  const key = `${teamId}:${titleKey}`;
  state.history.clubTitles[key] = (state.history.clubTitles[key] || 0) + 1;
  state.history.clubTitleLog.push({ season, teamId, titleKey });
}

export function registerClubSeasonSnapshot(state, team, row, season, year) {
  if (!team || !row) return;
  state.history.clubSeasonStats[team.id] = state.history.clubSeasonStats[team.id] || [];
  state.history.clubSeasonStats[team.id].push({
    season,
    year,
    division: team.division,
    position: row.position,
    points: row.points,
    gf: row.gf,
    ga: row.ga,
  });
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
