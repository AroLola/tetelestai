 const fs = require('fs');
const path = require('path');
const https = require('https');

const targetDir = './';
const imageFolder = './images'; 
const targetExtensions = ['.html', '.css', '.js'];

const absoluteImageFolder = path.resolve(imageFolder);

// 1. Ensure the central repository asset folder exists natively
if (!fs.existsSync(imageFolder)) {
    fs.mkdirSync(imageFolder, { recursive: true });
}

console.log("📦 Launching absolute asset crawler and local path alignment engine...");

// Advanced boundary lookahead regular expression built for GoDaddy image server string arrays
const godaddyPattern = /(?:https?:)?\/\/[:a-zA-Z0-9._-]*wsimg\.com\/isteam\/ip\/.*?(?=\s|["\'\>]|,(?:\s|\$))/gi;

function downloadImage(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        const requestUrl = url.startsWith('http') ? url : `https:${url}`;
        
        https.get(requestUrl, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Server Status: ${response.statusCode}`));
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
            // Ignore system or asset output targets to prevent recursive loops
            if (['.git', '.github', 'node_modules', 'images'].includes(item)) continue;
            await crawlAndLocalize(fullPath);
        } else {
            const fileExt = path.extname(fullPath).toLowerCase();
            if (targetExtensions.includes(fileExt)) {
                try {
                    let content = fs.readFileSync(fullPath, 'utf8');
                    let wasModified = false;

                    const matches = content.match(godaddyPattern);
                    if (matches) {
                        for (const match of [...new Set(matches)]) {
                            // Extract root asset fragment by separating structural formatting parameters
                            const urlCleanParts = match.trim().split('/:')[0].split('?')[0];
                            const rawFilename = path.basename(urlCleanParts);
                            
                            if (!rawFilename || !rawFilename.includes('.')) continue;

                            const decodedFilename = decodeURIComponent(rawFilename).replace(/[^a-zA-Z0-9.-]/g, '_');
                            const localDestination = path.join(imageFolder, decodedFilename);

                            if (!fs.existsSync(localDestination)) {
                                console.log(`📥 Downloading Asset to Repo: ${decodedFilename}`);
                                try {
                                    await downloadImage(match.trim(), localDestination);
                                } catch (err) {
                                    console.log(`⚠️ Download skipped for: ${decodedFilename}`);
                                }
                            }
                        }
                    }

                    // Rewrite paths inside the active tracking file
                    if (godaddyPattern.test(content)) {
                        const currentFileDir = path.dirname(path.resolve(fullPath));
                        let relativeImagesPath = path.relative(currentFileDir, absoluteImageFolder).replace(/\\/g, '/');
                        
                        if (!relativeImagesPath.startsWith('.')) {
                            relativeImagesPath = './' + relativeImagesPath;
                        }

                        content = content.replace(godaddyPattern, (urlMatch) => {
                            const urlCleanParts = urlMatch.trim().split('/:')[0].split('?')[0];
                            const rawFile = path.basename(urlCleanParts);
                            const cleanFilename = decodeURIComponent(rawFile).replace(/[^a-zA-Z0-9.-]/g, '_');
                            return `${relativeImagesPath}/${cleanFilename}`;
                        });
                        wasModified = true;
                    }

                    if (wasModified) {
                        fs.writeFileSync(fullPath, content, 'utf8');
                        console.log(`✨ Re-aligned relative references inside: ${fullPath}`);
                    }
                } catch (err) {
                    console.error(`❌ Error parsing file ${fullPath}: ${err.message}`);
                }
            }
        }
    }
}

(async () => {
    await crawlAndLocalize(targetDir);
    console.log("🎉 All platform assets have been successfully converted and localized!");
})();
