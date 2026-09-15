import { test as setup, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { authFiles } from '../../config/auth.config';

setup('authenticate silver user', async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.goToLoginPage();

  await loginPage.login(process.env.SILVER_USER_EMAIL!, process.env.SILVER_USER_PASSWORD!);

  await expect(page).not.toHaveURL(/login/);

  await page.context().storageState({
    path: authFiles.silver,
  });
});
