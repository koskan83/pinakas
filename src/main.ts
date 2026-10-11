import './style.css';
import { Board, EraserMode, SizedTool } from './board';
import { AxesAn, AxesMode, Background, Doc, Item, MeasOpts, ShapeKind, TextItem, Tool, isDark, newDoc } from './model';
import { blobToPic, captureScreen, clipboardImage, pdfToPages } from './importers';
import { kvGet, kvSet } from './storage';
import { Lessons } from './lessons';
import { driveBuiltIn, driveClientId, driveConnect, setDriveClientId, uploadToDrive } from './drive';
import qrcode from 'qrcode-generator';
import { Timer } from './timer';
import { GadgetKind } from './gadgets';
import { closeOverlay, isNative, isOverlay, nativeSave, nativeScreenshot, openOverlay } from './native';
import { Curtain, Spotlight } from './overlays';
import { STAMPS } from './stamps';
import { compile, paramsOf } from './expr';
import { buildPdf } from './pdf';
import { MODELS, Provider, RecKind, loadAi, recognize, saveAi, texToImage } from './ai';
import { axesRange, itemBounds, uid } from './model';

/** Βασικά χρώματα ανά φόντο· ίδια θέση = αντίστοιχο χρώμα στο άλλο φόντο. */
const PALETTE = {
  light: ['#111111', '#e11d48', '#2563eb', '#16a34a'],
  dark: ['#ffffff', '#fb7185', '#7dd3fc', '#86efac'],
};
/** Χρώματα του υπογραμμιστικού (ίδια σε κάθε φόντο). */
const HL_PALETTE = ['#fde047', '#86efac', '#f9a8d4', '#7dd3fc'];
const MORE_COLORS = [
  '#111111', '#6b7280', '#d1d5db', '#ffffff', '#92400e', '#d6a36c',
  '#b91c1c', '#ef4444', '#fb7185', '#f472b6', '#be185d', '#a21caf',
  '#ea580c', '#f59e0b', '#fde047', '#a3e635', '#16a34a', '#166534',
  '#0f766e', '#2dd4bf', '#7dd3fc', '#2563eb', '#1e3a8a', '#7c3aed',
];
const SIZES: Record<SizedTool, number[]> = {
  pen: [2, 4, 8, 16],
  highlighter: [2, 4, 8, 16],
  eraser: [8, 16, 32, 64],
};
const SIZE_NAME = ['Λεπτό', 'Κανονικό', 'Παχύ', 'Πολύ παχύ'];
type PenKind = 'pen' | 'laser';
const LASER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5" fill="#ef4444" stroke="none"/></svg>';
const PENCIL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/></svg>';
const PEN_ICON: Record<PenKind, string> = { pen: PENCIL_ICON, laser: LASER_ICON };
/** Γραμμικό εικονίδιο 24×24 στο ύφος της μπάρας. */
const IC = (d: string): string => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const P = (d: string): string => IC(`<path d="${d}"/>`);
/** Γραμμή μενού: εικονίδιο και κείμενο. */
const mi = (attr: string, icon: string, label: string): string => `<button ${attr}><i>${icon}</i>${label}</button>`;
/** Πλακίδιο του μενού «Όργανα»: εικονίδιο με μικρή λεζάντα από κάτω. */
const tile = (attr: string, icon: string, label: string, title = label): string =>
  `<button ${attr} class="tile" title="${title}"><span>${icon}</span><small>${label}</small></button>`;
