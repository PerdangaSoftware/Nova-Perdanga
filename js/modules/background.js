import state, { emit } from './state.js';
import { storage, idb } from './storage.js';
import { extractAverageColor } from './utils.js';
import BackgroundPreloader from './preloader.js';
import { fetchWallhavenBatch } from './wallhaven.js';

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
    return state.settings.wallhavenQueue?.[0] || null;
}

export async function preCalculateNextBackground() {
    const settings = state.settings;
    const gallery = await storage.getGallery();
    let nextThumbUrl = "";

    if (settings.bgType === 'local' && gallery.length > 0) {
        let currentIndex = gallery.findIndex(i => i.id === settings.selectedLocalBg);
        if (currentIndex === -1) currentIndex = 0;
        
        let targetIndex = currentIndex;
        if (settings.bgFrequency === 'every_tab' && gallery.length > 1) {
            let randomIdx;
            do { 
                randomIdx = Math.floor(Math.random() * gallery.length); 
            } while (randomIdx === currentIndex);
            targetIndex = randomIdx;
        }
        nextThumbUrl = gallery[targetIndex].thumb || gallery[targetIndex].url;
        
        localStorage.setItem('nova_startup_bg_id', gallery[targetIndex].id);
        localStorage.setItem('nova_startup_bg_type', gallery[targetIndex].type || 'local');
        localStorage.setItem('nova_startup_bg_pos', gallery[targetIndex].positionY !== undefined ? gallery[targetIndex].positionY : 50);
    } else if (settings.bgType === 'wallhaven' && settings.wallhavenQueue.length > 0) {
        nextThumbUrl = settings.bgFrequency === 'every_tab' && settings.wallhavenQueue.length > 1 
            ? settings.wallhavenQueue[1] 
            : settings.wallhavenQueue[0];
        localStorage.removeItem('nova_startup_bg_id');
        localStorage.setItem('nova_startup_bg_type', 'wallhaven');
        localStorage.setItem('nova_startup_bg_pos', '50');
    }

    if (nextThumbUrl) {
        localStorage.setItem('nova_startup_bg', nextThumbUrl);
        
        if (settings.bgType === 'wallhaven') {
            const activeUrls = settings.wallhavenQueue.slice(0, 4);
            BackgroundPreloader.maintain(activeUrls);
            activeUrls.forEach((url, i) => BackgroundPreloader.preload(url, i === 0));
        } else if (nextThumbUrl.startsWith('http')) {
            BackgroundPreloader.maintain([nextThumbUrl]);
            BackgroundPreloader.preload(nextThumbUrl, true);
        }

        if (settings.searchAutoColor) {
            const color = await extractAverageColor(nextThumbUrl);
            if (color) localStorage.setItem('nova_startup_bg_color', JSON.stringify(color));
        }
    }
}

