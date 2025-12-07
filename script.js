// Elements
const clicker = document.getElementById('clicker');
const clickCount = document.getElementById('click-count');
const resetBtn = document.getElementById('reset');
const autoclickerBtn = document.querySelector('.autoclicker-1');
const autoclicker10Btn = document.querySelector('.autoclicker-10');
const autoclicker100Btn = document.querySelector('.autoclicker-100');
const multiplierBtn = document.querySelector('.multiplier-1');
const multiplier2Btn = document.querySelector('.multiplier-2');
// multiplier indicator removed; stats-bar now shows multiplier
// Developer menu elements (may be absent during editing but will exist in DOM)
const devToggleBtn = document.getElementById('dev-toggle');
const devPanel = document.getElementById('dev-panel');
const devHc = document.getElementById('dev-hc');
const devPoints = document.getElementById('dev-points');
const devCp = document.getElementById('dev-cp');
const devUpAuto1 = document.getElementById('dev-up-auto1');
const devUpAuto10 = document.getElementById('dev-up-auto10');
const devUpMult1 = document.getElementById('dev-up-mult1');
const devUpMult2 = document.getElementById('dev-up-mult2');
const devMilestone = document.getElementById('dev-milestone');
const devApplyBtn = document.getElementById('dev-apply');
const devCloseBtn = document.getElementById('dev-close');
// Achievements elements
const achToggleBtn = document.getElementById('ach-toggle');
const achPanel = document.getElementById('ach-panel');
const achListEl = document.getElementById('ach-list');
const achCloseBtn = document.getElementById('ach-close');
const achClearBtn = document.getElementById('ach-clear');
const achPopup = document.getElementById('ach-popup');
const achPopupTitle = document.getElementById('ach-popup-title');
const achPopupDesc = document.getElementById('ach-popup-desc');
const achPopupClose = document.getElementById('ach-popup-close');
const achPopupView = document.getElementById('ach-popup-view');
const KEY_ACHIEVEMENTS = 'achievements_list_v1';

function loadAchievements(){
    try {
        const raw = localStorage.getItem(KEY_ACHIEVEMENTS);
        return raw ? JSON.parse(raw) : [];
    } catch(e){ return []; }
}

function saveAchievements(list){
    try { localStorage.setItem(KEY_ACHIEVEMENTS, JSON.stringify(list||[])); } catch(e){}
}

function addAchievement(id, title, desc){
    const list = loadAchievements();
    // avoid duplicates by id
    if (list.some(a => a.id === id)) return;
    const entry = { id, title, desc, ts: Date.now() };
    list.unshift(entry);
    saveAchievements(list);
    renderAchievements();
}

function renderAchievements(){
    if (!achListEl) return;
    const list = loadAchievements();
    achListEl.innerHTML = '';
    if (list.length === 0) {
        const empty = document.createElement('li');
        empty.textContent = 'No achievements yet.';
        empty.style.color = '#666';
        achListEl.appendChild(empty);
        return;
    }
    list.forEach(a => {
        const li = document.createElement('li');
        const t = document.createElement('div'); t.className = 'ach-title'; t.textContent = a.title;
        const d = document.createElement('div'); d.className = 'ach-desc'; d.textContent = a.desc;
        const ts = document.createElement('div'); ts.className = 'ach-ts'; ts.textContent = new Date(a.ts).toLocaleString();
        li.appendChild(t);
        li.appendChild(d);
        li.appendChild(ts);
        achListEl.appendChild(li);
    });
}

function openAchievements(){ if (!achPanel) return; achPanel.classList.remove('hide'); achPanel.setAttribute('aria-hidden','false'); renderAchievements(); }
function closeAchievements(){ if (!achPanel) return; achPanel.classList.add('hide'); achPanel.setAttribute('aria-hidden','true'); }

function showAchievementPopup(title, desc){
    if (!achPopup) return;
    if (achPopupTitle) achPopupTitle.textContent = title;
    if (achPopupDesc) achPopupDesc.textContent = desc;
    // Defer showing the popup so the originating click doesn't immediately close it
    setTimeout(() => {
        achPopup.classList.remove('hide');
        try { achPopup.setAttribute('aria-hidden','false'); } catch(e){}
    }, 0);
}

function hideAchievementPopup(){ if (!achPopup) return; achPopup.classList.add('hide'); achPopup.setAttribute('aria-hidden','true'); }

if (achToggleBtn) achToggleBtn.addEventListener('click', () => { if (achPanel && !achPanel.classList.contains('hide')) closeAchievements(); else openAchievements(); });
if (achCloseBtn) achCloseBtn.addEventListener('click', () => closeAchievements());
if (achClearBtn) achClearBtn.addEventListener('click', () => { saveAchievements([]); renderAchievements(); });
if (achPopupClose) achPopupClose.addEventListener('click', () => hideAchievementPopup());
if (achPopupView) achPopupView.addEventListener('click', () => { hideAchievementPopup(); openAchievements(); });


// Storage keys and upgrade definitions
const KEY_COUNT = 'clickCount';
const KEY_LAST_TICK = 'autoclickers_last_tick';
const KEY_HC_MILESTONE = 'hc_milestone_1000';
const KEY_AUTO_MILESTONE = 'auto_milestone_50000';

