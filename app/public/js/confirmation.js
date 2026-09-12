document.addEventListener("DOMContentLoaded", () => {
  const booking = Store.get("bookingConfirmation");

  if (!booking) {
    document.getElementById("no-booking").style.display = "";
    return;
  }
  document.getElementById("confirmation-content").style.display = "";

  // split-flap style reveal of the confirmation code
  const codeEl = document.getElementById("confirmation-code");
  const code = booking.confirmationCode;
  codeEl.innerHTML = code
    .split("")
    .map((ch) => `<span class="cell mono">${ch}</span>`)
    .join("");
  codeEl.querySelectorAll(".cell").forEach((c) => {
    c.style.display = "inline-block";
    c.style.background = "rgba(255,255,255,.08)";
    c.style.borderRadius = "6px";
    c.style.padding = "2px 8px";
    c.style.margin = "0 2px";
  });

  // simple placeholder QR (deterministic pattern from the confirmation code, no external calls)
  const qrBox = document.getElementById("qr-box");
  const size = 8;
  let seed = 0;
  for (const ch of code) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let svg = `<svg viewBox="0 0 ${size} ${size}" width="100" height="100">`;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (rand() > 0.55)
        svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="#131A2A"/>`;
    }
  }
  svg += `</svg>`;
  qrBox.innerHTML = svg;

  // itinerary summary
  function legSummary(flight, label) {
    return `
      <div class="ticket-stub" data-testid="confirm-ticket-${label.toLowerCase()}">
        <div class="ticket-main">
          <h3 style="margin-bottom:2px;">${label} \u00b7 ${flight.airline} ${flight.flightNumber}</h3>
          <p class="hint" style="margin-bottom:12px;">${formatDateLong(flight.date)}</p>
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
  document.getElementById("itinerary-summary").innerHTML =
    legSummary(booking.outbound, "Outbound") +
    (booking.returnFlight ? legSummary(booking.returnFlight, "Return") : "");

  // ---------- tier baggage benefit (stamped on the booking by the server) ----------
  const tierBenefitEl = document.getElementById("tier-benefit");
  if (booking.tierBenefit && booking.tierBenefit.bags > 0) {
    const { bags, tier } = booking.tierBenefit;
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

  document.getElementById("passenger-summary").innerHTML = booking.passengers
    .map(
      (p) => `
    <div class="passenger-item" style="cursor:default;" data-testid="confirm-passenger-${p.seat}">
      <span class="passenger-badge">P${p.seat}</span>
      <div><strong>${p.name}</strong><div class="hint">Passport ${p.passport}</div></div>
    </div>`,
    )
    .join("");

  document.getElementById("confirm-total").textContent = formatMoney(
    booking.total,
  );

  // ---------- special requests (optional, echoed back from the booking) ----------
  const specialRequestsPanel = document.getElementById(
    "special-requests-panel",
  );
  if (booking.specialRequests) {
    specialRequestsPanel.style.display = "";
    document.getElementById("special-requests-text").textContent =
      booking.specialRequests;
  }

  // ---------- download e-ticket ----------
  document.getElementById("download-btn").addEventListener("click", () => {
    const lines = [
      `MOCKJET E-TICKET`,
      `Confirmation code: ${booking.confirmationCode}`,
      ``,
      `Outbound: ${booking.outbound.airline} ${booking.outbound.flightNumber}`,
      `${booking.outbound.from} ${booking.outbound.departTime} -> ${booking.outbound.to} ${booking.outbound.arriveTime}`,
      ...(booking.returnFlight
        ? [
            ``,
            `Return: ${booking.returnFlight.airline} ${booking.returnFlight.flightNumber}`,
            `${booking.returnFlight.from} ${booking.returnFlight.departTime} -> ${booking.returnFlight.to} ${booking.returnFlight.arriveTime}`,
          ]
        : []),
      ``,
      `Passengers:`,
      ...booking.passengers.map(
        (p) => `  P${p.seat} \u2014 ${p.name} (Passport ${p.passport})`,
      ),
      ...(booking.tierBenefit
        ? [
            ``,
            `Included: ${booking.tierBenefit.bags} free checked bag(s) (${booking.tierBenefit.tier === "gold" ? "Gold" : "Silver"} member benefit)`,
          ]
        : []),
      ``,
      `Total charged: ${formatMoney(booking.total)}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mockjet-eticket-${booking.confirmationCode}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document
    .getElementById("print-btn")
    .addEventListener("click", () => window.print());

  document.getElementById("email-btn").addEventListener("click", () => {
    showToast(`Itinerary sent to ${booking.contact.email}`, "email-toast");
  });
});
