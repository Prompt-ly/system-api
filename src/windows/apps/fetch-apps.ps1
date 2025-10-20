#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'SilentlyContinue'

function New-JsonObject($Type, $Id, $Icon, $Name, $Launch) {
  [pscustomobject]@{ id = $Id; name = $Name; type = $Type; icon = $Icon; launch = $Launch }
}

function Get-UwpAppIcons([string]$PackageName) {
  function Find-BestIcon($SearchDir, $IconName, $SubdirHint) {
    if (-not (Test-Path $SearchDir)) { return $null }
    Get-ChildItem -LiteralPath $SearchDir -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $_.BaseName -like "*$IconName*" -and $_.Extension -in '.png','.ico' } |
      Sort-Object {
        $score = 0
        if ($SubdirHint -and ($_.Directory.Name -eq $SubdirHint -or $_.Directory.Parent.Name -eq $SubdirHint)) { $score += 1000 }
        if ($_.Name -match '(?:targetsize|scale)-(\d+)') { $score += [int]$matches[1] }
        $score
      } -Descending | Select-Object -First 1
  }

  function Get-BestScaleAsset($InstallLocation, $RelativePath) {
    $rel = $RelativePath -replace '/', '\\'
    $basePath = Join-Path $InstallLocation $rel
    if (Test-Path -LiteralPath $basePath) { return (Resolve-Path -LiteralPath $basePath).Path }

    $dir = Split-Path $basePath -Parent
    $name = [System.IO.Path]::GetFileNameWithoutExtension((Split-Path $basePath -Leaf))
    $subdirHint = ($RelativePath -split '[/\\]')[0]
    $fallbackPaths = @((Join-Path $InstallLocation 'Assets'), (Join-Path $InstallLocation 'assets'), $InstallLocation)

    if (Test-Path -LiteralPath $dir) {
      foreach ($pattern in @("$name.scale-*.png", "$name.targetsize-*.*", "$name.scale-*.*", "$name.*")) {
        $candidates = Get-ChildItem -LiteralPath $dir -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -like $pattern }
        if ($candidates) {
          return ($candidates | Sort-Object { if ($_.Name -match '(?:targetsize|scale)-(\d+)') { [int]$matches[1] } else { 0 } } -Descending | Select-Object -First 1).FullName
        }
      }
      $found = Find-BestIcon $dir $name $subdirHint
      if ($found) { return $found.FullName }
    }

    foreach ($fallbackDir in $fallbackPaths) {
      $ico = Get-ChildItem -LiteralPath $fallbackDir -File -Filter '*.ico' -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($ico) { return $ico.FullName }
      $found = Find-BestIcon $fallbackDir $name $subdirHint
      if ($found) { return $found.FullName }
      foreach ($commonName in @('AppList', 'Square44x44Logo', 'Square150x150Logo', 'Logo')) {
        $found = Find-BestIcon $fallbackDir $commonName $subdirHint
        if ($found) { return $found.FullName }
      }
    }
    return $null
  }

  $pkg = Get-AppxPackage -Name $PackageName -ErrorAction Stop
  $manifestPath = Join-Path $pkg.InstallLocation 'AppxManifest.xml'
  if (-not (Test-Path -LiteralPath $manifestPath)) { throw "AppxManifest not found" }

  [xml]$xml = Get-Content -LiteralPath $manifestPath
  $nsm = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
  $nsm.AddNamespace('ns', $xml.DocumentElement.NamespaceURI)
  foreach ($prefix in 'uap','uap2','uap3','uap4','uap5','uap6','uap7','uap10') {
    try { $uri = $xml.DocumentElement.GetNamespaceOfPrefix($prefix); if ($uri) { $nsm.AddNamespace($prefix, $uri) } } catch {}
  }

  $apps = $xml.SelectNodes('/ns:Package/ns:Applications/ns:Application', $nsm)
  if (-not $apps) { return @() }

  $results = @()
  foreach ($app in $apps) {
    $appId = $app.GetAttribute('Id')
    $aumid = "$($pkg.PackageFamilyName)!$appId"
    $ve = $app.SelectSingleNode('uap:VisualElements', $nsm)
    if (-not $ve) { $ve = $app.SelectSingleNode('VisualElements', $nsm) }

    $iconRel = $null
    if ($ve) {
      $iconRel = $ve.GetAttribute('Square44x44Logo')
      if ([string]::IsNullOrWhiteSpace($iconRel)) { $iconRel = $ve.GetAttribute('Logo') }
    }

    $iconPath = $null
    if (-not [string]::IsNullOrWhiteSpace($iconRel) -and -not ($iconRel -like 'ms-resource:*')) {
      $iconPath = Get-BestScaleAsset $pkg.InstallLocation $iconRel
    }

    $results += [PSCustomObject]@{
      PackageName = $pkg.Name; PackageFamilyName = $pkg.PackageFamilyName
      AUMID = $aumid; ApplicationId = $appId; IconPath = $iconPath
    }
  }
  return $results
}

