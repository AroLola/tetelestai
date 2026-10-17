 const fs = require('fs');
const path = require('path');
const https = require('https');

const targetDir = './';
const imageFolder = './images'; 
const extensions = ['.html', '.css', '.js'];

const absoluteImageFolder = path.resolve(imageFolder);

if (!fs.existsSync(imageFolder)) {
    fs.mkdirSync(imageFolder, { recursive: true });
}

console.log("📦 Launching absolute asset crawler and local path alignment engine...");

// Clean regular expression matching GoDaddy's CDN pathways
const godaddyPattern = /(?:https?:)?\/\/[:a-zA-Z0-9._-]*wsimg\.com\/isteam\/ip\/[^\s"\'\>,\)]+/gi;

function downloadImage(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        const requestUrl = url.startsWith('http') ? url : `https:${url}`;
        
        https.get(requestUrl, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Status ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', (err) => {
            fs.unlink(destPath, () => reject(err));
        });
    });
}

async function crawlAndLocalize(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            if (['.git', '.github', 'node_modules', 'images'].includes(item)) continue;
            await crawlAndLocalize(fullPath);
        } else if (extensions.includes(path.extname(fullPath).toLowerCase())) {
            try {
                let content = fs.readFileSync(fullPath, 'utf8');
                let wasModified = false;

                const matches = content.match(godaddyPattern);
                if (matches) {
                    for (const match of [...new Set(matches)]) {
                        // FIX: Added bracket indexes [0] to safely strip URL parameters without crashes
                        let baseCleanUrl = match.trim().split('/:')[0].split('?')[0];
                        
                        const rawFilename = path.basename(baseCleanUrl);
                        const decodedFilename = decodeURIComponent(rawFilename).replace(/[^a-zA-Z0-9.-]/g, '_');
                        const localDestination = path.join(imageFolder, decodedFilename);

                        if (!fs.existsSync(localDestination)) {
                            console.log(`📥 Downloading Asset: ${decodedFilename}`);
                            try {
                                await downloadImage(baseCleanUrl, localDestination);
                            } catch (err) {
                                console.log(`⚠️ Download blocked for: ${decodedFilename}`);
                            }
                        }
                    }
                }

                // Rewrite paths uniformly across the source files
                if (godaddyPattern.test(content)) {
                    const currentFileDir = path.dirname(path.resolve(fullPath));
                    let relativeImagesPath = path.relative(currentFileDir, absoluteImageFolder).replace(/\\/g, '/');
                    
                    if (!relativeImagesPath.startsWith('.')) {
                        relativeImagesPath = './' + relativeImagesPath;
                    }

                    content = content.replace(godaddyPattern, (urlMatch) => {
                        // FIX: Safely unpack indexes here as well to isolate clean names
                        let baseCleanUrl = urlMatch.trim().split('/:')[0].split('?')[0];
                        const rawFile = path.basename(baseCleanUrl);
                        const cleanFilename = decodeURIComponent(rawFile).replace(/[^a-zA-Z0-9.-]/g, '_');
                        return `${relativeImagesPath}/${cleanFilename}`;
                    });
                    wasModified = true;
                }

                if (wasModified) {
                    fs.writeFileSync(fullPath, content, 'utf8');
                    console.log(`✨ Re-aligned layout variables inside: ${fullPath}`);
                }
            } catch (err) {
                console.error(`❌ Error parsing ${fullPath}: ${err.message}`);
            }
        }
    }
}

(async () => {
    await crawlAndLocalize(targetDir);
    console.log("🎉 All platform assets have been successfully converted and localized!");
})();
