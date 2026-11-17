import state from './state.js';

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

const idbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('NovaPerdangaDB', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('images');
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject('IndexedDB failed');
});

export const idb = {
    get: async (key) => {
        const db = await idbPromise;
        return new Promise(res => {
            const req = db.transaction('images', 'readonly').objectStore('images').get(key);
            req.onsuccess = () => res(req.result);
            req.onerror = () => res(null);
        });
    },
    set: async (key, blob) => {
        const db = await idbPromise;
        return new Promise(res => {
            const tx = db.transaction('images', 'readwrite');
            tx.objectStore('images').put(blob, key);
            tx.oncomplete = () => res();
        });
    },
    remove: async (key) => {
        const db = await idbPromise;
        return new Promise(res => {
            const tx = db.transaction('images', 'readwrite');
            tx.objectStore('images').delete(key);
            tx.oncomplete = () => res();
        });
    }
};

export const storage = {
    getSettings: () => new Promise(res => chrome.storage.local.get(['nova_settings'], data => res(data.nova_settings || defaultSettings))),
    setSettings: (newData) => new Promise(res => chrome.storage.local.set({ nova_settings: newData }, res)),
    getGallery: () => new Promise(res => chrome.storage.local.get(['nova_gallery'], data => res(data.nova_gallery || []))),
    setGallery: (gallery) => new Promise(res => chrome.storage.local.set({ nova_gallery: gallery }, res))
};

export async function initSettings() {
    let loaded = await storage.getSettings();
    state.settings = { ...defaultSettings, ...loaded };

    if (state.settings.bgFrequency === undefined) {
        state.settings.bgFrequency = state.settings.bgChangeNewTab ? "every_tab" : "never";
    }
    if (state.settings.wallhavenQueue === undefined) state.settings.wallhavenQueue = [];
    if (state.settings.wallhavenHistory === undefined) state.settings.wallhavenHistory = [];
    if (state.settings.wallhavenResolution === undefined) state.settings.wallhavenResolution = "";
    if (state.settings.wallhavenResolutionMode === undefined) state.settings.wallhavenResolutionMode = "atleast";
    if (state.settings.wallhavenTopRange === undefined) state.settings.wallhavenTopRange = "1M";
    if (state.settings.wallhavenRatio === undefined) state.settings.wallhavenRatio = "";
    if (state.settings.wallhavenColor === undefined) state.settings.wallhavenColor = "";

    state.activeDrawerTab = state.settings.bgType === 'local' ? 'local' : 'wallhaven';
    localStorage.setItem('nova_font_cache', state.settings.font);

    return state.settings;
}
