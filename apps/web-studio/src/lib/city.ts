import 'server-only';
import { cookies } from 'next/headers';

export const CITY_COOKIE = 'studio_city';

/** The visitor's chosen city (a browsing preference only; never used for authorisation). */
export async function getCity(): Promise<string | undefined> {
  const v = (await cookies()).get(CITY_COOKIE)?.value;
  return v && v.length <= 80 ? decodeURIComponent(v) : undefined;
}

/** Set once the visitor has picked a city (or "all cities"), so the first-visit pop-up shows only once. */
export const CITY_CHOSEN_COOKIE = 'studio_city_chosen';

export async function hasChosenCity(): Promise<boolean> {
  return (await cookies()).get(CITY_CHOSEN_COOKIE)?.value === '1';
}
