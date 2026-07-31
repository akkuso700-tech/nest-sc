param()

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptRoot "..\..")
$backendDir = Join-Path $projectRoot "backend"
$backendFrontendDir = Join-Path $backendDir "frontend-dist"
$backendPublicDir = Join-Path $backendDir "public"
$frontendDistDir = Join-Path $projectRoot "frontend\dist"
$artifactsDir = Join-Path $scriptRoot "artifacts"
$stagingDir = Join-Path $artifactsDir "backend-hostinger"
$frontendArtifactDir = Join-Path $artifactsDir "frontend-hostinger"
$backendZipPath = Join-Path $artifactsDir "backend-hostinger.zip"

New-Item -ItemType Directory -Force -Path $artifactsDir | Out-Null

if (Test-Path $stagingDir) {
  Remove-Item $stagingDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null

Copy-Item -Path (Join-Path $backendDir "*") -Destination $stagingDir -Recurse -Force

$frontendSourceDir = $null
$frontendDistIndex = Join-Path $frontendDistDir "index.html"
$frontendArtifactIndex = Join-Path $frontendArtifactDir "index.html"

if (Test-Path (Join-Path $backendPublicDir "index.html")) {
  $frontendSourceDir = $backendPublicDir
}
elseif (Test-Path (Join-Path $backendFrontendDir "index.html")) {
  $frontendSourceDir = $backendFrontendDir
}
elseif (Test-Path $frontendDistIndex) {
  $frontendSourceDir = $frontendDistDir
}
elseif (Test-Path $frontendArtifactIndex) {
  $frontendSourceDir = $frontendArtifactDir
}

if ($frontendSourceDir) {
  $publicDir = Join-Path $stagingDir "public"
  New-Item -ItemType Directory -Force -Path $publicDir | Out-Null
  Copy-Item -Path (Join-Path $frontendSourceDir "*") -Destination $publicDir -Recurse -Force
}

$removeTargets = @(
  "node_modules",
  "uploads",
  ".env",
  ".env.render.demo.example",
  ".env.render.live.example",
  "render-demo.env.example",
  "render-live.env.example",
  "dev-backend.log"
)

foreach ($target in $removeTargets) {
  $fullPath = Join-Path $stagingDir $target
  if (Test-Path $fullPath) {
    Remove-Item $fullPath -Recurse -Force
  }
}

if (Test-Path $backendZipPath) {
  Remove-Item $backendZipPath -Force
}

Compress-Archive -Path (Join-Path $stagingDir "*") -DestinationPath $backendZipPath -Force

Write-Host "Backend artifact hazir: $backendZipPath"
Write-Host "Not: Hostinger panelde bu zip'i acip npm install calistirin."
if ($frontendSourceDir) {
  Write-Host "Frontend static dosyalari package icine eklendi: $frontendSourceDir -> public/"
}
else {
  Write-Host "Uyari: Frontend static bulunamadi. Root domainde SPA acilmayabilir."
}
