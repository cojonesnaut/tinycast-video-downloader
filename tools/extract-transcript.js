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

// src/tools/extract-transcript.ts
var extract_transcript_exports = {};
__export(extract_transcript_exports, {
  default: () => tool
});
module.exports = __toCommonJS(extract_transcript_exports);

// node_modules/@raycast/utils/dist/module.js
var import_react = __toESM(require("react"));
var import_api = require("@raycast/api");
var import_node_crypto = __toESM(require("node:crypto"));
var import_jsx_runtime = require("react/jsx-runtime");
function $93381684554307cb$var$isNativeFunction(f) {
  if (typeof f !== "function") return false;
  const exp = /^function\s+\w*\s*\(\s*\)\s*{\s+\[native code\]\s+}$/i;
  return exp.exec(Function.prototype.toString.call(f)) !== null;
}
function $93381684554307cb$var$hashReplacer(value) {
  if (value instanceof URLSearchParams) return value.toString();
  return value;
}
function $93381684554307cb$export$fe386877a696ae78(writeTo, context = []) {
  function write(str) {
    if ("update" in writeTo) return writeTo.update(str, "utf8");
    else return writeTo.write(str);
  }
  return {
    dispatch: function(value) {
      value = $93381684554307cb$var$hashReplacer(value);
      const type = typeof value;
      if (value === null) this["_null"]();
      else
        this["_" + type](value);
    },
    _object: function(object) {
      const pattern = /\[object (.*)\]/i;
      const objString = Object.prototype.toString.call(object);
      let objType = pattern.exec(objString)?.[1] ?? "unknown:[" + objString + "]";
      objType = objType.toLowerCase();
      let objectNumber = null;
      if ((objectNumber = context.indexOf(object)) >= 0) {
        this.dispatch("[CIRCULAR:" + objectNumber + "]");
        return;
      } else context.push(object);
      if (Buffer.isBuffer(object)) {
        write("buffer:");
        return write(object.toString("base64"));
      }
      if (objType !== "object" && objType !== "function" && objType !== "asyncfunction") {
        if (this["_" + objType])
          this["_" + objType](object);
        else throw new Error('Unknown object type "' + objType + '"');
      } else {
        let keys = Object.keys(object);
        keys = keys.sort();
        if (!$93381684554307cb$var$isNativeFunction(object)) keys.splice(0, 0, "prototype", "__proto__", "constructor");
        write("object:" + keys.length + ":");
        const self = this;
        return keys.forEach(function(key) {
          self.dispatch(key);
          write(":");
          self.dispatch(object[key]);
          write(",");
        });
      }
    },
    _array: function(arr, unordered) {
      unordered = typeof unordered !== "undefined" ? unordered : false;
      const self = this;
      write("array:" + arr.length + ":");
      if (!unordered || arr.length <= 1) {
        arr.forEach(function(entry) {
          self.dispatch(entry);
        });
        return;
      }
      let contextAdditions = [];
      const entries = arr.map(function(entry) {
        const strm = $93381684554307cb$var$PassThrough();
        const localContext = context.slice();
        const hasher = $93381684554307cb$export$fe386877a696ae78(strm, localContext);
        hasher.dispatch(entry);
        contextAdditions = contextAdditions.concat(localContext.slice(context.length));
        return strm.read().toString();
      });
      context = context.concat(contextAdditions);
      entries.sort();
      this._array(entries, false);
    },
    _date: function(date) {
      write("date:" + date.toJSON());
    },
    _symbol: function(sym) {
      write("symbol:" + sym.toString());
    },
    _error: function(err) {
      write("error:" + err.toString());
    },
    _boolean: function(bool) {
      write("bool:" + bool.toString());
    },
    _string: function(string) {
      write("string:" + string.length + ":");
      write(string.toString());
    },
    _function: function(fn) {
      write("fn:");
      if ($93381684554307cb$var$isNativeFunction(fn)) this.dispatch("[native]");
      else this.dispatch(fn.toString());
      this.dispatch("function-name:" + String(fn.name));
      this._object(fn);
    },
    _number: function(number) {
      write("number:" + number.toString());
    },
    _xml: function(xml) {
      write("xml:" + xml.toString());
    },
    _null: function() {
      write("Null");
    },
    _undefined: function() {
      write("Undefined");
    },
    _regexp: function(regex) {
      write("regex:" + regex.toString());
    },
    _uint8array: function(arr) {
      write("uint8array:");
      this.dispatch(Array.prototype.slice.call(arr));
    },
    _uint8clampedarray: function(arr) {
      write("uint8clampedarray:");
      this.dispatch(Array.prototype.slice.call(arr));
    },
    _int8array: function(arr) {
      write("int8array:");
      this.dispatch(Array.prototype.slice.call(arr));
    },
    _uint16array: function(arr) {
      write("uint16array:");
      this.dispatch(Array.prototype.slice.call(arr));
    },
    _int16array: function(arr) {
      write("int16array:");
      this.dispatch(Array.prototype.slice.call(arr));
    },
    _uint32array: function(arr) {
      write("uint32array:");
      this.dispatch(Array.prototype.slice.call(arr));
    },
    _int32array: function(arr) {
      write("int32array:");
      this.dispatch(Array.prototype.slice.call(arr));
    },
    _float32array: function(arr) {
      write("float32array:");
      this.dispatch(Array.prototype.slice.call(arr));
    },
    _float64array: function(arr) {
      write("float64array:");
      this.dispatch(Array.prototype.slice.call(arr));
    },
    _arraybuffer: function(arr) {
      write("arraybuffer:");
      this.dispatch(new Uint8Array(arr));
    },
    _url: function(url) {
      write("url:" + url.toString());
    },
    _map: function(map) {
      write("map:");
      const arr = Array.from(map);
      this._array(arr, true);
    },
    _set: function(set) {
      write("set:");
      const arr = Array.from(set);
      this._array(arr, true);
    },
    _file: function(file) {
      write("file:");
      this.dispatch([
        file.name,
        file.size,
        file.type,
        file.lastModified
      ]);
    },
    _blob: function(blob) {
      write("blob:");
      this.dispatch([
        blob.size,
        blob.type
      ]);
    },
    _headers: function(headers) {
      write("headers:");
      this.dispatch(Array.from(headers.entries()).sort(([left], [right]) => left.localeCompare(right)));
    },
    _request: function(request) {
      write("request:");
      this.dispatch({
        cache: request.cache,
        credentials: request.credentials,
        hasBody: request.body !== null,
        headers: request.headers,
        integrity: request.integrity,
        method: request.method,
        mode: request.mode,
        redirect: request.redirect,
        referrer: request.referrer,
        referrerPolicy: request.referrerPolicy,
        url: request.url
      });
    },
    _abortsignal: function(signal) {
      write("abortsignal:");
      this.dispatch([
        signal.aborted,
        signal.aborted ? String(signal.reason) : void 0
      ]);
    },
    _formdata: function(formData) {
      write("formdata:");
      this.dispatch(Array.from(formData.entries()));
    },
    _readablestream: function() {
      write("readablestream");
    },
    _domwindow: function() {
      write("domwindow");
    },
    _bigint: function(number) {
      write("bigint:" + number.toString());
    },
    /* Node.js standard native objects */
    _process: function() {
      write("process");
    },
    _timer: function() {
      write("timer");
    },
    _pipe: function() {
      write("pipe");
    },
    _tcp: function() {
      write("tcp");
    },
    _udp: function() {
      write("udp");
    },
    _tty: function() {
      write("tty");
    },
    _statwatcher: function() {
      write("statwatcher");
    },
    _securecontext: function() {
      write("securecontext");
    },
    _connection: function() {
      write("connection");
    },
    _zlib: function() {
      write("zlib");
    },
    _context: function() {
      write("context");
    },
    _nodescript: function() {
      write("nodescript");
    },
    _httpparser: function() {
      write("httpparser");
    },
    _dataview: function() {
      write("dataview");
    },
    _signal: function() {
      write("signal");
    },
    _fsevent: function() {
      write("fsevent");
    },
    _tlswrap: function() {
      write("tlswrap");
    }
  };
}
function $93381684554307cb$var$PassThrough() {
  return {
    buf: "",
    write: function(b) {
      this.buf += b;
    },
    end: function(b) {
      this.buf += b;
    },
    read: function() {
      return this.buf;
    }
  };
}
function $e2e1ea6dd3b7d2e1$export$b644b65666fe0c18(key, _value) {
  const value = this[key];
  if (value instanceof Date) return `__raycast_cached_date__${value.toISOString()}`;
  if (Buffer.isBuffer(value)) return `__raycast_cached_buffer__${value.toString("base64")}`;
  return _value;
}
function $e2e1ea6dd3b7d2e1$export$63698c10df99509c(_key, value) {
  if (typeof value === "string" && value.startsWith("__raycast_cached_date__")) return new Date(value.replace("__raycast_cached_date__", ""));
  if (typeof value === "string" && value.startsWith("__raycast_cached_buffer__")) return Buffer.from(value.replace("__raycast_cached_buffer__", ""), "base64");
  return value;
}
function $e2e1ea6dd3b7d2e1$export$d6af199866bfb566(object) {
  const hashingStream = (0, import_node_crypto.default).createHash("sha1");
  const hasher = (0, $93381684554307cb$export$fe386877a696ae78)(hashingStream);
  hasher.dispatch(object);
  return hashingStream.digest("hex");
}
var $7d691a802b89543d$var$isX = !!process.env.RAYCASTX;
function $155078c0ae8ac51d$export$33b32b3abf8170f0(fn, options) {
  const cache = new (0, import_api.Cache)({
    namespace: (0, $e2e1ea6dd3b7d2e1$export$d6af199866bfb566)(fn)
  });
  const wrappedFn = async (...args) => {
    const key = (0, $e2e1ea6dd3b7d2e1$export$d6af199866bfb566)(args || []) + options?.internal_cacheKeySuffix;
    const cached = cache.get(key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached, (0, $e2e1ea6dd3b7d2e1$export$63698c10df99509c));
      const isExpired = options?.maxAge && Date.now() - timestamp > options.maxAge;
      if (!isExpired && (!options?.validate || options.validate(data))) return data;
    }
    const result = await fn(...args);
    cache.set(key, JSON.stringify({
      data: result,
      timestamp: Date.now()
    }, (0, $e2e1ea6dd3b7d2e1$export$b644b65666fe0c18)));
    return result;
  };
  wrappedFn.clearCache = () => {
    cache.clear();
  };
  return wrappedFn;
}

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

