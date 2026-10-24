import { Action, ActionPanel, Clipboard, Detail, Form, getPreferenceValues, openExtensionPreferences, showInFinder } from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadCaptionVideo, extractCaptions, transcriptText, markdownEscape, errorText, expand, validUrl, type CaptionVideo, type Cue, type TranscriptPreferences } from "./transcript-engine.js";

export default function ExtractTranscript() {
  const prefs = getPreferenceValues<TranscriptPreferences & { autoLoadUrlFromClipboard?: boolean }>();
  const [url, setUrl] = useState("");
  const [video, setVideo] = useState<CaptionVideo | null>(null);
  const [track, setTrack] = useState("");
  const [timestamps, setTimestamps] = useState(false);
  const [cues, setCues] = useState<Cue[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Paste a video URL, then choose Load Caption Languages.");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const working = useRef(false), edited = useRef(false);
  useEffect(() => { if (prefs.autoLoadUrlFromClipboard) void Clipboard.readText().then(text => { if (!edited.current && text && validUrl(text)) setUrl(text.trim()); }).catch(() => {}); }, []);
  async function submit(values: Record<string, unknown>) {
    if (working.current) return;
    working.current = true; setBusy(true); setError("");
    try {
      const link = String(values.url ?? url).trim();
      if (!video || link !== video.url) {
        setStatus("Loading available caption languages…");
        const next = await loadCaptionVideo(link, prefs);
        setVideo(next); setUrl(link);
        const preferred = next.tracks.find(t => !t.automatic && /^en(?:-|$)/.test(t.code)) || next.tracks.find(t => t.code === "en-orig") || next.tracks.find(t => /^en(?:-|$)/.test(t.code)) || next.tracks[0];
        setTrack(preferred.id); setStatus(next.publicCaptions ? "Public captions loaded (browser session had none). Choose a language, then run Extract Transcript." : "Choose a caption language, then run Extract Transcript.");
      } else {
        setStatus("Downloading and extracting captions… Keep this command open.");
        const selected = String(values.language ?? track);
        setTrack(selected); setTimestamps(Boolean(values.timestamps ?? timestamps));
        setCues(await extractCaptions(video, selected, prefs));
        setStatus("");
      }
    } catch (e) { setError(errorText(e)); setStatus("Could not extract the transcript. See the error below."); }
    finally { working.current = false; setBusy(false); }
  }
  const text = cues ? transcriptText(cues, timestamps) : "";
  const language = video?.tracks.find(t => t.id === track);
  const markdown = video && cues ? `# ${markdownEscape(video.title)}\n\n${markdownEscape(video.url)}\n\n${markdownEscape(language?.name || track)}${language?.automatic ? " · Automatic captions" : " · Published captions"}\n\n${markdownEscape(text)}` : "";
  function save(extension: "md" | "txt") {
    try {
      const folder = expand(prefs.downloadPath || "~/Downloads"); mkdirSync(folder, { recursive: true });
      const name = (video?.title || "Transcript").replace(/[\/\\:*?"<>|\x00-\x1f]/g, "_").slice(0, 100);
      const file = path.join(folder, `${name} - transcript-${Date.now()}.${extension}`);
      writeFileSync(file, extension === "md" ? markdown : text, { encoding: "utf8", flag: "wx" });
      setSaved(file); setError("");
    } catch (e) { setError(errorText(e)); }
  }
  if (cues) return <Detail markdown={`${markdown}${saved ? `\n\n---\n\nSaved: ${markdownEscape(saved)}` : ""}${error ? `\n\nExport error: ${markdownEscape(error)}` : ""}`} actions={<ActionPanel>
    <Action.CopyToClipboard title="Copy Transcript" content={text} />
    <Action title="Save as Markdown" onAction={() => save("md")} />
    <Action title="Save as Text" onAction={() => save("txt")} />
    <Action title={timestamps ? "Hide Timestamps" : "Show Timestamps"} onAction={() => setTimestamps(v => !v)} />
    {saved && <Action title="Show Saved Transcript in Finder" onAction={() => showInFinder(saved)} />}
    <Action title="Choose Another Language" onAction={() => { setCues(null); setSaved(""); setError(""); setStatus("Choose a language, then run Extract Transcript."); }} />
  </ActionPanel>} />;
  return <Form isLoading={busy} actions={<ActionPanel>
    <Action.SubmitForm title={busy ? "Working…" : video ? "Extract Transcript" : "Load Caption Languages"} onSubmit={submit} />
    {error && <Action.CopyToClipboard title="Copy Error" content={error} />}
    <Action title="Extension Preferences" onAction={openExtensionPreferences} />
  </ActionPanel>}>
    <Form.TextField id="url" title="Video URL" value={url} onChange={value => { if (!working.current) { edited.current = true; setUrl(value); setVideo(null); setTrack(""); setError(""); setStatus("Choose Load Caption Languages."); } }} placeholder="https://www.youtube.com/watch?v=…" />
    {video && <Form.Description title="Video" text={video.title} />}
    {video && <Form.Dropdown id="language" title="Caption Language" value={track} onChange={setTrack}>
      {video.tracks.map(t => <Form.Dropdown.Item key={t.id} value={t.id} title={`${t.name} (${t.code}) · ${t.automatic ? "Automatic" : "Published"}`} />)}
    </Form.Dropdown>}
    <Form.Checkbox id="timestamps" title="Timestamps" label="Include timestamps" value={timestamps} onChange={setTimestamps} />
    <Form.Description title="Status" text={status} />
    {error && <Form.Description title="Error" text={error.slice(-3000)} />}
  </Form>;
}
