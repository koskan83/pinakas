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
  const text = body.contents[0].parts[1].text.includes('will be plotted') ? 'F: 10-2x\nD: 0 ; 5\nX: t\nY: υ' : '✓ Σωστή επιλογή: το 2';
  return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }) });
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
/** Απαντά στο παράθυρο ερώτησης της εφαρμογής. */
async function answer(text) {
  await page.waitForSelector('#ask input');
  await page.fill('#ask input', text);
  await page.click('#ask .go');
}
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

test('Γράφοντας, η μπάρα δεν ξεθωριάζει παρά μόνο όταν την πλησιάσει η γραφίδα', async () => {
  await pen();
  const faded = () => page.evaluate(() => ['toolbarWrap', 'lessonName', 'zoomCtl'].filter((id) => document.getElementById(id).classList.contains('under')));
  await page.mouse.move(400, 300);
  await page.mouse.down();
  await page.mouse.move(520, 330, { steps: 6 });
  assert((await faded()).length === 0, 'κάτι ξεθώριασε ενώ η γραφίδα ήταν μακριά');
  const z = await page.evaluate(() => { const r = document.getElementById('zoomCtl').getBoundingClientRect(); return { x: r.left - 20, y: r.bottom + 20 }; });
  await page.mouse.move(z.x, z.y, { steps: 6 });
  assert((await faded()).join() === 'zoomCtl', 'έπρεπε να ξεθωριάσει μόνο το zoom');
  await page.mouse.up();
  assert((await faded()).length === 0, 'το zoom έμεινε ξεθωριασμένο μετά το σήκωμα');
  await page.click('#undo');
});

test('Πλήρης οθόνη: εμφανίζεται κουμπί εξόδου δίπλα στο zoom', async () => {
  assert(!(await visible('#fsExit')), 'το κουμπί εξόδου φαίνεται χωρίς πλήρη οθόνη');
  await page.click('#menuBtn');
  await page.click('#menu [data-act="full"]');
  await page.waitForFunction(() => !!document.fullscreenElement);
  await page.waitForSelector('#fsExit:not(.hidden)', { timeout: 3000 }).catch(() => {});
  assert(await visible('#fsExit'), 'δεν εμφανίστηκε κουμπί εξόδου από την πλήρη οθόνη');
  await page.click('#fsExit');
  await page.waitForFunction(() => !document.fullscreenElement);
  await page.waitForSelector('#fsExit.hidden', { state: 'attached', timeout: 3000 }).catch(() => {});
  assert(!(await visible('#fsExit')), 'το κουμπί εξόδου έμεινε μετά την έξοδο');
});

test('Σκούρος πίνακας: το μαύρο από την παλέτα γράφει μαύρο (για λευκές σελίδες που μπήκαν από αρχείο)', async () => {
  await page.click('#menuBtn');
  await page.click('#menu [data-act="bg-dark"]');
  await page.click('#menuBtn');
  await pen();
  await page.click('#colorBtn');
  await page.click('#colorGrid [data-color="#111111"]');
  await drag(300, 200, 520, 240);
  const s = (await items()).filter((i) => i.kind === 'stroke').pop();
  assert(s && s.color === '#000000', `το μαύρο της παλέτας γράφτηκε ως ${s && s.color}, που σε σκούρο πίνακα γίνεται λευκό`);
  await page.click('#undo');
  await page.click('#colors [data-color="#ffffff"]');
  await page.click('#menuBtn');
  await page.click('#menu [data-act="bg-white"]');
  await page.click('#menuBtn');
  assert(!(await visible('#menu')), 'το μενού έμεινε ανοιχτό');
});