const I = {
  lib: P('M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z'),
  folder: P('M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'),
  save: P('M12 4v11M7 11l5 5 5-5M4 20h16'),
  doc: P('M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6'),
  image: IC('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-8 8"/>'),
  fit: P('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'),
  clear: P('M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11l4 5M14 11l-4 5'),
  delpage: IC('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 12h6"/>'),
  screen: IC('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  spark: P('M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z'),
  full: P('M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5'),
  target: IC('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8.5"/>'),
  check: P('M4 6.5l1.500 1.500 3-3M4 12.5l1.5 1.5 3-3M4 18.5l1.5 1.5 3-3M12 7h8M12 13h8M12 19h8'),
  tag: P('M4 5h16M7 5v7M17 5v7M4 16h16M4 20h10'),
  paste: IC('<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V3h6v2"/>'),
  palette: IC('<path d="M12 3a9 9 0 1 0 0 18c1.500 0 2-1 2-2 0-1.500-1-2 0-3s4 .5 6-1.500A9 9 0 0 0 12 3z"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7.500" r="1"/><circle cx="16" cy="10" r="1"/>'),
  keys: IC('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'),
  line: P('M4 20L20 4'),
  arrow: P('M4 20L20 4M11 4h9v9'),
  rect: IC('<rect x="3" y="6" width="18" height="12" rx="1"/>'),
  ellipse: IC('<ellipse cx="12" cy="12" rx="9" ry="6.5"/>'),
  triangle: P('M12 4l9 16H3z'),
  angle: P('M20 20H4L15 5M11 20a7 7 0 0 0-2.800-5.600'),
  axFull: P('M3 12h18M12 21V3M18.5 9.5L21 12l-2.5 2.5M9.5 5.5L12 3l2.5 2.5'),
  axQ1: P('M5 19h16M5 19V3M18.5 16.5L21 19l-2.5 2.5M2.5 5.500L5 3l2.5 2.5'),
  axQ14: P('M5 12h16M5 21V3M18.5 9.5L21 12l-2.5 2.5M2.5 5.500L5 3l2.5 2.5'),
  asym: IC('<path d="M8 3v18M3 17h18" stroke-dasharray="2.5 3"/><path d="M11 4c.5 7 3 10.500 10 11"/>'),
  trig: IC('<circle cx="12" cy="12" r="8.5"/><path d="M12 12l6-6M3.5 12h17"/>'),
  ruler: IC('<rect x="2" y="8" width="20" height="8" rx="1"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/>'),
  protractor: P('M3 17a9 9 0 0 1 18 0zM12 17v-3M7.5 12.500l1.500 1.500M16.5 12.5l-1.5 1.5'),
  compass: IC('<circle cx="12" cy="4.500" r="1.500"/><path d="M12 6L6 21M12 6l6 15M8.500 14h7"/>'),
  physics: IC('<path d="M2 12h2l1.500-4 2.500 8 2.500-8 2.500 8 1.500-4h1.500"/><rect x="16" y="8" width="6" height="8" rx="1"/>'),
  timer: IC('<circle cx="12" cy="13.500" r="7.500"/><path d="M12 13.500V9.500M9.500 3h5M12 3v3"/>'),
  curtain: IC('<rect x="3" y="4" width="18" height="16" rx="1.500"/><path d="M3 12h18M7 12v8M12 12v8M17 12v8"/>'),
  spot: IC('<circle cx="12" cy="12" r="5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  play: P('M8 5l11 7-11 7z'),
  send: P('M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2'),
  plus: P('M12 5v14M5 12h14'),
  minus: P('M5 12h14'),
};

const app = document.getElementById('app')!;
app.insertAdjacentHTML(
  'beforeend',
  `
  <button id="menuBtn" class="fab" title="Μενού">☰</button>
  <button id="overlayClose" class="fab hidden" title="Κλείσιμο και επιστροφή στον πίνακα">✕</button>
  <div id="menu" class="popup hidden">
    ${mi('data-act="lib"', I.lib, 'Μαθήματα…')}
    ${mi('data-act="open"', I.folder, 'Άνοιγμα αρχείου ως νέο μάθημα…')}
    ${mi('data-act="save"', I.save, 'Αποθήκευση του μαθήματος σε αρχείο')}
    ${mi('data-act="pdf"', I.doc, 'Εξαγωγή όλων των σελίδων σε PDF')}
    ${mi('data-act="png"', I.image, 'Εξαγωγή σελίδας σε PNG')}
    ${mi('data-act="send"', I.send, 'Αποστολή στους μαθητές (QR)…')}
    <hr />
    <div class="bgRow">
      <span>Φόντο</span>
      <button data-act="bg-white" class="bgSw" title="Λευκό"></button>
      <button data-act="bg-grid" class="bgSw grid" title="Λευκό με πλέγμα"></button>
      <button data-act="bg-lines" class="bgSw lines" title="Λευκό με γραμμές τετραδίου"></button>
      <button data-act="bg-dark" class="bgSw dark" title="Σκούρο"></button>
      <button data-act="bg-dark-grid" class="bgSw dark grid" title="Σκούρο με πλέγμα"></button>
      <button data-act="bg-dark-lines" class="bgSw dark lines" title="Σκούρο με γραμμές τετραδίου"></button>
    </div>
    <hr />
    ${mi('data-act="fit"', I.fit, 'Προσαρμογή προβολής')}
    ${mi('data-act="clear"', I.clear, 'Καθαρισμός σελίδας')}
    ${mi('data-act="delpage"', I.delpage, 'Διαγραφή σελίδας')}
    <hr />
    ${mi('data-act="overlay" id="overlayAct" class="hidden"', I.screen, 'Γράψιμο πάνω από άλλα προγράμματα')}
    ${mi('data-act="ai"', I.spark, 'Αναγνώριση γραφής (ρυθμίσεις)…')}
    ${mi('data-act="full"', I.full, 'Πλήρης οθόνη')}
    ${mi('data-act="labels"', I.tag, 'Ονόματα κάτω από τα εικονίδια')}
    ${mi('data-act="pdflogo"', I.doc, 'Λογότυπο στις σελίδες του PDF')}
    ${mi('data-act="diag"', I.target, 'Διάγνωση αφής/γραφίδας')}
    ${mi('data-act="test"', I.check, 'Λίστα δοκιμής στην τάξη')}
  </div>

  <div id="zoomCtl">
    <button id="zoomOut" title="Σμίκρυνση">${I.minus}</button>
    <button id="zoomFit" title="Προσαρμογή: όλη η σελίδα στην οθόνη">100%</button>
    <button id="zoomIn" title="Μεγέθυνση">${I.plus}</button>
  </div>
  <div id="toolbarWrap">
  <div id="toolbar">
    <div id="barTab">
      <button id="barDrag"><span>⠿</span>Μετακίνηση γραμμής εργαλείων</button>
      <button id="barSmaller"><span>−</span>Μικρότερη</button>
      <button id="barBigger"><span>＋</span>Μεγαλύτερη</button>
      <button id="barFold"><span>▾</span>Σύμπτυξη</button>
    </div>
    <div id="subbar">
      <div class="group" id="penKinds">
        <button data-pen="pen"><span>${PENCIL_ICON}</span>Στυλό</button>
        <button data-pen="laser"><span>${LASER_ICON}</span>Δείκτης λέιζερ (σβήνει μόνος του)</button>
        <button data-auto="text" class="rec"><span>Aα</span>Αυτόματη αναγνώριση κειμένου: ό,τι γράφεις γίνεται καθαρό κείμενο μόλις σταματήσεις</button>
        <button data-auto="math" class="rec"><span>√x</span>Αυτόματη αναγνώριση τύπων: ό,τι γράφεις γίνεται τυπωμένος τύπος μόλις σταματήσεις</button>
      </div>
      <div class="group" id="shapes">
        <button data-shape="line"><span>╱</span>Ευθεία</button>
        <button data-shape="arrow"><span>➚</span>Βέλος</button>
        <button data-shape="rect"><span>▭</span>Ορθογώνιο</button>
        <button data-shape="ellipse"><span>◯</span>Έλλειψη</button>
        <button data-shape="triangle"><span>△</span>Τρίγωνο</button>
        <button data-shape="angle"><span>∠</span>Γωνία με μοίρες</button>
      </div>
      <div class="group" id="eraserOpts">
        <button data-eraser="partial"><span>◌</span>Σβήνει μόνο ό,τι είναι μέσα στον κύκλο</button>
        <button data-eraser="stroke"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14c3-7 5 5 8-1s5 5 10-3"/><path d="M5 5l14 14" stroke="#f87171"/></svg></span>Σβήνει ολόκληρη τη γραμμή</button>
        <button id="eraseAll"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11l4 5M14 11l-4 5"/></svg></span>Σβήσιμο όλων</button>
      </div>
      <div class="group" id="selOpts">
        <button id="del"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg></span>Διαγραφή επιλογής</button>
        <button id="dup"><span class="txt">×2</span>Αντίγραφο επιλογής</button>
        <button id="sumBtn"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l5-12M4 20l11-3"/><path d="M4 20L20 5" stroke="#60a5fa"/><path d="M14 5h6v6" stroke="#60a5fa"/></svg></span>Συνισταμένη: δύο βέλη ή ευθείες με κοινή κορυφή, ή μία γωνία</button>
        <button data-rec="text" class="rec"><span>Aα</span>Αναγνώριση της επιλογής ως κείμενο</button>
        <button data-rec="math" class="rec"><span>√x</span>Αναγνώριση της επιλογής ως τύπο</button>
      </div>
      <div class="group" id="axesOpts">
        <button data-axis="x"><span>x</span>Όνομα οριζόντιου άξονα</button>
        <button data-axis="y"><span>y</span>Όνομα κατακόρυφου άξονα</button>
        <button id="fnBtn"><span class="txt">f(x)</span>Γραφική παράσταση συνάρτησης</button>
        <button data-an="int"><span class="txt">∫</span>Ορισμένο ολοκλήρωμα ως εμβαδόν (δεύτερο πάτημα: χωρίο ανάμεσα σε δύο συναρτήσεις)</button>
        <button data-an="sum"><span class="txt">Σ</span>Αθροίσματα Riemann: κάθε πάτημα διπλασιάζει τα ορθογώνια (4, 8, 16, 32)</button>
        <button data-an="lim"><span class="txt">lim</span>Όριο σε σημείο: σύρε το σημείο πάνω στην καμπύλη προς το x₀</button>
        <button data-an="tan"><span class="txt">f′</span>Εφαπτομένη και παράγωγος (δεύτερο πάτημα: και η τέμνουσα)</button>
        <button data-an="asym"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v18M3 17h18" stroke-dasharray="2.5 3"/><path d="M11 4c.5 7 3 10.500 10 11"/></svg></span>Ασύμπτωτες</button>
      </div>
      <div class="group" id="springOpts">
        <button id="spMarks"><span class="txt">ΘΦΜ</span>Εμφάνιση θέσης φυσικού μήκους, θέσης ισορροπίας και ±A</button>
        <button id="spDamp"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c1.500-9 3.500-9 5 0s3 6 4.500 0 2.500-4 3.500 0 2 2.500 3 0 1.500-1 2 0h1.500"/></svg></span>Απόσβεση: η ταλάντωση σβήνει σιγά σιγά</button>
        <button id="spStop"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg></span>Σταμάτημα ταλάντωσης</button>
      </div>
      <div class="group" id="widths"></div>
    </div>
    <div class="group" id="tools">
      <button data-tool="select" data-l="Επιλογή"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="13" height="11" rx="1.5" stroke-dasharray="3 2.5"/><path d="M12 11l9 4.5-4 1.3-1.3 4z" fill="currentColor"/></svg></span>Επιλογή (σύρε γύρω από πολλά για ομαδική επιλογή)</button>
      <button id="penBtn" data-l="Γραφή"><span>${PENCIL_ICON}</span>Γραφή</button>
      <button data-tool="highlighter" data-l="Υπογρ."><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3l6 6-8 8H8l-2-2v-4z"/><path d="M3 21h13" stroke="#facc15" stroke-width="3.5"/></svg></span>Υπογραμμιστικό</button>
      <button data-tool="text" data-l="Κείμενο"><span>T</span>Κείμενο</button>
      <button data-tool="eraser" data-l="Γόμα"><span><svg viewBox="0 0 24 24"><g transform="rotate(-40 12 12)"><rect x="3" y="7.5" width="9" height="9" rx="1.5" fill="#fb7185"/><rect x="12" y="7.5" width="9" height="9" rx="1.5" fill="#60a5fa"/><rect x="11" y="7.5" width="2" height="9" fill="#f9fafb"/></g></svg></span>Γόμα</button>
      <button data-tool="measure" data-l="Μέτρηση"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16L16 3l5 5L8 21z"/><path d="M7 12l2 2M10 9l2 2M13 6l2 2"/></svg></span>Μετρήσεις: πάτα ένα σχήμα για μήκη, γωνίες, εμβαδόν, περίμετρο· σύρε μέσα σε μια γωνία για να τη μετρήσεις</button>
      <button data-tool="hand" data-l="Κίνηση"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg></span>Μετακίνηση πίνακα</button>
    </div>
    <div class="group" id="colors"></div>
    <div class="group">
      <button id="undo" data-l="Αναίρ."><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4L3 9l5 5"/><path d="M3 9h11a5.5 5.5 0 0 1 0 11h-4"/></svg></span>Αναίρεση</button>
      <button id="redo" data-l="Ξανά"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4l5 5-5 5"/><path d="M21 9H10a5.5 5.5 0 0 0 0 11h4"/></svg></span>Επανάληψη</button>
    </div>
    <div class="group">
      <button id="importBtn" class="accent" data-l="Εισαγ."><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg></span>Εισαγωγή</button>
      <button id="gadgetBtn" data-l="Όργανα"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3l4.5 8h-9z"/><circle cx="17" cy="7.5" r="4"/><rect x="4" y="14" width="7" height="7" rx="1"/><path d="M14 21l7-7"/></svg></span>Όργανα και βοηθήματα</button>
    </div>
    <div class="group pages">
      <button id="prev"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></span></button>
      <div id="pageLabel">1 / 1</div>
      <button id="next"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></span></button>
      <button id="addPage" data-l="Σελίδα"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3" width="13" height="15" rx="2"/><path d="M4 7v12a2 2 0 0 0 2 2h10M13.5 7v7M10 10.5h7"/></svg></span>Σελίδα</button>
    </div>
  </div>
  </div>
  <div id="dockHint" class="hidden"></div>

  <div id="importMenu" class="popup hidden">
    ${mi('data-imp="file"', I.folder, 'Εικόνα ή PDF από αρχείο…')}
    ${mi('data-imp="shot"', I.screen, 'Στιγμιότυπο οθόνης')}
    ${mi('data-imp="paste"', I.paste, 'Επικόλληση από το πρόχειρο')}
    <hr />
    ${mi('data-ins="tpl"', I.doc, 'Σελίδα από πρότυπο…')}
  </div>

  <div id="stampMenu" class="popup hidden"><div id="stampGrid"></div></div>

  <div id="tplMenu" class="popup hidden">
    <div id="tplList"></div>
    <hr />
    ${mi('id="tplSave"', I.plus, 'Αποθήκευση της σελίδας ως πρότυπο')}
  </div>

  <div id="gadgetMenu" class="popup hidden">
    <div class="gHead">Σχήματα</div>
    <div class="tiles">
      ${tile('data-shape="line"', I.line, 'Ευθεία')}
      ${tile('data-shape="arrow"', I.arrow, 'Βέλος')}
      ${tile('data-shape="rect"', I.rect, 'Ορθογώνιο')}
      ${tile('data-shape="ellipse"', I.ellipse, 'Κύκλος', 'Κύκλος ή έλλειψη')}
      ${tile('data-shape="triangle"', I.triangle, 'Τρίγωνο')}
      ${tile('data-shape="angle"', I.angle, 'Γωνία', 'Γωνία με μοίρες')}
    </div>
    <div class="gHead">Άξονες και συναρτήσεις</div>
    <div class="tiles">
      ${tile('data-axes="full"', I.axFull, 'Άξονες', 'Άξονες με 4 τεταρτημόρια')}
      ${tile('data-axes="q1"', I.axQ1, '1ο τεταρτ.', 'Άξονες: 1ο τεταρτημόριο')}
      ${tile('data-axes="q14"', I.axQ14, 'x ≥ 0', 'Άξονες: 1ο και 4ο τεταρτημόριο (x ≥ 0)')}
      ${tile('data-ins="trig"', I.trig, 'Τριγ. κύκλος', 'Τριγωνομετρικός κύκλος')}
      ${tile('data-anq="int"', '<b>∫</b>', 'Ολοκλήρωμα', 'Ορισμένο ολοκλήρωμα ως εμβαδόν')}
      ${tile('data-anq="sum"', '<b>Σ</b>', 'Riemann', 'Αθροίσματα Riemann')}
      ${tile('data-anq="lim"', '<b class="sm">lim</b>', 'Όριο', 'Όριο σε σημείο')}
      ${tile('data-anq="tan"', '<b>f′</b>', 'Εφαπτομένη', 'Εφαπτομένη και παράγωγος')}
      ${tile('data-anq="asym"', I.asym, 'Ασύμπτωτες')}
    </div>
    <div class="gHead">Όργανα και φυσική</div>
    <div class="tiles">
      ${tile('data-gadget="ruler"', I.ruler, 'Χάρακας')}
      ${tile('data-gadget="protractor"', I.protractor, 'Μοιρογν.', 'Μοιρογνωμόνιο')}
      ${tile('data-gadget="compass"', I.compass, 'Διαβήτης')}
      ${tile('data-ins="stamps"', I.physics, 'Φυσική…', 'Σχήματα φυσικής')}
    </div>
    <div class="gHead">Παρουσίαση</div>
    <div class="tiles">
      ${tile('data-gadget="timer"', I.timer, 'Χρονόμετρο')}
      ${tile('data-view="curtain"', I.curtain, 'Κουρτίνα')}
      ${tile('data-view="spot"', I.spot, 'Προβολέας')}
      ${tile('data-view="replay"', I.play, 'Αναπαραγωγή', 'Αναπαραγωγή της σελίδας')}
    </div>
  </div>

  <div id="colorMenu" class="popup hidden">
    <div id="colorGrid"></div>
    <label id="colorPick"><i>${I.palette}</i>Οποιοδήποτε χρώμα…<input id="colorInput" type="color" value="#2563eb" /></label>
  </div>
  <div id="measOpts" class="popup hidden">
    <button data-meas="len">Μήκη</button>
    <button data-meas="ang">Γωνίες</button>
    <button data-meas="area">Εμβαδόν</button>
    <button data-meas="per">Περίμετρος</button>
  </div>
  <div id="measMenu" class="popup hidden">
    <div class="fnRow"><input id="measInput" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" /><button id="measOk">✓</button></div>
    <div id="measKeys"></div>
    <div class="hint">Αριθμός: η πλευρά γίνεται τόσα cm (ή η γωνία τόσες μοίρες). Γράμμα ή μονάδα (α, θ, 5 m): αλλάζει μόνο η ετικέτα. Κενό: η πραγματική μέτρηση.</div>
  </div>
  <div id="labelMenu" class="popup hidden">
    <div id="labelGrid"></div>
    ${mi('id="labelOther"', I.keys, 'Άλλο…')}
  </div>
  <div id="fnMenu" class="popup hidden">
    <div id="fnHead"><b>⠿ Συναρτήσεις</b><button id="fnPts" class="pill" title="Ρίζες, ακρότατα και σημεία τομής">• Σημεία</button><button id="fnClose" title="Κλείσιμο">✕</button></div>
    <div id="fnList"></div>
    <div id="fnParams"></div>
    <div class="fnRow"><span>f(x) =</span><input id="fnInput" type="text" inputmode="none" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="x²-3x+2" /><button id="fnAdd">✓</button></div>
    <div id="fnErr" class="hint"></div>
    <div id="fnKeys"></div>
  </div>

  <div id="aiMenu" class="popup hidden">
    <b>Αναγνώριση γραφής</b>
    <div class="bgRow">
      <span>Υπηρεσία</span>
      <button data-prov="gemini" class="pill">Gemini</button>
      <button data-prov="claude" class="pill">Claude</button>
    </div>
    <label class="field">Μοντέλο<input id="aiModel" type="text" list="aiModels" autocomplete="off" spellcheck="false" /><datalist id="aiModels"></datalist></label>
    <label class="field">Κλειδί API<input id="aiKey" type="password" autocomplete="off" spellcheck="false" /></label>
    <div class="aiRow"><button id="aiSave">✓ Αποθήκευση</button><button id="aiForget">Διαγραφή κλειδιού</button></div>
    <div class="hint" id="aiHint"></div>
  </div>

  <div id="sendMenu" class="popup hidden">
    <b>Αποστολή στους μαθητές</b>
    <div id="sendSetup">
      <div class="hint">Για να ανεβαίνει το μάθημα στο Google Drive και να βγαίνει QR, χρειάζεται μία φορά το «Client ID» από το Google Cloud του λογαριασμού σου. Μέχρι τότε μπορείς να κοινοποιείς το PDF με το κουμπί πιο κάτω.</div>
      <label class="field">Client ID<input id="sendId" type="text" autocomplete="off" spellcheck="false" placeholder="….apps.googleusercontent.com" /></label>
      <div class="aiRow"><button id="sendIdSave" class="go">Αποθήκευση</button></div>
    </div>
    <div class="aiRow" id="sendActs">
      <button id="sendDrive" class="go">Ανέβασμα στο Drive και QR</button>
      <button id="sendShare">Κοινοποίηση του PDF</button>
    </div>
    <div id="sendOut" class="hidden">
      <canvas id="sendQr" width="560" height="560"></canvas>
      <div id="sendUrl"></div>
      <div class="aiRow"><button id="sendCopy">Αντιγραφή συνδέσμου</button><button id="sendBig">Μεγάλο QR</button></div>
      <div class="hint" id="sendNote"></div>
    </div>
    <div class="aiRow"><button id="sendIdEdit">Αλλαγή Client ID</button><button id="sendClose">Κλείσιμο</button></div>
  </div>
  <div id="qrBig" class="hidden"><img src="./logo.svg" alt="" /><canvas width="1200" height="1200"></canvas><div></div></div>

  <div id="replayBar" class="hidden">
    <span>Αναπαραγωγή</span>
    <button data-rp="pause" title="Παύση / συνέχεια">⏸</button>
    <button data-rp="step" title="Επόμενο βήμα">⏭</button>
    <button data-rp="stop" title="Τέλος">✕</button>
  </div>
  <div id="textEd" class="hidden">
    <textarea rows="2" placeholder="Γράψε εδώ…"></textarea>
    <div class="row">
      <button id="textOk">✓ Εντάξει</button>
      <button id="textCancel">✕ Άκυρο</button>
    </div>
  </div>
  <div id="diag" class="hidden"></div>
  <div id="toast" class="hidden"></div>
  <div id="drop" class="hidden">Άφησε το αρχείο εδώ (εικόνα ή PDF)</div>
  <input id="fileImport" type="file" accept="image/*,application/pdf" multiple hidden />
  <input id="fileOpen" type="file" accept=".json,application/json" hidden />
`
);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
/** Ξαναστήνει τη γραμμή εργαλείων και τη δεύτερη σειρά της. */
let layoutBar = (): void => {};
const timer = new Timer(app);
const curtain = new Curtain(app);
const spot = new Spotlight(app);
const board = new Board($('base') as HTMLCanvasElement, $('live') as HTMLCanvasElement);
if (isOverlay) {
  board.transparent = true;
  document.documentElement.classList.add('overlay');
  $('overlayClose').classList.remove('hidden');
  $('overlayClose').onclick = () => void closeOverlay();
}

// ---------- helpers ----------

let toastTimer = 0;
function toast(msg: string, ms = 3000): void {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  if (ms > 0) toastTimer = window.setTimeout(() => t.classList.add('hidden'), ms);
}

function download(blob: Blob, name: string): void {
  if (isNative) {
    nativeSave(blob, name)
      .then((ok) => ok && toast('Αποθηκεύτηκε'))
      .catch((err) => toast(`Αποτυχία αποθήκευσης: ${err}`, 6000));
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Όνομα κατάλληλο για αρχείο. */
function fileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '_').trim() || 'pinakas';
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

// ---------- εισαγωγή ----------

async function importFiles(files: File[]): Promise<void> {
  for (const f of files) {
    try {
      if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
        toast(`Εισαγωγή PDF… 0%`, 0);
        const pages = await pdfToPages(f, (d, n) => toast(`Εισαγωγή PDF… σελίδα ${Math.min(d + 1, n)} από ${n}`, 0));
        board.appendPages(pages);
        toast(`Προστέθηκαν ${pages.length} σελίδες από το PDF`);
      } else if (f.type.startsWith('image/')) {
        const pic = await blobToPic(f);
        board.addPicture(pic.src, pic.w, pic.h);
      } else if (/\.json$/i.test(f.name)) {
        const doc = JSON.parse(await f.text()) as Doc;
        if (doc?.v !== 1 || !Array.isArray(doc.pages) || doc.pages.length === 0) throw new Error('Μη έγκυρο αρχείο πίνακα');
        // το αρχείο ανοίγει ως ξεχωριστό μάθημα· το τρέχον δεν πειράζεται
        if (lessons) await lessons.createFrom(doc, f.name.replace(/\.json$/i, ''));
        else board.loadDoc(doc);
        toast('Το αρχείο άνοιξε ως νέο μάθημα');
      } else {
        toast(`Μη υποστηριζόμενο αρχείο: ${f.name}`);
      }
    } catch (err) {
      console.error(err);
      toast(`Αποτυχία εισαγωγής: ${f.name}`, 5000);
    }
  }
}

async function doScreenshot(): Promise<void> {
  try {
    const pic = isNative ? await blobToPic(await nativeScreenshot()) : await captureScreen();
    board.addPicture(pic.src, pic.w, pic.h);
  } catch (err) {
    const name = (err as Error).name;
    if (name === 'NotAllowedError') return; // ο χρήστης ακύρωσε
    toast('Η λήψη οθόνης δεν υποστηρίζεται εδώ. Βγάλε στιγμιότυπο με τη συσκευή και πάτα «Επικόλληση» ή Εισαγωγή αρχείου.', 7000);
  }
}

async function doPaste(): Promise<void> {
  try {
    const blob = await clipboardImage();
    if (!blob) {
      toast('Δεν βρέθηκε εικόνα στο πρόχειρο');
      return;
    }
    const pic = await blobToPic(blob);
    board.addPicture(pic.src, pic.w, pic.h);
  } catch {
    toast('Δεν επιτρέπεται η πρόσβαση στο πρόχειρο. Δοκίμασε Ctrl+V.', 5000);
  }
}

document.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files ?? [])];
  if (files.length) {
    e.preventDefault();
    void importFiles(files);
  }
});

