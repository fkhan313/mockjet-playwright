document.addEventListener("DOMContentLoaded", async () => {
  const params = Store.get("searchParams");
  if (!params) {
    window.location.href = "/";
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const isRoundtrip = params.tripType === "roundtrip";

  const heading = document.getElementById("results-heading");
  const subheading = document.getElementById("results-subheading");
  const skeleton = document.getElementById("loading-skeleton");
  const flightList = document.getElementById("flight-list");
  const emptyState = document.getElementById("empty-state");
  const searchError = document.getElementById("search-error");
  const resultsCount = document.getElementById("results-count");
  const selectionBar = document.getElementById("selection-bar");
  const selectionLabel = document.getElementById("selection-label");
  const selectionPrice = document.getElementById("selection-price");
  const continueBtn = document.getElementById("continue-btn");
  const airlineFiltersEl = document.getElementById("airline-filters");
  const priceRange = document.getElementById("price-range");
  const priceRangeValue = document.getElementById("price-range-value");
  const sortSelect = document.getElementById("sort-select");

  let phase = "outbound"; // 'outbound' | 'return'
  let allFlights = [];
  let selectedOutbound = Store.get("outboundFlight");
  let selectedReturn = Store.get("returnFlight");
  let filterRenderFrame = null;
  // Keyed by flight id so cards hidden by a filter (e.g. price slider) are
  // reused instead of destroyed+recreated when they reappear.
  let cardPool = new Map();

  function scheduleRender() {
    cancelAnimationFrame(filterRenderFrame);
    filterRenderFrame = requestAnimationFrame(() => {
      applyFiltersAndRender();
    });
  }

  function scheduleRenderAfterPointerSettles() {
    cancelAnimationFrame(filterRenderFrame);
    filterRenderFrame = requestAnimationFrame(() => {
      applyFiltersAndRender();
    });
  }

  function updatePriceDisplay() {
    const maxPrice = Number(priceRange.value);
    priceRangeValue.textContent = `Up to ${formatMoney(maxPrice)}`;
  }

  if (isRoundtrip && selectedOutbound && !selectedReturn) phase = "return";
  if (!isRoundtrip) selectedReturn = null;

  function updateHeading() {
    if (phase === "outbound") {
      heading.textContent = `${params.fromCity} \u2192 ${params.toCity}`;
      subheading.textContent = `${formatDateLong(params.date)} \u00b7 ${params.adults + params.children} passenger(s) \u00b7 ${params.cabin}`;
    } else {
      heading.textContent = `${params.toCity} \u2192 ${params.fromCity} (return)`;
      subheading.textContent = `${formatDateLong(params.returnDate)} \u00b7 Now choose your return flight`;
    }
  }

  function currentLeg() {
    return phase === "outbound"
      ? { from: params.from, to: params.to, date: params.date }
      : { from: params.to, to: params.from, date: params.returnDate };
  }

  async function loadFlights() {
    skeleton.style.display = "";
    flightList.style.display = "none";
    emptyState.style.display = "none";
    searchError.style.display = "none";
    updateHeading();

    const leg = currentLeg();
    const qs = new URLSearchParams({
      from: leg.from,
      to: leg.to,
      date: leg.date,
      cabin: params.cabin,
    });
    if (urlParams.get("simulateError")) qs.set("simulateError", "1");
    if (urlParams.get("slow")) qs.set("slow", "1");

    try {
      const data = await apiGet(`/api/flights?${qs.toString()}`);
      allFlights = data.flights;
      cardPool = new Map();
      buildAirlineFilters();
      buildPriceRange();
      skeleton.style.display = "none";
      flightList.style.display = "";
      applyFiltersAndRender();
    } catch (err) {
      skeleton.style.display = "none";
      searchError.style.display = "";
      searchError.innerHTML = `<h3>We couldn't load flights</h3><p data-testid="search-error-message">${err.message}</p>
        <button type="button" class="btn btn-secondary" id="retry-search" data-testid="retry-search">Try again</button>`;
      document
        .getElementById("retry-search")
        .addEventListener("click", loadFlights);
    }
  }

  function buildAirlineFilters() {
    const airlines = [...new Set(allFlights.map((f) => f.airline))];
    airlineFiltersEl.innerHTML = airlines
      .map(
        (a) => `
      <label class="checkbox-row">
        <input type="checkbox" class="filter-airline" value="${a}" checked data-testid="filter-airline-${a.replace(/\s+/g, "-")}">
        ${a}
      </label>`,
      )
      .join("");
    airlineFiltersEl
      .querySelectorAll(".filter-airline")
      .forEach((cb) => cb.addEventListener("change", applyFiltersAndRender));
  }

  function buildPriceRange() {
    const max = Math.max(...allFlights.map((f) => f.price), 100);
    priceRange.max = Math.ceil(max / 10) * 10;
    priceRange.value = priceRange.max;
    priceRangeValue.textContent = `Up to ${formatMoney(priceRange.value)}`;
  }

  function getCheckedValues(selector) {
    return [...document.querySelectorAll(selector)]
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);
  }

  function applyFiltersAndRender() {
    const stopsAllowed = getCheckedValues(".filter-stops").map(Number);
    const airlinesAllowed = getCheckedValues(".filter-airline");
    const maxPrice = Number(priceRange.value);
    updatePriceDisplay();

    let filtered = allFlights.filter((f) => {
      const stopBucket = f.stops >= 2 ? 2 : f.stops;
      return (
        stopsAllowed.includes(stopBucket) &&
        airlinesAllowed.includes(f.airline) &&
        f.price <= maxPrice
      );
    });

    const sortBy = sortSelect.value;
    filtered.sort((a, b) => {
      if (sortBy === "price") return a.price - b.price;
      if (sortBy === "duration") return a.durationMinutes - b.durationMinutes;
      return a.departTime.localeCompare(b.departTime);
    });

    resultsCount.textContent = `${filtered.length} flight${filtered.length === 1 ? "" : "s"} found`;
    renderList(filtered);
  }

  function currentSelectedId() {
    return phase === "outbound" ? selectedOutbound?.id : selectedReturn?.id;
  }

  function renderList(flights) {
    const nextIds = new Set(flights.map((f) => f.id));

    // Detach (don't destroy) cards that are filtered out, keeping them in the
    // pool so they can be reattached without re-rendering their shadow DOM.
    [...flightList.children].forEach((card) => {
      if (!nextIds.has(card.flight?.id)) {
        card.remove();
      }
    });

    // Only move a card when it isn't already at its correct position, so
    // unchanged cards stay put instead of being disconnected/reconnected.
    flights.forEach((f, index) => {
      let card = cardPool.get(f.id);
      if (!card) {
        card = document.createElement("flight-card");
        cardPool.set(f.id, card);
      }
      card.flight = f;
      card.selected = f.id === currentSelectedId();

      const nodeAtIndex = flightList.children[index];
      if (nodeAtIndex !== card) {
        flightList.insertBefore(card, nodeAtIndex || null);
      }
    });

    emptyState.style.display = flights.length ? "none" : "";
  }

  flightList.addEventListener("flight-select", (e) => {
    const flight = e.detail.flight;
    if (phase === "outbound") {
      selectedOutbound = flight;
      Store.set("outboundFlight", flight);
    } else {
      selectedReturn = flight;
      Store.set("returnFlight", flight);
    }
    [...flightList.children].forEach((card) => {
      card.selected = card.flight.id === flight.id;
    });
    updateSelectionBar();
  });

  function updateSelectionBar() {
    selectionBar.style.display = "";
    if (phase === "outbound") {
      if (selectedOutbound) {
        selectionLabel.textContent = `${selectedOutbound.airline} ${selectedOutbound.flightNumber} selected`;
        selectionPrice.textContent =
          formatMoney(selectedOutbound.price) + " / passenger";
        continueBtn.disabled = false;
        continueBtn.textContent = isRoundtrip
          ? "Continue to return flights"
          : "Continue to review";
      } else {
        selectionLabel.textContent = "Select an outbound flight to continue";
        selectionPrice.textContent = "";
        continueBtn.disabled = true;
      }
    } else {
      if (selectedReturn) {
        const total = selectedOutbound.price + selectedReturn.price;
        selectionLabel.textContent = `${selectedOutbound.airline} ${selectedOutbound.flightNumber} + ${selectedReturn.airline} ${selectedReturn.flightNumber}`;
        selectionPrice.textContent = formatMoney(total) + " / passenger";
        continueBtn.disabled = false;
        continueBtn.textContent = "Continue to review";
      } else {
        selectionLabel.textContent = "Select a return flight to continue";
        selectionPrice.textContent = "";
        continueBtn.disabled = true;
      }
    }
  }

  continueBtn.addEventListener("click", () => {
    if (phase === "outbound" && isRoundtrip) {
      phase = "return";
      selectedReturn = null;
      Store.clear("returnFlight");
      loadFlights();
      updateSelectionBar();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.location.href = "/summary.html";
    }
  });

  sortSelect.addEventListener("change", scheduleRender);
  priceRange.addEventListener("input", updatePriceDisplay);
  priceRange.addEventListener("change", scheduleRenderAfterPointerSettles);
  priceRange.addEventListener("pointerup", scheduleRenderAfterPointerSettles);
  priceRange.addEventListener(
    "pointercancel",
    scheduleRenderAfterPointerSettles,
  );
  document
    .querySelectorAll(".filter-stops")
    .forEach((cb) => cb.addEventListener("change", scheduleRender));
  document.getElementById("reset-filters").addEventListener("click", () => {
    document
      .querySelectorAll(".filter-stops, .filter-airline")
      .forEach((cb) => (cb.checked = true));
    priceRange.value = priceRange.max;
    scheduleRender();
  });

  document.getElementById("fare-rules-link").addEventListener("click", (e) => {
    e.preventDefault();
    openModal("Fare rules", "/fare-rules.html");
  });

  updateSelectionBar();
  await loadFlights();
});
