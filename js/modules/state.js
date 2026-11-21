export const defaultSettings = {
    font: "'Outfit', sans-serif",
    textColor: "#ffffff",
    searchAutoColor: true,
    searchBgColor: "#ffffff",
    searchBgOpacity: 25,
    engine: "google",
    bgType: "wallhaven", 
    bgFrequency: "every_tab",
    wallhavenMode: "search",
    wallhavenTopRange: "1M",
    wallhavenQuery: "landscape",
    wallhavenResolution: "",
    wallhavenResolutionMode: "atleast",
    wallhavenRatio: "",
    wallhavenColor: "",
    wallhavenQueue: [], 
    wallhavenHistory: [],
    localHistory: [],
    selectedLocalBg: "",
    bgBlur: 0,
    bgBrightness: 100,
    bgFadeEnabled: true, 
    bgFade: 1000,
    searchBlur: 10,
    searchWidth: 500,
    searchFontSize: 12,
    clockSize: 80,
    dateSize: 15,
    greetingSize: 25,
    weatherSize: 11,
    timeEnabled: true,
    time12h: false,
    timeSeconds: false,
    dateEnabled: true,
    weatherEnabled: true,
    weatherCity: "",
    weatherUnit: "celsius",
    weatherService: "google",
    greetingsEnabled: true
};

function getInitialSettings() {
    try {
        const rawSnap = localStorage.getItem('nova_snapshot');
        if (rawSnap) {
            const snap = JSON.parse(rawSnap);
            if (snap && snap.settings) {
                const s = { ...defaultSettings, ...snap.settings };
                if (s.engine === 'bing') s.engine = 'google';
                return s;
            }
        }
        const cached = localStorage.getItem('nova_settings_cache');
        if (cached) {
            const s = { ...defaultSettings, ...JSON.parse(cached) };
            if (s.engine === 'bing') s.engine = 'google';
            return s;
        }
    } catch {}
    return { ...defaultSettings };
}

const state = {
    settings: getInitialSettings(),
    activeBg: 1,
    activeObjectUrl: null,
    isLoadingBg: false,
    currentActiveWallhavenUrl: localStorage.getItem('nova_active_wh_url') || localStorage.getItem('nova_startup_bg') || '',
    activeDrawerTab: (getInitialSettings().bgType === 'local') ? 'local' : 'wallhaven',
    currentLocalOffset: null,
    currentWhOffset: null,
    bgSwitchSeq: 0,
    isPagingPreview: false,
    rootStyle: document.documentElement.style
};

const bus = new EventTarget();

export function emit(eventName, detail = {}) {
    bus.dispatchEvent(new CustomEvent(eventName, { detail }));
}

export function on(eventName, callback) {
    bus.addEventListener(eventName, (e) => callback(e.detail));
}

export function getState() {
    return state;
}

export default state;
