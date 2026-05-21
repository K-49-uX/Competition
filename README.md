# AfyaConnect

Healthcare access platform for refugee camps. Multi-language (EN/SW/FR/AR + RTL),
live queue tickets, clinic locator, health education, emergency SOS, and an admin
dashboard for clinic staff.

## Stack

- **client/** — React 19 + Vite + Tailwind CSS + react-router + react-query +
  react-i18next + react-leaflet + socket.io-client
- **server/** — Node 20 + Express + MongoDB (Mongoose) + Socket.io + JWT +
  bcrypt + Helmet + zod, with optional Firebase Cloud Messaging (FCM) push

## Quick start

Prerequisites: Node 20+, MongoDB (use Atlas, a local install, or Docker).

```bash
# 1. Install everything (workspaces)
npm install

# 2. Start MongoDB (option A: Docker)
docker compose up -d
# or point server/.env MONGODB_URI to your Atlas cluster

# 3. Seed sample data (clinics, admin, education content)
npm run seed

# 4. Run client + server together
npm run dev
```

- Client: <http://localhost:5173>
- API: <http://localhost:4000/api/health>

### Default seeded accounts

| Role      | Phone         | Password    |
| --------- | ------------- | ----------- |
| Admin     | +254732501047 | admin1234   |
| Patient   | +254700000001 | patient1234 |
| Clinician | +254700000002 | clinic1234  |

### Smoke test

```bash
npm run smoke
```

### FCM (optional)

Push notifications are stubbed by default. To enable:

1. Create a Firebase project, download the service-account JSON.
2. Save it as `server/firebase-service-account.json`.
3. In `server/.env`, set `FCM_ENABLED=true`.
4. (Web push) Set `VITE_FIREBASE_*` values in `client/.env` and add a service
   worker (`client/public/firebase-messaging-sw.js`).

---

## Original blueprint

To build **AfyaConnect**, you need a robust, scalable architecture that can handle real-time notifications and high traffic in low-resource environments like the Kakuma Refugee Camp.

Below is the full technical architecture and UI design blueprint to guide your coding agents.

---

## 🛠️ System Architecture

The platform should follow a **client-server model** with a focus on mobile-first accessibility.

### 1. Technology Stack

- **Frontend:** React Native or Flutter (for cross-platform iOS/Android support) to ensure a consistent experience.

- **Backend:** Node.js with Express or Python (FastAPI/Django) to manage high-concurrency requests.

- **Database:** PostgreSQL for structured patient records and Redis for real-time queue management.

- **Real-time Communication:** WebSockets (Socket.io) for live queue updates and Firebase Cloud Messaging (FCM) for emergency alerts.

- **Maps/GPS:** Leaflet or Google Maps API for the clinic locator feature.

### 2. Core Modules

- **Auth Module:** Manages secure login/registration.

- **Queue & Booking Engine:** Digitizes the scheduling and real-time numbering system.

- **Notification Engine:** Handles automated health updates and emergency SOS broadcasts.

- **Localization Service:** Manages dynamic text translation between English, French, Swahili, and Arabic.

---

## 🎨 UI/UX Design Blueprint

The interface must be clean, high-contrast, and utilize icons for users with varying literacy levels.

### 1. Multi-Language Entry & Login

- **Splash Screen:** A simple logo with a prominent **Language Toggle** at the top right.
- **Toggle Options:** English, Kiswahili, Français, العربية.

- **Login Page:**
- Fields: Refugee ID Number / Phone Number and Password.
- Buttons: "Login" and "Register New Patient."
- _Note: Must be accessible before any other features are viewed._

### 2. Main Dashboard (Bottom Navigation)

- **Home:** Quick-action buttons for "Book Appointment" and "Clinic Locator".

- **Health Info:** Feed for vaccination campaigns and disease alerts.

- **Education:** Categories for Hygiene, Nutrition, and Maternal Health.

- **Profile:** Personal health history and language settings.

### 3. Key Feature Screens

- **Appointment/Queue Screen:** \* Displays current "Live Ticket Number" and "Estimated Wait Time" to reduce clinic congestion.

- **Clinic Locator:** \* An interactive map showing the nearest pharmacies and emergency centers with "Get Directions" buttons.

- **Emergency SOS Button:** \* A large, red floating action button (FAB) on every screen. Pressing it triggers an immediate alert to healthcare providers with the user's location.

---

## 📋 Implementation Tasks for Coding Agents

1.  **Frontend Agent:** Create a responsive UI that supports Right-to-Left (RTL) formatting for the Arabic language toggle.

2.  **Backend Agent:** Build a RESTful API for appointment scheduling and implement a logic-heavy queue management system.

3.  **Database Agent:** Design a schema that links Patient IDs to multiple appointments, medical notifications, and localized health education content.

4.  **Security Agent:** Ensure all patient data is encrypted and that the emergency SOS system has a high-priority "fail-safe" protocol.

To ensure **AfyaConnect** is accessible in a humanitarian setting like Kakuma, the design must be "Mobile-First" for patients using smartphones, while providing a comprehensive dashboard for clinic administrators on laptops.

### 🎨 Visual Identity & Style Guide

The color palette is designed to be calming, professional, and high-contrast for readability in outdoor or low-light conditions.

- **Primary Blue (`#0056b3`):** Trust and healthcare.
- **Success Green (`#28a745`):** Appointment confirmations and health.
- **Emergency Red (`#dc3545`):** SOS alerts and critical warnings.

- **Neutral Gray (`#f8f9fa`):** Background for reduced eye strain.
- **Typography:** Sans-serif fonts (like Inter or Roboto) for clarity across English, French, Swahili, and Arabic.

---

### 💻 Responsive CSS Framework

This CSS uses a **CSS Grid** and **Flexbox** approach to automatically switch between a mobile-stack and a laptop-wide layout.

```css
/* Core Variables */
:root {
  --primary: #0056b3;
  --secondary: #6c757d;
  --success: #28a745;
  --danger: #dc3545;
  --light: #f8f9fa;
  --dark: #343a40;
  --shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* Base Responsive Layout */
.container {
  display: grid;
  grid-template-columns: 1fr; /* Mobile default */
  gap: 20px;
  padding: 15px;
}

@media (min-width: 1024px) {
  .container {
    grid-template-columns: 250px 1fr; /* Laptop: Sidebar + Content */
  }
}

/* The Language Toggle */
.lang-toggle {
  display: flex;
  justify-content: flex-end;
  padding: 10px;
  background: var(--light);
}

/* Feature Cards */
.card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: var(--shadow);
  transition: transform 0.2s;
  border-left: 5px solid var(--primary); /* Visual accent */
}

