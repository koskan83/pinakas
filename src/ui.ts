/** Η σελίδα της εφαρμογής: εικονίδια και το HTML της γραμμής εργαλείων, των μενού και των παραθύρων. */

import { PICS } from './kids/stickers';

export type PenKind = 'pen' | 'laser';
export const LASER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5" fill="#ef4444" stroke="none"/></svg>';
export const PENCIL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/></svg>';
export const PEN_ICON: Record<PenKind, string> = { pen: PENCIL_ICON, laser: LASER_ICON };
/** Γραμμικό εικονίδιο 24×24 στο ύφος της μπάρας. */
const IC = (d: string): string => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const P = (d: string): string => IC(`<path d="${d}"/>`);
/** Γραμμή μενού: εικονίδιο και κείμενο. */
const mi = (attr: string, icon: string, label: string): string => `<button ${attr}><i>${icon}</i>${label}</button>`;
/** Πλακίδιο του μενού «Όργανα»: εικονίδιο με μικρή λεζάντα από κάτω. */
const tile = (attr: string, icon: string, label: string, title = label): string =>
  `<button ${attr} class="tile" title="${title}"><span>${icon}</span><small>${label}</small></button>`;
/** Έγχρωμα εικονίδια για εργαλεία του Δημοτικού, στο ύφος των emoji δίπλα τους. */
const K = {
  numline: IC('<path d="M2 15h20M4 12v6M9 12v6M14 12v6M19 12v6"/><circle cx="14" cy="6.500" r="3" fill="#f97316" stroke="none"/>'),
  hundred: IC('<rect x="3" y="3" width="6" height="6" fill="#facc15" stroke="none"/><rect x="9" y="9" width="6" height="6" fill="#facc15" stroke="none"/><rect x="15" y="15" width="6" height="6" fill="#facc15" stroke="none"/><rect x="3" y="3" width="18" height="18" rx="1.500"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>'),
  times: IC('<rect x="3" y="3" width="18" height="18" rx="3" fill="#a855f7" stroke="none"/><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.600"/>'),
  colops: IC('<rect x="3" y="3" width="5" height="5" rx="1" fill="#22c55e" stroke="none"/><rect x="9.500" y="3" width="5" height="5" rx="1" fill="#ef4444" stroke="none"/><rect x="16" y="3" width="5" height="5" rx="1" fill="#3b82f6" stroke="none"/><path d="M3 12h18M3 20h18" opacity=".45"/><path d="M3 16h18" stroke-width="2.600"/>'),
  fracpie: IC('<path d="M12 12V3a9 9 0 0 1 7.800 13.500z" fill="#f97316" stroke="none"/><circle cx="12" cy="12" r="9"/><path d="M12 3v9l7.800 4.500M12 12l-7.800 4.500"/>'),
  fracbar: IC('<rect x="2" y="8" width="10" height="8" fill="#3b82f6" stroke="none"/><rect x="2" y="8" width="20" height="8" rx="1"/><path d="M7 8v8M12 8v8M17 8v8"/>'),
};
const I = {
  lib: P('M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z'),
  folder: P('M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'),
  save: P('M12 4v11M7 11l5 5 5-5M4 20h16'),
  cloudUp: P('M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4.5 4.5 0 0 1-1 8.9M12 12v8M9 15l3-3 3 3'),
  cloudDown: P('M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4.5 4.5 0 0 1-1 8.9M12 12v8M9 17l3 3 3-3'),
  doc: P('M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6'),
  image: IC('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-8 8"/>'),
  fit: P('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'),
  clear: P('M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11l4 5M14 11l-4 5'),
  delpage: IC('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 12h6"/>'),
  screen: IC('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  spark: P('M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z'),
  full: P('M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5'),
  exit: P('M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M15 8l4 4-4 4M19 12H9'),
  fullExit: P('M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5'),
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
  rhombus: P('M12 3l8 9-8 9-8-9z'),
  para: P('M8 6h13l-5 12H3z'),
  table: IC('<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 12h18M9 5v14M15 5v14"/>'),
  angle: P('M20 20H4L15 5M11 20a7 7 0 0 0-2.800-5.600'),
  axFull: P('M3 12h18M12 21V3M18.5 9.5L21 12l-2.5 2.5M9.5 5.5L12 3l2.5 2.5'),
  axQ1: P('M5 19h16M5 19V3M18.5 16.5L21 19l-2.5 2.5M2.5 5.500L5 3l2.5 2.5'),
  axQ14: P('M5 12h16M5 21V3M18.5 9.5L21 12l-2.5 2.5M2.5 5.500L5 3l2.5 2.5'),
  asym: IC('<path d="M8 3v18M3 17h18" stroke-dasharray="2.5 3"/><path d="M11 4c.5 7 3 10.500 10 11"/>'),
  trig: IC('<circle cx="12" cy="12" r="8.5"/><path d="M12 12l6-6M3.5 12h17"/>'),
  ruler: IC('<rect x="2" y="8" width="20" height="8" rx="1"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/>'),
  protractor: P('M3 17a9 9 0 0 1 18 0zM12 17v-3M7.5 12.500l1.500 1.500M16.5 12.5l-1.5 1.5'),
  compass: IC('<circle cx="12" cy="4.500" r="1.500"/><path d="M12 6L6 21M12 6l6 15M8.500 14h7"/>'),
  poll: IC('<path d="M4 20h16"/><rect x="5" y="11" width="3.500" height="7" rx="1"/><rect x="10.250" y="5" width="3.500" height="13" rx="1"/><rect x="15.500" y="14" width="3.500" height="4" rx="1"/>'),
  lottery: IC('<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.300 2.700-6 6-6s6 2.700 6 6"/><path d="M17 4.500l1 2 2.200.300-1.600 1.500.400 2.200-2-1.100-2 1.100.400-2.200"/>'),
  physics: IC('<path d="M2 12h2l1.500-4 2.500 8 2.500-8 2.500 8 1.500-4h1.500"/><rect x="16" y="8" width="6" height="8" rx="1"/>'),
  timer: IC('<circle cx="12" cy="13.500" r="7.500"/><path d="M12 13.500V9.500M9.500 3h5M12 3v3"/>'),
  curtain: IC('<rect x="3" y="4" width="18" height="16" rx="1.500"/><path d="M3 12h18M7 12v8M12 12v8M17 12v8"/>'),
  curtainTop: IC('<rect x="3" y="4" width="18" height="16" rx="1.500"/><path d="M3 12h18M7 12V4M12 12V4M17 12V4"/>'),
  spot: IC('<circle cx="12" cy="12" r="5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  play: P('M8 5l11 7-11 7z'),
  send: P('M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2'),
  plus: P('M12 5v14M5 12h14'),
  minus: P('M5 12h14'),
};

/** Στήνει όλα τα στοιχεία της εφαρμογής μέσα στο `app`. */
export function mountUi(app: HTMLElement): void {
  app.insertAdjacentHTML(
  'beforeend',
  `
  <button id="menuBtn" class="fab" title="Μενού">☰</button>
  <button id="overlayClose" class="fab hidden" title="Κλείσιμο και επιστροφή στον πίνακα">✕</button>
  <div id="menu" class="popup hidden">
    <div class="gHead">Μάθημα</div>
    ${mi('data-act="lib"', I.lib, 'Μαθήματα…')}
    ${mi('data-act="savewhere"', I.save, 'Αποθήκευση…')}
    ${mi('data-act="openwhere"', I.folder, 'Άνοιγμα…')}
    ${mi('data-act="end" class="end"', I.send, 'Τέλος μαθήματος: QR για τους μαθητές')}
    <div class="gHead">Σελίδα</div>
    <div class="bgRow">
      <span>Φόντο</span>
      <button data-act="bg-white" class="bgSw" title="Λευκό"></button>
      <button data-act="bg-grid" class="bgSw grid" title="Λευκό με πλέγμα"></button>
      <button data-act="bg-lines" class="bgSw lines" title="Λευκό με γραμμές τετραδίου"></button>
      <button data-act="bg-dark" class="bgSw dark" title="Σκούρο"></button>
      <button data-act="bg-dark-grid" class="bgSw dark grid" title="Σκούρο με πλέγμα"></button>
      <button data-act="bg-dark-lines" class="bgSw dark lines" title="Σκούρο με γραμμές τετραδίου"></button>
      <button data-act="bg-write" class="bgSw write" data-lv="pri" title="Τετράδιο γραφής: γραμμές με βοηθητική για τα μικρά γράμματα"></button>
      <button data-act="bg-squares" class="bgSw squares" data-lv="pri" title="Τετράδιο αριθμητικής: μεγάλα τετράγωνα"></button>
    </div>
    <div class="bgRow">
      <span>Περίγραμμα Α4</span>
      <button data-act="a4-off" class="a4Sw off" title="Χωρίς περίγραμμα">✕</button>
      <button data-act="a4-v" class="a4Sw v" title="Αχνό περίγραμμα Α4 όρθιας: για στοίχιση, και το PDF βγαίνει ακριβώς Α4"><i></i></button>
      <button data-act="a4-h" class="a4Sw h" title="Αχνό περίγραμμα Α4 πλάγιας: για στοίχιση, και το PDF βγαίνει ακριβώς Α4"><i></i></button>
    </div>
    ${mi('data-act="fit"', I.fit, 'Προσαρμογή προβολής')}
    ${mi('data-act="clear"', I.clear, 'Καθαρισμός σελίδας')}
    ${mi('data-act="delpage"', I.delpage, 'Διαγραφή σελίδας')}
    <div class="gHead">Εφαρμογή</div>
    ${mi('data-act="full"', I.full, 'Πλήρης οθόνη')}
    ${mi('data-act="overlay" id="overlayAct" class="hidden"', I.screen, 'Γράψιμο πάνω από άλλα προγράμματα')}
    ${mi('data-act="fxsound" data-lv="pri"', I.spark, 'Ήχοι')}
    ${mi('data-act="fxclick" data-lv="pri"', I.spark, 'Ήχος «κλικ» στα κουμπιά των εργαλείων')}
    ${mi('data-act="level"', I.target, 'Αλλαγή σε Δημοτικό')}
    ${mi('data-act="help"', I.doc, 'Οδηγίες χρήσης')}
    ${mi('data-act="more"', I.target, 'Ρυθμίσεις και αρχεία…')}
    ${mi('data-act="exit" id="exitAct" class="hidden"', I.exit, 'Έξοδος')}
  </div>
  <div id="setMenu" class="popup hidden">
    <div class="gHead">Ρυθμίσεις</div>
    ${mi('data-act="ai"', I.spark, 'Αναγνώριση γραφής και λύσεις (κλειδί)…')}
    ${mi('data-act="labels"', I.tag, 'Ονόματα κάτω από τα εικονίδια')}
    ${mi('data-act="prettyink"', PENCIL_ICON, 'Ομορφότερη γραφή: λιγότερο τρέμουλο, πάχος σαν στυλό')}
    ${mi('data-act="pdflogo"', I.doc, 'Λογότυπο στις σελίδες του PDF')}
    ${mi('data-act="startscr"', I.spark, '«Τι κάνουμε σήμερα;» στο πρώτο άνοιγμα της μέρας')}
    ${mi('data-act="snip" class="hidden"', I.screen, 'Ψαλίδι πάνω από άλλες εφαρμογές')}
    <div class="gHead">Αρχεία</div>
    ${mi('data-act="filesdir" class="hidden"', I.folder, 'Φάκελος για τα αρχεία των μαθημάτων…')}
    ${mi('data-act="filesdrive" class="hidden"', I.save, 'Αρχεία και στο Google Drive, στον φάκελο του τμήματος')}
    <div class="gHead">Για προχωρημένους</div>
    ${mi('data-act="diag"', I.target, 'Διάγνωση αφής/γραφίδας')}
    ${mi('data-act="test"', I.check, 'Λίστα δοκιμής στην τάξη')}
    ${mi('data-act="usage"', I.check, 'Τι χρησιμοποιώ')}
    ${mi('data-act="news"', I.spark, 'Τι νέο')}
    <div id="verLine"></div>
  </div>
  <div id="whereMenu" class="popup hidden">
    <div class="gHead" data-for="save">Αποθήκευση του μαθήματος</div>
    ${mi('data-act="save" data-for="save"', I.save, 'Στον δίσκο, σε αρχείο')}
    ${mi('data-act="drivesave" data-for="save" data-drive', I.cloudUp, 'Στο Google Drive')}
    <div class="gHead" data-for="save">Εξαγωγή και αποστολή</div>
    ${mi('data-act="pdf" data-for="save"', I.doc, 'Σε PDF…')}
    ${mi('data-act="png" data-for="save"', I.image, 'Η σελίδα σε εικόνα PNG')}
    ${mi('data-act="send" data-for="save"', I.send, 'Στους μαθητές, με επιλογή σελίδων…')}
    <div class="gHead" data-for="open">Άνοιγμα μαθήματος</div>
    ${mi('data-act="open" data-for="open"', I.folder, 'Από τον δίσκο, από αρχείο…')}
    ${mi('data-act="driveopen" data-for="open" data-drive', I.cloudDown, 'Από το Google Drive…')}
  </div>

  <div id="zoomCtl">
    <button id="zoomOut" title="Σμίκρυνση">${I.minus}</button>
    <button id="zoomFit" title="Προσαρμογή: όλη η σελίδα στην οθόνη">100%</button>
    <button id="zoomIn" title="Μεγέθυνση">${I.plus}</button>
    <button id="fsExit" class="hidden" title="Έξοδος από πλήρη οθόνη">${I.fullExit}</button>
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
      <div class="group hidden" id="selOpts">
        <button id="del" title="Διαγραφή επιλογής" data-l="Διαγραφή"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg></span></button>
        <button id="dup" title="Αντίγραφο επιλογής" data-l="Αντίγραφο"><span class="txt">×2</span></button>
        <button id="bigger" title="Μεγαλύτερο (και τα γράμματα των κειμένων)" data-l="Μεγαλύτερο"><span class="txt">＋</span></button>
        <button id="smaller" title="Μικρότερο (και τα γράμματα των κειμένων)" data-l="Μικρότερο"><span class="txt">−</span></button>
        <button id="flipH" title="Καθρέφτης: αριστερά–δεξιά" data-l="Καθρέφτης"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18" stroke-dasharray="2 2.5"/><path d="M9 6L3 18h6z"/><path d="M15 6l6 12h-6z" fill="currentColor" fill-opacity=".25"/></svg></span></button>
        <button id="flipV" title="Καθρέφτης: πάνω–κάτω" data-l="Πάνω–κάτω"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18" stroke-dasharray="2 2.5"/><path d="M6 9L18 3v6z"/><path d="M6 15l12 6v-6z" fill="currentColor" fill-opacity=".25"/></svg></span></button>
        <button id="sumBtn" title="Συνισταμένη: δύο βέλη ή ευθείες με κοινή κορυφή, ή μία γωνία" data-l="Συνισταμένη"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l5-12M4 20l11-3"/><path d="M4 20L20 5" stroke="#60a5fa"/><path d="M14 5h6v6" stroke="#60a5fa"/></svg></span></button>
        <button id="tidyBtn" title="Τακτοποίηση της χειρόγραφης γραφής: ίσια σειρά, ίσα κενά ανάμεσα στις λέξεις (μένει χειρόγραφη)" data-l="Τακτοποίηση"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18" stroke-dasharray="2 2.5"/><path d="M4 16c1-6 3-6 4 0M10 16c0-3 1-5 3-5s3 2 3 5M18 9v7"/></svg></span></button>
        <button id="angBtn" title="Γωνία ανάμεσα στις ευθείες: κρύψιμο ή εμφάνιση (σβήνεται και με τη γόμα πάνω στις μοίρες)" data-l="Γωνία"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 19H4L16 5"/><path d="M11 19a7 7 0 0 0-2.400-5.300"/></svg></span></button>
        <button id="moveBtn" title="Μεταφορά της επιλογής σε άλλη σελίδα (ή σε νέα), στην ίδια θέση" data-l="Σε σελίδα"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h8l3 3v5M4 4v16h7"/><path d="M14 17h7M18 14l3 3-3 3"/></svg></span></button>
        <i class="sep recSep"></i>
        <button data-rec="text" class="rec" title="Αναγνώριση της επιλογής ως κείμενο" data-l="Σε κείμενο"><span class="txt">Aα</span></button>
        <button data-rec="math" class="rec" data-lv="sec" title="Αναγνώριση της επιλογής ως τύπο" data-l="Σε τύπο"><span class="txt">√x</span></button>
        <button data-rec="solve" class="rec solve" data-lv="sec" title="Λύση της επιλεγμένης άσκησης (μπαίνει από κάτω)" data-l="Λύση"><span class="txt">x=?</span></button>
        <button data-rec="spell" class="rec check" data-lv="pri" title="Έλεγχος ορθογραφίας: από κάτω γράφεται ποιες λέξεις θέλουν διόρθωση" data-l="Ορθογραφία"><span class="txt">αβγ</span></button>
        <button data-speak="1" class="rec" data-lv="pri" title="Ο πίνακας διαβάζει φωναχτά το επιλεγμένο κείμενο" data-l="Διάβασέ το"><span class="txt">🔊</span></button>
        <button data-spellwords="1" class="rec" data-lv="pri" title="Ορθογραφία με το τερατάκι με τις επιλεγμένες λέξεις (γραμμένες με το «Κείμενο» ή με το χέρι)" data-l="Τερατάκι"><span class="txt">👾</span></button>
        <button data-rec="graph" class="rec graph" data-lv="sec" title="Γραφική παράσταση της επιλεγμένης συνάρτησης, σε άξονες που ταιριάζουν στο πεδίο ορισμού της" data-l="Γραφική"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3v17h17"/><path d="M6 17c3 0 4-11 7-11s3 7 7 7"/></svg></span></button>
        <button data-rec="figure" class="rec graph" data-lv="sec" title="Σχήμα για την επιλεγμένη εκφώνηση (π.χ. Φυσικής): μπαίνει από κάτω, αν η άσκηση χρειάζεται σχήμα" data-l="Σχήμα"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19h18M5 19L17 8v11"/><rect x="9.500" y="8.800" width="5" height="4" transform="rotate(-42.500 12 10.800)"/></svg></span></button>
        <button data-rec="check" class="rec check" title="Έλεγχος της λύσης ενός μαθητή: δείχνει σε ποια γραμμή είναι το πρώτο λάθος" data-l="Έλεγχος"><span class="txt">✓?</span></button>
      </div>
      <div class="group" id="penKinds">
        <button data-pen="pen"><span>${PENCIL_ICON}</span>Στυλό</button>
        <button data-pen="laser"><span>${LASER_ICON}</span>Δείκτης λέιζερ (σβήνει μόνος του)</button>
        <button data-auto="text" class="rec"><span>Aα</span>Αυτόματη αναγνώριση κειμένου: ό,τι γράφεις γίνεται καθαρό κείμενο μόλις σταματήσεις</button>
        <button data-auto="math" class="rec" data-lv="sec"><span>√x</span>Αυτόματη αναγνώριση τύπων: ό,τι γράφεις γίνεται τυπωμένος τύπος μόλις σταματήσεις</button>
      </div>
      <div class="group" id="shapes">
        <button data-shape="line"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20L20 4"/></svg></span>Ευθεία</button>
        <button data-shape="arrow"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20L20 4M11 4h9v9"/></svg></span>Βέλος</button>
        <button data-shape="rect"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="1"/></svg></span>Ορθογώνιο</button>
        <button data-shape="ellipse"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="9" ry="7"/></svg></span>Έλλειψη</button>
        <button data-shape="triangle"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l9 16H3z"/></svg></span>Τρίγωνο</button>
        <button data-shape="rhombus"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 9-8 9-8-9z"/></svg></span>Ρόμβος</button>
        <button data-shape="para"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13l-5 12H3z"/></svg></span>Παραλληλόγραμμο</button>
        <button data-shape="angle"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 19H4L16 5"/><path d="M11 19a7 7 0 0 0-2.400-5.300"/></svg></span>Γωνία με μοίρες</button>
      </div>
      <div class="group" id="eraserOpts">
        <button data-eraser="partial"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8" stroke-dasharray="2.5 3"/></svg></span>Σβήνει μόνο ό,τι είναι μέσα στον κύκλο</button>
        <button data-eraser="stroke"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14c3-7 5 5 8-1s5 5 10-3"/><path d="M5 5l14 14" stroke="#f87171"/></svg></span>Σβήνει ολόκληρη τη γραμμή</button>
        <button id="eraseAll"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11l4 5M14 11l-4 5"/></svg></span>Σβήσιμο όλων</button>
      </div>
      <div class="group" id="axesOpts">
        <button data-axis="x" data-l="Άξονας x"><span>x</span>Όνομα οριζόντιου άξονα</button>
        <button data-axis="y" data-l="Άξονας y"><span>y</span>Όνομα κατακόρυφου άξονα</button>
        <button id="axScale" data-l="Κλίμακα"><span class="txt">×1</span>Κλίμακα οριζόντιου άξονα: διάλεξε πόσο αξίζει μια γραμμή (×2 έως ×100, ή υποδιαίρεση ÷2 έως ÷100). Ο κατακόρυφος προσαρμόζεται μόνος του</button>
        <button id="axNums" data-l="Αριθμοί"><span class="txt">123</span>Αριθμοί στους άξονες: σβήσε τους για να γράψεις δικές σου τιμές (π.χ. ανά 10 ή 20)</button>
        <i class="sep"></i>
        <button id="fnBtn" data-l="Συνάρτ."><span class="txt">f(x)</span>Γραφική παράσταση συνάρτησης</button>
        <i class="sep"></i>
        <button data-an="int" data-l="Εμβαδόν"><span class="txt">∫</span>Ορισμένο ολοκλήρωμα ως εμβαδόν (δεύτερο πάτημα: χωρίο ανάμεσα σε δύο συναρτήσεις)</button>
        <button data-an="sum" data-l="Riemann"><span class="txt">Σ</span>Αθροίσματα Riemann: κάθε πάτημα διπλασιάζει τα ορθογώνια (4, 8, 16, 32)</button>
        <button data-an="lim" data-l="Όριο"><span class="txt">lim</span>Όριο σε σημείο: σύρε το σημείο πάνω στην καμπύλη προς το x₀</button>
        <button data-an="tan" data-l="Εφαπτ."><span class="txt">f′</span>Εφαπτομένη και παράγωγος (δεύτερο πάτημα: και η τέμνουσα)</button>
        <button data-an="asym" data-l="Ασύμπτ."><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v18M3 17h18" stroke-dasharray="2.5 3"/><path d="M11 4c.5 7 3 10.500 10 11"/></svg></span>Ασύμπτωτες</button>
      </div>
      <div class="group" id="springOpts">
        <button id="spPlay" data-l="Κίνηση"><span class="txt">▶</span>Κίνηση: ξεκινά ή σταματά (κύματα, κρούση, βολή, κυκλική κίνηση)</button>
        <button id="spMarks" data-l="Θέσεις"><span class="txt">ΘΦΜ</span>Εμφάνιση θέσης φυσικού μήκους, θέσης ισορροπίας και ±A (στο εκκρεμές: ισορροπία και ακραίες θέσεις)</button>
        <button id="spDamp" data-l="Απόσβ."><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c1.500-9 3.500-9 5 0s3 6 4.500 0 2.500-4 3.500 0 2 2.500 3 0 1.500-1 2 0h1.500"/></svg></span>Απόσβεση: η ταλάντωση σβήνει σιγά σιγά</button>
        <button id="spStop" data-l="Στοπ"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg></span>Σταμάτημα ταλάντωσης</button>
      </div>
      <div class="group" id="widths"></div>
    </div>
    <div class="group" id="tools">
      <button data-tool="select" data-l="Επιλογή"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="13" height="11" rx="1.5" stroke-dasharray="3 2.5"/><path d="M12 11l9 4.5-4 1.3-1.3 4z" fill="currentColor"/></svg></span>Επιλογή (σύρε γύρω από πολλά για ομαδική επιλογή)</button>
      <button id="penBtn" data-l="Γραφή"><span>${PENCIL_ICON}</span>Γραφή</button>
      <button data-tool="highlighter" data-l="Υπογρ."><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3l6 6-8 8H8l-2-2v-4z"/><path d="M3 21h13" stroke="#facc15" stroke-width="3.5"/></svg></span>Υπογραμμιστικό</button>
      <button data-tool="text" data-l="Κείμενο"><span>T</span>Κείμενο</button>
      <button data-tool="eraser" data-l="Γόμα"><span><svg viewBox="0 0 24 24"><g transform="rotate(-40 12 12)"><rect x="3" y="7.5" width="9" height="9" rx="1.5" fill="#fb7185"/><rect x="12" y="7.5" width="9" height="9" rx="1.5" fill="#60a5fa"/><rect x="11" y="7.5" width="2" height="9" fill="#f9fafb"/></g></svg></span>Γόμα</button>
      <button data-tool="measure" data-lv="sec" data-l="Μέτρηση"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16L16 3l5 5L8 21z"/><path d="M7 12l2 2M10 9l2 2M13 6l2 2"/></svg></span>Μετρήσεις: πάτα ένα σχήμα για μήκη, γωνίες, εμβαδόν, περίμετρο· σύρε μέσα σε μια γωνία για να τη μετρήσεις</button>
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
    <div class="group hidden" id="favs"></div>
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
    ${mi('data-imp="file"', I.folder, 'Εικόνα, PDF ή Word από αρχείο…')}
    ${mi('data-imp="shot"', I.screen, 'Στιγμιότυπο οθόνης')}
    ${mi('data-imp="paste"', I.paste, 'Επικόλληση από το πρόχειρο')}
    <hr />
    ${mi('data-ins="tpl"', I.doc, 'Σελίδα από πρότυπο…')}
  </div>

  <div id="stampMenu" class="popup hidden"><div id="stampGrid"></div></div>
  <div id="tableMenu" class="popup hidden">
    <div class="bgRow" id="tblStyles">
      <button data-tbl="grid" class="pill">Πίνακας</button>
      <button data-tbl="det" class="pill">Ορίζουσα | |</button>
      <button data-tbl="matrix" class="pill">Μήτρα [ ]</button>
    </div>
    <div id="tblGrid"></div>
    <div class="hint" id="tblHint"></div>
  </div>

  <div id="tplMenu" class="popup hidden">
    <div id="tplList"></div>
    <hr />
    ${mi('id="tplSave"', I.plus, 'Αποθήκευση της σελίδας ως πρότυπο')}
  </div>

  <div id="gadgetMenu" class="popup hidden">
    <div id="favBar"><span id="favMsg">Πάτα έως 6 όργανα για να μπουν στη μπάρα</span><button id="favEdit" class="pill" title="Διάλεξε έως 6 όργανα που θα είναι πάντα στη βασική μπάρα">☆ Αγαπημένα</button></div>
    <div class="gHead" id="recentHead">Πρόσφατα</div>
    <div class="tiles" id="recentTiles"></div>
    <div id="gTabs" data-lv="pri">
      <button data-gtab="num">Αριθμοί</button>
      <button data-gtab="frac">Κλάσματα</button>
      <button data-gtab="time">Ώρα · Χρήματα</button>
      <button data-gtab="shape">Σχήματα</button>
      <button data-gtab="play">Παιχνίδια</button>
    </div>
    <div class="gHead" data-lv="pri" data-tab="num">Αριθμοί και πράξεις</div>
    <div class="tiles" data-lv="pri" data-tab="num">
      ${tile('data-kid="numline"', K.numline, 'Αριθμογραμμή', 'Αριθμογραμμή: το ⟳ αλλάζει από πού ως πού')}
      ${tile('data-kid="blocks"', '<b class="em">🔢</b>', 'Ε Δ Μ', 'Εκατοντάδες, δεκάδες, μονάδες με κυβάκια: πάνω από 9 περνά ένα στην επόμενη στήλη')}
      ${tile('data-kid="hundred"', K.hundred, 'Πίνακας 100', 'Πίνακας του 100: πατάς αριθμούς και χρωματίζονται')}
      ${tile('data-kid="times"', K.times, 'Προπαίδεια', 'Προπαίδεια: πατάς ένα κουτί και φαίνεται το γινόμενο')}
      ${tile('data-kid="colops"', K.colops, 'Κάθετη πράξη', 'Πλέγμα για κάθετη πράξη με κρατούμενα')}
      ${tile('data-kid="balance"', '<b class="em">⚖️</b>', 'Ζυγαριά', 'Ζυγαριά: βάζεις αριθμούς και γέρνει προς το μεγαλύτερο άθροισμα')}
    </div>
    <div class="gHead" data-lv="pri" data-tab="frac">Κλάσματα</div>
    <div class="tiles" data-lv="pri" data-tab="frac">
      ${tile('data-kid="fracpie"', K.fracpie, 'Πίτα', 'Κλάσμα σε κύκλο: πατάς κομμάτια και χρωματίζονται. Το 🎯 βάζει άσκηση')}
      ${tile('data-kid="fracbar"', K.fracbar, 'Μπάρα', 'Κλάσμα σε μπάρα: για σύγκριση και ισοδύναμα κλάσματα. Το 🎯 βάζει άσκηση')}
      ${tile('data-kid="fracpizza"', '<b class="em">🍕</b>', 'Πίτσα', 'Κλάσμα σε πίτσα: τα κομμάτια που παίρνεις φαίνονται ολόκληρα')}
      ${tile('data-kid="fracchoc"', '<b class="em">🍫</b>', 'Σοκολάτα', 'Κλάσμα σε σοκολάτα: τα κομμάτια που παίρνεις φαίνονται ολόκληρα')}
    </div>
    <div class="gHead" data-lv="pri" data-tab="time">Χρόνος και χρήματα</div>
    <div class="tiles" data-lv="pri" data-tab="time">
      ${tile('data-kid="clock"', '<b class="em">🕒</b>', 'Ρολόι', 'Ρολόι: σέρνεις τους δείκτες. Το 🎯 βάζει άσκηση («Δείξε 7:45»)')}
      ${tile('data-kid="money"', '<b class="em">💶</b>', 'Χρήματα', 'Κέρματα και χαρτονομίσματα ευρώ')}
      ${tile('data-gadget="timer"', I.timer, 'Χρονόμετρο')}
    </div>
    <div class="gHead" data-tab="shape">Σχήματα</div>
    <div class="tiles" data-tab="shape">
      ${tile('data-shape="line"', I.line, 'Ευθεία')}
      ${tile('data-shape="arrow"', I.arrow, 'Βέλος')}
      ${tile('data-shape="rect"', I.rect, 'Ορθογώνιο')}
      ${tile('data-shape="ellipse"', I.ellipse, 'Κύκλος', 'Κύκλος ή έλλειψη')}
      ${tile('data-shape="triangle"', I.triangle, 'Τρίγωνο')}
      ${tile('data-shape="rhombus"', I.rhombus, 'Ρόμβος')}
      ${tile('data-shape="para"', I.para, 'Παραλ/μο', 'Παραλληλόγραμμο')}
      ${tile('data-shape="angle"', I.angle, 'Γωνία', 'Γωνία με μοίρες')}
      ${tile('data-ins="table"', I.table, 'Πίνακας…', 'Πίνακας, ορίζουσα ή μήτρα: διαλέγεις γραμμές και στήλες')}
    </div>
    <div class="gHead" data-lv="sec">Άξονες</div>
    <div class="tiles" data-lv="sec">
      ${tile('data-axes="full"', I.axFull, 'Άξονες', 'Άξονες με 4 τεταρτημόρια')}
      ${tile('data-axes="q1"', I.axQ1, '1ο τεταρτ.', 'Άξονες: 1ο τεταρτημόριο')}
      ${tile('data-axes="q14"', I.axQ14, 'x ≥ 0', 'Άξονες: 1ο και 4ο τεταρτημόριο (x ≥ 0)')}
      ${tile('data-ins="trig"', I.trig, 'Τριγ. κύκλος', 'Τριγωνομετρικός κύκλος')}
    </div>
    <div class="gHead" data-lv="sec">Ανάλυση συνάρτησης</div>
    <div class="tiles" data-lv="sec">
      ${tile('data-anq="int"', '<b>∫</b>', 'Ολοκλήρωμα', 'Ορισμένο ολοκλήρωμα ως εμβαδόν')}
      ${tile('data-anq="sum"', '<b>Σ</b>', 'Riemann', 'Αθροίσματα Riemann')}
      ${tile('data-anq="lim"', '<b class="sm">lim</b>', 'Όριο', 'Όριο σε σημείο')}
      ${tile('data-anq="tan"', '<b>f′</b>', 'Εφαπτομένη', 'Εφαπτομένη και παράγωγος')}
      ${tile('data-anq="asym"', I.asym, 'Ασύμπτωτες')}
    </div>
    <div class="gHead" data-tab="shape"><span data-lv="sec">Όργανα και φυσική</span><span data-lv="pri">Όργανα</span></div>
    <div class="tiles" data-tab="shape">
      ${tile('data-gadget="ruler"', I.ruler, 'Χάρακας')}
      ${tile('data-gadget="protractor"', I.protractor, 'Μοιρογν.', 'Μοιρογνωμόνιο')}
      ${tile('data-gadget="compass"', I.compass, 'Διαβήτης')}
      ${tile('data-ins="stamps" data-lv="sec"', I.physics, 'Φυσική…', 'Σχήματα φυσικής')}
      ${tile('data-kid="poll" data-lv="sec"', I.poll, 'Ψηφοφορία', 'Ψηφοφορία της τάξης: Α Β Γ Δ ή ναι/όχι, με ραβδόγραμμα στο τέλος')}
      ${tile('data-kid="lottery" data-lv="sec"', I.lottery, 'Κλήρωση', 'Κλήρωση: βγάζει τυχαίο μαθητή του τμήματος (ή αριθμό, αν το τμήμα δεν έχει ονόματα)')}
    </div>
    <div class="gHead" data-lv="pri" data-tab="num">Εικόνες για μέτρημα</div>
    <div class="tiles small" data-lv="pri" data-tab="num">
      ${PICS.map(([key, emoji, label]) => `<button data-kid="pic-${key}" class="tile pic" title="${label}"><span><b class="em">${emoji}</b></span></button>`).join('')}
    </div>
    <div class="gHead" data-lv="pri" data-tab="play">Παιχνίδια</div>
    <div class="tiles" data-lv="pri" data-tab="play">
      ${tile('data-kid="build"', '<b class="em">🧱</b>', 'Κυβάκια', 'Χτίσιμο με κυβάκια: διαλέγεις υλικό και σέρνεις για να χτίσεις')}
      ${tile('data-kid="numcubes"', '<b class="em">🟥</b>', 'Αριθμοκυβάκια', 'Αριθμοκυβάκια 1–20: σέρνεις το ένα πάνω στο άλλο και ενώνονται, ✂️ τα χωρίζει, και αλλάζουν σχήμα, χρώμα και αξεσουάρ· ⚖️ ζυγαριά για αθροίσματα')}
      ${tile('data-kid="spell"', '<b class="em">👾</b>', 'Ορθογραφία', 'Ορθογραφία: έτοιμες λέξεις ανά τάξη ή δικές σου· ο μαθητής γράφει, το τερατάκι τρώει τα λάθη και μεγαλώνει, και ο μαθητής γράφει το σωστό στα κενά')}
      ${tile('data-kid="hangman"', '<b class="em">🔡</b>', 'Κρεμάλα', 'Κρεμάλα: τυχαία λέξη ή δική σου, με πάτημα στα γράμματα')}
      ${tile('data-kid="dice"', '<b class="em">🎲</b>', 'Ζάρι')}
      ${tile('data-kid="poll"', '<b class="em">📊</b>', 'Ψηφοφορία', 'Ψηφοφορία της τάξης: Α Β Γ Δ ή ναι/όχι, με ραβδόγραμμα στο τέλος')}
      ${tile('data-kid="lottery"', '<b class="em">🎟️</b>', 'Κλήρωση', 'Κλήρωση: βγάζει τυχαίο μαθητή του τμήματος (ή αριθμό, αν το τμήμα δεν έχει ονόματα)')}
    </div>
    <div class="gHead" data-lv="pri" data-tab="play">Επιβράβευση</div>
    <div class="tiles" data-lv="pri" data-tab="play">
      ${tile('data-kid="star"', '<b class="em">⭐</b>', 'Αστέρι')}
      ${tile('data-kid="smile"', '<b class="em">🙂</b>', 'Φατσούλα')}
      ${tile('data-kid="bravo"', '<b class="em">👏</b>', 'Μπράβο!')}
    </div>
    <div class="gHead" data-tab="shape">Παρουσίαση</div>
    <div class="tiles" data-tab="shape">
      ${tile('data-gadget="timer" data-lv="sec"', I.timer, 'Χρονόμετρο')}
      ${tile('data-view="curtainTop"', I.curtainTop, 'Κουρτ. πάνω', 'Κουρτίνα από πάνω (γράφεις και πάνω της)')}
      ${tile('data-view="curtain"', I.curtain, 'Κουρτ. κάτω', 'Κουρτίνα από κάτω (γράφεις και πάνω της)')}
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
  <div id="moveMenu" class="popup hidden">
    <div class="gHead">Μεταφορά σε σελίδα</div>
    <div id="moveGrid"></div>
  </div>
  <div id="scaleMenu" class="popup hidden">
    <div id="scaleGrid"></div>
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
  <div id="pagePick" class="hidden">
    <div id="ppBox">
      <b id="ppTitle"></b>
      <div id="ppQuick"><button id="ppAll">Όλες</button><button id="ppNone">Καμία</button><button id="ppCur">Μόνο αυτή που βλέπω</button></div>
      <div id="ppGrid"></div>
      <div id="ppActs"><button id="ppCancel">Άκυρο</button><button id="ppOk"></button></div>
    </div>
  </div>
  <div id="welcome" class="hidden">
    <div id="wBox">
      <div id="wHead"><img class="onDark" src="./logo-light.svg" alt="" /><img class="onLight" src="./logo.svg" alt="" /><div><b>Καλώς ήρθες στο PrismaBoard</b><span>Τέσσερα πράγματα και ξεκινάς.</span></div></div>
      <div id="wCards">
        <div><i>${PENCIL_ICON}</i><b>Γράψε αμέσως</b><span>Το στυλό γράφει. Η παλάμη ή η γροθιά σβήνει. Δύο δάχτυλα μετακινούν και μεγεθύνουν.</span></div>
        <div><i>${I.ruler}</i><b>Όργανα</b><span>Σχήματα που μετριούνται, άξονες και συναρτήσεις, χάρακας, διαβήτης, κουρτίνα.</span></div>
        <div><i>${I.doc}</i><b>Δεν χάνεται τίποτα</b><span>Ό,τι γράφεις αποθηκεύεται μόνο του. Τα μαθήματά σου είναι στο όνομα πάνω αριστερά.</span></div>
        <div><i>${I.send}</i><b>Στο τέλος, ένα QR</b><span>☰ → «Τέλος μαθήματος»: οι μαθητές σκανάρουν και παίρνουν το μάθημα σε PDF.</span></div>
      </div>
      <div id="wLevel"><span>Για ποιες τάξεις;</span><button data-level="primary"><b>Δημοτικό</b><small>Απλή γραμμή εργαλείων, αριθμογραμμή, κλάσματα, ρολόι, ζυγαριά</small></button><button data-level="secondary"><b>Γυμνάσιο – Λύκειο</b><small>Συναρτήσεις, μετρήσεις, φυσική, λύση ασκήσεων</small></button></div>
      <div id="wActs"><button id="wHelp">Πλήρεις οδηγίες</button><button id="wGo" class="go">Ξεκίνα</button></div>
    </div>
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
  <div id="drop" class="hidden">Άφησε το αρχείο εδώ (εικόνα, PDF ή Word)</div>
  <input id="fileImport" type="file" accept="image/*,.png,.jpg,.jpeg,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple hidden />
  <input id="fileOpen" type="file" accept=".json,application/json" hidden />
`
  );
}
