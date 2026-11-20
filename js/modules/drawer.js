import state, { emit, on } from './state.js';
import { storage, idb, saveSnapshot } from './storage.js';
import { isSameWallpaper, getCurrentScreenWallpaperUrl, loadBackground, switchToNextWallpaper, switchToPrevWallpaper } from './background.js';
import { getWallhavenPool, saveWallhavenPool, fetchWallhavenApi, resetWallhavenSession, doFetchWallhaven, saveCurrentWallhaven } from './wallhaven.js';
import { renderGallery } from './gallery.js';

export function updatePrevButtonState() {
    const btnPrev = document.getElementById('b_drawer_prev_bg');
    if (!btnPrev) return;
    const isLocal = state.settings.bgType === 'local';
    let canGoPrev = false;
    if (isLocal) {
        const localTotal = parseInt(localStorage.getItem('nova_gallery_count') || '0');
        canGoPrev = localTotal > 1;
    } else {
        const pool = getWallhavenPool();
        canGoPrev = pool.length > 1;
    }
    btnPrev.disabled = !canGoPrev;
    btnPrev.style.opacity = canGoPrev ? '1' : '0.4';
    btnPrev.style.cursor = canGoPrev ? 'pointer' : 'not-allowed';
}

export function updatePreviewHighlight(activeTarget = null) {
    const isLocal = state.settings.bgType === 'local';
    const target = activeTarget || (isLocal ? state.settings.selectedLocalBg : (state.currentActiveWallhavenUrl || getCurrentScreenWallpaperUrl()));
    const grid = document.getElementById('wallhaven-preview-grid');
    if (!grid) return;
    const items = grid.querySelectorAll('.wh-preview-item');
    if (state.activeDrawerTab === 'local') {
        items.forEach(el => {
            el.classList.toggle('selected', isLocal && el.dataset.id === target);
        });
    } else {
        items.forEach(el => {
            el.classList.toggle('selected', !isLocal && isSameWallpaper(el.dataset.path, target));
        });
    }
}

export async function jumpToActiveWallpaper() {
    await syncPreviewWithActiveWallpaper(null, true);
}