// Define available upgrades here. Each upgrade has a storage key id, cost, and either:
// - type: 'add' with a numeric `cps` (additive clicks/sec per unit)
// - type: 'mult' with a numeric `mult` (multiplier per unit, e.g. 0.2 = +20% per unit)
const UPGRADES = {
    auto1: { key: 'autoclicker1_count', cost: 50, type: 'add', cps: 1, label: 'Autoclicker 1' },
    // Autoclicker 10: 10 CPS, appears at 600 points
    auto10: { key: 'autoclicker10_count', cost: 600, type: 'add', cps: 10, label: 'Autoclicker 10' },
    // Autoclicker 100: 100 CPS, appears at 10000 points
    auto100: { key: 'autoclicker100_count', cost: 10000, type: 'add', cps: 100, label: 'Autoclicker 100' },
    // multiplier: ×2 (100% increase per unit)
    mult2: { key: 'multiplier2_count', cost: 6000, type: 'mult', mult: 1.5, label: 'Multiplier 2: ×2.50' },
    mult1: { key: 'multiplier1_count', cost: 100, type: 'mult', mult: 1, label: 'Multiplier 1: ×2' }
};

// Automatic achievement constants
const AUTO_MILESTONE_THRESHOLD = 50000; // 50k computer points
const AUTO_MILESTONE_MULT = 1.5; // ×1.5 multiplier for Automatic achievement
let autoMilestoneAwarded = (localStorage.getItem(KEY_AUTO_MILESTONE) === '1');

// BroadcastChannel for real-time sync across tabs
let bc = null;
if ('BroadcastChannel' in window) bc = new BroadcastChannel('clicker_channel');

function broadcastState() {
    const payload = { type: 'state', count: count };
    // include upgrade counts
    Object.keys(UPGRADES).forEach(id => payload[id] = getUpgradeCount(id));
    // include milestone state
    payload.hcMilestone1000 = hcMilestoneAwarded ? 1 : 0;
    payload.autoMilestone50000 = autoMilestoneAwarded ? 1 : 0;
    try { bc && bc.postMessage(payload); } catch (e) {}
}

// Load saved count
let count = 0;
const savedCount = localStorage.getItem(KEY_COUNT);
if (savedCount !== null) count = parseInt(savedCount, 10) || 0;
clickCount.textContent = count;

// Stats tracking
let humanPointsTotal = 0; // HP: points gained from manual clicks
let computerPointsTotal = 0; // CP: points gained from autoclickers/computer
let humanPointsCurrentTick = 0; // human points collected since last tick (per-second)
let lastHumanSecond = 0; // human points in most recent completed second
let humanTickIntervalId = null;
// Click/count tracking
let humanClickCount = 0; // HC: total manual click events
let humanClicksCurrentTick = 0; // manual clicks since last second
let lastHumanClicksSecond = 0; // manual clicks in most recent completed second (HCPS)
let computerClickCount = 0; // CC: total computer-generated click events (autoclickers)
let humanClickAccumulator = 0; // carry fractional points from multipliers for manual clicks

// HC milestone
const HC_MILESTONE_THRESHOLD = 1000;
const HC_MILESTONE_MULT = 1.5; // multiplier factor (×1.50)
let hcMilestoneAwarded = (localStorage.getItem(KEY_HC_MILESTONE) === '1');

// stat elements
const statMultEl = document.getElementById('stat-mult');
const statHcEl = document.getElementById('stat-hc');
const statCcEl = document.getElementById('stat-cc');
const statHpEl = document.getElementById('stat-hp');
const statCpEl = document.getElementById('stat-cp');
const statHcpsEl = document.getElementById('stat-hcps');
const statHppsEl = document.getElementById('stat-hpps');
const statCcpsEl = document.getElementById('stat-ccps');
const statCppsEl = document.getElementById('stat-cpps');

function updateStatsUI(){
    // Multiplier (show with two decimals)
    try { if (statMultEl) statMultEl.textContent = `×${getMultiplierFactor().toFixed(2)}`; } catch(e){}
    // Counts
    if (statHcEl) statHcEl.textContent = String(humanClickCount);
    if (statCcEl) statCcEl.textContent = String(computerClickCount);
    // Points
    if (statHpEl) statHpEl.textContent = String(humanPointsTotal);
    if (statCpEl) statCpEl.textContent = String(computerPointsTotal);
    // per-second rates
    if (statHcpsEl) statHcpsEl.textContent = String(lastHumanClicksSecond);
    if (statHppsEl) statHppsEl.textContent = String(lastHumanSecond);
    // compute computer clicks/sec (raw additive, without multiplier)
    const compClicksPerSecRaw = getComputerClicksPerSecondRaw();
    // ccps: computer clicks per second (autoclicker clicks/sec, not combined with human clicks)
    if (statCcpsEl) statCcpsEl.textContent = String(compClicksPerSecRaw.toFixed(2));
    // computer points per second (includes multiplier)
    if (statCppsEl) statCppsEl.textContent = String(totalCPS().toFixed(2));
}

function isHcMilestoneAwarded(){
    return hcMilestoneAwarded || (localStorage.getItem(KEY_HC_MILESTONE) === '1');
}

function isAutoMilestoneAwarded(){
    return autoMilestoneAwarded || (localStorage.getItem(KEY_AUTO_MILESTONE) === '1');
}

function setAutoMilestoneAwarded(v){
    autoMilestoneAwarded = !!v;
    try {
        if (autoMilestoneAwarded) localStorage.setItem(KEY_AUTO_MILESTONE, '1');
        else localStorage.removeItem(KEY_AUTO_MILESTONE);
    } catch(e){}
}

function setHcMilestoneAwarded(v){
    hcMilestoneAwarded = !!v;
    try {
        if (hcMilestoneAwarded) localStorage.setItem(KEY_HC_MILESTONE, '1');
        else localStorage.removeItem(KEY_HC_MILESTONE);
    } catch(e){}
}

