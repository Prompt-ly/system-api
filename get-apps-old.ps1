# PowerShell 5+ (Windows 10/11)
# Output: multiline per app (spaced for readability)

$ErrorActionPreference = 'SilentlyContinue'

function Resolve-AppxLogo {
  param(
    [Parameter(Mandatory)]
    [string] $InstallLocation,
    [Parameter(Mandatory)]
    [string] $LogoPath
  )
  $p = Join-Path $InstallLocation $LogoPath
  $dir = Split-Path $p -Parent
  $base = [System.IO.Path]::GetFileNameWithoutExtension($p)
  $ext = [System.IO.Path]::GetExtension($p)
  $scales = 32, 48, 64, 96, 100, 125, 150, 200, 400
  $patterns = @(
    '{0}.scale-{1}{2}',
    '{0}.targetsize-{1}{2}',
    '{0}.contrast-standard_scale-{1}{2}',
    '{0}.{1}{2}',
    '{0}_{1}{2}',
    '{0}-{1}{2}'
  )
  if (Test-Path $p) { return $p }
  foreach ($s in $scales) {
    foreach ($fmt in $patterns) {
      $candidate = Join-Path $dir ($fmt -f $base, $s, $ext)
      if (Test-Path $candidate) { return $candidate }
    }
  }
  $first = Get-ChildItem -LiteralPath $dir -File |
    Where-Object { $_.Name -like "$base*" -and $_.Extension -eq $ext } |
    Select-Object -First 1
  if ($first) { return $first.FullName }
  return $null
}

function Get-AppxLogoFromManifest {
  param([Parameter(Mandatory)][string] $InstallLocation)
  $manifest = Join-Path $InstallLocation 'AppxManifest.xml'
  if (!(Test-Path $manifest)) { return $null }
  try { $xml = [xml](Get-Content -LiteralPath $manifest -Raw) } catch {
    return $null
  }
  $mgr = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
  $mgr.AddNamespace('uap', 'http://schemas.microsoft.com/appx/manifest/uap/windows10')
  $mgr.AddNamespace('m3', 'http://schemas.microsoft.com/appx/2014/manifest')
  $mgr.AddNamespace(
    'uap2',
    'http://schemas.microsoft.com/appx/manifest/uap/windows10/2'
  )
  $visual = $xml.Package.Applications.Application.VisualElements
  if (-not $visual) {
    $visual = $xml.SelectSingleNode('//uap:VisualElements', $mgr)
    if (-not $visual) { $visual = $xml.SelectSingleNode('//m3:VisualElements', $mgr) }
    if (-not $visual) { $visual = $xml.SelectSingleNode('//uap2:VisualElements', $mgr) }
  }
  if ($visual -and $visual.Logo) {
    $logo = $visual.Logo
  } else {
    $logo = 'Assets\Square150x150Logo.png'
  }
  return Resolve-AppxLogo -InstallLocation $InstallLocation -LogoPath $logo
}

