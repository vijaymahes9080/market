// State variables
const state = {
    spotPrice: 23622.90,
    volatility: 14.5,
    daysToExpiry: 28,
    indiaVix: 12.8,
    mmiIndex: 58.4,
    lotMultiplier: 75,
    
    // Strategy Builder legs list
    legs: [],
    
    // Active view desk
    activeDesk: 'learner', // Default is learner hub to help beginners immediately!
    
    // Saved scenarios list
    savedScenarios: [],

    // PDF generation console steps
    cronStep: 0,
    cronInterval: null,

    // Heatmap configuration
    heatmapMode: 'sectors',

    // Customizable Precious Metals parameters
    physicalGst: 3.0,
    physicalMaking: 5.0,
    physicalRefinery: 1.0,
    digitalSpread: 3.0,
    digitalStorage: 0.05,

    // Beginner Mode & Simulator
    beginnerMode: true,
    simOptionType: 'CALL',
    simStrike: 23600,
    simPremium: 100,
    simExpirySpot: 23750,

    // SIP Calculator
    sipMode: 'regular'
};

// Preloaded Nifty Index close values for EMA_21 recursive calculations (N = 21 Days)
const HISTORICAL_NIFTY_CLOSES = [
    23450.25, 23512.40, 23420.90, 23395.10, 23508.80, 
    23612.35, 23555.60, 23680.15, 23725.90, 23605.00, 
    23522.45, 23590.20, 23645.75, 23702.40, 23585.10, 
    23490.80, 23565.30, 23620.50, 23658.15, 23602.45
]; // Length = 20. We will append the current spot price as the 21st value.

// Chart instances
let payoffChartInstance = null;
let goldAppreciationChartInstance = null;
let childLegacyChartInstance = null;
let debtAmortChartInstance = null;
let swpDepletionChartInstance = null;
let goldReturnsChartInstance = null;
let assetAllocationChartInstance = null;
let sipGrowthChartInstance = null;
let fdGrowthChartInstance = null;
let rdGrowthChartInstance = null;
let ppfGrowthChartInstance = null;
let npsChartInstance = null;
let retirementChartInstance = null;

// Cumulative Normal Distribution Function (CND)
function cnd(x) {
    const a1 = 0.319381530;
    const a2 = -0.356563782;
    const a3 = 1.781477937;
    const a4 = -1.821255978;
    const a5 = 1.330274429;
    const L = Math.abs(x);
    const K = 1.0 / (1.0 + 0.2316419 * L);
    let w = 1.0 - 1.0 / Math.sqrt(2 * Math.PI) * Math.exp(-L * L / 2) * (a1 * K + a2 * K * K + a3 * Math.pow(K, 3) + a4 * Math.pow(K, 4) + a5 * Math.pow(K, 5));
    if (x < 0) w = 1.0 - w;
    return w;
}

