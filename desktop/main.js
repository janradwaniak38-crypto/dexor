const { app, BrowserWindow, ipcMain, desktopCapturer, screen, shell, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { PNG } = require('pngjs');

const DEFAULT_CATALOG = require('./config.json').catalogUrl;
const allowedKeys = new Set([
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''), 'SPACE', 'ENTER', 'TAB', 'ESC', 'BACKSPACE',
  'SHIFT', 'CTRL', 'ALT', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
  'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
]);

let mainWindow;
let activeRun = null;
let clickerTimer = null;
let clickerCount = 0;
let clickerBusy = false;
let settings;
let installed = [];

function dataFile(name) { return path.join(app.getPath('userData'), name); }
function loadJson(name, fallback) {
  try { return JSON.parse(fs.readFileSync(dataFile(name), 'utf8')); }
  catch { return fallback; }
}
function saveJson(name, value) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(dataFile(name), JSON.stringify(value, null, 2), 'utf8');
}
function sendStatus(message, kind = 'info') {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('status', { message, kind });
}
function cleanId(value) {
  const id = String(value || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{1,70}$/i.test(id)) throw new Error('Nieprawidłowy identyfikator makra.');
  return id;
}
function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}
function validateMacro(input) {
  const macro = {
    id: cleanId(input.id),
    name: String(input.name || 'Nowe makro').slice(0, 90),
    game: String(input.game || 'Inne').slice(0, 60),
    category: String(input.category || '').slice(0, 40),
    tags: Array.isArray(input.tags) ? input.tags.slice(0, 12).map((tag) => String(tag).slice(0, 30)) : [],
    version: String(input.version || '1.0.0').slice(0, 30),
    description: String(input.description || '').slice(0, 500),
    repeat: Boolean(input.repeat),
    needsCalibration: Boolean(input.needsCalibration),
    steps: []
  };
  if (!Array.isArray(input.steps) || input.steps.length > 100) throw new Error('Makro może mieć maksymalnie 100 kroków.');
  macro.steps = input.steps.map((step) => {
    if (!step || typeof step !== 'object') throw new Error('Nieprawidłowy krok makra.');
    if (step.type === 'wait') return { type: 'wait', ms: clampNumber(step.ms, 50, 600000, 500) };
    if (step.type === 'click') return {
      type: 'click', x: clampNumber(step.x, 0, 12000, 960), y: clampNumber(step.y, 0, 12000, 540),
      button: ['left', 'right', 'middle'].includes(step.button) ? step.button : 'left'
    };
    if (step.type === 'key') {
      const key = String(step.key || '').toUpperCase();
      if (!allowedKeys.has(key)) throw new Error(`Klawisz „${key}” nie jest obsługiwany.`);
      return { type: 'key', key };
    }
    if (step.type === 'waitColor') {
      const color = String(step.color || '').toUpperCase();
      if (!/^#[0-9A-F]{6}$/.test(color)) throw new Error('Kolor musi mieć format #RRGGBB.');
      return {
        type: 'waitColor', x: clampNumber(step.x, 0, 12000, 960), y: clampNumber(step.y, 0, 12000, 540),
        color, tolerance: clampNumber(step.tolerance, 0, 100, 24), timeoutMs: clampNumber(step.timeoutMs, 1000, 180000, 30000)
      };
    }
    if (step.type === 'fischTrack') {
      const template = Array.isArray(step.template) && step.template.length === 75
        ? step.template.slice(0, 75).map((value) => clampNumber(value, 0, 255, 0))
        : [];
      return {
        type: 'fischTrack',
        left: clampNumber(step.left, -1, 12000, -1), right: clampNumber(step.right, -1, 12000, -1),
        trackY: clampNumber(step.trackY, -1, 12000, -1), fishY: clampNumber(step.fishY, -1, 12000, -1),
        template
      };
    }
    if (step.type === 'launchGame') {
      const game = String(step.game || '').toLowerCase();
      if (!['fortnite', 'roblox'].includes(game)) throw new Error('Nieobsługiwana gra.');
      return { type: 'launchGame', game };
    }
    throw new Error(`Nieobsługiwany typ kroku: ${String(step.type)}`);
  });
  return macro;
}

function makeWindow() {
  mainWindow = new BrowserWindow({
    width: 1380, height: 900, minWidth: 1040, minHeight: 680,
    backgroundColor: '#0a0b10', title: 'Dexor',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

function getNativeScript() {
  return app.isPackaged ? path.join(process.resourcesPath, 'native.ps1') : path.join(__dirname, 'native.ps1');
}
function nativeAction(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', getNativeScript(), ...args.map(String)], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || `Natywna akcja zakończyła się kodem ${code}.`)));
  });
}

async function capturePrimary() {
  const restoreWindow = Boolean(mainWindow && mainWindow.isVisible());
  if (restoreWindow) {
    mainWindow.hide();
    await sleep(350);
  }
  try {
  const display = screen.getPrimaryDisplay();
  const thumbW = Math.max(320, Math.min(1920, display.size.width));
  const thumbH = Math.max(240, Math.min(1080, display.size.height));
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: thumbW, height: thumbH } });
  const source = sources.find((item) => item.display_id === String(display.id)) || sources[0];
  if (!source || source.thumbnail.isEmpty()) throw new Error('Nie udało się pobrać obrazu ekranu.');
  const size = source.thumbnail.getSize();
  return { png: source.thumbnail.toPNG(), dataUrl: source.thumbnail.toDataURL(), width: size.width, height: size.height, scaleFactor: display.scaleFactor };
  } finally {
    if (restoreWindow && mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  }
}

