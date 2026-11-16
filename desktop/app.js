const content = document.getElementById('content');
const modalRoot = document.getElementById('modal-root');
const toast = document.getElementById('toast');
const titles = { home: 'Przegląd', library: 'Moje makra', online: 'Katalog online', clicker: 'Auto klikacz', settings: 'Ustawienia' };
let state = { settings: {}, installed: [], clickerActive: false };
let catalog = [];
let activeView = 'home';
let toastTimer;
let editor = null;
let clickCount = 0;
let catalogFilter = 'all';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const fmtNumber = (value) => new Intl.NumberFormat('pl-PL').format(Number(value || 0));

function showToast(message, kind = 'info') {
  toast.textContent = message;
  toast.className = `toast visible ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3400);
}

function iconForGame(game = '') {
  const name = game.toLowerCase();
  if (name.includes('fisch')) return '🎣';
  if (name.includes('fortnite')) return '⚡';
  if (name.includes('roblox')) return '◈';
  if (name.includes('narz')) return '⌘';
  return '◇';
}

function macroCard(macro, online = false) {
  const installed = state.installed.some((item) => item.id === macro.id);
  const action = online
    ? (installed ? `<button class="button button-soft" data-action="edit" data-id="${esc(macro.id)}">Otwórz</button>` : `<button class="button button-primary" data-action="install" data-id="${esc(macro.id)}">Pobierz</button>`)
    : `<button class="button button-soft" data-action="edit" data-id="${esc(macro.id)}">Konfiguruj</button><button class="button button-run ${state.activeMacroId === macro.id ? 'running' : ''}" data-action="run" data-id="${esc(macro.id)}">${state.activeMacroId === macro.id ? '■' : '▶'}</button>`;
  return `<article class="macro-card ${online ? 'catalog-card' : ''}">
    <div class="macro-card-top"><div class="game-icon">${iconForGame(macro.game)}</div><span class="tag">${esc(macro.category || macro.game || 'Makro')}</span>${online ? `<span class="template-badge">SZABLON</span>` : (macro.needsCalibration ? `<span class="template-badge needs-setup">USTAW</span>` : '')}</div>
    <h3>${esc(macro.name)}</h3><p>${esc(macro.description || 'Własna sekwencja Dexor.')}</p>
    <div class="macro-card-meta"><span>${esc(macro.game || 'Inne')}</span><span>v${esc(macro.version || '1.0.0')}</span><span>${fmtNumber((macro.steps || []).length)} kroków</span></div>
    <div class="macro-card-actions">${action}${!online ? `<button class="icon-button danger-button" data-action="delete" data-id="${esc(macro.id)}" title="Usuń">×</button>` : ''}</div>
  </article>`;
}

function renderHome() {
  const recent = state.installed.slice(0, 3);
  const ready = catalog.length > 0;
  content.innerHTML = `<section class="welcome-row"><div><div class="eyebrow"><span class="eyebrow-line"></span> TWOJE CENTRUM MAKR</div><h1>Witaj w <span>Dexor.</span></h1><p>Ustaw, dostosuj i uruchamiaj swoje makra z jednego miejsca.</p></div><button class="button button-primary" data-action="navigate" data-view="online">Przeglądaj katalog <span>↗</span></button></section>
    <section class="hero-card"><div class="hero-copy"><div class="hero-tag"><span class="pulse"></span> DEXOR · ONLINE</div><h2>Twoje gry.<br><em>Twój rytm.</em></h2><p>Pobierz szablon z katalogu, ustaw punkty na ekranie i dopasuj sekwencję do swojej gry.</p><button class="button button-light" data-action="navigate" data-view="library">Otwórz moje makra <span>→</span></button></div><div class="hero-art"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="hero-glyph">D<span>×</span></div><div class="hero-chip chip-a">SCREEN <b>●</b></div><div class="hero-chip chip-b">INPUT <b>↗</b></div><div class="hero-chip chip-c">MACRO <b>↻</b></div></div><div class="hero-glow"></div></section>
    <section class="stats-grid"><div class="stat-card"><div class="stat-top"><span>INSTALOWANE MAKRА</span><span class="stat-icon">▦</span></div><strong>${fmtNumber(state.installed.length)}</strong><small>na tym urządzeniu</small></div><div class="stat-card"><div class="stat-top"><span>KATALOG ONLINE</span><span class="stat-icon">⌘</span></div><strong>${ready ? fmtNumber(catalog.length) : '—'}</strong><small>${ready ? 'szablonów do pobrania' : 'podłącz adres katalogu'}</small></div><div class="stat-card stat-card-accent"><div class="stat-top"><span>STATUS STEROWANIA</span><span class="stat-icon green-icon">●</span></div><strong>Gotowy</strong><small>lokalny silnik Windows</small></div></section>
    <section class="section-heading"><div><div class="eyebrow">SZYBKI DOSTĘP</div><h2>Ostatnio używane</h2></div><button class="text-button" data-action="navigate" data-view="library">Zobacz wszystkie <span>→</span></button></section>
    ${recent.length ? `<div class="macro-grid">${recent.map((item) => macroCard(item)).join('')}</div>` : `<div class="empty-card"><div class="empty-icon">✳</div><div><h3>Tu pojawią się Twoje makra</h3><p>Pobierz szablon z katalogu i dopasuj go do widoku gry.</p></div><button class="button button-soft" data-action="navigate" data-view="online">Otwórz katalog</button></div>`}
    <div class="info-strip"><span class="info-symbol">i</span><span>Szablony gier wymagają kalibracji pozycji i kolorów. <b>F8</b> natychmiast zatrzymuje aktywne makro.</span><button data-action="navigate" data-view="settings">Ustawienia <span>→</span></button></div>`;
}

function renderLibrary() {
  const items = state.installed;
  content.innerHTML = `<section class="page-intro"><div><div class="eyebrow">LOKALNA BIBLIOTEKA</div><h1>Moje makra</h1><p>Makra zainstalowane na tym urządzeniu. Konfiguracja jest zapisywana lokalnie.</p></div><div class="intro-actions"><button class="button button-soft" data-action="new-macro">＋ Nowe makro</button><button class="button button-primary" data-action="navigate" data-view="online">＋ Dodaj z katalogu</button></div></section>
    ${items.length ? `<div class="toolbar"><label class="search-box"><span>⌕</span><input id="macro-search" type="search" placeholder="Szukaj w bibliotece..."></label><span class="result-count">${items.length} elementów</span></div><div id="macro-grid" class="macro-grid">${items.map((item) => macroCard(item)).join('')}</div>` : `<div class="empty-panel"><div class="empty-orbit">◇</div><h2>Biblioteka jest pusta</h2><p>Otwórz katalog online, pobierz szablon i skonfiguruj pierwszą sekwencję.</p><button class="button button-primary" data-action="navigate" data-view="online">Przejdź do katalogu <span>→</span></button></div>`}`;
}

function renderOnline() {
  const visibleCatalog = catalog.filter((item) => catalogFilter === 'all' || (catalogFilter === 'roblox' && item.game.toLowerCase().includes('fisch')) || (catalogFilter === 'tools' && item.category === 'Narzędzia') || (catalogFilter === 'launchers' && item.category === 'Launcher'));
  content.innerHTML = `<section class="page-intro"><div><div class="eyebrow"><span class="eyebrow-line"></span> DEXOR COMMUNITY</div><h1>Katalog online</h1><p>Przeglądaj i instaluj gotowe szablony. Makra są danymi, nie pobieranym kodem.</p></div><button class="button button-soft" data-action="refresh">↻ Odśwież katalog</button></section>
    <div class="catalog-banner"><div class="catalog-banner-icon">⌘</div><div><strong>${catalog.length ? `${catalog.length} szablony dostępne` : 'Połącz katalog online'}</strong><p>${catalog.length ? 'Konfiguracja wykonuje się lokalnie na Twoim komputerze.' : `Obecny adres: ${esc(state.settings.catalogUrl || 'brak')}`}</p></div><button class="text-button" data-action="navigate" data-view="settings">Ustaw adres katalogu <span>→</span></button></div>
    <div class="filter-row"><button class="filter-chip ${catalogFilter === 'all' ? 'active' : ''}" data-filter="all">Wszystkie <b>${catalog.length}</b></button><button class="filter-chip ${catalogFilter === 'roblox' ? 'active' : ''}" data-filter="roblox">Roblox</button><button class="filter-chip ${catalogFilter === 'tools' ? 'active' : ''}" data-filter="tools">Narzędzia</button><button class="filter-chip ${catalogFilter === 'launchers' ? 'active' : ''}" data-filter="launchers">Launchery</button></div>
    ${catalog.length ? `<div class="macro-grid">${visibleCatalog.map((item) => macroCard(item, true)).join('') || '<div class="empty-search">Brak szablonów w tej kategorii.</div>'}</div>` : `<div class="empty-panel"><div class="empty-orbit">⌁</div><h2>Nie udało się załadować katalogu</h2><p>Wklej publiczny adres <code>catalog.json</code> z GitHub Pages w Ustawieniach.</p><button class="button button-primary" data-action="navigate" data-view="settings">Otwórz ustawienia <span>→</span></button></div>`}`;
}

function renderClicker() {
  const interval = state.settings.clickerInterval || 500;
  const button = state.settings.clickerButton || 'left';
  content.innerHTML = `<section class="page-intro"><div><div class="eyebrow">NARZĘDZIE SYSTEMOWE</div><h1>Auto klikacz</h1><p>Klikaj w bieżącym miejscu kursora z wybranym interwałem.</p></div><div class="hotkey-pill"><kbd>F6</kbd><span>skrót start / stop</span></div></section>
    <div class="clicker-layout"><section class="clicker-panel"><div class="panel-heading"><div><span class="eyebrow">USTAWIENIA KLIKANIA</span><h2>Kontrola interwału</h2></div><span class="live-badge ${state.clickerActive ? 'is-live' : ''}"><i></i>${state.clickerActive ? 'AKTYWNY' : 'GOTOWY'}</span></div><label class="field-label" for="click-interval">Interwał między kliknięciami <span>ms</span></label><div class="interval-input"><input id="click-interval" type="number" min="50" max="60000" step="50" value="${interval}"><span>ms</span></div><input id="click-range" class="range" type="range" min="50" max="5000" step="50" value="${Math.min(interval, 5000)}"><div class="range-labels"><span>50 ms · szybciej</span><span>5000 ms · wolniej</span></div><label class="field-label" for="click-button">Przycisk myszy</label><select id="click-button" class="select-control"><option value="left" ${button === 'left' ? 'selected' : ''}>Lewy</option><option value="right" ${button === 'right' ? 'selected' : ''}>Prawy</option><option value="middle" ${button === 'middle' ? 'selected' : ''}>Środkowy</option></select><div class="clicker-warning"><span>!</span><p>Kliknięcia są wysyłane do okna znajdującego się pod kursorem. Przesuń kursor w bezpieczne miejsce przed startem.</p></div><button class="button ${state.clickerActive ? 'button-stop' : 'button-primary'} clicker-main-button" data-action="clicker-toggle">${state.clickerActive ? '■  Zatrzymaj klikacz' : '▶  Uruchom klikacz'}</button></section>
    <section class="clicker-side"><div class="clicker-visual"><div class="click-ring ring-outer"></div><div class="click-ring ring-inner"></div><div class="click-core">${state.clickerActive ? '<span class="click-pulse"></span>' : '⊙'}</div><div class="click-cursor">↖</div></div><div class="click-stats"><div><small>WYKONANE KLIKNIĘCIA</small><strong id="click-count">${fmtNumber(clickCount)}</strong></div><div><small>INTERWAŁ</small><strong id="click-speed">${interval}<em> ms</em></strong></div></div><div class="side-note"><span>⌁</span><p>Skrót <b>F6</b> przełącza klikacz z dowolnego okna. Naciśnij <b>F8</b>, aby zatrzymać makro.</p></div></section></div>`;
  const numberInput = document.getElementById('click-interval');
  const rangeInput = document.getElementById('click-range');
  numberInput.addEventListener('input', () => { if (Number(numberInput.value) <= 5000) rangeInput.value = numberInput.value; });
  rangeInput.addEventListener('input', () => { numberInput.value = rangeInput.value; });
}

function renderSettings() {
  const settings = state.settings || {};
  content.innerHTML = `<section class="page-intro"><div><div class="eyebrow">PREFERENCJE</div><h1>Ustawienia</h1><p>Połączenie katalogu i konfiguracja lokalnego uruchamiania.</p></div></section>
    <div class="settings-layout"><section class="settings-card"><div class="settings-card-title"><div class="settings-icon">⌘</div><div><h2>Katalog online</h2><p>Publiczny adres pliku catalog.json</p></div></div><label class="field-label" for="catalog-url">Adres katalogu</label><input id="catalog-url" class="text-input" type="url" value="${esc(settings.catalogUrl || '')}" placeholder="https://konto.github.io/dexor/catalog.json"><small class="field-hint">Adres będzie publiczny dla wszystkich instalacji Dexora.</small><div class="divider"></div><div class="settings-card-title"><div class="settings-icon">⚡</div><div><h2>Fortnite</h2><p>Wybierz lokalny plik wykonywalny gry</p></div></div><div class="path-row"><input id="fortnite-path" class="text-input" readonly value="${esc(settings.fortnitePath || '')}" placeholder="Nie wybrano pliku Fortnite"><button class="button button-soft" data-action="choose-fortnite">Wybierz plik</button></div><div class="divider"></div><div class="settings-card-title"><div class="settings-icon">⊙</div><div><h2>Auto klikacz</h2><p>Ustawienia zostaną zachowane lokalnie</p></div></div><div class="settings-inline"><div><label class="field-label" for="settings-interval">Interwał kliknięcia</label><input id="settings-interval" class="text-input small-input" type="number" min="50" max="60000" step="50" value="${settings.clickerInterval || 500}"></div><div><label class="field-label" for="settings-button">Przycisk myszy</label><select id="settings-button" class="select-control"><option value="left" ${(settings.clickerButton || 'left') === 'left' ? 'selected' : ''}>Lewy</option><option value="right" ${settings.clickerButton === 'right' ? 'selected' : ''}>Prawy</option><option value="middle" ${settings.clickerButton === 'middle' ? 'selected' : ''}>Środkowy</option></select></div></div><button class="button button-primary save-settings" data-action="save-settings">Zapisz ustawienia</button></section>
    <aside class="settings-aside"><div class="side-info-card"><div class="info-spark">✳</div><h3>Twoje ustawienia<br>zostają u Ciebie.</h3><p>Dexor przechowuje lokalne profile, skróty i ustawienia na tym urządzeniu. Katalog udostępnia tylko listę szablonów.</p><div class="privacy-row"><i></i> BRAK KONTA · BRAK SYNCHRONIZACJI</div></div><div class="shortcut-card"><span class="eyebrow">SKRÓTY SYSTEMOWE</span><div><kbd>F6</kbd><span>Start / stop klikacza</span></div><div><kbd>F8</kbd><span>Natychmiast zatrzymaj makro</span></div></div></aside></div>`;
}

function render() {
  document.getElementById('current-page').textContent = titles[activeView];
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === activeView));
  document.getElementById('macro-count').textContent = state.installed.length;
  if (activeView === 'home') renderHome();
  if (activeView === 'library') renderLibrary();
  if (activeView === 'online') renderOnline();
  if (activeView === 'clicker') renderClicker();
  if (activeView === 'settings') renderSettings();
}

async function refreshState() {
  state = await window.dexor.getState();
  if (activeView !== 'online') render();
  document.getElementById('connection-state').textContent = catalog.length ? 'Połączono · katalog gotowy' : 'Wymaga konfiguracji';
  document.querySelector('.status-orb').classList.toggle('online', catalog.length > 0);
}

async function refreshCatalog(silent = false) {
  try {
    catalog = await window.dexor.getCatalog();
    document.getElementById('connection-state').textContent = `Połączono · ${catalog.length} makr`;
    document.querySelector('.status-orb').classList.add('online');
    if (!silent) showToast('Katalog online został odświeżony.', 'success');
  } catch (error) {
    catalog = [];
    document.getElementById('connection-state').textContent = 'Wymaga konfiguracji';
    document.querySelector('.status-orb').classList.remove('online');
    if (!silent) showToast(error.message, 'error');
  }
  render();
}

function defaultStep(type = 'wait') {
  if (type === 'click') return { type, x: 900, y: 500, button: 'left' };
  if (type === 'key') return { type, key: 'E' };
  if (type === 'waitColor') return { type, x: 900, y: 500, color: '#FFFFFF', tolerance: 24, timeoutMs: 30000 };
  if (type === 'fischTrack') return { type, auto: true };
  if (type === 'launchGame') return { type, game: 'fortnite' };
  return { type: 'wait', ms: 500 };
}

function stepRow(step, index) {
  let fields = '';
  if (step.type === 'click') fields = `<label>X <input data-step="${index}" data-field="x" type="number" value="${step.x}"></label><label>Y <input data-step="${index}" data-field="y" type="number" value="${step.y}"></label><label>Przycisk <select data-step="${index}" data-field="button"><option value="left" ${step.button === 'left' ? 'selected' : ''}>Lewy</option><option value="right" ${step.button === 'right' ? 'selected' : ''}>Prawy</option><option value="middle" ${step.button === 'middle' ? 'selected' : ''}>Środkowy</option></select></label>`;
  if (step.type === 'key') fields = `<label>Klawisz <input data-step="${index}" data-field="key" maxlength="12" value="${esc(step.key)}"></label>`;
  if (step.type === 'wait') fields = `<label>Czas <input data-step="${index}" data-field="ms" type="number" min="50" value="${step.ms}"></label><span class="field-suffix">ms</span>`;
  if (step.type === 'waitColor') fields = `<label>X <input data-step="${index}" data-field="x" type="number" value="${step.x}"></label><label>Y <input data-step="${index}" data-field="y" type="number" value="${step.y}"></label><label>Kolor <input data-step="${index}" data-field="color" type="color" value="${step.color || '#FFFFFF'}"></label><label>Tolerancja <input data-step="${index}" data-field="tolerance" type="number" min="0" max="100" value="${step.tolerance ?? 24}"></label><button class="mini-button" data-action="capture-color" data-index="${index}">Pobierz z ekranu</button>`;
  if (step.type === 'fischTrack') fields = `<span class="field-suffix">AUTOMATYCZNIE · skanuje ekran podczas działania</span>`;
  if (step.type === 'launchGame') fields = `<label>Gra <select data-step="${index}" data-field="game"><option value="fortnite" ${step.game === 'fortnite' ? 'selected' : ''}>Fortnite</option><option value="roblox" ${step.game === 'roblox' ? 'selected' : ''}>Roblox</option></select></label>`;
  const labels = { click: 'Kliknięcie', key: 'Naciśnij klawisz', wait: 'Czekaj', waitColor: 'Czekaj na kolor', fischTrack: 'Śledź rybę · auto', launchGame: 'Uruchom grę' };
  return `<div class="step-row"><span class="step-index">${String(index + 1).padStart(2, '0')}</span><select class="step-type" data-step-type="${index}">${Object.entries(labels).map(([value, label]) => `<option value="${value}" ${step.type === value ? 'selected' : ''}>${label}</option>`).join('')}</select><div class="step-fields">${fields}</div><button class="step-remove" data-action="remove-step" data-index="${index}" title="Usuń krok">×</button></div>`;
}

function openEditor(macro) {
  editor = structuredClone(macro || { id: `macro-${Date.now()}`, name: '', game: 'Fisch', version: '1.0.0', description: '', repeat: false, steps: [] });
  if (!Array.isArray(editor.steps)) editor.steps = [];
  if (editor.steps.length === 0) editor.steps.push(defaultStep());
  modalRoot.innerHTML = `<div class="modal-backdrop"><section class="editor-modal"><div class="modal-header"><div><span class="eyebrow">EDYTOR SEKWENCJI</span><h2>${esc(editor.name || 'Nowe makro')}</h2></div><button class="modal-close" data-action="close-modal">×</button></div><div class="editor-body"><div class="editor-main"><div class="editor-fields"><label>Nazwa makra<input id="edit-name" maxlength="90" value="${esc(editor.name)}" placeholder="Np. Fisch · Połów ryb"></label><label>Gra<input id="edit-game" maxlength="60" value="${esc(editor.game)}" placeholder="Nazwa gry"></label><label class="wide-field">Opis<input id="edit-description" maxlength="500" value="${esc(editor.description)}" placeholder="Co ma robić to makro?"></label><label class="repeat-toggle"><input id="edit-repeat" type="checkbox" ${editor.repeat ? 'checked' : ''}><span>Powtarzaj sekwencję do zatrzymania (F8)</span></label></div><div class="steps-heading"><div><span class="eyebrow">SEKWENCJA</span><h3>Kroki makra</h3></div><button class="button button-soft small-button" data-action="add-step">＋ Dodaj krok</button></div><div id="steps-list" class="steps-list">${editor.steps.map(stepRow).join('')}</div><div class="editor-note"><b>ⓘ</b><span>„Śledź rybę · auto” sam szuka minigry, toru i znacznika ryby na głównym ekranie. Działa tylko, gdy makro jest uruchomione; F8 je zatrzymuje.</span></div></div><aside class="capture-panel"><div class="capture-heading"><span class="eyebrow">PODGLĄD EKRANU</span><button class="mini-button" data-action="capture-screen">Zrób zrzut</button></div><div class="screen-preview" id="screen-preview"><div class="screen-placeholder"><span>▣</span><p>Zrzut ekranu pojawi się tutaj</p></div></div><small>Podgląd jest używany do ręcznego ustawiania zwykłych kroków.</small></aside></div><div class="modal-footer"><button class="button button-ghost" data-action="close-modal">Anuluj</button><button class="button button-primary" data-action="save-macro">Zapisz makro <span>→</span></button></div></section></div>`;
  modalRoot.querySelector('#edit-name').addEventListener('input', (event) => { editor.name = event.target.value; modalRoot.querySelector('.modal-header h2').textContent = editor.name || 'Nowe makro'; });
  modalRoot.querySelector('#edit-game').addEventListener('input', (event) => { editor.game = event.target.value; });
  modalRoot.querySelector('#edit-description').addEventListener('input', (event) => { editor.description = event.target.value; });
  modalRoot.querySelector('#edit-repeat').addEventListener('change', (event) => { editor.repeat = event.target.checked; });
  modalRoot.oninput = updateStepValue;
  modalRoot.onchange = (event) => {
    const typeIndex = Number(event.target.dataset.stepType);
    if (Number.isInteger(typeIndex) && editor?.steps[typeIndex]) {
      editor.captureMode = null;
      editor.steps[typeIndex] = defaultStep(event.target.value);
      editor.selectedIndex = typeIndex;
      modalRoot.querySelector('#steps-list').innerHTML = editor.steps.map(stepRow).join('');
      return;
    }
    updateStepValue(event);
  };
}

function updateStepValue(event) {
  const index = Number(event.target.dataset.step);
  const field = event.target.dataset.field;
  if (Number.isInteger(index) && field && editor?.steps[index]) {
    const value = event.target.type === 'number' ? Number(event.target.value) : event.target.value;
    editor.steps[index][field] = value;
  }
}

async function takeScreenShot() {
  const snapshot = await window.dexor.captureScreen();
  const preview = modalRoot.querySelector('#screen-preview');
  preview.innerHTML = `<img id="screen-image" src="${snapshot.dataUrl}" alt="Podgląd ekranu">`;
  const image = preview.querySelector('img');
  image.dataset.width = snapshot.width;
  image.dataset.height = snapshot.height;
}

function sampleFromPreview(event) {
  const image = event.target.closest('#screen-image');
  if (!image) return;
  const rect = image.getBoundingClientRect();
  const x = Math.max(0, Math.min(Number(image.dataset.width) - 1, Math.round((event.clientX - rect.left) / rect.width * Number(image.dataset.width))));
  const y = Math.max(0, Math.min(Number(image.dataset.height) - 1, Math.round((event.clientY - rect.top) / rect.height * Number(image.dataset.height))));
  const canvas = document.createElement('canvas');
  canvas.width = Number(image.dataset.width);
  canvas.height = Number(image.dataset.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const rgba = ctx.getImageData(x, y, 1, 1).data;
  const color = `#${[rgba[0], rgba[1], rgba[2]].map((item) => item.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  const selected = Number(editor.selectedIndex || 0);
  if (editor.captureMode && editor.steps[selected]?.type === 'fischTrack') {
    const step = editor.steps[selected];
    if (editor.captureMode === 'track-left') {
      step.left = x;
      step.trackY = y;
      showToast(`Zapisano lewy brzeg toru · ${x}, ${y}`, 'success');
    } else if (editor.captureMode === 'track-right') {
      if (step.left < 0) { showToast('Najpierw wskaż lewy brzeg toru.', 'error'); return; }
      if (x <= step.left) { showToast('Prawy brzeg musi być na prawo od lewego.', 'error'); return; }
      if (Math.abs(y - step.trackY) > 18) { showToast('Kliknij prawy brzeg na tej samej wysokości co lewy.', 'error'); return; }
      step.right = x;
      step.rightY = y;
      step.trackY = Math.round((step.trackY + y) / 2);
      showToast(`Zapisano prawy brzeg toru · ${x}, ${y}`, 'success');
    } else if (editor.captureMode === 'fish') {
      if (x < 4 || x > canvas.width - 5 || y < 4 || y > canvas.height - 5) { showToast('Wskaż rybę nie bliżej niż 5 pikseli od krawędzi obrazu.', 'error'); return; }
      if (step.left < 0 || step.right <= step.left) { showToast('Najpierw wskaż oba brzegi toru.', 'error'); return; }
      if (x < step.left + 5 || x > step.right - 5 || Math.abs(y - step.trackY) > 18) { showToast('Kliknij znacznik ryby na torze, mniej więcej na jego środku.', 'error'); return; }
      const pixels = [];
      for (const dy of [-4, -2, 0, 2, 4]) {
        for (const dx of [-4, -2, 0, 2, 4]) {
          const sample = ctx.getImageData(x + dx, y + dy, 1, 1).data;
          pixels.push(sample[0], sample[1], sample[2]);
        }
      }
      step.fishY = y;
      step.template = pixels;
      showToast(`Zapisano próbkę znacznika ryby · ${x}, ${y}`, 'success');
    }
    editor.captureMode = null;
    modalRoot.querySelector('#steps-list').innerHTML = editor.steps.map(stepRow).join('');
    return;
  }
  if (!editor.steps[selected]) editor.steps[selected] = defaultStep('waitColor');
  if (editor.steps[selected].type !== 'waitColor') editor.steps[selected] = defaultStep('waitColor');
  Object.assign(editor.steps[selected], { x, y, color });
  editor.needsCalibration = false;
  editor.selectedIndex = selected;
  const list = modalRoot.querySelector('#steps-list');
  list.innerHTML = editor.steps.map(stepRow).join('');
  showToast(`Pobrano punkt ${x}, ${y} · ${color}`, 'success');
}

