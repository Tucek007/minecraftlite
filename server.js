/**
 * server.js - Zero-dependency static HTTP server for Minecraft Lite.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = process.env.PORT || 8080;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg'
};

function serveFile(req, res) {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') {
        reqPath = '/index.html';
    }

    const normalizedRoot = path.resolve(ROOT_DIR);
    const filePath = path.resolve(normalizedRoot, '.' + reqPath);

    // Prevent directory traversal
    if (filePath !== normalizedRoot && !filePath.startsWith(normalizedRoot + path.sep)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found: ' + reqPath);
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stats.size,
            'Cache-Control': 'no-cache'
        });

        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
    });
}

function startServer(port) {
    const server = http.createServer(serveFile);

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`Port ${port} in use, trying port ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Server error:', err);
        }
    });

    server.listen(port, () => {
        console.log(`\n==================================================`);
        console.log(`  Minecraft Lite Server running at:`);
        console.log(`  http://localhost:${port}/`);
        console.log(`==================================================\n`);
    });
}

if (require.main === module) {
    startServer(parseInt(DEFAULT_PORT, 10));
}

module.exports = { startServer, MIME_TYPES };
