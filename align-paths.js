const fs = require('fs');
const path = require('path');

const targetDir = './';
const imageFolder = './images';
const targetExtensions = ['.html', '.css', '.js'];

const absoluteImageFolder = path.resolve(imageFolder);

console.log("📦 Launching local path layout alignment engine...");

// Precision lookup regex that catches any wsimg URLs inside src, href, or srcset blocks
const godaddyPattern = /(?:https?:)?\/\/[:a-zA-Z0-9._-]*wsimg\.com\/isteam\/ip\/[^\s"\'\>,\)]+/gi;

async function crawlAndLocalize(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            if (['.git', '.github', 'node_modules', 'images'].includes(item)) continue;
            await crawlAndLocalize(fullPath);
        } else {
            const fileExt = path.extname(fullPath).toLowerCase();
            if (targetExtensions.includes(fileExt)) {
                try {
                    let content = fs.readFileSync(fullPath, 'utf8');
                    let wasModified = false;

                    if (godaddyPattern.test(content)) {
                        // Calculate the precise relative depth path (handles nested folder assets natively)
                        const currentFileDir = path.dirname(path.resolve(fullPath));
                        let relativeImagesPath = path.relative(currentFileDir, absoluteImageFolder).replace(/\\/g, '/');
                        
                        if (!relativeImagesPath.startsWith('.')) {
                            relativeImagesPath = './' + relativeImagesPath;
                        }

                        // Rewrite the code inside the file string buffer
                        content = content.replace(godaddyPattern, (urlMatch) => {
                            const fullRawUrl = urlMatch.trim();
                            // Safely extract the original core filename structure
                            const cleanUrlSegment = fullRawUrl.split(':/')[0].split('?')[0];
                            const rawFile = path.basename(cleanUrlSegment);
                            const cleanFilename = decodeURIComponent(rawFile).replace(/[^a-zA-Z0-9.-]/g, '_');
                            
                            return `${relativeImagesPath}/${cleanFilename}`;
                        });
                        wasModified = true;
                    }

                    if (wasModified) {
                        fs.writeFileSync(fullPath, content, 'utf8');
                        console.log(`✨ Re-aligned local paths inside: ${fullPath}`);
                    }
                } catch (err) {
                    console.error(`❌ Error aligning file ${fullPath}: ${err.message}`);
                }
            }
        }
    }
}

(async () => {
    await crawlAndLocalize(targetDir);
    console.log("🎉 All local source files have been structuralized with local path markers!");
})();
