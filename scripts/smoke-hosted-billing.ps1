$ErrorActionPreference = "Stop"

$repoRoot = (git rev-parse --show-toplevel).Trim().Replace('/', '\')
$currentDirectory = (Get-Location).Path.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
if ($repoRoot -ne $currentDirectory -or $repoRoot -ne "C:\Users\miche\Desktop\setuvara") {
  throw "Hosted billing smoke tests must run from the Setuvara repository root."
}

$environmentCheck = (node scripts/check-hosted-billing-env.mjs | Out-String)
if (
  $LASTEXITCODE -ne 0 -or
  $environmentCheck -notmatch 'PROJECT=true' -or
  $environmentCheck -notmatch 'LIVE=true' -or
  $environmentCheck -notmatch 'PUBLISHABLE_KEY=true'
) {
  throw "The local environment is not configured for the verified Setuvara project."
}

$env:NEXT_PUBLIC_APP_URL = "http://localhost:3014"
$stdoutPath = Join-Path $repoRoot ".next\hosted-billing-smoke-stdout.log"
$stderrPath = Join-Path $repoRoot ".next\hosted-billing-smoke-stderr.log"
$server = Start-Process -FilePath (Get-Command node).Source `
  -ArgumentList @("node_modules/next/dist/bin/next", "dev", "-p", "3014") `
  -WorkingDirectory $repoRoot `
  -WindowStyle Hidden `
  -PassThru `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath

try {
  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
      $status = & curl.exe --silent --output NUL --write-out "%{http_code}" --max-time 3 "http://localhost:3014/login"
      if ($LASTEXITCODE -eq 0 -and $status -eq "200") { $ready = $true; break }
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  if (-not $ready) { throw "The local Setuvara app did not become ready." }

  $catalog = & curl.exe --silent --output NUL --write-out "%{http_code}" --max-time 15 "http://localhost:3014/api/billing/catalog"
  $publicLookup = & curl.exe --silent --output NUL --write-out "%{http_code}" --max-time 15 "http://localhost:3014/api/billing/public/billing_e2e_missing"
  $webhook = & curl.exe --silent --output NUL --write-out "%{http_code}" --max-time 15 --request POST --header "Content-Type: application/json" --data "{}" "http://localhost:3014/api/webhooks/dodo"
  $checkout = & curl.exe --silent --output NUL --write-out "%{http_code}" --max-time 15 --request POST --header "Origin: http://localhost:3014" --header "Idempotency-Key: $([guid]::NewGuid().ToString())" --header "Content-Type: application/json" --data '{"plan":"plus","interval":"monthly"}' "http://localhost:3014/api/billing/checkout"
  $portal = & curl.exe --silent --output NUL --write-out "%{http_code}" --max-time 15 --request POST --header "Origin: http://localhost:3014" --header "Content-Type: application/json" --data "{}" "http://localhost:3014/api/billing/portal"

  "HOSTED_SCHEMA_PUBLIC_ROUTE_STATUS=$publicLookup"
  "BILLING_CATALOG_STATUS=$catalog"
  "UNSIGNED_WEBHOOK_STATUS=$webhook"
  "UNAUTHENTICATED_CHECKOUT_STATUS=$checkout"
  "UNAUTHENTICATED_PORTAL_STATUS=$portal"

  if (
    $publicLookup -ne "404" -or
    $catalog -ne "200" -or
    $webhook -ne "401" -or
    $checkout -notin @("400", "401") -or
    $portal -ne "401"
  ) {
    throw "A hosted-schema billing API smoke check did not return its expected safe response."
  }
} finally {
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item Env:NEXT_PUBLIC_APP_URL -ErrorAction SilentlyContinue
}