let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  $('drop').classList.remove('hidden');
});
window.addEventListener('dragleave', () => {
  if (--dragDepth <= 0) {
    dragDepth = 0;
    $('drop').classList.add('hidden');
  }
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('drop').classList.add('hidden');
  void importFiles([...(e.dataTransfer?.files ?? [])]);
});

// ---------- γραμμή εργαλείων ----------

const PREFS_KEY = 'grafida.prefs';
/** Το τελευταίο χρώμα που διάλεξε ο χρήστης εκτός βασικής παλέτας. */
let customColor: string | null = null;
try {
  const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
  for (const t of ['pen', 'highlighter', 'eraser'] as SizedTool[]) {
    if (SIZES[t].includes(p.sizes?.[t])) board.sizes[t] = p.sizes[t];
  }
  if (p.eraserMode === 'stroke' || p.eraserMode === 'partial') board.eraserMode = p.eraserMode;
  if (typeof p.customColor === 'string') customColor = p.customColor;
} catch {
  /* χωρίς αποθηκευμένες προτιμήσεις */
}
function savePrefs(): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ sizes: board.sizes, eraserMode: board.eraserMode, customColor }));
  } catch {
    /* δεν πειράζει */
  }
}

const inkPalette = (): string[] => PALETTE[isDark(board.doc.bg) ? 'dark' : 'light'];
/** Τα χρώματα που δείχνει η γραμμή: του υπογραμμιστικού όταν το κρατάς, αλλιώς της γραφής. */
const palette = (): string[] => (board.tool === 'highlighter' ? HL_PALETTE : inkPalette());
/** Το υπογραμμιστικό και η γραφή θυμούνται το καθένα το δικό του χρώμα. */
let hlColor = HL_PALETTE[0];
let inkColor: string | null = null;
let wasHl = false;
const colorsEl = $('colors');
let colorsKey = '';
function renderColors(): void {
  const list = [...palette()];
  if (board.tool !== 'highlighter' && customColor && !list.includes(customColor)) list.push(customColor);
  if (!list.includes(board.color)) list.push(board.color);
  const key = list.join();
  if (key === colorsKey) return;
  colorsKey = key;
  colorsEl.innerHTML =
    list.map((c) => `<button class="color" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('') +
    '<button id="colorBtn" title="Περισσότερα χρώματα" aria-label="Περισσότερα χρώματα"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2.2-.6-1.5.3-2.8 2-2.8H18a3 3 0 0 0 3-3c0-5.500-4-10-9-10z"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1" fill="currentColor"/><circle cx="15" cy="8" r="1" fill="currentColor"/></svg></span></button>';
}
$('colorGrid').innerHTML = MORE_COLORS.map((c) => `<button class="color" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');

const widthsEl = $('widths');
SIZE_NAME.forEach((name, i) => {
  const b = document.createElement('button');
  b.className = 'width';
  b.dataset.width = String(i);
  b.title = name;
  b.innerHTML = `<i style="width:${6 + i * 6}px;height:${6 + i * 6}px"></i>`;
  widthsEl.append(b);
});
/** Το εργαλείο του οποίου το μέγεθος δείχνουν τα κουμπιά πάχους. */
const sizedTool = (): SizedTool => (board.tool === 'eraser' || board.tool === 'highlighter' ? board.tool : 'pen');

/** Η παραλλαγή γραφής που διαλέχτηκε τελευταία (στυλό, μαρκαδόρος ή λέιζερ). */
let penKind: PenKind = 'pen';
const isPenKind = (t: Tool): t is PenKind => t === 'pen' || t === 'laser';

function pickColor(c: string): void {
  board.color = c;
  if (board.tool !== 'highlighter' && !palette().includes(c)) customColor = c;
  if (!['highlighter', 'pen', 'shape', 'text'].includes(board.tool)) board.setTool(penKind === 'laser' ? 'pen' : penKind);
  savePrefs();
  refreshUi();
}

$('shapes').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-shape]');
  if (!b) return;
  board.shapeKind = b.dataset.shape as ShapeKind | 'angle';
  refreshUi();
});
$('tools').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('#penBtn')) {
    board.setTool(penKind);
    return;
  }
  const b = t.closest<HTMLElement>('[data-tool]');
  if (b) board.setTool(b.dataset.tool as Tool);
});
$('penKinds').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-pen]');
  if (b) board.setTool(b.dataset.pen as PenKind);
});
colorsEl.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('#colorBtn')) {
    togglePopup(colorMenu, $('colorBtn'));
    return;
  }
  const b = t.closest<HTMLElement>('[data-color]');
  if (b) pickColor(b.dataset.color!);
});
$('colorGrid').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-color]');
  if (!b) return;
  closePopups();
  pickColor(b.dataset.color!);
});
($('colorInput') as HTMLInputElement).onchange = (e) => {
  closePopups();
  pickColor((e.target as HTMLInputElement).value.toLowerCase());
};
widthsEl.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-width]');
  if (!b) return;
  const t = sizedTool();
  board.sizes[t] = SIZES[t][Number(b.dataset.width)];
  savePrefs();
  refreshUi();
});
$('eraserOpts').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('#eraseAll')) {
    if (board.page.items.length === 0) return;
    board.clearPage();
    toast('Σβήστηκαν όλα στη σελίδα — πάτα ↶ για να τα φέρεις πίσω');
    return;
  }
  const b = t.closest<HTMLElement>('[data-eraser]');
  if (!b) return;
  board.eraserMode = b.dataset.eraser as EraserMode;
  savePrefs();
  refreshUi();
});
$('undo').onclick = () => board.undo();
$('redo').onclick = () => board.redo();
$('del').onclick = () => board.deleteSelected();
$('dup').onclick = () => board.duplicateSelected();
$('sumBtn').onclick = () => board.addResultant();
$('prev').onclick = () => board.goto(board.cur - 1);
$('next').onclick = () => board.goto(board.cur + 1);
$('addPage').onclick = () => board.addPage();

// ---------- άξονες: ονόματα και συναρτήσεις ----------

