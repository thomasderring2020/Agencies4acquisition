// US state reference data: abbreviation, full name, FIPS code, and map region.
export type Region = "West" | "Southwest" | "Midwest" | "Southeast" | "Northeast";

export const STATES: { abbr: string; name: string; fips: string; region: Region }[] = [
  { abbr: "AL", name: "Alabama", fips: "01", region: "Southeast" },
  { abbr: "AK", name: "Alaska", fips: "02", region: "West" },
  { abbr: "AZ", name: "Arizona", fips: "04", region: "Southwest" },
  { abbr: "AR", name: "Arkansas", fips: "05", region: "Southeast" },
  { abbr: "CA", name: "California", fips: "06", region: "West" },
  { abbr: "CO", name: "Colorado", fips: "08", region: "West" },
  { abbr: "CT", name: "Connecticut", fips: "09", region: "Northeast" },
  { abbr: "DE", name: "Delaware", fips: "10", region: "Northeast" },
  { abbr: "DC", name: "District of Columbia", fips: "11", region: "Northeast" },
  { abbr: "FL", name: "Florida", fips: "12", region: "Southeast" },
  { abbr: "GA", name: "Georgia", fips: "13", region: "Southeast" },
  { abbr: "HI", name: "Hawaii", fips: "15", region: "West" },
  { abbr: "ID", name: "Idaho", fips: "16", region: "West" },
  { abbr: "IL", name: "Illinois", fips: "17", region: "Midwest" },
  { abbr: "IN", name: "Indiana", fips: "18", region: "Midwest" },
  { abbr: "IA", name: "Iowa", fips: "19", region: "Midwest" },
  { abbr: "KS", name: "Kansas", fips: "20", region: "Midwest" },
  { abbr: "KY", name: "Kentucky", fips: "21", region: "Southeast" },
  { abbr: "LA", name: "Louisiana", fips: "22", region: "Southeast" },
  { abbr: "ME", name: "Maine", fips: "23", region: "Northeast" },
  { abbr: "MD", name: "Maryland", fips: "24", region: "Northeast" },
  { abbr: "MA", name: "Massachusetts", fips: "25", region: "Northeast" },
  { abbr: "MI", name: "Michigan", fips: "26", region: "Midwest" },
  { abbr: "MN", name: "Minnesota", fips: "27", region: "Midwest" },
  { abbr: "MS", name: "Mississippi", fips: "28", region: "Southeast" },
  { abbr: "MO", name: "Missouri", fips: "29", region: "Midwest" },
  { abbr: "MT", name: "Montana", fips: "30", region: "West" },
  { abbr: "NE", name: "Nebraska", fips: "31", region: "Midwest" },
  { abbr: "NV", name: "Nevada", fips: "32", region: "West" },
  { abbr: "NH", name: "New Hampshire", fips: "33", region: "Northeast" },
  { abbr: "NJ", name: "New Jersey", fips: "34", region: "Northeast" },
  { abbr: "NM", name: "New Mexico", fips: "35", region: "Southwest" },
  { abbr: "NY", name: "New York", fips: "36", region: "Northeast" },
  { abbr: "NC", name: "North Carolina", fips: "37", region: "Southeast" },
  { abbr: "ND", name: "North Dakota", fips: "38", region: "Midwest" },
  { abbr: "OH", name: "Ohio", fips: "39", region: "Midwest" },
  { abbr: "OK", name: "Oklahoma", fips: "40", region: "Southwest" },
  { abbr: "OR", name: "Oregon", fips: "41", region: "West" },
  { abbr: "PA", name: "Pennsylvania", fips: "42", region: "Northeast" },
  { abbr: "RI", name: "Rhode Island", fips: "44", region: "Northeast" },
  { abbr: "SC", name: "South Carolina", fips: "45", region: "Southeast" },
  { abbr: "SD", name: "South Dakota", fips: "46", region: "Midwest" },
  { abbr: "TN", name: "Tennessee", fips: "47", region: "Southeast" },
  { abbr: "TX", name: "Texas", fips: "48", region: "Southwest" },
  { abbr: "UT", name: "Utah", fips: "49", region: "West" },
  { abbr: "VT", name: "Vermont", fips: "50", region: "Northeast" },
  { abbr: "VA", name: "Virginia", fips: "51", region: "Southeast" },
  { abbr: "WA", name: "Washington", fips: "53", region: "West" },
  { abbr: "WV", name: "West Virginia", fips: "54", region: "Southeast" },
  { abbr: "WI", name: "Wisconsin", fips: "55", region: "Midwest" },
  { abbr: "WY", name: "Wyoming", fips: "56", region: "West" },
];

export const REGIONS: Region[] = ["West", "Southwest", "Midwest", "Southeast", "Northeast"];

export const ABBRS = new Set(STATES.map((s) => s.abbr));
export const byAbbr = Object.fromEntries(STATES.map((s) => [s.abbr, s]));
export const byFips = Object.fromEntries(STATES.map((s) => [s.fips, s]));
export const nameToAbbr = Object.fromEntries(STATES.map((s) => [s.name.toLowerCase(), s.abbr]));

/** Pull state abbreviations out of free text that names states ("California, Washington, Oregon and Arizona"). */
export function statesNamedIn(text: string): string[] {
  let lower = text.toLowerCase();
  const found: string[] = [];
  // Longer names first, and consume each match, so "West Virginia" doesn't also count as "Virginia".
  for (const s of [...STATES].sort((a, b) => b.name.length - a.name.length)) {
    const re = new RegExp(`\\b${s.name.toLowerCase()}\\b`, "g");
    if (re.test(lower)) {
      found.push(s.abbr);
      lower = lower.replace(re, " ");
    }
  }
  return found;
}
