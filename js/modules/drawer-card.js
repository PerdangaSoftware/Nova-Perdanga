import state from './state.js';
import { storage, idb } from './storage.js';
import { isSameWallpaper, getCurrentScreenWallpaperUrl, loadBackground } from './background.js';
import { getWallhavenPool } from './wallhaven.js';
import { renderGallery } from './gallery.js';
import { renderLocalPreviews } from './drawer-local.js';
import { syncPreviewWithActiveWallpaper, updateWallhavenTags } from './drawer-wallhaven.js';

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
        if (e.target.closest('#active-card-view-btn') || 
            e.target.closest('#active-card-delete-btn') ||
            e.target.closest('#b_drawer_wh_download') ||
            e.target.closest('#drawer-wh-details-card') ||
            e.target.closest('#drawer-local-pos-card')) return;
        jumpToActiveWallpaper();
    };
    activeCard.style.cursor = 'pointer';
    activeCard.title = 'Jump to active wallpaper';

    const isLocal = state.settings.bgType === 'local';

    if (isLocal) {
        const gallery = await storage.getGallery();
        const current = gallery.find(img => img.id === state.settings.selectedLocalBg) || gallery[0];
        const whDetailsCard = document.getElementById('drawer-wh-details-card');
        if (whDetailsCard) whDetailsCard.classList.add('hidden');
        const localPosCard = document.getElementById('drawer-local-pos-card');
        if (localPosCard) localPosCard.classList.remove('hidden');
        const btnWhDownload = document.getElementById('b_drawer_wh_download');
        if (btnWhDownload) btnWhDownload.classList.remove('hidden');
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
                const removeIdx = g.findIndex(img => img.id === current.id);
                if (removeIdx === -1) return;
                const imgToRemove = g[removeIdx];
                if (imgToRemove && imgToRemove.type === 'local') await idb.remove(imgToRemove.id);
                g.splice(removeIdx, 1);

                let curOffset = state.currentLocalOffset !== null 
                    ? state.currentLocalOffset 
                    : parseInt(localStorage.getItem('nova_local_preview_offset') || '0');
                if (isNaN(curOffset) || curOffset < 0) curOffset = 0;

                if (g.length === 0) {
                    state.settings.selectedLocalBg = '';
                    curOffset = 0;
                } else {
                    const newIdx = Math.min(removeIdx, g.length - 1);
                    state.settings.selectedLocalBg = g[newIdx].id;
                    if (curOffset >= g.length) {
                        curOffset = Math.max(0, Math.floor((g.length - 1) / 10) * 10);
                    }
                }

                state.currentLocalOffset = curOffset;
                localStorage.setItem('nova_local_preview_offset', String(curOffset));
                localStorage.setItem('nova_gallery_count', String(g.length));

                await storage.setGallery(g);
                await storage.setSettings(state.settings);
                renderGallery();
                await renderLocalPreviews(curOffset);
                if (state.settings.bgType === 'local') await loadBackground(false, false);
            };
        }
        const posInput = document.getElementById('i_drawer_local_pos');
        const posBadge = document.getElementById('drawer-v-local-pos');
        const curPos = current.positionY !== undefined ? current.positionY : 50;
        if (posInput) {
            posInput.value = curPos;
            const fillVal = ((posInput.value - posInput.min) / (posInput.max - posInput.min)) * 100;
            posInput.style.background = `linear-gradient(to right, var(--accent-blue) 0%, var(--accent-blue) ${fillVal}%, var(--border-color) ${fillVal}%, var(--border-color) 100%)`;
        }
        if (posBadge) posBadge.textContent = `${curPos}%`;
    } else {
        const localPosCard = document.getElementById('drawer-local-pos-card');
        if (localPosCard) localPosCard.classList.add('hidden');
        const currentUrl = state.currentActiveWallhavenUrl || getCurrentScreenWallpaperUrl();
        const whDetailsCard = document.getElementById('drawer-wh-details-card');
        if (!currentUrl) {
            activeCard.classList.add('hidden');
            if (whDetailsCard) whDetailsCard.classList.add('hidden');
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
        const btnWhDownload = document.getElementById('b_drawer_wh_download');
        if (btnWhDownload) btnWhDownload.classList.remove('hidden');
        if (whDetailsCard) whDetailsCard.classList.remove('hidden');
        updateWallhavenTags(currentUrl);
    }
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

export async function downloadCurrentWallhaven() {
    const isLocal = state.settings.bgType === 'local';
    const btn = document.getElementById('b_drawer_wh_download');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '<svg class="nova-spin" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><span>Saving...</span>';
        btn.style.pointerEvents = 'none';
    }

    try {
        let blob = null;
        let filename = `Nova_Wallpaper_${Date.now()}.jpg`;

        if (isLocal) {
            const gallery = await storage.getGallery();
            const current = gallery.find(img => img.id === state.settings.selectedLocalBg) || gallery[0];
            if (!current) throw new Error('No local wallpaper');

            if (current.type === 'local') {
                blob = await idb.get(current.id);
            } else if (current.url) {
                const res = await fetch(current.url);
                if (res.ok) blob = await res.blob();
                const parts = current.url.split('/');
                filename = parts[parts.length - 1] || filename;
            }
        } else {
            const currentUrl = state.currentActiveWallhavenUrl || getCurrentScreenWallpaperUrl();
            if (!currentUrl) throw new Error('No url');
            const res = await fetch(currentUrl);
            if (!res.ok) throw new Error('Fetch failed');
            blob = await res.blob();
            const match = currentUrl.match(/wallhaven-([a-zA-Z0-9]+)\.(jpg|png|jpeg|webp)/i);
            if (match) {
                filename = `wallhaven-${match[1]}.${match[2]}`;
            } else {
                const parts = currentUrl.split('/');
                filename = parts[parts.length - 1] || filename;
            }
        }

        if (!blob) throw new Error('No blob');

        let ext = '.jpg';
        if (blob.type === 'image/png') ext = '.png';
        else if (blob.type === 'image/webp') ext = '.webp';
        else if (blob.type === 'image/gif') ext = '.gif';
        else if (blob.type === 'image/jpeg') ext = '.jpg';
        if (!filename.includes('.')) filename += ext;

        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);

        if (btn) {
            btn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#2dd4bf" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span style="color:#2dd4bf">Saved</span>';
            setTimeout(() => {
                btn.innerHTML = origHtml;
                btn.style.pointerEvents = '';
            }, 1800);
        }
    } catch (err) {
        if (btn) {
            btn.innerHTML = origHtml;
            btn.style.pointerEvents = '';
        }
    }
}

