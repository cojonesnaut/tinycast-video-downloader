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
var import_api2 = require("@raycast/api");
var import_react = require("react");
var import_node_fs2 = require("node:fs");
var import_node_os2 = require("node:os");
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
var import_node_fs = require("node:fs");
var import_node_os = require("node:os");
var import_node_path = __toESM(require("node:path"), 1);
var root = import_node_path.default.join((0, import_node_os.tmpdir)(), "tinycast-video-downloader");
function paths(dir, info) {
  return { dir, info, log: import_node_path.default.join(dir, "progress.log"), control: import_node_path.default.join(dir, "control"), status: import_node_path.default.join(dir, "status"), pid: import_node_path.default.join(dir, "pid") };
}
var read = (file) => {
  try {
    return (0, import_node_fs.readFileSync)(file, "utf8").trim();
  } catch {
    return "";
  }
};
function createJob(info) {
  (0, import_node_fs.mkdirSync)(root, { recursive: true });
  const job = paths((0, import_node_fs.mkdtempSync)(import_node_path.default.join(root, "job-")), info);
  (0, import_node_fs.writeFileSync)(import_node_path.default.join(job.dir, "job.json"), JSON.stringify(info));
  (0, import_node_fs.writeFileSync)(job.control, "running");
  return job;
}
function updateJob(job, details2) {
  job.info = { ...job.info, ...details2 };
  try {
    (0, import_node_fs.writeFileSync)(import_node_path.default.join(job.dir, "job.json"), JSON.stringify(job.info));
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
  if (!/^\d+$/.test(pid)) return !(0, import_node_fs.existsSync)(job.status) && Date.now() - (0, import_node_fs.statSync)(job.dir).mtimeMs < 1e4;
  return execa("/bin/kill", ["-0", pid]).then(() => true, () => false);
}
async function runningJobs() {
  let names2 = [];
  try {
    names2 = (0, import_node_fs.readdirSync)(root).filter((name) => name.startsWith("job-"));
  } catch {
    return [];
  }
  const jobs = [];
  for (const name of names2) {
    const dir = import_node_path.default.join(root, name);
    try {
      const job = paths(dir, JSON.parse((0, import_node_fs.readFileSync)(import_node_path.default.join(dir, "job.json"), "utf8")));
      if (await isAlive(job)) jobs.push(job);
      else if (Date.now() - (0, import_node_fs.statSync)(dir).mtimeMs > 36e5) (0, import_node_fs.rmSync)(dir, { recursive: true, force: true });
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
      speed: number(speed) ?? lastKnown(lines, i, format, 6),
      eta: number(eta) ?? lastKnown(lines, i, format, 7),
      resolution: resolution === "NA" ? void 0 : resolution,
      codec: codec === "NA" || codec === "none" ? void 0 : codec,
      extension: extension === "NA" ? void 0 : extension
    });
  }
  return null;
}
function lastKnown(lines, end, format, field) {
  for (let j = end - 1, seen = 0; j >= 0 && seen < 40; j--) {
    if (!lines[j].startsWith(marker)) continue;
    seen++;
    const fields = lines[j].slice(marker.length).split("|");
    if (fields[1] !== format) return void 0;
    const value = number(fields[field]);
    if (value !== void 0) return value;
  }
  return void 0;
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
function timeLeft(n) {
  if (n === void 0) return "";
  n = Math.max(0, Math.round(n));
  if (n < 60) return `${n} s`;
  if (n < 3600) return `${Math.floor(n / 60)} min${n % 60 ? ` ${n % 60} s` : ""}`;
  return `${Math.floor(n / 3600)} h${Math.floor(n / 60) % 60 ? ` ${Math.floor(n / 60) % 60} min` : ""}`;
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
function printed(log, marker2) {
  const line = log.split(/\r?\n/).reverse().find((l) => l.startsWith(marker2));
  try {
    const value = line && JSON.parse(line.slice(marker2.length));
    return typeof value === "string" ? value : void 0;
  } catch {
    return void 0;
  }
}
var plannedFile = (log) => printed(log, "TINYCAST_FILE:");
var printedTitle = (log) => printed(log, "TINYCAST_TITLE:");

// src/tinycast-download-view.tsx
var import_api = require("@raycast/api");
var import_node_path2 = __toESM(require("node:path"), 1);

// src/tinycast-panel.ts
var PANEL_WIDTH = 909;
var accents = { "-1": "#8C8C8C", "0": "#E0393E", "1": "#F7821B", "2": "#FFC600", "3": "#62BA46", "4": "#007AFF", "5": "#A550A7", "6": "#F74F9E" };
var accentColor = (accent) => accents[accent ?? "4"] ?? accents["4"];
var palettes = {
  dark: { label: "#9A9A9A", value: "#E1E1E1", heading: "#E5E5E5", track: "rgba(255,255,255,0.09)" },
  light: { label: "#6E6E73", value: "#1D1D1F", heading: "#1D1D1F", track: "rgba(0,0,0,0.08)" }
};
var palette = (appearance) => palettes[appearance === "light" ? "light" : "dark"];
var FONT = `font-family="-apple-system,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif"`;
var xml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function middle(text, max = 63) {
  const chars = [...text];
  if (chars.length <= max) return text;
  const head = Math.ceil((max - 1) / 2);
  return chars.slice(0, head).join("") + "\u2026" + chars.slice(chars.length - (max - 1 - head)).join("");
}
var uri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
function progressPanel(title, rows, percent, color, appearance) {
  const p = palette(appearance);
  const font = `${FONT} font-size="21.1"`;
  const top = 35;
  const text = rows.map(([label, value], i) => {
    const y = top + 26 + i * 35;
    return `<text x="20" y="${y}" fill="${p.label}" ${font}>${xml(label)}</text><text x="218" y="${y}" fill="${p.value}" ${font}>${xml(middle(value))}</text>`;
  }).join("");
  const name = [...title].length > 76 ? [...title].slice(0, 75).join("") + "\u2026" : title;
  const bar = top + 309, height = top + 341;
  const width = percent == null ? 0 : Math.max(14, Math.round(880 * Math.max(0, Math.min(100, percent)) / 100));
  return uri(`<svg xmlns="http://www.w3.org/2000/svg" width="909" height="${height}" viewBox="0 0 909 ${height}"><defs><clipPath id="bar"><rect x="18" y="${bar}" width="880" height="14" rx="7"/></clipPath></defs><text x="20" y="26" fill="${p.heading}" stroke="${p.heading}" stroke-width="0.9" stroke-linejoin="round" ${font}>${xml(name)}</text>${text}<g clip-path="url(#bar)"><rect x="18" y="${bar}" width="880" height="14" fill="${p.track}"/>${width ? `<rect x="18" y="${bar}" width="${width}" height="14" fill="${color}"/>` : ""}</g></svg>`);
}
var marks = {
  complete: { fill: "#30D158", mark: `<path d="M79.3 87.5L97.4 105.6L133.7 66.4" fill="none" stroke="#202020" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>` },
  error: { fill: "#FF453A", mark: `<path d="M106.5 52V93" stroke="#202020" stroke-width="11" stroke-linecap="round"/><circle cx="106.5" cy="117" r="7.5" fill="#202020"/>` },
  stopped: { fill: "#8E8E93", mark: `<rect x="84.5" y="64" width="44" height="44" rx="7" fill="#202020"/>` }
};
function finishedPanel(kind, heading, file, rows, appearance) {
  const p = palette(appearance), badge = marks[kind];
  const height = 241 + (rows.length - 1) * 60 + 30;
  const text = rows.map(([label, value], i) => {
    const y = 241 + i * 60;
    return `<text x="34" y="${y}" fill="${p.label}" ${FONT} font-size="35">${xml(label)}</text><text x="218" y="${y}" fill="${p.value}" ${FONT} font-size="36.2">${xml(middle(value, 72))}</text>`;
  }).join("");
  return uri(`<svg xmlns="http://www.w3.org/2000/svg" width="${PANEL_WIDTH}" height="${Math.round(height * PANEL_WIDTH / 1560)}" viewBox="0 0 1560 ${height}"><circle cx="106.5" cy="86" r="63.5" fill="${badge.fill}"/>${badge.mark}<text x="224" y="74" fill="${p.heading}" stroke="${p.heading}" stroke-width="2.6" stroke-linejoin="round" ${FONT} font-size="52.5">${xml(heading)}</text><text x="222" y="135" fill="${p.value}" ${FONT} font-size="37">${xml(middle(file, 64))}</text>${text}</svg>`);
}
function finishedAt(date) {
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()];
  const two = (n) => String(n).padStart(2, "0");
  return `${month} ${date.getDate()}, ${date.getFullYear()} at ${two(date.getHours())}:${two(date.getMinutes())}`;
}

// src/tinycast-download-view.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function statusText(progress, paused, stopping) {
  if (stopping) return "Cancelling\u2026";
  if (paused) return "Paused";
  const item = progress.item ? ` (item ${progress.item})` : "";
  if (progress.phase === "starting") return "Preparing download\u2026";
  if (progress.phase === "processing") return `Processing${item}\u2026`;
  return `Downloading ${progress.resolution === "audio only" ? "audio" : "video"}${item}\u2026`;
}
function amount(n, decimal) {
  if (n >= 1e9) return bytes(n, decimal);
  if (n >= 1e6) return `${Math.round(n / 1e6)} MB`;
  return `${Math.round(n / 1e3)} KB`;
}
function DownloadingPanel(p) {
  const { progress, decimal } = p;
  const processing = progress.phase === "processing";
  const percent = processing ? 100 : progress.percent == null ? null : Math.floor(progress.percent);
  const running = !p.paused && !p.stopping && progress.phase === "download";
  const rows = [
    ["URL", p.url],
    ["Status", statusText(progress, p.paused, p.stopping)],
    ["File size", progress.total ? bytes(progress.total, decimal) : "Unknown"],
    ["Downloaded", progress.downloaded !== void 0 && progress.phase !== "starting" ? `${amount(progress.downloaded, decimal)}${percent == null ? "" : `  (${percent}%)`}` : "\u2014"],
    ["Transfer rate", running && progress.speed ? `${bytes(progress.speed, decimal)}/s` : "\u2014"],
    ["Time left", running && progress.eta !== void 0 ? timeLeft(progress.eta) : "\u2014"],
    ["Resume capability", "yt-dlp"],
    ["Save to", p.savePath || "Preparing\u2026"]
  ];
  const markdown = `![](${progressPanel(p.title, rows, percent, p.color, import_api.environment.appearance)})${p.note ? `

${p.note}` : ""}`;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Detail, { navigationTitle: p.title, markdown, actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_api.ActionPanel, { children: [
    !p.stopping && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: p.paused ? "Resume" : "Pause", icon: p.paused ? import_api.Icon.Play : import_api.Icon.Pause, shortcut: { modifiers: ["cmd"], key: "p" }, onAction: p.onPauseResume }),
    !p.stopping && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: "Cancel Download", icon: import_api.Icon.XMarkCircle, style: import_api.Action.Style.Destructive, shortcut: { modifiers: ["cmd"], key: "." }, onAction: p.onCancel }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: p.closeWhenDone ? "Keep Open When Completed" : "Close When Completed", icon: p.closeWhenDone ? import_api.Icon.CheckCircle : import_api.Icon.Circle, shortcut: { modifiers: ["cmd", "shift"], key: "w" }, onAction: () => p.onCloseWhenDone(!p.closeWhenDone) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action.CopyToClipboard, { title: "Copy URL", content: p.url, shortcut: { modifiers: ["cmd", "shift"], key: "c" } }),
    p.savePath && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action.ShowInFinder, { title: "Show Download Folder", path: import_node_path2.default.dirname(p.savePath) })
  ] }) });
}
function FinishedDetail(p) {
  const file = p.files[0];
  const name = p.files.length > 1 ? `${p.files.length} files` : file || p.savePath ? import_node_path2.default.basename(file || p.savePath) : p.title !== p.url ? p.title : "";
  const location = file ? import_node_path2.default.dirname(file) : p.savePath ? import_node_path2.default.dirname(p.savePath) : p.directory;
  const errorLine = (p.error || "").split(/\r?\n/).reverse().find((line) => line.startsWith("ERROR:"))?.replace(/^ERROR:\s*/, "") || "See Copy Error for details";
  const heading = p.kind === "complete" ? "Download completed" : p.kind === "error" ? "Download failed" : "Download cancelled";
  const rows = p.kind === "complete" ? [["Size", p.size !== void 0 ? bytes(p.size, p.decimal) : "\u2014"], ["Location", location], ["URL", p.url], ["Finished", finishedAt(p.finishedAt)]] : p.kind === "error" ? [["Location", location], ["URL", p.url], ["Failed", finishedAt(p.finishedAt)], ["Error", errorLine]] : [["Location", location], ["URL", p.url], ["Cancelled", finishedAt(p.finishedAt)], ["Partial", "Files kept \u2014 Resume continues"]];
  const close = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: "Close", icon: import_api.Icon.XMarkCircle, shortcut: { modifiers: ["cmd"], key: "w" }, onAction: () => void (0, import_api.closeMainWindow)() });
  const another = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: "New Download", icon: import_api.Icon.Download, shortcut: { modifiers: ["cmd"], key: "n" }, onAction: p.onNew });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_api.Detail,
    {
      navigationTitle: p.title,
      markdown: `![](${finishedPanel(p.kind, heading, name, rows, import_api.environment.appearance)})`,
      actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_api.ActionPanel, { children: [
        p.kind === "complete" && file && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action.Open, { title: "Open", target: file }),
        p.kind === "complete" && file && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action.ShowInFinder, { path: file }),
        p.kind === "error" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: "Try Again", icon: import_api.Icon.ArrowClockwise, onAction: p.onRetry }),
        p.kind === "stopped" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: "Resume", icon: import_api.Icon.Play, onAction: p.onRetry }),
        p.kind === "error" && p.error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action.CopyToClipboard, { title: "Copy Error", content: p.error }),
        close,
        another,
        file && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action.CopyToClipboard, { title: "Copy File Path", content: file, shortcut: { modifiers: ["cmd", "shift"], key: "c" } })
      ] })
    }
  );
}

