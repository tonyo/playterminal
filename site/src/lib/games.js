// Plain functions over Game entries ({ id, data }), so node:test can test them without Astro.

// A slug is the Game's file name and its page URL: /game/<slug>/.
export const SLUG_PATTERN = /^[a-z0-9-]+$/;

export function checkSlugs(games) {
  for (const game of games) {
    if (!SLUG_PATTERN.test(game.id)) {
      throw new Error(`Game file name ${JSON.stringify(game.id)} is not a slug (a-z, 0-9, -)`);
    }
  }
  return games;
}

// By name, ignoring case (code point order, not locale order, so the build is the same everywhere).
export function byName(games) {
  const key = (game) => game.data.name.toLowerCase();
  return [...games].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

// The Games listed on the games page, by name.
export function displayedGames(games) {
  return byName(games.filter((game) => game.data.displayed));
}

export function gameUrl(game) {
  return `/game/${game.id}/`;
}

// The config the game page passes to scripts/game.js.
export function gameConfig(game, v86Base) {
  return {
    name: game.data.name,
    command: game.data.command,
    refreshCode: game.data.refresh_code ?? null,
    v86Base,
  };
}
