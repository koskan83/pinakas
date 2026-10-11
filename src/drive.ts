/**
 * Ανέβασμα αρχείου στο Google Drive του χρήστη και κοινόχρηστος σύνδεσμος.
 * Η εφαρμογή ζητά μόνο το δικαίωμα «drive.file»: βλέπει αποκλειστικά τα αρχεία που ανέβασε η ίδια.
 * Το διακριτικό πρόσβασης μένει στη μνήμη της καρτέλας και στέλνεται μόνο σε κεφαλίδες.
 */

const KEY = 'grafida.drive';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER = 'PrismaBoard';

interface TokenResponse { access_token?: string; expires_in?: number; error?: string; error_description?: string }
interface TokenClient { requestAccessToken(o?: { prompt?: string }): void }
interface Gis {
  accounts: { oauth2: { initTokenClient(o: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type?: string; message?: string }) => void }): TokenClient } };
}

/**
 * Το «Client ID» της εφαρμογής στο Google Cloud: δημόσιο αναγνωριστικό, όχι μυστικό.
 * Όταν είναι συμπληρωμένο εδώ, κανείς δεν χρειάζεται να ρυθμίσει τίποτα· απλώς συνδέεται με τον δικό του λογαριασμό Google.
 */
const BUILT_IN_CLIENT_ID = '613162937289-dvkduc2gme21ilma0jp6u240fjke068m.apps.googleusercontent.com';

/** Αν η εφαρμογή έχει δικό της Client ID και δεν χρειάζεται ρύθμιση από τον χρήστη. */
export const driveBuiltIn = !!BUILT_IN_CLIENT_ID;

export function driveClientId(): string {
  try {
    return localStorage.getItem(KEY) || BUILT_IN_CLIENT_ID;
  } catch {
    return BUILT_IN_CLIENT_ID;
  }
}

export function setDriveClientId(id: string): void {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* χωρίς αποθήκευση */
  }
  token = null;
}

let gis: Promise<Gis> | null = null;
function loadGis(): Promise<Gis> {
  gis ??= new Promise<Gis>((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => res((window as unknown as { google: Gis }).google);
    s.onerror = () => {
      gis = null;
      rej(new Error('Δεν φορτώθηκε η σύνδεση της Google (χρειάζεται ίντερνετ)'));
    };
    document.head.append(s);
  });
  return gis;
}

let token: { value: string; until: number } | null = null;

/** Ζητά πρόσβαση (ανοίγει παράθυρο της Google την πρώτη φορά). Πρέπει να καλείται αμέσως μετά από πάτημα κουμπιού. */
export async function driveConnect(): Promise<void> {
  await getToken();
}

async function getToken(): Promise<string> {
  if (token && Date.now() < token.until) return token.value;
  const clientId = driveClientId();
  if (!clientId) throw new Error('Δεν έχει οριστεί Client ID');
  const g = await loadGis();
  return new Promise<string>((res, rej) => {
    const client = g.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => {
        if (!r.access_token) return rej(new Error(r.error_description ?? r.error ?? 'Η Google δεν έδωσε πρόσβαση'));
        token = { value: r.access_token, until: Date.now() + ((r.expires_in ?? 3600) - 60) * 1000 };
        res(r.access_token);
      },
      error_callback: (e) => rej(new Error(e.type === 'popup_closed' ? 'Το παράθυρο της Google έκλεισε' : e.type === 'popup_failed_to_open' ? 'Ο browser μπλόκαρε το παράθυρο της Google' : e.message ?? 'Αποτυχία σύνδεσης')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

async function api<T>(url: string, init: RequestInit, tk: string): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${tk}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (res.status === 401) token = null;
    throw new Error(body?.error?.message ?? `Σφάλμα ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function folderId(tk: string): Promise<string> {
  const q = `name='${FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const found = await api<{ files: { id: string }[] }>(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`, {}, tk);
  if (found.files[0]) return found.files[0].id;
  const made = await api<{ id: string }>('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
  }, tk);
  return made.id;
}

export interface Uploaded {
  /** Σύνδεσμος προβολής του αρχείου. */
  url: string;
  /** false αν ο λογαριασμός δεν επιτρέπει «όποιος έχει τον σύνδεσμο» (π.χ. σχολικός λογαριασμός). */
  shared: boolean;
}

/** Ανεβάζει το αρχείο στον φάκελο «PrismaBoard» του Drive και το κάνει ορατό σε όποιον έχει τον σύνδεσμο. */
export async function uploadToDrive(blob: Blob, name: string): Promise<Uploaded> {
  const tk = await getToken();
  const parent = await folderId(tk);
  const b = `grafida${Math.random().toString(36).slice(2)}`;
  const body = new Blob([
    `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [parent] })}\r\n--${b}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`,
    blob,
    `\r\n--${b}--`,
  ]);
  const file = await api<{ id: string }>('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { 'content-type': `multipart/related; boundary=${b}` },
    body,
  }, tk);
  let shared = true;
  try {
    await api(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    }, tk);
  } catch {
    shared = false;
  }
  return { url: `https://drive.google.com/file/d/${file.id}/view`, shared };
}
