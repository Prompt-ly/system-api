export interface Setting {
  id: string;
  name: string;
  open: () => void;
}

export interface SettingRegistry {
  getSettings(): Setting[];
}
