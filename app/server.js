const express = require("express");
const path = require("path");
const crypto = require("crypto");
const airports = require("./data/airports.json");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ============================================================
// Auth (cookie-based sessions, deliberately hand-rolled so the
// whole auth story is visible in one file for a demo/portfolio site)
// ============================================================
const SESSION_COOKIE = "mockjet_session";
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const sessions = new Map(); // token -> { email, name, expiresAt }
const bookingsByEmail = new Map(); // email -> array of booking objects

const USERS = [
  {
    email: "test@mockjet.dev",
    password: "Test1234!",
    name: "Alex Rivera",
    status: "active",
    tier: "basic",
    phone: "(555) 010-2020",
    dob: "1990-05-14",
    passport: "X1234567",
    payment: { cardName: "Alex Rivera", last4: "1111", expiry: "12/28" },
  },
  {
    email: "silver@mockjet.dev",
    password: "Test1234!",
    name: "Morgan Lee",
    status: "active",
    tier: "silver",
    phone: "(555) 010-3030",
    dob: "1985-11-02",
    passport: "Y2345678",
    payment: { cardName: "Morgan Lee", last4: "2222", expiry: "08/27" },
  },
  {
    email: "gold@mockjet.dev",
    password: "Test1234!",
    name: "John Carter",
    status: "active",
    tier: "gold",
    phone: "(555) 010-4040",
    dob: "1978-03-27",
    passport: "Z3456789",
    payment: { cardName: "John Carter", last4: "3333", expiry: "03/29" },
  },
  {
    email: "locked@mockjet.dev",
    password: "Test1234!",
    name: "Locked Account",
    status: "locked",
    tier: "basic",
    phone: "",
    dob: "",
    passport: "",
  },
];

function findUserByEmail(email) {
  return USERS.find(
    (u) => u.email.toLowerCase() === String(email || "").toLowerCase(),
  );
}

// Tier benefit: Silver/Gold get free checked bags on economy fares.
// Premium/business already include a bag, so the perk only applies to economy.
function tierCheckedBags(user) {
  if (!user) return 0;
  if (user.tier === "gold") return 2;
  if (user.tier === "silver") return 1;
  return 0;
}

// 6-character uppercase alphanumeric confirmation code (e.g. "K7Q2MZ")
const CONFIRMATION_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function randomConfirmationCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code +=
      CONFIRMATION_ALPHABET[
        Math.floor(Math.random() * CONFIRMATION_ALPHABET.length)
      ];
  }
  return code;
}

