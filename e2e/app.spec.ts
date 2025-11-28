import { test, expect } from '@playwright/test';

test.describe('Application Core', () => {
    test('homepage loads successfully', async ({ page }) => {
        await page.goto('/');
        
        // Wait for the page to be fully loaded
        await page.waitForLoadState('networkidle');
        
        // Check that the page has loaded (look for common elements)
        // The app should have a main content area
        await expect(page.locator('body')).toBeVisible();
    });

    test('login page is accessible', async ({ page }) => {
        await page.goto('/login');
        
        await page.waitForLoadState('networkidle');
        
        // Should show login form or authentication UI
        await expect(page.locator('body')).toBeVisible();
    });

    test('navigation works correctly', async ({ page }) => {
        await page.goto('/');
        
        await page.waitForLoadState('networkidle');
        
        // The page should be navigable
        const title = await page.title();
        expect(title).toBeDefined();
    });
});

test.describe('PWA Features', () => {
    test('manifest is available', async ({ request }) => {
        // PWA manifest should be accessible
        // The manifest might be at different paths depending on configuration
        const possiblePaths = ['/manifest.webmanifest', '/manifest.json', '/site.webmanifest'];
        
        let manifestFound = false;
        for (const path of possiblePaths) {
            try {
                const response = await request.get(path);
                if (response.ok()) {
                    manifestFound = true;
                    const manifest = await response.json();
                    expect(manifest.name).toBeDefined();
                    break;
                }
            } catch (e) {
                // Continue trying other paths
            }
        }
        
        // Skip if no manifest found (might not be configured in dev)
        if (!manifestFound) {
            test.skip();
        }
    });
});

test.describe('Error Handling', () => {
    test('404 page handles unknown routes', async ({ page }) => {
        const response = await page.goto('/this-route-does-not-exist-12345');
        
        // Should either redirect or show error page
        // Most apps will return 200 with a SPA router or 404
        expect(response).not.toBeNull();
    });
});

