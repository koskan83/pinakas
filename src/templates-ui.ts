/** Πρότυπα σελίδων: τα έτοιμα και όσα αποθηκεύει ο χρήστης από την τρέχουσα σελίδα. */

import { Item } from './model';
import { kvGet, kvSet } from './storage';
import { ask } from './dialog';
import { BUILTIN, type Template } from './pages';
import { $, board, toast } from './app';
import { esc } from './axes-ui';
import { closePopups } from './main';

let templates: Template[] = [];

export function renderTemplates(): void {
  $('tplList').innerHTML =
    BUILTIN.map((t, i) => `<div class="tplItem"${t.lv ? ` data-lv="${t.lv}"` : ''}><button data-tpl="b${i}">📄 ${esc(t.name)}</button></div>`).join('') +
    templates.map((t, i) => `<div class="tplItem"><button data-tpl="u${i}">📄 ${esc(t.name)}</button><button data-tpldel="${i}" title="Διαγραφή προτύπου">✕</button></div>`).join('');
}

export function initTemplates(): void {
  void kvGet<Template[]>('templates').then((t) => { templates = t ?? []; });
  $('tplMenu').addEventListener('click', async (e) => {
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
      const name = (await ask('Όνομα προτύπου', { value: `Πρότυπο ${templates.length + 1}` }))?.trim();
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
}
