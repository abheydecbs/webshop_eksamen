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

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server kører på http://localhost:${PORT}`);
    console.log(`📊 API tilgængelig på http://localhost:${PORT}/api/produkter`);
    console.log(`🛒 Ordre API tilgængelig på http://localhost:${PORT}/ordre.html`);
});
