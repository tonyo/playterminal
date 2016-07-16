function enablePlayButton() {
    $("#open-terminal-btn").prop('disabled', false);
}

function disablePlayButton() {
    $("#open-terminal-btn").prop('disabled', true);
}

function displayError() {
    var $statusMessage = $('#status-message');
    $statusMessage.text('Something went wrong. Try again in a few minutes.')
                  .show(200);
    enablePlayButton();
    $("body").css("cursor", "default");
}

function requestTerminal(timeout) {
    /* Run the AJAX request and sleep for 'timeout' if the terminal is not ready */

    $("body").css("cursor", "progress");
    $.ajax({
        url: gamesApiUrl,
        dataType: "json",
        method: "POST",
        data: JSON.stringify({"id": gameId}),
        contentType: "application/json",
        beforeSend: function(request) {
            request.setRequestHeader("X-CSRFToken", csrfToken);
        }
    }).done(function(result) {
        if (result["status"] == "creating") {
            // Repeat request after some timeout
            timeout = timeout || 500;
            console.log('Terminal: creating...');
            console.log('Sleeping for', timeout);
            var newTimeout = Math.round((timeout * 1.2) / 10) * 10;
            setTimeout(function(){ requestTerminal(newTimeout); }, timeout);
        } else if (result["status"] == "ok") {
            console.log(result);
            $("body").css("cursor", "default");
            tty.open(result["kaylee_url"], result["terminal_id"]);
        } else {
            displayError();
        }
    }).fail(function(jqXHR, textStatus, errorThrown) {
        displayError();
    });
}

$(document).ready(function() {
    $("#open-terminal-btn").click(function() {
        disablePlayButton();
        var $statusMessage = $('#status-message');
        $statusMessage.hide();
        requestTerminal();
    });

    tty.on('disconnect', function() {
        enablePlayButton();
    });
});
