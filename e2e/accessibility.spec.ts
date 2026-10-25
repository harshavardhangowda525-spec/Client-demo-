import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { SITES } from './helpers';

// Automated WCAG 2.1 A/AA checks. Automated scans catch a subset of issues;
// manual keyboard and screen-reader review is still recommended before launch.
const PAGES: [string, string][] = [
  [SITES.photo, '/'], [SITES.photo, '/book'], [SITES.photo, '/portfolio'], [SITES.photo, '/booking-status'],
  [SITES.podcast, '/'], [SITES.podcast, '/availability'], [SITES.podcast, '/facilities'],
  [SITES.events, '/'], [SITES.events, '/enquire'], [SITES.events, '/packages'],
  [SITES.studio, '/'], [SITES.studio, '/services/photography'], [SITES.studio, '/service/video-podcast-recording'], [SITES.studio, '/search?q=studio'],
  [SITES.studio, '/enquire'], [SITES.studio, '/portfolio'], [SITES.studio, '/studio'], [SITES.studio, '/packages'], [SITES.studio, '/account'],
  [SITES.admin, '/'],
];

for (const [base, path] of PAGES) {
  test(`no serious accessibility violations: ${base}${path}`, async ({ page }) => {
    // Reduced motion renders scroll-reveal content fully opaque, so contrast is measured on final colours.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(base + path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
  });
}

test('booking flow is keyboard operable to the first step', async ({ page }) => {
  await page.goto(`${SITES.photo}/book`);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.getByRole('radio', { name: /Portrait photography/ }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('radio', { name: /Portrait photography/ })).toBeChecked();
});
