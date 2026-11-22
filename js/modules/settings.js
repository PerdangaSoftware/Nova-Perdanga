import state, { emit, on } from './state.js';
import { storage, saveSnapshot } from './storage.js';
import { updateClockAndDate } from './clock.js';
import { updateWeather } from './weather.js';
import { loadBackground, preCalculateNextBackground, switchToNextWallpaper } from './background.js';
import { resetWallhavenSession, doFetchWallhaven } from './wallhaven.js';
import { syncPreviewWithActiveWallpaper, toggleWhDrawer, renderLocalPreviews, renderWallhavenPreviews } from './drawer.js';
import { applyShortcutsLayout, renderShortcuts } from './shortcuts.js';

export const wallhavenColors = [
    '660000', '990000', 'cc0000', 'cc3333', 'ea4c88', '993399',
    '663399', '333399', '0066cc', '0099cc', '66cccc', '77cc33',
    '669900', '336600', '666600', '999900', 'cccc33', 'ffff00',
    'ffcc33', 'ff9900', 'ff6600', 'cc6633', '996633', '663300',
    '000000', '999999', 'cccccc', 'ffffff', '424153', ''
];

export function updateSliderFill(slider) {
    if (!slider) return;
    const val = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty('--slider-fill', `${val}%`);
    slider.style.background = `linear-gradient(to right, #14b8a6 0%, #14b8a6 ${val}%, rgba(255, 255, 255, 0.12) ${val}%, rgba(255, 255, 255, 0.12) 100%)`;
}

export function updateBadge(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

export function initWallhavenColorGrid() {
    const grid = document.getElementById('wallhaven-color-grid');
    if (!grid) return;
    const buttons = wallhavenColors.map(hex => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wh-color-item' + (hex === '' ? ' wh-color-none' : '');
        if (hex) {
            btn.style.backgroundColor = '#' + hex;
            btn.title = '#' + hex;
        } else {
            btn.title = 'Any Color';
        }
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const newColor = (state.settings.wallhavenColor === hex) ? '' : hex;
            state.settings.wallhavenColor = newColor;
            resetWallhavenSession();
            await storage.setSettings(state.settings);
            updateWallhavenColorUI();
            await doFetchWallhaven(1);
            if (state.settings.bgType === 'wallhaven') {
                loadBackground(true, false);
            }
        });
        return btn;
    });
    grid.replaceChildren(...buttons);
}

export function updateWallhavenColorUI() {
    const badge = document.getElementById('v_wallhaven_color');
    if (badge) {
        if (state.settings.wallhavenColor) {
            badge.innerHTML = `<span class="badge-color-dot" style="background:#${state.settings.wallhavenColor}"></span>#${state.settings.wallhavenColor}`;
        } else {
            badge.textContent = 'Any';
        }
    }
    const grid = document.getElementById('wallhaven-color-grid');
    if (!grid) return;
    const buttons = grid.querySelectorAll('.wh-color-item');
    buttons.forEach((btn, index) => {
        const hex = wallhavenColors[index];
        const isSelected = (state.settings.wallhavenColor === hex) || (!state.settings.wallhavenColor && hex === '');
        btn.classList.toggle('selected', isSelected);
    });
}

