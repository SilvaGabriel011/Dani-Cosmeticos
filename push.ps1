# Script de Push para Git
param(
    [string]$message = "update"
)

Write-Host "`n>> Iniciando push..." -ForegroundColor Cyan

git add .

if ($message -eq "update") {
    $timestamp = Get-Date -Format "dd/MM/yyyy HH:mm"
    $message = "update: $timestamp"
}

Write-Host ">> Commit: $message" -ForegroundColor Yellow
git commit -m "$message"

Write-Host ">> Enviando para origin..." -ForegroundColor Yellow
git push

Write-Host "`n>> Push concluido!" -ForegroundColor Green
