import koffi from "koffi";

export type Pointer = typeof koffi.pointer;
export const kernel32 = koffi.load("kernel32.dll");
export const advapi32 = koffi.load("advapi32.dll");
