function playButton() {
  return document.getElementById('open-terminal-btn');
}

function statusMessage() {
  return document.getElementById('status-message');
}

function setCursor(cursor) {
  document.body.style.cursor = cursor;
}

function enablePlayButton() {
  playButton().disabled = false;
}

function disablePlayButton() {
  playButton().disabled = true;
}

function showStatus(text, kind) {
  var status = statusMessage();
  status.classList.remove('alert-info', 'alert-danger');
  status.classList.add('alert-' + kind);
  status.textContent = text;
  status.hidden = false;
}

function hideStatus() {
  statusMessage().hidden = true;
  setCursor('default');
}

function showProgress(e) {
  if (!e.lengthComputable || !e.total) {
    return;
  }
  var percent = Math.floor((100 * e.loaded) / e.total);
  showStatus('Loading the game… ' + percent + '%', 'info');
}

function openTerminal() {
  disablePlayButton();
  setCursor('progress');
  showStatus('Loading the game…', 'info');
  new TerminalWindow({
    base: gameConfig.v86Base,
    name: gameConfig.name,
    command: gameConfig.command,
    refreshCode: gameConfig.refreshCode,
    onProgress: showProgress,
    onOpen: hideStatus,
    onError: function () {
      showStatus('Something went wrong. Try again in a few minutes.', 'danger');
      setCursor('default');
    },
    onClose: enablePlayButton,
  });
}

// The script is deferred, so the page is parsed by now.
playButton().addEventListener('click', openTerminal);
