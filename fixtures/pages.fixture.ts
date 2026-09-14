import { test as base } from '@playwright/test';
import { LoginPage } from "../pages/login.page";


type PageFixtures = {
  loginPage: LoginPage;
};

export const test = base.extend<PageFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

});