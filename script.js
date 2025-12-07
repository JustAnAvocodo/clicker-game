/* =========================================
   GAME LOGIC & ELEMENTS
   ========================================= */
const clicker = document.getElementById('clicker');
const clickCount = document.getElementById('click-count');
const resetBtn = document.getElementById('reset');
const autoclickerBtn = document.querySelector('.autoclicker-1');
const autoclicker10Btn = document.querySelector('.autoclicker-10');
const autoclicker100Btn = document.querySelector('.autoclicker-100');
const multiplierBtn = document.querySelector('.multiplier-1');
const multiplier2Btn = document.querySelector('.multiplier-2');

// Dev Elements
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

// Achievements Elements
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

// Cloud & Login Elements
const modalLogin = document.getElementById('modal-login');
const modalLeaderboard = document.getElementById('modal-leaderboard');
const authMsg = document.getElementById('auth-msg');
const userInfoDisplay = document.getElementById('user-info');
const leaderboardList = document.getElementById('leaderboard-list');

/* =========================================
   ACHIEVEMENTS SYSTEM
   ========================================= */
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
        li.appendChild(t); li.appendChild(d); li.appendChild(ts);
        achListEl.appendChild(li);
    });
}

function openAchievements(){ if (!achPanel) return; achPanel.classList.remove('hide'); achPanel.setAttribute('aria-hidden','false'); renderAchievements(); }
function closeAchievements(){ if (!achPanel) return; achPanel.classList.add('hide'); achPanel.setAttribute('aria-hidden','true'); }

function showAchievementPopup(title, desc){
    if (!achPopup) return;
    if (achPopupTitle) achPopupTitle.textContent = title;
    if (achPopupDesc) achPopupDesc.textContent = desc;
    setTimeout(() => { achPopup.classList.remove('hide'); try { achPopup.setAttribute('aria-hidden','false'); } catch(e){} }, 0);
}
function hideAchievementPopup(){ if (!achPopup) return; achPopup.classList.add('hide'); achPopup.setAttribute('aria-hidden','true'); }

if (achToggleBtn) achToggleBtn.addEventListener('click', () => { if (achPanel && !achPanel.classList.contains('hide')) closeAchievements(); else openAchievements(); });
if (achCloseBtn) achCloseBtn.addEventListener('click', () => closeAchievements());
if (achClearBtn) achClearBtn.addEventListener('click', () => { saveAchievements([]); renderAchievements(); });
if (achPopupClose) achPopupClose.addEventListener('click', () => hideAchievementPopup());
if (achPopupView) achPopupView.addEventListener('click', () => { hideAchievementPopup(); openAchievements(); });

/* =========================================
   GAME VARIABLES & UPGRADES
   ========================================= */
const KEY_COUNT = 'clickCount';
const KEY_LAST_TICK = 'autoclickers_last_tick';
const KEY_HC_MILESTONE = 'hc_milestone_1000';
const KEY_AUTO_MILESTONE = 'auto_milestone_50000';

const UPGRADES = {
    auto1: { key: 'autoclicker1_count', cost: 50, type: 'add', cps: 1, label: 'Autoclicker 1' },
    auto10: { key: 'autoclicker10_count', cost: 600, type: 'add', cps: 10, label: 'Autoclicker 10' },
    auto100: { key: 'autoclicker100_count', cost: 10000, type: 'add', cps: 100, label: 'Autoclicker 100' },
    mult2: { key: 'multiplier2_count', cost: 6000, type: 'mult', mult: 1.5, label: 'Multiplier 2: ×2.50' },
    mult1: { key: 'multiplier1_count', cost: 100, type: 'mult', mult: 1, label: 'Multiplier 1: ×2' }
};

const AUTO_MILESTONE_THRESHOLD = 50000; 
const AUTO_MILESTONE_MULT = 1.5; 
let autoMilestoneAwarded = (localStorage.getItem(KEY_AUTO_MILESTONE) === '1');

// BroadcastChannel
let bc = null;
if ('BroadcastChannel' in window) bc = new BroadcastChannel('clicker_channel');

function broadcastState() {
    const payload = { type: 'state', count: count };
    Object.keys(UPGRADES).forEach(id => payload[id] = getUpgradeCount(id));
    payload.hcMilestone1000 = hcMilestoneAwarded ? 1 : 0;
    payload.autoMilestone50000 = autoMilestoneAwarded ? 1 : 0;
    try { bc && bc.postMessage(payload); } catch (e) {}
}

