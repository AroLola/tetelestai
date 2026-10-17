#!/bin/bash
echo "🛡️ Initiating surgical system recovery loop..."

# Process all static layout pages to strip ONLY crashing tracking loops
find . -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" \) | while read -r file; do
    if grep -qE "bs-genericMap|dataLayer" "$file"; then
        echo "⚡ Safe Cleaning: $file"
        
        # Strip out the exact map scripts crashing your viewport execution
        sed -i -E 's|<script[^>]*src="[^"]*bs-genericMap[^"]*"[^>]*></script>||gi' "$file"
        
        # Purge the tracking layer scripts that are freezing the container layouts
        sed -i -E 's|<script[^>]*>window\.dataLayer[[:space:]]*=.*?</script>||gi' "$file"
    fi
done

echo "🎉 Layout stabilization sweep complete!"
