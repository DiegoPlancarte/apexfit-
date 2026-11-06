# ApexFit 🏋️‍♂️⚡

> Progressive Overload & Hybrid Fitness Tracker with Offline-First Resilience and Google Sheets Integration.

ApexFit is an offline-first fitness tracking Progressive Web App (PWA) built for lifting and running. It provides instant local data hydration via IndexedDB (`ApexFitDB`), progressive overload tracking, real-world set duration logging (`active_sec`), shoe rotation odometer management, and non-blocking background synchronization with Google Sheets.

---

## Features

- **Progressive Overload Reference**: Automatic extraction of previous session weights, reps, and RIR for every exercise.
- **Real-World Active Time Tracking**: Accurately tracks set duration in seconds (`Active_Sec`) anchored to session start and rest timer completion.
- **Offline-First Resilience**: Instant boot and interaction backed by local IndexedDB (`ApexFitDB`), with an automatic background sync outbox and timeout safeguards.
- **Olympic Weight Plate Spinner & Branding**: Custom 45LB Olympic weight plate animation and branded app icon assets.
- **Running & Fleet Management**: Manual run logging with shoe mileage tracking and a 350-mile retirement threshold.
- **Local Timezone Integrity**: Strict browser-local date and timestamp formatting (`YYYY-MM-DD` and local ISO) to prevent late-evening rollover errors.
- **Weekly Schedule & WOD**: Dynamic weekly split planning and one-tap access to today's workout.

---

## Tech Stack

- **Framework**: React 19 + Vite
- **Storage**: IndexedDB (`ApexFitDB`) + localStorage fallback
- **Backend Sync**: Google Apps Script (Web App) + Google Sheets
- **Testing**: Jest + Babel
- **Code Quality**: ESLint

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Run Test Suite
```bash
npm test
```

### 4. Run Linter
```bash
npm run lint
```

### 5. Production Build
```bash
npm run build
```

---

## License

MIT