let count = 0;
const savedCount = localStorage.getItem(KEY_COUNT);
if (savedCount !== null) count = parseInt(savedCount, 10) || 0;
clickCount.textContent = count;

let humanPointsTotal = 0; 
let computerPointsTotal = 0; 
let humanPointsCurrentTick = 0; 
let lastHumanSecond = 0; 
let humanTickIntervalId = null;
let humanClickCount = 0; 
let humanClicksCurrentTick = 0; 
let lastHumanClicksSecond = 0; 
let computerClickCount = 0; 
let humanClickAccumulator = 0; 

const HC_MILESTONE_THRESHOLD = 1000;
const HC_MILESTONE_MULT = 1.5; 
let hcMilestoneAwarded = (localStorage.getItem(KEY_HC_MILESTONE) === '1');

// Stat Elements
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
    try { if (statMultEl) statMultEl.textContent = `×${getMultiplierFactor().toFixed(2)}`; } catch(e){}
    if (statHcEl) statHcEl.textContent = String(humanClickCount);
    if (statCcEl) statCcEl.textContent = String(computerClickCount);
    if (statHpEl) statHpEl.textContent = String(humanPointsTotal);
    if (statCpEl) statCpEl.textContent = String(computerPointsTotal);
    if (statHcpsEl) statHcpsEl.textContent = String(lastHumanClicksSecond);
    if (statHppsEl) statHppsEl.textContent = String(lastHumanSecond);
    const compClicksPerSecRaw = getComputerClicksPerSecondRaw();
    if (statCcpsEl) statCcpsEl.textContent = String(compClicksPerSecRaw.toFixed(2));
    if (statCppsEl) statCppsEl.textContent = String(totalCPS().toFixed(2));
}

function isHcMilestoneAwarded(){ return hcMilestoneAwarded || (localStorage.getItem(KEY_HC_MILESTONE) === '1'); }
function isAutoMilestoneAwarded(){ return autoMilestoneAwarded || (localStorage.getItem(KEY_AUTO_MILESTONE) === '1'); }

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

function awardHcMilestoneIfNeeded(){
    if (!isHcMilestoneAwarded() && humanClickCount >= HC_MILESTONE_THRESHOLD){
        setHcMilestoneAwarded(true);
        try { updateStatsUI(); } catch(e){}
        try { broadcastState(); } catch(e){}
        addAchievement('hc_1000', 'Dedication', 'You reached 1000 human clicks — Reward: ×1.50 multiplier');
        showAchievementPopup('Dedication', 'You reached 1000 human clicks — Reward: ×1.50 multiplier');
    }
}

function awardAutoMilestoneIfNeeded(){
    if (!isAutoMilestoneAwarded() && computerPointsTotal >= AUTO_MILESTONE_THRESHOLD){
        setAutoMilestoneAwarded(true);
        try { updateStatsUI(); } catch(e){}
        try { broadcastState(); } catch(e){}
        addAchievement('cp_50000', 'Automatic', 'You reached 50000 computer points — Reward: ×1.50 multiplier');
        showAchievementPopup('Automatic', 'You reached 50000 computer points — Reward: ×1.50 multiplier');
    }
}

function setCount(n){
    count = Math.max(0, Math.floor(n));
    clickCount.textContent = count;
    try { localStorage.setItem(KEY_COUNT, String(count)); } catch(e){}
    broadcastState();
    try { updateUI(); } catch (e) {}
}

function updateCPSDisplay(){
    const el = document.getElementById('cps');
    if (!el) return;
    el.textContent = totalCPS().toFixed(2);
}

function handleManualClick(){
    const factor = getMultiplierFactor();
    humanClickAccumulator += 1 * factor;
    const gain = Math.floor(humanClickAccumulator);
    if (gain > 0) {
        humanClickAccumulator -= gain;
        humanPointsTotal += gain;
        humanPointsCurrentTick += gain;
        setCount(count + gain);
    }
    humanClickCount += 1;
    humanClicksCurrentTick += 1;
    awardHcMilestoneIfNeeded();
    updateStatsUI();
}
clicker.addEventListener('click', handleManualClick);

