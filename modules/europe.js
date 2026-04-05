const LEAGUES = [
  'Liga Nordia',
  'Liga Centralia',
  'Liga Occidentia',
  'Liga Oranje',
  'Liga Albion',
  'Liga Lusitania',
  'Liga Danubia',
  'Liga Flandria',
];

const TOKENS = {
  Nordia: ['FC Aurora', 'IK Frost', 'Storm BK', 'Nordlys', 'Skarn', 'Vikingur', 'Bris IF', 'Polar SK'],
  Centralia: ['Dynamo Mitte', 'Union Eisen', 'Blauwerk', 'SpVg Kron', 'TSV Adler', 'Lok Meridian', 'SC Wald', 'Roter Stern'],
  Occidentia: ['Athletique Ouest', 'Racing Loire', 'US Maritime', 'FC Lumière', 'Stade Tricolore', 'AC Mont', 'Olympique Ciel', 'AS Vendée'],
  Oranje: ['Oranje Stad', 'VV Delta', 'AZ Polder', 'RKV Tulip', 'Noordhaven', 'Sparta Kanaal', 'FC Windmill', 'SV Maas'],
  Albion: ['Kingsbridge FC', 'Northport United', 'Wessex Town', 'Redshire', 'Bristol Crown', 'County Rangers', 'Eastford', 'Ironbridge'],
  Lusitania: ['Sporting Atlântico', 'FC Ribeira', 'Beira Marítima', 'Clube Douro', 'União Minho', 'SC Alvor', 'Lis Sol', 'Porto Norte'],
  Danubia: ['FK Danub', 'Rapid Karpat', 'Steaua Alba', 'Slavia Most', 'Balkanova', 'SC Pannon', 'Universitatea', 'Dinamo Voda'],
  Flandria: ['KSV Brug', 'Royal Meers', 'FC Haven', 'Sint Gilde', 'Racing Brel', 'Union Schelde', 'Atletiek Gentia', 'KV Leuvena'],
};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeTeamId(leagueName, idx) {
  return `${leagueName.toLowerCase().replace(/\s+/g, '-')}-t${idx + 1}`;
}

function buildLeagueTeams(leagueName) {
  const key = leagueName.split(' ').at(1);
  const names = TOKENS[key] || TOKENS.Nordia;
  return names.slice(0, 8).map((name, idx) => ({
    id: makeTeamId(leagueName, idx),
    name,
    strength: rand(60, 83),
    prestige: rand(48, 82),
  }));
}

function compareRows(a, b) {
  return b.points - a.points || b.gd - a.gd || b.gf - a.gf;
}

function playMatch(home, away) {
  const homeGoals = Math.max(0, rand(0, 3) + Math.round((home.strength - away.strength) / 20));
  const awayGoals = Math.max(0, rand(0, 3) + Math.round((away.strength - home.strength) / 24));
  return { homeGoals, awayGoals };
}

function simulateLeague(leagueName) {
  const teams = buildLeagueTeams(leagueName);
  const table = teams.map((team) => ({ teamId: team.id, teamName: team.name, points: 0, gf: 0, ga: 0, gd: 0, wins: 0, draws: 0, losses: 0 }));

  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      const home = teams[i];
      const away = teams[j];
      const first = playMatch(home, away);
      const second = playMatch(away, home);

      [[home, away, first], [away, home, second]].forEach(([h, a, res]) => {
        const hr = table.find((row) => row.teamId === h.id);
        const ar = table.find((row) => row.teamId === a.id);
        hr.gf += res.homeGoals;
        hr.ga += res.awayGoals;
        ar.gf += res.awayGoals;
        ar.ga += res.homeGoals;
        hr.gd = hr.gf - hr.ga;
        ar.gd = ar.gf - ar.ga;
        if (res.homeGoals > res.awayGoals) {
          hr.points += 3;
          hr.wins += 1;
          ar.losses += 1;
        } else if (res.homeGoals < res.awayGoals) {
          ar.points += 3;
          ar.wins += 1;
          hr.losses += 1;
        } else {
          hr.points += 1;
          ar.points += 1;
          hr.draws += 1;
          ar.draws += 1;
        }
      });
    }
  }

  table.sort(compareRows);
  table.forEach((row, idx) => {
    row.position = idx + 1;
  });

  const cupTeams = [...teams].sort(() => Math.random() - 0.5).slice(0, 8);
  const cupChampion = cupTeams.sort((a, b) => b.strength - a.strength + rand(-4, 4))[0];

  return {
    name: leagueName,
    teams,
    table,
    champion: table[0]?.teamName,
    championTeamId: table[0]?.teamId,
    cupChampion: cupChampion?.name,
    cupChampionTeamId: cupChampion?.id,
    europeSlots: {
      champions: [table[0]],
      cupWinners: [table.find((row) => row.teamId === cupChampion?.id) || table[1]],
      continental2: table.slice(1, 4),
    },
  };
}

export function simulateExternalEuropeSeason(season) {
  const leagues = LEAGUES.map(simulateLeague);
  const qualifiers = {
    champions: leagues.map((league) => ({ source: league.name, teamId: league.europeSlots.champions[0].teamId, teamName: league.europeSlots.champions[0].teamName })),
    cupWinners: leagues.map((league) => ({ source: league.name, teamId: league.europeSlots.cupWinners[0].teamId, teamName: league.europeSlots.cupWinners[0].teamName })),
    continental2: leagues.flatMap((league) => league.europeSlots.continental2.map((row) => ({ source: league.name, teamId: row.teamId, teamName: row.teamName }))),
  };

  return { season, leagues, qualifiers };
}
