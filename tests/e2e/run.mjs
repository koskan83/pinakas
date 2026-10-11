/**
 * Δοκιμές που πατάνε κουμπιά στην πραγματική εφαρμογή (χτισμένη στο dist/), μέσα σε Chrome χωρίς παράθυρο.
 * Τρέχει με: npm run test:e2e
 * Το Google Drive και η σύνδεση της Google αντικαθίστανται με ψεύτικες απαντήσεις: δεν ανεβαίνει τίποτα πουθενά.
 */
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const PORT = 4188;
const URL_ = `http://localhost:${PORT}/`;

function findChrome() {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  for (const cmd of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try {
      const p = execSync(`command -v ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      if (p) return p;
    } catch { /* δεν υπάρχει */ }
  }
  const cache = join(homedir(), '.cache', 'ms-playwright');
  if (existsSync(cache)) {
    for (const d of readdirSync(cache).sort().reverse()) {
      for (const rel of ['chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-linux64/chrome', 'chrome-linux/chrome']) {
        const p = join(cache, d, rel);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

const exe = findChrome();
if (!exe) {
  console.error('Δεν βρέθηκε Chrome. Όρισε τη μεταβλητή CHROME με τη διαδρομή του.');
  process.exit(2);
}
if (!existsSync('dist/index.html')) {
  console.error('Λείπει το dist/. Τρέξε πρώτα: npm run build');
  process.exit(2);
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-server.pid); } catch { /* ήδη κλειστό */ } };
process.on('exit', stop);
for (let i = 0; ; i++) {
  try { if ((await fetch(URL_)).ok) break; } catch { /* δεν ξεκίνησε ακόμα */ }
  if (i > 80) { console.error('Ο διακομιστής προεπισκόπησης δεν ξεκίνησε'); process.exit(2); }
  await new Promise((r) => setTimeout(r, 250));
}

const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, acceptDownloads: true, locale: 'el-GR' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

// ψεύτικη Google: η σύνδεση πετυχαίνει αμέσως και το Drive δέχεται ό,τι του στείλεις
const drive = { uploads: 0, perms: 0 };
await ctx.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({
  contentType: 'text/javascript',
  body: `window.google={accounts:{oauth2:{initTokenClient:(o)=>({requestAccessToken:()=>setTimeout(()=>o.callback({access_token:'fake',expires_in:3600}),10)})}}};`,
}));
// ψεύτικο AI: απαντά πάντα ότι η σημειωμένη επιλογή είναι σωστή
const aiCalls = [];
await ctx.route('https://generativelanguage.googleapis.com/**', (r) => {
  const body = r.request().postDataJSON();
  aiCalls.push({ image: body.contents[0].parts[0].inline_data?.data?.length ?? 0, prompt: body.contents[0].parts[1].text });
  return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '✓ Σωστή επιλογή: το 2' }] } }] }) });
});
await ctx.route('https://www.googleapis.com/**', (r) => {
  const req = r.request();
  const u = new URL(req.url());
  let body = { id: 'x' };
  if (req.method() === 'GET') body = { files: [{ id: 'folder' }] };
  else if (u.pathname.startsWith('/upload')) { drive.uploads++; body = { id: 'file1' }; }
  else if (u.pathname.endsWith('/permissions')) drive.perms++;
  return r.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
});

const tmp = mkdtempSync(join(tmpdir(), 'prismaboard-e2e-'));
process.on('exit', () => rmSync(tmp, { recursive: true, force: true }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const visible = (sel) => page.locator(sel).isVisible();
async function drag(x0, y0, x1, y1, steps = 12) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps });
  await page.mouse.up();
}
async function lasso(x0, y0, x1, y1) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (const [x, y] of [[x1, y0], [x1, y1], [x0, y1], [x0, y0]]) await page.mouse.move(x, y, { steps: 8 });
  await page.mouse.up();
}
const tool = (name) => page.click(`#tools [data-tool="${name}"], [data-tool="${name}"]`);
const pen = () => page.click('#penBtn');
async function download(action) {
  const [d] = await Promise.all([page.waitForEvent('download'), action()]);
  // με το πραγματικό όνομα, για να έχει το αρχείο τη σωστή κατάληξη όταν το ξαναδώσουμε στην εφαρμογή
  const to = join(tmp, d.suggestedFilename());
  await d.saveAs(to);
  return to;
}
/** Το μάθημα όπως το αποθηκεύει η ίδια η εφαρμογή σε αρχείο: έτσι βλέπουμε τι υπάρχει πραγματικά στον πίνακα. */
async function doc() {
  const p = await download(async () => {
    await page.click('#menuBtn');
    await page.click('#menu [data-act="more"]');
    await page.click('#setMenu [data-act="save"]');
  });
  return JSON.parse(readFileSync(p, 'utf8'));
}
const items = async (pi = 0) => (await doc()).pages[pi].items;
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('Πρώτη φορά: η οθόνη γνωριμίας εμφανίζεται και κλείνει με το «Ξεκίνα»', async () => {
  assert(await visible('#welcome'), 'δεν εμφανίστηκε η οθόνη πρώτης χρήσης');
  await page.click('#wGo');
  assert(!(await visible('#welcome')), 'η οθόνη πρώτης χρήσης δεν έκλεισε');
  await page.reload();
  await page.waitForSelector('#toolbar');
  await sleep(400);
  assert(!(await visible('#welcome')), 'η οθόνη πρώτης χρήσης ξαναβγήκε στη δεύτερη φορά');
});

test('Γραφή, αναίρεση, επανάληψη', async () => {
  await pen();
  assert(await page.isDisabled('#undo'), 'η αναίρεση έπρεπε να είναι ανενεργή σε κενό πίνακα');
  await drag(300, 200, 520, 240);
  await drag(300, 280, 520, 320);
  assert((await items()).filter((i) => i.kind === 'stroke').length === 2, 'δεν γράφτηκαν δύο γραμμές');
  await page.click('#undo');
  assert((await items()).length === 1, 'η αναίρεση δεν αφαίρεσε τη γραμμή');
  await page.click('#redo');
  assert((await items()).length === 2, 'η επανάληψη δεν την έφερε πίσω');
});

test('Γόμα ολόκληρης γραμμής', async () => {
  await tool('eraser');
  await page.click('[data-eraser="stroke"]');
  await drag(400, 180, 400, 260);
  assert((await items()).length === 1, 'η γόμα δεν έσβησε τη γραμμή');
});

test('Σχήμα από τα Όργανα, επιλογή και διαγραφή από τη μπάρα δίπλα του', async () => {
  await page.click('#gadgetBtn');
  await page.click('#gadgetMenu [data-shape="triangle"]');
  await drag(700, 200, 900, 380);
  const it = await items();
  assert(it.some((i) => i.kind === 'shape' && i.shape === 'triangle'), 'δεν μπήκε τρίγωνο');
  await tool('select');
  await page.mouse.click(800, 380);
  assert(await visible('#selOpts #del'), 'δεν εμφανίστηκε η μπάρα ενεργειών δίπλα στην επιλογή');
  assert(!(await visible('#selOpts [data-rec="solve"]')), 'το «Λύση» δεν έπρεπε να φαίνεται σε σκέτο σχήμα');
  await page.click('#selOpts #dup');
  assert((await items()).filter((i) => i.kind === 'shape').length === 2, 'το αντίγραφο δεν έγινε');
  await page.click('#selOpts #del');
  assert((await items()).filter((i) => i.kind === 'shape').length === 1, 'η διαγραφή δεν έγινε');
});

test('Λάσο σε χειρόγραφο: εμφανίζονται αναγνώριση, λύση και έλεγχος', async () => {
  await tool('select');
  await lasso(260, 250, 560, 350);
  for (const k of ['text', 'math', 'solve', 'check']) assert(await visible(`#selOpts [data-rec="${k}"]`), `λείπει το κουμπί «${k}»`);
  await page.mouse.click(1000, 600);
});

test('Πίνακας 3 × 3 ως ορίζουσα', async () => {
  await page.click('#gadgetBtn');
  await page.click('#gadgetMenu .tiles:not(#recentTiles) [data-ins="table"]');
  await page.click('#tblStyles [data-tbl="det"]');
  await page.click('#tblGrid [data-r="3"][data-c="3"]');
  const t = (await items()).find((i) => i.shape === 'table');
  assert(t && t.grid.r === 3 && t.grid.c === 3 && t.grid.style === 'det', 'δεν μπήκε ορίζουσα 3 × 3');
});

test('Άξονες, τριγωνομετρικός κύκλος και μετρήσεις σχεδιάζονται', async () => {
  const inked = () => page.evaluate(() => {
    const cv = document.getElementById('base');
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0 && d[i - 1] + d[i - 2] + d[i - 3] < 600) n++;
    return n;
  });
  const before = await inked();
  await page.click('#gadgetBtn');
  await page.click('#gadgetMenu .tiles:not(#recentTiles) [data-axes="full"]');
  await page.click('#gadgetBtn');
  await page.click('#gadgetMenu .tiles:not(#recentTiles) [data-ins="trig"]');
  const it = await items();
  assert(it.some((i) => i.kind === 'axes') && it.some((i) => i.kind === 'trig'), 'δεν μπήκαν άξονες και τριγωνομετρικός κύκλος');
  // μετρήσεις στο τρίγωνο: άγγιγμα με τον χάρακα ανάβει τα μήκη
  await tool('measure');
  await page.mouse.click(800, 380);
  await sleep(300);
  assert((await items()).some((i) => i.shape === 'triangle' && i.meas), 'δεν άναψαν μετρήσεις στο τρίγωνο');
  assert((await inked()) > before + 2000, 'τα νέα στοιχεία δεν φαίνονται στον καμβά');
  await page.mouse.click(120, 420);
});

test('Τα «Πρόσφατα» στα Όργανα θυμούνται ό,τι χρησιμοποιήθηκε', async () => {
  await page.click('#gadgetBtn');
  assert(await visible('#recentTiles [data-shape="triangle"]'), 'το τρίγωνο δεν μπήκε στα πρόσφατα');
  // κλείσιμο του μενού με άγγιγμα σε κενό σημείο του πίνακα, μακριά από τα πλακίδια
  await page.mouse.click(120, 420);
  assert(!(await visible('#gadgetMenu')), 'το μενού Όργανα δεν έκλεισε');
});

test('Νέα σελίδα και μετακίνηση ανάμεσα στις σελίδες', async () => {
  await page.click('#addPage');
  assert((await page.textContent('#pageLabel')).trim() === '2 / 2', 'η νέα σελίδα δεν μετρήθηκε');
  await pen();
  await drag(300, 300, 600, 300);
  await page.click('#prev');
  assert((await page.textContent('#pageLabel')).trim() === '1 / 2', 'δεν γύρισε στην πρώτη σελίδα');
});

let pdfPath = '';
test('Εξαγωγή σε PDF με επιλογή σελίδων', async () => {
  pdfPath = await download(async () => {
    await page.click('#menuBtn');
    await page.click('#menu [data-act="pdf"]');
    await page.waitForSelector('#pagePick:not(.hidden)');
    await page.click('#ppOk');
  });
  const buf = readFileSync(pdfPath);
  assert(buf.subarray(0, 5).toString() === '%PDF-', 'το αρχείο δεν είναι PDF');
  assert((buf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length === 2, 'το PDF δεν έχει δύο σελίδες');
});

test('Αποστολή με επιλογή σελίδων: το QR εμφανίζεται μετά το ανέβασμα', async () => {
  await page.click('#menuBtn');
  await page.click('#menu [data-act="send"]');
  await page.click('#sendDrive');
  await page.waitForSelector('#pagePick:not(.hidden)');
  await page.click('#ppOk');
  await page.waitForSelector('#sendMenu:not(.hidden) #sendOut:not(.hidden) #sendQr', { timeout: 15000 });
  assert(drive.uploads >= 1 && drive.perms >= 1, 'δεν έγινε ανέβασμα και κοινή χρήση');
  assert((await page.textContent('#sendUrl')).includes('drive.google.com/file/d/file1'), 'λείπει ο σύνδεσμος');
  await page.click('#sendClose');
});

test('Τέλος μαθήματος: μεγάλο QR με ένα πάτημα, χωρίς ερώτηση για σελίδες', async () => {
  const before = drive.uploads;
  await page.click('#menuBtn');
  await page.click('#menu [data-act="end"]');
  await page.waitForSelector('#qrBig:not(.hidden)', { timeout: 15000 });
  assert(!(await visible('#pagePick')), 'ρώτησε για σελίδες');
  assert(drive.uploads > before, 'δεν ανέβηκε το PDF');
  await page.click('#qrBig');
  await sleep(1500);
});

test('Εισαγωγή PDF: οι σελίδες του μπαίνουν στο μάθημα', async () => {
  await page.setInputFiles('#fileImport', pdfPath);
  await page.waitForSelector('#pagePick:not(.hidden)', { timeout: 20000 });
  await page.click('#ppOk');
  await page.waitForFunction(() => /\/ 4$/.test(document.getElementById('pageLabel').textContent.trim()), null, { timeout: 20000 });
  const d = await doc();
  assert(d.pages.length === 4 && d.pages[3].items.some((i) => i.kind === 'image'), 'οι σελίδες του PDF δεν μπήκαν ως εικόνες');
});

test('Λάσο πάνω σε σελίδα από PDF ή Word: το AI βλέπει την κυκλωμένη περιοχή και ελέγχει την απάντηση', async () => {
  await page.click('#menuBtn');
  await page.click('#menu [data-act="more"]');
  await page.click('#setMenu [data-act="ai"]');
  await page.fill('#aiKey', 'test-local');
  await page.click('#aiSave');
  await tool('select');
  const pi = parseInt(await page.textContent('#pageLabel'), 10) - 1;
  assert((await items(pi)).some((i) => i.kind === 'image'), 'η τρέχουσα σελίδα δεν έχει την εικόνα του PDF');
  const n0 = (await items(pi)).length;
  await lasso(420, 200, 640, 320);
  assert(await visible('#selOpts [data-rec="check"]'), 'δεν εμφανίστηκε το «Έλεγχος» για περιοχή πάνω σε εικόνα');
  assert(await visible('#selOpts [data-rec="solve"]'), 'δεν εμφανίστηκε το «Λύση» για περιοχή πάνω σε εικόνα');
  await page.click('#selOpts [data-rec="check"]');
  await page.waitForFunction(() => document.getElementById('toast').textContent.startsWith('Δεν βρέθηκε λάθος'), null, { timeout: 10000 });
  assert(aiCalls.length === 1 && aiCalls[0].image > 500, 'δεν στάλθηκε εικόνα της περιοχής');
  const it = await items(pi);
  assert(it.length === n0 + 1 && it.at(-1).kind === 'text' && it.at(-1).text.startsWith('✓'), 'η απάντηση δεν γράφτηκε κάτω από την περιοχή');
});

test('Μαθήματα: νέο μάθημα, τμήμα, και όλα μένουν μετά από κλείσιμο', async () => {
  page.once('dialog', (d) => d.accept('Δοκιμή Β2'));
  await page.click('#lessonName');
  await page.waitForSelector('#lib:not(.hidden)');
  await page.click('#lib [data-lib="new"]');
  await page.waitForFunction(() => document.getElementById('lessonName').textContent === 'Δοκιμή Β2');
  await pen();
  await drag(300, 300, 500, 340);
  const n0 = (await items()).length;
  assert(n0 === 1, `στο νέο μάθημα γράφτηκαν ${n0} στοιχεία αντί για 1`);
  await page.click('#lessonName');
  await page.waitForSelector('#lib:not(.hidden)');
  assert((await page.locator('#libGrid .card').count()) === 2, 'η βιβλιοθήκη δεν έχει δύο μαθήματα');
  page.once('dialog', (d) => d.accept('Β2'));
  await page.click('#libGrid .card.on [data-card="group"]');
  await page.waitForSelector('#libGroups [data-group="Β2"]');
  await page.click('#libGroups [data-group="Β2"]');
  assert((await page.locator('#libGrid .card').count()) === 1, 'το φίλτρο τμήματος δεν δούλεψε');
  await page.click('#lib [data-lib="close"]');
  await sleep(2000);
  await page.reload();
  await page.waitForSelector('#toolbar');
  await page.waitForFunction(() => document.getElementById('lessonName').textContent === 'Δοκιμή Β2');
  const n1 = (await items()).length;
  assert(n1 === 1, `μετά το ξανάνοιγμα βρέθηκαν ${n1} στοιχεία αντί για 1`);
});

test('Αντίγραφο μαθημάτων στο Drive', async () => {
  const before = drive.uploads;
  await page.click('#lessonName');
  await page.waitForSelector('#lib:not(.hidden)');
  await page.click('#lib [data-lib="cloud"]');
  await page.waitForFunction(() => document.getElementById('libSafeMsg').textContent.startsWith('Όλα τα μαθήματα έχουν αντίγραφο'), null, { timeout: 20000 });
  assert(drive.uploads - before >= 1, 'δεν ανέβηκε αντίγραφο');
  await page.click('#lib [data-lib="close"]');
});

await page.goto(URL_);
await page.waitForSelector('#toolbar');
await sleep(600);
let failed = 0;
for (const t of tests) {
  try {
    await t.fn();
    console.log(`  ✓ ${t.name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${t.name}\n      ${String(err.message ?? err).split('\n')[0]}`);
    // καθαρή κατάσταση για το επόμενο σενάριο
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => document.querySelectorAll('.popup, #pagePick, #lib, #qrBig, #welcome').forEach((e) => e.classList.add('hidden'))).catch(() => {});
  }
}
if (errors.length) {
  failed++;
  console.log(`  ✗ Σφάλματα JavaScript στη σελίδα:\n      ${[...new Set(errors)].slice(0, 5).join('\n      ')}`);
}
console.log(`\n${tests.length - Math.min(failed, tests.length)} από ${tests.length} σενάρια πέρασαν`);
await browser.close();
stop();
process.exit(failed ? 1 : 0);
