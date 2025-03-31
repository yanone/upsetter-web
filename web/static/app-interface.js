// Load App
let upsetter = null;
let fontTargets = [];
var sources_selectable = null;
var targets_selectable = null;
var selecting_targets_programmatically = false;

$(document).ready(function () {
    async function main() {
        upsetter = new Upsetter({
            readyFunction: appIsReady,
            initialLoadingPercentageFunction: initialLoadingPercentage,
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

    // Prepare BODY

    let dragCounter = 0;

    $(document).on("dragenter", function (event) {
        event.preventDefault();
        event.stopPropagation();
        dragCounter++;
        $(".default").hide();
        $(".file-dragging").show();
    });
    $(document).on("dragleave", function (event) {
        event.preventDefault();
        event.stopPropagation();
        dragCounter--;
        if (dragCounter === 0) {
            $(".default").show();
            $(".file-dragging").hide();
        }
    });

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

        dragCounter = 0; // Reset the counter
        $(".default").show();
        $(".file-dragging").hide();
    });

    // logo delay in case it loads too fast
    setTimeout(function () {
        $('#welcome').hide();
        $('#app').show();
        $('#app').css('display', 'flex');
        sourcesLoaded([]);
        targetsLoaded([]);
        loadTargetSettingsUI();
    }, 0);
}

function initialLoadingPercentage(percentage) {
    $("#loadingPercentage").html(`${percentage}%`);
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

        sources_selectable = new Selectable({
            filter: "#font-sources .items ol li",
            selectedClass: "ui-selected",
            unselectedClass: "ui-unselected",
            selectedContainer: "#font-sources .items ol",
            unselectedContainer: "#font-sources .items ol",
            container: "#font-sources .items",
            autoScroll: {
                increment: 15,
                threshold: 0
            },
            lasso: {
                borderColor: "rgba(255, 255, 255, 1)",
                backgroundColor: "rgba(255, 255, 255, 0.1)"
            }
        });
        sources_selectable.on("select", function (item) {
            $("#delete-sources-button").button("option", "disabled", false);
            $("#add-single-weight-button").button("option", "disabled", false);
        });
        sources_selectable.on("deselect", function (item) {
            if (selectedSourceIDs().length == 0) {
                $("#delete-sources-button").button("option", "disabled", true);
                $("#add-single-weight-button").button("option", "disabled", true);
            }
            else {
                $("#add-single-weight-button").button("option", "disabled", false);
            }
        });
    }
    else {
        $('#font-sources .items').html("<ol class='selectable'><li><div><span class='material-symbols-outlined'>place_item</span> Drag & drop source fonts here</div></li></ol>");
        sourcesAreAvailable(false);
    }


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

        targets_selectable = new Selectable({
            filter: "#font-targets .items ol li",
            selectedClass: "ui-selected",
            unselectedClass: "ui-unselected",
            selectedContainer: "#font-targets .items ol",
            unselectedContainer: "#font-targets .items ol",
            container: "#font-targets .items",
            autoScroll: {
                increment: 15,
                threshold: 0
            },
            lasso: {
                borderColor: "rgba(255, 255, 255, 1)",
                backgroundColor: "rgba(255, 255, 255, 0.1)"
            }
        });
        targets_selectable.on("select", function (item) {
            $("#delete-targets-button").button("option", "disabled", false);
            if (!selecting_targets_programmatically) {
                loadTargetSettingsUI();
            }
        });
        targets_selectable.on("deselect", function (item) {
            if (selectedTargetIDs().length == 0) {
                $("#delete-targets-button").button("option", "disabled", true);
            }
            if (!selecting_targets_programmatically) {
                loadTargetSettingsUI();
            }
        });
    }
    else {
        $('#font-targets .items').html("<ol class='selectable'><li><div><span class='material-symbols-outlined'>arrow_back</span> Create targets from sources</div></li></ol>");
        $("#delete-targets-button").button("option", "disabled", true);
        fontsCanBeDownloaded(false);
        fontsCanBeGenerated(false);
    }
    updateUI();
}

/* SELECTION */

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

function unselectTargetIDs(IDs) {
    selecting_targets_programmatically = true;
    for (const i in IDs) {
        ID = IDs[i];
        targets_selectable.deselect($(`li[targetfontid=${ID}]`)[0]);
    }
    selecting_targets_programmatically = false;
    loadTargetSettingsUI();
}

function unselectAllTargets() {
    if (selectedTargetIDs().length > 0) {
        selecting_targets_programmatically = true;
        targets_selectable.clear();
        selecting_targets_programmatically = false;
        loadTargetSettingsUI();
    }
}

