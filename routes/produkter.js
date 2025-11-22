const express = require('express');
const db = require('../database/db');

const router = express.Router();

// Hent alle produkter
router.get('/', (req, res) => {
    db.all('SELECT * FROM produkter', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Kunne ikke hente produkter' });
        const produkter = rows.map(row => ({
            id: row.id,
            navn: row.navn,
            pris: row.pris,
            beskrivelse: row.beskrivelse,
            kategori: row.kategori,
            mærke: row.maerke
        }));
        res.json(produkter);
    });
});

// Hent enkelt produkt
router.get('/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM produkter WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Kunne ikke hente produkt' });
        if (!row) return res.status(404).json({ error: 'Produkt ikke fundet' });
        res.json({
            id: row.id,
            navn: row.navn,
            pris: row.pris,
            beskrivelse: row.beskrivelse,
            kategori: row.kategori,
            mærke: row.maerke
        });
    });
});

// Søg
router.get('/søg/:query', (req, res) => {
    const { query } = req.params;
    const søgeord = `%${query}%`;
    db.all(
        'SELECT * FROM produkter WHERE navn LIKE ? OR beskrivelse LIKE ? OR maerke LIKE ?',
        [søgeord, søgeord, søgeord],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Søgning fejlede' });
            const produkter = rows.map(row => ({
                id: row.id,
                navn: row.navn,
                pris: row.pris,
                beskrivelse: row.beskrivelse,
                kategori: row.kategori,
                mærke: row.maerke
            }));
            res.json(produkter);
        }
    );
});

module.exports = router;
