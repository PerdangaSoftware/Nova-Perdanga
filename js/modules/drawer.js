import state, { emit, on } from './state.js';
import { storage, saveSnapshot } from './storage.js';
import { isSameWallpaper, getCurrentScreenWallpaperUrl, loadBackground, switchToNextWallpaper, switchToPrevWallpaper, preCalculateNextBackground } from './background.js';
import { getWallhavenPool, fetchWallhavenBatch, resetWallhavenSession, doFetchWallhaven, saveCurrentWallhaven } from './wallhaven.js';
import { renderGallery, downloadAllWallpapersZip } from './gallery.js';
import { updatePrevButtonState, updatePreviewHighlight, jumpToActiveWallpaper, updateActiveWallpaperCard, hydrateDrawerHeader, downloadCurrentWallhaven } from './drawer-card.js';
import { syncLocalPreviewWithCurrentBackground, renderLocalPreviews } from './drawer-local.js';
import { syncPreviewWithActiveWallpaper, syncPreviewWithCurrentBackground, renderWallhavenPreviews, changeWallhavenPreviewOffset, selectWallhavenPreviewImage, updateWallhavenCategoryChips, submitDrawerQuery, searchWallhavenTag, updateWallhavenTags } from './drawer-wallhaven.js';

export {
    updatePrevButtonState,
    updatePreviewHighlight,
    jumpToActiveWallpaper,
    updateActiveWallpaperCard,
    hydrateDrawerHeader,
    downloadCurrentWallhaven,
    syncLocalPreviewWithCurrentBackground,
    renderLocalPreviews,
    syncPreviewWithActiveWallpaper,
    syncPreviewWithCurrentBackground,
    renderWallhavenPreviews,
    changeWallhavenPreviewOffset,
    selectWallhavenPreviewImage,
    updateWallhavenCategoryChips,
    submitDrawerQuery,
    searchWallhavenTag,
    updateWallhavenTags
};

export function toggleWhDrawer(forceState, shouldSync = true) {
    const domWhDrawer = document.getElementById('wallhaven-preview-drawer');
    const domWhDrawerQuickBtn = document.getElementById('wh-drawer-quick-btn');
    if (!domWhDrawer) return;
    const stateVal = forceState !== undefined ? forceState : !domWhDrawer.classList.contains('shown');
    domWhDrawer.classList.toggle('shown', stateVal);
    if (domWhDrawerQuickBtn) domWhDrawerQuickBtn.classList.toggle('active', stateVal);
    document.body.classList.toggle('drawer-open', stateVal);
    localStorage.setItem('nova_drawer_open', stateVal ? '1' : '0');
    saveSnapshot();
    if (stateVal && shouldSync) {
        syncPreviewWithActiveWallpaper(null, true);
    }
}

