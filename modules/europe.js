const COLOR_FAMILIES = {
  es: ['Roja', 'Azul', 'Verde', 'Dorada'],
  en: ['Red', 'Blue', 'Green', 'Golden'],
  fr: ['Rouge', 'Bleue', 'Verte', 'Dorée'],
  it: ['Rossa', 'Blu', 'Verde', 'Dorata'],
  de: ['Rot', 'Blau', 'Grün', 'Gold'],
  pt: ['Vermelha', 'Azul', 'Verde', 'Dourada'],
};

const LEAGUES = [
  { key: 'iberia', country: 'España', language: 'es', baseName: 'Liga' },
  { key: 'albion', country: 'Inglaterra', language: 'en', baseName: 'League' },
  { key: 'gaulle', country: 'Francia', language: 'fr', baseName: 'Ligue' },
  { key: 'italia', country: 'Italia', language: 'it', baseName: 'Lega' },
  { key: 'teutonia', country: 'Alemania', language: 'de', baseName: 'Liga' },
  { key: 'lusitania', country: 'Portugal', language: 'pt', baseName: 'Liga' },
];

const TOKENS = {
  iberia: ['Atlético Brasa', 'Real Mar', 'Unión Sierra', 'Deportivo Sol', 'CD Olivo', 'Racing Costa', 'Sporting Norte', 'CF Valle'],
  albion: ['Kingsbridge FC', 'Northport United', 'Wessex Town', 'Redshire', 'Bristol Crown', 'County Rangers', 'Eastford', 'Ironbridge'],
  gaulle: ['Athletique Ouest', 'Racing Loire', 'US Maritime', 'FC Lumière', 'Stade Tricolore', 'AC Mont', 'Olympique Ciel', 'AS Vendée'],
  italia: ['AC Volta', 'Unione Tirreno', 'Sportiva Dorica', 'Blu Torino', 'Verde Parma', 'Rossa Napoli', 'Atletico Siena', 'FC Ravenna'],
  teutonia: ['Dynamo Mitte', 'Union Eisen', 'Blauwerk', 'SpVg Kron', 'TSV Adler', 'Lok Meridian', 'SC Wald', 'Roter Stern'],
  lusitania: ['Sporting Atlântico', 'FC Ribeira', 'Beira Marítima', 'Clube Douro', 'União Minho', 'SC Alvor', 'Lis Sol', 'Porto Norte'],
};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeTeamId(leagueKey, idx) {
  return `${leagueKey}-t${idx + 1}`;
}

function leagueColorName(leagueMeta, tier = 0) {
  const colors = COLOR_FAMILIES[leagueMeta.language] || COLOR_FAMILIES.es;
  return `${leagueMeta.baseName} ${colors[tier] || colors[0]}`;
}

function buildLeagueTeams(leagueMeta) {
  const names = TOKENS[leagueMeta.key] || TOKENS.iberia;
  return names.slice(0, 8).map((name, idx) => ({
    id: makeTeamId(leagueMeta.key, idx),
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

function simulateLeague(leagueMeta) {
  const teams = buildLeagueTeams(leagueMeta);
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
    key: leagueMeta.key,
    country: leagueMeta.country,
    language: leagueMeta.language,
    name: leagueColorName(leagueMeta, 0),
    divisions: [1, 2, 3, 4].map((tier) => leagueColorName(leagueMeta, tier - 1)),
    cupName: `${leagueMeta.baseName} ${COLOR_FAMILIES[leagueMeta.language][1]} Cup`,
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

  const competitions = {
    champions: 'Copa Estelar Dorada',
    cupWinners: 'Copa de Ganadores Azules',
    continental2: 'Copa Continental Verde',
  };

  return { season, leagues, qualifiers, competitions };
}
