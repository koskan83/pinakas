/**
 * Ο κατάλογος των εργαλείων του Δημοτικού που φορτώνονται αργότερα (βλ. lazy.ts): ό,τι χρειάζεται ο πίνακας πριν φτάσει ο κώδικάς τους.
 * Ένα test (tests/kids-catalog.test.ts) ελέγχει ότι συμφωνεί με τα ίδια τα εργαλεία· αν αλλάξει κάτι εκεί, αλλάζει κι εδώ.
 * `has`: ποιες προαιρετικές μέθοδοι υπάρχουν (tap, ask, paint, drop, fx, cursor, fullAt).
 */
export interface KidMeta { label: string; w: number; h: number; init?: number[]; big?: boolean; cheer?: boolean; animMs?: number; hidden?: boolean; has: string }

export const KID_CATALOG: Record<string, KidMeta> = {
  numline: { label: 'Αριθμογραμμή', w: 760, h: 120, init: [0], has: 'tap' },
  clock: { label: 'Ρολόι', w: 320, h: 390, init: [185, 1], has: 'tap paint drop' },
  blocks: { label: 'Εκατοντάδες, δεκάδες, μονάδες', w: 620, h: 400, init: [234, 1], has: 'tap' },
  money: { label: 'Χρήματα', w: 640, h: 360, init: [1, 0, 0, 0, 0, 0, 0, 0, 0], has: 'tap' },
  hundred: { label: 'Πίνακας του 100', w: 500, h: 500, init: [0, 0, 0, 0], has: 'tap' },
  times: { label: 'Προπαίδεια', w: 520, h: 520, init: [0, 0, 0, 0], has: 'tap fx' },
  colops: { label: 'Κάθετη πράξη', w: 320, h: 300, has: '' },
  fracpie: { label: 'Κλάσμα: πίτα', w: 280, h: 370, init: [4, 0], has: 'tap fx' },
  fracbar: { label: 'Κλάσμα: μπάρα', w: 560, h: 170, init: [4, 0], has: 'tap fx' },
  fracpizza: { label: 'Κλάσμα: πίτσα', w: 280, h: 370, init: [4, 0, 1], has: 'tap fx' },
  fracchoc: { label: 'Κλάσμα: σοκολάτα', w: 560, h: 170, init: [4, 0, 1], has: 'tap fx' },
  dice: { label: 'Ζάρι', w: 150, h: 150, init: [5], has: 'tap fx' },
  lottery: { label: 'Κλήρωση', w: 240, h: 270, init: [0, 25], has: 'tap fx' },
  poll: { label: 'Ψηφοφορία', w: 560, h: 380, init: [4, 0, 0, 0, 0, 0, 0], has: 'tap fx' },
  balance: { label: 'Ζυγαριά', w: 660, h: 430, init: [1, 0], has: 'tap fx' },
  build: { label: 'Χτίσιμο με κυβάκια', w: 960, h: 640, init: [0], has: 'paint fx fullAt' },
  numcubes: { label: 'Αριθμοκυβάκια', w: 960, h: 640, init: [0, 0, 0, 55, 130, 1, 1, 0, 0, 0, 100, 130, 2, 2, 0, 0, 0, 145, 130, 3, 3, 0, 0, 0, 190, 130, 4, 4, 0, 0, 0, 235, 130, 5, 5, 0, 0, 0], animMs: 2000, has: 'paint drop fx cursor fullAt' },
  spell: { label: 'Ορθογραφία', w: 900, h: 660, init: [0, 0], big: true, animMs: 16000, has: 'tap ask fx' },
  hangman: { label: 'Κρεμάλα', w: 800, h: 480, init: [0], has: 'tap ask fx' },
};
