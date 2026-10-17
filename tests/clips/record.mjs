/**
 * Κινούμενα κλιπ για τις οδηγίες (public/odigies/*.webm): ο πίνακας «παίζει» μόνος του σε Chrome χωρίς παράθυρο
 * και κάθε κλιπ γράφεται από την αρχή. Όταν αλλάζει η εμφάνιση, ξαναγράφονται όλα με μία εντολή:
 *   npm run build && node tests/clips/record.mjs [όνομα…]
 * Κάθε κλιπ τελειώνει με το αποτέλεσμα ακίνητο για λίγο, πριν ξαναρχίσει. Δίπλα του γράφεται και το τελευταίο καρέ
 * (.jpg), για την εκτύπωση και για όσο φορτώνει το βίντεο. Ένας μπλε κύκλος δείχνει πού ακουμπά το δάχτυλο.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { findChrome } from '../../scripts/find-chrome.mjs';

const PORT = 4189;
const URL_ = `http://localhost:${PORT}/`;
const W = 1280, H = 720;
const OUT = 'public/odigies';

const exe = findChrome();
if (!exe) {
  console.error('Δεν βρέθηκε Chrome. Όρισε τη μεταβλητή CHROME με τη διαδρομή του.');
  process.exit(2);
}
if (!existsSync('dist/index.html')) {
  console.error('Λείπει το dist/. Τρέξε πρώτα: npm run build');
  process.exit(2);
}

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => server.kill());
for (let i = 0; ; i++) {
  try { if ((await fetch(URL_)).ok) break; } catch { /* δεν ξεκίνησε ακόμα */ }
  if (i > 80) { console.error('Ο διακομιστής προεπισκόπησης δεν ξεκίνησε'); process.exit(2); }
  await new Promise((r) => setTimeout(r, 250));
}

const NEWS_ID = /NEWS_ID = '([^']+)'/.exec(readFileSync('src/news.ts', 'utf8'))[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });

/** Νέα, καθαρή συσκευή: χωρίς γνωριμία, «Τι νέο», «Τι κάνουμε σήμερα;» και υπενθυμίσεις. */
async function device(level) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'el-GR' });
  await ctx.addInitScript(([lv, news]) => {
    if (sessionStorage.getItem('clip')) return;
    sessionStorage.setItem('clip', '1');
    localStorage.setItem('grafida.welcome', '1');
    localStorage.setItem('grafida.news', news);
    localStorage.setItem('grafida.startscr', '0');
    localStorage.setItem('grafida.level', lv);
    localStorage.setItem('grafida.safe', JSON.stringify({ at: Date.now(), done: false, ids: {}, gone: [], told: Date.now() }));
  }, [level, NEWS_ID]);
  const page = await ctx.newPage();
  await page.goto(URL_);
  await page.waitForSelector('#toolbar');
  await sleep(800);
  return { ctx, page };
}

/** Το «δάχτυλο»: κύκλος που ακολουθεί τον δείκτη και γεμίζει όταν πατά. */
async function finger(page) {
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = 'clipFinger';
    d.style.cssText = 'position:fixed;left:0;top:0;width:38px;height:38px;margin:-19px 0 0 -19px;border-radius:50%;background:rgba(37,99,235,.18);border:3px solid rgba(37,99,235,.75);pointer-events:none;z-index:2147483647;opacity:0;transition:opacity .15s,transform .12s,background .12s';
    document.body.append(d);
    const at = (e) => { d.style.left = `${e.clientX}px`; d.style.top = `${e.clientY}px`; d.style.opacity = '1'; };
    addEventListener('pointermove', at, true);
    addEventListener('pointerdown', (e) => { at(e); d.style.transform = 'scale(.8)'; d.style.background = 'rgba(37,99,235,.45)'; }, true);
    addEventListener('pointerup', () => { d.style.transform = ''; d.style.background = 'rgba(37,99,235,.18)'; }, true);
  });
}