// src/transcript.ts
var import_node_fs = __toESM(require("node:fs"), 1);
var import_path = __toESM(require("path"), 1);

// src/utils.ts
var import_api2 = require("@raycast/api");
var import_fs = require("fs");
var import_child_process = require("child_process");
var import_os = require("os");
var isWindows = process.platform === "win32";
var isMac = process.platform === "darwin";
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
} = (0, import_api2.getPreferenceValues)();
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

// node_modules/srt-parser-2/dist/index.js
var Parser = class {
  seperator = ",";
  timestampToSeconds(srtTimestamp) {
    const [rest, millisecondsString] = srtTimestamp.split(",");
    const milliseconds = parseInt(millisecondsString);
    const [hours, minutes, seconds] = rest.split(":").map((x) => parseInt(x));
    const result = milliseconds * 1e-3 + seconds + 60 * minutes + 3600 * hours;
    return Math.round(result * 1e3) / 1e3;
  }
  correctFormat(time) {
    let str = time.replace(".", ",");
    var hour = null;
    var minute = null;
    var second = null;
    var millisecond = null;
    var [front, ms] = str.split(",");
    millisecond = this.fixed_str_digit(3, ms);
    var [a_hour, a_minute, a_second] = front.split(":");
    hour = this.fixed_str_digit(2, a_hour, false);
    minute = this.fixed_str_digit(2, a_minute, false);
    second = this.fixed_str_digit(2, a_second, false);
    return `${hour}:${minute}:${second},${millisecond}`;
  }
  /*
    // make sure string is 'how_many_digit' long
    // if str is shorter than how_many_digit, pad with 0
    // if str is longer than how_many_digit, slice from the beginning
    // Example:
  
    Input: fixed_str_digit(3, '100')
    Output: 100
    Explain: unchanged, because "100" is 3 digit
  
    Input: fixed_str_digit(3, '50')
    Output: 500
    Explain: pad end with 0
  
    Input: fixed_str_digit(3, '50', false)
    Output: 050
    Explain: pad start with 0
  
    Input: fixed_str_digit(3, '7771')
    Output: 777
    Explain: slice from beginning
    */
  fixed_str_digit(how_many_digit, str, padEnd = true) {
    if (str.length == how_many_digit) {
      return str;
    }
    if (str.length > how_many_digit) {
      return str.slice(0, how_many_digit);
    }
    if (str.length < how_many_digit) {
      if (padEnd) {
        return str.padEnd(how_many_digit, "0");
      } else {
        return str.padStart(how_many_digit, "0");
      }
    }
  }
  tryComma(data) {
    data = data.replace(/\r/g, "");
    var regex = /(\d+)\n(\d{1,2}:\d{2}:\d{2},\d{1,3}) --> (\d{1,2}:\d{2}:\d{2},\d{1,3})/g;
    let data_array = data.split(regex);
    data_array.shift();
    return data_array;
  }
  tryDot(data) {
    data = data.replace(/\r/g, "");
    var regex = /(\d+)\n(\d{1,2}:\d{2}:\d{2}\.\d{1,3}) --> (\d{1,2}:\d{2}:\d{2}\.\d{1,3})/g;
    let data_array = data.split(regex);
    data_array.shift();
    this.seperator = ".";
    return data_array;
  }
  fromSrt(data) {
    var originalData = data;
    var data_array = this.tryComma(originalData);
    if (data_array.length == 0) {
      data_array = this.tryDot(originalData);
    }
    var items = [];
    for (var i = 0; i < data_array.length; i += 4) {
      const startTime = this.correctFormat(data_array[i + 1].trim());
      const endTime = this.correctFormat(data_array[i + 2].trim());
      var new_line = {
        id: data_array[i].trim(),
        startTime,
        startSeconds: this.timestampToSeconds(startTime),
        endTime,
        endSeconds: this.timestampToSeconds(endTime),
        text: data_array[i + 3].trim()
      };
      items.push(new_line);
    }
    return items;
  }
  toSrt(data) {
    var res = "";
    const end_of_line = "\r\n";
    for (var i = 0; i < data.length; i++) {
      var s = data[i];
      res += s.id + end_of_line;
      res += s.startTime + " --> " + s.endTime + end_of_line;
      res += s.text.replace("\n", end_of_line) + end_of_line + end_of_line;
    }
    return res;
  }
};
var dist_default = Parser;