function seedBookings() {
  const seedFlight = (overrides) => ({
    airline: "SkyBridge Air",
    airlineCode: "SB",
    flightNumber: "SB482",
    from: "DTW",
    to: "JFK",
    date: "2026-09-14",
    departTime: "08:15",
    arriveTime: "10:02",
    durationMinutes: 107,
    stops: 0,
    stopCities: [],
    price: 214,
    cabin: "economy",
    seatsLeft: 6,
    baggage: { carryOn: true, checked: 0 },
    gate: "C12",
    ...overrides,
  });

  bookingsByEmail.set("test@mockjet.dev", [
    {
      confirmationCode: randomConfirmationCode(),
      bookedAt: "2026-07-02T14:20:00.000Z",
      bookedBy: "test@mockjet.dev",
      status: "confirmed",
      outbound: seedFlight({
        from: "DTW",
        to: "JFK",
        date: "2026-09-14",
        flightNumber: "SB482",
      }),
      returnFlight: seedFlight({
        from: "JFK",
        to: "DTW",
        date: "2026-09-21",
        flightNumber: "SB491",
        departTime: "17:40",
        arriveTime: "19:26",
      }),
      passengers: [{ seat: 1, name: "Alex Rivera", passport: "X1234567" }],
      contact: { email: "test@mockjet.dev", phone: "(555) 010-2020" },
      total: 428,
      seatAssignment: null,
      boardingGroup: null,
    },
    {
      confirmationCode: randomConfirmationCode(),
      bookedAt: "2026-05-11T09:05:00.000Z",
      bookedBy: "test@mockjet.dev",
      status: "checked-in",
      outbound: seedFlight({
        from: "SFO",
        to: "ORD",
        date: "2026-08-20",
        flightNumber: "AU177",
        airline: "Aurora Airlines",
        airlineCode: "AU",
        gate: "B7",
      }),
      returnFlight: null,
      passengers: [{ seat: 1, name: "Alex Rivera", passport: "X1234567" }],
      contact: { email: "test@mockjet.dev", phone: "(555) 010-2020" },
      total: 189,
      seatAssignment: "14C",
      boardingGroup: "3",
    },
    {
      confirmationCode: randomConfirmationCode(),
      bookedAt: "2026-04-01T11:45:00.000Z",
      bookedBy: "test@mockjet.dev",
      status: "cancelled",
      outbound: seedFlight({
        from: "MIA",
        to: "BOS",
        date: "2026-06-02",
        flightNumber: "CW309",
        airline: "Continental Wing",
        airlineCode: "CW",
        gate: "A4",
      }),
      returnFlight: seedFlight({
        from: "BOS",
        to: "MIA",
        date: "2026-06-09",
        flightNumber: "CW310",
        airline: "Continental Wing",
        airlineCode: "CW",
        departTime: "20:10",
        arriveTime: "23:15",
      }),
      passengers: [{ seat: 1, name: "Alex Rivera", passport: "X1234567" }],
      contact: { email: "test@mockjet.dev", phone: "(555) 010-2020" },
      total: 356,
      seatAssignment: null,
      boardingGroup: null,
    },
  ]);

  bookingsByEmail.set("silver@mockjet.dev", [
    {
      confirmationCode: randomConfirmationCode(),
      bookedAt: "2026-06-18T10:30:00.000Z",
      bookedBy: "silver@mockjet.dev",
      status: "confirmed",
      outbound: seedFlight({
        from: "LAX",
        to: "SEA",
        date: "2026-10-02",
        flightNumber: "PC221",
        airline: "Pacific Crest Airways",
        airlineCode: "PC",
        gate: "D3",
      }),
      returnFlight: seedFlight({
        from: "SEA",
        to: "LAX",
        date: "2026-10-09",
        flightNumber: "PC222",
        airline: "Pacific Crest Airways",
        airlineCode: "PC",
        departTime: "14:25",
        arriveTime: "16:40",
        gate: "A9",
      }),
      passengers: [{ seat: 1, name: "Morgan Lee", passport: "Y2345678" }],
      contact: { email: "silver@mockjet.dev", phone: "(555) 010-3030" },
      total: 312,
      seatAssignment: null,
      boardingGroup: null,
    },
    {
      confirmationCode: randomConfirmationCode(),
      bookedAt: "2026-03-22T16:10:00.000Z",
      bookedBy: "silver@mockjet.dev",
      status: "checked-in",
      outbound: seedFlight({
        from: "DEN",
        to: "PHX",
        date: "2026-07-15",
        flightNumber: "NS88",
        airline: "Northern Star Air",
        airlineCode: "NS",
        gate: "B2",
      }),
      returnFlight: null,
      passengers: [{ seat: 1, name: "Morgan Lee", passport: "Y2345678" }],
      contact: { email: "silver@mockjet.dev", phone: "(555) 010-3030" },
      total: 148,
      seatAssignment: "9A",
      boardingGroup: "2",
    },
  ]);

  bookingsByEmail.set("gold@mockjet.dev", [
    {
      confirmationCode: randomConfirmationCode(),
      bookedAt: "2026-07-28T08:45:00.000Z",
      bookedBy: "gold@mockjet.dev",
      status: "confirmed",
      outbound: seedFlight({
        from: "JFK",
        to: "LHR",
        date: "2026-11-05",
        flightNumber: "SB900",
        cabin: "business",
        price: 1890,
        gate: "E7",
      }),
      returnFlight: seedFlight({
        from: "LHR",
        to: "JFK",
        date: "2026-11-12",
        flightNumber: "SB901",
        cabin: "business",
        price: 1890,
        departTime: "11:20",
        arriveTime: "14:05",
        gate: "F2",
      }),
      passengers: [{ seat: 1, name: "John Carter", passport: "Z3456789" }],
      contact: { email: "gold@mockjet.dev", phone: "(555) 010-4040" },
      total: 3780,
      seatAssignment: null,
      boardingGroup: null,
    },
    {
      confirmationCode: randomConfirmationCode(),
      bookedAt: "2026-05-30T13:20:00.000Z",
      bookedBy: "gold@mockjet.dev",
      status: "checked-in",
      outbound: seedFlight({
        from: "SFO",
        to: "JFK",
        date: "2026-08-28",
        flightNumber: "AU188",
        airline: "Aurora Airlines",
        airlineCode: "AU",
        cabin: "premium",
        price: 640,
        gate: "C5",
      }),
      returnFlight: null,
      passengers: [{ seat: 1, name: "John Carter", passport: "Z3456789" }],
      contact: { email: "gold@mockjet.dev", phone: "(555) 010-4040" },
      total: 640,
      seatAssignment: "2A",
      boardingGroup: "1",
    },
    {
      confirmationCode: randomConfirmationCode(),
      bookedAt: "2026-04-14T09:15:00.000Z",
      bookedBy: "gold@mockjet.dev",
      status: "confirmed",
      outbound: seedFlight({
        from: "ORD",
        to: "MIA",
        date: "2026-12-18",
        flightNumber: "CW410",
        airline: "Continental Wing",
        airlineCode: "CW",
        cabin: "premium",
        price: 520,
        gate: "B11",
      }),
      returnFlight: seedFlight({
        from: "MIA",
        to: "ORD",
        date: "2026-12-26",
        flightNumber: "CW411",
        airline: "Continental Wing",
        airlineCode: "CW",
        cabin: "premium",
        price: 520,
        departTime: "18:35",
        arriveTime: "20:50",
        gate: "A6",
      }),
      passengers: [{ seat: 1, name: "John Carter", passport: "Z3456789" }],
      contact: { email: "gold@mockjet.dev", phone: "(555) 010-4040" },
      total: 1040,
      seatAssignment: null,
      boardingGroup: null,
    },
    {
      confirmationCode: randomConfirmationCode(),
      bookedAt: "2026-02-09T15:40:00.000Z",
      bookedBy: "gold@mockjet.dev",
      status: "cancelled",
      outbound: seedFlight({
        from: "SEA",
        to: "LAS",
        date: "2026-03-20",
        flightNumber: "NS120",
        airline: "Northern Star Air",
        airlineCode: "NS",
        cabin: "economy",
        price: 210,
        gate: "C3",
      }),
      returnFlight: null,
      passengers: [{ seat: 1, name: "John Carter", passport: "Z3456789" }],
      contact: { email: "gold@mockjet.dev", phone: "(555) 010-4040" },
      total: 210,
      seatAssignment: null,
      boardingGroup: null,
    },
  ]);
}
seedBookings();

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = decodeURIComponent(pair.slice(idx + 1).trim());
    cookies[key] = val;
  });
  return cookies;
}

function getSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function requireSessionOr401(req, res) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "Please sign in to view this." });
    return null;
  }
  return session;
}

app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  const delay = 500 + Math.random() * 300;

  setTimeout(() => {
    const user = USERS.find(
      (u) => u.email.toLowerCase() === String(email || "").toLowerCase(),
    );
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }
    if (user.status === "locked") {
      return res.status(423).json({
        error: "This account is locked. Contact support to regain access.",
      });
    }

    const token = crypto.randomBytes(24).toString("hex");
    sessions.set(token, {
      email: user.email,
      name: user.name,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });

    res.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`,
    );
    res.json({ email: user.email, name: user.name });
  }, delay);
});

app.post("/api/logout", (req, res) => {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
  );
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "Not signed in." });
  const user = findUserByEmail(session.email);
  if (!user) return res.status(401).json({ error: "Not signed in." });
  res.json({
    email: user.email,
    name: user.name,
    phone: user.phone,
    dob: user.dob,
    passport: user.passport,
    tier: user.tier,
    payment: user.payment,
  });
});

app.patch("/api/me", (req, res) => {
  const session = requireSessionOr401(req, res);
  if (!session) return;
  const user = findUserByEmail(session.email);
  if (!user) return res.status(401).json({ error: "Not signed in." });

  const { name, phone, dob, passport, payment } = req.body || {};
  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: "Full name cannot be empty." });
  }

  if (name !== undefined) user.name = String(name).trim();
  if (phone !== undefined) user.phone = String(phone).trim();
  if (dob !== undefined) user.dob = String(dob).trim();
  if (passport !== undefined) user.passport = String(passport).trim();
  if (payment !== undefined) user.payment = payment;

  // Keep the session's cached name in sync so the header greeting updates immediately.
  session.name = user.name;

  res.json({
    email: user.email,
    name: user.name,
    phone: user.phone,
    dob: user.dob,
    passport: user.passport,
  });
});

const AIRLINES = [
  { code: "SB", name: "SkyBridge Air" },
  { code: "AU", name: "Aurora Airlines" },
  { code: "CW", name: "Continental Wing" },
  { code: "NS", name: "Northern Star Air" },
  { code: "PC", name: "Pacific Crest Airways" },
];

const CABINS = ["economy", "premium", "business"];

// --- deterministic PRNG so the same search always returns the same results ---
function seededRandom(seedStr) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  return function () {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function minutesToClock(mins) {
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function generateFlights(from, to, date, cabin) {
  const rand = seededRandom(`${from}-${to}-${date}-${cabin || "economy"}`);
  const count = 4 + Math.floor(rand() * 4); // 4-7 flights
  const flights = [];

  for (let i = 0; i < count; i++) {
    const airline = AIRLINES[Math.floor(rand() * AIRLINES.length)];
    const flightNumber = `${airline.code}${100 + Math.floor(rand() * 899)}`;
    const departMinutes = Math.floor(rand() * 1380);
    const durationMinutes = 90 + Math.floor(rand() * 480);
    const stops = rand() < 0.45 ? 0 : rand() < 0.8 ? 1 : 2;
    const basePrice = 89 + Math.floor(rand() * 650);
    const cabinMultiplier =
      cabin === "business" ? 3.4 : cabin === "premium" ? 1.7 : 1;
    const price = Math.round(basePrice * cabinMultiplier);
    const stopCities = [];
    for (let s = 0; s < stops; s++) {
      const pool = airports.filter((a) => a.code !== from && a.code !== to);
      stopCities.push(pool[Math.floor(rand() * pool.length)].code);
    }

    flights.push({
      id: `${date}-${from}-${to}-${flightNumber}-${i}`,
      airline: airline.name,
      airlineCode: airline.code,
      flightNumber,
      from,
      to,
      date,
      departTime: minutesToClock(departMinutes),
      arriveTime: minutesToClock(departMinutes + durationMinutes),
      durationMinutes,
      stops,
      stopCities,
      price,
      cabin: cabin || "economy",
      seatsLeft: 1 + Math.floor(rand() * 9),
      baggage: { carryOn: true, checked: cabin === "economy" ? 0 : 1 },
      gate: `${String.fromCharCode(65 + Math.floor(rand() * 6))}${1 + Math.floor(rand() * 30)}`,
    });
  }

  return flights;
}

app.get("/api/airports", (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  const delay = 250 + Math.random() * 200;
  setTimeout(() => {
    if (!q) return res.json([]);
    const matches = airports
      .filter(
        (a) =>
          a.code.toLowerCase().includes(q) ||
          a.city.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q),
      )
      .slice(0, 8);
    res.json(matches);
  }, delay);
});

app.get("/api/flights", (req, res) => {
  const { from, to, date, cabin, simulateError, slow } = req.query;
  const delay = slow ? 3000 : 700 + Math.random() * 500;

  setTimeout(() => {
    if (simulateError) {
      return res.status(500).json({
        error: "Search service is temporarily unavailable. Please try again.",
      });
    }
    if (!from || !to || !date) {
      return res
        .status(400)
        .json({ error: "from, to, and date are required." });
    }
    if (from === to) {
      return res
        .status(400)
        .json({ error: "Origin and destination cannot be the same airport." });
    }
    const flights = generateFlights(from, to, date, cabin);
    res.json({ flights, from, to, date });
  }, delay);
});

app.post("/api/book", (req, res) => {
  const {
    outbound,
    returnFlight,
    passengers,
    contact,
    payment,
    specialRequests,
  } = req.body || {};
  const delay = 900 + Math.random() * 600;
  const session = getSession(req);

  setTimeout(() => {
    if (
      !outbound ||
      !passengers ||
      !passengers.length ||
      !contact ||
      !payment
    ) {
      return res
        .status(400)
        .json({ error: "Missing required booking information." });
    }
    // special requests are optional but capped at 200 characters
    if (specialRequests && specialRequests.trim().length > 200) {
      return res
        .status(400)
        .json({ error: "Special requests must be 200 characters or fewer." });
    }
    // simulate a declined card for negative-path testing
    if (
      payment.cardNumber &&
      payment.cardNumber.replace(/\s/g, "").endsWith("0000")
    ) {
      return res
        .status(402)
        .json({ error: "Payment declined. Please use a different card." });
    }

    const confirmationCode = randomConfirmationCode();
    const total =
      (outbound.price || 0) + (returnFlight ? returnFlight.price : 0);

    const booking = {
      confirmationCode,
      bookedAt: new Date().toISOString(),
      bookedBy: session ? session.email : "guest",
      status: "confirmed",
      outbound,
      returnFlight: returnFlight || null,
      passengers,
      contact,
      specialRequests: specialRequests || null,
      total: total * passengers.length,
      seatAssignment: null,
      boardingGroup: null,
    };

    // Stamp the tier baggage benefit so the confirmation page can show it.
    // Only applies to economy fares (premium/business already include a bag).
    const user = session ? findUserByEmail(session.email) : null;
    const bags = outbound.cabin === "economy" ? tierCheckedBags(user) : 0;
    if (bags > 0) {
      booking.tierBenefit = { bags, tier: user.tier };
    }

    // guest bookings aren't tied to an account, so there's nothing to save them against
    if (session) {
      const existing = bookingsByEmail.get(session.email) || [];
      existing.unshift(booking);
      bookingsByEmail.set(session.email, existing);
    }

    res.json(booking);
  }, delay);
});

app.get("/api/bookings", (req, res) => {
  const session = requireSessionOr401(req, res);
  if (!session) return;
  const bookings = bookingsByEmail.get(session.email) || [];
  res.json({ bookings });
});

app.post("/api/bookings/:code/checkin", (req, res) => {
  const session = requireSessionOr401(req, res);
  if (!session) return;

  const bookings = bookingsByEmail.get(session.email) || [];
  const booking = bookings.find((b) => b.confirmationCode === req.params.code);
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  if (booking.status === "cancelled") {
    return res.status(409).json({
      error: "This booking has been cancelled and cannot be checked in.",
    });
  }
  if (booking.status === "checked-in") {
    return res
      .status(409)
      .json({ error: "This booking is already checked in." });
  }

  const row = 3 + Math.floor(Math.random() * 30);
  const seatLetter = "ABCDEF"[Math.floor(Math.random() * 6)];
  booking.status = "checked-in";
  booking.seatAssignment = `${row}${seatLetter}`;
  booking.boardingGroup = String(1 + Math.floor(Math.random() * 5));

  setTimeout(() => res.json(booking), 500 + Math.random() * 300);
});

app.post("/api/bookings/:code/cancel", (req, res) => {
  const session = requireSessionOr401(req, res);
  if (!session) return;

  const bookings = bookingsByEmail.get(session.email) || [];
  const booking = bookings.find((b) => b.confirmationCode === req.params.code);
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  if (booking.status === "cancelled") {
    return res
      .status(409)
      .json({ error: "This booking is already cancelled." });
  }

  booking.status = "cancelled";
  booking.seatAssignment = null;
  booking.boardingGroup = null;

  setTimeout(() => res.json(booking), 500 + Math.random() * 300);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`MockJet demo running at http://localhost:${PORT}`);
});
