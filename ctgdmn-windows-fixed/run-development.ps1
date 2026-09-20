$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path (Join-Path $PSScriptRoot "node_modules"))) {
    Write-Host "Đang cài thư viện lần đầu..." -ForegroundColor Cyan
    npm ci
}

Write-Host "Đang mở ứng dụng CTGDMN ở chế độ thử nghiệm..." -ForegroundColor Cyan
npm start
