// Placeholder variable for Pyodide
let pyodide = null;


// constants
const SOURCESFOLDER = "sources";
const TARGETSFOLDER = "targets";
const DOWNLOADSFOLDER = "download";

optional_opentype_features_names = {
    "afrc": "Alternative Fractions",
    "calt": "Contextual Alternates",
    "case": "Case-Sensitive Forms",
    "clig": "Contextual Ligatures",
    "dlig": "Discretionary Ligatures",
    "frac": "Fractions",
    "hist": "Historical Forms",
    "hlig": "Historical Ligatures",
    "liga": "Standard Ligatures",
    "lnum": "Lining Figures",
    "onum": "Oldstyle Figures",
    "pnum": "Proportional Figures",
    "salt": "Stylistic Alternates",
    "smcp": "Small Capitals",
    "ss01": "Stylistic Set 1",
    "ss02": "Stylistic Set 2",
    "ss03": "Stylistic Set 3",
    "ss04": "Stylistic Set 4",
    "ss05": "Stylistic Set 5",
    "ss06": "Stylistic Set 6",
    "ss07": "Stylistic Set 7",
    "ss08": "Stylistic Set 8",
    "ss09": "Stylistic Set 9",
    "ss10": "Stylistic Set 10",
    "ss11": "Stylistic Set 11",
    "ss12": "Stylistic Set 12",
    "ss13": "Stylistic Set 13",
    "ss14": "Stylistic Set 14",
    "ss15": "Stylistic Set 15",
    "ss16": "Stylistic Set 16",
    "ss17": "Stylistic Set 17",
    "ss18": "Stylistic Set 18",
    "ss19": "Stylistic Set 19",
    "ss20": "Stylistic Set 20",
    "subs": "Subscript",
    "sups": "Superscript",
    "swsh": "Swash",
    "titl": "Titling",
    "tnum": "Tabular Figures",
    "zero": "Slashed Zero",
}


class Upsetter {
    constructor(options) {
        this.options = options;

        // User settings
        this.user_settings = {};

        this.options.initialLoadingPercentageFunction(0);

        // Load Pyodide
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js';
        script.type = 'text/javascript';
        document.head.append(script);

        // Script is loaded, run this.readyFunction()
        script.onload = () => this.loadPyodide().then(() => {
            this.options.initialLoadingPercentageFunction(100);
            // 500ms timeout
            setTimeout(() => {
                this.options.readyFunction();
            }, 500);

        });
    }

