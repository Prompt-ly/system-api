export interface Setting {
  id: string;
  name: string;
  open: () => void;
}

export interface SettingRegistry {
  fetchSettings(): Promise<Setting[]>;
}
