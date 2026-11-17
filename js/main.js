import { hydrateUI, initClock } from './modules/clock.js';
import { initSettings } from './modules/storage.js';
import { updateWeather } from './modules/weather.js';
import { initGallery } from './modules/gallery.js';
import { initSearch } from './modules/search.js';
import { initSettingsUI, applySettingsToDOM, initWallhavenColorGrid, toggleSettings } from './modules/settings.js';
import { initDrawer, syncPreviewWithCurrentBackground, toggleWhDrawer } from './modules/drawer.js';
import { initHotkeys } from './modules/hotkeys.js';
import { loadBackground } from './modules/background.js';

hydrateUI();

document.addEventListener('DOMContentLoaded', async () => {
    await initSettings();
    initClock();
    initGallery();
    initSearch();
    initSettingsUI();
    initDrawer();
    initHotkeys();
    initWallhavenColorGrid();
    applySettingsToDOM();
    updateWeather();

    await loadBackground(false, true);
    syncPreviewWithCurrentBackground();

    if (localStorage.getItem('nova_settings_open') === '1') {
        toggleSettings(true);
    }
    if (localStorage.getItem('nova_drawer_open') === '1') {
        toggleWhDrawer(true);
    }
    if (localStorage.getItem('nova_zen_mode') === '1') {
        document.body.classList.add('zen-mode');
    }

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            document.body.classList.remove('preload-no-transition');
            document.documentElement.classList.remove('init-settings-open', 'init-drawer-open');
            document.documentElement.classList.add('ready');
        });
    });
});
