# Analyze code changes and extract documentation-relevant information

param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,

    [Parameter(Mandatory=$true)]
    [string]$FileContent,

    [Parameter(Mandatory=$true)]
    [string]$UpdateType
)

# Result object
$result = @{
    FileName = (Split-Path $FilePath -Leaf)
    FilePath = $FilePath
    UpdateType = $UpdateType
    ClassName = $null
    ClassDescription = $null
    PublicMethods = @()
    PublicProperties = @()
    ComponentName = $null
    ComponentProps = @()
}

# Parse based on update type
switch ($UpdateType) {
    "model" {
        # Extract C# model information

        # Extract class name
        if ($FileContent -match 'public\s+class\s+(\w+)') {
            $result.ClassName = $Matches[1]
        }

        # Extract XML summary for class description
        if ($FileContent -match '///\s*<summary>\s*(.*?)\s*</summary>\s*public\s+class') {
            $result.ClassDescription = $Matches[1].Trim()
        } else {
            # Default description based on file name
            $result.ClassDescription = "$($result.ClassName) model"
        }

        # Extract public properties
        $propertyPattern = 'public\s+(\w+(?:<[^>]+>)?(?:\[\])?)\s+(\w+)\s*\{'
        $propertyMatches = [regex]::Matches($FileContent, $propertyPattern)
        foreach ($match in $propertyMatches) {
            $propType = $match.Groups[1].Value
            $propName = $match.Groups[2].Value
            $result.PublicProperties += @{
                Name = $propName
                Type = $propType
            }
        }
    }

    "service" {
        # Extract C# service information

        # Extract class name
        if ($FileContent -match 'public\s+class\s+(\w+)') {
            $result.ClassName = $Matches[1]
        }

        # Extract description
        if ($FileContent -match '///\s*<summary>\s*(.*?)\s*</summary>\s*public\s+class') {
            $result.ClassDescription = $Matches[1].Trim()
        } else {
            $result.ClassDescription = "Core business logic for $($result.ClassName -replace 'Service$', '')"
        }

        # Extract public methods (excluding getters/setters)
        $methodPattern = 'public\s+(?:async\s+)?(?:Task<?)?(\w+)>?\s+(\w+)\s*\([^)]*\)'
        $methodMatches = [regex]::Matches($FileContent, $methodPattern)
        $uniqueMethods = @{}
        foreach ($match in $methodMatches) {
            $returnType = $match.Groups[1].Value
            $methodName = $match.Groups[2].Value

            # Skip property getters/setters
            if ($methodName -notmatch '^(get_|set_)') {
                if (-not $uniqueMethods.ContainsKey($methodName)) {
                    $uniqueMethods[$methodName] = $true
                    $result.PublicMethods += "$methodName()"
                }
            }
        }
    }

    "hub" {
        # Extract SignalR Hub information

        # Extract class name
        if ($FileContent -match 'public\s+class\s+(\w+)\s*:\s*Hub') {
            $result.ClassName = $Matches[1]
        }

        # Description
        $result.ClassDescription = "Real-time communication hub"

        # Extract public methods (SignalR events)
        $methodPattern = 'public\s+(?:async\s+)?(?:Task<?)?(?:\w+)?>?\s+(\w+)\s*\('
        $methodMatches = [regex]::Matches($FileContent, $methodPattern)
        $uniqueMethods = @{}
        foreach ($match in $methodMatches) {
            $methodName = $match.Groups[1].Value

            # Skip base class methods and property accessors
            if ($methodName -notmatch '^(get_|set_|OnConnected|OnDisconnected)') {
                if (-not $uniqueMethods.ContainsKey($methodName)) {
                    $uniqueMethods[$methodName] = $true
                    $result.PublicMethods += $methodName
                }
            }
        }
    }

    "controller" {
        # Extract Controller information

        # Extract class name
        if ($FileContent -match 'public\s+class\s+(\w+)\s*:\s*Controller') {
            $result.ClassName = $Matches[1]
        }

        # Description
        $result.ClassDescription = "HTTP endpoints for $($result.ClassName -replace 'Controller$', '')"

        # Extract action methods
        $methodPattern = 'public\s+(?:async\s+)?(?:Task<?)?(?:\w+)?>?\s+(\w+)\s*\('
        $methodMatches = [regex]::Matches($FileContent, $methodPattern)
        $uniqueMethods = @{}
        foreach ($match in $methodMatches) {
            $methodName = $match.Groups[1].Value

            # Skip property accessors
            if ($methodName -notmatch '^(get_|set_)') {
                if (-not $uniqueMethods.ContainsKey($methodName)) {
                    $uniqueMethods[$methodName] = $true
                    $result.PublicMethods += $methodName
                }
            }
        }
    }

    "vue-component" {
        # Extract Vue component information

        # Extract component name
        if ($FileContent -match "name:\s*['\"]([^'\"]+)['\"]") {
            $result.ComponentName = $Matches[1]
        } else {
            # Fallback to filename
            $result.ComponentName = [System.IO.Path]::GetFileNameWithoutExtension($result.FileName)
        }

        # Extract props
        if ($FileContent -match "props:\s*\{([^}]+)\}") {
            $propsBlock = $Matches[1]
            $propPattern = '(\w+):\s*(?:String|Number|Boolean|Object|Array)'
            $propMatches = [regex]::Matches($propsBlock, $propPattern)
            foreach ($match in $propMatches) {
                $result.ComponentProps += $match.Groups[1].Value
            }
        }

        # Try to extract description from comments
        if ($FileContent -match '//\s*(.+)' -and $FileContent.IndexOf('//') -lt 200) {
            $result.ClassDescription = $Matches[1].Trim()
        } else {
            $result.ClassDescription = "$($result.ComponentName) Vue component"
        }
    }
}

# Return result as JSON
return $result | ConvertTo-Json -Depth 10
