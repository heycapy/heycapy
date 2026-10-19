import { getCountriesForTimezone, getTimezone } from "countries-and-timezones";
import { SHORT_COUNTRY_NAMES, UNSET_TIMEZONE } from "./constants";

// "India" for a country on one clock, "New York" for a country on several, null when not set
export function placeName(timezone: string): string | null {
  if (timezone === UNSET_TIMEZONE) return null;
  const zone = getTimezone(timezone);
  const name = zone?.aliasOf ?? timezone;
  const [country] = getCountriesForTimezone(name);
  if (country?.timezones.length === 1) return SHORT_COUNTRY_NAMES[country.id] ?? country.name;
  return (name.split("/").pop() ?? name).replaceAll("_", " ");
}