    async loadPyodide() {

        pyodide = await loadPyodide();

        this.options.initialLoadingPercentageFunction(20);

        await pyodide.loadPackage('micropip');

        this.options.initialLoadingPercentageFunction(40);

        await pyodide.loadPackage('static/upsetter/upsetter-0.1.0a6-py3-none-any.whl');

        this.options.initialLoadingPercentageFunction(60);

        await pyodide.runPythonAsync(`
import micropip
import os
import json
import copy
import shutil
from pyodide.code import run_js

optional_opentype_features = [
    "afrc",
    "calt",
    "case",
    "clig",
    "dlig",
    "frac",
    "hist",
    "hlig",
    "liga",
    "lnum",
    "onum",
    "pnum",
    "salt",
    "smcp",
    "ss01",
    "ss02",
    "ss03",
    "ss04",
    "ss05",
    "ss06",
    "ss07",
    "ss08",
    "ss09",
    "ss10",
    "ss11",
    "ss12",
    "ss13",
    "ss14",
    "ss15",
    "ss16",
    "ss17",
    "ss18",
    "ss19",
    "ss20",
    "subs",
    "sups",
    "swsh",
    "titl",
    "tnum",
    "zero",
]


await micropip.install("fonttools==4.55.8")
from fontTools.ttLib import TTFont, TTLibError

run_js("upsetter.options.initialLoadingPercentageFunction(80);")

await micropip.install("brotli")
await micropip.install("opentype-feature-freezer")

import upsetter

os.makedirs("${SOURCESFOLDER}", exist_ok=True)
os.makedirs("${TARGETSFOLDER}", exist_ok=True)
os.makedirs("${DOWNLOADSFOLDER}", exist_ok=True)

class UpsetterFont(TTFont):
    def familyName(self):
        name = self["name"]
        familyName = name.getName(16, 3, 1, 1033)
        if familyName:
            return familyName.toUnicode()
        return name.getName(1, 3, 1, 1033).toUnicode()
    def styleName(self):
        name = self["name"]
        styleName = name.getName(17, 3, 1, 1033)
        if styleName:
            return styleName.toUnicode()
        return name.getName(2, 3, 1, 1033).toUnicode()
    def isItalic(self):
        return "Italic" in self.fileName()
    def fileName(self):
        return self.reader.file.name
    def optionalOTfeatures(self):
        ot_features = set()
        for FeatureRecord in self.get("GSUB").table.FeatureList.FeatureRecord:
            ot_features.add(FeatureRecord.FeatureTag)
        for FeatureRecord in self.get("GPOS").table.FeatureList.FeatureRecord:
            ot_features.add(FeatureRecord.FeatureTag)
        # prune against optional_opentype_features
        ot_features = ot_features.intersection(set(optional_opentype_features))
        return sorted(list(ot_features))
    def stylisticSetNames(self):
        # Extract name table for readable names
        name = self["name"]
        
        # GSUB table contains feature info
        if "GSUB" not in self:
            print("No GSUB table found.")
            return {}
        
        gsub_table = self["GSUB"].table
        feature_names = {}

        for feature_record in gsub_table.FeatureList.FeatureRecord:
            feature_tag = feature_record.FeatureTag
            
            # Look for stylistic sets (ss01 - ss20)
            if feature_tag.startswith("ss"):
                if hasattr(feature_record.Feature.FeatureParams, "UINameID"):  # Some fonts use UINameID for feature name
                    name_id = feature_record.Feature.FeatureParams.UINameID
                    feature_name = name.getName(name_id, 3, 1, 1033).toUnicode()
                    feature_names[feature_tag] = feature_name
        
        return feature_names

fontSources = {}

class FontSource(object):
    def __init__(self, fileName):
        self.fileName = fileName
        self.ttFont = UpsetterFont(f"${SOURCESFOLDER}/{self.fileName}")
    def delete(self):
        os.remove(f"${SOURCESFOLDER}/{self.fileName}")
        del fontSources[self.fileName]
    def getTargets(self):
        targets_list = []
        for ID, targetFont in fontTargets.items():
            if targetFont.sourceFont == self:
                targets_list.append(targetFont)
        return targets_list
    def data(self):
        return {
            "fileName": self.fileName,
            "size": round(os.path.getsize(f"${SOURCESFOLDER}/{self.fileName}") / 1000),
            "type": "variable" if "fvar" in self.ttFont else "static",
            "familyName": self.ttFont.familyName(),
            "isItalic": self.ttFont.isItalic(),
            "weightClass": self.ttFont.get("OS/2").usWeightClass
        }

def getFontSource(fileName):
    if os.path.exists(f"${SOURCESFOLDER}/{fileName}"):
        if fileName not in fontSources:
            fontSources[fileName] = FontSource(fileName)
        return fontSources[fileName]
    return None

fontTargets_index = 0
fontTargets = {}

def nextFontTargetIndex():
    global fontTargets_index
    fontTargets_index += 1
    return fontTargets_index

class FontTarget(object):
    def __init__(self, sourceFont, settings):
        self.sourceFont = sourceFont
        self.ID = None
        self.ttFont = None
        self.settings = settings
        self.last_compilation_settings = None
    def delete(self):
        del fontTargets[self.ID]
        if os.path.exists(f"${TARGETSFOLDER}/{self.fileName()}"):
            os.remove(f"${TARGETSFOLDER}/{self.fileName()}")
    def updateSetting(self, key, value):
        print(self.name(), key, value)
        self.settings[key] = value
    def data(self):
        _data = {
            "sourceFont": self.sourceFont.fileName,
            "isItalic": self.sourceFont.ttFont.isItalic(),
            "weightClass": self.sourceFont.ttFont.get("OS/2").usWeightClass,
            "ID": self.ID,
            "source_size": round(os.path.getsize(f"${SOURCESFOLDER}/{self.sourceFont.fileName}") / 1000),
            "size_uncompressed": round((os.path.getsize(f"${TARGETSFOLDER}/{self.fileName()}") if os.path.exists(f"${TARGETSFOLDER}/{self.fileName()}") and self.settings["compression"] in ("uncompressed", "both") else 0) / 1000),
            "size_compressed": round((os.path.getsize(f"${TARGETSFOLDER}/{self.compressedFileName()}") if os.path.exists(f"${TARGETSFOLDER}/{self.compressedFileName()}") and self.settings["compression"] in ("compressed", "both") else 0) / 1000),
            "settings": self.settings,
            "needsCompilation": self.needsCompilation(),
            "optionalOTfeatures": self.sourceFont.ttFont.optionalOTfeatures(),
            "name": self.name(),
            "stylisticSetNames": self.sourceFont.ttFont.stylisticSetNames(),

        }
        return _data
    def name(self):
        return f"{self.sourceFont.ttFont.familyName()}-{self.sourceFont.ttFont.styleName()}"
    def fileName(self):
        return f"{self.name()}{os.path.splitext(self.sourceFont.fileName)[1]}"
    def compressedFileName(self):
        return f"{self.name()}.woff2"
    def needsCompilation(self):
        return self.settings != self.last_compilation_settings
    def compile(self):
        self.ttFont = copy.deepcopy(self.sourceFont.ttFont)
        if self.settings["freeze_features"]:
            self.ttFont = upsetter.font_freeze_features(self.ttFont, self.settings["freeze_features"], None)
        self.ttFont = upsetter.font_subset(self.sourceFont.ttFont, remove_features=self.settings["drop_features"] or None)

        if self.settings["compression"] in ("uncompressed", "both"):
            self.ttFont.save(f"${TARGETSFOLDER}/{self.fileName()}")

        if self.settings["compression"] in ("compressed", "both"):
            woff2_ttFont = copy.deepcopy(self.ttFont)
            woff2_ttFont.flavor = "woff2"
            woff2_ttFont.save(f"${TARGETSFOLDER}/{self.compressedFileName()}")

        self.last_compilation_settings = copy.deepcopy(self.settings)

        if self.settings["compression"] == "uncompressed" and os.path.exists(f"${TARGETSFOLDER}/{self.compressedFileName()}"):
            os.remove(f"${TARGETSFOLDER}/{self.compressedFileName()}")
        if self.settings["compression"] == "compressed" and os.path.exists(f"${TARGETSFOLDER}/{self.fileName()}"):
            os.remove(f"${TARGETSFOLDER}/{self.fileName()}")
    def emitFiles(self):
        files = []
        if self.settings["compression"] in ("uncompressed", "both"):
            files.append(self.fileName())
        if self.settings["compression"] in ("compressed", "both"):
            files.append(self.compressedFileName())
        return files

def getFontTarget(sourceFont=None, ID=None):
    if not ID:
        ID = nextFontTargetIndex()
        assert sourceFont is not None, "sourceFont must be provided if ID is not provided"
    if ID not in fontTargets:
        defaultSettings = {
            "compression": "uncompressed",
            "freeze_features": [],
            "drop_features": [],
        }
        fontTargets[ID] = FontTarget(sourceFont, defaultSettings)
    fontTargets[ID].ID = ID
    return fontTargets[ID]



    `);

        this.options.fontsCanBeDownloadedFunction(false);
        this.options.fontsCanBeGeneratedFunction(false);
    }

