/** Γραφίδα, δάχτυλα και ποντίκι: τι κάνει κάθε άγγιγμα ανάλογα με το εργαλείο (μέθοδοι της Board, σε δικό τους αρχείο). */

import { AxesItem, Item, Pt, inLasso, itemBounds, reboxShape, recognizeShape, rotateItem, roundAngle, scaleItem, translateItem, uid, unrot } from './model';
import { STAMPS } from './stamps';
import type { Board, PState, Twist } from './board';

export function down(bd: Board, e: PointerEvent): void {
  e.preventDefault();
  if (bd.replay) return;
  bd.live.setPointerCapture(e.pointerId);
  bd.onPointerInfo(e, bd.ptrs.size + 1);
  const ps: PState = { id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY, t0: performance.now(), mode: 'none' };
  bd.ptrs.set(e.pointerId, ps);
  // κάθε νέο άγγιγμα ακυρώνει την περιοχή του προηγούμενου λάσου
  const hadRegion = !!bd.region;
  bd.region = null;
  if (hadRegion) bd.onUi();

  const touches = [...bd.ptrs.values()].filter((p) => p.type === 'touch');
  if (e.pointerType === 'touch' && touches.length === 1) bd.touchSel = { selected: bd.selected, multi: bd.multi.slice() };
  // Όλο το χέρι (4+ δάχτυλα) με κάτι επιλεγμένο: το στρίψιμο του χεριού το περιστρέφει
  if (e.pointerType === 'touch' && bd.gesture) {
    if (bd.gesture.twist) rebaseTwist(bd, bd.gesture.twist);
    else if (touches.length >= 4) startTwist(bd);
  }

  // Χειρονομία δύο δαχτύλων: pan / zoom
  if (e.pointerType === 'touch' && !bd.gesture) {
    const other = [...bd.ptrs.values()].find((p) => p.type === 'touch' && p.id !== e.pointerId && p.mode !== 'none');
    const otherAny = [...bd.ptrs.values()].find((p) => p.type === 'touch' && p.id !== e.pointerId);
    const cand = other ?? otherAny;
    if (cand) {
      const young = cand.stroke ? performance.now() - cand.t0 < 300 : true;
      const busy = cand.mode === 'gadget';
      const free = bd.tool === 'hand' || bd.tool === 'select' || cand.mode === 'pan' || cand.mode === 'none';
      if (!busy && (young || free)) {
        bd.cancelPointer(cand);
        bd.startGesture(cand, ps);
        return;
      }
    }
  }
  if (bd.gesture) return;

  const [wx, wy] = bd.toWorld(e.clientX, e.clientY);
  const v = bd.page.view;

  if (e.pointerType === 'mouse' && e.button === 1) {
    ps.mode = 'pan';
    ps.start = [e.clientX, e.clientY];
    ps.v0 = { ...v };
    return;
  }

  const drawing = bd.tool === 'pen' || bd.tool === 'highlighter';
  const gd = bd.gadgets.down(wx, wy, v.k, {
    color: bd.color, width: bd.width, hl: bd.tool === 'highlighter', drawing,
  });
  if (gd) {
    ps.mode = 'gadget';
    ps.gadget = gd;
    ps.stroke = gd.stroke;
    bd.renderLive();
    return;
  }

  let tool = bd.tool;
  if (e.pointerType === 'touch' && Math.max(e.width, e.height) > bd.palmThreshold) tool = 'eraser';

  // τα εργαλεία του Δημοτικού δουλεύουν με ό,τι κι αν κρατάς: πάτημα σε κουμπί τους ή χτίσιμο με κυβάκια δεν γράφει στον πίνακα
  if (tool === 'pen' || tool === 'highlighter' || tool === 'shape' || tool === 'text' || tool === 'laser') {
    const hit = bd.hitTest(wx, wy);
    if (hit && hit.kind === 'stamp' && STAMPS[hit.name]?.kid) {
      if (bd.kidPaint(ps, hit, wx, wy, true)) {
        ps.mode = 'kid';
        ps.kidOrig = hit;
        bd.redraw();
        return;
      }
      if (bd.pressKid(hit, [wx, wy])) return;
    }
  }

  switch (tool) {
    case 'pen':
    case 'highlighter':
      ps.mode = 'draw';
      ps.stroke = {
        kind: 'stroke', id: uid(), pts: [[wx, wy]],
        color: bd.color, width: bd.width, hl: tool === 'highlighter',
      };
      ps.start = [e.clientX, e.clientY];
      bd.armSnap(ps);
      bd.renderLive();
      break;
    case 'shape':
      ps.mode = 'shape';
      // βέλος/ευθεία που ξεκινά πολύ κοντά στην αρχή άλλου: κουμπώνει εκεί και δείχνει τη γωνία τους
      let sx = wx, sy = wy, angleWith: string | undefined;
      if (bd.shapeKind === 'arrow' || bd.shapeKind === 'line') {
        const items = bd.page.items;
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          if (it.kind === 'shape' && (it.shape === 'arrow' || it.shape === 'line') && Math.hypot(it.x0 - wx, it.y0 - wy) < 28 / v.k) {
            sx = it.x0; sy = it.y0; angleWith = it.id;
            break;
          }
        }
      }
      ps.live = bd.shapeKind === 'angle'
        ? { kind: 'angle', id: uid(), x: wx, y: wy, a1: 0, a2: 0, len1: 0, len2: 0, color: bd.color, width: bd.width }
        : {
          kind: 'shape', id: uid(), shape: bd.shapeKind,
          x0: sx, y0: sy, x1: wx, y1: wy, color: bd.color, width: bd.width, angleWith,
        };
      bd.renderLive();
      break;
    case 'text': {
      const hit = bd.hitTest(wx, wy);
      bd.onTextRequest(wx, wy, hit && hit.kind === 'text' ? hit : undefined);
      break;
    }
    case 'eraser':
      ps.mode = 'erase';
      ps.before = bd.page.items.slice();
      bd.eraserAt = { x: wx, y: wy };
      bd.eraseAt(ps, wx, wy);
      bd.renderLive();
      break;
    case 'measure':
      // πάτημα ή σύρσιμο μέσα σε μια γωνία τη μετράει· το τόξο μένει στη σελίδα όταν σηκώσεις τη γραφίδα
      ps.mode = 'measure';
      ps.start = [e.clientX, e.clientY];
      ps.live = bd.angleAround(wx, wy) ?? undefined;
      bd.renderLive();
      break;
    case 'laser':
      ps.mode = 'laser';
      ps.laser = { pts: [[wx, wy]], t: 0 };
      bd.lasers.push(ps.laser);
      bd.renderLive();
      break;
    case 'hand':
      ps.mode = 'pan';
      ps.start = [e.clientX, e.clientY];
      ps.v0 = { ...v };
      break;
    case 'select': {
      const items = bd.page.items;
      // πιάνοντας το σώμα ενός ελατηρίου το τραβάς· όταν το αφήσεις ταλαντώνεται
      const spring = bd.springAt(wx, wy);
      if (spring) {
        // το εκκρεμές πιάνεται από εκεί που βρίσκεται (ακίνητο είναι γερμένο), το ελατήριο από τη θέση ισορροπίας
        const g = STAMPS[spring.name]?.spring?.(spring.w, spring.h);
        const st = bd.springState(spring);
        const d0 = g?.bob ? (!st.amp && !st.d ? g.rest ?? 0 : st.d) : 0;
        bd.osc.delete(spring.id);
        bd.selected = spring.id;
        bd.multi = [];
        bd.oscDrag = { id: spring.id, d: d0, d0 };
        ps.mode = 'osc';
        ps.start = [wx, wy];
        bd.redraw();
        bd.onUi();
        return;
      }
      const sel = bd.selected ? items.find((x) => x.id === bd.selected) : undefined;
      if (sel) {
        const hi = bd.pointHandles(sel).findIndex((p) => Math.hypot(wx - p[0], wy - p[1]) < 24 / v.k);
        const b = itemBounds(sel);
        const corner = bd.cornerResizable(sel) && Math.hypot(wx - b.x1, wy - b.y1) < 24 / v.k;
        const rh = bd.rotHandle(b);
        if (hi < 0 && !corner && bd.rotatable(sel) && Math.hypot(wx - rh[0], wy - rh[1]) < 22 / v.k) {
          ps.mode = 'rotate';
          ps.orig = sel;
          ps.preview = sel;
          ps.start = bd.pivotPoint(b, sel);
          ps.a0 = Math.atan2(wy - ps.start[1], wx - ps.start[0]);
          ps.tap = true;
          bd.redraw();
          return;
        }
        if (hi >= 0 || corner) {
          ps.mode = 'resize';
          ps.handle = hi >= 0 ? hi + 1 : 0;
          ps.orig = sel;
          ps.preview = sel;
          ps.start = [wx, wy];
          bd.redraw();
          return;
        }
      }
      if (bd.multi.length) {
        const b = bd.groupBounds();
        if (b) {
          const corner = Math.hypot(wx - b.x1, wy - b.y1) < 24 / v.k;
          const inside = wx >= b.x0 && wx <= b.x1 && wy >= b.y0 && wy <= b.y1;
          const rh = bd.rotHandle(b);
          if (!corner && Math.hypot(wx - rh[0], wy - rh[1]) < 22 / v.k) {
            ps.mode = 'grotate';
            ps.before = items.slice();
            ps.ids = new Set(bd.multi);
            ps.start = bd.pivotPoint(b);
            ps.a0 = Math.atan2(wy - ps.start[1], wx - ps.start[0]);
            ps.tap = true;
            return;
          }
          if (corner || inside) {
            ps.mode = corner ? 'gresize' : 'gmove';
            ps.before = items.slice();
            ps.ids = new Set(bd.multi);
            ps.gb = b;
            ps.start = [wx, wy];
            return;
          }
        }
      }
      const hit = bd.hitTest(wx, wy);
      bd.multi = [];
      // πάνω σε μη επιλεγμένη εικόνα (π.χ. σελίδα PDF) το σύρσιμο κάνει λάσο· το απλό άγγιγμα την επιλέγει
      if (hit && hit.kind === 'stamp' && bd.kidPaint(ps, hit, wx, wy, true)) {
        // χτίσιμο με κυβάκια ή δείκτης ρολογιού: το σύρσιμο δουλεύει πάνω στο εργαλείο, δεν το μετακινεί ούτε το επιλέγει
        bd.selected = null;
        ps.mode = 'kid';
        // όχι στο ps.orig: ό,τι είναι εκεί θεωρείται «υπό μετακίνηση» και δεν ζωγραφίζεται στη σελίδα
        ps.kidOrig = hit;
        bd.redraw();
        bd.onUi();
        break;
      }
      if (hit && !(hit.kind === 'image' && hit.id !== bd.selected)) {
        ps.wasSel = hit.id === bd.selected;
        bd.selected = hit.id;
        ps.mode = 'move';
        ps.orig = hit;
        ps.preview = hit;
        ps.start = [wx, wy];
        bd.redraw();
      } else {
        bd.selected = null;
        ps.mode = 'lasso';
        ps.lasso = [[wx, wy]];
        ps.tapHit = hit?.id;
        bd.renderLive();
      }
      bd.onUi();
      break;
    }
  }
}

