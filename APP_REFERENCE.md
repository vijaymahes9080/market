# VJ Analysing the Market — App Reference

## Table of Contents
- [Technical Stack](#technical-stack)
- [File Structure](#file-structure)
- [Desk Inventory](#desk-inventory)
- [Architecture & Data Flow](#architecture--data-flow)
- [UI Design System](#ui-design-system)
- [Live Data & CORS Proxy Strategy](#live-data--cors-proxy-strategy)
- [State Management](#state-management)
- [Known Issues & Limitations](#known-issues--limitations)
- [Future Improvement Roadmap](#future-improvement-roadmap)

---

## Technical Stack

| Dependency | Usage |
|---|---|
| **Tailwind CSS** (CDN) | Utility-first styling, all theming via classes |
| **Chart.js** 4.x (CDN) | All charts (line, doughnut, bar) |
| **Plus Jakarta Sans** (Google Font) | Primary UI font (300–800) |
| **JetBrains Mono** (Google Font) | Numbers, tables, monospace data |
| **Yahoo Finance v8 API** | Live market data (Nifty, Sensex, Bank Nifty, sectoral) |
| **CORS proxies** (5-tier fallback) | Bypass browser CORS for Yahoo API |
| **localStorage** | Theme, beginner mode, auto-saved config, scenarios |

---

## File Structure

```
enrich_wealth_dashboard.html     # ~2575 lines — All HTML (tabs, inputs, desk views)
enrich_wealth_dashboard.js       # ~3115 lines — All JS (calc logic, charts, data fetching, events)
enrich_wealth_dashboard.css      # ~550 lines  — All CSS (glass panels, animations, light-mode overrides)
APP_REFERENCE.md                 # This file
```

**No build step, no bundler** — open `enrich_wealth_dashboard.html` directly in a browser.

---

## Desk Inventory

18 desks total. Each desk has: **tab button** | **sidebar input container** | **desk view div** | **JS calc function** | **badge color**.

| # | Desk (switchDesk key) | Tab Label | Brand Color | Chart | Functions |
|---|---|---|---|---|---|
| 1 | `learner` | Learner's Hub | `amber-500` | — | `updateSimResult()`, `setSimOptionType()` |
| 2 | `options` | Options & Index Desk | `brand-500` | `payoffChartInstance` (line) | `updateAppLayout()`, `renderOptionChain()`, `renderSectorHeatmap()`, `updateVJGauge()`, `calculateGreeks()`, `calculateStrategyPayoff()` |
| 3 | `gold` | Precious Metals Desk | `yellow-500` | `goldAppreciationChartInstance` (line, 4ds) | `calculateGoldDragAppreciation()` |
| 4 | `delivery` | Delivery Hub | `indigo-500` | — | `triggerCronPipeline()`, `closePDFViewer()` |
| 5 | `child` | Child Legacy | `violet-500` | `childLegacyChartInstance` (line, 2ds) | `calculateChildLegacy()` |
| 6 | `debt` | Debt Engine | `rose-500` | `debtAmortChartInstance` (doughnut, 2ds) | `calculateDebtEMI()` |
| 7 | `swp` | SWP Calc | `cyan-500` | `swpDepletionChartInstance` (line) | `calculateSWP()` |
| 8 | `goldReturns` | Gold Returns | `yellow-400` | `goldReturnsChartInstance` (bar) | `calculateGoldReturns()` |
| 9 | `asset` | Asset Allocator | `blue-500` | `assetAllocationChartInstance` (doughnut, 4ds) | `calculateAssetAllocation()` |
| 10 | `sip` | SIP Calc | `emerald-500` | `sipGrowthChartInstance` (line, 2ds) | `calculateSIP()`, `setSIPMode()` |
| 11 | `ppf` | PPF | `amber-600` | — (yearly table) | `calculatePPF()` |
| 12 | `nps` | NPS | `purple-500` | — | `calculateNPS()` |
| 13 | `fd` | FD | `cyan-500` | — | `calculateFD()` |
| 14 | `rd` | RD | `teal-500` | — | `calculateRD()` |
| 15 | `mfLumpsum` | MF Lumpsum | `sky-500` | — (yearly table) | `calculateMFLumpsum()` |
| 16 | `retirement` | Retirement | `rose-500` | — | `calculateRetirement()` |
| 17 | `tax` | Tax Calc | `orange-500` | — | `calculateTax()` |
| 18 | `goldSpot` | Gold Price | `yellow-400` | — | `calculateGoldSpot()` |

### Sidebar Input Container ↔ Desk View Mapping

```
Container ID                 Desk View ID
─────────────────────────────────────────────
optionsInputsContainer       optionsDeskView, learnerDeskView, deliveryDeskView
goldInputsContainer          goldDeskView
childInputsContainer         childDeskView
debtInputsContainer          debtDeskView
swpInputsContainer           swpDeskView
goldReturnsInputsContainer   goldReturnsDeskView
assetInputsContainer         assetDeskView
sipInputsContainer           sipDeskView
ppfInputsContainer           ppfDeskView
npsInputsContainer           npsDeskView
fdInputsContainer            fdDeskView
rdInputsContainer            rdDeskView
mfLumpsumInputsContainer     mfLumpsumDeskView
retirementInputsContainer    retirementDeskView
taxInputsContainer           taxDeskView
goldSpotInputsContainer      goldSpotDeskView
```

---

## Architecture & Data Flow

### Page Load Sequence
```
HTML loads → Tailwind/Chart.js/Fonts CDN loaded
          → enrich_wealth_dashboard.css loads
          → enrich_wealth_dashboard.js loaded (defer)
                → window.onload fires:
                    1. Wire all input event listeners (~80)
                    2. Set beginner mode from localStorage
                    3. Set theme from localStorage
                    4. Restore auto-saved config (Options desk)
                    5. Restore scenarios
                    6. Start live ticker (30s interval, immediate fetch)
                    7. Set default desk to Learner's Hub
                    8. Update layout + charts
```

### SwitchDesk Flow
```
switchDesk('sip')
  → Hide ALL desk views (18 divs + '.hidden')
  → Hide ALL input containers (18 divs + '.hidden')
  → Reset ALL tab buttons to BASE style
  → Show selected desk view & input container
  → Highlight selected tab button (bg-COLOR-500 text-slate-950 shadow)
  → Update badge text & color
  → Call the calc function (e.g. calculateSIP())
  → Optionally call fetchLiveMarketData()
```

### Calculation Pattern (all calculators follow this)
```
function calculateX() {
    // 1. Read inputs with parseFloat/parseInt + defaults
    const input = document.getElementById('inputId')?.value || default;
    
    // 2. Perform calculation
    const result = formula(inputs);
    
    // 3. Format helper (₹ + Indian locale)
    const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');
    
    // 4. Update DOM
    document.getElementById('outputId').innerText = fmt(result);
}
```

---

## UI Design System

### Color Palette by Desk
Each desk uses a consistent accent color across tab (active state), badge, input focus, and output cards:

| Desk | Color | Tailwind Class |
|---|---|---|
| Learner's Hub | Amber | `amber-500` |
| Options | Brand Emerald | `brand-500` (#10b981) |
| Gold (Precious Metals) | Yellow | `yellow-500` |
| Delivery | Indigo | `indigo-500` |
| Child Legacy | Violet | `violet-500` |
| Debt Engine | Rose | `rose-500` |
| SWP | Cyan | `cyan-500` |
| Gold Returns | Yellow | `yellow-400` |
| Asset Allocator | Blue | `blue-500` |
| SIP | Emerald | `emerald-500` |
| PPF | Amber | `amber-600` |
| NPS | Purple | `purple-500` |
| FD | Cyan | `cyan-500` |
| RD | Teal | `teal-500` |
| MF Lumpsum | Sky | `sky-500` |
| Retirement | Rose | `rose-500` |
| Tax | Orange | `orange-500` |
| Gold Price | Yellow | `yellow-400` |

### Glass Panel Design
All panels use: `.glass-panel` class
```
bg-slate-950/80 backdrop-blur
border border-slate-800/60
rounded-2xl shadow-xl
```

### Animation Classes
| Class | Effect | Duration |
|---|---|---|
| `.sip-animate-in` | fade slide up 16px | 0.5s |
| `.sip-animate-in-d1` to `-d7` | staggered delays | 0.05–0.35s |
| `.sip-value-flash` | green glow on value | 0.6s |
| `.sip-return-flash` | white glow on return | 0.6s |
| `.sip-bar-glow` | brightness pulse | 0.8s |
| `.sip-banner-enter` | slide + scale | 0.4s |
| `.sip-mode-active` | ripple box-shadow | 0.5s |
| `.sip-card-hover` | lift + shadow | 0.3s |
| `.glass-panel-hover` | border/bg/glow | 0.25s |
| `.transition-needle` | VJ gauge rotation | 0.6s |
| `tickerScroll` | infinite horizontal scroll | 60s |

### Light Mode
Triggered by `body.light-mode` class. Toggles via `toggleTheme()` saved in `localStorage('vj_theme')`.
All `.light-mode` overrides in CSS remap dark backgrounds to `bg-slate-50/white`, text to `slate-900`, borders to `slate-200`.
Charts are redrawn with light-mode colors on toggle.

### Responsive Layout
```html
<main class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
    <section class="lg:col-span-4">  <!-- Sidebar inputs -->
    <section class="lg:col-span-8">  <!-- Main desk view -->
```

---

## Live Data & CORS Proxy Strategy

### Yahoo Finance Endpoint
```
https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}?interval=1d&range=1d
```

### CORS Proxy Chain (5 tiers, tried in order)
```javascript
const PROXY_LIST = [
    { url: u => `https://corsproxy.io/?${encodeURIComponent(u)}`,     raw: true },
    { url: u => `https://api.cors.syrins.tech/?url=${encodeURIComponent(u)}`, raw: true },
    { url: u => `https://blkproxy.iambhvsh.in/api/proxy?url=${encodeURIComponent(u)}`, raw: true },
    { url: u => `https://proxy.2677929.xyz/${u}`,                     raw: true },
    { url: u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, raw: false }
];
```
- Each request has a **8s timeout** (`AbortSignal.timeout(8000)`)
- `raw: true` → response is the raw Yahoo JSON
- `raw: false` (allorigins) → response is `{ contents: "..." }` wrapper
- Function `fetchWithProxy(yahooUrl)` returns the parsed data if any proxy succeeds
- Throws if all proxies fail

### Indices Fetched (10 total)
```
^NSEI (NIFTY 50), ^NSEBANK (BANK NIFTY), ^BSESN (SENSEX),
^CNXIT (IT), ^CNXENERGY (Energy), ^CNXAUTO (Auto),
^CNXPHARMA (Pharma), ^CNXFMCG (FMCG), ^CNXMETAL (Metal),
^CNXREALTY (Realty)
```

### Fetch Intervals
| Function | Interval | Immediate? |
|---|---|---|
| `fetchLiveTickerData()` | 30s | Yes (on load) |
| `fetchLiveMarketData()` | 60s | Yes (on SIP tab visit) |
| `cycleMarketTicker()` | On click | Yes (manual) |

### Offline Indicator
When all CORS proxies fail, `setOnlineStatus(false)` is called:
- Sync dot turns grey (no pulse)
- Text shows "offline" in red
- SIP desk shows "Offline Data" in red

---

## State Management

### Global `state` Object
```javascript
const state = {
    spotPrice: 23622.90,          // Updated by live sync
    volatility: 14.5,
    daysToExpiry: 28,
    indiaVix: 12.8,
    mmiIndex: 58.4,
    lotMultiplier: 75,
    legs: [],                      // Strategy builder legs
    activeDesk: 'learner',
    savedScenarios: [],            // Scenario manager
    cronStep: 0,
    cronInterval: null,
    heatmapMode: 'sectors',
    physicalGst: 3.0, physicalMaking: 5.0, physicalRefinery: 1.0,
    digitalSpread: 3.0, digitalStorage: 0.05,
    beginnerMode: true,
    simOptionType: 'CALL',
    simStrike: 23600, simPremium: 100, simExpirySpot: 23750,
    sipMode: 'regular'
};
```

### Chart Instance Variables
```javascript
let payoffChartInstance, goldAppreciationChartInstance, childLegacyChartInstance,
    debtAmortChartInstance, swpDepletionChartInstance, goldReturnsChartInstance,
    assetAllocationChartInstance, sipGrowthChartInstance,
    fdGrowthChartInstance, rdGrowthChartInstance, ppfGrowthChartInstance,
    npsChartInstance, retirementChartInstance = null;
```
**Pattern:** All charts are destroyed + recreated on each update (no `.update()`).

### localStorage Keys
| Key | Purpose |
|---|---|
| `vj_beginner_mode` | Beginner mode toggle state |
| `vj_theme` | Light/dark mode |
| `vj_auto_config` | Auto-saved Options desk config |
| `vj_scenarios` | Saved scenarios JSON |

---

## Known Issues & Limitations

1. **CORS proxy reliability** — Free proxies (corsproxy.io, allorigins.win) are unreliable and may 403/timeout. The 5-tier fallback improves success rate but doesn't guarantee it. Long-term fix: deploy a free Cloudflare Worker or Vercel serverless function as a dedicated proxy.

2. **No server-side** — All computation is client-side. No user accounts, no persistent data, no backend.

3. **CDN dependency** — App won't render without internet (Tailwind, Chart.js, Fonts all loaded from CDN). Consider bundling or using a service worker for offline.

4. **No testing** — Zero unit tests, zero integration tests. Changes must be manually verified.

5. **Single HTML file is massive** — 2575 lines of inline HTML. Consider splitting into components or using a partial system.

6. **Chart.js destroy+recreate** — Inefficient for real-time updates. Better to use `chart.data.datasets[0].data = newData; chart.update('none');` for smoother updates.

7. **Indian tax regime slabs are hardcoded** — FY 2025-26 new regime slabs are hardcoded. Tax laws change yearly and require manual update.

8. **No accessibility (a11y)** — Missing `aria-*` attributes, keyboard navigation, screen reader labels.

9. **No loading states for AMD** — Ticker strip shows "⏳ Loading..." but individual desk data fetches have no loading spinners.

10. **Yahoo Finance symbols may change** — Some sectoral indices (CNXIT, CNXENERGY) may have deprecated symbols.

---

## Future Improvement Roadmap

### Priority: High

- [ ] **Dedicated CORS proxy** — Deploy a free Cloudflare Worker that proxies Yahoo Finance. Eliminates dependency on unreliable free proxies.
  ```
  // Cloudflare Worker (deploy free):
  addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
  })
  async function handleRequest(request) {
    const url = new URL(request.url).searchParams.get('url')
    const resp = await fetch(url)
    return new Response(resp.body, { headers: { 'Access-Control-Allow-Origin': '*' } })
  }
  ```
- [ ] **Real-time WebSocket data** — For true live ticker, integrate a WebSocket feed (e.g., MarketSmith, TradingView, or NSE WebSocket).
- [ ] **Chart.js update optimization** — Replace `destroy()+new` with `chart.data.datasets[0].data = newData; chart.update('none');` for all charts.
- [ ] **Loading states** — Add skeleton loaders / spinners for all desk views while data is fetched.

### Priority: Medium

- [ ] **Responsive mobile improvements** — Tab bar wraps awkwardly on small screens. Use a horizontal scroll or collapsible hamburger menu for 18+ tabs.
- [ ] **Export to PDF/Excel** — Add download buttons for all calculator result tables.
- [ ] **Compare mode** — Side-by-side comparison (e.g., two SIP scenarios, FD vs RD vs PPF).
- [ ] **Historical data charts** — Add interactive historical performance charts (10Y CAGR, rolling returns) via Yahoo Finance `range=10y` endpoint.
- [ ] **Tax regime auto-update** — Fetch latest tax slabs from a public API instead of hardcoding.
- [ ] **Currency converter** — Add USD/INR gold price conversion for Gold Price desk.
- [ ] **Goal tracking** — Multiple simultaneous goals with progress bars (SIP goal, retirement goal, child goal).

### Priority: Low

- [ ] **Dark mode refinement** — Add more color scheme options (OLED black, sepia, etc.).
- [ ] **Sound effects** — Optional ticker sounds, notification on milestone reach.
- [ ] **Shareable URLs** — Encode calculator state into URL hash for sharing.
- [ ] **PWA support** — Add manifest.json, service worker, offline caching.
- [ ] **i18n** — Hindi or regional language support.
- [ ] **AI recommendations** — Use on-device ML (TensorFlow.js) to suggest asset allocation based on historical patterns.

### Feature Ideas

- **Stock Screener** — Filter stocks by P/E, P/B, dividend yield, market cap.
- **Portfolio Tracker** — Import holdings via CSV, track P&L, generate reports.
- **IPO Calendar** — Upcoming IPOs, GMP tracking, allotment status.
- **Mutual Fund Screener** — Compare expense ratios, rolling returns, fund manager tenure.
- **Technical Indicators** — RSI, MACD, Bollinger Bands charts with overlay on Nifty.
- **Options Strategist** — Suggest option strategies based on market outlook (bullish/bearish/neutral).
- **Tax Loss Harvesting** — Suggest stocks to sell for tax-loss harvesting to offset gains.

---

## Key Calculation Formulas

### SIP (Regular)
```
FV = P × [((1 + r)^n - 1) / r] × (1 + r)
```
Where `P` = monthly SIP, `r` = monthly return rate, `n` = months

### SIP (Step-Up)
Each year the SIP increases by `step%`:
```
FV_y = SIP_y × [((1 + r)^12 - 1) / r] × (1 + r)^(remaining_years * 12)
SIP_y = SIP_0 × (1 + step)^(y - 1)
```

### FD
```
M = P × (1 + r/n)^(n × t)
```
Where `r` = annual rate, `n` = compounding frequency, `t` = years

### RD
Sum of each monthly deposit compounded quarterly to maturity.

### PPF
```
M = (M_prev + Annual_Deposit) × (1 + rate)
```
Iterated yearly for the tenure.

### NPS
```
Corpus = Monthly_Total × [((1 + r)^months - 1) / r] × (1 + r)
LumpSum = Corpus × (1 - annuity%)
Pension = (Corpus × annuity% × annuity_return%) / 12
```

### Retirement Corpus
```
Expense_at_Retire = Current_Expense × (1 + inflation)^years_to_retire
Corpus_Needed = PV of inflation-adjusted expenses for retirement years
Gap = Corpus_Needed - FV(Current_Savings)
Required_SIP = PMT to fill Gap pre-retirement
```

### Tax (Old vs New Regime)
Old regime: progressive slabs with deductions (80C, 80D, HRA, NPS, Home loan).
New regime: lower progressive slabs, no deductions, FY 2025-26 rates.

### Black-Scholes (Options Desk)
```
d1 = [ln(S/K) + (r + σ²/2)T] / (σ√T)
d2 = d1 - σ√T
Call = S × N(d1) - K × e^(-rT) × N(d2)
Put = K × e^(-rT) × N(-d2) - S × N(-d1)
```

---

## Appendix: Complete ID Reference

### Tab Buttons (18)
```
tabLearnerBtn, tabOptionsBtn, tabGoldBtn, tabDeliveryBtn, tabChildBtn,
tabDebtBtn, tabSwpBtn, tabGoldReturnsBtn, tabAssetBtn, tabSIPBtn,
tabPPFBtn, tabNPSBtn, tabFDBtn, tabRDBtn, tabMFLumpsumBtn,
tabRetirementBtn, tabTaxBtn, tabGoldSpotBtn
```

### Utility Functions Pattern
```javascript
const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');
const setTxt = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.innerText = v;
};
```
Use `setTxt` consistently across all calculators for cleaner code.
