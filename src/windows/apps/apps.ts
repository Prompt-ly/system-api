import type { App, AppRegistry } from "@/modules/apps";
import { Registry } from "./registry";

function hashStringToNumber(str: string): number {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return Math.abs(hash);
}

type RegistryApp = App & {
  registryKey: string;
};

async function fetchRegistryApps(): Promise<App[]> {
  const keys = [
    { hive: Registry.HKLM, key: "\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall" },
    { hive: Registry.HKLM, key: "\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall" },
    { hive: Registry.HKCU, key: "\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall" },
    { hive: Registry.HKCU, key: "\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall" }
  ];

  const apps: Array<RegistryApp> = [];

  for (const k of keys) {
    try {
      const reg = new Registry({ hive: k.hive, key: k.key });
      const children: Registry[] = await new Promise((resolve) =>
        reg.keys((err: Error | null, sub?: Registry[]) => resolve(err ? [] : sub || []))
      );

      const items = await Promise.all(
        children.map(
          (sub) =>
            new Promise<Partial<RegistryApp> | null>((resolve) => {
              const registryKey = sub.key.split("\\").pop() || "";

              sub.values((_err: Error | null, values?: { name: string; type: string; value: string }[]) => {
                const app: Partial<RegistryApp> = { registryKey };

                for (const v of values || []) {
                  if (v.name === "DisplayName") app.name = v.value;
                  if (v.name === "DisplayVersion") app.version = v.value;
                  if (v.name === "Publisher") app.publisher = v.value;
                  if (v.name === "DisplayIcon") app.icon = v.value;
                  if (v.name === "Comments" || v.name === "LocalizedDescription") app.description = v.value;
                }

                resolve(app.name ? app : null);
              });
            })
        )
      );

      apps.push(...items.filter((item): item is RegistryApp => item !== null && item.registryKey !== undefined));
    } catch {}
  }

  const seen = new Set<string>();
  const uniqueApps = apps.filter((app) => {
    if (app.name && !seen.has(app.name)) {
      seen.add(app.name);
      return true;
    }
    return false;
  });

  return uniqueApps
    .filter((app): app is RegistryApp => app?.name !== undefined)
    .map((app) => ({
      id: hashStringToNumber(app.registryKey),
      name: app.name || "",
      version: app.version || "",
      publisher: app.publisher || "",
      description: app.description || "",
      icon: app.icon || null
    }));
}

export class WindowsAppRegistry implements AppRegistry {
  private apps: App[] = [];

  async fetch() {
    this.apps = await fetchRegistryApps();
  }

  listApps(): App[] {
    return this.apps;
  }

  getApp(id: number): App | null {
    return this.apps.find((app) => app.id === id) || null;
  }

  uninstallApp(_id: number): boolean {
    // TODO: Implement uninstalling logic
    return false;
  }
}