// src/tinycast.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var prefs = (0, import_api2.getPreferenceValues)();
var expand = (value) => value.replace(/^~(?=\/|$)/, (0, import_node_os2.homedir)());
function executable(name, preference) {
  const candidates = [preference && expand(preference.trim()), `/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`, ...String(process.env.PATH || "").split(":").filter(Boolean).map((p) => import_node_path3.default.join(p, name))];
  const found = candidates.find((p) => p && (0, import_node_fs2.existsSync)(p));
  if (!found) throw new Error(`${name} was not found. Set its full path in extension preferences (run \u201Cwhich ${name}\u201D in Terminal).`);
  return found;
}
function tools() {
  return { ytdlp: executable("yt-dlp", prefs.ytdlPath), ffmpeg: executable("ffmpeg", prefs.ffmpegPath), ffprobe: executable("ffprobe", prefs.ffprobePath) };
}
function environment2() {
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
  const [progress, setProgress] = (0, import_react.useState)(null);
  const [retry, setRetry] = (0, import_react.useState)(0);
  const [paused, setPaused] = (0, import_react.useState)(false);
  const [stopping, setStopping] = (0, import_react.useState)(false);
  const [jobInfo, setJobInfo] = (0, import_react.useState)(null);
  const [decimal, setDecimal] = (0, import_react.useState)(".");
  const [accent, setAccent] = (0, import_react.useState)();
  const [savePath, setSavePath] = (0, import_react.useState)("");
  const [finishedAt2, setFinishedAt] = (0, import_react.useState)(/* @__PURE__ */ new Date());
  const [closeWhenDone, setCloseWhenDone] = (0, import_react.useState)(false);
  const closeWhenDoneRef = (0, import_react.useRef)(false);
  const lastRequest = (0, import_react.useRef)({});
  const languages = audioTracks(metadata?.formats);
  (0, import_react.useEffect)(() => {
    if (audioLanguage !== "original" && !languages.tracks.some((track) => track.value === audioLanguage)) setAudioLanguage("original");
  }, [metadata]);
  const activeJob = (0, import_react.useRef)(null);
  const busy = (0, import_react.useRef)(false);
  const edited = (0, import_react.useRef)(false);
  const lookupVersion = (0, import_react.useRef)(0);
  (0, import_react.useEffect)(() => {
    void execa("/usr/bin/defaults", ["read", "-g", "AppleLocale"]).then((r) => setDecimal(decimalSeparator(r.stdout.trim())), () => {
    });
    void execa("/usr/bin/defaults", ["read", "-g", "AppleAccentColor"]).then((r) => setAccent(r.stdout.trim()), () => {
    });
  }, []);
  (0, import_react.useEffect)(() => {
    if (prefs.autoLoadUrlFromClipboard) import_api2.Clipboard.readText().then((text) => {
      if (!edited.current && !busy.current && text && valid(text)) setUrl(text.trim());
    }).catch(() => {
    });
  }, []);
  (0, import_react.useEffect)(() => {
    if (downloading) return;
    let cancelled = false;
    const version = ++lookupVersion.current;
    setMetadata(null);
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
        const result = await execa(ytdlp, lookupArgs, { env: environment2(), timeout: 9e4 }).catch((e) => {
          const note = cookieFailure(details(e), prefs.cookiesFromBrowser);
          if (!note) throw e;
          if (!cancelled && version === lookupVersion.current) setCookieNote(`${note} Continuing without cookies.`);
          return execa(ytdlp, withoutCookies(lookupArgs), { env: environment2(), timeout: 9e4 });
        });
        const info = JSON.parse(result.stdout);
        if (!cancelled && version === lookupVersion.current) {
          setMetadata(info);
          if (!busy.current) setStatus("Ready. Choose a format and press Return to download.");
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
    updateJob(job, { title: metadata.title, duration: metadata.duration });
    setJobInfo(job.info);
  }, [metadata]);
  async function checkBrowserCookies() {
    const browser = prefs.cookiesFromBrowser;
    if (!browser || browser === "none") {
      setCookieCheck({ ok: false, message: "Use Cookies from Browser is set to None. Choose your browser in Extension Preferences, then check again." });
      return;
    }
    setCookieCheck({ ok: true, message: "Checking\u2026 If macOS asks Tinycast for Keychain access, choose Always Allow." });
    const directory = (0, import_node_fs2.mkdtempSync)(import_node_path3.default.join((0, import_node_os2.tmpdir)(), "tinycast-cookies-"));
    const file = import_node_path3.default.join(directory, "cookies.txt");
    try {
      const output = await execa(tools().ytdlp, ["--ignore-config", "--cookies-from-browser", browser, "--cookies", file], { env: environment2(), timeout: 12e4 }).then((r) => `${r.stdout}
${r.stderr}`, (e) => `${e.stdout ?? ""}
${e.stderr ?? e.message ?? ""}`);
      let cookies = "";
      try {
        cookies = (0, import_node_fs2.readFileSync)(file, "utf8");
      } catch {
      }
      setCookieCheck(describeCookieCheck(output, cookies, browser));
    } catch (e) {
      setCookieCheck({ ok: false, message: details(e) });
    } finally {
      (0, import_node_fs2.rmSync)(directory, { recursive: true, force: true });
    }
  }
  function controlDownload(next) {
    const job = activeJob.current;
    if (!job || controlState(job) === "stop") return;
    try {
      (0, import_node_fs2.writeFileSync)(job.control, next);
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
            const log = readLog(job), planned = plannedFile(log), title2 = job.info.title ? void 0 : printedTitle(log);
            if (title2) {
              updateJob(job, { title: title2 });
              setJobInfo({ ...job.info });
            }
            if (planned) setSavePath(job.info.format === "MP4" ? planned.replace(/\.[^./]+$/, ".mp4") : job.info.format === "MP3" ? planned.replace(/\.[^./]+$/, ".mp3") : planned);
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
    setFinishedAt(/* @__PURE__ */ new Date());
    const saved = log.split(/\r?\n/).flatMap((line) => {
      try {
        const file = JSON.parse(line);
        return typeof file === "string" && (0, import_node_fs2.existsSync)(file) ? [file] : [];
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
          return sum + (0, import_node_fs2.statSync)(file).size;
        } catch {
          return sum;
        }
      }, 0) });
      setFiles(saved);
      setStatus(`Saved ${saved.length} file${saved.length === 1 ? "" : "s"} to ${job.info.directory}`);
      if (closeWhenDoneRef.current) void (0, import_api2.closeMainWindow)();
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
    lastRequest.current = job.info.request ?? { url: job.info.url };
    setLoading(false);
    setDownloading(true);
    setError("");
    setFiles([]);
    setStopping(false);
    setSavePath("");
    setProgress({ phase: "starting", percent: null });
    setStatus(message);
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
    const link2 = String(values.url ?? url).trim();
    if (!valid(link2)) {
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
    setSavePath("");
    lastRequest.current = { ...values, url: link2 };
    setProgress({ phase: "starting", percent: null });
    setStatus("Preparing download\u2026");
    try {
      const requested = String(values.audio || audioLanguage || "original");
      const audio = requested !== "original" && validLanguage(requested) ? requested : "original";
      const existing = (await runningJobs()).find((job2) => job2.info.url === link2 && (job2.info.audio ?? "original") === audio);
      if (existing) {
        busy.current = false;
        await follow(existing, "This video is already downloading \u2014 showing that download.");
        return;
      }
      const bin = tools();
      const directory = expand(prefs.downloadPath || "~/Downloads");
      (0, import_node_fs2.mkdirSync)(directory, { recursive: true });
      const choice = String(values.format || format || "mp4");
      const quality = String(values.resolution || resolution || "highest");
      let args = [...common(), values.playlist ?? playlist ? "--yes-playlist" : "--no-playlist", "--ffmpeg-location", import_node_path3.default.dirname(bin.ffmpeg), "--newline", "--progress", "--progress-delta", "0.25", "--progress-template", "download:TINYCAST_PROGRESS:%(progress._percent_str)s|%(info.format_id)s|%(info.playlist_index)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s|%(info.resolution)s|%(info.vcodec)s|%(info.ext)s", "--progress-template", "postprocess:TINYCAST_PROCESSING:%(progress.status)s", "--print", "video:TINYCAST_FORMATS:%(requested_formats.:.{format_id,filesize,filesize_approx})j", "--print", "video:TINYCAST_FILE:%(filename)j", "--print", "video:TINYCAST_TITLE:%(title)j", "--print", "after_move:%(filepath)j", "--no-simulate", "-P", directory, "-o", audio === "original" ? "%(title).180B [%(id)s].%(ext)s" : `%(title).180B [%(id)s].${audio}.%(ext)s`];
      args.push(...formatArgs(choice, quality, audio));
      args.push("--", link2);
      const job = createJob({ url: link2, request: lastRequest.current, title: metadata?.title, duration: metadata?.duration, format: formatLabel(choice), quality: qualityLabel(choice, quality), audio, audioName: languages.tracks.find((track) => track.value === audio)?.title, directory, started: Date.now() });
      activeJob.current = job;
      setJobInfo(job.info);
      const start = () => {
        void execa("/bin/sh", ["-c", downloadSupervisor, "tinycast-download", job.log, job.control, job.status, job.pid, bin.ytdlp, ...args], { env: environment2(), timeout: 0 }).catch(() => {
        });
      };
      start();
      let code = await watch(job);
      const note = code && code !== 130 && controlState(job) !== "stop" ? cookieFailure(readLog(job), prefs.cookiesFromBrowser) : void 0;
      if (note) {
        setCookieNote(`${note} Downloading without cookies.`);
        args = withoutCookies(args);
        (0, import_node_fs2.rmSync)(job.status, { force: true });
        (0, import_node_fs2.rmSync)(job.pid, { force: true });
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
  function newDownload() {
    setProgress(null);
    setError("");
    setJobInfo(null);
    setSavePath("");
    setFiles([]);
  }
  const title = jobInfo?.title || metadata?.title || jobInfo?.url || url;
  const link = jobInfo?.url || url.trim();
  if (progress && (progress.phase === "complete" || progress.phase === "error" || progress.phase === "stopped")) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    FinishedDetail,
    {
      kind: progress.phase,
      title,
      url: link,
      files,
      size: progress.total,
      directory: jobInfo?.directory || expand(prefs.downloadPath || "~/Downloads"),
      savePath,
      finishedAt: finishedAt2,
      error,
      decimal,
      onNew: newDownload,
      onRetry: () => {
        const request = lastRequest.current;
        newDownload();
        void download(request);
      }
    }
  );
  if (progress) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      DownloadingPanel,
      {
        title,
        url: link,
        progress,
        paused,
        stopping,
        savePath,
        decimal,
        color: accentColor(accent),
        note: cookieNote || void 0,
        closeWhenDone,
        onCloseWhenDone: (value) => {
          closeWhenDoneRef.current = value;
          setCloseWhenDone(value);
        },
        onPauseResume: () => controlDownload(paused ? "running" : "paused"),
        onCancel: () => controlDownload("stop")
      }
    );
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_api2.Form, { isLoading: loading || downloading, actions: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_api2.ActionPanel, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Action.SubmitForm, { title: downloading ? "Downloading\u2026" : "Download Video", icon: import_api2.Icon.Download, onSubmit: download }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Action, { title: "Reload Video Details", icon: import_api2.Icon.ArrowClockwise, shortcut: { modifiers: ["cmd"], key: "r" }, onAction: () => {
      if (!busy.current) setRetry((v) => v + 1);
    } }),
    files.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Action, { title: "Show Download in Finder", icon: import_api2.Icon.Finder, onAction: () => (0, import_api2.showInFinder)(files[0]) }),
    error && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Action.CopyToClipboard, { title: "Copy Error", content: error }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Action, { title: "Check Browser Cookies", icon: import_api2.Icon.Lock, shortcut: { modifiers: ["cmd", "shift"], key: "k" }, onAction: () => void checkBrowserCookies() }),
    (cookieCheck?.needsPermission || /Full Disk Access|data from other apps/.test(cookieNote)) && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Action, { title: "Open Privacy Settings", icon: import_api2.Icon.Gear, onAction: () => void execa("/usr/bin/open", [privacySettingsUrl]).catch(() => {
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Action, { title: "Extension Preferences", onAction: import_api2.openExtensionPreferences })
  ] }), children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Form.TextField, { id: "url", title: "Video URL", value: url, placeholder: "https://www.youtube.com/watch?v=\u2026", onChange: (value) => {
      if (!busy.current) {
        edited.current = true;
        setUrl(value);
      }
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Form.Dropdown, { id: "format", title: "Format", value: format, onChange: setFormat, children: formats.map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Form.Dropdown.Item, { value: item.value, title: item.title }, item.value)) }),
    format === "mp4" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Form.Dropdown, { id: "resolution", title: "Resolution", value: resolution, onChange: setResolution, children: resolutions.map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Form.Dropdown.Item, { value: item.value, title: item.title }, item.value)) }),
    languages.tracks.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_api2.Form.Dropdown, { id: "audio", title: "Audio Language", value: audioLanguage, onChange: setAudioLanguage, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Form.Dropdown.Item, { value: "original", title: languages.original ? `Original \u2014 ${languages.original}` : "Original" }),
      languages.tracks.map((track) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Form.Dropdown.Item, { value: track.value, title: `${track.title} (dubbed)` }, track.value))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Form.Checkbox, { id: "playlist", title: "Playlist", label: "Download the entire playlist", value: playlist, onChange: setPlaylist }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Form.Description, { title: "Status", text: status }),
    (cookieCheck || cookieNote) && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Form.Description, { title: "Cookies", text: cookieCheck?.message || cookieNote }),
    metadata?.title && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Form.Description, { title: "Video", text: metadata.title }),
    error && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Form.Description, { title: "Error", text: error.slice(-3e3) }),
    files.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api2.Form.Description, { title: "Saved file", text: files.join("\n") })
  ] });
}
