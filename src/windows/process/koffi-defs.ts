import koffi from "koffi";
import { kernel32 } from "@/utils/koffi-globals";

export const PROCESSENTRY32W_STRUCT = koffi.struct("PROCESSENTRY32W", {
  dwSize: "uint32",
  cntUsage: "uint32",
  th32ProcessID: "uint32",
  th32DefaultHeapID: "uintptr",
  th32ModuleID: "uint32",
  cntThreads: "uint32",
  th32ParentProcessID: "uint32",
  pcPriClassBase: "int32",
  dwFlags: "uint32",
  szExeFile: koffi.array("uint16", 260)
});

export const CreateToolhelp32Snapshot = kernel32.func("CreateToolhelp32Snapshot", "void*", ["uint32", "uint32"]);
export const Process32FirstW = kernel32.func("Process32FirstW", "bool", ["void*", "void*"]);
export const Process32NextW = kernel32.func("Process32NextW", "bool", ["void*", "void*"]);
export const CloseHandle = kernel32.func("CloseHandle", "bool", ["void*"]);

export const OpenProcess = kernel32.func("OpenProcess", "void*", ["uint32", "bool", "uint32"]);
export const TerminateProcess = kernel32.func("TerminateProcess", "bool", ["void*", "uint32"]);
export const GetLastError = kernel32.func("GetLastError", "uint32", []);

export const TH32CS_SNAPPROCESS = 0x00000002;
export const PROCESS_TERMINATE = 0x0001;
export const PROCESS_QUERY_INFORMATION = 0x0400;
