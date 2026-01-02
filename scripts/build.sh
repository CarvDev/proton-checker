#!/bin/bash

DOMAIN="proton-checker@carvdev.github.com"
UUID="proton-checker@carvdev.github.com"

echo "Starting extension packaging..."

# 1. Update translation templates
echo "  Updating translation files..."
./scripts/manage-translations.sh > /dev/null 2>&1

# 2. COMPILE translations
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

# 3. Create the ZIP file (excluding development files)
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