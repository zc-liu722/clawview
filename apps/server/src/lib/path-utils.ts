import { homedir } from "node:os";
import { resolve } from "node:path";

export function expandHomePath(filePath: string): string {
  if (filePath === "~") {
    return homedir();
  }

  if (filePath.startsWith("~/")) {
    return resolve(homedir(), filePath.slice(2));
  }

  return filePath;
}
