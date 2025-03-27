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
            fontsCanBeGeneratedFunction: fontsCanBeGenerated,
            updateTargetFunction: updateTarget,
            updateUIFunction: updateUI

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

    $("#add-single-weight-button").button("option", "disabled", true);

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
    }, 0);
}

function sourcesLoaded(data) {

    if (data.length > 0) {
        html = "<ol class='selectable'>";
        for (let i = 0; i < data.length; i++) {
            let fontSource = new FontSource({ data: data[i] });
            html += fontSource.html();
        }
        html += "</ol>";
        $('#font-sources .items').html(html);
        sourcesAreAvailable(true);
        $('#font-sources .items ol').selectable({
            selected: function (event, ui) {
                $("#delete-sources-button").button("option", "disabled", false);
                $("#add-single-weight-button").button("option", "disabled", false);
                // loadTargetSettingsUI();
            },
            unselected: function (event, ui) {
                if (selectedSourceIDs().length == 0) {
                    $("#delete-sources-button").button("option", "disabled", true);
                    $("#add-single-weight-button").button("option", "disabled", true);
                }
                else {
                    $("#add-single-weight-button").button("option", "disabled", false);
                }
            }
        });
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
        html = "<ol class='selectable'>";
        for (let i = 0; i < data.length; i++) {
            let fontTarget = new FontTarget(data[i]);
            html += fontTarget.html();
        }
        html += "</ol>";
        $('#font-targets .items').html(html);
        fontsCanBeGenerated(true);
        $('#font-targets .items ol').selectable({
            selected: function (event, ui) {
                $("#delete-targets-button").button("option", "disabled", false);
                loadTargetSettingsUI();
            },
            unselected: function (event, ui) {
                if (selectedTargetIDs().length == 0) {
                    $("#delete-targets-button").button("option", "disabled", true);
                }
                loadTargetSettingsUI();
            }
        });
    }
    else {
        $('#font-targets .items').html("No targets created.");
        $("#delete-targets-button").button("option", "disabled", true);
        fontsCanBeDownloaded(false);
        fontsCanBeGenerated(false);
    }
    updateUI();
}

function selectedTargetIDs() {
    let targets = [];
    $('#font-targets .items ol .ui-selected').each(function () {
        if ($(this).attr("targetfontid") != undefined) {
            targets.push($(this).attr("targetfontid"));
        }
    });
    return targets;
}

function selectedSourceIDs() {
    let sources = [];
    $('#font-sources .items ol .ui-selected').each(function () {
        if ($(this).attr("sourcefontid") != undefined) {
            sources.push($(this).attr("sourcefontid"));
        }
    });
    return sources;
}

function targetIDs() {
    let targets = [];
    $('#font-targets .items ol li').each(function () {
        targets.push($(this).attr("targetfontid"));
    });
    return targets;
}

function sourceIDs() {
    let targets = [];
    $('#font-sources .items ol li').each(function () {
        targets.push($(this).attr("sourcefontid"));
    });
    return targets;
}

function deleteSelectedTargets() {
    upsetter.deleteTargets(selectedTargetIDs());
}

function deleteSelectedSources() {
    upsetter.deleteSources(selectedSourceIDs());
}

function updateTarget(data) {
    let ID = data["ID"];
    target = new FontTarget(data);
    $(`li[targetfontid=${ID}]`).html(target.innerHTML());
    updateUI();
}

function updateUI() {
    $("#generate-button").button("option", "disabled", true);
    $("#download-button").button("option", "disabled", true);

    // Generate and Download Buttons
    if (targetIDs().length > 0) {
        var needsGenerating = false;
        for (const i in targetIDs()) {
            ID = targetIDs()[i];
            data = upsetter.targetData(ID);
            if (data.needsCompilation) {
                needsGenerating = true;
            }
        }

        if (needsGenerating) {
            $("#generate-button").button("option", "disabled", false);
        }
        else {
            $("#download-button").button("option", "disabled", false);
        }
    }

    if (selectedSourceIDs().length > 0) {
        $("#add-single-weight-button").button("option", "disabled", false);
        $("#delete-sources-button").button("option", "disabled", false);
    }
    else {
        $("#add-single-weight-button").button("option", "disabled", true);
        $("#delete-sources-button").button("option", "disabled", true);
    }

    if (sourceIDs().length == 0) {
        $("#add-single-weight-button").button("option", "disabled", true);
        $("#delete-sources-button").button("option", "disabled", true);
    }

    loadTargetSettingsUI();

}

