import { test as setup, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { authFiles } from '../../config/auth.config';

setup('authenticate gold user', async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.goToLoginPage();

  await loginPage.login(process.env.GOLD_USER_EMAIL!, process.env.GOLD_USER_PASSWORD!);

  await expect(page).not.toHaveURL(/login/);

  await page.context().storageState({
    path: authFiles.gold,
  });
});
