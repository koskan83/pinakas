/** Όλα τα εργαλεία του Δημοτικού εκτός από τις εικόνες και τις σφραγίδες: φορτώνονται σε δικό τους κομμάτι (βλ. lazy.ts). */
import type { StampDef } from '../stamps';
import { BUILD_KIDS } from './build';
import { FRACTION_KIDS } from './fractions';
import { GAME_KIDS } from './games';
import { HANGMAN_KIDS } from './hangman';
import { NUMBER_KIDS } from './numbers';
import { NUMCUBE_KIDS } from './numcubes';
import { SPELL_KIDS } from './spell';

export const TOOL_KIDS: Record<string, StampDef> = {
  ...NUMBER_KIDS, ...FRACTION_KIDS, ...GAME_KIDS, ...BUILD_KIDS, ...NUMCUBE_KIDS, ...SPELL_KIDS, ...HANGMAN_KIDS,
};
