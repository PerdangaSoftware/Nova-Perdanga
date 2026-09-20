(function() {
    'use strict';

    // ===== STATE =====
    const state = {
        isRunning: false,
        endTime: null,
        remaining: 600,
        duration: 600,
        isExpanded: false,
        buttonPos: { x: 20, y: 20 },
        widgetPos: { x: 20, y: 20 },
        lastCompletedTime: 0,
        isAlarmPlaying: false
    };

    const settings = {
        timerEnabled: true,
        timerDuration: 600,
        timerSoundEnabled: true,
        timerSoundVolume: 60,
    };

    let intervalId = null;
    let alarmInterval = null;
    let alarmTimeout = null;
    let elements = {};
    let dragData = null;
    let hasMoved = false;
    let isInitialized = false;
    let originalTitle = "New Tab";

    // ===== STORAGE =====
    async function loadData() {
        const data = await chrome.storage.local.get(['nova_timer_settings', 'nova_timer_state']);

        const ts = data.nova_timer_settings || {};
        settings.timerEnabled = ts.timerEnabled !== undefined ? ts.timerEnabled : true;
        settings.timerDuration = ts.timerDuration !== undefined ? ts.timerDuration : 600;
        settings.timerSoundEnabled = ts.timerSoundEnabled !== undefined ? ts.timerSoundEnabled : true;
        settings.timerSoundVolume = ts.timerSoundVolume !== undefined ? ts.timerSoundVolume : 60;

        const s = data.nova_timer_state || {};
        state.isRunning = s.isRunning || false;
        state.endTime = s.endTime || null;
        state.remaining = s.remaining !== undefined ? s.remaining : settings.timerDuration;
        state.duration = s.duration !== undefined ? s.duration : settings.timerDuration;
        state.isExpanded = s.isExpanded || false;
        state.buttonPos = s.buttonPos || { x: 20, y: 20 };
        state.widgetPos = s.widgetPos || { x: 20, y: 20 };
        state.lastCompletedTime = s.lastCompletedTime || 0;
        state.isAlarmPlaying = s.isAlarmPlaying || false;
    }

    async function saveState() {
        await chrome.storage.local.set({ nova_timer_state: { ...state } });
    }

    async function saveSettings() {
        await chrome.storage.local.set({ nova_timer_settings: { ...settings } });
    }

    // ===== DOM CREATION =====
    function createElements() {
        if (elements.button) return;

        const button = document.createElement('div');
        button.id = 'nova-timer-button';
        button.className = 'nova-timer-button';
        button.innerHTML = `
            <svg class="nova-timer-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="13" r="8"/>
                <path d="M12 9v4l2 2"/>
                <path d="M9 2h6"/>
            </svg>
            <span class="nova-timer-button-time" style="display: none;"></span>
        `;
        document.body.appendChild(button);

        const widget = document.createElement('div');
        widget.id = 'nova-timer-widget';
        widget.className = 'nova-timer-widget';
        widget.innerHTML = `
            <div class="nova-timer-widget-header">
                <span class="nova-timer-widget-title">Timer</span>
                <button class="nova-timer-collapse-btn" title="Collapse">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                        <path d="M5 12h14"/>
                    </svg>
                </button>
            </div>
            <div class="nova-timer-circle-container">
                <svg class="nova-timer-progress-svg" viewBox="0 0 200 200">
                    <circle class="nova-timer-progress-bg" cx="100" cy="100" r="90"/>
                    <circle class="nova-timer-progress-fill" cx="100" cy="100" r="90"/>
                </svg>
                <div class="nova-timer-display">
                    <span class="nova-timer-time">10:00</span>
                </div>
            </div>
            <div class="nova-timer-controls">
                <button class="nova-timer-start-btn">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    <span>Start</span>
                </button>
                <button class="nova-timer-reset-btn">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    <span>Reset</span>
                </button>
            </div>
            <div class="nova-timer-presets">
                <button class="nova-timer-preset" data-minutes="5">5m</button>
                <button class="nova-timer-preset" data-minutes="10">10m</button>
                <button class="nova-timer-preset" data-minutes="15">15m</button>
                <button class="nova-timer-preset" data-minutes="25">25m</button>
                <button class="nova-timer-preset" data-minutes="45">45m</button>
            </div>
        `;
        document.body.appendChild(widget);

        elements.button = button;
        elements.widget = widget;
        elements.buttonTime = button.querySelector('.nova-timer-button-time');
        elements.widgetTime = widget.querySelector('.nova-timer-time');
        elements.progressFill = widget.querySelector('.nova-timer-progress-fill');
        elements.startBtn = widget.querySelector('.nova-timer-start-btn');
        elements.resetBtn = widget.querySelector('.nova-timer-reset-btn');
        elements.collapseBtn = widget.querySelector('.nova-timer-collapse-btn');
        elements.presets = widget.querySelectorAll('.nova-timer-preset');
        elements.header = widget.querySelector('.nova-timer-widget-header');

        button.addEventListener('mousedown', handleDragStart('button'));
        elements.header.addEventListener('mousedown', handleDragStart('widget'));

        elements.collapseBtn.addEventListener('mousedown', (e) => e.stopPropagation());
        elements.collapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            collapse();
        });

        elements.startBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!state.isAlarmPlaying) toggleStartPause();
        });

        elements.resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (state.isAlarmPlaying) {
                userStopAlarm();
            } else {
                reset();
            }
        });

        elements.presets.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const minutes = parseInt(btn.dataset.minutes);
                setDuration(minutes * 60);
            });
        });
    }

    function removeElements() {
        if (elements.button) elements.button.remove();
        if (elements.widget) elements.widget.remove();
        elements = {};
        if (intervalId) { clearInterval(intervalId); intervalId = null; }
        if (alarmInterval) { clearInterval(alarmInterval); alarmInterval = null; }
        if (alarmTimeout) { clearTimeout(alarmTimeout); alarmTimeout = null; }
        document.title = originalTitle;
    }

    // ===== DRAG FUNCTIONALITY =====
    function handleDragStart(type) {
        return (e) => {
            if (e.button !== 0) return;
            hasMoved = false;
            const el = type === 'button' ? elements.button : elements.widget;
            const rect = el.getBoundingClientRect();

            dragData = {
                type: type,
                startX: e.clientX,
                startY: e.clientY,
                elemX: rect.left,
                elemY: rect.top,
                width: rect.width,
                height: rect.height,
            };
            e.preventDefault();
        };
    }

    document.addEventListener('mousemove', (e) => {
        if (!dragData) return;
        const dx = e.clientX - dragData.startX;
        const dy = e.clientY - dragData.startY;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;

        let newX = Math.max(10, Math.min(dragData.elemX + dx, window.innerWidth - dragData.width - 10));
        let newY = Math.max(10, Math.min(dragData.elemY + dy, window.innerHeight - dragData.height - 10));

        if (dragData.type === 'button') {
            state.buttonPos = { x: newX, y: newY };
            if (elements.button) {
                elements.button.style.left = newX + 'px';
                elements.button.style.top = newY + 'px';
            }
        } else {
            state.widgetPos = { x: newX, y: newY };
            if (elements.widget) {
                elements.widget.style.left = newX + 'px';
                elements.widget.style.top = newY + 'px';
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (!dragData) return;
        if (!hasMoved && dragData.type === 'button') {
            if (state.isExpanded) collapse(); else expand();
        } else if (hasMoved) {
            saveState();
        }
        hasMoved = false;
        dragData = null;
    });

    // Window resize viewport boundary clamp
    window.addEventListener('resize', () => {
        if (elements.button) {
            const rect = elements.button.getBoundingClientRect();
            state.buttonPos.x = Math.max(10, Math.min(state.buttonPos.x, window.innerWidth - rect.width - 10));
            state.buttonPos.y = Math.max(10, Math.min(state.buttonPos.y, window.innerHeight - rect.height - 10));
            elements.button.style.left = state.buttonPos.x + 'px';
            elements.button.style.top = state.buttonPos.y + 'px';
        }
        if (elements.widget) {
            const rect = elements.widget.getBoundingClientRect();
            state.widgetPos.x = Math.max(10, Math.min(state.widgetPos.x, window.innerWidth - rect.width - 10));
            state.widgetPos.y = Math.max(10, Math.min(state.widgetPos.y, window.innerHeight - rect.height - 10));
            elements.widget.style.left = state.widgetPos.x + 'px';
            elements.widget.style.top = state.widgetPos.y + 'px';
        }
    });

    // ===== EXPAND / COLLAPSE =====
    function expand() {
        if (!elements.button || !elements.widget) return;
        state.isExpanded = true;

        const btnRect = elements.button.getBoundingClientRect();
        const widgetWidth = 280;
        const widgetHeight = 420;
        let x = btnRect.left;
        let y = btnRect.top;

        if (x + widgetWidth > window.innerWidth) x = window.innerWidth - widgetWidth - 15;
        if (y + widgetHeight > window.innerHeight) y = window.innerHeight - widgetHeight - 15;
        if (x < 10) x = 10;
        if (y < 10) y = 10;

        state.widgetPos = { x, y };
        elements.widget.style.left = x + 'px';
        elements.widget.style.top = y + 'px';

        elements.button.classList.add('nova-timer-hidden');
        elements.widget.classList.add('nova-timer-expanded');

        saveState();
        updateDisplay();
    }

    function collapse() {
        if (!elements.button || !elements.widget) return;
        state.isExpanded = false;

        const widgetRect = elements.widget.getBoundingClientRect();
        state.buttonPos = { x: widgetRect.left, y: widgetRect.top };
        elements.button.style.left = state.buttonPos.x + 'px';
        elements.button.style.top = state.buttonPos.y + 'px';

        elements.widget.classList.remove('nova-timer-expanded');
        elements.button.classList.remove('nova-timer-hidden');

        saveState();
        updateDisplay();
    }

    // ===== TIMER LOGIC =====
    function toggleStartPause() {
        if (state.isRunning) pause(); else start();
    }

    function start() {
        if (state.remaining <= 0) state.remaining = state.duration;
        state.isRunning = true;
        state.endTime = Date.now() + state.remaining * 1000;
        startInterval();
        updateDisplay();
        saveState();
    }

    function pause() {
        state.isRunning = false;
        state.endTime = null;
        if (intervalId) { clearInterval(intervalId); intervalId = null; }
        updateDisplay();
        saveState();
    }

    function reset() {
        state.isRunning = false;
        state.endTime = null;
        state.remaining = state.duration;
        if (intervalId) { clearInterval(intervalId); intervalId = null; }
        updateDisplay();
        saveState();
    }

    function setDuration(seconds) {
        state.duration = seconds;
        if (!state.isRunning && !state.isAlarmPlaying) {
            state.remaining = seconds;
        }
        updateDisplay();
        saveState();
    }

    function startInterval() {
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(tick, 250);
    }

    function tick() {
        if (state.isRunning && state.endTime) {
            const now = Date.now();
            state.remaining = Math.ceil((state.endTime - now) / 1000);

            if (state.remaining <= 0) {
                state.remaining = 0;
                state.isRunning = false;
                state.endTime = null;
                state.lastCompletedTime = now;
                state.isAlarmPlaying = true; 
                
                if (intervalId) { clearInterval(intervalId); intervalId = null; }
                if (settings.timerSoundEnabled) startAlarm();
                
                if (elements.widget) elements.widget.classList.add('nova-timer-complete');
                updateDisplay();
                saveState();
            } else {
                updateDisplay();
            }
        }
    }

    // ===== DISPLAY =====
    function formatTime(seconds) {
        seconds = Math.max(0, seconds);
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function updateDisplay() {
        const timeStr = formatTime(state.remaining);

        if (state.isRunning) {
            document.title = timeStr;
        } else if (state.isAlarmPlaying) {
            document.title = "Timer Done!";
        } else {
            document.title = originalTitle;
        }

        if (elements.buttonTime) {
            if (state.isRunning || state.isAlarmPlaying) {
                elements.buttonTime.textContent = timeStr;
                elements.buttonTime.style.display = 'inline-block';
            } else {
                elements.buttonTime.textContent = '';
                elements.buttonTime.style.display = 'none';
            }
        }

        if (elements.widgetTime) elements.widgetTime.textContent = timeStr;

        if (elements.progressFill) {
            const radius = 90;
            const circumference = 2 * Math.PI * radius;
            const progress = state.duration > 0 ? state.remaining / state.duration : 0;
            elements.progressFill.style.strokeDasharray = circumference;
            elements.progressFill.style.strokeDashoffset = circumference * (1 - progress);
        }

        if (elements.startBtn) {
            const span = elements.startBtn.querySelector('span');
            const svg = elements.startBtn.querySelector('svg');
            if (state.isRunning) {
                if (span) span.textContent = 'Pause';
                if (svg) svg.innerHTML = '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>';
            } else {
                if (span) span.textContent = 'Start';
                if (svg) svg.innerHTML = '<path d="M8 5v14l11-7z"/>';
            }
        }

        if (elements.resetBtn) {
            const span = elements.resetBtn.querySelector('span');
            const svg = elements.resetBtn.querySelector('svg');
            if (state.isAlarmPlaying) {
                if (span) span.textContent = 'Stop';
                if (svg) svg.innerHTML = '<rect x="6" y="6" width="12" height="12" rx="2"/>';
                elements.resetBtn.classList.add('nova-timer-stop-active');
                elements.startBtn.style.opacity = '0.5';
                elements.startBtn.style.pointerEvents = 'none';
            } else {
                if (span) span.textContent = 'Reset';
                if (svg) svg.innerHTML = '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>';
                elements.resetBtn.classList.remove('nova-timer-stop-active');
                elements.startBtn.style.opacity = '1';
                elements.startBtn.style.pointerEvents = 'auto';
            }
        }

        if (elements.presets) {
            elements.presets.forEach(btn => {
                if (parseInt(btn.dataset.minutes) * 60 === state.duration) btn.classList.add('active');
                else btn.classList.remove('active');
            });
        }

        if (elements.button) elements.button.classList.toggle('nova-timer-running', state.isRunning);
        if (elements.widget) elements.widget.classList.toggle('nova-timer-running', state.isRunning);

        if (state.isExpanded && elements.widget && elements.button) {
            elements.button.classList.add('nova-timer-hidden');
            elements.widget.classList.add('nova-timer-expanded');
        } else if (!state.isExpanded && elements.widget && elements.button) {
            elements.widget.classList.remove('nova-timer-expanded');
            elements.button.classList.remove('nova-timer-hidden');
        }
    }

    function applyPositions() {
        if (elements.button) {
            elements.button.style.left = state.buttonPos.x + 'px';
            elements.button.style.top = state.buttonPos.y + 'px';
        }
        if (elements.widget) {
            elements.widget.style.left = state.widgetPos.x + 'px';
            elements.widget.style.top = state.widgetPos.y + 'px';
        }
    }

    // ===== RICH AUDIO GENERATION =====
    function playMySound(vol) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended') ctx.resume();
            
            const masterVol = (vol / 100) * (vol / 100);
            if (masterVol === 0) return;

            const freqs = [261.63, 329.63, 392.00, 493.88, 587.33];
            const duration = 2.5; 
            
            freqs.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.value = freq;
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                gain.gain.setValueAtTime(0, ctx.currentTime);
                const startTime = ctx.currentTime + (i * 0.08);
                
                gain.gain.linearRampToValueAtTime(0.15 * masterVol, startTime + 0.3);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
                
                osc.start(startTime);
                osc.stop(startTime + duration);
            });
            
            const bassOsc = ctx.createOscillator();
            const bassGain = ctx.createGain();
            bassOsc.type = 'sine';
            bassOsc.frequency.value = 130.81;
            bassOsc.connect(bassGain);
            bassGain.connect(ctx.destination);
            bassGain.gain.setValueAtTime(0, ctx.currentTime);
            bassGain.gain.linearRampToValueAtTime(0.3 * masterVol, ctx.currentTime + 0.5);
            bassGain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            bassOsc.start(ctx.currentTime);
            bassOsc.stop(ctx.currentTime + duration);
        } catch(e) {
            console.error("Audio error:", e);
        }
    }

    function startAlarm(remainingTime = 60000) {
        if (alarmInterval !== null) return;
        const playOnce = () => { playMySound(settings.timerSoundVolume); };
        playOnce();
        alarmInterval = setInterval(playOnce, 3000);
        if (alarmTimeout) clearTimeout(alarmTimeout);
        alarmTimeout = setTimeout(() => userStopAlarm(), remainingTime);
    }

    function userStopAlarm() {
        if (alarmInterval) {
            clearInterval(alarmInterval);
            alarmInterval = null;
        }
        if (alarmTimeout) {
            clearTimeout(alarmTimeout);
            alarmTimeout = null;
        }
        
        state.isAlarmPlaying = false;
        state.remaining = state.duration;
        state.isRunning = false;
        state.endTime = null;
        
        if (elements.widget) elements.widget.classList.remove('nova-timer-complete');
        updateDisplay();
        saveState();
    }

    // ===== SETTINGS UI =====
    function injectSettings() {
        const settingsPanel = document.getElementById('settings');
        if (!settingsPanel) return;
        if (document.getElementById('nova-timer-settings')) return;

        const section = document.createElement('div');
        section.id = 'nova-timer-settings';
        section.innerHTML = `
            <div class="settings-title">
                <h2>Timer Widget</h2>
            </div>
            <div class="param">
                <div class="wrapper row-between">
                    <label>Enable Timer</label>
                    <label class="toggle">
                        <input type="checkbox" id="i_timer_enable">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <hr>
                <div class="wrapper row-between">
                    <label>Default Duration (min)</label>
                    <input type="number" id="i_timer_duration" class="dark-input" min="1" max="180" value="10" style="width: 70px; text-align: center;">
                </div>
                <hr>
                <div class="wrapper row-between">
                    <label>Timer Sound</label>
                    <label class="toggle">
                        <input type="checkbox" id="i_timer_sound_enable">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <hr>
                <div class="wrapper">
                    <div class="label-with-val">
                        <label>Sound Volume</label>
                        <span class="val-badge" id="timer-volume-label">60%</span>
                    </div>
                    <div class="range-wrapper" style="display:flex; align-items:center; gap:10px;">
                        <input type="range" id="i_timer_volume" min="0" max="100" value="60" step="5">
                    </div>
                </div>
            </div>
        `;
        settingsPanel.appendChild(section);

        const enableInput = document.getElementById('i_timer_enable');
        const durationInput = document.getElementById('i_timer_duration');
        const soundInput = document.getElementById('i_timer_sound_enable');
        const volumeInput = document.getElementById('i_timer_volume');
        const volumeLabel = document.getElementById('timer-volume-label');

        enableInput.checked = settings.timerEnabled;
        durationInput.value = settings.timerDuration / 60;
        soundInput.checked = settings.timerSoundEnabled;
        volumeInput.value = settings.timerSoundVolume;
        volumeLabel.textContent = `${settings.timerSoundVolume}%`;
        updateSliderFill(volumeInput);

        enableInput.addEventListener('change', async (e) => {
            settings.timerEnabled = e.target.checked;
            await saveSettings();
            if (settings.timerEnabled) {
                createElements();
                applyPositions();
                updateDisplay();
                if (state.isRunning && state.endTime) {
                    const now = Date.now();
                    if (state.endTime > now) {
                        state.remaining = Math.ceil((state.endTime - now) / 1000);
                        startInterval();
                    }
                }
                if (state.isAlarmPlaying) startAlarm();
            } else {
                removeElements();
            }
        });

        durationInput.addEventListener('input', (e) => {
            let minutes = parseInt(e.target.value);
            if (isNaN(minutes)) return;
            if (minutes < 1) minutes = 1;
            if (minutes > 180) minutes = 180;
            
            settings.timerDuration = minutes * 60;
            if (!state.isRunning) {
                state.duration = minutes * 60;
                if (!state.isAlarmPlaying) state.remaining = minutes * 60;
            }
            updateDisplay();
            saveSettings();
        });

        soundInput.addEventListener('change', async (e) => {
            settings.timerSoundEnabled = e.target.checked;
            await saveSettings();
            if (!settings.timerSoundEnabled && state.isAlarmPlaying) {
                userStopAlarm();
            }
        });

        volumeInput.addEventListener('input', (e) => {
            updateSliderFill(e.target);
            const vol = parseInt(e.target.value);
            volumeLabel.textContent = `${vol}%`;
            settings.timerSoundVolume = vol;
            saveSettings();
        });
    }

    function updateSliderFill(slider) {
        const val = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
        slider.style.background = `linear-gradient(to right, #3b82f6 ${val}%, #333 ${val}%)`;
    }

    // ===== STORAGE CHANGE LISTENER =====
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;

        if (changes.nova_timer_state) {
            const newState = changes.nova_timer_state.newValue;
            if (newState) {
                const wasRunning = state.isRunning;
                const wasAlarmPlaying = state.isAlarmPlaying;

                state.isRunning = newState.isRunning || false;
                state.endTime = newState.endTime || null;
                state.remaining = newState.remaining !== undefined ? newState.remaining : settings.timerDuration;
                state.duration = newState.duration !== undefined ? newState.duration : settings.timerDuration;
                state.lastCompletedTime = newState.lastCompletedTime || 0;
                state.isAlarmPlaying = newState.isAlarmPlaying || false;

                if (!dragData) {
                    state.isExpanded = newState.isExpanded || false;
                    state.buttonPos = newState.buttonPos || state.buttonPos;
                    state.widgetPos = newState.widgetPos || state.widgetPos;
                    applyPositions();
                }

                if (state.isRunning && !wasRunning) startInterval();
                else if (!state.isRunning && wasRunning) {
                    if (intervalId) { clearInterval(intervalId); intervalId = null; }
                }

                if (state.isAlarmPlaying && !wasAlarmPlaying) {
                    if (settings.timerSoundEnabled) startAlarm();
                    if (elements.widget) elements.widget.classList.add('nova-timer-complete');
                } else if (!state.isAlarmPlaying && wasAlarmPlaying) {
                    if (alarmInterval) { clearInterval(alarmInterval); alarmInterval = null; }
                    if (alarmTimeout) { clearTimeout(alarmTimeout); alarmTimeout = null; }
                    if (elements.widget) elements.widget.classList.remove('nova-timer-complete');
                }

                updateDisplay();
            }
        }

        if (changes.nova_timer_settings) {
            const newSettings = changes.nova_timer_settings.newValue || {};
            const wasEnabled = settings.timerEnabled;
            settings.timerEnabled = newSettings.timerEnabled !== undefined ? newSettings.timerEnabled : true;
            settings.timerDuration = newSettings.timerDuration !== undefined ? newSettings.timerDuration : 600;
            settings.timerSoundEnabled = newSettings.timerSoundEnabled !== undefined ? newSettings.timerSoundEnabled : true;
            settings.timerSoundVolume = newSettings.timerSoundVolume !== undefined ? newSettings.timerSoundVolume : 60;

            const enableInput = document.getElementById('i_timer_enable');
            const durationInput = document.getElementById('i_timer_duration');
            const soundInput = document.getElementById('i_timer_sound_enable');
            const volumeInput = document.getElementById('i_timer_volume');
            const volumeLabel = document.getElementById('timer-volume-label');

            if (enableInput) enableInput.checked = settings.timerEnabled;
            if (durationInput && document.activeElement !== durationInput) {
                durationInput.value = settings.timerDuration / 60;
            }
            if (soundInput) soundInput.checked = settings.timerSoundEnabled;
            if (volumeInput) {
                volumeInput.value = settings.timerSoundVolume;
                if (volumeLabel) volumeLabel.textContent = `${settings.timerSoundVolume}%`;
                updateSliderFill(volumeInput);
            }

            if (!settings.timerEnabled && wasEnabled) removeElements();
            else if (settings.timerEnabled && !wasEnabled) {
                createElements();
                applyPositions();
                updateDisplay();
                if (state.isRunning && state.endTime) {
                    const now = Date.now();
                    if (state.endTime > now) {
                        state.remaining = Math.ceil((state.endTime - now) / 1000);
                        startInterval();
                    }
                }
                if (state.isAlarmPlaying && settings.timerSoundEnabled) startAlarm();
            }
        }
    });

    // ===== INITIALIZATION =====
    async function init() {
        if (isInitialized) return;
        isInitialized = true;

        originalTitle = document.title || "New Tab";
        await loadData();
        injectSettings();

        if (!settings.timerEnabled) return;

        createElements();
        applyPositions();
        updateDisplay();

        if (state.isRunning && state.endTime) {
            const now = Date.now();
            if (state.endTime > now) {
                state.remaining = Math.ceil((state.endTime - now) / 1000);
                startInterval();
            } else {
                state.remaining = 0;
                state.isRunning = false;
                state.endTime = null;
                state.isAlarmPlaying = true;
                saveState();
            }
            updateDisplay();
        }

        if (state.isAlarmPlaying) {
            const now = Date.now();
            const elapsed = now - state.lastCompletedTime;
            if (elapsed < 60000) {
                if (settings.timerSoundEnabled) {
                    startAlarm(60000 - elapsed);
                }
                if (elements.widget) elements.widget.classList.add('nova-timer-complete');
            } else {
                state.isAlarmPlaying = false;
                saveState();
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();