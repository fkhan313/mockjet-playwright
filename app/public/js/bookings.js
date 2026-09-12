document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuthOrRedirect();
  if (!user) return; // redirecting to /login.html

  const skeleton = document.getElementById("loading-skeleton");
  const tableWrap = document.getElementById("bookings-table-wrap");
  const tbody = document.getElementById("bookings-tbody");
  const emptyState = document.getElementById("account-empty");
  const exportBtn = document.getElementById("export-excel-btn");

  let bookings = [];

  function routeLabel(booking) {
    const out = `${booking.outbound.from} \u2192 ${booking.outbound.to}`;
    return booking.returnFlight ? `${out} (round trip)` : out;
  }

  function dateLabel(booking) {
    const outDate = formatDateLong(booking.outbound.date);
    return booking.returnFlight
      ? `${outDate} \u2013 ${formatDateLong(booking.returnFlight.date)}`
      : outDate;
  }

  function statusBadge(status) {
    const labels = {
      confirmed: "Confirmed",
      "checked-in": "Checked in",
      cancelled: "Cancelled",
    };
    return `<span class="status-badge status-${status}" data-testid="status-badge">${labels[status] || status}</span>`;
  }

  function actionsCell(booking) {
    if (booking.status === "cancelled") {
      return `<span class="hint">&mdash;</span>`;
    }
    const buttons = [];
    if (booking.status === "confirmed") {
      buttons.push(
        `<button type="button" class="btn btn-primary" data-action="checkin" data-code="${booking.confirmationCode}" data-testid="checkin-btn-${booking.confirmationCode}">Check in</button>`,
      );
    }
    if (booking.status === "checked-in") {
      buttons.push(
        `<button type="button" class="btn btn-secondary" data-action="boarding-pass" data-code="${booking.confirmationCode}" data-testid="boarding-pass-btn-${booking.confirmationCode}">Boarding pass</button>`,
      );
    }
    buttons.push(
      `<button type="button" class="btn btn-ghost" data-action="cancel" data-code="${booking.confirmationCode}" data-testid="cancel-btn-${booking.confirmationCode}">Cancel</button>`,
    );
    return `<div class="booking-actions">${buttons.join("")}</div>`;
  }

  function renderTable() {
    if (!bookings.length) {
      tableWrap.style.display = "none";
      emptyState.style.display = "";
      return;
    }
    emptyState.style.display = "none";
    tableWrap.style.display = "";

    tbody.innerHTML = bookings
      .map(
        (b) => `
      <tr class="${b.status === "cancelled" ? "is-cancelled" : ""}" data-testid="booking-row-${b.confirmationCode}">
        <td class="booking-code">${b.confirmationCode}</td>
        <td class="booking-route">${routeLabel(b)}</td>
        <td>${dateLabel(b)}</td>
        <td>${statusBadge(b.status)}</td>
        <td class="mono">${formatMoney(b.total)}</td>
        <td>${actionsCell(b)}</td>
      </tr>
    `,
      )
      .join("");

    tbody
      .querySelectorAll('[data-action="checkin"]')
      .forEach((btn) =>
        btn.addEventListener("click", () =>
          handleCheckin(btn.dataset.code, btn),
        ),
      );
    tbody
      .querySelectorAll('[data-action="cancel"]')
      .forEach((btn) =>
        btn.addEventListener("click", () =>
          handleCancel(btn.dataset.code, btn),
        ),
      );
    tbody
      .querySelectorAll('[data-action="boarding-pass"]')
      .forEach((btn) =>
        btn.addEventListener("click", () =>
          downloadBoardingPass(btn.dataset.code),
        ),
      );
  }

  async function loadBookings() {
    skeleton.style.display = "";
    tableWrap.style.display = "none";
    emptyState.style.display = "none";
    const data = await apiGet("/api/bookings");
    bookings = data.bookings;
    skeleton.style.display = "none";
    renderTable();
  }

  async function handleCheckin(code, btn) {
    btn.disabled = true;
    btn.textContent = "Checking in\u2026";
    try {
      const updated = await apiPost(`/api/bookings/${code}/checkin`, {});
      bookings = bookings.map((b) =>
        b.confirmationCode === code ? updated : b,
      );
      renderTable();
      showToast(
        `Checked in \u2014 seat ${updated.seatAssignment}, boarding group ${updated.boardingGroup}`,
        "checkin-toast",
      );
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Check in";
      showToast(err.message, "checkin-error-toast");
    }
  }

  async function handleCancel(code, btn) {
    const confirmed = window.confirm(
      "Cancel this booking? This can't be undone.",
    );
    if (!confirmed) return;
    btn.disabled = true;
    btn.textContent = "Cancelling\u2026";
    try {
      const updated = await apiPost(`/api/bookings/${code}/cancel`, {});
      bookings = bookings.map((b) =>
        b.confirmationCode === code ? updated : b,
      );
      renderTable();
      showToast("Booking cancelled.", "cancel-toast");
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Cancel";
      showToast(err.message, "cancel-error-toast");
    }
  }

  function downloadBoardingPass(code) {
    const booking = bookings.find((b) => b.confirmationCode === code);
    if (!booking || !window.jspdf) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: [320, 480] });
    const f = booking.outbound;
    const passenger = booking.passengers[0];

    doc.setFillColor(11, 18, 32);
    doc.rect(0, 0, 320, 90, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("MockJet Boarding Pass", 20, 35);
    doc.setFontSize(10);
    doc.setTextColor(245, 165, 36);
    doc.text("DEMO DOCUMENT \u2014 NOT VALID FOR TRAVEL", 20, 55);

    doc.setTextColor(20, 20, 20);
    doc.setFontSize(20);
    doc.text(`${f.from}  ->  ${f.to}`, 20, 130);

    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    const rows = [
      ["Passenger", passenger ? passenger.name : ""],
      ["Flight", `${f.airline} ${f.flightNumber}`],
      ["Date", formatDateLong(f.date)],
      ["Departs", f.departTime],
      ["Gate", f.gate],
      ["Seat", booking.seatAssignment || ""],
      ["Boarding group", booking.boardingGroup || ""],
      ["Confirmation", booking.confirmationCode],
    ];
    let y = 160;
    rows.forEach(([label, value]) => {
      doc.setTextColor(140, 140, 140);
      doc.text(label.toUpperCase(), 20, y);
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(12);
      doc.text(String(value), 130, y);
      doc.setFontSize(10);
      y += 26;
    });

    doc.setDrawColor(220, 220, 220);
    doc.setLineDashPattern([3, 2], 0);
    doc.line(20, y + 4, 300, y + 4);

    doc.save(`mockjet-boarding-pass-${booking.confirmationCode}.pdf`);
  }

  exportBtn.addEventListener("click", () => {
    if (!window.XLSX || !bookings.length) return;
    const rows = bookings.map((b) => ({
      "Confirmation Code": b.confirmationCode,
      Route: routeLabel(b),
      Date: dateLabel(b),
      Status: b.status,
      Total: b.total,
      "Booked At": b.bookedAt,
      Seat: b.seatAssignment || "",
      "Boarding Group": b.boardingGroup || "",
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Bookings");
    XLSX.writeFile(workbook, "mockjet-bookings.xlsx");
  });

  await loadBookings();
});
