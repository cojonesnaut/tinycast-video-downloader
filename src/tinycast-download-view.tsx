import { Action, ActionPanel, Detail, Icon, closeMainWindow, environment } from "@raycast/api";
import path from "node:path";
import { bytes, timeLeft, type Progress } from "./tinycast-progress.js";
import { finishedAt, finishedPanel, progressPanel } from "./tinycast-panel.js";

// The download window: a details panel while downloading and a "Download completed"
// screen afterwards. Each is drawn as one transparent image in a
// Detail view, so Tinycast's liquid-glass panel shows through (a Grid tile would put a
// selection plate behind it). Detail keeps the previous image on screen while the next
// one decodes, so updates never flash.

function statusText(progress: Progress, paused: boolean, stopping: boolean) {
  if (stopping) return "Cancelling…";
  if (paused) return "Paused";
  const item = progress.item ? ` (item ${progress.item})` : "";
  if (progress.phase === "starting") return "Preparing download…";
  if (progress.phase === "processing") return `Processing${item}…`;
  return `Downloading ${progress.resolution === "audio only" ? "audio" : "video"}${item}…`;
}

// Downloaded amount in whole megabytes ("55 MB"), with one decimal for GB.
function amount(n: number, decimal: string) {
  if (n >= 1e9) return bytes(n, decimal);
  if (n >= 1e6) return `${Math.round(n / 1e6)} MB`;
  return `${Math.round(n / 1000)} KB`;
}

export type DownloadingProps = {
  title: string; url: string; progress: Progress; paused: boolean; stopping: boolean;
  savePath?: string; decimal: string; color: string; note?: string;
  closeWhenDone: boolean; onCloseWhenDone: (value: boolean) => void;
  onPauseResume: () => void; onCancel: () => void;
};

export function DownloadingPanel(p: DownloadingProps) {
  const { progress, decimal } = p;
  const processing = progress.phase === "processing";
  const percent = processing ? 100 : progress.percent == null ? null : Math.floor(progress.percent);
  const running = !p.paused && !p.stopping && progress.phase === "download";
  const rows: [string, string][] = [
    ["URL", p.url],
    ["Status", statusText(progress, p.paused, p.stopping)],
    ["File size", progress.total ? bytes(progress.total, decimal) : "Unknown"],
    ["Downloaded", progress.downloaded !== undefined && progress.phase !== "starting" ? `${amount(progress.downloaded, decimal)}${percent == null ? "" : `  (${percent}%)`}` : "—"],
    ["Transfer rate", running && progress.speed ? `${bytes(progress.speed, decimal)}/s` : "—"],
    ["Time left", running && progress.eta !== undefined ? timeLeft(progress.eta) : "—"],
    ["Resume capability", "yt-dlp"],
    ["Save to", p.savePath || "Preparing…"],
  ];
  const markdown = `![](${progressPanel(p.title, rows, percent, p.color, environment.appearance)})${p.note ? `\n\n${p.note}` : ""}`;
  return <Detail navigationTitle={p.title} markdown={markdown} actions={<ActionPanel>
    {!p.stopping && <Action title={p.paused ? "Resume" : "Pause"} icon={p.paused ? Icon.Play : Icon.Pause} shortcut={{ modifiers: ["cmd"], key: "p" }} onAction={p.onPauseResume} />}
    {!p.stopping && <Action title="Cancel Download" icon={Icon.XMarkCircle} style={Action.Style.Destructive} shortcut={{ modifiers: ["cmd"], key: "." }} onAction={p.onCancel} />}
    <Action title={p.closeWhenDone ? "Keep Open When Completed" : "Close When Completed"} icon={p.closeWhenDone ? Icon.CheckCircle : Icon.Circle} shortcut={{ modifiers: ["cmd", "shift"], key: "w" }} onAction={() => p.onCloseWhenDone(!p.closeWhenDone)} />
    <Action.CopyToClipboard title="Copy URL" content={p.url} shortcut={{ modifiers: ["cmd", "shift"], key: "c" }} />
    {p.savePath && <Action.ShowInFinder title="Show Download Folder" path={path.dirname(p.savePath)} />}
  </ActionPanel>} />;
}

export type FinishedProps = {
  kind: "complete" | "error" | "stopped"; title: string; url: string; files: string[]; size?: number;
  directory: string; savePath?: string; finishedAt: Date; error?: string; decimal: string;
  onRetry: () => void; onNew: () => void;
};

export function FinishedDetail(p: FinishedProps) {
  const file = p.files[0];
  // Before yt-dlp has named the file, fall back to the title (never a piece of the URL).
  const name = p.files.length > 1 ? `${p.files.length} files` : file || p.savePath ? path.basename(file || p.savePath!) : p.title !== p.url ? p.title : "";
  const location = file ? path.dirname(file) : p.savePath ? path.dirname(p.savePath) : p.directory;
  const errorLine = (p.error || "").split(/\r?\n/).reverse().find(line => line.startsWith("ERROR:"))?.replace(/^ERROR:\s*/, "") || "See Copy Error for details";
  const heading = p.kind === "complete" ? "Download completed" : p.kind === "error" ? "Download failed" : "Download cancelled";
  const rows: [string, string][] = p.kind === "complete"
    ? [["Size", p.size !== undefined ? bytes(p.size, p.decimal) : "—"], ["Location", location], ["URL", p.url], ["Finished", finishedAt(p.finishedAt)]]
    : p.kind === "error"
      ? [["Location", location], ["URL", p.url], ["Failed", finishedAt(p.finishedAt)], ["Error", errorLine]]
      : [["Location", location], ["URL", p.url], ["Cancelled", finishedAt(p.finishedAt)], ["Partial", "Files kept — Resume continues"]];
  const close = <Action title="Close" icon={Icon.XMarkCircle} shortcut={{ modifiers: ["cmd"], key: "w" }} onAction={() => void closeMainWindow()} />;
  const another = <Action title="New Download" icon={Icon.Download} shortcut={{ modifiers: ["cmd"], key: "n" }} onAction={p.onNew} />;
  return <Detail navigationTitle={p.title} markdown={`![](${finishedPanel(p.kind, heading, name, rows, environment.appearance)})`}
    actions={<ActionPanel>
      {p.kind === "complete" && file && <Action.Open title="Open" target={file} />}
      {p.kind === "complete" && file && <Action.ShowInFinder path={file} />}
      {p.kind === "error" && <Action title="Try Again" icon={Icon.ArrowClockwise} onAction={p.onRetry} />}
      {p.kind === "stopped" && <Action title="Resume" icon={Icon.Play} onAction={p.onRetry} />}
      {p.kind === "error" && p.error && <Action.CopyToClipboard title="Copy Error" content={p.error} />}
      {close}
      {another}
      {file && <Action.CopyToClipboard title="Copy File Path" content={file} shortcut={{ modifiers: ["cmd", "shift"], key: "c" }} />}
    </ActionPanel>} />;
}