const AXIS_LABELS = ['x', 'y', 't', 's', 'υ', 'u', 'v', 'a', 'F', 'm', 'V', 'P', 'T', 'I', 'R', 'W', 'E', 'f(x)'];
let labelAxis: 'x' | 'y' = 'y';
$('labelGrid').innerHTML = AXIS_LABELS.map((l) => `<button data-label="${l}">${l}</button>`).join('');
$('axesOpts').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('#fnBtn')) {
    togglePopup(fnMenu, $('fnBtn'));
    renderFns();
    return;
  }
  const anKey = t.closest<HTMLElement>('[data-an]')?.dataset.an;
  if (anKey) {
    toggleAnalysis(anKey);
    return;
  }
  const b = t.closest<HTMLElement>('[data-axis]');
  if (!b) return;
  const same = !labelMenu.classList.contains('hidden') && labelAxis === b.dataset.axis;
  closePopups();
  if (same) return;
  labelAxis = b.dataset.axis as 'x' | 'y';
  labelMenu.classList.remove('hidden');
  placeNear(labelMenu, b);
});
/** Ανάβει, αλλάζει μορφή ή σβήνει ένα εργαλείο ανάλυσης στους επιλεγμένους άξονες. */
function toggleAnalysis(key: string): void {
  const ax = board.selectedAxes;
  if (!ax) return;
  closePopups();
  const shown = (ax.fns ?? []).filter((f) => !f.hidden).length;
  if (!shown) {
    toast('Γράψε πρώτα μια συνάρτηση με το f(x)');
    return;
  }
  const r = axesRange(ax);
  const inX = (v: number): number => Math.max(r.xmin, Math.min(r.xmax, v));
  const an: AxesAn = { ...ax.an };
  const newInt = { a: inX(1), b: inX(3) };
  if (key === 'int') {
    if (!an.int) an.int = newInt;
    else if (!an.int.between && shown >= 2) an.int = { ...an.int, between: true };
    else delete an.int;
  } else if (key === 'sum') {
    const n = an.int?.n;
    const next = !n ? 4 : n >= 32 ? undefined : n * 2;
    an.int = { ...(an.int ?? newInt), n: next };
  } else if (key === 'lim') {
    if (an.lim) delete an.lim;
    else an.lim = { x0: inX(0), x: inX(1.5) };
  } else if (key === 'tan') {
    if (!an.tan) an.tan = { x: inX(1) };
    else if (!an.tan.h) an.tan = { ...an.tan, h: 1 };
    else delete an.tan;
  } else if (key === 'asym') an.asym = !an.asym;
  board.updateAxes({ an });
}
$('labelMenu').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  let label = t.closest<HTMLElement>('[data-label]')?.dataset.label;
  if (t.closest('#labelOther')) label = prompt('Όνομα άξονα:')?.trim().slice(0, 12) || undefined;
  closePopups();
  if (label) board.setAxisLabel(labelAxis, label);
});

const fnInput = $('fnInput') as HTMLInputElement;
const FN_KEYS = [
  '7', '8', '9', '÷', 'x', 'x²', '^', '√',
  '4', '5', '6', '×', '(', ')', '|', 'π',
  '1', '2', '3', '−', 'ημ(', 'συν(', 'εφ(', 'ln(',
  '0', ',', '+', 'e', 'a', 'b', '⌫', 'C',
  'σφ(', 'log(', 'c', 'k', 'λ', 'ω', '←', '→',
];
const FN_INSERT: Record<string, string> = { 'x²': '²', '÷': '/', '×': '·', '−': '-' };
$('fnKeys').innerHTML = FN_KEYS.map((k) => `<button data-key="${k}"${/^[0-9,]$/.test(k) ? ' class="num"' : ''}>${k}</button>`).join('');
const esc = (t: string): string => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
/** Ποια συνάρτηση της λίστας διορθώνεται (null = γράφεται καινούργια). */
let fnEdit: number | null = null;
/** Ο χρήστης έσυρε το πλαίσιο: δεν το ξανατοποθετούμε μόνοι μας. */
let fnMoved = false;
let fnParamKey = '';

function nextFnColor(): string {
  const pal = [...inkPalette(), '#ea580c', '#7c3aed'];
  return pal[1 + ((board.selectedAxes?.fns?.length ?? 0) % (pal.length - 1))];
}
/** Βάζει το πλαίσιο δίπλα στους άξονες, ώστε η καμπύλη να φαίνεται όσο γράφεις. */
function placeFnMenu(): void {
  const ax = board.selectedAxes;
  if (fnMoved || !ax || fnMenu.classList.contains('hidden')) return;
  const b = itemBounds(ax);
  const [l, t] = board.toScreen(b.x0, b.y0);
  const [r, bt] = board.toScreen(b.x1, b.y1);
  const w = fnMenu.offsetWidth, h = fnMenu.offsetHeight;
  const roomR = window.innerWidth - r, roomL = l;
  fnMenu.style.left = (roomR >= roomL ? Math.min(r + 12, window.innerWidth - w - 8) : Math.max(8, l - w - 12)) + 'px';
  fnMenu.style.top = Math.max(8, Math.min((t + bt) / 2 - h / 2, window.innerHeight - h - 8)) + 'px';
}
function renderFnParams(): void {
  const ax = board.selectedAxes;
  const exprs = [...(ax?.fns ?? []).map((f) => f.expr), fnInput.value];
  const names = [...new Set(exprs.flatMap(paramsOf))];
  const val = (n: string): number => board.paramPreview?.[n] ?? ax?.params?.[n] ?? 1;
  const box = $('fnParams');
  if (names.join() !== fnParamKey) {
    fnParamKey = names.join();
    box.innerHTML = names
      .map((n) => `<label class="fnPar"><b>${esc(n)} = <output></output></b><input type="range" min="-5" max="5" step="0.1" data-par="${esc(n)}" /></label>`)
      .join('');
  }
  box.querySelectorAll<HTMLInputElement>('[data-par]').forEach((sl) => {
    const v = val(sl.dataset.par!);
    sl.value = String(v);
    sl.parentElement!.querySelector('output')!.textContent = String(+v.toFixed(1));
  });
}
function renderFns(): void {
  const ax = board.selectedAxes;
  const fns = ax?.fns ?? [];
  $('fnList').innerHTML = fns
    .map(
      (f, i) =>
        `<div class="fnItem${f.hidden ? ' off' : ''}${i === fnEdit ? ' ed' : ''}"><button data-fnvis="${i}" class="vis" style="--c:${f.color}" title="Εμφάνιση / απόκρυψη"></button>` +
        `<span data-fnedit="${i}" title="Πάτα για διόρθωση">${esc(f.expr)}</span><button data-fndel="${i}" title="Αφαίρεση">✕</button></div>`,
    )
    .join('');
  $('fnPts').classList.toggle('on', !!ax?.points);
  renderFnParams();
  if (!fnInput.value) $('fnErr').textContent = fns.length ? '' : 'Γράψε π.χ. x²-3x+2, ημ(x), 1/x, ή με παραμέτρους: ax²+b';
  placeFnMenu();
}
/** Σχεδιάζει ζωντανά αυτό που γράφεται, χωρίς να το αποθηκεύει. */
function previewFn(): void {
  const expr = fnInput.value.trim();
  if (!expr) {
    board.fnPreview = null;
    $('fnErr').textContent = '';
  } else {
    try {
      compile(expr);
      board.fnPreview = { index: fnEdit, expr, color: nextFnColor() };
      $('fnErr').textContent = '';
    } catch (err) {
      // κρατάμε την τελευταία έγκυρη μορφή στην οθόνη
      $('fnErr').textContent = `… ${(err as Error).message}`;
    }
  }
  renderFnParams();
  board.redraw();
}
function resetFnDraft(): void {
  const dirty = !!board.fnPreview || !!board.paramPreview;
  board.fnPreview = null;
  board.paramPreview = null;
  fnEdit = null;
  fnInput.value = '';
  if (dirty) board.redraw();
}
function addFn(): void {
  const ax = board.selectedAxes;
  const expr = fnInput.value.trim();
  if (!ax || !expr) return;
  try {
    compile(expr);
  } catch (err) {
    $('fnErr').textContent = `Δεν το κατάλαβα: ${(err as Error).message}`;
    return;
  }
  const fns = ax.fns ?? [];
  const next = fnEdit === null ? [...fns, { expr, color: nextFnColor() }] : fns.map((f, i) => (i === fnEdit ? { ...f, expr } : f));
  const params = { ...ax.params, ...board.paramPreview };
  for (const n of paramsOf(expr)) params[n] ??= 1;
  board.fnPreview = null;
  board.paramPreview = null;
  fnEdit = null;
  fnInput.value = '';
  board.updateAxes({ fns: next, params });
  renderFns();
}
$('fnAdd').onclick = addFn;
$('spMarks').onclick = () => board.updateSpring({ marks: !board.selectedSpring?.marks });
$('spDamp').onclick = () => board.updateSpring({ damp: !board.selectedSpring?.damp });
$('spStop').onclick = () => board.stopSpring();
fnInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addFn();
});
fnInput.addEventListener('input', previewFn);
$('fnKeys').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
  if (!b) return;
  const key = b.dataset.key!;
  const from = fnInput.selectionStart ?? fnInput.value.length;
  const to = fnInput.selectionEnd ?? from;
  let at = from;
  if (key === 'C') {
    fnInput.value = '';
    at = 0;
  } else if (key === '←' || key === '→') {
    at = Math.max(0, Math.min(fnInput.value.length, (key === '←' ? from : to) + (key === '←' ? -1 : 1)));
  } else if (key === '⌫') {
    const cut = from === to ? Math.max(0, from - 1) : from;
    fnInput.value = fnInput.value.slice(0, cut) + fnInput.value.slice(to);
    at = cut;
  } else {
    const k = FN_INSERT[key] ?? key;
    fnInput.value = fnInput.value.slice(0, from) + k + fnInput.value.slice(to);
    at = from + k.length;
  }
  fnInput.focus();
  fnInput.setSelectionRange(at, at);
  previewFn();
});
$('fnList').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const ax = board.selectedAxes;
  if (!ax) return;
  const fns = ax.fns ?? [];
  const idx = (k: string): number | null => {
    const el = t.closest<HTMLElement>(`[data-${k}]`);
    return el ? Number(el.dataset[k]) : null;
  };
  const del = idx('fndel'), vis = idx('fnvis'), ed = idx('fnedit');
  if (del !== null) {
    resetFnDraft();
    board.updateAxes({ fns: fns.filter((_, i) => i !== del) });
  } else if (vis !== null) {
    board.updateAxes({ fns: fns.map((f, i) => (i === vis ? { ...f, hidden: !f.hidden } : f)) });
  } else if (ed !== null) {
    fnEdit = fnEdit === ed ? null : ed;
    fnInput.value = fnEdit === null ? '' : fns[ed].expr;
    fnInput.focus();
    previewFn();
  }
  renderFns();
});
$('fnParams').addEventListener('input', (e) => {
  const sl = e.target as HTMLInputElement;
  if (!sl.dataset.par) return;
  board.paramPreview = { ...board.paramPreview, [sl.dataset.par]: Number(sl.value) };
  sl.parentElement!.querySelector('output')!.textContent = String(+Number(sl.value).toFixed(1));
  board.redraw();
});
$('fnParams').addEventListener('change', () => {
  const ax = board.selectedAxes;
  if (!ax || !board.paramPreview) return;
  const params = { ...ax.params, ...board.paramPreview };
  board.paramPreview = null;
  board.updateAxes({ params });
});
$('fnPts').onclick = () => {
  const ax = board.selectedAxes;
  if (ax) board.updateAxes({ points: !ax.points });
  renderFns();
};
$('fnClose').onclick = () => closePopups();
{
  // το πλαίσιο σέρνεται από την κεφαλίδα του
  const head = $('fnHead');
  let off: { x: number; y: number } | null = null;
  head.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const r = fnMenu.getBoundingClientRect();
    off = { x: e.clientX - r.left, y: e.clientY - r.top };
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', (e) => {
    if (!off) return;
    fnMoved = true;
    fnMenu.style.left = Math.max(0, Math.min(e.clientX - off.x, window.innerWidth - 80)) + 'px';
    fnMenu.style.top = Math.max(0, Math.min(e.clientY - off.y, window.innerHeight - 50)) + 'px';
  });
  const end = (): void => { off = null; };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
}

