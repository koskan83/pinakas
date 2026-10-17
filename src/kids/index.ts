/**
 * Εργαλεία για το Δημοτικό: αριθμογραμμή, κλάσματα, ρολόι, υλικό δεκάδων, χρήματα, πίνακας του 100, προπαίδεια,
 * ζάρι, κλήρωση, ζυγαριά και σφραγίδες επιβράβευσης. Κάθε εργαλείο ζωγραφίζεται μέσα σε κουτί w × h από την κατάστασή του
 * (λίστα αριθμών `v`) και αλλάζει με πάτημα: η `tap` επιστρέφει τη νέα κατάσταση, ή null αν το πάτημα δεν έπεσε πουθενά.
 *
 * Κάθε ομάδα εργαλείων ζει στο δικό της αρχείο· εδώ μαζεύονται όλα στο KIDS.
 */
import type { StampDef } from '../stamps';
import { BUILD_KIDS } from './build';
import { FRACTION_KIDS } from './fractions';
import { GAME_KIDS } from './games';
import { HANGMAN_KIDS } from './hangman';
import { NUMBER_KIDS } from './numbers';
import { NUMCUBE_KIDS } from './numcubes';
import { SPELL_KIDS } from './spell';
import { STICKER_KIDS } from './stickers';

export const KIDS: Record<string, StampDef> = {
  ...NUMBER_KIDS, ...FRACTION_KIDS, ...GAME_KIDS, ...BUILD_KIDS, ...NUMCUBE_KIDS, ...SPELL_KIDS, ...HANGMAN_KIDS, ...STICKER_KIDS,
};

export type { KidEnv } from './common';
export { PICS } from './stickers';
export { monster } from './monster';
export { spellDiff, spellKeyboard } from './spell';
export { spellGame, spellList, spellNorm, spellPack, spellState, type Spell } from './spell-words';
export { hangNorm, hangStart, hangState } from './hangman';
export { ncDrop, ncPack, ncShapes, ncState, type NCState, type NCube } from './numcubes';
