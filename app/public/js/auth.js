// Shared auth helpers, loaded on every page. Handles rendering the
// "Sign in" / "Hi, <name>" state in the header and gating protected pages.

async function fetchCurrentUser() {
  try {
    const res = await fetch("/api/me");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function renderAuthSlot() {
  const slot = document.getElementById("auth-area");
  if (!slot) return null;

  const user = await fetchCurrentUser();

  if (user) {
    slot.innerHTML = `
      <div class="auth-menu" data-testid="auth-menu">
        <button type="button" class="auth-menu-trigger" data-testid="auth-menu-trigger" aria-haspopup="true" aria-expanded="false">
          <span>${user.name}</span>
          <span class="auth-menu-chevron" aria-hidden="true">&#9662;</span>
        </button>
        <div class="auth-dropdown" data-testid="auth-dropdown" role="menu">
          <a href="/account.html" class="auth-dropdown-item" data-testid="my-account-link" role="menuitem">My account</a>
          <a href="/bookings.html" class="auth-dropdown-item" data-testid="my-bookings-link" role="menuitem">My bookings</a>
          <button type="button" class="auth-dropdown-item auth-dropdown-signout" data-testid="sign-out-btn" role="menuitem">Sign out</button>
        </div>
      </div>
    `;

    const menu = slot.querySelector('[data-testid="auth-menu"]');
    const trigger = slot.querySelector('[data-testid="auth-menu-trigger"]');

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.toggle("open");
      trigger.setAttribute("aria-expanded", String(isOpen));
    });
    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target)) {
        menu.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
      }
    });
    menu.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        menu.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
        trigger.focus();
      }
    });

    slot
      .querySelector('[data-testid="sign-out-btn"]')
      .addEventListener("click", async () => {
        await fetch("/api/logout", { method: "POST" });
        window.location.href = "/";
      });
  } else {
    slot.innerHTML = `
      <a class="auth-signin-link" href="/login.html?redirect=${encodeURIComponent(window.location.pathname)}" data-testid="sign-in-link">Sign in</a>
    `;
  }

  return user;
}

// Call from a page that only makes sense for a signed-in user (e.g. account.html).
// Redirects to /login.html?redirect=<current path> if not authenticated.
async function requireAuthOrRedirect() {
  const user = await fetchCurrentUser();
  if (!user) {
    window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    return null;
  }
  return user;
}
