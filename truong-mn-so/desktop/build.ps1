# Đóng gói bản cài trên máy cá nhân: PyInstaller → desktop\dist\TruongMNSo, rồi Inno Setup → desktop\Output\*.exe
# Chạy trong thư mục truong-mn-so:  powershell -ExecutionPolicy Bypass -File desktop\build.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

& .\.venv\Scripts\python.exe -m pip install --quiet pyinstaller
& .\.venv\Scripts\python.exe -m PyInstaller desktop\truong-mn-so.spec --noconfirm --distpath desktop\dist --workpath desktop\build
if ($LASTEXITCODE -ne 0) { throw 'PyInstaller lỗi' }

$iscc = @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw 'Chưa cài Inno Setup 6 (https://jrsoftware.org/isdl.php)' }
& $iscc desktop\installer.iss
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup lỗi' }
Get-ChildItem desktop\Output\*.exe | Select-Object Name, @{n='MB';e={[math]::Round($_.Length / 1MB)}}
