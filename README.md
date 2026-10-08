<div align="center">

<img src="public/icon.svg" width="88" alt="WishWatch icon" />

# WishWatch

**English** · [Português](README.pt-BR.md)

A wishlist with price tracking. Paste a product link, note why you want it, and follow its price history with drop alerts.

![React](https://img.shields.io/badge/React_19-292524?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-292524?logo=typescript&logoColor=3178C6)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_4-292524?logo=tailwindcss&logoColor=38BDF8)
![Gemini](https://img.shields.io/badge/Gemini_API-292524?logo=googlegemini&logoColor=8E75B2)
![PWA](https://img.shields.io/badge/PWA-292524?logo=pwa&logoColor=white)

</div>

<p align="center">
  <img src="docs/screenshots/mobile-lista.png" width="260" alt="Product list on mobile" />
  &nbsp;
  <img src="docs/screenshots/mobile-detalhe.png" width="260" alt="Price history for a product" />
</p>

> The app interface is in Brazilian Portuguese and targets Brazilian stores.

## Features

- **Add by link**: Gemini reads the product page and fills in name, store, image, price and category. Works with Amazon, Mercado Livre, Magalu, Kabum, Shopee and other stores.
- **Reason and priority**: each item records why you want it (Need / Want / Wish).
- **Price history**: chart with target price, lowest, average and change since the item was added.
- **24/7 monitoring**: a scheduled GitHub Actions job checks prices every 3 hours, even with the app closed.
- **Push alerts**: price below target, configurable percentage drop, all-time low and back in stock, sent via Web Push to every connected device.
- **Android APK**: built by GitHub Actions (Trusted Web Activity) and published to Releases.
- **Sync**: data lives on the server (Upstash Redis) and is available on any device with the access key. Without a database, the app runs locally on the device.
- **Discount check**: an `INFLATED DISCOUNT` stamp appears when a store shows a "was/now" price the history has already recorded before.
- **Cost in working hours**: given monthly income and hours worked, each product shows how much work time it represents.
- **AI analysis**: an objective recommendation ("Buy now" or "Wait") based on history, trend, reason and priority.
- **Savings tracker**: marking an item as bought adds up the difference between the original price and what you paid.
- **Installable PWA**: works offline for browsing, with a monochrome icon for Android themed icons.
- **Backup**: export and import the wishlist as JSON.

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript, Tailwind CSS 4, Recharts, Lucide |
| Server | Express (`/api` routes), Web Push (`web-push`, VAPID keys generated automatically) |
| Database | Upstash Redis over REST (local file in development) |
| Automation | GitHub Actions: CI, scheduled monitoring and APK build |
| Android | Trusted Web Activity generated with `@bubblewrap/core` |
| AI | `@google/genai` with `gemini-2.5-flash`, using the `urlContext` and `googleSearch` tools |
| PWA | `vite-plugin-pwa` (Workbox), self-hosted fonts via Fontsource |
| Tests | Vitest (alert rules and server-side monitoring) |

## Architecture

```
GitHub Actions (cron, 3 h) ──► POST /api/check-all ──► Gemini (urlContext + googleSearch)
                                      │
             App (PWA / APK) ◄──── Web Push ◄──┤
                    │                          ├──► Upstash Redis
                    └──── /api (access key) ───┘
```

```
server.ts              # Express: /api, assetlinks and static app files
server/
├── api.ts             # routes, price checks and monitoring (checkAll)
├── repo.ts            # products, alerts, settings and push subscriptions
├── db.ts              # Upstash Redis (REST) or local file
└── push.ts            # Web Push with VAPID keys generated on first use
src/
├── components/        # UI (cards, modals, sync)
├── services/
│   ├── alerts.ts            # alert rules (pure, shared by app and server)
│   ├── priceChecker.ts      # price extraction with Gemini
│   ├── purchaseAnalyzer.ts  # purchase analysis with Gemini
│   ├── storage.ts           # local or remote repository, same interface
│   ├── sync.ts / push.ts    # server connection and push subscription
│   └── apiClient.ts
└── sw.ts              # service worker: offline cache, push and notification click
android/generate-twa.mjs  # Android project (TWA) generated in CI
tests/                 # Vitest
```

Design decisions worth noting:

- **The Gemini key stays on the server.** The app only talks to `/api/*`, protected by an access key.
- **Alert rules are pure functions** (`alerts.ts`), shared by local and server modes and covered by tests.
- **One repository, two modes.** `storage.ts` exposes the same interface for `localStorage` and the API, so the app doesn't care where data lives.
- **Low-confidence readings never trigger alerts.** They are flagged for `MANUAL REVIEW` to avoid false notifications.
- **Zero push setup.** VAPID keys are generated on first use and stored in the database.

## Getting started

Requirements: Node.js 22+ and a [Gemini API key](https://aistudio.google.com/apikey).

```bash
npm install
cp .env.example .env.local   # then fill in GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

Without a Gemini key, the app still works with manual entry. Without the Upstash variables, data is stored in `.data/` (development only). To see the app with data, go to **Configurações → Carregar exemplo** (Settings → Load sample).

| Script | What it does |
| --- | --- |
| `npm run dev` | Express server + Vite with hot reload |
| `npm run build` | production build into `dist/` |
| `npm start` | serves the production build |
| `npm run lint` | type check with `tsc` |
| `npm test` | tests with Vitest |
| `npm run icons` | regenerates PWA icons from `scripts/generate-icons.js` |

## Deployment, 24/7 monitoring and APK

The full step-by-step guide (Upstash, Render, GitHub Actions and installing on a phone) is in [docs/CONFIGURACAO.md](docs/CONFIGURACAO.md) (Portuguese).

## Visual identity

The app follows the **Retro Ledger** style: linen background (`#FAF7F2`), off-white cards with a solid 2px shadow, Plus Jakarta Sans for text and Space Mono for numbers. The icon follows Android's monochrome pattern: a gray squircle with a black symbol.

<p align="center">
  <img src="docs/screenshots/desktop-detalhe.png" width="720" alt="Product detail on desktop" />
</p>

## Roadmap

- [x] 24/7 monitoring with GitHub Actions
- [x] Cloud persistence and multi-device sync
- [x] Push notifications and Android APK
- [ ] Browser extension to add products straight from the store page

## License

[MIT](LICENSE)