function Parse-LnkShortcut($Path) {
  try {
    $wsh = New-Object -ComObject WScript.Shell
    $lnk = $wsh.CreateShortcut($Path)
    $iconPath = $null; $iconIndex = 0
    if ($lnk.IconLocation) {
      $parts = $lnk.IconLocation -split ',', 2
      $iconPath = $parts[0]
      if ($parts.Count -gt 1) { [void][int]::TryParse($parts[1], [ref]$iconIndex) }
    }
    [pscustomobject]@{
      Type = 'lnk'; Path = $Path; Target = $lnk.TargetPath; Arguments = $lnk.Arguments
      WorkingDir = $lnk.WorkingDirectory; IconPath = $iconPath; IconIndex = $iconIndex
      Description = $lnk.Description; Hotkey = $lnk.Hotkey
    }
  } catch { $null }
}

function Parse-UrlShortcut($Path) {
  try { $content = Get-Content -LiteralPath $Path -ErrorAction Stop } catch { return $null }
  $props = @{}
  foreach ($line in $content) {
    if ($line -match '^\s*([^;].*?)\s*=\s*(.*)\s*$') { $props[$matches[1]] = $matches[2] }
  }
  [pscustomobject]@{ Type = 'url'; Path = $Path; URL = $props['URL']; IconFile = $props['IconFile'] }
}

function Get-StartMenuParsed {
  $dirs = @("$env:ProgramData\Microsoft\Windows\Start Menu\Programs", "$env:AppData\Microsoft\Windows\Start Menu\Programs")
  Get-ChildItem -LiteralPath $dirs -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -in '.lnk','.url' } |
    ForEach-Object {
      if ($_.Extension -eq '.lnk') { Parse-LnkShortcut $_.FullName }
      elseif ($_.Extension -eq '.url') { Parse-UrlShortcut $_.FullName }
    } | Where-Object { $_ }
}

function Get-StartAppsMap {
  $map = @{}
  try {
    Get-StartApps | ForEach-Object { $map[$_.Name] = $_.AppID; $map[$_.AppID] = $_.AppID }
  } catch { }
  return $map
}

function Expand-EnvPath($Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { return $Path }
  [System.Environment]::ExpandEnvironmentVariables($Path)
}

function Resolve-IconPath($Primary, $Fallback) {
  $Primary = Expand-EnvPath $Primary
  $Fallback = Expand-EnvPath $Fallback
  if ($Primary -and (Test-Path $Primary)) { return $Primary }
  if ($Fallback -and (Test-Path $Fallback)) { return $Fallback }
  if ($Primary) { return $Primary }
  return $Fallback
}

function Normalize-DesktopId($Name, $ExePath, $Aumid) {
  if ($Aumid) { return $Aumid }
  if ($ExePath) {
    $file = [IO.Path]::GetFileNameWithoutExtension($ExePath)
    $vendor = ([IO.Path]::GetDirectoryName($ExePath) -split '[\\/]' | Select-Object -Last 2) -join '.'
    return ($vendor + '.' + $file).ToLowerInvariant()
  }
  if ($Name) { return ($Name -replace '[^\w\.]+','-').ToLowerInvariant() }
  [Guid]::NewGuid().Guid
}