// Probability Density Function (PDF)
function npdf(x) {
    return (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

// Black-Scholes Pricing and Greeks solver
function calculateGreeks(S, K, T_days, r_annual, sigma_annual, optionType) {
    const T = Math.max(0.0001, T_days / 365.0);
    const r = r_annual / 100.0;
    const sigma = sigma_annual / 100.0;

    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);

    let price = 0;
    let delta = 0;
    let theta = 0;

    if (optionType === 'CALL') {
        price = S * cnd(d1) - K * Math.exp(-r * T) * cnd(d2);
        delta = cnd(d1);
        theta = - (S * npdf(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * cnd(d2);
    } else {
        price = K * Math.exp(-r * T) * cnd(-d2) - S * cnd(-d1);
        delta = cnd(d1) - 1;
        theta = - (S * npdf(d1) * sigma) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * cnd(-d2);
    }

    const gamma = npdf(d1) / (S * sigma * Math.sqrt(T));
    const vega = S * Math.sqrt(T) * npdf(d1);

    return {
        price: Math.max(0.05, price),
        delta: delta,
        gamma: gamma,
        theta: theta / 365.0,
        vega: vega / 100.0
    };
}

// EMA 21 Calculator
function calculateEMA21(closes, latestSpot) {
    const fullCloses = [...closes, latestSpot];
    const N = 21;
    const alpha = 2 / (N + 1);
    let ema = fullCloses[0]; // initialize with first value
    
    for (let i = 1; i < fullCloses.length; i++) {
        ema = (fullCloses[i] * alpha) + (ema * (1 - alpha));
    }
    return ema;
}

// Switch workspace tabs — supports 9 desks
function switchDesk(desk) {
    state.activeDesk = desk;
    // Hide all desk views
    ['optionsDeskView','goldDeskView','deliveryDeskView','learnerDeskView',
     'childDeskView','debtDeskView','swpDeskView','goldReturnsDeskView','assetDeskView',
     'sipDeskView','ppfDeskView','npsDeskView','fdDeskView','rdDeskView','mfLumpsumDeskView','retirementDeskView','taxDeskView',
     'goldSpotDeskView'
    ].forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
    // Hide all sidebar containers
    ['optionsInputsContainer','goldInputsContainer','childInputsContainer',
     'debtInputsContainer','swpInputsContainer','goldReturnsInputsContainer','assetInputsContainer',
     'sipInputsContainer','ppfInputsContainer','npsInputsContainer','fdInputsContainer','rdInputsContainer','mfLumpsumInputsContainer','retirementInputsContainer','taxInputsContainer',
     'goldSpotInputsContainer'
    ].forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });

    const badge = document.getElementById('deskTypeBadge');
    const BASE = 'px-3 py-1.5 rounded-lg transition-all duration-200 text-slate-400 hover:text-white';
    // Reset all tab buttons
    ['tabOptionsBtn','tabGoldBtn','tabDeliveryBtn','tabLearnerBtn',
     'tabChildBtn','tabDebtBtn','tabSwpBtn','tabGoldReturnsBtn','tabAssetBtn',
     'tabSIPBtn','tabPPFBtn','tabNPSBtn','tabFDBtn','tabRDBtn','tabMFLumpsumBtn','tabRetirementBtn','tabTaxBtn','tabGoldSpotBtn'
    ].forEach(id => {
        const btn = document.getElementById(id); if (!btn) return;
        if (id === 'tabDeliveryBtn' || id === 'tabLearnerBtn' || id === 'tabChildBtn' || id === 'tabSIPBtn')
            btn.className = BASE + ' flex items-center gap-1.5';
        else btn.className = BASE;
    });

    if (desk === 'options') {
        document.getElementById('optionsDeskView').classList.remove('hidden');
        document.getElementById('optionsInputsContainer').classList.remove('hidden');
        document.getElementById('tabOptionsBtn').className = 'px-3 py-1.5 rounded-lg transition-all duration-200 bg-brand-500 text-slate-950 shadow';
        badge.innerText = 'Options Desk';
        badge.className = 'text-[9px] bg-brand-500/20 text-brand-400 border border-brand-500/30 px-2 py-0.5 rounded-full font-bold';
        updateAppLayout();
    } else if (desk === 'gold') {
        document.getElementById('goldDeskView').classList.remove('hidden');
        document.getElementById('goldInputsContainer').classList.remove('hidden');
        document.getElementById('tabGoldBtn').className = 'px-3 py-1.5 rounded-lg transition-all duration-200 bg-yellow-500 text-slate-950 shadow';
        badge.innerText = 'Gold Desk';
        badge.className = 'text-[9px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full font-bold';
        updateAppLayout();
    } else if (desk === 'delivery') {
        document.getElementById('deliveryDeskView').classList.remove('hidden');
        document.getElementById('optionsInputsContainer').classList.remove('hidden');
        document.getElementById('tabDeliveryBtn').className = 'px-3 py-1.5 rounded-lg transition-all duration-200 bg-indigo-500 text-slate-950 shadow flex items-center gap-1.5';
        badge.innerText = 'Delivery Desk';
        badge.className = 'text-[9px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold';
    } else if (desk === 'learner') {
        document.getElementById('learnerDeskView').classList.remove('hidden');
        document.getElementById('optionsInputsContainer').classList.remove('hidden');
        document.getElementById('tabLearnerBtn').className = 'px-3 py-1.5 rounded-lg transition-all duration-200 bg-amber-500 text-slate-950 shadow flex items-center gap-1.5';
        badge.innerText = "Learner's Hub";
        badge.className = 'text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold';
        updateAppLayout();
    } else if (desk === 'child') {
        document.getElementById('childDeskView').classList.remove('hidden');
        document.getElementById('childInputsContainer').classList.remove('hidden');
        document.getElementById('tabChildBtn').className = 'px-3 py-1.5 rounded-lg transition-all duration-200 bg-violet-500 text-slate-950 shadow flex items-center gap-1.5';
        badge.innerText = 'Child Legacy';
        badge.className = 'text-[9px] bg-violet-500/20 text-violet-400 border border-violet-500/30 px-2 py-0.5 rounded-full font-bold';
        calculateChildLegacy();
    } else if (desk === 'debt') {
        document.getElementById('debtDeskView').classList.remove('hidden');
        document.getElementById('debtInputsContainer').classList.remove('hidden');
        document.getElementById('tabDebtBtn').className = 'px-3 py-1.5 rounded-lg transition-all duration-200 bg-rose-500 text-slate-950 shadow';
        badge.innerText = 'Debt Engine';
        badge.className = 'text-[9px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold';
        calculateDebtEMI();
    } else if (desk === 'swp') {
        document.getElementById('swpDeskView').classList.remove('hidden');
        document.getElementById('swpInputsContainer').classList.remove('hidden');
        document.getElementById('tabSwpBtn').className = 'px-3 py-1.5 rounded-lg transition-all duration-200 bg-cyan-500 text-slate-950 shadow';
        badge.innerText = 'SWP Calculator';
        badge.className = 'text-[9px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full font-bold';
        calculateSWP();
    } else if (desk === 'goldReturns') {
        document.getElementById('goldReturnsDeskView').classList.remove('hidden');
        document.getElementById('goldReturnsInputsContainer').classList.remove('hidden');
        document.getElementById('tabGoldReturnsBtn').className = 'px-3 py-1.5 rounded-lg transition-all duration-200 bg-yellow-400 text-slate-950 shadow';
        badge.innerText = 'Gold Returns';
        badge.className = 'text-[9px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full font-bold';
        calculateGoldReturns();
    } else if (desk === 'asset') {
        document.getElementById('assetDeskView').classList.remove('hidden');
        document.getElementById('assetInputsContainer').classList.remove('hidden');
        document.getElementById('tabAssetBtn').className = 'px-3 py-1.5 rounded-lg transition-all duration-200 bg-blue-500 text-slate-950 shadow';
        badge.innerText = 'Asset Allocator';
        badge.className = 'text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold';
        calculateAssetAllocation();
    } else if (desk === 'sip') {
        document.getElementById('sipDeskView').classList.remove('hidden');
        document.getElementById('sipInputsContainer').classList.remove('hidden');
        document.getElementById('tabSIPBtn').className = 'px-3 py-1.5 rounded-lg transition-all duration-200 bg-emerald-500 text-slate-950 shadow flex items-center gap-1.5';
        badge.innerText = 'SIP Calculator';
        badge.className = 'text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold';
        calculateSIP();
        fetchLiveMarketData();
    } else if (desk === 'ppf') {
        document.getElementById('ppfDeskView').classList.remove('hidden');
        document.getElementById('ppfInputsContainer').classList.remove('hidden');
        document.getElementById('tabPPFBtn').className = 'px-3 py-1.5 rounded-lg transition-all duration-200 bg-amber-600 text-slate-950 shadow';
        badge.innerText = 'PPF Calculator';
        badge.className = 'text-[9px] bg-amber-600/20 text-amber-400 border border-amber-600/30 px-2 py-0.5 rounded-full font-bold';
        calculatePPF();
    } else if (desk === 'nps') {
        document.getElementById('npsDeskView').classList.remove('hidden');
        document.getElementById('npsInputsContainer').classList.remove('hidden');
        document.getElementById('tabNPSBtn').className = 'px-3 py-1.5 rounded-lg transition-all duration-200 bg-purple-500 text-slate-950 shadow';
        badge.innerText = 'NPS Calculator';
        badge.className = 'text-[9px] bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold';
        calculateNPS();
    } else if (desk === 'fd') {
        document.getElementById('fdDeskView').classList.remove('hidden');
        document.getElementById('fdInputsContainer').classList.remove('hidden');
        document.getElementById('tabFDBtn').className = 'px-3 py-1.5 rounded-lg transition-all duration-200 bg-cyan-500 text-slate-950 shadow';
        badge.innerText = 'FD Calculator';
        badge.className = 'text-[9px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full font-bold';
        calculateFD();
    } else if (desk === 'rd') {
        document.getElementById('rdDeskView').classList.remove('hidden');
        document.getElementById('rdInputsContainer').classList.remove('hidden');
        document.getElementById('tabRDBtn').className = 'px-3 py-1.5 rounded-lg transition-all duration-200 bg-teal-500 text-slate-950 shadow';
        badge.innerText = 'RD Calculator';
        badge.className = 'text-[9px] bg-teal-500/20 text-teal-400 border border-teal-500/30 px-2 py-0.5 rounded-full font-bold';
        calculateRD();
    } else if (desk === 'mfLumpsum') {
        document.getElementById('mfLumpsumDeskView').classList.remove('hidden');
        document.getElementById('mfLumpsumInputsContainer').classList.remove('hidden');
        document.getElementById('tabMFLumpsumBtn').className = 'px-3 py-1.5 rounded-lg transition-all duration-200 bg-sky-500 text-slate-950 shadow';
        badge.innerText = 'MF Lumpsum';
        badge.className = 'text-[9px] bg-sky-500/20 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded-full font-bold';
        calculateMFLumpsum();
    } else if (desk === 'retirement') {
        document.getElementById('retirementDeskView').classList.remove('hidden');
        document.getElementById('retirementInputsContainer').classList.remove('hidden');
        document.getElementById('tabRetirementBtn').className = 'px-3 py-1.5 rounded-lg transition-all duration-200 bg-rose-500 text-slate-950 shadow';
        badge.innerText = 'Retirement Calculator';
        badge.className = 'text-[9px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold';
        calculateRetirement();
    } else if (desk === 'tax') {
        document.getElementById('taxDeskView').classList.remove('hidden');
        document.getElementById('taxInputsContainer').classList.remove('hidden');
        document.getElementById('tabTaxBtn').className = 'px-3 py-1.5 rounded-lg transition-all duration-200 bg-orange-500 text-slate-950 shadow';
        badge.innerText = 'Tax Calculator';
        badge.className = 'text-[9px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-bold';
        calculateTax();
    } else if (desk === 'goldSpot') {
        document.getElementById('goldSpotDeskView').classList.remove('hidden');
        document.getElementById('goldSpotInputsContainer').classList.remove('hidden');
        document.getElementById('tabGoldSpotBtn').className = 'px-3 py-1.5 rounded-lg transition-all duration-200 bg-yellow-400 text-slate-950 shadow';
        badge.innerText = 'Gold Price';
        badge.className = 'text-[9px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full font-bold';
        calculateGoldSpot();
    }
}

// Beginner Mode Toggle & State management
function toggleBeginnerMode() {
    state.beginnerMode = !state.beginnerMode;
    localStorage.setItem('vj_beginner_mode', state.beginnerMode);
    updateBeginnerModeUI();
}

function updateBeginnerModeUI() {
    const btn = document.getElementById('beginnerToggleBtn');
    const dot = document.getElementById('beginnerIndicatorDot');
    const textSpan = document.getElementById('beginnerToggleText');
    if (!btn || !dot) return;

    if (state.beginnerMode) {
        btn.className = "bg-brand-500/10 border border-brand-500/30 text-brand-400 hover:bg-brand-500/20 px-3 py-1.5 rounded-xl font-bold text-[10px] flex items-center gap-1.5 shadow-inner transition duration-150";
        dot.className = "w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse";
        if (textSpan) textSpan.innerText = "Beginner Mode: ON";
        document.querySelectorAll('.beginner-guide').forEach(el => el.classList.remove('hidden'));
    } else {
        btn.className = "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-xl font-bold text-[10px] flex items-center gap-1.5 shadow-inner transition duration-150";
        dot.className = "w-1.5 h-1.5 rounded-full bg-slate-500";
        if (textSpan) textSpan.innerText = "Beginner Mode: OFF";
        document.querySelectorAll('.beginner-guide').forEach(el => el.classList.add('hidden'));
    }
}

// SIP Calculator Mode Switching
function setSIPMode(mode) {
    state.sipMode = mode;
    // Update sidebar buttons
    ['regular','stepup','lumpsum','goal'].forEach(m => {
        const btn = document.getElementById('sipMode' + m.charAt(0).toUpperCase() + m.slice(1));
        if (!btn) return;
        if (m === mode) {
            btn.className = 'py-1.5 px-2 rounded-lg text-xs font-bold transition-all border bg-emerald-500 text-slate-950 border-emerald-500';
        } else {
            btn.className = 'py-1.5 px-2 rounded-lg text-xs font-bold transition-all border border-slate-700 text-slate-300 hover:text-white';
        }
    });
    // Update main panel buttons
    ['regular','stepup','lumpsum','goal'].forEach(m => {
        const btn = document.getElementById('mainSIPMode' + m.charAt(0).toUpperCase() + m.slice(1));
        if (!btn) return;
        if (m === mode) {
            btn.className = 'py-3 px-3 rounded-xl text-sm font-bold transition-all border bg-emerald-500 text-slate-950 border-emerald-500 shadow-lg shadow-emerald-500/20 flex flex-col items-center gap-1.5';
        } else {
            btn.className = 'py-3 px-3 rounded-xl text-sm font-bold transition-all border border-slate-700 text-slate-300 hover:text-white hover:border-emerald-500/50 flex flex-col items-center gap-1.5';
        }
    });
    // Add ripple animation to active button
    const activeBtn = document.getElementById('mainSIPMode' + mode.charAt(0).toUpperCase() + mode.slice(1));
    if (activeBtn) {
        activeBtn.classList.remove('sip-mode-active');
        void activeBtn.offsetWidth;
        activeBtn.classList.add('sip-mode-active');
    }

    // Toggle visibility of mode-specific rows with smooth animation
    const stepupRow = document.getElementById('sipStepUpRow');
    const lumpsumRow = document.getElementById('sipLumpsumRow');
    const goalRow = document.getElementById('sipGoalRow');
    const existingRow = document.getElementById('sipExistingRow');
    const amountRow = document.getElementById('sipAmountRow');
    const goalBanner = document.getElementById('sipGoalBanner');
    const desc = document.getElementById('sipModeDescription');

    if (stepupRow) stepupRow.classList.toggle('hidden', mode !== 'stepup');
    if (lumpsumRow) lumpsumRow.classList.toggle('hidden', mode !== 'lumpsum');
    if (goalRow) goalRow.classList.toggle('hidden', mode !== 'goal');
    if (existingRow) existingRow.classList.toggle('hidden', mode !== 'goal');
    if (amountRow) amountRow.classList.toggle('hidden', mode === 'goal');
    if (goalBanner) {
        const isGoal = mode === 'goal';
        if (!isGoal) {
            goalBanner.classList.add('hidden');
        } else {
            goalBanner.classList.remove('hidden');
            goalBanner.classList.remove('sip-banner-enter');
            void goalBanner.offsetWidth;
            goalBanner.classList.add('sip-banner-enter');
        }
    }
    if (desc) {
        if (mode === 'regular') desc.innerText = 'Fixed monthly investment compounded at your chosen rate of return.';
        else if (mode === 'stepup') desc.innerText = 'Monthly SIP increases by a fixed % each year to match income growth.';
        else if (mode === 'lumpsum') desc.innerText = 'One-time lump sum investment plus monthly SIP contributions.';
        else desc.innerText = 'Enter your target corpus — we calculate the exact monthly SIP needed.';
    }
    calculateSIP();
}

// Options Expiry Simulator handlers on Learner's Hub
function setSimOptionType(type) {
    state.simOptionType = type;
    const callBtn = document.getElementById('simCallBtn');
    const putBtn = document.getElementById('simPutBtn');
    if (!callBtn || !putBtn) return;

    if (type === 'CALL') {
        callBtn.className = "flex-grow py-2 rounded-lg text-xs font-bold transition border bg-brand-500 text-slate-950 border-brand-500 shadow";
        putBtn.className = "flex-grow py-2 rounded-lg text-xs font-bold transition border border-slate-800 text-slate-400 hover:text-white";
    } else {
        callBtn.className = "flex-grow py-2 rounded-lg text-xs font-bold transition border border-slate-800 text-slate-400 hover:text-white";
        putBtn.className = "flex-grow py-2 rounded-lg text-xs font-bold transition border bg-red-500 text-slate-950 border-red-500 shadow";
    }
    updateSimResult();
}

function updateSimResult() {
    state.simStrike = parseFloat(document.getElementById('simStrike').value) || 23600;
    state.simPremium = parseFloat(document.getElementById('simPremium').value) || 100;
    state.simExpirySpot = parseFloat(document.getElementById('simExpirySpot').value) || 23750;
    
    if (!state.simOptionType) state.simOptionType = 'CALL';
    
    document.getElementById('simPremiumVal').innerText = "₹" + state.simPremium;
    document.getElementById('simExpirySpotVal').innerText = "₹" + state.simExpirySpot.toLocaleString('en-IN');

    const lotSize = 75; // Nifty default
    const initialCost = state.simPremium * lotSize;
    
    let expiryVal = 0;
    if (state.simOptionType === 'CALL') {
        expiryVal = Math.max(state.simExpirySpot - state.simStrike, 0) * lotSize;
    } else {
        expiryVal = Math.max(state.simStrike - state.simExpirySpot, 0) * lotSize;
    }
    
    const netPL = expiryVal - initialCost;
    const yieldPct = (netPL / initialCost) * 100;

    const simPLCard = document.getElementById('simPLCard');
    const simPLVal = document.getElementById('simPLVal');
    const simPLPercent = document.getElementById('simPLPercent');
    const simStateLabel = document.getElementById('simStateLabel');
    const simStateDesc = document.getElementById('simStateDesc');
    const simExp = document.getElementById('simExplanationText');

    if (!simPLCard || !simPLVal || !simPLPercent || !simStateLabel || !simStateDesc || !simExp) return;

    const sign = netPL >= 0 ? '+' : '';
    simPLVal.innerText = sign + "₹" + Math.round(netPL).toLocaleString('en-IN');
    simPLPercent.innerText = `Yield: ${sign}${yieldPct.toFixed(1)}%`;

    if (netPL > 0) {
        simPLCard.className = "p-4 rounded-xl border flex flex-col justify-between bg-emerald-950/20 text-brand-400 border-emerald-500/20 shadow-glow-emerald";
        simStateLabel.innerText = "In-The-Money (Profit!)";
        simStateLabel.className = "text-base font-black text-brand-400 block mt-1";
        simStateDesc.innerText = "Option price closed higher than your net break-even.";
    } else if (netPL === 0) {
        simPLCard.className = "p-4 rounded-xl border flex flex-col justify-between bg-slate-900 text-slate-300 border-slate-800";
        simStateLabel.innerText = "At-The-Money (Breakeven)";
        simStateLabel.className = "text-base font-black text-slate-300 block mt-1";
        simStateDesc.innerText = "Option closed exactly at the breakeven point.";
    } else {
        simPLCard.className = "p-4 rounded-xl border flex flex-col justify-between bg-rose-950/20 text-rose-400 border-rose-500/20 shadow-glow-emerald";
        simStateLabel.innerText = expiryVal > 0 ? "In-The-Money (Partial Loss)" : "Out-Of-The-Money (Full Loss)";
        simStateLabel.className = "text-base font-black text-rose-400 block mt-1";
        simStateDesc.innerText = expiryVal > 0 ? "Option has some value, but does not cover the premium." : "The option expired worthless. You lost the entire premium paid.";
    }

    // Explanatory description text
    if (state.simOptionType === 'CALL') {
        if (state.simExpirySpot > state.simStrike) {
            const diff = state.simExpirySpot - state.simStrike;
            if (netPL > 0) {
                simExp.innerHTML = `You bought a <strong>CALL</strong> option at strike <strong>${state.simStrike}</strong> for <strong>₹${state.simPremium}</strong> premium. Since Nifty rose to <strong>${state.simExpirySpot}</strong>, your option has real value of ₹${diff} per share. After subtracting your purchase cost (₹${state.simPremium}), your net gain is ₹${diff - state.simPremium} per share, making a total profit of <strong>₹${Math.round(netPL).toLocaleString('en-IN')}</strong>!`;
            } else {
                simExp.innerHTML = `You bought a <strong>CALL</strong> option at strike <strong>${state.simStrike}</strong> for <strong>₹${state.simPremium}</strong> premium. Nifty ended at <strong>${state.simExpirySpot}</strong>, giving the option a value of ₹${diff} per share. However, since the rise (₹${diff}) is less than the premium you paid (₹${state.simPremium}), you incurred a partial loss of <strong>₹${Math.round(Math.abs(netPL)).toLocaleString('en-IN')}</strong>.`;
            }
        } else {
            simExp.innerHTML = `You bought a <strong>CALL</strong> option at strike <strong>${state.simStrike}</strong> for <strong>₹${state.simPremium}</strong>. Because Nifty closed at <strong>${state.simExpirySpot}</strong> (below the strike price), you have no right to buy cheap. The option expired completely worthless, and you lost your entire paid premium of <strong>₹${initialCost.toLocaleString('en-IN')}</strong>.`;
        }
    } else {
        // PUT option
        if (state.simExpirySpot < state.simStrike) {
            const diff = state.simStrike - state.simExpirySpot;
            if (netPL > 0) {
                simExp.innerHTML = `You bought a <strong>PUT</strong> option at strike <strong>${state.simStrike}</strong> for <strong>₹${state.simPremium}</strong> premium. Since Nifty dropped to <strong>${state.simExpirySpot}</strong>, you have the right to sell high. Your option has value of ₹${diff} per share. Subtracting your purchase cost (₹${state.simPremium}), your net profit is <strong>₹${Math.round(netPL).toLocaleString('en-IN')}</strong>!`;
            } else {
                simExp.innerHTML = `You bought a <strong>PUT</strong> option at strike <strong>${state.simStrike}</strong> for <strong>₹${state.simPremium}</strong> premium. Nifty ended at <strong>${state.simExpirySpot}</strong>, giving the option a value of ₹${diff} per share. But since the drop (₹${diff}) is less than the premium paid (₹${state.simPremium}), you made a net loss of <strong>₹${Math.round(Math.abs(netPL)).toLocaleString('en-IN')}</strong>.`;
            }
        } else {
            simExp.innerHTML = `You bought a <strong>PUT</strong> option at strike <strong>${state.simStrike}</strong> for <strong>₹${state.simPremium}</strong>. Because Nifty closed at <strong>${state.simExpirySpot}</strong> (above the strike price), you have no advantage in selling low. The option expired worthless, and you lost the entire paid premium of <strong>₹${initialCost.toLocaleString('en-IN')}</strong>.`;
        }
    }
}

// Option chain strikes builder & greeks renderer
function renderOptionChain() {
    const S = state.spotPrice;
    const IV = state.volatility;
    const days = state.daysToExpiry;
    const chainBody = document.getElementById('optionChainBody');
    if (!chainBody) return 1.18;
    chainBody.innerHTML = '';

    // Generate strikes centered around spot price
    const atmStrike = Math.round(S / 100) * 100;
    const strikes = [];
    for (let offset = -500; offset <= 500; offset += 100) {
        strikes.push(atmStrike + offset);
    }

    // Calculate put and call open interest aggregates to compute PCR
    let totalCallOI = 0;
    let totalPutOI = 0;

    strikes.forEach(K => {
        // Black-Scholes Greeks
        const calls = calculateGreeks(S, K, days, 6.0, IV, 'CALL');
        const puts = calculateGreeks(S, K, days, 6.0, IV, 'PUT');

        // Deterministic OI values (bell curves centered slightly OTM)
        const cOI = Math.round(100000 * Math.exp(-Math.pow(K - S - 100, 2) / 200000) * (1 + Math.cos(K / 200) * 0.2));
        const pOI = Math.round(100000 * Math.exp(-Math.pow(S - K - 100, 2) / 200000) * (1 + Math.sin(K / 200) * 0.2));
        
        totalCallOI += cOI;
        totalPutOI += pOI;

        const cChgOI = Math.round(cOI * (Math.sin(K / 100) * 0.15 + 0.05));
        const pChgOI = Math.round(pOI * (Math.cos(K / 100) * 0.15 + 0.05));

        const isItmCall = S > K ? 'itm-highlight-call' : '';
        const isItmPut = S < K ? 'itm-highlight-put' : '';
        const isAtm = Math.abs(S - K) < 50 ? 'bg-slate-900 border-y border-slate-700 font-extrabold text-white' : '';

        const tr = document.createElement('tr');
        tr.className = `hover:bg-slate-900/60 border-b border-slate-900/60 transition-colors`;
        
        tr.innerHTML = `
            <!-- Call parameters -->
            <td class="py-2.5 px-2 border-r border-slate-800/40 font-mono text-slate-400 ${isItmCall}">${cOI.toLocaleString()}</td>
            <td class="py-2.5 px-2 border-r border-slate-800/40 font-mono ${cChgOI >= 0 ? 'text-brand-400' : 'text-rose-400'} ${isItmCall}">${cChgOI >= 0 ? '+' : ''}${cChgOI.toLocaleString()}</td>
            <td class="py-2.5 px-2 border-r border-slate-800/40 font-mono text-slate-400 text-left pl-3 ${isItmCall}">
                <div class="text-[9px] font-bold text-slate-200">Δ: ${calls.delta.toFixed(2)}</div>
                <div class="text-[8px] text-slate-500">Γ: ${calls.gamma.toFixed(4)}</div>
                <div class="text-[8px] text-slate-500">θ: ${calls.theta.toFixed(2)}</div>
                <div class="text-[8px] text-slate-500">ν: ${calls.vega.toFixed(2)}</div>
            </td>
            <td class="py-2.5 px-2 border-r border-slate-800/40 font-mono text-slate-400 ${isItmCall}">₹${(calls.price * 1.01).toFixed(2)}</td>
            <td class="py-2.5 px-2 border-r border-slate-800/40 font-mono text-slate-400 ${isItmCall}">₹${(calls.price * 0.99).toFixed(2)}</td>
            <td class="py-2.5 px-3 ${isItmCall}">
                <button onclick="addChainLeg(${K}, 'CALL', ${(calls.price).toFixed(2)})" class="bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded border border-brand-500/20">Buy Call</button>
            </td>

            <!-- Strike center -->
            <td class="py-2.5 px-4 font-mono font-bold text-slate-200 bg-slate-950 shadow-inner sticky left-0 right-0 z-10 border-x border-slate-800 ${isAtm}">${K}</td>

            <!-- Put parameters -->
            <td class="py-2.5 px-3 ${isItmPut}">
                <button onclick="addChainLeg(${K}, 'PUT', ${(puts.price).toFixed(2)})" class="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/20">Buy Put</button>
            </td>
            <td class="py-2.5 px-2 border-l border-slate-800/40 font-mono text-slate-400 ${isItmPut}">₹${(puts.price * 0.99).toFixed(2)}</td>
            <td class="py-2.5 px-2 border-l border-slate-800/40 font-mono text-slate-400 ${isItmPut}">₹${(puts.price * 1.01).toFixed(2)}</td>
            <td class="py-2.5 px-2 border-l border-slate-800/40 font-mono text-slate-400 text-left pl-3 ${isItmPut}">
                <div class="text-[9px] font-bold text-slate-200">Δ: ${puts.delta.toFixed(2)}</div>
                <div class="text-[8px] text-slate-500">Γ: ${puts.gamma.toFixed(4)}</div>
                <div class="text-[8px] text-slate-500">θ: ${puts.theta.toFixed(2)}</div>
                <div class="text-[8px] text-slate-500">ν: ${puts.vega.toFixed(2)}</div>
            </td>
            <td class="py-2.5 px-2 border-l border-slate-800/40 font-mono ${pChgOI >= 0 ? 'text-brand-400' : 'text-rose-400'} ${isItmPut}">${pChgOI >= 0 ? '+' : ''}${pChgOI.toLocaleString()}</td>
            <td class="py-2.5 px-2 font-mono text-slate-400 ${isItmPut}">${pOI.toLocaleString()}</td>
        `;
        chainBody.appendChild(tr);
    });

    // Set PCR metrics
    const pcrVal = totalPutOI / totalCallOI;
    const pcrText = document.getElementById('optChainPcr');
    if (pcrText) pcrText.innerText = pcrVal.toFixed(2);
    return pcrVal;
}

// Add leg from Options Chain UI
function addChainLeg(strike, type, price) {
    state.legs.push({
        id: Date.now() + Math.random(),
        strike: strike,
        type: type,
        position: 'LONG', // default
        premium: price,
        multiplier: state.lotMultiplier
    });
    updateAppLayout();
}

// Add custom leg manual click
function addNewLeg() {
    const S = state.spotPrice;
    const K = Math.round(S / 100) * 100; // nearest 100 strike
    state.legs.push({
        id: Date.now() + Math.random(),
        strike: K,
        type: 'CALL',
        position: 'LONG',
        premium: 100.0,
        multiplier: state.lotMultiplier
    });
    updateAppLayout();
}

// Apply pre-defined options layouts
function applyStrategyPreset(preset) {
    const S = state.spotPrice;
    const K = Math.round(S / 100) * 100;
    const IV = state.volatility;
    const days = state.daysToExpiry;

    const prem = (strike, type) => {
        return parseFloat(calculateGreeks(S, strike, days, 6.0, IV, type).price.toFixed(2));
    };

    state.legs = [];

    if (preset === 'shortPut') {
        const k1 = K - 200;
        state.legs.push({ id: 1, strike: k1, type: 'PUT', position: 'SHORT', premium: prem(k1, 'PUT'), multiplier: state.lotMultiplier });
    } else if (preset === 'longStraddle') {
        state.legs.push(
            { id: 1, strike: K, type: 'CALL', position: 'LONG', premium: prem(K, 'CALL'), multiplier: state.lotMultiplier },
            { id: 2, strike: K, type: 'PUT', position: 'LONG', premium: prem(K, 'PUT'), multiplier: state.lotMultiplier }
        );
    } else if (preset === 'shortStrangle') {
        const kPut = K - 300;
        const kCall = K + 300;
        state.legs.push(
            { id: 1, strike: kPut, type: 'PUT', position: 'SHORT', premium: prem(kPut, 'PUT'), multiplier: state.lotMultiplier },
            { id: 2, strike: kCall, type: 'CALL', position: 'SHORT', premium: prem(kCall, 'CALL'), multiplier: state.lotMultiplier }
        );
    } else if (preset === 'ironButterfly') {
        const kPutWing = K - 200;
        const kCallWing = K + 200;
        state.legs.push(
            { id: 1, strike: kPutWing, type: 'PUT', position: 'LONG', premium: prem(kPutWing, 'PUT'), multiplier: state.lotMultiplier },
            { id: 2, strike: K, type: 'PUT', position: 'SHORT', premium: prem(K, 'PUT'), multiplier: state.lotMultiplier },
            { id: 3, strike: K, type: 'CALL', position: 'SHORT', premium: prem(K, 'CALL'), multiplier: state.lotMultiplier },
            { id: 4, strike: kCallWing, type: 'CALL', position: 'LONG', premium: prem(kCallWing, 'CALL'), multiplier: state.lotMultiplier }
        );
    } else if (preset === 'ironCondor') {
        const k1 = K - 300;
        const k2 = K - 100;
        const k3 = K + 100;
        const k4 = K + 300;
        state.legs.push(
            { id: 1, strike: k1, type: 'PUT', position: 'LONG', premium: prem(k1, 'PUT'), multiplier: state.lotMultiplier },
            { id: 2, strike: k2, type: 'PUT', position: 'SHORT', premium: prem(k2, 'PUT'), multiplier: state.lotMultiplier },
            { id: 3, strike: k3, type: 'CALL', position: 'SHORT', premium: prem(k3, 'CALL'), multiplier: state.lotMultiplier },
            { id: 4, strike: k4, type: 'CALL', position: 'LONG', premium: prem(k4, 'CALL'), multiplier: state.lotMultiplier }
        );
    }

    // Update beginner Mode strategy explainer card
    const eduText = document.getElementById('strategyEducationText');
    if (eduText) {
        if (preset === 'shortPut') {
            eduText.innerHTML = "💡 <strong>Strategy Insight: Short Put (Income Strategy)</strong><br>You sell a Put option at a strike price lower than the current market. You earn the premium (income) upfront. As long as Nifty closes above your strike at expiry, you keep the full profit. If Nifty drops severely below your strike, you face significant risk.";
        } else if (preset === 'longStraddle') {
            eduText.innerHTML = "💡 <strong>Strategy Insight: Long Straddle (Volatility Breakout)</strong><br>You buy both a Call and a Put at the exact same strike price. You pay two premiums. You profit if Nifty makes a huge, violent move in *either* direction (up or down). If the market stays flat, you lose both premiums due to time decay.";
        } else if (preset === 'shortStrangle') {
            eduText.innerHTML = "💡 <strong>Strategy Insight: Short Strangle (Range-Bound Selling)</strong><br>You sell an out-of-the-money Call and Put. You collect premiums from both. If the market closes flat between your two strikes at expiry, both options expire worthless, and you pocket the full premium. High risk if the market runs up or crashes.";
        } else if (preset === 'ironButterfly') {
            eduText.innerHTML = "💡 <strong>Strategy Insight: Iron Butterfly (Limited-Risk Range Play)</strong><br>A limited-risk strategy that profits if the market ends exactly at your center strike. You sell a central straddle (Call & Put) and buy cheaper protective wings on both sides. High reward relative to risk, but has a narrow profit zone.";
        } else if (preset === 'ironCondor') {
            eduText.innerHTML = "💡 <strong>Strategy Insight: Iron Condor (Low-Risk Stable Income)</strong><br>The ultimate range-bound income strategy. You sell a wider Call & Put spread and buy protective outer wings. You profit if the market closes flat between your breakevens. Limited risk, limited profit, but a high probability of success.";
        }
    }

    updateAppLayout();
}

// Modify individual leg options parameters
function updateLeg(id, field, val) {
    const leg = state.legs.find(l => l.id === id);
    if (!leg) return;
    
    if (field === 'strike' || field === 'premium' || field === 'multiplier') {
        leg[field] = parseFloat(val) || 0;
    } else {
        leg[field] = val;
    }
    updateAppLayout();
}

// Remove leg from list
function deleteLeg(id) {
    state.legs = state.legs.filter(l => l.id !== id);
    updateAppLayout();
}

// Render selected strategy legs configurations
function renderLegsUI() {
    const list = document.getElementById('legsList');
    if (!list) return;
    list.innerHTML = '';

    if (state.legs.length === 0) {
        list.innerHTML = `<span class="text-[10px] text-slate-500 italic block py-2">No active legs in strategy. Select Buy Call/Put above or load presets.</span>`;
        return;
    }

    state.legs.forEach(leg => {
        const div = document.createElement('div');
        div.className = "flex flex-wrap items-center gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-900/60 text-[10px]";
        
        div.innerHTML = `
            <div class="flex items-center gap-1.5 min-w-[70px]">
                <select onchange="updateLeg(${leg.id}, 'position', this.value)" class="bg-slate-900 border border-slate-800 text-white rounded px-1.5 py-1 font-bold">
                    <option value="LONG" ${leg.position === 'LONG' ? 'selected' : ''}>LONG</option>
                    <option value="SHORT" ${leg.position === 'SHORT' ? 'selected' : ''}>SHORT</option>
                </select>
            </div>

            <div class="flex items-center gap-1.5">
                <span class="text-slate-500 font-bold">Strike:</span>
                <input type="number" value="${leg.strike}" onchange="updateLeg(${leg.id}, 'strike', this.value)" class="w-16 bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-white font-bold">
            </div>

            <div class="flex items-center gap-1.5">
                <select onchange="updateLeg(${leg.id}, 'type', this.value)" class="bg-slate-900 border border-slate-800 text-white rounded px-1.5 py-1 font-bold">
                    <option value="CALL" ${leg.type === 'CALL' ? 'selected' : ''}>CALL</option>
                    <option value="PUT" ${leg.type === 'PUT' ? 'selected' : ''}>PUT</option>
                </select>
            </div>

            <div class="flex items-center gap-1.5">
                <span class="text-slate-500 font-bold">Premium:</span>
                <input type="number" value="${leg.premium}" step="0.5" onchange="updateLeg(${leg.id}, 'premium', this.value)" class="w-16 bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-white font-bold">
            </div>

            <div class="flex items-center gap-1.5">
                <span class="text-slate-500 font-bold">Lot:</span>
                <input type="number" value="${leg.multiplier}" onchange="updateLeg(${leg.id}, 'multiplier', this.value)" class="w-12 bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-white font-bold">
            </div>

            <button onclick="deleteLeg(${leg.id})" class="text-red-400 hover:text-red-500 p-1 rounded hover:bg-slate-800 ml-auto transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        `;
        list.appendChild(div);
    });
}

// Compute payoff details at expiration
function calculateStrategyPayoff(spotRange) {
    const results = [];
    
    spotRange.forEach(S_T => {
        let payoff = 0;
        
        state.legs.forEach(leg => {
            const K = leg.strike;
            const prem = leg.premium;
            const mult = leg.multiplier;
            let legVal = 0;

            if (leg.type === 'CALL') {
                if (leg.position === 'LONG') {
                    legVal = Math.max(S_T - K, 0) - prem;
                } else {
                    legVal = prem - Math.max(S_T - K, 0);
                }
            } else {
                if (leg.position === 'LONG') {
                    legVal = Math.max(K - S_T, 0) - prem;
                } else {
                    legVal = prem - Math.max(K - S_T, 0);
                }
            }
            payoff += legVal * mult;
        });
        results.push({ spot: S_T, val: payoff });
    });
    return results;
}

// Draw and update options strategies visual payoff profiles
function updateStrategyPayoffCurves() {
    const S = state.spotPrice;
    
    // Build range points around spot price
    const minSpot = Math.round(S * 0.85);
    const maxSpot = Math.round(S * 1.15);
    const step = Math.round((maxSpot - minSpot) / 100);
    
    const spotRange = [];
    for (let p = minSpot; p <= maxSpot; p += step) {
        spotRange.push(p);
    }

    const payoffPoints = calculateStrategyPayoff(spotRange);

    // Compute strategy bounds
    let maxProfit = -Infinity;
    let maxLoss = Infinity;
    
    // Boundary checks (0, 2*S, and strikes)
    const testStrikes = [0, S * 2, ...state.legs.map(l => l.strike)];
    const testPayoffs = calculateStrategyPayoff(testStrikes);
    
    testPayoffs.forEach(pt => {
        if (pt.val > maxProfit) maxProfit = pt.val;
        if (pt.val < maxLoss) maxLoss = pt.val;
    });

    // Handle unbounded cases
    // Check upside extreme payoff trends
    const zeroPayoff = calculateStrategyPayoff([0])[0].val;
    const highPayoff = calculateStrategyPayoff([S * 3])[0].val;
    
    let displayMaxProfit = "₹" + Math.round(maxProfit).toLocaleString('en-IN');
    let displayMaxLoss = "₹" + Math.round(maxLoss).toLocaleString('en-IN');

    if (highPayoff > maxProfit + 1000) {
        displayMaxProfit = "Unbounded (Upside)";
    } else if (highPayoff < maxLoss - 1000) {
        displayMaxLoss = "Unbounded (Upside)";
    }
    if (zeroPayoff > maxProfit + 1000 && state.legs.some(l => l.type === 'PUT' && l.position === 'LONG')) {
        // Technically capped at K-prem * mult, but practically extremely high
        displayMaxProfit = "Unbounded (Downside)";
    } else if (zeroPayoff < maxLoss - 1000) {
        displayMaxLoss = "Unbounded (Downside)";
    }

    const maxProfitEl = document.getElementById('strategyMaxProfit');
    const maxLossEl = document.getElementById('strategyMaxLoss');
    if (maxProfitEl) maxProfitEl.innerText = displayMaxProfit;
    if (maxLossEl) maxLossEl.innerText = displayMaxLoss;

    // Solve breakeven points by linear interpolation
    const breakevens = [];
    for (let i = 0; i < payoffPoints.length - 1; i++) {
        const pt1 = payoffPoints[i];
        const pt2 = payoffPoints[i+1];
        if ((pt1.val <= 0 && pt2.val > 0) || (pt1.val > 0 && pt2.val <= 0)) {
            const bePrice = pt1.spot + (0 - pt1.val) * (pt2.spot - pt1.spot) / (pt2.val - pt1.val);
            breakevens.push(bePrice);
        }
    }

    const breakevensEl = document.getElementById('strategyBreakevens');
    if (breakevensEl) {
        if (breakevens.length === 0) {
            breakevensEl.innerText = "None";
        } else {
            breakevensEl.innerText = breakevens.map(b => "₹" + Math.round(b).toLocaleString('en-IN')).join(" | ");
        }
    }

    // Render Chart.js
    const payoffChartCanvas = document.getElementById('payoffChart');
    if (!payoffChartCanvas) return;
    const ctx = payoffChartCanvas.getContext('2d');

    if (payoffChartInstance) {
        payoffChartInstance.destroy();
    }

    const isLight = document.body.classList.contains('light-mode');
    const gridColor = isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(51, 65, 85, 0.15)';
    const tickColor = isLight ? '#475569' : '#94a3b8';
    const tooltipBg = isLight ? '#ffffff' : '#020617';
    const tooltipBorder = isLight ? '#cbd5e1' : '#1e293b';
    const tooltipBody = isLight ? '#0f172a' : '#e2e8f0';
    const tooltipTitle = isLight ? '#0f172a' : '#fff';

    payoffChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: payoffPoints.map(p => `₹${p.spot.toLocaleString()}`),
            datasets: [{
                label: 'Net Payoff at Expiration',
                data: payoffPoints.map(p => Math.round(p.val)),
                borderColor: '#10b981',
                backgroundColor: isLight ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.05)',
                fill: true,
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: { color: tickColor, font: { family: 'Plus Jakarta Sans', size: 9 }, maxTicksLimit: 8 }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        color: tickColor,
                        font: { family: 'Plus Jakarta Sans', size: 9 },
                        callback: function(value) {
                            return (value >= 0 ? '+' : '') + '₹' + value.toLocaleString('en-IN');
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderWidth: 1,
                    titleColor: tooltipTitle,
                    bodyColor: tooltipBody,
                    bodyFont: { family: 'JetBrains Mono', size: 9 },
                    callbacks: {
                        label: function(context) {
                            return 'Payoff: ' + (context.raw >= 0 ? '+' : '') + '₹' + context.raw.toLocaleString('en-IN');
                        }
                    }
                }
            }
        }
    });
}