// Centralized award logic for the HC milestone so it can be triggered from multiple places
function awardHcMilestoneIfNeeded(){
    if (!isHcMilestoneAwarded() && humanClickCount >= HC_MILESTONE_THRESHOLD){
        setHcMilestoneAwarded(true);
        try { updateStatsUI(); } catch(e){}
        try { broadcastState(); } catch(e){}
        // Add achievement and show popup
        addAchievement('hc_1000', 'Dedication', 'You reached 1000 human clicks — Reward: ×1.50 multiplier');
        showAchievementPopup('Dedication', 'You reached 1000 human clicks — Reward: ×1.50 multiplier');
    }
}

// Centralized award logic for the Automatic achievement (50k computer points)
function awardAutoMilestoneIfNeeded(){
    if (!isAutoMilestoneAwarded() && computerPointsTotal >= AUTO_MILESTONE_THRESHOLD){
        console.log('[awardAutoMilestoneIfNeeded] awarding — computerPointsTotal=', computerPointsTotal);
        setAutoMilestoneAwarded(true);
        try { updateStatsUI(); } catch(e){}
        try { broadcastState(); } catch(e){}
        addAchievement('cp_50000', 'Automatic', 'You reached 50000 computer points — Reward: ×1.50 multiplier');
        console.log('[awardAutoMilestoneIfNeeded] calling showAchievementPopup');
        showAchievementPopup('Automatic', 'You reached 50000 computer points — Reward: ×1.50 multiplier');
    } else {
        console.log('[awardAutoMilestoneIfNeeded] check skipped — awarded=', isAutoMilestoneAwarded(), 'computerPointsTotal=', computerPointsTotal);
    }
}

function setCount(n){
    count = Math.max(0, Math.floor(n));
    clickCount.textContent = count;
    try { localStorage.setItem(KEY_COUNT, String(count)); } catch(e){}
    broadcastState();
    // update UI immediately when count changes
    try { updateUI(); } catch (e) {}
}

// update CPS display when UI updates
function updateCPSDisplay(){
    const el = document.getElementById('cps');
    if (!el) return;
    const cps = totalCPS();
    el.textContent = cps.toFixed(2);
}

// central handler for manual clicks (used by mouse and keyboard)
function handleManualClick(){
    const factor = getMultiplierFactor();
    // Use an accumulator to handle fractional multipliers (so ×1.5 averages correctly)
    humanClickAccumulator += 1 * factor;
    const gain = Math.floor(humanClickAccumulator);
    if (gain > 0) {
        humanClickAccumulator -= gain;
        // record as human-earned points
        humanPointsTotal += gain;
        humanPointsCurrentTick += gain;
        setCount(count + gain);
    }
    // click counts (human events)
    humanClickCount += 1;
    humanClicksCurrentTick += 1;
    // check HC milestone award
    awardHcMilestoneIfNeeded();
    updateStatsUI();
}

clicker.addEventListener('click', handleManualClick);

// Keyboard shortcuts: w, ArrowUp, j, n (case-insensitive)
// prevent holding keys from repeating actions: track active keys and ignore auto-repeat
const manualKeyNames = new Set(['w','arrowup','j','n']);
const activeManualKeys = new Set();
const activeKeys = new Set();

document.addEventListener('keydown', (e) => {
    // ignore if user is typing in an input/textarea/contenteditable
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
    const k = e.key;
    // ignore auto-repeat events globally
    if (e.repeat) return;
    // normalize key for matching (letters -> lowercase, arrows stay text lowered)
    const norm = (k.length === 1) ? k.toLowerCase() : k.toLowerCase();
    // if we've already handled this physical key press, ignore (prevents holding)
    if (activeKeys.has(norm)) return;
    activeKeys.add(norm);
    // manual-click keys: fire once per physical press
    if (manualKeyNames.has(norm)){
        activeManualKeys.add(norm);
        e.preventDefault();
        handleManualClick();
        return;
    }

    // numeric keys: map '1' => first upgrade button, '2' => second, etc.
    if (/^[1-9]$/.test(k)){
        e.preventDefault();
        const idx = parseInt(k, 10) - 1;
        const container = document.querySelector('.upgrades');
        if (!container) return;
        // Only consider visible upgrade buttons (skip those with the .hide class)
        const buttons = Array.from(container.querySelectorAll('button.upgrade')).filter(b => !b.classList.contains('hide'));
        if (idx >= 0 && idx < buttons.length){
            const btn = buttons[idx];
            try { btn.click(); } catch(e) {}
        }
        return;
    }
});

// clear active manual keys on keyup so key can be triggered again
document.addEventListener('keyup', (e) => {
    const k = e.key;
    const norm = (k.length === 1) ? k.toLowerCase() : k.toLowerCase();
    if (manualKeyNames.has(norm)) activeManualKeys.delete(norm);
    // clear from general active set so key can be triggered again
    if (activeKeys.has(norm)) activeKeys.delete(norm);
});

// clear active keys when window loses focus to avoid stuck keys
window.addEventListener('blur', () => {
    activeManualKeys.clear();
    activeKeys.clear();
});

