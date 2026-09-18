import { expect } from '@playwright/test';
import { test } from '../../fixtures/pages.fixture';

test.describe('Flight Search', () => {
  test('one way flight search', async ({ flightSearchPage }) => {
    await flightSearchPage.goToFlightSearchPage();
    await flightSearchPage.searchOneWayFlight('DFW', 'JFK', '2026-10-15');
    await flightSearchPage.page.waitForURL(/results\.html/);
    await expect(flightSearchPage.page).toHaveURL(/results\.html/);
  });
});
