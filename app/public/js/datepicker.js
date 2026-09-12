// A small, dependency-free date picker. Deliberately NOT a native <input type="date">
// so it exercises real click/keyboard sequences (a common pain point in Playwright practice).
// The trigger is a real <input>, so it also supports typing a date directly, alongside
// the popover calendar with month/year dropdowns for fast long-range navigation.

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function isoDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Accepts "YYYY-MM-DD" or "MM/DD/YYYY" (and "M/D/YYYY").
function parseTypedDate(str) {
  str = (str || "").trim();
  if (!str) return null;

  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const y = Number(m[1]),
      mo = Number(m[2]) - 1,
      d = Number(m[3]);
    const dt = new Date(y, mo, d);
    if (dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d)
      return isoDate(y, mo, d);
    return null;
  }

  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mo = Number(m[1]) - 1,
      d = Number(m[2]),
      y = Number(m[3]);
    const dt = new Date(y, mo, d);
    if (dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d)
      return isoDate(y, mo, d);
    return null;
  }

  const dt = new Date(str);
  if (!Number.isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const mo = dt.getMonth();
    const d = dt.getDate();
    const normalized = new Date(y, mo, d);
    if (
      normalized.getFullYear() === y &&
      normalized.getMonth() === mo &&
      normalized.getDate() === d
    ) {
      return isoDate(y, mo, d);
    }
  }

  return null;
}

function initDatePicker(container, { minDateISO, maxDateISO, label, testId, onSelect } = {}) {
  const trigger = container.querySelector(".dp-trigger");
  const popover = container.querySelector(".dp-popover");
  const min = minDateISO ? new Date(minDateISO + "T00:00:00") : new Date(new Date().toDateString());
  const max = maxDateISO ? new Date(maxDateISO + "T00:00:00") : null;
  const yearStart = min.getFullYear();
  const yearEnd = max ? max.getFullYear() : min.getFullYear() + 3;
  let view = max
    ? new Date(max.getFullYear(), max.getMonth(), 1)
    : new Date(min.getFullYear(), min.getMonth(), 1);
  let selected = null;

  trigger.dataset.testid = `${testId}-trigger`;
  popover.dataset.testid = `${testId}-popover`;
  trigger.setAttribute("placeholder", label || "Select date (e.g. 05/12/1974)");
  trigger.setAttribute("autocomplete", "off");

  function withinBounds(dateObj) {
    return (
      dateObj >= new Date(min.toDateString()) && (!max || dateObj <= new Date(max.toDateString()))
    );
  }

  function selectDate(iso) {
    selected = iso;
    trigger.value = formatDateLong(iso);
    trigger.classList.remove("dp-error");
    const d = new Date(iso + "T00:00:00");
    view = new Date(d.getFullYear(), d.getMonth(), 1);
    close();
    if (onSelect) onSelect(iso);
  }

  function render() {
    const y = view.getFullYear();
    const m = view.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDow = new Date(y, m, 1).getDay();

    let cells = "";
    for (let i = 0; i < firstDow; i++) cells += `<span></span>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateISO = isoDate(y, m, d);
      const dateObj = new Date(y, m, d);
      const disabled = !withinBounds(dateObj);
      const isSelected = dateISO === selected;
      const isToday = dateISO === todayISO();
      cells += `<button type="button" class="dp-day${isSelected ? " selected" : ""}${isToday ? " today" : ""}"
        data-date="${dateISO}" data-testid="${testId}-day-${dateISO}"
        ${disabled ? "disabled" : ""}>${d}</button>`;
    }

    const monthOptions = MONTH_NAMES.map(
      (name, i) => `<option value="${i}"${i === m ? " selected" : ""}>${name}</option>`,
    ).join("");
    let yearOptions = "";
    for (let yr = yearEnd; yr >= yearStart; yr--) {
      yearOptions += `<option value="${yr}"${yr === y ? " selected" : ""}>${yr}</option>`;
    }

    popover.innerHTML = `
      <div class="dp-header">
        <button type="button" class="dp-nav-btn" data-testid="${testId}-prev-month" aria-label="Previous month">&lsaquo;</button>
        <div class="dp-header-selects">
          <select class="dp-month-select" data-testid="${testId}-month-select" aria-label="Month">${monthOptions}</select>
          <select class="dp-year-select" data-testid="${testId}-year-select" aria-label="Year">${yearOptions}</select>
        </div>
        <button type="button" class="dp-nav-btn" data-testid="${testId}-next-month" aria-label="Next month">&rsaquo;</button>
      </div>
      <div class="dp-grid">
        ${DOW.map((d) => `<span class="dp-dow">${d}</span>`).join("")}
        ${cells}
      </div>`;

    popover.querySelector(`[data-testid="${testId}-prev-month"]`).addEventListener("click", (e) => {
      e.stopPropagation();
      view = new Date(y, m - 1, 1);
      render();
    });
    popover.querySelector(`[data-testid="${testId}-next-month"]`).addEventListener("click", (e) => {
      e.stopPropagation();
      view = new Date(y, m + 1, 1);
      render();
    });
    const monthSelect = popover.querySelector(".dp-month-select");
    const yearSelect = popover.querySelector(".dp-year-select");
    monthSelect.addEventListener("click", (e) => e.stopPropagation());
    yearSelect.addEventListener("click", (e) => e.stopPropagation());
    monthSelect.addEventListener("change", (e) => {
      view = new Date(y, Number(e.target.value), 1);
      render();
      popover.querySelector(".dp-month-select").focus(); // render() rebuilds the selects, losing focus
    });
    yearSelect.addEventListener("change", (e) => {
      view = new Date(Number(e.target.value), m, 1);
      render();
      popover.querySelector(".dp-year-select").focus(); // render() rebuilds the selects, losing focus
    });
    popover.querySelectorAll(".dp-day:not(:disabled)").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        selectDate(btn.dataset.date);
      });
    });
  }

  function open() {
    document.querySelectorAll(".dp-popover.open").forEach((p) => {
      if (p !== popover) p.classList.remove("open");
    });
    render();
    popover.classList.add("open");
  }
  function close() {
    popover.classList.remove("open");
  }
  function toggle() {
    popover.classList.contains("open") ? close() : open();
  }

  function applyTypedValue() {
    if (trigger.value.trim() === "") {
      selected = null;
      trigger.classList.remove("dp-error");
      return;
    }
    const iso = parseTypedDate(trigger.value);
    const dateObj = iso ? new Date(iso + "T00:00:00") : null;
    if (!iso || !withinBounds(dateObj)) {
      trigger.classList.add("dp-error");
      return;
    }
    selectDate(iso);
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    open();
  });
  trigger.addEventListener("focus", () => {
    if (!popover.classList.contains("open")) open();
  });
  trigger.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyTypedValue();
    } else if (e.key === "Escape") {
      close();
      trigger.blur();
    }
  });
  trigger.addEventListener("blur", () => {
    setTimeout(() => {
      if (container.contains(document.activeElement)) return; // focus moved inside the picker, leave it open
      applyTypedValue();
    }, 120);
  });
  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) close();
  });

  return {
    getValue: () => selected,
    setValue: (iso) => {
      if (iso) selectDate(iso);
    },
    setMin: (iso) => {
      min.setTime(new Date(iso + "T00:00:00").getTime());
    },
    clear: () => {
      selected = null;
      trigger.value = "";
      trigger.classList.remove("dp-error");
    },
    close,
  };
}
