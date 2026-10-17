# Video Downloader for Tinycast on macOS

**Requires Tinycast Beta 0.10.15-beta.83 or a later release with full-size Grid artwork. Tinycast stable 0.10.5 renders these cards as small icons.**

This is a Tinycast-specific rebuild of vimtor's Video Downloader. The compiled `index.js`, manifest and assets are ready to import; Node.js is not required to run it.

## Use

In Tinycast, open **Download Video**. The suggested shortcut is **⌘⌥D**. Tinycast stores shortcuts in its own settings, and extensions can't ship one, so set it once under Tinycast → Settings → Extensions → Video Downloader → Download Video with the shortcut recorder. It is kept when you reinstall over the existing folder and removed if you uninstall the extension. Paste a complete link into the **Video URL** field (not the launcher search field). The Status row shows lookup progress, the video title, or an error. Choose a format, then press **Return** to download. A metadata lookup is not required before downloading.

Formats: MP4 video (default), original format at the highest resolution, or MP3 audio. When MP4 is selected, a **Resolution** dropdown offers Highest (4K), 1440p, 1080p or 720p. When the video has dubbed or auto-dubbed audio (for example on YouTube), an **Audio Language** dropdown lists every audio language after the lookup finishes. It defaults to the original track and works for MP4, original format and MP3. A dubbed download gets the language code in its file name (for example “Title [id].es.mp4”), so it never replaces the original-language file. It can also run beside an original-language download of the same video. If the chosen language isn't available at download time, the original audio is used. MP4 selection prioritizes resolution and frame rate, then prefers MP4 video and M4A audio. Highest (default) selects 4K/8K when offered by the source, without upscaling lower-resolution video. A resolution limit picks the largest stream at or below it; if the source has nothing that small, the closest larger stream is used. Limits apply to the shorter side, so portrait videos are handled the same way. If the highest-resolution stream uses another container, it is remuxed to MP4 without downscaling. MP4 may contain AV1 or VP9 depending on the source. Playlist downloading is optional. You can close the command while downloading: the download keeps running, and reopening **Download Video** shows its progress again, with Pause and Stop still working. Pressing Download for a video that is already downloading shows that download instead of starting a second copy, since two runs would overwrite each other's partial files. The Glass sound plays on success even if the command was closed. A Downie-style row shows the video thumbnail dimmed across the whole card, the title, and “source – format – resolution” (for example “youtube.com – MP4 – 3840x2160”, with the file size added when finished). A full-width pill progress bar shows Downie's status text, such as “33% - Downloading - 20,7 MB/57,8 MB - 00:12 remaining - 3,0 MB/s”. Its fill uses your macOS accent colour, and numbers follow your region's decimal separator. The pill turns green with “Finished.” on success and red on failure. Pause, Stop and the other controls are in Actions (⌘P, ⌘.); the icons on the card are drawn to match Downie and are not clickable. The card follows Tinycast's light or dark appearance when Tinycast reports it, otherwise it is dark. A separate animated downloading toast is intentionally not shown, so no stale “Keep this command open” strip remains after completion. Sites such as YouTube deliver video and audio as separate streams. yt-dlp's sizes for both are read before the download starts, so the card shows one progress bar, byte count and time remaining for the whole video instead of restarting for the audio. If a site doesn't report the sizes, each stream shows its own progress. In playlists, each item has its own progress. Processing is shown separately; only confirmed completion turns the bar green at 100% and plays the macOS Glass notification sound. On success, **Show Download in Finder** is available in Actions. Choose **New Download** to return to the form. Failures show a red bar and an error with no completion sound.

The extension detects yt-dlp, ffmpeg and ffprobe in Homebrew's Apple Silicon and Intel locations, or from the executable paths in extension preferences. The download directory defaults to `~/Downloads`. `ffprobe` is included with ffmpeg. Browser cookies are used only when the existing cookie preference is enabled. yt-dlp runs as part of Tinycast, so macOS checks Tinycast's permissions: Safari cookies need Full Disk Access for Tinycast, and Chromium browsers such as Brave or Chrome may need Tinycast to be allowed to access data from other apps, plus a one-time Keychain prompt. If the cookies can't be read, the form shows a **Cookies** note explaining why, and the lookup and download continue without cookies instead of failing. To test the setting, choose **Check Browser Cookies** (⌘⇧K) in Download Video. It reads the browser's cookies inside Tinycast, so the result reflects Tinycast's real permissions. It reports how many cookies were read, whether you're signed in to YouTube in that browser, and any fix needed. When the fix is a permission, **Open Privacy Settings** opens System Settings → Privacy & Security. The check's temporary cookie file is deleted straight away. **Force IPv4** adds yt-dlp's `--force-ipv4` to every lookup, download and transcript request. Thumbnails are fetched normally. Clipboard autofill is supported; the upstream selected-text autofill preference is not used by this Tinycast interface. Browser extension support was removed because Tinycast has no browser extension.

