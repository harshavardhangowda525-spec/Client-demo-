import { expect, test } from '@playwright/test';
import { pickFirstSlot, fillGuestDetails, SITES, uniqueEmail } from './helpers';

test.describe('Event management website', () => {
  test('main pages load', async ({ page }) => {
    await page.goto(SITES.events);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Gatherings');
    for (const [path, heading] of [['/services', 'Event services'], ['/categories', 'Event categories'], ['/packages', 'Ways to work with us'], ['/gallery', 'Event gallery'], ['/venues', 'Locations & venues'], ['/faqs', 'Frequently asked questions'], ['/contact', 'Say hello']]) {
      await page.goto(SITES.events + path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    }
  });

  test('an enquiry is submitted and clearly is not a booking', async ({ page }) => {
    const d = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    await page.goto(`${SITES.events}/enquire?category=corporate`);
    await page.getByRole('button', { name: 'Send enquiry' }).click();
    await expect(page.getByText('Enter the expected number of guests').or(page.getByText('Use the format YYYY-MM-DD')).first()).toBeVisible();

    await page.getByLabel('Preferred date').fill(d);
    await page.getByLabel('Expected guests').fill('85');
    await page.getByRole('checkbox', { name: /Corporate event management/ }).check();
    await page.getByLabel('Minimum (₹)').fill('400000');
    await page.getByLabel('Maximum (₹)').fill('600000');
    await page.getByLabel('Set-up requirements').fill('Stage and projector');
    await page.getByLabel('Full name').fill('E2E Planner');
    await page.getByLabel('Email').fill(uniqueEmail('events'));
    await page.getByLabel(/I understand this is an enquiry/).check();
    await page.getByRole('button', { name: 'Send enquiry' }).click();
    await expect(page.getByText('This is not a booking yet.')).toBeVisible();
    await page.getByRole('link', { name: 'View enquiry status' }).click();
    await expect(page.getByText('Received. The team will review it shortly.')).toBeVisible();
  });

  test('a consultation can be booked directly', async ({ page }) => {
    await page.goto(`${SITES.events}/book`);
    await page.getByRole('radio', { name: /Event planning consultation/ }).check();
    await page.getByRole('button', { name: 'Continue to date & time' }).click();
    await pickFirstSlot(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await fillGuestDetails(page, uniqueEmail('consult'));
    await page.getByLabel(/I have read the booking terms/).check();
    await page.getByRole('button', { name: 'Reserve and continue to payment' }).click();
    await expect(page).toHaveURL(/booking-status\?ref=EV-/);
    await expect(page.locator('.badge', { hasText: 'Awaiting payment' })).toBeVisible();
  });
});
