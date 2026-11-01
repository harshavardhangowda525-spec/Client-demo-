import 'server-only';
import { serverApi } from '@studio/ui/server';

export interface MembershipPlan {
  id: string;
  key: string;
  name: string;
  tagline: string | null;
  priceMinor: number;
  periodDays: number;
  bookingDiscountBps: number;
  perks: string[];
  isFeatured: boolean;
  isSample: boolean;
}

export interface MembershipSummary {
  id: string;
  plan: MembershipPlan;
  startsAt: string;
  endsAt: string;
  bookingDiscountBps: number;
  isSimulated: boolean;
}

/** The visitor's active membership (null for guests, staff and non-members). De-duplicated per render. */
export async function getMembership(): Promise<MembershipSummary | null> {
  const r = await serverApi<{ membership: MembershipSummary | null }>('/api/v1/me/membership', { auth: true });
  return r?.membership ?? null;
}

export async function getPlans(): Promise<MembershipPlan[]> {
  return (await serverApi<MembershipPlan[]>('/api/v1/membership/plans')) ?? [];
}

/** Member price for a list price, rounded the same way as the server's pricing. */
export function memberPrice(minor: number, bps: number): number {
  return minor - Math.round((minor * bps) / 10_000);
}
