// Công cụ nội bộ: sinh hash Argon2id cho mật khẩu demo dùng trong migration seed.
// Chạy: cargo run --example gen_hash -- "MN360@2026"
use argon2::{
    password_hash::{PasswordHasher, SaltString},
    Argon2,
};
use rand_core::OsRng;

fn main() {
    let password = std::env::args().nth(1).expect("Cần truyền mật khẩu làm tham số");
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .expect("Băm mật khẩu thất bại")
        .to_string();
    println!("{hash}");
}