// Render dynamic Sector Heatmap items
function renderSectorHeatmap() {
    const S = state.spotPrice;
    const seed = S / 23622.90; // scale values matching Nifty moves
    
    const sectors = [
        { name: "Bank Nifty Financials", weight: "33%", pct: (1.99 * seed) },
        { name: "Nifty IT Services", weight: "14%", pct: (-0.42 * seed) },
        { name: "Nifty Energy Index", weight: "12%", pct: (2.10 * seed) },
        { name: "Nifty FMCG Basket", weight: "9%", pct: (0.58 * seed) },
        { name: "Nifty Auto Industry", weight: "8%", pct: (1.24 * seed) },
        { name: "Nifty Metal & Mining", weight: "4%", pct: (2.85 * seed) },
        { name: "Nifty Pharma / Biotech", weight: "4%", pct: (-0.15 * seed) }
    ];

    const components = [
        { name: "Reliance Industries", weight: "9.2%", pct: (1.45 * seed) },
        { name: "HDFC Bank Ltd", weight: "8.1%", pct: (2.34 * seed) },
        { name: "ICICI Bank Ltd", weight: "7.4%", pct: (1.89 * seed) },
        { name: "Infosys Limited", weight: "5.8%", pct: (-0.78 * seed) },
        { name: "TCS Limited", weight: "4.2%", pct: (-0.31 * seed) },
        { name: "Larsen & Toubro Ltd", weight: "3.9%", pct: (2.12 * seed) },
        { name: "ITC Limited", weight: "3.8%", pct: (0.95 * seed) },
        { name: "State Bank of India", weight: "3.2%", pct: (3.15 * seed) }
    ];

    const itemsToRender = state.heatmapMode === 'sectors' ? sectors : components;

    const grid = document.getElementById('heatmapGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const pdfGrid = document.getElementById('pdfHeatmapGrid');
    if (pdfGrid) pdfGrid.innerHTML = '';

    itemsToRender.forEach(item => {
        const isPos = item.pct >= 0;
        const sign = isPos ? '+' : '';
        const colorClass = isPos 
            ? 'bg-emerald-950/20 text-brand-400 border-emerald-500/20 shadow-glow-emerald' 
            : 'bg-rose-950/20 text-rose-400 border-rose-500/20';

        // Render in main grid
        const card = document.createElement('div');
        card.className = `p-3 rounded-xl border flex flex-col justify-between h-16 transition-all duration-300 ${colorClass}`;
        card.innerHTML = `
            <span class="text-[9px] font-bold text-slate-400 block">${item.name}</span>
            <div class="flex justify-between items-baseline mt-1.5">
                <span class="text-[8px] text-slate-500">Weight: ${item.weight}</span>
                <span class="text-xs font-black tracking-wide font-mono">${sign}${item.pct.toFixed(2)}%</span>
            </div>
        `;
        grid.appendChild(card);

        // Render in PDF report mockup
        if (pdfGrid) {
            const pdfCard = document.createElement('div');
            const pdfColor = isPos ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700';
            pdfCard.className = `p-1 border rounded flex justify-between items-center text-[5px] ${pdfColor}`;
            pdfCard.innerHTML = `
                <span class="font-bold">${item.name}</span>
                <span class="font-mono font-black">${sign}${item.pct.toFixed(2)}%</span>
            `;
            pdfGrid.appendChild(pdfCard);
        }
    });
}

function switchHeatmap(mode) {
    state.heatmapMode = mode;
    const sectorsBtn = document.getElementById('heatmapSectorsBtn');
    const componentsBtn = document.getElementById('heatmapComponentsBtn');
    if (!sectorsBtn || !componentsBtn) return;
    
    sectorsBtn.className = "px-2.5 py-1 rounded text-slate-400 hover:text-white";
    componentsBtn.className = "px-2.5 py-1 rounded text-slate-400 hover:text-white";
    
    if (mode === 'sectors') {
        sectorsBtn.className = "px-2.5 py-1 rounded bg-brand-500 text-slate-950 shadow";
    } else {
        componentsBtn.className = "px-2.5 py-1 rounded bg-brand-500 text-slate-950 shadow";
    }
    renderSectorHeatmap();
}

// Dynamic updates for VJ score consolidated gauge needle
function updateVJGauge() {
    const spot = state.spotPrice;
    const vix = state.indiaVix;
    const mmi = state.mmiIndex;
    
    // Calculate trend: spot vs EMA_21
    const emaVal = calculateEMA21(HISTORICAL_NIFTY_CLOSES, spot);
    const trend = spot >= emaVal ? 1.0 : 0.0;
    
    // Update EMA UI elements
    const ema21El = document.getElementById('ema21Value');
    const emaSpotEl = document.getElementById('emaIndexSpot');
    if (ema21El) ema21El.innerText = "₹" + Math.round(emaVal).toLocaleString('en-IN');
    if (emaSpotEl) emaSpotEl.innerText = "₹" + Math.round(spot).toLocaleString('en-IN');
    
    const alertEl = document.getElementById('trendIndicatorAlert');
    const alertText = document.getElementById('trendAlertText');
    if (alertEl && alertText) {
        if (trend === 1.0) {
            alertEl.className = "mt-4 p-2.5 rounded-xl border flex items-center gap-2 bg-emerald-500/10 border-emerald-500/30 text-brand-400";
            alertText.innerText = "Bullish Trend Alignment";
        } else {
            alertEl.className = "mt-4 p-2.5 rounded-xl border flex items-center gap-2 bg-rose-500/10 border-rose-500/30 text-rose-400";
            alertText.innerText = "Pronounced Downward Trend";
        }
    }

    // Estimate options Put-Call Open Interest ratio
    const pcrText = document.getElementById('optChainPcr');
    const pcrVal = pcrText ? (parseFloat(pcrText.innerText) || 1.18) : 1.18;
    
    // Normalizations
    const mmiNorm = mmi / 100.0;
    // PCR scale: bounds 0.70 to 1.30
    const pcrNorm = Math.max(0, Math.min(1, (pcrVal - 0.7) / (1.3 - 0.7)));
    // India VIX scale: bounds 8 (complacency/greed) to 40 (fear/panic)
    const vixNorm = Math.max(0, Math.min(1, (40 - vix) / (40 - 8)));

    // Weights
    const w1 = 0.3; // Trend
    const w2 = 0.3; // Mood (MMI)
    const w3 = 0.2; // PCR
    const w4 = 0.2; // VIX

    const score = (w1 * trend + w2 * mmiNorm + w3 * pcrNorm + w4 * vixNorm) * 100.0;

    // Update gauge UI
    const needle = document.getElementById('vjNeedle');
    const scoreVal = document.getElementById('vjScoreVal');
    const sentimentLabel = document.getElementById('sentimentLabel');
    const sentimentDesc = document.getElementById('sentimentDesc');

    if (scoreVal) scoreVal.innerText = score.toFixed(1) + "%";
    
    // Map score to degrees: 0% maps to -90 deg, 100% maps to 90 deg
    const angle = (score / 100.0) * 180 - 90;
    if (needle) needle.style.transform = `rotate(${angle}deg)`;

    // Sentiment zone label
    if (sentimentLabel && sentimentDesc) {
        if (score <= 25) {
            sentimentLabel.innerText = "Strongly Bearish";
            sentimentLabel.className = "text-red-400 font-extrabold text-xs uppercase tracking-wider bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 shadow-glow-emerald";
            sentimentDesc.innerText = "Multiple valuation indicators reflect deep capital contraction. Equity trend boundaries are tested and risk parameters indicate extreme structural fear.";
        } else if (score > 25 && score <= 45) {
            sentimentLabel.innerText = "Bearish Zone";
            sentimentLabel.className = "text-orange-400 font-extrabold text-xs uppercase tracking-wider bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20";
            sentimentDesc.innerText = "Technical averages confirm a downward trend. India VIX indicators are climbing. Option writing remains active on Call boundaries.";
        } else if (score > 45 && score <= 55) {
            sentimentLabel.innerText = "Neutral / Mixed";
            sentimentLabel.className = "text-slate-400 font-extrabold text-xs uppercase tracking-wider bg-slate-500/10 px-2 py-0.5 rounded border border-slate-500/20";
            sentimentDesc.innerText = "Consolidated signals show range-bound consolidation. No immediate technical breakout detected. Compounding portfolios operate neutrally.";
        } else if (score > 55 && score <= 75) {
            sentimentLabel.innerText = "Bullish Zone";
            sentimentLabel.className = "text-emerald-400 font-extrabold text-xs uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20";
            sentimentDesc.innerText = "Technical trends trade comfortably above structural EMA lines. Underlying Put support remains strong, suggesting minor risk premium gaps.";
        } else {
            sentimentLabel.innerText = "Strongly Bullish";
            sentimentLabel.className = "text-brand-400 font-extrabold text-xs uppercase tracking-wider bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20 shadow-glow-emerald";
            sentimentDesc.innerText = "Telemetry indicators confirm coordination inflows. The Market Mood represents high complacency or greed. Options leverage remains highly active.";
        }
    }

    // Sync with PDF elements
    const pdfSpotVal = document.getElementById('pdfSpotVal');
    const pdfEmaVal = document.getElementById('pdfEmaVal');
    const pdfTrendVal = document.getElementById('pdfTrendVal');
    const pdfSentimentScore = document.getElementById('pdfSentimentScore');
    const pdfSentimentLabel = document.getElementById('pdfSentimentLabel');
    const pdfVixVal = document.getElementById('pdfVixVal');
    const pdfMmiVal = document.getElementById('pdfMmiVal');
    const pdfPcrVal = document.getElementById('pdfPcrVal');

    if (pdfSpotVal) pdfSpotVal.innerText = "₹" + Math.round(spot).toLocaleString('en-IN');
    if (pdfEmaVal) pdfEmaVal.innerText = "₹" + Math.round(emaVal).toLocaleString('en-IN');
    if (pdfTrendVal) pdfTrendVal.innerText = trend === 1.0 ? "Bullish Alignment" : "Downward Trend";
    if (pdfSentimentScore) pdfSentimentScore.innerText = score.toFixed(1) + "%";
    if (pdfSentimentLabel && sentimentLabel) pdfSentimentLabel.innerText = sentimentLabel.innerText;
    if (pdfVixVal) pdfVixVal.innerText = vix.toFixed(1);
    if (pdfMmiVal) pdfMmiVal.innerText = mmi.toFixed(1);
    if (pdfPcrVal) pdfPcrVal.innerText = pcrVal.toFixed(2);
}

// ================= SECTION 2: PRECIOUS METALS ENGINE =================
function calculateGoldDragAppreciation() {
    const goldCapitalEl = document.getElementById('goldCapital');
    if (!goldCapitalEl) return;
    const capital = parseFloat(goldCapitalEl.value) || 500000;
    const horizon = parseInt(document.getElementById('goldHorizon').value) || 10;
    const returnPct = parseFloat(document.getElementById('goldAppreciation').value) || 12;
    const expectedReturn = returnPct / 100.0;
    
    const er = (parseFloat(document.getElementById('etfExpenseRatio').value) || 0.85) / 100.0;
    const te = (parseFloat(document.getElementById('etfTrackingError').value) || 0.25) / 100.0;

    const gst = (parseFloat(document.getElementById('physicalGst').value) || 3.0) / 100.0;
    const making = (parseFloat(document.getElementById('physicalMaking').value) || 5.0) / 100.0;
    const refinery = (parseFloat(document.getElementById('physicalRefinery').value) || 1.0) / 100.0;

    const spread = (parseFloat(document.getElementById('digitalSpread').value) || 3.0) / 100.0;
    const storage = (parseFloat(document.getElementById('digitalStorage').value) || 0.05) / 100.0;

    const format = (val) => "₹" + Math.round(val).toLocaleString('en-IN');

    // 1. Physical Gold Model
    // Deduct GST and making charges upfront, compound, then deduct refinery liquidation fee
    const physicalAllocated = capital / (1 + gst + making);
    const physicalFinal = physicalAllocated * Math.pow(1 + expectedReturn, horizon) * (1 - refinery);
    const physicalDrag = capital - physicalFinal;
    const physicalNetYield = (Math.pow(physicalFinal / capital, 1 / horizon) - 1) * 100;

    // 2. Digital Gold Model
    // Deduct spread upfront, apply expected return minus storage/custody fees annually
    const digitalAllocated = capital * (1 - spread);
    const digitalFinal = digitalAllocated * Math.pow(1 + expectedReturn - storage, horizon);
    const digitalDrag = capital - digitalFinal;
    const digitalNetYield = (Math.pow(digitalFinal / capital, 1 / horizon) - 1) * 100;

    // 3. Gold ETF Model
    // Compound capital annually at expected return minus expense ratio and tracking error
    const etfFinal = capital * Math.pow(1 + expectedReturn - er - te, horizon);
    const etfDrag = capital - etfFinal;
    const etfNetYield = (Math.pow(etfFinal / capital, 1 / horizon) - 1) * 100;

    // Update Cards
    document.getElementById('physicalMaturityCard').innerText = format(physicalFinal);
    document.getElementById('physicalCardDesc').innerText = `GST (${(gst*100).toFixed(1)}%) + Making premium (${(making*100).toFixed(1)}%) upfront. ${(refinery*100).toFixed(1)}% refinery cut at liquidation.`;
    document.getElementById('physicalYieldText').innerText = `Realized Yield: ${physicalNetYield.toFixed(2)}% p.a.`;

    document.getElementById('digitalMaturityCard').innerText = format(digitalFinal);
    document.getElementById('digitalCardDesc').innerText = `${(spread*100).toFixed(1)}% buy-sell spread upfront. ${(storage*100).toFixed(2)}% storage/custody fees annual drag.`;
    document.getElementById('digitalYieldText').innerText = `Realized Yield: ${digitalNetYield.toFixed(2)}% p.a.`;

    document.getElementById('etfMaturityCard').innerText = format(etfFinal);
    document.getElementById('etfYieldText').innerText = `${((expectedReturn - er - te) * 100).toFixed(2)}% net yield`;

    // Populate Table
    const dragTable = document.getElementById('goldDragTableBody');
    if (dragTable) {
        const physicalTotalDragPct = ((capital * Math.pow(1 + expectedReturn, horizon) - physicalFinal) / (capital * Math.pow(1 + expectedReturn, horizon)) * 100);
        const digitalTotalDragPct = ((capital * Math.pow(1 + expectedReturn, horizon) - digitalFinal) / (capital * Math.pow(1 + expectedReturn, horizon)) * 100);
        const etfTotalDragPct = ((capital * Math.pow(1 + expectedReturn, horizon) - etfFinal) / (capital * Math.pow(1 + expectedReturn, horizon)) * 100);

        dragTable.innerHTML = `
            <tr class="hover:bg-slate-900/40 border-b border-slate-900/60">
                <td class="py-3 px-4 font-bold text-white flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-red-400"></span> Physical Bullion
                </td>
                <td class="py-3 px-4 text-slate-300">${(gst*100).toFixed(1)}% GST + ${(making*100).toFixed(1)}% Making</td>
                <td class="py-3 px-4 text-slate-300">None</td>
                <td class="py-3 px-4 text-slate-300">${(refinery*100).toFixed(1)}% Refinery melt</td>
                <td class="py-3 px-4 font-bold text-red-400">${physicalTotalDragPct.toFixed(1)}% Drag Loss</td>
            </tr>
            <tr class="hover:bg-slate-900/40 border-b border-slate-900/60">
                <td class="py-3 px-4 font-bold text-white flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-amber-400"></span> Digital Gold
                </td>
                <td class="py-3 px-4 text-slate-300">${(spread*100).toFixed(1)}% Spread</td>
                <td class="py-3 px-4 text-slate-300">${(storage*100).toFixed(2)}% Custody fee</td>
                <td class="py-3 px-4 text-slate-300">None</td>
                <td class="py-3 px-4 font-bold text-amber-400">${digitalTotalDragPct.toFixed(1)}% Drag Loss</td>
            </tr>
            <tr class="hover:bg-slate-900/40">
                <td class="py-3 px-4 font-bold text-white flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-yellow-400"></span> Gold ETF Index
                </td>
                <td class="py-3 px-4 text-slate-300">Low commission</td>
                <td class="py-3 px-4 text-slate-300">${(er*100).toFixed(2)}% ER + ${(te*100).toFixed(2)}% TE</td>
                <td class="py-3 px-4 text-slate-300">Brokerage fees</td>
                <td class="py-3 px-4 font-bold text-yellow-400">${etfTotalDragPct.toFixed(1)}% Drag Loss</td>
            </tr>
        `;
    }

    // Setup chart arrays
    const yearsRange = [];
    const physicalPath = [];
    const digitalPath = [];
    const etfPath = [];
    const benchmarkPath = [];

    for (let yr = 0; yr <= horizon; yr++) {
        yearsRange.push(`Yr ${yr}`);
        
        // Benchmark Appreciation (Pure appreciation without drag)
        benchmarkPath.push(Math.round(capital * Math.pow(1 + expectedReturn, yr)));

        // Physical Gold growth
        const pAlloc = capital / (1 + gst + making);
        const pVal = pAlloc * Math.pow(1 + expectedReturn, yr) * (yr === horizon ? 1 - refinery : 1.0);
        physicalPath.push(Math.round(pVal));

        // Digital Gold growth
        const dAlloc = capital * (1 - spread);
        const dVal = dAlloc * Math.pow(1 + expectedReturn - storage, yr);
        digitalPath.push(Math.round(dVal));

        // Gold ETF growth
        const etfVal = capital * Math.pow(1 + expectedReturn - er - te, yr);
        etfPath.push(Math.round(etfVal));
    }

    // Render Chart.js
    const goldChartCanvas = document.getElementById('goldAppreciationChart');
    if (!goldChartCanvas) return;
    const ctx = goldChartCanvas.getContext('2d');

    if (goldAppreciationChartInstance) {
        goldAppreciationChartInstance.destroy();
    }

    const isLight = document.body.classList.contains('light-mode');
    const gridColor = isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(51, 65, 85, 0.15)';
    const tickColor = isLight ? '#475569' : '#94a3b8';
    const legendColor = isLight ? '#0f172a' : '#f8fafc';
    const tooltipBg = isLight ? '#ffffff' : '#020617';
    const tooltipBorder = isLight ? '#cbd5e1' : '#1e293b';
    const tooltipBody = isLight ? '#0f172a' : '#e2e8f0';
    const tooltipTitle = isLight ? '#0f172a' : '#fff';

    goldAppreciationChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: yearsRange,
            datasets: [
                {
                    label: 'Gold Spot Benchmark',
                    data: benchmarkPath,
                    borderColor: isLight ? '#64748b' : '#e2e8f0',
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Physical Bullion Value',
                    data: physicalPath,
                    borderColor: '#f87171', // Red
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Digital Gold Value',
                    data: digitalPath,
                    borderColor: '#fbbf24', // Amber
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Gold ETF Value',
                    data: etfPath,
                    borderColor: '#34d399', // Green
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: { color: tickColor, font: { family: 'Plus Jakarta Sans', size: 9 } }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        color: tickColor,
                        font: { family: 'Plus Jakarta Sans', size: 9 },
                        callback: function(value) {
                            if (value >= 10000000) return '₹' + (value / 10000000).toFixed(1) + 'Cr';
                            if (value >= 100000) return '₹' + (value / 100000).toFixed(1) + 'L';
                            return '₹' + value.toLocaleString('en-IN');
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: legendColor,
                        boxWidth: 10,
                        font: { family: 'Plus Jakarta Sans', size: 10 }
                    }
                },
                tooltip: {
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderWidth: 1,
                    titleColor: tooltipTitle,
                    bodyColor: tooltipBody,
                    bodyFont: { family: 'JetBrains Mono', size: 9 },
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ₹' + context.raw.toLocaleString('en-IN');
                        }
                    }
                }
            }
        }
    });
}

