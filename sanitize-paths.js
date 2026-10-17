const fs = require('fs');
const path = require('path');

const targetDir = './';
const targetExtensions = ['.html', '.css'];

console.log("🧹 Launching GoDaddy leftover path parameter cleanup engine...");

// This catches any local image paths that have trailing commas and garbage parameters attached
const brokenPathPattern = /(\.\/images\/[a-zA-Z0-9._-]+?\.(?:png|jpg|jpeg|gif|ico|JPG|JPEG|PNG|GIF|ICO))([^\s"\'\>]+)/gi;

async function cleanProjectPaths(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            if (['.git', '.github', 'node_modules', 'images'].includes(item)) continue;
            await cleanProjectPaths(fullPath);
        } else {
            const fileExt = path.extname(fullPath).toLowerCase();
            if (targetExtensions.includes(fileExt)) {
                try {
                    let content = fs.readFileSync(fullPath, 'utf8');
                    
                    if (brokenPathPattern.test(content)) {
                        // Strip out all trailing parameters appended after the file extension
                        content = content.replace(brokenPathPattern, (match, cleanLocalPath) => {
                            return cleanLocalPath;
                        });
                        
                        fs.writeFileSync(fullPath, content, 'utf8');
                        console.log(`✨ Sanitized trailing parameters inside: ${fullPath}`);
                    }
                } catch (err) {
                    console.error(`❌ Error parsing file ${fullPath}: ${err.message}`);
                }
            }
        }
    }
}

(async () => {
    await cleanProjectPaths(targetDir);
    console.log("🎉 All trailing parameter garbage has been successfully purged!");
})();