    async uploadFiles(files) {
        const fileProcessingPromises = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();

            // Wrap the FileReader in a Promise
            const filePromise = new Promise((resolve, reject) => {
                reader.onload = async (event) => {
                    try {
                        const data = event.target.result;
                        await this.processFileUpload(file.name, data);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                };
                reader.onerror = () => reject(reader.error);
            });

            reader.readAsArrayBuffer(file);
            fileProcessingPromises.push(filePromise);
        }

        // Wait for all files to be processed
        await Promise.all(fileProcessingPromises);

        // Now call fontSourcesInformation
        this.reloadSources();
        this.reloadTargets();
    }

    async processFileUpload(fileName, data) {
        if (fileName.endsWith('.json')) {
            const json = JSON.parse(new TextDecoder().decode(data));
            if ("upsetter-version" in json) {
                this.user_settings = json;
            } else {
                this.options.messageFunction("Error", "The file you uploaded is not a valid Upsetter settings file.");
            }
        } else if (fileName.endsWith('.ttf')) {
            if (pyodide.runPython(`os.path.exists("${SOURCESFOLDER}/${fileName}")`)) {
                this.options.messageFunction("Error", `${fileName} already exists. Remove the old file of same name before uploading a new version.`);
                return;
            }

            pyodide.FS.writeFile(`${SOURCESFOLDER}/${fileName}`, new Uint8Array(data));

            pyodide.runPython(`
                try:
                    source_font = UpsetterFont("${SOURCESFOLDER}/${fileName}")
                except TTLibError:
                    source_font = None
            `);

            // Check if the font is valid
            if (!pyodide.runPython(`source_font`)) {
                this.options.messageFunction("Error", `${fileName} is not a valid font file.`);
                pyodide.runPython(`os.remove("${SOURCESFOLDER}/${fileName}")`);
            }

            // Check if familyNames and types are consistent
            var fontSources = this.fontSourcesInformation();
            const firstFont = fontSources.pop(0);
            if (fontSources.length >= 1) {
                for (const font of fontSources) {
                    if (font.familyName != firstFont.familyName) {
                        this.options.messageFunction("Error", `All fonts must be of same family name. You uploaded ${font.familyName} and ${firstFont.familyName}.`);
                        pyodide.runPython(`os.remove("${SOURCESFOLDER}/${fileName}")`);
                        return;
                    }
                    if (font.type != firstFont.type) {
                        this.options.messageFunction("Error", `All fonts must be either static or variable. You uploaded both types.`);
                        pyodide.runPython(`os.remove("${SOURCESFOLDER}/${fileName}")`);
                        return;
                    }
                }
            }
        }
    }