// ================= SECTION 3: AUTOMATED REPORT DISTRIBUTION SIMULATOR =================
function triggerCronPipeline() {
    if (state.cronInterval) return; // already running

    const btn = document.getElementById('btnTriggerCron');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Running Pipeline...";
    }
    
    const logsEl = document.getElementById('cronLogs');
    if (logsEl) logsEl.innerHTML = '';
    
    // Step classes
    const s1 = document.getElementById('pipeStep1');
    const s2 = document.getElementById('pipeStep2');
    const s3 = document.getElementById('pipeStep3');
    const s4 = document.getElementById('pipeStep4');

    if (s1) s1.className = "p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[10px] font-bold text-slate-500";
    if (s2) s2.className = "p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[10px] font-bold text-slate-500";
    if (s3) s3.className = "p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[10px] font-bold text-slate-500";
    if (s4) s4.className = "p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[10px] font-bold text-slate-500";

    state.cronStep = 0;
    const dateStr = new Date().toISOString().split('T')[0];

    const pipelineLogs = [
        { time: "06:30:00 AM", msg: "CRON: Triggered distributed daily operational reports task.", step: 1 },
        { time: "06:30:12 AM", msg: "INGEST: Querying 50+ domestic & international streams (NSE spot, RBIs, gold spots)...", step: 1 },
        { time: "06:30:25 AM", msg: "INGEST: NSE Option Chain arrays for Strike 23,000-24,200 ingested successfully.", step: 1 },
        { time: "07:15:00 AM", msg: "MATH: Calculating technical boundaries. Nifty closes 21-Period EMA: ₹" + Math.round(calculateEMA21(HISTORICAL_NIFTY_CLOSES, state.spotPrice)).toLocaleString() + ".", step: 2 },
        { time: "07:15:15 AM", msg: "MATH: Normalized volatility vectors. Put-Call Open Interest Ratio (PCR): " + parseFloat(renderOptionChain()).toFixed(2) + ".", step: 2 },
        { time: "07:15:35 AM", msg: "MATH: Consolidated Market VJ Sentiment Index compiled: " + (document.getElementById('vjScoreVal') ? document.getElementById('vjScoreVal').innerText : '58.4%') + ".", step: 2 },
        { time: "07:45:00 AM", msg: "COMPILE: Puppeteer launching internal Chromium process for layout PDF parsing...", step: 3 },
        { time: "07:45:22 AM", msg: "COMPILE: HTML compilation completed. Exactly 5 pages rendered.", step: 3 },
        { time: "07:45:45 AM", msg: "STORAGE: Uploading PDF to AWS S3 catalog -> s3://vj-analysing-the-market/reports/" + dateStr + ".pdf.", step: 3 },
        { time: "08:00:00 AM", msg: "DISPATCH: Pulling sub-lists. Batch queues created for WhatsApp Business APIs.", step: 4 },
        { time: "08:00:15 AM", msg: "DISPATCH: Broadcast delivery completed to 184,923 high-engagement endpoints.", step: 4 }
    ];

    const indicator = document.getElementById('cronIndicator');
    const indicatorText = document.getElementById('cronIndicatorText');
    if (indicator) indicator.className = "w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse";
    if (indicatorText) indicatorText.innerText = "Ingesting...";

    state.cronInterval = setInterval(() => {
        if (state.cronStep < pipelineLogs.length) {
            const log = pipelineLogs[state.cronStep];
            if (logsEl) {
                const div = document.createElement('div');
                div.innerHTML = `<span class="text-slate-500">[${log.time}]</span> ${log.msg}`;
                logsEl.appendChild(div);
                logsEl.scrollTop = logsEl.scrollHeight;
            }

            // Update pipeline step classes & header text
            if (log.step === 1) {
                if (s1) s1.className = "p-3 bg-brand-500/10 rounded-xl border border-brand-500/30 text-[10px] font-bold text-brand-400 animate-pulse";
                if (indicatorText) indicatorText.innerText = "Ingesting...";
            } else if (log.step === 2) {
                if (s1) s1.className = "p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[10px] font-bold text-slate-400";
                if (s2) s2.className = "p-3 bg-brand-500/10 rounded-xl border border-brand-500/30 text-[10px] font-bold text-brand-400 animate-pulse";
                if (indicatorText) indicatorText.innerText = "Computing...";
            } else if (log.step === 3) {
                if (s2) s2.className = "p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[10px] font-bold text-slate-400";
                if (s3) s3.className = "p-3 bg-brand-500/10 rounded-xl border border-brand-500/30 text-[10px] font-bold text-brand-400 animate-pulse";
                if (indicatorText) indicatorText.innerText = "Compiling PDF...";
            } else if (log.step === 4) {
                if (s3) s3.className = "p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[10px] font-bold text-slate-400";
                if (s4) s4.className = "p-3 bg-brand-500/10 rounded-xl border border-brand-500/30 text-[10px] font-bold text-brand-400 animate-pulse";
                if (indicatorText) indicatorText.innerText = "Dispatching...";
            }

            state.cronStep++;
        } else {
            // Completed
            clearInterval(state.cronInterval);
            state.cronInterval = null;
            if (btn) {
                btn.disabled = false;
                btn.innerText = "Re-run Ingestion";
            }
            if (indicator) indicator.className = "w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse";
            if (indicatorText) indicatorText.innerText = "Reports Ready";
            if (s4) s4.className = "p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[10px] font-bold text-slate-400";

            // Show PDF viewer
            const pdfViewer = document.getElementById('pdfViewerModal');
            if (pdfViewer) pdfViewer.classList.remove('hidden');
        }
    }, 600); // speed up intervals
}

function closePDFViewer() {
    const pdfViewer = document.getElementById('pdfViewerModal');
    if (pdfViewer) pdfViewer.classList.add('hidden');
}

function printPDFMockup() {
    window.print();
}

// ================= SECTION 5: SCENARIOS & AUTO CONFIG SAVING =================
function saveScenario() {
    const nameInput = document.getElementById('scenarioName');
    if (!nameInput) return;
    const name = nameInput.value.trim();
    if (!name) return;

    const scenario = {
        id: Date.now(),
        name,
        spotPrice: parseFloat(document.getElementById('spotPrice').value),
        volatility: parseFloat(document.getElementById('volatility').value),
        daysToExpiry: parseInt(document.getElementById('daysToExpiry').value),
        indiaVix: parseFloat(document.getElementById('indiaVix').value),
        mmiIndex: parseFloat(document.getElementById('mmiIndex').value),
        
        // Gold
        goldCapital: parseFloat(document.getElementById('goldCapital').value),
        goldAppreciation: parseFloat(document.getElementById('goldAppreciation').value),
        goldHorizon: parseInt(document.getElementById('goldHorizon').value),
        etfExpenseRatio: parseFloat(document.getElementById('etfExpenseRatio').value),
        etfTrackingError: parseFloat(document.getElementById('etfTrackingError').value),

        // Customizable precious metals
        physicalGst: parseFloat(document.getElementById('physicalGst').value),
        physicalMaking: parseFloat(document.getElementById('physicalMaking').value),
        physicalRefinery: parseFloat(document.getElementById('physicalRefinery').value),
        digitalSpread: parseFloat(document.getElementById('digitalSpread').value),
        digitalStorage: parseFloat(document.getElementById('digitalStorage').value)
    };

    state.savedScenarios.push(scenario);
    localStorage.setItem('vj_scenarios', JSON.stringify(state.savedScenarios));
    nameInput.value = '';
    renderScenariosUI();
}

function loadScenario(id) {
    const scen = state.savedScenarios.find(s => s.id === id);
    if (!scen) return;

    document.getElementById('spotPrice').value = scen.spotPrice;
    document.getElementById('volatility').value = scen.volatility;
    document.getElementById('daysToExpiry').value = scen.daysToExpiry;
    document.getElementById('indiaVix').value = scen.indiaVix;
    document.getElementById('mmiIndex').value = scen.mmiIndex;

    // Gold
    document.getElementById('goldCapital').value = scen.goldCapital;
    document.getElementById('goldAppreciation').value = scen.goldAppreciation;
    document.getElementById('goldHorizon').value = scen.goldHorizon;
    document.getElementById('etfExpenseRatio').value = scen.etfExpenseRatio;
    document.getElementById('etfTrackingError').value = scen.etfTrackingError;

    // Customizable precious metals
    if (scen.physicalGst !== undefined) document.getElementById('physicalGst').value = scen.physicalGst;
    if (scen.physicalMaking !== undefined) document.getElementById('physicalMaking').value = scen.physicalMaking;
    if (scen.physicalRefinery !== undefined) document.getElementById('physicalRefinery').value = scen.physicalRefinery;
    if (scen.digitalSpread !== undefined) document.getElementById('digitalSpread').value = scen.digitalSpread;
    if (scen.digitalStorage !== undefined) document.getElementById('digitalStorage').value = scen.digitalStorage;

    updateAppLayout();
}

function deleteScenario(id, e) {
    e.stopPropagation();
    state.savedScenarios = state.savedScenarios.filter(s => s.id !== id);
    localStorage.setItem('vj_scenarios', JSON.stringify(state.savedScenarios));
    renderScenariosUI();
}