// Keyboard handling
const manualKeyNames = new Set(['w','arrowup','j','n']);
const activeManualKeys = new Set();
const activeKeys = new Set();

document.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
    const k = e.key;
    if (e.repeat) return;
    const norm = (k.length === 1) ? k.toLowerCase() : k.toLowerCase();
    if (activeKeys.has(norm)) return;
    activeKeys.add(norm);
    if (manualKeyNames.has(norm)){
        activeManualKeys.add(norm);
        e.preventDefault();
        handleManualClick();
        return;
    }
    if (/^[1-9]$/.test(k)){
        e.preventDefault();
        const idx = parseInt(k, 10) - 1;
        const container = document.querySelector('.upgrades');
        if (!container) return;
        const buttons = Array.from(container.querySelectorAll('button.upgrade')).filter(b => !b.classList.contains('hide'));
        if (idx >= 0 && idx < buttons.length){
            const btn = buttons[idx];
            try { btn.click(); } catch(e) {}
        }
        return;
    }
});

document.addEventListener('keyup', (e) => {
    const k = e.key;
    const norm = (k.length === 1) ? k.toLowerCase() : k.toLowerCase();
    if (manualKeyNames.has(norm)) activeManualKeys.delete(norm);
    if (activeKeys.has(norm)) activeKeys.delete(norm);
});
window.addEventListener('blur', () => { activeManualKeys.clear(); activeKeys.clear(); });

// Reset
resetBtn.addEventListener('click', () => {
    setCount(0);
    try {
        Object.keys(UPGRADES).forEach(id => { const k = getUpgradeKey(id); if (k) localStorage.removeItem(k); });
        localStorage.removeItem(KEY_LAST_TICK);
        localStorage.removeItem(KEY_HC_MILESTONE);
        localStorage.removeItem(KEY_AUTO_MILESTONE);
        localStorage.removeItem(KEY_ACHIEVEMENTS);
    } catch(e){}
    humanPointsTotal = 0; computerPointsTotal = 0; humanPointsCurrentTick = 0; lastHumanSecond = 0;
    humanClickCount = 0; humanClicksCurrentTick = 0; lastHumanClicksSecond = 0;
    computerClickCount = 0; humanClickAccumulator = 0;
    hcMilestoneAwarded = false; autoMilestoneAwarded = false;
    try { renderAchievements(); } catch(e){}
    try { updateStatsUI(); } catch(e) {}
    updateUI();
});

// Autoclicker Core
function getUpgradeKey(id){ return UPGRADES[id] && UPGRADES[id].key; }
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
    return owned > 0 || count >= def.cost;
}
function getMultiplierFactor(){
    const base = Object.keys(UPGRADES).reduce((prod, id) => {
        const def = UPGRADES[id];
        if (def.type === 'mult'){ const cnt = getUpgradeCount(id); return prod * (1 + (def.mult || 0) * cnt); }
        return prod;
    }, 1);
    let factor = base;
    if (isHcMilestoneAwarded()) factor *= HC_MILESTONE_MULT;
    if (isAutoMilestoneAwarded()) factor *= AUTO_MILESTONE_MULT;
    return factor;
}
function activateUpgrade(id){
    const prev = getUpgradeCount(id);
    const def = UPGRADES[id];
    if (def && def.type === 'mult' && prev >= 1) return; 
    const prevCPS = totalCPS();
    const next = prev + 1;
    setUpgradeCount(id, next);
    if (prevCPS === 0 && totalCPS() > 0) localStorage.setItem(KEY_LAST_TICK, String(Date.now()));
    updateUI();
    broadcastState();
}
function totalCPS(){
    const additive = Object.keys(UPGRADES).reduce((sum, id) => {
        const def = UPGRADES[id];
        if (def.type === 'add') { return sum + (getUpgradeCount(id) * (def.cps || 0)); }
        return sum;
    }, 0);
    const multProduct = Object.keys(UPGRADES).reduce((prod, id) => {
        const def = UPGRADES[id];
        if (def.type === 'mult') { const cnt = getUpgradeCount(id); return prod * (1 + (def.mult || 0) * cnt); }
        return prod;
    }, 1);
    return additive * multProduct;
}

