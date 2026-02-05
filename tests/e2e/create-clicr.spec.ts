
import { test, expect } from '@playwright/test';

test.describe('Create Clicr End-to-End', () => {

    test.beforeEach(async ({ page }) => {
        // Assumption: Auth setup or global setup handles login
        // If not, we might need to perform login here.
        // Given the context, let's assume we navigate to dashboard and redirect to login if needed.
        await page.goto('/dashboard');
        // Simple check if redirected to login
        if (await page.url().includes('login')) {
            // Perform Login (Mock or Real)
            await page.fill('input[name="email"]', 'demo@clicr.co'); // specific demo user
            await page.fill('input[name="password"]', 'password');
            await page.click('button[type="submit"]');
            await page.waitForURL('/dashboard');
        }
    });

    test('should create a new mapped Clicr successfully', async ({ page }) => {
        // 1. Navigate to Venues/Areas to ensure we have a place to add
        // Quick shortcut: Go to first area found in dashboard or venues list
        await page.goto('/venues');
        await page.waitForSelector('text=Venues');

        // Click first venue
        // Assuming UI structure: List of venue cards
        await page.click('a[href^="/venues/"]:first-of-type');

        // Now in Venue Detail, verify areas exist or create one?
        // Let's assume an area exists for "Create Clicr" test. 
        // Usually "Main Floor" or similar.
        // If we can't find an area link, this test might be flaky without setup.
        // Let's try to find an "Area" card/link. 
        // In VenueAreas.tsx, areas are listed.

        // Let's create a UNIQUE Clicr name to verify
        const clicrName = `AutoTest Clicr ${Date.now()}`;

        // Find the "Add Clicr" button. 
        // In VenueAreas.tsx: "Add Clicr" triggers modal. 
        // Wait, VenueAreas.tsx is the component. The PAGE is /venues/[id].
        // Actually, Add Clicr is in /areas/[id]/page.tsx?
        // Let's check where the user is adding clicrs from.
        // The previous context showed `app/(authenticated)/areas/[id]/page.tsx` having "Add Clicr".
        // So we need to go to an Area page.

        // From Venue page, click an Area.
        // Selector might be tricky without test-ids.
        // Look for text "Main" or any area card.
        await page.click('[href*="/areas/"]');

        // Now in Area Page
        await page.click('button:has-text("Add Clicr")');

        // Fill Modal
        await page.fill('input[placeholder*="Front Door"]', clicrName);

        // Select Flow Mode (Bidirectional default, but let's click one)
        await page.click('button:has-text("OUT ONLY")');

        // Save
        await page.click('button:has-text("Create Clicr")');

        // Assert: Modal closes
        await expect(page.locator('button:has-text("Create Clicr")')).toBeHidden();

        // Assert: Appears in list
        await expect(page.locator(`text=${clicrName}`)).toBeVisible();

        // Refresh
        await page.reload();
        await expect(page.locator(`text=${clicrName}`)).toBeVisible();
    });

});
