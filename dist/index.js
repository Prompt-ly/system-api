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
  Process: () => Process,
  Apps: () => Apps
});

// src/windows/apps/apps.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// src/windows/apps/icon-extractor.ts
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import koffi2 from "koffi";

// src/windows/apps/koffi-defs.ts
import koffi from "koffi";
var shell32 = koffi.load("shell32.dll");
var user32 = koffi.load("user32.dll");
var gdi32 = koffi.load("gdi32.dll");
var SHFILEINFOW = koffi.struct("SHFILEINFOW", {
  hIcon: "void*",
  iIcon: "int",
  dwAttributes: "uint32",
  szDisplayName: koffi.array("uint16", 260),
  szTypeName: koffi.array("uint16", 80)
});
var BITMAPINFOHEADER = koffi.struct("BITMAPINFOHEADER", {
  biSize: "uint32",
  biWidth: "int32",
  biHeight: "int32",
  biPlanes: "uint16",
  biBitCount: "uint16",
  biCompression: "uint32",
  biSizeImage: "uint32",
  biXPelsPerMeter: "int32",
  biYPelsPerMeter: "int32",
  biClrUsed: "uint32",
  biClrImportant: "uint32"
});
var BITMAP = koffi.struct("BITMAP", {
  bmType: "int32",
  bmWidth: "int32",
  bmHeight: "int32",
  bmWidthBytes: "int32",
  bmPlanes: "uint16",
  bmBitsPixel: "uint16",
  bmBits: "void*"
});
var IconInfoStruct = koffi.struct({
  fIcon: "bool",
  xHotspot: "uint32",
  yHotspot: "uint32",
  hbmMask: "void*",
  hbmColor: "void*"
});
var SHGetFileInfoW = shell32.func("SHGetFileInfoW", "uintptr_t", [
  koffi.pointer("uint16"),
  "uint32",
  koffi.out(koffi.pointer(SHFILEINFOW)),
  "uint32",
  "uint32"
]);
var ExtractIconExW = shell32.func("ExtractIconExW", "uint32", [
  koffi.pointer("uint16"),
  "int",
  koffi.out(koffi.pointer("void*")),
  koffi.out(koffi.pointer("void*")),
  "uint32"
]);
var DestroyIcon = user32.func("DestroyIcon", "bool", ["void*"]);
var GetIconInfo = user32.func("GetIconInfo", "bool", ["void*", koffi.out(koffi.pointer(IconInfoStruct))]);
var GetDIBits = gdi32.func("GetDIBits", "int", [
  "void*",
  "void*",
  "uint32",
  "uint32",
  koffi.out("void*"),
  koffi.out(koffi.pointer("void")),
  "uint32"
]);
var GetDC = user32.func("GetDC", "void*", ["void*"]);
var ReleaseDC = user32.func("ReleaseDC", "int", ["void*", "void*"]);
var DeleteObject = gdi32.func("DeleteObject", "bool", ["void*"]);
var GetObject = gdi32.func("GetObjectW", "int", ["void*", "int", koffi.out(koffi.pointer("void"))]);
var SHGFI_ICON = 256;
var SHGFI_SMALLICON = 1;
var DIB_RGB_COLORS = 0;

