$ErrorActionPreference = "Stop"

$repoRoot = (git rev-parse --show-toplevel).Trim().Replace('/', '\')
$currentDirectory = (Get-Location).Path.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
if ($repoRoot -ne $currentDirectory -or $repoRoot -ne "C:\Users\miche\Desktop\setuvara") {
  throw "Billing database tests must run from the Setuvara repository root."
}

$statusLines = npx supabase status --output json
if ($LASTEXITCODE -ne 0) {
  throw "Unable to read local Setuvara Supabase status."
}

try {
  $localStatus = ($statusLines -join "`n") | ConvertFrom-Json
} catch {
  throw "Local Setuvara Supabase status was not valid JSON."
}

if (
  -not $localStatus.API_URL -or
  -not $localStatus.PUBLISHABLE_KEY -or
  -not $localStatus.SERVICE_ROLE_KEY -or
  $localStatus.API_URL -notmatch '^http://(127\.0\.0\.1|localhost):54321$'
) {
  throw "Local Setuvara Supabase API or test credentials are unavailable."
}

$env:SETUVARA_LOCAL_SUPABASE_URL = $localStatus.API_URL
$env:SETUVARA_LOCAL_SUPABASE_PUBLISHABLE_KEY = $localStatus.PUBLISHABLE_KEY
$env:SETUVARA_LOCAL_SUPABASE_SERVICE_ROLE_KEY = $localStatus.SERVICE_ROLE_KEY

$testServer = $null
$ephemeralEnvironmentNames = @(
  "SETUVARA_LOCAL_SUPABASE_URL",
  "SETUVARA_LOCAL_SUPABASE_PUBLISHABLE_KEY",
  "SETUVARA_LOCAL_SUPABASE_SERVICE_ROLE_KEY",
  "SETUVARA_LOCAL_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "DODO_PAYMENTS_ENVIRONMENT",
  "DODO_PAYMENTS_API_KEY",
  "DODO_PAYMENTS_WEBHOOK_KEY",
  "DODO_PLUS_MONTHLY_PRODUCT_ID",
  "DODO_PLUS_YEARLY_PRODUCT_ID",
  "DODO_PRO_MONTHLY_PRODUCT_ID",
  "DODO_PRO_YEARLY_PRODUCT_ID"
)

try {
  deno test --unstable-sloppy-imports `
    --allow-env=SETUVARA_LOCAL_SUPABASE_URL,SETUVARA_LOCAL_SUPABASE_PUBLISHABLE_KEY,SETUVARA_LOCAL_SUPABASE_SERVICE_ROLE_KEY `
    --allow-net=127.0.0.1:54321,localhost:54321 `
    tests/billing/database.integration.test.ts
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  $env:NEXT_PUBLIC_SUPABASE_URL = $localStatus.API_URL
  $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $localStatus.PUBLISHABLE_KEY
  $env:SUPABASE_SERVICE_ROLE_KEY = $localStatus.SERVICE_ROLE_KEY
  $env:NEXT_PUBLIC_APP_URL = "http://localhost:3014"
  $env:SETUVARA_LOCAL_APP_URL = $env:NEXT_PUBLIC_APP_URL
  $env:DODO_PAYMENTS_ENVIRONMENT = "test_mode"
  $env:DODO_PAYMENTS_API_KEY = "local-test-key-not-used"
  $env:DODO_PAYMENTS_WEBHOOK_KEY = "local-test-webhook-key-not-used"
  $env:DODO_PLUS_MONTHLY_PRODUCT_ID = "pdt_localplusmonthly"
  $env:DODO_PLUS_YEARLY_PRODUCT_ID = "pdt_localplusyearly"
  $env:DODO_PRO_MONTHLY_PRODUCT_ID = "pdt_localpromonthly"
  $env:DODO_PRO_YEARLY_PRODUCT_ID = "pdt_localproyearly"

  $nodePath = (Get-Command node).Source
  $stdoutPath = Join-Path $repoRoot ".next\billing-route-test-stdout.log"
  $stderrPath = Join-Path $repoRoot ".next\billing-route-test-stderr.log"
  $testServer = Start-Process -FilePath $nodePath `
    -ArgumentList @("node_modules/next/dist/bin/next", "dev", "--webpack", "-p", "3014") `
    -WorkingDirectory $repoRoot `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath

  $serverReady = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
      $response = Invoke-WebRequest -Uri "$($env:SETUVARA_LOCAL_APP_URL)/login" -TimeoutSec 3 -UseBasicParsing
      if ($response.StatusCode -eq 200) {
        $serverReady = $true
        break
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  if (-not $serverReady) {
    throw "Local Setuvara test app did not become ready."
  }

  node --test tests/billing/api-routes.integration.mjs
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  if ($testServer -and -not $testServer.HasExited) {
    Stop-Process -Id $testServer.Id -Force -ErrorAction SilentlyContinue
  }
  foreach ($name in $ephemeralEnvironmentNames) {
    Remove-Item "Env:$name" -ErrorAction SilentlyContinue
  }
}
