document.addEventListener('DOMContentLoaded', async () => {
  // if already signed in, skip straight to the redirect target (or home)
  const params = new URLSearchParams(window.location.search);
  const redirectTo = params.get('redirect') || '/';
  const existingUser = await fetchCurrentUser();
  if (existingUser) {
    window.location.href = redirectTo;
    return;
  }

  const form = document.getElementById('login-form');
  const errorBanner = document.getElementById('login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailField = document.getElementById('login-email-field');
    const passwordField = document.getElementById('login-password-field');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    let valid = true;
    emailField.classList.toggle('invalid', !email);
    passwordField.classList.toggle('invalid', !password);
    if (!email || !password) valid = false;
    if (!valid) return;

    errorBanner.style.display = 'none';
    const submitBtn = document.getElementById('login-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in\u2026';

    try {
      await apiPost('/api/login', { email, password });
      window.location.href = redirectTo;
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
      errorBanner.style.display = '';
      errorBanner.innerHTML = `<p style="margin:0;" data-testid="login-error-message">${err.message}</p>`;
    }
  });
});
