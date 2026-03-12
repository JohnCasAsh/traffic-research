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
