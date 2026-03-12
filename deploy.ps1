# ============================================================
# TRAFFIC MANAGEMENT SYSTEM - DEPLOY SCRIPT
# Run this every time you make changes.
# It will: commit, push to GitHub, build, and deploy to Azure Green.
# ============================================================
# Usage:
#   .\deploy.ps1                        -> auto deploys to GREEN (staging)
#   .\deploy.ps1 -Message "my update"   -> with custom commit message
# ============================================================

param(
    [string]$Message = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$UIFolder = Join-Path $ProjectRoot "Traffic Management Dashboard UI"

# Azure deployment token
$GreenToken = "1f0d359479f271506b2aca9a355ac95b5d6ebc129ad9321b6519ddbe45f99d4004-478d80e9-b00d-480c-81e8-239e63a16564000292109f897900"

# Azure URL
$GreenURL = "https://witty-pond-09f897900.4.azurestaticapps.net"
$CustomDomain = "https://www.navocs.com"

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

# Step 4: Deploy to Azure Green
Write-Host "[4/4] Deploying to Azure GREEN (staging)..." -ForegroundColor Yellow
swa deploy ./dist --deployment-token $GreenToken --env production
Write-Host "  GREEN deployed: $GreenURL" -ForegroundColor Green

# Done
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " DEPLOYMENT COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  GitHub:  https://github.com/JohnCasAsh/traffic-research" -ForegroundColor White
Write-Host "  Green:   $GreenURL" -ForegroundColor Green
Write-Host "  Domain:  $CustomDomain" -ForegroundColor Green
Write-Host "  Local:   http://localhost:5173 (run npm run dev)" -ForegroundColor White
Write-Host ""

# Step 5: Auto-log progress to Notion + Make
Write-Host "[5/5] Logging deploy to Notion..." -ForegroundColor Yellow
try {
    $BackendURL = "http://localhost:3001"
    # Get list of changed files from last commit
    $changedFiles = git diff --name-only HEAD~1 HEAD 2>$null
    if (-not $changedFiles) { $changedFiles = "No file diff available" }
    $fileList = ($changedFiles | Select-Object -First 10) -join ", "
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"

    # Log to Activity Log + Make webhook
    $eventBody = @{
        eventType = "deploy_completed"
        payload = @{
            severity = "info"
            message = "Deploy to Green: $Message"
            note = "Files changed: $fileList"
            triggeredFrom = "deploy.ps1"
        }
    } | ConvertTo-Json -Depth 5
    Invoke-RestMethod -Method Post -Uri "$BackendURL/api/ops/make-test" -ContentType "application/json" -Body $eventBody -TimeoutSec 10 -ErrorAction SilentlyContinue | Out-Null

    # Log to Daily Progress Report
    $progressBody = @{
        title = "Deploy: $Message"
        category = "Deployment"
        status = "Completed"
        notes = "Files: $fileList | Deployed to $GreenURL at $timestamp"
        impact = "High"
    } | ConvertTo-Json -Depth 5
    Invoke-RestMethod -Method Post -Uri "$BackendURL/api/ops/log-progress" -ContentType "application/json" -Body $progressBody -TimeoutSec 10 -ErrorAction SilentlyContinue | Out-Null

    Write-Host "  Notion + Make notified." -ForegroundColor Green
} catch {
    Write-Host "  Notion logging skipped (backend not running)." -ForegroundColor DarkGray
}