function ensureAutoclickerElements(){
    if (autoclickerBtn) { const def1 = UPGRADES['auto1']; if (def1) { if (count >= def1.cost) autoclickerBtn.classList.remove('hide'); else autoclickerBtn.classList.add('hide'); } }
    if (autoclicker10Btn) { const def10 = UPGRADES['auto10']; if (def10) { if (count >= def10.cost) autoclicker10Btn.classList.remove('hide'); else autoclicker10Btn.classList.add('hide'); } }
    if (autoclicker100Btn) { const def100 = UPGRADES['auto100']; if (def100) { if (count >= def100.cost) autoclicker100Btn.classList.remove('hide'); else autoclicker100Btn.classList.add('hide'); } }
}

// Button Listeners
if (autoclickerBtn){ autoclickerBtn.addEventListener('click', () => { const id = 'auto1'; const def = UPGRADES[id]; if (!def || count < def.cost) return; setCount(count - def.cost); activateUpgrade(id); if (totalCPS() > 0) startLocalInterval(); }); }
if (multiplierBtn){ multiplierBtn.addEventListener('click', () => { const id = 'mult1'; const def = UPGRADES[id]; if (!def || getUpgradeCount(id) >= 1 || count < def.cost) return; setCount(count - def.cost); activateUpgrade(id); if (totalCPS() > 0) startLocalInterval(); }); }
if (multiplier2Btn){ multiplier2Btn.addEventListener('click', () => { const id = 'mult2'; const def = UPGRADES[id]; if (!def || getUpgradeCount(id) >= 1 || count < def.cost) return; setCount(count - def.cost); activateUpgrade(id); if (totalCPS() > 0) startLocalInterval(); }); }
if (autoclicker10Btn){ autoclicker10Btn.addEventListener('click', () => { const id = 'auto10'; const def = UPGRADES[id]; if (!def || count < def.cost) return; setCount(count - def.cost); activateUpgrade(id); if (totalCPS() > 0) startLocalInterval(); }); }
if (autoclicker100Btn){ autoclicker100Btn.addEventListener('click', () => { const id = 'auto100'; const def = UPGRADES[id]; if (!def || count < def.cost) return; setCount(count - def.cost); activateUpgrade(id); if (totalCPS() > 0) startLocalInterval(); }); }

// Ticking
let localIntervalId = null;
function startLocalInterval(){ if (localIntervalId) return; localIntervalId = setInterval(tickHandler, 200); }
function stopLocalInterval(){ if (!localIntervalId) return; clearInterval(localIntervalId); localIntervalId = null; }
function startHumanTick(){ if (humanTickIntervalId) return; humanTickIntervalId = setInterval(() => { lastHumanSecond = humanPointsCurrentTick; humanPointsCurrentTick = 0; lastHumanClicksSecond = humanClicksCurrentTick; humanClicksCurrentTick = 0; updateStatsUI(); }, 1000); }
function stopHumanTick(){ if (!humanTickIntervalId) return; clearInterval(humanTickIntervalId); humanTickIntervalId = null; }

function tickHandler(){
    const rawCps = getComputerClicksPerSecondRaw();
    if (rawCps <= 0) { stopLocalInterval(); return; }
    const mult = getMultiplierFactor();
    const last = parseInt(localStorage.getItem(KEY_LAST_TICK) || '0', 10) || Date.now();
    const now = Date.now();
    const elapsedMs = now - last;
    const seconds = Math.floor(elapsedMs / 1000);
    if (seconds >= 1) {
        const computerClicks = seconds * rawCps;
        const computerGain = computerClicks * mult;
        setCount(count + computerGain);
        computerPointsTotal += computerGain;
        computerClickCount += Math.floor(computerClicks);
        updateStatsUI();
        awardAutoMilestoneIfNeeded();
        const newLast = last + seconds * 1000;
        localStorage.setItem(KEY_LAST_TICK, String(newLast));
    }
}
function restoreAutoclicker(){
    const cps = totalCPS();
    if (cps > 0){
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
            awardAutoMilestoneIfNeeded();
        }
        const remainder = elapsedMs % 1000;
        const newLast = now - remainder;
        localStorage.setItem(KEY_LAST_TICK, String(newLast));
        startLocalInterval();
    }
}
function getComputerClicksPerSecondRaw(){
    return Object.keys(UPGRADES).reduce((sum, id) => {
        const def = UPGRADES[id];
        if (def.type === 'add') return sum + (getUpgradeCount(id) * (def.cps || 0));
        return sum;
    }, 0);
}

