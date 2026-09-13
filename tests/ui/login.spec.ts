import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';

test.describe('Login', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goToLoginPage();
  });

  test('log in successfully with valid credentials', async ({ page }) => {
    await loginPage.login(process.env.REGULAR_USER_EMAIL!, process.env.REGULAR_USER_PASSWORD!);
    await loginPage.expectLoginSuccess();
  });

  test('locked account shows an error message', async ({ page }) => {
    await loginPage.login(process.env.LOCKED_USER_EMAIL!, process.env.LOCKED_USER_PASSWORD!);
    await loginPage.expectLockedAccountError();
  });

  test('empty fields show validation error', async ({ page }) => {
    await loginPage.loginButton.click();
    await loginPage.expectFieldError('username', 'Enter your email address.');
    await loginPage.expectFieldError('password', 'Enter your password.');
});


});