const touchPts = (bd: Board): Map<number, Pt> =>
  new Map([...bd.ptrs.values()].filter((p) => p.type === 'touch').map((p) => [p.id, [p.x, p.y] as Pt]));

/** Πόσο έχει στρίψει το χέρι από τη βάση: μέση στροφή των δαχτύλων γύρω από το κέντρο τους. */
function twistAngle(bd: Board, t: Twist): number {
  const now = touchPts(bd);
  const ids = [...t.p0.keys()].filter((id) => now.has(id));
  if (ids.length < 2) return 0;
  let c0x = 0, c0y = 0, cx = 0, cy = 0;
  for (const id of ids) {
    c0x += t.p0.get(id)![0]; c0y += t.p0.get(id)![1];
    cx += now.get(id)![0]; cy += now.get(id)![1];
  }
  c0x /= ids.length; c0y /= ids.length; cx /= ids.length; cy /= ids.length;
  let cross = 0, dot = 0;
  for (const id of ids) {
    const ax = t.p0.get(id)![0] - c0x, ay = t.p0.get(id)![1] - c0y;
    const bx = now.get(id)![0] - cx, by = now.get(id)![1] - cy;
    cross += ax * by - ay * bx;
    dot += ax * bx + ay * by;
  }
  return Math.atan2(cross, dot);
}

