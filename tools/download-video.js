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

// src/tools/download-video.ts
var download_video_exports = {};
__export(download_video_exports, {
  default: () => tool
});
module.exports = __toCommonJS(download_video_exports);

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
        failure.code = error.code ?? void 0;
        failure.exitCode = typeof error.code === "number" ? error.code : void 0;
        failure.shortMessage = error.message;
        reject(failure);
      } else {
        resolve({ stdout: output, stderr: errors, exitCode: 0 });
      }
    });
  });
}

// src/utils.ts
var import_api = require("@raycast/api");
var import_fs = require("fs");
var import_child_process = require("child_process");
var import_os = require("os");
var isWindows = process.platform === "win32";
var isMac = process.platform === "darwin";
function looksLikeFilePath(line) {
  return isWindows ? /^[a-zA-Z]:\\/.test(line) : line.startsWith("/");
}
function sanitizeWindowsPath(path2) {
  return path2.replace(/\r/g, "").replace(/\n/g, "").trim();
}
var {
  downloadPath: downloadPathPreference,
  homebrewPath,
  autoLoadUrlFromClipboard,
  autoLoadUrlFromSelectedText,
  forceIpv4,
  cookiesFromBrowser,
  ytdlPath: ytdlPathPreference,
  ffmpegPath: ffmpegPathPreference,
  ffprobePath: ffprobePathPreference
} = (0, import_api.getPreferenceValues)();
var downloadPath = downloadPathPreference.replace(/^~(?=$|[/\\])/, (0, import_os.homedir)());
var getytdlPath = () => {
  const cleanedYtdlPath = isWindows ? sanitizeWindowsPath(ytdlPathPreference || "") : ytdlPathPreference;
  if (cleanedYtdlPath && (0, import_fs.existsSync)(cleanedYtdlPath)) return cleanedYtdlPath;
  try {
    const defaultPath = isMac ? "/opt/homebrew/bin/yt-dlp" : isWindows ? sanitizeWindowsPath((0, import_child_process.execSync)("where yt-dlp").toString().trim().split("\n")[0]) : "/usr/bin/yt-dlp";
    return defaultPath;
  } catch {
    return "";
  }
};
var getffmpegPath = () => {
  const cleanedFfmpegPath = isWindows ? sanitizeWindowsPath(ffmpegPathPreference || "") : ffmpegPathPreference;
  if (cleanedFfmpegPath && (0, import_fs.existsSync)(cleanedFfmpegPath)) return cleanedFfmpegPath;
  try {
    const defaultPath = isMac ? "/opt/homebrew/bin/ffmpeg" : isWindows ? sanitizeWindowsPath((0, import_child_process.execSync)("where ffmpeg").toString().trim().split("\n")[0]) : "/usr/bin/ffmpeg";
    return defaultPath;
  } catch {
    return "";
  }
};
var getffprobePath = () => {
  const cleanedFfprobePath = isWindows ? sanitizeWindowsPath(ffprobePathPreference || "") : ffprobePathPreference;
  if (cleanedFfprobePath && (0, import_fs.existsSync)(cleanedFfprobePath)) return cleanedFfprobePath;
  try {
    const defaultPath = isMac ? "/opt/homebrew/bin/ffprobe" : isWindows ? sanitizeWindowsPath((0, import_child_process.execSync)("where ffprobe").toString().trim().split("\n")[0]) : "/usr/bin/ffprobe";
    return defaultPath;
  } catch {
    return "";
  }
};
function getCommonArgs({ throttle = false } = {}) {
  const args = [];
  if (forceIpv4) args.push("--force-ipv4");
  if (cookiesFromBrowser && cookiesFromBrowser !== "none") {
    args.push("--cookies-from-browser", cookiesFromBrowser);
  }
  if (throttle) {
    args.push("--extractor-retries", "3");
    args.push("--sleep-requests", "1");
  }
  return args;
}
var hasCodec = ({ vcodec, acodec }) => {
  return {
    hasVcodec: Boolean(vcodec) && vcodec !== "none",
    hasAcodec: Boolean(acodec) && acodec !== "none"
  };
};
var mp3Format = {
  format_id: "bestaudio",
  ext: "mp3",
  video_ext: "none",
  protocol: "https",
  resolution: "audio only",
  vcodec: "none",
  acodec: "mp3",
  tbr: null,
  filesize: void 0,
  filesize_approx: void 0
};
var getFormats = (video) => {
  const videoKey = "Video";
  const audioOnlyKey = "Audio Only";
  const videoWithAudio = [];
  const audioOnly = [];
  if (!video) return { [videoKey]: videoWithAudio, [audioOnlyKey]: audioOnly };
  audioOnly.push(mp3Format);
  for (const format of video.formats.slice().reverse()) {
    const { hasAcodec, hasVcodec } = hasCodec(format);
    if (hasVcodec) videoWithAudio.push(format);
    else if (hasAcodec && !hasVcodec) audioOnly.push(format);
    else continue;
  }
  return { [videoKey]: videoWithAudio, [audioOnlyKey]: audioOnly };
};
var getFormatValue = (format) => {
  const { hasAcodec } = hasCodec(format);
  const audio = hasAcodec ? "" : "+bestaudio";
  const targetExt = `#${format.ext}`;
  return format.format_id + audio + targetExt;
};
function sanitizeVideoTitle(name) {
  const maxLen = 200;
  const invalidChars = isWindows ? ["<", ">", ":", '"', "/", "\\", "|", "?", "*"] : [":"];
  let safe = name.trim();
  for (const char of invalidChars) {
    safe = safe.replaceAll(char, "");
  }
  safe = Array.from(safe).filter((char) => char.charCodeAt(0) >= 32).join("");
  if (isWindows) safe = safe.replace(/[. ]+$/, "");
  safe = safe.replace(/\s+/g, " ");
  if (safe.length > maxLen) {
    safe = safe.slice(0, maxLen);
    const lastSpace = safe.lastIndexOf(" ");
    if (lastSpace > 0) {
      safe = safe.slice(0, lastSpace);
    }
  }
  return safe.trim() || "untitled";
}

