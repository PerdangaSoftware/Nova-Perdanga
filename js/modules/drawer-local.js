import state from './state.js';
import { storage } from './storage.js';
import { loadBackground } from './background.js';
import { renderGallery } from './gallery.js';
import { updatePrevButtonState, updatePreviewHighlight, updateActiveWallpaperCard } from './drawer-card.js';
import { syncPreviewWithActiveWallpaper } from './drawer-wallhaven.js';

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

    const sh = document.getElementById('startup-hide-css');
    if (sh) sh.remove();
    document.documentElement.classList.remove('init-bg-local');

    if (tabWh) tabWh.classList.remove('active');
    if (tabLocal) tabLocal.classList.add('active');
    if (drawerMode) drawerMode.textContent = 'Local Files';
    if (uploadCard) uploadCard.classList.remove('hidden');
    const localActions = document.getElementById('drawer-local-actions');
    if (localActions) localActions.classList.remove('hidden');
    const whDetailsCard = document.getElementById('drawer-wh-details-card');
    if (whDetailsCard) whDetailsCard.classList.add('hidden');
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
        offset = Math.max(0, Math.floor((gallery.length - 1) / 10) * 10);
    }
    state.currentLocalOffset = offset;
    localStorage.setItem('nova_local_preview_offset', String(offset));

    const hasMultiplePages = gallery.length > 10;
    if (btnPrev) btnPrev.disabled = !hasMultiplePages;
    if (btnNext) btnNext.disabled = !hasMultiplePages;
    const btnZip = document.getElementById('b_drawer_download_all_local');
    if (btnZip) btnZip.disabled = gallery.length === 0;

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

