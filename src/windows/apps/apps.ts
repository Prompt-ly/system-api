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
          $root=$_.InstallLocation
          $icon=[System.IO.Path]::Combine($root,$logo)
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

type PSApp = {
  name: string;
  version?: string;
  publisher?: string;
  iconPath?: string;
  uninstallCmd?: string;
  description?: string;
  location?: string;
  source: "Appx" | "StartMenu";
};

function parseAppsFromPowerShell(): PSApp[] {
  try {
    const out = ps(script);
    if (!out) return [];

    const data = JSON.parse(out);

    // Normalise to array
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
    const apps = parseAppsFromPowerShell();

    this.apps = apps.map((app) => {
      const icon = cleanIconPath(app.iconPath);
      const idSeed = `${app.source}|${app.name}|${app.version ?? ""}|${app.publisher ?? ""}|${icon}`;

      return {
        id: hashStringToNumber(idSeed),
        name: app.name || "",
        version: app.version ?? "",
        publisher: app.publisher ?? "",
        icon: icon || undefined,
        location: app.location || undefined,
        uninstaller: app.uninstallCmd || undefined,
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
    // TODO: Implement uninstaller
    return false;
  }
}
