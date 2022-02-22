const _ = require('lodash');
const lib = require('lib')({token: process.env.AUTOCODE_TOKEN});
const {stringify: csvStringify} = require('csv-stringify/sync');

const gamertags = ['PhantomTheoden', 'TheDaringDuke', 'dogwaterwifi924'];

async function fetchFeedForPlayer(gamertag) {
  const maxPageSize = 25;
  const pagesToFetch = 20;

  return (await Promise.all(_.range(pagesToFetch).map(pageIndex => 
    lib.halo.infinite['@0.3.8'].stats.matches.list({
      gamertag, // required
      limit: {
        count: maxPageSize,
        offset: maxPageSize * pageIndex
      },
      mode: 'matchmade'
    })))).flatMap(({data}) => data);
}

async function main() {
  // const allGames = Promise.all(gamertags.map(async gamertag => [gamertag, await fetchFeedForPlayer(gamertag)]));
  const allGames = await Promise.all(gamertags.map(fetchFeedForPlayer));
  // const allGames = await Promise.all(gamertags.map(fetchFeedForPlayer));
  // console.log(allGames);

  const commonGameIds = _.intersectionBy(...allGames, 'id').map(({id}) => id);

  if (!commonGameIds.length) {
    throw new Error('No common games found');
  }

  const allGamesFullDetail = await Promise.all(commonGameIds.map(id => lib.halo.infinite['@0.3.8'].stats.matches.retrieve({id})));
  const forCSV = _(allGamesFullDetail)
    .map('data')
    .filter(game => game.details.playlist.name === 'Ranked Arena')
    .map(game => {
      const playerEntryForPlayer = gamertag => _.find(game.players, {gamertag});

      const perPlayerStats = _(gamertags)
        .map(gamertag => {
          const playerEntry = playerEntryForPlayer(gamertag);
          return [gamertag, {
            kda: playerEntry.stats.core.kda,
            rankProgression: playerEntry.progression.csr.post_match.value - playerEntry.progression.csr.pre_match.value
          }];
        })
        .fromPairs()
        .value();

      const getAggregateStats = statName => _(perPlayerStats).mapValues(statName).values().mean();

      const aggregatePlayerStats = _(perPlayerStats[gamertags[0]])
        .mapValues((_value, statName) => getAggregateStats(statName))
        .value();
      const playerAndAggregateStats = {
        ...perPlayerStats,
        Average: aggregatePlayerStats
      };
      const playerColumns = _.reduce(playerAndAggregateStats, (acc, stats, gamertag) => ({
        ...acc,
        [`${gamertag} KDA`]: stats.kda,
        [`${gamertag} Rank Progression`]: stats.rankProgression
      }), {});

      return {
        Id: game.id,
        'Halo Tracker Link': `https://halotracker.com/halo-infinite/match/${game.id}`,
        'Game Start': game.played_at,
        Map: game.details.map.name,
        Gametype: game.details.category.name,
        Outcome: playerEntryForPlayer(gamertags[0]).outcome,
        ...playerColumns
      };
    })
    .value();

  const csv = csvStringify(forCSV, {
    header: true
  });

  console.log(csv);
}

main();