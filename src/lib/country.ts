// Country settings for brands. Add a country here and it appears in the platform console.
// Money is always stored in the currency's minor unit (cents, pence).
export interface CountryConfig {
  name: string;
  currency: string;
  decimals: number;
  heroTitle: string;
  heroText: string;
  searchPlaceholder: string;
  townPlaceholder: string;
  phonePlaceholder: string;
  licenceLabel: string;
  cashNote: string;
  destinations: Array<{ name: string; note: string; svg: string }>;
}

const SKY = (top: string, land: string, extra = "") =>
  `<rect width="200" height="150" fill="${top}"/>${extra}<path d="M0 105c40-14 90-14 130-2s50 10 70 6v41H0z" fill="${land}"/>`;

export const COUNTRIES: Record<string, CountryConfig> = {
  LK: {
    name: "Sri Lanka", currency: "LKR", decimals: 0,
    heroTitle: "Your island escape, booked with locals",
    heroText: "Beach stays, tea-country bungalows, drivers, guides, transport, surf weeks and Ayurveda spas from licensed Sri Lankan providers.",
    searchPlaceholder: "Galle, Ella, Arugam Bay…", townPlaceholder: "e.g. Negombo", phonePlaceholder: "+94 7X XXX XXXX",
    licenceLabel: "Licence or registration number (SLTDA / NTC / Ayurveda)",
    cashNote: "Pay in rupees on arrival",
    destinations: [
      { name: "Galle", note: "Fort stays and beaches", svg: '<rect width="200" height="150" fill="#0e8f86"/><circle cx="160" cy="34" r="20" fill="#ffc145"/><path d="M0 95c40-12 80-12 120 0s60 10 80 4v51H0z" fill="#13b5a6"/><path d="M0 118c50-10 100-10 200 2v30H0z" fill="#ffe2b8"/>' },
      { name: "Ella", note: "Tea country", svg: '<rect width="200" height="150" fill="#3fa34d"/><path d="M0 80c30-30 60-30 90-6s60 20 110-14v90H0z" fill="#2e8a3d"/><path d="M0 110c40-20 80-16 120-2s60 6 80-6v48H0z" fill="#21702f"/>' },
      { name: "Arugam Bay", note: "Surf weeks", svg: '<rect width="200" height="150" fill="#ff8a5c"/><circle cx="100" cy="88" r="38" fill="#ffc145"/><path d="M0 100c30-8 60-8 90 0s70 8 110 0v50H0z" fill="#0e8f86"/>' },
      { name: "Sigiriya", note: "Ancient rock fortress", svg: '<rect width="200" height="150" fill="#6aa9d8"/><path d="M70 150V70c0-14 10-24 30-24s30 10 30 24v80z" fill="#8a5a3c"/><path d="M0 120c50-12 150-12 200 0v30H0z" fill="#3fa34d"/>' },
    ],
  },
  GB: {
    name: "United Kingdom", currency: "GBP", decimals: 2,
    heroTitle: "See Britain your way",
    heroText: "Coach trips, private hire, guided tours, stays and day trips across the UK from licensed local operators.",
    searchPlaceholder: "London, Edinburgh, Bath, York…", townPlaceholder: "e.g. Manchester", phonePlaceholder: "+44 7XXX XXXXXX",
    licenceLabel: "Licence or registration number (e.g. PSV operator licence)",
    cashNote: "Pay the operator on the day",
    destinations: [
      { name: "London", note: "City breaks and day trips", svg: SKY("#5b8fd6", "#3d6b3a", '<rect x="90" y="40" width="20" height="70" fill="#c9b37a"/><path d="M90 40l10-16 10 16z" fill="#8a7a50"/><circle cx="100" cy="58" r="6" fill="#fff8ee"/>') },
      { name: "Edinburgh", note: "Castles and festivals", svg: SKY("#7a8fb8", "#4f6b4a", '<path d="M60 105V70h20v-8h10v8h20v-8h10v8h20v35z" fill="#6b6f7a"/>') },
      { name: "Lake District", note: "Lakes and fells", svg: SKY("#8cc7e8", "#3f8a4d", '<path d="M0 90l50-40 40 30 40-36 70 46v20H0z" fill="#56785a"/><ellipse cx="100" cy="118" rx="70" ry="10" fill="#5aa7e0"/>') },
      { name: "Bath", note: "Georgian city and spas", svg: SKY("#e8c48c", "#7a9a5a", '<path d="M40 105V75h120v30z" fill="#d9c08f"/><path d="M50 75v30M70 75v30M90 75v30M110 75v30M130 75v30M150 75v30" stroke="#b39a68" stroke-width="4"/>') },
    ],
  },
};

export const countryOf = (code: string | null | undefined): CountryConfig => COUNTRIES[code ?? ""] ?? COUNTRIES.LK;
export const isCountry = (code: string) => code in COUNTRIES;

const SYMBOL: Record<string, string> = { LKR: "Rs ", GBP: "£", USD: "$", EUR: "€" };

/** Formats minor units (cents/pence) in the given currency, e.g. 1234500 LKR -> "Rs 12,345"; 1999 GBP -> "£19.99". */
export function formatMoney(minor: number, currency: string): string {
  const decimals = currency === "LKR" ? 0 : 2;
  const amount = (minor / 100).toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (SYMBOL[currency] ?? currency + " ") + amount;
}
export const moneyFmt = (currency: string) => (minor: number) => formatMoney(minor, currency);