function selectTargetIDs(IDs) {
    selecting_targets_programmatically = true;
    for (const i in IDs) {
        ID = IDs[i];
        targets_selectable.select($(`li[targetfontid=${ID}]`)[0]);
    }
    selecting_targets_programmatically = false;
    loadTargetSettingsUI();
}

/* OTHER */

function targetIDs() {
    let targets = [];
    $('#font-targets .items ol li').each(function () {
        if ($(this).attr("targetfontid") != undefined) {
            targets.push($(this).attr("targetfontid"));
        }
    });
    return targets;
}

function sourceIDs() {
    let targets = [];
    $('#font-sources .items ol li').each(function () {
        if ($(this).attr("sourcefontid") != undefined) {
            targets.push($(this).attr("sourcefontid"));
        }
    });
    return targets;
}

function deleteSelectedTargets() {
    upsetter.deleteTargets(selectedTargetIDs());
    updateUI();
    loadTargetSettingsUI();
}

function deleteSelectedSources() {
    upsetter.deleteSources(selectedSourceIDs());
    updateUI();
    loadTargetSettingsUI();
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

    if (selectedTargetIDs().length > 0) {
        $("#delete-targets-button").button("option", "disabled", false);
    }
    else {
        $("#delete-targets-button").button("option", "disabled", true);
    }

    // loadTargetSettingsUI();

}

function loadTargetSettingsUI() {
    $("#target-settings-ui").html(targetSettingsHTML());
}


class FontSource {
    constructor(options) {
        this.options = options;
    }

    html() {
        html = `<li sourcefontid="${this.options.data["fileName"]}"><div class="${this.options.data.isItalic ? "italic" : ""}"><span class="name">${this.options.data["fileName"]}</span><br />`;
        html += `${this.options.data["type"]} ${this.options.data["weightClass"]} (${this.options.data["size"]}kB)`;
        html += "</div></li>";
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
        html = `<div class="${this.options.isItalic ? "italic" : ""}"><span class="name">${this.options.name}</span>${this.options.needsCompilation ? " <span class='material-symbols-outlined' title='This font needs to be re-generated'>change_circle</span>" : ""}<br />`;
        html += `<span class="visiblewhenidle">`
        if (this.options.size_uncompressed) {
            html += `uncmpr:${this.options.size_uncompressed}kB (${Math.round(100 * this.options.size_uncompressed / this.options.source_size)}%)`
        }
        if (this.options.size_uncompressed && this.options.size_compressed) {
            html += `, `
        }
        if (this.options.size_compressed) {
            html += `compr:${this.options.size_compressed}kB (${Math.round(100 * this.options.size_compressed / this.options.source_size)}%)`
        }
        html += `</span > <span class="visiblewhencompiling">compiling...</span></div>`

        return html;
    }
}

function collectSettings(key) {
    var list_of_settings = new Set();
    for (const i in selectedTargetIDs()) {
        ID = selectedTargetIDs()[i];
        data = upsetter.targetData(ID);
        list_of_settings.add(data.settings[key]);
    }
    return Array.from(list_of_settings);
}

function collectData(key) {
    var list_of_settings = new Set();
    for (const i in selectedTargetIDs()) {
        ID = selectedTargetIDs()[i];
        data = upsetter.targetData(ID);
        list_of_settings.add(data[key]);
    }
    return Array.from(list_of_settings);
}


