import { expect, test, type Page } from '@playwright/test';
import { SITES, uniqueEmail } from './helpers';

// Sign in once per account and reuse the session: the auth endpoints are
// rate limited (8 sign-ins per minute per IP), which repeated runs would trip.
const sessions = new Map<string, Awaited<ReturnType<Page['context']>['storageState']> extends Promise<infer T> ? T : never>();

async function signIn(page: Page, email: string, password: string) {
  const saved = sessions.get(email);
  if (saved) {
    await page.context().clearCookies();
    await page.context().addCookies(saved.cookies);
    await page.goto(SITES.admin);
    return;
  }
  await page.goto(SITES.admin);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Studio admin' })).toHaveCount(0);
  sessions.set(email, await page.context().storageState());
}

test.describe('Admin panel', () => {
  test('customers are refused; staff see a restricted menu', async ({ page }) => {
    await signIn(page, 'customer@demo.example', 'DemoCustomer!2026');
    await expect(page.getByRole('heading', { name: 'Not authorised' })).toBeVisible();
    await page.context().clearCookies();
    await signIn(page, 'staff@demo.example', 'DemoStaff!2026');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    const nav = page.getByRole('navigation').first();
    await expect(nav.getByRole('link', { name: 'Bookings' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Audit log' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Staff & roles' })).toHaveCount(0);
  });

  test('a website request is approved by staff, and the admin sees the same record', async ({ page, browser }) => {
    // Customer submits a request-mode booking on the photography site.
    const site = await browser.newPage();
    const email = uniqueEmail('request');
    await site.goto(`${SITES.photo}/book?service=corporate-video`);
    await site.getByRole('button', { name: 'Continue to date & time' }).click();
    await site.waitForFunction(() => !document.querySelector('.calendar[aria-busy="true"]'));
    await site.locator('.calendar__day[data-available="true"]').first().click();
    await site.locator('.slot').first().click();
    await site.getByRole('button', { name: 'Continue' }).click();
    await site.getByLabel('Full name').fill('Request Customer');
    await site.getByLabel('Email').fill(email);
    await site.getByRole('button', { name: 'Review booking' }).click();
    await site.getByLabel(/I have read the booking terms/).check();
    await site.getByRole('button', { name: 'Submit request' }).click();
    await expect(site).toHaveURL(/ref=PH-/);
    const ref = new URL(site.url()).searchParams.get('ref')!;
    await expect(site.locator('.badge', { hasText: 'Request submitted' })).toBeVisible();

    await signIn(page, 'admin@demo.example', 'DemoAdmin!2026');
    await page.getByRole('navigation').first().getByRole('link', { name: 'Bookings' }).click();
    await page.getByLabel('Search').fill(ref);
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('link', { name: ref }).click();
    await expect(page.getByRole('heading', { name: ref })).toBeVisible();
    await page.getByRole('button', { name: 'Approve and request payment' }).click();
    await expect(page.getByText('Status changed to Awaiting payment.')).toBeVisible();
    await page.getByLabel(/Reason \/ note/).fill('Confirmed scope on a call');
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByText('Status changed to Confirmed.')).toBeVisible();

    // The customer sees the updated status after refresh.
    await site.reload();
    await expect(site.locator('.badge', { hasText: 'Confirmed' }).first()).toBeVisible();

    // The change is in the audit log.
    await page.getByRole('navigation').first().getByRole('link', { name: 'Audit log' }).click();
    await expect(page.getByText(`${ref}: AWAITING_PAYMENT → CONFIRMED`)).toBeVisible();
  });

  test('admin records acceptance of the seeded quotation and converts it into a booking', async ({ page }) => {
    await signIn(page, 'admin@demo.example', 'DemoAdmin!2026');
    await page.getByRole('navigation').first().getByRole('link', { name: 'Enquiries & briefs' }).click();
    await page.getByLabel('Status').selectOption('QUOTED');
    await page.getByRole('button', { name: 'Search' }).click();
    const first = page.locator('table a.mono').first();
    if (!(await first.count())) test.skip(true, 'No quoted enquiry left (demo data already converted). Run pnpm db:seed to reset.');
    await first.click();
    await page.getByLabel('Note', { exact: true }).fill('Accepted by phone (e2e)');
    await page.getByRole('button', { name: 'Record acceptance' }).click();
    await expect(page.getByText('Acceptance recorded.')).toBeVisible();
    await page.getByLabel('Venue').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Create booking' }).click();
    await expect(page.getByText('Booking created from the quotation.')).toBeVisible();
    await expect(page.locator('.badge', { hasText: /Booking EV-/ })).toBeVisible();
  });

  test('integrations never claim to be connected without credentials', async ({ page }) => {
    await signIn(page, 'admin@demo.example', 'DemoAdmin!2026');
    await page.getByRole('navigation').first().getByRole('link', { name: 'Integrations' }).click();
    await expect(page.getByText('Connected and verified')).toHaveCount(0);
    await expect(page.getByRole('row', { name: /Razorpay payments/ })).toContainText(/Not configured|Awaiting credentials/);
  });

  test('studio site content: unauthorised testimonials cannot be published; templates reject unknown placeholders', async ({ page }) => {
    await signIn(page, 'admin@demo.example', 'DemoAdmin!2026');
    await page.getByRole('navigation').first().getByRole('link', { name: 'Studio site' }).click();
    await expect(page.getByRole('heading', { name: 'Studio site' })).toBeVisible();
    await page.getByRole('tab', { name: 'Equipment & facilities' }).click();
    await expect(page.getByText('Awaiting verification').first()).toBeVisible();
    await page.getByRole('tab', { name: 'Testimonials' }).click();
    await page.getByRole('button', { name: 'Add new' }).click();
    await page.getByLabel('Quote').fill('A quote added only to test the publishing rule.');
    await page.getByLabel('Client name').fill('E2E Client');
    await page.getByLabel('Published').check();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('only be published once the customer has authorised it');

    await page.getByRole('navigation').first().getByRole('link', { name: 'Notifications' }).click();
    await page.getByRole('tab', { name: 'Templates' }).click();
    const first = page.locator('section.panel').first();
    await first.getByRole('button', { name: 'Edit' }).click();
    await first.getByLabel('Subject').fill('Hello {{notAVariable}}');
    await first.getByRole('button', { name: 'Save template' }).click();
    await expect(page.getByRole('status')).toContainText('Unknown placeholder');
  });
});