test('Εκτύπωση από το μενού του browser: λευκό χαρτί, σκούρα χρώματα, χωρίς γραμμή εργαλείων', async () => {
  await page.click('#menuBtn');
  await page.click('#menu [data-act="bg-dark"]');
  await page.click('#menuBtn');
  await pen();
  await page.click('#colors [data-color="#ffffff"]');
  await drag(300, 200, 620, 200);
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.waitForFunction(() => { const i = document.querySelector('#printView img'); return i && i.complete && i.naturalWidth > 0; });
  const r = await page.evaluate(() => {
    const img = document.querySelector('#printView img');
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const c = cv.getContext('2d');
    c.drawImage(img, 0, 0);
    const px = (x, y) => [...c.getImageData(Math.round(x), Math.round(y), 1, 1).data].slice(0, 3);
    return { n: document.querySelectorAll('#printView img').length, app: getComputedStyle(document.getElementById('app')).display, corner: px(4, 4), darkest: Math.min(...Array.from({ length: cv.height }, (_, y) => Math.max(...px(cv.width / 2, y)))), lightInk: (() => { const d = c.getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 60 && d[i + 1] < 60 && d[i + 2] < 60) n++; return n; })() };
  });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.emulateMedia({ media: null });
  await page.click('#undo');
  await page.click('#menuBtn');
  await page.click('#menu [data-act="bg-white"]');
  await page.click('#menuBtn');
  assert(r.n === 1, `έπρεπε να τυπωθεί 1 σελίδα, βγήκαν ${r.n}`);
  assert(r.app === 'none', 'η γραμμή εργαλείων θα τυπωνόταν μαζί');
  assert(r.corner.every((v) => v > 240), `το χαρτί δεν είναι λευκό: ${r.corner}`);
  assert(r.lightInk > 50, `η λευκή γραφή δεν έγινε σκούρα στο χαρτί (σκούρα pixel: ${r.lightInk}, πιο σκούρο στη μέση: ${r.darkest})`);
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
  for (const k of ['text', 'math', 'solve', 'check', 'graph']) assert(await visible(`#selOpts [data-rec="${k}"]`), `λείπει το κουμπί «${k}»`);
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

test('Άξονες χωρίς αριθμούς: το «123» τους σβήνει και οι επόμενοι άξονες το θυμούνται', async () => {
  const inked = () => page.evaluate(() => {
    const cv = document.getElementById('base');
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0 && d[i - 1] + d[i - 2] + d[i - 3] < 600) n++;
    return n;
  });
  const add = async () => {
    await page.click('#gadgetBtn');
    await page.click('#gadgetMenu .tiles:not(#recentTiles) [data-axes="full"]');
  };
  await add();
  const withNums = await inked();
  await page.click('#axNums');
  const without = await inked();
  assert(without < withNums, 'οι αριθμοί δεν έφυγαν από τους άξονες');
  assert((await items()).find((i) => i.kind === 'axes').nums === false, 'οι άξονες δεν αποθηκεύτηκαν χωρίς αριθμούς');
  await page.click('#undo');
  await page.click('#undo');
  await add();
  assert((await items()).find((i) => i.kind === 'axes').nums === false, 'οι νέοι άξονες δεν θυμήθηκαν «χωρίς αριθμούς»');
  await page.click('#axNums');
  assert((await items()).find((i) => i.kind === 'axes').nums !== false, 'οι αριθμοί δεν ξαναμπήκαν');
  await page.click('#undo');
  await page.click('#undo');
  assert(!(await items()).some((i) => i.kind === 'axes'), 'έμειναν άξονες στη σελίδα');
});