## Extract Transcript

Open **Extract Transcript**, paste a video URL, and choose **Load Caption Languages**. Select a published or automatic caption track, optionally enable timestamps, then choose **Extract Transcript** (⌘Return in current Tinycast Beta). The transcript appears in a preview with **Copy Transcript**, **Save as Markdown**, **Save as Text**, and **Show/Hide Timestamps** actions. Saved transcripts go to the configured download folder with a unique filename.

This extracts existing captions, including automatic captions and translated tracks when exposed by the site. It does not perform speech recognition on videos without captions, and needs no Raycast AI service. It reuses the yt-dlp/ffmpeg paths and opt-in browser-cookie preferences. If the configured browser session exposes no captions or fails, the command retries publicly and keeps that public mode for subtitle extraction. Temporary subtitle files are isolated per extraction and cleaned up afterward. Meaningful parenthetical and bracketed text is preserved; rolling caption overlap is removed.

Verified with a real YouTube automatic-caption extraction, plus Tinycast runtime tests for the language picker, preview, timestamp toggle, and Markdown/text exports.

## Import or rebuild

Tinycast → Settings → Extensions → Install → Add Folder → select **video-downloader**.

To rebuild, install Node.js with npm and run `Build.command`, or:

```sh
npm install --ignore-scripts
npm run build
```

For locked dependencies: `pnpm install --frozen-lockfile --ignore-scripts && pnpm run build`.

## Compatibility changes

The Tinycast entry point is `src/tinycast.tsx`. It uses controlled React form fields and the supported `execFile` process API, avoiding the original Raycast utility hooks and execa's unsupported Node APIs. Format choices are always available. Lookup errors, missing binaries, failed downloads and saved paths are visible. Live yt-dlp progress is written to a unique temporary log and sampled every 250 ms, since Tinycast buffers process callbacks. Temporary logs are removed when the download completes or fails. Unknown totals show a preparing state until yt-dlp reports a percentage. The card is rendered in a single Grid.Item with a permanent identity. Tinycast retains the previous decoded card while the next update loads, so progress changes do not replace it with a blank placeholder. The 4-pixel bar is a continuous SVG rectangle, not text or emoji blocks. Transfer statistics come from yt-dlp, and unknown values are omitted rather than guessed. User yt-dlp config files are ignored so external options cannot suppress downloads or change machine-readable output.

The original Raycast source is preserved in `src/index.tsx`; `npm run build:raycast` uses that original entry point. The upstream AI tool bundles are included, but Tinycast's folder importer installs only the main UI command.

## Verification

Tested against the JavaScript runtime shipped in the installed Tinycast app with real yt-dlp and ffmpeg: pasting a YouTube link loaded metadata; form submission saved MP3 and MP4 files; ffprobe confirmed video and audio in the MP4. The installed app was also checked directly for URL lookup and downloading. A throttled real YouTube download through the installed runtime verified intermediate percentage updates, green 100% completion, and the afplay notification command. Parser checks cover unknown totals, separate transfers, processing, failure colors, byte counts, speeds, remaining time and escaped titles. A real runtime download verified that no download toast is created. A throttled download retained the same Grid.Item identity across all progress frames. Format-selection tests prefer 4K MP4 over lower-resolution MP4 and retain 4K resolution when remuxing is needed. Closing the command mid-download was tested with the supervisor left running and with it killed: the reopened command reattached, Pause suspended yt-dlp, Resume continued it, the file completed at its full size, and pressing Download again for the same video attached instead of starting a duplicate.

## Attribution

Tinycast edition by cojonesnaut. The launcher icon is `assets/video-downloader-icon.png` (source: `metadata/extension-icon.svg`). If Tinycast still shows an old icon after reinstalling, quit and reopen Tinycast, and check that Settings → Extensions → Video Downloader isn't using a custom SF Symbol icon (choose **Use Original**). Original extension by vimtor and contributors, MIT license (included).

- Store: https://www.raycast.com/vimtor/video-downloader
- Source snapshot: https://github.com/raycast/extensions/tree/80e0b27435acfe057635b12d48544a4f813e4e97/extensions/video-downloader
- Tinycast import documentation: https://abue-ammar.github.io/tinycast/docs/extensions/installing/

## Pause and stop downloads

While downloading, use Pause Download / Resume Download in Actions (Command-P), or Stop Download (Command-period). Pause also suspends FFmpeg processing. A paused download stays paused if you close the command. Stop terminates the download and any processing, keeps partial files for a later retry, and does not play the completion sound. The progress bar stays still while paused.

## Download thumbnails

Thumbnails continue loading if you start the download before video lookup finishes. FFmpeg scales the thumbnail to fill the 720×108 card at 480×72 pixels, the extension dims it as Downie does and converts it once into vector paths, because macOS’s SVG decoder does not display embedded bitmap images. Progress updates reuse that preview.
