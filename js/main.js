import { hydrateUI, initClock } from './modules/clock.js';
import { initSettings } from './modules/storage.js';
import { updateWeather } from './modules/weather.js';
import { initGallery } from './modules/gallery.js';
import { initSearch } from './modules/search.js';
import { initSettingsUI, applySettingsToDOM, initWallhavenColorGrid, toggleSettings } from './modules/settings.js';
import { initDrawer, toggleWhDrawer, hydrateDrawerHeader } from './modules/drawer.js';
import { initHotkeys } from './modules/hotkeys.js';
import { loadBackground } from './modules/background.js';

if (localStorage.getItem('nova_settings_open') === '1') {
    toggleSettings(true);
}
if (localStorage.getItem('nova_drawer_open') === '1') {
    toggleWhDrawer(true);
}
if (localStorage.getItem('nova_zen_mode') === '1') {
    document.body.classList.add('zen-mode');
}

hydrateUI();
applySettingsToDOM();
hydrateDrawerHeader();

document.addEventListener('DOMContentLoaded', async () => {
    const startupHide = document.getElementById('startup-hide-css');
    if (startupHide) startupHide.remove();

    initClock();
    initGallery();
    initSearch();
    initSettingsUI();
    initDrawer();
    initHotkeys();
    initWallhavenColorGrid();

    await initSettings();
    applySettingsToDOM();
    updateWeather();

    await loadBackground(false, true);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            document.documentElement.classList.add('ready');
            document.documentElement.classList.remove('init-settings-open', 'init-drawer-open', 'init-bg-local');
            const sh = document.getElementById('startup-hide-css');
            if (sh) sh.remove();
            const sb = document.getElementById('startup-bg-style');
            if (sb) sb.remove();
        });
    });
});