async function handleAction(action, id, element) {
  try {
    if (action === 'navigate') { activeView = element.dataset.view; modalRoot.innerHTML = ''; render(); return; }
    if (action === 'refresh') { await refreshCatalog(); return; }
    if (action === 'install') { state.installed = await window.dexor.installMacro(id); await refreshState(); activeView = 'library'; render(); showToast('Makro zainstalowane. Otwórz je, aby ustawić parametry.', 'success'); return; }
    if (action === 'edit') { const macro = state.installed.find((item) => item.id === id); if (macro) openEditor(macro); return; }
    if (action === 'new-macro') { openEditor(); return; }
    if (action === 'run') {
      if (state.activeMacroId === id) await window.dexor.stopMacro();
      else { await window.dexor.runMacro(id); showToast('Makro uruchomione · F8 zatrzymuje odtwarzanie.', 'success'); }
      state = await window.dexor.getState(); render(); return;
    }
    if (action === 'delete') { state.installed = await window.dexor.deleteMacro(id); render(); showToast('Usunięto lokalną kopię makra.', 'info'); return; }
    if (action === 'close-modal') { modalRoot.innerHTML = ''; editor = null; return; }
    if (action === 'add-step') { editor.steps.push(defaultStep('wait')); editor.selectedIndex = editor.steps.length - 1; modalRoot.querySelector('#steps-list').innerHTML = editor.steps.map(stepRow).join(''); return; }
    if (action === 'remove-step') { editor.steps.splice(Number(element.dataset.index), 1); if (!editor.steps.length) editor.steps.push(defaultStep()); modalRoot.querySelector('#steps-list').innerHTML = editor.steps.map(stepRow).join(''); return; }
    if (action === 'capture-screen') { await takeScreenShot(); return; }
    if (action === 'capture-color') { editor.selectedIndex = Number(element.dataset.index); await takeScreenShot(); showToast('Kliknij na zrzucie ekranu, aby pobrać punkt i kolor.', 'info'); return; }
    if (['capture-track-left', 'capture-track-right', 'capture-fish'].includes(action)) {
      editor.selectedIndex = Number(element.dataset.index);
      editor.captureMode = action === 'capture-track-left' ? 'track-left' : action === 'capture-track-right' ? 'track-right' : 'fish';
      await takeScreenShot();
      const instruction = editor.captureMode === 'track-left' ? 'Kliknij lewy brzeg toru na jego środku.' : editor.captureMode === 'track-right' ? 'Kliknij prawy brzeg na tej samej wysokości.' : 'Kliknij pionowy znacznik ryby tam, gdzie przecina środek toru.';
      showToast(instruction, 'info');
      return;
    }
    if (action === 'save-macro') {
      editor.name = modalRoot.querySelector('#edit-name').value.trim() || 'Moje makro';
      editor.game = modalRoot.querySelector('#edit-game').value.trim() || 'Inne';
      editor.description = modalRoot.querySelector('#edit-description').value.trim();
      editor.repeat = modalRoot.querySelector('#edit-repeat').checked;
      state.installed = await window.dexor.saveMacro(editor);
      modalRoot.innerHTML = ''; editor = null; render(); showToast('Makro zapisane lokalnie.', 'success'); return;
    }
    if (action === 'choose-fortnite') { const chosen = await window.dexor.chooseFortnite(); const input = document.getElementById('fortnite-path'); if (input) input.value = chosen || ''; showToast(chosen ? 'Zapisano ścieżkę Fortnite.' : 'Nie wybrano pliku.', chosen ? 'success' : 'info'); return; }
    if (action === 'save-settings') {
      const values = {
        catalogUrl: document.getElementById('catalog-url').value.trim(),
        fortnitePath: document.getElementById('fortnite-path').value,
        clickerInterval: Number(document.getElementById('settings-interval').value),
        clickerButton: document.getElementById('settings-button').value
      };
      state.settings = await window.dexor.setSettings(values);
      await refreshCatalog(true); showToast('Zapisano ustawienia.', 'success'); return;
    }
    if (action === 'clicker-toggle') {
      const interval = Number(document.getElementById('click-interval').value);
      const button = document.getElementById('click-button').value;
      state.settings = await window.dexor.setSettings({ ...state.settings, clickerInterval: interval, clickerButton: button });
      await window.dexor.toggleClicker(); state = await window.dexor.getState(); render(); return;
    }
  } catch (error) { showToast(error.message || 'Wystąpił błąd.', 'error'); }
}

