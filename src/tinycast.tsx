import { Action, ActionPanel, Clipboard, Grid, Form, Icon, environment as host, getPreferenceValues, showInFinder, openExtensionPreferences } from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { execa } from "./tinycast-execa";

import { loadThumbnail } from "./tinycast-thumbnail";
import { downloadSupervisor } from "./download-control";
import { controlState, createJob, exitCode, isAlive, readLog, runningJobs, signal, updateJob, type Job, type JobInfo } from "./tinycast-jobs";
import { audioTracks, formatArgs, formatLabel, formats, qualityLabel, resolutions, validLanguage } from "./tinycast-formats";
import { cookieFailure, describeCookieCheck, privacySettingsUrl, withoutCookies, type CookieCheck } from "./tinycast-cookies";
import { decimalSeparator, parseProgress, progressCard, type Progress } from "./tinycast-progress";

type Preferences = { downloadPath?: string; ytdlPath?: string; ffmpegPath?: string; ffprobePath?: string; forceIpv4?: boolean; cookiesFromBrowser?: string; autoLoadUrlFromClipboard?: boolean };
type Metadata = { title?: string; duration?: number; live_status?: string; thumbnail?: string; formats?: Parameters<typeof audioTracks>[0] };
const prefs = getPreferenceValues<Preferences>();
const expand = (value: string) => value.replace(/^~(?=\/|$)/, homedir());
function executable(name: string, preference?: string) {
  const candidates = [preference && expand(preference.trim()), `/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`, ...String(process.env.PATH || "").split(":").filter(Boolean).map(p => path.join(p, name))];
  const found = candidates.find(p => p && existsSync(p));
  if (!found) throw new Error(`${name} was not found. Set its full path in extension preferences (run “which ${name}” in Terminal).`);
  return found;
}
function tools() {
  return { ytdlp: executable("yt-dlp", prefs.ytdlPath), ffmpeg: executable("ffmpeg", prefs.ffmpegPath), ffprobe: executable("ffprobe", prefs.ffprobePath) };
}
function environment() {
  return { ...process.env, PATH: ["/opt/homebrew/bin", "/usr/local/bin", process.env.PATH, "/usr/bin", "/bin"].filter(Boolean).join(":"), PYTHONUNBUFFERED: "1" };
}
function common() {
  const args = ["--ignore-config", "--socket-timeout", "20", "--retries", "1", "--extractor-retries", "1"];
  if (prefs.forceIpv4) args.push("--force-ipv4");
  if (prefs.cookiesFromBrowser && prefs.cookiesFromBrowser !== "none") args.push("--cookies-from-browser", prefs.cookiesFromBrowser);
  return args;
}
function valid(value: string) {
  try { return ["https:", "http:"].includes(new URL(value.trim()).protocol); } catch { return false; }
}
function details(error: unknown) {
  const e = error as { stderr?: string; message?: string };
  return e.stderr?.trim() || e.message || String(error);
}