function Get-UninstallIndex {
  $roots = @(
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
  )
  $entries = foreach ($root in $roots) {
    if (Test-Path $root) {
      Get-ChildItem $root | ForEach-Object {
        try {
          $p = Get-ItemProperty $_.PsPath
          if ($p.DisplayName) {
            [pscustomobject]@{
              DisplayName     = $p.DisplayName
              DisplayIcon     = $p.DisplayIcon
              InstallLocation = $p.InstallLocation
              UninstallString = $p.UninstallString
              KeyPath         = $_.PsPath
            }
          }
        } catch {}
      }
    }
  }
  $idx = @{ ByExe = @{}; ByDir = @{}; ByName = @{} }
  foreach ($e in $entries) {
    if ($e.DisplayIcon) {
      $iconPath = $e.DisplayIcon -replace '^\s*"', '' -replace '"\s*$', ''
      $iconPath = $iconPath.Split(',')[0]
      if ([System.IO.Path]::IsPathRooted($iconPath)) {
        if (-not $idx.ByExe.ContainsKey($iconPath)) { $idx.ByExe[$iconPath] = @() }
        $idx.ByExe[$iconPath] += $e
      }
    }
    if ($e.InstallLocation) {
      $dir = $e.InstallLocation.TrimEnd('\')
      if (-not $idx.ByDir.ContainsKey($dir)) { $idx.ByDir[$dir] = @() }
      $idx.ByDir[$dir] += $e
    }
    if ($e.DisplayName) {
      if (-not $idx.ByName.ContainsKey($e.DisplayName)) {
        $idx.ByName[$e.DisplayName] = @()
      }
      $idx.ByName[$e.DisplayName] += $e
    }
  }
  return $idx
}

function Get-ShortcutInfo {
  param([Parameter(Mandatory)][string] $LnkPath)
  $w = New-Object -ComObject WScript.Shell
  $s = $w.CreateShortcut($LnkPath)
  $target = $s.TargetPath
  $args = $s.Arguments
  $icon = $s.IconLocation
  $iconPath = $null
  if ($icon) {
    $iconPath = ($icon.Split(',')[0]).Trim('"')
    if (
      -not [string]::IsNullOrWhiteSpace($iconPath) -and
      -not (Test-Path $iconPath) -and (Test-Path $target)
    ) {
      $iconPath = $target
    }
  } elseif (Test-Path $target) { $iconPath = $target }
  [pscustomobject]@{
    Name     = [System.IO.Path]::GetFileNameWithoutExtension($LnkPath)
    Location = $target
    Args     = $args
    IconPath = $iconPath
    LinkPath = $LnkPath
  }
}

function Get-DesktopStartMenuApps {
  $paths = @(
    "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
    "$env:AppData\Microsoft\Windows\Start Menu\Programs"
  )
  $links = foreach ($p in $paths) {
    if (Test-Path $p) {
      Get-ChildItem -LiteralPath $p -Recurse -Filter *.lnk -File
    }
  }
  foreach ($lnk in $links) { Get-ShortcutInfo -LnkPath $lnk.FullName }
}

function Get-UwpStartApps {
  $apps = $null
  try { $apps = Get-StartApps } catch { $apps = @() }
  foreach ($a in $apps) {
    $name = $a.Name
    $appId = $a.AppID
    if (-not $appId) { continue }
    if ($appId -like '*!*') {
      $pfn = $appId.Split('!')[0]
      $pkg = Get-AppxPackage -PackageFamilyName $pfn
      if (-not $pkg) { continue }
      $install = $pkg.InstallLocation
      $logo = Get-AppxLogoFromManifest -InstallLocation $install
      [pscustomobject]@{
        Name            = $name
        Location        = $install
        UninstallString = if ($pkg.PackageFullName) {
          "powershell -NoProfile -Command Remove-AppxPackage '$($pkg.PackageFullName)'"
        } else { $null }
        IconPath        = $logo
      }
    }
  }
}

function Get-AllStartMenuAppsInfo {
  $uninstallIdx = Get-UninstallIndex
  $desktop = Get-DesktopStartMenuApps | ForEach-Object {
    $loc = $_.Location
    $icon = $_.IconPath
    $uninstall = $null
    if ($loc -and $uninstallIdx.ByExe.ContainsKey($loc)) {
      $uninstall = ($uninstallIdx.ByExe[$loc] | Select-Object -First 1)
      $uninstall = $uninstall.UninstallString
    } elseif ($icon -and $uninstallIdx.ByExe.ContainsKey($icon)) {
      $uninstall = ($uninstallIdx.ByExe[$icon] | Select-Object -First 1)
      $uninstall = $uninstall.UninstallString
    } elseif ($loc) {
      $dir = Split-Path $loc -Parent
      if ($dir -and $uninstallIdx.ByDir.ContainsKey($dir)) {
        $uninstall = ($uninstallIdx.ByDir[$dir] | Select-Object -First 1)
        $uninstall = $uninstall.UninstallString
      }
    }
    if (-not $uninstall -and $_.Name -and $uninstallIdx.ByName.ContainsKey($_.Name)) {
      $uninstall = ($uninstallIdx.ByName[$($_.Name)] | Select-Object -First 1)
      $uninstall = $uninstall.UninstallString
    }
    [pscustomobject]@{
      Name            = $_.Name
      Location        = $loc
      UninstallString = $uninstall
      IconPath        = $icon
    }
  }
  $uwp = Get-UwpStartApps
  $all = @()
  if ($desktop) { $all += $desktop }
  if ($uwp) { $all += $uwp }
  $all | Sort-Object Name, Location -Unique
}

Get-AllStartMenuAppsInfo |
  ForEach-Object {
    @"
Name: $($_.Name)
Location: $($_.Location)
UninstallString: $($_.UninstallString)
IconPath: $($_.IconPath)


"@
  } | Write-Output