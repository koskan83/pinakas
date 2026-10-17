import { describe, expect, it } from 'vitest';
import { KID_CATALOG } from '../src/kids/catalog';
import { TOOL_KIDS } from '../src/kids/tools';
import { KIDS, kidsReady, loadKids } from '../src/kids/lazy';

const METHODS = ['tap', 'ask', 'paint', 'drop', 'fx', 'cursor', 'fullAt'] as const;

describe('Εργαλεία Δημοτικού που φορτώνονται αργότερα', () => {
  it('ο κατάλογος έχει ακριβώς τα εργαλεία, με το ίδιο όνομα, μέγεθος, αρχική κατάσταση και μεθόδους', () => {
    expect(Object.keys(KID_CATALOG).sort()).toEqual(Object.keys(TOOL_KIDS).sort());
    for (const [k, d] of Object.entries(TOOL_KIDS)) {
      const m = KID_CATALOG[k];
      expect({ k, label: m.label, w: m.w, h: m.h, init: m.init, big: m.big, cheer: m.cheer, animMs: m.animMs, hidden: m.hidden })
        .toEqual({ k, label: d.label, w: d.w, h: d.h, init: d.init, big: d.big, cheer: d.cheer, animMs: d.animMs, hidden: d.hidden });
      expect([k, m.has]).toEqual([k, METHODS.filter((f) => typeof d[f] === 'function').join(' ')]);
    }
  });

  it('πριν φτάσουν, οι θέσεις δεν κάνουν τίποτα· μετά γεμίζουν επί τόπου με τα αληθινά', async () => {
    const before = KIDS.numcubes;
    expect(before.paint!([], 0, 0, 10, 10, {}, true)).toBeNull();
    expect(KIDS.dice.tap!([5], 75, 75, 150, 150)).toBeNull();
    await loadKids();
    expect(kidsReady()).toBe(true);
    expect(KIDS.numcubes).toBe(before);
    expect(KIDS.numcubes.drawKid).toBe(TOOL_KIDS.numcubes.drawKid);
    expect(KIDS.dice.tap!([5], 75, 75, 150, 150)).not.toBeNull();
  });
});
