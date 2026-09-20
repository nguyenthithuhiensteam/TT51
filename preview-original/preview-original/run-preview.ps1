param([int]$Port = 8765)
Set-Location $PSScriptRoot
if (Get-Command python -ErrorAction SilentlyContinue) { python -m http.server $Port }
elseif (Get-Command py -ErrorAction SilentlyContinue) { py -m http.server $Port }
else { Write-Host 'Cần cài Python để chạy preview qua HTTP.'; exit 1 }