// UI Updates
function updateUI(){
    // Updates button text and disabled states
    const checkUpgrade = (btn, id) => {
        if(!btn) return;
        const def = UPGRADES[id];
        const owned = getUpgradeCount(id);
        btn.textContent = `${def.label} (${def.cost} Pts) — Owned: ${owned} — CPS: ${ (owned * (def.cps||0)).toFixed(2) }`;
        const unlocked = isUpgradeUnlocked(id);
        if(!unlocked) btn.classList.add('hide'); 
        else { btn.classList.remove('hide'); if(owned>0) btn.classList.add('in-cart'); else btn.classList.remove('in-cart'); }
        btn.disabled = (count < def.cost);
        if(btn.disabled) btn.classList.add('disabled'); else btn.classList.remove('disabled');
    };
    checkUpgrade(autoclickerBtn, 'auto1');
    checkUpgrade(autoclicker10Btn, 'auto10');
    checkUpgrade(autoclicker100Btn, 'auto100');

    // Multiplier logic
    const checkMult = (btn, id) => {
        if(!btn) return;
        const def = UPGRADES[id];
        const owned = getUpgradeCount(id);
        const factor = 1 + (def.mult || 0) * owned;
        const unlocked = isUpgradeUnlocked(id);
        if (!unlocked) btn.classList.add('hide');
        else if (owned > 0) {
            const percent = ((def.mult || 0) * 100 * owned).toFixed(0);
            btn.textContent = `${def.label} (${def.cost} Pts) — Owned: ${owned} — +${percent}% (×${factor.toFixed(2)})`;
            btn.classList.add('in-cart');
            if (!btn.classList.contains('hidden-after-buy')) {
                btn.classList.add('fade-out');
                setTimeout(() => { btn.classList.add('hide'); btn.classList.add('hidden-after-buy'); btn.classList.remove('fade-out'); }, 450);
            }
            btn.disabled = true; btn.classList.add('disabled');
        } else {
            btn.textContent = `${def.label} (${def.cost} Pts) — Owned: ${owned} — +0% (locked)`;
            btn.classList.remove('in-cart', 'hidden-after-buy', 'fade-out', 'hide');
            btn.disabled = (count < def.cost);
            if(btn.disabled) btn.classList.add('disabled'); else btn.classList.remove('disabled');
        }
    };
    checkMult(multiplierBtn, 'mult1');
    checkMult(multiplier2Btn, 'mult2');

    try { updateCPSDisplay(); } catch(e) {}
}

// Broadcast & Storage Listeners
if (bc){ bc.onmessage = (ev) => { if (!ev || !ev.data) return; const d = ev.data; if (d.type === 'state'){ if (typeof d.count === 'number' && d.count !== count) { setCount(d.count); } const anyRemote = Object.keys(UPGRADES).some(id => typeof d[id] === 'number' && d[id] > 0); if (anyRemote && totalCPS() === 0) restoreAutoclicker(); if (typeof d.hcMilestone1000 === 'number'){ if (d.hcMilestone1000 === 1) setHcMilestoneAwarded(true); } if (typeof d.autoMilestone50000 === 'number'){ if (d.autoMilestone50000 === 1) setAutoMilestoneAwarded(true); } } }; }
window.addEventListener('storage', (e) => { if (!e) return; if (e.key === KEY_COUNT) { const v = parseInt(e.newValue || '0', 10) || 0; if (v !== count) { count = v; clickCount.textContent = v; try { updateUI(); } catch (err) {} } } const upgradeKeys = Object.keys(UPGRADES).map(id => getUpgradeKey(id)); if (upgradeKeys.includes(e.key) || e.key === KEY_LAST_TICK) { if (totalCPS() > 0) startLocalInterval(); else stopLocalInterval(); try { updateUI(); } catch (err) {} } });

