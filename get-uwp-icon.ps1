function Get-UwpAppIcons {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [string]$PackageName
  )

  function Get-BestScaleAsset {
    param(
      [Parameter(Mandatory = $true)]
      [string]$InstallLocation,
      [Parameter(Mandatory = $true)]
      [string]$RelativePath
    )

    # Normalize slashes and combine
    $rel = $RelativePath -replace '/', '\'
    $basePath = Join-Path $InstallLocation $rel

    # If the exact file exists, prefer it
    if (Test-Path -LiteralPath $basePath) {
      return (Resolve-Path -LiteralPath $basePath).Path
    }

    # Try to resolve scale-qualifiers (e.g., foo.scale-400.png)
    $dir = Split-Path $basePath -Parent
    $file = Split-Path $basePath -Leaf
    $name = [System.IO.Path]::GetFileNameWithoutExtension($file)
    $ext = [System.IO.Path]::GetExtension($file)

    if (-not (Test-Path -LiteralPath $dir)) {
      return $null
    }

    $pattern = "$name.scale-*.png"
    $candidates = Get-ChildItem -LiteralPath $dir -File -ErrorAction SilentlyContinue |
      Where-Object {
        $_.Name -like $pattern -or $_.Name -ieq $file
      }

    if (-not $candidates) {
      # Also try without forcing .png (some apps might use .jpg)
      $patternAnyExt = "$name.scale-*.*"
      $candidates = Get-ChildItem -LiteralPath $dir -File -ErrorAction SilentlyContinue |
        Where-Object {
          $_.Name -like $patternAnyExt -or $_.Name -ieq $file
        }
    }

    if (-not $candidates) {
      return $null
    }

    # Pick the highest scale if available
    $best = $candidates |
      Sort-Object -Property @{
        Expression = {
          if ($_.Name -match '\.scale-(\d+)\.') { [int]$matches[1] } else { 0 }
        }
        Descending = $true
      } |
      Select-Object -First 1

    return $best.FullName
  }

  $pkg = Get-AppxPackage -Name $PackageName -ErrorAction Stop
  $install = $pkg.InstallLocation
  $manifestPath = Join-Path $install 'AppxManifest.xml'
  if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "AppxManifest not found at $manifestPath"
  }

  [xml]$xml = Get-Content -LiteralPath $manifestPath

  # Prepare namespace manager (uap/uap3/uap5 etc. are common)
  $nsm = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
  $nsm.AddNamespace('ns', $xml.DocumentElement.NamespaceURI)

  # Capture common UAP namespaces if present
  foreach ($prefix in 'uap','uap2','uap3','uap4','uap5','uap6','uap7','uap10') {
    try {
      $uri = $xml.DocumentElement.GetNamespaceOfPrefix($prefix)
      if ($uri) { $nsm.AddNamespace($prefix, $uri) }
    } catch {}
  }

  # Select all Application nodes
  $apps = $xml.SelectNodes('/ns:Package/ns:Applications/ns:Application', $nsm)
  if (-not $apps) {
    return @()
  }

  $results = @()

  foreach ($app in $apps) {
    $appId = $app.GetAttribute('Id')
    $aumid = "$($pkg.PackageFamilyName)!$appId"

    # Try uap:VisualElements first, then legacy VisualElements
    $ve = $app.SelectSingleNode('uap:VisualElements', $nsm)
    if (-not $ve) { $ve = $app.SelectSingleNode('VisualElements', $nsm) }

    # Determine icon attribute preference:
    # Prefer Square44x44Logo (small tile/app list icon), fallback to Logo
    $iconRel = $null
    if ($ve) {
      $iconRel = $ve.GetAttribute('Square44x44Logo')
      if ([string]::IsNullOrWhiteSpace($iconRel)) {
        $iconRel = $ve.GetAttribute('Logo')
      }
    }

    # If no VisualElements or attribute, leave icon null
    $iconPath = $null
    if (-not [string]::IsNullOrWhiteSpace($iconRel) -and
        -not ($iconRel -like 'ms-resource:*')) {
      $iconPath = Get-BestScaleAsset -InstallLocation $install -RelativePath $iconRel
    }

    $results += [PSCustomObject]@{
      PackageName       = $pkg.Name
      PackageFamilyName = $pkg.PackageFamilyName
      AUMID             = $aumid
      ApplicationId     = $appId
      IconPath          = $iconPath
    }
  }

  return $results
}