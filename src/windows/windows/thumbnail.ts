import type { NativeHandle } from "./types";
import { Buffer } from "node:buffer";
import koffi from "koffi";
import { BITMAPINFO, Gdi32, RECT, User32 } from "./koffi-defs";

const DIB_RGB_COLORS = 0;
const PW_RENDERFULLCONTENT = 0x00000002;

export const captureWindowThumbnail = (hwnd: NativeHandle): string | undefined => {
  const rect = {} as any;
  if (!User32.GetWindowRect(hwnd, rect)) return undefined;

  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;

  if (width <= 0 || height <= 0) return undefined;

  const hdcWindow = User32.GetWindowDC(hwnd);
  if (!hdcWindow) return undefined;

  const hdcMem = Gdi32.CreateCompatibleDC(hdcWindow);
  const hBitmap = Gdi32.CreateCompatibleBitmap(hdcWindow, width, height);
  const hOld = Gdi32.SelectObject(hdcMem, hBitmap);

  // Print window to bitmap
  // PW_RENDERFULLCONTENT is supported on Windows 8.1 and later.
  // For older versions, use 0.
  const result = User32.PrintWindow(hwnd, hdcMem, PW_RENDERFULLCONTENT);

  if (!result) {
    // Cleanup
    Gdi32.SelectObject(hdcMem, hOld);
    Gdi32.DeleteObject(hBitmap);
    Gdi32.DeleteDC(hdcMem);
    User32.ReleaseDC(hwnd, hdcWindow);
    return undefined;
  }

  // Prepare BITMAPINFO
  // We use negative height to get top-down bitmap which is easier to reason about,
  // but for BMP file format, standard is bottom-up (positive height).
  // Let's use bottom-up (positive height) for maximum compatibility.
  const bmi = {
    bmiHeader: {
      biSize: 40, // sizeof(BITMAPINFOHEADER)
      biWidth: width,
      biHeight: height, // Bottom-up
      biPlanes: 1,
      biBitCount: 32, // RGBA
      biCompression: 0, // BI_RGB
      biSizeImage: 0,
      biXPelsPerMeter: 0,
      biYPelsPerMeter: 0,
      biClrUsed: 0,
      biClrImportant: 0
    },
    bmiColors: [0]
  };

  // Get bits
  const bufferSize = width * height * 4;
  const buffer = Buffer.alloc(bufferSize);

  const lines = Gdi32.GetDIBits(hdcMem, hBitmap, 0, height, buffer, bmi, DIB_RGB_COLORS);

  // Cleanup GDI objects
  Gdi32.SelectObject(hdcMem, hOld);
  Gdi32.DeleteObject(hBitmap);
  Gdi32.DeleteDC(hdcMem);
  User32.ReleaseDC(hwnd, hdcWindow);

  if (lines === 0) return undefined;

  // Create BMP file header
  const fileHeaderSize = 14;
  const infoHeaderSize = 40;
  const fileSize = fileHeaderSize + infoHeaderSize + bufferSize;

  const fileHeader = Buffer.alloc(fileHeaderSize);
  fileHeader.write("BM", 0); // Signature
  fileHeader.writeUInt32LE(fileSize, 2); // File size
  fileHeader.writeUInt32LE(0, 6); // Reserved
  fileHeader.writeUInt32LE(fileHeaderSize + infoHeaderSize, 10); // Offset to data

  const infoHeader = Buffer.alloc(infoHeaderSize);
  infoHeader.writeUInt32LE(infoHeaderSize, 0); // Header size
  infoHeader.writeInt32LE(width, 4); // Width
  infoHeader.writeInt32LE(height, 8); // Height (bottom-up)
  infoHeader.writeUInt16LE(1, 12); // Planes
  infoHeader.writeUInt16LE(32, 14); // Bit count
  infoHeader.writeUInt32LE(0, 16); // Compression
  infoHeader.writeUInt32LE(bufferSize, 20); // Image size
  infoHeader.writeInt32LE(0, 24); // X Pels
  infoHeader.writeInt32LE(0, 28); // Y Pels
  infoHeader.writeUInt32LE(0, 32); // Clr Used
  infoHeader.writeUInt32LE(0, 36); // Clr Important

  const bmpBuffer = Buffer.concat([fileHeader, infoHeader, buffer]);
  return bmpBuffer.toString("base64");
};