document.body.addEventListener('click', (event) => {
  const nav = event.target.closest('.nav-item');
  if (nav) { activeView = nav.dataset.view; render(); return; }
  if (event.target.closest('#refresh-catalog')) { refreshCatalog(); return; }
  if (event.target.closest('#top-stop')) { window.dexor.stopMacro(); return; }
  if (event.target.closest('#screen-image')) { sampleFromPreview(event); return; }
  const filter = event.target.closest('[data-filter]');
  if (filter) { catalogFilter = filter.dataset.filter; renderOnline(); return; }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  handleAction(button.dataset.action, button.dataset.id, button);
});

content.addEventListener('input', (event) => {
  if (event.target.id !== 'macro-search') return;
  const query = event.target.value.toLowerCase();
  const filtered = state.installed.filter((item) => `${item.name} ${item.game} ${item.description}`.toLowerCase().includes(query));
  const grid = document.getElementById('macro-grid');
  if (grid) grid.innerHTML = filtered.map((item) => macroCard(item)).join('') || '<div class="empty-search">Brak wyników wyszukiwania.</div>';
});

window.dexor.onStatus((event) => {
  showToast(event.message, event.kind);
  window.dexor.getState().then((next) => { state = next; render(); });
});
window.dexor.onClickerCount((count) => {
  clickCount = count;
  const node = document.getElementById('click-count');
  if (node) node.textContent = fmtNumber(count);
});

window.dexor.getState().then((next) => { state = next; render(); refreshCatalog(true); }).catch((error) => showToast(error.message, 'error'));