// ---------- αλλαγή μέτρησης πλευράς ----------

const measMenu = $('measMenu');
const measInput = $('measInput') as HTMLInputElement;
const MEAS_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', ',', '⌫', 'α', 'β', 'γ', 'x', 'm', 'cm', 'θ', 'φ', 'ω', '°', 'Α', 'Β'];
$('measKeys').innerHTML = MEAS_KEYS.map((k) => `<button data-key="${k}"${/^[0-9,]$/.test(k) ? ' class="num"' : ''}>${k}</button>`).join('');
let measTarget: { id: string; side: number } | null = null;
const measOpts = $('measOpts');
/** Το σχήμα του οποίου οι επιλογές μετρήσεων είναι ανοιχτές. */
let measShape: string | null = null;
function renderMeasOpts(): void {
  const sh = board.page.items.find((x) => x.id === measShape);
  if (!sh || (sh.kind !== 'shape' && sh.kind !== 'angle')) {
    measOpts.classList.add('hidden');
    return;
  }
  // ευθεία, βέλος και γωνία έχουν μόνο μήκη
  const line = sh.kind === 'angle' || sh.shape === 'line' || sh.shape === 'arrow';
  const avail: Record<string, boolean> = { len: true, ang: sh.kind === 'shape' && (sh.shape === 'rect' || sh.shape === 'triangle'), area: !line, per: !line };
  measOpts.querySelectorAll<HTMLButtonElement>('[data-meas]').forEach((b) => {
    const k = b.dataset.meas as keyof MeasOpts;
    b.classList.toggle('on', !!sh.meas?.[k]);
    b.classList.toggle('hidden', !avail[k]);
  });
}
measOpts.addEventListener('click', (e) => {
  const k = (e.target as HTMLElement).closest<HTMLElement>('[data-meas]')?.dataset.meas as keyof MeasOpts | undefined;
  const sh = board.page.items.find((x) => x.id === measShape);
  if (!k || !sh || (sh.kind !== 'shape' && sh.kind !== 'angle')) return;
  board.setMeas(sh.id, { ...sh.meas, [k]: !sh.meas?.[k] });
  renderMeasOpts();
});
/** Μόλις άνοιξε: το πρώτο πλήκτρο αντικαθιστά την παλιά τιμή (χωρίς να ανοίγει το πληκτρολόγιο της συσκευής). */
let measFresh = false;
measInput.addEventListener('pointerdown', () => { measFresh = false; });
// με την Επιλογή, πάτημα πάνω σε μια μέτρηση ανοίγει την αλλαγή της (πριν το δει ο πίνακας)
document.addEventListener(
  'pointerdown',
  (e) => {
    if (e.target !== $('live') || (board.tool !== 'select' && board.tool !== 'measure')) return;
    const hit = board.measureAt(e.clientX, e.clientY);
    if (!hit) {
      // με το εργαλείο «Μετρήσεις», πάτημα σε σχήμα ανοίγει από πάνω του τις επιλογές
      const sh = board.tool === 'measure' ? board.shapeAt(e.clientX, e.clientY) : null;
      if (!sh) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      closePopups();
      measShape = sh.id;
      // πρώτο πάτημα σε σχήμα χωρίς μετρήσεις: ξεκινά με τα μήκη
      if (!sh.meas.len && !sh.meas.ang && !sh.meas.area && !sh.meas.per) board.setMeas(sh.id, { len: true });
      renderMeasOpts();
      measOpts.classList.remove('hidden');
      const w = measOpts.offsetWidth, h = measOpts.offsetHeight;
      measOpts.style.left = Math.max(8, Math.min(sh.x - w / 2, window.innerWidth - w - 8)) + 'px';
      measOpts.style.top = Math.max(8, sh.y - h - 34) + 'px';
      return;
    }
    e.stopImmediatePropagation();
    e.preventDefault();
    closePopups();
    measTarget = { id: hit.id, side: hit.side };
    measInput.value = hit.text;
    measMenu.classList.remove('hidden');
    const w = measMenu.offsetWidth, h = measMenu.offsetHeight;
    measMenu.style.left = Math.max(8, Math.min(hit.x - w / 2, window.innerWidth - w - 8)) + 'px';
    measMenu.style.top = (hit.y + 30 + h < window.innerHeight ? hit.y + 30 : Math.max(8, hit.y - h - 30)) + 'px';
    measFresh = true;
  },
  true,
);
function applyMeasure(): void {
  if (measTarget) board.setMeasure(measTarget.id, measTarget.side, measInput.value);
  measTarget = null;
  closePopups();
}
$('measOk').onclick = applyMeasure;
measInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') applyMeasure();
});
$('measKeys').addEventListener('click', (e) => {
  const key = (e.target as HTMLElement).closest<HTMLElement>('[data-key]')?.dataset.key;
  if (!key) return;
  if (measFresh) measInput.value = '';
  measFresh = false;
  const from = document.activeElement === measInput ? measInput.selectionStart ?? measInput.value.length : measInput.value.length;
  const to = document.activeElement === measInput ? measInput.selectionEnd ?? from : from;
  const cut = key === '⌫' ? (from === to ? Math.max(0, from - 1) : from) : from;
  const ins = key === '⌫' ? '' : key === 'm' || key === 'cm' ? ` ${key}` : key;
  measInput.value = measInput.value.slice(0, cut) + ins + measInput.value.slice(to);
});

// ---------- αναγνώριση γραφής ----------

const ai = loadAi();
const aiMenu = $('aiMenu');
const aiKey = $('aiKey') as HTMLInputElement;
const aiModel = $('aiModel') as HTMLInputElement;
const AI_HINT: Record<Provider, string> = {
  gemini: 'Δωρεάν κλειδί από το Google AI Studio (aistudio.google.com), με ημερήσιο όριο. Στη δωρεάν βαθμίδα η Google χρησιμοποιεί ό,τι στέλνεις για να βελτιώνει τα προϊόντα της.',
  claude: 'Κλειδί από το console.anthropic.com. Χρεώνεται ανά χρήση.',
};
function renderAi(): void {
  document.querySelectorAll<HTMLElement>('[data-prov]').forEach((b) => b.classList.toggle('on', b.dataset.prov === ai.provider));
  $('aiModels').innerHTML = MODELS[ai.provider].map((m) => `<option value="${m}"></option>`).join('');
  aiModel.value = ai.models[ai.provider];
  aiKey.value = '';
  aiKey.placeholder = ai.keys[ai.provider] ? '•••••••• (αποθηκευμένο σε αυτή τη συσκευή)' : 'επικόλλησε εδώ το κλειδί σου';
  $('aiHint').textContent = `${AI_HINT[ai.provider]} Το κλειδί μένει μόνο σε αυτή τη συσκευή. Η εικόνα όσων αναγνωρίζεις στέλνεται στην υπηρεσία.`;
}
function openAi(): void {
  closePopups();
  renderAi();
  aiMenu.classList.remove('hidden');
}
aiMenu.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const prov = t.closest<HTMLElement>('[data-prov]')?.dataset.prov as Provider | undefined;
  if (prov) {
    ai.provider = prov;
    saveAi(ai);
    renderAi();
  } else if (t.closest('#aiSave')) {
    if (aiKey.value.trim()) ai.keys[ai.provider] = aiKey.value.trim();
    if (aiModel.value.trim()) ai.models[ai.provider] = aiModel.value.trim();
    saveAi(ai);
    closePopups();
    toast(ai.keys[ai.provider] ? 'Οι ρυθμίσεις αποθηκεύτηκαν' : 'Αποθηκεύτηκαν, αλλά λείπει το κλειδί');
  } else if (t.closest('#aiForget')) {
    ai.keys[ai.provider] = '';
    saveAi(ai);
    renderAi();
    toast('Το κλειδί διαγράφηκε από αυτή τη συσκευή');
  }
});

let aiBusy = 0;
/** Στέλνει τα στοιχεία για αναγνώριση και τα αντικαθιστά με κείμενο ή τυπωμένο τύπο. */
async function runRecognition(ids: string[], kind: RecKind): Promise<void> {
  if (!ai.keys[ai.provider]) {
    openAi();
    toast('Βάλε πρώτα το κλειδί της υπηρεσίας');
    return;
  }
  const page = board.cur;
  const img = await board.inkImage(ids);
  if (!img) return;
  aiBusy++;
  toast('✨ Αναγνώριση…', 0);
  try {
    const out = await recognize(img.blob, kind, ai);
    if (!out) {
      toast('Δεν μπόρεσα να το διαβάσω');
      return;
    }
    if (board.cur !== page) {
      toast('Άλλαξες σελίδα· η αναγνώριση δεν εφαρμόστηκε');
      return;
    }
    const { box, color } = img;
    const bh = box.y1 - box.y0;
    if (kind === 'text') {
      const lines = out.split('\n').length;
      const size = Math.max(22, Math.min(96, (bh / lines) * 0.75));
      board.replaceItems(ids, { kind: 'text', id: uid(), x: box.x0, y: box.y0, text: out, size, color });
    } else {
      let pic = await texToImage(out, board.ink(color), Math.max(24, Math.min(90, bh * 0.45)));
      // ο τύπος να μην βγει πολύ ψηλότερος από το χειρόγραφο
      const f = Math.min(1, (Math.max(bh, 50) * 1.15) / pic.h);
      pic = { ...pic, w: pic.w * f, h: pic.h * f };
      board.replaceItems(ids, { kind: 'image', id: uid(), x: box.x0, y: box.y0 + (bh - pic.h) / 2, w: pic.w, h: pic.h, src: pic.src });
    }
    $('toast').classList.add('hidden');
  } catch (err) {
    toast(`Η αναγνώριση απέτυχε: ${(err as Error).message}`, 6000);
  } finally {
    aiBusy--;
  }
}
$('selOpts').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-rec]');
  if (b) void runRecognition(board.selectionIds, b.dataset.rec as RecKind);
});

// αυτόματη αναγνώριση: ό,τι γράφεται στέλνεται μόλις η γραφίδα μείνει σηκωμένη για λίγο
let autoKind: RecKind | null = null;
let autoBatch: string[] = [];
let autoTimer = 0;
const AUTO_IDLE_MS = 1600;
function autoFlush(): void {
  clearTimeout(autoTimer);
  const ids = autoBatch;
  autoBatch = [];
  if (autoKind && ids.length) void runRecognition(ids, autoKind);
}
board.onStroke = (s) => {
  if (!autoKind) return;
  autoBatch.push(s.id);
  clearTimeout(autoTimer);
  autoTimer = window.setTimeout(autoFlush, AUTO_IDLE_MS);
};
$('live').addEventListener('pointerdown', () => clearTimeout(autoTimer));
const autoRearm = (): void => {
  if (!autoKind || autoBatch.length === 0) return;
  clearTimeout(autoTimer);
  autoTimer = window.setTimeout(autoFlush, AUTO_IDLE_MS);
};
$('live').addEventListener('pointerup', autoRearm);
$('live').addEventListener('pointercancel', autoRearm);
$('penKinds').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-auto]');
  if (!b) return;
  const k = b.dataset.auto as RecKind;
  if (autoKind === k) {
    autoKind = null;
  } else if (!ai.keys[ai.provider]) {
    openAi();
    toast('Βάλε πρώτα το κλειδί της υπηρεσίας');
    return;
  } else {
    autoKind = k;
    if (board.tool !== 'pen') board.setTool('pen');
    toast(k === 'text' ? 'Αυτόματη αναγνώριση κειμένου: γράψε και σταμάτα για λίγο' : 'Αυτόματη αναγνώριση τύπων: γράψε και σταμάτα για λίγο', 4000);
  }
  clearTimeout(autoTimer);
  autoBatch = [];
  refreshUi();
});

// ---------- κατάσταση κουμπιών ----------

