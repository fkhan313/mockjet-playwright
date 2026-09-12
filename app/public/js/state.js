// Shared helpers used across every page. Kept deliberately framework-free.

const Store = {
  get(key, fallback = null) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value));
  },
  clear(key) {
    sessionStorage.removeItem(key);
  },
};

function formatMoney(n) {
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function formatDuration(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function formatDateLong(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// ---------- toast ----------
function showToast(message, testId = "toast") {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `<span class="dot"></span><span class="toast-message"></span>`;
    document.body.appendChild(el);
  }
  el.dataset.testid = testId;
  el.querySelector(".toast-message").textContent = message;
  el.classList.add("show");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("show"), 3200);
}

// ---------- modal (used for fare rules / terms iframes) ----------
function openModal(title, iframeSrc) {
  let overlay = document.querySelector(".modal-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true" aria-label="Modal">
        <div class="modal-head">
          <h3 class="modal-title"></h3>
          <button class="modal-close" aria-label="Close" data-testid="modal-close">&times;</button>
        </div>
        <iframe class="modal-frame" title="Modal content"></iframe>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    overlay.querySelector(".modal-close").addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("open"))
        closeModal();
    });
  }
  overlay.querySelector(".modal-title").textContent = title;
  overlay.querySelector(".modal-frame").src = iframeSrc;
  overlay.classList.add("open");
}

function closeModal() {
  const overlay = document.querySelector(".modal-overlay");
  if (overlay) overlay.classList.remove("open");
}

// ---------- fetch wrapper ----------
async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

async function apiPost(url, data) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

async function apiPatch(url, data) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}
