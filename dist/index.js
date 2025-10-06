var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// src/windows/windows.ts
var exports_windows = {};
__export(exports_windows, {
  createAppIcon: () => createAppIcon,
  Process: () => Process,
  Apps: () => Apps
});

// src/windows/apps/apps.ts
import { execFileSync as execFileSync2 } from "node:child_process";

// src/windows/apps/icon-extractor.ts
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
function getMimeType(ext) {
  const mimeTypes = {
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
function resolveAppxIconPathWithPowerShell(iconPath) {
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
function resolveAppxIconPath(iconPath) {
  if (iconPath.includes("WindowsApps")) {
    return resolveAppxIconPathWithPowerShell(iconPath);
  }
  try {
    if (existsSync(iconPath)) {
      return iconPath;
    }
    const dir = dirname(iconPath);
    const baseNameWithoutExt = basename(iconPath, extname(iconPath));
    const ext = extname(iconPath);
    if (!existsSync(dir)) {
      return null;
    }
    let files;
    try {
      files = readdirSync(dir);
    } catch {
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
    const scales = [400, 200, 150, 125, 100];
    for (const scale of scales) {
      const scaledName = `${baseNameWithoutExt}.scale-${scale}${ext}`;
      if (files.includes(scaledName)) {
        return join(dir, scaledName);
      }
      const targetsizeName = `${baseNameWithoutExt}.targetsize-${scale}${ext}`;
      if (files.includes(targetsizeName)) {
        return join(dir, targetsizeName);
      }
    }
    for (const scale of scales) {
      const contrastName = `${baseNameWithoutExt}.contrast-standard_scale-${scale}${ext}`;
      if (files.includes(contrastName)) {
        return join(dir, contrastName);
      }
    }
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
    const matchingFile = files.find((file) => file.startsWith(baseNameWithoutExt) && file.endsWith(ext));
    return matchingFile ? join(dir, matchingFile) : null;
  } catch {
    return null;
  }
}
function extractIconWithPowerShell(filePath) {
  try {
    const ext = extname(filePath).toLowerCase();
    if (ext === ".ico") {
      return null;
    }
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
    if (result) {
      return `data:image/x-icon;base64,${result}`;
    }
    return null;
  } catch {
    return null;
  }
}
function fileToBase64DataURI(filePath) {
  try {
    const resolvedPath = resolveAppxIconPath(filePath);
    if (!resolvedPath)
      return null;
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
function fileToBase64DataURIWithPowerShell(filePath) {
  try {
    const ext = extname(filePath);
    const mimeType = getMimeType(ext);
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
function extractIconAsBase64(filePath) {
  if (!filePath || !filePath.trim()) {
    return null;
  }
  const cleanPath = filePath.trim();
  const isWindowsApps = cleanPath.includes("WindowsApps");
  if (!isWindowsApps && !existsSync(cleanPath)) {
    return null;
  }
  const ext = extname(cleanPath).toLowerCase();
  const imageExtensions = [".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp", ".svg"];
  if (imageExtensions.includes(ext)) {
    return fileToBase64DataURI(cleanPath);
  }
  if (ext === ".ico") {
    return fileToBase64DataURI(cleanPath);
  }
  const executableExtensions = [".exe", ".dll", ".cpl", ".ocx", ".scr"];
  if (executableExtensions.includes(ext)) {
    return extractIconWithPowerShell(cleanPath);
  }
  return extractIconWithPowerShell(cleanPath);
}

// src/windows/apps/app-icon.ts
function createAppIcon(path) {
  let cachedBase64 = null;
  let loadPromise = null;
  return {
    path,
    getBase64: async () => {
      if (cachedBase64 !== null) {
        return cachedBase64;
      }
      if (loadPromise) {
        return loadPromise;
      }
      loadPromise = (async () => {
        try {
          const base64 = extractIconAsBase64(path);
          cachedBase64 = base64 ?? "";
          return cachedBase64;
        } catch {
          cachedBase64 = "";
          return "";
        } finally {
          loadPromise = null;
        }
      })();
      return loadPromise;
    }
  };
}

// src/windows/apps/apps.ts
function hashStringToNumber(str) {
  let hash = 0;
  for (let i = 0;i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const n = Math.abs(hash);
  return n === 0 ? 1 : n;
}
function cleanIconPath(path) {
  let s = (path || "").trim();
  const lastComma = s.lastIndexOf(",");
  if (lastComma !== -1) {
    const right = s.slice(lastComma + 1).trim();
    if (/^-?\d+$/.test(right)) {
      s = s.slice(0, lastComma).trim();
    }
  }
  if (s.startsWith('"') && s.endsWith('"') || s.startsWith("'") && s.endsWith("'")) {
    s = s.slice(1, -1);
  }
  return s;
}
var ps = (script) => execFileSync2("powershell.exe", ["-NoProfile", "-Command", script], {
  encoding: "utf8",
  windowsHide: true,
  maxBuffer: 1024 * 1024 * 64
}).trim();
var script = `
$ErrorActionPreference="SilentlyContinue"

function Get-IconFromLnk($p){
  try{
    $sh=New-Object -ComObject WScript.Shell
    $lnk=$sh.CreateShortcut($p)
    if([string]::IsNullOrWhiteSpace($lnk.IconLocation)){
      return $lnk.TargetPath
    } else {
      return ($lnk.IconLocation -split ",")[0]
    }
  }catch{ return $null }
}

function Get-TargetFromLnk($p){
  try{
    $sh=New-Object -ComObject WScript.Shell
    $lnk=$sh.CreateShortcut($p)
    return $lnk.TargetPath
  }catch{ return $null }
}

function Get-IconFromUrl($p){
  try{
    $content=Get-Content $p -ErrorAction SilentlyContinue
    foreach($line in $content){
      if($line -match '^IconFile=(.+)$'){
        return $matches[1]
      }
    }
    return $null
  }catch{ return $null }
}

function Get-TargetFromUrl($p){
  try{
    $content=Get-Content $p -ErrorAction SilentlyContinue
    foreach($line in $content){
      if($line -match '^URL=(.+)$'){
        return $matches[1]
      }
    }
    return $null
  }catch{ return $null }
}

function Get-Appx {
  Get-AppxPackage | ForEach-Object {
    $m=Get-AppxPackageManifest -Package $_ -ErrorAction SilentlyContinue
    $d=$null; $icon=$null; $pub=$_.Publisher; $displayName=$_.Name
    if($m){
      $d=$m.Package.Properties.Description
      $icons=$m.Package.Applications.Application.VisualElements
      if($icons){
        $logo=$icons.Square44x44Logo
        if($logo){
          # Clean logo path: some manifests have duplicate paths with spaces
          # Take only the first part before any space
          $cleanLogo = ($logo -split ' ')[0].Trim()
          $root=$_.InstallLocation
          $icon=[System.IO.Path]::Combine($root,$cleanLogo)
        }
      }
      if($m.Package.Properties.DisplayName){ $displayName=$m.Package.Properties.DisplayName }
      if(!$d){ $d=$m.Package.Properties.Description }
      if($m.Package.PublisherDisplayName){ 
        $pub=$m.Package.PublisherDisplayName 
      } elseif($pub -match 'CN=([^,]+)') {
        $pub=$matches[1]
      }
    }
    [pscustomobject]@{
      name=$displayName
      version=$_.Version.ToString()
      publisher=$pub
      iconPath=$icon
      uninstallCmd="powershell -Command Remove-AppxPackage '"+$_.PackageFullName+"'"
      description=$d
      location=$_.InstallLocation
      source="Appx"
    }
  }
}

function Get-StartMenu {
  $paths=@(
    "$Env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs",
    "$Env:AppData\\Microsoft\\Windows\\Start Menu\\Programs",
    "$Env:ALLUSERSPROFILE\\Microsoft\\Windows\\Start Menu\\Programs",
    "$Env:USERPROFILE\\Start Menu\\Programs",
    "$Env:Public\\Desktop",
    "$Env:UserProfile\\Desktop"
  )
  $list=@()
  foreach($p in $paths){
    if(Test-Path $p){
      # Get .lnk files
      Get-ChildItem $p -Recurse -Include *.lnk -ErrorAction SilentlyContinue |
        ForEach-Object {
          $name=$_.BaseName
          $icon=Get-IconFromLnk $_.FullName
          $target=Get-TargetFromLnk $_.FullName
          if($target){
            [pscustomobject]@{
              name=$name
              version=$null
              publisher=$null
              iconPath=$icon
              uninstallCmd=$null
              description=$_.FullName
              location=$target
              source="StartMenu"
            }
          }
        }
      # Get .url files (Steam and other internet shortcuts)
      Get-ChildItem $p -Recurse -Include *.url -ErrorAction SilentlyContinue |
        ForEach-Object {
          $name=$_.BaseName
          $icon=Get-IconFromUrl $_.FullName
          $target=Get-TargetFromUrl $_.FullName
          if($target){
            [pscustomobject]@{
              name=$name
              version=$null
              publisher=$null
              iconPath=$icon
              uninstallCmd=$null
              description=$_.FullName
              location=$target
              source="StartMenu"
            }
          }
        }
    }
  }
  $list
}

$all = @(Get-Appx) + @(Get-StartMenu)
$all | Where-Object { $_.name } | Sort-Object name -Unique |
  ConvertTo-Json -Depth 6
`;
function parseAppsFromPowerShell() {
  try {
    const out = ps(script);
    if (!out)
      return [];
    const data = JSON.parse(out);
    if (Array.isArray(data))
      return data;
    if (data && typeof data === "object")
      return [data];
    return [];
  } catch {
    return [];
  }
}

class WindowsAppRegistry {
  apps = [];
  async fetch() {
    const apps = parseAppsFromPowerShell();
    this.apps = apps.map((app) => {
      const iconPath = cleanIconPath(app.iconPath);
      const idSeed = `${app.source}|${app.name}|${app.version ?? ""}|${app.publisher ?? ""}|${iconPath}`;
      return {
        id: hashStringToNumber(idSeed),
        name: app.name || "",
        version: app.version ?? "",
        publisher: app.publisher ?? "",
        icon: iconPath ? createAppIcon(iconPath) : undefined,
        location: app.location || undefined,
        uninstaller: app.uninstallCmd || undefined,
        installDate: undefined
      };
    });
  }
  listApps() {
    return this.apps;
  }
  getApp(id) {
    return this.apps.find((app) => app.id === id) || null;
  }
  uninstallApp(_id) {
    return false;
  }
}

// src/windows/process/process.ts
import koffi3 from "koffi";

// src/utils/koffi-utils.ts
function wideCharArrayToString(arr) {
  const chars = [];
  for (let i = 0;i < arr.length; i++) {
    const char = arr[i];
    if (char === undefined || char === 0)
      break;
    chars.push(char);
  }
  return String.fromCharCode(...chars);
}

// src/windows/process/koffi-defs.ts
import koffi2 from "koffi";

// src/utils/koffi-globals.ts
import koffi from "koffi";
var kernel32 = koffi.load("kernel32.dll");
var advapi32 = koffi.load("advapi32.dll");

// src/windows/process/koffi-defs.ts
var PROCESSENTRY32W_STRUCT = koffi2.struct("PROCESSENTRY32W", {
  dwSize: "uint32",
  cntUsage: "uint32",
  th32ProcessID: "uint32",
  th32DefaultHeapID: "uintptr",
  th32ModuleID: "uint32",
  cntThreads: "uint32",
  th32ParentProcessID: "uint32",
  pcPriClassBase: "int32",
  dwFlags: "uint32",
  szExeFile: koffi2.array("uint16", 260)
});
var CreateToolhelp32Snapshot = kernel32.func("CreateToolhelp32Snapshot", "void*", ["uint32", "uint32"]);
var Process32FirstW = kernel32.func("Process32FirstW", "bool", ["void*", "void*"]);
var Process32NextW = kernel32.func("Process32NextW", "bool", ["void*", "void*"]);
var CloseHandle = kernel32.func("CloseHandle", "bool", ["void*"]);
var OpenProcess = kernel32.func("OpenProcess", "void*", ["uint32", "bool", "uint32"]);
var TerminateProcess = kernel32.func("TerminateProcess", "bool", ["void*", "uint32"]);
var GetLastError = kernel32.func("GetLastError", "uint32", []);
var TH32CS_SNAPPROCESS = 2;
var PROCESS_TERMINATE = 1;
var PROCESS_QUERY_INFORMATION = 1024;

// src/windows/process/process.ts
class WindowsProcessManager {
  listProcesses() {
    const processes = [];
    try {
      const hSnapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
      if (!hSnapshot) {
        console.error("CreateToolhelp32Snapshot failed:", GetLastError());
        return [];
      }
      const pe32Buffer = Buffer.alloc(koffi3.sizeof(PROCESSENTRY32W_STRUCT));
      koffi3.encode(pe32Buffer, PROCESSENTRY32W_STRUCT, {
        dwSize: koffi3.sizeof(PROCESSENTRY32W_STRUCT),
        cntUsage: 0,
        th32ProcessID: 0,
        th32DefaultHeapID: 0,
        th32ModuleID: 0,
        cntThreads: 0,
        th32ParentProcessID: 0,
        pcPriClassBase: 0,
        dwFlags: 0,
        szExeFile: new Array(260).fill(0)
      });
      if (Process32FirstW(hSnapshot, pe32Buffer)) {
        do {
          const processEntry = koffi3.decode(pe32Buffer, PROCESSENTRY32W_STRUCT);
          const processName = wideCharArrayToString(processEntry.szExeFile);
          processes.push({
            id: processEntry.th32ProcessID,
            name: processName,
            status: "running",
            startTime: new Date(0)
          });
        } while (Process32NextW(hSnapshot, pe32Buffer));
      } else {
        const error = GetLastError();
        if (error !== 18) {
          console.error("Process32FirstW/NextW failed:", error);
        }
      }
      CloseHandle(hSnapshot);
    } catch (error) {
      console.error("Error in listProcesses:", error);
    }
    return processes;
  }
  getProcess(id) {
    const processes = this.listProcesses();
    return processes.find((p) => p.id === id) || null;
  }
  stopProcess(id) {
    let success = false;
    try {
      const hProcess = OpenProcess(PROCESS_TERMINATE | PROCESS_QUERY_INFORMATION, false, id);
      if (!hProcess) {
        const error = GetLastError();
        console.error(`Failed to open process ${id}. Error: ${error}. (Access Denied: 5)`);
        return false;
      }
      success = TerminateProcess(hProcess, 0);
      if (!success) {
        console.error(`Failed to terminate process ${id}. Error: ${GetLastError()}`);
      }
      CloseHandle(hProcess);
    } catch (e) {
      console.error(`Error stopping process ${id}:`, e);
    }
    return success;
  }
}

// src/windows/windows.ts
var Process = new WindowsProcessManager;
var Apps = new WindowsAppRegistry;
export {
  exports_windows as Windows
};