function loadTargetSettingsUI() {
    $("#target-settings-ui").html(targetSettingsHTML());
}


class FontSource {
    constructor(options) {
        this.options = options;
    }

    html() {
        html = `<li sourcefontid="${this.options.data["fileName"]}">${this.options.data["fileName"]}<br />`;
        html += `<b>${this.options.data["type"]} ${this.options.data["weightClass"]}</b> (${this.options.data["size"]}kB)`;
        html += "</li>";
        return html;
    }
}

class FontTarget {
    constructor(options) {
        this.options = options;
    }
    html() {
        html = `<li targetfontid="${this.options.ID}">`
        html += this.innerHTML();
        html += "</li>";
        return html;
    }
    innerHTML() {
        html = `${this.options.sourceFont}${this.options.needsCompilation ? "<b>***</b>" : ""}<br />`;
        html += `<span class="visiblewhenidle">(`
        if (this.options.size_uncompressed) {
            html += `u:${this.options.size_uncompressed}kB`
        }
        if (this.options.size_uncompressed && this.options.size_compressed) {
            html += `+`
        }
        if (this.options.size_compressed) {
            html += `c:${this.options.size_compressed}kB`
        }
        html += `)</span > <span class="visiblewhencompiling">compiling</span>`

        return html;
    }
}

function targetSettingsHTML() {

    if (selectedTargetIDs().length == 0) {
        return "Please select one or more targets to edit them.";
    }

    var list_of_settings = new Set();
    for (const i in selectedTargetIDs()) {
        ID = selectedTargetIDs()[i];
        data = upsetter.targetData(ID);
        list_of_settings.add(data.settings.compression);
    }

    list_of_settings = Array.from(list_of_settings);

    html = ``;
    html += `
    <div class="widget">
    <fieldset>
    <legend>Compression: </legend>
    <label for="uncompressed">Uncompressed</label>
    <input type="radio" name="compression" id="uncompressed" value="uncompressed" ${list_of_settings.length == 1 && list_of_settings[0] == "uncompressed" ? "checked" : ""}>
    <label for="compressed">Compressed</label>
    <input type="radio" name="compression" id="compressed" value="compressed" ${list_of_settings.length == 1 && list_of_settings[0] == "compressed" ? "checked" : ""}>
    <label for="compressed_both">Both</label>
    <input type="radio" name="compression" id="compressed_both" value="both" ${list_of_settings.length == 1 && list_of_settings[0] == "both" ? "checked" : ""}>
    <legend class="hint" style="display: ${list_of_settings.length > 1 ? "block" : "none"};">(Multiple values selected)</legend>
    </fieldset>
    </div>

    <script>
    $( function() {

    $( "input" ).checkboxradio({
      icon: false
    });

    // Add event listener for the radio group
    $("input[name='compression']").on("change", function() {

        // Update targets
        for (const i in selectedTargetIDs()) {
            ID = selectedTargetIDs()[i];
            upsetter.updateTargetSettings(ID, "compression", $(this).val());
        }

        // Hide hint
        $($(this).siblings(".hint")[0]).hide();

      });

    } );
    </script>
    `;
    return html;
}


function targetFontIsCompiling(ID, condition) {
    if (condition) {
        $(`li[targetfontid=${ID}]`).addClass("compiling");
    } else {
        $(`li[targetfontid=${ID}]`).removeClass("compiling");
    }
}

function fontsCanBeGenerated(condition) {
    if (condition) {
        $("#generate-button").button("option", "disabled", false);
    }
    else {
        $("#generate-button").button("option", "disabled", true);
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