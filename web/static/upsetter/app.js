// Placeholder variable for Pyodide
let pyodide = null;


// constants
const SOURCESFOLDER = "sources";
const TARGETSFOLDER = "targets";

class Upsetter {
    constructor(options) {
        this.options = options;

        // User settings
        this.user_settings = {};

        // Load Pyodide
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js';
        script.type = 'text/javascript';
        document.head.append(script);

        // Script is loaded, run this.readyFunction()
        script.onload = () => this.loadPyodide().then(() => {
            this.options.readyFunction();
        });
    }

    async loadPyodide() {
        pyodide = await loadPyodide();
        await pyodide.loadPackage('micropip');
        await pyodide.loadPackage('static/upsetter/upsetter-0.1.0a6-py3-none-any.whl');
        await pyodide.runPythonAsync(`
import micropip
import os
import json
import copy
from pyodide.code import run_js

await micropip.install("fonttools==4.55.8")
from fontTools.ttLib import TTFont, TTLibError

await micropip.install("brotli")

import upsetter

os.makedirs("${SOURCESFOLDER}", exist_ok=True)
os.makedirs("${TARGETSFOLDER}", exist_ok=True)

class UpsetterTTFont(TTFont):
    def familyName(self):
        name = self["name"]
        familyName = name.getName(16, 3, 1, 1033)
        if familyName:
            return familyName.toUnicode()
        return name.getName(1, 3, 1, 1033).toUnicode()
    def isItalic(self):
        return "Italic" in self.fileName()
    def fileName(self):
        return self.reader.file.name

fontSources = {}

class FontSource(object):
    def __init__(self, fileName):
        self.fileName = fileName
        self.ttFont = UpsetterTTFont(f"${SOURCESFOLDER}/{self.fileName}")
    def delete(self):
        os.remove(f"${SOURCESFOLDER}/{self.fileName}")
        del fontSources[self.fileName]
    def getTargets(self):
        list = []
        for ID, targetFont in fontTargets.items():
            if targetFont.sourceFont == self:
                list.append(targetFont)
        return list
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
        self.settings[key] = value
    def data(self):
        return {
            "sourceFont": self.sourceFont.fileName,
            "isItalic": self.sourceFont.ttFont.isItalic(),
            "weightClass": self.sourceFont.ttFont.get("OS/2").usWeightClass,
            "ID": self.ID,
            "size_uncompressed": round((os.path.getsize(f"${TARGETSFOLDER}/{self.fileName()}") if os.path.exists(f"${TARGETSFOLDER}/{self.fileName()}") and self.settings["compression"] in ("uncompressed", "both") else 0) / 1000),
            "size_compressed": round((os.path.getsize(f"${TARGETSFOLDER}/{self.compressedFileName()}") if os.path.exists(f"${TARGETSFOLDER}/{self.compressedFileName()}") and self.settings["compression"] in ("compressed", "both") else 0) / 1000),
            "settings": self.settings,
            "needsCompilation": self.needsCompilation()
        }
    def fileName(self):
        return f"{self.ID}{os.path.splitext(self.sourceFont.fileName)[1]}"
    def compressedFileName(self):
        return f"{self.ID}.woff2"
    def needsCompilation(self):
        return self.settings != self.last_compilation_settings
    def compile(self):
        self.ttFont = upsetter.font_subset(self.sourceFont.ttFont)

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
        

def getFontTarget(sourceFont=None, ID=None):
    if not ID:
        ID = nextFontTargetIndex()
    if ID not in fontTargets:
        defaultSettings = {
            "compression": "uncompressed"
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
                    source_font = TTFont("${SOURCESFOLDER}/${fileName}")
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
            list = []
            for file in os.listdir("${SOURCESFOLDER}"):
                font = getFontSource(file)
                list.append(font.data())

            # Sort the list by Italic
            list.sort(key=lambda x: (x["isItalic"], x["weightClass"]))
            json.dumps(list)  # Serialize the list to JSON

            `));
        return list;
    }

    fontTargetsInformation() {
        const list = JSON.parse(pyodide.runPython(`
            list = []
            for ID, targetFont in fontTargets.items():
                list.append(targetFont.data())

            # Sort the list by Italic
            list.sort(key=lambda x: (x["isItalic"], x["weightClass"]))
            json.dumps(list)  # Serialize the list to JSON

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
        this.options.updateTargetFunction(JSON.parse(pyodide.runPython(`json.dumps(getFontTarget(ID=${ID}).data())`))); // Update the target font

    }

    async deleteSource(fileName) {
        if (pyodide.runPython(`getFontSource("${fileName}").getTargets() != []`)) {
            okaycancel("Warning", `The font ${fileName} is being used in a target. Are you sure you want to delete it?`)
                .then((result) => {
                    if (result) {
                        pyodide.runPython(`
                            for target in getFontSource("${fileName}").getTargets():
                                target.delete()
                            getFontSource("${fileName}").delete()`);
                        this.reloadSources();
                        this.reloadTargets();
                    }
                });

        }
        else {
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
    }

    reloadTargets() {
        const fontTargets = this.fontTargetsInformation();
        this.options.targetsLoadedFunction(fontTargets);
    }

    reloadSources() {
        const fontSources = this.fontSourcesInformation();
        this.options.sourcesLoadedFunction(fontSources);
    }

    async addTargetFonts() {
        pyodide.runPython(`

            for fileName, sourceFont in fontSources.items():
                targetFont = getFontTarget(sourceFont=sourceFont)

        `);

        // Now call fontSourcesInformation
        this.reloadTargets();

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
        this.options.fontsCanBeGeneratedFunction(true);

        var endTime = Date.now();
        console.log(`Average font compile time: ${(endTime - startTime) / IDs.length}ms`);
    }

    // make zip file with Python of all files in targets folder and download
    download() {
        pyodide.runPython(`
            import zipfile
            import os

            with zipfile.ZipFile("upsetter.zip", "w") as zipf:
                for file in os.listdir("${TARGETSFOLDER}"):
                    zipf.write(os.path.join("${TARGETSFOLDER}", file), file)
            `);

        const zipFile = pyodide.FS.readFile("upsetter.zip");
        const blob = new Blob([zipFile], { type: "application/zip" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "upsetter.zip";
        a.click();

    }
}

