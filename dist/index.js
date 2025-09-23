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
import { execFileSync } from "node:child_process";
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
var ps = (script) => execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
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

function Get-Win32 {
  $paths=@(
    "HKLM:Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKLM:Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKCU:Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
  )
  $apps=@()
  foreach($p in $paths){
    if(Test-Path $p){
      $apps += Get-ChildItem $p | ForEach-Object {
        $i=Get-ItemProperty $_.PSPath
        if($i.DisplayName){
          [pscustomobject]@{
            name=$i.DisplayName
            version=$i.DisplayVersion
            publisher=$i.Publisher
            iconPath=$i.DisplayIcon
            uninstallCmd=$i.UninstallString
            description=$i.Comments
            location=if($i.InstallLocation){$i.InstallLocation}else{$null}
            source="Win32"
          }
        }
      }
    }
  }
  $apps
}

function Get-Appx {
  Get-AppxPackage | ForEach-Object {
    $m=Get-AppxPackageManifest -Package $_ -ErrorAction SilentlyContinue
    $d=$null; $icon=$null; $pub=$_.Publisher
    if($m){
      $d=$m.Package.Properties.Description
      $icons=$m.Package.Applications.Application.VisualElements
      if($icons){
        $logo=$icons.Square44x44Logo
        if($logo){
          $root=$_.InstallLocation
          $icon=[System.IO.Path]::Combine($root,$logo)
        }
      }
      if(!$d){ $d=$m.Package.Properties.DisplayName }
      if(!$pub){ $pub=$m.Package.PublisherDisplayName }
    }
    [pscustomobject]@{
      name=$_.Name
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
    "$Env:Public\\Desktop",
    "$Env:UserProfile\\Desktop"
  )
  $list=@()
  foreach($p in $paths){
    if(Test-Path $p){
      Get-ChildItem $p -Recurse -Include *.lnk |
        ForEach-Object {
          $name=$_.BaseName
          $icon=Get-IconFromLnk $_.FullName
          $target=Get-TargetFromLnk $_.FullName
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
  $list
}

$all = @(Get-Win32) + @(Get-Appx) + @(Get-StartMenu)
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
    const raw = parseAppsFromPowerShell();
    const seen = new Set;
    const unique = raw.filter((a) => {
      const key = (a.name || "").trim().toLowerCase();
      if (!key)
        return false;
      if (seen.has(key))
        return false;
      seen.add(key);
      return true;
    });
    this.apps = unique.map((a) => {
      const icon = cleanIconPath(a.iconPath);
      const idSeed = `${a.source}|${a.name}|${a.version ?? ""}|${a.publisher ?? ""}|${icon}`;
      return {
        id: hashStringToNumber(idSeed),
        name: a.name || "",
        version: a.version ?? "",
        publisher: a.publisher ?? "",
        icon: icon || undefined,
        location: a.location || undefined,
        uninstaller: a.uninstallCmd || undefined,
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
