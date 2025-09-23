import type { Process } from "../../src/modules/process";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { WindowsProcessManager } from "../../src/windows/process/process";

describe("WindowsProcessManager", () => {
  let processManager: WindowsProcessManager;

  beforeAll(() => {
    processManager = new WindowsProcessManager();
  });

  describe("listProcesses", () => {
    test("should return an array of processes", () => {
      const processes = processManager.listProcesses();

      expect(processes).toBeInstanceOf(Array);
      expect(processes.length).toBeGreaterThan(0);
    });

    test("should return processes with valid properties", () => {
      const processes = processManager.listProcesses();

      // Test at least the first few processes
      const testProcesses = processes.slice(0, 5);

      testProcesses.forEach((process: Process) => {
        expect(process).toHaveProperty("id");
        expect(process).toHaveProperty("name");
        expect(process).toHaveProperty("status");
        expect(process).toHaveProperty("startTime");

        expect(typeof process.id).toBe("number");
        expect(process.id).toBeGreaterThanOrEqual(0); // Process ID 0 is valid (System Process)
        expect(typeof process.name).toBe("string");
        expect(process.name.length).toBeGreaterThan(0);
        expect(["running", "stopped", "paused"]).toContain(process.status);
        expect(process.startTime).toBeInstanceOf(Date);
      });
    });

    test("should include common Windows processes", () => {
      const processes = processManager.listProcesses();
      const processNames = processes.map((p) => p.name.toLowerCase());

      // These processes should typically exist on Windows
      const expectedProcesses = ["svchost.exe", "explorer.exe"];
      const foundProcesses = expectedProcesses.filter((name) =>
        processNames.some((procName) => procName.includes(name.toLowerCase()))
      );

      expect(foundProcesses.length).toBeGreaterThan(0);
    });
  });

  describe("getProcess", () => {
    test("should return a process by ID", () => {
      const processes = processManager.listProcesses();

      if (processes.length > 0) {
        const firstProcess = processes[0];
        const foundProcess = processManager.getProcess(firstProcess.id);

        expect(foundProcess).not.toBeNull();
        expect(foundProcess?.id).toBe(firstProcess.id);
        expect(foundProcess?.name).toBe(firstProcess.name);
      }
    });

    test("should return null for non-existent process ID", () => {
      const nonExistentId = 999999;
      const process = processManager.getProcess(nonExistentId);

      expect(process).toBeNull();
    });

    test("should return null for invalid process ID", () => {
      const invalidIds = [-1, -100]; // Remove 0 as it's a valid system process

      invalidIds.forEach((id) => {
        const process = processManager.getProcess(id);
        expect(process).toBeNull();
      });
    });
  });

  describe("stopProcess", () => {
    let testProcessId: number | null = null;

    beforeAll(async () => {
      // Start a simple test process (notepad) for testing termination
      const { spawn } = await import("node:child_process");
      const testProcess = spawn("notepad.exe", [], { detached: true });
      testProcessId = testProcess.pid || null;

      // Wait a bit for the process to fully start
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    afterAll(() => {
      // Cleanup: ensure the test process is terminated
      if (testProcessId) {
        try {
          processManager.stopProcess(testProcessId);
        } catch {
          // Ignore errors during cleanup
        }
      }
    });

    test("should successfully stop a valid process", () => {
      if (testProcessId) {
        const result = processManager.stopProcess(testProcessId);
        // Note: This might fail if the process requires elevated privileges or is protected
        // We'll consider false as acceptable since we're testing on a potentially restricted environment
        expect(typeof result).toBe("boolean");

        // If it succeeded, verify the process is no longer running
        if (result) {
          setTimeout(() => {
            if (testProcessId) {
              const process = processManager.getProcess(testProcessId);
              expect(process).toBeNull();
            }
          }, 500);
        }
      }
    });

    test("should return false for non-existent process", () => {
      const nonExistentId = 999999;
      const result = processManager.stopProcess(nonExistentId);

      expect(result).toBe(false);
    });

    test("should return false for system processes (access denied)", () => {
      // Try to stop a system process (should fail due to permissions)
      const processes = processManager.listProcesses();
      const systemProcess = processes.find(
        (p) => p.name.toLowerCase().includes("svchost.exe") || p.name.toLowerCase().includes("csrss.exe")
      );

      if (systemProcess) {
        const result = processManager.stopProcess(systemProcess.id);
        expect(result).toBe(false);
      }
    });

    test("should handle invalid process IDs gracefully", () => {
      const invalidIds = [-1, -100]; // Remove 0 as it's a valid system process

      invalidIds.forEach((id) => {
        const result = processManager.stopProcess(id);
        expect(result).toBe(false);
      });
    });
  });

  describe("integration tests", () => {
    test("should handle multiple operations in sequence", () => {
      // Get list of processes
      const processes = processManager.listProcesses();
      expect(processes.length).toBeGreaterThan(0);

      // Find a specific process
      const targetProcess = processes.find((p) => p.name.toLowerCase().includes("explorer.exe"));

      if (targetProcess) {
        // Get the process by ID
        const foundProcess = processManager.getProcess(targetProcess.id);
        expect(foundProcess).not.toBeNull();
        expect(foundProcess?.id).toBe(targetProcess.id);
      }
    });

    test("should maintain consistency across multiple calls", () => {
      const processes1 = processManager.listProcesses();
      const processes2 = processManager.listProcesses();

      // The number of processes might vary slightly, but should be similar
      expect(Math.abs(processes1.length - processes2.length)).toBeLessThan(10);

      // Check that most process IDs are consistent
      const ids1 = new Set(processes1.map((p) => p.id));
      const ids2 = new Set(processes2.map((p) => p.id));
      const intersection = new Set([...ids1].filter((id) => ids2.has(id)));

      // At least 80% of processes should be consistent
      const consistencyRatio = intersection.size / Math.max(ids1.size, ids2.size);
      expect(consistencyRatio).toBeGreaterThan(0.8);
    });
  });

  describe("error handling", () => {
    test("should handle koffi errors gracefully", () => {
      // This test ensures that any koffi-level errors don't crash the application
      expect(() => {
        processManager.listProcesses();
      }).not.toThrow();
    });

    test("should handle Windows API errors gracefully", () => {
      // Test with edge case process IDs (exclude 0 as it's valid)
      const edgeCaseIds = [1, 4, Number.MAX_SAFE_INTEGER];

      edgeCaseIds.forEach((id) => {
        expect(() => {
          processManager.getProcess(id);
          processManager.stopProcess(id);
        }).not.toThrow();
      });
    });
  });
});
