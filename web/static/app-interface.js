// Load App
let upsetter = null;
let fontTargets = [];

$(document).ready(function () {
    async function main() {
        upsetter = new Upsetter({
            readyFunction: appIsReady,
            messageFunction: message,
            okaycancelFunction: okaycancel,
            sourcesLoadedFunction: sourcesLoaded,
            targetsLoadedFunction: targetsLoaded,
            targetFontIsCompilingFunction: targetFontIsCompiling,
            fontsCanBeDownloadedFunction: fontsCanBeDownloaded,
            updateTargetFunction: updateTarget

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

function okaycancel(title, message, okay = "Okay", cancel = "Cancel") {
    return new Promise((resolve) => {
        $("#dialog").html(message);
        $("#dialog").dialog({
            dialogClass: "no-close",
            title: title,
            buttons: [
                {
                    text: okay,
                    click: function () {
                        $(this).dialog("close");
                        resolve(true);
                    }
                },
                {
                    text: cancel,
                    click: function () {
                        $(this).dialog("close");
                        resolve(false);
                    }
                }
            ]
        });
    });
}


function appIsReady() {
    console.log("App is ready");

    // Prepare drop-over area
    $(".drop-area").on("dragover", function (event) {
        event.preventDefault();
        event.stopPropagation();
        $(this).addClass("drag");
    });
    $(".drop-area").on("dragleave", function (event) {
        event.preventDefault();
        event.stopPropagation();
        $(this).removeClass("drag");
    });
    $(".drop-area").on("drop", function (event) {
        event.preventDefault();
        event.stopPropagation();
        $(this).removeClass("drag");

        upsetter.uploadFiles(event.originalEvent.dataTransfer.files);
    });

    // logo delay in case it loads too fast
    setTimeout(function () {
        $('#welcome').hide();
        $('#big-drop-area').show();
    }, 500);
}

function sourcesLoaded(data) {

    if (data.length > 0) {
        html = "<ul>";
        for (let i = 0; i < data.length; i++) {
            let fontSource = new FontSource({ data: data[i] });
            html += fontSource.html();
        }
        html += "</ul>";
        $('#font-sources .items').html(html);
        sourcesAreAvailable(true);
    }
    else {
        $('#font-sources .items').html("No sources loaded.");
        sourcesAreAvailable(false);
    }

    $('#big-drop-area').hide();
    $('#app').show();
    $('#app').css('display', 'flex');

}

function targetsLoaded(data) {

    if (data.length > 0) {
        html = "<ul>";
        for (let i = 0; i < data.length; i++) {
            let fontTarget = new FontTarget({ data: data[i] });
            html += fontTarget.html();
        }
        html += "</ul>";
        $('#font-targets .items').html(html);
    }
    else {
        $('#font-targets .items').html("No targets created.");
        fontsCanBeDownloaded(false);
    }
}

function updateTarget(data) {
    let ID = data["ID"];
    target = new FontTarget({ data: data });
    $(`li[targetFontID=${ID}]`).html(target.innerHTML());
}


class FontSource {
    constructor(options) {
        this.options = options;
    }

    html() {
        html = `<li>${this.options.data["fileName"]}<br />`;
        html += `<b>${this.options.data["type"]} ${this.options.data["weightClass"]}</b> (${this.options.data["size"]}kB)`;
        html += ` <a href="javascript:upsetter.deleteSource('${this.options.data["fileName"]}')">delete</a>`;
        html += "</li>";
        return html;
    }
}

class FontTarget {
    constructor(options) {
        this.options = options;
    }
    html() {
        html = `<li targetFontID="${this.options.data["ID"]}">`
        html += this.innerHTML();
        html += "</li>";
        return html;
    }
    innerHTML() {
        html = `${this.options.data["sourceFont"]}<br />`;
        html += `<span class="visiblewhenidle">(${this.options.data["size"]}kB)</span><span class="visiblewhencompiling">compiling</span>`
        html += ` <a href="javascript:upsetter.deleteTarget('${this.options.data["ID"]}')">delete</a>`;
        return html;
    }
}

function addTargetFonts() {
    for (const font of upsetter.fontSourcesInformation()) {
        console.log(font);
    }
}

function targetFontIsCompiling(ID, condition) {
    if (condition) {
        $(`li[targetFontID=${ID}]`).addClass("compiling");
    } else {
        $(`li[targetFontID=${ID}]`).removeClass("compiling");
    }
}

function fontsCanBeDownloaded(condition) {
    if (condition) {
        $("#download-button").button("option", "disabled", false);
    }
    else {
        $("#download-button").button("option", "disabled", true);
    }
}

function sourcesAreAvailable(condition) {
    if (condition) {
        $("#add-weights-button").button("option", "disabled", false);
    }
    else {
        $("#add-weights-button").button("option", "disabled", true);
    }
}