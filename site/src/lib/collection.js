// Every Game from the content collection, by name, with the slugs checked.
import { getCollection } from 'astro:content';
import { byName, checkSlugs } from './games.js';

export async function allGames() {
  return byName(checkSlugs(await getCollection('games')));
}