async function readScreenPixel(x, y) {
  const capture = await capturePrimary();
  const image = PNG.sync.read(capture.png);
  const px = Math.max(0, Math.min(image.width - 1, Math.round(Number(x))));
  const py = Math.max(0, Math.min(image.height - 1, Math.round(Number(y))));
  const index = (image.width * py + px) * 4;
  const [r, g, b] = image.data.slice(index, index + 3);
  return { r, g, b, hex: `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}` };
}

function closeEnough(actual, target, tolerance) {
  const values = actual.match(/[A-F0-9]{2}/gi).map((v) => parseInt(v, 16));
  const expected = target.match(/[A-F0-9]{2}/gi).map((v) => parseInt(v, 16));
  return values.every((value, i) => Math.abs(value - expected[i]) <= tolerance * 2.55);
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function stopRun(reason = 'Makro zatrzymane.') {
  if (activeRun) {
    const run = activeRun;
    run.cancelled = true;
    activeRun = null;
    releaseRunMouse(run);
    sendStatus(reason, 'warn');
  }
}

function nativeScreenPoint(x, y, capture) {
  const display = screen.getPrimaryDisplay();
  return [
    Math.round(x / capture.width * display.size.width * display.scaleFactor),
    Math.round(y / capture.height * display.size.height * display.scaleFactor)
  ];
}

async function setRunMouse(run, held, point) {
  if (run.mouseHeld === held) return;
  const [x, y] = point ? nativeScreenPoint(point.x, point.y, point.capture) : [-1, -1];
  await nativeAction([held ? 'MouseDown' : 'MouseUp', x, y, 'left']);
  run.mouseHeld = held;
  if (held && run.cancelled) {
    await nativeAction(['MouseUp', -1, -1, 'left']);
    run.mouseHeld = false;
  }
}

function releaseRunMouse(run) {
  if (!run.mouseHeld) return;
  run.mouseHeld = false;
  nativeAction(['MouseUp', -1, -1, 'left']).catch(() => {});
}

function sampleRgb(image, x, y) {
  const px = Math.max(0, Math.min(image.width - 1, x));
  const py = Math.max(0, Math.min(image.height - 1, y));
  const offset = (py * image.width + px) * 4;
  return [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
}

function locateFish(image, step) {
  const offsets = [-4, -2, 0, 2, 4];
  let bestX = -1;
  let bestScore = Infinity;
  const first = Math.max(step.left + 5, 5);
  const last = Math.min(step.right - 5, image.width - 5);
  for (let x = first; x <= last; x += 1) {
    let difference = 0;
    let samples = 0;
    let templateIndex = 0;
    for (const dy of offsets) {
      for (const dx of offsets) {
        const rgb = sampleRgb(image, x + dx, step.fishY + dy);
        difference += Math.abs(rgb[0] - step.template[templateIndex++]);
        difference += Math.abs(rgb[1] - step.template[templateIndex++]);
        difference += Math.abs(rgb[2] - step.template[templateIndex++]);
        samples += 3;
      }
    }
    const score = difference / samples;
    if (score < bestScore) { bestScore = score; bestX = x; }
  }
  if (bestX < 0 || bestScore > 68) return null;
  return { x: bestX, score: bestScore };
}

function locateBar(image, step) {
  let bestStart = -1;
  let bestEnd = -1;
  let runStart = -1;
  for (let x = step.left; x <= step.right; x += 1) {
    const [r, g, b] = sampleRgb(image, x, step.trackY);
    const isBright = r + g + b > 390 && Math.min(r, g, b) > 65;
    if (isBright && runStart < 0) runStart = x;
    if ((!isBright || x === step.right) && runStart >= 0) {
      const runEnd = isBright && x === step.right ? x : x - 1;
      if (runEnd - runStart > bestEnd - bestStart) { bestStart = runStart; bestEnd = runEnd; }
      runStart = -1;
    }
  }
  if (bestStart < 0 || bestEnd - bestStart < (step.right - step.left) * 0.12) return null;
  return { left: bestStart, right: bestEnd, center: (bestStart + bestEnd) / 2 };
}

async function trackFisch(step, run) {
  if (step.left < 0 || step.right <= step.left || step.trackY < 0 || step.fishY < 0 || step.template.length !== 75) {
    throw new Error('Skonfiguruj krok „Śledź rybę”: wskaż oba końce toru i znacznik ryby.');
  }
  let lastFish = null;
  let lastFishAt = 0;
  let velocity = 0;
  let wasDetected = false;
  while (!run.cancelled) {
    const capture = await capturePrimary();
    const image = PNG.sync.read(capture.png);
    const bar = locateBar(image, step);
    const fish = locateFish(image, step);
    const now = Date.now();
    if (fish && bar) {
      if (lastFish) {
        const elapsed = Math.max(0.05, (now - lastFishAt) / 1000);
        const instantVelocity = Math.max(-420, Math.min(420, (fish.x - lastFish.x) / elapsed));
        velocity = velocity * 0.55 + instantVelocity * 0.45;
      }
      lastFish = fish;
      lastFishAt = now;
      wasDetected = true;
      const predictedFish = fish.x + velocity * 0.12;
      const error = predictedFish - bar.center;
      const inputPoint = { x: bar.center, y: step.trackY, capture };
      if (error > (run.mouseHeld ? 8 : 14)) await setRunMouse(run, true, inputPoint);
      else if (error < (run.mouseHeld ? -8 : -14)) await setRunMouse(run, false, inputPoint);
      if (now - (run.lastFishStatusAt || 0) > 2500) {
        run.lastFishStatusAt = now;
        sendStatus('Fisch · śledzę rybę na torze.', 'success');
      }
    } else if (wasDetected && now - lastFishAt > 1400) {
      await setRunMouse(run, false, { x: (step.left + step.right) / 2, y: step.trackY, capture });
      return;
    }
    await sleep(100);
  }
  await setRunMouse(run, false);
}

async function executeStep(step, run) {
  if (run.cancelled) return;
  if (step.type === 'wait') return sleep(step.ms);
  if (step.type === 'click') {
    const snapshot = await capturePrimary();
    const display = screen.getPrimaryDisplay();
    const x = Math.round(step.x / snapshot.width * display.size.width * display.scaleFactor);
    const y = Math.round(step.y / snapshot.height * display.size.height * display.scaleFactor);
    return nativeAction(['Click', x, y, step.button]);
  }
  if (step.type === 'key') return nativeAction(['Key', step.key]);
  if (step.type === 'launchGame') return openGame(step.game);
  if (step.type === 'fischTrack') return trackFisch(step, run);
  if (step.type === 'waitColor') {
    const endAt = Date.now() + step.timeoutMs;
    while (!run.cancelled && Date.now() < endAt) {
      const pixel = await readScreenPixel(step.x, step.y);
      if (closeEnough(pixel.hex, step.color, step.tolerance)) return;
      await sleep(250);
    }
    if (!run.cancelled) throw new Error(`Nie wykryto koloru ${step.color} na ekranie przed upływem czasu.`);
  }
}

async function runMacro(id) {
  if (activeRun) stopRun('Poprzednie makro zatrzymane.');
  const macro = installed.find((item) => item.id === id);
  if (!macro) throw new Error('Nie znaleziono zainstalowanego makra.');
  const checked = validateMacro(macro);
  if (!checked.steps.length) throw new Error('Dodaj kroki w edytorze przed uruchomieniem.');
  if (checked.needsCalibration) throw new Error('Najpierw skalibruj punkt oczekiwania w edytorze, wybierając kolor z ekranu.');
  const run = { id, cancelled: false, mouseHeld: false };
  activeRun = run;
  sendStatus(`Uruchomiono: ${macro.name}`, 'success');
  if (mainWindow && mainWindow.isVisible()) mainWindow.minimize();
  try {
    await sleep(350);
    do {
      for (const step of checked.steps) {
        if (run.cancelled) break;
        await executeStep(step, run);
      }
    } while (checked.repeat && !run.cancelled);
  } catch (error) {
    sendStatus(error.message, 'error');
  } finally {
    await setRunMouse(run, false).catch(() => {});
    if (activeRun === run) {
      activeRun = null;
      sendStatus(`Zakończono: ${macro.name}`, 'info');
    }
  }
  return { ok: true };
}

async function openGame(game) {
  if (game === 'roblox') {
    await shell.openExternal('roblox://');
    return true;
  }
  const gamePath = settings.fortnitePath;
  if (!gamePath || !fs.existsSync(gamePath)) throw new Error('Wybierz plik FortniteClient-Win64-Shipping.exe w Ustawieniach.');
  const result = await shell.openPath(gamePath);
  if (result) throw new Error(result);
  return true;
}

function toggleClicker(force) {
  if (clickerTimer) {
    clearTimeout(clickerTimer);
    clearInterval(clickerTimer);
    clickerTimer = null;
    sendStatus('Klikacz zatrzymany.', 'info');
    return false;
  }
  if (force === false) return false;
  clickerCount = 0;
  const interval = clampNumber(settings.clickerInterval, 50, 60000, 500);
  const tick = () => {
    if (clickerBusy) return;
    clickerBusy = true;
    nativeAction(['Click', -1, -1, settings.clickerButton || 'left']).then(() => {
      clickerCount += 1;
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('clicker:count', clickerCount);
    }).catch((error) => { toggleClicker(false); sendStatus(error.message, 'error'); }).finally(() => { clickerBusy = false; });
  };
  if (mainWindow && mainWindow.isVisible()) mainWindow.minimize();
  clickerTimer = setTimeout(() => { if (clickerTimer) clickerTimer = setInterval(tick, interval); }, 350);
  sendStatus(`Klikacz działa · ${interval} ms`, 'success');
  return true;
}

function validateSettings(input) {
  const next = { ...settings };
  if (typeof input.catalogUrl === 'string') {
    const candidate = input.catalogUrl.trim();
    if (candidate) {
      const url = new URL(candidate);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Adres katalogu musi zaczynać się od http:// lub https://.');
      next.catalogUrl = url.toString();
    }
  }
  if (input.fortnitePath !== undefined) next.fortnitePath = String(input.fortnitePath).slice(0, 500);
  if (input.clickerInterval !== undefined) next.clickerInterval = clampNumber(input.clickerInterval, 50, 60000, 500);
  if (input.clickerButton !== undefined) next.clickerButton = ['left', 'right', 'middle'].includes(input.clickerButton) ? input.clickerButton : 'left';
  return next;
}

function registerIpc() {
  ipcMain.handle('state:get', () => ({ settings, installed, activeMacroId: activeRun?.id || null, clickerActive: Boolean(clickerTimer) }));
  ipcMain.handle('catalog:get', async () => {
    const response = await fetch(settings.catalogUrl, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error(`Katalog zwrócił HTTP ${response.status}.`);
    const catalog = await response.json();
    if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.packages)) throw new Error('Nieprawidłowy format katalogu Dexor.');
    return catalog.packages.map((item) => validateMacro(item));
  });
  ipcMain.handle('macro:install', async (_event, rawId) => {
    const id = cleanId(rawId);
    const response = await fetch(settings.catalogUrl, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error(`Katalog zwrócił HTTP ${response.status}.`);
    const catalog = await response.json();
    const incoming = catalog.packages?.find((item) => item.id === id);
    if (!incoming) throw new Error('Makra nie ma w katalogu online.');
    const macro = validateMacro(incoming);
    macro.installedAt = new Date().toISOString();
    installed = [...installed.filter((item) => item.id !== id), macro];
    saveJson('macros.json', installed);
    return installed;
  });
  ipcMain.handle('macro:save', (_event, input) => {
    const macro = validateMacro(input);
    installed = [...installed.filter((item) => item.id !== macro.id), macro];
    saveJson('macros.json', installed);
    return installed;
  });
  ipcMain.handle('macro:delete', (_event, rawId) => {
    const id = cleanId(rawId);
    stopRun('Makro usunięte; odtwarzanie zatrzymane.');
    installed = installed.filter((item) => item.id !== id);
    saveJson('macros.json', installed);
    return installed;
  });
  ipcMain.handle('macro:run', (_event, rawId) => { runMacro(cleanId(rawId)).catch((error) => sendStatus(error.message, 'error')); return { ok: true }; });
  ipcMain.handle('macro:stop', () => { stopRun(); return true; });
  ipcMain.handle('screen:capture', async () => {
    const capture = await capturePrimary();
    return { dataUrl: capture.dataUrl, width: capture.width, height: capture.height };
  });
  ipcMain.handle('game:open', (_event, game) => openGame(String(game).toLowerCase()));
  ipcMain.handle('settings:set', (_event, input) => {
    settings = validateSettings(input || {});
    saveJson('settings.json', settings);
    return settings;
  });
  ipcMain.handle('game:choose-fortnite', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Wskaż plik Fortnite', properties: ['openFile'], filters: [{ name: 'Program', extensions: ['exe'] }]
    });
    if (result.canceled || !result.filePaths[0]) return settings.fortnitePath;
    settings.fortnitePath = result.filePaths[0];
    saveJson('settings.json', settings);
    return settings.fortnitePath;
  });
  ipcMain.handle('clicker:toggle', () => toggleClicker());
  ipcMain.handle('clicker:config', (_event, input) => {
    settings = validateSettings(input || {});
    saveJson('settings.json', settings);
    if (clickerTimer) { toggleClicker(false); toggleClicker(); }
    return settings;
  });
}

app.whenReady().then(() => {
  settings = { catalogUrl: DEFAULT_CATALOG, fortnitePath: '', clickerInterval: 500, clickerButton: 'left', ...loadJson('settings.json', {}) };
  installed = loadJson('macros.json', []);
  registerIpc();
  makeWindow();
  globalShortcut.register('F8', () => stopRun('F8 · zatrzymano makro.'));
  globalShortcut.register('F6', () => toggleClicker());
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) makeWindow(); });
});

app.on('will-quit', () => {
  stopRun('Dexor został zamknięty.');
  if (clickerTimer) clearInterval(clickerTimer);
  globalShortcut.unregisterAll();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
