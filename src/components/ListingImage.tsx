import type { ListingType } from "@prisma/client";
import ListingArt from "./ListingArt";

/** The listing's photo if it has one, otherwise its illustration. */
export default function ListingImage({ type, imageUrl, alt }: { type: ListingType; imageUrl?: string | null; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return imageUrl ? <img className="art-img" src={imageUrl} alt={alt} loading="lazy" /> : <ListingArt type={type} />;
}
