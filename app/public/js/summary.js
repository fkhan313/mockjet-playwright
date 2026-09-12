document.addEventListener("DOMContentLoaded", async () => {
  const params = Store.get("searchParams");
  const outbound = Store.get("outboundFlight");
  const returnFlight = Store.get("returnFlight");

  if (!params || !outbound) {
    window.location.href = "/";
    return;
  }

  const totalPassengers = Math.max(1, (params.adults || 1) + (params.children || 0));

  // ---------- itinerary cards ----------
  function ticketStub(flight, legLabel) {
    return `
      <div class="ticket-stub" data-testid="ticket-${legLabel.toLowerCase()}">
        <div class="ticket-main">
          <h3 style="margin-bottom:2px;">${legLabel} \u00b7 ${flight.airline} ${flight.flightNumber}</h3>
          <p class="hint" style="margin-bottom:12px;">${formatDateLong(flight.date)} \u00b7 ${flight.stops === 0 ? "Nonstop" : flight.stops + " stop(s)"} \u00b7 ${formatDuration(flight.durationMinutes)}</p>
          <div class="flight-route">
            <div><div class="time">${flight.departTime}</div><div class="city">${flight.from}</div></div>
            <div class="path"><div class="line"></div></div>
            <div><div class="time">${flight.arriveTime}</div><div class="city">${flight.to}</div></div>
          </div>
        </div>
        <div class="ticket-stub-end">
          <div class="ticket-divider"></div>
          <div class="hint" style="color:var(--amber-300);">GATE</div>
          <div class="mono" style="font-size:1.1rem; font-weight:700;">${flight.gate}</div>
        </div>
      </div>`;
  }

  document.getElementById("itinerary-container").innerHTML =
    ticketStub(outbound, "Outbound") + (returnFlight ? ticketStub(returnFlight, "Return") : "");

  // ---------- optional auth / guest checkout ----------
  const authChoicePanel = document.getElementById("auth-choice");
  const bookingForm = document.getElementById("booking-form");
  const currentUser = await fetchCurrentUser();

  // ---------- tier baggage benefit ----------
  // Silver/Gold get free checked bags on economy fares. Premium/business
  // already include a bag, so the perk only shows for economy.
  const tierBenefitEl = document.getElementById("tier-benefit");
  const tier = currentUser?.tier;
  const bags = tier === "gold" ? 2 : tier === "silver" ? 1 : 0;
  if (outbound.cabin === "economy" && bags > 0) {
    const tierLabel = tier === "gold" ? "Gold" : "Silver";
    tierBenefitEl.style.display = "";
    tierBenefitEl.innerHTML = `
      <p style="margin:0; display:flex; align-items:center; gap:8px;">
        <span aria-hidden="true">&#128176;</span>
        <span>
          <strong>${bags} free checked bag${bags > 1 ? "s" : ""} included</strong>
          &mdash; ${tierLabel} member benefit on this economy fare.
        </span>
      </p>`;
  }

  function revealBookingForm() {
    authChoicePanel.style.display = "none";
    bookingForm.style.display = "";
  }

  if (currentUser) {
    // already signed in: skip the choice screen and prefill what we know
    revealBookingForm();
    const emailInput = document.getElementById("contact-email");
    if (emailInput && !emailInput.value) emailInput.value = currentUser.email;
    const phoneInput = document.getElementById("contact-phone");
    if (phoneInput && !phoneInput.value && currentUser.phone) phoneInput.value = currentUser.phone;

    // prefill saved (masked) payment details; CVC is intentionally left blank
    if (currentUser.payment) {
      const cardName = document.getElementById("card-name");
      const cardNumber = document.getElementById("card-number");
      const cardExpiry = document.getElementById("card-expiry");
      if (cardName && !cardName.value) cardName.value = currentUser.payment.cardName || "";
      if (cardNumber && !cardNumber.value && currentUser.payment.last4)
        cardNumber.value = `\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ${currentUser.payment.last4}`;
      if (cardExpiry && !cardExpiry.value) cardExpiry.value = currentUser.payment.expiry || "";
    }
  } else {
    authChoicePanel.style.display = "";
    document.getElementById("login-and-continue-btn").addEventListener("click", () => {
      window.location.href = `/login.html?redirect=${encodeURIComponent("/summary.html")}`;
    });
    document.getElementById("continue-as-guest-btn").addEventListener("click", revealBookingForm);
  }

  // ---------- passenger list (build + drag/drop reorder) ----------
  const passengerListEl = document.getElementById("passenger-list");
  let passengerOrder = Array.from({ length: totalPassengers }, (_, i) => i);
  let draggedIndex = null;
  const passengerDobPickers = new Map();

  // ---------- special requests character counter ----------
  const SPECIAL_REQUESTS_MAX = 200;
  const specialRequestsEl = document.getElementById("special-requests");
  const specialRequestsCount = document.getElementById("special-requests-count");
  if (specialRequestsEl && specialRequestsCount) {
    const updateCount = () => {
      const len = specialRequestsEl.textContent.trim().length;
      specialRequestsCount.textContent = `${len} / ${SPECIAL_REQUESTS_MAX} characters`;
      specialRequestsCount.style.color = len > SPECIAL_REQUESTS_MAX ? "var(--error)" : "";
    };
    specialRequestsEl.addEventListener("input", updateCount);
    updateCount();
  }

  function passengerRowHTML(seatNumber, n) {
    return `
      <div class="passenger-item" draggable="true" data-n="${n}" data-testid="passenger-row-${n}">
        <span class="drag-handle" data-testid="drag-handle-${n}" aria-label="Drag to reorder">\u2630</span>
        <span class="passenger-badge">P${seatNumber}</span>
        <div class="passenger-fields">
          <div class="field">
            <label for="pax-name-${n}">Full name</label>
            <input type="text" id="pax-name-${n}" data-testid="pax-name-${n}" placeholder="As on passport">
            <span class="error-text">Enter the passenger's full name.</span>
          </div>
          <div class="field datepicker-wrap" id="pax-dob-field-${n}">
            <label id="pax-dob-label-${n}" for="pax-dob-trigger-${n}">Date of birth</label>
            <input type="text" class="dp-trigger placeholder" id="pax-dob-trigger-${n}" aria-labelledby="pax-dob-label-${n}" placeholder="Select date (e.g. 05/12/1974)">
            <span class="error-text">Enter a date of birth.</span>
            <div class="dp-popover" id="pax-dob-popover-${n}"></div>
          </div>
          <div class="field">
            <label for="pax-passport-${n}">Passport number</label>
            <input type="text" id="pax-passport-${n}" data-testid="pax-passport-${n}" placeholder="e.g. X1234567">
            <span class="error-text">Enter a passport number.</span>
          </div>
          <div class="field">
            <label>Passport scan</label>
            <div class="file-drop" data-testid="pax-file-drop-${n}" tabindex="0">
              <span class="drop-label">Click or drop a file here</span>
              <input type="file" id="pax-file-${n}" data-testid="pax-file-${n}" accept="image/*,.pdf">
              <div class="file-name" data-testid="pax-file-name-${n}"></div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderPassengers() {
    passengerListEl.innerHTML = passengerOrder.map((n, i) => passengerRowHTML(i + 1, n)).join("");

    passengerOrder.forEach((n) => {
      const nameInput = document.getElementById(`pax-name-${n}`);
      const dobInput = document.getElementById(`pax-dob-trigger-${n}`);
      const passportInput = document.getElementById(`pax-passport-${n}`);

      // date of birth picker: must be in the past (max = today)
      const field = document.getElementById(`pax-dob-field-${n}`);
      const dobPicker = initDatePicker(field, {
        minDateISO: "1920-01-01",
        maxDateISO: todayISO(),
        testId: `pax-dob-${n}`,
        onSelect: () => field.classList.remove("invalid"),
      });
      passengerDobPickers.set(n, dobPicker);

      function validatePassengerField(input, type) {
        const fieldWrap = input.closest(".field");
        if (!fieldWrap) return;
        let isValid = true;
        if (type === "dob") {
          isValid = !!input.value.trim() && !!parseTypedDate(input.value.trim());
        } else {
          isValid = input.value.trim().length > 0;
        }
        fieldWrap.classList.toggle("invalid", !isValid);
      }

      nameInput.addEventListener("blur", () => validatePassengerField(nameInput, "text"));
      nameInput.addEventListener("input", () => {
        if (nameInput.value.trim()) validatePassengerField(nameInput, "text");
      });

      dobInput.addEventListener("blur", () => {
        // defer so a click into the popover's month/year select isn't mistaken for leaving the field
        setTimeout(() => {
          if (field.contains(document.activeElement)) return;
          validatePassengerField(dobInput, "dob");
        }, 150);
      });
      dobInput.addEventListener("input", () => {
        if (dobInput.value.trim()) validatePassengerField(dobInput, "dob");
      });

      passportInput.addEventListener("blur", () => validatePassengerField(passportInput, "text"));
      passportInput.addEventListener("input", () => {
        if (passportInput.value.trim()) validatePassengerField(passportInput, "text");
      });

      // file drop zone
      const dropZone = document.querySelector(`[data-testid="pax-file-drop-${n}"]`);
      const fileInput = document.getElementById(`pax-file-${n}`);
      const fileNameEl = document.querySelector(`[data-testid="pax-file-name-${n}"]`);

      dropZone.addEventListener("click", () => fileInput.click());
      dropZone.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") fileInput.click();
      });
      fileInput.addEventListener("change", () => {
        if (fileInput.files[0]) fileNameEl.textContent = fileInput.files[0].name;
      });
      ["dragenter", "dragover"].forEach((evt) =>
        dropZone.addEventListener(evt, (e) => {
          e.preventDefault();
          dropZone.classList.add("dragover");
        }),
      );
      ["dragleave", "drop"].forEach((evt) =>
        dropZone.addEventListener(evt, () => dropZone.classList.remove("dragover")),
      );
      dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        if (e.dataTransfer.files[0]) {
          fileInput.files = e.dataTransfer.files;
          fileNameEl.textContent = e.dataTransfer.files[0].name;
        }
      });
    });

    wireDragReorder();
  }

  function snapshotPassengerState() {
    const state = {};
    passengerListEl.querySelectorAll(".passenger-item").forEach((row) => {
      const n = Number(row.dataset.n);
      const nameInput = document.getElementById(`pax-name-${n}`);
      const dobInput = document.getElementById(`pax-dob-trigger-${n}`);
      const passportInput = document.getElementById(`pax-passport-${n}`);
      const fileInput = document.getElementById(`pax-file-${n}`);
      const fileName = document.querySelector(`[data-testid="pax-file-name-${n}"]`);

      state[n] = {
        name: nameInput ? nameInput.value : "",
        dob: dobInput ? dobInput.value : "",
        passport: passportInput ? passportInput.value : "",
        fileName: fileName ? fileName.textContent : "",
        fileList:
          fileInput && fileInput.files
            ? Array.from(fileInput.files).map((file) => ({
                name: file.name,
                size: file.size,
                type: file.type,
              }))
            : [],
      };
    });
    return state;
  }

  function restorePassengerState(state) {
    Object.entries(state).forEach(([nKey, values]) => {
      const n = Number(nKey);
      const nameInput = document.getElementById(`pax-name-${n}`);
      const dobInput = document.getElementById(`pax-dob-trigger-${n}`);
      const passportInput = document.getElementById(`pax-passport-${n}`);
      const fileInput = document.getElementById(`pax-file-${n}`);
      const fileName = document.querySelector(`[data-testid="pax-file-name-${n}"]`);

      if (nameInput) nameInput.value = values.name;
      if (dobInput) dobInput.value = values.dob;
      if (passportInput) passportInput.value = values.passport;
      if (fileName) fileName.textContent = values.fileName;

      if (fileInput && values.fileList.length) {
        const dataTransfer = new DataTransfer();
        values.fileList.forEach(({ name, size, type }) => {
          const file = new File([], name, { type, lastModified: Date.now() });
          Object.defineProperty(file, "size", {
            value: size,
            configurable: true,
          });
          dataTransfer.items.add(file);
        });
        fileInput.files = dataTransfer.files;
      }
    });
  }

  function updateSeatBadges() {
    passengerListEl.querySelectorAll(".passenger-item").forEach((row, i) => {
      const badge = row.querySelector(".passenger-badge");
      if (badge) badge.textContent = `P${i + 1}`;
    });
    passengerOrder = [...passengerListEl.querySelectorAll(".passenger-item")].map((el) =>
      Number(el.dataset.n),
    );
  }

  function wireDragReorder() {
    const rows = [...passengerListEl.querySelectorAll(".passenger-item")];
    rows.forEach((row) => {
      row.addEventListener("dragstart", () => {
        draggedIndex = Number(row.dataset.n);
        row.classList.add("dragging");
      });
      row.addEventListener("dragend", () => row.classList.remove("dragging"));
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        row.classList.add("drag-over");
      });
      row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.classList.remove("drag-over");
        const targetIndex = Number(row.dataset.n);
        if (draggedIndex === null || draggedIndex === targetIndex) return;

        const stateBeforeMove = snapshotPassengerState();
        const draggedEl = passengerListEl.querySelector(`[data-n="${draggedIndex}"]`);
        const allRows = [...passengerListEl.children];
        const draggedPos = allRows.indexOf(draggedEl);
        const targetPos = allRows.indexOf(row);
        if (draggedPos < targetPos) {
          row.after(draggedEl);
        } else {
          row.before(draggedEl);
        }
        updateSeatBadges();
        restorePassengerState(stateBeforeMove);
      });
    });
  }

  renderPassengers();

  if (currentUser) {
    // prefill only the primary passenger (P1, n=0) from the saved profile
    const nameInput = document.getElementById("pax-name-0");
    if (nameInput && !nameInput.value && currentUser.name) nameInput.value = currentUser.name;

    const passportInput = document.getElementById("pax-passport-0");
    if (passportInput && !passportInput.value && currentUser.passport)
      passportInput.value = currentUser.passport;

    if (currentUser.dob) {
      const dobPicker = passengerDobPickers.get(0);
      if (dobPicker && !dobPicker.getValue()) dobPicker.setValue(currentUser.dob);
    }
  }

  document.getElementById("passenger-count-label").textContent =
    `${totalPassengers} passenger${totalPassengers > 1 ? "s" : ""}`;

  const total = (outbound.price + (returnFlight ? returnFlight.price : 0)) * totalPassengers;
  document.getElementById("total-price").textContent = formatMoney(total);

  // ---------- input masking ----------
  const cardNumber = document.getElementById("card-number");
  cardNumber.addEventListener("input", () => {
    // If the field holds a masked saved card, clear it on the first edit so
    // the user can enter a fresh number instead of fighting the placeholder
    // dots (which would otherwise all vanish on the first backspace).
    if (cardNumber.value.includes("\u2022")) {
      cardNumber.value = "";
      return;
    }
    const digits = cardNumber.value.replace(/\D/g, "").slice(0, 16);
    cardNumber.value = digits.replace(/(.{4})/g, "$1 ").trim();
  });

  const cardExpiry = document.getElementById("card-expiry");
  cardExpiry.addEventListener("input", () => {
    let digits = cardExpiry.value.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) digits = digits.slice(0, 2) + "/" + digits.slice(2);
    cardExpiry.value = digits;
  });

  const cardCvc = document.getElementById("card-cvc");
  cardCvc.addEventListener("input", () => {
    cardCvc.value = cardCvc.value.replace(/\D/g, "").slice(0, 4);
  });

  document.getElementById("terms-link").addEventListener("click", (e) => {
    e.preventDefault();
    openModal("Terms & conditions", "/terms.html");
  });

  // ---------- validation ----------
  function setError(fieldId, hasError) {
    const el = document.getElementById(fieldId);
    if (el) el.classList.toggle("invalid", hasError);
  }

  function validate() {
    let valid = true;

    passengerOrder.forEach((n) => {
      const name = document.getElementById(`pax-name-${n}`);
      const dob = document.getElementById(`pax-dob-trigger-${n}`);
      const passport = document.getElementById(`pax-passport-${n}`);
      if (!name.value.trim()) {
        name.closest(".field").classList.add("invalid");
        valid = false;
      } else name.closest(".field").classList.remove("invalid");

      const dobValue = dob ? dob.value.trim() : "";
      const dobValid = !!dobValue && !!parseTypedDate(dobValue);
      if (!dobValid) {
        dob.closest(".field").classList.add("invalid");
        valid = false;
      } else dob.closest(".field").classList.remove("invalid");

      if (!passport.value.trim()) {
        passport.closest(".field").classList.add("invalid");
        valid = false;
      } else passport.closest(".field").classList.remove("invalid");
    });

    const email = document.getElementById("contact-email");
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
    setError("email-field", !emailOk);
    if (!emailOk) valid = false;

    const phone = document.getElementById("contact-phone");
    const phoneOk = phone.value.replace(/\D/g, "").length >= 7;
    setError("phone-field", !phoneOk);
    if (!phoneOk) valid = false;

    const cardName = document.getElementById("card-name");
    const cardNameOk = cardName.value.trim().length > 1;
    setError("card-name-field", !cardNameOk);
    if (!cardNameOk) valid = false;

    const cardNumOk =
      cardNumber.value.includes("\u2022") || cardNumber.value.replace(/\D/g, "").length === 16;
    setError("card-number-field", !cardNumOk);
    if (!cardNumOk) valid = false;

    const expiryOk = /^\d{2}\/\d{2}$/.test(cardExpiry.value);
    setError("card-expiry-field", !expiryOk);
    if (!expiryOk) valid = false;

    const cvcOk = cardCvc.value.length >= 3;
    setError("card-cvc-field", !cvcOk);
    if (!cvcOk) valid = false;

    const terms = document.getElementById("terms-checkbox");
    const termsError = document.getElementById("terms-error");
    termsError.style.display = terms.checked ? "none" : "block";
    termsError.classList.toggle("invalid", !terms.checked);
    if (!terms.checked) valid = false;

    const specialRequestsEl = document.getElementById("special-requests");
    const specialRequestsText = specialRequestsEl ? specialRequestsEl.textContent.trim() : "";
    if (specialRequestsText.length > SPECIAL_REQUESTS_MAX) {
      specialRequestsEl.classList.add("invalid");
      valid = false;
    } else if (specialRequestsEl) {
      specialRequestsEl.classList.remove("invalid");
    }

    return valid;
  }

  document.getElementById("booking-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) {
      const firstInvalid = document.querySelector(".invalid");
      if (firstInvalid) firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const confirmed = window.confirm(
      `Confirm booking for ${formatMoney(total)}? This charges the card on file.`,
    );
    if (!confirmed) return;

    const payBtn = document.getElementById("pay-btn");
    payBtn.disabled = true;
    payBtn.textContent = "Processing\u2026";

    const passengers = passengerOrder.map((n, i) => ({
      seat: i + 1,
      name: document.getElementById(`pax-name-${n}`).value.trim(),
      passport: document.getElementById(`pax-passport-${n}`).value.trim(),
    }));

    const specialRequestsEl = document.getElementById("special-requests");
    const specialRequests = specialRequestsEl ? specialRequestsEl.textContent.trim() : "";
    const payload = {
      outbound,
      returnFlight: returnFlight || null,
      passengers,
      specialRequests: specialRequests || null,
      contact: {
        email: document.getElementById("contact-email").value.trim(),
        phone: document.getElementById("contact-phone").value.trim(),
      },
      payment: {
        cardName: document.getElementById("card-name").value.trim(),
        cardNumber: cardNumber.value.trim(),
        expiry: cardExpiry.value.trim(),
      },
    };

    try {
      const result = await apiPost("/api/book", payload);
      Store.set("bookingConfirmation", result);
      window.location.href = "/confirmation.html";
    } catch (err) {
      payBtn.disabled = false;
      payBtn.textContent = "Confirm & pay";
      let banner = document.getElementById("booking-error-banner");
      if (!banner) {
        banner = document.createElement("div");
        banner.id = "booking-error-banner";
        banner.className = "panel";
        banner.style.borderColor = "var(--error)";
        banner.style.marginBottom = "16px";
        banner.dataset.testid = "booking-error";
        document.getElementById("booking-form").prepend(banner);
      }
      banner.innerHTML = `<h3 style="color:var(--error); margin-bottom:4px;">Booking failed</h3><p style="margin:0;">${err.message}</p>`;
      banner.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
});