export async function updateActiveWallpaperCard() {
    const activeCard = document.getElementById('drawer-active-card');
    if (!activeCard) return;

    const thumbEl = document.getElementById('active-card-thumb');
    const resEl = document.getElementById('active-card-res');
    const colorsEl = document.getElementById('active-card-colors');
    const viewBtn = document.getElementById('active-card-view-btn');
    const delBtn = document.getElementById('active-card-delete-btn');
    const titleEl = activeCard.querySelector('.active-card-title');
    const pulseBadge = activeCard.querySelector('.active-pulse-badge');

    activeCard.onclick = (e) => {
        if (e.target.closest('#active-card-view-btn') || e.target.closest('#active-card-delete-btn')) return;
        jumpToActiveWallpaper();
    };
    activeCard.style.cursor = 'pointer';
    activeCard.title = 'Jump to active wallpaper';

    const isLocal = state.settings.bgType === 'local';

    if (isLocal) {
        const gallery = await storage.getGallery();
        const current = gallery.find(img => img.id === state.settings.selectedLocalBg) || gallery[0];
        if (!current) {
            activeCard.classList.add('hidden');
            return;
        }
        activeCard.classList.remove('hidden');
        if (titleEl) titleEl.textContent = 'ON SCREEN (Local)';
        if (pulseBadge) pulseBadge.textContent = '● Active';
        if (thumbEl) thumbEl.style.backgroundImage = `url('${current.thumb || current.url}')`;
        if (resEl) resEl.textContent = (current.width && current.height) ? `${current.width}×${current.height}` : 'Local File';
        if (colorsEl) colorsEl.replaceChildren();
        if (viewBtn) {
            viewBtn.style.display = 'inline-flex';
            const span = viewBtn.querySelector('span');
            if (span) span.textContent = 'View';
            else viewBtn.textContent = 'View';
            viewBtn.href = '#';
            viewBtn.onclick = async (e) => {
                e.preventDefault();
                if (current.type === 'local') {
                    const blob = await idb.get(current.id);
                    if (blob) window.open(URL.createObjectURL(blob), '_blank');
                } else if (current.url) {
                    window.open(current.url, '_blank');
                }
            };
        }
        if (delBtn) {
            delBtn.classList.remove('hidden');
            delBtn.onclick = async (e) => {
                e.preventDefault();
                let g = await storage.getGallery();
                const imgToRemove = g.find(img => img.id === current.id);
                if (imgToRemove && imgToRemove.type === 'local') await idb.remove(imgToRemove.id);
                g = g.filter(img => img.id !== current.id);
                state.settings.selectedLocalBg = g.length > 0 ? g[0].id : '';
                await storage.setGallery(g);
                await storage.setSettings(state.settings);
                renderGallery();
                renderLocalPreviews();
                if (state.settings.bgType === 'local') loadBackground(false, false);
            };
        }
    } else {
        const currentUrl = state.currentActiveWallhavenUrl || getCurrentScreenWallpaperUrl();
        if (!currentUrl) {
            activeCard.classList.add('hidden');
            return;
        }
        activeCard.classList.remove('hidden');
        if (titleEl) titleEl.textContent = 'ON SCREEN (Wallhaven)';
        if (pulseBadge) pulseBadge.textContent = '● Active';

        const pool = getWallhavenPool();
        let meta = pool.find(item => isSameWallpaper(item.path, currentUrl));
        if (meta) {
            try {
                localStorage.setItem('nova_active_wh_meta', JSON.stringify({
                    path: meta.path,
                    thumb: meta.thumb,
                    resolution: meta.resolution,
                    colors: meta.colors
                }));
            } catch {}
        } else {
            try {
                const cachedMeta = localStorage.getItem('nova_active_wh_meta');
                if (cachedMeta) {
                    const parsed = JSON.parse(cachedMeta);
                    if (isSameWallpaper(parsed.path, currentUrl)) {
                        meta = parsed;
                    }
                }
            } catch {}
        }

        const thumbUrl = meta?.thumb || currentUrl;
        if (thumbEl) thumbEl.style.backgroundImage = `url('${thumbUrl}')`;
        if (resEl) resEl.textContent = meta?.resolution ? meta.resolution : 'Wallhaven HD';

        if (colorsEl) {
            const colors = meta?.colors || [];
            if (colors.length > 0) {
                const dots = colors.slice(0, 5).map(c => {
                    const dot = document.createElement('div');
                    dot.className = 'active-color-dot';
                    dot.style.backgroundColor = c.startsWith('#') ? c : '#' + c;
                    return dot;
                });
                colorsEl.replaceChildren(...dots);
            } else {
                colorsEl.replaceChildren();
            }
        }
        if (viewBtn) {
            viewBtn.style.display = 'inline-flex';
            const span = viewBtn.querySelector('span');
            if (span) span.textContent = 'Original';
            else viewBtn.textContent = 'Original';
            viewBtn.href = currentUrl;
            viewBtn.onclick = null;
        }
        if (delBtn) {
            delBtn.classList.add('hidden');
        }
    }
}

export async function syncLocalPreviewWithCurrentBackground() {
    await syncPreviewWithActiveWallpaper(null, true);
}

