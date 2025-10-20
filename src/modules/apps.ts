export interface App {
  id: string;
  name: string;
  type: "desktop" | "uwp" | "url";
  icon: {
    path: string;
    getBase64: () => Promise<string>;
  }
  launch: () => void;
}

export interface AppRegistry {
  fetchApps(): Promise<App[]>;
}
