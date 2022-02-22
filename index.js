const _ = require('lodash');
const lib = require('lib')({token: process.env.AUTOCODE_TOKEN});

const gamertags = ['PhantomTheoden', 'TheDaringDuke', 'dogwaterwifi924'];
// const gamertags = ['PhantomTheoden'];
const gamesToFetch = 25;

// We need to page back to get more games.
async function fetchFeedForPlayer(gamertag) {
  const result = await lib.halo.infinite['@0.3.8'].stats.matches.list({
    gamertag, // required
    limit: {
      count: gamesToFetch,
      offset: 0
    },
    mode: 'matchmade'
  });
  return result;
}

async function main() {
  // const allGames = Promise.all(gamertags.map(async gamertag => [gamertag, await fetchFeedForPlayer(gamertag)]));
  const allGames = (await Promise.all(gamertags.map(fetchFeedForPlayer))).map(res => res.data);
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
        .flatMap(gamertag => {
          const playerEntry = playerEntryForPlayer(gamertag);
          // return [gamertag, {
          //   kda: 
          // }]

          return [
            [`${gamertag} KDA`, playerEntry.stats.core.kda],
            [`${gamertag} Rank Progression`, playerEntry.progression.csr.post_match.value - playerEntry.progression.csr.pre_match.value]
          ];
        })
        .fromPairs()
        .value();

      return {
        Id: game.id,
        Map: game.details.map.name,
        Gametype: game.details.category.name,
        Outcome: playerEntryForPlayer(gamertags[0]).outcome,
        ...perPlayerStats
      };
    })
    .value();

  console.log(forCSV);
}

main();