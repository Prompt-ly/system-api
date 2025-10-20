# Input: wildcard to filter by name
$AppName = "*"

# Load AppsFolder items
$apps = (New-Object -ComObject Shell.Application).
  NameSpace('shell:::{4234d49b-0245-4df3-b780-3893943456e1}').
  Items() | Where-Object { $_.Name -like $AppName }

# Registry roots to scan
$regUninstRoots = @(
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall'
)

# Build registry maps
$uninstMap   = @{}
$displayIcon = @{}
$installLoc  = @{}

foreach ($root in $regUninstRoots) {
  if (Test-Path $root) {
    Get-ChildItem $root -ErrorAction SilentlyContinue | ForEach-Object {
      $p = Get-ItemProperty $_.PsPath -ErrorAction SilentlyContinue
      if (-not $p -or -not $p.DisplayName) { return }
      
      $dn = $p.DisplayName
      if (-not $uninstMap.ContainsKey($dn)) { $uninstMap[$dn] = $p.UninstallString }
      if (-not $displayIcon.ContainsKey($dn) -and $p.DisplayIcon) { $displayIcon[$dn] = $p.DisplayIcon }
      if (-not $installLoc.ContainsKey($dn) -and $p.InstallLocation) { $installLoc[$dn] = $p.InstallLocation }
    }
  }
}

# Appx packages
$appxPkgs = @{}
Get-AppxPackage -ErrorAction SilentlyContinue | ForEach-Object {
  $appxPkgs[$_.PackageFullName] = $_
}

# Start Menu cache
$shortcutCache = @{}
@("$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
  "$env:ProgramData\Microsoft\Windows\Start Menu\Programs") | ForEach-Object {
  if (Test-Path $_) {
    Get-ChildItem $_ -Recurse -Filter "*.lnk" -ErrorAction SilentlyContinue | ForEach-Object {
      if (-not $shortcutCache.ContainsKey($_.BaseName)) {
        $shortcutCache[$_.BaseName] = $_.FullName
      }
    }
  }
}

function Get-ValidPath {
  param([string]$spec)
  if (-not $spec) { return $null }
  if ($spec -match '^[A-Za-z0-9\.\-]+_[A-Za-z0-9]+!') { return $null }
  
  $s = $spec.Trim('"')
  if (-not $s) { return $null }
  
  if ($s -match '^(.*?),(-?\d+)$') {
    $file = $Matches[1].Trim('"')
    if ($file -and (Test-Path $file -ErrorAction SilentlyContinue)) { return $s }
    return $null
  }
  if (Test-Path $s -ErrorAction SilentlyContinue) { return $s }
  return $null
}

function Find-UwpLogo {
  param([string]$path)
  if (-not $path -or -not (Test-Path $path)) { return $null }
  
  foreach ($logo in @('Assets\Square44x44Logo.targetsize-32.png',
                      'Assets\Square44x44Logo.scale-200.png',
                      'Assets\Square44x44Logo.png',
                      'Assets\Square150x150Logo.png',
                      'Assets\StoreLogo.png')) {
    $full = Join-Path $path $logo
    if (Test-Path $full) { return $full }
  }
  return $null
}

# Find real executable for an app
function Find-AppExe {
  param($name, $searchDirs)
  
  foreach ($dir in $searchDirs) {
    if (-not $dir -or -not (Test-Path $dir)) { continue }
    
    # Try name-based patterns
    foreach ($pattern in @("$name.exe", "$($name -replace ' ','').exe", "$($name -replace ' .*$','').exe")) {
      $exe = Join-Path $dir $pattern
      if (Test-Path $exe) { return $exe }
    }
    
    # Find .ico files
    $ico = Get-ChildItem $dir -Filter "*.ico" -File -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($ico) { return $ico.FullName }
    
    # Find main exe (not uninstaller/updater/utility)
    $mainExe = Get-ChildItem $dir -Filter "*.exe" -File -ErrorAction SilentlyContinue | 
               Where-Object { $_.Name -notmatch 'uninstall|update|setup|installer|7z|vcredist|directx' -and $_.Length -gt 500KB } | 
               Sort-Object Length -Descending |
               Select-Object -First 1
    if ($mainExe) { return $mainExe.FullName }
  }
  return $null
}

# Resolve path from shortcut
function Get-LnkTarget {
  param([string]$lnkPath)
  if (-not $lnkPath -or -not (Test-Path $lnkPath)) { return $null }
  try {
    $wsh = New-Object -ComObject WScript.Shell
    $lnk = $wsh.CreateShortcut($lnkPath)
    return @{
      Target = $lnk.TargetPath
      Icon = $lnk.IconLocation
      WorkingDir = $lnk.WorkingDirectory
    }
  } catch { return $null }
}