test('Συνάρτηση που δεν χωράει (y = −200x): ο κατακόρυφος άξονας αλλάζει κλίμακα μόνος του', async () => {
  const type = async (v) => {
    if (!(await visible('#fnAdd'))) await page.click('#fnBtn');
    await page.evaluate((v) => { const i = document.getElementById('fnInput'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    await page.click('#fnAdd');
  };
  const del = async () => {
    if (!(await visible('#fnAdd'))) await page.click('#fnBtn');
    await page.click('#fnList [data-fndel="0"]');
  };
  const axes = async () => (await items()).find((i) => i.kind === 'axes');
  await page.click('#gadgetBtn');
  await page.click('#gadgetMenu .tiles:not(#recentTiles) [data-axes="full"]');
  await type('x²');
  assert((await axes()).sy === undefined, 'η x² δεν έπρεπε να αλλάξει την κλίμακα');
  await del();
  await type('-200x');
  const sy = (await axes()).sy;
  assert(sy === 200, `η κλίμακα για την y = −200x βγήκε ${sy} αντί για 200`);
  await page.evaluate(() => document.getElementById('axScale').click());
  const a2 = await axes();
  assert(a2.sx === 2 && a2.sy === 500, `με 2 ανά γραμμή στον x περίμενα sx 2 και sy 500, βγήκαν ${a2.sx} και ${a2.sy}`);
  await del();
  assert((await axes()).sy === undefined, 'χωρίς συναρτήσεις η κλίμακα έπρεπε να γυρίσει στο 1');
  await page.mouse.click(1200, 300);
  for (let i = 0; i < 6 && (await axes()); i++) await page.click('#undo');
  assert(!(await axes()), 'έμειναν άξονες στη σελίδα');
});

test('Δύο γραφικές παραστάσεις: σέρνεις τη μία πάνω στην άλλη και ενώνονται στους ίδιους άξονες', async () => {
  const type = async (v) => {
    if (!(await visible('#fnAdd'))) await page.click('#fnBtn');
    await page.evaluate((v) => { const i = document.getElementById('fnInput'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    await page.click('#fnAdd');
  };
  const allAxes = async () => (await items()).filter((i) => i.kind === 'axes');
  const add = async (f) => {
    await page.click('#gadgetBtn');
    await page.click('#gadgetMenu .tiles:not(#recentTiles) [data-axes="full"]');
    await type(f);
  };
  await add('x²');
  // οι πρώτοι άξονες πάνε αριστερά, για να μπουν οι δεύτεροι χωριστά
  let a = await allAxes();
  assert(a.length === 1, 'δεν μπήκαν οι πρώτοι άξονες');
  await add('2x');
  a = await allAxes();
  assert(a.length === 2 && a[0].fns.length === 1 && a[1].fns.length === 1, 'δεν υπάρχουν δύο άξονες με μία συνάρτηση ο καθένας');
  // οι δεύτεροι είναι επιλεγμένοι και ακριβώς πάνω στους πρώτους: ένα μικρό σύρσιμο τους «αφήνει» επάνω τους
  await page.mouse.click(1250, 120);
  await tool('select');
  const box = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  await drag(box.w / 2 + 60, box.h / 2 - 60, box.w / 2 + 90, box.h / 2 - 40);
  a = await allAxes();
  assert(a.length === 1, `μετά το σύρσιμο έμειναν ${a.length} άξονες αντί για 1`);
  assert(a[0].fns.length === 2 && a[0].fns[0].expr === 'x²' && a[0].fns[1].expr === '2x', 'οι συναρτήσεις δεν ενώθηκαν');
  assert(a[0].fns[0].color !== a[0].fns[1].color, 'η δεύτερη συνάρτηση δεν άλλαξε χρώμα');
  // εμβαδόν ανάμεσα στις δύο καμπύλες: τα άκρα πάνε μόνα τους στα σημεία τομής (x² = 2x → 0 και 2)
  await page.evaluate(() => document.querySelector('[data-an="int"]').click());
  await page.evaluate(() => document.querySelector('[data-an="int"]').click());
  a = await allAxes();
  assert(a[0].an && a[0].an.int && a[0].an.int.between && a[0].an.int.a === 0 && a[0].an.int.b === 2, `τα άκρα του χωρίου δεν πήγαν στα σημεία τομής: ${JSON.stringify(a[0].an)}`);
  await page.click('#undo');
  await page.click('#undo');
  await page.click('#undo');
  assert((await allAxes()).length === 2, 'η αναίρεση δεν τις χώρισε ξανά');
  for (let i = 0; i < 8 && (await allAxes()).length; i++) await page.click('#undo');
  assert(!(await allAxes()).length, 'έμειναν άξονες στη σελίδα');
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

test('Λάσο σε συνάρτηση → «Γραφική»: μπαίνουν άξονες που ταιριάζουν στο πεδίο ορισμού', async () => {
  const pi = Number((await page.textContent('#pageLabel')).split('/')[0]) - 1;
  await tool('select');
  await lasso(420, 200, 640, 320);
  await page.click('#selOpts [data-rec="graph"]');
  await page.waitForFunction(() => document.getElementById('toast').textContent.startsWith('Η γραφική παράσταση μπήκε'), null, { timeout: 10000 });
  const ax = (await items(pi)).find((i) => i.kind === 'axes');
  assert(ax, 'δεν μπήκαν άξονες');
  assert(ax.mode === 'q1', `για υ = 10 − 2t με 0 ≤ t ≤ 5 περίμενα 1ο τεταρτημόριο, βγήκε ${ax.mode}`);
  assert(ax.fns.length === 1 && ax.fns[0].expr === '10-2x' && ax.fns[0].dom[0] === 0 && ax.fns[0].dom[1] === 5, 'η συνάρτηση ή το πεδίο ορισμού δεν πέρασαν σωστά');
  assert(ax.lx === 't' && ax.ly === 'υ', 'τα ονόματα των αξόνων δεν πέρασαν');
  await page.mouse.click(1200, 300);
});

test('Δημοτικό: απλή γραμμή εργαλείων, εργαλεία που αλλάζουν με πάτημα, και επιστροφή σε Γυμνάσιο – Λύκειο', async () => {
  const pi = Number((await page.textContent('#pageLabel')).split('/')[0]) - 1;
  const level = async () => { await page.click('#menuBtn'); await page.click('#menu [data-act="level"]'); };
  assert(await visible('#tools [data-tool="measure"]'), 'στο Γυμνάσιο – Λύκειο λείπει η Μέτρηση');
  await level();
  assert(!(await visible('#tools [data-tool="measure"]')), 'στο Δημοτικό η Μέτρηση έπρεπε να κρυφτεί');
  await page.click('#gadgetBtn');
  assert(await visible('#gadgetMenu [data-kid="balance"]'), 'δεν φαίνονται τα εργαλεία του Δημοτικού');
  assert(!(await visible('#gadgetMenu .tiles:not(#recentTiles) [data-axes="full"]')), 'οι άξονες έπρεπε να κρυφτούν στο Δημοτικό');
  await page.click('#gadgetMenu .tiles:not(#recentTiles) [data-kid="fracbar"]');
  let it = (await items(pi)).find((i) => i.kind === 'stamp' && i.name === 'fracbar');
  assert(it && it.v[0] === 4 && it.v[1] === 0, 'δεν μπήκε η μπάρα κλασμάτων');
  // πάτημα πάνω στο εργαλείο (κομμάτι της μπάρας ή κουμπί −): αλλάζει η κατάστασή του χωρίς να μετακινηθεί
  const k = await page.evaluate(() => Number(document.getElementById('zoomFit').textContent.replace('%', '')) / 100);
  const mid = await page.evaluate(() => ({ x: innerWidth / 2, y: innerHeight / 2 }));
  await page.mouse.click(mid.x - (it.w * k) / 2 + (it.w * k) / 8, mid.y - 60);
  it = (await items(pi)).find((i) => i.kind === 'stamp' && i.name === 'fracbar');
  const changed = it.v.join() !== '4,0';
  const barAfterTap = await visible('#selOpts');
  // και με το στυλό στο χέρι: το πάτημα σε κουμπί του εργαλείου το αλλάζει και δεν αφήνει τελεία στον πίνακα
  await pen();
  const nPen = (await items(pi)).length;
  await page.mouse.click(mid.x - (it.w * k) / 2 + (it.w * k) / 8, mid.y - 60);
  const it2 = (await items(pi)).find((i) => i.kind === 'stamp' && i.name === 'fracbar');
  const penTap = it2.v.join() !== it.v.join() && (await items(pi)).length === nPen;
  await page.click('#tools [data-tool="select"]');
  await page.click('#undo');
  await page.click('#undo');
  await page.click('#undo');
  // κυβάκια: όσο κρατάς πατημένο για να χτίσεις, το εργαλείο πρέπει να μένει στην οθόνη
  await page.click('#gadgetBtn');
  await page.click('#gadgetMenu .tiles:not(#recentTiles) [data-kid="build"]');
  const sky = () => page.evaluate(([x, y]) => {
    const cv = document.getElementById('base');
    const f = cv.width / cv.clientWidth;
    return [...cv.getContext('2d').getImageData(Math.round(x * f), Math.round(y * f), 1, 1).data].slice(0, 3).join();
  }, [mid.x - 150, mid.y - 150]);
  const skyBefore = await sky();
  await page.mouse.move(mid.x, mid.y - 100);
  await page.mouse.down();
  await page.mouse.move(mid.x + 60, mid.y - 100, { steps: 5 });
  const skyDuring = await sky();
  await page.mouse.up();
  const built = (await items(pi)).find((i) => i.kind === 'stamp' && i.name === 'build');
  const blocks = built ? built.v.slice(1).filter((n) => n > 0).length : 0;
  await page.click('#undo');
  await page.click('#undo');
  await page.reload();
  await page.waitForSelector('#toolbar');
  assert(skyBefore === '224,242,254', `τα κυβάκια δεν ζωγραφίστηκαν εκεί που περίμενα (χρώμα ${skyBefore})`);
  assert(skyDuring === skyBefore, `όσο χτίζεις, το εργαλείο εξαφανίζεται από την οθόνη (χρώμα ${skyDuring})`);
  assert(blocks >= 2, `το σύρσιμο έχτισε ${blocks} κυβάκια αντί για τουλάχιστον 2`);
  assert(!(await visible('#tools [data-tool="measure"]')), 'η επιλογή «Δημοτικό» δεν έμεινε μετά το ξανάνοιγμα');
  await level();
  assert(await visible('#tools [data-tool="measure"]'), 'η Μέτρηση δεν επέστρεψε στο Γυμνάσιο – Λύκειο');
  assert(changed, 'το πάτημα πάνω στο εργαλείο δεν άλλαξε την κατάστασή του');
  // έτοιμη σελίδα του Γυμνασίου – Λυκείου από τα πρότυπα
  await page.click('#importBtn');
  await page.click('[data-ins="tpl"]');
  assert(!(await visible('#tplList [data-tpl="b3"]')), 'τα πρότυπα του Δημοτικού φαίνονται στο Γυμνάσιο – Λύκειο');
  await page.click('#tplList [data-tpl="b2"]');
  const last = (await doc()).pages.at(-1).items;
  assert(last.some((i) => i.kind === 'axes') && last.some((i) => i.kind === 'text' && i.text === 'Ασύμπτωτες'), 'το πρότυπο «Μελέτη συνάρτησης» δεν έφτιαξε τη σελίδα του');
  await page.click('#menuBtn');
  await page.click('#menu [data-act="more"]');
  assert(/Έκδοση \d{4}-\d\d-\d\d/.test(await page.textContent('#verLine')), 'δεν φαίνεται η έκδοση στις ρυθμίσεις');
  await page.click('#setMenu [data-act="news"]');
  assert((await page.locator('#ask li').count()) >= 3, 'το «Τι νέο» δεν άνοιξε');
  await page.click('#ask .go');
  assert(penTap, 'με το στυλό, το πάτημα σε κουμπί εργαλείου του Δημοτικού δεν δούλεψε ή άφησε σημάδι');
  assert(!barAfterTap, 'μετά από πάτημα σε κουμπί του εργαλείου εμφανίστηκε η μπάρα «Διαγραφή / ×2»');
});

test('Μαθήματα: νέο μάθημα, τμήμα, μετονομασία από το όνομα, και όλα μένουν μετά από κλείσιμο', async () => {
  await page.click('#libOpen');
  await page.waitForSelector('#lib:not(.hidden)');
  await page.click('#lib [data-lib="new"]');
  await answer('Δοκιμή Β2');
  await page.waitForFunction(() => document.getElementById('lessonName').textContent === 'Δοκιμή Β2');
  await pen();
  await drag(300, 300, 500, 340);
  const n0 = (await items()).length;
  assert(n0 === 1, `στο νέο μάθημα γράφτηκαν ${n0} στοιχεία αντί για 1`);
  await page.click('#libOpen');
  await page.waitForSelector('#lib:not(.hidden)');
  assert((await page.locator('#libGrid .card').count()) === 2, 'η βιβλιοθήκη δεν έχει δύο μαθήματα');
  await page.click('#libGrid .card.on [data-card="group"]');
  await answer('Β2');
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
  await page.click('#lessonName span');
  await answer('Δοκιμή Β2 νέο');
  await page.waitForFunction(() => document.getElementById('lessonName').textContent === 'Δοκιμή Β2 νέο');
  await sleep(300);
  await page.reload();
  await page.waitForSelector('#toolbar');
  await page.waitForFunction(() => document.getElementById('lessonName').textContent === 'Δοκιμή Β2 νέο');
});

test('Αντίγραφο μαθημάτων στο Drive', async () => {
  const before = drive.uploads;
  await page.click('#libOpen');
  await page.waitForSelector('#lib:not(.hidden)');
  await page.click('#lib [data-lib="cloud"]');
  await page.waitForFunction(() => document.getElementById('libSafeMsg').textContent.startsWith('Όλα τα μαθήματα έχουν αντίγραφο'), null, { timeout: 20000 });
  assert(drive.uploads - before >= 1, 'δεν ανέβηκε αντίγραφο');
  await page.click('#lib [data-lib="close"]');
});

test('Δύο δάχτυλα: το σύρσιμο δεν αλλάζει το zoom, το άνοιγμα των δαχτύλων το αλλάζει', async () => {
  const zoom = () => page.evaluate(() => document.getElementById('zoomFit').textContent);
  // αγγίγματα μέσω του ίδιου του browser: δύο δάχτυλα σε απόσταση 200, που σέρνονται μαζί ενώ η απόστασή τους «παίζει» ±20
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id, radiusX: 8, radiusY: 8, force: 1 })) });
  const z0 = await zoom();
  await touch('touchStart', [[500, 300], [700, 300]]);
  for (let i = 1; i <= 20; i++) {
    const wob = (i % 2 ? 1 : -1) * 10;
    await touch('touchMove', [[500 + i * 12 - wob, 300 + i * 6], [700 + i * 12 + wob, 300 + i * 6]]);
  }
  await sleep(100);
  const z1 = await zoom();
  // τώρα ανοίγουν καθαρά: από 200 σε 420
  for (let i = 1; i <= 11; i++) await touch('touchMove', [[740 - i * 10, 420], [940 + i * 10, 420]]);
  await sleep(100);
  const z2 = await zoom();
  await touch('touchEnd', []);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await cdp.detach();
  await page.click('#zoomFit');
  assert(z1 === z0, `το σύρσιμο με δύο δάχτυλα άλλαξε το zoom από ${z0} σε ${z1}`);
  assert(parseInt(z2) > parseInt(z1), `το άνοιγμα των δαχτύλων δεν μεγέθυνε (${z1} → ${z2})`);
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
