// The extension uses only buffered, promise-based execa calls. Tinycast provides
// execFile, but not the full Node stream/util surface required by execa 9.
import { execFile } from "node:child_process";

export class ExecaError extends Error {
  stdout = "";
  stderr = "";
  exitCode?: number;
  code?: string | number;
  shortMessage = "";
}

export function execa(
  file: string,
  args: string[] = [],
  options: { env?: NodeJS.ProcessEnv; cwd?: string; timeout?: number } = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { ...options, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      const output = String(stdout ?? "").replace(/\r?\n$/, "");
      const errors = String(stderr ?? "").replace(/\r?\n$/, "");
      if (error) {
        const failure = new ExecaError(error.message);
        failure.name = "ExecaError";
        failure.stdout = output;
        failure.stderr = errors;
        failure.code = error.code;
        failure.exitCode = typeof error.code === "number" ? error.code : undefined;
        failure.shortMessage = error.message;
        reject(failure);
      } else {
        resolve({ stdout: output, stderr: errors, exitCode: 0 });
      }
    });
  });
}
