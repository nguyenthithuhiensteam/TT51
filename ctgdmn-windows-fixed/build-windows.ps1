$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Chưa tìm thấy Node.js. Hãy cài Node.js LTS rồi chạy lại tệp này."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "Chưa tìm thấy npm. Hãy cài đầy đủ Node.js rồi chạy lại."
}

Write-Host "[1/4] Cài thư viện đúng theo package-lock.json..." -ForegroundColor Cyan
npm ci

Write-Host "[2/4] Kiểm thử dữ liệu và chức năng lõi..." -ForegroundColor Cyan
npm test

Write-Host "[3/4] Tạo bộ cài Windows 64-bit..." -ForegroundColor Cyan
npm run make:win

Write-Host "[4/4] Kiểm tra kết quả..." -ForegroundColor Cyan
$installers = Get-ChildItem -Path (Join-Path $PSScriptRoot "out\make") -Recurse -Filter "*.exe" -ErrorAction SilentlyContinue
if (-not $installers) {
    throw "Quá trình đóng gói kết thúc nhưng chưa tìm thấy tệp .exe trong out\make."
}

Write-Host "ĐÃ HOÀN THÀNH BỘ CÀI:" -ForegroundColor Green
$installers | ForEach-Object { Write-Host $_.FullName -ForegroundColor Green }
Write-Host "Lưu ý: bộ cài thử nghiệm chưa ký số nên Windows SmartScreen có thể yêu cầu xác nhận khi mở." -ForegroundColor Yellow
