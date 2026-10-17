/** Γέφυρα προς την εφαρμογή Windows (Tauri). Στον browser το `isNative` είναι false. */

interface TauriCore {
  invoke<T>(cmd: string, args?: unknown, options?: { headers: Record<string, string> }): Promise<T>;
}

const core = (window as unknown as { __TAURI__?: { core: TauriCore } }).__TAURI__?.core;

export const isNative = !!core;

/** Στιγμιότυπο ολόκληρης της οθόνης (το παράθυρο κρύβεται στιγμιαία). */
export async function nativeScreenshot(): Promise<Blob> {
  const buf = await core!.invoke<ArrayBuffer>('capture_screen');
  return new Blob([buf], { type: 'image/png' });
}

/** Παράθυρο «Αποθήκευση ως». Επιστρέφει false αν ο χρήστης ακύρωσε. */
export async function nativeSave(blob: Blob, name: string): Promise<boolean> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return core!.invoke<boolean>('save_file', bytes, { headers: { 'x-file-name': name } });
}

/** true όταν τρέχουμε στο διαφανές παράθυρο «γράψιμο πάνω από άλλα προγράμματα». */
export const isOverlay = !!(window as unknown as { __GRAFIDA_OVERLAY__?: boolean }).__GRAFIDA_OVERLAY__;

/** Ανοίγει διαφανές παράθυρο πάνω από όλα και ελαχιστοποιεί τον πίνακα. */
export function openOverlay(): Promise<void> {
  return core!.invoke<void>('open_overlay');
}

export function closeOverlay(): Promise<void> {
  return core!.invoke<void>('close_overlay');
}

/** Κλείνει την εφαρμογή των Windows. */
export function nativeExit(): Promise<void> {
  return core!.invoke<void>('exit_app');
}

/** Σώζει κατευθείαν στο «Έγγραφα\PrismaBoard\<φάκελος>» χωρίς ερώτηση· επιστρέφει πού γράφτηκε. */
export async function nativeSaveIn(folder: string, blob: Blob, name: string): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return core!.invoke<string>('save_in_folder', bytes, { headers: { 'x-file-name': encodeURIComponent(name), 'x-folder': encodeURIComponent(folder) } });
}

/** Ανοίγει τον φάκελο στην Εξερεύνηση αρχείων, με το αρχείο επιλεγμένο. */
export function nativeShowFile(path: string): Promise<void> {
  return core!.invoke<void>('show_file', { path });
}
