import { expect, test, type Page } from '@playwright/test';
import { payDemoDeposit, pickFirstSlot, SITES, uniqueEmail } from './helpers';

const S = SITES.studio;

// Smallest valid PNG (1×1), so the upload passes the server's content check.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

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
  test('home shows real sections and search suggests services', async ({ page }) => {
    await page.goto(S);
    await expect(page.getByRole('heading', { name: /Popular services/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Browse by category' })).toBeVisible();
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

  test('book from the service page panel and pay a simulated deposit', async ({ page }) => {
    await page.goto(`${S}/service/portrait-photography`);
    const panel = page.locator('#book');
    await expect(panel.getByText(/₹/).first()).toBeVisible();
    await pickFirstSlot(page);
    await panel.getByRole('link', { name: 'Continue to book' }).click();
    await expect(page).toHaveURL(/\/book\?.*step=2/);
    await page.getByLabel('Full name').fill('Studio Guest');
    await page.getByLabel('Email').fill(uniqueEmail('studio'));
    await page.getByRole('button', { name: 'Review booking' }).click();
    await page.getByLabel(/I have read the booking terms/).check();
    await page.getByRole('button', { name: 'Reserve and continue to payment' }).click();
    await expect(page).toHaveURL(/booking-status\?ref=PH-/);
    await payDemoDeposit(page);
    await page.getByRole('link', { name: 'View receipt' }).click();
    await expect(page.getByRole('heading', { name: 'Payment receipt' })).toBeVisible();
    await expect(page.getByText('This is not a tax invoice.', { exact: false })).toBeVisible();
  });

  test('quote-only services send a brief with an attachment, not a booking', async ({ page }) => {
    await page.goto(`${S}/service/brand-and-advertising-shoots`);
    await page.locator('#book').getByRole('link', { name: 'Request a quote' }).click();
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

    // Book a slot far enough ahead to be reschedulable.
    await page.goto(`${S}/service/audio-recording`);
    await page.getByRole('button', { name: 'Next month' }).click();
    await pickFirstSlot(page);
    await page.locator('#book').getByRole('link', { name: 'Continue to book' }).click();
    await page.getByRole('button', { name: 'Review booking' }).click();
    await page.getByLabel(/I have read the booking terms/).check();
    await page.getByRole('button', { name: 'Reserve and continue to payment' }).click();
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