export function initDrawer() {
    on('preview:sync', async (detail) => {
        await syncPreviewWithActiveWallpaper(detail?.currentUrl);
    });

    on('preview:rerender', () => {
        if (state.activeDrawerTab === 'wallhaven') {
            renderWallhavenPreviews(state.currentWhOffset);
        }
    });

    const grid = document.getElementById('wallhaven-preview-grid');
    if (grid) {
        grid.addEventListener('click', async (e) => {
            const item = e.target.closest('.wh-preview-item');
            if (!item) return;
            e.stopPropagation();
            if (state.activeDrawerTab === 'local') {
                const id = item.dataset.id;
                if (!id) return;
                if (state.settings.selectedLocalBg === id && state.settings.bgType === 'local') return;
                const prevId = state.settings.selectedLocalBg;
                if (!state.settings.localHistory) state.settings.localHistory = [];
                if (prevId && prevId !== id) {
                    state.settings.localHistory.push(prevId);
                    if (state.settings.localHistory.length > 50) state.settings.localHistory.shift();
                }
                state.settings.bgType = 'local';
                state.settings.selectedLocalBg = id;
                const bgTypeInput = document.getElementById('i_bg_type');
                if (bgTypeInput) bgTypeInput.value = 'local';
                const hubTitle = document.getElementById('v_hub_launcher_title');
                if (hubTitle) hubTitle.textContent = 'Browse Local Files';
                await storage.setSettings(state.settings);
                updatePreviewHighlight(id);
                updateActiveWallpaperCard();
                updatePrevButtonState();
                renderGallery();
                await loadBackground(false, false);
            } else {
                const path = item.dataset.path;
                if (!path) return;
                const pool = getWallhavenPool();
                const matched = pool.find(p => isSameWallpaper(p.path, path));
                if (matched) {
                    selectWallhavenPreviewImage(matched);
                } else {
                    if (isSameWallpaper(getCurrentScreenWallpaperUrl(), path)) return;
                    state.settings.bgType = 'wallhaven';
                    state.currentActiveWallhavenUrl = path;
                    localStorage.setItem('nova_active_wh_url', path);
                    await storage.setSettings(state.settings);
                    emit('preview:sync', { currentUrl: path });
                    await loadBackground(false, false);
                }
            }
        });
    }

    const btnOpenWhDrawer = document.getElementById('b_open_wh_drawer');
    if (btnOpenWhDrawer) {
        btnOpenWhDrawer.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleWhDrawer(true);
        });
    }

    const domWhDrawerQuickBtn = document.getElementById('wh-drawer-quick-btn');
    if (domWhDrawerQuickBtn) {
        domWhDrawerQuickBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleWhDrawer();
        });
    }

    const btnCloseWhDrawer = document.getElementById('close-wh-drawer-btn');
    if (btnCloseWhDrawer) {
        btnCloseWhDrawer.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleWhDrawer(false);
        });
    }

    const btnTabWh = document.getElementById('b_drawer_tab_wallhaven');
    if (btnTabWh) {
        btnTabWh.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (state.activeDrawerTab === 'wallhaven' && state.settings.bgType === 'wallhaven') return;
            state.activeDrawerTab = 'wallhaven';
            state.settings.bgType = 'wallhaven';
            const bgTypeInput = document.getElementById('i_bg_type');
            if (bgTypeInput) bgTypeInput.value = 'wallhaven';
            const hubTitle = document.getElementById('v_hub_launcher_title');
            if (hubTitle) hubTitle.textContent = 'Browse Wallhaven';
            await storage.setSettings(state.settings);
            emit('settings:dom_sync');
            await syncPreviewWithActiveWallpaper(null, true);
            await loadBackground(false, false);
        });
    }

    const btnTabLocal = document.getElementById('b_drawer_tab_local');
    if (btnTabLocal) {
        btnTabLocal.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (state.activeDrawerTab === 'local' && state.settings.bgType === 'local') return;
            state.activeDrawerTab = 'local';
            state.settings.bgType = 'local';
            const bgTypeInput = document.getElementById('i_bg_type');
            if (bgTypeInput) bgTypeInput.value = 'local';
            const hubTitle = document.getElementById('v_hub_launcher_title');
            if (hubTitle) hubTitle.textContent = 'Browse Local Files';
            await storage.setSettings(state.settings);
            emit('settings:dom_sync');
            await syncPreviewWithActiveWallpaper(null, true);
            await loadBackground(false, false);
        });
    }

    const btnRefreshWhDrawer = document.getElementById('b_refresh_wh_drawer');
    if (btnRefreshWhDrawer) {
        btnRefreshWhDrawer.addEventListener('click', async (e) => {
            e.stopPropagation();
            btnRefreshWhDrawer.classList.add('spinning');
            try {
                if (state.activeDrawerTab === 'local') {
                    await renderLocalPreviews();
                } else {
                    resetWallhavenSession();
                    state.currentWhOffset = 0;
                    const grid = document.getElementById('wallhaven-preview-grid');
                    if (grid) grid.innerHTML = '<div class="wh-preview-empty">Loading...</div>';
                    const countBadge = document.getElementById('v_wallhaven_preview_count');
                    if (countBadge) countBadge.textContent = '...';
                    await doFetchWallhaven(1);
                    renderWallhavenPreviews(0);
                }
            } finally {
                setTimeout(() => {
                    btnRefreshWhDrawer.classList.remove('spinning');
                }, 400);
            }
        });
    }

    const btnPrevWhPreview = document.getElementById('b_prev_wh_preview');
    const btnNextWhPreview = document.getElementById('b_next_wh_preview');
    if (btnPrevWhPreview) {
        btnPrevWhPreview.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (state.activeDrawerTab === 'local') {
                const gallery = await storage.getGallery();
                if (gallery.length <= 10) return;
                let currentOffset = state.currentLocalOffset !== null 
                    ? state.currentLocalOffset 
                    : parseInt(localStorage.getItem('nova_local_preview_offset') || '0');
                let targetOffset = currentOffset - 10;
                if (targetOffset < 0) {
                    targetOffset = Math.floor((gallery.length - 1) / 10) * 10;
                }
                await renderLocalPreviews(targetOffset);
            } else {
                await changeWallhavenPreviewOffset(-10);
            }
        });
    }
    if (btnNextWhPreview) {
        btnNextWhPreview.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (state.activeDrawerTab === 'local') {
                const gallery = await storage.getGallery();
                if (gallery.length <= 10) return;
                let currentOffset = state.currentLocalOffset !== null 
                    ? state.currentLocalOffset 
                    : parseInt(localStorage.getItem('nova_local_preview_offset') || '0');
                let targetOffset = currentOffset + 10;
                if (targetOffset >= gallery.length) {
                    targetOffset = 0;
                }
                await renderLocalPreviews(targetOffset);
            } else {
                await changeWallhavenPreviewOffset(10);
            }
        });
    }

    const btnDrawerPrevBg = document.getElementById('b_drawer_prev_bg');
    if (btnDrawerPrevBg) {
        btnDrawerPrevBg.addEventListener('click', async (e) => {
            e.stopPropagation();
            await switchToPrevWallpaper();
        });
    }

    const btnDrawerNextBg = document.getElementById('b_drawer_next_bg');
    if (btnDrawerNextBg) {
        btnDrawerNextBg.addEventListener('click', async (e) => {
            e.stopPropagation();
            await switchToNextWallpaper();
        });
    }

    const btnDrawerSave = document.getElementById('b_drawer_save');
    if (btnDrawerSave) {
        btnDrawerSave.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (state.activeDrawerTab === 'local' || state.settings.bgType === 'local') {
                const uploadInput = document.getElementById('i_drawer_local_upload');
                if (uploadInput) uploadInput.click();
            } else {
                await saveCurrentWallhaven();
            }
        });
    }

    const btnWhDownload = document.getElementById('b_drawer_wh_download');
    if (btnWhDownload) {
        btnWhDownload.addEventListener('click', async (e) => {
            e.stopPropagation();
            await downloadCurrentWallhaven();
        });
    }

    const tagsToggle = document.getElementById('drawer-wh-tags-toggle');
    const tagsWrap = document.getElementById('drawer-wh-tags');
    const tagsArrow = document.getElementById('drawer-wh-tags-arrow');
    if (tagsToggle && tagsWrap) {
        tagsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCollapsed = tagsWrap.classList.toggle('collapsed');
            if (tagsArrow) tagsArrow.classList.toggle('open', !isCollapsed);
            localStorage.setItem('nova_wh_tags_collapsed', isCollapsed ? '1' : '0');
        });
        const savedCollapsed = localStorage.getItem('nova_wh_tags_collapsed');
        if (savedCollapsed === '1') {
            tagsWrap.classList.add('collapsed');
            if (tagsArrow) tagsArrow.classList.remove('open');
        } else {
            tagsWrap.classList.remove('collapsed');
            if (tagsArrow) tagsArrow.classList.add('open');
        }
    }

    const btnDrawerFilterToggle = document.getElementById('b_drawer_filter_toggle');
    const drawerQuickFilters = document.getElementById('drawer-quick-filters');
    if (btnDrawerFilterToggle && drawerQuickFilters) {
        btnDrawerFilterToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = !drawerQuickFilters.classList.contains('hidden');
            drawerQuickFilters.classList.toggle('hidden', isOpen);
            btnDrawerFilterToggle.classList.toggle('open', !isOpen);
        });
    }

    const categoryChips = document.querySelectorAll('#drawer-category-chips .filter-chip');
    categoryChips.forEach(chip => {
        chip.addEventListener('click', async (e) => {
            e.stopPropagation();
            const mode = chip.dataset.mode;
            if (!mode) return;
            state.settings.wallhavenMode = mode;
            const whModeInput = document.getElementById('i_wallhaven_mode');
            if (whModeInput) whModeInput.value = mode;
            resetWallhavenSession();
            state.currentWhOffset = 0;
            const grid = document.getElementById('wallhaven-preview-grid');
            if (grid) grid.innerHTML = '<div class="wh-preview-empty">Loading...</div>';
            const countBadge = document.getElementById('v_wallhaven_preview_count');
            if (countBadge) countBadge.textContent = '...';
            await storage.setSettings(state.settings);
            updateWallhavenCategoryChips();
            await doFetchWallhaven(1);
            renderWallhavenPreviews(0);
        });
    });

    const rangeChips = document.querySelectorAll('#drawer-top-range-row .filter-sub-chip');
    rangeChips.forEach(chip => {
        chip.addEventListener('click', async (e) => {
            e.stopPropagation();
            const range = chip.dataset.range;
            if (!range) return;
            state.settings.wallhavenTopRange = range;
            const topRangeInput = document.getElementById('i_wallhaven_toprange');
            if (topRangeInput) topRangeInput.value = range;
            resetWallhavenSession();
            state.currentWhOffset = 0;
            const grid = document.getElementById('wallhaven-preview-grid');
            if (grid) grid.innerHTML = '<div class="wh-preview-empty">Loading...</div>';
            const countBadge = document.getElementById('v_wallhaven_preview_count');
            if (countBadge) countBadge.textContent = '...';
            await storage.setSettings(state.settings);
            updateWallhavenCategoryChips();
            await doFetchWallhaven(1);
            renderWallhavenPreviews(0);
        });
    });

    const drawerRatioSel = document.getElementById('i_drawer_ratio');
    if (drawerRatioSel) {
        drawerRatioSel.addEventListener('change', async (e) => {
            e.stopPropagation();
            state.settings.wallhavenRatio = e.target.value;
            const ratioInput = document.getElementById('i_wallhaven_ratio');
            if (ratioInput) ratioInput.value = e.target.value;
            resetWallhavenSession();
            state.currentWhOffset = 0;
            const grid = document.getElementById('wallhaven-preview-grid');
            if (grid) grid.innerHTML = '<div class="wh-preview-empty">Loading...</div>';
            const countBadge = document.getElementById('v_wallhaven_preview_count');
            if (countBadge) countBadge.textContent = '...';
            await storage.setSettings(state.settings);
            await doFetchWallhaven(1);
            renderWallhavenPreviews(0);
        });
    }

    const drawerResSel = document.getElementById('i_drawer_resolution');
    if (drawerResSel) {
        drawerResSel.addEventListener('change', async (e) => {
            e.stopPropagation();
            state.settings.wallhavenResolution = e.target.value;
            const resInput = document.getElementById('i_wallhaven_resolution');
            if (resInput) resInput.value = e.target.value;
            resetWallhavenSession();
            state.currentWhOffset = 0;
            const grid = document.getElementById('wallhaven-preview-grid');
            if (grid) grid.innerHTML = '<div class="wh-preview-empty">Loading...</div>';
            const countBadge = document.getElementById('v_wallhaven_preview_count');
            if (countBadge) countBadge.textContent = '...';
            await storage.setSettings(state.settings);
            await doFetchWallhaven(1);
            renderWallhavenPreviews(0);
        });
    }

    const drawerQueryInput = document.getElementById('i_drawer_query');
    const btnDrawerQuerySubmit = document.getElementById('b_drawer_query_submit');
    const btnDrawerQueryClear = document.getElementById('b_drawer_query_clear');

    if (btnDrawerQuerySubmit) {
        btnDrawerQuerySubmit.addEventListener('click', (e) => {
            e.stopPropagation();
            submitDrawerQuery();
        });
    }
    if (drawerQueryInput) {
        drawerQueryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.isComposing || e.keyCode === 229) return;
                submitDrawerQuery();
            }
        });
        drawerQueryInput.addEventListener('input', () => {
            if (btnDrawerQueryClear) {
                btnDrawerQueryClear.classList.toggle('hidden', !drawerQueryInput.value);
            }
        });
    }
    if (btnDrawerQueryClear) {
        btnDrawerQueryClear.addEventListener('click', async (e) => {
            e.stopPropagation();
            drawerQueryInput.value = '';
            btnDrawerQueryClear.classList.add('hidden');
            state.settings.wallhavenMode = 'top';
            state.settings.wallhavenQuery = '';
            const inputWh = document.getElementById('i_wallhaven');
            if (inputWh) inputWh.value = '';
            const inputWhMode = document.getElementById('i_wallhaven_mode');
            if (inputWhMode) inputWhMode.value = 'top';
            resetWallhavenSession();
            state.currentWhOffset = 0;
            const grid = document.getElementById('wallhaven-preview-grid');
            if (grid) grid.innerHTML = '<div class="wh-preview-empty">Loading...</div>';
            const countBadge = document.getElementById('v_wallhaven_preview_count');
            if (countBadge) countBadge.textContent = '...';
            await storage.setSettings(state.settings);
            updateWallhavenCategoryChips();
            await doFetchWallhaven(1);
            renderWallhavenPreviews(0);
        });
    }

    const colorToggle = document.getElementById('wallhaven-color-toggle');
    const colorGrid = document.getElementById('wallhaven-color-grid');
    const colorArrow = document.getElementById('wallhaven-color-toggle-arrow');
    if (colorToggle && colorGrid) {
        colorToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCollapsed = colorGrid.classList.toggle('collapsed');
            if (colorArrow) colorArrow.classList.toggle('open', !isCollapsed);
            localStorage.setItem('nova_wh_color_collapsed', isCollapsed ? '1' : '0');
        });
        const savedCollapsed = localStorage.getItem('nova_wh_color_collapsed');
        if (savedCollapsed === '1') {
            colorGrid.classList.add('collapsed');
            if (colorArrow) colorArrow.classList.remove('open');
        } else {
            colorGrid.classList.remove('collapsed');
            if (colorArrow) colorArrow.classList.add('open');
        }
    }

    const posToggle = document.getElementById('drawer-local-pos-toggle');
    const posWrap = document.getElementById('drawer-local-pos-wrap');
    const posArrow = document.getElementById('drawer-local-pos-arrow');
    if (posToggle && posWrap) {
        posToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCollapsed = posWrap.classList.toggle('collapsed');
            if (posArrow) posArrow.classList.toggle('open', !isCollapsed);
            localStorage.setItem('nova_local_pos_collapsed', isCollapsed ? '1' : '0');
        });
        const savedCollapsed = localStorage.getItem('nova_local_pos_collapsed');
        if (savedCollapsed === '1') {
            posWrap.classList.add('collapsed');
            if (posArrow) posArrow.classList.remove('open');
        } else {
            posWrap.classList.remove('collapsed');
            if (posArrow) posArrow.classList.add('open');
        }
    }

    const drawerLocalPosInput = document.getElementById('i_drawer_local_pos');
    if (drawerLocalPosInput) {
        drawerLocalPosInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            const fillVal = ((val - e.target.min) / (e.target.max - e.target.min)) * 100;
            e.target.style.background = `linear-gradient(to right, var(--accent-blue) 0%, var(--accent-blue) ${fillVal}%, var(--border-color) ${fillVal}%, var(--border-color) 100%)`;
            const badge = document.getElementById('drawer-v-local-pos');
            if (badge) badge.textContent = `${val}%`;
            if (state.settings.bgType === 'local') {
                const activeEl = document.getElementById(`bg-${state.activeBg}`);
                if (activeEl) activeEl.style.backgroundPosition = `center ${val}%`;
            }
        });

        drawerLocalPosInput.addEventListener('change', async (e) => {
            const val = parseInt(e.target.value);
            const settings = state.settings;
            const gallery = await storage.getGallery();
            const currentImg = gallery.find(img => img.id === settings.selectedLocalBg);
            if (currentImg) {
                currentImg.positionY = val;
                await storage.setGallery(gallery);
                if (settings.bgType === 'local') preCalculateNextBackground();
            }
        });
    }

    const btnDrawerDownloadAll = document.getElementById('b_drawer_download_all_local');
    if (btnDrawerDownloadAll) {
        btnDrawerDownloadAll.addEventListener('click', async (e) => {
            e.stopPropagation();
            await downloadAllWallpapersZip(btnDrawerDownloadAll);
        });
    }
}

export default {
    initDrawer,
    toggleWhDrawer,
    hydrateDrawerHeader,
    updateActiveWallpaperCard,
    renderWallhavenPreviews,
    renderLocalPreviews
};
