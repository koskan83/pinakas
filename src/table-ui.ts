/** Το μενού «Πίνακας / ορίζουσα / μήτρα»: είδος και μέγεθος από πλέγμα, όπως στο Word. */

import { TableStyle } from './model';
import { $, board } from './app';
import { closePopups, placeNear, refreshUi } from './main';

const TBL_MAX = 6;
let tblStyle: TableStyle = 'grid';
/** Οι γραμμές και οι στήλες που δείχνει τώρα το πλέγμα επιλογής (κάτω από το δάχτυλο ή η τελευταία επιλογή). */
let tblPick = { r: 3, c: 3 };

function paintTableMenu(): void {
  const tableMenu = $('tableMenu');
  tableMenu.querySelectorAll<HTMLElement>('[data-tbl]').forEach((b) => b.classList.toggle('on', b.dataset.tbl === tblStyle));
  tableMenu.querySelectorAll<HTMLElement>('#tblGrid button').forEach((b) => b.classList.toggle('on', +b.dataset.r! <= tblPick.r && +b.dataset.c! <= tblPick.c));
  $('tblHint').textContent = `Πάτα το κελί που θες: τώρα ${tblPick.r} × ${tblPick.c} (γραμμές × στήλες)`;
}

export function openTableMenu(): void {
  const tableMenu = $('tableMenu');
  paintTableMenu();
  tableMenu.classList.remove('hidden');
  placeNear(tableMenu, $('gadgetBtn'));
}

export function initTableMenu(): void {
  const tableMenu = $('tableMenu');
  $('tblGrid').innerHTML = Array.from({ length: TBL_MAX * TBL_MAX }, (_, i) => `<button data-r="${Math.floor(i / TBL_MAX) + 1}" data-c="${(i % TBL_MAX) + 1}"></button>`).join('');
  tableMenu.addEventListener('pointerover', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('#tblGrid button');
    if (!b || e.pointerType !== 'mouse') return;
    tblPick = { r: +b.dataset.r!, c: +b.dataset.c! };
    paintTableMenu();
  });
  tableMenu.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const st = t.closest<HTMLElement>('[data-tbl]')?.dataset.tbl as TableStyle | undefined;
    if (st) {
      tblStyle = st;
      paintTableMenu();
      return;
    }
    const b = t.closest<HTMLElement>('#tblGrid button');
    if (!b) return;
    tblPick = { r: +b.dataset.r!, c: +b.dataset.c! };
    closePopups();
    board.addTable(tblPick.r, tblPick.c, tblStyle);
    refreshUi();
  });
}