function Make-UrlId($Url) {
  if (-not $Url) { return [Guid]::NewGuid().Guid }
  try {
    $u = [Uri]$Url
    if ($u.Scheme -in @('http','https')) {
      $seg = ($u.AbsolutePath.Trim('/').Split('/') | Where-Object { $_ } | Select-Object -First 1)
      if ($seg -match '^\d+$') { return ($u.Host.Split('.')[-2] + '-' + $seg).ToLowerInvariant() }
      return ($u.Host.Split('.')[-2] + '-' + ($seg -replace '[^\w]+','-')).ToLowerInvariant()
    }
    return (($u.OriginalString -replace '[:/\\?&=#]+','-').Trim('-')).ToLowerInvariant()
  } catch {
    return ($Url -replace '[:/\\?&=#]+','-').ToLowerInvariant()
  }
}

function Find-SystemExe($FileName) {
  if ([string]::IsNullOrWhiteSpace($FileName)) { return $null }
  foreach ($path in @("C:\Windows\System32", "C:\Windows\SysWOW64", "$env:SystemRoot\System32", "$env:SystemRoot\SysWOW64")) {
    $fullPath = Join-Path $path $FileName
    if (Test-Path $fullPath) { return $fullPath }
  }
  return $null
}

function Resolve-DesktopAppIcon($Name, $AppId, $ParsingPath, $Link, $LnkMatch) {
  $targetExe = $null; $iconPath = $null

  if ($Link) { try { $iconIndex = 0; $iconPath = $Link.GetIconLocation([ref]$iconIndex) } catch { } }
  if ($LnkMatch) {
    if (-not $targetExe) { $targetExe = $LnkMatch.Target }
    if (-not $iconPath -and $LnkMatch.IconPath) { $iconPath = $LnkMatch.IconPath }
    if (-not $iconPath -and $LnkMatch.Target) { $iconPath = $LnkMatch.Target }
  }
  if (-not $targetExe -and $ParsingPath -and (Test-Path $ParsingPath)) { $targetExe = $ParsingPath }

  $id = Normalize-DesktopId $Name $targetExe $AppId

  if (-not $targetExe -and -not $iconPath -and $id -match '\\([^\\]+\.(exe|msc|chm|dll))$') {
    $foundPath = Find-SystemExe $matches[1]
    if ($foundPath) { $targetExe = $foundPath; $iconPath = $foundPath }
  }

  return @{ Id = $id; Icon = (Resolve-IconPath $iconPath $targetExe); Location = $targetExe }
}

# Skip items whose location ends with unwanted extensions (case-insensitive)
function Should-SkipByExtension([string]$Location) {
  if (-not $Location) { return $false }
  $loc = $Location.ToLowerInvariant()
  return $loc -match '\.(chm|txt|url|html)$'
}

# Skip items whose display name indicates uninstallers
function Should-SkipByName([string]$Name) {
  if (-not $Name) { return $false }
  $n = $Name.ToLowerInvariant()
  return $n -match 'uninstall'
}

# Main execution
$startParsed = Get-StartMenuParsed
$startAppsMap = Get-StartAppsMap
$lnkByName = @{}; $urls = @()
foreach ($item in $startParsed) {
  if ($item.Type -eq 'lnk') { $lnkByName[[IO.Path]::GetFileNameWithoutExtension($item.Path)] = $item }
  elseif ($item.Type -eq 'url') { $urls += $item }
}

$shell = New-Object -ComObject Shell.Application
$folder = $shell.NameSpace('shell:::{4234d49b-0245-4df3-b780-3893943456e1}')
$appItems = @($folder.Items())
$result = New-Object System.Collections.Generic.List[object]

