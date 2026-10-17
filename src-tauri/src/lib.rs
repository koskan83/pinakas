use std::io::Cursor;
use std::time::Duration;

use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;
use xcap::Monitor;

/// Στιγμιότυπο της οθόνης στην οποία βρίσκεται το παράθυρο.
/// Το παράθυρο κρύβεται προσωρινά ώστε να φαίνεται ό,τι είναι από πίσω του.
#[tauri::command]
async fn capture_screen(window: WebviewWindow) -> Result<Response, String> {
    let center = window
        .outer_position()
        .ok()
        .zip(window.outer_size().ok())
        .map(|(p, s)| (p.x + s.width as i32 / 2, p.y + s.height as i32 / 2));

    window.hide().map_err(|e| e.to_string())?;
    let shot = tauri::async_runtime::spawn_blocking(move || -> Result<Vec<u8>, String> {
        // περιμένουμε να ολοκληρωθεί η απόκρυψη του παραθύρου
        std::thread::sleep(Duration::from_millis(400));
        let monitor = center
            .and_then(|(x, y)| Monitor::from_point(x, y).ok())
            .or_else(|| Monitor::all().ok().and_then(|m| m.into_iter().next()))
            .ok_or_else(|| "Δεν βρέθηκε οθόνη".to_string())?;
        let img = monitor.capture_image().map_err(|e| e.to_string())?;
        let mut png = Vec::new();
        image::DynamicImage::ImageRgba8(img)
            .write_to(&mut Cursor::new(&mut png), image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;
        Ok(png)
    })
    .await
    .map_err(|e| e.to_string());

    let _ = window.show();
    let _ = window.set_focus();
    Ok(Response::new(shot??))
}

/// Αποθήκευση αρχείου με παράθυρο «Αποθήκευση ως». Τα bytes έρχονται ως raw body,
/// το προτεινόμενο όνομα στην κεφαλίδα `x-file-name`. Επιστρέφει false αν ο χρήστης ακύρωσε.
#[tauri::command]
async fn save_file(app: AppHandle, request: Request<'_>) -> Result<bool, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Αναμένονταν δυαδικά δεδομένα".into());
    };
    let name = request
        .headers()
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("pinakas")
        .to_string();
    let ext = name.rsplit('.').next().unwrap_or("").to_string();

    let mut dialog = app.dialog().file().set_file_name(&name);
    if !ext.is_empty() && ext != name {
        dialog = dialog.add_filter(ext.to_uppercase(), &[ext.as_str()]);
    }
    let Some(path) = dialog.blocking_save_file() else {
        return Ok(false);
    };
    let path = path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(path, bytes).map_err(|e| e.to_string())?;
    Ok(true)
}

/// Αποκωδικοποίηση «percent-encoding» (οι κεφαλίδες μεταφέρουν μόνο ASCII, τα ονόματα είναι ελληνικά).
fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Some(v) = std::str::from_utf8(&b[i + 1..i + 3]).ok().and_then(|h| u8::from_str_radix(h, 16).ok()) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Όνομα αρχείου ή φακέλου χωρίς διαδρομές και χαρακτήρες που δεν επιτρέπουν τα Windows.
fn safe_part(s: &str) -> String {
    let cleaned: String = s
        .chars()
        .map(|c| if matches!(c, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|') || c.is_control() { '_' } else { c })
        .collect();
    cleaned.trim().trim_matches('.').to_string()
}

/// Αποθήκευση χωρίς ερώτηση στο «Έγγραφα\PrismaBoard\<φάκελος>» (φάκελος ανά τμήμα).
/// Τα bytes ως raw body· όνομα και φάκελος στις κεφαλίδες `x-file-name` και `x-folder`. Επιστρέφει τη διαδρομή του αρχείου.
#[tauri::command]
async fn save_in_folder(app: AppHandle, request: Request<'_>) -> Result<String, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Αναμένονταν δυαδικά δεδομένα".into());
    };
    let header = |k: &str| request.headers().get(k).and_then(|v| v.to_str().ok()).map(percent_decode).unwrap_or_default();
    let name = safe_part(&header("x-file-name"));
    if name.is_empty() {
        return Err("Χωρίς όνομα αρχείου".into());
    }
    let folder = safe_part(&header("x-folder"));
    let mut dir = app.path().document_dir().map_err(|e| e.to_string())?.join("PrismaBoard");
    if !folder.is_empty() {
        dir = dir.join(folder);
    }
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(name);
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

/// Ανοίγει την Εξερεύνηση αρχείων στον φάκελο, με το αρχείο επιλεγμένο.
#[tauri::command]
fn show_file(path: String) -> Result<(), String> {
    #[cfg(windows)]
    std::process::Command::new("explorer").arg(format!("/select,{path}")).spawn().map_err(|e| e.to_string())?;
    #[cfg(not(windows))]
    std::process::Command::new("xdg-open")
        .arg(std::path::Path::new(&path).parent().unwrap_or(std::path::Path::new(".")))
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Ανοίγει διαφανές παράθυρο πάνω από όλα τα προγράμματα, για γράψιμο πάνω τους,
/// και ελαχιστοποιεί τον κύριο πίνακα.
#[tauri::command]
async fn open_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("overlay") {
        return w.set_focus().map_err(|e| e.to_string());
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.minimize();
    }
    WebviewWindowBuilder::new(&app, "overlay", WebviewUrl::App("index.html".into()))
        .title("PrismaBoard – γράψιμο πάνω από την οθόνη")
        .initialization_script("window.__GRAFIDA_OVERLAY__ = true;")
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .fullscreen(true)
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Κλείνει το διαφανές παράθυρο και επαναφέρει τον πίνακα.
#[tauri::command]
async fn close_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("overlay") {
        w.close().map_err(|e| e.to_string())?;
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.unminimize();
        let _ = main.set_focus();
    }
    Ok(())
}

/// «Έξοδος» από το μενού: κλείνει όλη την εφαρμογή (και το διαφανές παράθυρο, αν είναι ανοιχτό).
#[tauri::command]
fn exit_app(app: AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![capture_screen, save_file, open_overlay, close_overlay, exit_app, save_in_folder, show_file])
        .run(tauri::generate_context!())
        .expect("σφάλμα κατά την εκκίνηση της εφαρμογής");
}