resetBtn.addEventListener('click', () => {
    setCount(0);
    // deactivate autoclicker
    try {
        // remove all upgrade counts and last-tick
        Object.keys(UPGRADES).forEach(id => { const k = getUpgradeKey(id); if (k) localStorage.removeItem(k); });
        localStorage.removeItem(KEY_LAST_TICK);
        // remove HC milestone flag
        localStorage.removeItem(KEY_HC_MILESTONE);
        // remove Automatic achievement flag
        localStorage.removeItem(KEY_AUTO_MILESTONE);
        // remove achievements list
        localStorage.removeItem(KEY_ACHIEVEMENTS);
    } catch(e){}
    // reset stats
    humanPointsTotal = 0;
    computerPointsTotal = 0;
    humanPointsCurrentTick = 0;
    lastHumanSecond = 0;
    // reset click counters (human & computer)
    humanClickCount = 0;
    humanClicksCurrentTick = 0;
    lastHumanClicksSecond = 0;
    computerClickCount = 0;
    humanClickAccumulator = 0;
    // reset milestone state
    hcMilestoneAwarded = false;
    autoMilestoneAwarded = false;
    // refresh rendered achievements
    try { renderAchievements(); } catch(e){}
    try { updateStatsUI(); } catch(e) {}
    updateUI();
});

// Autoclicker helpers
function getUpgradeKey(id){
    return UPGRADES[id] && UPGRADES[id].key;
}

function getUpgradeCount(id){
    const key = getUpgradeKey(id);
    if (!key) return 0;
    return parseInt(localStorage.getItem(key) || '0', 10) || 0;
}

function setUpgradeCount(id, n){
    const key = getUpgradeKey(id);
    if (!key) return;
    localStorage.setItem(key, String(Math.max(0, Math.floor(n))));
}

function isUpgradeUnlocked(id){
    const def = UPGRADES[id];
    if (!def) return false;
    const owned = getUpgradeCount(id);
    // unlocked when owned or when player has reached the cost at least once (use current count as proxy)
    return owned > 0 || count >= def.cost;
}

// returns the current multiplier factor from all 'mult' upgrades (additive stacking)
function getMultiplierFactor(){
    // base multiplier from purchased multiplier upgrades
    const base = Object.keys(UPGRADES).reduce((prod, id) => {
        const def = UPGRADES[id];
        if (def.type === 'mult'){
            const cnt = getUpgradeCount(id);
            return prod * (1 + (def.mult || 0) * cnt);
        }
        return prod;
    }, 1);
    // apply HC milestone and Automatic achievement multipliers if awarded
    let factor = base;
    if (isHcMilestoneAwarded()) factor *= HC_MILESTONE_MULT;
    if (isAutoMilestoneAwarded()) factor *= AUTO_MILESTONE_MULT;
    return factor;
}

function activateUpgrade(id){
    // increment owned count by 1 (but multiplier upgrades are limited to 1)
    const prev = getUpgradeCount(id);
    const def = UPGRADES[id];
    if (def && def.type === 'mult' && prev >= 1) return; // already owned, ignore
    const prevCPS = totalCPS();
    const next = prev + 1;
    setUpgradeCount(id, next);
    // if previously there was no CPS and now there is, set the global last tick
    if (prevCPS === 0 && totalCPS() > 0) localStorage.setItem(KEY_LAST_TICK, String(Date.now()));
    updateUI();
    broadcastState();
}

function totalCPS(){
    // additive base CPS
    const additive = Object.keys(UPGRADES).reduce((sum, id) => {
        const def = UPGRADES[id];
        if (def.type === 'add') {
            return sum + (getUpgradeCount(id) * (def.cps || 0));
        }
        return sum;
    }, 0);

    // multiplier product: apply additive multiplier per unit: multiply base by (1 + mult * count)
    const multProduct = Object.keys(UPGRADES).reduce((prod, id) => {
        const def = UPGRADES[id];
        if (def.type === 'mult') {
            const cnt = getUpgradeCount(id);
            return prod * (1 + (def.mult || 0) * cnt);
        }
        return prod;
    }, 1);

    return additive * multProduct;
}

function ensureAutoclickerElements(){
    // show/hide autoclicker 1
    if (autoclickerBtn) {
        const def1 = UPGRADES['auto1'];
        if (def1) {
            if (count >= def1.cost) autoclickerBtn.classList.remove('hide');
            else autoclickerBtn.classList.add('hide');
        }
    }
    // show/hide autoclicker 10
    if (autoclicker10Btn) {
        const def10 = UPGRADES['auto10'];
        if (def10) {
            if (count >= def10.cost) autoclicker10Btn.classList.remove('hide');
            else autoclicker10Btn.classList.add('hide');
        }
    }
    // show/hide autoclicker 100
    if (autoclicker100Btn) {
        const def100 = UPGRADES['auto100'];
        if (def100) {
            if (count >= def100.cost) autoclicker100Btn.classList.remove('hide');
            else autoclicker100Btn.classList.add('hide');
        }
    }
}

// Purchase/activate autoclicker when button clicked
if (autoclickerBtn){
    autoclickerBtn.addEventListener('click', () => {
        const id = 'auto1';
        const def = UPGRADES[id];
        if (!def) return;
        if (count < def.cost) return; // do nothing if not enough
        setCount(count - def.cost);
        activateUpgrade(id);
        // ensure local ticking starts
        if (totalCPS() > 0) startLocalInterval();
    });
}

if (multiplierBtn){
    multiplierBtn.addEventListener('click', () => {
        const id = 'mult1';
        const def = UPGRADES[id];
        if (!def) return;
        // prevent buying multiple multipliers
        if (getUpgradeCount(id) >= 1) return;
        if (count < def.cost) return;
        setCount(count - def.cost);
        activateUpgrade(id);
        if (totalCPS() > 0) startLocalInterval();
    });
}
if (multiplier2Btn){
    multiplier2Btn.addEventListener('click', () => {
        const id = 'mult2';
        const def = UPGRADES[id];
        if (!def) return;
        // prevent buying multiple multipliers
        if (getUpgradeCount(id) >= 1) return;
        if (count < def.cost) return;
        setCount(count - def.cost);
        activateUpgrade(id);
        if (totalCPS() > 0) startLocalInterval();
    });
}
// Purchase/activate autoclicker 10
if (autoclicker10Btn){
    autoclicker10Btn.addEventListener('click', () => {
        const id = 'auto10';
        const def = UPGRADES[id];
        if (!def) return;
        if (count < def.cost) return; // do nothing if not enough
        setCount(count - def.cost);
        activateUpgrade(id);
        // ensure local ticking starts
        if (totalCPS() > 0) startLocalInterval();
    });
}