// Dev Menu
function populateDevPanel(){ if (!devPanel) return; try { if (devHc) devHc.value = String(humanClickCount || 0); if (devPoints) devPoints.value = String(count || 0); if (devCp) devCp.value = String(Math.floor(computerPointsTotal || 0)); if (devUpAuto1) devUpAuto1.value = String(getUpgradeCount('auto1') || 0); if (devUpAuto10) devUpAuto10.value = String(getUpgradeCount('auto10') || 0); if (devUpMult1) devUpMult1.value = String(getUpgradeCount('mult1') || 0); if (devUpMult2) devUpMult2.value = String(getUpgradeCount('mult2') || 0); if (devMilestone) devMilestone.checked = isHcMilestoneAwarded(); } catch(e){} }
function openDevPanel(){ if (!devPanel) return; populateDevPanel(); devPanel.classList.remove('hide'); devPanel.setAttribute('aria-hidden','false'); }
function closeDevPanel(){ if (!devPanel) return; devPanel.classList.add('hide'); devPanel.setAttribute('aria-hidden','true'); }
function applyDevChanges(){ try { if (devHc) humanClickCount = Math.max(0, parseInt(devHc.value||'0',10)); if (devPoints) setCount(parseInt(devPoints.value||'0',10)); if (devCp) computerPointsTotal = Math.max(0, parseInt(devCp.value||'0',10)); if (devUpAuto1) setUpgradeCount('auto1', Math.max(0, parseInt(devUpAuto1.value||'0',10))); if (devUpAuto10) setUpgradeCount('auto10', Math.max(0, parseInt(devUpAuto10.value||'0',10))); if (devUpMult1) setUpgradeCount('mult1', Math.max(0, Math.min(1, parseInt(devUpMult1.value||'0',10)))); if (devUpMult2) setUpgradeCount('mult2', Math.max(0, Math.min(1, parseInt(devUpMult2.value||'0',10)))); if (devMilestone) setHcMilestoneAwarded(!!devMilestone.checked); if (totalCPS() > 0) startLocalInterval(); else stopLocalInterval(); updateUI(); updateStatsUI(); broadcastState(); awardHcMilestoneIfNeeded(); awardAutoMilestoneIfNeeded(); } catch(e){} }
if (devToggleBtn) devToggleBtn.addEventListener('click', () => { if (devPanel && !devPanel.classList.contains('hide')) closeDevPanel(); else openDevPanel(); });
if (devApplyBtn) devApplyBtn.addEventListener('click', () => { applyDevChanges(); });
if (devCloseBtn) devCloseBtn.addEventListener('click', () => { closeDevPanel(); });
document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.shiftKey && e.key && e.key.toLowerCase() === 'd') { e.preventDefault(); if (devPanel && !devPanel.classList.contains('hide')) closeDevPanel(); else openDevPanel(); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'Esc') { if (achPopup && !achPopup.classList.contains('hide')) { hideAchievementPopup(); e.preventDefault(); return; } if (achPanel && !achPanel.classList.contains('hide')) { closeAchievements(); e.preventDefault(); return; } if (devPanel && !devPanel.classList.contains('hide')) { closeDevPanel(); e.preventDefault(); return; } } });
document.addEventListener('click', (e) => { const t = e.target; const insideDev = t.closest && t.closest('#dev-panel'); const onDev = t.closest && t.closest('#dev-toggle'); const insideAch = t.closest && t.closest('#ach-panel'); const insidePop = t.closest && t.closest('#ach-popup'); const onAch = t.closest && t.closest('#ach-toggle'); if (devPanel && !devPanel.classList.contains('hide') && !insideDev && !onDev) closeDevPanel(); if (achPanel && !achPanel.classList.contains('hide') && !insideAch && !onAch && !insidePop) closeAchievements(); if (achPopup && !achPopup.classList.contains('hide') && !insidePop && !onAch) hideAchievementPopup(); });

// Initialization
renderAchievements();
ensureAutoclickerElements();
updateUI();
restoreAutoclicker();
try { updateStatsUI(); } catch(e) {}
startHumanTick();
// Stats-bar hamburger toggle (shows/hides the stats panel)
const statsToggleBtn = document.getElementById('btn-stats-toggle');
const statsBarEl = document.getElementById('stats-bar');
if (statsToggleBtn && statsBarEl) {
    // use a 'collapsed' class so we don't interfere with global '.hide' usage
    const isCollapsed = statsBarEl.classList.contains('collapsed');
    statsToggleBtn.setAttribute('aria-expanded', (!isCollapsed).toString());
    statsToggleBtn.addEventListener('click', () => {
        // Toggle stats panel on all viewports (mobile and desktop behave the same)
        const nowCollapsed = statsBarEl.classList.toggle('collapsed');
        statsToggleBtn.setAttribute('aria-expanded', (!nowCollapsed).toString());
    });
    // ARIA is kept by the toggle itself; do not force state on resize so behavior is identical on PC and mobile
}