// src/windows/apps/icon-extractor.ts
var PREFERRED_SCALES = [32, 48, 64, 96, 100, 125, 150, 200, 400];
var IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp", ".svg"];
var EXECUTABLE_EXTENSIONS = [".exe", ".dll", ".cpl", ".ocx", ".scr"];
var MIME_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};
var toWide = (s) => {
  const arr = new Uint16Array(s.length + 1);
  for (let i = 0;i < s.length; i++)
    arr[i] = s.charCodeAt(i);
  return arr;
};
var getMime = (ext) => MIME_TYPES[ext.toLowerCase()] || "image/png";
var getPatterns = (base, ext, scale) => [
  `${base}.scale-${scale}${ext}`,
  `${base}.targetsize-${scale}${ext}`,
  `${base}.contrast-standard_scale-${scale}${ext}`,
  `${base}.${scale}${ext}`,
  `${base}_${scale}${ext}`,
  `${base}-${scale}${ext}`
];
async function iconToBase64(hIcon) {
  if (!hIcon || hIcon === 0)
    return null;
  try {
    const iconInfo = {};
    if (!GetIconInfo(hIcon, iconInfo)) {
      DestroyIcon(hIcon);
      return null;
    }
    const hdc = GetDC(null);
    if (!hdc) {
      DestroyIcon(hIcon);
      return null;
    }
    const bitmapInfo = Buffer.alloc(koffi2.sizeof(BITMAP));
    const result = GetObject(iconInfo.hbmColor, koffi2.sizeof(BITMAP), bitmapInfo);
    if (result === 0) {
      ReleaseDC(null, hdc);
      DeleteObject(iconInfo.hbmMask);
      DeleteObject(iconInfo.hbmColor);
      DestroyIcon(hIcon);
      return null;
    }
    const bitmap = koffi2.decode(bitmapInfo, BITMAP);
    const width = Math.abs(bitmap.bmWidth);
    const height = Math.abs(bitmap.bmHeight);
    if (width === 0 || height === 0 || width > 256 || height > 256) {
      ReleaseDC(null, hdc);
      DeleteObject(iconInfo.hbmMask);
      DeleteObject(iconInfo.hbmColor);
      DestroyIcon(hIcon);
      return null;
    }
    const bmi = Buffer.alloc(1024);
    const bmiHeader = {
      biSize: 40,
      biWidth: width,
      biHeight: height,
      biPlanes: 1,
      biBitCount: 32,
      biCompression: 0,
      biSizeImage: 0,
      biXPelsPerMeter: 0,
      biYPelsPerMeter: 0,
      biClrUsed: 0,
      biClrImportant: 0
    };
    const bufferSize = width * height * 4;
    const pixelData = Buffer.alloc(bufferSize);
    koffi2.encode(bmi, BITMAPINFOHEADER, bmiHeader);
    const dibResult = GetDIBits(hdc, iconInfo.hbmColor, 0, height, pixelData, bmi, DIB_RGB_COLORS);
    ReleaseDC(null, hdc);
    DeleteObject(iconInfo.hbmMask);
    DeleteObject(iconInfo.hbmColor);
    DestroyIcon(hIcon);
    if (dibResult === 0) {
      return null;
    }
    const icoHeader = Buffer.alloc(6);
    icoHeader.writeUInt16LE(0, 0);
    icoHeader.writeUInt16LE(1, 2);
    icoHeader.writeUInt16LE(1, 4);
    const icoEntry = Buffer.alloc(16);
    icoEntry.writeUInt8(width >= 256 ? 0 : width, 0);
    icoEntry.writeUInt8(height >= 256 ? 0 : height, 1);
    icoEntry.writeUInt8(0, 2);
    icoEntry.writeUInt8(0, 3);
    icoEntry.writeUInt16LE(1, 4);
    icoEntry.writeUInt16LE(32, 6);
    icoEntry.writeUInt32LE(pixelData.length + 40, 8);
    icoEntry.writeUInt32LE(22, 12);
    const icoBitmapInfo = Buffer.alloc(40);
    icoBitmapInfo.writeUInt32LE(40, 0);
    icoBitmapInfo.writeInt32LE(width, 4);
    icoBitmapInfo.writeInt32LE(height * 2, 8);
    icoBitmapInfo.writeUInt16LE(1, 12);
    icoBitmapInfo.writeUInt16LE(32, 14);
    icoBitmapInfo.writeUInt32LE(0, 16);
    icoBitmapInfo.writeUInt32LE(pixelData.length, 20);
    icoBitmapInfo.writeInt32LE(0, 24);
    icoBitmapInfo.writeInt32LE(0, 28);
    icoBitmapInfo.writeUInt32LE(0, 32);
    icoBitmapInfo.writeUInt32LE(0, 36);
    const icoFile = Buffer.concat([icoHeader, icoEntry, icoBitmapInfo, pixelData]);
    const base64 = icoFile.toString("base64");
    return `data:image/x-icon;base64,${base64}`;
  } catch {
    return null;
  }
}
async function extractIconWithKoffi(filePath) {
  try {
    const wideFilePath = toWide(filePath);
    const largeIconPtr = [0];
    const smallIconPtr = [0];
    const count = ExtractIconExW(wideFilePath, 0, largeIconPtr, smallIconPtr, 1);
    if (count > 0 && smallIconPtr[0]) {
      const iconData = await iconToBase64(smallIconPtr[0]);
      if (iconData)
        return iconData;
    }
    if (count > 0 && largeIconPtr[0]) {
      const iconData = await iconToBase64(largeIconPtr[0]);
      if (iconData)
        return iconData;
    }
    const fileInfo = {};
    const wideFilePathForShell = toWide(filePath);
    const result = SHGetFileInfoW(wideFilePathForShell, 0, fileInfo, koffi2.sizeof(SHFILEINFOW), SHGFI_ICON | SHGFI_SMALLICON);
    if (result && fileInfo.hIcon) {
      return await iconToBase64(fileInfo.hIcon);
    }
    return null;
  } catch {
    return null;
  }
}
async function resolveAppxIconPathDirect(iconPath) {
  try {
    if (existsSync(iconPath))
      return iconPath;
    const dir = dirname(iconPath);
    const baseNameWithoutExt = basename(iconPath, extname(iconPath));
    const ext = extname(iconPath);
    if (!existsSync(dir))
      return null;
    let files;
    try {
      files = readdirSync(dir);
    } catch {
      for (const scale of PREFERRED_SCALES.slice(0, 5)) {
        for (const pattern of getPatterns(baseNameWithoutExt, ext, scale).slice(0, 3)) {
          const testPath = join(dir, pattern);
          if (existsSync(testPath))
            return testPath;
        }
      }
      return null;
    }
    for (const scale of PREFERRED_SCALES) {
      for (const pattern of getPatterns(baseNameWithoutExt, ext, scale)) {
        if (files.includes(pattern))
          return join(dir, pattern);
      }
    }
    const matchingFile = files.find((f) => f.startsWith(baseNameWithoutExt) && f.endsWith(ext));
    return matchingFile ? join(dir, matchingFile) : null;
  } catch {
    return null;
  }
}
async function resolveAppxIconPath(iconPath) {
  if (iconPath.includes("WindowsApps")) {
    return await resolveAppxIconPathDirect(iconPath);
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
      for (const scale of PREFERRED_SCALES.slice(0, 5)) {
        for (const pattern of getPatterns(baseNameWithoutExt, ext, scale).slice(0, 3)) {
          const testPath = join(dir, pattern);
          if (existsSync(testPath)) {
            return testPath;
          }
        }
      }
      return null;
    }
    for (const scale of PREFERRED_SCALES) {
      for (const pattern of getPatterns(baseNameWithoutExt, ext, scale)) {
        if (files.includes(pattern)) {
          return join(dir, pattern);
        }
      }
    }
    const matchingFile = files.find((file) => file.startsWith(baseNameWithoutExt) && file.endsWith(ext));
    return matchingFile ? join(dir, matchingFile) : null;
  } catch {
    return null;
  }
}
async function extractIcon(filePath) {
  if (extname(filePath).toLowerCase() === ".ico") {
    return null;
  }
  return await extractIconWithKoffi(filePath);
}
async function fileToBase64DataURI(filePath) {
  try {
    const resolvedPath = await resolveAppxIconPath(filePath);
    if (!resolvedPath)
      return null;
    const buffer = await readFile(resolvedPath);
    const ext = extname(resolvedPath);
    const mimeType = getMime(ext);
    const base64 = buffer.toString("base64");
    return `data:${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}
async function extractIconAsBase64(filePath) {
  if (!filePath || !filePath.trim()) {
    return null;
  }
  const cleanPath = filePath.trim();
  const ext = extname(cleanPath).toLowerCase();
  const isWindowsApps = cleanPath.includes("WindowsApps");
  if (!isWindowsApps && !existsSync(cleanPath)) {
    return null;
  }
  if (IMAGE_EXTENSIONS.includes(ext) || ext === ".ico") {
    return await fileToBase64DataURI(cleanPath);
  }
  if (EXECUTABLE_EXTENSIONS.includes(ext)) {
    return await extractIcon(cleanPath);
  }
  return await extractIcon(cleanPath);
}

// src/windows/apps/apps.ts
var execFileAsync = promisify(execFile);
var createAppIcon = (path, preloadedBase64) => {
  let cachedBase64 = preloadedBase64 ?? null;
  let loadPromise = null;
  return {
    path,
    getBase64: async () => {
      if (cachedBase64 !== null)
        return cachedBase64;
      if (loadPromise)
        return loadPromise;
      loadPromise = (async () => {
        try {
          if (cachedBase64 !== null)
            return cachedBase64;
          const base64 = await extractIconAsBase64(path);
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
};
var hashStringToNumber = (value) => Math.abs([...value].reduce((acc, ch) => (acc << 5) - acc + ch.charCodeAt(0) | 0, 0)) || 1;
var cleanIconPath = (path) => {
  const raw = typeof path === "string" ? path : path == null ? "" : String(path);
  return raw.trim().replace(/^['"]|['"]$/g, "").replace(/,\s*-?\d+$/, "");
};
var ps = async (script) => {
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 64
  });
  return stdout.trim();
};
var buildScript = () => String.raw`
$ErrorActionPreference="SilentlyContinue"

function ReadLnk($p){
  try{
    $sh=New-Object -ComObject WScript.Shell
    $lnk=$sh.CreateShortcut($p)
    $iconLoc=$lnk.IconLocation
    $icon=if($iconLoc){$iconLoc}else{$null}
    @{ Icon=$icon; Target=$lnk.TargetPath }
  }catch{ @{ Icon=$null; Target=$null } }
}

function ReadUrl($p){
  try{
    $lines=Get-Content $p -ErrorAction Stop
    $icon=($lines | Where-Object { $_ -like "IconFile=*" } | Select-Object -First 1) -replace "IconFile=",""
    $target=($lines | Where-Object { $_ -like "URL=*" } | Select-Object -First 1) -replace "URL=",""
    @{ Icon=$icon; Target=$target }
  }catch{ @{ Icon=$null; Target=$null } }
}

function Appx(){
  Get-AppxPackage | ForEach-Object {
    $manifest=$null
    try{ $manifest=Get-AppxPackageManifest -Package $_ -ErrorAction Stop }catch{}
    $logo=$null
    if($manifest){
      $logos=@(
        $manifest.Package.Applications.Application.VisualElements.Square44x44Logo,
        $manifest.Package.Applications.Application.VisualElements.Square150x150Logo,
        $manifest.Package.Applications.Application.VisualElements.Square71x71Logo,
        $manifest.Package.Applications.Application.VisualElements.Square30x30Logo
      ) | Where-Object { $_ -and $_ -ne "" }
      if($logos){
        foreach($l in $logos){
          $relativePath=($l -split " ")[0]
          if($relativePath){
            $testPath=Join-Path $_.InstallLocation $relativePath
            if($testPath -and (Test-Path $testPath -ErrorAction SilentlyContinue)){
              $logo=$testPath
              break
            }
          }
        }
        # Fallback: use first logo even if file doesn't exist (icon resolver will handle variants)
        if(-not $logo -and $logos[0]){
          $relativePath=($logos[0] -split " ")[0]
          if($relativePath){
            $logo=Join-Path $_.InstallLocation $relativePath
          }
        }
      }
    }
    $publisher=$_.Publisher
    if($manifest -and $manifest.Package.PublisherDisplayName){ $publisher=$manifest.Package.PublisherDisplayName }
    $name=$_.Name
    if($manifest -and $manifest.Package.Properties.DisplayName){ $name=$manifest.Package.Properties.DisplayName }
    [pscustomobject]@{
      name=$name
      version=$_.Version.ToString()
      publisher=$publisher
      iconPath=$logo
      uninstallCmd="powershell -Command Remove-AppxPackage '"+$_.PackageFullName+"'"
      description=if($manifest){$manifest.Package.Properties.Description}else{$null}
      location=$_.InstallLocation
      source="Appx"
    }
  }
}

function StartMenu(){
  $roots=@(
    "$Env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs",
    "$Env:AppData\\Microsoft\\Windows\\Start Menu\\Programs",
    "$Env:ALLUSERSPROFILE\\Microsoft\\Windows\\Start Menu\\Programs",
    "$Env:USERPROFILE\\Start Menu\\Programs",
    "$Env:Public\\Desktop",
    "$Env:UserProfile\\Desktop"
  ) | Where-Object { Test-Path $_ }

  foreach($root in $roots){
    Get-ChildItem $root -Recurse -Include *.lnk,*.url -ErrorAction SilentlyContinue | ForEach-Object {
      $info = if($_.Extension -ieq ".lnk"){ ReadLnk $_.FullName } elseif($_.Extension -ieq ".url"){ ReadUrl $_.FullName } else { $null }
      if($info -and $info.Target){
        $icon=$info.Icon
        if([string]::IsNullOrWhiteSpace($icon)){ $icon=$info.Target }
        if($icon){ $icon=[System.Environment]::ExpandEnvironmentVariables($icon) }
        [pscustomobject]@{
          name=$_.BaseName
          version=$null
          publisher=$null
          iconPath=$icon
          uninstallCmd=$null
          description=$_.FullName
          location=$info.Target
          source="StartMenu"
        }
      }
    }
  }
}

$result = @(Appx) + @(StartMenu)
$result | Where-Object { $_.name } | Sort-Object name -Unique | ConvertTo-Json -Depth 6
`;
var parseAppsFromPowerShell = async () => {
  try {
    const raw = await ps(buildScript());
    if (!raw)
      return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  } catch {
    return [];
  }
};

class WindowsAppRegistry {
  apps = [];
  async fetch() {
    const apps = await parseAppsFromPowerShell();
    this.apps = apps.filter((app) => {
      const hasResourceName = app.name?.startsWith("ms-resource:");
      const hasResourceIcon = app.iconPath?.startsWith("ms-resource:");
      return !hasResourceName && !hasResourceIcon;
    }).map((app) => {
      const iconPath = cleanIconPath(app.iconPath) || undefined;
      const idSeed = `${app.source}|${app.name}|${app.version ?? ""}|${app.publisher ?? ""}|${iconPath ?? ""}`;
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
import koffi5 from "koffi";

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
import koffi4 from "koffi";

// src/utils/koffi-globals.ts
import koffi3 from "koffi";
var kernel32 = koffi3.load("kernel32.dll");
var advapi32 = koffi3.load("advapi32.dll");

// src/windows/process/koffi-defs.ts
var PROCESSENTRY32W_STRUCT = koffi4.struct("PROCESSENTRY32W", {
  dwSize: "uint32",
  cntUsage: "uint32",
  th32ProcessID: "uint32",
  th32DefaultHeapID: "uintptr",
  th32ModuleID: "uint32",
  cntThreads: "uint32",
  th32ParentProcessID: "uint32",
  pcPriClassBase: "int32",
  dwFlags: "uint32",
  szExeFile: koffi4.array("uint16", 260)
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
      const pe32Buffer = Buffer.alloc(koffi5.sizeof(PROCESSENTRY32W_STRUCT));
      koffi5.encode(pe32Buffer, PROCESSENTRY32W_STRUCT, {
        dwSize: koffi5.sizeof(PROCESSENTRY32W_STRUCT),
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
          const processEntry = koffi5.decode(pe32Buffer, PROCESSENTRY32W_STRUCT);
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
