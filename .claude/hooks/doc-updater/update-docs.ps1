# Update documentation markdown files with analyzed code changes

param(
    [Parameter(Mandatory=$true)]
    [string]$DocPath,

    [Parameter(Mandatory=$true)]
    [string]$FilePath,

    [Parameter(Mandatory=$true)]
    [string]$AnalysisResult,

    [Parameter(Mandatory=$true)]
    [string]$TableSection
)

# Parse analysis result
$analysis = $AnalysisResult | ConvertFrom-Json

# Check if doc file exists
if (-not (Test-Path $DocPath)) {
    Write-Error "Documentation file not found: $DocPath"
    return
}

# Read documentation file
$docContent = Get-Content $DocPath -Raw

# Find the table section
$sectionPattern = "###\s+$([regex]::Escape($TableSection))"
$sectionMatch = [regex]::Match($docContent, $sectionPattern)

if (-not $sectionMatch.Success) {
    Write-Error "Section '$TableSection' not found in $DocPath"
    return
}

# Find the table after the section header
$tableStartPos = $sectionMatch.Index + $sectionMatch.Length
$remainingContent = $docContent.Substring($tableStartPos)

# Find table boundaries (from | to next ## or end of content)
$tablePattern = '(?s)(\|[^\n]+\|.*?)(?=\n##|\n###|$)'
$tableMatch = [regex]::Match($remainingContent, $tablePattern)

if (-not $tableMatch.Success) {
    Write-Error "Table not found in section '$TableSection'"
    return
}

$tableContent = $tableMatch.Groups[1].Value
$tableLines = $tableContent -split "`n" | Where-Object { $_.Trim() -ne '' }

if ($tableLines.Count -lt 2) {
    Write-Error "Invalid table format"
    return
}

# Parse table header to determine column count and structure
$headerLine = $tableLines[0]
$separatorLine = $tableLines[1]
$dataLines = $tableLines[2..($tableLines.Count - 1)]

# Determine columns
$columnCount = ($headerLine -split '\|').Count - 2  # Minus 2 for leading and trailing |

# Build new row based on analysis result and table structure
$fileName = $analysis.FileName
$newRow = $null

# Determine table structure and build appropriate row
if ($headerLine -match '\|\s*File\s*\|\s*Role\s*\|\s*Main\s+(Methods|Endpoints|Events)') {
    # Three-column table: File | Role | Methods/Properties
    $relativeLink = "../../$($FilePath -replace '\\', '/')"

    # Build methods/properties list
    $methodsList = ""
    if ($analysis.UpdateType -eq "model") {
        # For models, list properties
        $propNames = $analysis.PublicProperties | ForEach-Object { "``$($_.Name)``" }
        $methodsList = $propNames -join ', '
    } elseif ($analysis.UpdateType -eq "service" -or $analysis.UpdateType -eq "controller") {
        # For services/controllers, list methods
        $methodNames = $analysis.PublicMethods | ForEach-Object { "``$_``" }
        $methodsList = $methodNames -join ', '
    } elseif ($analysis.UpdateType -eq "hub") {
        # For hubs, list SignalR methods
        $methodNames = $analysis.PublicMethods
        $methodsList = $methodNames -join ', '
    }

    $description = if ($analysis.ClassDescription) { $analysis.ClassDescription } else { "$fileName file" }
    $newRow = "| [$fileName]($relativeLink) | $description | $methodsList |"

} elseif ($headerLine -match '\|\s*File\s*\|\s*Description\s*\|\s*Used In') {
    # Vue Components table: File | Description | Used In
    $relativeLink = "../../$($FilePath -replace '\\', '/')"
    $description = if ($analysis.ClassDescription) { $analysis.ClassDescription } else { "$($analysis.ComponentName) component" }
    $newRow = "| [$fileName]($relativeLink) | $description | - |"
}

if (-not $newRow) {
    Write-Error "Could not determine table structure for section '$TableSection'"
    return
}

# Check if file already exists in table
$filePattern = "\|\s*\[.*?\]\(.*?$([regex]::Escape($fileName))\)"
$existingRowIndex = -1

for ($i = 0; $i -lt $dataLines.Count; $i++) {
    if ($dataLines[$i] -match $filePattern) {
        $existingRowIndex = $i
        break
    }
}

# Prepare update
$updatedTable = @($headerLine, $separatorLine)

if ($existingRowIndex -ge 0) {
    # Update existing row
    $oldRow = $dataLines[$existingRowIndex]

    # Replace the row
    for ($i = 0; $i -lt $dataLines.Count; $i++) {
        if ($i -eq $existingRowIndex) {
            $updatedTable += $newRow
        } else {
            $updatedTable += $dataLines[$i]
        }
    }

    $changeType = "UPDATED"
    $diffOld = $oldRow
    $diffNew = $newRow
} else {
    # Add new row
    $updatedTable += $dataLines
    $updatedTable += $newRow

    $changeType = "ADDED"
    $diffOld = ""
    $diffNew = $newRow
}

# Reconstruct table
$updatedTableText = $updatedTable -join "`n"

# Replace table in document
$beforeTable = $docContent.Substring(0, $tableStartPos)
$afterTablePos = $tableStartPos + $tableMatch.Index + $tableMatch.Length
$afterTable = $docContent.Substring($afterTablePos)

$updatedDocContent = $beforeTable + "`n`n" + $updatedTableText + $afterTable

# Create backup
$backupPath = "$DocPath.backup.$(Get-Date -Format 'yyyyMMddHHmmss')"
Copy-Item $DocPath $backupPath -Force

# Write to pending review instead of directly updating
$projectDir = $env:CLAUDE_PROJECT_DIR
if (-not $projectDir) { $projectDir = (Get-Location).Path }

$pendingReviewPath = Join-Path $projectDir ".claude\hooks\logs\pending-review.md"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$reviewEntry = @"

## [$timestamp] $fileName modified

**File**: $FilePath
**Documentation**: $DocPath
**Section**: $TableSection
**Change Type**: $changeType

### Proposed Change:
``````diff
$(if ($diffOld) { "- $diffOld" })
+ $diffNew
``````

**Backup created**: $backupPath

---

"@

# Append to pending review
Add-Content -Path $pendingReviewPath -Value $reviewEntry

# Also save the updated content to a temp file for apply-review.ps1
$tempUpdatePath = "$DocPath.update"
Set-Content -Path $tempUpdatePath -Value $updatedDocContent -NoNewline

# Log
$logPath = Join-Path $projectDir ".claude\hooks\logs\doc-updates.log"
Add-Content -Path $logPath -Value "[$timestamp] PENDING: $DocPath - $changeType row for $fileName"

Write-Host "Documentation update pending review: $pendingReviewPath"