/** Ο δείκτης κινείται ομαλά, όπως ένα χέρι, και όχι με άλματα. */
function hand(page) {
  let x = W / 2, y = H / 2;
  const move = async (tx, ty, steps = 18) => {
    await page.mouse.move(tx, ty, { steps });
    x = tx;
    y = ty;
  };
  return {
    move,
    async tap(tx, ty) {
      await move(tx, ty);
      await sleep(180);
      await page.mouse.down();
      await sleep(90);
      await page.mouse.up();
      await sleep(350);
    },
    async tapEl(sel) {
      const b = await page.locator(sel).first().boundingBox();
      if (!b) throw new Error(`δεν φαίνεται: ${sel}`);
      await this.tap(b.x + b.width / 2, b.y + b.height / 2);
    },
    async drag(x0, y0, x1, y1, steps = 30) {
      await move(x0, y0);
      await sleep(150);
      await page.mouse.down();
      await page.mouse.move(x1, y1, { steps });
      x = x1;
      y = y1;
      await sleep(120);
      await page.mouse.up();
      await sleep(350);
    },
    async away() {
      await move(W - 60, H / 2 - 120, 14);
    },
    get pos() { return [x, y]; },
  };
}

/** Γράφει ό,τι κάνει το `act`, κρατά το τέλος ακίνητο για `hold` ms και το κάνει webm (μέσα στο ίδιο το Chrome). */
async function record(name, level, prep, act, hold = 2600) {
  const { ctx, page } = await device(level);
  const h = hand(page);
  await prep(page, h);
  await finger(page);
  await h.away();
  await sleep(300);
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', (f) => {
    frames.push({ data: f.data, t: f.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: W, maxHeight: H });
  await sleep(700);
  await act(page, h);
  await h.away();
  // στο ακίνητο τέλος φαίνεται μόνο το αποτέλεσμα, χωρίς το «δάχτυλο»
  await page.evaluate(() => { document.getElementById('clipFinger').style.opacity = '0'; });
  await sleep(hold);
  const end = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  if (frames.length === 0) throw new Error('κανένα καρέ');
  writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(frames.at(-1).data, 'base64'));
  if (process.env.CLIP_DEBUG) console.log(`    ${name}: ${frames.length} καρέ, κωδικοποίηση…`);

  // κωδικοποίηση: τα καρέ ξαναπαίζονται στον ίδιο ρυθμό πάνω σε καμβά και το MediaRecorder τα γράφει
  const enc = await ctx.newPage();
  await enc.setContent('<!doctype html><body style="margin:0"></body>');
  const b64 = await enc.evaluate(async ({ frames, end, W, H }) => {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    document.body.append(cv);
    const c = cv.getContext('2d');
    const imgs = await Promise.all(frames.map(async (f) => {
      const i = new Image();
      i.src = `data:image/jpeg;base64,${f.data}`;
      await i.decode();
      return i;
    }));
    c.drawImage(imgs[0], 0, 0, W, H);
    const rec = new MediaRecorder(cv.captureStream(30), { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 900_000 });
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.start();
    const t0 = performance.now(), base = frames[0].t;
    const total = (end - base) * 1000;
    let k = 0;
    // ξαναζωγραφίζει συνεχώς (και το ίδιο καρέ), ώστε και το ακίνητο τέλος να γραφτεί με τη σωστή διάρκεια
    while (performance.now() - t0 < total) {
      const now = performance.now() - t0;
      while (k + 1 < frames.length && (frames[k + 1].t - base) * 1000 <= now) k++;
      c.drawImage(imgs[k], 0, 0, W, H);
      await new Promise((r) => setTimeout(r, 33));
    }
    await new Promise((r) => { rec.onstop = r; rec.stop(); });
    const buf = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, { frames, end, W, H });
  const out = Buffer.from(b64, 'base64');
  writeFileSync(`${OUT}/${name}.webm`, out);
  console.log(`  ✓ ${name}.webm  ${(out.length / 1024).toFixed(0)} KB, ${(end - frames[0].t).toFixed(1)}″, ${frames.length} καρέ`);
  await ctx.close();
}

// ---------- τα κλιπ ----------

