const LEAGUES = [
  { key: 'iberia', country: 'España', language: 'es', familyName: 'Liga Corona Íbera', tierName: 'División', cupName: 'Copa Corona Íbera' },
  { key: 'albion', country: 'Inglaterra', language: 'en', familyName: 'Albion Crown League', tierName: 'Division', cupName: 'Albion Crown Cup' },
  { key: 'gaulle', country: 'Francia', language: 'fr', familyName: 'Ligue Couronne Gauloise', tierName: 'Division', cupName: 'Coupe Couronne Gauloise' },
  { key: 'italia', country: 'Italia', language: 'it', familyName: 'Lega Corona Italica', tierName: 'Divisione', cupName: 'Coppa Corona Italica' },
  { key: 'teutonia', country: 'Alemania', language: 'de', familyName: 'Kronenliga Teutonia', tierName: 'Staffel', cupName: 'Teutonia Kronenpokal' },
  { key: 'lusitania', country: 'Portugal', language: 'pt', familyName: 'Liga Coroa Lusitana', tierName: 'Divisão', cupName: 'Taça Coroa Lusitana' },
];

const TOKENS = {
  iberia: ['Atlético Candela', 'Real Bahía', 'Unión Sierra', 'Deportivo Albor', 'CD Encina', 'Racing Costa', 'Sporting Bruma', 'CF Vega'],
  albion: ['Kingsbridge Rovers', 'Northport Athletic', 'Wessex Albion', 'Redminster', 'Bristol Harbours', 'County Forge', 'Eastford Vale', 'Ironbridge Town'],
  gaulle: ['Olympique Cendré', 'Racing Loire', 'Union Maritime', 'FC Lumière', 'Stade Ventoux', 'AC Azur', 'AS Verdier', 'Athlétique Dorée'],
  italia: ['Atletica Tirrena', 'Unione Dorica', 'SC Riviera', 'AC Azzurra', 'Virtus Vermiglia', 'Calcio Verde', 'US Alba', 'FC Dorata'],
  teutonia: ['Dynamo Nordlicht', 'Union Eisenwald', 'SV Blauhafen', 'TSV Grünstadt', 'SC Goldufer', 'Lok Silbertal', 'Roter Sternwerk', 'Adlerkreis'],
  lusitania: ['Sporting Atlântico', 'União Ribeira', 'Clube da Serra', 'FC Douramar', 'SC Vanguarda', 'Atlético Minho', 'Bairro Azulense', 'Estrela Verdejo'],
};

const LEGACY_TEAM_FIXES = {
  KingsbridgeFC: 'Kingsbridge Rovers',
  NorthportUnited: 'Northport Athletic',
  WessexTown: 'Wessex Albion',
  Redshire: 'Redminster',
  BristolCrown: 'Bristol Harbours',
  CountyRangers: 'County Forge',
  Eastford: 'Eastford Vale',
  Ironbridge: 'Ironbridge Town',
  AthletiqueOuest: 'Olympique Cendré',
  USMaritime: 'Union Maritime',
  StadeTricolore: 'Stade Ventoux',
  ACMont: 'AC Azur',
  OlympiqueCiel: 'AS Verdier',
  ASVendée: 'Athlétique Dorée',
  ACVolta: 'Atletica Tirrena',
  UnioneTirreno: 'Unione Dorica',
  SportivaDorica: 'SC Riviera',
  BluTorino: 'AC Azzurra',
  VerdeParma: 'Calcio Verde',
  RossaNapoli: 'Virtus Vermiglia',
  AtleticoSiena: 'US Alba',
  FCRavenna: 'FC Dorata',
  DynamoMitte: 'Dynamo Nordlicht',
  UnionEisen: 'Union Eisenwald',
  Blauwerk: 'SV Blauhafen',
  SpVgKron: 'TSV Grünstadt',
  TSVAdler: 'Adlerkreis',
  LokMeridian: 'Lok Silbertal',
  SCWald: 'SC Goldufer',
  RoterStern: 'Roter Sternwerk',
  FCRibeira: 'União Ribeira',
  BeiraMarítima: 'Clube da Serra',
  ClubeDouro: 'FC Douramar',
  UniãoMinho: 'Atlético Minho',
  SCAlvor: 'SC Vanguarda',
  LisSol: 'Bairro Azulense',
  PortoNorte: 'Estrela Verdejo',
};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeTeamId(leagueKey, idx) {
  return `${leagueKey}-t${idx + 1}`;
}

function leagueTierName(leagueMeta, tier = 1) {
  if (tier <= 1) return `${leagueMeta.familyName}`;
  return `${leagueMeta.familyName} · ${leagueMeta.tierName} ${tier}`;
}

function leagueCupName(leagueMeta) {
  return leagueMeta.cupName;
}

function normalizeTeamName(name) {
  if (!name) return name;
  const compact = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
  return LEGACY_TEAM_FIXES[compact] || name;
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
    name: leagueTierName(leagueMeta, 1),
    divisions: [1, 2, 3, 4].map((tier) => leagueTierName(leagueMeta, tier)),
    cupName: leagueCupName(leagueMeta),
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

export function normalizeExternalLeagueData(europeExternal) {
  if (!europeExternal || typeof europeExternal !== 'object') return europeExternal;
  const applyNormalization = (leagues) => {
    if (!Array.isArray(leagues)) return;
    const byKey = Object.fromEntries(LEAGUES.map((meta) => [meta.key, meta]));
    leagues.forEach((league, index) => {
      const meta = byKey[league.key] || LEAGUES[index];
      if (!meta) return;
      league.country = meta.country;
      league.language = meta.language;
      league.name = leagueTierName(meta, 1);
      league.divisions = [1, 2, 3, 4].map((tier) => leagueTierName(meta, tier));
      league.cupName = leagueCupName(meta);

      (league.teams || []).forEach((team) => {
        team.name = normalizeTeamName(team.name);
      });
      (league.table || []).forEach((row) => {
        row.teamName = normalizeTeamName(row.teamName);
      });
      league.champion = normalizeTeamName(league.champion);
      league.cupChampion = normalizeTeamName(league.cupChampion);
    });
  };

  applyNormalization(europeExternal.leagues);
  (europeExternal.history || []).forEach((entry) => {
    applyNormalization(entry.leagues);
  });

  return europeExternal;
}
