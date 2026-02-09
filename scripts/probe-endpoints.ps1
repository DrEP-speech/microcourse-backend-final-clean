<# scripts/probe-endpoints.ps1
   Probes key endpoints and prints StatusCodes.
   Interprets 401 as "route exists but protected" (GOOD).
#>
param(
  [Parameter(Mandatory=$false)]
  [string]$Base = "http://localhost:4000"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$paths = @(
  "/health",
  "/api",                       # often 200/404 depending on app
  "/api/auth/login",            # POST endpoint (GET may be 404)
  "/api/auth/register",         # POST endpoint (GET may be 404)
  "/api/courses/public",        # SHOULD be public if you support public catalog
  "/api/courses",               # often 401 without token (GOOD)
  "/api/quizzes",               # often 401 without token (GOOD)
  "/api/analytics/student/overview"  # often 401 without token (GOOD)
)

Write-Host "🔎 Probing $Base ..." -ForegroundColor Cyan

foreach ($p in $paths) {
  $url = "$Base$p"
  try {
    $r = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 5 -SkipHttpErrorCheck
    $code = [int]$r.StatusCode
    $note = switch ($code) {
      200 { "OK" }
      401 { "PROTECTED (good)" }
      404 { "NOT FOUND" }
      default { "HTTP $code" }
    }
    "{0,-35} {1,4}  {2}" -f $p, $code, $note
  } catch {
    "{0,-35} ERR   {1}" -f $p, $_.Exception.Message
  }
}

Write-Host ""
Write-Host "ℹ️  Note: /api/auth/login & /api/auth/register are typically POST-only, so GET may be 404 (fine)." -ForegroundColor DarkGray