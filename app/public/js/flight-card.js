// Deliberately built as a Shadow DOM custom element. Playwright can still pierce
// an open shadow root with normal locators, but it's a good gap to practice against
// since most demo sites never exercise it.

class FlightCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._flight = null;
    this._selected = false;
  }

  set flight(value) {
    if (this._flight === value) return;
    this._flight = value;
    this.render();
  }
  get flight() {
    return this._flight;
  }

  set selected(value) {
    if (this._selected === value) return;
    this._selected = value;
    this.render();
  }

  connectedCallback() {
    // Moving an already-connected card (e.g. reordering during a re-render)
    // disconnects/reconnects it, which would otherwise re-fetch the linked
    // stylesheet and flash unstyled content (like the tooltip) on every move.
    if (!this._rendered) {
      this.render();
    }
  }

  render() {
    const f = this._flight;
    if (!f) return;
    this._rendered = true;
    const stopsLabel =
      f.stops === 0 ? "Nonstop" : `${f.stops} stop${f.stops > 1 ? "s" : ""}`;
    const stopsBadgeClass = f.stops === 0 ? "badge-nonstop" : "badge-stop";
    const stopCities =
      f.stopCities && f.stopCities.length
        ? ` via ${f.stopCities.join(", ")}`
        : "";

    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="/css/styles.css">
      <style>
        :host { display: block; }
        .card {
          display: flex; align-items: center; gap: 18px;
          background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(249,250,252,0.96));
          border: 1px solid rgba(19, 26, 42, 0.08);
          border-radius: 18px;
          padding: 16px 18px;
          box-shadow: 0 18px 32px rgba(19, 26, 42, 0.06);
          transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
        }
        .card:hover { transform: translateY(-1px); }
        .card.is-selected {
          border-color: rgba(245,165,36,0.9);
          box-shadow: 0 0 0 2px rgba(245,165,36,0.18), 0 18px 32px rgba(19, 26, 42, 0.06);
        }
        .airline { display: flex; flex-direction: column; gap: 4px; min-width: 130px; }
        .airline-name { font-weight: 700; font-size: .9rem; color: var(--navy-950, #131A2A); }
        .flight-no { font-family: 'JetBrains Mono', monospace; font-size: .72rem; color: var(--ink-400, #8792A2); }
        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          font-size: .7rem;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 999px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .badge-nonstop {
          background: rgba(31, 157, 107, 0.12);
          color: var(--success, #1F9D6B);
        }
        .badge-stop {
          background: rgba(245, 165, 36, 0.12);
          color: var(--amber-700, #B9760A);
        }
        .times { display: flex; align-items: center; gap: 12px; flex: 1; font-family: 'JetBrains Mono', monospace; }
        .time-block { text-align: center; }
        .time-block .t { font-size: 1.15rem; font-weight: 700; color: var(--navy-950, #131A2A); }
        .time-block .a { font-size: .72rem; color: var(--ink-400, #8792A2); }
        .mid { flex: 1; text-align: center; font-size: .72rem; color: var(--ink-400, #8792A2); }
        .mid .duration { margin-bottom: 3px; }
        .mid .line { height: 1px; background: var(--line, #DEE3E8); position: relative; margin: 0 6px; }
        .right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; min-width: 130px; }
        .price { font-size: 1.25rem; font-weight: 700; color: var(--navy-950, #131A2A); font-family: 'JetBrains Mono', monospace; }
        .per { font-size: .68rem; color: var(--ink-400, #8792A2); }
        .seats-left { font-size: .72rem; color: var(--amber-700, #B9760A); }
        /* Inlined here (duplicated from styles.css) so the tooltip starts
           hidden immediately, instead of flashing visible while the linked
           stylesheet is still loading inside this shadow root. */
        .tooltip-wrap { position: relative; display: inline-flex; }
        .tooltip-bubble {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: var(--navy-950, #131A2A);
          color: #fff;
          font-size: 0.75rem;
          padding: 6px 10px;
          border-radius: 6px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.12s ease;
          z-index: 10;
        }
        .tooltip-wrap:hover .tooltip-bubble,
        .tooltip-wrap:focus-within .tooltip-bubble {
          opacity: 1;
        }
        button.select-btn {
          padding: .55em 1.2em; border-radius: 9px; border: none;
          background: linear-gradient(180deg, #ffd98e, #f5a524); color: var(--navy-950, #131A2A);
          font-weight: 700; font-size: .85rem; cursor: pointer; font-family: inherit;
          box-shadow: 0 8px 18px rgba(245,165,36,0.2);
        }
        button.select-btn:hover { background: linear-gradient(180deg, #fbe1a4, #f0a711); }
        button.select-btn.is-selected { background: linear-gradient(180deg, #0d172a, #16213b); color: #fff; box-shadow: none; }
        .bag-icon { cursor: default; font-size: .95rem; }
      </style>
      <div class="card ${this._selected ? "is-selected" : ""}" data-testid="flight-card" data-flight-id="${f.id}">
        <div class="airline">
          <span class="airline-name">${f.airline}</span>
          <span class="flight-no">${f.flightNumber}</span>
          <span class="badge ${stopsBadgeClass}">${stopsLabel}</span>
        </div>
        <div class="times">
          <div class="time-block">
            <div class="t">${f.departTime}</div>
            <div class="a">${f.from}</div>
          </div>
          <div class="mid">
            <div class="duration">${formatDuration(f.durationMinutes)}</div>
            <div class="line"></div>
            <div>${stopsLabel}${stopCities}</div>
          </div>
          <div class="time-block">
            <div class="t">${f.arriveTime}</div>
            <div class="a">${f.to}</div>
          </div>
        </div>
        <div class="right">
          <span class="tooltip-wrap bag-icon" tabindex="0" data-testid="baggage-tooltip">
            🧳
            <span class="tooltip-bubble">${f.baggage.checked ? "1 checked bag included" : "Carry-on only \u2014 no checked bag"}</span>
          </span>
          <div class="price" data-testid="flight-price">${formatMoney(f.price)}</div>
          <div class="per">per passenger</div>
          ${f.seatsLeft <= 3 ? `<div class="seats-left" data-testid="seats-left">Only ${f.seatsLeft} left</div>` : ""}
          <button type="button" class="select-btn ${this._selected ? "is-selected" : ""}" data-testid="select-flight-btn">
            ${this._selected ? "Selected \u2713" : "Select"}
          </button>
        </div>
      </div>
    `;

    this.shadowRoot
      .querySelector(".select-btn")
      .addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("flight-select", {
            detail: { flight: f },
            bubbles: true,
            composed: true,
          }),
        );
      });
  }
}

customElements.define("flight-card", FlightCard);
