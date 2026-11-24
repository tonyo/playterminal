function enablePlayButton() {
    $("#open-terminal-btn").prop('disabled', false);
}

function disablePlayButton() {
    $("#open-terminal-btn").prop('disabled', true);
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
    $("body").css("cursor", "default");
}

function sendRefreshSignal() {
    if (!gameRefreshCode) {
        return;
    }
    var key = String.fromCharCode(gameRefreshCode);
    tty.socket.sendMessage('tty', {"stream": Base64.encode(key)});
}

function showProgress(e) {
    if (!e.lengthComputable || !e.total) {
        return;
    }
    var percent = Math.floor(100 * e.loaded / e.total);
    showStatus('Loading the game… ' + percent + '%', 'info');
}

function openTerminal() {
    disablePlayButton();
    $("body").css("cursor", "progress");
    showStatus('Loading the game…', 'info');
    tty.open(function() {
        return new V86Socket({
            base: gameConfig.v86Base,
            command: gameConfig.command,
            onProgress: showProgress
        });
    }, gameConfig.command);

    // tty.open() drops earlier 'attach' listeners, so add this one after it.
    tty.once('attach', function(msg) {
        if (msg.status == 200) {
            hideStatus();
        } else {
            showStatus('Something went wrong. Try again in a few minutes.', 'danger');
            $("body").css("cursor", "default");
        }
    });
}

$(document).ready(function() {
    $("#open-terminal-btn").click(openTerminal);

    tty.on('disconnect', function() {
        enablePlayButton();
    });

    tty.on('open window', function() {
        sendRefreshSignal();
    });
});
