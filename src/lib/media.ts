import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

// Uploaded images live on a Docker volume (UPLOAD_DIR) and are served by /media/[name].
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const TYPES = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
export type ImageExt = keyof typeof TYPES;
export const contentTypeFor = (ext: string) => TYPES[ext as ImageExt];

/** Detects the image type from the file's first bytes, so a renamed non-image is refused. */
function sniff(b: Uint8Array): ImageExt | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

/** Saves an uploaded image and returns its public path, or an error message. */
export async function saveImage(file: File): Promise<{ url: string } | { error: string }> {
  if (!file || file.size === 0) return { error: "Choose an image file." };
  if (file.size > MAX_IMAGE_BYTES) return { error: "That image is over 5 MB. Export it smaller (e.g. 1600 px wide) and try again." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniff(bytes);
  if (!ext) return { error: "Use a JPG, PNG or WebP image." };
  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, name), bytes);
  return { url: `/media/${name}` };
}

/** Accepts only https links for images hosted elsewhere. */
export function cleanImageLink(input: string): string | null {
  try {
    const u = new URL(input.trim());
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
