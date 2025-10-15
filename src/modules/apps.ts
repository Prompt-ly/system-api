export interface App {
  id: number;
  name: string;
  version: string;
  publisher: string;
  icon?: AppIcon;
  location?: string;
  uninstaller?: string;
  installDate?: Date;
}

export type AppIcon = {
  path: string;
  getBase64: () => Promise<string>;
};

export interface AppRegistry {
  getApps(refresh?: boolean): Promise<App[]>;
  getApp(id: number): App | null;
  uninstallApp(id: number): boolean;
}
