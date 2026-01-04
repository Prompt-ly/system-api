export type NativeHandle = unknown;

export interface WindowInfo {
  id: string;
  title: string;
  application?: string;
  thumbnail?: string;
  processId: number;
  handle: NativeHandle; // void*
}

export interface WindowPlacement {
  length: number;
  flags: number;
  showCmd: number;
  minPosition: { x: number; y: number };
  maxPosition: { x: number; y: number };
  normalPosition: { left: number; top: number; right: number; bottom: number };
}
