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
            await micropip.install('fonttools==4.55.8')
            from fontTools.ttLib import TTFont, TTLibError
            os.makedirs("${SOURCESFOLDER}", exist_ok=True)
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
                    source_font = TTFont("${SOURCESFOLDER}/${fileName}")
                except TTLibError:
                    source_font = None
            `);

            if (!pyodide.runPython(`source_font`)) {
                this.options.messageFunction("Error", `${fileName} is not a valid font file.`);
                pyodide.runPython(`os.remove("${SOURCESFOLDER}/${fileName}")`);
            }
        }
    }

    fontSourcesInformation() {
        const list = JSON.parse(pyodide.runPython(`
            list = []
            for file in os.listdir("${SOURCESFOLDER}"):
                list.append({
                    "name": file,
                    "size": round(os.path.getsize(f"${SOURCESFOLDER}/{file}") / 1000)
                })
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