function renderScenariosUI() {
    const list = document.getElementById('scenariosList');
    if (!list) return;
    list.innerHTML = '';

    if (state.savedScenarios.length === 0) {
        list.innerHTML = `<span class="text-[9px] text-slate-500 italic block py-1">No custom configurations.</span>`;
        return;
    }

    state.savedScenarios.forEach(scen => {
        const div = document.createElement('div');
        div.className = "flex justify-between items-center bg-slate-950/40 hover:bg-slate-900 border border-slate-900 px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer hover:border-brand-500/20 transition";
        div.onclick = () => loadScenario(scen.id);
        
        div.innerHTML = `
            <div class="text-left font-semibold text-slate-300">
                <span>${scen.name}</span>
                <span class="block text-[8px] text-slate-500">Spot: ₹${Math.round(scen.spotPrice).toLocaleString()} | IV: ${scen.volatility}%</span>
            </div>
            <button onclick="deleteScenario(${scen.id}, event)" class="text-red-400 hover:text-red-500 p-1 rounded hover:bg-slate-800 transition">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        `;
        list.appendChild(div);
    });
}

// Fetch real-time Nifty 50 PE ratio using open CORS proxies from Yahoo Finance
async function fetchRealtimeNiftyPE() {
    const yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&range=1d';
    const data = await fetchWithProxy(yahooUrl);
    return data.chart.result[0].meta.regularMarketPrice;
}

async function syncLivePE() {
    const btn = document.getElementById('syncBtn');
    const hStatus = document.getElementById('headerMarketStatusText');
    if (!btn || !hStatus) return;
    btn.disabled = true;
    btn.innerHTML = "Syncing...";

    try {
        const liveSpot = await fetchRealtimeNiftyPE();
        
        // Update inputs
        document.getElementById('spotPrice').value = liveSpot.toFixed(2);
        state.spotPrice = liveSpot;
        
        // Update header status
        hStatus.innerText = `Nifty Live: ₹${liveSpot.toLocaleString('en-IN')}`;
        
        updateAppLayout();
        
        // Flash glow
        hStatus.classList.add('text-brand-300');
        setTimeout(() => hStatus.classList.remove('text-brand-300'), 1500);

    } catch (err) {
        console.error("Live PE sync failed:", err);
        setOnlineStatus(false);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12"></path></svg> Sync Live`;
    }
}

// ================= GENERAL LAYOUT & STATE PIPELINE =================
function updateAppLayout() {
    const spotEl = document.getElementById('spotPrice');
    if (!spotEl) return;
    // Read inputs
    state.spotPrice = parseFloat(spotEl.value) || 23622.90;
    state.volatility = parseFloat(document.getElementById('volatility').value) || 14.5;
    state.daysToExpiry = parseInt(document.getElementById('daysToExpiry').value) || 28;
    state.indiaVix = parseFloat(document.getElementById('indiaVix').value) || 12.8;
    state.mmiIndex = parseFloat(document.getElementById('mmiIndex').value) || 58.4;
    state.lotMultiplier = parseInt(document.getElementById('lotSizeMultiplier').value) || 75;

    // Updates sliders display text
    document.getElementById('volVal').innerText = state.volatility.toFixed(1) + "%";
    document.getElementById('vixVal').innerText = state.indiaVix.toFixed(1);
    document.getElementById('mmiVal').innerText = state.mmiIndex.toFixed(1);
    
    // Gold Sliders display text
    const goldApp = parseFloat(document.getElementById('goldAppreciation').value) || 12.0;
    const etfEr = parseFloat(document.getElementById('etfExpenseRatio').value) || 0.85;
    const etfTe = parseFloat(document.getElementById('etfTrackingError').value) || 0.25;

    const physicalGstVal = parseFloat(document.getElementById('physicalGst').value) || 3.0;
    const physicalMakingVal = parseFloat(document.getElementById('physicalMaking').value) || 5.0;
    const physicalRefineryVal = parseFloat(document.getElementById('physicalRefinery').value) || 1.0;
    const digitalSpreadVal = parseFloat(document.getElementById('digitalSpread').value) || 3.0;
    const digitalStorageVal = parseFloat(document.getElementById('digitalStorage').value) || 0.05;

    document.getElementById('goldAppreciationVal').innerText = goldApp.toFixed(1) + "%";
    document.getElementById('etfExpenseRatioVal').innerText = etfEr.toFixed(2) + "%";
    document.getElementById('etfTrackingErrorVal').innerText = etfTe.toFixed(2) + "%";

    document.getElementById('physicalGstVal').innerText = physicalGstVal.toFixed(1) + "%";
    document.getElementById('physicalMakingVal').innerText = physicalMakingVal.toFixed(1) + "%";
    document.getElementById('physicalRefineryVal').innerText = physicalRefineryVal.toFixed(1) + "%";
    document.getElementById('digitalSpreadVal').innerText = digitalSpreadVal.toFixed(1) + "%";
    document.getElementById('digitalStorageVal').innerText = digitalStorageVal.toFixed(2) + "%";

    // Update greeks & layouts
    renderOptionChain();
    renderLegsUI();
    updateStrategyPayoffCurves();
    renderSectorHeatmap();
    updateVJGauge();
    
    // Gold returns calculation
    calculateGoldDragAppreciation();

    // Save auto configurations
    saveAutoConfig();
}

function saveAutoConfig() {
    const config = {
        spotPrice: parseFloat(document.getElementById('spotPrice').value),
        volatility: parseFloat(document.getElementById('volatility').value),
        daysToExpiry: parseInt(document.getElementById('daysToExpiry').value),
        indiaVix: parseFloat(document.getElementById('indiaVix').value),
        mmiIndex: parseFloat(document.getElementById('mmiIndex').value),
        
        // Gold
        goldCapital: parseFloat(document.getElementById('goldCapital').value),
        goldAppreciation: parseFloat(document.getElementById('goldAppreciation').value),
        goldHorizon: parseInt(document.getElementById('goldHorizon').value),
        etfExpenseRatio: parseFloat(document.getElementById('etfExpenseRatio').value),
        etfTrackingError: parseFloat(document.getElementById('etfTrackingError').value),

        // Customizable precious metals
        physicalGst: parseFloat(document.getElementById('physicalGst').value),
        physicalMaking: parseFloat(document.getElementById('physicalMaking').value),
        physicalRefinery: parseFloat(document.getElementById('physicalRefinery').value),
        digitalSpread: parseFloat(document.getElementById('digitalSpread').value),
        digitalStorage: parseFloat(document.getElementById('digitalStorage').value)
    };
    localStorage.setItem('vj_auto_config', JSON.stringify(config));
}

function loadAutoConfig() {
    const configStr = localStorage.getItem('vj_auto_config');
    if (!configStr) return;
    try {
        const config = JSON.parse(configStr);
        document.getElementById('spotPrice').value = config.spotPrice || 23622.90;
        document.getElementById('volatility').value = config.volatility || 14.5;
        document.getElementById('daysToExpiry').value = config.daysToExpiry || 28;
        document.getElementById('indiaVix').value = config.indiaVix || 12.8;
        document.getElementById('mmiIndex').value = config.mmiIndex || 58.4;
        
        // Gold
        document.getElementById('goldCapital').value = config.goldCapital || 500000;
        document.getElementById('goldAppreciation').value = config.goldAppreciation || 12.0;
        document.getElementById('goldHorizon').value = config.goldHorizon || 10;
        document.getElementById('etfExpenseRatio').value = config.etfExpenseRatio || 0.85;
        document.getElementById('etfTrackingError').value = config.etfTrackingError || 0.25;

        // Customizable precious metals
        if (config.physicalGst !== undefined) document.getElementById('physicalGst').value = config.physicalGst;
        if (config.physicalMaking !== undefined) document.getElementById('physicalMaking').value = config.physicalMaking;
        if (config.physicalRefinery !== undefined) document.getElementById('physicalRefinery').value = config.physicalRefinery;
        if (config.digitalSpread !== undefined) document.getElementById('digitalSpread').value = config.digitalSpread;
        if (config.digitalStorage !== undefined) document.getElementById('digitalStorage').value = config.digitalStorage;
    } catch(e) {
        console.error("Auto load failed", e);
    }
}

// Theme Toggle Simulator
function toggleTheme() {
    const body = document.body;
    const sunIcon = document.getElementById('themeSunIcon');
    const moonIcon = document.getElementById('themeMoonIcon');
    if (!body || !sunIcon || !moonIcon) return;
    
    body.classList.toggle('light-mode');
    
    const isLight = body.classList.contains('light-mode');
    if (isLight) {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
        localStorage.setItem('vj_theme', 'light');
    } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
        localStorage.setItem('vj_theme', 'dark');
    }
    
    // Re-render layout and redraw charts to match active theme
    updateAppLayout();
}

// On Load Initialization
window.onload = function() {
    // Load saved theme
    const savedTheme = localStorage.getItem('vj_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        const sun = document.getElementById('themeSunIcon');
        const moon = document.getElementById('themeMoonIcon');
        if (sun) sun.classList.remove('hidden');
        if (moon) moon.classList.add('hidden');
    }

    // Load saved scenarios
    const saved = localStorage.getItem('vj_scenarios');
    if (saved) {
        try {
            state.savedScenarios = JSON.parse(saved);
        } catch(e) {
            state.savedScenarios = [];
        }
    }
    renderScenariosUI();

    // Load last config
    loadAutoConfig();

    // Set default Strategy legs preset (Iron Condor) on first load
    applyStrategyPreset('ironCondor');

    // Wire input events
    document.getElementById('spotPrice').addEventListener('input', updateAppLayout);
    document.getElementById('volatility').addEventListener('input', updateAppLayout);
    document.getElementById('daysToExpiry').addEventListener('input', updateAppLayout);
    document.getElementById('indiaVix').addEventListener('input', updateAppLayout);
    document.getElementById('mmiIndex').addEventListener('input', updateAppLayout);
    document.getElementById('lotSizeMultiplier').addEventListener('change', updateAppLayout);
    
    // Gold inputs
    document.getElementById('goldCapital').addEventListener('input', updateAppLayout);
    document.getElementById('goldAppreciation').addEventListener('input', updateAppLayout);
    document.getElementById('goldHorizon').addEventListener('input', updateAppLayout);
    document.getElementById('etfExpenseRatio').addEventListener('input', updateAppLayout);
    document.getElementById('etfTrackingError').addEventListener('input', updateAppLayout);

    // New Precious Metals Inputs
    document.getElementById('physicalGst').addEventListener('input', updateAppLayout);
    document.getElementById('physicalMaking').addEventListener('input', updateAppLayout);
    document.getElementById('physicalRefinery').addEventListener('input', updateAppLayout);
    document.getElementById('digitalSpread').addEventListener('input', updateAppLayout);
    document.getElementById('digitalStorage').addEventListener('input', updateAppLayout);

    // Wire Call vs Put Expiry Simulator inputs
    document.getElementById('simStrike').addEventListener('input', updateSimResult);
    document.getElementById('simPremium').addEventListener('input', updateSimResult);
    document.getElementById('simExpirySpot').addEventListener('input', updateSimResult);

    // Initialize Beginner Mode
    const savedBeg = localStorage.getItem('vj_beginner_mode');
    state.beginnerMode = (savedBeg === null || savedBeg === 'true');
    updateBeginnerModeUI();

    // Initialize call/put simulator layout
    setSimOptionType('CALL');

    // ===== Wire new Calculator Desk inputs =====
    // Child Legacy
    ['childCurrentAge','childReturnRate'].forEach(id => document.getElementById(id)?.addEventListener('input', calculateChildLegacy));
    ['childTargetAge','childTargetCorpus','childCurrentSIP','childExistingCorpus'].forEach(id => document.getElementById(id)?.addEventListener('input', calculateChildLegacy));
    // Debt Engine
    ['debtRate','debtTenure'].forEach(id => document.getElementById(id)?.addEventListener('input', calculateDebtEMI));
    ['debtPrincipal','debtPrepayment'].forEach(id => document.getElementById(id)?.addEventListener('input', calculateDebtEMI));
    // SWP Calculator
    ['swpReturnRate','swpInflation'].forEach(id => document.getElementById(id)?.addEventListener('input', calculateSWP));
    ['swpCorpus','swpMonthly'].forEach(id => document.getElementById(id)?.addEventListener('input', calculateSWP));
    // Gold Returns
    ['grYearsHeld'].forEach(id => document.getElementById(id)?.addEventListener('input', calculateGoldReturns));
    ['grPurchasePrice','grCurrentPrice','grQuantity','grForm'].forEach(id => document.getElementById(id)?.addEventListener('input', calculateGoldReturns));
    // Asset Allocation
    ['assetAge','assetHorizon','assetCurrentEquity','assetCurrentDebt','assetCurrentGold','assetCurrentCash'].forEach(id => document.getElementById(id)?.addEventListener('input', calculateAssetAllocation));
    ['assetAmount','assetRisk'].forEach(id => document.getElementById(id)?.addEventListener('input', calculateAssetAllocation));

    // SIP Calculator Inputs
    ['sipReturnRate','sipTenure','sipAmount','sipStepUpPct','sipLumpsumAmt','sipGoalAmt','sipExistingAmt'].forEach(id => document.getElementById(id)?.addEventListener('input', calculateSIP));

    // PPF Calculator Inputs
    ['ppfAnnual','ppfRate','ppfTenure'].forEach(id => document.getElementById(id)?.addEventListener('input', calculatePPF));
    ['ppfRate'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('ppfRateVal').innerText = document.getElementById('ppfRate').value + '%';
    }));
    ['ppfTenure'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('ppfTenureVal').innerText = document.getElementById('ppfTenure').value + ' yrs';
    }));

    // NPS Calculator Inputs
    ['npsMonthly','npsEmployer','npsAge','npsRetireAge','npsReturn','npsAnnuity','npsAnnuityReturn'].forEach(id => document.getElementById(id)?.addEventListener('input', calculateNPS));
    ['npsAge'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('npsAgeVal').innerText = document.getElementById('npsAge').value + ' yrs';
    }));
    ['npsRetireAge'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('npsRetireAgeVal').innerText = document.getElementById('npsRetireAge').value + ' yrs';
    }));
    ['npsReturn'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('npsReturnVal').innerText = document.getElementById('npsReturn').value + '%';
    }));
    ['npsAnnuity'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('npsAnnuityVal').innerText = document.getElementById('npsAnnuity').value + '%';
    }));
    ['npsAnnuityReturn'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('npsAnnuityReturnVal').innerText = document.getElementById('npsAnnuityReturn').value + '%';
    }));

    // FD Calculator Inputs
    ['fdPrincipal','fdRate','fdTenure','fdFreq','fdTaxRate'].forEach(id => document.getElementById(id)?.addEventListener('input', calculateFD));
    ['fdRate'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('fdRateVal').innerText = document.getElementById('fdRate').value + '%';
    }));
    ['fdTenure'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('fdTenureVal').innerText = document.getElementById('fdTenure').value + ' yrs';
    }));
    ['fdTaxRate'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('fdTaxRateVal').innerText = document.getElementById('fdTaxRate').value + '%';
    }));

    // RD Calculator Inputs
    ['rdMonthly','rdRate','rdTenure'].forEach(id => document.getElementById(id)?.addEventListener('input', calculateRD));
    ['rdRate'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('rdRateVal').innerText = document.getElementById('rdRate').value + '%';
    }));
    ['rdTenure'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('rdTenureVal').innerText = document.getElementById('rdTenure').value + ' yrs';
    }));

    // MF Lumpsum Inputs
    ['mflAmount','mflRate','mflTenure'].forEach(id => document.getElementById(id)?.addEventListener('input', calculateMFLumpsum));
    ['mflRate'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('mflRateVal').innerText = document.getElementById('mflRate').value + '%';
    }));
    ['mflTenure'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('mflTenureVal').innerText = document.getElementById('mflTenure').value + ' yrs';
    }));

    // Retirement Corpus Inputs
    ['retCurrentAge','retRetireAge','retLifeExp','retMonthlyExp','retInflation','retPreReturn','retPostReturn','retCurrentSavings'].forEach(id => document.getElementById(id)?.addEventListener('input', calculateRetirement));
    ['retCurrentAge'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('retCurrentAgeVal').innerText = document.getElementById('retCurrentAge').value + ' yrs';
    }));
    ['retRetireAge'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('retRetireAgeVal').innerText = document.getElementById('retRetireAge').value + ' yrs';
    }));
    ['retLifeExp'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('retLifeExpVal').innerText = document.getElementById('retLifeExp').value + ' yrs';
    }));
    ['retInflation'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('retInflationVal').innerText = document.getElementById('retInflation').value + '%';
    }));
    ['retPreReturn'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('retPreReturnVal').innerText = document.getElementById('retPreReturn').value + '%';
    }));
    ['retPostReturn'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('retPostReturnVal').innerText = document.getElementById('retPostReturn').value + '%';
    }));

    // Tax Calculator Inputs
    ['taxIncome','taxAge','tax80C','tax80D','taxHRA','taxNPS','taxHomeLoan'].forEach(id => document.getElementById(id)?.addEventListener('input', calculateTax));
    ['taxAge'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('taxAgeVal').innerText = document.getElementById('taxAge').value + ' yrs';
    }));

    // Gold Spot Price Inputs
    ['gspPurity','gspWeight','gspSpotPrice','gspMaking','gspGst'].forEach(id => document.getElementById(id)?.addEventListener('input', calculateGoldSpot));
    ['gspPurity'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('gspPurityVal').innerText = document.getElementById('gspPurity').value + 'K';
    }));
    ['gspWeight'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('gspWeightVal').innerText = document.getElementById('gspWeight').value + ' g';
    }));
    ['gspMaking'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('gspMakingVal').innerText = document.getElementById('gspMaking').value + '%';
    }));
    ['gspGst'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
        document.getElementById('gspGstVal').innerText = document.getElementById('gspGst').value + '%';
    }));

    // Start live market auto-refresh every 60 seconds
    if (sipMarketInterval) clearInterval(sipMarketInterval);
    sipMarketInterval = setInterval(fetchLiveMarketData, 60000);

    // Fetch live ticker data on load and every 30s
    fetchLiveTickerData();
    if (tickerInterval) clearInterval(tickerInterval);
    tickerInterval = setInterval(fetchLiveTickerData, 30000);

    // Set default tab to Learner's Hub
    switchDesk('learner');

    updateAppLayout();
}

