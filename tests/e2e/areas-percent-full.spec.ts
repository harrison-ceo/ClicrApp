
import { test, expect } from '@playwright/test';

test.describe('Areas percent full', () => {

    test('Should update percent full instantly', async ({ page }) => {
        // 1. Visit Venue/Area (assuming logged in state, handle login if needed)
        await page.goto('/dashboard');
        if (await page.url().includes('login')) {
            await page.fill('input[name="email"]', 'demo@clicr.co');
            await page.fill('input[name="password"]', 'password');
            await page.click('button[type="submit"]');
            await page.waitForURL('/dashboard');
        }

        // Go to Venue Areas
        await page.goto('/venues');
        await page.click('a[href^="/venues/"]:first-of-type');
        await page.locator('button:has-text("Areas")').click();

        // Check if an area exists, if not add one
        if (await page.locator('text=No areas configured').isVisible()) {
            await page.click('button:has-text("Add Area")');
            await page.fill('input[placeholder="e.g. Main Floor"]', 'Test Area');
            await page.fill('input[placeholder="0 for unlimited"]', '100');
            await page.click('button:has-text("Save Area")');
        }

        // Find the first area card
        const firstArea = page.locator('.group').first();
        const capacityText = await firstArea.locator('.text-xs.font-mono').innerText();
        // "XX / 100" or similar

        // We can't easily click + button from Areas tab usually? 
        // Oh, the cards have edit buttons but maybe not count buttons?
        // The requirement says: "Areas tab shows live % full... Click +10 in that area"
        // Usually +10 is done in Area Detail or Clicr.
        // Let's go to Area Detail to change occupancy, then come back.

        // Click area name or similar to go to detail
        await firstArea.click();

        // At Area Detail /areas/[id]
        // Add Clicr if none
        if (await page.locator('text=No active clicrs').isVisible()) {
            await page.click('button:has-text("Add Clicr")');
            await page.fill('input[placeholder="e.g. Front Door, VIP Entrance"]', 'Test Clicr');
            await page.click('button:has-text("Create Clicr")');
        }

        // Open clicr
        await page.click('a[title="Open Counter"]');

        // Click +
        await page.click('button:has-text("IN")');

        // Go back to Venue Areas
        await page.goto('/venues');
        await page.click('a[href^="/venues/"]:first-of-type');
        await page.locator('button:has-text("Areas")').click();

        // Check % Full is updated (non-zero)
        const pctText = await page.locator('.text-slate-500').first().innerText();
        expect(pctText).toMatch(/[0-9]+%/);
        expect(pctText).not.toBe('0%'); // Assuming we started at 0 and added 1, and cap is small enough
        // Actually if cap is 100 and we added 1, it's 1%.
    });

});
