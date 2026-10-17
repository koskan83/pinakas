/**
 * Οι οδηγίες για εκτύπωση (dist/odigies.pdf) φτιάχνονται από το odigies.html σε κάθε build, αντί να κρατιούνται στο git.
 * Χωρίς Chrome το build δεν σταματά: απλώς λείπει το PDF (και δεν μπαίνει στη λίστα για χρήση χωρίς ίντερνετ).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { findChrome } from './find-chrome.mjs';

const HTML = 'dist/odigies.html', PDF = 'dist/odigies.pdf', LIST = 'dist/precache.json';
const exe = findChrome();
if (!exe || !existsSync(HTML)) {
  console.warn(`odigies.pdf: παραλείπεται (${exe ? 'λείπει το ' + HTML : 'δεν βρέθηκε Chrome· όρισε τη μεταβλητή CHROME'})`);
  process.exit(0);
}
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(resolve(HTML)).href, { waitUntil: 'load' });
  // οι εικόνες (και οι αφίσες των κλιπ) να έχουν φορτώσει πριν το τύπωμα
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  await page.pdf({ path: PDF, preferCSSPageSize: true, printBackground: true });
} finally {
  await browser.close();
}
const files = JSON.parse(readFileSync(LIST, 'utf8'));
if (!files.includes('odigies.pdf')) writeFileSync(LIST, JSON.stringify([...files, 'odigies.pdf']));
console.log('odigies.pdf: έτοιμο');
