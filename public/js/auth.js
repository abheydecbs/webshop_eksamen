// Fælles auth helper (cookie-baseret nu)
async function fetchCurrentUser() {
  try {
    const res = await fetch('/api/auth/me', { method: 'GET' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  window.location.href = '/';
}

// Dynamisk header bruger menu
 (async function initUserMenu() {
  const header = document.querySelector('header');
  if (!header) return;
  let userMenu = document.getElementById('user-menu');
  if (!userMenu) {
    userMenu = document.createElement('div');
    userMenu.id = 'user-menu';
    userMenu.style.marginTop = '0.5rem';
    userMenu.style.textAlign = 'center';
    header.appendChild(userMenu);
  }
  const user = await fetchCurrentUser();
  if (user) {
    userMenu.innerHTML = `<div style="color:#fff; font-size:0.9rem;">Logget ind som <strong>${user.email}</strong> <button id="logout-btn" style="margin-left:1rem; background:#ff6600; border:none; color:#fff; padding:0.4rem 0.8rem; border-radius:4px; cursor:pointer;">Logout</button></div>`;
    document.getElementById('logout-btn').addEventListener('click', logout);
  } else {
    userMenu.innerHTML = `<div style="font-size:0.9rem;"><a style="color:#ff6600; text-decoration:none;" href="/login.html">Login</a> | <a style="color:#ff6600; text-decoration:none;" href="/register.html">Opret</a></div>`;
  }
 })();
