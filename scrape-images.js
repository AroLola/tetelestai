 const fs = require('fs');
const path = require('path');
const https = require('https');

const targetDir = './';
const imageFolder = './images'; 
const extensions = ['.html', '.css', '.js'];

const absoluteImageFolder = path.resolve(imageFolder);

// Ensure the local asset directory exists natively
if (!fs.existsSync(imageFolder)) {
    fs.mkdirSync(imageFolder, { recursive: true });
}

console.log("📦 Launching absolute asset crawler and local path alignment engine...");

// FIX: Custom lookahead regex that captures commas inside the URL but stops at structural boundaries (spaces, quotes, or separating commas)
const godaddyPattern = /(?:https?:)?\/\/[:a-zA-Z0-9._-]*wsimg\.com\/isteam\/ip\/.*?(?=\s|["\'\>]|,(?:\s|\$))/gi;

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
                        // Safely split step-by-step to isolate the true file path segment
                        const urlStrippedOfParams = match.trim().split('/:')[0].split('?')[0];
                        const rawFilename = path.basename(urlStrippedOfParams);
                        const decodedFilename = decodeURIComponent(rawFilename).replace(/[^a-zA-Z0-9.-]/g, '_');
                        const localDestination = path.join(imageFolder, decodedFilename);

                        if (!fs.existsSync(localDestination)) {
                            console.log(`📥 Downloading Asset: ${decodedFilename}`);
                            try {
                                await downloadImage(match.trim(), localDestination);
                            } catch (err) {
                                console.log(`⚠️ Download blocked for: ${decodedFilename} (${err.message})`);
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
                        const urlStrippedOfParams = urlMatch.trim().split('/:')[0].split('?')[0];
                        const rawFile = path.basename(urlStrippedOfParams);
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
