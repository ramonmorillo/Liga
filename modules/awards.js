import { allTeams } from './state.js';

export function getSeasonAwards(state) {
  const players = allTeams(state).flatMap((team) => team.squad.map((player) => ({ player, team })));
  const topScorer = players.sort((a, b) => b.player.seasonGoals - a.player.seasonGoals)[0];

  const goalkeepers = players
    .filter(({ player }) => player.position === 'POR')
    .map(({ player, team }) => {
      const conceded = team.seasonStats.ga;
      return { player, team, conceded };
    })
    .sort((a, b) => a.conceded - b.conceded);

  const bestPlayer = players
    .map(({ player, team }) => ({
      player,
      team,
      score: player.overall * 0.55 + player.form * 0.18 + player.morale * 0.12 + player.seasonGoals * 2.8,
    }))
    .sort((a, b) => b.score - a.score)[0];

  return {
    pichichi: topScorer ? `${topScorer.player.name} ${topScorer.player.surname} (${topScorer.team.name}, ${topScorer.player.seasonGoals})` : '—',
    zamora: goalkeepers[0] ? `${goalkeepers[0].player.name} ${goalkeepers[0].player.surname} (${goalkeepers[0].team.name})` : '—',
    bestPlayer: bestPlayer ? `${bestPlayer.player.name} ${bestPlayer.player.surname} (${bestPlayer.team.name})` : '—',
  };
}
