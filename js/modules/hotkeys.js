import state from './state.js';
import { storage } from './storage.js';
import { showToast } from './utils.js';
import { loadBackground } from './background.js';
import { saveCurrentWallhaven } from './wallhaven.js';
import { toggleSettings, updateSetting } from './settings.js';
import { toggleWhDrawer, syncPreviewWithCurrentBackground } from './drawer.js';

export const toggleShortcutsModal = (forceState) => {
    const shortcutsModal = document.getElementById('shortcuts-modal');
    if (!shortcutsModal) return;
    const stateVal = forceState !== undefined ? forceState : shortcutsModal.classList.contains('hidden');
    shortcutsModal.classList.toggle('hidden', !stateVal);
};

export const toggleZenMode = (forceState, silent = false) => {
    const isZen = forceState !== undefined ? forceState : !document.body.classList.contains('zen-mode');
    document.body.classList.toggle('zen-mode', isZen);
    document.documentElement.classList.toggle('zen-mode', isZen);
    localStorage.setItem('nova_zen_mode', isZen ? '1' : '0');
    if (!silent) {
        showToast(isZen ? "Zen Mode: UI hidden (Press H or Esc to exit)" : "Zen Mode off");
    }
};

export function initHotkeys() {
    const shortcutsModal = document.getElementById('shortcuts-modal');
    const btnShowShortcuts = document.getElementById('b_show_shortcuts');
    const btnCloseShortcuts = document.getElementById('close-shortcuts-btn');

    if (btnShowShortcuts) btnShowShortcuts.addEventListener('click', () => toggleShortcutsModal(true));
    if (btnCloseShortcuts) btnCloseShortcuts.addEventListener('click', () => toggleShortcutsModal(false));
    if (shortcutsModal) {
        shortcutsModal.addEventListener('click', (e) => {
            if (e.target === shortcutsModal) toggleShortcutsModal(false);
        });
    }

    document.addEventListener('dblclick', (e) => {
        if (e.target === document.body || e.target.id === 'interface' || e.target.id === 'background-wrapper' || e.target.id === 'bg-overlay') {
            toggleZenMode();
        }
    });

    window.addEventListener('keydown', async (e) => {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        const isInputFocused = activeTag === 'input' || activeTag === 'textarea' || (document.activeElement && document.activeElement.isContentEditable);

        const code = e.code;
        const key = e.key ? e.key.toLowerCase() : '';
        const domWhDrawer = document.getElementById('wallhaven-preview-drawer');
        const domSettings = document.getElementById('settings');
        const searchInput = document.getElementById('searchbar');

        if (key === 'escape' || code === 'Escape') {
            if (shortcutsModal && !shortcutsModal.classList.contains('hidden')) {
                toggleShortcutsModal(false);
                return;
            }
            if (document.body.classList.contains('zen-mode')) {
                toggleZenMode();
                return;
            }
            if (domWhDrawer && domWhDrawer.classList.contains('shown')) {
                toggleWhDrawer(false);
                return;
            }
            if (domSettings && domSettings.classList.contains('shown')) {
                toggleSettings(false);
                return;
            }
            return;
        }

        if (isInputFocused) return;

        if (code === 'KeyW' || key === 'w' || key === 'ц') {
            e.preventDefault();
            toggleWhDrawer();
            return;
        }

        if (code === 'Slash' || key === '/' || key === '.' || code === 'Space' || key === ' ') {
            e.preventDefault();
            if (searchInput) searchInput.focus();
            return;
        }

        if (code === 'KeyM' || key === 'm' || key === 'ь') {
            e.preventDefault();
            const newType = state.settings.bgType === 'wallhaven' ? 'local' : 'wallhaven';
            state.activeDrawerTab = newType;
            await updateSetting('bgType', newType, () => loadBackground(false, false));
            syncPreviewWithCurrentBackground();
            showToast(`Mode: ${newType === 'wallhaven' ? 'Wallhaven' : 'Local files'}`);
            return;
        }

        if (code === 'KeyH' || key === 'h' || key === 'р' || code === 'KeyZ' || key === 'z' || key === 'я') {
            e.preventDefault();
            toggleZenMode();
            return;
        }

        if (code === 'KeyO' || key === 'o' || key === 'щ' || code === 'Comma' || key === ',') {
            e.preventDefault();
            toggleSettings();
            return;
        }

        if (code === 'KeyN' || key === 'n' || key === 'т' || code === 'ArrowRight' || key === 'arrowright') {
            e.preventDefault();
            loadBackground(true, false);
            return;
        }

        if (code === 'KeyP' || key === 'p' || key === 'з' || code === 'ArrowLeft' || key === 'arrowleft') {
            e.preventDefault();
            if (state.settings.bgType === 'wallhaven') {
                if (state.settings.wallhavenHistory.length > 0) {
                    const prevUrl = state.settings.wallhavenHistory.pop();
                    state.settings.wallhavenQueue.unshift(prevUrl);
                    state.currentActiveWallhavenUrl = prevUrl;
                    localStorage.setItem('nova_active_wh_url', prevUrl);
                    syncPreviewWithCurrentBackground(prevUrl);
                    await storage.setSettings(state.settings);
                    loadBackground(false, false);
                }
            } else {
                const gallery = await storage.getGallery();
                if (gallery.length > 1) {
                    let idx = gallery.findIndex(img => img.id === state.settings.selectedLocalBg);
                    idx = (idx - 1 + gallery.length) % gallery.length;
                    state.settings.selectedLocalBg = gallery[idx].id;
                    await storage.setSettings(state.settings);
                    loadBackground(false, false);
                }
            }
            return;
        }

        if (code === 'KeyS' || key === 's' || key === 'ы') {
            e.preventDefault();
            if (state.settings.bgType === 'wallhaven') {
                await saveCurrentWallhaven();
            } else {
                showToast("Already using Local wallpaper");
            }
            return;
        }
    });
}