function targetSettingsHTML() {

    if (selectedTargetIDs().length == 0) {
        return "<div style='visibility: hidden'>.</div><div class='spacer'></div><div><span class='material-symbols-outlined'>arrow_back</span> Select one or more targets to edit them</div>";
    }

    html = ``;

    // Based on which source
    sourceFont = collectData("sourceFont");
    if (sourceFont.length == 1) {
        sourceFont = sourceFont[0];
    }
    else {
        sourceFont = "Multiple source fonts";
    }
    html += `
    <div>
    Based on source: <b>${sourceFont}</b>
    </div>
    <p></p>
    `

    // Compression
    compression = collectSettings("compression");

    html += ``;
    html += `
    <div class="widget">
    <fieldset>
    <legend>Compression: </legend>
    <label for="uncompressed">Uncompressed</label>
    <input type="radio" name="compression" id="uncompressed" value="uncompressed" ${compression.length == 1 && compression[0] == "uncompressed" ? "checked" : ""}>
    <label for="compressed">Compressed</label>
    <input type="radio" name="compression" id="compressed" value="compressed" ${compression.length == 1 && compression[0] == "compressed" ? "checked" : ""}>
    <label for="compressed_both">Both</label>
    <input type="radio" name="compression" id="compressed_both" value="both" ${compression.length == 1 && compression[0] == "both" ? "checked" : ""}>
    <legend class="hint" style="display: ${compression.length > 1 ? "block" : "none"};"><span class="material-symbols-outlined">info</span> Multiple values selected</legend>
    </fieldset>
    </div>
    `;

    html += `<p></p>`;
    html += `<p>Optional OpenType Features:</p>`;
    html += `<p></p>`;

    // Optional OT features
    otFeatures = collectData("optionalOTfeatures");

    // Combine OT features into a single array
    let totalOTfeatures = new Set();
    for (const i in otFeatures) {
        for (const j in otFeatures[i]) {
            totalOTfeatures = totalOTfeatures.add(otFeatures[i][j]);
        }
    }
    totalOTfeatures = Array.from(totalOTfeatures).sort();

    if (totalOTfeatures.length == 0) {
        html += `<p>No optional OpenType features available</p>`;
    }
    else {
        html += `<table>`;
        // html += `<tr><th>Feature</th><th>Code</th><th>User Choice</th></tr>`;

        for (const i in totalOTfeatures) {
            feature = totalOTfeatures[i];
            html += `<tr>`;
            html += `<td><code>${feature}</code></td>`;

            // Stylistic Set Names
            let ssName = "";
            let multipleSSNames = false;
            let names = new Set();
            if (feature.startsWith("ss")) {
                // Get stylistic set names, if defined
                ssNames = collectData("stylisticSetNames");
                for (const j in ssNames) {
                    if (ssNames[j][feature]) {
                        names.add(ssNames[j][feature]);
                    }
                }
                names = Array.from(names);
                if (names.length > 1) {
                    ssName = names[0];
                    multipleSSNames = true;
                }
                else {
                    ssName = names[0];
                }
            }

            // Decide name
            let feature_name = feature;
            if (optional_opentype_features_names[feature]) {
                feature_name = optional_opentype_features_names[feature];
            }
            if (ssName) {
                feature_name = ssName;
            }

            html += `<td>${feature_name} `;
            // Check if the feature is available in all fonts
            let availableInAll = true;
            for (const j in selectedTargetIDs()) {
                ID = selectedTargetIDs()[j];
                data = upsetter.targetData(ID);
                if (!data.optionalOTfeatures.includes(feature)) {
                    availableInAll = false;
                    break;
                }
            }
            if (!availableInAll) {
                html += `<br /> <span class="hint"><span class="material-symbols-outlined">info</span> Not available in all selected fonts</span>`;
            }
            if (multipleSSNames) {
                html += `<br /> <span class="hint"><span class="material-symbols-outlined">warning</span> Stylistic Set has different names across selected fonts:<br /><em>${names.join("</em>, <em>")}</em></span>`;
            }

            // Calculate value
            let values = new Set();
            for (const j in selectedTargetIDs()) {
                ID = selectedTargetIDs()[j];
                data = upsetter.targetData(ID);
                let value = "keep";
                if (data.settings.freeze_features.indexOf(feature) > -1) {
                    value = "freeze";
                }
                if (data.settings.drop_features.indexOf(feature) > -1) {
                    value = "drop";
                }
                values.add(value);
            }
            values = Array.from(values);


            html += `<td>`;
            html += `
            <div class="widget">
                <fieldset>
                    <label for="feature_${feature}_keep">Keep</label>
                    <input type="radio" feature="${feature}" part="opentypefeature" name="feature_${feature}" id="feature_${feature}_keep" value="keep" ${values.length == 1 && values[0] == "keep" ? "checked" : ""}>
                        <label for="feature_${feature}_freeze">Freeze</label>
                    <input type="radio" feature="${feature}" part="opentypefeature" name="feature_${feature}" id="feature_${feature}_freeze" value="freeze" ${values.length == 1 && values[0] == "freeze" ? "checked" : ""}>
                        <label for="feature_${feature}_drop">Drop</label>
                    <input type="radio" feature="${feature}" part="opentypefeature" name="feature_${feature}" id="feature_${feature}_drop" value="drop" ${values.length == 1 && values[0] == "drop" ? "checked" : ""}>
            `;
            html += `</fieldset>`
            if (values.length > 1) {
                html += `<div class="hint"><span class="material-symbols-outlined">info</span> Multiple values selected</div>`;
            }
            html += `</div>
            `;
            html += `</td>`;
            html += `</tr>`;
        }
        html += `</table > `;

        html += `
            <script>
            $(function () {
                $("input[type='radio']").checkboxradio({
                    icon: false
                });
            });
            </script >
            `;


    }
    return html;
}


function targetFontIsCompiling(ID, condition) {
    if (condition) {
        $(`li[targetfontid = ${ID}]`).addClass("compiling");
    } else {
        $(`li[targetfontid = ${ID}]`).removeClass("compiling");
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