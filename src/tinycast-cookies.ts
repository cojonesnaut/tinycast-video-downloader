// yt-dlp aborts before downloading when it cannot read the chosen browser's
// cookies. Recognise those failures so the extension can explain them and retry
// without cookies instead of showing a raw traceback.
const names: Record<string, string> = { safari: "Safari", chrome: "Chrome", brave: "Brave", edge: "Microsoft Edge", firefox: "Firefox", opera: "Opera", vivaldi: "Vivaldi" };

export function cookieFailure(output: string, browser?: string): string | undefined {
  if (!browser || browser === "none") return undefined;
  const name = names[browser] || browser;
  const error = output.split(/\r?\n/).reverse().find(line => line.startsWith("ERROR:")) || "";
  if (/Cookies\.binarycookies/.test(error) && /Operation not permitted|Permission denied/i.test(error))
    return `Tinycast can't read ${name} cookies. Give Tinycast Full Disk Access in System Settings → Privacy & Security, then restart Tinycast.`;
  if (/could not find \S+ cookies database/i.test(error))
    return `No ${name} cookie database was found. If ${name} is installed and signed in, allow Tinycast to access data from other apps in System Settings → Privacy & Security.`;
  // Login-required errors also mention "--cookies"; those are not read failures.
  if (/cookies database|cookies\.sqlite|keyring|could not copy .*cookie|failed to decrypt/i.test(error) && !/--cookies/.test(error))
    return `Couldn't read ${name} cookies: ${error.replace(/^ERROR:\s*/, "")}`;
  return undefined;
}

// System Settings → Privacy & Security → Full Disk Access.
export const privacySettingsUrl = "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles";
export type CookieCheck = { ok: boolean; message: string; needsPermission?: boolean };

// Summarise a cookie-only yt-dlp run (no URL: yt-dlp loads the browser's cookies,
// writes them to --cookies, then exits complaining about the missing URL).
// output is yt-dlp's stdout + stderr; cookieFile is the Netscape cookie file it wrote.
export function describeCookieCheck(output: string, cookieFile: string, browser: string): CookieCheck {
  const name = names[browser.split(":")[0]] || browser;
  const failure = cookieFailure(output, browser);
  if (failure) return { ok: false, message: failure, needsPermission: /Full Disk Access|data from other apps/.test(failure) };
  const extracted = output.match(/Extracted (\d+) cookies from \S+(?: \((\d+) could not be decrypted\))?/);
  if (!extracted) {
    const error = output.split(/\r?\n/).reverse().find(line => line.startsWith("ERROR:"));
    return { ok: false, message: `Couldn't read ${name} cookies${error ? `: ${error.replace(/^ERROR:\s*/, "")}` : "."}` };
  }
  const read = Number(extracted[1]), undecrypted = Number(extracted[2] || 0);
  const keychain = `When macOS asks Tinycast for “${name} Safe Storage” in the Keychain, choose Always Allow, then check again.`;
  if (!read && undecrypted) return { ok: false, message: `Found ${undecrypted} ${name} cookies but couldn't decrypt them. ${keychain}` };
  if (!read) return { ok: false, message: `${name} has no saved cookies. Sign in to YouTube (or the site you download from) in ${name}, then check again.` };
  // Netscape format: domain, subdomains, path, secure, expiry, name, value (HttpOnly lines are prefixed).
  const youtube = cookieFile.split(/\r?\n/).map(line => line.replace(/^#HttpOnly_/, "").split("\t")).filter(f => f.length >= 7 && /(^|\.)youtube\.com$/.test(f[0]));
  const signedIn = youtube.some(f => ["LOGIN_INFO", "SAPISID", "__Secure-3PSID"].includes(f[5]));
  const youtubeText = signedIn ? "signed in to YouTube" : youtube.length ? `${youtube.length} YouTube cookies, but not signed in to YouTube` : "no YouTube cookies; sign in to YouTube in this browser if downloads ask you to sign in";
  return { ok: true, message: `Read ${read} cookies from ${name}: ${youtubeText}.${undecrypted ? ` ${undecrypted} more couldn't be decrypted. ${keychain}` : ""}` };
}

// Remove "--cookies-from-browser <browser>" from a yt-dlp argument list.
export function withoutCookies(args: string[]): string[] {
  const index = args.indexOf("--cookies-from-browser");
  return index < 0 ? args : [...args.slice(0, index), ...args.slice(index + 2)];
}
