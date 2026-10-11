# PrismaBoard

Διαδραστικός πίνακας για γραφίδα, αφή και ποντίκι (BenQ Board, Windows, browser).

## Ανάπτυξη (browser)

```bash
npm install
npm run dev
```

Άνοιγμα στο `http://localhost:5173`. Από άλλη συσκευή του ίδιου δικτύου (π.χ. τον πίνακα): `http://<IP-υπολογιστή>:5173`.

`npm run build` βγάζει στατικά αρχεία στον φάκελο `dist/`.

## Εφαρμογή Windows

Ο φάκελος `src-tauri/` τυλίγει την ίδια εφαρμογή σε πρόγραμμα Windows (Tauri) και προσθέτει
στιγμιότυπο ολόκληρης της οθόνης και παράθυρο «Αποθήκευση ως».

- **GitHub Actions:** το workflow «Windows installer» χτίζει το πρόγραμμα εγκατάστασης. Τρέχει χειροκίνητα
  από την καρτέλα Actions ή αυτόματα σε κάθε tag `v*`. Το `.exe` κατεβαίνει από τα Artifacts της εκτέλεσης.
- **Σε Windows PC:** με εγκατεστημένα Node, Rust και Visual Studio Build Tools, `npm run app:build`.

## Δομή

| Αρχείο | Ρόλος |
|---|---|
| `src/model.ts` | Τύποι δεδομένων, γεωμετρία, αναγνώριση σχημάτων |
| `src/board.ts` | Καμβάς, είσοδος γραφίδας/αφής, αναίρεση, σελίδες |
| `src/gadgets.ts` | Χάρακας, μοιρογνωμόνιο, διαβήτης |
| `src/timer.ts` | Χρονόμετρο |
| `src/importers.ts` | Εισαγωγή PDF, εικόνας, στιγμιότυπου |
| `src/native.ts` | Γέφυρα προς την εφαρμογή Windows |
| `src/main.ts` | Γραμμή εργαλείων και μενού |
