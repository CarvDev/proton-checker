# ProtonDB Checker Indicator

A GNOME Shell extension that allows you to check game compatibility on Linux (Proton) directly from your panel. It uses the Steam API to search for games and the ProtonDB API to fetch compatibility reports.

![Extension Screenshot](screenshot.png)

## Features

* **Search Steam Games:** Quickly find games by name.
* **ProtonDB Integration:** View Tier (Platinum, Gold, Silver, etc.), Score, and Confidence levels.
* **Color Coded:** Visual indicators for different compatibility tiers matching ProtonDB's style.
* **Modern Stack:** Built with ESM and LibSoup 3 for GNOME 45+.

## Requirements

* GNOME Shell 45 or later.
* `libsoup-3.0` (Standard on most modern distributions).

## Installation

### From Source (Manual)

1.  Clone this repository:
    ```bash
    git clone [https://github.com/CarvDev/proton-checker.git](https://github.com/CarvDev/proton-checker.git)
    cd proton-checker
    ```

2.  Copy the extension to your local extensions directory:
    ```bash
    # Create the directory if it doesn't exist
    mkdir -p ~/.local/share/gnome-shell/extensions/proton-checker@carvdev.github.com
    
    # Copy files
    cp -r * ~/.local/share/gnome-shell/extensions/proton-checker@carvdev.github.com/
    ```
    *(Note: Exclude the `po` folder and `.git` files if you want a cleaner install, but copying everything works for testing).*

3.  Log out and log back in (on Wayland) or press `Alt+F2`, type `r`, and hit Enter (on X11).

4.  Enable the extension using **Extensions** app or terminal:
    ```bash
    gnome-extensions enable proton-checker@carvdev.github.com
    ```

## Development & Translations

### Directory Structure
* `extension.js`: Main logic.
* `stylesheet.css`: Styling for the popup menu.
* `locale/`: Compiled translation files (`.mo`).
* `po/`: Source translation files (`.po` and `.pot`).

### Updating Translations

If you want to help translate this extension to your language, follow these steps.

**Prerequisites:** Ensure you have the `gettext` package installed on your system (it provides `msgfmt`, `msgmerge`, and `xgettext`).

**Note:** Replace `LANG_CODE` with your locale code (e.g., `pt_BR`, `de`, `fr`, `es`).

1.  **Generate the template:**
    Run this command to extract the latest strings from the source code:
    ```bash
    xgettext --from-code=UTF-8 --output=po/proton-checker@carvdev.github.com.pot extension.js
    ```

2.  **Update or Create language file:**
    
    * **To create a NEW translation:**
        ```bash
        msginit --input=po/proton-checker@carvdev.github.com.pot --output=po/LANG_CODE.po --locale=LANG_CODE
        ```
    
    * **To UPDATE an existing translation:**
        ```bash
        msgmerge -U po/LANG_CODE.po po/proton-checker@carvdev.github.com.pot
        ```

3.  **Compile to binary (.mo):**
    For the extension to load the translations, compile the `.po` file:
    ```bash
    mkdir -p locale/LANG_CODE/LC_MESSAGES/
    msgfmt po/LANG_CODE.po -o locale/LANG_CODE/LC_MESSAGES/proton-checker@carvdev.github.com.mo
    ```

## License

This project is licensed under the **GNU General Public License v3.0**. See the [LICENSE](LICENSE) file for details.

## Credits

* Data provided by [ProtonDB](https://www.protondb.com/) and [Steam](https://store.steampowered.com/).
* This extension is not affiliated with Valve or ProtonDB.