use glob;
use std::path::Path;

#[tauri::command]
fn get_dir(path: &str) -> String {
    match Path::new(path).parent() {
        Some(dir) => dir.to_str().unwrap_or("").to_string(),
        None => String::new(),
    }
}

#[tauri::command]
fn join_path(dir_path: &str, file_name: &str) -> String {
    let path = Path::new(dir_path).join(file_name);
    path.to_str().unwrap_or("").to_string()
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn get_list_file_names(setting_dir_path: &str) -> Vec<String> {
    let mut ret: Vec<String> = vec![];
    let mut s = String::from(setting_dir_path);
    s.push_str("/*.list");
    if let Ok(path) = glob::glob(&s) {
        for entry in path {
            match entry {
                Ok(pathbuf) => {
                    ret.push(pathbuf.to_string_lossy().to_string());
                }
                Err(_) => {
                    // pass
                }
            }
        }
    } else {
        // pass
    }

    return ret;
}

#[tauri::command]
fn get_table_file_names(setting_dir_path: &str) -> Vec<String> {
    let mut ret: Vec<String> = vec![];
    let mut s = String::from(setting_dir_path);
    s.push_str("/*.table");
    if let Ok(path) = glob::glob(&s) {
        for entry in path {
            match entry {
                Ok(pathbuf) => {
                    ret.push(pathbuf.to_string_lossy().to_string());
                }
                Err(_) => {
                    // pass
                }
            }
        }
    } else {
        // pass
    }

    return ret;
}


#[tauri::command]
fn get_file_name_from_path(path: &str) -> String {
    let path = Path::new(path);
    let mut s: String = String::from("");
    if let Some(file_name) = path.file_name() {
        if let Some(file_name_str) = file_name.to_str() {
            s = String::from(file_name_str);
        } else {
        }
    } else {

    }
    s
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_list_file_names,
            get_table_file_names,
            get_dir,
            join_path,
            get_file_name_from_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
