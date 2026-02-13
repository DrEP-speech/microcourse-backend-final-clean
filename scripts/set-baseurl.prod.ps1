param(
  [string]$BaseUrl = "https://microcourse-backend-final-clean.onrender.com"
)

$env:BASE_URL = $BaseUrl.TrimEnd("/")
Write-Host "BASE_URL set to $env:BASE_URL" -ForegroundColor Green