/** Άλλαξαν τα δάχτυλα που ακουμπούν: η γωνία ως εδώ κρατιέται και η μέτρηση ξεκινά από τις τωρινές θέσεις. */
function rebaseTwist(bd: Board, t: Twist): void {
  t.acc += twistAngle(bd, t);
  t.p0 = touchPts(bd);
}

function startTwist(bd: Board): void {
  const g = bd.gesture!;
  const items = bd.page.items;
  // το πρώτο δάχτυλο μπορεί να «ξε-επέλεξε» ακουμπώντας σε κενό: ισχύει η επιλογή που υπήρχε πριν ακουμπήσει το χέρι
  let ids = bd.selectedIds();
  if (!ids.size && bd.touchSel) ids = new Set(bd.touchSel.multi.length ? bd.touchSel.multi : bd.touchSel.selected ? [bd.touchSel.selected] : []);
  const sel = items.filter((it) => ids.has(it.id) && bd.rotatable(it));
  if (!sel.length) return;
  if (!bd.selectedIds().size && bd.touchSel) {
    bd.selected = bd.touchSel.selected;
    bd.multi = bd.touchSel.multi.slice();
  }
  // ό,τι μετακίνηση ή zoom έκαναν τα δύο πρώτα δάχτυλα πριν φτάσουν τα υπόλοιπα, αναιρείται
  Object.assign(bd.page.view, g.v0);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of sel) {
    const b = itemBounds(it);
    x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1);
  }
  g.twist = { ids: new Set(sel.map((it) => it.id)), before: items.slice(), pivot: [(x0 + x1) / 2, (y0 + y1) / 2], p0: touchPts(bd), acc: 0, changed: false };
  bd.redraw();
  bd.onUi();
}