// src/transcript.ts
async function extractTranscript(url, language = "en") {
  const ytdlPath = getytdlPath();
  const ffmpegPath = getffmpegPath();
  if (!import_node_fs.default.existsSync(ytdlPath)) {
    throw new Error("yt-dlp is not installed");
  }
  if (!import_node_fs.default.existsSync(ffmpegPath)) {
    throw new Error("ffmpeg is not installed");
  }
  const videoInfo = await execa(ytdlPath, [...getCommonArgs({ throttle: true }), "--dump-json", url]);
  const video = JSON.parse(videoInfo.stdout);
  if (video.live_status !== "not_live" && video.live_status !== void 0) {
    throw new Error("Live streams are not supported");
  }
  const tmpDir = import_path.default.join(downloadPath, ".tmp-subtitles");
  if (!import_node_fs.default.existsSync(tmpDir)) {
    import_node_fs.default.mkdirSync(tmpDir, { recursive: true });
  }
  try {
    const subtitleResult = await execa(ytdlPath, [
      ...getCommonArgs({ throttle: true }),
      "--write-sub",
      // Write subtitle file
      "--write-auto-sub",
      // Write automatically generated subtitles
      "--skip-download",
      // Don't download the video
      "--sub-lang",
      // Specify subtitle language
      language,
      "--convert-subs",
      // Convert subtitles to srt format
      "srt",
      "--ffmpeg-location",
      ffmpegPath,
      "-o",
      // Output template
      import_path.default.join(tmpDir, "%(id)s.%(ext)s"),
      url
    ]);
    if (subtitleResult.failed) {
      throw new Error("Failed to download subtitles");
    }
    const files = import_node_fs.default.readdirSync(tmpDir).filter((f) => f.endsWith(".srt"));
    const wanted = language.toLowerCase();
    const subtitleFile = files.find((f) => {
      const lang = f.slice(0, -".srt".length).split(".").pop()?.toLowerCase() ?? "";
      return lang === wanted || lang.startsWith(`${wanted}-`);
    });
    if (!subtitleFile) {
      const available = files.map((f) => f.slice(0, -".srt".length).split(".").pop()).filter(Boolean).join(", ");
      throw new Error(
        available ? `No ${language} subtitles found for this video (available: ${available})` : `No ${language} subtitles found for this video`
      );
    }
    const subtitleContent = import_node_fs.default.readFileSync(import_path.default.join(tmpDir, subtitleFile), "utf-8");
    const transcript = cleanUpSrt(subtitleContent);
    import_node_fs.default.rmSync(tmpDir, { recursive: true, force: true });
    return {
      transcript,
      title: sanitizeVideoTitle(video.title)
    };
  } catch (error) {
    import_node_fs.default.rmSync(tmpDir, { recursive: true, force: true });
    throw error;
  }
}
function cleanUpSrt(srtContent) {
  const parser = new dist_default();
  const subtitles = parser.fromSrt(srtContent);
  let cleanedText = "";
  let previousText = "";
  for (const subtitle of subtitles) {
    const currentText = subtitle.text.trim();
    if (!currentText) continue;
    if (currentText === previousText) continue;
    if (currentText.includes(previousText) && previousText !== "") {
      const newPart = currentText.substring(previousText.length).trim();
      if (newPart) {
        cleanedText += " " + newPart;
      }
    } else if (!previousText.includes(currentText)) {
      if (cleanedText) cleanedText += " ";
      cleanedText += currentText;
    }
    previousText = currentText;
  }
  return cleanedText.replace(/\s+/g, " ").replace(/<[^>]+>/g, "").replace(/\{[^}]+\}/g, "").replace(/\[.*?\]/g, "").replace(/\([^)]*\)/g, "").replace(/♪/g, "").trim();
}

// src/tools/extract-transcript.ts
async function tool(input) {
  const { url, language = "en" } = input;
  const cachedTranscript = $155078c0ae8ac51d$export$33b32b3abf8170f0(extractTranscript);
  const { transcript } = await cachedTranscript(url, language);
  return transcript;
}
