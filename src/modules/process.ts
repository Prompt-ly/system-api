export interface Process {
  id: number;
  name: string;
  status: "running" | "stopped" | "paused";
  startTime: Date;
  endTime?: Date;
}

export interface ProcessManager {
  stopProcess(id: number): boolean;
  getProcess(id: number): Process | null;
  listProcesses(): Process[];
}
