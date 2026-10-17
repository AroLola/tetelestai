 const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

// --- CONFIGURATION ---
const TARGET_SITE = 'https://tetelestai.services'; // Your live site URL
const IMAGE_OUTPUT_DIR = './images';              // Local repo directory
// ---------------------

// Ensure local image directory exists natively
if (!fs.existsSync(IMAGE_OUTPUT_DIR)) {
    fs.mkdirSync(IMAGE_OUTPUT_DIR, { recursive: true });
}

// Safe utility to asynchronously download graphic binaries
async function downloadImage(url, filepath) {
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(filepath);
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        console.error(`❌ Failed to fetch binary for: ${url} (${error.message})`);
        return false;
    }
}

async function startScrape() {
    try {
        console.log(`🌐 Fetching live layouts from: ${TARGET_SITE}...`);
        const response = await axios.get(TARGET_SITE, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        // Load HTML layout structure into Cheerio DOM tree parser
        const \$ = cheerio.load(response.data);
        const imageUrls = new Set();

        // 1. Gather all basic structural img tags
        \$('img').each((i, el) => {
            const src = (el).attr('src') || (el).attr('data-src');
            if (src) imageUrls.add(src);
        });

        // 2. Gather background imagery variations, icons, and slider assets
        \$('[style*="background"]').each((i, el) => {
            const style = \$(el).attr('style');
            const match = style.match(/url\(['"]?([^'"]+)['"]?\)/i);
            if (match && match[1]) imageUrls.add(match[1]);
        });

        console.log(`📦 Found ${imageUrls.size} layout assets to convert.`);

        for (let imgUrl of imageUrls) {
            // FIX: Trim query resizing variables safely
            let cleanUrl = imgUrl.trim().split('?')[0].split('/:')[0];

            // Resolve protocol relative paths (e.g., //wsimg.com -> https://wsimg.com)
            if (cleanUrl.startsWith('//')) {
                cleanUrl = `https:${cleanUrl}`;
            } else if (cleanUrl.startsWith('/')) {
                cleanUrl = `${TARGET_SITE}${cleanUrl}`;
            }

            try {
                const urlObj = new URL(cleanUrl);
                const rawFilename = path.basename(urlObj.pathname);
                
                // Skip tracking tags or empty text file fragments
                if (!rawFilename || !rawFilename.includes('.')) continue;

                const decodedFilename = decodeURIComponent(rawFilename);
                const localDestination = path.join(IMAGE_OUTPUT_DIR, decodedFilename);

                console.log(`📥 Localizing: ${decodedFilename}`);
                await downloadImage(cleanUrl, localDestination);
            } catch (urlError) {
                console.error(`⚠️ Could not parse URL asset: ${cleanUrl}`);
            }
        }

        console.log('\n🎉 Asset extraction loop finished successfully! Check your ./images folder.');
    } catch (err) {
        console.error(`💥 Critical failure parsing site core: ${err.message}`);
    }
}

startScrape();
