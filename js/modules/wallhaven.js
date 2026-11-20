import state, { emit } from './state.js';
import { storage, idb } from './storage.js';
import { showToast, generateThumbnail } from './utils.js';
import BackgroundPreloader from './preloader.js';

const apiCache = new Map();
const inFlightRequests = new Map();
let currentFetchSeq = 0;

export function resetWallhavenSession() {
    currentFetchSeq++;
    state.whFetchSeq = currentFetchSeq;
    apiCache.clear();
    inFlightRequests.clear();
    isFetchingWallhaven = false;
    state.currentWhOffset = 0;
    localStorage.removeItem('nova_wh_preview');
    localStorage.setItem('nova_wh_pool', '[]');
    localStorage.setItem('nova_wh_preview_offset', '0');
    localStorage.setItem('nova_wh_api_page', '1');
    localStorage.setItem('nova_wh_total', '0');
    localStorage.setItem('nova_wh_seed', Math.random().toString(36).substring(2, 8));
}

export function getWallhavenPool() {
    try {
        const pool = JSON.parse(localStorage.getItem('nova_wh_pool') || '[]');
        if (Array.isArray(pool)) return pool;
        return [];
    } catch (e) {
        return [];
    }
}

export function saveWallhavenPool(pool) {
    try {
        localStorage.setItem('nova_wh_pool', JSON.stringify(pool));
    } catch (e) {}
}

export function buildWallhavenUrl(page = 1) {
    const settings = state.settings;
    const params = new URLSearchParams();
    params.set('categories', '111');
    params.set('purity', '100');

    let seed = localStorage.getItem('nova_wh_seed');
    if (!seed) {
        seed = Math.random().toString(36).substring(2, 8);
        localStorage.setItem('nova_wh_seed', seed);
    }

    const mode = settings.wallhavenMode || 'search';
    if (mode === 'latest') {
        params.set('sorting', 'date_added');
        params.set('order', 'desc');
        params.set('page', String(page));
    } else if (mode === 'hot') {
        params.set('sorting', 'hot');
        params.set('page', String(page));
    } else if (mode === 'top') {
        params.set('sorting', 'toplist');
        params.set('topRange', settings.wallhavenTopRange || '1M');
        params.set('order', 'desc');
        params.set('page', String(page));
    } else if (mode === 'random') {
        params.set('sorting', 'random');
        params.set('seed', seed);
        params.set('page', String(page));
    } else {
        if (settings.wallhavenQuery && settings.wallhavenQuery.trim() !== '') {
            params.set('q', settings.wallhavenQuery.trim());
        }
        params.set('sorting', 'relevance');
        params.set('order', 'desc');
        params.set('page', String(page));
    }

    if (settings.wallhavenResolution) {
        if (settings.wallhavenResolutionMode === 'exact') {
            params.set('resolutions', settings.wallhavenResolution);
        } else {
            params.set('atleast', settings.wallhavenResolution);
        }
    }

    if (settings.wallhavenRatio) {
        params.set('ratios', settings.wallhavenRatio);
    }

    if (settings.wallhavenColor) {
        params.set('colors', settings.wallhavenColor.replace('#', ''));
    }

    return `https://wallhaven.cc/api/v1/search?${params.toString()}`;
}

export async function fetchWallhavenApi(page = 1, seq = null) {
    if (seq !== null && seq !== currentFetchSeq) {
        return [];
    }
    const url = buildWallhavenUrl(page);
    const cached = apiCache.get(url);
    if (cached && (Date.now() - cached.timestamp < 300000)) {
        return cached.data;
    }
    if (inFlightRequests.has(url)) {
        return inFlightRequests.get(url);
    }
    const fetchPromise = (async () => {
        try {
            const res = await fetch(url);
            if (!res.ok) return [];
            if (seq !== null && seq !== currentFetchSeq) return [];
            const data = await res.json();
            if (seq !== null && seq !== currentFetchSeq) return [];
            if (data && data.meta) {
                if (data.meta.total !== undefined) {
                    localStorage.setItem('nova_wh_total', String(data.meta.total));
                }
                if (data.meta.seed) {
                    localStorage.setItem('nova_wh_seed', data.meta.seed);
                }
            }
            const items = (data && Array.isArray(data.data)) ? data.data : [];
            apiCache.set(url, { timestamp: Date.now(), data: items });
            return items;
        } catch (e) {
            return [];
        } finally {
            inFlightRequests.delete(url);
        }
    })();
    inFlightRequests.set(url, fetchPromise);
    return fetchPromise;
}

let isFetchingWallhaven = false;
export async function fetchWallhavenBatch() {
    if (isFetchingWallhaven) return;
    isFetchingWallhaven = true;
    const batchSeq = currentFetchSeq;

    const executeFetch = async () => {
        if (batchSeq !== currentFetchSeq) return;
        await doFetchWallhaven();
    };

    try {
        if (navigator.locks) {
            await navigator.locks.request('nova_wallhaven_fetch', executeFetch);
        } else {
            await executeFetch();
        }
    } finally {
        isFetchingWallhaven = false;
    }
}

