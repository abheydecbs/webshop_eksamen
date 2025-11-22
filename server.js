require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const app = express();
const PORT = Number(process.env.PORT) || 3000; // HTTP (redirect) eller fallback
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 3443;
const USE_HTTPS = process.env.USE_HTTPS === 'true';

// Routers
const { router: authRouter } = require('./routes/auth');
const produkterRouter = require('./routes/produkter');
const ordreRouter = require('./routes/ordre');
const kurvRouter = require('./routes/kurv');

// Security Middleware
app.disable('x-powered-by');
app.use(cors({
    origin: USE_HTTPS ? `https://localhost:${HTTPS_PORT}` : `http://localhost:${PORT}`,
    credentials: true
}));
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'"],
            connectSrc: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));
if (USE_HTTPS) {
    // HSTS kun når vi kører HTTPS
    app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: false }));
}

app.use(express.json({ limit: '50kb' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// Mount routes
app.use('/api/auth', authRouter);
app.use('/api/produkter', produkterRouter);
app.use('/api/ordre', ordreRouter);
app.use('/api/kurv', kurvRouter);

function startServers() {
    if (USE_HTTPS) {
        const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, 'cert', 'localhost-key.pem');
        const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, 'cert', 'localhost-cert.pem');
        let creds;
        try {
            creds = { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
        } catch (e) {
            console.error('Kunne ikke læse SSL cert/key, falder tilbage til kun HTTP:', e.message);
        }
        if (creds) {
            https.createServer(creds, app).listen(HTTPS_PORT, () => {
                console.log(`HTTPS server kører på https://localhost:${HTTPS_PORT}`);
                console.log('Ordre kan ses på https://localhost:' + HTTPS_PORT + '/ordre.html');
                console.log('Bemærk: Selv-signeret cert skal accepteres i browseren.');
            });
            // HTTP redirect
            http.createServer((req, res) => {
                const location = `https://localhost:${HTTPS_PORT}${req.url}`;
                res.writeHead(301, { Location: location });
                res.end();
            }).listen(PORT, () => {
                console.log(`HTTP redirect server på http://localhost:${PORT} -> HTTPS`);
            });
            return;
        }
    }
    // Normal HTTP fallback
    app.listen(PORT, () => {
        console.log(`HTTP server kører på http://localhost:${PORT}`);
    });
}

startServers();
