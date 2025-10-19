# Raycast-style Application Fetcher
# Comprehensive app discovery using Shell.Application COM, Get-StartApps, and Get-AppxPackage

$ErrorActionPreference = "SilentlyContinue"

# Helper function to generate smart IDs
function Get-AppId {
    param($name, $path, $type, $packageFamilyName = $null)
    
    switch ($type) {
        "uwp" {
            if ($packageFamilyName) {
                return $packageFamilyName
            }
            # Extract from path if it contains AppID
            if ($path -match '!([^!]+)$') {
                return $Matches[1]
            }
            return $name -replace '[^a-zA-Z0-9]', ''
        }
        "url" {
            # Extract domain + hash for URLs
            if ($path -match 'https?://([^/]+)') {
                $domain = $Matches[1] -replace '[^a-zA-Z0-9]', ''
                $hash = [System.Web.HttpUtility]::UrlEncode($path).GetHashCode()
                return "$domain-$hash"
            }
            return "url-$($name.GetHashCode())"
        }
        default {
            # Desktop apps - use executable name without com. prefix, all lowercase
            if ($path -and (Test-Path $path)) {
                $exe = [System.IO.Path]::GetFileNameWithoutExtension($path)
                return $exe.ToLower()
            }
            return ($name -replace '[^a-zA-Z0-9]', '').ToLower()
        }
    }
}

# Helper function to resolve UWP logos (simplified)
function Resolve-UwpLogo {
    param($installLocation, $logoPath)
    
    if (-not $installLocation -or -not $logoPath) { return $null }
    
    $basePath = Join-Path $installLocation $logoPath
    if (Test-Path $basePath) { return $basePath }
    
    # Try common logo patterns
    $logoPatterns = @(
        "Square44x44Logo.targetsize-32.png",
        "Square44x44Logo.scale-200.png", 
        "Square44x44Logo.png",
        "Square150x150Logo.png",
        "StoreLogo.png"
    )
    
    $dir = Split-Path $basePath -Parent
    foreach ($pattern in $logoPatterns) {
        $candidate = Join-Path $dir $pattern
        if (Test-Path $candidate) { return $candidate }
    }
    
    return $null
}

# Helper function to get shortcut info with better error handling
function Get-ShortcutInfo {
    param($lnkPath)
    
    try {
        $wsh = New-Object -ComObject WScript.Shell
        $lnk = $wsh.CreateShortcut($lnkPath)
        return @{
            Target = $lnk.TargetPath
            Icon = $lnk.IconLocation
            WorkingDir = $lnk.WorkingDirectory
            Arguments = $lnk.Arguments
        }
    } catch {
        return $null
    }
}

# Helper function to resolve icon path
function Resolve-IconPath {
    param($iconPath, $targetPath, $type)
    
    # Try provided icon path first
    if ($iconPath -and (Test-Path $iconPath)) {
        return $iconPath
    }
    
    # For URL shortcuts, skip expensive icon search
    if ($type -eq "url") {
        return $null
    }
    
    # For desktop, use target executable
    if ($targetPath -and (Test-Path $targetPath)) {
        return $targetPath
    }
    
    # For shortcuts, try to resolve the target
    if ($targetPath -and $targetPath -like "*.lnk") {
        $lnkInfo = Get-ShortcutInfo $targetPath
        if ($lnkInfo -and $lnkInfo.Target -and (Test-Path $lnkInfo.Target)) {
            return $lnkInfo.Target
        }
    }
    
    # Skip expensive recursive search for performance
    return $null
}

# Helper function to resolve app location for modern apps (optimized)
function Resolve-AppLocation {
    param($appName, $appId)
    
    # Skip resolution for known non-executable IDs
    if ($appId -match '^(com\.|AgileBits\.|Anysphere\.|CNEventWindowClass|EBBB53C2055ED281|F0DC299D809B9700)') {
        return $null
    }
    
    # Only try a few common locations, no recursive search
    $commonPaths = @(
        "${env:ProgramFiles}\$appName\$appName.exe",
        "${env:ProgramFiles(x86)}\$appName\$appName.exe",
        "${env:LocalAppData}\Programs\$appName\$appName.exe"
    )
    
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            return $path
        }
    }
    
    return $null
}