export async function doFetchWallhaven(requestedPage = null) {
    const mySeq = currentFetchSeq;
    let pool = (requestedPage === 1) ? [] : getWallhavenPool();
    if (requestedPage === 1) {
        state.currentWhOffset = 0;
        localStorage.setItem('nova_wh_preview_offset', '0');
        localStorage.setItem('nova_wh_pool', '[]');
        localStorage.setItem('nova_wh_api_page', '1');
    }
    const curApiPage = parseInt(localStorage.getItem('nova_wh_api_page') || '1');
    const pageToFetch = requestedPage || (pool.length === 0 ? 1 : curApiPage + 1);
    const fetchedItems = await fetchWallhavenApi(pageToFetch, mySeq);

    if (mySeq !== currentFetchSeq) return [];

    if (fetchedItems && fetchedItems.length > 0) {
        if (mySeq !== currentFetchSeq) return [];
        localStorage.setItem('nova_wh_api_page', String(pageToFetch));
        const existingPaths = new Set(pool.map(p => p.path));
        const newItems = fetchedItems
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

            const newPaths = newItems.map(i => i.path);
            if (requestedPage === 1) {
                state.settings.wallhavenQueue = newPaths;
            } else {
                const existingQueue = new Set(state.settings.wallhavenQueue || []);
                const toAdd = newPaths.filter(p => !existingQueue.has(p));
                if (!state.settings.wallhavenQueue) state.settings.wallhavenQueue = [];
                state.settings.wallhavenQueue.push(...toAdd);
            }
            if (state.settings.wallhavenQueue.length > 50) {
                state.settings.wallhavenQueue = state.settings.wallhavenQueue.slice(0, 50);
            }
            await storage.setSettings(state.settings);

            const urlsToPreload = state.settings.wallhavenQueue.slice(0, 4);
            BackgroundPreloader.maintain(urlsToPreload);
            urlsToPreload.forEach((pUrl, i) => BackgroundPreloader.preload(pUrl, i === 0));

            if (requestedPage === 1 && pool.length === 24) {
                const total = parseInt(localStorage.getItem('nova_wh_total') || '0');
                if (total === 0 || total > 24) {
                    fetchWallhavenApi(2, mySeq).then(p2Items => {
                        if (mySeq !== currentFetchSeq) return;
                        if (p2Items && p2Items.length > 0) {
                            const latestPool = getWallhavenPool();
                            const paths = new Set(latestPool.map(p => p.path));
                            const more = p2Items.filter(img => !paths.has(img.path)).map(img => ({
                                path: img.path,
                                thumb: img.thumbs?.small || img.thumbs?.original || img.path,
                                resolution: img.resolution || '',
                                colors: img.colors || []
                            }));
                            if (more.length > 0) {
                                latestPool.push(...more);
                                saveWallhavenPool(latestPool);
                                localStorage.setItem('nova_wh_api_page', '2');
                                const colMap = JSON.parse(localStorage.getItem('nova_wh_colors') || '{}');
                                more.forEach(img => {
                                    if (img.colors && img.colors.length > 0) {
                                        colMap[img.path] = img.colors[0];
                                    }
                                });
                                localStorage.setItem('nova_wh_colors', JSON.stringify(colMap));
                                if (state.activeDrawerTab === 'wallhaven' && state.currentWhOffset >= 20) {
                                    emit('preview:rerender');
                                }
                            }
                        }
                    });
                }
            }
        }
    }
    return pool;
}

export async function saveCurrentWallhaven() {
    const currentBg = state.currentActiveWallhavenUrl || (state.settings.wallhavenQueue && state.settings.wallhavenQueue[0]) || '';
    if (!currentBg) {
        showToast("No Wallhaven wallpaper active");
        return false;
    }

    const btn = document.getElementById('b_drawer_save') || document.getElementById('active-card-save-btn') || document.getElementById('b_save_wallhaven');
    const orig = btn ? btn.innerHTML : "";
    if (btn) { 
        btn.innerHTML = "Saving..."; 
        btn.style.pointerEvents = "none"; 
    }

    try {
        const gallery = await storage.getGallery();
        if (!gallery.some(img => img.url === currentBg || img.thumb === currentBg)) {
            let newImg;
            try {
                const res = await fetch(currentBg);
                if (!res.ok) throw new Error("Fetch failed");
                const blob = await res.blob();
                const thumb = await generateThumbnail(blob);
                
                newImg = { 
                    id: 'img_wh_' + Date.now() + Math.floor(Math.random() * 100), 
                    thumb: thumb, 
                    type: 'local', 
                    positionY: 50 
                };
                await idb.set(newImg.id, blob);
            } catch(err) {
                newImg = { 
                    id: 'wallhaven_' + Date.now(), 
                    url: currentBg, 
                    thumb: currentBg, 
                    type: 'wallhaven', 
                    positionY: 50 
                };
            }
            
            gallery.unshift(newImg);
            await storage.setGallery(gallery);
            emit('gallery:updated', { gallery });
            
            if (btn) { 
                btn.innerHTML = "Saved ✓"; 
                btn.style.color = "#4ade80"; 
            }
            showToast("Wallpaper saved to Local files ✓");
            return true;
        } else {
            if (btn) btn.innerHTML = "Already Saved!";
            showToast("Already in Local files");
            return false;
        }
    } catch(e) {
        if (btn) { 
            btn.innerHTML = "Error!"; 
            btn.style.color = "#f87171"; 
        }
        showToast("Error saving wallpaper");
        return false;
    } finally {
        if (btn) {
            setTimeout(() => { 
                btn.innerHTML = orig; 
                btn.style.color = ""; 
                btn.style.pointerEvents = "auto"; 
            }, 2000);
        }
    }
}
