import { expect } from "@playwright/test";
import { test } from "../../fixtures/pages.fixture";
import { ValidationMessages, AccountMessages } from "../../test-data/messages";

test.describe("Login", () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goToLoginPage();
  });

  test("log in successfully with valid credentials", async ({ loginPage }) => {
    await loginPage.login(
      process.env.REGULAR_USER_EMAIL!,
      process.env.REGULAR_USER_PASSWORD!,
    );
    await expect(loginPage.authMenuTrigger).toBeVisible();
  });

  test("locked account shows an error message", async ({ loginPage }) => {
    await loginPage.login(
      process.env.LOCKED_USER_EMAIL!,
      process.env.LOCKED_USER_PASSWORD!,
    );
    await expect(loginPage.lockedAccountError).toHaveText(
      AccountMessages.locked,
    );
  });

  test("empty fields show validation error", async ({ loginPage }) => {
    await loginPage.loginButton.click();
    await expect(loginPage.usernameError).toHaveText(
      ValidationMessages.emailRequired,
    );
    await expect(loginPage.passwordError).toHaveText(
      ValidationMessages.passwordRequired,
    );
  });
});
