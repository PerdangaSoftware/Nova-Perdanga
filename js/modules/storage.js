import state, { defaultSettings } from './state.js';

export { defaultSettings };

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

export function saveSnapshot() {
    try {
        const snapshot = {
            settings: state.settings,
            ui: {
                settingsOpen: localStorage.getItem('nova_settings_open') === '1',
                drawerOpen: localStorage.getItem('nova_drawer_open') === '1',
                zenMode: localStorage.getItem('nova_zen_mode') === '1'
            },
            drawer: {
                offset: parseInt(localStorage.getItem('nova_wh_preview_offset') || '0'),
                total: parseInt(localStorage.getItem('nova_wh_total') || '0'),
                activeWhUrl: localStorage.getItem('nova_active_wh_url') || '',
                activeTab: state.activeDrawerTab || (state.settings.bgType === 'local' ? 'local' : 'wallhaven')
            },
            font: state.settings.font,
            timeEnabled: state.settings.timeEnabled,
            dateEnabled: state.settings.dateEnabled,
            weatherEnabled: state.settings.weatherEnabled,
            greetingsEnabled: state.settings.greetingsEnabled
        };
        localStorage.setItem('nova_snapshot', JSON.stringify(snapshot));
    } catch {}
}

export const storage = {
    getSettings: async () => {
        const data = await chrome.storage.local.get(['nova_settings']);
        return data.nova_settings ? structuredClone(data.nova_settings) : structuredClone(defaultSettings);
    },
    setSettings: async (newData) => {
        try {
            localStorage.setItem('nova_settings_cache', JSON.stringify(newData));
            saveSnapshot();
        } catch {}
        await chrome.storage.local.set({ nova_settings: newData });
    },
    getGallery: async () => {
        const data = await chrome.storage.local.get(['nova_gallery']);
        return data.nova_gallery || [];
    },
    setGallery: async (gallery) => {
        await chrome.storage.local.set({ nova_gallery: gallery });
    }
};

export async function initSettings() {
    let loaded = await storage.getSettings();
    state.settings = { ...defaultSettings, ...loaded };

    if (state.settings.bgFrequency === undefined) {
        state.settings.bgFrequency = state.settings.bgChangeNewTab ? "every_tab" : "never";
    }
    if (state.settings.wallhavenQueue === undefined) state.settings.wallhavenQueue = [];
    if (state.settings.wallhavenHistory === undefined) state.settings.wallhavenHistory = [];
    if (state.settings.localHistory === undefined) state.settings.localHistory = [];
    if (state.settings.wallhavenResolution === undefined) state.settings.wallhavenResolution = "";
    if (state.settings.wallhavenResolutionMode === undefined) state.settings.wallhavenResolutionMode = "atleast";
    if (state.settings.wallhavenTopRange === undefined) state.settings.wallhavenTopRange = "1M";
    if (state.settings.wallhavenRatio === undefined) state.settings.wallhavenRatio = "";
    if (state.settings.wallhavenColor === undefined) state.settings.wallhavenColor = "";

    state.activeDrawerTab = state.settings.bgType === 'local' ? 'local' : 'wallhaven';
    localStorage.setItem('nova_font_cache', state.settings.font);
    try {
        localStorage.setItem('nova_settings_cache', JSON.stringify(state.settings));
        saveSnapshot();
    } catch {}

    return state.settings;
}