function refreshUi(): void {
  const tool = board.tool;
  // μπαίνοντας στο υπογραμμιστικό (ή βγαίνοντας) αλλάζει και το χρώμα που κρατάς
  if ((tool === 'highlighter') !== wasHl) {
    wasHl = tool === 'highlighter';
    if (wasHl) {
      inkColor = board.color;
      board.color = hlColor;
    } else {
      hlColor = board.color;
      board.color = inkColor ?? inkPalette()[0];
    }
  }
  if (isPenKind(tool)) penKind = tool;
  const show = (id: string, on: boolean): void => { $(id).classList.toggle('hidden', !on); };
  document.querySelectorAll<HTMLElement>('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool));
  $('penBtn').classList.toggle('on', isPenKind(tool));
  $('gadgetBtn').classList.toggle('on', tool === 'shape');
  $('penBtn').querySelector('span')!.innerHTML = PEN_ICON[penKind];
  document.querySelectorAll<HTMLElement>('[data-pen]').forEach((b) => b.classList.toggle('on', b.dataset.pen === tool));
  document.querySelectorAll<HTMLElement>('[data-auto]').forEach((b) => b.classList.toggle('on', b.dataset.auto === autoKind));
  renderColors();
  document.querySelectorAll<HTMLElement>('[data-color]').forEach((b) => b.classList.toggle('on', b.dataset.color === board.color));
  const st = sizedTool();
  document.querySelectorAll<HTMLElement>('[data-width]').forEach((b) => b.classList.toggle('on', SIZES[st][Number(b.dataset.width)] === board.sizes[st]));
  document.querySelectorAll<HTMLElement>('[data-eraser]').forEach((b) => b.classList.toggle('on', b.dataset.eraser === board.eraserMode));
  document.querySelectorAll<HTMLElement>('[data-shape]').forEach((b) => b.classList.toggle('on', tool === 'shape' && b.dataset.shape === board.shapeKind));

  // η δεύτερη σειρά δείχνει μόνο ό,τι αφορά το εργαλείο που κρατάς
  const ax = tool === 'select' ? board.selectedAxes : null;
  show('penKinds', isPenKind(tool));
  show('shapes', tool === 'shape');
  show('eraserOpts', tool === 'eraser');
  show('selOpts', tool === 'select' && board.hasSelection);
  // η αναγνώριση έχει νόημα μόνο όταν στην επιλογή υπάρχει χειρόγραφο
  const ink = board.selectionHasInk;
  document.querySelectorAll<HTMLElement>('#selOpts .rec').forEach((b) => b.classList.toggle('hidden', !ink));
  show('sumBtn', !!board.resultantSource);
  show('axesOpts', !!ax);
  const sp = tool === 'select' ? board.selectedSpring : null;
  show('springOpts', !!sp);
  $('spMarks').classList.toggle('on', !!sp?.marks);
  $('spDamp').classList.toggle('on', !!sp?.damp);
  ($('spStop') as HTMLButtonElement).disabled = !board.springMoving;
  show('widths', tool === 'pen' || tool === 'highlighter' || tool === 'shape' || tool === 'text' || tool === 'eraser');
  show('subbar', [...$('subbar').children].some((g) => !g.classList.contains('hidden')));
  const anOn: Record<string, boolean> = { int: !!ax?.an?.int, sum: !!ax?.an?.int?.n, lim: !!ax?.an?.lim, tan: !!ax?.an?.tan, asym: !!ax?.an?.asym };
  document.querySelectorAll<HTMLElement>('[data-an]').forEach((b) => b.classList.toggle('on', anOn[b.dataset.an!]));
  $('axesOpts').querySelector('[data-an=sum] span')!.textContent = ax?.an?.int?.n ? `Σ${ax.an.int.n}` : 'Σ';
  $('axesOpts').querySelector('[data-axis=x] span')!.textContent = ax?.lx ?? 'x';
  $('axesOpts').querySelector('[data-axis=y] span')!.textContent = ax?.ly ?? 'y';
  if (!ax && !fnMenu.classList.contains('hidden')) {
    fnMenu.classList.add('hidden');
    resetFnDraft();
  } else if (ax && !fnMenu.classList.contains('hidden')) renderFns();

  ($('undo') as HTMLButtonElement).disabled = !board.canUndo;
  ($('redo') as HTMLButtonElement).disabled = !board.canRedo;
  ($('prev') as HTMLButtonElement).disabled = board.cur === 0;
  ($('next') as HTMLButtonElement).disabled = board.cur >= board.doc.pages.length - 1;
  $('pageLabel').textContent = `${board.cur + 1} / ${board.doc.pages.length}`;
  document.querySelectorAll<HTMLElement>('[data-gadget]').forEach((b) => {
    const g = b.dataset.gadget!;
    b.classList.toggle('on', g === 'timer' ? timer.visible : board.gadgets.has(g as GadgetKind));
  });
  const viewOn: Record<string, boolean> = { curtain: curtain.visible, spot: spot.visible, replay: board.replaying };
  document.querySelectorAll<HTMLElement>('[data-view]').forEach((b) => b.classList.toggle('on', viewOn[b.dataset.view!]));
  document.querySelectorAll<HTMLElement>('.bgSw').forEach((b) => b.classList.toggle('on', b.dataset.act === `bg-${board.doc.bg}`));
  document.body.classList.toggle('dark', isDark(board.doc.bg));
  show('replayBar', board.replaying);
  $('replayBar').querySelector('[data-rp=pause]')!.textContent = board.replayPaused ? '▶' : '⏸';
  document.body.dataset.bg = board.doc.bg;
  layoutBar();
}
board.onUi = refreshUi;
curtain.onChange = refreshUi;
spot.onChange = refreshUi;

$('replayBar').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-rp]');
  if (!b) return;
  if (b.dataset.rp === 'pause') board.toggleReplayPause();
  else if (b.dataset.rp === 'step') board.replayStep();
  else board.stopReplay();
});

// ---------- θέση, μέγεθος και σύμπτυξη της γραμμής εργαλείων ----------

interface BarState {
  scale: number;
  folded: boolean;
  /** Θέση πάνω-αριστερά όταν ο χρήστης την έχει μετακινήσει· αλλιώς κάτω στο κέντρο. */
  pos: { x: number; y: number } | null;
  /** Κάθετη διάταξη, όταν έχει αφεθεί στην αριστερή ή δεξιά άκρη. */
  vertical: boolean;
}

function initToolbar(): void {
  const wrap = $('toolbarWrap');
  const bar = $('toolbar');
  const tab = $('barTab');
  const hint = $('dockHint');
  const KEY = 'grafida.toolbar';
  const st: BarState = { scale: 1, folded: false, pos: null, vertical: false };
  try {
    Object.assign(st, JSON.parse(localStorage.getItem(KEY) ?? '{}'));
  } catch {
    /* χωρίς αποθηκευμένες ρυθμίσεις */
  }

  // τα κείμενα των κουμπιών γίνονται tooltips· στη γραμμή φαίνονται μόνο τα εικονίδια
  bar.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    const label = [...b.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim();
    if (label) {
      b.title = label;
      b.setAttribute('aria-label', label);
    }
  });

  const apply = (): void => {
    bar.style.setProperty('--ts', String(st.scale));
    bar.classList.toggle('folded', st.folded);
    $('barFold').querySelector('span')!.textContent = st.folded ? '▸' : '▾';
    wrap.classList.toggle('moved', !!st.pos);
    bar.classList.toggle('vertical', !!st.pos && st.vertical);
    if (st.pos) {
      // κρατάμε τη γραμμή (και τη λαβή πάνω της) μέσα στην οθόνη
      const r = bar.getBoundingClientRect();
      const th = tab.getBoundingClientRect().height;
      st.pos.x = Math.max(0, Math.min(st.pos.x, window.innerWidth - r.width));
      // πάνω αριστερά βρίσκεται το κουμπί του μενού: δεν το σκεπάζουμε
      const minY = (st.pos.x < 80 && r.height < window.innerHeight - 120 ? 78 : 0) + th;
      st.pos.y = Math.max(minY, Math.min(st.pos.y, window.innerHeight - r.height));
      wrap.style.left = st.pos.x + 'px';
      wrap.style.top = st.pos.y + 'px';
    } else {
      wrap.style.left = '';
      wrap.style.top = '';
    }
    // η δεύτερη σειρά ανοίγει προς την πλευρά που έχει χώρο
    const r = bar.getBoundingClientRect();
    bar.classList.toggle('sub-below', r.top < 70 * st.scale + 30);
    bar.classList.toggle('sub-right', r.left + r.width / 2 < window.innerWidth / 2);
    // ...και στέκεται πάνω από (ή δίπλα σε) το εργαλείο που αφορά
    const sub = $('subbar');
    const anchor = bar.querySelector<HTMLElement>('#tools button.on, #gadgetBtn.on');
    sub.style.left = sub.style.right = sub.style.top = '';
    bar.classList.remove('sub-lift');
    if (anchor && !sub.classList.contains('hidden') && !st.folded) {
      const k = r.width / bar.offsetWidth || 1;
      const a = anchor.getBoundingClientRect();
      const s = sub.getBoundingClientRect();
      if (bar.classList.contains('vertical')) {
        const first = sub.querySelector<HTMLElement>('.group:not(.hidden) button');
        const pad = first ? first.getBoundingClientRect().top - s.top : 0;
        const top = Math.max(8, Math.min(a.top - pad, window.innerHeight - s.height - 8));
        sub.style.setProperty('--caret', (a.top + a.height / 2 - top) / k + 'px');
        sub.style.top = (top - r.top) / k + 'px';
      } else {
        // το πρώτο εικονίδιο της σειράς κάθεται ακριβώς πάνω από το εργαλείο
        const first = sub.querySelector<HTMLElement>('.group:not(.hidden) button');
        const pad = first ? first.getBoundingClientRect().left - s.left : 0;
        const left = Math.max(8, Math.min(a.left - pad, window.innerWidth - s.width - 8));
        sub.style.setProperty('--caret', (a.left + a.width / 2 - left) / k + 'px');
        sub.style.left = (left - r.left) / k + 'px';
        sub.style.right = 'auto';
        // αν πέφτει πάνω στη λαβή της γραμμής, ανεβαίνει πάνω από αυτήν
        const t = tab.getBoundingClientRect();
        bar.classList.toggle('sub-lift', !bar.classList.contains('sub-below') && left + s.width > t.left - 4 && left < t.right + 4);
      }
    }
    board.bottomInset = st.pos ? 0 : r.height + 24 + 56 * st.scale;
  };
  const save = (): void => {
    try {
      localStorage.setItem(KEY, JSON.stringify(st));
    } catch {
      /* δεν πειράζει */
    }
  };

  $('barSmaller').onclick = () => { st.scale = Math.max(0.6, +(st.scale - 0.15).toFixed(2)); apply(); save(); };
  $('barBigger').onclick = () => { st.scale = Math.min(2, +(st.scale + 0.15).toFixed(2)); apply(); save(); };
  $('barFold').onclick = () => { st.folded = !st.folded; apply(); save(); };

  const grip = $('barDrag');
  const EDGE = 70;
  let off: { x: number; y: number } | null = null;
  let dragged = false;
  /** Σε ποια άκρη θα «κουμπώσει» κατακόρυφα αν αφεθεί τώρα. */
  let dock: 'left' | 'right' | null = null;
  grip.addEventListener('pointerdown', (e) => {
    const r = bar.getBoundingClientRect();
    off = { x: e.clientX - r.left, y: e.clientY - r.top };
    dragged = false;
    dock = null;
    grip.setPointerCapture(e.pointerId);
  });
  grip.addEventListener('pointermove', (e) => {
    if (!off) return;
    dragged = true;
    st.pos = { x: e.clientX - off.x, y: e.clientY - off.y };
    // κουμπώνει όταν το δάχτυλο φτάσει κοντά στην άκρη ή όταν η γραμμή σπρωχτεί πάνω της
    const w = bar.getBoundingClientRect().width;
    if (e.clientX < EDGE || st.pos.x < 6) dock = 'left';
    else if (e.clientX > window.innerWidth - EDGE || st.pos.x + w > window.innerWidth - 6) dock = 'right';
    else dock = null;
    hint.classList.toggle('hidden', !dock);
    hint.classList.toggle('right', dock === 'right');
    apply();
  });
  const end = (): void => {
    if (!off) return;
    off = null;
    hint.classList.add('hidden');
    if (!dragged) return;
    // κοντά στο κάτω-κεντρικό σημείο επιστρέφει στην αρχική της θέση
    const r = bar.getBoundingClientRect();
    const centered = Math.abs(r.left + r.width / 2 - window.innerWidth / 2) < 60;
    st.vertical = !!dock;
    if (!dock && centered && r.bottom > window.innerHeight - 40) st.pos = null;
    if (dock && st.pos) st.pos.x = dock === 'left' ? 0 : window.innerWidth;
    apply();
    // η κατακόρυφη γραμμή έχει άλλο ύψος: ξαναελέγχουμε ότι χωρά
    apply();
    save();
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  grip.addEventListener('lostpointercapture', end);
  grip.addEventListener('dblclick', () => { st.pos = null; st.vertical = false; apply(); save(); });
  window.addEventListener('resize', apply);
  new MutationObserver(apply).observe($('subbar'), { attributes: true, attributeFilter: ['class'] });

  // όσο γράφεις, η γραμμή ξεθωριάζει και δεν εμποδίζει τη γραφίδα
  const inking = new Set<number>();
  const live = $('live');
  live.addEventListener('pointerdown', (e) => { inking.add(e.pointerId); document.body.classList.add('inking'); });
  const lift = (e: PointerEvent): void => {
    inking.delete(e.pointerId);
    if (inking.size === 0) document.body.classList.remove('inking');
  };
  live.addEventListener('pointerup', lift);
  live.addEventListener('pointercancel', lift);

  layoutBar = apply;
  apply();
}

