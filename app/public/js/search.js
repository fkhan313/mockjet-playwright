document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('search-form');
  const fromInput = document.getElementById('from-input');
  const toInput = document.getElementById('to-input');
  const fromList = document.getElementById('from-list');
  const toList = document.getElementById('to-list');
  const returnField = document.getElementById('return-field');
  const swapBtn = document.getElementById('swap-btn');

  let selectedFrom = null;
  let selectedTo = null;

  // restore a previous search, if any (nice for back-navigation from results)
  const prev = Store.get('searchParams');
  if (prev) {
    if (prev.fromLabel) { fromInput.value = prev.fromLabel; selectedFrom = { code: prev.from, city: prev.fromCity }; }
    if (prev.toLabel) { toInput.value = prev.toLabel; selectedTo = { code: prev.to, city: prev.toCity }; }
  }

  // ---------- trip type ----------
  form.querySelectorAll('input[name="tripType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isRoundtrip = form.tripType.value === 'roundtrip';
      returnField.style.display = isRoundtrip ? '' : 'none';
      if (!isRoundtrip) returnDp.clear();
    });
  });

  // ---------- autocomplete ----------
  function wireAutocomplete(input, list, onPick) {
    let activeIndex = -1;
    let debounceTimer;

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const q = input.value.trim();
      if (q.length < 1) { list.classList.remove('open'); list.innerHTML = ''; return; }
      debounceTimer = setTimeout(async () => {
        try {
          const matches = await apiGet(`/api/airports?q=${encodeURIComponent(q)}`);
          activeIndex = -1;
          list.innerHTML = matches.map((a, i) =>
            `<li role="option" data-code="${a.code}" data-city="${a.city}" data-testid="airport-option-${a.code}">
               <span>${a.city} \u2014 ${a.name}</span><span class="code">${a.code}</span>
             </li>`).join('');
          list.classList.toggle('open', matches.length > 0);
        } catch (e) {
          list.innerHTML = `<li data-testid="autocomplete-error">Couldn't load airports. Try again.</li>`;
          list.classList.add('open');
        }
      }, 220);
    });

    list.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-code]');
      if (!li) return;
      input.value = `${li.dataset.city} (${li.dataset.code})`;
      onPick({ code: li.dataset.code, city: li.dataset.city });
      list.classList.remove('open');
    });

    input.addEventListener('keydown', (e) => {
      const items = [...list.querySelectorAll('li[data-code]')];
      if (!items.length || !list.classList.contains('open')) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        items[activeIndex].click();
        return;
      } else {
        return;
      }
      items.forEach((li, i) => li.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false'));
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    });

    document.addEventListener('click', (e) => {
      if (e.target !== input) list.classList.remove('open');
    });
  }

  wireAutocomplete(fromInput, fromList, (airport) => {
    selectedFrom = airport;
    setFieldError('from-field', false);
  });
  wireAutocomplete(toInput, toList, (airport) => {
    selectedTo = airport;
    setFieldError('to-field', false);
  });

  swapBtn.addEventListener('click', () => {
    const tmpVal = fromInput.value; fromInput.value = toInput.value; toInput.value = tmpVal;
    const tmpSel = selectedFrom; selectedFrom = selectedTo; selectedTo = tmpSel;
  });

  // ---------- date pickers ----------
  const departDp = initDatePicker(document.getElementById('depart-field'), {
    minDateISO: todayISO(),
    testId: 'depart',
    onSelect: (iso) => {
      returnDp.setMin(iso);
      setFieldError('depart-field', false);
    }
  });
  const returnDp = initDatePicker(document.getElementById('return-field'), {
    minDateISO: todayISO(),
    testId: 'return',
    onSelect: () => setFieldError('return-field', false)
  });

  // ---------- passengers / cabin popover ----------
  const passengersTrigger = document.getElementById('passengers-trigger');
  const passengersPopover = document.getElementById('passengers-popover');
  const cabinSelect = document.getElementById('cabin-select');
  let adults = 1, children = 0;

  function updatePassengerSummary() {
    const parts = [`${adults} Adult${adults > 1 ? 's' : ''}`];
    if (children > 0) parts.push(`${children} Child${children > 1 ? 'ren' : ''}`);
    const cabinLabel = cabinSelect.options[cabinSelect.selectedIndex].text;
    passengersTrigger.textContent = `${parts.join(', ')}, ${cabinLabel}`;
  }

  function stepper(idPrefix, get, set, min, max) {
    const dec = document.getElementById(`${idPrefix}-decrement`) || document.querySelector(`[data-testid="${idPrefix}-decrement"]`);
    const inc = document.getElementById(`${idPrefix}-increment`) || document.querySelector(`[data-testid="${idPrefix}-increment"]`);
    const count = document.querySelector(`[data-testid="${idPrefix}-count"]`);
    dec.addEventListener('click', () => { if (get() > min) { set(get() - 1); count.textContent = get(); dec.disabled = get() <= min; updatePassengerSummary(); } });
    inc.addEventListener('click', () => { if (get() < max) { set(get() + 1); count.textContent = get(); updatePassengerSummary(); } });
    dec.disabled = get() <= min;
  }

  stepper('adults', () => adults, (v) => adults = v, 1, 6);
  stepper('children', () => children, (v) => children = v, 0, 5);
  cabinSelect.addEventListener('change', updatePassengerSummary);

  passengersTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.dp-popover.open').forEach(p => { if (p !== passengersPopover) p.classList.remove('open'); });
    passengersPopover.classList.toggle('open');
  });
  document.getElementById('passengers-done').addEventListener('click', () => passengersPopover.classList.remove('open'));
  document.addEventListener('click', (e) => {
    if (!document.getElementById('passengers-field').contains(e.target)) passengersPopover.classList.remove('open');
  });

  // ---------- validation + submit ----------
  function setFieldError(fieldId, hasError) {
    document.getElementById(fieldId).classList.toggle('invalid', hasError);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const isRoundtrip = form.tripType.value === 'roundtrip';
    let valid = true;

    if (!selectedFrom) { setFieldError('from-field', true); valid = false; }
    if (!selectedTo) { setFieldError('to-field', true); valid = false; }
    if (selectedFrom && selectedTo && selectedFrom.code === selectedTo.code) {
      setFieldError('to-field', true); valid = false;
    }
    if (!departDp.getValue()) { setFieldError('depart-field', true); valid = false; }
    if (isRoundtrip && !returnDp.getValue()) { setFieldError('return-field', true); valid = false; }

    if (!valid) return;

    const searchParams = {
      tripType: form.tripType.value,
      from: selectedFrom.code,
      fromCity: selectedFrom.city,
      fromLabel: fromInput.value,
      to: selectedTo.code,
      toCity: selectedTo.city,
      toLabel: toInput.value,
      date: departDp.getValue(),
      returnDate: isRoundtrip ? returnDp.getValue() : null,
      adults,
      children,
      cabin: cabinSelect.value
    };
    Store.set('searchParams', searchParams);
    Store.clear('outboundFlight');
    Store.clear('returnFlight');
    window.location.href = '/results.html';
  });
});
