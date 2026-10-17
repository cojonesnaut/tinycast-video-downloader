"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/tinycast.tsx
var tinycast_exports = {};
__export(tinycast_exports, {
  default: () => TinycastDownloader
});
module.exports = __toCommonJS(tinycast_exports);
var import_api = require("@raycast/api");
var import_react = require("react");
var import_node_fs3 = require("node:fs");
var import_node_os3 = require("node:os");
var import_node_path3 = __toESM(require("node:path"), 1);

// src/tinycast-execa.ts
var import_node_child_process = require("node:child_process");
var ExecaError = class extends Error {
  stdout = "";
  stderr = "";
  exitCode;
  code;
  shortMessage = "";
};
function execa(file, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    (0, import_node_child_process.execFile)(file, args, { ...options, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      const output = String(stdout ?? "").replace(/\r?\n$/, "");
      const errors = String(stderr ?? "").replace(/\r?\n$/, "");
      if (error) {
        const failure = new ExecaError(error.message);
        failure.name = "ExecaError";
        failure.stdout = output;
        failure.stderr = errors;
        failure.code = error.code;
        failure.exitCode = typeof error.code === "number" ? error.code : void 0;
        failure.shortMessage = error.message;
        reject(failure);
      } else {
        resolve({ stdout: output, stderr: errors, exitCode: 0 });
      }
    });
  });
}

