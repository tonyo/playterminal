function enablePlayButton() {
    $("#open-terminal-btn").prop('disabled', false);
}

function disablePlayButton() {
    $("#open-terminal-btn").prop('disabled', true);
}

$(document).ready(function() {
    $("#open-terminal-btn").click(function() {
        disablePlayButton();
        var $statusMessage = $('#status-message');
        $statusMessage.hide();

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
            tty.open(result["kaylee_url"], result["terminal_id"]);
        }).fail(function(jqXHR, textStatus, errorThrown) {
            $statusMessage.text('Something went wrong. Try again in a few minutes.')
                          .show(200);
            enablePlayButton();
        });
    });

    tty.on('disconnect', function() {
        enablePlayButton();
    });
});
