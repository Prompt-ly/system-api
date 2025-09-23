import { exec } from "node:child_process";

export class Registry {
  static readonly HKLM = "HKEY_LOCAL_MACHINE";
  static readonly HKCU = "HKEY_CURRENT_USER";

  hive: string;
  key: string;

  constructor(opts: { hive: string; key: string }) {
    this.hive = opts.hive;
    this.key = opts.key;
  }

  keys(cb: (err: Error | null, subKeys?: Registry[]) => void) {
    const fullPath = `${this.hive}${this.key}`;
    const cmd = `REG QUERY "${fullPath}"`;

    exec(cmd, (err, stdout) => {
      if (err) return cb(err);

      const subKeys = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith(this.hive))
        .map((line) => new Registry({ hive: this.hive, key: line.replace(this.hive, "") }));

      cb(null, subKeys);
    });
  }

  values(cb: (err: Error | null, items?: { name: string; type: string; value: string }[]) => void) {
    const fullPath = `${this.hive}${this.key}`;
    const cmd = `REG QUERY "${fullPath}"`;

    exec(cmd, (err, stdout) => {
      if (err) return cb(err);

      const valueRegex = /^\s+([^\s]+)\s+REG_(\S+)\s+(.*)$/;
      const items = stdout
        .split(/\r?\n/)
        .map((line) => line.match(valueRegex))
        .filter((match): match is RegExpMatchArray => match !== null)
        .map((match) => ({
          name: match[1] || "",
          type: match[2] || "",
          value: match[3] || ""
        }));

      cb(null, items);
    });
  }
}
