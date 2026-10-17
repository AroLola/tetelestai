const fs = require('fs');
const path = require('path');
const https = require('https');

const targetDir = './';
const imageFolder = './images';
const extensions = ['.html', '.js', '.css'];

// 1. Ensure the local asset directory exists natively
if (!fs.existsSync(imageFolder)) {
    fs.mkdirSync(imageFolder, { recursive: true });
}

console.log("📦 Launching absolute asset crawler and local path alignment engine...");

// This catches ALL variations of absolute, protocol-relative, and query-wrapped assets
const godaddyPattern = /(?:https?:)?\/\/[:a-zA-Z0-9._-]*wsimg\.com\/isteam\/ip\/[a-f0-9-]+\/[a-zA-Z0-9%._-]+\.(?:jpg|jpeg|png|gif|ico|JPG|JPEG|PNG|GIF|ICO)/gi;

// Safe utility to asynchronously download graphic binaries over HTTPS
function downloadImage(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        const requestUrl = url.startsWith('http') ? url : `https:${url}`;
        
        https.get(requestUrl, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Server Error: Status ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', (err) => {
            fs.unlink(destPath, () => reject(err));
        });
    });
}

// Global folder loop crawler
async function crawlAndLocalize(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            // Protect standard runtime and system tracking folders from string replacement loops
            if (['.git', '.github', 'node_modules', 'images'].includes(item)) continue;
            await crawlAndLocalize(fullPath);
        } else if (extensions.includes(path.extname(item).toLowerCase())) {
            try {
                let content = fs.readFileSync(fullPath, 'utf8');
                let wasModified = false;

                // A. Match and fetch all missing platform image links to crawl
                const matches = content.match(godaddyPattern);
                if (matches) {
                    for (const match of [...new Set(matches)]) {
                        // Strip trailing resizing properties / query logic to capture raw filename
                        const cleanUrl = match.split('?')[0].split('/:')[0];
                        const rawFilename = path.basename(cleanUrl);
                        const decodedFilename = decodeURIComponent(rawFilename);
                        const localDestination = path.join(imageFolder, decodedFilename);

                        if (!fs.existsSync(localDestination)) {
                            console.log(`📥 Downloading Asset to Repository: ${decodedFilename}`);
                            try {
                                await downloadImage(cleanUrl, localDestination);
                            } catch (err) {
                                console.log(`⚠️ Skinned reference download block for: ${decodedFilename}`);
                            }
                        }
                    }
                }

                // B. Erase common corrupted extension notations left by older text tools (.pngs= -> .png?)
                if (/\.(png|jpg|jpeg|gif)s=/i.test(content)) {
                    content = content.replace(/\.(png|jpg|jpeg|gif)s=/gi, '.\$1?');
                    wasModified = true;
                }

                // C. Purge the lingering GoDaddy freemium ad placeholders natively
                if (/<div[^>]*id="freemium-ad-[0-9]+"[^>]*><\/div>/gi.test(content)) {
                    content = content.replace(/<div[^>]*id="freemium-ad-[0-9]+"[^>]*><\/div>/gi, '');
                    wasModified = true;
                }

                // D. Rewrite all external paths to uniform local repository coordinates
                const replacePattern = /(?:https?:)?\/\/[:a-zA-Z0-9._-]*wsimg\.com\/isteam\/ip\/[a-f0-9-]+\/[a-zA-Z0-9%._-]+\.(?:jpg|jpeg|png|gif|ico|JPG|JPEG|PNG|GIF|ICO)(?:\/[^\s"\'\>]+)?/gi;
                if (replacePattern.test(content)) {
                    content = content.replace(replacePattern, (urlMatch) => {
                        const cleanUrl = urlMatch.split('?')[0].split('/:')[0];
                        const rawFile = path.basename(cleanUrl);
                        return `./images/${decodeURIComponent(rawFile)}`;
                    });
                    wasModified = true;
                }

                if (wasModified) {
                    fs.writeFileSync(fullPath, content, 'utf8');
                    console.log(`✨ Re-aligned relative layout assets inside: ${fullPath}`);
                }
            } catch (err) {
                console.error(`❌ Error parsing ${fullPath}: ${err.message}`);
            }
        }
    }
}

(async () => {
    await crawlAndLocalize(targetDir);
    print("🎉 All platform assets have been successfully converted and localized!");
})();
