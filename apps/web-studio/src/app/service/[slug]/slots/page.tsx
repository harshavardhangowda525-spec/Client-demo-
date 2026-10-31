import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDuration, formatMoney } from '@studio/ui';
import { serverApi, type SearchParams } from '@studio/ui/server';
import { getCity } from '../../../../lib/city';
import type { StudioService } from '../../../../lib/types';

type Params = Promise<{ slug: string }>;
type Showtimes = {
  serviceId: string;
  bookingMode: string;
  packageId: string | null;
  durationMin: number | null;
  isDemoAvailability: boolean;
  days: { date: string; slots: number }[];
  date: string | null;
  locations: { id: string; name: string; addressLine1: string; city: string; isDemo: boolean; slots: { startTime: string; endTime: string }[] }[];
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const s = await serverApi<StudioService>(`/api/v1/studio/services/${encodeURIComponent(slug)}`, { allow404: true });
  return { title: s ? `${s.name}: choose a time` : 'Choose a time' };
}

function dayParts(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return {
    dow: d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }),
    day: d.getUTCDate(),
    month: d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }),
    long: d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }),
  };
}

export default async function Page({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const s = (await serverApi<StudioService>(`/api/v1/studio/services/${encodeURIComponent(slug)}`))!;
  if (s.bookingMode === 'ENQUIRY') {
    return (
      <section className="section">
        <div className="container stack" style={{ maxWidth: 640 }}>
          <h1>{s.name}</h1>
          <p>This service is priced by custom quotation, so there are no fixed times to pick. Send a brief and the team will reply with a quote.</p>
          <p><Link className="btn" href={`/enquire?service=${s.slug}`}>Request a quote</Link></p>
        </div>
      </section>
    );
  }

  const cookieCity = await getCity();
  const city = one(sp.city) ?? (cookieCity && s.cities.includes(cookieCity) ? cookieCity : '');
  const pkgParam = one(sp.package);
  const durParam = one(sp.duration);
  const qs = new URLSearchParams();
  if (one(sp.date)) qs.set('date', one(sp.date)!);
  if (pkgParam) qs.set('packageId', pkgParam);
  else if (durParam) qs.set('durationMin', durParam);
  if (city) qs.set('city', city);
  const st = (await serverApi<Showtimes>(`/api/v1/studio/services/${encodeURIComponent(slug)}/showtimes?${qs}`))!;
  const pkg = s.packages.find((p) => p.id === st.packageId) ?? null;
  const duration = st.durationMin ?? s.defaultDurationMin;
  const durations: number[] = [];
  if (!s.packages.length) for (let d = s.minDurationMin; d <= s.maxDurationMin; d += s.durationStepMin) durations.push(d);

  // Links keep every other choice and change one.
  const link = (over: Record<string, string | null>) => {
    const u = new URLSearchParams();
    const base: Record<string, string | null> = { date: st.date, package: pkg?.id ?? null, duration: pkg ? null : String(duration), city: city || null, ...over };
    for (const [k, v] of Object.entries(base)) if (v) u.set(k, v);
    return `/service/${s.slug}/slots?${u}`;
  };
  const checkout = (locationId: string, time: string) => {
    const u = new URLSearchParams({ service: s.slug, location: locationId, date: st.date!, time });
    if (pkg) u.set('package', pkg.id);
    else u.set('duration', String(duration));
    return `/checkout?${u}`;
  };
  const anySlots = st.locations.some((l) => l.slots.length);

  return (
    <>
      <div className="st-showhead">
        <div className="container">
          <h1>{s.name}</h1>
          <div className="st-tags" style={{ marginBottom: 'var(--space-3)' }}>
            {s.categories.map((c) => <span key={c.slug}>{c.name}</span>)}
            <span>{pkg ? `${pkg.name} · ${formatMoney(pkg.priceMinor)}` : formatDuration(duration)}</span>
          </div>
          {s.packages.length > 0 ? (
            <nav aria-label="Package" className="st-pills">
              {s.packages.map((p) => <Link key={p.id} className="st-pill" href={link({ package: p.id, duration: null })} aria-current={p.id === pkg?.id ? 'true' : undefined}>{p.name} · {formatDuration(p.durationMin)}</Link>)}
            </nav>
          ) : (
            <nav aria-label="Session length" className="st-pills">
              {durations.map((d) => <Link key={d} className="st-pill" href={link({ duration: String(d) })} aria-current={d === duration ? 'true' : undefined}>{formatDuration(d)}</Link>)}
            </nav>
          )}
          {s.cities.length > 1 && (
            <nav aria-label="City" className="st-pills" style={{ marginTop: 'var(--space-3)' }}>
              <Link className="st-pill" href={link({ city: null })} aria-current={!city ? 'true' : undefined}>All cities</Link>
              {s.cities.map((c) => <Link key={c} className="st-pill" href={link({ city: c })} aria-current={city === c ? 'true' : undefined}>{c}</Link>)}
            </nav>
          )}
        </div>
      </div>

      <div className="st-datebar">
        <div className="container cluster" style={{ justifyContent: 'space-between' }}>
          <nav aria-label="Date" className="st-dates">
            {st.days.map((d) => {
              const p = dayParts(d.date);
              const current = d.date === st.date;
              return (
                <Link key={d.date} href={link({ date: d.date })} className="st-date" aria-current={current ? 'date' : undefined} aria-disabled={d.slots === 0 ? 'true' : undefined} aria-label={`${p.long}${d.slots === 0 ? ', fully booked or closed' : ''}`} tabIndex={d.slots === 0 ? -1 : undefined}>
                  <small>{p.dow}</small><b>{p.day}</b><small>{p.month}</small>
                </Link>
              );
            })}
          </nav>
          <div className="st-legend" aria-hidden="true"><span><i style={{ background: 'var(--ok)' }} />Available</span><span><i style={{ background: '#c4c4c4' }} />Unavailable</span></div>
        </div>
      </div>

      <section className="container" aria-label="Studios and times" style={{ paddingBlock: 'var(--space-4)' }}>
        {st.isDemoAvailability && <p className="badge badge--demo" style={{ marginBottom: 'var(--space-3)' }}>Demonstration availability</p>}
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {st.locations.map((l) => (
            <div key={l.id} className="st-venue">
              <div>
                <h2>{l.name}</h2>
                <p>{l.addressLine1}, {l.city}{l.isDemo ? ' · demonstration address' : ''}</p>
              </div>
              {l.slots.length ? (
                <div className="st-times">
                  {l.slots.map((t) => (
                    <Link key={t.startTime} className="st-time" href={checkout(l.id, t.startTime)} aria-label={`${t.startTime} to ${t.endTime} at ${l.name}`}>
                      <span>{t.startTime}</span><small>until {t.endTime}</small>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="small muted" style={{ margin: 0, alignSelf: 'center' }}>No free times on this day.</p>
              )}
            </div>
          ))}
          {st.locations.length === 0 && <div className="st-venue"><p style={{ margin: 0 }}>This service isn&rsquo;t offered in {city || 'this city'}. <Link href={link({ city: null })}>Show all cities</Link>.</p></div>}
        </div>
        {!anySlots && st.locations.length > 0 && <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>Pick another date above; greyed-out days are fully booked or closed.</p>}
        <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>Times are local to each studio. A time is reserved for you only once you continue to payment.</p>
      </section>
    </>
  );
}