// =================================================================
// CHILD LEGACY ENGINE
// =================================================================
function calculateChildLegacy() {
    const currentAge = parseInt(document.getElementById('childCurrentAge')?.value) || 5;
    const targetAge  = parseInt(document.getElementById('childTargetAge')?.value)  || 18;
    const targetCorpus = parseFloat(document.getElementById('childTargetCorpus')?.value) || 5000000;
    const returnRate   = parseFloat(document.getElementById('childReturnRate')?.value)   || 12;
    const monthlySIP   = parseFloat(document.getElementById('childCurrentSIP')?.value)   || 15000;
    const existingCorpus = parseFloat(document.getElementById('childExistingCorpus')?.value) || 0;

    // Update slider labels
    const ageEl = document.getElementById('childCurrentAgeVal'); if (ageEl) ageEl.innerText = currentAge + ' yrs';
    const rateEl = document.getElementById('childReturnRateVal'); if (rateEl) rateEl.innerText = returnRate.toFixed(1) + '%';

    const yearsRemaining = Math.max(targetAge - currentAge, 1);
    const months = yearsRemaining * 12;
    const monthlyRate = returnRate / 100 / 12;

    // FV of existing corpus compounded annually
    const fvExisting = existingCorpus * Math.pow(1 + returnRate / 100, yearsRemaining);
    // FV of monthly SIP (future value of annuity due)
    const fvSIP = monthlySIP > 0 && monthlyRate > 0
        ? monthlySIP * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate)
        : monthlySIP * months;
    const projectedCorpus = fvExisting + fvSIP;

    const gap = targetCorpus - projectedCorpus;
    const readinessPct = Math.min(100, (projectedCorpus / targetCorpus) * 100);

    // Required SIP to close gap
    const remaining = Math.max(0, targetCorpus - fvExisting);
    const sipDivisor = monthlyRate > 0
        ? ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate)
        : months;
    const requiredSIP = remaining > 0 ? remaining / sipDivisor : 0;

    const fmt = n => '\u20b9' + Math.round(Math.abs(n)).toLocaleString('en-IN');
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };

    setTxt('childProjectedCorpus', fmt(projectedCorpus));
    setTxt('childYearsRemaining', yearsRemaining + ' years');
    setTxt('childRequiredSIP', fmt(requiredSIP) + '/mo');

    const gapEl = document.getElementById('childGapAmount');
    if (gapEl) {
        gapEl.innerText = (gap > 0 ? '\u2212' : '+') + fmt(gap);
        gapEl.className = 'text-xl font-black block mt-1 ' + (gap > 0 ? 'text-rose-400' : 'text-brand-400');
    }
    const readEl = document.getElementById('childReadiness');
    if (readEl) readEl.innerText = readinessPct.toFixed(1) + '%';
    const barEl = document.getElementById('childReadinessBar');
    if (barEl) {
        barEl.style.width = readinessPct.toFixed(1) + '%';
        barEl.className = 'h-full rounded-full transition-all duration-700 ' +
            (readinessPct >= 80 ? 'bg-brand-500' : readinessPct >= 50 ? 'bg-yellow-400' : 'bg-rose-400');
    }

    // Build year-by-year data
    const labels = [], projected = [], target = [];
    for (let y = 0; y <= yearsRemaining; y++) {
        labels.push('Age ' + (currentAge + y));
        const m = y * 12;
        const fvE = existingCorpus * Math.pow(1 + returnRate / 100, y);
        const fvS = m > 0 && monthlyRate > 0
            ? monthlySIP * ((Math.pow(1 + monthlyRate, m) - 1) / monthlyRate) * (1 + monthlyRate)
            : monthlySIP * m;
        projected.push(Math.round(fvE + fvS));
        target.push(Math.round(targetCorpus));
    }

    const canvas = document.getElementById('childLegacyChart'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (childLegacyChartInstance) childLegacyChartInstance.destroy();
    const isLight = document.body.classList.contains('light-mode');
    const grid = isLight ? 'rgba(15,23,42,0.06)' : 'rgba(51,65,85,0.15)';
    const tick = isLight ? '#475569' : '#94a3b8';
    childLegacyChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [
            { label: 'Projected Corpus', data: projected, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.08)', fill: true, borderWidth: 2, pointRadius: 3, tension: 0.3 },
            { label: 'Target Corpus', data: target, borderColor: '#f43f5e', borderDash: [5,5], borderWidth: 1.5, pointRadius: 0, tension: 0 }
        ]},
        options: { responsive: true, maintainAspectRatio: false,
            scales: {
                x: { grid: { color: grid }, ticks: { color: tick, font: { size: 9 }, maxTicksLimit: 8 } },
                y: { grid: { color: grid }, ticks: { color: tick, font: { size: 9 }, callback: v => v >= 1e7 ? '\u20b9'+(v/1e7).toFixed(1)+'Cr' : v >= 1e5 ? '\u20b9'+(v/1e5).toFixed(1)+'L' : '\u20b9'+v.toLocaleString() } }
            },
            plugins: { legend: { labels: { color: tick, boxWidth: 10, font: { size: 9 } } },
                tooltip: { callbacks: { label: c => c.dataset.label+': \u20b9'+c.raw.toLocaleString('en-IN') } } }
        }
    });
}

// =================================================================
// DEBT ENGINE — EMI + AMORTISATION + PREPAYMENT
// =================================================================
function calculateDebtEMI() {
    const principal = parseFloat(document.getElementById('debtPrincipal')?.value) || 5000000;
    const annualRate = parseFloat(document.getElementById('debtRate')?.value) || 8.5;
    const tenure = parseInt(document.getElementById('debtTenure')?.value) || 240;
    const prepayment = parseFloat(document.getElementById('debtPrepayment')?.value) || 0;

    const rateEl = document.getElementById('debtRateVal'); if (rateEl) rateEl.innerText = annualRate.toFixed(2) + '%';
    const tenEl = document.getElementById('debtTenureVal'); if (tenEl) tenEl.innerText = tenure + ' mo (' + Math.round(tenure/12) + ' yr)';

    const r = annualRate / 100 / 12;
    const emi = r > 0
        ? principal * r * Math.pow(1 + r, tenure) / (Math.pow(1 + r, tenure) - 1)
        : principal / tenure;
    const totalInterest = (emi * tenure) - principal;

    // Simulate with prepayment
    let balance = principal, totalInterestWithPrep = 0, monthsPaid = 0;
    while (balance > 1 && monthsPaid < 600) {
        const intPayment = balance * r;
        const principalPayment = Math.min(emi - intPayment + prepayment, balance);
        totalInterestWithPrep += intPayment;
        balance -= principalPayment;
        monthsPaid++;
    }
    const interestSaved = Math.max(0, totalInterest - totalInterestWithPrep);
    const monthsSaved = Math.max(0, tenure - monthsPaid);
    const fmt = n => '\u20b9' + Math.round(n).toLocaleString('en-IN');

    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    setTxt('debtEMI', fmt(emi));
    setTxt('debtTotalInterest', fmt(prepayment > 0 ? totalInterestWithPrep : totalInterest));
    setTxt('debtInterestSaved', prepayment > 0 ? fmt(interestSaved) : '\u20b90');
    setTxt('debtTenureSaved', prepayment > 0 ? monthsSaved + ' months' : '0 months');

    const canvas = document.getElementById('debtAmortChart'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (debtAmortChartInstance) debtAmortChartInstance.destroy();
    const isLight = document.body.classList.contains('light-mode');
    debtAmortChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Principal', 'Total Interest'],
            datasets: [{ data: [Math.round(principal), Math.round(prepayment > 0 ? totalInterestWithPrep : totalInterest)],
                backgroundColor: ['#3b82f6', '#f43f5e'],
                borderColor: isLight ? '#f8fafc' : '#020617', borderWidth: 3 }]
        },
        options: { responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: isLight ? '#475569' : '#94a3b8', boxWidth: 10, font: { size: 9 } } },
                tooltip: { callbacks: { label: c => c.label + ': \u20b9' + c.raw.toLocaleString('en-IN') } } }
        }
    });
}

// =================================================================
// SWP CALCULATOR — CORPUS DRAWDOWN SIMULATOR
// =================================================================
function calculateSWP() {
    const corpus = parseFloat(document.getElementById('swpCorpus')?.value) || 10000000;
    const monthlyWithdrawal = parseFloat(document.getElementById('swpMonthly')?.value) || 50000;
    const returnRate = parseFloat(document.getElementById('swpReturnRate')?.value) || 10;
    const inflation = parseFloat(document.getElementById('swpInflation')?.value) || 6;

    const rEl = document.getElementById('swpReturnRateVal'); if (rEl) rEl.innerText = returnRate.toFixed(1) + '%';
    const iEl = document.getElementById('swpInflationVal'); if (iEl) iEl.innerText = inflation.toFixed(1) + '%';

    const monthlyReturn = returnRate / 100 / 12;
    const monthlyInflation = inflation / 100 / 12;

    let balance = corpus, month = 0, depletion = -1;
    const yearsData = [], balanceData = [];
    while (balance > 0 && month <= 480) {
        if (month % 12 === 0) { yearsData.push('Yr ' + (month / 12)); balanceData.push(Math.round(Math.max(0, balance))); }
        const interest = balance * monthlyReturn;
        const inflWithdraw = monthlyWithdrawal * Math.pow(1 + monthlyInflation, month);
        balance = balance + interest - inflWithdraw;
        if (balance <= 0 && depletion === -1) depletion = month;
        month++;
    }

    const safeRate = ((monthlyWithdrawal * 12) / corpus * 100).toFixed(2);
    const fmt = n => '\u20b9' + Math.round(n).toLocaleString('en-IN');

    const depEl = document.getElementById('swpDepletionDate');
    if (depEl) {
        if (depletion === -1) { depEl.innerText = 'Never (Perpetual \u2665)'; depEl.className = 'text-xl font-black text-brand-400 block mt-1'; }
        else { const y = Math.floor(depletion/12), m2 = depletion%12; depEl.innerText = y + ' yrs ' + m2 + ' mo'; depEl.className = 'text-xl font-black block mt-1 ' + (y < 20 ? 'text-rose-400' : 'text-yellow-400'); }
    }
    const safeEl = document.getElementById('swpSafeRate');
    if (safeEl) { safeEl.innerText = safeRate + '% p.a.'; safeEl.className = 'text-2xl font-black block mt-1 ' + (parseFloat(safeRate) > 4 ? 'text-rose-400' : 'text-brand-400'); }
    const yr10El = document.getElementById('swp10YrCorpus');
    if (yr10El) yr10El.innerText = balanceData.length > 10 ? fmt(balanceData[10]) : fmt(0);

    const canvas = document.getElementById('swpDepletionChart'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (swpDepletionChartInstance) swpDepletionChartInstance.destroy();
    const isLight = document.body.classList.contains('light-mode');
    const grid = isLight ? 'rgba(15,23,42,0.06)' : 'rgba(51,65,85,0.15)';
    const tick = isLight ? '#475569' : '#94a3b8';
    swpDepletionChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: yearsData, datasets: [{ label: 'Remaining Corpus', data: balanceData,
            borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.08)', fill: true, borderWidth: 2, pointRadius: 2, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false,
            scales: {
                x: { grid: { color: grid }, ticks: { color: tick, font: { size: 9 }, maxTicksLimit: 10 } },
                y: { grid: { color: grid }, ticks: { color: tick, font: { size: 9 }, callback: v => v >= 1e7 ? '\u20b9'+(v/1e7).toFixed(1)+'Cr' : v >= 1e5 ? '\u20b9'+(v/1e5).toFixed(1)+'L' : '\u20b9'+v.toLocaleString() } }
            },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => 'Corpus: \u20b9'+c.raw.toLocaleString('en-IN') } } }
        }
    });
}

// =================================================================
// GOLD RETURNS CALCULATOR — CAGR + TAX ENGINE
// =================================================================
function calculateGoldReturns() {
    const purchasePrice = parseFloat(document.getElementById('grPurchasePrice')?.value) || 5000;
    const currentPrice  = parseFloat(document.getElementById('grCurrentPrice')?.value)  || 9500;
    const quantity      = parseFloat(document.getElementById('grQuantity')?.value)      || 100;
    const yearsHeld     = parseInt(document.getElementById('grYearsHeld')?.value)       || 5;
    const form          = document.getElementById('grForm')?.value || 'physical';

    const yhEl = document.getElementById('grYearsHeldVal'); if (yhEl) yhEl.innerText = yearsHeld + ' yrs';

    const purchaseValue = purchasePrice * quantity;
    const currentValue  = currentPrice  * quantity;
    const absoluteGain  = currentValue - purchaseValue;
    const gainPct = purchaseValue > 0 ? (absoluteGain / purchaseValue) * 100 : 0;
    const cagr = purchasePrice > 0 && yearsHeld > 0 ? (Math.pow(currentPrice / purchasePrice, 1 / yearsHeld) - 1) * 100 : 0;

    // Tax calculation
    let taxAmount = 0, taxNote = '', postTaxGain = absoluteGain;
    if (absoluteGain > 0) {
        if (yearsHeld >= 3) {
            if (form === 'physical') {
                const indexedCost = purchaseValue * Math.pow(1.06, yearsHeld);
                const indexedGain = Math.max(0, currentValue - indexedCost);
                taxAmount = indexedGain * 0.20;
                taxNote = '20% LTCG with CII indexation (Physical Gold)';
            } else if (form === 'etf') {
                taxAmount = absoluteGain * 0.20;
                taxNote = '20% LTCG without indexation (Gold ETF)';
            } else {
                taxAmount = 0;
                taxNote = '\u2705 TAX-FREE — SGB redemption at maturity';
            }
        } else {
            taxAmount = absoluteGain * 0.30;
            taxNote = 'STCG at income tax slab rate (~30% assumed, <3 yr holding)';
        }
    } else { taxNote = 'No gain — no tax applicable'; }
    postTaxGain = absoluteGain - taxAmount;

    const fmt = n => '\u20b9' + Math.round(Math.abs(n)).toLocaleString('en-IN');
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };

    setTxt('grCurrentValue', fmt(currentValue));
    setTxt('grCAGR', cagr.toFixed(2) + '% p.a.');
    setTxt('grPostTax', fmt(postTaxGain));
    setTxt('grTaxNote', '\u20b9' + Math.round(taxAmount).toLocaleString('en-IN') + ' tax \u2014 ' + taxNote);

    const gainEl = document.getElementById('grAbsGain');
    if (gainEl) {
        gainEl.innerText = (absoluteGain >= 0 ? '+' : '\u2212') + fmt(absoluteGain) + ' (' + gainPct.toFixed(1) + '%)';
        gainEl.className = 'text-xl font-black block mt-1 ' + (absoluteGain >= 0 ? 'text-brand-400' : 'text-rose-400');
    }

    // Year-by-year bar chart
    const yearLabels = [], yearValues = [];
    for (let y = 0; y <= yearsHeld; y++) {
        yearLabels.push('Yr ' + y);
        yearValues.push(Math.round(purchaseValue * Math.pow(1 + cagr / 100, y)));
    }
    const canvas = document.getElementById('goldReturnsChart'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (goldReturnsChartInstance) goldReturnsChartInstance.destroy();
    const isLight = document.body.classList.contains('light-mode');
    const grid = isLight ? 'rgba(15,23,42,0.06)' : 'rgba(51,65,85,0.15)';
    const tick = isLight ? '#475569' : '#94a3b8';
    goldReturnsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: yearLabels, datasets: [{ label: 'Portfolio Value', data: yearValues,
            backgroundColor: yearValues.map((v, i) => i === yearValues.length - 1 ? 'rgba(234,179,8,0.9)' : 'rgba(234,179,8,0.4)'),
            borderColor: '#eab308', borderWidth: 1, borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false,
            scales: {
                x: { grid: { color: grid }, ticks: { color: tick, font: { size: 9 } } },
                y: { grid: { color: grid }, ticks: { color: tick, font: { size: 9 }, callback: v => v >= 1e7 ? '\u20b9'+(v/1e7).toFixed(1)+'Cr' : v >= 1e5 ? '\u20b9'+(v/1e5).toFixed(1)+'L' : '\u20b9'+v.toLocaleString() } }
            },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => '\u20b9'+c.raw.toLocaleString('en-IN') } } }
        }
    });
}

// =================================================================
// SIP CALCULATOR — 4 MODE ENGINE (Regular, Step-Up, Lump+SIP, Goal)
// =================================================================
let sipMarketInterval = null;

