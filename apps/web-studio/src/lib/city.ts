import 'server-only';
import { cookies } from 'next/headers';

export const CITY_COOKIE = 'studio_city';

/** The visitor's chosen city (a browsing preference only; never used for authorisation). */
export async function getCity(): Promise<string | undefined> {
  const v = (await cookies()).get(CITY_COOKIE)?.value;
  return v && v.length <= 80 ? decodeURIComponent(v) : undefined;
}