// ---------- αναδυόμενα μενού ----------

const menu = $('menu');
const impMenu = $('importMenu');
const gadgetMenu = $('gadgetMenu');
const colorMenu = $('colorMenu');
const labelMenu = $('labelMenu');
const fnMenu = $('fnMenu');
const stampMenu = $('stampMenu');
const tplMenu = $('tplMenu');
function closePopups(): void {
  document.querySelectorAll('.popup').forEach((p) => p.classList.add('hidden'));
  measShape = null;
  resetFnDraft();
  fnMoved = false;
}
/** Τοποθετεί ένα αναδυόμενο μενού δίπλα στο κουμπί του, μέσα στα όρια της οθόνης. */
function placeNear(popup: HTMLElement, anchor: HTMLElement): void {
  const a = anchor.getBoundingClientRect();
  const w = popup.offsetWidth;
  const h = popup.offsetHeight;
  const bar = $('toolbar');
  if (bar.classList.contains('vertical') && bar.contains(anchor)) {
    // κατακόρυφη γραμμή: το μενού ανοίγει δίπλα στο κουμπί, προς το κέντρο της οθόνης
    const b = (anchor.closest<HTMLElement>('#subbar') ?? bar).getBoundingClientRect();
    const left = b.left + b.width / 2 > window.innerWidth / 2 ? b.left - w - 10 : b.right + 10;
    popup.style.left = Math.max(8, Math.min(left, window.innerWidth - w - 8)) + 'px';
    popup.style.top = Math.max(8, Math.min(a.top + a.height / 2 - h / 2, window.innerHeight - h - 8)) + 'px';
    return;
  }
  const left = Math.max(8, Math.min(a.left + a.width / 2 - w / 2, window.innerWidth - w - 8));
  let top = a.top - h - 10;
  if (top < 8) top = Math.min(a.bottom + 10, window.innerHeight - h - 8);
  popup.style.left = left + 'px';
  popup.style.top = Math.max(8, top) + 'px';
}
function togglePopup(popup: HTMLElement, anchor: HTMLElement): void {
  const open = popup.classList.contains('hidden');
  closePopups();
  if (!open) return;
  popup.classList.remove('hidden');
  placeNear(popup, anchor);
}
$('gadgetBtn').onclick = () => togglePopup(gadgetMenu, $('gadgetBtn'));
$('importBtn').onclick = () => togglePopup(impMenu, $('importBtn'));
$('menuBtn').onclick = () => {
  const open = menu.classList.contains('hidden');
  closePopups();
  menu.classList.toggle('hidden', !open);
};
document.addEventListener('pointerdown', (e) => {
  if (!(e.target as HTMLElement).closest('.popup, #menuBtn, #importBtn, #gadgetBtn, #colorBtn, #axesOpts')) closePopups();
});

gadgetMenu.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const anq = t.closest<HTMLElement>('[data-anq]')?.dataset.anq;
  if (anq) {
    // τα εργαλεία ανάλυσης δουλεύουν πάνω σε άξονες με συνάρτηση: διαλέγουμε (ή φτιάχνουμε) άξονες και, αν λείπει, ζητάμε συνάρτηση
    closePopups();
    board.setTool('select');
    if (!board.selectedAxes && !board.selectAxes()) board.addAxes('full');
    refreshUi();
    const ax = board.selectedAxes;
    if (ax && (ax.fns ?? []).some((f) => !f.hidden)) {
      const on: Record<string, boolean> = { int: !!ax.an?.int, sum: false, lim: !!ax.an?.lim, tan: !!ax.an?.tan, asym: !!ax.an?.asym };
      if (!on[anq]) toggleAnalysis(anq);
    } else {
      togglePopup(fnMenu, $('fnBtn'));
      renderFns();
      toast('Γράψε πρώτα τη συνάρτηση. Μετά, τα ∫, Σ, lim, f′ είναι στη σειρά πάνω από τη μπάρα.', 6000);
    }
    return;
  }
  const shape = t.closest<HTMLElement>('[data-shape]')?.dataset.shape;
  const ax = t.closest<HTMLElement>('[data-axes]')?.dataset.axes;
  const ins = t.closest<HTMLElement>('[data-ins]')?.dataset.ins;
  if (shape || ax || ins) {
    closePopups();
    if (shape) {
      board.shapeKind = shape as ShapeKind | 'angle';
      board.setTool('shape');
    } else if (ax) board.addAxes(ax as AxesMode);
    else if (ins === 'trig') board.addTrig();
    else {
      stampMenu.classList.remove('hidden');
      placeNear(stampMenu, $('gadgetBtn'));
    }
    refreshUi();
    return;
  }
  const view = t.closest<HTMLElement>('[data-view]')?.dataset.view;
  if (view) {
    closePopups();
    if (view === 'curtain') curtain.toggle();
    else if (view === 'spot') spot.toggle();
    else if (board.replaying) board.stopReplay();
    else if (board.page.items.length === 0) toast('Η σελίδα είναι κενή');
    else board.startReplay();
    refreshUi();
    return;
  }
  const b = t.closest<HTMLElement>('[data-gadget]');
  if (!b) return;
  const g = b.dataset.gadget!;
  if (g === 'timer') timer.toggle();
  else board.toggleGadget(g as GadgetKind);
  refreshUi();
});

impMenu.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const ins = t.closest<HTMLElement>('[data-ins]')?.dataset.ins;
  const b = t.closest<HTMLElement>('[data-imp]');
  if (!ins && !b) return;
  closePopups();
  if (ins === 'tpl') {
    renderTemplates();
    tplMenu.classList.remove('hidden');
    placeNear(tplMenu, $('importBtn'));
  } else if (b!.dataset.imp === 'file') ($('fileImport') as HTMLInputElement).click();
  else if (b!.dataset.imp === 'shot') void doScreenshot();
  else void doPaste();
});
($('fileImport') as HTMLInputElement).onchange = (e) => {
  const input = e.target as HTMLInputElement;
  void importFiles([...(input.files ?? [])]);
  input.value = '';
};
($('fileOpen') as HTMLInputElement).onchange = (e) => {
  const input = e.target as HTMLInputElement;
  void importFiles([...(input.files ?? [])]);
  input.value = '';
};

// ---------- σχήματα φυσικής ----------

for (const [name, d] of Object.entries(STAMPS)) {
  const b = document.createElement('button');
  b.dataset.stamp = name;
  b.title = d.label;
  const cv = document.createElement('canvas');
  cv.width = 144;
  cv.height = 112;
  const c = cv.getContext('2d')!;
  const k = Math.min(128 / d.w, 96 / d.h);
  c.translate((144 - d.w * k) / 2, (112 - d.h * k) / 2);
  c.scale(k, k);
  c.strokeStyle = c.fillStyle = '#f9fafb';
  c.lineWidth = 2.2 / k;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  d.draw(c, d.w, d.h);
  b.append(cv, document.createTextNode(d.label));
  $('stampGrid').append(b);
}
stampMenu.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-stamp]');
  if (!b) return;
  closePopups();
  board.addStamp(b.dataset.stamp!);
});

// ---------- πρότυπα σελίδων ----------

interface Template { name: string; items: Item[] }
const text = (x: number, y: number, t: string, size = 34): Item => ({ kind: 'text', id: '', x, y, text: t, size, color: '#111111' });
const rule = (x0: number, y0: number, x1: number, y1: number): Item =>
  ({ kind: 'shape', id: '', shape: 'line', x0, y0, x1, y1, color: '#111111', width: 2 });
const BUILTIN: Template[] = [
  {
    name: 'Δεδομένα – Ζητούμενα – Λύση',
    items: [text(60, 90, 'Δεδομένα'), rule(60, 140, 420, 140), text(60, 380, 'Ζητούμενα'), rule(60, 430, 420, 430),
      rule(470, 80, 470, 660), text(520, 90, 'Λύση'), rule(520, 140, 1180, 140)],
  },
  {
    name: 'Δύο στήλες',
    items: [rule(640, 80, 640, 660)],
  },
];
let templates: Template[] = [];
void kvGet<Template[]>('templates').then((t) => { templates = t ?? []; });
function renderTemplates(): void {
  $('tplList').innerHTML =
    BUILTIN.map((t, i) => `<div class="tplItem"><button data-tpl="b${i}">📄 ${esc(t.name)}</button></div>`).join('') +
    templates.map((t, i) => `<div class="tplItem"><button data-tpl="u${i}">📄 ${esc(t.name)}</button><button data-tpldel="${i}" title="Διαγραφή προτύπου">✕</button></div>`).join('');
}
tplMenu.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const del = t.closest<HTMLElement>('[data-tpldel]');
  if (del) {
    templates.splice(Number(del.dataset.tpldel), 1);
    void kvSet('templates', templates);
    renderTemplates();
    return;
  }
  if (t.closest('#tplSave')) {
    if (board.page.items.length === 0) {
      toast('Η σελίδα είναι κενή');
      return;
    }
    const name = prompt('Όνομα προτύπου:', `Πρότυπο ${templates.length + 1}`)?.trim();
    if (!name) return;
    templates.push({ name, items: JSON.parse(JSON.stringify(board.page.items)) as Item[] });
    void kvSet('templates', templates);
    renderTemplates();
    toast('Το πρότυπο αποθηκεύτηκε');
    return;
  }
  const b = t.closest<HTMLElement>('[data-tpl]');
  if (!b) return;
  closePopups();
  const id = b.dataset.tpl!;
  const tpl = (id[0] === 'b' ? BUILTIN : templates)[Number(id.slice(1))];
  if (tpl) board.addPageWith(tpl.items);
});

// ---------- κύριο μενού ----------

if (isNative && !isOverlay) $('overlayAct').classList.remove('hidden');
menu.addEventListener('click', async (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!b) return;
  const act = b.dataset.act!;
  if (!act.startsWith('bg-')) closePopups();
  if (act === 'pdflogo') {
    setPdfLogo(!pdfLogo);
  } else if (act === 'labels') {
    setLabels(!$('toolbar').classList.contains('labels'));
  } else if (act === 'lib') {
    void lessons?.open();
  } else if (act === 'test') {
    window.open('./dokimi.html', '_blank');
  } else if (act === 'open') {
    ($('fileOpen') as HTMLInputElement).click();
  } else if (act === 'save') {
    download(new Blob([JSON.stringify(board.doc)], { type: 'application/json' }), `${fileName(lessons?.current?.name ?? 'pinakas')}_${stamp()}.json`);
  } else if (act === 'png') {
    download(await board.exportPng(), `selida_${board.cur + 1}_${stamp()}.png`);
  } else if (act === 'send') {
    openSend();
  } else if (act === 'pdf') {
    try {
      download(await lessonPdf(), `${fileName(lessons?.current?.name ?? 'mathima')}_${stamp()}.pdf`);
    } catch (err) {
      console.error(err);
      toast('Η εξαγωγή σε PDF απέτυχε', 5000);
    }
  } else if (act.startsWith('bg-')) {
    // το τρέχον χρώμα περνά στο αντίστοιχο της παλέτας του νέου φόντου
    const i = palette().indexOf(board.color);
    board.setBackground(act.slice(3) as Background);
    if (i >= 0) board.color = palette()[i];
    refreshUi();
  } else if (act === 'fit') {
    board.fitView();
  } else if (act === 'clear') {
    board.clearPage();
  } else if (act === 'delpage') {
    if (confirm('Να διαγραφεί η σελίδα;')) board.deletePage();
  } else if (act === 'full') {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen().catch(() => {});
  } else if (act === 'overlay') {
    openOverlay().catch((err) => toast(`Δεν άνοιξε: ${err}`, 6000));
  } else if (act === 'ai') {
    openAi();
  } else if (act === 'diag') {
    $('diag').classList.toggle('hidden');
  }
});