function calculateSIP() {
    const mode = state.sipMode || 'regular';
    const rate = parseFloat(document.getElementById('sipReturnRate')?.value) || 12;
    const tenure = parseInt(document.getElementById('sipTenure')?.value) || 15;
    const monthlySIP = parseFloat(document.getElementById('sipAmount')?.value) || 10000;
    const stepUpPct = parseFloat(document.getElementById('sipStepUpPct')?.value) || 10;
    const lumpsumAmt = parseFloat(document.getElementById('sipLumpsumAmt')?.value) || 0;
    const goalAmt = parseFloat(document.getElementById('sipGoalAmt')?.value) || 10000000;
    const existingAmt = parseFloat(document.getElementById('sipExistingAmt')?.value) || 0;

    // Update display labels
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    setTxt('sipReturnRateVal', rate.toFixed(1) + '%');
    setTxt('sipTenureVal', tenure + ' yrs');
    setTxt('sipStepUpPctVal', stepUpPct + '%');
    setTxt('sipNiftyLive', '₹' + Math.round(state.spotPrice).toLocaleString('en-IN'));
    const now = new Date();
    setTxt('sipLastRefresh', now.toLocaleTimeString('en-IN'));

    const months = tenure * 12;
    const monthlyRate = rate / 100 / 12;
    const yearlyRate = rate / 100;

    let totalInvested = 0;
    let finalValue = 0;
    let yearlyData = [];

    if (mode === 'regular') {
        // FV of annuity due (monthly investment at beginning of period)
        if (monthlyRate > 0) {
            finalValue = monthlySIP * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
        } else {
            finalValue = monthlySIP * months;
        }
        totalInvested = monthlySIP * months;

        // Build yearly data
        for (let y = 0; y <= tenure; y++) {
            const m = y * 12;
            const inv = monthlySIP * m;
            let fv = 0;
            if (m > 0 && monthlyRate > 0) {
                fv = monthlySIP * ((Math.pow(1 + monthlyRate, m) - 1) / monthlyRate) * (1 + monthlyRate);
            }
            yearlyData.push({ year: y, invested: inv, value: Math.round(fv) });
        }

        setTxt('sipMetric4Label', 'Investment Type');
        setTxt('sipMetric4Value', 'Regular SIP');

    } else if (mode === 'stepup') {
        const stepRate = stepUpPct / 100;
        let totalInv = 0;
        let fv = 0;
        yearlyData.push({ year: 0, invested: 0, value: 0 });
        let currentSIP = monthlySIP;

        for (let y = 1; y <= tenure; y++) {
            const annualInv = currentSIP * 12;
            totalInv += annualInv;
            // Compound previous FV for 1 year + add this year's SIP (end of year)
            fv = fv * (1 + yearlyRate) + currentSIP * ((Math.pow(1 + monthlyRate, 12) - 1) / monthlyRate) * (1 + monthlyRate);
            yearlyData.push({ year: y, invested: totalInv, value: Math.round(fv) });
            currentSIP *= (1 + stepRate); // step up for next year
        }
        totalInvested = totalInv;
        finalValue = fv;

        setTxt('sipMetric4Label', 'Final SIP');
        setTxt('sipMetric4Value', '₹' + Math.round(currentSIP / (1 + stepRate)).toLocaleString('en-IN') + '/mo');

    } else if (mode === 'lumpsum') {
        // FV of lump sum + annuity of monthly SIP
        const fvLumpsum = lumpsumAmt * Math.pow(1 + yearlyRate, tenure);
        let fvSIP = 0;
        if (monthlyRate > 0) {
            fvSIP = monthlySIP * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
        } else {
            fvSIP = monthlySIP * months;
        }
        finalValue = fvLumpsum + fvSIP;
        totalInvested = lumpsumAmt + monthlySIP * months;

        // Yearly data
        for (let y = 0; y <= tenure; y++) {
            const m = y * 12;
            const inv = lumpsumAmt + monthlySIP * m;
            const fvL = lumpsumAmt * Math.pow(1 + yearlyRate, y);
            let fvS = 0;
            if (m > 0 && monthlyRate > 0) {
                fvS = monthlySIP * ((Math.pow(1 + monthlyRate, m) - 1) / monthlyRate) * (1 + monthlyRate);
            }
            yearlyData.push({ year: y, invested: inv, value: Math.round(fvL + fvS) });
        }

        setTxt('sipMetric4Label', 'Lump Sum');
        setTxt('sipMetric4Value', '₹' + Math.round(lumpsumAmt).toLocaleString('en-IN'));

    } else if (mode === 'goal') {
        // Reverse engineer required SIP
        const fvExisting = existingAmt * Math.pow(1 + yearlyRate, tenure);
        const remaining = Math.max(0, goalAmt - fvExisting);
        let requiredSIP = 0;
        if (remaining > 0 && monthlyRate > 0) {
            const annuityFactor = ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
            requiredSIP = remaining / annuityFactor;
        }
        totalInvested = requiredSIP * months;
        finalValue = goalAmt;
        // SIP-based final
        let fvSIP = 0;
        if (monthlyRate > 0) {
            fvSIP = requiredSIP * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
        } else {
            fvSIP = requiredSIP * months;
        }
        finalValue = fvExisting + fvSIP;

        // Yearly data
        for (let y = 0; y <= tenure; y++) {
            const m = y * 12;
            const inv = (requiredSIP * m) + existingAmt;
            const fvE = existingAmt * Math.pow(1 + yearlyRate, y);
            let fvS = 0;
            if (m > 0 && monthlyRate > 0) {
                fvS = requiredSIP * ((Math.pow(1 + monthlyRate, m) - 1) / monthlyRate) * (1 + monthlyRate);
            }
            yearlyData.push({ year: y, invested: inv, value: Math.round(fvE + fvS) });
        }

        setTxt('sipRequiredSIP', '₹' + Math.round(requiredSIP).toLocaleString('en-IN'));
        setTxt('sipGoalTarget', '₹' + Math.round(goalAmt).toLocaleString('en-IN'));
        setTxt('sipGoalExistingFV', '₹' + Math.round(fvExisting).toLocaleString('en-IN'));
        setTxt('sipGoalGap', '₹' + Math.round(Math.max(0, goalAmt - fvExisting)).toLocaleString('en-IN'));
        setTxt('sipMetric4Label', 'Required SIP');
        setTxt('sipMetric4Value', '₹' + Math.round(requiredSIP).toLocaleString('en-IN') + '/mo');
    }

    const estReturns = Math.max(0, finalValue - totalInvested);
    const returnsPct = totalInvested > 0 ? (estReturns / totalInvested) * 100 : 0;

    // Update metric cards with flash animation
    const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');
    const flashEl = (id) => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('sip-value-flash', 'sip-return-flash');
            void el.offsetWidth; // force reflow
            el.classList.add(id === 'sipTotalInvested' ? 'sip-value-flash' : 'sip-return-flash');
        }
    };
    flashEl('sipTotalInvested');
    flashEl('sipEstReturns');
    flashEl('sipFinalValue');
    setTxt('sipTotalInvested', fmt(totalInvested));
    setTxt('sipEstReturns', fmt(estReturns));
    setTxt('sipFinalValue', fmt(finalValue));

    // Wealth ratio bar with glow animation
    const total = totalInvested + estReturns;
    const invPct = total > 0 ? (totalInvested / total) * 100 : 50;
    const retPct = total > 0 ? (estReturns / total) * 100 : 50;
    ['sipInvestedBarFill', 'sipReturnsBarFill'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('sip-bar-glow');
            void el.offsetWidth;
            el.classList.add('sip-bar-glow');
        }
    });
    document.getElementById('sipInvestedBarFill').style.width = invPct.toFixed(1) + '%';
    document.getElementById('sipReturnsBarFill').style.width = retPct.toFixed(1) + '%';
    setTxt('sipInvestedPct', invPct.toFixed(1) + '%');
    setTxt('sipReturnsPct', retPct.toFixed(1) + '%');

    // Year-by-year table with staggered row animation
    const tbody = document.getElementById('sipYearTableBody');
    if (tbody) {
        tbody.innerHTML = yearlyData.map((d, idx) => {
            const yReturn = d.invested > 0 ? ((d.value - d.invested) / d.invested * 100) : 0;
            const delay = Math.min(idx * 20, 400);
            return `<tr class="border-b border-slate-800/40 hover:bg-slate-900/60 transition-colors duration-200" style="animation:sipFadeSlideUp 0.35s cubic-bezier(0.16,1,0.3,1) ${delay}ms both">
                <td class="py-2 pr-4 text-slate-300">Year ${d.year === 0 ? '0 (Start)' : d.year}</td>
                <td class="text-right pr-4 text-slate-400">${fmt(d.invested - (yearlyData[Math.max(0, d.year - 1)]?.invested || 0))}</td>
                <td class="text-right pr-4 text-slate-300">${fmt(d.invested)}</td>
                <td class="text-right pr-4 text-white font-bold text-base">${fmt(d.value)}</td>
                <td class="text-right font-bold ${yReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${yReturn >= 0 ? '+' : ''}${yReturn.toFixed(1)}%</td>
            </tr>`;
        }).join('');
    }

    // Render SIP Growth Chart
    const canvas = document.getElementById('sipGrowthChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (sipGrowthChartInstance) sipGrowthChartInstance.destroy();

    const isLight = document.body.classList.contains('light-mode');
    const gridColor = isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(51, 65, 85, 0.15)';
    const tickColor = isLight ? '#475569' : '#94a3b8';
    const legendColor = isLight ? '#0f172a' : '#f8fafc';

    sipGrowthChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: yearlyData.map(d => 'Yr ' + d.year),
            datasets: [
                {
                    label: 'Portfolio Value',
                    data: yearlyData.map(d => d.value),
                    borderColor: '#10b981',
                    backgroundColor: isLight ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.05)',
                    fill: true,
                    borderWidth: 2,
                    pointRadius: yearlyData.length <= 15 ? 3 : 0,
                    tension: 0.3
                },
                {
                    label: 'Total Invested',
                    data: yearlyData.map(d => d.invested),
                    borderColor: '#64748b',
                    borderDash: [5, 5],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: { color: tickColor, font: { family: 'Plus Jakarta Sans', size: 9 }, maxTicksLimit: 10 }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        color: tickColor,
                        font: { family: 'Plus Jakarta Sans', size: 9 },
                        callback: function(value) {
                            if (value >= 10000000) return '₹' + (value / 10000000).toFixed(1) + 'Cr';
                            if (value >= 100000) return '₹' + (value / 100000).toFixed(1) + 'L';
                            return '₹' + value.toLocaleString('en-IN');
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: legendColor, boxWidth: 10, font: { family: 'Plus Jakarta Sans', size: 10 } }
                },
                tooltip: {
                    backgroundColor: isLight ? '#ffffff' : '#020617',
                    borderColor: isLight ? '#cbd5e1' : '#1e293b',
                    borderWidth: 1,
                    titleColor: isLight ? '#0f172a' : '#fff',
                    bodyColor: isLight ? '#0f172a' : '#e2e8f0',
                    bodyFont: { family: 'JetBrains Mono', size: 9 },
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ₹' + context.raw.toLocaleString('en-IN');
                        }
                    }
                }
            }
        }
    });
}

// =================================================================
// LIVE TICKER STRIP — Auto-fetches multiple indices from Yahoo Finance
// =================================================================
let tickerInterval = null;

async function fetchLiveTickerData() {
    const tickers = [
        { symbol: '^NSEI', label: 'NIFTY 50' },
        { symbol: '^NSEBANK', label: 'BANK NIFTY' },
        { symbol: '^BSESN', label: 'SENSEX' },
        { symbol: '^CNXIT', label: 'NIFTY IT', fallback: true },
        { symbol: '^CNXENERGY', label: 'NIFTY ENERGY', fallback: true },
        { symbol: '^CNXAUTO', label: 'NIFTY AUTO', fallback: true },
        { symbol: '^CNXPHARMA', label: 'NIFTY PHARMA', fallback: true },
        { symbol: '^CNXFMCG', label: 'NIFTY FMCG', fallback: true },
        { symbol: '^CNXMETAL', label: 'NIFTY METAL', fallback: true },
        { symbol: '^CNXREALTY', label: 'NIFTY REALTY', fallback: true }
    ];

    let results = [];
    let anySuccess = false;

    for (const t of tickers) {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t.symbol)}?interval=1d&range=5d`;
            const data = await fetchWithProxy(url);
            const result = data?.chart?.result?.[0];
            if (!result) continue;
            const meta = result.meta;
            const price = meta.regularMarketPrice;
            const prevClose = meta.previousClose || result.indicators?.quote?.[0]?.close?.[0] || price;
            if (!price || price <= 0) continue;
            anySuccess = true;
            const chg = price - prevClose;
            const chgPct = prevClose > 0 ? (chg / prevClose) * 100 : 0;
            const sign = chg >= 0 ? '+' : '';
            const cls = chg >= 0 ? 'ticker-up' : 'ticker-down';

            results.push({
                label: t.label, price, chg, chgPct, sign, cls,
                html: `<span class="ticker-item ${cls}">
                    <span class="font-bold opacity-80">${t.label}</span>
                    <span class="font-black tracking-tight">₹${Math.round(price).toLocaleString('en-IN')}</span>
                    <span class="font-bold">${sign}${chg.toFixed(2)}</span>
                    <span class="font-bold">(${sign}${chgPct.toFixed(2)}%)</span>
                </span>`
            });
        } catch (e) {
            // silently skip failed tickers
        }
    }

    setOnlineStatus(anySuccess);

    // Always show at least the header Nifty even if API fails, with local spot
    if (results.length === 0) {
        const spot = state.spotPrice || 23622.90;
        results.push({
            label: 'NIFTY 50', price: spot, chg: 0, chgPct: 0, sign: '', cls: 'ticker-neutral',
            html: `<span class="ticker-item ticker-neutral">
                <span class="font-bold opacity-80">NIFTY 50</span>
                <span class="font-black tracking-tight">₹${Math.round(spot).toLocaleString('en-IN')}</span>
                <span class="font-bold">0.00 (0.00%)</span>
            </span>`
        });
    }

    const track = document.getElementById('liveTickerTrack');
    if (track) {
        track.innerHTML = results.map(r => r.html).join('') + results.map(r => r.html).join('');
        const ageEl = document.getElementById('liveDataAge');
        if (ageEl) {
            const now = new Date();
            ageEl.innerText = (anySuccess ? 'live' : 'offline') + ' · ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            ageEl.className = 'text-[9px] ' + (anySuccess ? 'text-brand-400' : 'text-rose-500') + ' ml-0.5 font-bold';
        }
    }

    const primary = results.find(r => r.label === 'NIFTY 50');
    const hStatus = document.getElementById('headerMarketStatusText');
    if (hStatus && primary) {
        hStatus.innerText = `NIFTY 50: ₹${Math.round(primary.price).toLocaleString('en-IN')}`;
    }
}

// Cycle header ticker on click — force refresh and animate
function cycleMarketTicker() {
    const hStatus = document.getElementById('headerMarketStatusText');
    if (hStatus) hStatus.classList.add('text-brand-300');
    fetchLiveTickerData();
    setTimeout(() => { if (hStatus) hStatus.classList.remove('text-brand-300'); }, 1500);
}

// =================================================================
// SHARED CORS PROXY FALLBACK — tries multiple proxies automatically
// =================================================================
const PROXY_LIST = [
    { url: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`, raw: true },
    { url: (u) => `https://api.cors.syrins.tech/?url=${encodeURIComponent(u)}`, raw: true },
    { url: (u) => `https://blkproxy.iambhvsh.in/api/proxy?url=${encodeURIComponent(u)}`, raw: true },
    { url: (u) => `https://proxy.2677929.xyz/${u}`, raw: true },
    { url: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, raw: false }
];

async function fetchWithProxy(yahooUrl) {
    for (let i = 0; i < PROXY_LIST.length; i++) {
        try {
            const proxyUrl = PROXY_LIST[i].url(yahooUrl);
            const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
            if (!resp.ok) continue;
            let data;
            if (PROXY_LIST[i].raw) {
                data = await resp.json();
            } else {
                const wrapped = await resp.json();
                data = JSON.parse(wrapped.contents);
            }
            if (data?.chart?.result?.[0]?.meta?.regularMarketPrice > 0) return data;
        } catch (err) {
            console.warn(`Proxy ${i + 1} failed:`, err?.message?.slice(0, 60));
        }
    }
    throw new Error('All CORS proxies failed');
}

// Visual offline indicator
function setOnlineStatus(online) {
    const dot = document.getElementById('syncIndicatorDot');
    const age = document.getElementById('liveDataAge');
    const hStatus = document.getElementById('headerMarketStatusText');
    if (!dot || !age) return;
    if (online) {
        dot.className = 'w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse';
        age.innerText = age.innerText.includes('live') ? age.innerText : 'live';
        age.className = 'text-[9px] text-brand-400 ml-0.5 font-bold';
        if (hStatus) hStatus.className = 'text-[10px] bg-slate-900 border border-slate-800 text-brand-400 px-3 py-1.5 rounded-xl font-mono flex items-center gap-1.5 shadow-inner';
    } else {
        dot.className = 'w-1.5 h-1.5 rounded-full bg-slate-600';
        age.innerText = 'offline';
        age.className = 'text-[9px] text-rose-500 ml-0.5 font-bold';
        if (hStatus) hStatus.className = 'text-[10px] bg-slate-900 border border-rose-900/50 text-rose-400 px-3 py-1.5 rounded-xl font-mono flex items-center gap-1.5 shadow-inner';
    }
}