/** Ένα σχήμα από τα Όργανα, σερμένο από (x0, y0) έως (x1, y1). */
async function shape(h, kind, x0, y0, x1, y1) {
  await h.tapEl('#gadgetBtn');
  await h.tapEl(`#gadgetMenu .tiles:not(#recentTiles) [data-shape="${kind}"]`);
  await h.drag(x0, y0, x1, y1);
}

const CLIPS = {
  // 6. Σχήματα και μετρήσεις: τρίγωνο από τα Όργανα, μετά Μέτρηση με μήκη και γωνίες
  async shapes() {
    await record('shapes', 'secondary', async () => {}, async (page, h) => {
      await shape(h, 'triangle', 480, 200, 800, 470);
      await h.tapEl('#tools [data-tool="measure"]');
      await h.tap(640, 470);
      await sleep(400);
      await h.tapEl('#measOpts [data-meas="ang"]');
      await sleep(300);
      await h.tapEl('#measOpts [data-meas="area"]');
    });
  },
  // 6. Γωνία ανάμεσα σε δύο γραμμές: δύο ευθείες με κοινή κορυφή και Μέτρηση μέσα στο άνοιγμα
  async angle() {
    await record('angle', 'secondary', async () => {}, async (page, h) => {
      await shape(h, 'line', 440, 480, 860, 480);
      await h.drag(440, 480, 760, 200);
      await h.tapEl('#tools [data-tool="measure"]');
      // ένα πάτημα μέσα στο άνοιγμα, μακριά από τις δύο γραμμές
      await h.tap(560, 445);
    });
  },
  // 5. Επιλογή: πιάνεις το σχήμα, μεγαλώνει από τη γωνία, στρίβει από τη λαβή, και οι ενέργειες είναι στη μπάρα
  async select() {
    await record('select', 'secondary', async (page, h) => {
      await shape(h, 'rect', 520, 300, 760, 440);
      await page.click('#tools [data-tool="select"]');
      await page.mouse.click(640, 640 / 2 + 200);
    }, async (page, h) => {
      await h.tap(520, 370);
      await sleep(500);
      await h.drag(762, 442, 840, 500);
      await sleep(300);
      await h.drag(680, 262, 780, 290, 30);
      await sleep(300);
      await h.tapEl('#selOpts #bigger');
    });
  },
  // 14. Αριθμοκυβάκια: σέρνεις το 2 πάνω στο 3 και γίνονται 5
  async numcubes() {
    await record('numcubes', 'primary', async (page) => {
      await page.click('#gadgetBtn');
      await page.click('#gTabs [data-gtab="play"]');
      await page.click('#gadgetMenu .tiles:not(#recentTiles) [data-kid="numcubes"]');
      await page.click('#tools [data-tool="select"]');
      await page.mouse.click(30, 300);
      if (process.env.CLIP_PROBE) await page.screenshot({ path: 'probe.png' });
    }, async (page, h) => {
      void page;
      // οι θέσεις των χαρακτήρων όπως μπαίνει το εργαλείο σε οθόνη 1280 × 720 (βλ. CLIP_PROBE)
      await h.drag(535, 395, 650, 375, 36);
      await sleep(900);
      await h.tap(802, 505);
      await sleep(900);
      if (process.env.CLIP_PROBE) await page.screenshot({ path: 'probe2.png' });
      // όλοι κάθονται στη ζυγαριά (1 < 14): το 4 πάει αριστερά (5 < 10) και μετά το 5, και γέρνει ανάποδα (10 > 5)
      await h.drag(770, 340, 470, 330, 34);
      await sleep(1200);
      if (process.env.CLIP_PROBE) await page.screenshot({ path: 'probe3.png' });
      await h.drag(652, 310, 545, 300, 30);
      await sleep(900);
    }, 3200);
  },
};

const want = process.argv.slice(2);
for (const [name, run] of Object.entries(CLIPS)) {
  if (want.length && !want.includes(name)) continue;
  try {
    await run();
  } catch (err) {
    console.log(`  ✗ ${name}: ${String(err.message ?? err).split('\n')[0]}`);
    process.exitCode = 1;
  }
}
await browser.close();
// ο διακομιστής προεπισκόπησης κρατά αλλιώς το node ανοιχτό
server.kill();
process.exit();