export function applySettingsToDOM() {
    const settings = state.settings;
    const rootStyle = state.rootStyle;

    rootStyle.setProperty('--font-family', settings.font);
    rootStyle.setProperty('--text-color', settings.textColor);
    rootStyle.setProperty('--bg-blur', `${settings.bgBlur}px`);
    rootStyle.setProperty('--search-blur', `${settings.searchBlur}px`);
    rootStyle.setProperty('--bg-brightness', settings.bgBrightness / 100);
    rootStyle.setProperty('--bg-fade', `${settings.bgFade}ms`);

    rootStyle.setProperty('--search-width', `${settings.searchWidth}px`);
    rootStyle.setProperty('--search-font-size', `${settings.searchFontSize / 10}rem`);
    rootStyle.setProperty('--clock-size', `${settings.clockSize / 10}rem`);
    rootStyle.setProperty('--date-size', `${settings.dateSize / 10}rem`);
    rootStyle.setProperty('--greeting-size', `${settings.greetingSize / 10}rem`);
    rootStyle.setProperty('--weather-size', `${settings.weatherSize / 10}rem`);

    if (!settings.searchAutoColor) {
        const hex = settings.searchBgColor || "#ffffff";
        let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        if (!isNaN(r)) { 
            rootStyle.setProperty('--search-bg-r', r); 
            rootStyle.setProperty('--search-bg-g', g); 
            rootStyle.setProperty('--search-bg-b', b); 
        }
    }
    
    rootStyle.setProperty('--search-bg-opacity', settings.searchBgOpacity / 100);

    const inputFont = document.getElementById('i_font');
    const inputTextColor = document.getElementById('i_text_color');
    const inputEngine = document.getElementById('i_engine');
    const inputBgType = document.getElementById('i_bg_type');
    const inputBgFrequency = document.getElementById('i_bg_frequency');
    const inputLocalOrder = document.getElementById('i_local_order');
    const inputWhMode = document.getElementById('i_wallhaven_mode');
    const inputWhTopRange = document.getElementById('i_wallhaven_toprange');
    const inputWh = document.getElementById('i_wallhaven');
    const inputWhRes = document.getElementById('i_wallhaven_resolution');
    const inputWhResMode = document.getElementById('i_wallhaven_resolution_mode');
    const inputWhRatio = document.getElementById('i_wallhaven_ratio');
    const inputSearchAuto = document.getElementById('i_search_auto_color');
    const inputSearchColor = document.getElementById('i_search_bg_color');

    if (inputFont) inputFont.value = settings.font;
    if (inputTextColor) inputTextColor.value = settings.textColor;
    if (inputEngine) {
        if (!['google', 'ddg', 'brave', 'startpage', 'qwant'].includes(settings.engine)) settings.engine = 'google';
        inputEngine.value = settings.engine;
    }
    if (inputBgType) inputBgType.value = settings.bgType;
    if (inputBgFrequency) inputBgFrequency.value = settings.bgFrequency;
    if (inputLocalOrder) inputLocalOrder.value = settings.localOrder || 'sequential';
    if (inputWhMode) inputWhMode.value = settings.wallhavenMode;
    if (inputWhTopRange) inputWhTopRange.value = settings.wallhavenTopRange;
    if (inputWh) inputWh.value = settings.wallhavenQuery;
    if (inputWhRes) inputWhRes.value = settings.wallhavenResolution;
    if (inputWhResMode) inputWhResMode.value = settings.wallhavenResolutionMode;
    if (inputWhRatio) inputWhRatio.value = settings.wallhavenRatio;
    updateWallhavenColorUI();

    const hubTitle = document.getElementById('v_hub_launcher_title');
    if (hubTitle) {
        hubTitle.textContent = (settings.bgType === 'local') ? 'Browse Local Files' : 'Browse Wallhaven';
    }
    
    if (inputSearchAuto) inputSearchAuto.checked = settings.searchAutoColor;
    if (inputSearchColor) inputSearchColor.value = settings.searchBgColor;
    
    const sliderMap = [
        ['i_blur', 'bgBlur', 'v_blur', 'px'],
        ['i_search_blur', 'searchBlur', 'v_search_blur', 'px'],
        ['i_search_opacity', 'searchBgOpacity', 'v_search_opacity', '%'],
        ['i_brightness', 'bgBrightness', 'v_brightness', '%'],
        ['i_fade', 'bgFade', 'v_fade', 'ms'],
        ['i_search_width', 'searchWidth', 'v_search_width', 'px'],
        ['i_search_font', 'searchFontSize', 'v_search_font', 'rem', 10],
        ['i_clock_size', 'clockSize', 'v_clock_size', 'rem', 10],
        ['i_date_size', 'dateSize', 'v_date_size', 'rem', 10],
        ['i_greeting_size', 'greetingSize', 'v_greeting_size', 'rem', 10],
        ['i_weather_size', 'weatherSize', 'v_weather_size', 'rem', 10]
    ];

    sliderMap.forEach(([elemId, settingKey, badgeId, unit, divisor]) => {
        const input = document.getElementById(elemId);
        if (input) {
            input.value = settings[settingKey];
            updateSliderFill(input);
            const displayVal = divisor ? (settings[settingKey] / divisor).toFixed(1) : settings[settingKey];
            updateBadge(badgeId, `${displayVal}${unit}`);
        }
    });

    const timeEnable = document.getElementById('i_time_enable');
    const time12h = document.getElementById('i_time_12h');
    const timeSec = document.getElementById('i_time_seconds');
    const dateEnable = document.getElementById('i_date_enable');
    const weatherEnable = document.getElementById('i_weather_enable');
    const weatherCity = document.getElementById('i_weather_city');
    const weatherUnit = document.getElementById('i_weather_unit');
    const weatherService = document.getElementById('i_weather_service');
    const greetingsEnable = document.getElementById('i_greetings_enable');

    if (timeEnable) timeEnable.checked = settings.timeEnabled;
    if (time12h) time12h.checked = settings.time12h;
    if (timeSec) timeSec.checked = settings.timeSeconds;
    if (dateEnable) dateEnable.checked = settings.dateEnabled;
    if (weatherEnable) weatherEnable.checked = settings.weatherEnabled;
    if (weatherCity) weatherCity.value = settings.weatherCity;
    if (weatherUnit) weatherUnit.value = settings.weatherUnit;
    if (weatherService) weatherService.value = settings.weatherService;
    if (greetingsEnable) greetingsEnable.checked = settings.greetingsEnabled;

    const elWhOptions = document.getElementById('wallhaven-options');
    if (elWhOptions) elWhOptions.classList.toggle('hidden', settings.bgType !== 'wallhaven');
    const elWhQueryWrap = document.getElementById('wallhaven-query-wrapper');
    if (elWhQueryWrap) elWhQueryWrap.classList.toggle('hidden', settings.wallhavenMode !== 'search');
    const elWhTopRangeWrap = document.getElementById('wallhaven-top-range-wrapper');
    if (elWhTopRangeWrap) elWhTopRangeWrap.classList.toggle('hidden', settings.wallhavenMode !== 'top');
    const elWhResModeWrap = document.getElementById('wallhaven-res-mode-wrapper');
    if (elWhResModeWrap) elWhResModeWrap.classList.toggle('hidden', !settings.wallhavenResolution);
    
    const localOrderWrap = document.getElementById('local-order-wrapper');
    if (localOrderWrap) localOrderWrap.classList.toggle('hidden', settings.bgType !== 'local');
    
    const inputShortcuts = document.getElementById('i_shortcuts_enable');
    if (inputShortcuts) inputShortcuts.checked = settings.shortcutsEnabled !== false;
    const shortcutsBar = document.getElementById('shortcuts-bar');
    if (shortcutsBar) shortcutsBar.classList.toggle('hidden', settings.shortcutsEnabled === false);

    const inputShortcutsPos = document.getElementById('i_shortcuts_position');
    if (inputShortcutsPos) inputShortcutsPos.value = settings.shortcutsPosition || 'bottom';
    const inputShortcutsSize = document.getElementById('i_shortcuts_size');
    if (inputShortcutsSize) inputShortcutsSize.value = settings.shortcutsSize || 'medium';

    const posWrap = document.getElementById('shortcuts-position-wrapper');
    const sizeWrap = document.getElementById('shortcuts-size-wrapper');
    const scEnabled = settings.shortcutsEnabled !== false;
    if (posWrap) posWrap.classList.toggle('hidden', !scEnabled);
    if (sizeWrap) sizeWrap.classList.toggle('hidden', !scEnabled);
    applyShortcutsLayout();

    const manualColorWrap = document.getElementById('manual-color-wrapper');
    if (manualColorWrap) manualColorWrap.classList.toggle('hidden', settings.searchAutoColor);

    const opts = { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: settings.timeSeconds ? '2-digit' : undefined, 
        hour12: settings.time12h 
    };
    localStorage.setItem('nova_time_opts', JSON.stringify(opts));

    updateClockAndDate();
}

