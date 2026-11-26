// xterm.js and its WebGL addon from npm, as the globals terminal-window.js uses, and the
// page's config from the #game-config element.
import '@xterm/xterm/css/xterm.css';
import '../styles/terminal-styles.css';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from '@xterm/xterm';

window.Terminal = Terminal;
window.WebglAddon = { WebglAddon };
window.gameConfig = JSON.parse(document.getElementById('game-config').textContent);