export default function TinycastDownloader() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState("mp4");
  const [resolution, setResolution] = useState("highest");
  const [audioLanguage, setAudioLanguage] = useState("original");
  const [playlist, setPlaylist] = useState(false);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [status, setStatus] = useState("Paste a video URL. Press Return to download.");
  const [error, setError] = useState("");
  const [cookieNote, setCookieNote] = useState("");
  const [cookieCheck, setCookieCheck] = useState<CookieCheck | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [thumbnail, setThumbnail] = useState<string | undefined>();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [retry, setRetry] = useState(0);
  const [paused, setPaused] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [jobInfo, setJobInfo] = useState<JobInfo | null>(null);
  const [videoSize, setVideoSize] = useState("");
  const [look, setLook] = useState<{ accent?: string; decimal?: string }>({});
  // Original, dubbed and auto-dubbed audio tracks of the looked-up video.
  const languages = audioTracks(metadata?.formats);
  useEffect(() => {
    if (audioLanguage !== "original" && !languages.tracks.some(track => track.value === audioLanguage)) setAudioLanguage("original");
  }, [metadata]);
  const activeJob = useRef<Job | null>(null);
  const busy = useRef(false);
  const edited = useRef(false);
  const lookupVersion = useRef(0);

  // Downie colours its bar with the macOS accent colour and formats numbers for the
  // user's region; read both once. Unset accent (multicolour) falls back to blue.
  useEffect(() => {
    void Promise.all([
      execa("/usr/bin/defaults", ["read", "-g", "AppleAccentColor"]).then(r => r.stdout.trim(), () => undefined),
      execa("/usr/bin/defaults", ["read", "-g", "AppleLocale"]).then(r => decimalSeparator(r.stdout.trim()), () => undefined),
    ]).then(([accent, decimal]) => setLook({ accent, decimal }));
  }, []);

  useEffect(() => {
    if (prefs.autoLoadUrlFromClipboard) Clipboard.readText().then(text => {
      if (!edited.current && !busy.current && text && valid(text)) setUrl(text.trim());
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (downloading) return;
    let cancelled = false;
    const version = ++lookupVersion.current;
    setMetadata(null); setThumbnail(undefined); setError(""); setFiles([]); setCookieNote("");
    if (!url.trim()) { setLoading(false); setStatus("Paste a video URL. Press Return to download."); return; }
    if (!valid(url)) { setLoading(false); setStatus("Enter a complete http:// or https:// video URL."); return; }
    setLoading(true); setStatus("Loading video details… You can also press Return to download now.");
    const timer = setTimeout(async () => {
      try {
        const { ytdlp } = tools();
        const lookupArgs = [...common(), "--no-playlist", "--skip-download", "--dump-single-json", "--", url.trim()];
        const result = await execa(ytdlp, lookupArgs, { env: environment(), timeout: 90000 }).catch(e => {
          // Unreadable browser cookies abort yt-dlp; explain why and look up publicly.
          const note = cookieFailure(details(e), prefs.cookiesFromBrowser);
          if (!note) throw e;
          if (!cancelled && version === lookupVersion.current) setCookieNote(`${note} Continuing without cookies.`);
          return execa(ytdlp, withoutCookies(lookupArgs), { env: environment(), timeout: 90000 });
        });
        const info = JSON.parse(result.stdout) as Metadata;
        if (!cancelled && version === lookupVersion.current) { setMetadata(info); if (!busy.current) setStatus("Ready. Choose a format and press Return to download.");
          if (info.thumbnail?.startsWith("https://")) {
            void loadThumbnail(info.thumbnail, tools().ffmpeg, host?.appearance).then(image => {
              if (!cancelled && version === lookupVersion.current) setThumbnail(image);
            }).catch(() => {});
          } }
      } catch (e) {
        if (!cancelled && version === lookupVersion.current && !busy.current) { setError(details(e)); setStatus("Video lookup failed. See the error below, retry, or try Download."); }
      } finally { if (!cancelled && version === lookupVersion.current) setLoading(false); }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [url, retry]);

  useEffect(() => {
    const job = activeJob.current;
    if (!job || !metadata?.title || job.info.title || job.info.url !== url.trim()) return;
    updateJob(job, { title: metadata.title, duration: metadata.duration, thumbnail: metadata.thumbnail });
    setJobInfo(job.info);
  }, [metadata]);

  // Reads the chosen browser's cookies the same way downloads do, inside Tinycast so
  // macOS applies Tinycast's permissions, and reports what was found. The temporary
  // cookie file holds session cookies, so it is deleted straight away.
  async function checkBrowserCookies() {
    const browser = prefs.cookiesFromBrowser;
    if (!browser || browser === "none") {
      setCookieCheck({ ok: false, message: "Use Cookies from Browser is set to None. Choose your browser in Extension Preferences, then check again." });
      return;
    }
    setCookieCheck({ ok: true, message: "Checking… If macOS asks Tinycast for Keychain access, choose Always Allow." });
    const directory = mkdtempSync(path.join(tmpdir(), "tinycast-cookies-"));
    const file = path.join(directory, "cookies.txt");
    try {
      const output = await execa(tools().ytdlp, ["--ignore-config", "--cookies-from-browser", browser, "--cookies", file], { env: environment(), timeout: 120000 })
        .then(r => `${r.stdout}\n${r.stderr}`, (e: { stdout?: string; stderr?: string; message?: string }) => `${e.stdout ?? ""}\n${e.stderr ?? e.message ?? ""}`);
      let cookies = "";
      try { cookies = readFileSync(file, "utf8"); } catch { /* nothing was written */ }
      setCookieCheck(describeCookieCheck(output, cookies, browser));
    } catch (e) {
      setCookieCheck({ ok: false, message: details(e) });
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }

  function controlDownload(next: "running" | "paused" | "stop") {
    const job = activeJob.current;
    if (!job || controlState(job) === "stop") return;
    try {
      writeFileSync(job.control, next);
      // Also signal yt-dlp directly in case the supervisor that started it is gone.
      void signal(job, next === "paused" ? "STOP" : next === "running" ? "CONT" : "TERM").then(() => next === "stop" ? signal(job, "CONT") : undefined);
      setPaused(next === "paused"); setStopping(next === "stop");
      setStatus(next === "paused" ? "Paused — resume or stop using Actions." : next === "stop" ? "Stopping download…" : "Resuming download…");
    } catch (e) { setError(`Could not control download: ${details(e)}`); }
  }

  // Follow a job's log until it ends. Resolves with yt-dlp's exit code, or undefined
  // when the supervisor disappeared and the result has to be read from the log.
  function watch(job: Job) {
    return new Promise<number | undefined>(resolve => {
      // Tinycast re-decodes the whole card SVG on every update (~50 ms), so redraw it
      // at most once a second; phase changes (paused, processing…) show at once.
      let last = "", shownAt = 0, shownPhase = "", ticks = 0, checking = false, deadSince = 0;
      const timer = setInterval(async () => {
        const state = controlState(job);
        setPaused(state === "paused");
        if (state === "running") {
          const next = parseProgress(readLog(job));
          if (next && JSON.stringify(next) !== last && (next.phase !== shownPhase || Date.now() - shownAt >= 1000)) {
            last = JSON.stringify(next); shownAt = Date.now(); shownPhase = next.phase; setProgress(next);
            if (next.resolution && /^\d+x\d+$/.test(next.resolution)) setVideoSize(next.resolution);
            setStatus(next.phase === "processing" ? "Finishing the file…" : "Downloading… You can close this command and reopen it to see progress.");
          }
        }
        const code = exitCode(job);
        if (code !== undefined) { clearInterval(timer); resolve(code); return; }
        if (++ticks % 4 || checking) return;
        checking = true;
        const alive = await isAlive(job);
        checking = false;
        if (alive) deadSince = 0;
        else if (!deadSince) deadSince = Date.now();
        else if (Date.now() - deadSince > 1500 && exitCode(job) === undefined) { clearInterval(timer); resolve(undefined); }
      }, 250);
    });
  }

  function finish(job: Job, code: number | undefined) {
    const log = readLog(job);
    const saved = log.split(/\r?\n/).flatMap(line => {
      try { const file = JSON.parse(line); return typeof file === "string" && existsSync(file) ? [file] : []; } catch { return []; }
    });
    if (code === 130 || controlState(job) === "stop") {
      setProgress(previous => ({ ...previous, percent: previous?.percent ?? null, phase: "stopped" }));
      setError(""); setStatus("Download stopped. Partial files are kept for a later retry.");
    } else if ((code === 0 || code === undefined) && saved.length) {
      setProgress({ phase: "complete", percent: 100, total: saved.reduce((sum, file) => { try { return sum + statSync(file).size; } catch { return sum; } }, 0) });
      setFiles(saved); setStatus(`Saved ${saved.length} file${saved.length === 1 ? "" : "s"} to ${job.info.directory}`);
    } else {
      setProgress(previous => ({ percent: previous?.percent ?? null, phase: "error" }));
      setError(log || "yt-dlp finished but did not report a saved file."); setStatus("Download failed. The error below explains why.");
    }
  }

  // Show a download that is already running (started earlier or from another window).
  async function follow(job: Job, message: string) {
    busy.current = true; activeJob.current = job; setJobInfo(job.info);
    setLoading(false); setDownloading(true); setError(""); setFiles([]); setStopping(false);
    setProgress({ phase: "starting", percent: null }); setStatus(message);
    if (job.info.thumbnail?.startsWith("https://")) void loadThumbnail(job.info.thumbnail, tools().ffmpeg, host?.appearance).then(setThumbnail).catch(() => {});
    try { finish(job, await watch(job)); }
    finally { activeJob.current = null; setPaused(false); setStopping(false); busy.current = false; setDownloading(false); }
  }

  useEffect(() => {
    void runningJobs().then(jobs => {
      if (jobs[0] && !busy.current) void follow(jobs[0], "This download kept running while the command was closed.");
    });
  }, []);

  async function download(values: Record<string, unknown>) {
    if (busy.current) return;
    const link = String(values.url ?? url).trim();
    if (!valid(link)) { setError("Enter a complete http:// or https:// video URL."); return; }
    busy.current = true; setPaused(false); setStopping(false); setLoading(false); setDownloading(true); setError(""); setFiles([]);
    setProgress({ phase: "starting", percent: null });
    setStatus("Preparing download…");
    try {
      // Never run the same video twice at once: both runs would write the same .part files.
      const requested = String(values.audio || audioLanguage || "original");
      const audio = requested !== "original" && validLanguage(requested) ? requested : "original";
      // A dubbed download is a different file, so it may run beside the original.
      const existing = (await runningJobs()).find(job => job.info.url === link && (job.info.audio ?? "original") === audio);
      if (existing) { busy.current = false; await follow(existing, "This video is already downloading — showing that download."); return; }
      const bin = tools();
      const directory = expand(prefs.downloadPath || "~/Downloads");
      mkdirSync(directory, { recursive: true });
      const choice = String(values.format || format || "mp4");
      const quality = String(values.resolution || resolution || "highest");
      let args = [...common(), values.playlist ?? playlist ? "--yes-playlist" : "--no-playlist", "--ffmpeg-location", path.dirname(bin.ffmpeg), "--newline", "--progress", "--progress-delta", "0.25", "--progress-template", "download:TINYCAST_PROGRESS:%(progress._percent_str)s|%(info.format_id)s|%(info.playlist_index)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s|%(info.resolution)s|%(info.vcodec)s|%(info.ext)s", "--progress-template", "postprocess:TINYCAST_PROCESSING:%(progress.status)s", "--print", "video:TINYCAST_FORMATS:%(requested_formats.:.{format_id,filesize,filesize_approx})j", "--print", "after_move:%(filepath)j", "--no-simulate", "-P", directory, "-o", audio === "original" ? "%(title).180B [%(id)s].%(ext)s" : `%(title).180B [%(id)s].${audio}.%(ext)s`];
      args.push(...formatArgs(choice, quality, audio));
      args.push("--", link);
      const job = createJob({ url: link, title: metadata?.title, duration: metadata?.duration, thumbnail: metadata?.thumbnail, format: formatLabel(choice), quality: qualityLabel(choice, quality), audio, audioName: languages.tracks.find(track => track.value === audio)?.title, directory, started: Date.now() });
      activeJob.current = job; setJobInfo(job.info);
      // Fixed shell code; the paths, executable and every yt-dlp argument are
      // positional parameters, never interpolated into shell code. The supervisor
      // outlives this command, so progress is read from the job folder, not the promise.
      const start = () => { void execa("/bin/sh", ["-c", downloadSupervisor, "tinycast-download", job.log, job.control, job.status, job.pid, bin.ytdlp, ...args], { env: environment(), timeout: 0 }).catch(() => {}); };
      start();
      let code = await watch(job);
      // yt-dlp stops before downloading if it can't read browser cookies: retry once without them.
      const note = code && code !== 130 && controlState(job) !== "stop" ? cookieFailure(readLog(job), prefs.cookiesFromBrowser) : undefined;
      if (note) {
        setCookieNote(`${note} Downloading without cookies.`);
        args = withoutCookies(args); rmSync(job.status, { force: true }); rmSync(job.pid, { force: true });
        start(); code = await watch(job);
      }
      finish(job, code);
    } catch (e) {
      setProgress(previous => ({ percent: previous?.percent ?? null, phase: "error" }));
      setError(details(e)); setStatus("Download failed. The error below explains why.");
    } finally {
      activeJob.current = null; setPaused(false); setStopping(false);
      busy.current = false; setDownloading(false);
    }
  }

  if (progress) return <Grid columns={1} aspectRatio={"720/108" as Grid.AspectRatio} inset={Grid.Inset.Zero} fit={Grid.Fit.Contain} filtering={false} selectedItemId="active-download">
    <Grid.Item
      id="active-download"
      content={{ source: progressCard(stopping ? { ...progress, phase: "stopping" } : paused ? { ...progress, phase: "paused" } : progress, jobInfo?.title || metadata?.title || jobInfo?.url || url, error || status, {
        source: (() => { try { return new URL(jobInfo?.url || url).hostname; } catch { return ""; } })(),
        format: (jobInfo?.format ?? formatLabel(format)) === "Original" ? progress.extension?.toUpperCase() || "Original" : jobInfo?.format ?? formatLabel(format),
        resolution: videoSize || jobInfo?.quality || qualityLabel(format, resolution), audio: jobInfo?.audioName,
        thumbnail, appearance: host?.appearance, accent: look.accent, decimal: look.decimal,
      }) }}
      subtitle={error ? "Download failed — use Copy Error in Actions for details." : `${status}${cookieNote ? " · Browser cookies unavailable — see Cookies in the form" : ""}`}
      actions={<ActionPanel>
        {downloading && !stopping && <Action title={paused ? "Resume Download" : "Pause Download"} icon={paused ? Icon.Play : Icon.Pause} shortcut={{ modifiers: ["cmd"], key: "p" }} onAction={() => controlDownload(paused ? "running" : "paused")} />}
        {downloading && !stopping && <Action title="Stop Download" icon={Icon.Stop} shortcut={{ modifiers: ["cmd"], key: "." }} onAction={() => controlDownload("stop")} />}
        {!downloading && <Action title="New Download" icon={Icon.ArrowClockwise} onAction={() => { setProgress(null); setError(""); setJobInfo(null); setVideoSize(""); }} />}
        {files.length > 0 && <Action title="Show Download in Finder" icon={Icon.Finder} onAction={() => showInFinder(files[0])} />}
        {error && <Action.CopyToClipboard title="Copy Error" content={error} />}
      </ActionPanel>}
    />
  </Grid>;

  return <Form isLoading={loading || downloading} actions={<ActionPanel>
    <Action.SubmitForm title={downloading ? "Downloading…" : "Download Video"} icon={Icon.Download} onSubmit={download} />
    <Action title="Reload Video Details" icon={Icon.ArrowClockwise} shortcut={{ modifiers: ["cmd"], key: "r" }} onAction={() => { if (!busy.current) setRetry(v => v + 1); }} />
    {files.length > 0 && <Action title="Show Download in Finder" icon={Icon.Finder} onAction={() => showInFinder(files[0])} />}
    {error && <Action.CopyToClipboard title="Copy Error" content={error} />}
    <Action title="Check Browser Cookies" icon={Icon.Lock} shortcut={{ modifiers: ["cmd", "shift"], key: "k" }} onAction={() => void checkBrowserCookies()} />
    {(cookieCheck?.needsPermission || /Full Disk Access|data from other apps/.test(cookieNote)) && <Action title="Open Privacy Settings" icon={Icon.Gear} onAction={() => void execa("/usr/bin/open", [privacySettingsUrl]).catch(() => {})} />}
    <Action title="Extension Preferences" onAction={openExtensionPreferences} />
  </ActionPanel>}>
    <Form.TextField id="url" title="Video URL" value={url} placeholder="https://www.youtube.com/watch?v=…" onChange={value => { if (!busy.current) { edited.current = true; setUrl(value); } }} />
    <Form.Dropdown id="format" title="Format" value={format} onChange={setFormat}>
      {formats.map(item => <Form.Dropdown.Item key={item.value} value={item.value} title={item.title} />)}
    </Form.Dropdown>
    {format === "mp4" && <Form.Dropdown id="resolution" title="Resolution" value={resolution} onChange={setResolution}>
      {resolutions.map(item => <Form.Dropdown.Item key={item.value} value={item.value} title={item.title} />)}
    </Form.Dropdown>}
    {languages.tracks.length > 0 && <Form.Dropdown id="audio" title="Audio Language" value={audioLanguage} onChange={setAudioLanguage}>
      <Form.Dropdown.Item value="original" title={languages.original ? `Original — ${languages.original}` : "Original"} />
      {languages.tracks.map(track => <Form.Dropdown.Item key={track.value} value={track.value} title={`${track.title} (dubbed)`} />)}
    </Form.Dropdown>}
    <Form.Checkbox id="playlist" title="Playlist" label="Download the entire playlist" value={playlist} onChange={setPlaylist} />
    <Form.Description title="Status" text={status} />
    {(cookieCheck || cookieNote) && <Form.Description title="Cookies" text={cookieCheck?.message || cookieNote} />}
    {metadata?.title && <Form.Description title="Video" text={metadata.title} />}
    {error && <Form.Description title="Error" text={error.slice(-3000)} />}
    {files.length > 0 && <Form.Description title="Saved file" text={files.join("\n")} />}
  </Form>;
}