export const updateSetting = async (key, val, triggerFunc) => { 
    state.settings[key] = val; 
    await storage.setSettings(state.settings); 
    applySettingsToDOM(); 
    if (key === 'font') localStorage.setItem('nova_font_cache', val);
    if (key === 'weatherEnabled') localStorage.setItem('nova_weather_enabled', val);
    if (key === 'timeEnabled') localStorage.setItem('nova_time_enabled', val);
    if (key === 'dateEnabled') localStorage.setItem('nova_date_enabled', val);
    if (key === 'greetingsEnabled') localStorage.setItem('nova_greetings_enabled', val);
    if (key === 'searchAutoColor') localStorage.setItem('nova_search_auto', val);
    if (triggerFunc) triggerFunc();
    preCalculateNextBackground(); 
};

export const toggleSettings = (forceState) => {
    const domSettings = document.getElementById('settings');
    const domSettingsToggleBtn = document.getElementById('settings-toggle-btn');
    const domInterface = document.getElementById('interface');
    if (!domSettings || !domSettingsToggleBtn || !domInterface) return;
    
    const stateVal = forceState !== undefined ? forceState : !domSettings.classList.contains('shown');
    domSettings.classList.toggle('shown', stateVal);
    domInterface.classList.toggle('pushed', stateVal);
    domSettingsToggleBtn.classList.toggle('active', stateVal);
    document.body.classList.toggle('settings-open', stateVal);
    localStorage.setItem('nova_settings_open', stateVal ? '1' : '0');
    saveSnapshot();
};

