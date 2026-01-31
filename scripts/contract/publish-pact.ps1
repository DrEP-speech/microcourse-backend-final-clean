# scripts/contract/publish-pact.ps1
# Stub: publish pact files to broker later (once provider/consumer pacts exist).
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$BrokerBaseUrl = $env:PACT_BROKER_BASE_URL
if (-not $BrokerBaseUrl) { $BrokerBaseUrl = "http://localhost:9292" }

Write-Host "PACT broker: $BrokerBaseUrl"
Write-Host "TODO: wire real pact publish once pact files exist (consumer tests)."
Write-Host "This script is intentionally a placeholder for disciplined expansion."