// src/tools/download-video.ts
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
async function tool(input) {
  const ytdlPath = getytdlPath();
  const ffmpegPath = getffmpegPath();
  const ffprobePath = getffprobePath();
  if (!import_node_fs.default.existsSync(ytdlPath)) {
    throw new Error("yt-dlp is not installed");
  }
  if (!import_node_fs.default.existsSync(ffmpegPath)) {
    throw new Error("ffmpeg is not installed");
  }
  if (!import_node_fs.default.existsSync(ffprobePath)) {
    throw new Error("ffprobe is not installed");
  }
  const videoInfo = await execa(ytdlPath, [
    ...getCommonArgs({ throttle: true }),
    "--no-playlist",
    "--dump-json",
    "--format-sort=res,ext,tbr",
    input.url
  ]);
  const video = JSON.parse(videoInfo.stdout);
  if (video.live_status !== "not_live" && video.live_status !== void 0) {
    throw new Error("Live streams are not supported");
  }
  const options = [...getCommonArgs(), "--no-playlist", "-P", downloadPath];
  const formats = getFormats(video);
  const bestFormat = formats["Video"][0];
  if (bestFormat) {
    const formatValue = getFormatValue(bestFormat);
    const [downloadFormat, recodeFormat] = formatValue.split("#");
    options.push("--ffmpeg-location", ffmpegPath);
    options.push("--format", downloadFormat);
    options.push("--recode-video", recodeFormat);
  }
  options.push("--print", "after_move:filepath");
  const result = await execa(ytdlPath, [...options, input.url]);
  if (result.failed) {
    throw new Error(`Failed to download video: ${result.stderr}`);
  }
  const filePath = result.stdout.split("\n").find((line) => looksLikeFilePath(line.trim()));
  if (!filePath) {
    throw new Error("Could not determine downloaded file path");
  }
  return {
    downloadedPath: filePath,
    fileName: import_node_path.default.basename(filePath),
    title: sanitizeVideoTitle(video.title),
    duration: video.duration
  };
}
