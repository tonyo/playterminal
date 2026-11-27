// The game page: Play opens a TerminalWindow on the Game in #game-config.
import { TerminalWindow } from './terminal-window.js';

const game = JSON.parse(document.getElementById('game-config').textContent);
const play = document.getElementById('open-terminal-btn');
const status = document.getElementById('status-message');

function showStatus(text, kind) {
  status.classList.remove('alert-info', 'alert-danger');
  status.classList.add(`alert-${kind}`);
  status.textContent = text;
  status.hidden = false;
}

play.addEventListener('click', () => {
  play.disabled = true;
  document.body.style.cursor = 'progress';
  showStatus('Loading the game…', 'info');
  new TerminalWindow({
    base: game.v86Base,
    name: game.name,
    command: game.command,
    refreshCode: game.refreshCode,
    onProgress(e) {
      if (e.lengthComputable && e.total) {
        showStatus(`Loading the game… ${Math.floor((100 * e.loaded) / e.total)}%`, 'info');
      }
    },
    onOpen() {
      status.hidden = true;
      document.body.style.cursor = 'default';
    },
    onError() {
      showStatus('Something went wrong. Try again in a few minutes.', 'danger');
      document.body.style.cursor = 'default';
    },
    onClose() {
      play.disabled = false;
    },
  });
});
