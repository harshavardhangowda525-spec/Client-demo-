import { expect, type Page } from '@playwright/test';

export const SITES = {
  photo: process.env.SITE_URL_PHOTO ?? 'http://localhost:3001',
  podcast: process.env.SITE_URL_PODCAST ?? 'http://localhost:3002',
  events: process.env.SITE_URL_EVENTS ?? 'http://localhost:3003',
  studio: process.env.SITE_URL_STUDIO ?? 'http://localhost:3004',
  admin: process.env.SITE_URL_ADMIN ?? 'http://localhost:3100',
};

export const uniqueEmail = (tag: string) => `e2e-${tag}-${Date.now()}@test.example`;

/**
 * Click the first available day, moving to the next month when the current one
 * has none left (e.g. near the end of a month, after the booking lead time).
 */
export async function pickFirstDay(page: Page) {
  for (let i = 0; i < 3; i++) {
    const day = page.locator('.calendar__day[data-available="true"]').first();
    await page.waitForFunction(() => !document.querySelector('.calendar[aria-busy="true"]'));
    if (await day.count()) {
      await day.click();
      return;
    }
    await page.getByRole('button', { name: 'Next month' }).click();
  }
  throw new Error('No availability found in the next three months');
}

/** Pick the first available day and its first slot. */
export async function pickFirstSlot(page: Page) {
  await pickFirstDay(page);
  await page.locator('.slot').first().click();
}

export async function fillGuestDetails(page: Page, email: string) {
  await page.getByLabel('Full name').fill('E2E Guest');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Review booking' }).click();
}

export async function payDemoDeposit(page: Page) {
  await expect(page.getByText('Demo payment mode')).toBeVisible();
  await page.getByRole('button', { name: /^Pay deposit/ }).click();
  await page.getByRole('button', { name: 'Simulate successful payment' }).click();
  await expect(page.getByText('Simulated payment recorded. No money was taken.')).toBeVisible();
  await expect(page.locator('.badge', { hasText: 'Confirmed' }).first()).toBeVisible();
}
