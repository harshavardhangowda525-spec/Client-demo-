import { expect, test, type Page } from '@playwright/test';
import { payDemoDeposit, SITES, uniqueEmail } from './helpers';

const S = SITES.studio;

// Smallest valid PNG (1×1), so the upload passes the server's content check.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

/** A weekday about `offset` days ahead (YYYY-MM-DD), so lead-time and weekend rules don't interfere. */
function weekday(offset: number) {
  const d = new Date(Date.now() + offset * 86_400_000);
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Showtimes page → first free time → booking summary → reserve. Returns once on the booking page. */
async function bookViaShowtimes(page: Page, slug: string, date: string, opts: { email?: string; coupon?: string } = {}) {
  await page.goto(`${S}/service/${slug}/slots?date=${date}`);
  await page.locator('.st-time').first().click();
  await expect(page).toHaveURL(/\/checkout\?/);
  await expect(page.getByText('Amount payable')).toBeVisible();
  await expect(page.locator('.st-summary__total')).toContainText('₹');
  if (opts.coupon) {
    await page.getByLabel('Coupon code').fill(opts.coupon);
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page.getByText(`Offer ${opts.coupon}`)).toBeVisible();
  }
  if (opts.email !== undefined) {
    await page.getByLabel('Full name').fill('Studio Guest');
    await page.getByLabel('Email').fill(opts.email);
  }
  await page.getByLabel(/booking terms/).check();
  await page.getByRole('button', { name: /Proceed to pay|Send booking request/ }).click();
  await expect(page).toHaveURL(/booking-status\?ref=/);
}

async function register(page: Page, email: string) {
  await page.goto(`${S}/account`);
  await page.getByRole('tab', { name: /Create account/i }).click();
  await page.getByLabel('Full name').fill('Studio Tester');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('StudioTester!2026');
  await page.getByRole('button', { name: /Create account/i }).last().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Hello, Studio/);
}

