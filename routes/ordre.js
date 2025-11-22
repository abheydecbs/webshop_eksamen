const express = require('express');
const db = require('../database/db');

const router = express.Router();

// Opret ordre
router.post('/', (req, res) => {
    const { kunde, kurv } = req.body;
    if (!kunde || !kurv || kurv.length === 0) return res.status(400).json({ error: 'Manglende kunde- eller kurvoplysninger' });
    const ordreId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const totalPris = kurv.reduce((sum, item) => sum + (item.pris * item.antal), 0);
    db.run(
        'INSERT INTO kunder (navn, email, telefon, adresse, postnr, by) VALUES (?, ?, ?, ?, ?, ?)',
        [kunde.navn, kunde.email, kunde.telefon, kunde.adresse, kunde.postnr, kunde.by],
        function(err) {
            if (err) return res.status(500).json({ error: 'Kunne ikke oprette kunde' });
            const kundeId = this.lastID;
            db.run(
                'INSERT INTO ordre (ordre_id, kunde_id, total_pris, status) VALUES (?, ?, ?, ?)',
                [ordreId, kundeId, totalPris, 'modtaget'],
                function(err2) {
                    if (err2) return res.status(500).json({ error: 'Kunne ikke oprette ordre' });
                    const stmt = db.prepare('INSERT INTO ordre_linjer (ordre_id, produkt_id, produkt_navn, produkt_pris, antal) VALUES (?, ?, ?, ?, ?)');
                    kurv.forEach(item => stmt.run(ordreId, item.id, item.navn, item.pris, item.antal));
                    stmt.finalize();
                    res.json({ success: true, ordreId, kundeId, totalPris, message: 'Ordre oprettet succesfuldt' });
                }
            );
        }
    );
});

// Hent alle ordre
router.get('/', (req, res) => {
    db.all(
        `SELECT 
            o.ordre_id,
            o.total_pris,
            o.status,
            o.oprettet_dato,
            k.navn as kunde_navn,
            k.email as kunde_email,
            k.telefon as kunde_telefon,
            k.adresse as kunde_adresse,
            k.postnr as kunde_postnr,
            k.by as kunde_by
        FROM ordre o
        JOIN kunder k ON o.kunde_id = k.id
        ORDER BY o.oprettet_dato DESC`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Kunne ikke hente ordre' });
            res.json(rows);
        }
    );
});

// Hent enkelt ordre
router.get('/:ordreId', (req, res) => {
    const { ordreId } = req.params;
    db.get(
        `SELECT 
            o.ordre_id,
            o.total_pris,
            o.status,
            o.oprettet_dato,
            k.navn as kunde_navn,
            k.email as kunde_email,
            k.telefon as kunde_telefon,
            k.adresse as kunde_adresse,
            k.postnr as kunde_postnr,
            k.by as kunde_by
        FROM ordre o
        JOIN kunder k ON o.kunde_id = k.id
        WHERE o.ordre_id = ?`,
        [ordreId],
        (err, ordre) => {
            if (err) return res.status(500).json({ error: 'Kunne ikke hente ordre' });
            if (!ordre) return res.status(404).json({ error: 'Ordre ikke fundet' });
            db.all('SELECT * FROM ordre_linjer WHERE ordre_id = ?', [ordreId], (err2, linjer) => {
                if (err2) return res.status(500).json({ error: 'Kunne ikke hente ordre detaljer' });
                res.json({ ...ordre, produkter: linjer });
            });
        }
    );
});

module.exports = router;
