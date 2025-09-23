export interface App {
  id: number;
  name: string;
  version: string;
  publisher: string;
  icon?: string;
  location?: string;
  uninstaller?: string;
  installDate?: Date;
}

export interface AppRegistry {
  fetch(): Promise<void>;
  listApps(): App[];
  getApp(id: number): App | null;
  uninstallApp(id: number): boolean;
}
