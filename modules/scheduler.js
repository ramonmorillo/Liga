// Método circle para liga de ida y vuelta.
export function generateDoubleRoundRobin(teams) {
  const ids = teams.map((t) => t.id);
  const list = [...ids];
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

  const secondLeg = firstLeg.map((r, i) => ({
    matchday: i + 1 + firstLeg.length,
    matches: r.matches.map((m) => ({ home: m.away, away: m.home })),
  }));

  return [...firstLeg, ...secondLeg];
}