/* =========================================
   PERSISTENT LOGIN & CLOUD SAVE SYSTEM
   ========================================= */

let currentUser = null;

// 1. AUTO LOGIN on Startup
window.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('clicker_user_session');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateLoginUI();
    }
});

function updateLoginUI() {
    if (currentUser) {
        if(userInfoDisplay) userInfoDisplay.innerText = `Player: ${currentUser.username}`;
        if(document.getElementById('btn-login-modal')) document.getElementById('btn-login-modal').classList.add('hide');
        if(document.getElementById('cloud-controls')) document.getElementById('cloud-controls').classList.remove('hide');
    }
}

// 2. OPEN/CLOSE MODALS
if(document.getElementById('btn-login-modal')) document.getElementById('btn-login-modal').addEventListener('click', () => { modalLogin.classList.remove('hide'); });
if(document.getElementById('btn-leaderboard')) document.getElementById('btn-leaderboard').addEventListener('click', () => { modalLeaderboard.classList.remove('hide'); loadLeaderboardData(); });
document.querySelectorAll('.close-modal').forEach(btn => { btn.addEventListener('click', (e) => { document.getElementById(e.target.dataset.target).classList.add('hide'); }); });

// 3. AUTH LOGIC
async function doSignup() {
    const user = document.getElementById('inp-username').value;
    const pass = document.getElementById('inp-password').value;
    if(!user || !pass) return authMsg.innerText = "Fill all fields";
    authMsg.innerText = "Signing up...";
    try {
        const res = await fetch('/.netlify/functions/auth-signup', { method: 'POST', body: JSON.stringify({ username: user, password: pass }) });
        const data = await res.json();
        if(res.ok) { authMsg.innerText = "Created! Logging in..."; doLogin(); } 
        else { authMsg.innerText = "Error: " + (data.error || "Failed"); }
    } catch(e) { authMsg.innerText = "Network Error"; }
}

async function doLogin() {
    const user = document.getElementById('inp-username').value;
    const pass = document.getElementById('inp-password').value;
    authMsg.innerText = "Logging in...";
    try {
        const res = await fetch('/.netlify/functions/auth-login', { method: 'POST', body: JSON.stringify({ username: user, password: pass }) });
        const data = await res.json();
        if(res.ok) {
            currentUser = data; 
            localStorage.setItem('clicker_user_session', JSON.stringify(currentUser));
            updateLoginUI();
            modalLogin.classList.add('hide');
            alert(`Welcome back, ${data.username}!`);
        } else { authMsg.innerText = "Error: " + (data.error || "Failed"); }
    } catch(e) { authMsg.innerText = "Network Error"; }
}

// 4. LEADERBOARD
async function loadLeaderboardData() {
    leaderboardList.innerHTML = "<li style='text-align:center;'>Loading...</li>";
    try {
        const res = await fetch('/.netlify/functions/get-leaderboard');
        const data = await res.json();
        leaderboardList.innerHTML = "";
        if(data.length === 0) { leaderboardList.innerHTML = "<li>No scores yet!</li>"; return; }
        data.forEach((entry, index) => {
            const li = document.createElement('li');
            let rankEmoji = `#${index + 1}`;
            if(index === 0) rankEmoji = "🥇"; if(index === 1) rankEmoji = "🥈"; if(index === 2) rankEmoji = "🥉";
            li.innerHTML = `<span class="rank">${rankEmoji}</span> <span class="player-name">${entry.username}</span> <span class="player-score">${entry.score.toLocaleString()} pts</span>`;
            leaderboardList.appendChild(li);
        });
    } catch(e) { leaderboardList.innerHTML = "<li>Failed to load.</li>"; }
}

