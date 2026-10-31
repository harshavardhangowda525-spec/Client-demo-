import { expect, test } from '@playwright/test';
import { SITES, fillGuestDetails, payDemoDeposit, pickFirstDay, uniqueEmail } from './helpers';

test.describe('Podcast studio website', () => {
  test('main pages load', async ({ page }) => {
    await page.goto(SITES.podcast);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Record the conversation');
    for (const [path, heading] of [['/studios', 'Studio overview'], ['/facilities', 'Facilities & equipment'], ['/services', 'Recording services'], ['/packages', 'Transparent pricing'], ['/locations', 'Studio locations'], ['/gallery', 'Inside the studio'], ['/faqs', 'Frequently asked questions']]) {
      await page.goto(SITES.podcast + path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    }
    // No invented equipment specifications.
    await page.goto(SITES.podcast + '/facilities');
    await expect(page.getByText('Awaiting verified details from the studio').first()).toBeVisible();
  });

  test('availability calendar deep-links into booking; slot is then no longer offered', async ({ page }) => {
    await page.goto(`${SITES.podcast}/availability`);
    await page.getByLabel('Session type').selectOption({ label: 'Studio rental' });
    await pickFirstDay(page);
    const slot = page.locator('a.slot').first();
    const time = (await slot.textContent())!.trim();
    await slot.click();

    await expect(page).toHaveURL(/\/book\?service=studio-rental/);
    await expect(page.getByRole('radio', { name: /Studio rental/ })).toBeChecked();
    await page.getByRole('button', { name: 'Continue to date & time' }).click();
    await expect(page.getByRole('button', { name: new RegExp(`^${time} to`) })).toHaveAttribute('aria-pressed', 'true');
    const url = new URL(page.url());
    await page.getByRole('button', { name: 'Continue' }).click();
    await fillGuestDetails(page, uniqueEmail('podcast'));
    await page.getByLabel(/I have read the booking terms/).check();
    await page.getByRole('button', { name: 'Reserve and continue to payment' }).click();
    await expect(page).toHaveURL(/booking-status\?ref=PC-/);
    await payDemoDeposit(page);

    // The same start time is no longer offered on that day at that studio.
    await page.goto(`${SITES.podcast}/book?service=studio-rental&location=${url.searchParams.get('location')}&date=${url.searchParams.get('date')}`);
    await page.getByRole('button', { name: 'Continue to date & time' }).click();
    await page.waitForFunction(() => !document.querySelector('.calendar[aria-busy="true"]'));
    await expect(page.getByRole('button', { name: new RegExp(`^${time} to`) })).toHaveCount(0);
  });
});
