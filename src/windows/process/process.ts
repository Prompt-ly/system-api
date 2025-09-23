import type { Process, ProcessManager } from "@/modules/process";
import koffi from "koffi";
import { wideCharArrayToString } from "@/utils/koffi-utils";
import {
  CloseHandle,
  CreateToolhelp32Snapshot,
  GetLastError,
  OpenProcess,
  PROCESS_QUERY_INFORMATION,
  PROCESS_TERMINATE,
  PROCESSENTRY32W_STRUCT,
  Process32FirstW,
  Process32NextW,
  TerminateProcess,
  TH32CS_SNAPPROCESS
} from "./koffi-defs";

export class WindowsProcessManager implements ProcessManager {
  listProcesses(): Process[] {
    const processes: Process[] = [];

    try {
      const hSnapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);

      if (!hSnapshot) {
        console.error("CreateToolhelp32Snapshot failed:", GetLastError());
        return [];
      }

      // Allocate memory for PROCESSENTRY32W
      const pe32Buffer = Buffer.alloc(koffi.sizeof(PROCESSENTRY32W_STRUCT));

      // Initialise structure
      koffi.encode(pe32Buffer, PROCESSENTRY32W_STRUCT, {
        dwSize: koffi.sizeof(PROCESSENTRY32W_STRUCT),
        cntUsage: 0,
        th32ProcessID: 0,
        th32DefaultHeapID: 0,
        th32ModuleID: 0,
        cntThreads: 0,
        th32ParentProcessID: 0,
        pcPriClassBase: 0,
        dwFlags: 0,
        szExeFile: new Array(260).fill(0)
      });

      // Get first process
      if (Process32FirstW(hSnapshot, pe32Buffer)) {
        do {
          const processEntry = koffi.decode(pe32Buffer, PROCESSENTRY32W_STRUCT);
          const processName = wideCharArrayToString(processEntry.szExeFile);

          processes.push({
            id: processEntry.th32ProcessID,
            name: processName,
            status: "running",
            startTime: new Date(0)
          });
        } while (Process32NextW(hSnapshot, pe32Buffer));
      } else {
        const error = GetLastError();

        if (error !== 18) {
          console.error("Process32FirstW/NextW failed:", error);
        }
      }

      CloseHandle(hSnapshot);
    } catch (error) {
      console.error("Error in listProcesses:", error);
    }

    return processes;
  }

  getProcess(id: number): Process | null {
    const processes = this.listProcesses();
    return processes.find((p) => p.id === id) || null;
  }

  stopProcess(id: number): boolean {
    let success = false;

    try {
      const hProcess = OpenProcess(PROCESS_TERMINATE | PROCESS_QUERY_INFORMATION, false, id);

      if (!hProcess) {
        const error = GetLastError();
        console.error(`Failed to open process ${id}. Error: ${error}. (Access Denied: 5)`);
        return false;
      }

      success = TerminateProcess(hProcess, 0);

      if (!success) {
        console.error(`Failed to terminate process ${id}. Error: ${GetLastError()}`);
      }

      CloseHandle(hProcess);
    } catch (e) {
      console.error(`Error stopping process ${id}:`, e);
    }

    return success;
  }
}