function moveTwist(bd: Board, t: Twist): void {
  let deg = ((t.acc + twistAngle(bd, t)) * 180) / Math.PI;
  // μικρό τρέμουλο του χεριού δεν είναι στροφή· κοντά σε πολλαπλάσια των 15° «κουμπώνει»
  if (!t.changed && Math.abs(deg) < 4) return;
  const near = Math.round(deg / 15) * 15;
  if (Math.abs(near - deg) <= 3) deg = near;
  const ang = (deg * Math.PI) / 180;
  bd.page.items = t.before.map((it) => (t.ids.has(it.id) ? rotateItem(it, t.pivot[0], t.pivot[1], ang) : it));
  t.changed = true;
  bd.redraw();
}

export function startGesture(bd: Board, a: PState, b: PState): void {
  a.mode = 'none';
  b.mode = 'none';
  const c0: Pt = [(a.x + b.x) / 2, (a.y + b.y) / 2];
  bd.gesture = {
    a: a.id, b: b.id, c0,
    d0: Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1),
    v0: { ...bd.page.view },
    zoom: false,
  };
  bd.redraw();
}

/** Ακυρώνει ό,τι έκανε ένας δείκτης χωρίς να το καταχωρήσει. */
export function cancelPointer(bd: Board, ps: PState): void {
  if ((ps.mode === 'erase' || ps.mode === 'gmove' || ps.mode === 'gresize') && ps.changed && ps.before) bd.page.items = ps.before;
  if (ps.laser) bd.lasers = bd.lasers.filter((l) => l !== ps.laser);
  ps.laser = undefined;
  ps.lasso = undefined;
  clearTimeout(ps.timer);
  ps.stroke = undefined;
  ps.live = undefined;
  ps.gadget = undefined;
  ps.preview = undefined;
  ps.orig = undefined;
  if (ps.kidOrig) {
    // μισοτελειωμένο σύρσιμο πάνω σε εργαλείο του Δημοτικού: γυρίζει όπως ήταν
    const before = ps.kidOrig;
    const i = bd.page.items.findIndex((x) => x.id === before.id);
    if (i >= 0) bd.page.items[i] = before;
    ps.kidOrig = undefined;
  }
  ps.before = undefined;
  ps.changed = false;
  ps.mode = 'none';
  bd.eraserAt = null;
  bd.redraw();
}

/** Κράτημα της γραφίδας ακίνητης: το σκίτσο γίνεται τέλειο σχήμα. */
export function armSnap(bd: Board, ps: PState): void {
  clearTimeout(ps.timer);
  ps.timer = window.setTimeout(() => {
    if (ps.mode !== 'draw' || !ps.stroke || ps.stroke.hl || ps.live) return;
    const r = recognizeShape(ps.stroke.pts);
    if (!r) return;
    const s = ps.stroke;
    ps.live = r.t === 'angle'
      ? { kind: 'angle', id: uid(), x: r.x, y: r.y, a1: r.a1, a2: r.a2, len1: r.len1, len2: r.len2, color: s.color, width: s.width }
      : {
        kind: 'shape', id: uid(), shape: r.shape, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, pts: r.pts,
        color: s.color, width: s.width, hl: s.hl,
      };
    bd.renderLive();
  }, 600);
}

/** Ποντίκι ή γραφίδα που αιωρείται πάνω από εργαλείο του Δημοτικού: ο κέρσορας που ζητά (π.χ. ψαλίδι). */
function kidCursor(bd: Board, e: PointerEvent): void {
  let cur = '';
  if (['select', 'pen', 'highlighter', 'shape', 'text', 'laser'].includes(bd.tool)) {
    const [wx, wy] = bd.toWorld(e.clientX, e.clientY);
    const hit = bd.hitTest(wx, wy);
    const d = hit && hit.kind === 'stamp' ? STAMPS[hit.name] : undefined;
    if (hit && hit.kind === 'stamp' && d?.cursor) {
      const [lx, ly] = unrot(hit, wx, wy);
      cur = d.cursor(hit.v ?? d.init ?? [], lx - hit.x, ly - hit.y, hit.w, hit.h) ?? '';
    }
  }
  if (bd.live.style.cursor !== cur) bd.live.style.cursor = cur;
}

