import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "./tinycast-execa";

// Downloads keep running if the command is closed. Every download is a job folder
// under one shared root, so a reopened command can reattach to it and the same
// video is never downloaded twice at once (two yt-dlp runs would share .part files).
const root = path.join(tmpdir(), "tinycast-video-downloader");
export type JobInfo = { url: string; request?: Record<string, unknown>; title?: string; duration?: number; format?: string; quality?: string; audio?: string; audioName?: string; directory: string; started: number };
export type Job = { dir: string; log: string; control: string; status: string; pid: string; info: JobInfo };

function paths(dir: string, info: JobInfo): Job {
  return { dir, info, log: path.join(dir, "progress.log"), control: path.join(dir, "control"), status: path.join(dir, "status"), pid: path.join(dir, "pid") };
}
const read = (file: string) => { try { return readFileSync(file, "utf8").trim(); } catch { return ""; } };

export function createJob(info: JobInfo): Job {
  mkdirSync(root, { recursive: true });
  const job = paths(mkdtempSync(path.join(root, "job-")), info);
  writeFileSync(path.join(job.dir, "job.json"), JSON.stringify(info));
  writeFileSync(job.control, "running");
  return job;
}
// Fill in details that arrive after the download started (the lookup can finish later).
export function updateJob(job: Job, details: Partial<JobInfo>) {
  job.info = { ...job.info, ...details };
  try { writeFileSync(path.join(job.dir, "job.json"), JSON.stringify(job.info)); } catch { /* folder already removed */ }
}
export const readLog = (job: Job) => read(job.log);
export const controlState = (job: Job) => read(job.control);
// Exit code once the supervisor has finished, otherwise undefined.
export function exitCode(job: Job) { const code = read(job.status); return code ? Number(code) : undefined; }

// Signal the job's process group directly as well as through the control file, so
// pause/stop still work when the supervisor that started it is no longer running.
export async function signal(job: Job, name: "STOP" | "CONT" | "TERM") {
  const pid = read(job.pid);
  if (/^\d+$/.test(pid)) await execa("/bin/kill", [`-${name}`, "--", `-${pid}`]).catch(() => {});
}
export async function isAlive(job: Job) {
  const pid = read(job.pid);
  if (!/^\d+$/.test(pid)) return !existsSync(job.status) && Date.now() - statSync(job.dir).mtimeMs < 10000;
  return execa("/bin/kill", ["-0", pid]).then(() => true, () => false);
}

// Running jobs, newest first. Folders of jobs that ended over an hour ago are removed.
export async function runningJobs(): Promise<Job[]> {
  let names: string[] = [];
  try { names = readdirSync(root).filter(name => name.startsWith("job-")); } catch { return []; }
  const jobs: Job[] = [];
  for (const name of names) {
    const dir = path.join(root, name);
    try {
      const job = paths(dir, JSON.parse(readFileSync(path.join(dir, "job.json"), "utf8")) as JobInfo);
      if (await isAlive(job)) jobs.push(job);
      else if (Date.now() - statSync(dir).mtimeMs > 3600000) rmSync(dir, { recursive: true, force: true });
    } catch { /* a folder being created or removed */ }
  }
  return jobs.sort((a, b) => b.info.started - a.info.started);
}
