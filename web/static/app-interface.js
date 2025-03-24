// Load App
let upsetter = null;

$(document).ready(function () {
    async function main() {
        upsetter = new Upsetter({
            readyFunction: appIsReady,
            messageFunction: message,
            sourcesLoadedFunction: sourcesLoaded
        });
    }
    main();
});


// App Interface

function message(title, message, okay = "Okay") {
    $("#dialog").html(message)
    $("#dialog").dialog({
        dialogClass: "no-close",
        title: title,
        buttons: [
            {
                text: okay,
                click: function () {
                    $(this).dialog("close");
                }
            }
        ]
    });
}

function appIsReady() {
    console.log("App is ready");

    // Prepare drop-over area
    $("#drop-area").on("dragover", function (event) {
        event.preventDefault();
        event.stopPropagation();
        $(this).addClass("drag");
    });
    $("#drop-area").on("dragleave", function (event) {
        event.preventDefault();
        event.stopPropagation();
        $(this).removeClass("drag");
    });
    $("#drop-area").on("drop", function (event) {
        event.preventDefault();
        event.stopPropagation();
        $(this).removeClass("drag");

        upsetter.uploadFiles(event.originalEvent.dataTransfer.files);
    });

    // logo delay in case it loads too fast
    setTimeout(function () {
        $('#welcome').hide();
        $('#drop-area').show();
    }, 500);
}

function sourcesLoaded(data) {
    if (data) {
        html = "<ul>";
        for (let i = 0; i < data.length; i++) {
            html += `<li>${data[i]["name"]} (${data[i]["size"]}kB) <a href="javascript:upsetter.deleteSource('${data[i]["name"]}')">delete</a></li>`;
        }
        html += "</ul>";
        $('#font-sources').html(html);
        $('#font-sources').show();
    }
    else {
        $('#font-sources').hide();
    }


}