export function move(bd: Board, e: PointerEvent): void {
  const ps = bd.ptrs.get(e.pointerId);
  if (!ps) {
    if (e.pointerType !== 'touch') kidCursor(bd, e);
    if (e.pointerType === 'mouse' && bd.tool === 'eraser') {
      const [wx, wy] = bd.toWorld(e.clientX, e.clientY);
      bd.eraserAt = { x: wx, y: wy };
      bd.renderLive();
    }
    return;
  }
  bd.onPointerInfo(e, bd.ptrs.size);
  const evs = e.getCoalescedEvents?.() ?? [];
  const list = evs.length ? evs : [e];
  for (const ev of list) bd.moveOne(ps, ev);
  bd.renderLive();
}

export function moveOne(bd: Board, ps: PState, e: PointerEvent): void {
  ps.x = e.clientX;
  ps.y = e.clientY;
  if (bd.gesture?.twist) {
    moveTwist(bd, bd.gesture.twist);
    return;
  }
  if (bd.gesture) {
    const g = bd.gesture;
    const a = bd.ptrs.get(g.a);
    const b = bd.ptrs.get(g.b);
    if (!a || !b) return;
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const d = Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1);
    if (!g.zoom) {
      // δύο δάχτυλα που σέρνονται μαζί δεν κρατούν ποτέ ακριβώς την ίδια απόσταση: μικρές αλλαγές δεν είναι zoom.
      // Αν η σελίδα έχει ήδη μετακινηθεί αρκετά, είναι φανερά μετακίνηση και το zoom θέλει ακόμα πιο καθαρό άνοιγμα.
      const moved = Math.hypot(cx - g.c0[0], cy - g.c0[1]);
      const need = moved > 60 ? Math.max(90, g.d0 * 0.3) : Math.max(36, g.d0 * 0.14);
      if (Math.abs(d - g.d0) > need) {
        g.zoom = true;
        // το zoom ξεκινά από εδώ, χωρίς πήδημα
        g.d0 = d;
        g.c0 = [cx, cy];
        g.v0 = { ...bd.page.view };
      }
    }
    const k = g.zoom ? Math.min(8, Math.max(0.1, g.v0.k * (d / g.d0))) : g.v0.k;
    const wx = (g.c0[0] - g.v0.x) / g.v0.k;
    const wy = (g.c0[1] - g.v0.y) / g.v0.k;
    const v = bd.page.view;
    v.k = k;
    v.x = cx - wx * k;
    v.y = cy - wy * k;
    bd.redraw();
    return;
  }
  const [wx, wy] = bd.toWorld(e.clientX, e.clientY);
  switch (ps.mode) {
    case 'draw': {
      if (ps.live) {
        // μετά την αναγνώριση, όσο κρατάς πατημένο, η άκρη ακολουθεί τη γραφίδα
        const l = ps.live;
        if (l.kind === 'angle') {
          l.a2 = roundAngle(Math.atan2(wy - l.y, wx - l.x));
          l.len2 = Math.max(20, Math.hypot(wx - l.x, wy - l.y));
        } else if (l.shape === 'line') {
          l.x1 = wx;
          l.y1 = wy;
        }
        break;
      }
      const pts = ps.stroke!.pts;
      if (ps.stroke!.hl) {
        // το υπογραμμιστικό τραβάει μόνο ευθεία· κοντά στο οριζόντιο ή το κατακόρυφο ισιώνει τελείως
        const [ax, ay] = pts[0];
        let bx = wx, by = wy;
        if (Math.abs(by - ay) < Math.abs(bx - ax) * 0.14) by = ay;
        else if (Math.abs(bx - ax) < Math.abs(by - ay) * 0.14) bx = ax;
        // ενδιάμεσα σημεία, για να μπορεί η γόμα να σβήσει ένα κομμάτι της
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 8));
        pts.length = 1;
        for (let i = 1; i <= n; i++) pts.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
        break;
      }
      const last = pts[pts.length - 1];
      const minD = 1.2 / bd.page.view.k;
      if (Math.hypot(wx - last[0], wy - last[1]) >= minD) pts.push([wx, wy]);
      if (Math.hypot(e.clientX - ps.start![0], e.clientY - ps.start![1]) > 4) {
        ps.start = [e.clientX, e.clientY];
        bd.armSnap(ps);
      }
      break;
    }
    case 'gadget':
      ps.gadget!.move(wx, wy);
      break;
    case 'shape': {
      const l = ps.live!;
      if (l.kind === 'angle') {
        // η πρώτη πλευρά μένει οριζόντια, η δεύτερη ακολουθεί τη γραφίδα
        const d = Math.hypot(wx - l.x, wy - l.y);
        l.a2 = roundAngle(Math.atan2(wy - l.y, wx - l.x));
        l.len1 = d;
        l.len2 = d;
      } else {
        l.x1 = wx;
        l.y1 = wy;
      }
      break;
    }
    case 'erase':
      bd.eraserAt = { x: wx, y: wy };
      bd.eraseAt(ps, wx, wy);
      break;
    case 'laser':
      ps.laser!.pts.push([wx, wy]);
      break;
    case 'measure':
      ps.live = bd.angleAround(wx, wy) ?? undefined;
      break;
    case 'lasso':
      ps.lasso!.push([wx, wy]);
      break;
    case 'rotate':
      if (ps.tap && bd.rotStill(ps, wx, wy)) break;
      ps.tap = false;
      ps.preview = rotateItem(ps.orig!, ps.start![0], ps.start![1], bd.rotAngle(ps, wx, wy));
      break;
    case 'grotate': {
      if (ps.tap && bd.rotStill(ps, wx, wy)) break;
      ps.tap = false;
      const ang = bd.rotAngle(ps, wx, wy);
      const ids = ps.ids!;
      bd.page.items = ps.before!.map((it) => (ids.has(it.id) ? rotateItem(it, ps.start![0], ps.start![1], ang) : it));
      ps.changed = true;
      bd.redraw();
      break;
    }
    case 'gmove':
    case 'gresize': {
      const dx = wx - ps.start![0];
      const dy = wy - ps.start![1];
      const b = ps.gb!;
      const f = Math.max(0.1, (b.x1 - b.x0 + dx) / Math.max(b.x1 - b.x0, 1));
      const ids = ps.ids!;
      const move = ps.mode === 'gmove';
      bd.page.items = ps.before!.map((it) => (!ids.has(it.id) ? it : move ? translateItem(it, dx, dy) : scaleItem(it, b.x0, b.y0, f)));
      ps.changed = true;
      bd.redraw();
      break;
    }
    case 'pan': {
      const v = bd.page.view;
      v.x = ps.v0!.x + (e.clientX - ps.start![0]);
      v.y = ps.v0!.y + (e.clientY - ps.start![1]);
      bd.redraw();
      break;
    }
    case 'osc': {
      const o = bd.oscDrag;
      const it = o && bd.page.items.find((x) => x.id === o.id);
      const g = it && it.kind === 'stamp' ? STAMPS[it.name]?.spring?.(it.w, it.h) : undefined;
      if (o && g && it) {
        // σε στραμμένο ελατήριο η μετατόπιση μετριέται πάνω στον δικό του άξονα
        const [ax, ay] = unrot(it, ps.start![0], ps.start![1]), [bx, by] = unrot(it, wx, wy);
        o.d = Math.max(-g.max, Math.min(g.max, (o.d0 ?? 0) + (bx - ax) * g.ux + (by - ay) * g.uy));
      }
      break;
    }
    case 'kid': {
      const cur = bd.page.items.find((x) => x.id === ps.kidOrig?.id);
      if (cur && cur.kind === 'stamp' && bd.kidPaint(ps, cur, wx, wy, false)) bd.redraw();
      return;
    }
    case 'move': {
      const dx = wx - ps.start![0];
      const dy = wy - ps.start![1];
      const o = ps.orig!;
      ps.preview = translateItem(o, dx, dy);
      break;
    }
    case 'resize': {
      const o = ps.orig!;
      const dx = wx - ps.start![0];
      const dy = wy - ps.start![1];
      if (o.kind === 'image' || o.kind === 'stamp') {
        const nw = Math.max(40, o.w + dx);
        ps.preview = { ...o, w: nw, h: (nw * o.h) / o.w };
      } else if (o.kind === 'text') {
        // η λαβή μεγαλώνει τα γράμματα, όσο τραβιέται το πλάτος
        const b = itemBounds(o);
        const w = Math.max(1, b.x1 - b.x0);
        ps.preview = { ...o, size: Math.max(8, Math.min(1200, (o.size * (w + dx)) / w)) };
      } else if (o.kind === 'trig') {
        if (ps.handle === 1) {
          // ακέραιες μοίρες· κοντά σε πολλαπλάσια των 15° «κουμπώνει»
          let deg = Math.round((Math.atan2(o.y - wy, wx - o.x) * 180) / Math.PI);
          const near = Math.round(deg / 15) * 15;
          if (Math.abs(near - deg) <= 2) deg = near;
          ps.preview = { ...o, a: (((deg % 360) + 360) % 360) * (Math.PI / 180) };
        } else {
          ps.preview = { ...o, r: Math.max(60, o.r + dx / 1.28) };
        }
      } else if (o.kind === 'shape') {
        const fx = o.x1 >= o.x0;
        const fy = o.y1 >= o.y0;
        ps.preview = reboxShape(
          o,
          fx ? o.x0 : o.x0 + dx, fy ? o.y0 : o.y0 + dy,
          fx ? o.x1 + dx : o.x1, fy ? o.y1 + dy : o.y1,
        );
      } else if (o.kind === 'axes' && ps.handle) {
        const key = bd.r.axesHandles(o)[ps.handle - 1]?.k;
        if (key) ps.preview = bd.r.moveAxesHandle(o, key, (wx - o.x) / o.unit);
      } else if (o.kind === 'axes') {
        const b = itemBounds(o);
        const f = Math.max(0.3, (b.x1 - b.x0 + dx) / (b.x1 - b.x0));
        const scaled: AxesItem = { ...o, unit: Math.max(12, o.unit * f) };
        const nb = itemBounds(scaled);
        ps.preview = { ...scaled, x: scaled.x + b.x0 - nb.x0, y: scaled.y + b.y0 - nb.y0 };
      } else if (o.kind === 'angle') {
        const ang = roundAngle(Math.atan2(wy - o.y, wx - o.x));
        const len = Math.max(20, Math.hypot(wx - o.x, wy - o.y));
        ps.preview = ps.handle === 1 ? { ...o, a1: ang, len1: len } : { ...o, a2: ang, len2: len };
      }
      break;
    }
  }
}

