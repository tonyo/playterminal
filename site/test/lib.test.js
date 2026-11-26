// The plain functions behind the pages, with made-up Games.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { byName, checkSlugs, displayedGames, gameConfig, gameUrl } from '../src/lib/games.js';
import { jsonScript } from '../src/lib/json-script.js';
import { renderMarkdown } from '../src/lib/markdown.js';

const game = (id, data) => ({ id, data: { displayed: false, ...data } });
const robots = game('robots', { name: 'Robots', command: 'robots', displayed: true });
const tetris = game('tetris', { name: 'Tetris', command: 'tetris-bsd' });
const adventure = game('adventure', { name: 'adventure', command: 'adventure', displayed: true });

test('the games page lists only displayed Games, by name ignoring case', () => {
  assert.deepEqual(
    displayedGames([robots, tetris, adventure]).map((g) => g.id),
    ['adventure', 'robots'],
  );
});

test('byName keeps every Game', () => {
  assert.deepEqual(
    byName([tetris, robots]).map((g) => g.id),
    ['robots', 'tetris'],
  );
});

test('a Game file name must be a slug', () => {
  assert.doesNotThrow(() => checkSlugs([robots, game('micro-tetris2', { name: 'x' })]));
  for (const id of ['Robots', 'my game', 'a_b', '']) {
    assert.throws(() => checkSlugs([game(id, { name: 'x' })]), /not a slug/);
  }
});

test('the game page URL is /game/<slug>/', () => {
  assert.equal(gameUrl(robots), '/game/robots/');
});

test('the JS config has the name, command, refresh code and VM base', () => {
  assert.deepEqual(gameConfig(game('x', { name: 'X', command: 'x', refresh_code: 12 }), '/vm/'), {
    name: 'X',
    command: 'x',
    refreshCode: 12,
    v86Base: '/vm/',
  });
  assert.equal(gameConfig(robots, '/v86/').refreshCode, null);
});

test('jsonScript escapes what could close the script element', () => {
  const json = jsonScript({ command: '</script><script>alert(1)&' });
  assert.ok(!json.includes('</script>'));
  assert.equal(json, '{"command":"\\u003C/script\\u003E\\u003Cscript\\u003Ealert(1)\\u0026"}');
  assert.deepEqual(JSON.parse(json), { command: '</script><script>alert(1)&' });
});

test('descriptions render Markdown', () => {
  const html = renderMarkdown('Press `q` to *quit*.\n\n- one\n- two');
  assert.ok(html.includes('<p>Press <code>q</code> to <em>quit</em>.</p>'));
  assert.ok(html.includes('<li>one</li>'));
});

for (const [markdown, unsafe] of [
  ['<script>alert(1)</script>', '<script>alert'],
  ['<img src=x onerror="alert(1)">', '<img src=x'],
  ['[click](javascript:alert(1))', 'href="javascript:'],
  ['![x](data:text/html;base64,PHNjcmlwdD4=)', 'src="data:text/html'],
]) {
  test(`description Markdown is safe: ${markdown}`, () => {
    assert.ok(!renderMarkdown(markdown).includes(unsafe));
  });
}
