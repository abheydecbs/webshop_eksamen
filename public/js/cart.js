// Centraliseret kurv logik
(function(){
  let cart = JSON.parse(localStorage.getItem('kurv')) || [];
  let serverMode = false;
  let authChecked = false;

  async function ensureAuthChecked(){
    if (authChecked) return;
    try {
      const me = await fetch('/api/auth/me');
      if (me.ok) {
        const res = await fetch('/api/kurv');
        if (res.ok) {
          cart = await res.json();
          serverMode = true;
        }
      }
    } catch(e) { /* ignore */ }
    authChecked = true;
  }

  function persistLocal(){
    if (serverMode) return;
    localStorage.setItem('kurv', JSON.stringify(cart));
  }

  function getCount(){
    return cart.reduce((s,i)=>s+i.antal,0);
  }

  function updateHeaderCount(){
    const el = document.getElementById('kurv-antal');
    if (el) el.textContent = getCount();
  }

  async function add(product){
    await ensureAuthChecked();
    if (serverMode){
      try {
        const res = await fetch('/api/kurv/add', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ produktId: product.id, antal:1 }) });
        if (res.ok){ cart = await res.json(); updateHeaderCount(); return true; }
      } catch(e){ /* fallback */ }
    }
    const existing = cart.find(i=>i.id===product.id);
    if (existing) existing.antal++; else cart.push({ ...product, antal:1 });
    persistLocal();
    updateHeaderCount();
    return true;
  }

  async function changeQuantity(id, delta){
    await ensureAuthChecked();
    const item = cart.find(i=>i.id===id);
    if (!item) return;
    const newQty = item.antal + delta;
    if (serverMode){
      if (newQty <= 0) return remove(id);
      try {
        const res = await fetch(`/api/kurv/item/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ antal:newQty }) });
        if (res.ok){ cart = await res.json(); updateHeaderCount(); return; }
      } catch(e){ /* fallback */ }
    }
    item.antal = newQty;
    if (item.antal <= 0){
      cart = cart.filter(i=>i.id!==id);
    }
    persistLocal();
    updateHeaderCount();
  }

  async function remove(id){
    await ensureAuthChecked();
    if (serverMode){
      try {
        const res = await fetch(`/api/kurv/item/${id}`, { method:'DELETE' });
        if (res.ok){ cart = await res.json(); updateHeaderCount(); return; }
      } catch(e){ /* fallback */ }
    }
    cart = cart.filter(i=>i.id!==id);
    persistLocal();
    updateHeaderCount();
  }

  async function clearAfterOrder(){
    if (serverMode){
      try { await fetch('/api/kurv', { method:'DELETE' }); } catch(e){}
    }
    cart = [];
    persistLocal();
    updateHeaderCount();
  }

  function getCart(){ return cart.slice(); }
  function isServerMode(){ return serverMode; }

  window.Cart = { add, changeQuantity, remove, getCart, isServerMode, clearAfterOrder, ensureAuthChecked, updateHeaderCount };
})();
