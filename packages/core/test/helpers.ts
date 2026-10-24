import { prisma } from '@studio/db';
import { seedDemo } from '../src/seed/run';
import { loadActor, type Actor } from '../src/actor';
import { addDays, formatLocalDate, localDayOfWeek, todayIn, type LocalDate } from '../src/time';

export async function resetDatabase() {
  await seedDemo({ force: true, withSampleActivity: false });
}

export async function ids() {
  const svc = async (slug: string) => (await prisma.service.findFirstOrThrow({ where: { slug } })).id;
  const loc = async (slug: string) => (await prisma.location.findUniqueOrThrow({ where: { slug } })).id;
  return {
    portrait: await svc('portrait-photography'),
    product: await svc('product-photography'),
    multicam: await svc('multi-camera-sessions'),
    audio: await svc('audio-recording'),
    consultation: await svc('planning-consultation'),
    corporateEvents: await svc('corporate-event-management'),
    corporateVideo: await svc('corporate-video'),
    blr: await loc('bengaluru-studio-demo'),
    bom: await loc('mumbai-studio-demo'),
    lounge: await loc('planning-lounge-demo'),
    garden: await loc('garden-venue-demo'),
  };
}

export async function actor(email: string): Promise<Actor> {
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  return (await loadActor(u.id))!;
}

/** A Monday–Friday date `offset`+ days ahead in IST, as YYYY-MM-DD. */
export function futureWeekday(offset = 10): string {
  let d: LocalDate = addDays(todayIn('Asia/Kolkata'), offset);
  while ([0, 6].includes(localDayOfWeek(d, 'Asia/Kolkata'))) d = addDays(d, 1);
  return formatLocalDate(d);
}

export const guest = (email = 'guest@test.example') => ({ name: 'Test Guest', email });
