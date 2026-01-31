# Apply pending documentation updates

param()

$projectDir = $env:CLAUDE_PROJECT_DIR
if (-not $projectDir) {
    $projectDir = (Get-Location).Path
}

$pendingReviewPath = Join-Path $projectDir ".claude\hooks\logs\pending-review.md"
$logPath = Join-Path $projectDir ".claude\hooks\logs\doc-updates.log"

# Check if pending review file exists
if (-not (Test-Path $pendingReviewPath)) {
    Write-Host "No pending documentation updates found."
    exit 0
}

# Read pending review content
$reviewContent = Get-Content $pendingReviewPath -Raw

if (-not $reviewContent -or $reviewContent.Trim() -eq "") {
    Write-Host "No pending documentation updates."
    exit 0
}

Write-Host "=== Pending Documentation Updates ===" -ForegroundColor Cyan
Write-Host ""
Get-Content $pendingReviewPath
Write-Host ""

# Ask for confirmation
$confirmation = Read-Host "Apply all pending updates? (yes/no)"
if ($confirmation -ne "yes" -and $confirmation -ne "y") {
    Write-Host "Updates cancelled." -ForegroundColor Yellow
    exit 0
}

# Find all .update files
$updateFiles = Get-ChildItem -Path $projectDir -Recurse -Filter "*.md.update" -ErrorAction SilentlyContinue

if ($updateFiles.Count -eq 0) {
    Write-Host "No update files found." -ForegroundColor Yellow
    exit 0
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Apply each update
foreach ($updateFile in $updateFiles) {
    $targetFile = $updateFile.FullName -replace '\.update$', ''

    if (Test-Path $targetFile) {
        # Copy update content to target
        Copy-Item $updateFile.FullName $targetFile -Force
        Write-Host "Applied update to: $targetFile" -ForegroundColor Green

        # Log
        Add-Content -Path $logPath -Value "[$timestamp] APPLIED: $targetFile"

        # Remove update file
        Remove-Item $updateFile.FullName -Force
    } else {
        Write-Host "Warning: Target file not found: $targetFile" -ForegroundColor Yellow
    }
}

# Clear pending review
Clear-Content $pendingReviewPath
Add-Content -Path $pendingReviewPath -Value "# Pending Documentation Updates"
Add-Content -Path $pendingReviewPath -Value ""
Add-Content -Path $pendingReviewPath -Value "No pending updates."

Write-Host ""
Write-Host "All updates applied successfully!" -ForegroundColor Green
Write-Host "Check the log file for details: $logPath"