export async function renderLocalPreviews(explicitOffset = null) {
    const grid = document.getElementById('wallhaven-preview-grid');
    const countBadge = document.getElementById('v_wallhaven_preview_count');
    const launcherBadge = document.getElementById('v_wallhaven_preview_count_badge');
    const drawerMode = document.getElementById('v_wallhaven_drawer_mode');
    const btnPrev = document.getElementById('b_prev_wh_preview');
    const btnNext = document.getElementById('b_next_wh_preview');
    const tabWh = document.getElementById('b_drawer_tab_wallhaven');
    const tabLocal = document.getElementById('b_drawer_tab_local');
    const uploadCard = document.getElementById('drawer-local-upload-card');
    const btnDrawerSave = document.getElementById('b_drawer_save');
    const searchBar = document.getElementById('drawer-search-bar');
    const filterToggle = document.getElementById('b_drawer_filter_toggle');
    const quickFilters = document.getElementById('drawer-quick-filters');

    if (tabWh) tabWh.classList.remove('active');
    if (tabLocal) tabLocal.classList.add('active');
    if (drawerMode) drawerMode.textContent = 'Local Files';
    if (uploadCard) uploadCard.classList.remove('hidden');
    if (btnDrawerSave) btnDrawerSave.classList.add('hidden');
    if (searchBar) searchBar.classList.add('hidden');
    if (filterToggle) filterToggle.classList.add('hidden');
    if (quickFilters) quickFilters.classList.add('hidden');

    const gallery = await storage.getGallery();
    localStorage.setItem('nova_gallery_count', String(gallery.length));
    let offset = explicitOffset !== null 
        ? explicitOffset 
        : (state.currentLocalOffset !== null 
            ? state.currentLocalOffset 
            : parseInt(localStorage.getItem('nova_local_preview_offset') || '0'));
    if (isNaN(offset) || offset < 0) offset = 0;
    if (gallery.length > 0 && offset >= gallery.length) {
        offset = 0;
    }
    state.currentLocalOffset = offset;
    localStorage.setItem('nova_local_preview_offset', String(offset));

    const hasMultiplePages = gallery.length > 10;
    if (btnPrev) btnPrev.disabled = !hasMultiplePages;
    if (btnNext) btnNext.disabled = !hasMultiplePages;

    if (gallery.length === 0) {
        if (countBadge) countBadge.textContent = '0';
        if (launcherBadge) launcherBadge.textContent = '0';
        if (grid) grid.innerHTML = '<div class="wh-preview-empty">No local wallpapers yet</div>';
        updateActiveWallpaperCard();
        updatePrevButtonState();
        return;
    }

    const currentSlice = gallery.slice(offset, offset + 10);
    const fromNum = offset + 1;
    const toNum = offset + currentSlice.length;
    const countText = `${fromNum}-${toNum} / ${gallery.length}`;
    if (countBadge) countBadge.textContent = countText;
    if (launcherBadge) launcherBadge.textContent = countText;

    if (!grid) return;

    const activeId = state.settings.selectedLocalBg || (gallery.length > 0 ? gallery[0].id : '');

    try {
        const sliceData = {
            offset,
            total: gallery.length,
            activeId,
            items: currentSlice.map(img => ({
                id: img.id,
                thumb: img.thumb || img.url
            }))
        };
        localStorage.setItem('nova_local_slice_cache', JSON.stringify(sliceData));
    } catch {}

    const existingItems = grid.querySelectorAll('.wh-preview-item');
    const isSameSlice = existingItems.length === currentSlice.length &&
        Array.from(existingItems).every((el, i) => el.dataset.id === currentSlice[i].id);

    if (isSameSlice) {
        existingItems.forEach((item, sliceIdx) => {
            const img = currentSlice[sliceIdx];
            const isSelected = (state.settings.bgType === 'local' && img.id === activeId);
            item.classList.toggle('selected', isSelected);
            item.title = `Wallpaper #${offset + sliceIdx + 1}${isSelected ? '' : ' (Click to set)'}`;
        });
        updateActiveWallpaperCard();
        updatePrevButtonState();
        return;
    }

    const items = currentSlice.map((img, sliceIdx) => {
        const isSelected = (state.settings.bgType === 'local' && img.id === activeId);
        const item = document.createElement('div');
        item.className = 'wh-preview-item' + (isSelected ? ' selected' : '');
        item.dataset.id = img.id;
        item.style.backgroundImage = `url('${img.thumb || img.url}')`;
        item.title = `Wallpaper #${offset + sliceIdx + 1}${isSelected ? '' : ' (Click to set)'}`;
        item.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (state.settings.selectedLocalBg === img.id && state.settings.bgType === 'local') return;

            const prevId = state.settings.selectedLocalBg;
            if (!state.settings.localHistory) state.settings.localHistory = [];
            if (prevId && prevId !== img.id) {
                state.settings.localHistory.push(prevId);
                if (state.settings.localHistory.length > 50) state.settings.localHistory.shift();
            }

            state.settings.bgType = 'local';
            state.settings.selectedLocalBg = img.id;
            const bgTypeInput = document.getElementById('i_bg_type');
            if (bgTypeInput) bgTypeInput.value = 'local';
            const hubTitle = document.getElementById('v_hub_launcher_title');
            if (hubTitle) hubTitle.textContent = 'Browse Local Files';
            await storage.setSettings(state.settings);
            updatePreviewHighlight(img.id);
            updateActiveWallpaperCard();
            updatePrevButtonState();
            renderGallery();
            await loadBackground(false, false);
        });
        return item;
    });

    grid.replaceChildren(...items);

    updateActiveWallpaperCard();
    updatePrevButtonState();
}