# Helper function to determine app type
function Get-AppType {
    param($path, $packageFamilyName = $null)
    
    if ($packageFamilyName) { return "uwp" }
    if ($path -match '^https?://') { return "url" }
    if ($path -match '\.exe$|\.msc$|\.cpl$') { return "desktop" }
    if ($path -match '\.lnk$') { return "desktop" }
    return "desktop"
}

# Get UWP apps (now handled by Shell.Application COM object)
function Get-UwpApps {
    # UWP apps are now discovered through the Shell.Application COM object
    # in the Get-DesktopApps function, so this function is no longer needed
    return @()
}

# Get desktop apps using Shell.Application COM object (most comprehensive)
function Get-DesktopApps {
    $apps = @()
    
    try {
        # Use Shell.Application to access AppsFolder - this is the most comprehensive method
        $shell = New-Object -ComObject Shell.Application
        $appsFolder = $shell.NameSpace('shell:::{4234d49b-0245-4df3-b780-3893943456e1}')
        $items = $appsFolder.Items()
        
        foreach ($item in $items) {
            $name = $item.Name
            $path = $item.Path
            
            # Skip system items and duplicates
            if (-not $name -or $name -match '^(Control Panel|Recycle Bin|This PC)$') { continue }
            
            # Determine app type and resolve location
            $location = $path
            $iconPath = $null
            $type = Get-AppType $path
            
            # Handle shortcuts
            if ($path -like '*.lnk') {
                $lnkInfo = Get-ShortcutInfo $path
                if ($lnkInfo -and $lnkInfo.Target) {
                    # Only use the target if it's a valid file path
                    if ($lnkInfo.Target -and (Test-Path $lnkInfo.Target)) {
                        $location = $lnkInfo.Target
                        $iconPath = Resolve-IconPath $lnkInfo.Icon $lnkInfo.Target $type
                        $type = Get-AppType $lnkInfo.Target
        } else {
                        # If target is not a valid path, keep the original path but try to get icon
                        $iconPath = Resolve-IconPath $lnkInfo.Icon $path $type
                    }
                }
            }
            
            # Handle URL shortcuts
            if ($path -like '*.url') {
                try {
                    $content = Get-Content $path -ErrorAction SilentlyContinue
                    $url = ($content | Where-Object { $_ -like "URL=*" } | Select-Object -First 1) -replace "URL=", ""
                    $iconFile = ($content | Where-Object { $_ -like "IconFile=*" } | Select-Object -First 1) -replace "IconFile=", ""
                    
                    if ($url) {
                        $location = $url
                        $iconPath = Resolve-IconPath $iconFile $url "url"
                        $type = "url"
                    }
                } catch { }
            }
            
            # Get icon path if not already resolved
            if (-not $iconPath) {
                $iconPath = Resolve-IconPath $null $location $type
            }
            
            # For apps with non-standard locations, try to find the actual executable
            if ($location -and -not (Test-Path $location) -and $location -notlike "http*" -and $location -notlike "steam*" -and $location -notlike "*.exe" -and $location -notlike "*.lnk") {
                $resolvedLocation = Resolve-AppLocation $name $location
                if ($resolvedLocation) {
                    $location = $resolvedLocation
                    if (-not $iconPath) {
                        $iconPath = $resolvedLocation
                    }
                }
            }
            
            $apps += @{
                type = $type
                id = Get-AppId $name $location $type
                iconPath = $iconPath
                name = $name
                location = $location
            }
        }
    } catch { }
    
    return $apps
}

# Get URL shortcuts (now handled by Shell.Application COM object)
function Get-UrlApps {
    # URL shortcuts are now discovered through the Shell.Application COM object
    # in the Get-DesktopApps function, so this function is no longer needed
    return @()
}

# Main execution
$allApps = @()
$allApps += Get-UwpApps
$allApps += Get-DesktopApps  
$allApps += Get-UrlApps

# Remove duplicates using manual deduplication
$uniqueApps = @()
$seenIds = @{}
foreach ($app in $allApps) {
    if ($app.id -and $app.id -ne "" -and -not $seenIds.ContainsKey($app.id)) {
        $uniqueApps += $app
        $seenIds[$app.id] = $true
    }
}

# Return condensed JSON array
if ($uniqueApps.Count -eq 0) {
    "[]"
} else {
    $uniqueApps | ConvertTo-Json -Compress
}