export function up(bd: Board, e: PointerEvent): void {
  const ps = bd.ptrs.get(e.pointerId);
  if (!ps) return;
  bd.ptrs.delete(e.pointerId);
  bd.onPointerInfo(e, bd.ptrs.size);

  if (bd.gesture?.twist) {
    const t = bd.gesture.twist;
    if (touchPts(bd).size >= 2) {
      // σηκώθηκε ένα δάχτυλο αλλά το χέρι είναι ακόμα πάνω: συνεχίζει από εκεί που ήταν
      t.p0.set(ps.id, t.p0.get(ps.id) ?? [ps.x, ps.y]);
      bd.ptrs.set(ps.id, ps);
      t.acc += twistAngle(bd, t);
      bd.ptrs.delete(ps.id);
      t.p0 = touchPts(bd);
      return;
    }
    if (t.changed) bd.push({ t: 'set', p: bd.cur, before: t.before, after: bd.page.items.slice() });
    bd.gesture = null;
    bd.redraw();
    bd.onUi();
    bd.onChange();
    return;
  }
  if (bd.gesture && (bd.gesture.a === e.pointerId || bd.gesture.b === e.pointerId)) {
    bd.gesture = null;
    bd.onChange();
    return;
  }

  switch (ps.mode) {
    case 'gadget':
      if (!ps.stroke || ps.stroke.pts.length < 2) break;
    case 'draw':
    case 'shape': {
      clearTimeout(ps.timer);
      const s: Item = ps.live ?? ps.stroke!;
      if (ps.mode === 'shape' && ps.live) {
        const l = ps.live;
        const len = l.kind === 'angle' ? l.len2 : Math.hypot(l.x1 - l.x0, l.y1 - l.y0);
        if (len < (l.kind === 'angle' ? 20 : 4) / bd.page.view.k) break;
      }
      bd.page.items.push(s);
      bd.push({ t: 'add', p: bd.cur, item: s });
      if (ps.mode === 'draw' && s.kind === 'stroke' && !s.hl) bd.onStroke(s);
      const c = bd.bctx;
      c.save();
      bd.setWorldTransform(c);
      bd.r.drawItem(c, s);
      if (s.kind === 'shape' && s.meas) bd.r.drawMeasures(c, s);
      c.restore();
      break;
    }
    case 'erase':
      if (ps.changed && ps.before) {
        bd.push({ t: 'set', p: bd.cur, before: ps.before, after: bd.page.items.slice() });
      }
      bd.eraserAt = null;
      break;
    case 'pan':
      bd.onChange();
      break;
    case 'laser':
      ps.laser!.t = performance.now();
      bd.fadeLasers();
      break;
    case 'measure': {
      const m = ps.live;
      // η ίδια γωνία δεν μετριέται δεύτερη φορά
      const dup = m && m.kind === 'angle' && bd.page.items.some((x) => x.kind === 'angle' && x.arc
        && Math.hypot(x.x - m.x, x.y - m.y) < 2 && Math.abs(x.a1 - m.a1) < 0.01 && Math.abs(x.a2 - m.a2) < 0.01);
      if (m && !dup) {
        bd.page.items.push(m);
        bd.push({ t: 'add', p: bd.cur, item: m });
        bd.redraw();
        return;
      }
      break;
    }
    case 'lasso': {
      const poly = ps.lasso!;
      const xs = poly.map((q) => q[0]), ys = poly.map((q) => q[1]);
      const ext = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      if (ext < 12 / bd.page.view.k) {
        bd.selected = ps.tapHit ?? null;
      } else {
        const ids = bd.page.items.filter((it) => inLasso(it, poly)).map((it) => it.id);
        bd.selected = ids.length === 1 ? ids[0] : null;
        bd.multi = ids.length > 1 ? ids : [];
        bd.region = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
      }
      bd.onUi();
      break;
    }
    case 'gmove':
    case 'gresize':
    case 'grotate':
      if (ps.mode === 'grotate' && ps.tap) {
        const gb = bd.groupBounds();
        if (gb) bd.nextPivot(gb);
      } else if (bd.pivot && ps.changed && ps.mode !== 'grotate') {
        // η ομάδα μετακινήθηκε: το κέντρο περιστροφής πάει μαζί της· αν άλλαξε μέγεθος, ξαναγίνεται το κέντρο της
        const gb = bd.groupBounds();
        if (ps.mode === 'gmove' && gb && ps.gb) bd.pivot = { ...bd.pivot, p: [bd.pivot.p[0] + gb.x0 - ps.gb.x0, bd.pivot.p[1] + gb.y0 - ps.gb.y0] };
        else bd.pivot = null;
      }
      if (ps.changed && ps.before) {
        bd.push({ t: 'set', p: bd.cur, before: ps.before, after: bd.page.items.slice() });
      }
      bd.redraw();
      return;
    case 'kid': {
      const before = ps.kidOrig!;
      let after = bd.page.items.find((x) => x.id === before.id);
      if (after && after !== before && after.kind === 'stamp') {
        // το εργαλείο μπορεί να «κλείσει» την κίνηση (π.χ. το ρολόι: βρέθηκε η ώρα της άσκησης)
        const d = STAMPS[after.name], end = d?.drop?.(after.v ?? []);
        if (end) {
          const done = { ...after, v: end.v };
          bd.page.items[bd.page.items.indexOf(after)] = done;
          // με δική του κίνηση (αριθμοκυβάκια: ένωση) κινείται και στο άφημα
          if (d.animMs) bd.kidChanged(done, after.v ?? [], end.ev);
          else bd.onKidFx(end.ev, done);
          after = done;
        }
      }
      if (after && after !== before) bd.push({ t: 'mod', p: bd.cur, before, after });
      ps.kidOrig = undefined;
      bd.redraw();
      bd.onUi();
      return;
    }
    case 'osc': {
      const o = bd.oscDrag;
      bd.oscDrag = null;
      // ένα απλό άγγιγμα (χωρίς τράβηγμα) απλώς σταματά το σώμα
      if (o && Math.abs(o.d) > 3 && Math.abs(o.d - (o.d0 ?? 0)) > 3) {
        bd.osc.set(o.id, { amp: o.d, t0: performance.now() });
        bd.runOsc();
      }
      bd.redraw();
      bd.onUi();
      return;
    }
    case 'move':
    case 'rotate':
    case 'resize': {
      const before = ps.orig!;
      const after = ps.preview!;
      if (ps.mode === 'rotate' && ps.tap) bd.nextPivot(itemBounds(before), before);
      const i = bd.page.items.findIndex((x) => x.id === before.id);
      // πάτημα (χωρίς σύρσιμο) πάνω σε εργαλείο του Δημοτικού: αλλάζει η κατάστασή του
      if (i >= 0 && ps.mode === 'move' && before.kind === 'stamp' && (bd.tapKid(before, after, ps.start!) || (ps.wasSel && bd.tapStampText(before, after, ps.start!)))) {
        ps.orig = undefined;
        ps.preview = undefined;
        bd.redraw();
        return;
      }
      if (i >= 0 && ps.mode === 'move' && after.kind === 'axes' && after !== before && bd.mergeAxes(before as AxesItem, after)) {
        ps.orig = undefined;
        ps.preview = undefined;
        bd.redraw();
        bd.onUi();
        return;
      }
      if (i >= 0 && after !== before) {
        bd.page.items[i] = after;
        bd.push({ t: 'mod', p: bd.cur, before, after });
      }
      ps.orig = undefined;
      ps.preview = undefined;
      bd.redraw();
      return;
    }
  }
  bd.renderLive();
}
