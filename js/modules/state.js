const state = {
    settings: {},
    activeBg: 1,
    activeObjectUrl: null,
    isLoadingBg: false,
    currentActiveWallhavenUrl: localStorage.getItem('nova_active_wh_url') || '',
    activeDrawerTab: 'wallhaven',
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
