// Produkter (hentes fra API)
let produkter = [];
let filtreretProdukter = [];

// Kurv håndteres nu centralt i cart.js (window.Cart)

// Hent produkter fra API
async function hentProdukter() {
    try {
        const response = await fetch('http://localhost:3000/api/produkter');
        if (!response.ok) {
            throw new Error('Kunne ikke hente produkter');
        }
        produkter = await response.json();
        filtreretProdukter = [...produkter];
        visProdukter();
    } catch (error) {
        console.error('Fejl ved hentning af produkter:', error);
        document.getElementById('produkt-liste').innerHTML = 
            '<p class="fejl-besked">❌ Kunne ikke hente produkter. Sørg for at serveren kører.</p>';
    }
}

// Vis produkter
function visProdukter(produkterAtVise = produkter) {
    const produktListe = document.getElementById('produkt-liste');
    produktListe.innerHTML = '';

    if (produkterAtVise.length === 0) {
        produktListe.innerHTML = '<p class="ingen-produkter">Ingen produkter fundet</p>';
        return;
    }

    produkterAtVise.forEach(produkt => {
        const produktCard = document.createElement('div');
        produktCard.className = 'produkt-card';
        produktCard.innerHTML = `
            <div class="produkt-badge">${produkt.mærke}</div>
            <h3>${produkt.navn}</h3>
            <p class="beskrivelse">${produkt.beskrivelse}</p>
            <p class="kategori">Kategori: ${getCategoryName(produkt.kategori)}</p>
            <p class="pris">${produkt.pris.toLocaleString('da-DK')} kr.</p>
            <button onclick="tilføjTilKurv(${produkt.id})">Tilføj til kurv</button>
        `;
        produktListe.appendChild(produktCard);
    });
}

// Hjælpefunktion til kategori-navne
function getCategoryName(kategori) {
    const navne = {
        'computere': 'Computere & Tablets',
        'mobil': 'Mobil & Telefoni',
        'tv': 'TV & Lyd',
        'gaming': 'Gaming',
        'tilbehor': 'Tilbehør'
    };
    return navne[kategori] || kategori;
}

// Søgefunktion
function søgProdukter() {
    const søgeord = document.getElementById('søg-input').value.toLowerCase();
    const kategori = document.getElementById('kategori-filter').value;
    
    filtreretProdukter = produkter.filter(produkt => {
        const matcherSøgning = produkt.navn.toLowerCase().includes(søgeord) || 
                               produkt.beskrivelse.toLowerCase().includes(søgeord) ||
                               produkt.mærke.toLowerCase().includes(søgeord);
        const matcherKategori = kategori === 'alle' || produkt.kategori === kategori;
        return matcherSøgning && matcherKategori;
    });
    
    sorterProdukter();
}

// Sorteringsfunktion
function sorterProdukter() {
    const sortering = document.getElementById('sortering').value;
    
    switch(sortering) {
        case 'pris-lav':
            filtreretProdukter.sort((a, b) => a.pris - b.pris);
            break;
        case 'pris-høj':
            filtreretProdukter.sort((a, b) => b.pris - a.pris);
            break;
        case 'navn':
            filtreretProdukter.sort((a, b) => a.navn.localeCompare(b.navn, 'da'));
            break;
        default:
            filtreretProdukter = [...produkter];
    }
    
    visProdukter(filtreretProdukter);
}

// Tilføj til kurv
async function tilføjTilKurv(produktId) {
    const produkt = produkter.find(p => p.id === produktId);
    if (!produkt) return;
    await Cart.add(produkt);
    visKurvNotifikation(produkt.navn);
}

// Gem kurv til localStorage
function gemKurv() { /* Centraliseret i Cart */ }

// Vis notifikation
function visKurvNotifikation(produktNavn) {
    const notification = document.createElement('div');
    notification.className = 'kurv-notification';
    notification.innerHTML = `✓ ${produktNavn} tilføjet til kurven`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Opdater kurv antal i header
function opdaterKurvAntal() { Cart.updateHeaderCount(); }

// Initialiser
Cart.ensureAuthChecked().then(() => {
    hentProdukter();
    Cart.updateHeaderCount();
});

// Event listeners for søgning og filtrering
document.getElementById('søg-input').addEventListener('input', søgProdukter);
document.getElementById('kategori-filter').addEventListener('change', søgProdukter);
document.getElementById('sortering').addEventListener('change', sorterProdukter);
