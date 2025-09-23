export interface App {
  id: number;
  name: string;
  version: string;
  publisher: string;
  description: string;
  icon: string | null;
}

export interface AppRegistry {
  fetch(): Promise<void>;
  listApps(): App[];
  getApp(id: number): App | null;
  uninstallApp(id: number): boolean;
}
