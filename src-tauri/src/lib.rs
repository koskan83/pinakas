use std::io::Cursor;
use std::time::Duration;

use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, WebviewWindow};
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![capture_screen, save_file])
        .run(tauri::generate_context!())
        .expect("σφάλμα κατά την εκκίνηση της εφαρμογής");
}
