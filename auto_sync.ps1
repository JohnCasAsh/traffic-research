# ============================================================
# AUTO SYNC SCRIPT
# Commits and pushes repo changes to a target branch.
# Intended for scheduled execution (e.g., every 6 hours).
# ============================================================

param(
    [string]$Branch = "develop"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Get-EnvFileValue {
    param(
        [string]$FilePath,
        [string]$Key
    )

    if (-not (Test-Path $FilePath)) {
        return $null
    }

    $prefix = "$Key="
    $line = Get-Content $FilePath | Where-Object { $_.StartsWith($prefix) } | Select-Object -First 1
    if (-not $line) {
        return $null
    }

    return $line.Substring($prefix.Length).Trim()
}

function Send-Heartbeat {
    param(
        [string]$RepoRoot,
        [string]$Branch,
        [bool]$HadChanges
    )

    $envFile = Join-Path $RepoRoot "backend\.env"
    $makeEnabled = $env:MAKE_ENABLED
    if ([string]::IsNullOrWhiteSpace($makeEnabled)) {
        $makeEnabled = Get-EnvFileValue -FilePath $envFile -Key "MAKE_ENABLED"
    }

    $makeWebhookUrl = $env:MAKE_WEBHOOK_URL
    if ([string]::IsNullOrWhiteSpace($makeWebhookUrl)) {
        $makeWebhookUrl = Get-EnvFileValue -FilePath $envFile -Key "MAKE_WEBHOOK_URL"
    }

    if ($makeEnabled -ne "true" -or [string]::IsNullOrWhiteSpace($makeWebhookUrl)) {
        Write-Host "Heartbeat skipped: MAKE settings not configured." -ForegroundColor DarkGray
        return
    }

    $shortCommit = (git rev-parse --short HEAD).Trim()
    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

    $heartbeatBody = @{
        eventType = "scheduled_heartbeat"
        service = "traffic-management-automation"
        environment = if ([string]::IsNullOrWhiteSpace($env:NODE_ENV)) { "local" } else { $env:NODE_ENV }
        timestamp = $timestamp
        payload = @{
            severity = "info"
            message = "6-hour automation heartbeat"
            branch = $Branch
            hadChanges = $HadChanges
            commit = $shortCommit
            source = "auto_sync.ps1"
        }
    } | ConvertTo-Json -Depth 8

    try {
        Invoke-RestMethod -Method Post -Uri $makeWebhookUrl -ContentType "application/json" -Body $heartbeatBody -TimeoutSec 15 | Out-Null
        Write-Host "Heartbeat sent to Make.com." -ForegroundColor Green
    } catch {
        Write-Host "Heartbeat send failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Set-Location $RepoRoot

if (-not (Test-Path ".git")) {
    throw "This script must run inside a git repository."
}

$conflicts = git diff --name-only --diff-filter=U
if ($conflicts) {
    Write-Host "Merge conflicts detected. Skipping auto-sync." -ForegroundColor Yellow
    exit 0
}

$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($currentBranch -ne $Branch) {
    git checkout $Branch | Out-Null
}

$status = git status --porcelain
$hadChanges = [bool]$status
if ($status) {
    git add -A

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    $commitMessage = "auto-sync: $timestamp"
    git commit --no-verify -m $commitMessage | Out-Host
} else {
    Write-Host "No changes to commit." -ForegroundColor Gray
}

$upstreamRef = git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null
if ($LASTEXITCODE -ne 0) {
    git push --no-verify -u origin $Branch | Out-Host
    exit $LASTEXITCODE
}

$aheadCount = [int](git rev-list --count "@{u}..HEAD")
if ($aheadCount -gt 0) {
    git push --no-verify | Out-Host
    Write-Host "Pushed $aheadCount commit(s) to origin/$Branch." -ForegroundColor Green
} else {
    Write-Host "Nothing to push." -ForegroundColor Gray
}

Send-Heartbeat -RepoRoot $RepoRoot -Branch $Branch -HadChanges $hadChanges
