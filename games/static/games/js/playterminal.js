$(document).ready(function() {
    $("#open-terminal-btn").click(function() {
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
        });
    });
});
