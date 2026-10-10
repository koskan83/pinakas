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
