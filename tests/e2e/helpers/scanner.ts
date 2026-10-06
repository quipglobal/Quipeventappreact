import { expect, type Page } from '@playwright/test';

export async function openManualScanner(page: Page) {
  const heading = page.getByRole('heading', { name: 'Scan Badge', exact: true });
  await expect(heading).toBeVisible({ timeout: 8_000 });
  // Use the top QR/manual toggle; the bottom hint overlaps the bottom nav.
  await heading.locator('..').getByRole('button').last().click({ timeout: 8_000 });
  await expect(page.getByPlaceholder(/ATT-/i)).toBeVisible({ timeout: 5_000 });
}

// The global header uses theme styles, not the former text-violet-400 class.
// Exclude the closed side-menu copy of the same points label.
export function scannerPointsBadge(page: Page) {
  return page.getByText(/^\d+ pts$/).filter({ visible: true }).first();
}
