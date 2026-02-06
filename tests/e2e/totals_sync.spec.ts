
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'owner@clicr.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password123';

test.describe('Totals Synchronization', () => {

    // Helper to get numbers
    const getNumber = async (locator: any) => {
        const text = await locator.innerText();
        return parseInt(text.replace(/[^0-9-]/g, ''), 10);
    };

    // Helper to login
    async function login(page: any) {
        await page.goto(`${BASE_URL}/login`);
        // Already on dashboard?
        if (page.url().includes('/dashboard')) return;

        await page.fill('input[name="email"]', TEST_EMAIL);
        await page.fill('input[name="password"]', TEST_PASSWORD);
        await page.click('button:has-text("Sign in")');

        // Wait for dashboard OR onboarding
        await page.waitForTimeout(2000); // Allow redirect

        if (page.url().includes('/onboarding')) {
            console.log("Redirected to Onboarding. Filling details...");
            const bizInput = page.locator('input[name="businessName"]');
            await bizInput.waitFor();
            await bizInput.fill('Test Auto Biz');

            try {
                const venueInput = page.locator('input[name="venueName"]');
                await venueInput.waitFor({ timeout: 5000 });
                await venueInput.fill('Test Auto Venue');
            } catch (e) {
                console.log("Onboarding Fill Failed. HTML Dump:", await page.content());
                throw e;
            }
            await page.click('button:has-text("Launch Dashboard")');
            await page.waitForURL(/\/dashboard/, { timeout: 30000 });
        } else {
            // Expect Dashboard
            await page.waitForURL(/\/dashboard/, { timeout: 30000 });
        }
    }

    test.skip('Occupancy updates persist (UI Driven)', async ({ browser }) => {
        const context = await browser.newContext(); // { recordVideo: { dir: 'videos/' } } if debugging needed
        const page = await context.newPage();
        await login(page);

        // 1. Validate Auth via Debug Page
        await page.goto(`${BASE_URL}/debug`);

        // Wait for Auth text to appear
        const authLocator = page.locator('span:has-text("Auth:")').first();
        try {
            await expect(authLocator).toBeVisible({ timeout: 15000 });
        } catch (e) {
            console.log("Debug page auth locator missing. Page content:", await page.content());
        }

        // Check if NOT AUTHENTICATED
        const notAuth = page.locator('text=NOT AUTHENTICATED');
        if (await notAuth.isVisible()) {
            // Try reload once
            console.log("Initial load shows NOT AUTHENTICATED. Reloading...");
            await page.reload();
            await page.waitForTimeout(2000);
            if (await notAuth.isVisible()) {
                throw new Error("TEST FAILURE: App failed to authenticate user in Playwright environment/Store. Client session missing.");
            }
        }

        // 2. Navigate to Clicr Selection
        await page.goto(`${BASE_URL}/clicr`);

        // 3. Select First Available Clicr
        // Only run if we are actually on list page
        if (page.url().endsWith('/clicr')) {
            const clicrCard = page.locator('a[href^="/clicr/"]').first();
            if (await clicrCard.isVisible()) {
                await clicrCard.click();
            } else {
                console.log("No Clicrs found in list. Trying direct navigation to dev_001.");
                await page.goto(`${BASE_URL}/clicr/dev_001`);
            }
        } else {
            console.log("Redirected away from /clicr? Current:", page.url());
        }

        const display = page.locator('.text-[15vh]'); // Occupancy Display

        try {
            await expect(display).toBeVisible({ timeout: 10000 });
        } catch (e) {
            throw new Error("No Clicr device available to test (display not visible). Current URL: " + page.url());
        }

        const startVal = await getNumber(display);

        // Click +3 using any available button
        const buttons = page.locator('button');
        const count = await buttons.count();
        if (count < 2) throw new Error("Not enough buttons on Clicr page");

        const btn = buttons.nth(0); // First button
        await btn.click();
        await page.waitForTimeout(200);
        await btn.click();
        await page.waitForTimeout(200);
        await btn.click();

        // Expect Increase (or Change)
        await expect(display).not.toHaveText(String(startVal), { timeout: 5000 });

        // WAIT 3 SECONDS (Revert Check)
        await page.waitForTimeout(3000);

        const endVal = await getNumber(display);

        // Assert NOT Reverted to 0 (unless startVal was 0 and we somehow stayed there, but we observed change)
        if (endVal === 0 && startVal !== 0) {
            throw new Error("REVERT TO ZERO DETECTED!");
        }

        // REFRESH Persistence Check
        await page.reload();
        await expect(display).toBeVisible();
        await expect(display).toHaveText(String(endVal), { timeout: 10000 });
    });

});