export function hydrateDrawerHeader() {
    const countBadge = document.getElementById('v_wallhaven_preview_count');
    const launcherBadge = document.getElementById('v_wallhaven_preview_count_badge');
    const drawerMode = document.getElementById('v_wallhaven_drawer_mode');
    const pool = getWallhavenPool();
    const total = parseInt(localStorage.getItem('nova_wh_total') || '0');
    let offset = parseInt(localStorage.getItem('nova_wh_preview_offset') || '0');
    if (isNaN(offset) || offset < 0) offset = 0;
    const settings = state.settings;

    if (state.activeDrawerTab === 'local' || settings.bgType === 'local') {
        if (drawerMode) drawerMode.textContent = 'Local Files';
        const localTotal = parseInt(localStorage.getItem('nova_gallery_count') || '0');
        let localOffset = parseInt(localStorage.getItem('nova_local_preview_offset') || '0');
        if (localTotal > 0) {
            const fromNum = localOffset + 1;
            const toNum = Math.min(localOffset + 10, localTotal);
            const countText = `${fromNum}-${toNum} / ${localTotal}`;
            if (countBadge) countBadge.textContent = countText;
            if (launcherBadge) launcherBadge.textContent = countText;
        }
        return;
    }

    if (drawerMode) {
        const mode = settings.wallhavenMode || 'search';
        if (mode === 'top') {
            drawerMode.textContent = `Toplist (${settings.wallhavenTopRange || '1M'})`;
        } else if (mode === 'search') {
            drawerMode.textContent = settings.wallhavenQuery ? `Tag: ${settings.wallhavenQuery}` : 'Search';
        } else {
            drawerMode.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
        }
    }

    if (pool.length > 0) {
        const currentSlice = pool.slice(offset, offset + 10);
        const fromNum = offset + 1;
        const toNum = offset + currentSlice.length;
        const countText = total > 0 ? `${fromNum}-${toNum} / ${total}` : `${fromNum}-${toNum}`;
        if (countBadge) countBadge.textContent = countText;
        if (launcherBadge) launcherBadge.textContent = countText;
    } else if (total > 0) {
        const fromNum = offset + 1;
        const toNum = offset + 10;
        const countText = `${fromNum}-${toNum} / ${total}`;
        if (countBadge) countBadge.textContent = countText;
        if (launcherBadge) launcherBadge.textContent = countText;
    }
}

export async function syncPreviewWithActiveWallpaper(targetIdOrUrl = null, forceJump = false) {
    const isLocal = state.settings.bgType === 'local';
    state.activeDrawerTab = isLocal ? 'local' : 'wallhaven';

    updateActiveWallpaperCard();
    updatePrevButtonState();

    if (isLocal) {
        const gallery = await storage.getGallery();
        if (gallery.length === 0) {
            await renderLocalPreviews(0);
            return;
        }
        const activeId = targetIdOrUrl || state.settings.selectedLocalBg || gallery[0].id;
        let activeIdx = gallery.findIndex(img => img.id === activeId);
        if (activeIdx === -1) activeIdx = 0;

        const targetOffset = Math.floor(activeIdx / 10) * 10;
        const currentOffset = state.currentLocalOffset !== null 
            ? state.currentLocalOffset 
            : parseInt(localStorage.getItem('nova_local_preview_offset') || '0');

        if (forceJump || currentOffset !== targetOffset) {
            await renderLocalPreviews(targetOffset);
        } else {
            updatePreviewHighlight(activeId);
        }
    } else {
        let pool = getWallhavenPool();
        const currentUrl = targetIdOrUrl || state.currentActiveWallhavenUrl || getCurrentScreenWallpaperUrl();
        if (pool.length === 0) {
            await doFetchWallhaven(1);
            pool = getWallhavenPool();
        }
        if (pool.length === 0) {
            renderWallhavenPreviews(0);
            return;
        }

        let activeIdx = pool.findIndex(item => isSameWallpaper(item.path, currentUrl));
        let targetOffset;
        if (activeIdx !== -1) {
            targetOffset = Math.floor(activeIdx / 10) * 10;
        } else {
            targetOffset = state.currentWhOffset !== null ? state.currentWhOffset : 0;
            if (forceJump) targetOffset = 0;
        }

        const currentOffset = state.currentWhOffset !== null 
            ? state.currentWhOffset 
            : parseInt(localStorage.getItem('nova_wh_preview_offset') || '0');

        const grid = document.getElementById('wallhaven-preview-grid');
        const domCount = grid ? grid.querySelectorAll('.wh-preview-item').length : 0;
        const currentSliceLength = pool.slice(targetOffset, targetOffset + 10).length;
        const activeInDom = grid ? Array.from(grid.querySelectorAll('.wh-preview-item')).some(el => isSameWallpaper(el.dataset.path, currentUrl)) : false;

        if (forceJump || currentOffset !== targetOffset || domCount !== currentSliceLength || (activeIdx !== -1 && !activeInDom)) {
            renderWallhavenPreviews(targetOffset);
        } else {
            updatePreviewHighlight(activeIdx !== -1 ? currentUrl : null);
        }
    }
}

