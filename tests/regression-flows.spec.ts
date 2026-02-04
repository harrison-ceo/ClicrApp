import { test, expect } from '@playwright/test';

test.describe('P0 Regression Tests', () => {

    test('Dashboard loads and displays traffic stats', async ({ page }) => {
        // Navigate to Dashboard
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/.*dashboard/);

        // Check for Traffic In/Out labels
        await expect(page.locator('text=In')).toBeVisible();
        await expect(page.locator('text=Out')).toBeVisible();

        // Ensure stats are numeric (not loading state forever)
        // Note: This relies on seeded data or live state
        const inCount = page.locator('.text-emerald-400').first();
        await expect(inCount).toBeVisible();
        await expect(inCount).not.toHaveText('...');
    });

    test('Areas Tab displays live occupancy', async ({ page }) => {
        // Go to first venue details
        await page.goto('/venues');
        await page.click('text=Manage >> nth=0'); // Click first manage button

        // Switch to Areas tab
        await page.click('text=Areas');

        // Check for Occupancy Bar
        // We look for text like "0 / 100" or similar
        const capacityText = page.locator('text=/ \\d+/').first(); // Regex for "/ Number"
        await expect(capacityText).toBeVisible();
    });

    test('Clicrs Tab handles occupancy correctly', async ({ page }) => {
        await page.goto('/clicr'); // Clicrs list

        // Check for card existing
        await expect(page.locator('text=Open')).first().toBeVisible();

        // Check that occupancy is displayed (large font)
        const occupancyDisplay = page.locator('.font-mono.text-3xl').first();
        await expect(occupancyDisplay).toBeVisible();
        // Should be a number
        const text = await occupancyDisplay.innerText();
        expect(Number(text)).not.toBeNaN();
    });

    test('Individual Clicr Screen Stress Test (No Glitch)', async ({ page }) => {
        // Navigate to a specific clicr (mock ID or select from list)
        await page.goto('/clicr');
        await page.click('.glass-card >> nth=0');

        // Wait for load
        await expect(page.locator('button', { hasText: '+' })).toBeVisible();

        // Rapid fire clicks
        await page.click('button:has-text("+")');
        await page.click('button:has-text("+")');
        await page.click('button:has-text("-")');

        // Assert NO "Device Not Found" error
        await expect(page.locator('text=Device Not Found')).not.toBeVisible();

        // Assert Syncing spinner might appear appropriately but not block permanently
        // (Optional check)
    });

});
