import state, { emit, on } from './state.js';
import { storage, idb } from './storage.js';
import { isSameWallpaper, getCurrentScreenWallpaperUrl, loadBackground } from './background.js';
import { getWallhavenPool, saveWallhavenPool, fetchWallhavenApi, resetWallhavenSession, doFetchWallhaven, saveCurrentWallhaven } from './wallhaven.js';
import { renderGallery } from './gallery.js';

export async function updateActiveWallpaperCard(mode) {
    const activeCard = document.getElementById('drawer-active-card');
    if (!activeCard) return;

    const thumbEl = document.getElementById('active-card-thumb');
    const resEl = document.getElementById('active-card-res');
    const colorsEl = document.getElementById('active-card-colors');
    const viewBtn = document.getElementById('active-card-view-btn');
    const delBtn = document.getElementById('active-card-delete-btn');

    if (mode === 'local') {
        const gallery = await storage.getGallery();
        const current = gallery.find(img => img.id === state.settings.selectedLocalBg) || gallery[0];
        if (!current) {
            activeCard.classList.add('hidden');
            return;
        }
        activeCard.classList.remove('hidden');
        if (thumbEl) thumbEl.style.backgroundImage = `url('${current.thumb || current.url}')`;
        if (resEl) resEl.textContent = (current.width && current.height) ? `${current.width}×${current.height}` : 'Local File';
        if (colorsEl) colorsEl.innerHTML = '';
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
        const currentUrl = getCurrentScreenWallpaperUrl();
        if (!currentUrl) {
            activeCard.classList.add('hidden');
            return;
        }
        activeCard.classList.remove('hidden');
        const pool = getWallhavenPool();
        const poolItem = pool.find(item => isSameWallpaper(item.path, currentUrl));
        const thumbUrl = poolItem?.thumb || currentUrl;

        if (thumbEl) thumbEl.style.backgroundImage = `url('${thumbUrl}')`;
        if (resEl) resEl.textContent = poolItem?.resolution ? poolItem.resolution : 'Wallhaven HD';
        if (colorsEl) {
            colorsEl.innerHTML = '';
            const colors = poolItem?.colors || [];
            if (colors.length > 0) {
                colors.slice(0, 5).forEach(c => {
                    const dot = document.createElement('div');
                    dot.className = 'active-color-dot';
                    dot.style.backgroundColor = c.startsWith('#') ? c : '#' + c;
                    colorsEl.appendChild(dot);
                });
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
    const gallery = await storage.getGallery();
    if (gallery.length === 0) {
        renderLocalPreviews();
        return;
    }
    const activeId = state.settings.selectedLocalBg || gallery[0].id;
    const activeIdx = gallery.findIndex(img => img.id === activeId);
    if (activeIdx !== -1) {
        const targetOffset = Math.floor(activeIdx / 10) * 10;
        localStorage.setItem('nova_local_preview_offset', String(targetOffset));
    }
    renderLocalPreviews();
}

export async function renderLocalPreviews() {
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
    if (btnDrawerSave) btnDrawerSave.innerHTML = '+ Upload';
    if (searchBar) searchBar.classList.add('hidden');
    if (filterToggle) filterToggle.classList.add('hidden');
    if (quickFilters) quickFilters.classList.add('hidden');

    const gallery = await storage.getGallery();
    let offset = parseInt(localStorage.getItem('nova_local_preview_offset') || '0');
    if (isNaN(offset) || offset < 0) offset = 0;
    if (gallery.length > 0 && offset >= gallery.length) {
        offset = Math.floor((gallery.length - 1) / 10) * 10;
        localStorage.setItem('nova_local_preview_offset', String(offset));
    }

    if (btnPrev) btnPrev.disabled = (offset === 0);
    if (btnNext) btnNext.disabled = (offset + 10 >= gallery.length);

    if (gallery.length === 0) {
        if (countBadge) countBadge.textContent = '0';
        if (launcherBadge) launcherBadge.textContent = '0';
        if (grid) grid.innerHTML = '<div class="wh-preview-empty">No local wallpapers yet</div>';
        updateActiveWallpaperCard('local');
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
        updateActiveWallpaperCard('local');
        return;
    }

    grid.innerHTML = '';

    currentSlice.forEach((img, sliceIdx) => {
        const isSelected = (state.settings.bgType === 'local' && img.id === activeId);
        const item = document.createElement('div');
        item.className = 'wh-preview-item' + (isSelected ? ' selected' : '');
        item.dataset.id = img.id;
        item.style.backgroundImage = `url('${img.thumb || img.url}')`;
        item.title = `Wallpaper #${offset + sliceIdx + 1}${isSelected ? '' : ' (Click to set)'}`;
        item.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (state.settings.selectedLocalBg === img.id && state.settings.bgType === 'local') return;
            state.settings.bgType = 'local';
            state.settings.selectedLocalBg = img.id;
            const bgTypeInput = document.getElementById('i_bg_type');
            if (bgTypeInput) bgTypeInput.value = 'local';
            const hubTitle = document.getElementById('v_hub_launcher_title');
            if (hubTitle) hubTitle.textContent = 'Browse Local Files';
            await storage.setSettings(state.settings);
            grid.querySelectorAll('.wh-preview-item').forEach(el => {
                el.classList.toggle('selected', el.dataset.id === img.id);
            });
            updateActiveWallpaperCard('local');
            renderGallery();
            await loadBackground(false, false);
        });
        grid.appendChild(item);
    });

    updateActiveWallpaperCard('local');
}

export function syncPreviewWithCurrentBackground(currentUrl = null) {
    if (state.activeDrawerTab === 'local') {
        syncLocalPreviewWithCurrentBackground();
        return;
    }
    const targetUrl = currentUrl || getCurrentScreenWallpaperUrl();
    if (targetUrl) {
        state.currentActiveWallhavenUrl = targetUrl;
        localStorage.setItem('nova_active_wh_url', targetUrl);
    }
    const pool = getWallhavenPool();
    if (pool.length === 0) {
        renderWallhavenPreviews();
        return;
    }

    if (targetUrl) {
        const activeIdx = pool.findIndex(item => isSameWallpaper(item.path, targetUrl));
        if (activeIdx !== -1) {
            const targetOffset = Math.floor(activeIdx / 10) * 10;
            localStorage.setItem('nova_wh_preview_offset', String(targetOffset));
        }
    }
    renderWallhavenPreviews();
}

export function renderWallhavenPreviews() {
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
    if (btnDrawerSave) btnDrawerSave.innerHTML = '★ Save';
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
    let offset = parseInt(localStorage.getItem('nova_wh_preview_offset') || '0');
    if (isNaN(offset) || offset < 0) offset = 0;
    if (pool.length > 0 && offset >= pool.length) {
        offset = Math.floor((pool.length - 1) / 10) * 10;
        localStorage.setItem('nova_wh_preview_offset', String(offset));
    }

    const total = parseInt(localStorage.getItem('nova_wh_total') || '0');

    if (btnPrev) {
        btnPrev.disabled = (offset === 0);
    }

    if (pool.length === 0) {
        if (countBadge) countBadge.textContent = '0';
        if (launcherBadge) launcherBadge.textContent = '0';
        if (btnNext) btnNext.disabled = true;
        if (grid) grid.innerHTML = '<div class="wh-preview-empty">No previews available</div>';
        updateActiveWallpaperCard('wallhaven');
        return;
    }

    const currentSlice = pool.slice(offset, offset + 10);
    const fromNum = offset + 1;
    const toNum = offset + currentSlice.length;

    const countText = total > 0 ? `${fromNum}-${toNum} / ${total}` : `${fromNum}-${toNum}`;
    if (countBadge) countBadge.textContent = countText;
    if (launcherBadge) launcherBadge.textContent = countText;

    if (btnNext) {
        if (total > 0 && offset + 10 >= total) {
            btnNext.disabled = true;
        } else {
            btnNext.disabled = false;
        }
    }

    if (!grid) return;

    const currentActive = (state.settings.bgType === 'wallhaven') ? getCurrentScreenWallpaperUrl() : null;

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
        updateActiveWallpaperCard('wallhaven');
        return;
    }

    grid.innerHTML = '';

    currentSlice.forEach(img => {
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
        grid.appendChild(item);
    });

    updateActiveWallpaperCard('wallhaven');
}

