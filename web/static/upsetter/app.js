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

class UpsetterFont(TTFont):
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
                        await this.processFile(file.name, data); // Ensure processFile is awaited
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

    async processFile(fileName, data) {
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
            list = []
            for file in os.listdir("${SOURCESFOLDER}"):
                ttFont = UpsetterFont(f"${SOURCESFOLDER}/{file}")
                list.append({
                    "fileName": file,
                    "size": round(os.path.getsize(f"${SOURCESFOLDER}/{file}") / 1000),
                    "type": "variable" if "fvar" in ttFont else "static",
                    "familyName": ttFont.familyName(),
                    "isItalic": ttFont.isItalic(),
                    "weightClass": ttFont.get("OS/2").usWeightClass
                })

            # Sort the list by Italic
            list.sort(key=lambda x: (x["isItalic"], x["weightClass"]))

            json.dumps(list)  # Serialize the list to JSON

            `));
        return list;
    }

    deleteSource(fileName) {
        pyodide.runPython(`os.remove("${SOURCESFOLDER}/${fileName}")`);

        // Now call fontSourcesInformation
        const fontSources = this.fontSourcesInformation();
        this.options.sourcesLoadedFunction(fontSources);
    }
}