export function syncPreviewWithCurrentBackground(currentUrl = null, forceJump = false) {
    syncPreviewWithActiveWallpaper(currentUrl, forceJump);
}

export function renderWallhavenPreviews(explicitOffset = null) {
    const grid = document.getElementById('wallhaven-preview-grid');
    const countBadge = document.getElementById('v_wallhaven_preview_count');
    const launcherBadge = document.getElementById('v_wallhaven_preview_count_badge');
    const drawerMode = document.getElementById('v_wallhaven_drawer_mode');
    const btnPrev = document.getElementById('b_prev_wh_preview');
    const btnNext = document.getElementById('b_next_wh_preview');
    const tabWh = document.getElementById('b_drawer_tab_wallhaven');
    const tabLocal = document.getElementById('b_drawer_tab_local');
    const uploadCard = document.getElementById('drawer-local-upload-card');
    const btnDrawerSave = document.getElementById('b_drawer_save');
    const searchBar = document.getElementById('drawer-search-bar');
    const filterToggle = document.getElementById('b_drawer_filter_toggle');
    const drawerQueryInput = document.getElementById('i_drawer_query');
    const btnDrawerQueryClear = document.getElementById('b_drawer_query_clear');

    if (tabWh) tabWh.classList.add('active');
    if (tabLocal) tabLocal.classList.remove('active');
    if (uploadCard) uploadCard.classList.add('hidden');
    if (btnDrawerSave) {
        btnDrawerSave.classList.remove('hidden');
        btnDrawerSave.innerHTML = '★ Save';
    }
    if (searchBar) searchBar.classList.remove('hidden');
    if (filterToggle) filterToggle.classList.remove('hidden');
    if (drawerQueryInput && document.activeElement !== drawerQueryInput) {
        drawerQueryInput.value = state.settings.wallhavenQuery || '';
    }
    if (btnDrawerQueryClear) {
        btnDrawerQueryClear.classList.toggle('hidden', !state.settings.wallhavenQuery);
    }
    updateWallhavenCategoryChips();

    if (drawerMode) {
        const mode = state.settings.wallhavenMode || 'search';
        if (mode === 'top') {
            drawerMode.textContent = `Toplist (${state.settings.wallhavenTopRange || '1M'})`;
        } else if (mode === 'search') {
            drawerMode.textContent = state.settings.wallhavenQuery ? `Tag: ${state.settings.wallhavenQuery}` : 'Search';
        } else {
            drawerMode.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
        }
    }

    const pool = getWallhavenPool();
    let offset = explicitOffset !== null
        ? explicitOffset
        : (state.currentWhOffset !== null 
            ? state.currentWhOffset 
            : parseInt(localStorage.getItem('nova_wh_preview_offset') || '0'));
    if (isNaN(offset) || offset < 0) offset = 0;
    if (pool.length > 0 && offset >= pool.length) {
        offset = Math.floor((pool.length - 1) / 10) * 10;
    }
    state.currentWhOffset = offset;
    localStorage.setItem('nova_wh_preview_offset', String(offset));

    const total = parseInt(localStorage.getItem('nova_wh_total') || '0');

    if (offset + 10 > pool.length && (total === 0 || pool.length < total)) {
        fetchWallhavenBatch().then(() => {
            if (state.activeDrawerTab === 'wallhaven') {
                renderWallhavenPreviews(state.currentWhOffset);
            }
        });
    }

    if (pool.length === 0) {
        if (countBadge) countBadge.textContent = '0';
        if (launcherBadge) launcherBadge.textContent = '0';
        if (btnPrev) btnPrev.disabled = true;
        if (btnNext) btnNext.disabled = true;
        if (grid) grid.innerHTML = '<div class="wh-preview-empty">No previews available</div>';
        updateActiveWallpaperCard();
        updatePrevButtonState();
        return;
    }

    const hasMultiplePages = pool.length > 10 || total > 10;
    if (btnPrev) btnPrev.disabled = !hasMultiplePages;
    if (btnNext) btnNext.disabled = !hasMultiplePages;

    const currentSlice = pool.slice(offset, offset + 10);
    const fromNum = offset + 1;
    const toNum = offset + currentSlice.length;

    const countText = total > 0 ? `${fromNum}-${toNum} / ${total}` : `${fromNum}-${toNum}`;
    if (countBadge && countBadge.textContent !== countText) countBadge.textContent = countText;
    if (launcherBadge && launcherBadge.textContent !== countText) launcherBadge.textContent = countText;

    if (!grid) return;

    const currentActive = (state.settings.bgType === 'wallhaven') ? getCurrentScreenWallpaperUrl() : null;

    try {
        const sliceData = {
            offset,
            total,
            currentActive,
            items: currentSlice.map(img => ({
                id: img.id,
                path: img.path,
                thumb: img.thumb,
                resolution: img.resolution
            }))
        };
        localStorage.setItem('nova_wh_slice_cache', JSON.stringify(sliceData));
    } catch {}

    const existingItems = grid.querySelectorAll('.wh-preview-item');
    const isSameSlice = existingItems.length === currentSlice.length &&
        Array.from(existingItems).every((el, i) => el.dataset.path === currentSlice[i].path);

    if (isSameSlice) {
        existingItems.forEach((item, sliceIdx) => {
            const img = currentSlice[sliceIdx];
            const isSelected = isSameWallpaper(currentActive, img.path);
            item.classList.toggle('selected', isSelected);
            if (img.resolution) {
                item.title = `${img.resolution}${isSelected ? '' : ' (Click to set)'}`;
            }
        });
        updateActiveWallpaperCard();
        updatePrevButtonState();
        return;
    }

    const items = currentSlice.map(img => {
        const isSelected = isSameWallpaper(currentActive, img.path);
        const item = document.createElement('div');
        item.className = 'wh-preview-item' + (isSelected ? ' selected' : '');
        item.dataset.path = img.path;
        item.style.backgroundImage = `url('${img.thumb}')`;
        if (img.resolution) {
            item.title = `${img.resolution}${isSelected ? '' : ' (Click to set)'}`;
        }
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            selectWallhavenPreviewImage(img);
        });
        return item;
    });

    grid.replaceChildren(...items);

    updateActiveWallpaperCard();
    updatePrevButtonState();
}

