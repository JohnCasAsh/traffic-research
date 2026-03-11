# ============================================================
# TRAFFIC MANAGEMENT SYSTEM - DEPLOY SCRIPT
# Run this script every time you want to update everything.
# It will: commit, push to GitHub, build, and deploy to Azure.
# ============================================================
# Usage:
#   .\deploy.ps1                  -> deploys to GREEN (staging)
#   .\deploy.ps1 -Slot blue       -> deploys to BLUE (production)
#   .\deploy.ps1 -Slot both       -> deploys to both GREEN and BLUE
# ============================================================

param(
    [ValidateSet("green", "blue", "both")]
    [string]$Slot = "green",

    [string]$Message = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$UIFolder = Join-Path $ProjectRoot "Traffic Management Dashboard UI"

# Azure deployment tokens
$GreenToken = "1f0d359479f271506b2aca9a355ac95b5d6ebc129ad9321b6519ddbe45f99d4004-478d80e9-b00d-480c-81e8-239e63a16564000292109f897900"
$BlueToken  = "4f860c71a8913b9024d7858b7dcc81e04ec33ea7d6a5473f0d2c3121bd30f3b906-be01d2fd-97a2-4740-8a5b-7cf2c1dd606c000001902fbdc100"

# Azure URLs
$GreenURL = "https://witty-pond-09f897900.4.azurestaticapps.net"
$BlueURL  = "https://ashy-stone-02fbdc100.6.azurestaticapps.net"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " TRAFFIC MANAGEMENT - DEPLOY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Git commit and push
Write-Host "[1/4] Checking for changes..." -ForegroundColor Yellow
Set-Location $ProjectRoot

$changes = git status --porcelain
if ($changes) {
    if (-not $Message) {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
        $Message = "Update: $timestamp"
    }
    Write-Host "  Committing: $Message" -ForegroundColor Gray
    git add .
    git commit -m $Message
} else {
    Write-Host "  No new changes to commit." -ForegroundColor Gray
}

# Step 2: Push to GitHub
Write-Host "[2/4] Pushing to GitHub..." -ForegroundColor Yellow
$currentBranch = git branch --show-current
git push origin $currentBranch
Write-Host "  Pushed to origin/$currentBranch" -ForegroundColor Green

# Step 3: Build
Write-Host "[3/4] Building project..." -ForegroundColor Yellow
Set-Location $UIFolder
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  BUILD FAILED!" -ForegroundColor Red
    exit 1
}
Write-Host "  Build complete." -ForegroundColor Green

# Step 4: Deploy to Azure
Write-Host "[4/4] Deploying to Azure..." -ForegroundColor Yellow

if ($Slot -eq "green" -or $Slot -eq "both") {
    Write-Host "  Deploying to GREEN (staging)..." -ForegroundColor Cyan
    swa deploy ./dist --deployment-token $GreenToken --env production
    Write-Host "  GREEN deployed: $GreenURL" -ForegroundColor Green
}

if ($Slot -eq "blue" -or $Slot -eq "both") {
    Write-Host "  Deploying to BLUE (production)..." -ForegroundColor Cyan
    swa deploy ./dist --deployment-token $BlueToken --env production
    Write-Host "  BLUE deployed: $BlueURL" -ForegroundColor Green
}

# Done
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " DEPLOYMENT COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  GitHub:  https://github.com/JohnCasAsh/traffic-research" -ForegroundColor White
if ($Slot -eq "green" -or $Slot -eq "both") {
    Write-Host "  Green:   $GreenURL" -ForegroundColor Green
}
if ($Slot -eq "blue" -or $Slot -eq "both") {
    Write-Host "  Blue:    $BlueURL" -ForegroundColor Green
}
Write-Host "  Local:   http://localhost:5173 (run npm run dev)" -ForegroundColor White
Write-Host ""
