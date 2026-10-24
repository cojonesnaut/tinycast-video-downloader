// The download details and "Download completed" screens, drawn as images. Coordinates
// and sizes come from the reference design (progress 909×341, finished 1560×451, both
// shown 909 wide). There is no background: the images sit on Tinycast's
// liquid-glass panel, and text colours follow the appearance. Text and flat shapes
// only, so an update decodes in a few milliseconds.

export const PANEL_WIDTH = 909;

// macOS accent colours by AppleAccentColor value; unset (multicolour) is blue.
const accents: Record<string, string> = { "-1": "#8C8C8C", "0": "#E0393E", "1": "#F7821B", "2": "#FFC600", "3": "#62BA46", "4": "#007AFF", "5": "#A550A7", "6": "#F74F9E" };
export const accentColor = (accent?: string) => accents[accent ?? "4"] ?? accents["4"];

type Palette = { label: string; value: string; heading: string; track: string };
const palettes: Record<"dark" | "light", Palette> = {
  dark: { label: "#9A9A9A", value: "#E1E1E1", heading: "#E5E5E5", track: "rgba(255,255,255,0.09)" },
  light: { label: "#6E6E73", value: "#1D1D1F", heading: "#1D1D1F", track: "rgba(0,0,0,0.08)" },
};
const palette = (appearance?: string) => palettes[appearance === "light" ? "light" : "dark"];

const FONT = `font-family="-apple-system,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif"`;
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Long values such as paths and file names are shortened in the middle.
export function middle(text: string, max = 63) {
  const chars = [...text];
  if (chars.length <= max) return text;
  const head = Math.ceil((max - 1) / 2);
  return chars.slice(0, head).join("") + "…" + chars.slice(chars.length - (max - 1 - head)).join("");
}
const uri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

// Progress: the video title, then eight label/value rows above a rounded bar in the
// accent colour. The title uses the rows' font size, emboldened like the finish heading.
export function progressPanel(title: string, rows: [string, string][], percent: number | null, color: string, appearance?: string) {
  const p = palette(appearance);
  const font = `${FONT} font-size="21.1"`;
  const top = 35; // the title line pushes the rows down by one row
  const text = rows.map(([label, value], i) => {
    const y = top + 26 + i * 35;
    return `<text x="20" y="${y}" fill="${p.label}" ${font}>${xml(label)}</text><text x="218" y="${y}" fill="${p.value}" ${font}>${xml(middle(value))}</text>`;
  }).join("");
  const name = [...title].length > 76 ? [...title].slice(0, 75).join("") + "…" : title;
  const bar = top + 309, height = top + 341;
  const width = percent == null ? 0 : Math.max(14, Math.round(880 * Math.max(0, Math.min(100, percent)) / 100));
  return uri(`<svg xmlns="http://www.w3.org/2000/svg" width="909" height="${height}" viewBox="0 0 909 ${height}">` +
    `<defs><clipPath id="bar"><rect x="18" y="${bar}" width="880" height="14" rx="7"/></clipPath></defs>` +
    `<text x="20" y="26" fill="${p.heading}" stroke="${p.heading}" stroke-width="0.9" stroke-linejoin="round" ${font}>${xml(name)}</text>${text}` +
    `<g clip-path="url(#bar)"><rect x="18" y="${bar}" width="880" height="14" fill="${p.track}"/>${width ? `<rect x="18" y="${bar}" width="${width}" height="14" fill="${color}"/>` : ""}</g></svg>`);
}

// Finished: a status badge, a bold heading, the file name and label/value rows.
const marks = {
  complete: { fill: "#30D158", mark: `<path d="M79.3 87.5L97.4 105.6L133.7 66.4" fill="none" stroke="#202020" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>` },
  error: { fill: "#FF453A", mark: `<path d="M106.5 52V93" stroke="#202020" stroke-width="11" stroke-linecap="round"/><circle cx="106.5" cy="117" r="7.5" fill="#202020"/>` },
  stopped: { fill: "#8E8E93", mark: `<rect x="84.5" y="64" width="44" height="44" rx="7" fill="#202020"/>` },
};
export function finishedPanel(kind: keyof typeof marks, heading: string, file: string, rows: [string, string][], appearance?: string) {
  const p = palette(appearance), badge = marks[kind];
  const height = 241 + (rows.length - 1) * 60 + 30;
  const text = rows.map(([label, value], i) => {
    const y = 241 + i * 60;
    return `<text x="34" y="${y}" fill="${p.label}" ${FONT} font-size="35">${xml(label)}</text><text x="218" y="${y}" fill="${p.value}" ${FONT} font-size="36.2">${xml(middle(value, 72))}</text>`;
  }).join("");
  return uri(`<svg xmlns="http://www.w3.org/2000/svg" width="${PANEL_WIDTH}" height="${Math.round(height * PANEL_WIDTH / 1560)}" viewBox="0 0 1560 ${height}">` +
    `<circle cx="106.5" cy="86" r="63.5" fill="${badge.fill}"/>${badge.mark}` +
    // macOS's SVG renderer ignores font-weight for the system font, so the heading is
    // emboldened with a matching outline (sized to the reference bold heading: width and ink).
    `<text x="224" y="74" fill="${p.heading}" stroke="${p.heading}" stroke-width="2.6" stroke-linejoin="round" ${FONT} font-size="52.5">${xml(heading)}</text>` +
    `<text x="222" y="135" fill="${p.value}" ${FONT} font-size="37">${xml(middle(file, 64))}</text>${text}</svg>`);
}

// The finish time, as "Oct 24, 2026 at 14:59".
export function finishedAt(date: Date) {
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()];
  const two = (n: number) => String(n).padStart(2, "0");
  return `${month} ${date.getDate()}, ${date.getFullYear()} at ${two(date.getHours())}:${two(date.getMinutes())}`;
}