export async function changeWallhavenPreviewOffset(delta) {
    if (state.isPagingPreview) return;
    state.isPagingPreview = true;

    try {
        let pool = getWallhavenPool();
        let currentOffset = state.currentWhOffset !== null 
            ? state.currentWhOffset 
            : parseInt(localStorage.getItem('nova_wh_preview_offset') || '0');
        if (isNaN(currentOffset) || currentOffset < 0) currentOffset = 0;

        const total = parseInt(localStorage.getItem('nova_wh_total') || '0');
        let targetOffset = currentOffset + delta;

        if (delta > 0) {
            if (targetOffset + 10 > pool.length && (total === 0 || pool.length < total)) {
                const btnNext = document.getElementById('b_next_wh_preview');
                if (btnNext) btnNext.style.opacity = '0.5';

                await doFetchWallhaven();
                pool = getWallhavenPool();

                if (btnNext) btnNext.style.opacity = '1';
            }

            if (targetOffset >= pool.length) {
                targetOffset = 0;
            }
        } else if (delta < 0) {
            if (targetOffset < 0) {
                targetOffset = Math.floor(Math.max(0, pool.length - 1) / 10) * 10;
            }
        }

        state.currentWhOffset = targetOffset;
        localStorage.setItem('nova_wh_preview_offset', String(targetOffset));
        renderWallhavenPreviews(targetOffset);
    } finally {
        state.isPagingPreview = false;
    }
}

