// Kurv logik er centraliseret i cart.js (window.Cart)

// Opdater kurv visning
function opdaterKurv() {
    const kurvIndhold = document.getElementById('kurv-indhold');
    const kurvAntal = document.getElementById('kurv-antal');
    const totalPris = document.getElementById('total-pris');
    const checkoutBtn = document.getElementById('checkout-btn');

    const kurv = Cart.getCart();

    if (kurv.length === 0) {
        kurvIndhold.innerHTML = '<p class="tom-kurv">Din kurv er tom</p>';
        kurvAntal.textContent = '0';
        totalPris.textContent = '0';
        checkoutBtn.disabled = true;
        checkoutBtn.style.opacity = '0.5';
        checkoutBtn.style.cursor = 'not-allowed';
        return;
    }

    checkoutBtn.disabled = false;
    checkoutBtn.style.opacity = '1';
    checkoutBtn.style.cursor = 'pointer';

    let html = '<div class="kurv-items">';
    let total = 0;
    let antalVarer = 0;

    kurv.forEach(item => {
        const subtotal = item.pris * item.antal;
        total += subtotal;
        antalVarer += item.antal;
        html += `
            <div class="kurv-item">
                <div class="kurv-item-info">
                    <h3>${item.navn}</h3>
                    <p class="kurv-item-beskrivelse">${item.beskrivelse}</p>
                    <p class="kurv-item-mærke">Mærke: ${item.mærke}</p>
                </div>
                <div class="kurv-item-antal">
                    <button onclick="ændrAntal(${item.id}, -1)" class="antal-btn">-</button>
                    <span class="antal">${item.antal}</span>
                    <button onclick="ændrAntal(${item.id}, 1)" class="antal-btn">+</button>
                </div>
                <div class="kurv-item-pris">
                    <p class="enhedspris">${item.pris.toLocaleString('da-DK')} kr. stk.</p>
                    <p class="subtotal">${subtotal.toLocaleString('da-DK')} kr.</p>
                </div>
                <button onclick="fjernFraKurv(${item.id})" class="fjern-btn">🗑️</button>
            </div>
        `;
    });

    html += '</div>';
    kurvIndhold.innerHTML = html;
    kurvAntal.textContent = antalVarer;
    totalPris.textContent = total.toLocaleString('da-DK');
}

// Ændr antal
async function ændrAntal(produktId, ændring) {
    await Cart.changeQuantity(produktId, ændring);
    opdaterKurv();
}

// Fjern fra kurv
async function fjernFraKurv(produktId) {
    await Cart.remove(produktId);
    opdaterKurv();
}

// Gem kurv til localStorage
function gemKurv() { /* styres i Cart */ }

// Checkout funktion - vis formular
async function checkout() {
    const kurvData = Cart.getCart();
    if (kurvData.length === 0) {
        alert('Din kurv er tom!');
        return;
    }
    
    // Vis checkout formular
    const kurvSection = document.getElementById('kurv');
    kurvSection.innerHTML = `
        <h2>Checkout - Indtast dine oplysninger</h2>
        <form id="checkout-form" class="checkout-form">
            <div class="form-gruppe">
                <label for="navn">Fulde navn *</label>
                <input type="text" id="navn" name="navn" required>
            </div>
            
            <div class="form-gruppe">
                <label for="email">Email *</label>
                <input type="email" id="email" name="email" required>
            </div>
            
            <div class="form-gruppe">
                <label for="telefon">Telefon *</label>
                <input type="tel" id="telefon" name="telefon" required>
            </div>
            
            <div class="form-gruppe">
                <label for="adresse">Adresse *</label>
                <input type="text" id="adresse" name="adresse" required>
            </div>
            
            <div class="form-row">
                <div class="form-gruppe">
                    <label for="postnr">Postnummer *</label>
                    <input type="text" id="postnr" name="postnr" required>
                </div>
                
                <div class="form-gruppe">
                    <label for="by">By *</label>
                    <input type="text" id="by" name="by" required>
                </div>
            </div>
            
            <div class="ordre-oversigt">
                <h3>Din ordre</h3>
                <div id="ordre-liste"></div>
                <div class="ordre-total">
                    <strong>Total: <span id="ordre-total-pris">${kurvData.reduce((sum, item) => sum + (item.pris * item.antal), 0).toLocaleString('da-DK')}</span> kr.</strong>
                </div>
            </div>
            
            <div class="form-handlinger">
                <a href="/kurv.html" class="tilbage-btn">← Tilbage til kurv</a>
                <button type="submit" class="bekræft-ordre-btn">Bekræft og afgiv ordre</button>
            </div>
        </form>
    `;
    
    // Vis ordre oversigt
    const ordreListe = document.getElementById('ordre-liste');
    const kurvVis = Cart.getCart();
    ordreListe.innerHTML = kurvVis.map(item => `
        <div class="ordre-item">
            <span>${item.navn} x ${item.antal}</span>
            <span>${(item.pris * item.antal).toLocaleString('da-DK')} kr.</span>
        </div>
    `).join('');
    
    // Tilføj form submit handler
    document.getElementById('checkout-form').addEventListener('submit', afgiv_ordre);

    // Auto-udfyld email hvis logget ind via cookie
    try {
        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
            const meData = await meRes.json();
            const emailInput = document.getElementById('email');
            emailInput.value = meData.email;
            emailInput.readOnly = true;
            emailInput.style.backgroundColor = '#f0f0f0';
        }
    } catch (e) { /* Ignorer hvis ikke logget ind */ }
}

// Afgiv ordre til API
async function afgiv_ordre(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const kunde = {
        navn: formData.get('navn'),
        email: formData.get('email'),
        telefon: formData.get('telefon'),
        adresse: formData.get('adresse'),
        postnr: formData.get('postnr'),
        by: formData.get('by')
    };
    
    try {
        const response = await fetch('/api/ordre', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                kunde: kunde,
                kurv: Cart.getCart()
            })
        });
        
        if (!response.ok) {
            throw new Error('Ordre kunne ikke oprettes');
        }
        
        const result = await response.json();
        
        // Vis bekræftelse
        visOrdreBekreftelse(result);
        
        // Tøm kurv (server først hvis aktiv)
        await Cart.clearAfterOrder();
        
    } catch (error) {
        console.error('Fejl ved ordre:', error);
        alert('Der opstod en fejl ved afgivelse af ordre. Prøv igen.');
    }
}

// Vis ordre bekræftelse
function visOrdreBekreftelse(ordre) {
    const kurvSection = document.getElementById('kurv');
    kurvSection.innerHTML = `
        <div class="ordre-bekræftelse">
            <div class="success-icon">✓</div>
            <h2>Tak for din ordre!</h2>
            <p class="ordre-id">Ordrenummer: <strong>${ordre.ordreId}</strong></p>
            <p>Total beløb: <strong>${ordre.totalPris.toLocaleString('da-DK')} kr.</strong></p>
            <p>Du vil modtage en bekræftelse på email.</p>
            <div class="bekreftelse-handlinger">
                <a href="/" class="fortsæt-btn">← Tilbage til shop</a>
            </div>
        </div>
    `;
}

// Initialiser
Cart.ensureAuthChecked().then(()=>opdaterKurv());
