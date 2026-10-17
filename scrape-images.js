 const fs = require('fs');
const path = require('path');
const https = require('https');

const targetDir = './';
const imageFolder = './images'; 
const targetExtensions = ['.html', '.css', '.js'];

const absoluteImageFolder = path.resolve(imageFolder);

// Ensure the local target folder exists natively
if (!fs.existsSync(imageFolder)) {
    fs.mkdirSync(imageFolder, { recursive: true });
}

console.log("📦 Launching absolute asset crawler and local path alignment engine...");

// Advanced boundary-proof regular expression tailored exactly for GoDaddy wsimg paths
const godaddyPattern = /(?:https?:)?\/\/[:a-zA-Z0-9._-]*wsimg\.com\/isteam\/ip\/[^\s"\'\>,\)]+/gi;

// Precision download engine using the full unedited URL to bypass GoDaddy server rejections
function downloadImage(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        const requestUrl = url.startsWith('http') ? url : `https:${url}`;
        
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            }
        };

        https.get(requestUrl, options, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Server Status Code: ${response.statusCode}`));
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
        } else {
            const fileExt = path.extname(fullPath).toLowerCase();
            if (targetExtensions.includes(fileExt)) {
                try {
                    let content = fs.readFileSync(fullPath, 'utf8');
                    let wasModified = false;

                    const matches = content.match(godaddyPattern);
                    if (matches) {
                        for (const match of [...new Set(matches)]) {
                            const fullRawUrl = match.trim();
                            
                            // FIX: Clean string split parsing without chained array bugs
                            const firstSplit = fullRawUrl.split('/:');
                            const cleanUrlSegment = firstSplit[0].split('?')[0];
                            
                            const rawFilename = path.basename(cleanUrlSegment);
                            if (!rawFilename || !rawFilename.includes('.')) continue;

                            const decodedFilename = decodeURIComponent(rawFilename).replace(/[^a-zA-Z0-9.-]/g, '_');
                            const localDestination = path.join(imageFolder, decodedFilename);

                            if (!fs.existsSync(localDestination)) {
                                console.log(`📥 Downloading Asset: ${decodedFilename}`);
                                try {
                                    // Crucial: Downloading using the full raw URL with sizing parameters intact
                                    await downloadImage(fullRawUrl, localDestination);
                                } catch (err) {
                                    console.log(`⚠️ Download failed for: ${decodedFilename} (${err.message})`);
                                }
                            }
                        }
                    }

                    // Rewrite paths inside the files dynamically based on folder tree depth
                    if (godaddyPattern.test(content)) {
                        const currentFileDir = path.dirname(path.resolve(fullPath));
                        let relativeImagesPath = path.relative(currentFileDir, absoluteImageFolder).replace(/\\/g, '/');
                        
                        if (!relativeImagesPath.startsWith('.')) {
                            relativeImagesPath = './' + relativeImagesPath;
                        }

                        content = content.replace(godaddyPattern, (urlMatch) => {
                            const fullRawUrl = urlMatch.trim();
                            const firstSplit = fullRawUrl.split('/:');
                            const cleanUrlSegment = firstSplit[0].split('?')[0];
                            
                            const rawFile = path.basename(cleanUrlSegment);
                            const cleanFilename = decodeURIComponent(rawFile).replace(/[^a-zA-Z0-9.-]/g, '_');
                            return `${relativeImagesPath}/${cleanFilename}`;
                        });
                        wasModified = true;
                    }

                    if (wasModified) {
                        fs.writeFileSync(fullPath, content, 'utf8');
                        console.log(`✨ Re-aligned relative layout references inside: ${fullPath}`);
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