// 5. MANUAL SAVE & LOAD
async function manualSave() {
    if(!currentUser) return alert("Login first.");
    
    // Gather ALL Data
    const savePacket = {
        count: count,
        humanPoints: humanPointsTotal,
        computerPoints: computerPointsTotal,
        humanClicks: humanClickCount,
        upgrades: {}
    };
    Object.keys(UPGRADES).forEach(id => { savePacket.upgrades[id] = getUpgradeCount(id); });
    const gameStateString = JSON.stringify(savePacket);
    
    try {
        const res = await fetch('/.netlify/functions/submit-score', { method: 'POST', body: JSON.stringify({ userId: currentUser.id, score: count, gameState: gameStateString }) });
        if(res.ok) alert("Game Saved! ☁️"); else alert("Save failed.");
    } catch(e) { alert("Network Error"); }
}

async function manualLoad() {
    if(!currentUser) return alert("Login first.");
    if(!confirm("Overwrite current progress with cloud save?")) return;
    try {
        const res = await fetch('/.netlify/functions/load-game', { method: 'POST', body: JSON.stringify({ userId: currentUser.id }) });
        const data = await res.json();
        if(!res.ok) return alert("Error: " + (data.error || "No save found"));
        
        const savePacket = JSON.parse(data.gameState);
        setCount(savePacket.count || 0);
        humanPointsTotal = savePacket.humanPoints || 0;
        computerPointsTotal = savePacket.computerPoints || 0;
        humanClickCount = savePacket.humanClicks || 0;
        if(savePacket.upgrades) { Object.keys(savePacket.upgrades).forEach(id => { setUpgradeCount(id, savePacket.upgrades[id]); }); }
        
        updateUI(); updateStatsUI(); restoreAutoclicker();
        alert("Game Loaded! 🎉");
    } catch(e) { alert("Load failed."); }
}

// Collapse upgrades on click (mobile-friendly)
(function(){
    const upgradesContainer = document.querySelector('.upgrades');
    // Always enable the Show Upgrades button so it appears next to Achievements on all viewports.
    if (!upgradesContainer) return;
    const upgradeButtons = Array.from(upgradesContainer.querySelectorAll('button.upgrade'));
    // place the Show Upgrades button near the achievements control
    const achToggle = document.getElementById('ach-toggle');

    // create or reuse a show-upgrades button (only on mobile sizes)
    let showUpgradesBtn = document.getElementById('btn-show-upgrades');
    if (!showUpgradesBtn) {
        showUpgradesBtn = document.createElement('button');
        showUpgradesBtn.id = 'btn-show-upgrades';
        // use the achievement button styling so it appears where achievements are
        showUpgradesBtn.className = 'ach-toggle stats-toggle';
        showUpgradesBtn.textContent = 'Show Upgrades';
        showUpgradesBtn.setAttribute('aria-expanded','true');
        // insert after the achievements toggle if possible, otherwise append to body
        if (achToggle && achToggle.parentNode) achToggle.parentNode.insertBefore(showUpgradesBtn, achToggle.nextSibling);
        else document.body.appendChild(showUpgradesBtn);
    }

    function collapseUpgrades(){
        upgradesContainer.classList.add('collapsed');
        showUpgradesBtn.setAttribute('aria-expanded','false');
    }
    function expandUpgrades(){
        upgradesContainer.classList.remove('collapsed');
        showUpgradesBtn.setAttribute('aria-expanded','true');
    }

    // Do NOT collapse when clicking an upgrade; only toggle via the showUpgrades button
    showUpgradesBtn.addEventListener('click', () => {
        if (upgradesContainer.classList.contains('collapsed')) expandUpgrades(); else collapseUpgrades();
    });

    // Do not force upgrade visibility on resize; allow the Show Upgrades button to control state on all viewports
})();

// Register clicks anywhere on the page as a manual click on wide screens
// (User requested: at width 1300 make clicking the screen register a click)
function __screenClickToManual(e){
    try {
        if (window.innerWidth > 13000) return; // only active on narrow viewports
        const t = e.target;
        if (!t) return;
        // ignore clicks that target interactive UI elements or panels
        if (t.closest && (
            t.closest('button') || t.closest('a') || t.closest('input') || t.closest('textarea') ||
            t.closest('.upgrades') || t.closest('.ach-panel') || t.closest('.dev-panel') || t.closest('.modal') ||
            t.closest('.stats-bar')
        )) return;
        // perform a manual click
        handleManualClick();
    } catch (err) { /* defensive: don't break page */ }
}

document.addEventListener('click', __screenClickToManual);