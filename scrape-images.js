 const fs = require('fs');
const path = require('path');
const https = require('https');

const targetDir = './';
const imageFolder = './images';
const extensions = ['.html', '.css']; // Safe file scope to avoid breaking JS navigation scripts

const absoluteImageFolder = path.resolve(imageFolder);

// Ensure the local asset directory exists natively
if (!fs.existsSync(imageFolder)) {
    fs.mkdirSync(imageFolder, { recursive: true });
}

console.log("📦 Launching custom GoDaddy path alignment engine...");

// Tailored Regex matching your exact wsimg.com link structures (capturing the sizing rules as well)
const godaddyPattern = /(?:https?:)?\/\/[:a-zA-Z0-9._-]*wsimg\.com\/isteam\/ip\/[^\s"\'\>]+?\.(?:jpg|jpeg|png|gif|ico|JPG|JPEG|PNG|GIF|ICO)(?:\/:\/[^\s"\'\>]+)?/gi;

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

async function crawlAndLocalize(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            if (['.git', '.github', 'node_modules', 'images'].includes(item)) continue;
            await crawlAndLocalize(fullPath);
        } else if (extensions.includes(path.extname(item).toLowerCase())) {
            try {
                let content = fs.readFileSync(fullPath, 'utf8');
                let wasModified = false;

                const matches = content.match(godaddyPattern);
                if (matches) {
                    for (const match of [...new Set(matches)]) {
                        // Strips down "/:/rs=..." layout parameters safely
                        let cleanUrl = match.split('/:')[0].split('?')[0];
                        
                        const rawFilename = path.basename(cleanUrl);
                        const decodedFilename = decodeURIComponent(rawFilename);
                        const localDestination = path.join(imageFolder, decodedFilename);

                        if (!fs.existsSync(localDestination)) {
                            console.log(`📥 Downloading Asset: ${decodedFilename}`);
                            try {
                                await downloadImage(cleanUrl, localDestination);
                            } catch (err) {
                                console.log(`⚠️ Download blocked for: ${decodedFilename}`);
                            }
                        }
                    }
                }

                // Rewrite the external paths inside your file layout 
                if (godaddyPattern.test(content)) {
                    const currentFileDir = path.dirname(path.resolve(fullPath));
                    let relativeImagesPath = path.relative(currentFileDir, absoluteImageFolder).replace(/\\/g, '/');
                    
                    if (!relativeImagesPath.startsWith('.')) {
                        relativeImagesPath = './' + relativeImagesPath;
                    }

                    content = content.replace(godaddyPattern, (urlMatch) => {
                        let cleanUrl = urlMatch.split('/:')[0].split('?')[0];
                        const rawFile = path.basename(cleanUrl);
                        return `${relativeImagesPath}/${decodeURIComponent(rawFile)}`;
                    });
                    wasModified = true;
                }

                if (wasModified) {
                    fs.writeFileSync(fullPath, content, 'utf8');
                    console.log(`✨ Re-aligned relative layouts inside: ${fullPath}`);
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
