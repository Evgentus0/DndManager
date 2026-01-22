# DndSessionManager Publish Script
param(
    [switch]$Zip,
    [string]$Version = "1.0"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$PublishPath = "$ProjectRoot\DndSessionManager.Host\bin\Release\net8.0-windows\win-x64\publish"

Write-Host "Publishing DndSessionManager..." -ForegroundColor Cyan

# Publish
dotnet publish "$ProjectRoot\DndSessionManager.Host" -c Release -r win-x64 --self-contained true

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nPublish successful!" -ForegroundColor Green
    Write-Host "Output: $PublishPath"

    # Get size
    $size = (Get-ChildItem $PublishPath -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "Total size: $([math]::Round($size, 2)) MB"

    # Create ZIP if requested
    if ($Zip) {
        $ZipPath = "$ProjectRoot\DndSessionManager-v$Version.zip"
        Write-Host "`nCreating ZIP archive..." -ForegroundColor Cyan

        if (Test-Path $ZipPath) { Remove-Item $ZipPath }
        Compress-Archive -Path "$PublishPath\*" -DestinationPath $ZipPath

        $zipSize = (Get-Item $ZipPath).Length / 1MB
        Write-Host "Created: $ZipPath ($([math]::Round($zipSize, 2)) MB)" -ForegroundColor Green
    }

    # Open folder
    explorer $PublishPath
} else {
    Write-Host "`nPublish failed!" -ForegroundColor Red
    exit 1
}
