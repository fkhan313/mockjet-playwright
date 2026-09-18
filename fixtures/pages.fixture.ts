import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { FlightSearchPage } from '../pages/flight-search.page';

type PageFixtures = {
  loginPage: LoginPage;
  flightSearchPage: FlightSearchPage;
};

export const test = base.extend<PageFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  flightSearchPage: async ({ page }, use) => {
    await use(new FlightSearchPage(page));
  },
});