export async function changeWallhavenPreviewOffset(delta) {
    if (state.isPagingPreview) return;
    state.isPagingPreview = true;

    try {
        let pool = getWallhavenPool();
        const currentOffset = parseInt(localStorage.getItem('nova_wh_preview_offset') || '0');
        const targetOffset = Math.max(0, currentOffset + delta);

        if (targetOffset === currentOffset && delta <= 0) {
            return;
        }

        if (delta > 0) {
            if (targetOffset + 10 > pool.length) {
                const btnNext = document.getElementById('b_next_wh_preview');
                if (btnNext) btnNext.style.opacity = '0.5';

                const curPage = parseInt(localStorage.getItem('nova_wh_api_page') || '1');
                const nextPage = curPage + 1;
                const fetched = await fetchWallhavenApi(nextPage);

                if (btnNext) btnNext.style.opacity = '1';

                if (fetched && fetched.length > 0) {
                    localStorage.setItem('nova_wh_api_page', String(nextPage));
                    const existingPaths = new Set(pool.map(p => p.path));
                    const newItems = fetched
                        .filter(img => !existingPaths.has(img.path))
                        .map(img => ({
                            path: img.path,
                            thumb: img.thumbs?.small || img.thumbs?.original || img.path,
                            resolution: img.resolution || '',
                            colors: img.colors || []
                        }));

                    if (newItems.length > 0) {
                        pool.push(...newItems);
                        saveWallhavenPool(pool);

                        const colorMap = JSON.parse(localStorage.getItem('nova_wh_colors') || '{}');
                        newItems.forEach(img => {
                            if (img.colors && img.colors.length > 0) {
                                colorMap[img.path] = img.colors[0];
                            }
                        });
                        localStorage.setItem('nova_wh_colors', JSON.stringify(colorMap));

                        const newPaths = newItems.map(i => i.path).filter(p => !state.settings.wallhavenQueue.includes(p) && !state.settings.wallhavenHistory.includes(p));
                        state.settings.wallhavenQueue.push(...newPaths);
                        if (state.settings.wallhavenQueue.length > 50) {
                            state.settings.wallhavenQueue = state.settings.wallhavenQueue.slice(0, 50);
                        }
                        await storage.setSettings(state.settings);
                    }
                }
            }

            if (targetOffset >= pool.length) {
                return;
            }
        }

        localStorage.setItem('nova_wh_preview_offset', String(targetOffset));
        renderWallhavenPreviews();
    } finally {
        state.isPagingPreview = false;
    }
}