// Purchase/activate autoclicker 100
if (autoclicker100Btn){
    autoclicker100Btn.addEventListener('click', () => {
        const id = 'auto100';
        const def = UPGRADES[id];
        if (!def) return;
        if (count < def.cost) return; // do nothing if not enough
        setCount(count - def.cost);
        activateUpgrade(id);
        // ensure local ticking starts
        if (totalCPS() > 0) startLocalInterval();
    });
}

// Progress and ticking
let localIntervalId = null;
function startLocalInterval(){
    if (localIntervalId) return;
    // Update every 200ms to animate progress bar smoothly
    localIntervalId = setInterval(tickHandler, 200);
}
function stopLocalInterval(){
    if (!localIntervalId) return;
    clearInterval(localIntervalId); localIntervalId = null;
}

function startHumanTick(){
    if (humanTickIntervalId) return;
    humanTickIntervalId = setInterval(() => {
        // move current human clicks into last second and reset current counter
        lastHumanSecond = humanPointsCurrentTick;
        humanPointsCurrentTick = 0;
        // clicks per second
        lastHumanClicksSecond = humanClicksCurrentTick;
        humanClicksCurrentTick = 0;
        updateStatsUI();
    }, 1000);
}

function stopHumanTick(){
    if (!humanTickIntervalId) return;
    clearInterval(humanTickIntervalId);
    humanTickIntervalId = null;
}

function tickHandler(){
    // Called ~5 times/sec; compute elapsed since last tick
    // use raw computer clicks/sec (autoclicker clicks) and apply multiplier only to points
    const rawCps = getComputerClicksPerSecondRaw();
    if (rawCps <= 0) {
        stopLocalInterval();
        return;
    }
    const mult = getMultiplierFactor();
    const last = parseInt(localStorage.getItem(KEY_LAST_TICK) || '0', 10) || Date.now();
    const now = Date.now();
    const elapsedMs = now - last;
    // compute full seconds to award
    const seconds = Math.floor(elapsedMs / 1000);
    if (seconds >= 1) {
        // raw computer clicks to award (unmultiplied)
        const computerClicks = seconds * rawCps;
        // points awarded include multiplier
        const computerGain = computerClicks * mult;
        setCount(count + computerGain);
        // record computer-earned points
        computerPointsTotal += computerGain;
        // count computer click events (raw clicks)
        computerClickCount += Math.floor(computerClicks);
        updateStatsUI();
        // Check for Automatic achievement (50k CP)
        awardAutoMilestoneIfNeeded();

        // advance last forward by awarded seconds
        const newLast = last + seconds * 1000;
        localStorage.setItem(KEY_LAST_TICK, String(newLast));
    }
}

// On load, if autoclicker active, catch up and start local interval
function restoreAutoclicker(){
    const cps = totalCPS();
    if (cps > 0){
        // catch up missed time
        const last = parseInt(localStorage.getItem(KEY_LAST_TICK) || String(Date.now()), 10);
        const now = Date.now();
        const elapsedMs = now - last;
        const seconds = Math.floor(elapsedMs / 1000);
        if (seconds >= 1){
            const rawCps = getComputerClicksPerSecondRaw();
            const mult = getMultiplierFactor();
            const computerClicks = seconds * rawCps;
            const computerGain = computerClicks * mult;
            setCount(count + computerGain);
            computerPointsTotal += computerGain;
            computerClickCount += Math.floor(computerClicks);
            updateStatsUI();
            // Check for Automatic achievement (50k CP)
            awardAutoMilestoneIfNeeded();
        }
        // set last to now - remainder
        const remainder = elapsedMs % 1000;
        const newLast = now - remainder;
        localStorage.setItem(KEY_LAST_TICK, String(newLast));
        startLocalInterval();
    } else {
        // nothing UI-specific to do when inactive
    }
}

// return raw computer clicks/sec (additive autoclicker CPS without multiplier)
function getComputerClicksPerSecondRaw(){
    return Object.keys(UPGRADES).reduce((sum, id) => {
        const def = UPGRADES[id];
        if (def.type === 'add') return sum + (getUpgradeCount(id) * (def.cps || 0));
        return sum;
    }, 0);
}