export async function selectWallhavenPreviewImage(img) {
    if (!img || !img.path) return;

    const prevUrl = state.currentActiveWallhavenUrl || getCurrentScreenWallpaperUrl();
    if (!state.settings.wallhavenHistory) state.settings.wallhavenHistory = [];
    if (prevUrl && prevUrl !== img.path && (!state.settings.wallhavenHistory.length || state.settings.wallhavenHistory[state.settings.wallhavenHistory.length - 1] !== prevUrl)) {
        state.settings.wallhavenHistory.push(prevUrl);
        if (state.settings.wallhavenHistory.length > 50) state.settings.wallhavenHistory.shift();
    }

    state.currentActiveWallhavenUrl = img.path;
    localStorage.setItem('nova_active_wh_url', img.path);
    try {
        localStorage.setItem('nova_active_wh_meta', JSON.stringify({
            path: img.path,
            thumb: img.thumb,
            resolution: img.resolution,
            colors: img.colors
        }));
    } catch {}

    const pool = getWallhavenPool();
    const clickedIdx = pool.findIndex(p => isSameWallpaper(p.path, img.path));
    if (clickedIdx !== -1) {
        state.settings.wallhavenQueue = pool.slice(clickedIdx).map(p => p.path);
    } else {
        state.settings.wallhavenQueue = state.settings.wallhavenQueue.filter(u => !isSameWallpaper(u, img.path));
        state.settings.wallhavenQueue.unshift(img.path);
    }

    if (img.colors && img.colors.length > 0) {
        const colorMap = JSON.parse(localStorage.getItem('nova_wh_colors') || '{}');
        colorMap[img.path] = img.colors[0];
        localStorage.setItem('nova_wh_colors', JSON.stringify(colorMap));
    }

    state.settings.bgType = 'wallhaven';
    state.activeDrawerTab = 'wallhaven';
    const bgTypeInput = document.getElementById('i_bg_type');
    if (bgTypeInput) bgTypeInput.value = 'wallhaven';
    const hubTitle = document.getElementById('v_hub_launcher_title');
    if (hubTitle) hubTitle.textContent = 'Browse Wallhaven';

    await storage.setSettings(state.settings);
    updatePreviewHighlight(img.path);
    updateActiveWallpaperCard();
    updatePrevButtonState();
    await loadBackground(false, false);
}

export function updateWallhavenCategoryChips() {
    const chips = document.querySelectorAll('#drawer-category-chips .filter-chip');
    chips.forEach(c => {
        c.classList.toggle('active', c.dataset.mode === (state.settings.wallhavenMode || 'search'));
    });
    const rangeRow = document.getElementById('drawer-top-range-row');
    if (rangeRow) {
        rangeRow.classList.toggle('hidden', state.settings.wallhavenMode !== 'top');
    }
    const rangeChips = document.querySelectorAll('#drawer-top-range-row .filter-sub-chip');
    rangeChips.forEach(rc => {
        rc.classList.toggle('active', rc.dataset.range === (state.settings.wallhavenTopRange || '1M'));
    });
    const ratioSel = document.getElementById('i_drawer_ratio');
    if (ratioSel) ratioSel.value = state.settings.wallhavenRatio || '';
    const resSel = document.getElementById('i_drawer_resolution');
    if (resSel) resSel.value = state.settings.wallhavenResolution || '';
    emit('color:update');
}

export async function submitDrawerQuery() {
    const drawerQueryInput = document.getElementById('i_drawer_query');
    const btnDrawerQueryClear = document.getElementById('b_drawer_query_clear');
    if (!drawerQueryInput) return;
    const q = drawerQueryInput.value.trim();
    if (!q) return;
    state.settings.wallhavenMode = 'search';
    state.settings.wallhavenQuery = q;
    const inputWh = document.getElementById('i_wallhaven');
    if (inputWh) inputWh.value = q;
    const inputWhMode = document.getElementById('i_wallhaven_mode');
    if (inputWhMode) inputWhMode.value = 'search';
    if (btnDrawerQueryClear) btnDrawerQueryClear.classList.remove('hidden');
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
}

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
            const whOpts = document.getElementById('wallhaven-options');
            if (whOpts) whOpts.classList.remove('hidden');
            const localOpts = document.getElementById('local-options');
            if (localOpts) localOpts.classList.add('hidden');
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
            const whOpts = document.getElementById('wallhaven-options');
            if (whOpts) whOpts.classList.add('hidden');
            const localOpts = document.getElementById('local-options');
            if (localOpts) localOpts.classList.remove('hidden');
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
                renderLocalPreviews();
            }
        });
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
}
