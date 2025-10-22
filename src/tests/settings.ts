import { ShellExecuteW, SW_SHOW } from "@/windows/apps/koffi-defs";

const wide = Buffer.from("ms-settings:otherusers\0", "utf16le");
ShellExecuteW(null, null, wide, null, null, SW_SHOW);
