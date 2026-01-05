import koffi from "koffi";

export type Pointer = typeof koffi.pointer;
export const kernel32 = koffi.load("kernel32.dll");
export const advapi32 = koffi.load("advapi32.dll");

export const BITMAPINFOHEADER = koffi.struct("BITMAPINFOHEADER", {
  biSize: "uint32",
  biWidth: "int32",
  biHeight: "int32",
  biPlanes: "uint16",
  biBitCount: "uint16",
  biCompression: "uint32",
  biSizeImage: "uint32",
  biXPelsPerMeter: "int32",
  biYPelsPerMeter: "int32",
  biClrUsed: "uint32",
  biClrImportant: "uint32"
});
