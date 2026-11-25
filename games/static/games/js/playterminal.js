function enablePlayButton() {
  $('#open-terminal-btn').prop('disabled', false);
}

function disablePlayButton() {
  $('#open-terminal-btn').prop('disabled', true);
}

function showStatus(text, kind) {
  $('#status-message')
    .removeClass('alert-info alert-danger')
    .addClass('alert-' + kind)
    .text(text)
    .show();
}

function hideStatus() {
  $('#status-message').hide();
  $('body').css('cursor', 'default');
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
  $('body').css('cursor', 'progress');
  showStatus('Loading the game…', 'info');
  new TerminalWindow({
    base: gameConfig.v86Base,
    command: gameConfig.command,
    refreshCode: gameConfig.refreshCode,
    onProgress: showProgress,
    onOpen: hideStatus,
    onError: function () {
      showStatus('Something went wrong. Try again in a few minutes.', 'danger');
      $('body').css('cursor', 'default');
    },
    onClose: enablePlayButton,
  });
}

$(document).ready(function () {
  $('#open-terminal-btn').click(openTerminal);
});
