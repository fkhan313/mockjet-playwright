import { Page, Locator, expect } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly authMenuTrigger: Locator;
  readonly lockedAccountError: Locator;
  readonly usernameError: Locator;
  readonly passwordError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.getByRole("textbox", { name: "Email" });
    this.passwordInput = page.getByRole("textbox", { name: "Password" });
    this.loginButton = page.getByRole("button", { name: "Sign in" });
    this.lockedAccountError = page.locator('[data-testid="login-error-message"]');
    this.usernameError = page.getByText('Enter your email address.', { exact: true });
    this.passwordError = page.getByText('Enter your password.', { exact: true });
    this.authMenuTrigger = page.locator('[data-testid="auth-menu-trigger"]');
  }

  async goToLoginPage() {
    await this.page.goto(`${process.env.BASE_URL}/login.html?redirect=%2F`);
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async expectLoginSuccess() {
  await expect(this.authMenuTrigger).toBeVisible();
}

  async expectLockedAccountError() {
    await expect(this.lockedAccountError).toHaveText(
    'This account is locked. Contact support to regain access.'
  );
}

  async expectFieldError(field: 'username' | 'password', text: string) {
    const locator = field === 'username' ? this.usernameError : this.passwordError;
    await expect(locator).toHaveText(text);
  }

}

