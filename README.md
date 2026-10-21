# 🏏 ManaNets — Box Cricket & Volleyball Court Booking System

A full-stack, responsive web booking and slot management system for **ManaNets** sports arena.

---

## 📋 Rates & Pricing Rules

### 1. Cricket Nets (2 Nets)
| Facility | Weekdays (Mon–Fri) | Weekends (Sat–Sun) | Special Offer |
| :--- | :--- | :--- | :--- |
| **Net 1 (Small)** | **₹300 / hour** | **₹400 / hour** | **2 + 1 FREE** on Weekdays (Book 3 hours, pay for 2) |
| **Net 2 (Big)** | **₹400 / hour** | **₹500 / hour** | **2 + 1 FREE** on Weekdays (Book 3 hours, pay for 2) |

### 2. Volleyball Court (1 Court)
| Facility | Weekdays (Mon–Fri) | Weekends (Sat–Sun) |
| :--- | :--- | :--- |
| **Volleyball Court** | **₹500 / hour** | **₹600 / hour** |

---

## 🔐 Admin Credentials

- **Portal URL:** `http://localhost:3000/admin`
- **Admin ID:** `ManaNets`
- **Password:** `Nets@1434`

---

## 🚀 Features

- **Public Customer Portal (`/`):**
  - Interactive court switcher (Net 1 Small, Net 2 Big, Volleyball Court).
  - Dynamic calendar picker with automatic weekday/weekend detection.
  - Real-time time slot availability grid (6:00 AM to 10:00 PM).
  - 1, 2, 3, or 4-hour duration selector with automatic **2+1 FREE** calculation badge.
  - Live price breakdown (hourly rate, discounts/free hours, total amount).
  - Customer booking form with validation.
  - Instant confirmation modal with booking ID.

- **Admin Console (`/admin`):**
  - Secure session-based authentication with bcrypt password hashing.
  - Real-time revenue analytics, total bookings, and confirmed slot counters.
  - View all reservations with date/court filters.
  - Mark bookings as **Paid**, **Confirmed**, or **Cancelled**.
  - Manual booking entry for walk-in or phone reservations with optional price overrides.
  - Slot blocker for rain, coaching, or net maintenance.

---

## 🛠️ Step-by-Step Installation & Running

### Step 1: Open Terminal in Project Directory
```powershell
cd "c:\Users\sickm\OneDrive\Documents\Projects\cricket nets"
```

### Step 2: Install Dependencies (Already completed)
```powershell
npm install
```

### Step 3: Start the Application
```powershell
npm start
```

### Step 4: Access the Application
- **Customer Booking Page:** [http://localhost:3000](http://localhost:3000)
- **Admin Management Portal:** [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 📁 Project Structure

```
cricket-nets/
├── server.js              # Express web server & session handling
├── database.js            # SQLite database with schema & queries
├── pricing.js             # Pricing calculator & slot availability engine
├── test-api.js            # Verification test suite
├── package.json           # Project dependencies & scripts
├── .env                   # Environment variables (Admin ID & Password)
├── routes/
│   ├── bookings.js        # Public booking & slot check endpoints
│   └── admin.js           # Admin login, dashboard, & slot management
└── public/
    ├── index.html         # Customer booking UI
    ├── admin-login.html   # Admin authentication UI
    ├── admin-dashboard.html # Admin control console
    ├── css/
    │   └── styles.css     # Sporty dark-themed responsive styles
    └── js/
        ├── booking.js     # Public booking logic & UI handler
        └── admin.js       # Admin dashboard & management handler
```