// =================================================================
// LIVE MARKET DATA — Nifty 50, Bank Nifty, Sensex via Yahoo Finance
// =================================================================
async function fetchLiveMarketData() {
    const tickers = [
        { symbol: '^NSEI', id: 'sipBenchNifty', chgId: 'sipBenchNiftyChg' },
        { symbol: '^NSEBANK', id: 'sipBenchBankNifty', chgId: 'sipBenchBankNiftyChg' },
        { symbol: '^BSESN', id: 'sipBenchSensex', chgId: 'sipBenchSensexChg' }
    ];

    let anySuccess = false;

    for (const t of tickers) {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t.symbol)}?interval=1d&range=1d`;
            const data = await fetchWithProxy(url);
            const result = data?.chart?.result?.[0];
            if (!result) continue;
            anySuccess = true;
            const meta = result.meta;
            const price = meta.regularMarketPrice;
            const prevClose = meta.previousClose || price;
            const chg = price - prevClose;
            const chgPct = prevClose > 0 ? (chg / prevClose) * 100 : 0;
            const sign = chg >= 0 ? '+' : '';

            const priceEl = document.getElementById(t.id);
            const chgEl = document.getElementById(t.chgId);
            if (priceEl) {
                priceEl.innerText = '₹' + Math.round(price).toLocaleString('en-IN');
                priceEl.className = 'text-2xl font-black block mt-1 ' + (chg >= 0 ? 'text-emerald-300' : 'text-rose-400');
            }
            if (chgEl) {
                chgEl.innerText = `${sign}${chg.toFixed(2)} (${sign}${chgPct.toFixed(2)}%)`;
                chgEl.className = 'text-sm font-bold mt-1 block ' + (chg >= 0 ? 'text-emerald-300' : 'text-rose-400');
            }

            if (t.symbol === '^NSEI' && price > 0) {
                const spotEl = document.getElementById('spotPrice');
                if (spotEl) {
                    state.spotPrice = price;
                    spotEl.value = price.toFixed(2);
                }
                document.getElementById('sipNiftyLive').innerText = '₹' + Math.round(price).toLocaleString('en-IN');
            }
            if (priceEl) {
                priceEl.classList.remove('sip-value-flash');
                void priceEl.offsetWidth;
                priceEl.classList.add('sip-value-flash');
            }
        } catch (e) {
            console.warn('Failed to fetch ' + t.symbol, e?.message?.slice(0, 60));
        }
    }
    setOnlineStatus(anySuccess);
    const sDot = document.getElementById('sipLiveDot');
    const sStatus = document.getElementById('sipLiveStatus');
    if (sDot) sDot.className = 'w-2 h-2 rounded-full ' + (anySuccess ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600');
    if (sStatus) {
        sStatus.innerText = anySuccess ? 'Live Market' : 'Offline Data';
        sStatus.className = anySuccess ? 'text-emerald-300' : 'text-rose-400';
    }
}

// =================================================================
// ASSET ALLOCATION CALCULATOR — RULE-BASED ENGINE
// =================================================================
function calculateAssetAllocation() {
    const amount  = parseFloat(document.getElementById('assetAmount')?.value)  || 1000000;
    const age     = parseInt(document.getElementById('assetAge')?.value)     || 35;
    const horizon = parseInt(document.getElementById('assetHorizon')?.value) || 15;
    const risk    = document.getElementById('assetRisk')?.value || 'moderate';
    const curEquity = parseFloat(document.getElementById('assetCurrentEquity')?.value) || 60;
    const curDebt   = parseFloat(document.getElementById('assetCurrentDebt')?.value)   || 25;
    const curGold   = parseFloat(document.getElementById('assetCurrentGold')?.value)   || 10;
    const curCash   = parseFloat(document.getElementById('assetCurrentCash')?.value)   || 5;

    // Update labels
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    setTxt('assetAgeVal', age + ' yrs');
    setTxt('assetHorizonVal', horizon + ' yrs');
    setTxt('assetCurrentEquityVal', curEquity + '%');
    setTxt('assetCurrentDebtVal',   curDebt   + '%');
    setTxt('assetCurrentGoldVal',   curGold   + '%');
    setTxt('assetCurrentCashVal',   curCash   + '%');

    // Rule-based recommended allocation
    const baseEquity = Math.max(20, Math.min(80, 100 - age));
    let recEquity, recDebt, recGold, recCash;
    if (risk === 'aggressive') {
        recEquity = Math.min(90, baseEquity + 15); recGold = 5;
        recDebt = Math.max(5, 85 - recEquity); recCash = Math.max(0, 100 - recEquity - recDebt - recGold);
    } else if (risk === 'conservative') {
        recEquity = Math.max(20, baseEquity - 20); recGold = 10; recDebt = 50;
        recCash = Math.max(0, 100 - recEquity - recDebt - recGold);
    } else {
        recEquity = baseEquity; recGold = 10;
        recDebt = Math.max(10, 80 - recEquity); recCash = Math.max(0, 100 - recEquity - recDebt - recGold);
    }
    // Normalise if total != 100 due to clamping
    const tot = recEquity + recDebt + recGold + recCash;
    if (tot !== 100) recDebt = Math.max(0, recDebt + (100 - tot));

    // Blended expected return (simplified annual assumptions)
    const EQ_R=12, DB_R=7, GD_R=10, CS_R=4;
    const blended = (recEquity*EQ_R + recDebt*DB_R + recGold*GD_R + recCash*CS_R) / 100;
    const projected = amount * Math.pow(1 + blended / 100, horizon);
    const diversScore = Math.min(100, Math.max(0, Math.round(
        100 - Math.abs(recEquity - curEquity) * 0.6 - Math.abs(recDebt - curDebt) * 0.3 - Math.abs(recGold - curGold) * 0.1
    )));

    const fmt = n => '\u20b9' + Math.round(n).toLocaleString('en-IN');
    setTxt('assetProjectedValue', fmt(projected));
    setTxt('assetBlendedReturn', blended.toFixed(1) + '% p.a.');

    const scoreEl = document.getElementById('assetDiversScore');
    if (scoreEl) {
        scoreEl.innerText = diversScore + '/100';
        scoreEl.className = 'text-2xl font-black block mt-1 ' + (diversScore >= 80 ? 'text-brand-400' : diversScore >= 60 ? 'text-yellow-400' : 'text-rose-400');
    }

    // Update allocation bars and diff labels
    const assets = ['Equity','Debt','Gold','Cash'];
    const recs = [recEquity, recDebt, recGold, recCash];
    const curs = [curEquity, curDebt, curGold, curCash];
    assets.forEach((a, i) => {
        const rb = document.getElementById('assetRec'+a+'Bar'); if (rb) rb.style.width = recs[i] + '%';
        const cb = document.getElementById('assetCur'+a+'Bar'); if (cb) cb.style.width = curs[i] + '%';
        setTxt('assetRec'+a+'Label', recs[i] + '%');
        setTxt('assetCur'+a+'Label', curs[i] + '%');
        const diff = recs[i] - curs[i];
        const dEl = document.getElementById('assetDiff'+a);
        if (dEl) { dEl.innerText = (diff >= 0 ? '+' : '') + diff.toFixed(0) + '%'; dEl.className = 'font-bold text-xs ' + (diff > 0 ? 'text-brand-400' : diff < 0 ? 'text-rose-400' : 'text-slate-400'); }
    });

    // Doughnut chart
    const canvas = document.getElementById('assetAllocationChart'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (assetAllocationChartInstance) assetAllocationChartInstance.destroy();
    const isLight = document.body.classList.contains('light-mode');
    assetAllocationChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Equity', 'Debt', 'Gold', 'Cash'],
            datasets: [{ data: [recEquity, recDebt, recGold, recCash],
                backgroundColor: ['#3b82f6','#8b5cf6','#eab308','#10b981'],
                borderColor: isLight ? '#f8fafc' : '#020617', borderWidth: 3 }] },
        options: { responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: isLight ? '#475569' : '#94a3b8', boxWidth: 10, font: { size: 9 } } },
                tooltip: { callbacks: { label: c => c.label + ': ' + c.raw + '%' } } }
        }
    });
}

// =================================================================
// FD CALCULATOR
// =================================================================
function calculateFD() {
    const principal = parseFloat(document.getElementById('fdPrincipal')?.value) || 100000;
    const rate = parseFloat(document.getElementById('fdRate')?.value) || 7;
    const tenure = parseFloat(document.getElementById('fdTenure')?.value) || 3;
    const freq = document.getElementById('fdFreq')?.value || 'yearly';
    const taxRate = parseFloat(document.getElementById('fdTaxRate')?.value) || 0;

    const nMap = { yearly: 1, half: 2, quarterly: 4, monthly: 12 };
    const n = nMap[freq] || 1;
    const r = rate / 100 / n;
    const t = tenure * n;
    const maturity = principal * Math.pow(1 + r, t);
    const interest = maturity - principal;
    const postTax = interest * (1 - taxRate / 100);
    const effRate = ((Math.pow(maturity / principal, 1 / tenure) - 1) * 100);

    const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');
    document.getElementById('fdMaturity').innerText = fmt(maturity);
    document.getElementById('fdInterest').innerText = fmt(interest);
    document.getElementById('fdPostTax').innerText = fmt(postTax > 0 ? principal + postTax : maturity);
    document.getElementById('fdEffRate').innerText = effRate.toFixed(2) + '%';
}

// =================================================================
// RD CALCULATOR
// =================================================================
function calculateRD() {
    const monthly = parseFloat(document.getElementById('rdMonthly')?.value) || 5000;
    const rate = parseFloat(document.getElementById('rdRate')?.value) || 7.5;
    const tenure = parseInt(document.getElementById('rdTenure')?.value) || 5;

    const n = 4; // quarterly compounding
    const r = rate / 100 / n;
    const months = tenure * 12;
    const quarters = tenure * n;

    // RD formula: M = R * ((1+r)^n - 1) / (1 - (1+r)^(-1/3))
    // Simplified: sum of each monthly deposit compounded quarterly
    let maturity = 0;
    for (let m = 1; m <= months; m++) {
        const qRemaining = Math.ceil((months - m + 1) / 3);
        maturity += monthly * Math.pow(1 + r, qRemaining);
    }
    const totalDeposits = monthly * months;
    const interest = maturity - totalDeposits;

    const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');
    document.getElementById('rdMaturity').innerText = fmt(maturity);
    document.getElementById('rdTotalDeposits').innerText = fmt(totalDeposits);
    document.getElementById('rdInterest').innerText = fmt(interest);
}

// =================================================================
// PPF CALCULATOR
// =================================================================
function calculatePPF() {
    const annual = parseFloat(document.getElementById('ppfAnnual')?.value) || 150000;
    const rate = parseFloat(document.getElementById('ppfRate')?.value) || 7.1;
    const tenure = parseInt(document.getElementById('ppfTenure')?.value) || 15;

    const r = rate / 100;
    let maturity = 0;
    const yearlyData = [];
    for (let y = 1; y <= tenure; y++) {
        maturity = (maturity + annual) * (1 + r);
        yearlyData.push({ year: y, invested: annual * y, value: Math.round(maturity) });
    }
    const totalDeposits = annual * tenure;
    const interest = maturity - totalDeposits;

    const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');
    document.getElementById('ppfMaturity').innerText = fmt(maturity);
    document.getElementById('ppfTotalDeposits').innerText = fmt(totalDeposits);
    document.getElementById('ppfInterest').innerText = fmt(interest);
    document.getElementById('ppfRateDisplay').innerText = rate.toFixed(1) + '% p.a.';

    // Yearly table
    const tbody = document.getElementById('ppfYearTable');
    if (tbody) {
        tbody.innerHTML = yearlyData.map((d, i) => {
            const delay = Math.min(i * 15, 300);
            return `<tr class="border-b border-slate-800/40 hover:bg-slate-900/60 transition-colors" style="animation:sipFadeSlideUp 0.3s ${delay}ms both">
                <td class="py-1.5 pr-4 text-slate-300">${d.year}</td>
                <td class="text-right pr-4 text-slate-400">${fmt(annual)}</td>
                <td class="text-right pr-4 text-slate-300">${fmt(d.invested)}</td>
                <td class="text-right pr-4 text-white font-bold text-sm">${fmt(d.value)}</td>
                <td class="text-right text-emerald-400">${(((d.value - d.invested) / d.invested) * 100).toFixed(1)}%</td>
            </tr>`;
        }).join('');
    }
}

// =================================================================
// NPS CALCULATOR
// =================================================================
function calculateNPS() {
    const monthly = parseFloat(document.getElementById('npsMonthly')?.value) || 5000;
    const employer = parseFloat(document.getElementById('npsEmployer')?.value) || 5000;
    const age = parseInt(document.getElementById('npsAge')?.value) || 30;
    const retireAge = parseInt(document.getElementById('npsRetireAge')?.value) || 60;
    const expReturn = parseFloat(document.getElementById('npsReturn')?.value) || 10;
    const annuityPct = parseFloat(document.getElementById('npsAnnuity')?.value) || 40;
    const annuityReturn = parseFloat(document.getElementById('npsAnnuityReturn')?.value) || 6;

    const yearsToRetire = Math.max(1, retireAge - age);
    const months = yearsToRetire * 12;
    const monthlyRate = expReturn / 100 / 12;
    const totalMonthly = monthly + employer;

    // FV of monthly contributions
    let corpus = 0;
    if (monthlyRate > 0) {
        corpus = totalMonthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
    } else {
        corpus = totalMonthly * months;
    }
    const totalInvested = totalMonthly * months;

    // At retirement: lump sum withdrawal + annuity
    const lumpSum = corpus * (1 - annuityPct / 100);
    const annuityInvestment = corpus * (annuityPct / 100);
    const monthlyPension = (annuityInvestment * (annuityReturn / 100)) / 12;

    const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');
    document.getElementById('npsCorpus').innerText = fmt(corpus);
    document.getElementById('npsLumpSum').innerText = fmt(lumpSum);
    document.getElementById('npsPension').innerText = fmt(monthlyPension) + '/mo';
    document.getElementById('npsTotalInvested').innerText = fmt(totalInvested);
}

// =================================================================
// RETIREMENT CORPUS CALCULATOR
// =================================================================
function calculateRetirement() {
    const currentAge = parseInt(document.getElementById('retCurrentAge')?.value) || 30;
    const retireAge = parseInt(document.getElementById('retRetireAge')?.value) || 60;
    const lifeExp = parseInt(document.getElementById('retLifeExp')?.value) || 85;
    const monthlyExp = parseFloat(document.getElementById('retMonthlyExp')?.value) || 50000;
    const inflation = parseFloat(document.getElementById('retInflation')?.value) || 6;
    const preRetReturn = parseFloat(document.getElementById('retPreReturn')?.value) || 12;
    const postRetReturn = parseFloat(document.getElementById('retPostReturn')?.value) || 7;
    const currentSavings = parseFloat(document.getElementById('retCurrentSavings')?.value) || 0;

    const yearsToRetire = Math.max(1, retireAge - currentAge);
    const retirementYears = Math.max(1, lifeExp - retireAge);
    const monthlyInfl = inflation / 100;
    const monthlyPostRet = postRetReturn / 100 / 12;

    // Monthly expense at retirement (inflation adjusted)
    const expAtRetire = monthlyExp * Math.pow(1 + monthlyInfl, yearsToRetire);

    // Corpus needed at retirement (PV of inflation-adjusted expenses for retirement years)
    // Using PV of growing annuity
    let corpusNeeded = 0;
    const retireMonths = retirementYears * 12;
    if (Math.abs(monthlyPostRet - monthlyInfl / 12) > 0.0001) {
        const g = monthlyInfl / 12;
        const r2 = monthlyPostRet;
        corpusNeeded = expAtRetire * ((1 - Math.pow((1 + g) / (1 + r2), retireMonths)) / (r2 - g));
    } else {
        corpusNeeded = expAtRetire * retireMonths;
    }

    // Current savings growth
    const fvSavings = currentSavings * Math.pow(1 + preRetReturn / 100, yearsToRetire);
    const gap = Math.max(0, corpusNeeded - fvSavings);

    // Monthly SIP needed to fill gap
    const monthlyRate = preRetReturn / 100 / 12;
    let requiredSIP = 0;
    if (gap > 0 && monthlyRate > 0 && yearsToRetire > 0) {
        const monthsToRetire = yearsToRetire * 12;
        requiredSIP = gap / (((Math.pow(1 + monthlyRate, monthsToRetire) - 1) / monthlyRate) * (1 + monthlyRate));
    }

    const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');
    document.getElementById('retExpAtRetire').innerText = fmt(expAtRetire) + '/mo';
    document.getElementById('retCorpusNeeded').innerText = fmt(corpusNeeded);
    document.getElementById('retFvSavings').innerText = fmt(fvSavings);
    document.getElementById('retGap').innerText = fmt(gap);
    document.getElementById('retRequiredSIP').innerText = fmt(requiredSIP) + '/mo';
}

// =================================================================
// TAX CALCULATOR (India — Old vs New Regime)
// =================================================================
function calculateTax() {
    const income = parseFloat(document.getElementById('taxIncome')?.value) || 1200000;
    const age = parseInt(document.getElementById('taxAge')?.value) || 35;
    const eightyC = parseFloat(document.getElementById('tax80C')?.value) || 0;
    const eightyD = parseFloat(document.getElementById('tax80D')?.value) || 0;
    const hra = parseFloat(document.getElementById('taxHRA')?.value) || 0;
    const npsDed = parseFloat(document.getElementById('taxNPS')?.value) || 0;
    const homeLoan = parseFloat(document.getElementById('taxHomeLoan')?.value) || 0;

    const isSenior = age >= 60;
    const isSuperSenior = age >= 80;

    // Old regime slabs
    let oldSlabs, oldRebate;
    if (isSuperSenior) {
        oldSlabs = [
            { limit: 500000, rate: 0 },
            { limit: 1000000, rate: 0.20 },
            { limit: Infinity, rate: 0.30 }
        ];
    } else if (isSenior) {
        oldSlabs = [
            { limit: 300000, rate: 0 },
            { limit: 500000, rate: 0.05 },
            { limit: 1000000, rate: 0.20 },
            { limit: Infinity, rate: 0.30 }
        ];
    } else {
        oldSlabs = [
            { limit: 250000, rate: 0 },
            { limit: 500000, rate: 0.05 },
            { limit: 1000000, rate: 0.20 },
            { limit: Infinity, rate: 0.30 }
        ];
    }

    // New regime slabs (FY 2025-26)
    const newSlabs = [
        { limit: 400000, rate: 0 },
        { limit: 800000, rate: 0.05 },
        { limit: 1200000, rate: 0.10 },
        { limit: 1600000, rate: 0.15 },
        { limit: 2000000, rate: 0.20 },
        { limit: 2400000, rate: 0.25 },
        { limit: Infinity, rate: 0.30 }
    ];

    const calcTax = (income, slabs, isNew) => {
        // Deductions only apply in old regime
        let taxable = income;
        if (!isNew) {
            const deductions = Math.min(eightyC, 150000) + Math.min(eightyD, isSenior ? 50000 : 25000)
                + hra + Math.min(npsDed, 50000) + homeLoan;
            taxable = Math.max(0, income - deductions);
        }

        let tax = 0;
        let prevLimit = 0;
        for (const slab of slabs) {
            if (taxable > prevLimit) {
                const slabIncome = Math.min(taxable, slab.limit) - prevLimit;
                tax += slabIncome * slab.rate;
            }
            prevLimit = slab.limit;
        }

        // Rebate under section 87A
        if ((isNew && income <= 700000) || (!isNew && taxable <= 500000)) {
            tax = Math.max(0, tax - 12500);
        }

        // Health & education cess 4%
        const cess = tax * 0.04;
        return { tax, cess, totalTax: tax + cess, taxable };
    };

    const oldResult = calcTax(income, oldSlabs, false);
    const newResult = calcTax(income, newSlabs, true);

    const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');
    document.getElementById('taxOldTaxable').innerText = fmt(oldResult.taxable);
    document.getElementById('taxOldTax').innerText = fmt(oldResult.tax);
    document.getElementById('taxOldCess').innerText = fmt(oldResult.cess);
    document.getElementById('taxOldTotal').innerText = fmt(oldResult.totalTax);

    document.getElementById('taxNewTaxable').innerText = fmt(newResult.taxable);
    document.getElementById('taxNewTax').innerText = fmt(newResult.tax);
    document.getElementById('taxNewCess').innerText = fmt(newResult.cess);
    document.getElementById('taxNewTotal').innerText = fmt(newResult.totalTax);

    const savings = oldResult.totalTax - newResult.totalTax;
    const recEl = document.getElementById('taxRecommendation');
    if (recEl) {
        if (Math.abs(savings) < 100) {
            recEl.innerText = 'Both regimes similar — choose based on simplicity';
            recEl.className = 'text-sm text-slate-300 font-semibold';
        } else if (savings > 0) {
            recEl.innerText = 'New Regime saves ₹' + Math.round(savings).toLocaleString('en-IN') + ' — recommended';
            recEl.className = 'text-sm text-emerald-300 font-bold';
        } else {
            recEl.innerText = 'Old Regime saves ₹' + Math.round(Math.abs(savings)).toLocaleString('en-IN') + ' — recommended (use deductions)';
            recEl.className = 'text-sm text-amber-300 font-bold';
        }
    }
}

// =================================================================
// MF LUMPSUM CALCULATOR
// =================================================================
function calculateMFLumpsum() {
    const amount = parseFloat(document.getElementById('mflAmount')?.value) || 100000;
    const rate = parseFloat(document.getElementById('mflRate')?.value) || 12;
    const tenure = parseInt(document.getElementById('mflTenure')?.value) || 10;

    const r = rate / 100;
    const maturity = amount * Math.pow(1 + r, tenure);
    const interest = maturity - amount;

    const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');
    document.getElementById('mflInvested').innerText = fmt(amount);
    document.getElementById('mflInterest').innerText = fmt(interest);
    document.getElementById('mflMaturity').innerText = fmt(maturity);

    // Yearly growth table
    const tbody = document.getElementById('mflYearTable');
    if (tbody) {
        const rows = [];
        for (let y = 1; y <= tenure; y++) {
            const val = amount * Math.pow(1 + r, y);
            const invGain = val - amount;
            rows.push(`<tr class="border-b border-slate-800/40 hover:bg-slate-900/60 transition-colors" style="animation:sipFadeSlideUp 0.3s ${Math.min(y*15,300)}ms both">
                <td class="py-1.5 pr-4 text-slate-300">${y}</td>
                <td class="text-right pr-4 text-slate-300">${fmt(amount)}</td>
                <td class="text-right pr-4 text-emerald-300">${fmt(Math.round(val))}</td>
                <td class="text-right text-emerald-400">${((val / amount - 1) * 100).toFixed(1)}%</td>
            </tr>`);
        }
        tbody.innerHTML = rows.join('');
    }
}

// =================================================================
// ENHANCED GOLD — Pure Gold Price Calculator
// =================================================================
function calculateGoldSpot() {
    const purity = parseFloat(document.getElementById('gspPurity')?.value) || 24;
    const weight = parseFloat(document.getElementById('gspWeight')?.value) || 10;
    const spotPrice = parseFloat(document.getElementById('gspSpotPrice')?.value) || 7500;
    const makingPct = parseFloat(document.getElementById('gspMaking')?.value) || 5;
    const gstPct = parseFloat(document.getElementById('gspGst')?.value) || 3;

    const pureRate = spotPrice * (purity / 24);
    const basePrice = pureRate * weight;
    const makingCharges = basePrice * (makingPct / 100);
    const gst = (basePrice + makingCharges) * (gstPct / 100);
    const totalPrice = basePrice + makingCharges + gst;
    const perGram = totalPrice / weight;
    const goldPremium = ((totalPrice - (spotPrice * weight)) / (spotPrice * weight)) * 100;

    const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');
    document.getElementById('gspBasePrice').innerText = fmt(basePrice);
    document.getElementById('gspMakingCharges').innerText = fmt(makingCharges);
    document.getElementById('gspGstAmount').innerText = fmt(gst);
    document.getElementById('gspTotalPrice').innerText = fmt(totalPrice);
    document.getElementById('gspPerGram').innerText = fmt(perGram) + '/g';
    document.getElementById('gspPremium').innerText = '+' + goldPremium.toFixed(1) + '%';
}
