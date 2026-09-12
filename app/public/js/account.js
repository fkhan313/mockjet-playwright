document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuthOrRedirect();
  if (!user) return; // redirecting to /login.html

  const form = document.getElementById("profile-form");
  const emailInput = document.getElementById("profile-email");
  const nameInput = document.getElementById("profile-name");
  const phoneInput = document.getElementById("profile-phone");
  const passportInput = document.getElementById("profile-passport");
  const dobField = document.getElementById("profile-dob-field");
  const saveBtn = document.getElementById("save-profile-btn");

  const cardNameInput = document.getElementById("card-name");
  const cardNumberInput = document.getElementById("card-number");
  const cardExpiryInput = document.getElementById("card-expiry");

  const dobPicker = initDatePicker(dobField, {
    minDateISO: "1920-01-01",
    maxDateISO: todayISO(),
    testId: "profile-dob",
    onSelect: () => dobField.classList.remove("invalid"),
  });

  emailInput.value = user.email;
  nameInput.value = user.name || "";
  phoneInput.value = user.phone || "";
  passportInput.value = user.passport || "";
  if (user.dob) dobPicker.setValue(user.dob);

  // ---------- payment prefill (masked) ----------
  if (user.payment) {
    cardNameInput.value = user.payment.cardName || "";
    cardNumberInput.value = user.payment.last4
      ? `\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ${user.payment.last4}`
      : "";
    cardExpiryInput.value = user.payment.expiry || "";
  }

  // ---------- payment input masking ----------
  cardNumberInput.addEventListener("input", () => {
    // If the field holds a masked saved card, clear it on the first edit so
    // the user can enter a fresh number instead of fighting the placeholder
    // dots (which would otherwise all vanish on the first backspace).
    if (cardNumberInput.value.includes("\u2022")) {
      cardNumberInput.value = "";
      return;
    }
    const digits = cardNumberInput.value.replace(/\D/g, "").slice(0, 16);
    cardNumberInput.value = digits.replace(/(.{4})/g, "$1 ").trim();
  });
  cardExpiryInput.addEventListener("input", () => {
    let digits = cardExpiryInput.value.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) digits = digits.slice(0, 2) + "/" + digits.slice(2);
    cardExpiryInput.value = digits;
  });

  // ---------- tier badge ----------
  const tierBadge = document.getElementById("loyalty-tier-badge");
  const tier = user.tier;
  if (tier === "silver" || tier === "gold") {
    const tierLabel = tier === "gold" ? "Gold member" : "Silver member";
    tierBadge.textContent = `\u2605 ${tierLabel}`;
    tierBadge.classList.add(`tier-badge--${tier}`);
    tierBadge.style.display = "";
  }

  form.style.display = "";

  function setError(fieldId, hasError) {
    const el = document.getElementById(fieldId);
    if (el) el.classList.toggle("invalid", hasError);
  }

  function validate() {
    let valid = true;

    const nameOk = nameInput.value.trim().length > 0;
    setError("profile-name-field", !nameOk);
    if (!nameOk) valid = false;

    const phoneValue = phoneInput.value.trim();
    const phoneOk = phoneValue === "" || phoneValue.replace(/\D/g, "").length >= 7;
    setError("profile-phone-field", !phoneOk);
    if (!phoneOk) valid = false;

    const dobTyped = document.getElementById("profile-dob-trigger").value.trim();
    const dobOk = dobTyped === "" || !!dobPicker.getValue();
    dobField.classList.toggle("invalid", !dobOk);
    if (!dobOk) valid = false;

    return valid;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving\u2026";
    try {
      const cardDigits = cardNumberInput.value.replace(/\D/g, "");
      const last4 = cardDigits.length >= 4 ? cardDigits.slice(-4) : user.payment?.last4 || "";
      await apiPatch("/api/me", {
        name: nameInput.value.trim(),
        phone: phoneInput.value.trim(),
        dob: dobPicker.getValue() || "",
        passport: passportInput.value.trim(),
        payment: {
          cardName: cardNameInput.value.trim(),
          last4,
          expiry: cardExpiryInput.value.trim(),
        },
      });
      // Re-mask the card number now that only the last 4 digits are saved,
      // so the full number isn't left visible in the field after saving.
      cardNumberInput.value = last4
        ? `\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ${last4}`
        : "";
      await renderAuthSlot(); // refresh header name after a save
      showToast("Account details saved.", "profile-saved-toast");
    } catch (err) {
      showToast(err.message, "profile-save-error-toast");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save changes";
    }
  });
});
