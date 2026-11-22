import state, { emit } from './state.js';
import { storage, idb } from './storage.js';
import { extractAverageColor } from './utils.js';
import BackgroundPreloader from './preloader.js';
import { fetchWallhavenBatch, getWallhavenPool, doFetchWallhaven } from './wallhaven.js';

export function isSameWallpaper(url1, url2) {
    if (!url1 || !url2) return false;
    if (url1 === url2) return true;
    const clean1 = String(url1).replace('url(', '').replace(')', '').replace(/"/g, '').replace(/'/g, '').split('?')[0].split('#')[0].trim();
    const clean2 = String(url2).replace('url(', '').replace(')', '').replace(/"/g, '').replace(/'/g, '').split('?')[0].split('#')[0].trim();
    if (clean1 === clean2) return true;
    const id1 = clean1.match(new RegExp('wallhaven-([a-z0-9]+)', 'i'))?.[1] || clean1.match(new RegExp('/([a-z0-9]{6})\\.[a-z]+$', 'i'))?.[1];
    const id2 = clean2.match(new RegExp('wallhaven-([a-z0-9]+)', 'i'))?.[1] || clean2.match(new RegExp('/([a-z0-9]{6})\\.[a-z]+$', 'i'))?.[1];
    if (id1 && id2 && id1.toLowerCase() === id2.toLowerCase()) return true;
    const file1 = clean1.split('/').pop().toLowerCase();
    const file2 = clean2.split('/').pop().toLowerCase();
    return file1.length > 3 && file1 === file2;
}

export function getCurrentScreenWallpaperUrl() {
    if (state.settings.bgType === 'local') {
        const startupId = localStorage.getItem('nova_startup_bg_id');
        return state.settings.selectedLocalBg || startupId || '';
    }
    if (state.currentActiveWallhavenUrl) return state.currentActiveWallhavenUrl;
    const savedActive = localStorage.getItem('nova_active_wh_url');
    if (savedActive) return savedActive;
    const bg1 = document.getElementById('bg-1');
    const bg2 = document.getElementById('bg-2');
    const activeEl = (state.activeBg === 2 ? bg2 : bg1) || (bg1?.classList.contains('active') ? bg1 : bg2);
    if (activeEl && activeEl.style.backgroundImage) {
        const raw = activeEl.style.backgroundImage;
        const cleaned = raw.replace('url(', '').replace(')', '').replace(/"/g, '').replace(/'/g, '').trim();
        if (cleaned && cleaned !== 'none') return cleaned;
    }
    const startupBg = localStorage.getItem('nova_startup_bg');
    if (startupBg) return startupBg;
    return state.settings.wallhavenQueue?.[0] || '';
}

export function preloadAdjacentLocalWallpapers(gallery, activeId) {
    if (!gallery || gallery.length <= 1) return;
    const currentIdx = gallery.findIndex(img => img.id === activeId);
    if (currentIdx === -1) return;
    const next1 = gallery[(currentIdx + 1) % gallery.length];
    const next2 = gallery[(currentIdx + 2) % gallery.length];
    const prev1 = gallery[(currentIdx - 1 + gallery.length) % gallery.length];
    if (next1) BackgroundPreloader.preloadLocal(next1.id);
    if (next2) BackgroundPreloader.preloadLocal(next2.id);
    if (prev1) BackgroundPreloader.preloadLocal(prev1.id);
}

export function preloadAdjacentWallhavenWallpapers(pool, currentIdx, currentUrl) {
    const urls = [];
    if (pool && pool.length > 1) {
        const next1 = pool[(currentIdx + 1) % pool.length]?.path;
        const next2 = pool[(currentIdx + 2) % pool.length]?.path;
        const prev1 = pool[(currentIdx - 1 + pool.length) % pool.length]?.path;
        if (next1 && next1 !== currentUrl) urls.push({ url: next1, highPriority: true });
        if (next2 && next2 !== currentUrl) urls.push({ url: next2, highPriority: false });
        if (prev1 && prev1 !== currentUrl) urls.push({ url: prev1, highPriority: false });
    }
    BackgroundPreloader.maintain(urls.map(u => u.url));
    urls.forEach(u => {
        if (u.url && typeof u.url === 'string' && u.url.startsWith('http')) {
            BackgroundPreloader.preload(u.url, u.highPriority);
        }
    });
}

export async function preCalculateNextBackground() {
    try {
        const settings = state.settings;
        const gallery = await storage.getGallery();
        let nextThumbUrl = "";

        if (settings.bgType === 'local' && gallery.length > 0) {
            let currentIndex = gallery.findIndex(i => i.id === settings.selectedLocalBg);
            if (currentIndex === -1) currentIndex = 0;
            
            let targetIndex = currentIndex;
            if (settings.bgFrequency === 'every_tab' && gallery.length > 1) {
                if (settings.localOrder === 'random') {
                    do {
                        targetIndex = Math.floor(Math.random() * gallery.length);
                    } while (targetIndex === currentIndex && gallery.length > 1);
                } else {
                    targetIndex = (currentIndex + 1) % gallery.length;
                }
            }
            nextThumbUrl = gallery[targetIndex].thumb || gallery[targetIndex].url;
            
            localStorage.setItem('nova_startup_bg_id', gallery[targetIndex].id);
            localStorage.setItem('nova_startup_bg_type', 'local');
            localStorage.setItem('nova_startup_bg_pos', gallery[targetIndex].positionY !== undefined ? gallery[targetIndex].positionY : 50);

            localStorage.setItem('nova_gallery_count', String(gallery.length));

            const targetOffset = Math.floor(targetIndex / 10) * 10;
            const sliceItems = gallery.slice(targetOffset, targetOffset + 10);
            try {
                localStorage.setItem('nova_local_slice_cache', JSON.stringify({
                    offset: targetOffset,
                    total: gallery.length,
                    activeId: gallery[targetIndex].id,
                    items: sliceItems.map(img => ({
                        id: img.id,
                        thumb: img.thumb || img.url
                    }))
                }));
            } catch {}
        } else if (settings.bgType === 'wallhaven') {
            const pool = getWallhavenPool();
            let currentIndex = pool.findIndex(item => isSameWallpaper(item.path, state.currentActiveWallhavenUrl || getCurrentScreenWallpaperUrl()));
            if (currentIndex === -1) currentIndex = 0;
            let targetIndex = currentIndex;
            if (settings.bgFrequency === 'every_tab' && pool.length > 1) {
                targetIndex = (currentIndex + 1) % pool.length;
            }
            if (pool[targetIndex]) {
                nextThumbUrl = pool[targetIndex].path;
                localStorage.removeItem('nova_startup_bg_id');
                localStorage.setItem('nova_startup_bg_type', 'wallhaven');
                localStorage.setItem('nova_startup_bg_pos', '50');
                localStorage.setItem('nova_startup_bg_wh_url', nextThumbUrl);
                try {
                    localStorage.setItem('nova_startup_bg_meta', JSON.stringify({
                        path: pool[targetIndex].path,
                        thumb: pool[targetIndex].thumb,
                        resolution: pool[targetIndex].resolution,
                        colors: pool[targetIndex].colors
                    }));
                } catch {}
                const targetOffset = Math.floor(targetIndex / 10) * 10;
                const sliceItems = pool.slice(targetOffset, targetOffset + 10);
                try {
                    localStorage.setItem('nova_wh_slice_cache', JSON.stringify({
                        offset: targetOffset,
                        total: parseInt(localStorage.getItem('nova_wh_total') || '0'),
                        currentActive: nextThumbUrl,
                        items: sliceItems.map(img => ({
                            id: img.id,
                            path: img.path,
                            thumb: img.thumb,
                            resolution: img.resolution
                        }))
                    }));
                } catch {}
            }
        }

        if (nextThumbUrl) {
            localStorage.setItem('nova_startup_bg', nextThumbUrl);
            
            if (nextThumbUrl.startsWith('http')) {
                BackgroundPreloader.preload(nextThumbUrl, true);
            }

            if (settings.searchAutoColor) {
                const color = await extractAverageColor(nextThumbUrl);
                if (color) localStorage.setItem('nova_startup_bg_color', JSON.stringify(color));
            }
        }
    } catch {}
}

export async function applyBackground(originalUrl, objectUrl = null, posY = 50) {
    const settings = state.settings;
    const displayUrl = objectUrl || originalUrl;
    if (!displayUrl) return;

    state.bgSwitchSeq = (state.bgSwitchSeq || 0) + 1;
    const currentSeq = state.bgSwitchSeq;

    const nextBg = state.activeBg === 1 ? 2 : 1;
    const currentEl = document.getElementById(`bg-${state.activeBg}`);
    const nextEl = document.getElementById(`bg-${nextBg}`);
    if (!currentEl || !nextEl) return;

    const executeSwap = () => {
        if (currentSeq !== state.bgSwitchSeq) return;

        nextEl.style.backgroundImage = `url(${displayUrl})`;
        nextEl.style.backgroundPosition = `center ${posY}%`;
        
        void nextEl.offsetWidth;
        
        nextEl.classList.add('active');
        currentEl.classList.remove('active');
        state.activeBg = nextBg;

        if (settings.bgType === 'wallhaven' && originalUrl) {
            state.currentActiveWallhavenUrl = originalUrl;
            localStorage.setItem('nova_active_wh_url', originalUrl);
        }

        if (state.activeObjectUrl && state.activeObjectUrl !== objectUrl && !state.activeObjectUrl.startsWith('data:')) {
            const urlToRevoke = state.activeObjectUrl;
            setTimeout(() => {
                if (urlToRevoke !== state.activeObjectUrl) {
                    URL.revokeObjectURL(urlToRevoke);
                }
            }, settings.bgFade + 100);
        }
        state.activeObjectUrl = objectUrl;

        preCalculateNextBackground(); 
    };

    const img = new Image();
    img.fetchPriority = 'high';
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';
    img.src = displayUrl;
    img.onload = async () => {
        try { await img.decode(); } catch(e) {}
        executeSwap();
    };
    img.onerror = () => {
        executeSwap();
    };

    if (settings.searchAutoColor) {
        const c = await extractAverageColor(originalUrl);
        if (c && currentSeq === state.bgSwitchSeq) {
            state.rootStyle.setProperty('--search-bg-r', c.r);
            state.rootStyle.setProperty('--search-bg-g', c.g);
            state.rootStyle.setProperty('--search-bg-b', c.b);
        }
    }
}

export async function switchToNextWallpaper() {
    const settings = state.settings;
    localStorage.setItem('nova_last_change', Date.now().toString());

    if (settings.bgType === 'local') {
        const gallery = await storage.getGallery();
        if (gallery.length === 0) return;
        if (gallery.length === 1) {
            settings.selectedLocalBg = gallery[0].id;
            await storage.setSettings(settings);
            await loadBackground(false, false);
            return;
        }

        if (settings.selectedLocalBg) {
            if (!settings.localHistory) settings.localHistory = [];
            settings.localHistory.push(settings.selectedLocalBg);
            if (settings.localHistory.length > 50) settings.localHistory.shift();
        }

        let currentIdx = gallery.findIndex(img => img.id === settings.selectedLocalBg);
        let nextIdx;
        if (settings.localOrder === 'random') {
            do {
                nextIdx = Math.floor(Math.random() * gallery.length);
            } while (nextIdx === currentIdx && gallery.length > 1);
        } else {
            nextIdx = (currentIdx === -1) ? 0 : (currentIdx + 1) % gallery.length;
        }
        settings.selectedLocalBg = gallery[nextIdx].id;
        await storage.setSettings(settings);
        await loadBackground(false, false);
    } else {
        let pool = getWallhavenPool();
        if (pool.length === 0) {
            await doFetchWallhaven(1);
            pool = getWallhavenPool();
        }
        if (pool.length === 0) return;

        const current = state.currentActiveWallhavenUrl || getCurrentScreenWallpaperUrl();
        let currentIdx = pool.findIndex(item => isSameWallpaper(item.path, current));
        let nextIdx;
        if (currentIdx === -1) {
            nextIdx = 0;
        } else {
            nextIdx = currentIdx + 1;
            if (nextIdx >= pool.length) {
                await doFetchWallhaven();
                pool = getWallhavenPool();
                if (nextIdx >= pool.length) {
                    nextIdx = 0;
                }
            } else if (nextIdx + 4 >= pool.length) {
                fetchWallhavenBatch();
            }
        }

        const nextItem = pool[nextIdx];
        if (nextItem && nextItem.path) {
            state.currentActiveWallhavenUrl = nextItem.path;
            localStorage.setItem('nova_active_wh_url', nextItem.path);
            try {
                localStorage.setItem('nova_active_wh_meta', JSON.stringify({
                    path: nextItem.path,
                    thumb: nextItem.thumb,
                    resolution: nextItem.resolution,
                    colors: nextItem.colors
                }));
            } catch {}
            settings.wallhavenQueue = pool.slice(nextIdx).map(p => p.path);
            await storage.setSettings(settings);
            await loadBackground(false, false);
        }
    }
}

export async function switchToPrevWallpaper() {
    const settings = state.settings;
    if (settings.bgType === 'local') {
        const gallery = await storage.getGallery();
        if (gallery.length === 0) return;
        if (gallery.length === 1) {
            settings.selectedLocalBg = gallery[0].id;
            await storage.setSettings(settings);
            await loadBackground(false, false);
            return;
        }

        if (settings.localHistory && settings.localHistory.length > 0) {
            const prevId = settings.localHistory.pop();
            const exists = gallery.some(img => img.id === prevId);
            if (exists && prevId !== settings.selectedLocalBg) {
                settings.selectedLocalBg = prevId;
                await storage.setSettings(settings);
                await loadBackground(false, false);
                return;
            }
        }

        let currentIdx = gallery.findIndex(img => img.id === settings.selectedLocalBg);
        let prevIdx = (currentIdx === -1) ? 0 : (currentIdx - 1 + gallery.length) % gallery.length;
        settings.selectedLocalBg = gallery[prevIdx].id;
        await storage.setSettings(settings);
        await loadBackground(false, false);
    } else {
        let pool = getWallhavenPool();
        if (pool.length === 0) {
            await doFetchWallhaven(1);
            pool = getWallhavenPool();
        }
        if (pool.length <= 1) return;

        const current = state.currentActiveWallhavenUrl || getCurrentScreenWallpaperUrl();
        let currentIdx = pool.findIndex(item => isSameWallpaper(item.path, current));
        let prevIdx;
        if (currentIdx === -1) {
            prevIdx = 0;
        } else {
            prevIdx = currentIdx - 1;
            if (prevIdx < 0) {
                prevIdx = pool.length - 1;
            }
        }

        const prevItem = pool[prevIdx];
        if (prevItem && prevItem.path) {
            state.currentActiveWallhavenUrl = prevItem.path;
            localStorage.setItem('nova_active_wh_url', prevItem.path);
            try {
                localStorage.setItem('nova_active_wh_meta', JSON.stringify({
                    path: prevItem.path,
                    thumb: prevItem.thumb,
                    resolution: prevItem.resolution,
                    colors: prevItem.colors
                }));
            } catch {}
            settings.wallhavenQueue = pool.slice(prevIdx).map(p => p.path);
            await storage.setSettings(settings);
            await loadBackground(false, false);
        }
    }
}

export async function evaluateFrequencyAdvance(isStartup) {
    const settings = state.settings;
    let shouldAdvance = false;
    const now = Date.now();
    const lastChange = parseInt(localStorage.getItem('nova_last_change') || '0');

    if (settings.bgFrequency === 'every_tab' && isStartup) {
        shouldAdvance = true;
    } else if (settings.bgFrequency === 'every_hour' && (now - lastChange) >= 3600000) {
        shouldAdvance = true;
    } else if (settings.bgFrequency === 'every_day' && (now - lastChange) >= 86400000) {
        shouldAdvance = true;
    }

    if (shouldAdvance) {
        localStorage.setItem('nova_last_change', now.toString());
        
        if (settings.bgType === 'local') {
            const gallery = await storage.getGallery();
            if (gallery.length > 1) {
                const nextId = localStorage.getItem('nova_startup_bg_id');
                if (nextId && gallery.some(img => img.id === nextId) && nextId !== settings.selectedLocalBg) {
                    settings.selectedLocalBg = nextId;
                } else {
                    let idx = gallery.findIndex(img => img.id === settings.selectedLocalBg);
                    let nextIdx;
                    if (settings.localOrder === 'random') {
                        do {
                            nextIdx = Math.floor(Math.random() * gallery.length);
                        } while (nextIdx === idx && gallery.length > 1);
                    } else {
                        nextIdx = (idx + 1) % gallery.length;
                    }
                    settings.selectedLocalBg = gallery[nextIdx].id;
                }
                await storage.setSettings(settings);
            }
        } else if (settings.bgType === 'wallhaven') {
            let pool = getWallhavenPool();
            if (pool.length > 1) {
                const startupWhUrl = localStorage.getItem('nova_startup_bg_wh_url') || localStorage.getItem('nova_startup_bg');
                let nextUrl = null;
                let nextIdx = -1;

                if (startupWhUrl && pool.some(item => isSameWallpaper(item.path, startupWhUrl))) {
                    nextIdx = pool.findIndex(item => isSameWallpaper(item.path, startupWhUrl));
                    nextUrl = pool[nextIdx].path;
                } else {
                    const current = state.currentActiveWallhavenUrl || localStorage.getItem('nova_active_wh_url') || getCurrentScreenWallpaperUrl();
                    let idx = pool.findIndex(item => isSameWallpaper(item.path, current));
                    if (idx === -1) idx = 0;
                    nextIdx = (idx + 1) % pool.length;
                    nextUrl = pool[nextIdx].path;
                }

                if (nextUrl) {
                    state.currentActiveWallhavenUrl = nextUrl;
                    localStorage.setItem('nova_active_wh_url', nextUrl);
                    if (pool[nextIdx]) {
                        try {
                            localStorage.setItem('nova_active_wh_meta', JSON.stringify({
                                path: pool[nextIdx].path,
                                thumb: pool[nextIdx].thumb,
                                resolution: pool[nextIdx].resolution,
                                colors: pool[nextIdx].colors
                            }));
                        } catch {}
                    }
                    settings.wallhavenQueue = pool.slice(nextIdx).map(p => p.path);
                    await storage.setSettings(settings);
                }
            }
        }
    }
}

export async function loadBackground(forceNext = false, isStartup = false) {
    if (forceNext) {
        await switchToNextWallpaper();
        return;
    }
    if (state.isLoadingBg) return;
    state.isLoadingBg = true;

    const settings = state.settings;
    let currentUrl = null;
    try {
        if (isStartup) {
            await evaluateFrequencyAdvance(isStartup);
        }

        if (settings.bgType === 'local') {
            const gallery = await storage.getGallery();
            if (gallery.length > 0) {
                const img = gallery.find(i => i.id === settings.selectedLocalBg) || gallery[0];
                let originalUrl = img.url || img.thumb;
                let newObjectUrl = null;
                const posY = img.positionY !== undefined ? img.positionY : 50;

                if (isStartup && window.novaStartupBgPromise) {
                    const startupRes = await window.novaStartupBgPromise;
                    if (startupRes.id === img.id || startupRes.url === originalUrl) {
                        let displayUrl = originalUrl;
                        if (startupRes.url && startupRes.url.startsWith('blob:')) {
                            state.activeObjectUrl = startupRes.url;
                            displayUrl = state.activeObjectUrl;
                        } else {
                            displayUrl = startupRes.url;
                        }
                        
                        const bg1 = document.getElementById('bg-1');
                        const bg2 = document.getElementById('bg-2');
                        
                        if (bg1 && bg1.style.backgroundImage !== `url("${displayUrl}")` && bg1.style.backgroundImage !== `url('${displayUrl}')` && bg1.style.backgroundImage !== `url(${displayUrl})`) {
                            bg1.style.backgroundImage = `url(${displayUrl})`;
                        }
                        if (bg1) {
                            bg1.style.backgroundPosition = `center ${posY}%`;
                            bg1.classList.add('active');
                        }
                        if (bg2) bg2.classList.remove('active');
                        state.activeBg = 1;
                        
                        if (settings.searchAutoColor) {
                            const c = await extractAverageColor(originalUrl);
                            if (c) {
                                state.rootStyle.setProperty('--search-bg-r', c.r);
                                state.rootStyle.setProperty('--search-bg-g', c.g);
                                state.rootStyle.setProperty('--search-bg-b', c.b);
                            }
                        }
                        preCalculateNextBackground();
                        preloadAdjacentLocalWallpapers(gallery, img.id);
                        emit('gallery:updated', { gallery });
                        emit('preview:sync', { currentUrl: img.id });
                        return; 
                    }
                }

                const cached = await BackgroundPreloader.get(img.id);
                if (cached && cached.objectUrl) {
                    newObjectUrl = cached.objectUrl;
                } else {
                    const blob = await idb.get(img.id);
                    if (blob) {
                        newObjectUrl = URL.createObjectURL(blob);
                        BackgroundPreloader.preloadLocal(img.id, blob);
                    }
                }
                applyBackground(originalUrl, newObjectUrl, posY);
                preloadAdjacentLocalWallpapers(gallery, img.id);
            } else {
                const currentEl = document.getElementById(`bg-${state.activeBg}`);
                if (currentEl) currentEl.style.backgroundImage = 'none';
                preCalculateNextBackground();
            }
        } else {
            const btnRefresh = document.getElementById('b_refresh_bg');
            const btnNextWh = document.getElementById('b_next_wh');
            
            let pool = getWallhavenPool();
            if (pool.length === 0) {
                await doFetchWallhaven(1);
                pool = getWallhavenPool();
            }

            currentUrl = state.currentActiveWallhavenUrl || localStorage.getItem('nova_active_wh_url');
            let poolIdx = pool.findIndex(item => isSameWallpaper(item.path, currentUrl));
            if (poolIdx === -1) {
                if (pool.length > 0) {
                    currentUrl = pool[0].path;
                    poolIdx = 0;
                }
            }

            if (currentUrl) {
                state.currentActiveWallhavenUrl = currentUrl;
                localStorage.setItem('nova_active_wh_url', currentUrl);
                if (pool[poolIdx]) {
                    try {
                        localStorage.setItem('nova_active_wh_meta', JSON.stringify({
                            path: pool[poolIdx].path,
                            thumb: pool[poolIdx].thumb,
                            resolution: pool[poolIdx].resolution,
                            colors: pool[poolIdx].colors
                        }));
                    } catch {}
                }
            }

            if (pool.length > 0 && poolIdx + 5 >= pool.length) {
                fetchWallhavenBatch();
            }

            if (isStartup && window.novaStartupBgPromise) {
                const startupRes = await window.novaStartupBgPromise;
                if (isSameWallpaper(startupRes.url, currentUrl)) {
                    const bg1 = document.getElementById('bg-1');
                    const bg2 = document.getElementById('bg-2');
                    
                    if (bg1 && bg1.style.backgroundImage !== `url("${currentUrl}")` && bg1.style.backgroundImage !== `url('${currentUrl}')` && bg1.style.backgroundImage !== `url(${currentUrl})`) {
                        bg1.style.backgroundImage = `url(${currentUrl})`;
                    }
                    if (bg1) {
                        bg1.style.backgroundPosition = `center 50%`;
                        bg1.classList.add('active');
                    }
                    if (bg2) bg2.classList.remove('active');
                    state.activeBg = 1;
                    
                    if (settings.searchAutoColor) {
                        const c = await extractAverageColor(currentUrl);
                        if (c) {
                            state.rootStyle.setProperty('--search-bg-r', c.r);
                            state.rootStyle.setProperty('--search-bg-g', c.g);
                            state.rootStyle.setProperty('--search-bg-b', c.b);
                        }
                    }
                    preCalculateNextBackground();
                    preloadAdjacentWallhavenWallpapers(pool, poolIdx, currentUrl);
                    emit('gallery:updated');
                    emit('preview:sync', { currentUrl });
                    return; 
                }
            }

            let newObjectUrl = null;
            const preloadedPromise = BackgroundPreloader.get(currentUrl);
            
            if (preloadedPromise) {
                if (btnRefresh) btnRefresh.style.opacity = "0.5";
                if (btnNextWh) btnNextWh.style.opacity = "0.5";
                
                const preloaded = await preloadedPromise;
                if (preloaded && preloaded.objectUrl) {
                    newObjectUrl = preloaded.objectUrl;
                }
            }

            if (currentUrl) applyBackground(currentUrl, newObjectUrl, 50);
            preloadAdjacentWallhavenWallpapers(pool, poolIdx, currentUrl);
        }
        
        emit('gallery:updated');
        emit('preview:sync', { currentUrl: settings.bgType === 'local' ? settings.selectedLocalBg : currentUrl });
    } finally {
        state.isLoadingBg = false;
        const btnRefresh = document.getElementById('b_refresh_bg');
        const btnNextWh = document.getElementById('b_next_wh');
        if (btnRefresh) btnRefresh.style.opacity = "1";
        if (btnNextWh) btnNextWh.style.opacity = "1";
    }
}
