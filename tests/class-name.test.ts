import { describe, expect, it } from 'vitest';
import { classFileName, safeName } from '../src/class-name';

const day = new Date(2026, 9, 17);

describe('Ονόματα αρχείων ανά τμήμα', () => {
  it('το τμήμα μπαίνει μπροστά και η μέρα στο τέλος', () => {
    expect(classFileName('Κλάσματα', 'Β2', 'pdf', day)).toBe('Β2 – Κλάσματα 17-10-2026.pdf');
  });
  it('δεν διπλασιάζει τμήμα ή μέρα που έχει ήδη το όνομα του μαθήματος', () => {
    expect(classFileName('Β2 17/10/2026', 'Β2', 'json', day)).toBe('Β2 17-10-2026.json');
    expect(classFileName('β2 εξισώσεις', 'Β2', 'pdf', day)).toBe('β2 εξισώσεις 17-10-2026.pdf');
  });
  it('χωρίς τμήμα, μόνο το όνομα και η μέρα', () => {
    expect(classFileName('Πρόχειρο', undefined, 'png', day)).toBe('Πρόχειρο 17-10-2026.png');
    expect(classFileName('  ', undefined, 'pdf', day)).toBe('Μάθημα 17-10-2026.pdf');
  });
  it('χωρίς χαρακτήρες που δεν δέχονται τα Windows', () => {
    expect(safeName('Α/Β: «τι;» *ok* <x>|?')).toBe('Α-Β_ «τι;» _ok_ _x___');
    expect(classFileName('Γ1/Γ2', 'Γ1/Γ2', 'pdf', day)).toBe('Γ1-Γ2 17-10-2026.pdf');
  });
});
