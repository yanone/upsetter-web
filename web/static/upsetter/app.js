// Placeholder variable for Pyodide
let pyodide = null;

// constants
const SOURCESFOLDER = "sources";

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
        await pyodide.runPythonAsync(`
import micropip
import os
import json
from pyodide.code import run_js

await micropip.install("fonttools==4.55.8")
from fontTools.ttLib import TTFont, TTLibError

os.makedirs("${SOURCESFOLDER}", exist_ok=True)

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
    def __init__(self, sourceFont):
        self.sourceFont = sourceFont
        self.ID = None
    def delete(self):
        del fontTargets[self.ID]
        print(f"Deleted target {self.ID}", fontTargets)
    def data(self):
        return {
            "sourceFont": self.sourceFont.fileName,
            "weightClass": self.sourceFont.ttFont.get("OS/2").usWeightClass,
            "ID": self.ID
        }

def getFontTarget(sourceFont=None, ID=None):
    if not ID:
        ID = nextFontTargetIndex()
    if ID not in fontTargets:
        fontTargets[ID] = FontTarget(sourceFont)
    fontTargets[ID].ID = ID
    return fontTargets[ID]



    `);
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
        const fontSources = this.fontSourcesInformation();
        this.options.sourcesLoadedFunction(fontSources);
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
            list.sort(key=lambda x: (x["weightClass"]))
            json.dumps(list)  # Serialize the list to JSON

            `));
        return list;
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
                        this.options.sourcesLoadedFunction(this.fontSourcesInformation());
                        this.options.targetsLoadedFunction(this.fontTargetsInformation());
                    }
                });

        }
        else {
            pyodide.runPython(`getFontSource("${fileName}").delete()`);
            this.options.sourcesLoadedFunction(this.fontSourcesInformation());
            this.options.targetsLoadedFunction(this.fontTargetsInformation());
        }
    }

    deleteTarget(ID) {
        pyodide.runPython(`getFontTarget(ID=${ID}).delete()`);

        // Now call fontSourcesInformation
        this.options.targetsLoadedFunction(this.fontTargetsInformation());
    }

    addTargetFonts() {
        pyodide.runPython(`

            for fileName, sourceFont in fontSources.items():
                targetFont = getFontTarget(sourceFont=sourceFont)

        `);

        // Now call fontSourcesInformation
        this.options.targetsLoadedFunction(this.fontTargetsInformation());
    }
}