// src/tinycast-thumbnail.ts
var import_node_fs = require("node:fs");
var import_node_os = require("node:os");
var import_node_path = __toESM(require("node:path"), 1);
var CARD_WIDTH = 720;
var CARD_HEIGHT = 108;
var SAMPLE_WIDTH = 360;
var SAMPLE_HEIGHT = 54;
function dimPixels(rgb, appearance) {
  const out = new Uint8Array(rgb.length);
  for (let i = 0; i < rgb.length; i++) out[i] = appearance === "light" ? Math.round(0.25 * rgb[i] + 0.75 * 242) : Math.round(rgb[i] * 0.33);
  return out;
}
function thumbnailPaths(rgb, width = SAMPLE_WIDTH, height = SAMPLE_HEIGHT) {
  if (rgb.length !== width * height * 3) throw new Error("Invalid thumbnail pixels");
  const colors = /* @__PURE__ */ new Map();
  const colorAt = (pixel) => [0, 1, 2].map((c) => (rgb[pixel * 3 + c] & 248).toString(16).padStart(2, "0")).join("");
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; ) {
      const start = x, color = colorAt(y * width + x++);
      while (x < width && colorAt(y * width + x) === color) x++;
      const runs = colors.get(color) || [];
      runs.push(`M${start} ${y}.5h${x - start}.3`);
      colors.set(color, runs);
    }
  }
  return `<g transform="scale(${CARD_WIDTH / width} ${CARD_HEIGHT / height})" fill="none" stroke-width="1.1">${[...colors].map(([color, runs]) => `<path stroke="#${color}" d="${runs.join("")}"/>`).join("")}</g>`;
}
async function loadThumbnail(url, ffmpeg, appearance) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Thumbnail request failed");
  const data = await response.arrayBuffer();
  if (!data.byteLength || data.byteLength > 8e6) throw new Error("Thumbnail is too large");
  const directory = (0, import_node_fs.mkdtempSync)(import_node_path.default.join((0, import_node_os.tmpdir)(), "tinycast-thumbnail-"));
  try {
    const input = import_node_path.default.join(directory, "image"), output = import_node_path.default.join(directory, "pixels.rgb");
    (0, import_node_fs.writeFileSync)(input, Buffer.from(data));
    const filter = `scale=${SAMPLE_WIDTH}:${SAMPLE_HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos,crop=${SAMPLE_WIDTH}:${SAMPLE_HEIGHT}`;
    await execa(ffmpeg, ["-nostdin", "-v", "error", "-i", input, "-vf", filter, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", output], { timeout: 15e3 });
    return thumbnailPaths(dimPixels((0, import_node_fs.readFileSync)(output), appearance));
  } finally {
    (0, import_node_fs.rmSync)(directory, { recursive: true, force: true });
  }
}

// src/download-control.ts
var downloadSupervisor = `
set -m
log="$1"; control="$2"; status="$3"; pidfile="$4"; shift 4
# After the command closes, the supervisor's own stdout/stderr pipes are broken; a job
# notice ("Terminated") written there would kill it with SIGPIPE before it records the result.
exec >/dev/null 2>&1
"$@" >"$log" 2>&1 &
job=$!
echo "$job" >"$pidfile"
last=running
while kill -0 "$job" 2>/dev/null; do
  desired=$(cat "$control" 2>/dev/null)
  if [ "$desired" = stop ]; then
    kill -TERM -"$job" 2>/dev/null
    kill -CONT -"$job" 2>/dev/null
    sleep 1
    kill -KILL -"$job" 2>/dev/null
    wait "$job" 2>/dev/null
    echo 130 >"$status"
    exit 130
  fi
  if [ "$desired" = paused ] && [ "$last" != paused ]; then
    kill -STOP -"$job" 2>/dev/null
    last=paused
  elif [ "$desired" = running ] && [ "$last" = paused ]; then
    kill -CONT -"$job" 2>/dev/null
    last=running
  fi
  sleep 0.2
done
wait "$job"
code=$?
echo "$code" >"$status"
[ "$code" = 0 ] && /usr/bin/afplay /System/Library/Sounds/Glass.aiff >/dev/null 2>&1
exit "$code"
`;

// src/tinycast-jobs.ts
var import_node_fs2 = require("node:fs");
var import_node_os2 = require("node:os");
var import_node_path2 = __toESM(require("node:path"), 1);
var root = import_node_path2.default.join((0, import_node_os2.tmpdir)(), "tinycast-video-downloader");
function paths(dir, info) {
  return { dir, info, log: import_node_path2.default.join(dir, "progress.log"), control: import_node_path2.default.join(dir, "control"), status: import_node_path2.default.join(dir, "status"), pid: import_node_path2.default.join(dir, "pid") };
}
var read = (file) => {
  try {
    return (0, import_node_fs2.readFileSync)(file, "utf8").trim();
  } catch {
    return "";
  }
};
function createJob(info) {
  (0, import_node_fs2.mkdirSync)(root, { recursive: true });
  const job = paths((0, import_node_fs2.mkdtempSync)(import_node_path2.default.join(root, "job-")), info);
  (0, import_node_fs2.writeFileSync)(import_node_path2.default.join(job.dir, "job.json"), JSON.stringify(info));
  (0, import_node_fs2.writeFileSync)(job.control, "running");
  return job;
}
function updateJob(job, details2) {
  job.info = { ...job.info, ...details2 };
  try {
    (0, import_node_fs2.writeFileSync)(import_node_path2.default.join(job.dir, "job.json"), JSON.stringify(job.info));
  } catch {
  }
}
var readLog = (job) => read(job.log);
var controlState = (job) => read(job.control);
function exitCode(job) {
  const code = read(job.status);
  return code ? Number(code) : void 0;
}
async function signal(job, name) {
  const pid = read(job.pid);
  if (/^\d+$/.test(pid)) await execa("/bin/kill", [`-${name}`, "--", `-${pid}`]).catch(() => {
  });
}
async function isAlive(job) {
  const pid = read(job.pid);
  if (!/^\d+$/.test(pid)) return !(0, import_node_fs2.existsSync)(job.status) && Date.now() - (0, import_node_fs2.statSync)(job.dir).mtimeMs < 1e4;
  return execa("/bin/kill", ["-0", pid]).then(() => true, () => false);
}
async function runningJobs() {
  let names2 = [];
  try {
    names2 = (0, import_node_fs2.readdirSync)(root).filter((name) => name.startsWith("job-"));
  } catch {
    return [];
  }
  const jobs = [];
  for (const name of names2) {
    const dir = import_node_path2.default.join(root, name);
    try {
      const job = paths(dir, JSON.parse((0, import_node_fs2.readFileSync)(import_node_path2.default.join(dir, "job.json"), "utf8")));
      if (await isAlive(job)) jobs.push(job);
      else if (Date.now() - (0, import_node_fs2.statSync)(dir).mtimeMs > 36e5) (0, import_node_fs2.rmSync)(dir, { recursive: true, force: true });
    } catch {
    }
  }
  return jobs.sort((a, b) => b.info.started - a.info.started);
}

// src/tinycast-formats.ts
var formats = [
  { value: "mp4", title: "MP4 video" },
  { value: "best", title: "Original format \xB7 highest resolution (may be WebM)" },
  { value: "mp3", title: "MP3 audio only" }
];
var resolutions = [
  { value: "highest", title: "Highest (4K)" },
  { value: "1440", title: "1440p" },
  { value: "1080", title: "1080p" },
  { value: "720", title: "720p" }
];
function formatLabel(choice) {
  return choice === "mp4" ? "MP4" : choice === "mp3" ? "MP3" : "Original";
}
function qualityLabel(choice, resolution) {
  return choice === "mp4" ? resolutions.find((item) => item.value === resolution)?.title ?? resolutions[0].title : choice === "mp3" ? "Audio" : "Highest";
}
var validLanguage = (code) => /^[A-Za-z0-9-]{1,20}$/.test(code);
function audioTracks(formats2 = []) {
  const languages = /* @__PURE__ */ new Map();
  for (const f of formats2) {
    if (f.vcodec !== "none" || !f.acodec || f.acodec === "none" || !f.language || !validLanguage(f.language)) continue;
    const name = (f.format_note || "").split(",")[0].replace(/\s*original|\s*\(default\)/gi, "").trim();
    const known = languages.get(f.language);
    languages.set(f.language, { name: known?.name || name || f.language, preference: Math.max(known?.preference ?? -1, f.language_preference ?? -1) });
  }
  if (languages.size < 2) return { tracks: [] };
  const best = Math.max(...[...languages.values()].map((l) => l.preference));
  const originalCode = best >= 5 ? [...languages].find(([, l]) => l.preference === best)?.[0] : void 0;
  const tracks = [...languages].filter(([code]) => code !== originalCode).map(([value, l]) => ({ value, title: l.name })).sort((a, b) => a.title.localeCompare(b.title));
  return { original: originalCode ? languages.get(originalCode)?.name : void 0, tracks };
}
function formatArgs(choice, resolution = "highest", audio = "original") {
  const lang = audio !== "original" && validLanguage(audio) ? `[language=${audio}]` : "";
  if (choice === "mp3") return ["-f", lang ? `ba${lang}/bestaudio/best` : "bestaudio/best", "-x", "--audio-format", "mp3", "--audio-quality", "0"];
  const select = lang ? `bv*+ba${lang}/bv*+ba/b` : "bv*+ba/b";
  if (choice === "mp4") {
    const res = /^\d+$/.test(resolution) ? `res:${resolution}` : "res";
    return [
      "-f",
      select,
      "-S",
      `${res},fps,ext:mp4:m4a`,
      "--merge-output-format",
      "mp4",
      "--remux-video",
      "mp4"
    ];
  }
  return ["-f", select, "-S", "res,fps"];
}

// src/tinycast-cookies.ts
var names = { safari: "Safari", chrome: "Chrome", brave: "Brave", edge: "Microsoft Edge", firefox: "Firefox", opera: "Opera", vivaldi: "Vivaldi" };
function cookieFailure(output, browser) {
  if (!browser || browser === "none") return void 0;
  const name = names[browser] || browser;
  const error = output.split(/\r?\n/).reverse().find((line) => line.startsWith("ERROR:")) || "";
  if (/Cookies\.binarycookies/.test(error) && /Operation not permitted|Permission denied/i.test(error))
    return `Tinycast can't read ${name} cookies. Give Tinycast Full Disk Access in System Settings \u2192 Privacy & Security, then restart Tinycast.`;
  if (/could not find \S+ cookies database/i.test(error))
    return `No ${name} cookie database was found. If ${name} is installed and signed in, allow Tinycast to access data from other apps in System Settings \u2192 Privacy & Security.`;
  if (/cookies database|cookies\.sqlite|keyring|could not copy .*cookie|failed to decrypt/i.test(error) && !/--cookies/.test(error))
    return `Couldn't read ${name} cookies: ${error.replace(/^ERROR:\s*/, "")}`;
  return void 0;
}
var privacySettingsUrl = "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles";
function describeCookieCheck(output, cookieFile, browser) {
  const name = names[browser.split(":")[0]] || browser;
  const failure = cookieFailure(output, browser);
  if (failure) return { ok: false, message: failure, needsPermission: /Full Disk Access|data from other apps/.test(failure) };
  const extracted = output.match(/Extracted (\d+) cookies from \S+(?: \((\d+) could not be decrypted\))?/);
  if (!extracted) {
    const error = output.split(/\r?\n/).reverse().find((line) => line.startsWith("ERROR:"));
    return { ok: false, message: `Couldn't read ${name} cookies${error ? `: ${error.replace(/^ERROR:\s*/, "")}` : "."}` };
  }
  const read2 = Number(extracted[1]), undecrypted = Number(extracted[2] || 0);
  const keychain = `When macOS asks Tinycast for \u201C${name} Safe Storage\u201D in the Keychain, choose Always Allow, then check again.`;
  if (!read2 && undecrypted) return { ok: false, message: `Found ${undecrypted} ${name} cookies but couldn't decrypt them. ${keychain}` };
  if (!read2) return { ok: false, message: `${name} has no saved cookies. Sign in to YouTube (or the site you download from) in ${name}, then check again.` };
  const youtube = cookieFile.split(/\r?\n/).map((line) => line.replace(/^#HttpOnly_/, "").split("	")).filter((f) => f.length >= 7 && /(^|\.)youtube\.com$/.test(f[0]));
  const signedIn = youtube.some((f) => ["LOGIN_INFO", "SAPISID", "__Secure-3PSID"].includes(f[5]));
  const youtubeText = signedIn ? "signed in to YouTube" : youtube.length ? `${youtube.length} YouTube cookies, but not signed in to YouTube` : "no YouTube cookies; sign in to YouTube in this browser if downloads ask you to sign in";
  return { ok: true, message: `Read ${read2} cookies from ${name}: ${youtubeText}.${undecrypted ? ` ${undecrypted} more couldn't be decrypted. ${keychain}` : ""}` };
}
function withoutCookies(args) {
  const index = args.indexOf("--cookies-from-browser");
  return index < 0 ? args : [...args.slice(0, index), ...args.slice(index + 2)];
}

// src/tinycast-progress.ts
var marker = "TINYCAST_PROGRESS:";
var number = (value) => {
  const n = Number(value);
  return value && Number.isFinite(n) && n >= 0 ? n : void 0;
};
function parseProgress(log) {
  const lines = log.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith("TINYCAST_PROCESSING:")) return { phase: "processing", percent: 100 };
    if (!lines[i].startsWith(marker)) continue;
    const [raw, format, item, downloaded, total, estimate, speed, eta, resolution, codec, extension] = lines[i].slice(marker.length).split("|");
    const percent = parseFloat(raw.replace("%", "").trim());
    return combine(lines, i, {
      phase: "download",
      percent: Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : null,
      format,
      item: item === "NA" ? void 0 : item,
      downloaded: number(downloaded),
      total: number(total) ?? number(estimate),
      speed: number(speed),
      eta: number(eta),
      resolution: resolution === "NA" ? void 0 : resolution,
      codec: codec === "NA" || codec === "none" ? void 0 : codec,
      extension: extension === "NA" ? void 0 : extension
    });
  }
  return null;
}
var formatsMarker = "TINYCAST_FORMATS:";
var size = (value) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
function combine(lines, end, current) {
  let start = end;
  while (start >= 0 && !lines[start].startsWith(formatsMarker)) start--;
  if (start < 0) return current;
  let requested;
  try {
    requested = JSON.parse(lines[start].slice(formatsMarker.length));
  } catch {
    return current;
  }
  if (!Array.isArray(requested) || requested.length < 2 || !requested.some((f) => String(f.format_id) === current.format)) return current;
  const reported = /* @__PURE__ */ new Map();
  for (let i = start + 1; i <= end; i++) if (lines[i].startsWith(marker)) {
    const [, format, , , total2, estimate] = lines[i].slice(marker.length).split("|");
    reported.set(format, number(total2) ?? number(estimate));
  }
  let total = 0, downloaded = 0;
  for (const f of requested) {
    const id = String(f.format_id);
    const expected = reported.get(id) ?? size(f.filesize) ?? size(f.filesize_approx);
    if (expected === void 0) return current;
    total += expected;
    downloaded += id === current.format ? Math.min(current.downloaded ?? 0, expected) : reported.has(id) ? expected : 0;
  }
  return {
    ...current,
    downloaded,
    total,
    percent: Math.min(100, downloaded / total * 100),
    eta: current.speed ? (total - downloaded) / current.speed : current.eta
  };
}
function bytes(n, decimal = ".") {
  if (n === void 0) return "";
  const one = (v) => v.toFixed(1).replace(".", decimal);
  if (n >= 1e9) return `${one(n / 1e9)} GB`;
  if (n >= 1e6) return `${one(n / 1e6)} MB`;
  return `${Math.round(n / 1e3)} KB`;
}
function time(n) {
  if (n === void 0) return "";
  n = Math.max(0, Math.round(n));
  const two = (v) => v.toString().padStart(2, "0");
  return n >= 3600 ? `${Math.floor(n / 3600)}:${two(Math.floor(n / 60) % 60)}:${two(n % 60)}` : `${two(Math.floor(n / 60))}:${two(n % 60)}`;
}
function decimalSeparator(appleLocale) {
  try {
    const region = (appleLocale.match(/@rg=([a-z]{2})/i)?.[1] || appleLocale.match(/_([A-Z]{2})/)?.[1] || "").toUpperCase();
    if (!region) return ".";
    const language = new Intl.Locale(`und-${region}`).maximize().language;
    return 1.5.toLocaleString(`${language}-${region}`).charAt(1) === "," ? "," : ".";
  } catch {
    return ".";
  }
}
var FONT = `font-family="'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif"`;
var xml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
var clip = (s, n) => [...s].length > n ? [...s].slice(0, n - 1).join("") + "\u2026" : s;
var accents = { "-1": "#6D6D6D", "0": "#C74044", "1": "#C06515", "2": "#B08A00", "3": "#4C9137", "4": "#1F63C4", "5": "#814784", "6": "#C13E7B" };
var mix = (hex, toward, amount) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount) + parseInt(toward.slice(i, i + 2), 16) * amount).toString(16).padStart(2, "0")).join("");
var themes = {
  dark: { card: "#4F4F4F", title: "#FAFAFA", muted: "#9E9E9E", track: "#484848", text: "#E8E8E8", icon: "#E0E0E0", edge: "#FFFFFF" },
  light: { card: "#F2F2F2", title: "#1D1D1F", muted: "#6E6E73", track: "#E3E3E6", text: "#1D1D1F", icon: "#3A3A3C", edge: "#000000" }
};
var glyphs = {
  pause: `<rect x="-3.6" y="-5.5" width="1.7" height="11" rx="0.8"/><rect x="1.9" y="-5.5" width="1.7" height="11" rx="0.8"/>`,
  play: `<path d="M-3 -5.5L5 0L-3 5.5Z"/>`,
  reveal: `<circle cx="-1.5" cy="-1.5" r="4.8" fill="none" stroke-width="1.6"/><path d="M2 2L5.6 5.6" fill="none" stroke-width="1.8" stroke-linecap="round"/>`,
  failed: `<path d="M0 -5.5V1.2" fill="none" stroke-width="1.9" stroke-linecap="round"/><circle cx="0" cy="4.6" r="1.2" stroke="none"/>`,
  subtitles: `<path d="M-7 -5.5h14a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1 -1.5 1.5h-8.5l-3 3v-3h-2.5a1.5 1.5 0 0 1 -1.5 -1.5v-7a1.5 1.5 0 0 1 1.5 -1.5z" fill="none" stroke-width="1.2"/><path d="M-4.5 -1.5h4M1.5 -1.5h3M-4.5 1.5h2.5M0 1.5h4.5" fill="none" stroke-width="1.1"/>`,
  more: `<circle r="7.5" fill="none" stroke-width="1.3"/><circle cx="-3.3" r="1.1" stroke="none"/><circle r="1.1" stroke="none"/><circle cx="3.3" r="1.1" stroke="none"/>`,
  close: `<circle r="7.5" fill="none" stroke-width="1.5"/><path d="M-2.8 -2.8L2.8 2.8M2.8 -2.8L-2.8 2.8" fill="none" stroke-width="1.6" stroke-linecap="round"/>`
};
var glyph = (name, x, y, color) => `<g transform="translate(${x} ${y})" fill="${color}" stroke="${color}">${glyphs[name]}</g>`;
function progressCard(progress, title, status, info = {}) {
  const light = info.appearance === "light";
  const theme = themes[light ? "light" : "dark"];
  const d = info.decimal || ".";
  const done = progress.phase === "complete", failed = progress.phase === "error";
  const idle = ["paused", "stopped", "stopping"].includes(progress.phase);
  const base = done ? "#2E5B2E" : failed ? "#7E2D2D" : idle ? "#6A6A6A" : accents[info.accent ?? "4"] ?? accents["4"];
  const fill = light ? mix(base, "#FFFFFF", 0.45) : base;
  const percent = done || failed ? 100 : progress.percent;
  const pct = percent == null ? "" : `${Math.floor(percent)}%`;
  const amount = progress.downloaded !== void 0 && progress.total ? `${bytes(progress.downloaded, d)}/${bytes(progress.total, d)}` : "";
  const line = progress.phase === "download" ? amount ? [pct, "Downloading", amount, progress.eta !== void 0 ? `${time(progress.eta)} remaining` : "", progress.speed ? `${bytes(progress.speed, d)}/s` : ""].filter(Boolean).join(" - ") : `Downloaded ${bytes(progress.downloaded ?? 0, d)} - unknown size - ${progress.speed ? `${bytes(progress.speed, d)}/s` : "Zero KB/s"}` : progress.phase === "processing" ? "Processing\u2026" : progress.phase === "starting" ? "Preparing download\u2026" : progress.phase === "paused" ? [pct, "Paused", amount].filter(Boolean).join(" - ") : progress.phase === "stopping" ? "Stopping\u2026" : progress.phase === "stopped" ? "Stopped. Partial files are kept." : done ? "Finished." : "Failed. Use Copy Error in Actions for details.";
  const host2 = (info.source || "").replace(/^www\./, "");
  const meta = [host2, info.format, info.resolution, info.audio, progress.item ? `Item ${progress.item}` : "", done && progress.total ? bytes(progress.total, d) : ""].filter(Boolean).join(" \u2013 ");
  const left = done ? glyph("reveal", 22, 89.5, theme.icon) : failed ? glyph("failed", 22, 89.5, theme.icon) : progress.phase === "paused" ? glyph("play", 22, 89.5, theme.icon) : progress.phase === "stopped" ? "" : glyph("pause", 22, 89.5, theme.icon);
  const width = percent == null ? 0 : Math.round(710 * percent / 100);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="108" viewBox="0 0 720 108"><defs><clipPath id="card"><rect width="720" height="108" rx="10"/></clipPath><clipPath id="pill"><rect x="5" y="76" width="710" height="27" rx="13.5"/></clipPath></defs><g clip-path="url(#card)"><rect width="720" height="108" fill="${theme.card}"/>${info.thumbnail || ""}</g><text x="16" y="28" fill="${theme.title}" ${FONT} font-size="14.5" font-weight="500">${xml(clip(title, 80))}</text><text x="16" y="47" fill="${theme.muted}" ${FONT} font-size="12">${xml(clip(meta, 100))}</text>` + glyph("close", 699, 21, theme.icon) + `<g clip-path="url(#pill)"><rect x="5" y="76" width="710" height="27" fill="${theme.track}" fill-opacity="0.92"/>${width ? `<rect x="5" y="76" width="${width}" height="27" fill="${fill}"/>` : ""}</g><rect x="5.5" y="76.5" width="709" height="26" rx="13" fill="none" stroke="${done ? "#5C9E5C" : theme.edge}" stroke-opacity="${done ? 0.7 : 0.18}"/>` + left + `<text x="360" y="93.8" text-anchor="middle" fill="${theme.text}" ${FONT} font-size="12.5">${xml(clip(line, 96))}</text>` + glyph("subtitles", 674, 89.5, theme.icon) + glyph("more", 699, 89.5, theme.icon) + `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// src/tinycast.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var prefs = (0, import_api.getPreferenceValues)();
var expand = (value) => value.replace(/^~(?=\/|$)/, (0, import_node_os3.homedir)());
function executable(name, preference) {
  const candidates = [preference && expand(preference.trim()), `/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`, ...String(process.env.PATH || "").split(":").filter(Boolean).map((p) => import_node_path3.default.join(p, name))];
  const found = candidates.find((p) => p && (0, import_node_fs3.existsSync)(p));
  if (!found) throw new Error(`${name} was not found. Set its full path in extension preferences (run \u201Cwhich ${name}\u201D in Terminal).`);
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
function valid(value) {
  try {
    return ["https:", "http:"].includes(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
}
function details(error) {
  const e = error;
  return e.stderr?.trim() || e.message || String(error);
}
function TinycastDownloader() {
  const [url, setUrl] = (0, import_react.useState)("");
  const [format, setFormat] = (0, import_react.useState)("mp4");
  const [resolution, setResolution] = (0, import_react.useState)("highest");
  const [audioLanguage, setAudioLanguage] = (0, import_react.useState)("original");
  const [playlist, setPlaylist] = (0, import_react.useState)(false);
  const [metadata, setMetadata] = (0, import_react.useState)(null);
  const [loading, setLoading] = (0, import_react.useState)(false);
  const [downloading, setDownloading] = (0, import_react.useState)(false);
  const [status, setStatus] = (0, import_react.useState)("Paste a video URL. Press Return to download.");
  const [error, setError] = (0, import_react.useState)("");
  const [cookieNote, setCookieNote] = (0, import_react.useState)("");
  const [cookieCheck, setCookieCheck] = (0, import_react.useState)(null);
  const [files, setFiles] = (0, import_react.useState)([]);
  const [thumbnail, setThumbnail] = (0, import_react.useState)();
  const [progress, setProgress] = (0, import_react.useState)(null);
  const [retry, setRetry] = (0, import_react.useState)(0);
  const [paused, setPaused] = (0, import_react.useState)(false);
  const [stopping, setStopping] = (0, import_react.useState)(false);
  const [jobInfo, setJobInfo] = (0, import_react.useState)(null);
  const [videoSize, setVideoSize] = (0, import_react.useState)("");
  const [look, setLook] = (0, import_react.useState)({});
  const languages = audioTracks(metadata?.formats);
  (0, import_react.useEffect)(() => {
    if (audioLanguage !== "original" && !languages.tracks.some((track) => track.value === audioLanguage)) setAudioLanguage("original");
  }, [metadata]);
  const activeJob = (0, import_react.useRef)(null);
  const busy = (0, import_react.useRef)(false);
  const edited = (0, import_react.useRef)(false);
  const lookupVersion = (0, import_react.useRef)(0);
  (0, import_react.useEffect)(() => {
    void Promise.all([
      execa("/usr/bin/defaults", ["read", "-g", "AppleAccentColor"]).then((r) => r.stdout.trim(), () => void 0),
      execa("/usr/bin/defaults", ["read", "-g", "AppleLocale"]).then((r) => decimalSeparator(r.stdout.trim()), () => void 0)
    ]).then(([accent, decimal]) => setLook({ accent, decimal }));
  }, []);
  (0, import_react.useEffect)(() => {
    if (prefs.autoLoadUrlFromClipboard) import_api.Clipboard.readText().then((text) => {
      if (!edited.current && !busy.current && text && valid(text)) setUrl(text.trim());
    }).catch(() => {
    });
  }, []);
  (0, import_react.useEffect)(() => {
    if (downloading) return;
    let cancelled = false;
    const version = ++lookupVersion.current;
    setMetadata(null);
    setThumbnail(void 0);
    setError("");
    setFiles([]);
    setCookieNote("");
    if (!url.trim()) {
      setLoading(false);
      setStatus("Paste a video URL. Press Return to download.");
      return;
    }
    if (!valid(url)) {
      setLoading(false);
      setStatus("Enter a complete http:// or https:// video URL.");
      return;
    }
    setLoading(true);
    setStatus("Loading video details\u2026 You can also press Return to download now.");
    const timer = setTimeout(async () => {
      try {
        const { ytdlp } = tools();
        const lookupArgs = [...common(), "--no-playlist", "--skip-download", "--dump-single-json", "--", url.trim()];
        const result = await execa(ytdlp, lookupArgs, { env: environment(), timeout: 9e4 }).catch((e) => {
          const note = cookieFailure(details(e), prefs.cookiesFromBrowser);
          if (!note) throw e;
          if (!cancelled && version === lookupVersion.current) setCookieNote(`${note} Continuing without cookies.`);
          return execa(ytdlp, withoutCookies(lookupArgs), { env: environment(), timeout: 9e4 });
        });
        const info = JSON.parse(result.stdout);
        if (!cancelled && version === lookupVersion.current) {
          setMetadata(info);
          if (!busy.current) setStatus("Ready. Choose a format and press Return to download.");
          if (info.thumbnail?.startsWith("https://")) {
            void loadThumbnail(info.thumbnail, tools().ffmpeg, import_api.environment?.appearance).then((image) => {
              if (!cancelled && version === lookupVersion.current) setThumbnail(image);
            }).catch(() => {
            });
          }
        }
      } catch (e) {
        if (!cancelled && version === lookupVersion.current && !busy.current) {
          setError(details(e));
          setStatus("Video lookup failed. See the error below, retry, or try Download.");
        }
      } finally {
        if (!cancelled && version === lookupVersion.current) setLoading(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url, retry]);
  (0, import_react.useEffect)(() => {
    const job = activeJob.current;
    if (!job || !metadata?.title || job.info.title || job.info.url !== url.trim()) return;
    updateJob(job, { title: metadata.title, duration: metadata.duration, thumbnail: metadata.thumbnail });
    setJobInfo(job.info);
  }, [metadata]);
  async function checkBrowserCookies() {
    const browser = prefs.cookiesFromBrowser;
    if (!browser || browser === "none") {
      setCookieCheck({ ok: false, message: "Use Cookies from Browser is set to None. Choose your browser in Extension Preferences, then check again." });
      return;
    }
    setCookieCheck({ ok: true, message: "Checking\u2026 If macOS asks Tinycast for Keychain access, choose Always Allow." });
    const directory = (0, import_node_fs3.mkdtempSync)(import_node_path3.default.join((0, import_node_os3.tmpdir)(), "tinycast-cookies-"));
    const file = import_node_path3.default.join(directory, "cookies.txt");
    try {
      const output = await execa(tools().ytdlp, ["--ignore-config", "--cookies-from-browser", browser, "--cookies", file], { env: environment(), timeout: 12e4 }).then((r) => `${r.stdout}
${r.stderr}`, (e) => `${e.stdout ?? ""}
${e.stderr ?? e.message ?? ""}`);
      let cookies = "";
      try {
        cookies = (0, import_node_fs3.readFileSync)(file, "utf8");
      } catch {
      }
      setCookieCheck(describeCookieCheck(output, cookies, browser));
    } catch (e) {
      setCookieCheck({ ok: false, message: details(e) });
    } finally {
      (0, import_node_fs3.rmSync)(directory, { recursive: true, force: true });
    }
  }
  function controlDownload(next) {
    const job = activeJob.current;
    if (!job || controlState(job) === "stop") return;
    try {
      (0, import_node_fs3.writeFileSync)(job.control, next);
      void signal(job, next === "paused" ? "STOP" : next === "running" ? "CONT" : "TERM").then(() => next === "stop" ? signal(job, "CONT") : void 0);
      setPaused(next === "paused");
      setStopping(next === "stop");
      setStatus(next === "paused" ? "Paused \u2014 resume or stop using Actions." : next === "stop" ? "Stopping download\u2026" : "Resuming download\u2026");
    } catch (e) {
      setError(`Could not control download: ${details(e)}`);
    }
  }
  function watch(job) {
    return new Promise((resolve) => {
      let last = "", shownAt = 0, shownPhase = "", ticks = 0, checking = false, deadSince = 0;
      const timer = setInterval(async () => {
        const state = controlState(job);
        setPaused(state === "paused");
        if (state === "running") {
          const next = parseProgress(readLog(job));
          if (next && JSON.stringify(next) !== last && (next.phase !== shownPhase || Date.now() - shownAt >= 1e3)) {
            last = JSON.stringify(next);
            shownAt = Date.now();
            shownPhase = next.phase;
            setProgress(next);
            if (next.resolution && /^\d+x\d+$/.test(next.resolution)) setVideoSize(next.resolution);
            setStatus(next.phase === "processing" ? "Finishing the file\u2026" : "Downloading\u2026 You can close this command and reopen it to see progress.");
          }
        }
        const code = exitCode(job);
        if (code !== void 0) {
          clearInterval(timer);
          resolve(code);
          return;
        }
        if (++ticks % 4 || checking) return;
        checking = true;
        const alive = await isAlive(job);
        checking = false;
        if (alive) deadSince = 0;
        else if (!deadSince) deadSince = Date.now();
        else if (Date.now() - deadSince > 1500 && exitCode(job) === void 0) {
          clearInterval(timer);
          resolve(void 0);
        }
      }, 250);
    });
  }
  function finish(job, code) {
    const log = readLog(job);
    const saved = log.split(/\r?\n/).flatMap((line) => {
      try {
        const file = JSON.parse(line);
        return typeof file === "string" && (0, import_node_fs3.existsSync)(file) ? [file] : [];
      } catch {
        return [];
      }
    });
    if (code === 130 || controlState(job) === "stop") {
      setProgress((previous) => ({ ...previous, percent: previous?.percent ?? null, phase: "stopped" }));
      setError("");
      setStatus("Download stopped. Partial files are kept for a later retry.");
    } else if ((code === 0 || code === void 0) && saved.length) {
      setProgress({ phase: "complete", percent: 100, total: saved.reduce((sum, file) => {
        try {
          return sum + (0, import_node_fs3.statSync)(file).size;
        } catch {
          return sum;
        }
      }, 0) });
      setFiles(saved);
      setStatus(`Saved ${saved.length} file${saved.length === 1 ? "" : "s"} to ${job.info.directory}`);
    } else {
      setProgress((previous) => ({ percent: previous?.percent ?? null, phase: "error" }));
      setError(log || "yt-dlp finished but did not report a saved file.");
      setStatus("Download failed. The error below explains why.");
    }
  }
  async function follow(job, message) {
    busy.current = true;
    activeJob.current = job;
    setJobInfo(job.info);
    setLoading(false);
    setDownloading(true);
    setError("");
    setFiles([]);
    setStopping(false);
    setProgress({ phase: "starting", percent: null });
    setStatus(message);
    if (job.info.thumbnail?.startsWith("https://")) void loadThumbnail(job.info.thumbnail, tools().ffmpeg, import_api.environment?.appearance).then(setThumbnail).catch(() => {
    });
    try {
      finish(job, await watch(job));
    } finally {
      activeJob.current = null;
      setPaused(false);
      setStopping(false);
      busy.current = false;
      setDownloading(false);
    }
  }
  (0, import_react.useEffect)(() => {
    void runningJobs().then((jobs) => {
      if (jobs[0] && !busy.current) void follow(jobs[0], "This download kept running while the command was closed.");
    });
  }, []);
  async function download(values) {
    if (busy.current) return;
    const link = String(values.url ?? url).trim();
    if (!valid(link)) {
      setError("Enter a complete http:// or https:// video URL.");
      return;
    }
    busy.current = true;
    setPaused(false);
    setStopping(false);
    setLoading(false);
    setDownloading(true);
    setError("");
    setFiles([]);
    setProgress({ phase: "starting", percent: null });
    setStatus("Preparing download\u2026");
    try {
      const requested = String(values.audio || audioLanguage || "original");
      const audio = requested !== "original" && validLanguage(requested) ? requested : "original";
      const existing = (await runningJobs()).find((job2) => job2.info.url === link && (job2.info.audio ?? "original") === audio);
      if (existing) {
        busy.current = false;
        await follow(existing, "This video is already downloading \u2014 showing that download.");
        return;
      }
      const bin = tools();
      const directory = expand(prefs.downloadPath || "~/Downloads");
      (0, import_node_fs3.mkdirSync)(directory, { recursive: true });
      const choice = String(values.format || format || "mp4");
      const quality = String(values.resolution || resolution || "highest");
      let args = [...common(), values.playlist ?? playlist ? "--yes-playlist" : "--no-playlist", "--ffmpeg-location", import_node_path3.default.dirname(bin.ffmpeg), "--newline", "--progress", "--progress-delta", "0.25", "--progress-template", "download:TINYCAST_PROGRESS:%(progress._percent_str)s|%(info.format_id)s|%(info.playlist_index)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s|%(info.resolution)s|%(info.vcodec)s|%(info.ext)s", "--progress-template", "postprocess:TINYCAST_PROCESSING:%(progress.status)s", "--print", "video:TINYCAST_FORMATS:%(requested_formats.:.{format_id,filesize,filesize_approx})j", "--print", "after_move:%(filepath)j", "--no-simulate", "-P", directory, "-o", audio === "original" ? "%(title).180B [%(id)s].%(ext)s" : `%(title).180B [%(id)s].${audio}.%(ext)s`];
      args.push(...formatArgs(choice, quality, audio));
      args.push("--", link);
      const job = createJob({ url: link, title: metadata?.title, duration: metadata?.duration, thumbnail: metadata?.thumbnail, format: formatLabel(choice), quality: qualityLabel(choice, quality), audio, audioName: languages.tracks.find((track) => track.value === audio)?.title, directory, started: Date.now() });
      activeJob.current = job;
      setJobInfo(job.info);
      const start = () => {
        void execa("/bin/sh", ["-c", downloadSupervisor, "tinycast-download", job.log, job.control, job.status, job.pid, bin.ytdlp, ...args], { env: environment(), timeout: 0 }).catch(() => {
        });
      };
      start();
      let code = await watch(job);
      const note = code && code !== 130 && controlState(job) !== "stop" ? cookieFailure(readLog(job), prefs.cookiesFromBrowser) : void 0;
      if (note) {
        setCookieNote(`${note} Downloading without cookies.`);
        args = withoutCookies(args);
        (0, import_node_fs3.rmSync)(job.status, { force: true });
        (0, import_node_fs3.rmSync)(job.pid, { force: true });
        start();
        code = await watch(job);
      }
      finish(job, code);
    } catch (e) {
      setProgress((previous) => ({ percent: previous?.percent ?? null, phase: "error" }));
      setError(details(e));
      setStatus("Download failed. The error below explains why.");
    } finally {
      activeJob.current = null;
      setPaused(false);
      setStopping(false);
      busy.current = false;
      setDownloading(false);
    }
  }
  if (progress) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Grid, { columns: 1, aspectRatio: "720/108", inset: import_api.Grid.Inset.Zero, fit: import_api.Grid.Fit.Contain, filtering: false, selectedItemId: "active-download", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_api.Grid.Item,
    {
      id: "active-download",
      content: { source: progressCard(stopping ? { ...progress, phase: "stopping" } : paused ? { ...progress, phase: "paused" } : progress, jobInfo?.title || metadata?.title || jobInfo?.url || url, error || status, {
        source: (() => {
          try {
            return new URL(jobInfo?.url || url).hostname;
          } catch {
            return "";
          }
        })(),
        format: (jobInfo?.format ?? formatLabel(format)) === "Original" ? progress.extension?.toUpperCase() || "Original" : jobInfo?.format ?? formatLabel(format),
        resolution: videoSize || jobInfo?.quality || qualityLabel(format, resolution),
        audio: jobInfo?.audioName,
        thumbnail,
        appearance: import_api.environment?.appearance,
        accent: look.accent,
        decimal: look.decimal
      }) },
      subtitle: error ? "Download failed \u2014 use Copy Error in Actions for details." : `${status}${cookieNote ? " \xB7 Browser cookies unavailable \u2014 see Cookies in the form" : ""}`,
      actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_api.ActionPanel, { children: [
        downloading && !stopping && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: paused ? "Resume Download" : "Pause Download", icon: paused ? import_api.Icon.Play : import_api.Icon.Pause, shortcut: { modifiers: ["cmd"], key: "p" }, onAction: () => controlDownload(paused ? "running" : "paused") }),
        downloading && !stopping && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: "Stop Download", icon: import_api.Icon.Stop, shortcut: { modifiers: ["cmd"], key: "." }, onAction: () => controlDownload("stop") }),
        !downloading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: "New Download", icon: import_api.Icon.ArrowClockwise, onAction: () => {
          setProgress(null);
          setError("");
          setJobInfo(null);
          setVideoSize("");
        } }),
        files.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: "Show Download in Finder", icon: import_api.Icon.Finder, onAction: () => (0, import_api.showInFinder)(files[0]) }),
        error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action.CopyToClipboard, { title: "Copy Error", content: error })
      ] })
    }
  ) });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_api.Form, { isLoading: loading || downloading, actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_api.ActionPanel, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action.SubmitForm, { title: downloading ? "Downloading\u2026" : "Download Video", icon: import_api.Icon.Download, onSubmit: download }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: "Reload Video Details", icon: import_api.Icon.ArrowClockwise, shortcut: { modifiers: ["cmd"], key: "r" }, onAction: () => {
      if (!busy.current) setRetry((v) => v + 1);
    } }),
    files.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: "Show Download in Finder", icon: import_api.Icon.Finder, onAction: () => (0, import_api.showInFinder)(files[0]) }),
    error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action.CopyToClipboard, { title: "Copy Error", content: error }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: "Check Browser Cookies", icon: import_api.Icon.Lock, shortcut: { modifiers: ["cmd", "shift"], key: "k" }, onAction: () => void checkBrowserCookies() }),
    (cookieCheck?.needsPermission || /Full Disk Access|data from other apps/.test(cookieNote)) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: "Open Privacy Settings", icon: import_api.Icon.Gear, onAction: () => void execa("/usr/bin/open", [privacySettingsUrl]).catch(() => {
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: "Extension Preferences", onAction: import_api.openExtensionPreferences })
  ] }), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.TextField, { id: "url", title: "Video URL", value: url, placeholder: "https://www.youtube.com/watch?v=\u2026", onChange: (value) => {
      if (!busy.current) {
        edited.current = true;
        setUrl(value);
      }
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.Dropdown, { id: "format", title: "Format", value: format, onChange: setFormat, children: formats.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.Dropdown.Item, { value: item.value, title: item.title }, item.value)) }),
    format === "mp4" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.Dropdown, { id: "resolution", title: "Resolution", value: resolution, onChange: setResolution, children: resolutions.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.Dropdown.Item, { value: item.value, title: item.title }, item.value)) }),
    languages.tracks.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_api.Form.Dropdown, { id: "audio", title: "Audio Language", value: audioLanguage, onChange: setAudioLanguage, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.Dropdown.Item, { value: "original", title: languages.original ? `Original \u2014 ${languages.original}` : "Original" }),
      languages.tracks.map((track) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.Dropdown.Item, { value: track.value, title: `${track.title} (dubbed)` }, track.value))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.Checkbox, { id: "playlist", title: "Playlist", label: "Download the entire playlist", value: playlist, onChange: setPlaylist }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.Description, { title: "Status", text: status }),
    (cookieCheck || cookieNote) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.Description, { title: "Cookies", text: cookieCheck?.message || cookieNote }),
    metadata?.title && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.Description, { title: "Video", text: metadata.title }),
    error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.Description, { title: "Error", text: error.slice(-3e3) }),
    files.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.Description, { title: "Saved file", text: files.join("\n") })
  ] });
}
