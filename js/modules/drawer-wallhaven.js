import state, { emit } from './state.js';
import { storage } from './storage.js';
import { isSameWallpaper, getCurrentScreenWallpaperUrl, loadBackground } from './background.js';
import { getWallhavenPool, fetchWallhavenBatch, resetWallhavenSession, doFetchWallhaven } from './wallhaven.js';
import { updatePrevButtonState, updatePreviewHighlight, updateActiveWallpaperCard } from './drawer-card.js';
import { renderLocalPreviews } from './drawer-local.js';

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

        const grid = document.getElementById('wallhaven-preview-grid');
        const hasWhItems = grid ? Array.from(grid.querySelectorAll('.wh-preview-item')).some(el => el.dataset.path) : false;
        if (forceJump || currentOffset !== targetOffset || hasWhItems) {
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
        const hasLocalItems = grid ? Array.from(grid.querySelectorAll('.wh-preview-item')).some(el => el.dataset.id) : false;

        if (forceJump || currentOffset !== targetOffset || domCount !== currentSliceLength || hasLocalItems || (activeIdx !== -1 && !activeInDom)) {
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

    const sh = document.getElementById('startup-hide-css');
    if (sh) sh.remove();
    document.documentElement.classList.remove('init-bg-local');

    if (tabWh) tabWh.classList.add('active');
    if (tabLocal) tabLocal.classList.remove('active');
    if (uploadCard) uploadCard.classList.add('hidden');
    const localActions = document.getElementById('drawer-local-actions');
    if (localActions) localActions.classList.add('hidden');
    const localPosCard = document.getElementById('drawer-local-pos-card');
    if (localPosCard) localPosCard.classList.add('hidden');
    const whDetailsCard = document.getElementById('drawer-wh-details-card');
    if (whDetailsCard) whDetailsCard.classList.remove('hidden');
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

export async function searchWallhavenTag(tagName) {
    if (!tagName) return;
    const drawerQueryInput = document.getElementById('i_drawer_query');
    if (drawerQueryInput) {
        drawerQueryInput.value = tagName;
    }
    await submitDrawerQuery();
}

const whTagsCache = new Map();
try {
    const stored = localStorage.getItem('nova_wh_tags_cache');
    if (stored) {
        const parsed = JSON.parse(stored);
        for (const [k, v] of Object.entries(parsed)) {
            whTagsCache.set(k, v);
        }
    }
} catch {}

function saveWhTagsCache() {
    try {
        const obj = {};
        const entries = Array.from(whTagsCache.entries());
        const recent = entries.slice(-350);
        for (const [k, v] of recent) {
            obj[k] = v;
        }
        localStorage.setItem('nova_wh_tags_cache', JSON.stringify(obj));
    } catch {}
}

let currentWhTagsSeq = 0;
let tagsDebounceTimer = null;
let tagsAbortController = null;

export async function updateWallhavenTags(wallpaperUrl, isImmediate = false) {
    const card = document.getElementById('drawer-wh-details-card');
    const tagsWrap = document.getElementById('drawer-wh-tags');
    const countBadge = document.getElementById('drawer-wh-tags-count');
    if (!card || !tagsWrap) return;

    if (state.activeDrawerTab === 'local' || state.settings.bgType === 'local') {
        card.classList.add('hidden');
        return;
    }
    card.classList.remove('hidden');

    if (!wallpaperUrl) {
        tagsWrap.classList.remove('loading-fade');
        tagsWrap.innerHTML = '<div class="wh-tag-empty">No tags available</div>';
        if (countBadge) countBadge.textContent = '0';
        return;
    }

    const pool = getWallhavenPool();
    const meta = pool.find(item => isSameWallpaper(item.path, wallpaperUrl));
    const idMatch = wallpaperUrl.match(/wallhaven-([a-zA-Z0-9]+)\./i) || wallpaperUrl.match(/\/([a-zA-Z0-9]+)\.(jpg|png|jpeg|webp)/i);
    const id = meta?.id || (idMatch ? idMatch[1] : null);

    if (!id) {
        tagsWrap.classList.remove('loading-fade');
        tagsWrap.innerHTML = '<div class="wh-tag-empty">No tags available</div>';
        if (countBadge) countBadge.textContent = '0';
        return;
    }

    if (whTagsCache.has(id)) {
        if (tagsDebounceTimer) {
            clearTimeout(tagsDebounceTimer);
            tagsDebounceTimer = null;
        }
        if (tagsAbortController) {
            tagsAbortController.abort();
            tagsAbortController = null;
        }
        tagsWrap.classList.remove('loading-fade');
        renderWhTags(whTagsCache.get(id), tagsWrap);
        return;
    }

    if (tagsWrap.children.length === 0 || tagsWrap.querySelector('.wh-tag-empty')) {
        tagsWrap.innerHTML = '<div class="wh-tag-loading"><svg class="nova-spin" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><span>Loading tags...</span></div>';
    } else {
        tagsWrap.classList.add('loading-fade');
    }

    if (countBadge) countBadge.textContent = '...';

    if (tagsDebounceTimer) {
        clearTimeout(tagsDebounceTimer);
        tagsDebounceTimer = null;
    }
    if (tagsAbortController) {
        tagsAbortController.abort();
        tagsAbortController = null;
    }

    const thisSeq = ++currentWhTagsSeq;

    const executeFetch = async (retryCount = 0) => {
        if (thisSeq !== currentWhTagsSeq) return;
        tagsAbortController = new AbortController();

        try {
            const res = await fetch(`https://wallhaven.cc/api/v1/w/${id}`, {
                signal: tagsAbortController.signal
            });

            if (res.status === 429 && retryCount < 2) {
                await new Promise(r => setTimeout(r, 1600 * (retryCount + 1)));
                if (thisSeq !== currentWhTagsSeq) return;
                return await executeFetch(retryCount + 1);
            }

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (thisSeq !== currentWhTagsSeq) return;

            const tags = (data && data.data && Array.isArray(data.data.tags)) ? data.data.tags : [];
            whTagsCache.set(id, tags);
            saveWhTagsCache();

            const currentActive = state.currentActiveWallhavenUrl || getCurrentScreenWallpaperUrl();
            if (isSameWallpaper(currentActive, wallpaperUrl)) {
                tagsWrap.classList.remove('loading-fade');
                renderWhTags(tags, tagsWrap);
            }
        } catch (e) {
            if (e.name === 'AbortError') return;
            if (thisSeq === currentWhTagsSeq) {
                tagsWrap.classList.remove('loading-fade');
                tagsWrap.innerHTML = '<button type="button" class="wh-tag-empty wh-tag-retry-btn" title="Click to retry loading tags">Tags unavailable (Click to retry)</button>';
                const retryBtn = tagsWrap.querySelector('.wh-tag-retry-btn');
                if (retryBtn) {
                    retryBtn.onclick = (ev) => {
                        ev.stopPropagation();
                        updateWallhavenTags(wallpaperUrl, true);
                    };
                }
                if (countBadge) countBadge.textContent = '0';
            }
        }
    };

    if (isImmediate) {
        await executeFetch();
    } else {
        tagsDebounceTimer = setTimeout(executeFetch, 280);
    }
}

function renderWhTags(tags, container) {
    if (!container) return;
    const countBadge = document.getElementById('drawer-wh-tags-count');
    if (!tags || tags.length === 0) {
        container.innerHTML = '<div class="wh-tag-empty">No tags for this wallpaper</div>';
        if (countBadge) countBadge.textContent = '0';
        return;
    }
    if (countBadge) countBadge.textContent = `${tags.length}`;
    container.replaceChildren();
    tags.slice(0, 10).forEach(t => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wh-tag-pill';
        btn.textContent = '#' + t.name;
        btn.title = `Search "${t.name}"`;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            searchWallhavenTag(t.name);
        });
        container.appendChild(btn);
    });
}

