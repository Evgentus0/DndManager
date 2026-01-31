# Pre-work checks: verify on master branch, clean working tree, and pull latest changes
# Exit codes:
#   0 - success, continue
#   2 - error, block action

$ErrorActionPreference = "Stop"

try {
    # Check 1: Verify current branch is master
    $currentBranch = git rev-parse --abbrev-ref HEAD 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to get current branch: $currentBranch"
        exit 2
    }

    if ($currentBranch -ne "master") {
        Write-Error "Not on master branch. Current branch: $currentBranch. Please switch to master before proceeding."
        exit 2
    }

    # Check 2: Verify working tree is clean (no uncommitted changes)
    $gitStatus = git status --porcelain 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to check git status: $gitStatus"
        exit 2
    }

    if ($gitStatus) {
        Write-Error "Working tree is not clean. Please commit or stash your changes before proceeding:`n$gitStatus"
        exit 2
    }

    # Check 3: Pull latest changes from remote
    $pullResult = git pull --ff-only 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to pull latest changes: $pullResult"
        exit 2
    }

    # All checks passed
    Write-Host "Pre-work checks passed: on master branch, clean working tree, pulled latest changes"
    exit 0
}
catch {
    Write-Error "Pre-work check failed: $_"
    exit 2
}
