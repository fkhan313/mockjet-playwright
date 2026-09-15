import { test as setup, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { authFiles } from '../../config/auth.config';

setup('authenticate regular user', async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.goToLoginPage();

  await loginPage.login(process.env.REGULAR_USER_EMAIL!, process.env.REGULAR_USER_PASSWORD!);

  await expect(page).not.toHaveURL(/login/);

  await page.context().storageState({
    path: authFiles.regular,
  });
});