.card:hover {
  transform: translateY(-5px);
}

/* Emergency SOS Button */
.sos-btn {
  background: var(--danger);
  color: white;
  font-weight: bold;
  border-radius: 50px;
  padding: 15px 30px;
  position: fixed;
  bottom: 20px;
  right: 20px;
  box-shadow: 0 4px 15px rgba(220, 53, 69, 0.4);
}
```

---

### 📱 UI Components & Layouts

#### 1. The Secure Login (Mobile & Laptop)

- **Design:** A centralized card with the AfyaConnect logo.

- **Function:** Features the mandatory language toggle (English, Swahili, French, Arabic) at the top.

- **Laptop View:** Background image of a healthcare setting; login form centered right.
- **Mobile View:** Full-screen white background with large input fields for easy tapping.

#### 2. Patient Dashboard Cards

To address overcrowding and information gaps, the UI uses **Status Cards**:

- **Queue Card:** Large bold number (e.g., **"Your Turn: #12"**) with a real-time progress bar to reduce clinic congestion.

- **Announcement Card:** A scrolling ticker for vaccination campaigns or disease outbreak alerts.

- **Map Card:** A mini-map showing the nearest clinic or pharmacy for faster navigation.

#### 3. Health Education Section (Laptop Optimized)

- **Layout:** A "Bento-grid" of cards.
- **Content:** Visual icons for Hygiene, Nutrition, and Maternal health.

- **Accessibility:** On laptops, this expands into a sidebar for easy browsing; on mobile, it becomes a horizontal scrollable list.

---

### 🌍 Global Support (RTL/LTR)

For the **Arabic** toggle, your coding agents must implement `direction: rtl;`.

- **Alignment:** Icons move to the right, and text flows right-to-left to ensure the platform is inclusive for diverse refugee populations.

- **Navigation:** The "Back" arrow flips direction to remain intuitive.
