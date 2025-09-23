import type { App, AppRegistry } from "@/modules/apps";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const n = Math.abs(hash);
  return n === 0 ? 1 : n;
}

function cleanIconPath(path: string | undefined | null): string {
  let s = (path || "").trim();
  const lastComma = s.lastIndexOf(",");
  if (lastComma !== -1) {
    const right = s.slice(lastComma + 1).trim();
    if (/^-?\d+$/.test(right)) {
      s = s.slice(0, lastComma).trim();
    }
  }
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return s;
}

const ps = (script: string) =>
  execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 64
  }).trim();

const script = `
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

type PSApp = {
  name: string;
  version?: string;
  publisher?: string;
  iconPath?: string;
  uninstallCmd?: string;
  description?: string;
  location?: string;
  source: "Win32" | "Appx" | "StartMenu";
};

function parseAppsFromPowerShell(): PSApp[] {
  try {
    const out = ps(script);
    if (!out) return [];
    const data = JSON.parse(out);
    // Normalize to array
    if (Array.isArray(data)) return data as PSApp[];
    if (data && typeof data === "object") return [data as PSApp];
    return [];
  } catch {
    return [];
  }
}

export function iconToBase64(path: string): string | undefined {
  try {
    const buf = readFileSync(path);
    return buf.toString("base64");
  } catch {
    return undefined;
  }
}

export class WindowsAppRegistry implements AppRegistry {
  private apps: App[] = [];

  async fetch() {
    const raw = parseAppsFromPowerShell();

    // Deduplicate
    const seen = new Set<string>();
    const unique = raw.filter((a) => {
      const key = (a.name || "").trim().toLowerCase();
      if (!key) return false;
      if (seen.has(key)) return false;
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
      } as App;
    });
  }

  listApps(): App[] {
    return this.apps;
  }

  getApp(id: number): App | null {
    return this.apps.find((app) => app.id === id) || null;
  }

  uninstallApp(_id: number): boolean {
    // Placeholder: not implemented
    return false;
  }
}