// ---------- διάγνωση ----------

const diag = $('diag');
diag.innerHTML = `
  <b>Διάγνωση εισόδου</b>
  <pre id="diagText">Άγγιξε ή γράψε στον πίνακα…</pre>
  <label>Όριο παλάμης (px): <span id="palmV"></span>
    <input id="palm" type="range" min="10" max="120" step="1" /></label>
  <small>Αν η γραφίδα του BenQ εμφανίζεται ως «touch», το μέγεθος επαφής ξεχωρίζει στυλό από παλάμη.
  Επαφές μεγαλύτερες από το όριο λειτουργούν ως γόμα.</small>`;
const palm = diag.querySelector<HTMLInputElement>('#palm')!;
palm.value = String(board.palmThreshold);
const palmV = diag.querySelector<HTMLElement>('#palmV')!;
palmV.textContent = palm.value;
palm.oninput = () => {
  board.palmThreshold = Number(palm.value);
  palmV.textContent = palm.value;
};
const diagText = diag.querySelector<HTMLElement>('#diagText')!;
let maxContact = 0;
board.onPointerInfo = (e, n) => {
  if (diag.classList.contains('hidden')) return;
  const size = Math.max(e.width, e.height);
  if (e.type === 'pointerdown') maxContact = size;
  else maxContact = Math.max(maxContact, size);
  diagText.textContent =
    `τύπος:        ${e.pointerType}\n` +
    `επαφή:        ${e.width.toFixed(1)} × ${e.height.toFixed(1)} px\n` +
    `μέγιστη επαφή:${maxContact.toFixed(1)} px\n` +
    `πίεση:        ${e.pressure.toFixed(2)}\n` +
    `κουμπιά:      ${e.buttons}\n` +
    `ταυτόχρονοι δείκτες: ${n}\n` +
    `pointerId:    ${e.pointerId}`;
};

// ---------- κείμενο ----------

const TEXT_SIZES = [20, 28, 44, 72];
const textEd = $('textEd');
const textArea = textEd.querySelector('textarea')!;
let textCtx: { x: number; y: number; existing?: TextItem } | null = null;

function openText(x: number, y: number, existing?: TextItem): void {
  if (textCtx) closeText(true);
  textCtx = { x, y, existing };
  const size = existing?.size ?? TEXT_SIZES[Math.max(0, SIZES.pen.indexOf(board.sizes.pen))];
  const [sx, sy] = board.toScreen(x, y);
  const fs = Math.max(14, size * board.zoom);
  textEd.style.left = Math.max(8, Math.min(sx, window.innerWidth - 340)) + 'px';
  textEd.style.top = Math.max(8, Math.min(sy, window.innerHeight - 220)) + 'px';
  textArea.style.fontSize = fs + 'px';
  textArea.style.color = board.ink(existing?.color ?? board.color);
  textArea.style.background = isDark(board.doc.bg) ? '#14201b' : '#fff';
  textArea.value = existing?.text ?? '';
  textEd.classList.remove('hidden');
  textArea.focus();
}

function closeText(save: boolean): void {
  if (!textCtx) return;
  const c = textCtx;
  textCtx = null;
  textEd.classList.add('hidden');
  if (save) {
    const size = c.existing?.size ?? TEXT_SIZES[Math.max(0, SIZES.pen.indexOf(board.sizes.pen))];
    board.commitText(c.x, c.y, textArea.value, size, c.existing);
  }
}
board.onTextRequest = openText;
$('textOk').onclick = () => closeText(true);
$('textCancel').onclick = () => closeText(false);
textArea.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Escape') closeText(false);
  else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) closeText(true);
});
document.addEventListener(
  'pointerdown',
  (e) => {
    if (textCtx && !(e.target as HTMLElement).closest('#textEd')) closeText(true);
  },
  true
);

// ---------- πληκτρολόγιο ----------

window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('textarea, input')) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) board.redo();
    else board.undo();
  } else if (ctrl && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    board.redo();
  } else if (ctrl && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    board.duplicateSelected();
  } else if (e.key === 'Escape') {
    board.stopReplay();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    board.deleteSelected();
  } else if (!ctrl) {
    const map: Record<string, Tool> = { v: 'select', p: 'pen', h: 'highlighter', l: 'laser', e: 'eraser', m: 'hand', s: 'shape', t: 'text', d: 'measure' };
    const t = map[e.key.toLowerCase()];
    if (t) board.setTool(t);
    else if (e.key === 'PageDown') board.goto(board.cur + 1);
    else if (e.key === 'PageUp') board.goto(board.cur - 1);
  }
});

// ---------- αυτόματη αποθήκευση ----------

// ---------- αποστολή στους μαθητές ----------

/** Αν οι σελίδες του PDF παίρνουν το λογότυπο σε μια γωνία (ρύθμιση ανά συσκευή). */
let pdfLogo = true;
function setPdfLogo(on: boolean): void {
  pdfLogo = on;
  document.querySelector('[data-act=pdflogo]')!.classList.toggle('on', on);
  try {
    localStorage.setItem('grafida.pdfLogo', on ? '1' : '0');
  } catch {
    /* χωρίς αποθήκευση */
  }
}
setPdfLogo((() => { try { return localStorage.getItem('grafida.pdfLogo') !== '0'; } catch { return true; } })());
let logoImg: Promise<HTMLImageElement | null> | null = null;
function loadLogo(): Promise<HTMLImageElement | null> {
  logoImg ??= new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = './logo.svg';
  });
  return logoImg;
}

async function lessonPdf(): Promise<Blob> {
  const mark = pdfLogo ? await loadLogo() : null;
  const pages = await board.exportJpegPages((d, n) => toast(`Ετοιμάζεται το PDF… σελίδα ${d + 1} από ${n}`, 0), mark ?? undefined);
  toast(`Το PDF είναι έτοιμο (${pages.length} σελίδες)`);
  return buildPdf(pages);
}

function drawQr(cv: HTMLCanvasElement, text: string): void {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const c = cv.getContext('2d')!;
  const cell = Math.floor(cv.width / (n + 8));
  const off = Math.floor((cv.width - cell * n) / 2);
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = '#000000';
  for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) if (qr.isDark(r, q)) c.fillRect(off + q * cell, off + r * cell, cell, cell);
}

const sendMenu = $('sendMenu');
let sendUrl = '';
function renderSend(editId = false): void {
  const has = !!driveClientId();
  $('sendSetup').classList.toggle('hidden', has && !editId);
  $('sendDrive').classList.toggle('hidden', !has);
  // με ενσωματωμένο Client ID η ρύθμιση δεν φαίνεται καθόλου
  $('sendIdEdit').classList.toggle('hidden', !has || editId || driveBuiltIn);
  ($('sendId') as HTMLInputElement).value = driveClientId();
}
function openSend(): void {
  closePopups();
  $('sendOut').classList.add('hidden');
  renderSend();
  sendMenu.classList.remove('hidden');
  sendMenu.style.left = Math.max(8, (window.innerWidth - sendMenu.offsetWidth) / 2) + 'px';
  sendMenu.style.top = Math.max(8, (window.innerHeight - sendMenu.offsetHeight) / 3) + 'px';
}
$('sendClose').onclick = () => closePopups();
$('sendIdEdit').onclick = () => renderSend(true);
$('sendIdSave').onclick = () => {
  setDriveClientId(($('sendId') as HTMLInputElement).value.trim());
  renderSend();
};
$('sendDrive').onclick = async () => {
  const name = `${fileName(lessons?.current?.name ?? 'mathima')}_${stamp()}.pdf`;
  try {
    // η σύνδεση πρώτα, όσο «μετράει» ακόμα το πάτημα: αλλιώς ο browser μπλοκάρει το παράθυρο της Google
    await driveConnect();
    const pdf = await lessonPdf();
    toast('Ανεβαίνει στο Google Drive…', 0);
    const up = await uploadToDrive(pdf, name);
    sendUrl = up.url;
    drawQr($('sendQr') as HTMLCanvasElement, up.url);
    $('sendUrl').textContent = up.url;
    $('sendNote').textContent = up.shared
      ? 'Το αρχείο είναι στον φάκελο «PrismaBoard» του Drive. Όποιος έχει τον σύνδεσμο ή το QR μπορεί να το δει.'
      : 'Το αρχείο ανέβηκε στον φάκελο «PrismaBoard», αλλά ο λογαριασμός δεν επιτρέπει κοινή χρήση με σύνδεσμο. Άνοιξέ το στο Drive και μοίρασέ το από εκεί.';
    $('sendOut').classList.remove('hidden');
    toast('Ανέβηκε');
  } catch (err) {
    console.error(err);
    toast(`Δεν ανέβηκε: ${err instanceof Error ? err.message : err}`, 8000);
  }
};
$('sendShare').onclick = async () => {
  try {
    const name = `${fileName(lessons?.current?.name ?? 'mathima')}_${stamp()}.pdf`;
    const file = new File([await lessonPdf()], name, { type: 'application/pdf' });
    // σε Android το φύλλο κοινοποίησης έχει και το Drive· αλλού απλώς κατεβαίνει
    if (!isNative && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: name });
    else download(file, name);
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') toast('Η κοινοποίηση απέτυχε', 5000);
  }
};
$('sendCopy').onclick = () => {
  navigator.clipboard?.writeText(sendUrl).then(() => toast('Ο σύνδεσμος αντιγράφηκε'), () => toast('Δεν έγινε αντιγραφή', 4000));
};
$('sendBig').onclick = () => {
  const big = $('qrBig');
  drawQr(big.querySelector('canvas')!, sendUrl);
  big.querySelector('div')!.textContent = 'Σκανάρετε για τις σημειώσεις του μαθήματος · πάτημα για κλείσιμο';
  big.classList.remove('hidden');
  closePopups();
};
$('qrBig').onclick = () => $('qrBig').classList.add('hidden');

// ---------- zoom και ονόματα εικονιδίων ----------

$('zoomOut').onclick = () => board.zoomBy(1 / 1.25);
$('zoomIn').onclick = () => board.zoomBy(1.25);
$('zoomFit').onclick = () => board.fitView();
board.onView = () => {
  const t = `${Math.round(board.zoom * 100)}%`;
  if ($('zoomFit').textContent !== t) $('zoomFit').textContent = t;
};
/** Μικρά ονόματα κάτω από τα εικονίδια της μπάρας· ανοιχτά μέχρι να τα κλείσει ο χρήστης. */
function setLabels(on: boolean): void {
  $('toolbar').classList.toggle('labels', on);
  document.querySelector('[data-act=labels]')!.classList.toggle('on', on);
  try {
    localStorage.setItem('grafida.labels', on ? '1' : '0');
  } catch {
    /* χωρίς αποθήκευση */
  }
  layoutBar();
}
setLabels((() => { try { return localStorage.getItem('grafida.labels') !== '0'; } catch { return true; } })());

// το διαφανές παράθυρο δεν έχει μαθήματα και δεν πειράζει ό,τι είναι αποθηκευμένο
const lessons = isOverlay
  ? null
  : new Lessons({ getDoc: () => board.doc, setDoc: (d) => board.loadDoc(d), thumb: () => board.thumb(), download, toast }, app);
board.onChange = () => lessons?.touch();

void (async () => {
  await lessons?.init().catch((err) => console.error(err));
  refreshUi();
  initToolbar();
})();

if (import.meta.env.PROD && !isNative && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