// Update UI elements
function updateUI(){
    // show autoclicker purchase if affordable
    if (autoclickerBtn) {
        const id = 'auto1';
        const owned = getUpgradeCount(id);
        const def = UPGRADES[id];
        if (def) {
            autoclickerBtn.textContent = `${def.label} (${def.cost} Pts) — Owned: ${owned} — CPS: ${ (owned * (def.cps||0)).toFixed(2) }`;
            // unlocked only when owned or player has reached the cost
            const unlocked = isUpgradeUnlocked(id);
            if (!unlocked) {
                autoclickerBtn.classList.add('hide');
            } else {
                autoclickerBtn.classList.remove('hide');
                // visual active indicator
                if (owned > 0) autoclickerBtn.classList.add('in-cart'); else autoclickerBtn.classList.remove('in-cart');
                // disable when not enough points
                autoclickerBtn.disabled = (count < def.cost);
                if (autoclickerBtn.disabled) autoclickerBtn.classList.add('disabled'); else autoclickerBtn.classList.remove('disabled');
            }
        }
    }

    // Autoclicker 10 UI
    if (autoclicker10Btn) {
        const id = 'auto10';
        const owned10 = getUpgradeCount(id);
        const def10 = UPGRADES[id];
        if (def10) {
            autoclicker10Btn.textContent = `${def10.label} (${def10.cost} Pts) — Owned: ${owned10} — CPS: ${ (owned10 * (def10.cps||0)).toFixed(2) }`;
            const unlocked10 = isUpgradeUnlocked(id);
            if (!unlocked10) {
                autoclicker10Btn.classList.add('hide');
            } else {
                autoclicker10Btn.classList.remove('hide');
                if (owned10 > 0) autoclicker10Btn.classList.add('in-cart'); else autoclicker10Btn.classList.remove('in-cart');
                autoclicker10Btn.disabled = (count < def10.cost);
                if (autoclicker10Btn.disabled) autoclicker10Btn.classList.add('disabled'); else autoclicker10Btn.classList.remove('disabled');
            }
        }
    }

    // Autoclicker 100 UI
    if (autoclicker100Btn) {
        const id = 'auto100';
        const owned100 = getUpgradeCount(id);
        const def100 = UPGRADES[id];
        if (def100) {
            autoclicker100Btn.textContent = `${def100.label} (${def100.cost} Pts) — Owned: ${owned100} — CPS: ${ (owned100 * (def100.cps||0)).toFixed(2) }`;
            const unlocked100 = isUpgradeUnlocked(id);
            if (!unlocked100) {
                autoclicker100Btn.classList.add('hide');
            } else {
                autoclicker100Btn.classList.remove('hide');
                if (owned100 > 0) autoclicker100Btn.classList.add('in-cart'); else autoclicker100Btn.classList.remove('in-cart');
                autoclicker100Btn.disabled = (count < def100.cost);
                if (autoclicker100Btn.disabled) autoclicker100Btn.classList.add('disabled'); else autoclicker100Btn.classList.remove('disabled');
            }
        }
    }

    // multiplier buttons UI (mult2 and mult1) and combined indicator
    // show/hide each multiplier button and when any multiplier is owned show combined factor
    const totalFactor = getMultiplierFactor();
    let anyOwned = false;

    if (multiplier2Btn) {
        const id2 = 'mult2';
        const owned2 = getUpgradeCount(id2);
        const def2 = UPGRADES[id2];
        if (def2) {
            const factor2 = 1 + (def2.mult || 0) * owned2;
            const unlocked2 = isUpgradeUnlocked(id2);
            if (!unlocked2) {
                multiplier2Btn.classList.add('hide');
            } else if (owned2 > 0) {
                anyOwned = true;
                const percent2 = ((def2.mult || 0) * 100 * owned2).toFixed(0);
                multiplier2Btn.textContent = `${def2.label} (${def2.cost} Pts) — Owned: ${owned2} — +${percent2}% (×${factor2.toFixed(2)})`;
                multiplier2Btn.classList.add('in-cart');
                if (!multiplier2Btn.classList.contains('hidden-after-buy')) {
                    multiplier2Btn.classList.add('fade-out');
                    setTimeout(() => {
                        multiplier2Btn.classList.add('hide');
                        multiplier2Btn.classList.add('hidden-after-buy');
                        multiplier2Btn.classList.remove('fade-out');
                    }, 450);
                }
                multiplier2Btn.disabled = true;
                multiplier2Btn.classList.add('disabled');
            } else {
                multiplier2Btn.textContent = `${def2.label} (${def2.cost} Pts) — Owned: ${owned2} — +0% (locked)`;
                multiplier2Btn.classList.remove('in-cart');
                multiplier2Btn.classList.remove('hidden-after-buy');
                multiplier2Btn.classList.remove('fade-out');
                multiplier2Btn.classList.remove('hide');
                multiplier2Btn.disabled = (count < def2.cost);
                if (multiplier2Btn.disabled) multiplier2Btn.classList.add('disabled'); else multiplier2Btn.classList.remove('disabled');
            }
        }
    }

    if (multiplierBtn) {
        const id = 'mult1';
        const owned = getUpgradeCount(id);
        const def = UPGRADES[id];
        if (def) {
            const factor = 1 + (def.mult || 0) * owned;
            const unlocked1 = isUpgradeUnlocked(id);
            if (!unlocked1) {
                multiplierBtn.classList.add('hide');
            } else if (owned > 0) {
                anyOwned = true;
                const percent = ((def.mult || 0) * 100 * owned).toFixed(0);
                multiplierBtn.textContent = `${def.label} (${def.cost} Pts) — Owned: ${owned} — +${percent}% (×${factor.toFixed(2)})`;
                multiplierBtn.classList.add('in-cart');
                if (!multiplierBtn.classList.contains('hidden-after-buy')) {
                    multiplierBtn.classList.add('fade-out');
                    setTimeout(() => {
                        multiplierBtn.classList.add('hide');
                        multiplierBtn.classList.add('hidden-after-buy');
                        multiplierBtn.classList.remove('fade-out');
                    }, 450);
                }
                multiplierBtn.disabled = true;
                multiplierBtn.classList.add('disabled');
            } else {
                multiplierBtn.textContent = `${def.label} (${def.cost} Pts) — Owned: ${owned} — +0% (locked)`;
                multiplierBtn.classList.remove('in-cart');
                multiplierBtn.classList.remove('hidden-after-buy');
                multiplierBtn.classList.remove('fade-out');
                multiplierBtn.classList.remove('hide');
                multiplierBtn.disabled = (count < def.cost);
                if (multiplierBtn.disabled) multiplierBtn.classList.add('disabled'); else multiplierBtn.classList.remove('disabled');
            }
        }
    }

    // Multiplier is shown in the stats bar (stat-mult) instead of a separate indicator.

    try { updateCPSDisplay(); } catch(e) {}
}

