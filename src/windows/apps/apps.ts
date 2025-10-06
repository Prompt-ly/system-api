import type { App, AppRegistry } from "@/modules/apps";
import { execFileSync } from "node:child_process";
import { createAppIcon } from "./app-icon";

const hashStringToNumber = (value: string): number =>
  Math.abs([...value].reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0)) || 1;

const cleanIconPath = (path?: string | null) => {
  const raw = typeof path === "string" ? path : path == null ? "" : String(path);
  return raw
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/,\s*-?\d+$/, "");
};

const ps = (script: string) =>
  execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 64
  }).trim();

const buildScript = () => String.raw`
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

const parseAppsFromPowerShell = (): PSApp[] => {
  try {
    const raw = ps(buildScript());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PSApp[]) : parsed ? [parsed as PSApp] : [];
  } catch {
    return [];
  }
};

export class WindowsAppRegistry implements AppRegistry {
  private apps: App[] = [];

  async fetch() {
    const apps = parseAppsFromPowerShell();

    this.apps = apps.map((app) => {
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
