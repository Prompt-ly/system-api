import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";

/**
 * Detect MIME type from file extension
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
  };
  return mimeTypes[ext.toLowerCase()] || "image/png";
}

/**
 * Resolve Appx icon path using PowerShell (handle permission issues)
 */
function resolveAppxIconPathWithPowerShell(iconPath: string): string | null {
  try {
    const dir = dirname(iconPath);
    const baseNameWithoutExt = basename(iconPath, extname(iconPath));
    const ext = extname(iconPath);

    const script = `
$ErrorActionPreference="Stop"
$dir = "${dir.replace(/\\/g, "/")}"
$base = "${baseNameWithoutExt}"
$ext = "${ext}"

# Check if exact path exists
$exactPath = "${iconPath.replace(/\\/g, "/")}"
if (Test-Path $exactPath) {
  Write-Output $exactPath
  exit 0
}

# Try to list files in directory
try {
  $files = Get-ChildItem -Path $dir -File -ErrorAction Stop | Select-Object -ExpandProperty Name
  
  # Try scale variants in order of preference (including common small sizes)
  $scales = @(400, 200, 150, 125, 100, 96, 64, 48, 40, 32, 24, 20, 16)
  foreach ($scale in $scales) {
    $patterns = @(
      "$base.scale-$scale$ext",
      "$base.targetsize-$scale$ext",
      "$base.contrast-standard_scale-$scale$ext",
      "$base.$scale$ext",
      "$base" + "_$scale$ext",
      "$base-$scale$ext"
    )
    
    foreach ($pattern in $patterns) {
      if ($files -contains $pattern) {
        Write-Output (Join-Path $dir $pattern)
        exit 0
      }
    }
  }
  
  # Find any matching file
  foreach ($file in $files) {
    if ($file.StartsWith($base) -and $file.EndsWith($ext)) {
      Write-Output (Join-Path $dir $file)
      exit 0
    }
  }
} catch {
  # If we can't list directory, try common patterns directly
  $scales = @(400, 200, 150, 125, 100, 96, 64, 48, 40, 32, 24, 20, 16)
  foreach ($scale in $scales) {
    $testPaths = @(
      (Join-Path $dir "$base.scale-$scale$ext"),
      (Join-Path $dir "$base.targetsize-$scale$ext"),
      (Join-Path $dir "$base.contrast-standard_scale-$scale$ext")
    )
    
    foreach ($testPath in $testPaths) {
      if (Test-Path $testPath) {
        Write-Output $testPath
        exit 0
      }
    }
  }
}

exit 1
`.trim();

    const result = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 1024 * 1024
    }).trim();

    return result || null;
  } catch {
    return null;
  }
}

/**
 * Resolve Appx icon path (handle scale variants like Square44x44Logo.scale-100.png)
 */
function resolveAppxIconPath(iconPath: string): string | null {
  // For WindowsApps paths, use PowerShell to avoid permission issues
  if (iconPath.includes("WindowsApps")) {
    return resolveAppxIconPathWithPowerShell(iconPath);
  }

  try {
    // If the exact path exists, use it
    if (existsSync(iconPath)) {
      return iconPath;
    }

    // Try to find scale variants
    const dir = dirname(iconPath);
    const baseNameWithoutExt = basename(iconPath, extname(iconPath));
    const ext = extname(iconPath);

    // Check if directory exists and is accessible
    if (!existsSync(dir)) {
      return null;
    }

    // Try to read directory - this might fail with permission errors for some Appx apps
    let files: string[];
    try {
      files = readdirSync(dir);
    } catch {
      // Permission denied or other error - try common scale variants directly
      const commonScales = [400, 200, 150, 125, 100];
      for (const scale of commonScales) {
        const testPaths = [
          join(dir, `${baseNameWithoutExt}.scale-${scale}${ext}`),
          join(dir, `${baseNameWithoutExt}.targetsize-${scale}${ext}`),
          join(dir, `${baseNameWithoutExt}.contrast-standard_scale-${scale}${ext}`)
        ];

        for (const testPath of testPaths) {
          if (existsSync(testPath)) {
            return testPath;
          }
        }
      }
      return null;
    }

    // Look for scale variants like: Logo.scale-100.png, Logo.scale-200.png, etc.
    const scales = [400, 200, 150, 125, 100]; // Prefer higher resolution

    for (const scale of scales) {
      const scaledName = `${baseNameWithoutExt}.scale-${scale}${ext}`;
      if (files.includes(scaledName)) {
        return join(dir, scaledName);
      }

      // Also try with targetsize
      const targetsizeName = `${baseNameWithoutExt}.targetsize-${scale}${ext}`;
      if (files.includes(targetsizeName)) {
        return join(dir, targetsizeName);
      }
    }

    // Try contrast variants
    for (const scale of scales) {
      const contrastName = `${baseNameWithoutExt}.contrast-standard_scale-${scale}${ext}`;
      if (files.includes(contrastName)) {
        return join(dir, contrastName);
      }
    }

    // Try alternate naming patterns (some apps use different patterns)
    for (const scale of scales) {
      const altNames = [
        `${baseNameWithoutExt}.${scale}${ext}`,
        `${baseNameWithoutExt}_${scale}${ext}`,
        `${baseNameWithoutExt}-${scale}${ext}`
      ];

      for (const altName of altNames) {
        if (files.includes(altName)) {
          return join(dir, altName);
        }
      }
    }

    // If no scale variant found, look for any file starting with the base name
    const matchingFile = files.find((file) => file.startsWith(baseNameWithoutExt) && file.endsWith(ext));

    return matchingFile ? join(dir, matchingFile) : null;
  } catch {
    return null;
  }
}