export async function selectWallhavenPreviewImage(img) {
    if (!img || !img.path) return;
    state.currentActiveWallhavenUrl = img.path;
    localStorage.setItem('nova_active_wh_url', img.path);

    const pool = getWallhavenPool();
    const clickedIdx = pool.findIndex(p => isSameWallpaper(p.path, img.path));
    if (clickedIdx !== -1) {
        const historyToAdd = pool.slice(0, clickedIdx).map(p => p.path).filter(p => !state.settings.wallhavenHistory.includes(p));
        state.settings.wallhavenHistory.push(...historyToAdd);
        if (state.settings.wallhavenHistory.length > 30) {
            state.settings.wallhavenHistory = state.settings.wallhavenHistory.slice(-30);
        }
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

    syncPreviewWithCurrentBackground(img.path);
    await storage.setSettings(state.settings);
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
    await storage.setSettings(state.settings);
    updateWallhavenCategoryChips();
    await doFetchWallhaven(1);
}

export function toggleWhDrawer(forceState) {
    const domWhDrawer = document.getElementById('wallhaven-preview-drawer');
    const domWhDrawerQuickBtn = document.getElementById('wh-drawer-quick-btn');
    if (!domWhDrawer) return;
    const stateVal = forceState !== undefined ? forceState : !domWhDrawer.classList.contains('shown');
    domWhDrawer.classList.toggle('shown', stateVal);
    if (domWhDrawerQuickBtn) domWhDrawerQuickBtn.classList.toggle('active', stateVal);
    document.body.classList.toggle('drawer-open', stateVal);
    localStorage.setItem('nova_drawer_open', stateVal ? '1' : '0');
    if (stateVal) {
        state.activeDrawerTab = state.settings.bgType === 'local' ? 'local' : 'wallhaven';
        if (state.activeDrawerTab === 'local') {
            syncLocalPreviewWithCurrentBackground();
        } else {
            syncPreviewWithCurrentBackground();
        }
    }
}

export function initDrawer() {
    on('preview:sync', (detail) => {
        if (state.activeDrawerTab === 'local' || state.settings.bgType === 'local') {
            syncLocalPreviewWithCurrentBackground();
        } else {
            syncPreviewWithCurrentBackground(detail?.currentUrl);
        }
    });

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
            await storage.setSettings(state.settings);
            emit('settings:dom_sync');
            syncPreviewWithCurrentBackground();
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
            await storage.setSettings(state.settings);
            emit('settings:dom_sync');
            syncLocalPreviewWithCurrentBackground();
            await loadBackground(false, false);
        });
    }

    const btnDrawerJumpActive = document.getElementById('b_drawer_jump_active');
    if (btnDrawerJumpActive) {
        btnDrawerJumpActive.addEventListener('click', (e) => {
            e.stopPropagation();
            state.activeDrawerTab = state.settings.bgType || 'wallhaven';
            if (state.activeDrawerTab === 'local') {
                syncLocalPreviewWithCurrentBackground();
            } else {
                syncPreviewWithCurrentBackground();
            }
            const grid = document.getElementById('wallhaven-preview-grid');
            if (grid) {
                const activeEl = grid.querySelector('.wh-preview-item.selected');
                if (activeEl) {
                    activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });
    }

    const btnRefreshWhDrawer = document.getElementById('b_refresh_wh_drawer');
    if (btnRefreshWhDrawer) {
        btnRefreshWhDrawer.addEventListener('click', async (e) => {
            e.stopPropagation();
            btnRefreshWhDrawer.classList.add('spinning');
            try {
                if (state.activeDrawerTab === 'local') {
                    renderLocalPreviews();
                } else {
                    await doFetchWallhaven(1);
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
        btnPrevWhPreview.addEventListener('click', (e) => {
            e.stopPropagation();
            if (state.activeDrawerTab === 'local') {
                const currentOffset = parseInt(localStorage.getItem('nova_local_preview_offset') || '0');
                const targetOffset = Math.max(0, currentOffset - 10);
                localStorage.setItem('nova_local_preview_offset', String(targetOffset));
                renderLocalPreviews();
            } else {
                changeWallhavenPreviewOffset(-10);
            }
        });
    }
    if (btnNextWhPreview) {
        btnNextWhPreview.addEventListener('click', (e) => {
            e.stopPropagation();
            if (state.activeDrawerTab === 'local') {
                const currentOffset = parseInt(localStorage.getItem('nova_local_preview_offset') || '0');
                const targetOffset = currentOffset + 10;
                localStorage.setItem('nova_local_preview_offset', String(targetOffset));
                renderLocalPreviews();
            } else {
                changeWallhavenPreviewOffset(10);
            }
        });
    }

    const btnDrawerPrevBg = document.getElementById('b_drawer_prev_bg');
    if (btnDrawerPrevBg) {
        btnDrawerPrevBg.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (state.activeDrawerTab === 'local' || state.settings.bgType === 'local') {
                const gallery = await storage.getGallery();
                if (gallery.length > 1) {
                    let idx = gallery.findIndex(img => img.id === state.settings.selectedLocalBg);
                    idx = (idx - 1 + gallery.length) % gallery.length;
                    state.settings.selectedLocalBg = gallery[idx].id;
                    await storage.setSettings(state.settings);
                    await loadBackground(false, false);
                }
            } else {
                if (state.settings.wallhavenHistory.length > 0) {
                    const prevUrl = state.settings.wallhavenHistory.pop();
                    state.settings.wallhavenQueue.unshift(prevUrl);
                    state.currentActiveWallhavenUrl = prevUrl;
                    localStorage.setItem('nova_active_wh_url', prevUrl);
                    syncPreviewWithCurrentBackground(prevUrl);
                    await storage.setSettings(state.settings);
                    await loadBackground(false, false);
                }
            }
        });
    }

    const btnDrawerNextBg = document.getElementById('b_drawer_next_bg');
    if (btnDrawerNextBg) {
        btnDrawerNextBg.addEventListener('click', async (e) => {
            e.stopPropagation();
            await loadBackground(true, false);
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
            await storage.setSettings(state.settings);
            updateWallhavenCategoryChips();
            await doFetchWallhaven(1);
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
            await storage.setSettings(state.settings);
            updateWallhavenCategoryChips();
            await doFetchWallhaven(1);
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
            await storage.setSettings(state.settings);
            await doFetchWallhaven(1);
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
            await storage.setSettings(state.settings);
            await doFetchWallhaven(1);
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
            await storage.setSettings(state.settings);
            updateWallhavenCategoryChips();
            await doFetchWallhaven(1);
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
