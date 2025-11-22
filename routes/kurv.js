const express = require('express');
const db = require('../database/db');
const { authMiddleware } = require('./auth');

const router = express.Router();

// Hent kurv
router.get('/', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    db.get('SELECT id FROM kurv WHERE user_id = ?', [userId], (err, kurvRow) => {
        if (err) return res.status(500).json({ error: 'Fejl ved hentning af kurv' });
        if (!kurvRow) return res.json([]);
        db.all(
            `SELECT kl.produkt_id as id, kl.produkt_navn as navn, p.beskrivelse, p.kategori, p.maerke as mærke, kl.produkt_pris as pris, kl.antal
             FROM kurv_linjer kl
             JOIN kurv k ON kl.kurv_id = k.id
             JOIN produkter p ON p.id = kl.produkt_id
             WHERE k.user_id = ?`,
            [userId],
            (err2, rows) => {
                if (err2) return res.status(500).json({ error: 'Fejl ved hentning af kurv linjer' });
                res.json(rows);
            }
        );
    });
});

// Tilføj til kurv
router.post('/add', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const { produktId, antal } = req.body;
    if (!produktId || !antal || antal < 1) return res.status(400).json({ error: 'Ugyldige data' });
    db.get('SELECT id, navn, pris FROM produkter WHERE id = ?', [produktId], (err, produkt) => {
        if (err) return res.status(500).json({ error: 'Fejl ved produkt opslag' });
        if (!produkt) return res.status(404).json({ error: 'Produkt ikke fundet' });
        db.get('SELECT id FROM kurv WHERE user_id = ?', [userId], (err2, kurvRow) => {
            if (err2) return res.status(500).json({ error: 'Fejl ved kurv opslag' });
            const ensureKurv = (callback) => {
                if (kurvRow) return callback(kurvRow.id);
                db.run('INSERT INTO kurv (user_id) VALUES (?)', [userId], function(err3) {
                    if (err3) return res.status(500).json({ error: 'Kunne ikke oprette kurv' });
                    callback(this.lastID);
                });
            };
            ensureKurv((kurvId) => {
                db.get('SELECT id, antal FROM kurv_linjer WHERE kurv_id = ? AND produkt_id = ?', [kurvId, produktId], (err4, linje) => {
                    if (err4) return res.status(500).json({ error: 'Fejl ved linje opslag' });
                    const finish = () => {
                        db.all(
                            `SELECT kl.produkt_id as id, kl.produkt_navn as navn, p.beskrivelse, p.kategori, p.maerke as mærke, kl.produkt_pris as pris, kl.antal
                             FROM kurv_linjer kl
                             JOIN kurv k ON kl.kurv_id = k.id
                             JOIN produkter p ON p.id = kl.produkt_id
                             WHERE k.user_id = ?`,
                            [userId],
                            (err5, rows) => {
                                if (err5) return res.status(500).json({ error: 'Fejl ved hentning af kurv' });
                                res.json(rows);
                            }
                        );
                    };
                    if (linje) {
                        const nyAntal = linje.antal + antal;
                        db.run('UPDATE kurv_linjer SET antal = ? WHERE id = ?', [nyAntal, linje.id], (err6) => {
                            if (err6) return res.status(500).json({ error: 'Kunne ikke opdatere antal' });
                            finish();
                        });
                    } else {
                        db.run(
                            'INSERT INTO kurv_linjer (kurv_id, produkt_id, produkt_navn, produkt_pris, antal) VALUES (?, ?, ?, ?, ?)',
                            [kurvId, produktId, produkt.navn, produkt.pris, antal],
                            (err7) => {
                                if (err7) return res.status(500).json({ error: 'Kunne ikke indsætte linje' });
                                finish();
                            }
                        );
                    }
                });
            });
        });
    });
});

// Opdater antal
router.put('/item/:produktId', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const produktId = req.params.produktId;
    const { antal } = req.body;
    if (!antal || antal < 1) return res.status(400).json({ error: 'Ugyldigt antal' });
    db.get('SELECT id FROM kurv WHERE user_id = ?', [userId], (err, kurvRow) => {
        if (err) return res.status(500).json({ error: 'Fejl ved kurv' });
        if (!kurvRow) return res.status(404).json({ error: 'Kurv ikke fundet' });
        db.run('UPDATE kurv_linjer SET antal = ? WHERE kurv_id = ? AND produkt_id = ?', [antal, kurvRow.id, produktId], function(err2) {
            if (err2) return res.status(500).json({ error: 'Fejl ved opdatering' });
            if (this.changes === 0) return res.status(404).json({ error: 'Linje ikke fundet' });
            db.all(
                `SELECT kl.produkt_id as id, kl.produkt_navn as navn, p.beskrivelse, p.kategori, p.maerke as mærke, kl.produkt_pris as pris, kl.antal
                 FROM kurv_linjer kl
                 JOIN kurv k ON kl.kurv_id = k.id
                 JOIN produkter p ON p.id = kl.produkt_id
                 WHERE k.user_id = ?`,
                [userId],
                (err3, rows) => {
                    if (err3) return res.status(500).json({ error: 'Fejl ved hentning af kurv' });
                    res.json(rows);
                }
            );
        });
    });
});

// Fjern linje
router.delete('/item/:produktId', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const produktId = req.params.produktId;
    db.get('SELECT id FROM kurv WHERE user_id = ?', [userId], (err, kurvRow) => {
        if (err) return res.status(500).json({ error: 'Fejl ved kurv' });
        if (!kurvRow) return res.status(404).json({ error: 'Kurv ikke fundet' });
        db.run('DELETE FROM kurv_linjer WHERE kurv_id = ? AND produkt_id = ?', [kurvRow.id, produktId], function(err2) {
            if (err2) return res.status(500).json({ error: 'Fejl ved sletning' });
            db.all(
                `SELECT kl.produkt_id as id, kl.produkt_navn as navn, p.beskrivelse, p.kategori, p.maerke as mærke, kl.produkt_pris as pris, kl.antal
                 FROM kurv_linjer kl
                 JOIN kurv k ON kl.kurv_id = k.id
                 JOIN produkter p ON p.id = kl.produkt_id
                 WHERE k.user_id = ?`,
                [userId],
                (err3, rows) => {
                    if (err3) return res.status(500).json({ error: 'Fejl ved hentning af kurv' });
                    res.json(rows);
                }
            );
        });
    });
});

// Ryd
router.delete('/', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    db.get('SELECT id FROM kurv WHERE user_id = ?', [userId], (err, kurvRow) => {
        if (err) return res.status(500).json({ error: 'Fejl ved kurv opslag' });
        if (!kurvRow) return res.json({ success: true });
        db.run('DELETE FROM kurv_linjer WHERE kurv_id = ?', [kurvRow.id], (err2) => {
            if (err2) return res.status(500).json({ error: 'Fejl ved rydning af kurv' });
            res.json({ success: true });
        });
    });
});

module.exports = router;
