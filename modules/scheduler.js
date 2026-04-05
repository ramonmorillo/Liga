export function generateDoubleRoundRobin(teamIds) {
  const list = [...teamIds];
  if (list.length % 2 !== 0) list.push('BYE');
  const half = list.length / 2;
  const firstLeg = [];

  for (let round = 0; round < list.length - 1; round += 1) {
    const matches = [];
    for (let i = 0; i < half; i += 1) {
      const home = list[i];
      const away = list[list.length - 1 - i];
      if (home !== 'BYE' && away !== 'BYE') {
        matches.push(round % 2 === 0 ? { home, away } : { home: away, away: home });
      }
    }
    firstLeg.push({ matchday: round + 1, matches });
    const fixed = list[0];
    const rest = list.slice(1);
    rest.unshift(rest.pop());
    list.splice(0, list.length, fixed, ...rest);
  }

  const secondLeg = firstLeg.map((round, index) => ({
    matchday: firstLeg.length + index + 1,
    matches: round.matches.map((match) => ({ home: match.away, away: match.home })),
  }));

  return [...firstLeg, ...secondLeg];
}

export function generateKnockoutRounds(teamIds, seeded = false) {
  const ids = [...teamIds];
  if (seeded) ids.sort(() => Math.random() - 0.5);
  else shuffle(ids);

  const rounds = [];
  let pool = ids;
  let roundName = 'Octavos';
  if (pool.length <= 8) roundName = 'Cuartos';

  while (pool.length > 1) {
    const matches = [];
    for (let i = 0; i < pool.length; i += 2) {
      matches.push({ home: pool[i], away: pool[i + 1] });
    }
    rounds.push({ name: roundName, matches, results: [] });

    if (pool.length === 16) roundName = 'Cuartos';
    else if (pool.length === 8) roundName = 'Semifinal';
    else if (pool.length === 4) roundName = 'Final';

    pool = new Array(pool.length / 2).fill('TBD');
  }

  return rounds;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}
