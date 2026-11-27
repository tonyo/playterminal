// The built site in dist/ (run `npm run build` first), with the real Games.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, '../dist');
const library = path.join(here, '../../games');

if (!existsSync(path.join(dist, 'index.html'))) {
  throw new Error('dist/ is missing: run `npm run build` first');
}

const page = (url) => readFileSync(path.join(dist, url, 'index.html'), 'utf8');
const htmlFiles = (dir = dist) =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .map((e) => path.join(e.parentPath, e.name));

test('the games page lists the Games by name, linking their pages', () => {
  const html = page('games');
  const names = [...html.matchAll(/<a href="\/game\/[a-z0-9-]+\/">([^<]+)<\/a>/g)].map((m) => m[1]);
  assert.deepEqual(names, ['Adventure', 'Greed', 'Hangman', 'NetHack', 'Robots', 'Tetris']);
  assert.ok(html.includes('href="/game/robots/"'));
});

test('every Game in the library has a page, listed or not', () => {
  for (const file of readdirSync(library).filter((f) => f.endsWith('.toml'))) {
    assert.ok(existsSync(path.join(dist, 'game', file.replace('.toml', ''), 'index.html')), file);
  }
});

test('the game page has the name, the Play button and the JS config', () => {
  const html = page('game/robots');
  assert.ok(html.includes('<h1>Robots</h1>'));
  assert.ok(html.includes('id="open-terminal-btn"'));
  const json = html.match(/<script id="game-config" type="application\/json">(.*?)<\/script>/)[1];
  assert.deepEqual(JSON.parse(json), {
    name: 'Robots',
    command: 'robots',
    refreshCode: null,
    v86Base: '/v86/',
  });
});

test('the licenses page links the VM third-party list and the license files', () => {
  const html = page('licenses');
  assert.ok(html.includes('href="/v86/THIRD-PARTY.txt"'));
  for (const name of ['xterm', 'xterm-addon-webgl', 'droid-sans-mono']) {
    assert.ok(html.includes(`href="/licenses/${name}.txt"`), name);
    assert.ok(existsSync(path.join(dist, 'licenses', `${name}.txt`)), name);
  }
});

test('the main and about pages render', () => {
  assert.ok(page('').includes('surfing alpaca'));
  assert.ok(page('about').includes('Created by'));
  assert.ok(existsSync(path.join(dist, '404.html')));
});

test('pages load nothing from other sites, and every local link resolves', () => {
  for (const file of htmlFiles()) {
    const html = readFileSync(file, 'utf8');
    for (const [, attr, url] of html.matchAll(/\b(src|href)="([^"]*)"/g)) {
      if (attr === 'src' || html.includes(`<link rel="stylesheet" href="${url}"`)) {
        assert.ok(url.startsWith('/') && !url.startsWith('//'), `${file}: ${url}`);
      }
      if (!url.startsWith('/') || url.startsWith('//') || url.startsWith('/v86/')) continue;
      const target = path.join(dist, url);
      const ok = url.endsWith('/')
        ? existsSync(path.join(target, 'index.html'))
        : existsSync(target);
      assert.ok(ok, `${path.relative(dist, file)} links ${url}, which is not in dist/`);
    }
  }
});
