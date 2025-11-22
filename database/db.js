const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Opret database
const dbPath = path.join(__dirname, 'webshop.db');
const db = new sqlite3.Database(dbPath);

// Initialiser database
db.serialize(() => {
    // Opret produkter tabel
    db.run(`
        CREATE TABLE IF NOT EXISTS produkter (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            navn TEXT NOT NULL,
            pris INTEGER NOT NULL,
            beskrivelse TEXT NOT NULL,
            kategori TEXT NOT NULL,
            maerke TEXT NOT NULL
        )
    `);

    // Opret brugere tabel (login system)
    db.run(`
        CREATE TABLE IF NOT EXISTS brugere (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            oprettet_dato DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Opret kunder tabel
    db.run(`
        CREATE TABLE IF NOT EXISTS kunder (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            navn TEXT NOT NULL,
            email TEXT NOT NULL,
            telefon TEXT NOT NULL,
            adresse TEXT NOT NULL,
            postnr TEXT NOT NULL,
            by TEXT NOT NULL,
            oprettet_dato DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Opret ordre tabel
    db.run(`
        CREATE TABLE IF NOT EXISTS ordre (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ordre_id TEXT UNIQUE NOT NULL,
            kunde_id INTEGER NOT NULL,
            total_pris INTEGER NOT NULL,
            status TEXT DEFAULT 'modtaget',
            oprettet_dato DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (kunde_id) REFERENCES kunder(id)
        )
    `);

    // Opret ordre_linjer tabel (produkter i ordren)
    db.run(`
        CREATE TABLE IF NOT EXISTS ordre_linjer (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ordre_id TEXT NOT NULL,
            produkt_id INTEGER NOT NULL,
            produkt_navn TEXT NOT NULL,
            produkt_pris INTEGER NOT NULL,
            antal INTEGER NOT NULL,
            FOREIGN KEY (ordre_id) REFERENCES ordre(ordre_id),
            FOREIGN KEY (produkt_id) REFERENCES produkter(id)
        )
    `);

    // Server-side kurv (en kurv per bruger)
    db.run(`
        CREATE TABLE IF NOT EXISTS kurv (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            opdateret_dato DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES brugere(id)
        )
    `);

    // Linjer i kurven
    db.run(`
        CREATE TABLE IF NOT EXISTS kurv_linjer (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kurv_id INTEGER NOT NULL,
            produkt_id INTEGER NOT NULL,
            produkt_navn TEXT NOT NULL,
            produkt_pris INTEGER NOT NULL,
            antal INTEGER NOT NULL,
            FOREIGN KEY (kurv_id) REFERENCES kurv(id),
            FOREIGN KEY (produkt_id) REFERENCES produkter(id)
        )
    `);

    // Tjek om der allerede er produkter
    db.get('SELECT COUNT(*) as count FROM produkter', (err, row) => {
        if (err) {
            console.error('Fejl ved database check:', err);
            return;
        }

        // Indsæt kun data hvis tabellen er tom
        if (row.count === 0) {
            console.log('Indsætter initial produktdata...');
            
            const produkter = [
                { navn: 'MacBook Pro 14"', pris: 18999, beskrivelse: 'M3 chip, 16GB RAM, 512GB SSD', kategori: 'computere', maerke: 'Apple' },
                { navn: 'Dell XPS 15', pris: 14999, beskrivelse: 'Intel i7, 16GB RAM, 1TB SSD', kategori: 'computere', maerke: 'Dell' },
                { navn: 'iPad Air', pris: 6499, beskrivelse: '10.9", 256GB, Wi-Fi', kategori: 'computere', maerke: 'Apple' },
                { navn: 'iPhone 15 Pro', pris: 11999, beskrivelse: '256GB, Titanium, A17 Pro chip', kategori: 'mobil', maerke: 'Apple' },
                { navn: 'Samsung Galaxy S24', pris: 8999, beskrivelse: '256GB, 8GB RAM, AI funktioner', kategori: 'mobil', maerke: 'Samsung' },
                { navn: 'LG OLED C3 55"', pris: 12999, beskrivelse: '4K OLED, 120Hz, Smart TV', kategori: 'tv', maerke: 'LG' },
                { navn: 'Sony Bravia 65"', pris: 15999, beskrivelse: '4K LED, Google TV', kategori: 'tv', maerke: 'Sony' },
                { navn: 'PlayStation 5', pris: 4499, beskrivelse: '825GB, inkl. controller', kategori: 'gaming', maerke: 'Sony' },
                { navn: 'Xbox Series X', pris: 4299, beskrivelse: '1TB, 4K gaming', kategori: 'gaming', maerke: 'Microsoft' },
                { navn: 'Nintendo Switch OLED', pris: 2999, beskrivelse: '7" OLED skærm, 64GB', kategori: 'gaming', maerke: 'Nintendo' },
                { navn: 'Logitech MX Master 3S', pris: 899, beskrivelse: 'Trådløs mus, ergonomisk', kategori: 'tilbehor', maerke: 'Logitech' },
                { navn: 'Keychron K2', pris: 799, beskrivelse: 'Mekanisk tastatur, RGB', kategori: 'tilbehor', maerke: 'Keychron' },
                { navn: 'Samsung 27" 4K Monitor', pris: 3499, beskrivelse: 'IPS, 60Hz, USB-C', kategori: 'tilbehor', maerke: 'Samsung' },
                { navn: 'AirPods Pro 2', pris: 2499, beskrivelse: 'Active Noise Cancelling', kategori: 'tilbehor', maerke: 'Apple' },
                { navn: 'Sony WH-1000XM5', pris: 3299, beskrivelse: 'Trådløse hovedtelefoner, ANC', kategori: 'tilbehor', maerke: 'Sony' }
            ];

            const stmt = db.prepare('INSERT INTO produkter (navn, pris, beskrivelse, kategori, maerke) VALUES (?, ?, ?, ?, ?)');
            
            produkter.forEach(produkt => {
                stmt.run(produkt.navn, produkt.pris, produkt.beskrivelse, produkt.kategori, produkt.maerke);
            });
            
            stmt.finalize();
            console.log('Database initialiseret med produkter');
        } else {
            console.log('Database allerede initialiseret');
        }
    });
});

module.exports = db;