// BroadcastChannel listener
if (bc){
    bc.onmessage = (ev) => {
        if (!ev || !ev.data) return;
        const d = ev.data;
        if (d.type === 'state'){
            // accept external count (use higher), and UI state
            if (typeof d.count === 'number' && d.count !== count) { setCount(d.count); }
            // restore if any upgrade was bought elsewhere
            const anyRemote = Object.keys(UPGRADES).some(id => typeof d[id] === 'number' && d[id] > 0);
            if (anyRemote && totalCPS() === 0) restoreAutoclicker();
                // apply HC milestone if remote reports it
                if (typeof d.hcMilestone1000 === 'number'){
                    if (d.hcMilestone1000 === 1) setHcMilestoneAwarded(true);
                }
                    // apply Automatic milestone if remote reports it
                    if (typeof d.autoMilestone50000 === 'number'){
                        if (d.autoMilestone50000 === 1) setAutoMilestoneAwarded(true);
                    }
        }
    };
}

// Also listen to storage events (other tabs without BroadcastChannel)
window.addEventListener('storage', (e) => {
        if (!e) return;
        if (e.key === KEY_COUNT) {
        const v = parseInt(e.newValue || '0', 10) || 0;
        if (v !== count) {
            // update local state and UI when count changed in another tab
            count = v;
            clickCount.textContent = v;
            try { updateUI(); } catch (err) {}
        }
        }
        // if any upgrade key or last-tick changed, refresh autoclicker state
        const upgradeKeys = Object.keys(UPGRADES).map(id => getUpgradeKey(id));
        if (upgradeKeys.includes(e.key) || e.key === KEY_LAST_TICK || e.key === 'gameshop_cart_update_ts') {
                if (totalCPS() > 0) startLocalInterval(); else stopLocalInterval();
                try { updateUI(); } catch (err) {}
        }
});

// Visibility change — try to catch up when tab becomes visible
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        restoreAutoclicker();
    }
});

// Initialize
// Developer menu helpers
function populateDevPanel(){
    if (!devPanel) return;
    try {
        if (devHc) devHc.value = String(humanClickCount || 0);
        if (devPoints) devPoints.value = String(count || 0);
        if (devCp) devCp.value = String(Math.floor(computerPointsTotal || 0));
        if (devUpAuto1) devUpAuto1.value = String(getUpgradeCount('auto1') || 0);
        if (devUpAuto10) devUpAuto10.value = String(getUpgradeCount('auto10') || 0);
        if (devUpMult1) devUpMult1.value = String(getUpgradeCount('mult1') || 0);
        if (devUpMult2) devUpMult2.value = String(getUpgradeCount('mult2') || 0);
        if (devMilestone) devMilestone.checked = isHcMilestoneAwarded();
    } catch(e){}
}

function openDevPanel(){ if (!devPanel) return; populateDevPanel(); devPanel.classList.remove('hide'); devPanel.setAttribute('aria-hidden','false'); }
function closeDevPanel(){ if (!devPanel) return; devPanel.classList.add('hide'); devPanel.setAttribute('aria-hidden','true'); }

function applyDevChanges(){
    try {
        if (devHc) {
            const v = parseInt(devHc.value || '0', 10) || 0;
            humanClickCount = Math.max(0, v);
        }
        if (devPoints) {
            const p = parseInt(devPoints.value || '0', 10) || 0;
            setCount(p);
        }
        // allow setting computer points for testing
        if (devCp) {
            const cp = parseInt(devCp.value || '0', 10) || 0;
            computerPointsTotal = Math.max(0, cp);
        }
        // upgrades
        if (devUpAuto1) setUpgradeCount('auto1', Math.max(0, parseInt(devUpAuto1.value || '0', 10) || 0));
        if (devUpAuto10) setUpgradeCount('auto10', Math.max(0, parseInt(devUpAuto10.value || '0', 10) || 0));
        if (devUpMult1) setUpgradeCount('mult1', Math.max(0, Math.min(1, parseInt(devUpMult1.value || '0', 10) || 0)));
        if (devUpMult2) setUpgradeCount('mult2', Math.max(0, Math.min(1, parseInt(devUpMult2.value || '0', 10) || 0)));
        // milestone
        if (devMilestone) setHcMilestoneAwarded(!!devMilestone.checked);
        // ensure autoclicker ticking when necessary
        if (totalCPS() > 0) startLocalInterval(); else stopLocalInterval();
        // update UI and stats
        updateUI(); updateStatsUI(); broadcastState();
        // If dev changed HC to meet/exceed the milestone threshold, award immediately
        awardHcMilestoneIfNeeded();
        // If dev changed computer points (CP), check Automatic achievement
        awardAutoMilestoneIfNeeded();
    } catch(e){}
}

// Dev panel events
if (devToggleBtn) devToggleBtn.addEventListener('click', () => { if (devPanel && !devPanel.classList.contains('hide')) closeDevPanel(); else openDevPanel(); });
if (devApplyBtn) devApplyBtn.addEventListener('click', () => { applyDevChanges(); });
if (devCloseBtn) devCloseBtn.addEventListener('click', () => { closeDevPanel(); });
// keyboard shortcut Ctrl+Shift+D to toggle dev menu
document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.shiftKey && e.key && e.key.toLowerCase() === 'd') { e.preventDefault(); if (devPanel && !devPanel.classList.contains('hide')) closeDevPanel(); else openDevPanel(); } });

