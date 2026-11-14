import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { UPLOAD_DIR } from "./media";

export const aiImagesEnabled = () => !!process.env.OPENAI_API_KEY;

/** Generates a landscape image from a text description with OpenAI's image API and saves it to uploads. */
export async function generateImage(prompt: string): Promise<{ url: string } | { error: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { error: "AI images aren't switched on yet: add an OpenAI API key on the server." };
  const clean = prompt.trim().slice(0, 1000);
  if (clean.length < 10) return { error: "Describe the image in a few more words." };
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1", prompt: clean, size: "1536x1024", n: 1 }),
    });
    if (!res.ok) {
      console.error("AI image failed:", res.status, (await res.text()).slice(0, 500));
      return { error: "The AI image service refused the request. Try a different description, or try again later." };
    }
    const data = await res.json();
    const b64: string | undefined = data?.data?.[0]?.b64_json;
    if (!b64) return { error: "The AI image service returned no image. Try again." };
    await mkdir(UPLOAD_DIR, { recursive: true });
    const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.png`;
    await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(b64, "base64"));
    return { url: `/media/${name}` };
  } catch (e) {
    console.error("AI image error:", e);
    return { error: "Couldn't reach the AI image service. Try again in a moment." };
  }
}

/** A starting description built from the listing; the admin can edit it before generating. */
export function suggestPrompt(l: { title: string; place: string; type: string }, countryName = "Sri Lanka") {
  const scene: Record<string, string> = {
    STAY: "a welcoming guesthouse or villa exterior with tropical plants",
    DRIVER: "a clean modern car or van on a scenic road",
    TRANSPORT: "a modern air-conditioned coach on a scenic highway",
    GUIDE: "a scenic landmark view with travellers exploring",
    SHARE: "a bright, tidy shared apartment room",
    PACKAGE: "an inviting holiday activity scene",
    WELLNESS: "a calm Ayurveda spa treatment room with natural materials",
  };
  return `Bright, natural travel photograph style image for "${l.title}" in ${l.place}, ${countryName}: ${scene[l.type] ?? `a ${countryName} travel scene`}. Daylight, fresh tropical colours, no text, no logos, no recognisable people.`;
}
