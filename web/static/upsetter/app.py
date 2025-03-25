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
