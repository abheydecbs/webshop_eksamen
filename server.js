const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database/db');
const app = express();
const PORT = 3000;
const JWT_SECRET = 'super_hemmelig_nøgle'; // For eksamensprojekt; i produktion brug ENV variabler

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// API Routes

// Hent alle produkter
app.get('/api/produkter', (req, res) => {
    db.all('SELECT * FROM produkter', [], (err, rows) => {
        if (err) {
            console.error('Database fejl:', err);
            return res.status(500).json({ error: 'Kunne ikke hente produkter' });
        }
        
        // Konverter 'maerke' til 'mærke' for frontend
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
app.get('/api/produkter/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM produkter WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('Database fejl:', err);
            return res.status(500).json({ error: 'Kunne ikke hente produkt' });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Produkt ikke fundet' });
        }
        
        const produkt = {
            id: row.id,
            navn: row.navn,
            pris: row.pris,
            beskrivelse: row.beskrivelse,
            kategori: row.kategori,
            mærke: row.maerke
        };
        
        res.json(produkt);
    });
});

// Søg produkter
app.get('/api/produkter/søg/:query', (req, res) => {
    const { query } = req.params;
    const søgeord = `%${query}%`;
    
    db.all(
        'SELECT * FROM produkter WHERE navn LIKE ? OR beskrivelse LIKE ? OR maerke LIKE ?',
        [søgeord, søgeord, søgeord],
        (err, rows) => {
            if (err) {
                console.error('Database fejl:', err);
                return res.status(500).json({ error: 'Søgning fejlede' });
            }
            
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

// AUTH API

// Registrer bruger
app.post('/api/auth/register', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email og password er påkrævet' });
    }

    // Tjek om email allerede findes
    db.get('SELECT id FROM brugere WHERE email = ?', [email], (err, row) => {
        if (err) {
            console.error('DB fejl ved tjek af bruger:', err);
            return res.status(500).json({ error: 'Server fejl' });
        }
        if (row) {
            return res.status(409).json({ error: 'Email er allerede registreret' });
        }

        const passwordHash = bcrypt.hashSync(password, 10);
        db.run('INSERT INTO brugere (email, password_hash) VALUES (?, ?)', [email, passwordHash], function(err) {
            if (err) {
                console.error('Fejl ved oprettelse af bruger:', err);
                return res.status(500).json({ error: 'Kunne ikke oprette bruger' });
            }
            const userId = this.lastID;
            const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '2h' });
            res.cookie('auth_token', token, {
                httpOnly: true,
                sameSite: 'strict',
                secure: false, // sæt til true i produktion med HTTPS
                maxAge: 2 * 60 * 60 * 1000
            });
            res.json({ success: true, email });
        });
    });
});

// Login bruger
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email og password er påkrævet' });
    }

    db.get('SELECT id, password_hash FROM brugere WHERE email = ?', [email], (err, row) => {
        if (err) {
            console.error('Fejl ved login:', err);
            return res.status(500).json({ error: 'Server fejl' });
        }
        if (!row) {
            return res.status(401).json({ error: 'Forkert email eller password' });
        }
        const match = bcrypt.compareSync(password, row.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Forkert email eller password' });
        }
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

// Hent egen bruger
app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json({ userId: req.user.userId, email: req.user.email });
});

// Logout - ryd cookie
app.post('/api/auth/logout', (req, res) => {
    res.cookie('auth_token', '', { httpOnly: true, sameSite: 'strict', secure: false, maxAge: 0 });
    res.json({ success: true });
});

// ORDRE API

// Opret ny ordre
app.post('/api/ordre', (req, res) => {
    const { kunde, kurv } = req.body;
    
    // Valider input
    if (!kunde || !kurv || kurv.length === 0) {
        return res.status(400).json({ error: 'Manglende kunde- eller kurvoplysninger' });
    }
    
    // Generer unikt ordre-ID
    const ordreId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Beregn total pris
    const totalPris = kurv.reduce((sum, item) => sum + (item.pris * item.antal), 0);
    
    // Indsæt kunde
    db.run(
        'INSERT INTO kunder (navn, email, telefon, adresse, postnr, by) VALUES (?, ?, ?, ?, ?, ?)',
        [kunde.navn, kunde.email, kunde.telefon, kunde.adresse, kunde.postnr, kunde.by],
        function(err) {
            if (err) {
                console.error('Fejl ved oprettelse af kunde:', err);
                return res.status(500).json({ error: 'Kunne ikke oprette kunde' });
            }
            
            const kundeId = this.lastID;
            
            // Indsæt ordre
            db.run(
                'INSERT INTO ordre (ordre_id, kunde_id, total_pris, status) VALUES (?, ?, ?, ?)',
                [ordreId, kundeId, totalPris, 'modtaget'],
                function(err) {
                    if (err) {
                        console.error('Fejl ved oprettelse af ordre:', err);
                        return res.status(500).json({ error: 'Kunne ikke oprette ordre' });
                    }
                    
                    // Indsæt ordre linjer
                    const stmt = db.prepare('INSERT INTO ordre_linjer (ordre_id, produkt_id, produkt_navn, produkt_pris, antal) VALUES (?, ?, ?, ?, ?)');
                    
                    kurv.forEach(item => {
                        stmt.run(ordreId, item.id, item.navn, item.pris, item.antal);
                    });
                    
                    stmt.finalize();
                    
                    res.json({
                        success: true,
                        ordreId: ordreId,
                        kundeId: kundeId,
                        totalPris: totalPris,
                        message: 'Ordre oprettet succesfuldt'
                    });
                }
            );
        }
    );
});

// Hent alle ordre
app.get('/api/ordre', (req, res) => {
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
            if (err) {
                console.error('Database fejl:', err);
                return res.status(500).json({ error: 'Kunne ikke hente ordre' });
            }
            res.json(rows);
        }
    );
});

// Hent enkelt ordre med detaljer
app.get('/api/ordre/:ordreId', (req, res) => {
    const { ordreId } = req.params;
    
    // Hent ordre og kunde info
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
            if (err) {
                console.error('Database fejl:', err);
                return res.status(500).json({ error: 'Kunne ikke hente ordre' });
            }
            
            if (!ordre) {
                return res.status(404).json({ error: 'Ordre ikke fundet' });
            }
            
            // Hent ordre linjer
            db.all(
                'SELECT * FROM ordre_linjer WHERE ordre_id = ?',
                [ordreId],
                (err, linjer) => {
                    if (err) {
                        console.error('Database fejl:', err);
                        return res.status(500).json({ error: 'Kunne ikke hente ordre detaljer' });
                    }
                    
                    res.json({
                        ...ordre,
                        produkter: linjer
                    });
                }
            );
        }
    );
});

// SERVER-KURV API (kræver login)

// Hent kurv
app.get('/api/kurv', authMiddleware, (req, res) => {
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
app.post('/api/kurv/add', authMiddleware, (req, res) => {
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
app.put('/api/kurv/item/:produktId', authMiddleware, (req, res) => {
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
app.delete('/api/kurv/item/:produktId', authMiddleware, (req, res) => {
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

// Ryd hele kurven
app.delete('/api/kurv', authMiddleware, (req, res) => {
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

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server kører på http://localhost:${PORT}`);
    console.log(`📊 API tilgængelig på http://localhost:${PORT}/api/produkter`);
    console.log(`🛒 Ordre API tilgængelig på http://localhost:${PORT}/ordre.html`);
});
