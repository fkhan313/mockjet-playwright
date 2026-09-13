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

  async goToLoginPage(): Promise<void> {
    await this.page.goto('/login.html?redirect=%2F');
  }

  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}