/**
 * Extract icon from various file types using PowerShell
 * Returns base64 string (without data URI prefix) that will be converted later
 * Supports: .exe, .dll, .ico, and file extension associations
 */
function extractIconWithPowerShell(filePath: string): string | null {
  try {
    const ext = extname(filePath).toLowerCase();

    // For .ico files, just return null and let the main function handle it
    if (ext === ".ico") {
      return null;
    }

    // PowerShell script to extract icons
    const script = `
$ErrorActionPreference="Stop"
Add-Type -AssemblyName System.Drawing

function Get-IconFromFile {
  param([string]$Path)
  
  if (-not (Test-Path $Path)) {
    return $null
  }

  try {
    # For executables and DLLs, extract the icon
    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($Path)
    if ($icon) {
      $ms = New-Object System.IO.MemoryStream
      $icon.Save($ms)
      $bytes = $ms.ToArray()
      $ms.Close()
      $icon.Dispose()
      return [Convert]::ToBase64String($bytes)
    }
  } catch {
    # If extraction fails, try to get the file type icon
    try {
      $shfi = New-Object PSObject -Property @{
        hIcon = [IntPtr]::Zero
      }
      
      # Use Shell32 to get file association icon
      Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Shell32 {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
  public struct SHFILEINFO {
    public IntPtr hIcon;
    public int iIcon;
    public uint dwAttributes;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
    public string szDisplayName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)]
    public string szTypeName;
  }
  [DllImport("shell32.dll", CharSet = CharSet.Auto)]
  public static extern IntPtr SHGetFileInfo(string pszPath, uint dwFileAttributes, ref SHFILEINFO psfi, uint cbFileInfo, uint uFlags);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool DestroyIcon(IntPtr hIcon);
}
"@
      
      $fileInfo = New-Object Shell32+SHFILEINFO
      $result = [Shell32]::SHGetFileInfo($Path, 0, [ref]$fileInfo, [System.Runtime.InteropServices.Marshal]::SizeOf($fileInfo), 0x100)
      
      if ($result -ne [IntPtr]::Zero -and $fileInfo.hIcon -ne [IntPtr]::Zero) {
        $icon = [System.Drawing.Icon]::FromHandle($fileInfo.hIcon)
        $ms = New-Object System.IO.MemoryStream
        $icon.Save($ms)
        $bytes = $ms.ToArray()
        $ms.Close()
        [Shell32]::DestroyIcon($fileInfo.hIcon)
        $icon.Dispose()
        return [Convert]::ToBase64String($bytes)
      }
    } catch {}
  }
  
  return $null
}

Get-IconFromFile -Path "${filePath.replace(/\\/g, "\\\\")}"
`.trim();

    const result = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 10
    }).trim();

    // PowerShell returns base64 for .ico format, add data URI prefix
    if (result) {
      return `data:image/x-icon;base64,${result}`;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Read a file and convert it to base64 data URI
 * Used for direct file reading (like .ico, .png, etc.)
 * For WindowsApps files, falls back to PowerShell if direct read fails
 */
function fileToBase64DataURI(filePath: string): string | null {
  try {
    // Try to resolve Appx icon path variants
    const resolvedPath = resolveAppxIconPath(filePath);
    if (!resolvedPath) return null;

    // For WindowsApps paths, use PowerShell directly (permission issues)
    if (filePath.includes("WindowsApps") || resolvedPath.includes("WindowsApps")) {
      return fileToBase64DataURIWithPowerShell(resolvedPath);
    }

    const buffer = readFileSync(resolvedPath);
    const ext = extname(resolvedPath);
    const mimeType = getMimeType(ext);
    const base64 = buffer.toString("base64");

    return `data:${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}

/**
 * Read file using PowerShell (can access WindowsApps folder)
 */
function fileToBase64DataURIWithPowerShell(filePath: string): string | null {
  try {
    const ext = extname(filePath);
    const mimeType = getMimeType(ext);

    // Normalize path - PowerShell handles forward slashes fine
    const normalizedPath = filePath.replace(/\\/g, "/");

    const script = `
    $ErrorActionPreference="Stop"
    try {
      $bytes = [System.IO.File]::ReadAllBytes("${normalizedPath}")
      [Convert]::ToBase64String($bytes)
    } catch {
      exit 1
    }
    `.trim();

    const result = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 10
    }).trim();

    if (result) {
      return `data:${mimeType};base64,${result}`;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Main icon extraction function
 * Handles different file types and extraction methods
 */
export function extractIconAsBase64(filePath: string | undefined | null): string | null {
  if (!filePath || !filePath.trim()) {
    return null;
  }

  const cleanPath = filePath.trim();

  // For WindowsApps paths, skip existsSync check (will be resolved later)
  const isWindowsApps = cleanPath.includes("WindowsApps");

  if (!isWindowsApps && !existsSync(cleanPath)) {
    return null;
  }

  const ext = extname(cleanPath).toLowerCase();

  // For image files, read directly (or resolve and read for Appx)
  const imageExtensions = [".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp", ".svg"];
  if (imageExtensions.includes(ext)) {
    return fileToBase64DataURI(cleanPath);
  }

  // For .ico files, read directly
  if (ext === ".ico") {
    return fileToBase64DataURI(cleanPath);
  }

  // For executables, DLLs, and other files, use PowerShell extraction
  const executableExtensions = [".exe", ".dll", ".cpl", ".ocx", ".scr"];
  if (executableExtensions.includes(ext)) {
    return extractIconWithPowerShell(cleanPath);
  }

  // For other files, try to get the file type icon using PowerShell
  return extractIconWithPowerShell(cleanPath);
}