export function initSettingsUI() {
    on('color:update', () => updateWallhavenColorUI());
    on('settings:dom_sync', () => applySettingsToDOM());

    const sliderMap = { 
        'i_blur': 'bgBlur', 
        'i_search_blur': 'searchBlur', 
        'i_brightness': 'bgBrightness', 
        'i_fade': 'bgFade', 
        'i_search_opacity': 'searchBgOpacity',
        'i_search_width': 'searchWidth', 
        'i_search_font': 'searchFontSize',
        'i_clock_size': 'clockSize', 
        'i_date_size': 'dateSize', 
        'i_greeting_size': 'greetingSize', 
        'i_weather_size': 'weatherSize'
    };

    Object.keys(sliderMap).forEach(id => {
        const slider = document.getElementById(id);
        if (slider) {
            slider.addEventListener('input', e => {
                updateSliderFill(e.target);
                const val = parseInt(e.target.value);
                updateSetting(sliderMap[e.target.id], val);
            });
        }
    });

    const inputFont = document.getElementById('i_font');
    if (inputFont) inputFont.addEventListener('change', e => updateSetting('font', e.target.value));

    const inputTextColor = document.getElementById('i_text_color');
    if (inputTextColor) inputTextColor.addEventListener('input', e => updateSetting('textColor', e.target.value));

    const inputEngine = document.getElementById('i_engine');
    if (inputEngine) inputEngine.addEventListener('change', e => updateSetting('engine', e.target.value));
    
    const inputSearchAuto = document.getElementById('i_search_auto_color');
    if (inputSearchAuto) {
        inputSearchAuto.addEventListener('change', e => {
            updateSetting('searchAutoColor', e.target.checked);
            if (e.target.checked) loadBackground(false, false); 
        });
    }

    const inputSearchColor = document.getElementById('i_search_bg_color');
    if (inputSearchColor) inputSearchColor.addEventListener('input', e => updateSetting('searchBgColor', e.target.value));

    const inputShortcuts = document.getElementById('i_shortcuts_enable');
    if (inputShortcuts) {
        inputShortcuts.addEventListener('change', e => {
            const enabled = e.target.checked;
            updateSetting('shortcutsEnabled', enabled);
            const shortcutsBar = document.getElementById('shortcuts-bar');
            if (shortcutsBar) shortcutsBar.classList.toggle('hidden', !enabled);
            const posWrap = document.getElementById('shortcuts-position-wrapper');
            const sizeWrap = document.getElementById('shortcuts-size-wrapper');
            if (posWrap) posWrap.classList.toggle('hidden', !enabled);
            if (sizeWrap) sizeWrap.classList.toggle('hidden', !enabled);
            applyShortcutsLayout();
        });
    }

    const inputShortcutsPos = document.getElementById('i_shortcuts_position');
    if (inputShortcutsPos) {
        inputShortcutsPos.addEventListener('change', e => {
            updateSetting('shortcutsPosition', e.target.value);
            applyShortcutsLayout();
        });
    }

    const inputShortcutsSize = document.getElementById('i_shortcuts_size');
    if (inputShortcutsSize) {
        inputShortcutsSize.addEventListener('change', e => {
            updateSetting('shortcutsSize', e.target.value);
            applyShortcutsLayout();
        });
    }

    const inputBgType = document.getElementById('i_bg_type');
    if (inputBgType) {
        inputBgType.addEventListener('change', async (e) => {
            const val = e.target.value;
            state.activeDrawerTab = val;
            await updateSetting('bgType', val, () => loadBackground(false, false));
            await syncPreviewWithActiveWallpaper(null, true);
        });
    }

    const inputBgFreq = document.getElementById('i_bg_frequency');
    if (inputBgFreq) inputBgFreq.addEventListener('change', e => updateSetting('bgFrequency', e.target.value));

    const inputLocalOrder = document.getElementById('i_local_order');
    if (inputLocalOrder) inputLocalOrder.addEventListener('change', e => updateSetting('localOrder', e.target.value));

    const inputWhMode = document.getElementById('i_wallhaven_mode');
    if (inputWhMode) {
        inputWhMode.addEventListener('change', e => { 
            resetWallhavenSession(); 
            updateSetting('wallhavenMode', e.target.value, () => loadBackground(true, false)); 
        });
    }

    const inputWhTopRange = document.getElementById('i_wallhaven_toprange');
    if (inputWhTopRange) {
        inputWhTopRange.addEventListener('change', e => { 
            resetWallhavenSession(); 
            updateSetting('wallhavenTopRange', e.target.value, () => loadBackground(true, false)); 
        });
    }

    const inputWhRes = document.getElementById('i_wallhaven_resolution');
    if (inputWhRes) {
        inputWhRes.addEventListener('change', e => { 
            resetWallhavenSession(); 
            updateSetting('wallhavenResolution', e.target.value, () => loadBackground(true, false)); 
        });
    }

    const inputWhResMode = document.getElementById('i_wallhaven_resolution_mode');
    if (inputWhResMode) {
        inputWhResMode.addEventListener('change', e => { 
            resetWallhavenSession(); 
            updateSetting('wallhavenResolutionMode', e.target.value, () => loadBackground(true, false)); 
        });
    }

    const inputWhRatio = document.getElementById('i_wallhaven_ratio');
    if (inputWhRatio) {
        inputWhRatio.addEventListener('change', e => { 
            resetWallhavenSession(); 
            updateSetting('wallhavenRatio', e.target.value, () => loadBackground(true, false)); 
        });
    }
    
    const inputWh = document.getElementById('i_wallhaven');
    const applyTag = () => {
        if (!inputWh) return;
        resetWallhavenSession();
        updateSetting('wallhavenQuery', inputWh.value, () => loadBackground(true, false));
    };
    const btnApplyWh = document.getElementById('b_apply_wallhaven');
    if (btnApplyWh) btnApplyWh.addEventListener('click', applyTag);
    if (inputWh) inputWh.addEventListener('keydown', (e) => { 
        if (e.key === 'Enter') { 
            e.preventDefault(); 
            if (e.isComposing || e.keyCode === 229) return;
            applyTag(); 
        } 
    });

    const timeEnable = document.getElementById('i_time_enable');
    if (timeEnable) timeEnable.addEventListener('change', e => updateSetting('timeEnabled', e.target.checked));

    const time12h = document.getElementById('i_time_12h');
    if (time12h) time12h.addEventListener('change', e => updateSetting('time12h', e.target.checked));

    const timeSec = document.getElementById('i_time_seconds');
    if (timeSec) timeSec.addEventListener('change', e => updateSetting('timeSeconds', e.target.checked));

    const dateEnable = document.getElementById('i_date_enable');
    if (dateEnable) dateEnable.addEventListener('change', e => updateSetting('dateEnabled', e.target.checked));

    const weatherEnable = document.getElementById('i_weather_enable');
    if (weatherEnable) weatherEnable.addEventListener('change', e => updateSetting('weatherEnabled', e.target.checked, () => updateWeather(true)));

    const weatherUnit = document.getElementById('i_weather_unit');
    if (weatherUnit) weatherUnit.addEventListener('change', e => updateSetting('weatherUnit', e.target.value, () => updateWeather(true)));

    const weatherService = document.getElementById('i_weather_service');
    if (weatherService) weatherService.addEventListener('change', e => updateSetting('weatherService', e.target.value, () => updateWeather(true)));

    const greetingsEnable = document.getElementById('i_greetings_enable');
    if (greetingsEnable) greetingsEnable.addEventListener('change', e => updateSetting('greetingsEnabled', e.target.checked));
    
    const weatherCity = document.getElementById('i_weather_city');
    const applyCity = () => {
        if (!weatherCity) return;
        updateSetting('weatherCity', weatherCity.value, () => updateWeather(true));
    };
    const btnApplyCity = document.getElementById('b_apply_city');
    if (btnApplyCity) btnApplyCity.addEventListener('click', applyCity);
    if (weatherCity) weatherCity.addEventListener('keydown', (e) => { 
        if (e.key === 'Enter') { 
            e.preventDefault(); 
            if (e.isComposing || e.keyCode === 229) return;
            applyCity(); 
        } 
    });

    const btnRefreshBg = document.getElementById('b_refresh_bg');
    if (btnRefreshBg) btnRefreshBg.addEventListener('click', () => switchToNextWallpaper());
    const btnNextWh = document.getElementById('b_next_wh');
    if (btnNextWh) btnNextWh.addEventListener('click', () => switchToNextWallpaper());

    const domSettingsToggleBtn = document.getElementById('settings-toggle-btn');
    if (domSettingsToggleBtn) {
        domSettingsToggleBtn.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            toggleSettings(); 
        });
    }

    const btnCloseSettings = document.getElementById('close-settings-btn');
    if (btnCloseSettings) {
        btnCloseSettings.addEventListener('click', () => toggleSettings(false));
    }

    document.addEventListener('click', (e) => {
        const domSettings = document.getElementById('settings');
        const domWhDrawer = document.getElementById('wallhaven-preview-drawer');
        const showSettingsBtn = document.getElementById('show-settings');
        const inSettings = (domSettings && domSettings.contains(e.target)) || (showSettingsBtn && showSettingsBtn.contains(e.target));
        const inDrawer = domWhDrawer && domWhDrawer.contains(e.target);
        if (!inSettings && !inDrawer && domSettings && domSettings.classList.contains('shown')) {
            toggleSettings(false);
        }
        if (!inSettings && !inDrawer && domWhDrawer && domWhDrawer.classList.contains('shown')) {
            toggleWhDrawer(false);
        }
    });
}
