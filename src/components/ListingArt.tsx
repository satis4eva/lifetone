import type { ListingType } from "@prisma/client";

// Illustrations per listing type, used until providers upload real photos.
const ART: Record<ListingType, { from: string; to: string; body: string }> = {
  STAY: { from: "#13b5a6", to: "#0e8f86", body: '<path d="M60 88l40-30 40 30v40H60z" fill="#fff8ee"/><path d="M90 128v-22h20v22" fill="#ff6f59"/><path d="M150 128c0-30 8-50 20-60" stroke="#3a6b2d" stroke-width="4" fill="none"/><path d="M170 68c-14-8-26-2-30 6 10-4 20-2 30-6zM170 68c10-6 22-2 24 8-8-6-16-6-24-8z" fill="#3fa34d"/>' },
  DRIVER: { from: "#5aa7e0", to: "#2d5b8a", body: '<path d="M50 110v-14l10-20h80l10 20v14z" fill="#fff8ee"/><circle cx="72" cy="112" r="9" fill="#123b33"/><circle cx="128" cy="112" r="9" fill="#123b33"/><path d="M66 78h68l6 14H60z" fill="#d9f3ef"/>' },
  TRANSPORT: { from: "#7fb7c4", to: "#3d6470", body: '<rect x="40" y="62" width="120" height="50" rx="8" fill="#fff8ee"/><path d="M40 84h120" stroke="#3d6470" stroke-width="3"/><circle cx="66" cy="114" r="8" fill="#123b33"/><circle cx="134" cy="114" r="8" fill="#123b33"/><rect x="50" y="68" width="22" height="12" rx="2" fill="#d9f3ef"/><rect x="80" y="68" width="22" height="12" rx="2" fill="#d9f3ef"/><rect x="110" y="68" width="22" height="12" rx="2" fill="#d9f3ef"/>' },
  GUIDE: { from: "#ffb38a", to: "#c45a2c", body: '<path d="M60 130V78c0-14 12-24 40-24s40 10 40 24v52z" fill="#8a5a3c"/><circle cx="160" cy="40" r="14" fill="#ffc145"/>' },
  SHARE: { from: "#b39ddb", to: "#7a5ab0", body: '<rect x="50" y="70" width="100" height="56" rx="6" fill="#fff8ee"/><rect x="62" y="82" width="34" height="24" rx="3" fill="#d9f3ef"/><rect x="104" y="82" width="34" height="24" rx="3" fill="#ffe6e0"/>' },
  PACKAGE: { from: "#ff9a7a", to: "#ff6f59", body: '<path d="M0 100c40-12 80-12 120 0s60 10 80 4v46H0z" fill="#13b5a6"/><path d="M70 96c10-30 30-46 60-50-14 16-28 34-36 50z" fill="#fff8ee"/><circle cx="50" cy="40" r="16" fill="#ffc145"/>' },
};

export default function ListingArt({ type }: { type: ListingType }) {
  const a = ART[type];
  const id = `g-${type}`;
  return (
    <svg className="art-svg" viewBox="0 0 200 130" preserveAspectRatio="xMidYMid slice" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a.from}"/><stop offset="1" stop-color="${a.to}"/></linearGradient></defs><rect width="200" height="130" fill="url(#${id})"/>${a.body}` }} />
  );
}
