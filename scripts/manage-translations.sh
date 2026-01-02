#!/bin/bash

# Configuration
DOMAIN="proton-checker@carvdev.github.com"
POT_FILE="po/$DOMAIN.pot"

# 1. Regenerate template (.pot)
echo "Extracting strings from source code..."
xgettext --from-code=UTF-8 --output="$POT_FILE" extension.js

# 2. Fix charset to UTF-8 (prevents msgfmt error)
sed -i 's/charset=CHARSET/charset=UTF-8/g' "$POT_FILE"

echo "  Template updated: $POT_FILE"

# Function to update or create a PO file
update_po() {
    LANG_CODE=$1
    PO_FILE="po/$LANG_CODE.po"

    if [ -f "$PO_FILE" ]; then
        echo "  Updating existing translation: $LANG_CODE"
        msgmerge --quiet --update --backup=none "$PO_FILE" "$POT_FILE"
    else
        echo "  Creating new translation: $LANG_CODE"
        msginit --no-translator --input="$POT_FILE" --output="$PO_FILE" --locale="$LANG_CODE"
    fi
}

# 3. Main Logic
if [ -n "$1" ]; then
    # If user provided an argument (e.g., ./script.sh es), process only that language
    update_po "$1"
else
    # If no arguments provided, update all existing .po files
    echo "  Updating all found .po files..."
    count=0
    for file in po/*.po; do
        if [ -f "$file" ]; then
            # Extract filename without extension (e.g., po/pt_BR.po -> pt_BR)
            lang=$(basename "$file" .po)
            update_po "$lang"
            ((count++))
        fi
    done
    
    if [ $count -eq 0 ]; then
        echo "No .po files found to update."
        echo "To create a new one, run: ./scripts/manage-translations.sh <LANG_CODE>"
    fi
fi

echo "Done!"