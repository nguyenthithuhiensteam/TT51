// Ngăn cửa sổ console phụ hiện lên trên Windows khi chạy bản release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mn360_lib::run();
}
