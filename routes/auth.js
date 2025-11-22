const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const db = require('../database/db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET mangler i miljøvariabler (.env)');
}

// Middleware til auth
function authMiddleware(req, res, next) {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'Ingen token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Ugyldig eller udløbet token' });
    }
}

// Registrer
router.post('/register', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email og password er påkrævet' });
    }
    db.get('SELECT id FROM brugere WHERE email = ?', [email], (err, row) => {
        if (err) return res.status(500).json({ error: 'Server fejl' });
        if (row) return res.status(409).json({ error: 'Email er allerede registreret' });
        const passwordHash = bcrypt.hashSync(password, 10);
        db.run('INSERT INTO brugere (email, password_hash) VALUES (?, ?)', [email, passwordHash], function(err2) {
            if (err2) return res.status(500).json({ error: 'Kunne ikke oprette bruger' });
            const userId = this.lastID;
            const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '2h' });
            res.cookie('auth_token', token, {
                httpOnly: true,
                sameSite: 'strict',
                secure: false,
                maxAge: 2 * 60 * 60 * 1000
            });
            res.json({ success: true, email });
        });
    });
});

// Login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email og password er påkrævet' });
    db.get('SELECT id, password_hash FROM brugere WHERE email = ?', [email], (err, row) => {
        if (err) return res.status(500).json({ error: 'Server fejl' });
        if (!row) return res.status(401).json({ error: 'Forkert email eller password' });
        const match = bcrypt.compareSync(password, row.password_hash);
        if (!match) return res.status(401).json({ error: 'Forkert email eller password' });
        const token = jwt.sign({ userId: row.id, email }, JWT_SECRET, { expiresIn: '2h' });
        res.cookie('auth_token', token, {
            httpOnly: true,
            sameSite: 'strict',
            secure: false,
            maxAge: 2 * 60 * 60 * 1000
        });
        res.json({ success: true, email });
    });
});

router.get('/me', authMiddleware, (req, res) => {
    res.json({ userId: req.user.userId, email: req.user.email });
});

router.post('/logout', (req, res) => {
    res.cookie('auth_token', '', { httpOnly: true, sameSite: 'strict', secure: false, maxAge: 0 });
    res.json({ success: true });
});

module.exports = { router, authMiddleware };