    fontSourcesInformation() {
        const list = JSON.parse(pyodide.runPython(`
            _list = []
            for file in os.listdir("${SOURCESFOLDER}"):
                font = getFontSource(file)
                _list.append(font.data())

            # Sort the list by Italic
            _list.sort(key=lambda x: (x["isItalic"], x["weightClass"]))
            json.dumps(_list)  # Serialize the list to JSON

            `));
        return list;
    }

    fontTargetsInformation() {
        const list = JSON.parse(pyodide.runPython(`
            _list = []
            for ID, targetFont in fontTargets.items():
                _list.append(targetFont.data())

            # Sort the list by Italic
            _list.sort(key=lambda x: (x["isItalic"], x["weightClass"]))
            json.dumps(_list)  # Serialize the list to JSON

            `));
        return list;
    }

    targetData(ID) {
        return JSON.parse(pyodide.runPython(`json.dumps(getFontTarget(ID=${ID}).data())`));
    }

    updateTargetSettings(ID, key, value) {
        pyodide.runPython(`
            getFontTarget(ID=${ID}).updateSetting("${key}", json.loads('${JSON.stringify(value)}'))
        `);
        this.options.updateTargetFunction(JSON.parse(pyodide.runPython(`json.dumps(getFontTarget(ID=${ID}).data())`)));
    }

    async deleteSource(fileName) {
        if (pyodide.runPython(`getFontSource("${fileName}").getTargets() != []`)) {
            const result = await okaycancel(
                "Warning",
                `The font ${fileName} is being used in a target. Are you sure you want to delete it?`
            );

            if (result) {
                pyodide.runPython(`
                    for target in getFontSource("${fileName}").getTargets():
                        target.delete()
                    getFontSource("${fileName}").delete()
                `);
                this.reloadSources();
                this.reloadTargets();
            }
        } else {
            pyodide.runPython(`getFontSource("${fileName}").delete()`);
            this.reloadSources();
            this.reloadTargets();
        }
    }

    deleteTarget(ID) {
        pyodide.runPython(`getFontTarget(ID=${ID}).delete()`);
    }