// Global Escape handler: close popup/panels in a sensible order
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
        // If achievement popup visible, close it first
        if (achPopup && !achPopup.classList.contains('hide')) { hideAchievementPopup(); e.preventDefault(); return; }
        // Then close achievements panel if open
        if (achPanel && !achPanel.classList.contains('hide')) { closeAchievements(); e.preventDefault(); return; }
        // Then close developer panel if open
        if (devPanel && !devPanel.classList.contains('hide')) { closeDevPanel(); e.preventDefault(); return; }
    }
});

// Close panels when clicking outside of them (dev panel, achievements panel, popup)
document.addEventListener('click', (e) => {
    const t = e.target;
    const clickedInsideDev = t.closest && t.closest('#dev-panel');
    const clickedOnDevToggle = t.closest && t.closest('#dev-toggle');
    const clickedInsideAchPanel = t.closest && t.closest('#ach-panel');
    const clickedInsideAchPopup = t.closest && t.closest('#ach-popup');
    const clickedOnAchToggle = t.closest && t.closest('#ach-toggle');

    // Close dev panel if open and click was outside panel and not on its toggle
    if (devPanel && !devPanel.classList.contains('hide') && !clickedInsideDev && !clickedOnDevToggle) {
        closeDevPanel();
    }

    // Close achievements panel if open and click was outside it and not on its toggle
    if (achPanel && !achPanel.classList.contains('hide') && !clickedInsideAchPanel && !clickedOnAchToggle && !clickedInsideAchPopup) {
        closeAchievements();
    }

    // Close achievement popup if open and click was outside popup and not on achievements toggle
    if (achPopup && !achPopup.classList.contains('hide') && !clickedInsideAchPopup && !clickedOnAchToggle) {
        hideAchievementPopup();
    }
});

// render achievements and attach keyboard handlers for dev/ach toggles
renderAchievements();
ensureAutoclickerElements();
updateUI();
restoreAutoclicker();
// initial stats render and start human tick
try { updateStatsUI(); } catch(e) {}
startHumanTick();

/* =========================================
   LOGIN & LEADERBOARD SYSTEM
   ========================================= */

let currentUser = null; // Stores {id, username}

// UI Elements
const modalLogin = document.getElementById('modal-login');
const modalLeaderboard = document.getElementById('modal-leaderboard');
const authMsg = document.getElementById('auth-msg');
const userInfoDisplay = document.getElementById('user-info');
const leaderboardList = document.getElementById('leaderboard-list');

// Open/Close logic
document.getElementById('btn-login-modal').addEventListener('click', () => {
    modalLogin.classList.remove('hide');
});
document.getElementById('btn-leaderboard').addEventListener('click', () => {
    modalLeaderboard.classList.remove('hide');
    loadLeaderboardData();
});

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.getElementById(e.target.dataset.target).classList.add('hide');
    });
});

// --- API FUNCTIONS ---

async function doSignup() {
    const user = document.getElementById('inp-username').value;
    const pass = document.getElementById('inp-password').value;
    if(!user || !pass) return authMsg.innerText = "Fill all fields";
    
    authMsg.innerText = "Signing up...";
    
    try {
        const res = await fetch('/.netlify/functions/auth-signup', {
            method: 'POST', body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if(res.ok) {
            authMsg.innerText = "Account created! Logging in...";
            doLogin(); // Auto login after signup
        } else {
            authMsg.innerText = "Error: " + (data.error || "Failed");
        }
    } catch(e) { authMsg.innerText = "Network Error"; }
}

async function doLogin() {
    const user = document.getElementById('inp-username').value;
    const pass = document.getElementById('inp-password').value;
    
    authMsg.innerText = "Logging in...";

    try {
        const res = await fetch('/.netlify/functions/auth-login', {
            method: 'POST', body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        
        if(res.ok) {
            currentUser = data; // Save user session
            userInfoDisplay.innerText = `Player: ${data.username}`;
            document.getElementById('btn-login-modal').style.display = 'none';
            modalLogin.classList.add('hide');
            alert(`Welcome back, ${data.username}!`);
        } else {
            authMsg.innerText = "Error: " + (data.error || "Failed");
        }
    } catch(e) { authMsg.innerText = "Network Error"; }
}

async function loadLeaderboardData() {
    leaderboardList.innerHTML = "Loading...";
    try {
        const res = await fetch('/.netlify/functions/get-leaderboard');
        const data = await res.json();
        
        leaderboardList.innerHTML = "";
        data.forEach((entry, index) => {
            const li = document.createElement('li');
            li.innerHTML = `<span>#${index+1} ${entry.username}</span> <span>${entry.score} pts</span>`;
            leaderboardList.appendChild(li);
        });
    } catch(e) {
        leaderboardList.innerHTML = "Failed to load.";
    }
}

async function saveScoreToCloud() {
    if(!currentUser) return; // Don't save if not logged in
    
    // We use the 'count' variable from your existing game code
    console.log("Auto-saving score to cloud...");
    
    await fetch('/.netlify/functions/submit-score', {
        method: 'POST', 
        body: JSON.stringify({ userId: currentUser.id, score: count })
    });
}

// --- AUTOSAVE LOOP ---
// Save score to database every 30 seconds if logged in
setInterval(saveScoreToCloud, 30000);