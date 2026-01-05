#!/bin/bash

DOMAIN="proton-checker@carvdev.github.com"
UUID="proton-checker@carvdev.github.com"

echo "Starting extension packaging..."

# 1. Update translation templates
echo "  Updating translation files..."
./scripts/manage-translations.sh > /dev/null 2>&1

# 2. Compile translations
echo "  Compiling translations to .mo..."

for po_file in po/*.po; do
    if [ -f "$po_file" ]; then
        # Extract language code (e.g., po/pt_BR.po -> pt_BR)
        lang=$(basename "$po_file" .po)
        
        # Create the target directory structure required by GNOME
        target_dir="locale/$lang/LC_MESSAGES"
        mkdir -p "$target_dir"
        
        # Compile the file
        # Output must be: locale/LANG/LC_MESSAGES/UUID.mo
        msgfmt "$po_file" -o "$target_dir/$DOMAIN.mo"
        
        echo "   - Compiled: $lang"
    fi
done

# 3. Generate fallbacks (if there's no universal translation for a language, use a regional one)
for locale_folder in locale/*; do
    if [ -d "$locale_folder" ]; then
        
        # Create the target directory, removing the characters from "_" to the end of the string 
        target_folder="${locale_folder%_*}"

        # Verify if the destination is diferent from the origin AND if it doesn't exist
        if [ "$target_folder" != "$locale_folder" ] && [ ! -d "$target_folder" ]; then
            echo "  Generating fallback: $target_folder (copy of $locale_folder)"
            cp -r "$locale_folder" "$target_folder"
        fi
    fi
done

# 4. Create the ZIP file (excluding development files)
ZIP_NAME="proton-checker.zip"
rm -f $ZIP_NAME

echo "  Creating file $ZIP_NAME..."

zip -r $ZIP_NAME \
    extension.js \
    metadata.json \
    stylesheet.css \
    locale/ \
    -x "*.po" \
    -x "*.pot" \
    -x "schemas/*.xml" \
    -x "scripts/*" \
    -x ".*"

echo "Package created successfully!"
echo "Locale folder content in zip:"
unzip -l $ZIP_NAME | grep ".mo"