    deleteTargets(IDs) {
        for (const ID of IDs) {
            pyodide.runPython(`getFontTarget(ID=${ID}).delete()`);
        }

        // Now call fontSourcesInformation
        this.reloadTargets();
        this.options.updateUIFunction();
    }

    async deleteSources(IDs) {
        for (const ID of IDs) {
            await this.deleteSource(ID);
        }

        // // Now call fontSourcesInformation
        this.reloadSources();
        this.reloadTargets();
        this.options.updateUIFunction();
    }

    reloadTargets() {
        const fontTargets = this.fontTargetsInformation();
        this.options.targetsLoadedFunction(fontTargets);
    }

    reloadSources() {
        const fontSources = this.fontSourcesInformation();
        this.options.sourcesLoadedFunction(fontSources);
    }

    addTargetFonts() {
        var IDs = JSON.parse(pyodide.runPython(`
            _list = []
            for fileName, sourceFont in fontSources.items():
                targetFont = getFontTarget(sourceFont=sourceFont)
                _list.append(targetFont.ID)
            json.dumps(_list)
        `));

        // Now call fontSourcesInformation
        this.reloadTargets();

        return IDs;

    }

    addSingleWeight(IDs) {

        var list = [];
        for (const ID of IDs) {
            var newID = JSON.parse(pyodide.runPython(`
                sourceFont = getFontSource("${ID}")
                targetFont = getFontTarget(sourceFont=sourceFont)
                json.dumps(targetFont.ID)
            `));
            list.push(newID);
        }

        // pyodide.runPython(`

        //     for fileName, sourceFont in fontSources.items():
        //         targetFont = getFontTarget(sourceFont=sourceFont)

        // `);

        // Now call fontSourcesInformation
        this.reloadTargets();

        return list;

    }

    async generate() {

        var startTime = Date.now();

        this.options.fontsCanBeDownloadedFunction(false);
        this.options.fontsCanBeGeneratedFunction(false);

        const IDs = JSON.parse(pyodide.runPython(`json.dumps([ID for ID, targetFont in fontTargets.items() if getFontTarget(ID=ID).needsCompilation()])`));

        // Create an array of promises for saving fonts
        const savePromises = IDs.map(async (ID) => {
            this.options.targetFontIsCompilingFunction(ID, true); // Indicate that the font is being compiled
            await pyodide.runPythonAsync(`getFontTarget(ID=${ID}).compile()`); // Save the font asynchronously
            this.options.targetFontIsCompilingFunction(ID, false); // Indicate that the font compilation is complete
            this.options.updateTargetFunction(JSON.parse(pyodide.runPython(`json.dumps(getFontTarget(ID=${ID}).data())`))); // Update the target font
        });

        // Wait for all save operations to complete
        await Promise.all(savePromises);

        this.options.fontsCanBeDownloadedFunction(true);
        // this.options.fontsCanBeGeneratedFunction(true);

        var endTime = Date.now();
        console.log(`Average font compile time: ${(endTime - startTime) / IDs.length}ms`);
    }

    // make zip file with Python of all files in targets folder and download
    download() {
        pyodide.runPython(`
            import zipfile
            familyName = fontTargets[list(fontTargets.keys())[0]].sourceFont.ttFont.familyName()

            # Delete old files
            for file in os.listdir("${DOWNLOADSFOLDER}"):
                os.remove(f"${DOWNLOADSFOLDER}/{file}")

            # Copy all files from targets folder to download folder
            for ID, targetFont in fontTargets.items():
                for file in targetFont.emitFiles():
                    shutil.copy(f"${TARGETSFOLDER}/{file}", f"${DOWNLOADSFOLDER}/{file}")
                    print(f"${TARGETSFOLDER}/{file}", f"${DOWNLOADSFOLDER}/{file}")

            # Create a zip file of all files in download folder
            with zipfile.ZipFile("download.zip", "w") as zipf:
                for file in os.listdir("${DOWNLOADSFOLDER}"):
                    zipf.write(os.path.join("${DOWNLOADSFOLDER}", file), file)
            
            `);

        const zipFile = pyodide.FS.readFile("download.zip");
        const blob = new Blob([zipFile], { type: "application/zip" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "upsetter.zip";
        a.click();

    }
}

