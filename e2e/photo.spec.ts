import { expect, test } from '@playwright/test';
import { fillGuestDetails, payDemoDeposit, pickFirstSlot, SITES, uniqueEmail } from './helpers';

test.describe('Photography website', () => {
  test('main pages load and navigate', async ({ page }) => {
    await page.goto(SITES.photo);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Images with');
    for (const [link, heading] of [['Photography', 'Photography services'], ['Videography', 'Videography services'], ['Portfolio', 'Selected work'], ['Packages', 'Transparent pricing'], ['Studio', 'The studio'], ['About', 'A studio built around craft'], ['Contact', 'Tell us about your project']]) {
      await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: link, exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    }
  });

  test('portfolio filters and opens a project', async ({ page }) => {
    await page.goto(`${SITES.photo}/portfolio`);
    await page.getByRole('navigation', { name: 'Filter by category' }).getByRole('link', { name: 'Videography' }).click();
    await expect(page).toHaveURL(/category=videography/);
    await page.getByRole('heading', { name: 'Café promotional film' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Café promotional film');
    await expect(page.getByText(/not client work/)).toBeVisible();
  });

  test('guest books, pays a simulated deposit, and the booking is confirmed and persisted', async ({ page }) => {
    const email = uniqueEmail('photo');
    await page.goto(`${SITES.photo}/book`);
    await page.getByRole('radio', { name: /Product photography/ }).check();
    await expect(page.locator('.booking-summary')).toContainText('Total');
    await page.getByRole('button', { name: 'Continue to date & time' }).click();
    await pickFirstSlot(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await fillGuestDetails(page, email);
    await page.getByLabel(/I have read the booking terms/).check();
    await page.getByRole('button', { name: 'Reserve and continue to payment' }).click();

    await expect(page).toHaveURL(/booking-status\?ref=PH-/);
    await expect(page.getByText('Slot reserved')).toBeVisible();
    await expect(page.locator('.badge', { hasText: 'Awaiting payment' })).toBeVisible();
    await payDemoDeposit(page);

    // Data persists after refresh (token kept in this browser only).
    await page.reload();
    await expect(page.locator('.badge', { hasText: 'Confirmed' }).first()).toBeVisible();
    await expect(page.getByText('Simulated').first()).toBeVisible();
  });

  test('form validation blocks incomplete details', async ({ page }) => {
    await page.goto(`${SITES.photo}/book?service=portrait-photography`);
    await page.getByRole('button', { name: 'Continue to date & time' }).click();
    await pickFirstSlot(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: 'Review booking' }).click();
    await expect(page.getByText('Enter your full name')).toBeVisible();
    await expect(page.getByText('Enter a valid email address')).toBeVisible();
  });

  test('booking status lookup requires the matching email', async ({ page }) => {
    await page.goto(`${SITES.photo}/booking-status`);
    await page.getByLabel('Booking reference').fill('PH-00000000');
    await page.getByLabel('Email used for the booking').fill('nobody@test.example');
    await page.getByRole('button', { name: 'Check status' }).click();
    await expect(page.getByText('No booking matches that reference and email address.')).toBeVisible();
  });
});