# Main processing function
function Process-App {
  param($item)
  
  $name = $item.Name
  $rawPath = $item.Path
  
  # Initialize results
  $result = @{
    Name = $name
    Path = $rawPath
    Icon = $null
    Uninstall = $null
  }
  
  # Try to get extended properties
  $pkgFull = $null
  $pkgInstall = $null
  try { $pkgFull = $item.ExtendedProperty('System.AppUserModel.PackageFullName') } catch {}
  try { $pkgInstall = $item.ExtendedProperty('System.AppUserModel.PackageInstallPath') } catch {}
  try { $imagePath = $item.ExtendedProperty('System.ImagePath') } catch {}
  
  # Collect potential search directories
  $searchDirs = @()
  
  # 1) If we have ImagePath, use it
  if ($imagePath) {
    $valid = Get-ValidPath $imagePath
    if ($valid) {
      $result.Icon = $valid
      if ($valid -match '\.exe$') {
        $result.Path = $valid
        $dir = Split-Path $valid -Parent
        if ($dir) { $searchDirs += $dir }
      }
    }
  }
  
  # 2) If path is a real file, use it
  if (-not $result.Path -or $result.Path -notmatch '\\') {
    $valid = Get-ValidPath $rawPath
    if ($valid) {
      $result.Path = $valid
      $result.Icon = $valid
      $dir = Split-Path $valid -Parent
      if ($dir) { $searchDirs += $dir }
    }
  }
  
  # 3) Check if it's a .lnk
  if ($rawPath -like '*.lnk' -and (Test-Path $rawPath)) {
    $lnkInfo = Get-LnkTarget $rawPath
    if ($lnkInfo) {
      if ($lnkInfo.Target) { 
        $result.Path = $lnkInfo.Target
        $dir = Split-Path $lnkInfo.Target -Parent
        if ($dir) { $searchDirs += $dir }
      }
      if ($lnkInfo.Icon) { $result.Icon = (Get-ValidPath $lnkInfo.Icon) }
      if ($lnkInfo.WorkingDir -and (Test-Path $lnkInfo.WorkingDir)) {
        $searchDirs += $lnkInfo.WorkingDir
      }
    }
  }
  
  # 4) UWP package handling
  if ($pkgFull -and $appxPkgs.ContainsKey($pkgFull)) {
    $pkg = $appxPkgs[$pkgFull]
    $result.Uninstall = "powershell -NoProfile -Command Remove-AppxPackage -Package `"$pkgFull`""
    
    if ($pkg.InstallLocation -and (Test-Path $pkg.InstallLocation)) {
      $searchDirs += $pkg.InstallLocation
      
      # Try to find the actual executable from manifest
      $manifest = Join-Path $pkg.InstallLocation "AppxManifest.xml"
      if (Test-Path $manifest) {
        try {
          [xml]$xml = Get-Content $manifest
          $app = $xml.Package.Applications.Application | Select-Object -First 1
          if ($app.Executable) {
            $exePath = Join-Path $pkg.InstallLocation $app.Executable
            if (Test-Path $exePath) {
              $result.Path = $exePath
            }
          }
        } catch {}
      }
      
      # UWP logo
      if (-not $result.Icon) {
        $logo = Find-UwpLogo $pkg.InstallLocation
        if ($logo) { $result.Icon = $logo }
      }
    }
  }
  
  # 5) Check registry by name
  if (-not $result.Uninstall -and $uninstMap.ContainsKey($name)) {
    $result.Uninstall = $uninstMap[$name]
  }
  
  if (-not $result.Icon -and $displayIcon.ContainsKey($name)) {
    $valid = Get-ValidPath $displayIcon[$name]
    if ($valid) { $result.Icon = $valid }
  }
  
  if ($installLoc.ContainsKey($name)) {
    $searchDirs += $installLoc[$name]
  }
  
  # 6) Check Start Menu shortcuts
  if ($shortcutCache.ContainsKey($name)) {
    $lnkInfo = Get-LnkTarget $shortcutCache[$name]
    if ($lnkInfo) {
      if (-not $result.Path -or $result.Path -notmatch '\\') {
        if ($lnkInfo.Target) { $result.Path = $lnkInfo.Target }
      }
      if (-not $result.Icon -and $lnkInfo.Icon) {
        $valid = Get-ValidPath $lnkInfo.Icon
        if ($valid) { $result.Icon = $valid }
      }
      if ($lnkInfo.WorkingDir -and (Test-Path $lnkInfo.WorkingDir)) {
        $searchDirs += $lnkInfo.WorkingDir
      }
    }
  }
  
  # 7) Extract search term from path/name for smart searching
  $searchTerm = $null
  if ($rawPath -match '\.([a-z0-9\-]+)(?:\.|$)') {
    $searchTerm = $Matches[1]
  } elseif ($name -match '^(\w+)') {
    $searchTerm = $Matches[1]
  }
  
  if ($searchTerm) {
    # Add common locations
    $searchDirs += @(
      "$env:LOCALAPPDATA\Programs\$searchTerm",
      "$env:LOCALAPPDATA\$searchTerm",
      "$env:PROGRAMFILES\$searchTerm",
      "${env:PROGRAMFILES(x86)}\$searchTerm",
      "$env:PROGRAMFILES\$name",
      "$env:LOCALAPPDATA\Programs\$name"
    )
  }
  
  # 8) Deep search in search directories
  if (-not $result.Icon -or -not $result.Path -or $result.Path -notmatch '\\') {
    $found = Find-AppExe $name ($searchDirs | Select-Object -Unique)
    if ($found) {
      if (-not $result.Icon) { $result.Icon = $found }
      if (-not $result.Path -or $result.Path -notmatch '\\') {
        if ($found -match '\.exe$') { $result.Path = $found }
      }
    }
  }
  
  # 9) Generate uninstall string if we found the path but no uninstall
  if (-not $result.Uninstall -and $result.Path -and (Test-Path $result.Path)) {
    $dir = Split-Path $result.Path -Parent
    
    # Look for uninstaller
    $uninstallers = Get-ChildItem $dir -Filter "*uninstall*.exe" -File -ErrorAction SilentlyContinue
    if ($uninstallers) {
      $result.Uninstall = "`"$($uninstallers[0].FullName)`""
    } else {
      # Check parent directory
      $parentDir = Split-Path $dir -Parent
      $uninstallers = Get-ChildItem $parentDir -Filter "*uninstall*.exe" -File -ErrorAction SilentlyContinue
      if ($uninstallers) {
        $result.Uninstall = "`"$($uninstallers[0].FullName)`""
      }
    }
  }
  
  # 10) Handle built-in Windows apps
  $builtInApps = @{
    'File Explorer' = @{ Path = "$env:WINDIR\explorer.exe"; Icon = "$env:WINDIR\explorer.exe"; Uninstall = 'Built-in Windows component' }
    'Control Panel' = @{ Path = "$env:WINDIR\System32\control.exe"; Icon = "$env:WINDIR\System32\control.exe"; Uninstall = 'Built-in Windows component' }
    'Windows Tools' = @{ Path = "$env:WINDIR\System32\control.exe"; Icon = "$env:WINDIR\System32\control.exe"; Uninstall = 'Built-in Windows component' }
    'Task Manager' = @{ Path = "$env:WINDIR\System32\taskmgr.exe"; Icon = "$env:WINDIR\System32\taskmgr.exe"; Uninstall = 'Built-in Windows component' }
    'Run' = @{ Path = "$env:WINDIR\System32\rundll32.exe"; Icon = "$env:WINDIR\System32\shell32.dll,24"; Uninstall = 'Built-in Windows component' }
  }
  
  if ($builtInApps.ContainsKey($name)) {
    $app = $builtInApps[$name]
    $result.Path = $app.Path
    $result.Icon = $app.Icon
    $result.Uninstall = $app.Uninstall
  }
  
  # 11) Better uninstall string generation
  if (-not $result.Uninstall -or $result.Uninstall -eq 'N/A') {
    if ($result.Path -and $result.Path -match '\\' -and (Test-Path $result.Path)) {
      $dir = Split-Path $result.Path -Parent
      
      # Look for uninstaller in same directory or parent
      $uninstallers = @()
      $uninstallers += Get-ChildItem $dir -Filter "*uninstall*.exe" -File -ErrorAction SilentlyContinue
      if (-not $uninstallers) {
        $parentDir = Split-Path $dir -Parent
        if ($parentDir) {
          $uninstallers += Get-ChildItem $parentDir -Filter "*uninstall*.exe" -File -ErrorAction SilentlyContinue
        }
      }
      
      if ($uninstallers) {
        $result.Uninstall = "`"$($uninstallers[0].FullName)`""
      } else {
        # No uninstaller found - provide manual deletion path
        $result.Uninstall = "No uninstaller found - manual deletion required"
      }
    } elseif ($rawPath -match '^https?://') {
      $result.Uninstall = "Web link - no uninstallation needed"
    } else {
      $result.Uninstall = "N/A"
    }
  }
  
  # 12) Fallbacks
  if (-not $result.Icon) {
    $result.Icon = "$env:WINDIR\System32\shell32.dll,2"
  }
  
  return $result
}

# Process all apps
$apps | ForEach-Object {
  $result = Process-App $_
  
  @"
Name:            $($result.Name)
Path:            $($result.Path)
UninstallString: $($result.Uninstall)
IconPath:        $($result.Icon)

"@
}
