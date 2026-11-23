function enablePlayButton() {
    $("#open-terminal-btn").prop('disabled', false);
}

function disablePlayButton() {
    $("#open-terminal-btn").prop('disabled', true);
}

function sendRefreshSignal() {
    if (!gameRefreshCode) {
        return;
    }
    var key = String.fromCharCode(gameRefreshCode);
    tty.socket.sendMessage('tty', {"stream": Base64.encode(key)});
}

$(document).ready(function() {
    $("#open-terminal-btn").click(function() {
        // The Terminal Window is not wired to a backend yet: the v86
        // serial socket replaces the rootnroll terminal in a later step.
        $('#status-message').hide();
    });

    tty.on('disconnect', function() {
        enablePlayButton();
    });

    tty.on('open window', function() {
        sendRefreshSignal();
    })
});
