// Sobe o backend (Python compilado pelo Nuitka, empacotado como sidecar) junto
// com a janela do app, e encerra o processo quando a janela fecha.
//
// O binário do backend precisa estar em:
//   src-tauri/binaries/granae-backend-<target-triple>(.exe)
// (gerado por build/build_backend.ps1 — ver README do projeto.)

use tauri::Manager;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let shell = app.shell();
            let sidecar = shell
                .sidecar("granae-backend")
                .expect("não foi possível localizar o sidecar do backend (granae-backend)");

            let (mut rx, child) = sidecar.spawn().expect("falha ao iniciar o backend");

            // Mantém o processo vivo no estado do app para poder matá-lo ao fechar.
            app.manage(std::sync::Mutex::new(Some(child)));

            // Loga a saída do backend no console do app (útil para depuração).
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            print!("[backend] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            eprint!("[backend] {}", String::from_utf8_lossy(&line));
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Some(state) = window
                    .app_handle()
                    .try_state::<std::sync::Mutex<Option<tauri_plugin_shell::process::CommandChild>>>()
                {
                    if let Ok(mut guard) = state.lock() {
                        if let Some(child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