export async function applyBackground(originalUrl, objectUrl = null, posY = 50) {
    const settings = state.settings;
    const displayUrl = objectUrl || originalUrl;
    if (!displayUrl) return;

    const nextBg = state.activeBg === 1 ? 2 : 1;
    const currentEl = document.getElementById(`bg-${state.activeBg}`);
    const nextEl = document.getElementById(`bg-${nextBg}`);
    if (!currentEl || !nextEl) return;

    const executeSwap = () => {
        nextEl.style.backgroundImage = `url(${displayUrl})`;
        nextEl.style.backgroundPosition = `center ${posY}%`;
        
        void nextEl.offsetWidth;
        
        nextEl.classList.add('active');
        currentEl.classList.remove('active');
        state.activeBg = nextBg;

        if (settings.bgType === 'wallhaven' && originalUrl) {
            state.currentActiveWallhavenUrl = originalUrl;
            localStorage.setItem('nova_active_wh_url', originalUrl);
            emit('preview:sync', { currentUrl: originalUrl });
        }

        if (state.activeObjectUrl && state.activeObjectUrl !== objectUrl) {
            const urlToRevoke = state.activeObjectUrl;
            setTimeout(() => {
                URL.revokeObjectURL(urlToRevoke);
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
        if (c) {
            state.rootStyle.setProperty('--search-bg-r', c.r);
            state.rootStyle.setProperty('--search-bg-g', c.g);
            state.rootStyle.setProperty('--search-bg-b', c.b);
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
                let nextId;
                if (settings.bgFrequency === 'every_tab') {
                    nextId = localStorage.getItem('nova_startup_bg_id');
                }
                if (!nextId || nextId === settings.selectedLocalBg || !gallery.some(img => img.id === nextId)) {
                    let idx = gallery.findIndex(img => img.id === settings.selectedLocalBg);
                    let randomIdx;
                    do { 
                        randomIdx = Math.floor(Math.random() * gallery.length); 
                    } while (randomIdx === idx);
                    nextId = gallery[randomIdx].id;
                }
                settings.selectedLocalBg = nextId;
                await storage.setSettings(settings);
            }
        } else if (settings.bgType === 'wallhaven' && settings.wallhavenQueue.length > 0) {
            const oldUrl = settings.wallhavenQueue.shift();
            settings.wallhavenHistory.push(oldUrl);
            if (settings.wallhavenHistory.length > 30) settings.wallhavenHistory.shift();
            await storage.setSettings(settings);
        }
    }
}

export async function loadBackground(forceNext = false, isStartup = false) {
    if (state.isLoadingBg) return;
    state.isLoadingBg = true;

    const settings = state.settings;
    let currentUrl = null;
    try {
        if (forceNext) {
            localStorage.setItem('nova_last_change', Date.now().toString());
            if (settings.bgType === 'local') {
                const gallery = await storage.getGallery();
                if (gallery.length > 1) {
                    let idx = gallery.findIndex(img => img.id === settings.selectedLocalBg);
                    let randomIdx;
                    do { 
                        randomIdx = Math.floor(Math.random() * gallery.length); 
                    } while (randomIdx === idx);
                    settings.selectedLocalBg = gallery[randomIdx].id;
                    await storage.setSettings(settings);
                }
            } else if (settings.bgType === 'wallhaven' && settings.wallhavenQueue.length > 0) {
                settings.wallhavenHistory.push(settings.wallhavenQueue.shift());
                await storage.setSettings(settings);
            }
        } else if (isStartup) {
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
                        emit('gallery:updated', { gallery });
                        emit('preview:sync');
                        return; 
                    }
                }

                if (img.type === 'local') {
                    const blob = await idb.get(img.id);
                    if (blob) {
                        newObjectUrl = URL.createObjectURL(blob);
                    }
                }
                applyBackground(originalUrl, newObjectUrl, posY);
            } else {
                const currentEl = document.getElementById(`bg-${state.activeBg}`);
                if (currentEl) currentEl.style.backgroundImage = 'none';
                preCalculateNextBackground();
            }
        } else {
            const btnRefresh = document.getElementById('b_refresh_bg');
            const btnNextWh = document.getElementById('b_next_wh');
            const btnPrevBg = document.getElementById('b_prev_bg');
            if (btnPrevBg) btnPrevBg.disabled = settings.wallhavenHistory.length === 0;

            if (!settings.wallhavenQueue || settings.wallhavenQueue.length === 0) {
                await fetchWallhavenBatch();
            } else if (settings.wallhavenQueue.length < 5) {
                fetchWallhavenBatch(); 
            }

            currentUrl = settings.wallhavenQueue[0];
            if (currentUrl) {
                state.currentActiveWallhavenUrl = currentUrl;
                localStorage.setItem('nova_active_wh_url', currentUrl);
                emit('preview:sync', { currentUrl });
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
                    emit('gallery:updated');
                    emit('preview:sync', { currentUrl });
                    return; 
                }
            }

            let newObjectUrl = null;
            const preloadedPromise = BackgroundPreloader.consume(currentUrl);
            
            if (preloadedPromise) {
                if (btnRefresh) btnRefresh.style.opacity = "0.5";
                if (btnNextWh) btnNextWh.style.opacity = "0.5";
                
                const preloaded = await preloadedPromise;
                if (preloaded && preloaded.objectUrl) {
                    newObjectUrl = preloaded.objectUrl;
                }
            }

            if (currentUrl) applyBackground(currentUrl, newObjectUrl, 50);
        }
        
        emit('gallery:updated');
        emit('preview:sync', { currentUrl });
    } finally {
        state.isLoadingBg = false;
        const btnRefresh = document.getElementById('b_refresh_bg');
        const btnNextWh = document.getElementById('b_next_wh');
        if (btnRefresh) btnRefresh.style.opacity = "1";
        if (btnNextWh) btnNextWh.style.opacity = "1";
    }
}
