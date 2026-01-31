# PostToolUse Hook - Documentation Auto-Updater
# This hook triggers after Edit/Write tools to update documentation

param()

# Read JSON input from stdin
$inputJson = [Console]::In.ReadToEnd()

# Convert to object
try {
    $hookData = $inputJson | ConvertFrom-Json
} catch {
    Write-Error "Failed to parse input JSON: $_"
    exit 0  # Don't block the operation
}

# Get file path from hook data
$filePath = $hookData.tool_input.file_path
if (-not $filePath) {
    # No file path, nothing to do
    exit 0
}

# Convert to relative path from project root
$projectDir = $env:CLAUDE_PROJECT_DIR
if (-not $projectDir) {
    $projectDir = (Get-Location).Path
}

# Normalize paths
$filePath = $filePath -replace '\\', '/'
$projectDir = $projectDir -replace '\\', '/'
$relativePath = $filePath -replace [regex]::Escape($projectDir + '/'), ''

# Filter: Only process relevant files
$shouldProcess = $false

# Check if file is in relevant directories
if ($relativePath -match '^DndSessionManager\.Web/Models/.*\.cs$') {
    $shouldProcess = $true
} elseif ($relativePath -match '^DndSessionManager\.Web/Services/.*\.cs$') {
    $shouldProcess = $true
} elseif ($relativePath -match '^DndSessionManager\.Web/Controllers/.*\.cs$') {
    $shouldProcess = $true
} elseif ($relativePath -match '^DndSessionManager\.Web/Hubs/.*\.cs$') {
    $shouldProcess = $true
} elseif ($relativePath -match '^DndSessionManager\.Web/wwwroot/ClientApp/components/.*\.js$') {
    $shouldProcess = $true
}

if (-not $shouldProcess) {
    # File not relevant for documentation, skip
    exit 0
}

# Load configuration
$configPath = Join-Path $projectDir ".claude\hooks\doc-updater\config.json"
if (-not (Test-Path $configPath)) {
    Write-Error "Configuration file not found: $configPath"
    exit 0
}

try {
    $config = Get-Content $configPath -Raw | ConvertFrom-Json
} catch {
    Write-Error "Failed to load config: $_"
    exit 0
}

# Find matching file mappings
$matchedMappings = @()
foreach ($mapping in $config.fileMappings) {
    $pattern = $mapping.pattern -replace '\*', '.*' -replace '\\', '/'
    if ($relativePath -match $pattern) {
        $matchedMappings += $mapping
    }
}

if ($matchedMappings.Count -eq 0) {
    # No matching mappings found
    exit 0
}

# Log file path
$logPath = Join-Path $projectDir ".claude\hooks\logs\doc-updates.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$logEntry = "[$timestamp] ANALYZING: $relativePath"
Add-Content -Path $logPath -Value $logEntry

# Get file content
$fileContent = ""
if ($hookData.tool_input.content) {
    $fileContent = $hookData.tool_input.content
} elseif (Test-Path $filePath) {
    $fileContent = Get-Content $filePath -Raw
}

# Analyze changes for each matched mapping
$analyzerScript = Join-Path $projectDir ".claude\hooks\doc-updater\analyze-changes.ps1"

foreach ($mapping in $matchedMappings) {
    $updateType = $mapping.updateType

    # Call analyzer
    $analysisResult = & $analyzerScript `
        -FilePath $relativePath `
        -FileContent $fileContent `
        -UpdateType $updateType

    if ($analysisResult) {
        # Process each documentation file
        foreach ($docFile in $mapping.docs) {
            $docPath = Join-Path $projectDir $docFile

            # Call updater
            $updaterScript = Join-Path $projectDir ".claude\hooks\doc-updater\update-docs.ps1"
            & $updaterScript `
                -DocPath $docPath `
                -FilePath $relativePath `
                -AnalysisResult $analysisResult `
                -TableSection $mapping.tableSection
        }
    }
}

# Log completion
$logEntry = "[$timestamp] COMPLETED: Processing $relativePath"
Add-Content -Path $logPath -Value $logEntry

# Return success
exit 0