# Build caches to avoid repeated expensive calls
$pkgByPFM = @{}
$pkgByName = @{}
try {
  $allPkgs = Get-AppxPackage -ErrorAction SilentlyContinue
  foreach ($p in $allPkgs) { $pkgByPFM[$p.PackageFamilyName] = $p; $pkgByName[$p.Name] = $p }
} catch {}
try {
  $allPkgsAllUsers = Get-AppxPackage -AllUsers -ErrorAction SilentlyContinue
  foreach ($p in $allPkgsAllUsers) { if (-not $pkgByPFM.ContainsKey($p.PackageFamilyName)) { $pkgByPFM[$p.PackageFamilyName] = $p }; if (-not $pkgByName.ContainsKey($p.Name)) { $pkgByName[$p.Name] = $p } }
} catch {}

$uwpIconCache = @{}
function Get-UwpIconsCached($pkgName) {
  if ([string]::IsNullOrWhiteSpace($pkgName)) { return @() }
  if ($uwpIconCache.ContainsKey($pkgName)) { return $uwpIconCache[$pkgName] }
  try { $icons = Get-UwpAppIcons $pkgName } catch { $icons = @() }
  $uwpIconCache[$pkgName] = $icons
  return $icons
}

# Resolve system default browser icon
# Default browser icon helpers removed per requirements

foreach ($it in $appItems) {
  $name = $it.Name
  $parsingPath = $it.Path
  $link = try { $it.GetLink() } catch { $null }

  if (Should-SkipByName $name) { continue }

  $appId = $null
  if ($startAppsMap.ContainsKey($name)) { $appId = $startAppsMap[$name] }
  elseif ($startAppsMap.ContainsKey($parsingPath)) { $appId = $startAppsMap[$parsingPath] }

  $isUwp = ($appId -and $appId -match '.+!.+') -or ($parsingPath -like 'shell:AppsFolder\*!*')
  $urlMatch = $urls | Where-Object { [IO.Path]::GetFileNameWithoutExtension($_.Path) -eq $name } | Select-Object -First 1
  $isUrl = $null -ne $urlMatch

  $type = 'desktop'; $id = $null; $iconPath = $null; $location = $null

  if ($isUwp) {
    $type = 'uwp'
    $aumid = $appId
    if (-not $aumid -and $parsingPath -like 'shell:AppsFolder\*!*') {
      $aumid = $parsingPath.Replace('shell:AppsFolder\','')
    }

    if ($aumid) {
      $pfm = ($aumid -split '!')[0]
      $pkg = if ($pkgByPFM.ContainsKey($pfm)) { $pkgByPFM[$pfm] } else { $null }

      if ($pkg) {
        $icons = Get-UwpIconsCached $pkg.Name
        $match = $icons | Where-Object { $_.AUMID -eq $aumid } | Select-Object -First 1
        if ($match -and $match.IconPath) { $iconPath = $match.IconPath }
        $id = $pkg.Name
      } else { $id = $aumid }
      
      $location = $aumid
    } else { $id = $parsingPath; $location = $parsingPath }
  }
  elseif ($isUrl) {
    $type = 'url'
    $id = Make-UrlId $urlMatch.URL
    $location = $urlMatch.URL
    $iconPath = $urlMatch.IconFile
  }
  else {
    $resolved = Resolve-DesktopAppIcon $name $appId $parsingPath $link $lnkByName[$name]
    $id = $resolved.Id; $iconPath = $resolved.Icon; $location = $resolved.Location
  }

  if (Should-SkipByExtension $location) { continue }

  $result.Add((New-JsonObject $type $id $iconPath $name $location)) | Out-Null
}

# Add URL shortcuts not in AppsFolder
foreach ($u in $urls) {
  $name = [IO.Path]::GetFileNameWithoutExtension($u.Path)
  if (Should-SkipByName $name) { continue }
  if (-not ($result | Where-Object { $_.name -eq $name })) {
    $id = Make-UrlId $u.URL
    $iconPath = $u.IconFile
    $result.Add((New-JsonObject 'url' $id $iconPath $name $u.URL)) | Out-Null
  }
}

$result | ConvertTo-Json -Depth 6 -Compress
