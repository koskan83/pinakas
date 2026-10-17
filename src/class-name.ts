/** Τα ονόματα των αρχείων και των φακέλων ανά τμήμα (βλ. class-files.ts): ίδια σε υπολογιστή, Android και Drive. */

/** Όνομα που επιτρέπεται για αρχείο ή φάκελο (οι ημερομηνίες 17/10/2026 γίνονται 17-10-2026). */
export function safeName(s: string): string {
  return s.replace(/\//g, '-').replace(/[\\:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
}

/** «Β2 – Κλάσματα 17-10-2026.pdf»: το τμήμα μπροστά (αν δεν το έχει ήδη το όνομα) και η μέρα στο τέλος (αν δεν την έχει). */
export function classFileName(name: string, group: string | undefined, ext: string, now = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  const day = `${p(now.getDate())}-${p(now.getMonth() + 1)}-${now.getFullYear()}`;
  let base = safeName(name) || 'Μάθημα';
  const g = group ? safeName(group) : '';
  if (g && !base.toLocaleLowerCase('el').startsWith(g.toLocaleLowerCase('el'))) base = `${g} – ${base}`;
  // τα ονόματα των μαθημάτων έχουν συχνά ήδη την ημερομηνία («Β2 17/10/2026»), σε όποια μορφή
  const has = [day, `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`].some((d) => base.includes(d));
  return `${base}${has ? '' : ` ${day}`}.${ext}`;
}