test.describe('Infinity Studios platform', () => {
  // The city pop-up opens on a first visit; most tests start as a returning visitor.
  test.beforeEach(async ({ context }, info) => {
    if (!info.title.includes('pop-up')) await context.addCookies([{ name: 'studio_city_chosen', value: '1', url: S }]);
  });

  test('first visit asks for a city with a pop-up, then remembers it', async ({ page }) => {
    await page.goto(S);
    const dialog = page.getByRole('dialog', { name: 'Select your city' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Bengaluru' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Recommended services in Bengaluru' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Select your city' })).toBeHidden();
  });

  test('home shows real sections and search suggests services', async ({ page }) => {
    await page.goto(S);
    await expect(page.getByRole('heading', { name: /Recommended services/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Explore by category' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Offers for you' })).toBeVisible();
    // No testimonials are seeded, so the section must not render.
    await expect(page.getByRole('heading', { name: 'What clients say' })).toHaveCount(0);
    const search = page.getByRole('combobox', { name: 'Search services' }).first();
    await search.fill('podcast');
    await page.getByRole('option', { name: /Video podcast recording/ }).click();
    await expect(page).toHaveURL(/\/service\/video-podcast-recording/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Video podcast recording');
  });

  test('category listing filters, sorts and keeps state in the URL', async ({ page }) => {
    await page.goto(`${S}/services/podcasting`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Podcast Studio');
    const count = async () => Number((await page.locator('.st-toolbar strong').textContent()) ?? 0);
    const all = await count();
    await page.getByLabel('Booking type').selectOption('hourly');
    await expect(page).toHaveURL(/type=hourly/);
    await expect(page.getByLabel('Booking type')).toHaveValue('hourly');
    expect(await count()).toBeLessThanOrEqual(all);
    await page.getByLabel('Sort by').selectOption('price_asc');
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(page).toHaveURL(/type=hourly/);
    await page.getByRole('link', { name: 'Clear filters' }).first().click();
    await expect(page).not.toHaveURL(/type=/);
    await expect(page.locator('.st-toolbar strong')).toHaveText(String(all));
  });

  test('service page → showtimes → booking summary with coupon → pay → e-ticket', async ({ page }) => {
    await page.goto(`${S}/service/portrait-photography`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Portrait photography');
    await expect(page.getByText('No reviews yet.', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Book', exact: true }).first().click();
    await expect(page).toHaveURL(/\/service\/portrait-photography\/slots/);
    await expect(page.getByRole('navigation', { name: 'Date' })).toBeVisible();
    await bookViaShowtimes(page, 'portrait-photography', weekday(9), { email: uniqueEmail('studio'), coupon: 'DEMO10' });
    await expect(page).toHaveURL(/ref=PH-/);
    await expect(page.getByRole('timer')).toContainText(/Complete payment in \d\d:\d\d/);
    await payDemoDeposit(page);
    await page.getByRole('link', { name: 'View e-ticket' }).click();
    await expect(page.getByRole('img', { name: /QR code for ticket PH-/ })).toBeVisible();
    await expect(page.locator('.st-ticket__code')).toHaveText(/^PH-[0-9A-Z]{8}\.[A-Z0-9]{10}$/);
    await page.getByRole('link', { name: 'Booking details' }).click();
    await page.getByRole('link', { name: 'View receipt' }).click();
    await expect(page.getByRole('heading', { name: 'Payment receipt' })).toBeVisible();
    await expect(page.getByText('Offer DEMO10')).toBeVisible();
  });

  test('offers page lists coupon codes; events are part of the unified site', async ({ page }) => {
    await page.goto(`${S}/offers`);
    await expect(page.locator('.st-offer__code', { hasText: 'DEMO10' })).toBeVisible();
    await page.goto(`${S}/services/events`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Events');
    await expect(page.getByRole('heading', { name: 'Corporate event management' })).toBeVisible();
  });

  test('quote-only services send a brief with an attachment, not a booking', async ({ page }) => {
    await page.goto(`${S}/service/brand-and-advertising-shoots`);
    await page.getByRole('link', { name: 'Request a quote' }).first().click();
    await expect(page).toHaveURL(/\/enquire\?service=brand-and-advertising-shoots/);
    await expect(page.getByRole('button', { name: 'Brand & advertising shoots' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('Project type').fill('Festive campaign stills');
    const d = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel('Preferred date').fill(d);
    await page.getByLabel('People on camera / in session').fill('4');
    await page.getByLabel('Project brief').fill('Twelve hero images for a festive launch.');
    await page.getByLabel('Reference files (optional)').setInputFiles({ name: 'moodboard.png', mimeType: 'image/png', buffer: PNG });
    await page.getByLabel('Full name').fill('Brief Sender');
    await page.getByLabel('Email').fill(uniqueEmail('brief'));
    await page.getByLabel(/privacy policy/).check();
    await page.getByRole('button', { name: 'Send brief' }).click();
    await expect(page.getByText('This is not a booking yet.')).toBeVisible();
    await expect(page.getByText('moodboard.png: uploaded')).toBeVisible();
    await expect(page.getByText(/EQ-[0-9A-Z]{8}/)).toBeVisible();
  });

  test('signed-in customer saves a service, sets preferences and requests a reschedule', async ({ page }) => {
    await register(page, uniqueEmail('acct'));

    // Save from a listing card, then find it in the account.
    await page.goto(`${S}/services/photography`);
    await page.getByRole('button', { name: 'Save Portrait photography' }).first().click();
    await expect(page.getByRole('button', { name: 'Remove Portrait photography from saved' }).first()).toBeVisible();

    await page.goto(`${S}/account`);
    await expect(page.getByRole('region', { name: 'Saved services' }).or(page.locator('section[aria-labelledby="saved-title"]'))).toContainText('Portrait photography');
    await page.getByLabel('WhatsApp reminders and updates').check();
    await page.getByRole('button', { name: 'Save preferences' }).click();
    await expect(page.getByText('Please confirm you agree to receive WhatsApp messages.')).toBeVisible();
    await page.getByLabel(/I agree to receive WhatsApp messages/).check();
    await page.getByRole('button', { name: 'Save preferences' }).click();
    await expect(page.getByText('Preferences saved.')).toBeVisible();

    // Book a slot far enough ahead to be reschedulable (signed in, so details are prefilled).
    await bookViaShowtimes(page, 'audio-recording', weekday(20));
    await expect(page).toHaveURL(/booking-status\?ref=PC-/);

    // Pick a real alternative slot from the live availability API.
    const svc = await (await page.request.get(`${S}/api/v1/studio/services/audio-recording`)).json();
    const booked = new URL(page.url()).searchParams.get('ref');
    const start = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
    const qs = new URLSearchParams({ serviceId: svc.id, locationId: svc.locationIds[0], date: start, days: '14', durationMin: String(svc.defaultDurationMin) });
    const avail = await (await page.request.get(`${S}/api/v1/availability?${qs}`)).json();
    const day = avail.days.find((x: { slots: unknown[] }) => x.slots.length);
    expect(day, 'an alternative slot exists').toBeTruthy();

    await page.getByRole('button', { name: 'Request a new time' }).click();
    await page.getByLabel('New date').fill(day.date);
    await page.getByLabel(/Start time/).fill(day.slots[0].startTime);
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByText(/Request sent/)).toBeVisible();
    expect(booked).toMatch(/^PC-/);
  });
});
