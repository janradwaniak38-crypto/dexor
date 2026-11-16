const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const glyph = (game = '') => game.toLowerCase().includes('fisch') ? '🎣' : game.toLowerCase().includes('fortnite') ? '⚡' : game.toLowerCase().includes('narz') ? '⊙' : '◇';

async function loadDexorSite() {
  try {
    const [configResponse, catalogResponse] = await Promise.all([fetch('./config.json', { cache: 'no-store' }), fetch('./catalog.json', { cache: 'no-store' })]);
    const config = await configResponse.json();
    const catalog = await catalogResponse.json();
    if (config.repository && !config.repository.includes('OWNER/')) {
      const repoUrl = `https://github.com/${config.repository}`;
      ['source-link', 'footer-github'].forEach((id) => { const link = document.getElementById(id); if (link) link.href = repoUrl; });
    }
    if (config.latestInstaller && !config.latestInstaller.includes('OWNER/')) {
      ['download-button', 'download-bottom'].forEach((id) => { const link = document.getElementById(id); if (link) link.href = config.latestInstaller; });
    }
    document.getElementById('catalog-grid').innerHTML = catalog.packages.map((item) => `<article class="catalog-item"><div class="catalog-item-icon">${glyph(item.game)}</div><div class="catalog-item-main"><div class="catalog-item-tag">${escapeHtml(item.category || item.game)}</div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><div class="tags">${(item.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div></div><div class="step-count"><strong>${(item.steps || []).length}</strong><small>KROKI</small></div></article>`).join('') || '<div class="loading-card">Brak szablonów w katalogu.</div>';
    document.getElementById('catalog-updated').textContent = `Aktualizacja: ${catalog.updatedAt || '—'}`;
  } catch {
    document.getElementById('catalog-grid').innerHTML = '<div class="loading-card">Nie udało się odczytać katalogu. Spróbuj ponownie później.</div>';
  }
}

loadDexorSite();
