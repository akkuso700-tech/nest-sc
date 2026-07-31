param(
  [string]$ApiUrl = "https://api.nest-sc.com/api/v1",
  [string]$UploadsOrigin = "https://upload.nest-sc.com",
  [ValidateSet("live", "demo")]
  [string]$AppEnvironment = "live",
  [string]$WebVitalsSampleRate = "0.2",
  [switch]$Install,
  [switch]$Build
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptRoot "..\..")
$frontendDir = Join-Path $projectRoot "frontend"
$viteOutputDir = Join-Path $projectRoot "backend\frontend-dist"
$legacyDistDir = Join-Path $frontendDir "dist"
$artifactsDir = Join-Path $scriptRoot "artifacts"
$frontendZipPath = Join-Path $artifactsDir "frontend-hostinger.zip"

New-Item -ItemType Directory -Force -Path $artifactsDir | Out-Null

Push-Location $frontendDir
try {
  if ($Build) {
    $env:VITE_API_URL = $ApiUrl
    $env:VITE_UPLOADS_ORIGIN = $UploadsOrigin
    $env:VITE_APP_ENV = $AppEnvironment
    $env:VITE_WEB_VITALS_SAMPLE_RATE = $WebVitalsSampleRate
  }

  if ($Install) {
    npm.cmd install
    if ($LASTEXITCODE -ne 0) {
      throw "npm install basarisiz oldu."
    }
  }

  if ($Build) {
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
      throw "npm run build basarisiz oldu."
    }
  }
}
finally {
  Pop-Location
}

$distDir = if (Test-Path (Join-Path $viteOutputDir "index.html")) {
  $viteOutputDir
}
elseif (Test-Path (Join-Path $legacyDistDir "index.html")) {
  $legacyDistDir
}
else {
  throw "Frontend build cikisi bulunamadi. Once npm run build calistir."
}

Copy-Item -Path (Join-Path $scriptRoot "frontend.htaccess") -Destination (Join-Path $distDir ".htaccess") -Force

if (Test-Path $frontendZipPath) {
  Remove-Item $frontendZipPath -Force
}

Compress-Archive -Path (Join-Path $distDir "*") -DestinationPath $frontendZipPath -Force

Write-Host "Frontend artifact hazir: $frontendZipPath"
