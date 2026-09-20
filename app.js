(function hydrateUI() {
    try {
        const timeEnabled = localStorage.getItem('nova_time_enabled') !== 'false';
        const dateEnabled = localStorage.getItem('nova_date_enabled') !== 'false';
        const weatherEnabled = localStorage.getItem('nova_weather_enabled') !== 'false';
        const greetingsEnabled = localStorage.getItem('nova_greetings_enabled') !== 'false';

        if (timeEnabled) {
            const domClock = document.getElementById('clock');
            if (domClock) {
                let opts = { hour: '2-digit', minute: '2-digit' };
                try {
                    const savedOpts = localStorage.getItem('nova_time_opts');
                    if (savedOpts) opts = JSON.parse(savedOpts);
                } catch (e) {}
                domClock.textContent = new Date().toLocaleTimeString([], opts);
            }
        }

        if (dateEnabled) {
            const domDate = document.getElementById('date');
            if (domDate) {
                domDate.textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
            }
        }

        if (greetingsEnabled) {
            const domGreeting = document.getElementById('greeting');
            if (domGreeting) {
                const hour = new Date().getHours();
                let greetText = "Good evening";
                if (hour < 12) greetText = "Good morning";
                else if (hour < 18) greetText = "Good afternoon";
                domGreeting.textContent = greetText;
            }
        }

        if (weatherEnabled) {
            const domWeather = document.getElementById('weather');
            if (domWeather) {
                try {
                    const cachedWeather = localStorage.getItem('nova_weather_cache');
                    if (cachedWeather) {
                        const w = JSON.parse(cachedWeather);
                        document.getElementById('weather-temp').textContent = w.temp;
                        document.getElementById('weather-desc').textContent = w.desc;
                        document.getElementById('weather-icon').textContent = w.icon;
                        if (w.serviceUrl) domWeather.href = w.serviceUrl;
                    } else {
                        document.getElementById('weather-desc').textContent = "Loading weather...";
                    }
                } catch(e) {}
            }
        }
    } catch (e) {}
})();

document.addEventListener('DOMContentLoaded', async () => {

    // Helper: generate 100% reliable deep-link forecast URL without IP override
    function getForecastUrl(service, city, lat, lon) {
        const encodedCity = encodeURIComponent(city.trim());
        switch (service) {
            case 'weathercom':
                return (lat && lon) 
                    ? `https://weather.com/weather/today/l/${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`
                    : `https://weather.com/weather/today/l/${encodedCity}`;
            case 'yandex':
                return `https://yandex.ru/search/?text=${encodeURIComponent('погода ' + city.trim())}`;
            case 'ventusky':
                return (lat && lon)
                    ? `https://www.ventusky.com/?p=${Number(lat).toFixed(4)};${Number(lon).toFixed(4)};10`
                    : `https://www.ventusky.com`;
            case 'google':
            case 'msn': // Backward compatibility mapping
            default:
                return `https://www.google.com/search?q=${encodeURIComponent('weather ' + city.trim())}`;
        }
    }

    // --- 1. STORAGE & INDEXEDDB SYSTEM ---
    const defaultSettings = {
        font: "'Inter', sans-serif",
        textColor: "#ffffff",
        searchAutoColor: true,
        searchBgColor: "#ffffff",
        searchBgOpacity: 25,
        engine: "google",
        bgType: "wallhaven", 
        bgFrequency: "every_tab",
        wallhavenMode: "search",
        wallhavenQuery: "landscape",
        wallhavenQueue: [], 
        wallhavenHistory: [],
        selectedLocalBg: "",
        bgBlur: 0,
        bgBrightness: 100,
        bgFadeEnabled: true, 
        bgFade: 1000,
        searchBlur: 10,
        
        searchWidth: 500,
        searchFontSize: 12,
        clockSize: 80,
        dateSize: 15,
        greetingSize: 25,
        weatherSize: 11,

        timeEnabled: true,
        time12h: false,
        timeSeconds: false,
        dateEnabled: true,
        weatherEnabled: true,
        weatherCity: "",
        weatherUnit: "celsius",
        weatherService: "google",
        greetingsEnabled: true
    };

    const idbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('NovaPerdangaDB', 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore('images');
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = () => reject('IndexedDB failed');
    });

    const idb = {
        get: async (key) => {
            const db = await idbPromise;
            return new Promise(res => {
                const req = db.transaction('images', 'readonly').objectStore('images').get(key);
                req.onsuccess = () => res(req.result);
                req.onerror = () => res(null);
            });
        },
        set: async (key, blob) => {
            const db = await idbPromise;
            return new Promise(res => {
                const tx = db.transaction('images', 'readwrite');
                tx.objectStore('images').put(blob, key);
                tx.oncomplete = () => res();
            });
        },
        remove: async (key) => {
            const db = await idbPromise;
            return new Promise(res => {
                const tx = db.transaction('images', 'readwrite');
                tx.objectStore('images').delete(key);
                tx.oncomplete = () => res();
            });
        }
    };

    const storage = {
        getSettings: () => new Promise(res => chrome.storage.local.get(['nova_settings'], data => res(data.nova_settings || defaultSettings))),
        setSettings: (newData) => new Promise(res => chrome.storage.local.set({ nova_settings: newData }, res)),
        getGallery: () => new Promise(res => chrome.storage.local.get(['nova_gallery'], data => res(data.nova_gallery || []))),
        setGallery: (gallery) => new Promise(res => chrome.storage.local.set({ nova_gallery: gallery }, res))
    };

    let settings = await storage.getSettings();
    settings = { ...defaultSettings, ...settings }; 
    
    if (settings.bgFrequency === undefined) settings.bgFrequency = settings.bgChangeNewTab ? "every_tab" : "never";
    if (settings.wallhavenQueue === undefined) settings.wallhavenQueue = [];
    if (settings.wallhavenHistory === undefined) settings.wallhavenHistory = [];

    localStorage.setItem('nova_font_cache', settings.font);

    // --- DOM Elements ---
    const domInterface = document.getElementById('interface');
    const domClockBlock = document.getElementById('time');
    const domClock = document.getElementById('clock');
    const domDate = document.getElementById('date');
    const domGreeting = document.getElementById('greeting');
    const domWeather = document.getElementById('weather');
    const domWeatherIcon = document.getElementById('weather-icon');
    const domWeatherTemp = document.getElementById('weather-temp');
    const domWeatherDesc = document.getElementById('weather-desc');
    
    const searchForm = document.getElementById('search-container');
    const searchInput = document.getElementById('searchbar');
    const searchClearBtn = document.getElementById('search-clear-btn');
    const domSearchSuggestions = document.getElementById('search-suggestions');
    
    const rootStyle = document.documentElement.style;
    const btnOptionsLocal = document.getElementById('b_options_local');
    const btnDownloadLocal = document.getElementById('b_download_local');
    const btnDownloadAllLocal = document.getElementById('b_download_all_local');
    const localImageOptions = document.getElementById('local-image-options');
    const inputLocalPos = document.getElementById('i_local_pos');

    localStorage.setItem('nova_weather_enabled', settings.weatherEnabled);
    localStorage.setItem('nova_search_auto', settings.searchAutoColor);
    localStorage.setItem('nova_time_enabled', settings.timeEnabled);
    localStorage.setItem('nova_date_enabled', settings.dateEnabled);
    localStorage.setItem('nova_greetings_enabled', settings.greetingsEnabled);

    // --- TOAST NOTIFICATION UTILITY ---
    function showToast(message, duration = 2200) {
        const container = document.getElementById('toast-container') || document.body;
        const toast = document.createElement('div');
        toast.className = 'nova-toast';
        toast.textContent = message;
        container.appendChild(toast);
        
        requestAnimationFrame(() => toast.classList.add('show'));
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // --- 1.1 ADVANCED WALLHAVEN PRELOADER ---
    const BackgroundPreloader = (() => {
        const queue = new Map();

        const preload = (url, highPriority = false) => {
            if (!url || !url.startsWith('http')) return null;
            if (queue.has(url)) return queue.get(url);

            const promise = (async () => {
                try {
                    const res = await fetch(url, { priority: highPriority ? 'high' : 'low' });
                    if (!res.ok) throw new Error("Fetch failed");
                    const blob = await res.blob();
                    const objectUrl = URL.createObjectURL(blob);
                    
                    const img = new Image();
                    img.src = objectUrl;
                    await img.decode().catch(() => null);
                    
                    return { objectUrl, blob };
                } catch (e) {
                    return { objectUrl: url, blob: null };
                }
            })();

            queue.set(url, promise);
            return promise;
        };

        const consume = (url) => {
            if (queue.has(url)) {
                const promise = queue.get(url);
                queue.delete(url);
                return promise;
            }
            return null;
        };

        const maintain = (activeUrls) => {
            for (const [url, promise] of queue.entries()) {
                if (!activeUrls.includes(url)) {
                    promise.then(res => {
                        if (res && res.objectUrl && res.objectUrl.startsWith('blob:')) {
                            URL.revokeObjectURL(res.objectUrl);
                        }
                    });
                    queue.delete(url);
                }
            }
        };

        return { preload, consume, maintain };
    })();

    // --- 2. TIME, DATE & GREETINGS ---
    let lastTimeStr = domClock.textContent || "";
    let lastDateStr = domDate.textContent || "";
    let lastGreetStr = domGreeting.textContent || "";

    function updateClockAndDate() {
        const now = new Date();
        
        if (settings.timeEnabled) {
            domClockBlock.classList.remove('hidden');
            const opts = { 
                hour: '2-digit', minute: '2-digit',
                second: settings.timeSeconds ? '2-digit' : undefined,
                hour12: settings.time12h 
            };
            const timeStr = now.toLocaleTimeString([], opts);
            if (timeStr !== lastTimeStr) {
                domClock.textContent = timeStr;
                lastTimeStr = timeStr;
            }
        } else {
            domClockBlock.classList.add('hidden');
        }

        if (settings.dateEnabled) {
            domDate.classList.remove('hidden');
            const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
            if (dateStr !== lastDateStr) {
                domDate.textContent = dateStr;
                lastDateStr = dateStr;
            }
        } else {
            domDate.classList.add('hidden');
        }

        if (settings.greetingsEnabled) {
            domGreeting.classList.remove('hidden');
            const hour = now.getHours();
            let greetText = "Good evening";
            if (hour < 12) greetText = "Good morning";
            else if (hour < 18) greetText = "Good afternoon";
            
            if (greetText !== lastGreetStr) {
                domGreeting.textContent = greetText;
                lastGreetStr = greetText;
            }
        } else {
            domGreeting.classList.add('hidden');
        }
    }
    setInterval(updateClockAndDate, 200);

    // --- 3. WEATHER (ROCK-SOLID DEEP-LINKING) ---
    async function updateWeather() {
        if (!settings.weatherEnabled) {
            domWeather.classList.add('hidden');
            return;
        }
        try {
            let lat, lon, cityDisplay;
            if (settings.weatherCity.trim() !== "") {
                const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(settings.weatherCity)}&count=1`);
                const geoData = await geoRes.json();
                if (geoData.results && geoData.results.length > 0) {
                    lat = geoData.results[0].latitude; 
                    lon = geoData.results[0].longitude; 
                    cityDisplay = geoData.results[0].name;
                } else throw new Error("City not found");
            } else {
                const geoRes = await fetch('https://get.geojs.io/v1/ip/geo.json');
                const geoData = await geoRes.json();
                lat = geoData.latitude; 
                lon = geoData.longitude; 
                cityDisplay = geoData.city;
            }
            const unit = settings.weatherUnit === 'fahrenheit' ? '&temperature_unit=fahrenheit' : '';
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true${unit}`);
            const weatherData = await weatherRes.json();
            
            const temp = Math.round(weatherData.current_weather.temperature);
            const code = weatherData.current_weather.weathercode;
            const unitSymbol = settings.weatherUnit === 'fahrenheit' ? '°F' : '°C';
            
            let desc = "Clear"; let icon = "☀️";
            if (code > 0 && code <= 3) { desc = "Cloudy"; icon = "⛅"; }
            if (code >= 45 && code <= 48) { desc = "Fog"; icon = "🌫️"; }
            if (code >= 51 && code <= 67) { desc = "Rain"; icon = "🌧️"; }
            if (code >= 71 && code <= 77) { desc = "Snow"; icon = "❄️"; }
            if (code >= 95) { desc = "Storm"; icon = "⛈️"; }

            // Generates 100% reliable forecast link for the specific city
            const serviceUrl = getForecastUrl(settings.weatherService, cityDisplay, lat, lon);

            domWeatherTemp.textContent = `${temp}${unitSymbol}`;
            domWeatherDesc.textContent = `${desc}, ${cityDisplay}`;
            domWeatherIcon.textContent = icon;
            domWeather.href = serviceUrl;
            domWeather.classList.remove('hidden');

            localStorage.setItem('nova_weather_cache', JSON.stringify({ 
                temp: `${temp}${unitSymbol}`, 
                desc: `${desc}, ${cityDisplay}`, 
                icon, 
                serviceUrl 
            }));
        } catch (e) {
            if (!localStorage.getItem('nova_weather_cache')) {
                domWeatherDesc.textContent = "Weather offline";
                domWeatherIcon.textContent = "❌";
                domWeather.classList.remove('hidden');
            }
        }
    }

    // --- 4. COLOR EXTRACTION ---
    async function extractAverageColor(url) {
        try {
            const colorMap = JSON.parse(localStorage.getItem('nova_wh_colors') || '{}');
            if (colorMap[url]) {
                const hex = colorMap[url];
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return { r, g, b };
            }

            let objectUrl = url;
            let isBlob = false;
            
            if (url.startsWith('http')) {
                const res = await fetch(url);
                const blob = await res.blob();
                objectUrl = URL.createObjectURL(blob);
                isBlob = true;
            }

            return new Promise(resolve => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    canvas.width = 64; canvas.height = 64;
                    ctx.drawImage(img, 0, 0, 64, 64);
                    if (isBlob) URL.revokeObjectURL(objectUrl);

                    const data = ctx.getImageData(0, 0, 64, 64).data;
                    let r = 0, g = 0, b = 0, count = 0;
                    let maxVibrant = 0, domR = 0, domG = 0, domB = 0;

                    for (let i = 0; i < data.length; i += 16) {
                        let pr = data[i], pg = data[i+1], pb = data[i+2];
                        let max = Math.max(pr, pg, pb), min = Math.min(pr, pg, pb);
                        let sat = max === 0 ? 0 : (max - min) / max;
                        
                        if (sat * max > maxVibrant) {
                            maxVibrant = sat * max;
                            domR = pr; domG = pg; domB = pb;
                        }
                        r += pr; g += pg; b += pb; count++;
                    }
                    
                    let avgR = r/count, avgG = g/count, avgB = b/count;
                    let finalR = Math.round((avgR + domR) / 2);
                    let finalG = Math.round((avgG + domG) / 2);
                    let finalB = Math.round((avgB + domB) / 2);
                    
                    resolve({ r: finalR, g: finalG, b: finalB });
                };
                img.onerror = () => {
                    if (isBlob) URL.revokeObjectURL(objectUrl);
                    resolve(null);
                };
                img.src = objectUrl;
            });
        } catch (e) { return null; }
    }

    // --- 5. BACKGROUND MANAGER ---
    let activeBg = 1;
    let activeObjectUrl = null; 

    async function preCalculateNextBackground() {
        const gallery = await storage.getGallery();
        let nextThumbUrl = "";

        if (settings.bgType === 'local' && gallery.length > 0) {
            let currentIndex = gallery.findIndex(i => i.id === settings.selectedLocalBg);
            if (currentIndex === -1) currentIndex = 0;
            
            let targetIndex = currentIndex;
            if (settings.bgFrequency === 'every_tab' && gallery.length > 1) {
                let randomIdx;
                do { randomIdx = Math.floor(Math.random() * gallery.length); } while (randomIdx === currentIndex);
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

    async function applyBackground(originalUrl, objectUrl = null, posY = 50) {
        const displayUrl = objectUrl || originalUrl;
        if (!displayUrl) return;

        const nextBg = activeBg === 1 ? 2 : 1;
        const currentEl = document.getElementById(`bg-${activeBg}`);
        const nextEl = document.getElementById(`bg-${nextBg}`);

        const executeSwap = () => {
            nextEl.style.backgroundImage = `url(${displayUrl})`;
            nextEl.style.backgroundPosition = `center ${posY}%`;
            
            void nextEl.offsetWidth;
            
            nextEl.classList.add('active');
            currentEl.classList.remove('active');
            activeBg = nextBg;

            if (activeObjectUrl && activeObjectUrl !== objectUrl) {
                const urlToRevoke = activeObjectUrl;
                setTimeout(() => {
                    URL.revokeObjectURL(urlToRevoke);
                }, settings.bgFade + 100);
            }
            activeObjectUrl = objectUrl;

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
                rootStyle.setProperty('--search-bg-r', c.r);
                rootStyle.setProperty('--search-bg-g', c.g);
                rootStyle.setProperty('--search-bg-b', c.b);
            }
        }
    }

    let isFetchingWallhaven = false;
    async function fetchWallhavenBatch() {
        if (isFetchingWallhaven) return;
        isFetchingWallhaven = true;

        const executeFetch = async () => {
            const currentSettings = await storage.getSettings();
            if (currentSettings.wallhavenQueue && currentSettings.wallhavenQueue.length > settings.wallhavenQueue.length) {
                settings.wallhavenQueue = currentSettings.wallhavenQueue;
            }
            if (!settings.wallhavenQueue || settings.wallhavenQueue.length < 5) {
                await doFetchWallhaven();
            }
        };

        if (navigator.locks) {
            await navigator.locks.request('nova_wallhaven_fetch', executeFetch);
        } else {
            await executeFetch();
        }
        
        isFetchingWallhaven = false;
    }

    async function doFetchWallhaven() {
        const seed = Math.random().toString(36).substring(2, 8);
        const cacheBuster = Date.now();
        
        let url = settings.wallhavenMode === 'top' 
            ? `https://wallhaven.cc/api/v1/search?categories=111&purity=110&topRange=3M&sorting=toplist&order=desc&page=${Math.floor(Math.random() * 5) + 1}&_=${cacheBuster}`
            : `https://wallhaven.cc/api/v1/search?q=${encodeURIComponent(settings.wallhavenQuery)}&sorting=random&seed=${seed}&purity=100&_=${cacheBuster}`;
        
        try {
            const res = await fetch(url, { cache: 'no-store' });
            const data = await res.json();
            if (data.data && data.data.length > 0) {
                let items = data.data;
                
                for (let i = items.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [items[i], items[j]] = [items[j], items[i]];
                }
                
                const colorMap = JSON.parse(localStorage.getItem('nova_wh_colors') || '{}');
                const newPaths = [];

                items.forEach(img => {
                    if (!settings.wallhavenQueue.includes(img.path) && !settings.wallhavenHistory.includes(img.path)) {
                        newPaths.push(img.path);
                        if (img.colors && img.colors.length > 0) {
                            colorMap[img.path] = img.colors[0];
                        }
                    }
                });

                const activePaths = new Set([...settings.wallhavenQueue, ...newPaths, ...settings.wallhavenHistory]);
                Object.keys(colorMap).forEach(key => {
                    if (!activePaths.has(key)) delete colorMap[key];
                });
                localStorage.setItem('nova_wh_colors', JSON.stringify(colorMap));

                settings.wallhavenQueue.push(...newPaths);
                if (settings.wallhavenQueue.length > 25) settings.wallhavenQueue = settings.wallhavenQueue.slice(0, 25);
                await storage.setSettings(settings);

                const urlsToPreload = settings.wallhavenQueue.slice(0, 4);
                BackgroundPreloader.maintain(urlsToPreload);
                urlsToPreload.forEach((pUrl, i) => BackgroundPreloader.preload(pUrl, i === 0));
            }
        } catch (e) { console.error("Wallhaven Error:", e); }
    }

    async function evaluateFrequencyAdvance(isStartup) {
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
                        do { randomIdx = Math.floor(Math.random() * gallery.length); } while (randomIdx === idx);
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

    let isLoadingBg = false;
    async function loadBackground(forceNext = false, isStartup = false) {
        if (isLoadingBg) return;
        isLoadingBg = true;

        try {
            if (forceNext) {
                localStorage.setItem('nova_last_change', Date.now().toString());
                if (settings.bgType === 'local') {
                    const gallery = await storage.getGallery();
                    if (gallery.length > 1) {
                        let idx = gallery.findIndex(img => img.id === settings.selectedLocalBg);
                        let randomIdx;
                        do { randomIdx = Math.floor(Math.random() * gallery.length); } while (randomIdx === idx);
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
                                activeObjectUrl = startupRes.url;
                                displayUrl = activeObjectUrl;
                            } else {
                                displayUrl = startupRes.url;
                            }
                            
                            const bg1 = document.getElementById('bg-1');
                            const bg2 = document.getElementById('bg-2');
                            
                            if (bg1.style.backgroundImage !== `url("${displayUrl}")` && bg1.style.backgroundImage !== `url('${displayUrl}')` && bg1.style.backgroundImage !== `url(${displayUrl})`) {
                                bg1.style.backgroundImage = `url(${displayUrl})`;
                            }
                            bg1.style.backgroundPosition = `center ${posY}%`;
                            bg1.classList.add('active');
                            if (bg2) bg2.classList.remove('active');
                            activeBg = 1;
                            
                            if (settings.searchAutoColor) {
                                const c = await extractAverageColor(originalUrl);
                                if (c) {
                                    rootStyle.setProperty('--search-bg-r', c.r);
                                    rootStyle.setProperty('--search-bg-g', c.g);
                                    rootStyle.setProperty('--search-bg-b', c.b);
                                }
                            }
                            preCalculateNextBackground();
                            renderGallery();
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
                    document.getElementById(`bg-${activeBg}`).style.backgroundImage = 'none';
                    preCalculateNextBackground();
                }
            } else {
                const btnRefresh = document.getElementById('b_refresh_bg');
                const btnNextWh = document.getElementById('b_next_wh');
                document.getElementById('b_prev_bg').disabled = settings.wallhavenHistory.length === 0;

                if (!settings.wallhavenQueue || settings.wallhavenQueue.length === 0) {
                    await fetchWallhavenBatch();
                } else if (settings.wallhavenQueue.length < 5) {
                    fetchWallhavenBatch(); 
                }

                const currentUrl = settings.wallhavenQueue[0];

                if (isStartup && window.novaStartupBgPromise) {
                    const startupRes = await window.novaStartupBgPromise;
                    if (startupRes.url === currentUrl) {
                        const bg1 = document.getElementById('bg-1');
                        const bg2 = document.getElementById('bg-2');
                        
                        if (bg1.style.backgroundImage !== `url("${currentUrl}")` && bg1.style.backgroundImage !== `url('${currentUrl}')` && bg1.style.backgroundImage !== `url(${currentUrl})`) {
                            bg1.style.backgroundImage = `url(${currentUrl})`;
                        }
                        bg1.style.backgroundPosition = `center 50%`;
                        bg1.classList.add('active');
                        if (bg2) bg2.classList.remove('active');
                        activeBg = 1;
                        
                        if (settings.searchAutoColor) {
                            const c = await extractAverageColor(currentUrl);
                            if (c) {
                                rootStyle.setProperty('--search-bg-r', c.r);
                                rootStyle.setProperty('--search-bg-g', c.g);
                                rootStyle.setProperty('--search-bg-b', c.b);
                            }
                        }
                        preCalculateNextBackground();
                        renderGallery();
                        return; 
                    }
                }

                let newObjectUrl = null;
                const preloadedPromise = BackgroundPreloader.consume(currentUrl);
                
                if (preloadedPromise) {
                    if(btnRefresh) btnRefresh.style.opacity = "0.5";
                    if(btnNextWh) btnNextWh.style.opacity = "0.5";
                    
                    const preloaded = await preloadedPromise;
                    if (preloaded && preloaded.objectUrl) {
                        newObjectUrl = preloaded.objectUrl;
                    }
                }

                if (currentUrl) applyBackground(currentUrl, newObjectUrl, 50);
            }
            renderGallery();
        } finally {
            isLoadingBg = false;
            const btnRefresh = document.getElementById('b_refresh_bg');
            const btnNextWh = document.getElementById('b_next_wh');
            if(btnRefresh) btnRefresh.style.opacity = "1";
            if(btnNextWh) btnNextWh.style.opacity = "1";
        }
    }

    // --- 6. LOCAL FILES GALLERY & ZIP PACKER ---
    const localGallery = document.getElementById('local-gallery');
    const localUpload = document.getElementById('i_local_upload');

    function createZip(files) {
        const textEncoder = new TextEncoder();
        const localHeaders = [];
        const centralEntries = [];
        let offset = 0;

        const crcTable = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            crcTable[i] = c;
        }

        function crc32(uint8) {
            let crc = 0xFFFFFFFF;
            for (let i = 0; i < uint8.length; i++) {
                crc = (crc >>> 8) ^ crcTable[(crc ^ uint8[i]) & 0xFF];
            }
            return (crc ^ 0xFFFFFFFF) >>> 0;
        }

        const now = new Date();
        const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
        const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

        for (const file of files) {
            const nameBytes = textEncoder.encode(file.name);
            const crc = crc32(file.data);
            const size = file.data.length;

            const localHeader = new Uint8Array(30 + nameBytes.length);
            const lv = new DataView(localHeader.buffer);
            lv.setUint32(0, 0x04034b50, true);
            lv.setUint16(4, 20, true);
            lv.setUint16(6, 0x0800, true);
            lv.setUint16(8, 0, true);
            lv.setUint16(10, dosTime, true);
            lv.setUint16(12, dosDate, true);
            lv.setUint32(14, crc, true);
            lv.setUint32(18, size, true);
            lv.setUint32(22, size, true);
            lv.setUint16(26, nameBytes.length, true);
            lv.setUint16(28, 0, true);
            localHeader.set(nameBytes, 30);

            localHeaders.push(localHeader, file.data);

            const cdEntry = new Uint8Array(46 + nameBytes.length);
            const cv = new DataView(cdEntry.buffer);
            cv.setUint32(0, 0x02014b50, true);
            cv.setUint16(4, 20, true);
            cv.setUint16(6, 20, true);
            cv.setUint16(8, 0x0800, true);
            cv.setUint16(10, 0, true);
            cv.setUint16(12, dosTime, true);
            cv.setUint16(14, dosDate, true);
            cv.setUint32(16, crc, true);
            cv.setUint32(20, size, true);
            cv.setUint32(24, size, true);
            cv.setUint16(28, nameBytes.length, true);
            cv.setUint16(30, 0, true);
            cv.setUint16(32, 0, true);
            cv.setUint16(34, 0, true);
            cv.setUint16(36, 0, true);
            cv.setUint32(38, 0, true);
            cv.setUint32(42, offset, true);
            cdEntry.set(nameBytes, 46);

            centralEntries.push(cdEntry);
            offset += localHeader.length + size;
        }

        const cdOffset = offset;
        let cdSize = 0;
        for (const entry of centralEntries) {
            cdSize += entry.length;
        }

        const eocd = new Uint8Array(22);
        const ev = new DataView(eocd.buffer);
        ev.setUint32(0, 0x06054b50, true);
        ev.setUint16(4, 0, true);
        ev.setUint16(6, 0, true);
        ev.setUint16(8, files.length, true);
        ev.setUint16(10, files.length, true);
        ev.setUint32(12, cdSize, true);
        ev.setUint32(16, cdOffset, true);
        ev.setUint16(20, 0, true);

        return new Blob([...localHeaders, ...centralEntries, eocd], { type: 'application/zip' });
    }

    async function parseZip(blob) {
        const buffer = await blob.arrayBuffer();
        const view = new DataView(buffer);
        const bytes = new Uint8Array(buffer);
        const textDecoder = new TextDecoder();
        const files = {};

        let eocdOffset = -1;
        for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
            if (view.getUint32(i, true) === 0x06054b50) {
                eocdOffset = i;
                break;
            }
        }

        if (eocdOffset !== -1) {
            const cdOffset = view.getUint32(eocdOffset + 16, true);
            const cdTotal = view.getUint16(eocdOffset + 10, true);
            let cur = cdOffset;

            for (let i = 0; i < cdTotal && cur + 46 <= buffer.byteLength; i++) {
                if (view.getUint32(cur, true) !== 0x02014b50) break;
                const compSize = view.getUint32(cur + 20, true);
                const nameLen = view.getUint16(cur + 28, true);
                const extraLen = view.getUint16(cur + 30, true);
                const commLen = view.getUint16(cur + 32, true);
                const localOffset = view.getUint32(cur + 42, true);

                const nameBytes = bytes.subarray(cur + 46, cur + 46 + nameLen);
                const filename = textDecoder.decode(nameBytes);

                if (localOffset + 30 <= buffer.byteLength && view.getUint32(localOffset, true) === 0x04034b50) {
                    const locNameLen = view.getUint16(localOffset + 26, true);
                    const locExtraLen = view.getUint16(localOffset + 28, true);
                    const dataStart = localOffset + 30 + locNameLen + locExtraLen;
                    files[filename] = bytes.subarray(dataStart, dataStart + compSize);
                }

                cur += 46 + nameLen + extraLen + commLen;
            }
        } else {
            let offset = 0;
            while (offset + 30 <= buffer.byteLength) {
                if (view.getUint32(offset, true) !== 0x04034b50) break;
                const compSize = view.getUint32(offset + 18, true);
                const nameLen = view.getUint16(offset + 26, true);
                const extraLen = view.getUint16(offset + 28, true);
                const filename = textDecoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLen));
                const dataStart = offset + 30 + nameLen + extraLen;
                files[filename] = bytes.subarray(dataStart, dataStart + compSize);
                offset = dataStart + compSize;
            }
        }

        return files;
    }

    function generateThumbnail(file, maxWidth = 300, quality = 0.6) {
        return new Promise(resolve => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            img.onload = () => {
                let w = img.width, h = img.height;
                if (w > maxWidth) { h = Math.round((maxWidth / w) * h); w = maxWidth; }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                URL.revokeObjectURL(objectUrl);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = objectUrl;
        });
    }

    async function renderGallery() {
        const gallery = await storage.getGallery();
        
        const counterEl = document.getElementById('gallery-count');
        if (counterEl) counterEl.textContent = gallery.length;

        const existingItems = Array.from(localGallery.children);
        const needsRebuild = existingItems.length !== gallery.length || !existingItems.every((el, i) => el.dataset.id === gallery[i].id);

        if (needsRebuild) {
            localGallery.innerHTML = '';
            gallery.forEach(img => {
                const div = document.createElement('div');
                div.className = `gallery-item ${settings.selectedLocalBg === img.id ? 'selected' : ''}`;
                div.style.backgroundImage = `url(${img.thumb || img.url})`; 
                div.dataset.id = img.id; 
                div.onclick = async () => {
                    if (settings.selectedLocalBg === img.id) return;
                    settings.selectedLocalBg = img.id;
                    await storage.setSettings(settings);
                    renderGallery(); 
                    if(settings.bgType === 'local') loadBackground(false, false);
                };
                localGallery.appendChild(div);
            });
        } else {
            existingItems.forEach(el => {
                if (el.dataset.id === settings.selectedLocalBg) el.classList.add('selected');
                else el.classList.remove('selected');
            });
        }
        
        const hasSelected = gallery.some(img => img.id === settings.selectedLocalBg);
        document.getElementById('b_local_remove').disabled = !hasSelected;
        document.getElementById('b_view_local').disabled = !hasSelected;
        document.getElementById('b_download_local').disabled = !hasSelected;
        if (btnDownloadAllLocal) btnDownloadAllLocal.disabled = gallery.length === 0;
        btnOptionsLocal.disabled = !hasSelected;

        if (hasSelected) {
            const currentImg = gallery.find(img => img.id === settings.selectedLocalBg);
            inputLocalPos.value = currentImg.positionY !== undefined ? currentImg.positionY : 50;
            updateSliderFill(inputLocalPos);
            updateBadge('v_local_pos', `${inputLocalPos.value}%`);
        } else {
            localImageOptions.classList.add('hidden');
        }
    }

    localUpload.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files.length) return;
        const gallery = await storage.getGallery();
        
        const addBtn = document.querySelector('.add-new-btn');
        addBtn.innerHTML = "Processing..."; addBtn.style.pointerEvents = "none";
        
        for (const file of files) {
            const thumb = await generateThumbnail(file);
            const newImg = { id: 'img_' + Date.now() + Math.random().toString(36).substring(2, 7), thumb: thumb, type: 'local', positionY: 50 };
            await idb.set(newImg.id, file); 
            gallery.unshift(newImg);
            settings.selectedLocalBg = newImg.id;
        }
        
        await storage.setGallery(gallery); await storage.setSettings(settings);
        renderGallery();
        if(settings.bgType === 'local') loadBackground(false, false);

        addBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Add new';
        addBtn.style.pointerEvents = "auto";
    });

    document.getElementById('b_local_remove').addEventListener('click', async () => {
        let gallery = await storage.getGallery();
        const imgToRemove = gallery.find(img => img.id === settings.selectedLocalBg);
        if (imgToRemove && imgToRemove.type === 'local') await idb.remove(imgToRemove.id);
        
        gallery = gallery.filter(img => img.id !== settings.selectedLocalBg);
        settings.selectedLocalBg = gallery.length > 0 ? gallery[0].id : "";
        await storage.setGallery(gallery); await storage.setSettings(settings);
        renderGallery();
        loadBackground(false, false);
    });

    document.getElementById('b_view_local').addEventListener('click', async () => {
        const gallery = await storage.getGallery();
        const current = gallery.find(img => img.id === settings.selectedLocalBg);
        if (current) {
            if (current.type === 'local') {
                const blob = await idb.get(current.id);
                if (blob) window.open(URL.createObjectURL(blob), '_blank');
            } else {
                window.open(current.url, '_blank');
            }
        }
    });

    document.getElementById('b_download_local').addEventListener('click', async () => {
        const gallery = await storage.getGallery();
        const current = gallery.find(img => img.id === settings.selectedLocalBg);
        if (!current) return;

        const btn = document.getElementById('b_download_local');
        const origText = btn.innerHTML;
        btn.innerHTML = "Saving...";
        btn.style.pointerEvents = "none";

        try {
            let url;
            let filename = 'Nova_Wallpaper_' + Date.now() + '.jpg';

            if (current.type === 'local') {
                const blob = await idb.get(current.id);
                if (blob) url = URL.createObjectURL(blob);
            } else if (current.type === 'wallhaven' || current.url) {
                const res = await fetch(current.url);
                const blob = await res.blob();
                url = URL.createObjectURL(blob);
                const parts = current.url.split('/');
                filename = parts[parts.length - 1] || filename;
            }

            if (url) {
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                if (current.type === 'local' || url.startsWith('blob:')) {
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                }
            }
        } catch (e) {
            console.error("Download failed", e);
            if (current.url) window.open(current.url, '_blank');
        }

        btn.innerHTML = origText;
        btn.style.pointerEvents = "auto";
    });

    // --- 6.1 DOWNLOAD ALL WALLPAPERS AT ONCE (.ZIP) ---
    if (btnDownloadAllLocal) {
        btnDownloadAllLocal.addEventListener('click', async () => {
            const gallery = await storage.getGallery();
            if (!gallery || gallery.length === 0) return;

            const origText = btnDownloadAllLocal.innerHTML;
            btnDownloadAllLocal.style.pointerEvents = 'none';
            btnDownloadAllLocal.disabled = true;

            try {
                const filesToZip = [];
                const usedNames = new Set();

                for (let i = 0; i < gallery.length; i++) {
                    btnDownloadAllLocal.innerHTML = `Packaging (${i + 1}/${gallery.length})...`;
                    await new Promise(r => setTimeout(r, 10));

                    const item = gallery[i];
                    let blob = null;
                    let filename = '';

                    if (item.type === 'local') {
                        blob = await idb.get(item.id);
                        if (!blob && item.thumb && item.thumb.startsWith('data:')) {
                            blob = await base64ToBlob(item.thumb);
                        }
                    } else if (item.type === 'wallhaven' || item.url) {
                        try {
                            const res = await fetch(item.url);
                            if (res.ok) blob = await res.blob();
                        } catch (err) {}

                        if (!blob && item.thumb && item.thumb.startsWith('http')) {
                            try {
                                const res = await fetch(item.thumb);
                                if (res.ok) blob = await res.blob();
                            } catch (err) {}
                        }

                        if (item.url) {
                            const parts = item.url.split('/');
                            filename = parts[parts.length - 1] || '';
                        }
                    }

                    if (blob) {
                        let ext = '.jpg';
                        if (blob.type === 'image/png') ext = '.png';
                        else if (blob.type === 'image/webp') ext = '.webp';
                        else if (blob.type === 'image/gif') ext = '.gif';
                        else if (blob.type === 'image/jpeg') ext = '.jpg';

                        if (!filename) {
                            filename = `wallpaper_${String(i + 1).padStart(2, '0')}${ext}`;
                        } else if (!filename.includes('.')) {
                            filename += ext;
                        }

                        let finalName = filename;
                        let counter = 1;
                        while (usedNames.has(finalName)) {
                            const dotIdx = filename.lastIndexOf('.');
                            if (dotIdx !== -1) {
                                finalName = `${filename.slice(0, dotIdx)}_${counter}${filename.slice(dotIdx)}`;
                            } else {
                                finalName = `${filename}_${counter}`;
                            }
                            counter++;
                        }
                        usedNames.add(finalName);

                        const arrayBuffer = await blob.arrayBuffer();
                        filesToZip.push({ name: finalName, data: new Uint8Array(arrayBuffer) });
                    }
                }

                if (filesToZip.length === 0) throw new Error("No wallpapers found");

                btnDownloadAllLocal.innerHTML = "Creating ZIP...";
                await new Promise(r => setTimeout(r, 10));

                const zipBlob = createZip(filesToZip);
                const zipUrl = URL.createObjectURL(zipBlob);
                const a = document.createElement('a');
                a.href = zipUrl;
                a.download = `Nova_Wallpapers_${Date.now()}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(zipUrl), 10000);

                btnDownloadAllLocal.innerHTML = "Saved ✓";
                btnDownloadAllLocal.style.color = "var(--accent-green)";
            } catch (e) {
                console.error("Batch wallpaper download failed:", e);
                btnDownloadAllLocal.innerHTML = "Error!";
                btnDownloadAllLocal.style.color = "var(--accent-red)";
            }

            setTimeout(() => {
                btnDownloadAllLocal.innerHTML = origText;
                btnDownloadAllLocal.style.color = "";
                btnDownloadAllLocal.style.pointerEvents = "auto";
                btnDownloadAllLocal.disabled = false;
            }, 2000);
        });
    }

    btnOptionsLocal.addEventListener('click', () => {
        localImageOptions.classList.toggle('hidden');
    });

    inputLocalPos.addEventListener('input', (e) => {
        updateSliderFill(e.target);
        updateBadge('v_local_pos', `${e.target.value}%`);
        if (settings.bgType === 'local') {
            const posY = parseInt(e.target.value);
            const activeEl = document.getElementById(`bg-${activeBg}`);
            activeEl.style.backgroundPosition = `center ${posY}%`;
        }
    });

    inputLocalPos.addEventListener('change', async (e) => {
        const gallery = await storage.getGallery();
        const currentImg = gallery.find(img => img.id === settings.selectedLocalBg);
        if (currentImg) {
            currentImg.positionY = parseInt(e.target.value);
            await storage.setGallery(gallery);
            if (settings.bgType === 'local') preCalculateNextBackground();
        }
    });

    async function saveCurrentWallhaven() {
        const currentBg = settings.wallhavenQueue[0];
        if (!currentBg) {
            showToast("No Wallhaven wallpaper active");
            return false;
        }

        const btn = document.getElementById('b_save_wallhaven');
        const orig = btn ? btn.innerHTML : "";
        if (btn) { btn.innerHTML = "Saving..."; btn.style.pointerEvents = "none"; }

        try {
            const gallery = await storage.getGallery();
            if (!gallery.some(img => img.url === currentBg || img.thumb === currentBg)) {
                let newImg;
                try {
                    const res = await fetch(currentBg);
                    if (!res.ok) throw new Error("Fetch failed");
                    const blob = await res.blob();
                    const thumb = await generateThumbnail(blob);
                    
                    newImg = { id: 'img_wh_' + Date.now() + Math.floor(Math.random()*100), thumb: thumb, type: 'local', positionY: 50 };
                    await idb.set(newImg.id, blob);
                } catch(err) {
                    newImg = { id: 'wallhaven_' + Date.now(), url: currentBg, thumb: currentBg, type: 'wallhaven', positionY: 50 };
                }
                
                gallery.unshift(newImg);
                await storage.setGallery(gallery);
                renderGallery();
                
                if (btn) { btn.innerHTML = "Saved ✓"; btn.style.color = "#4ade80"; }
                showToast("Wallpaper saved to Local files ✓");
                return true;
            } else {
                if (btn) btn.innerHTML = "Already Saved!";
                showToast("Already in Local files");
                return false;
            }
        } catch(e) {
            if (btn) { btn.innerHTML = "Error!"; btn.style.color = "#f87171"; }
            showToast("Error saving wallpaper");
            return false;
        } finally {
            if (btn) {
                setTimeout(() => { btn.innerHTML = orig; btn.style.color = ""; btn.style.pointerEvents = "auto"; }, 2000);
            }
        }
    }

    document.getElementById('b_save_wallhaven').addEventListener('click', saveCurrentWallhaven);

    document.getElementById('b_prev_bg').addEventListener('click', async () => {
        if (settings.wallhavenHistory.length > 0) {
            settings.wallhavenQueue.unshift(settings.wallhavenHistory.pop());
            await storage.setSettings(settings);
            loadBackground(false, false); 
        }
    });

    // --- 7. CONFIGURATION IMPORT / EXPORT (ZIP-BASED STREAMING) ---
    const base64ToBlob = async (base64) => {
        const res = await fetch(base64);
        return await res.blob();
    };

    document.getElementById('b_export').addEventListener('click', async () => {
        const btn = document.getElementById('b_export');
        const origText = btn.innerHTML;
        btn.innerHTML = "Exporting..."; 
        btn.style.pointerEvents = "none";

        try {
            const gallery = await storage.getGallery();
            const currentSettings = await storage.getSettings();
            const zipFiles = [];

            const cleanSettings = { ...currentSettings };
            if (cleanSettings.wallhavenQueue && cleanSettings.wallhavenQueue.length > 10) {
                cleanSettings.wallhavenQueue = cleanSettings.wallhavenQueue.slice(0, 10);
            }
            if (cleanSettings.wallhavenHistory && cleanSettings.wallhavenHistory.length > 10) {
                cleanSettings.wallhavenHistory = cleanSettings.wallhavenHistory.slice(-10);
            }

            const cleanGallery = gallery.map(item => {
                const entry = { ...item };
                delete entry.thumb;
                return entry;
            });

            for (let i = 0; i < gallery.length; i++) {
                const item = gallery[i];
                btn.innerHTML = `Exporting (${i + 1}/${gallery.length})...`;
                await new Promise(r => setTimeout(r, 0));

                let blob = null;
                if (item.type === 'local') {
                    blob = await idb.get(item.id);
                } else if (item.url) {
                    blob = await idb.get(item.id);
                }

                if (blob) {
                    const arrayBuffer = await blob.arrayBuffer();
                    zipFiles.push({
                        name: `images/${item.id}`,
                        data: new Uint8Array(arrayBuffer)
                    });
                }
            }

            const timerData = await new Promise(res => 
                chrome.storage.local.get(['nova_timer_settings', 'nova_timer_state'], res)
            );

            const configObj = { 
                version: "1.4", 
                settings: cleanSettings, 
                gallery: cleanGallery, 
                timerSettings: timerData.nova_timer_settings,
                timerState: timerData.nova_timer_state
            };

            const configString = JSON.stringify(configObj);
            const configBytes = new TextEncoder().encode(configString);
            zipFiles.unshift({
                name: "config.json",
                data: configBytes
            });

            btn.innerHTML = "Creating ZIP...";
            await new Promise(r => setTimeout(r, 0));

            const zipBlob = createZip(zipFiles);
            const downloadUrl = URL.createObjectURL(zipBlob);
            
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", downloadUrl);
            downloadAnchorNode.setAttribute("download", "novaperdanga_backup.zip");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            document.body.removeChild(downloadAnchorNode);
            
            setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
            
            btn.innerHTML = "Success ✓";
            btn.style.color = "var(--accent-green)";
        } catch (err) {
            console.error("Export Error: ", err);
            btn.innerHTML = "Error!";
            btn.style.color = "var(--accent-red)";
        }
        
        setTimeout(() => { 
            btn.innerHTML = origText; 
            btn.style.color = ""; 
            btn.style.pointerEvents = "auto"; 
        }, 2000);
    });

    document.getElementById('i_import').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const btnLabel = document.getElementById('b_import_label');
        const origText = btnLabel.innerHTML;
        btnLabel.innerHTML = "Importing..."; 
        btnLabel.style.pointerEvents = "none";

        try {
            const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
            const isZip = (head[0] === 0x50 && head[1] === 0x4B && head[2] === 0x03 && head[3] === 0x04) || file.name.endsWith('.zip');

            if (isZip) {
                btnLabel.innerHTML = "Reading ZIP...";
                await new Promise(r => setTimeout(r, 0));

                const files = await parseZip(file);
                if (!files['config.json']) throw new Error("Missing config.json in backup archive");

                const configText = new TextDecoder().decode(files['config.json']);
                const importedData = JSON.parse(configText);

                if (importedData.settings) await storage.setSettings(importedData.settings);
                if (importedData.timerSettings) {
                    await chrome.storage.local.set({ nova_timer_settings: importedData.timerSettings });
                }
                if (importedData.timerState) {
                    await chrome.storage.local.set({ nova_timer_state: importedData.timerState });
                }

                if (importedData.gallery) {
                    const total = importedData.gallery.length;
                    for (let i = 0; i < total; i++) {
                        const item = importedData.gallery[i];
                        btnLabel.innerHTML = `Importing (${i + 1}/${total})...`;
                        await new Promise(r => setTimeout(r, 0));

                        const imgKey = `images/${item.id}`;
                        if (files[imgKey]) {
                            const imgData = files[imgKey];
                            
                            let mime = 'image/jpeg';
                            if (imgData[0] === 0x89 && imgData[1] === 0x50 && imgData[2] === 0x4E && imgData[3] === 0x47) mime = 'image/png';
                            else if (imgData[0] === 0x52 && imgData[1] === 0x49 && imgData[2] === 0x46 && imgData[3] === 0x46) mime = 'image/webp';
                            else if (imgData[0] === 0x47 && imgData[1] === 0x49 && imgData[2] === 0x46) mime = 'image/gif';

                            const blob = new Blob([imgData], { type: mime });
                            await idb.set(item.id, blob);

                            item.thumb = await generateThumbnail(blob);
                        }
                    }
                    await storage.setGallery(importedData.gallery);
                }
            } else {
                const fileContent = await file.text();
                await new Promise(r => setTimeout(r, 10)); 
                
                const importedData = JSON.parse(fileContent);
                if (importedData.settings) await storage.setSettings(importedData.settings);
                
                if (importedData.timerSettings) {
                    await chrome.storage.local.set({ nova_timer_settings: importedData.timerSettings });
                }
                if (importedData.timerState) {
                    await chrome.storage.local.set({ nova_timer_state: importedData.timerState });
                }

                if (importedData.images) {
                    const imageEntries = Object.entries(importedData.images);
                    for (let i = 0; i < imageEntries.length; i++) {
                        const [id, base64] = imageEntries[i];
                        btnLabel.innerHTML = `Importing (${i + 1}/${imageEntries.length})...`;
                        await new Promise(r => setTimeout(r, 0));

                        const blob = await base64ToBlob(base64);
                        await idb.set(id, blob);

                        if (importedData.gallery) {
                            const gItem = importedData.gallery.find(g => g.id === id);
                            if (gItem && (!gItem.thumb || !gItem.thumb.startsWith('data:'))) {
                                gItem.thumb = await generateThumbnail(blob);
                            }
                        }
                    }
                }

                if (importedData.gallery) await storage.setGallery(importedData.gallery);
            }

            btnLabel.innerHTML = "Success! Reloading...";
            btnLabel.style.color = "var(--accent-green)";
            setTimeout(() => window.location.reload(), 1200);
        } catch (err) {
            console.error("Import Error: ", err);
            btnLabel.innerHTML = "Invalid File";
            btnLabel.style.color = "var(--accent-red)";
            setTimeout(() => { 
                btnLabel.innerHTML = origText; 
                btnLabel.style.pointerEvents = "auto"; 
                btnLabel.style.color = "";
            }, 2000);
        }

        e.target.value = '';
    });

    // --- 8. SEARCH BAR, AUTOCOMPLETE & SEARCH BANGS ---
    let currentSuggFocus = -1;
    let currentSuggestions = [];
    let originalQuery = "";
    
    let currentAbortController = null;
    const suggestionCache = new Map();

    const toggleClearBtn = () => {
        if (searchInput.value.length > 0) {
            searchClearBtn.classList.remove('hide');
        } else {
            searchClearBtn.classList.add('hide');
        }
    };

    searchClearBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        searchInput.value = '';
        originalQuery = '';
        toggleClearBtn();
        domSearchSuggestions.classList.add('hide');
        currentSuggestions = [];
        searchInput.focus();
    });

    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    };

    const fetchSuggestions = async (query) => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery || trimmedQuery.startsWith('!')) return [];
        
        if (suggestionCache.has(trimmedQuery)) {
            return suggestionCache.get(trimmedQuery);
        }
        
        if (currentAbortController) currentAbortController.abort();
        currentAbortController = new AbortController();
        const signal = currentAbortController.signal;
        
        try {
            const engine = settings.engine;
            let res, data, results;
            
            if (engine === 'ddg') {
                res = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(trimmedQuery)}`, { signal });
                data = await res.json();
                results = data.map(i => i.phrase).slice(0, 8);
            } else if (engine === 'bing') {
                res = await fetch(`https://api.bing.com/osjson.aspx?query=${encodeURIComponent(trimmedQuery)}`, { signal });
                data = await res.json();
                results = data[1].slice(0, 8);
            } else {
                res = await fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(trimmedQuery)}`, { signal });
                data = await res.json();
                results = data[1].slice(0, 8);
            }

            suggestionCache.set(trimmedQuery, results);
            
            if (suggestionCache.size > 50) {
                const firstKey = suggestionCache.keys().next().value;
                suggestionCache.delete(firstKey);
            }
            
            return results;
        } catch (e) {
            if (e.name === 'AbortError') return null;
            return [];
        }
    };

    const renderSuggestions = (suggestions) => {
        currentSuggestions = suggestions;
        domSearchSuggestions.innerHTML = '';
        currentSuggFocus = -1;

        if (!suggestions || suggestions.length === 0) {
            domSearchSuggestions.classList.add('hide');
            return;
        }

        suggestions.forEach((sugg, index) => {
            const li = document.createElement('li');
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', 'false');
            li.innerHTML = `
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sugg-icon">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <span>${sugg}</span>
            `;
            
            li.addEventListener('mousedown', (e) => {
                e.preventDefault();
                searchInput.value = sugg;
                domSearchSuggestions.classList.add('hide');
                searchForm.dispatchEvent(new Event('submit', { cancelable: true }));
            });
            
            li.addEventListener('mouseenter', () => {
                updateSuggFocus(index, false);
            });
            
            domSearchSuggestions.appendChild(li);
        });

        domSearchSuggestions.classList.remove('hide');
    };

    const updateSuggFocus = (index, updateInput = true) => {
        const items = domSearchSuggestions.querySelectorAll('li');
        if (!items || items.length === 0) return;
        
        items.forEach(i => {
            i.classList.remove('active');
            i.setAttribute('aria-selected', 'false');
        });
        
        currentSuggFocus = index;
        
        if (currentSuggFocus >= items.length) currentSuggFocus = -1;
        if (currentSuggFocus < -1) currentSuggFocus = items.length - 1;
        
        if (currentSuggFocus !== -1) {
            items[currentSuggFocus].classList.add('active');
            items[currentSuggFocus].setAttribute('aria-selected', 'true');
            if (updateInput) {
                searchInput.value = currentSuggestions[currentSuggFocus];
            }
        } else if (updateInput) {
            searchInput.value = originalQuery;
        }
    };

    domSearchSuggestions.addEventListener('mouseleave', () => {
        updateSuggFocus(-1, false);
    });

    searchInput.addEventListener('input', debounce(async (e) => {
        const val = e.target.value;
        originalQuery = val;
        toggleClearBtn();
        
        if (!val.trim()) {
            domSearchSuggestions.classList.add('hide');
            currentSuggestions = [];
            return;
        }
        
        const suggs = await fetchSuggestions(val);
        if (suggs !== null) renderSuggestions(suggs);
    }, 150));

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            domSearchSuggestions.classList.add('hide');
            searchInput.value = originalQuery;
            searchInput.blur();
            return;
        }

        if (domSearchSuggestions.classList.contains('hide')) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            updateSuggFocus(currentSuggFocus + 1, true);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            updateSuggFocus(currentSuggFocus - 1, true);
        }
    });

    document.addEventListener('click', (e) => {
        if (!searchForm.contains(e.target)) {
            domSearchSuggestions.classList.add('hide');
        }
    });

    // Search Bangs Handler
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const raw = searchInput.value.trim();
        if (!raw) return;

        domSearchSuggestions.classList.add('hide');

        if (raw.startsWith('!')) {
            const spaceIdx = raw.indexOf(' ');
            const bang = spaceIdx === -1 ? raw.toLowerCase() : raw.substring(0, spaceIdx).toLowerCase();
            const query = spaceIdx === -1 ? '' : raw.substring(spaceIdx + 1).trim();

            const bangsMap = {
                '!y': () => query ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` : 'https://www.youtube.com',
                '!wiki': () => {
                    const isCyrillic = /[а-яё]/i.test(query);
                    const lang = isCyrillic ? 'ru' : 'en';
                    return query ? `https://${lang}.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}` : `https://${lang}.wikipedia.org`;
                },
                '!r': () => query ? `https://www.reddit.com/search/?q=${encodeURIComponent(query)}` : 'https://www.reddit.com',
                '!gl': () => {
                    const cleaned = query.toLowerCase().replace(/[\s\-_]/g, '');
                    if (!query || cleaned === 'novaperdanga') {
                        return 'https://gitlab.com/perdanga/nova-perdanga';
                    }
                    return `https://gitlab.com/search?search=${encodeURIComponent(query)}`;
                },
                '!gh': () => query ? `https://github.com/search?q=${encodeURIComponent(query)}` : 'https://github.com'
            };

            if (bangsMap[bang]) {
                window.location.href = bangsMap[bang]();
                return;
            }
        }

        const engines = { 
            google: 'https://www.google.com/search?q=', 
            ddg: 'https://duckduckgo.com/?q=', 
            bing: 'https://www.bing.com/search?q=' 
        };
        window.location.href = engines[settings.engine] + encodeURIComponent(raw);
    });

    // --- 9. UI BINDINGS & SETTINGS ---
    const inputs = {
        font: document.getElementById('i_font'),
        textColor: document.getElementById('i_text_color'),
        engine: document.getElementById('i_engine'),
        bgType: document.getElementById('i_bg_type'),
        bgFrequency: document.getElementById('i_bg_frequency'),
        wallhavenMode: document.getElementById('i_wallhaven_mode'),
        wallhaven: document.getElementById('i_wallhaven'),
        blur: document.getElementById('i_blur'),
        searchBlur: document.getElementById('i_search_blur'),
        searchAutoColor: document.getElementById('i_search_auto_color'),
        searchBgColor: document.getElementById('i_search_bg_color'),
        searchOpacity: document.getElementById('i_search_opacity'),
        brightness: document.getElementById('i_brightness'),
        fade: document.getElementById('i_fade'),
        timeEnable: document.getElementById('i_time_enable'),
        time12h: document.getElementById('i_time_12h'),
        timeSeconds: document.getElementById('i_time_seconds'),
        dateEnable: document.getElementById('i_date_enable'),
        weatherEnable: document.getElementById('i_weather_enable'),
        weatherCity: document.getElementById('i_weather_city'),
        weatherUnit: document.getElementById('i_weather_unit'),
        weatherService: document.getElementById('i_weather_service'),
        greetingsEnable: document.getElementById('i_greetings_enable'),
        
        searchWidth: document.getElementById('i_search_width'),
        searchFontSize: document.getElementById('i_search_font'),
        clockSize: document.getElementById('i_clock_size'),
        dateSize: document.getElementById('i_date_size'),
        greetingSize: document.getElementById('i_greeting_size'),
        weatherSize: document.getElementById('i_weather_size'),
    };

    function updateSliderFill(slider) {
        const val = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
        slider.style.background = `linear-gradient(to right, #3b82f6 ${val}%, #333 ${val}%)`;
    }

    function updateBadge(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function applySettingsToDOM() {
        rootStyle.setProperty('--font-family', settings.font);
        rootStyle.setProperty('--text-color', settings.textColor);
        rootStyle.setProperty('--bg-blur', `${settings.bgBlur}px`);
        rootStyle.setProperty('--search-blur', `${settings.searchBlur}px`);
        rootStyle.setProperty('--bg-brightness', settings.bgBrightness / 100);
        rootStyle.setProperty('--bg-fade', `${settings.bgFade}ms`);

        rootStyle.setProperty('--search-width', `${settings.searchWidth}px`);
        rootStyle.setProperty('--search-font-size', `${settings.searchFontSize / 10}rem`);
        rootStyle.setProperty('--clock-size', `${settings.clockSize / 10}rem`);
        rootStyle.setProperty('--date-size', `${settings.dateSize / 10}rem`);
        rootStyle.setProperty('--greeting-size', `${settings.greetingSize / 10}rem`);
        rootStyle.setProperty('--weather-size', `${settings.weatherSize / 10}rem`);

        if (!settings.searchAutoColor) {
            const hex = settings.searchBgColor || "#ffffff";
            let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
            if (!isNaN(r)) { rootStyle.setProperty('--search-bg-r', r); rootStyle.setProperty('--search-bg-g', g); rootStyle.setProperty('--search-bg-b', b); }
        }
        
        rootStyle.setProperty('--search-bg-opacity', settings.searchBgOpacity / 100);

        inputs.font.value = settings.font;
        inputs.textColor.value = settings.textColor;
        inputs.engine.value = settings.engine;
        inputs.bgType.value = settings.bgType;
        inputs.bgFrequency.value = settings.bgFrequency;
        inputs.wallhavenMode.value = settings.wallhavenMode;
        inputs.wallhaven.value = settings.wallhavenQuery;
        
        inputs.searchAutoColor.checked = settings.searchAutoColor;
        inputs.searchBgColor.value = settings.searchBgColor;
        
        inputs.blur.value = settings.bgBlur; updateSliderFill(inputs.blur); updateBadge('v_blur', `${settings.bgBlur}px`);
        inputs.searchBlur.value = settings.searchBlur; updateSliderFill(inputs.searchBlur); updateBadge('v_search_blur', `${settings.searchBlur}px`);
        inputs.searchOpacity.value = settings.searchBgOpacity; updateSliderFill(inputs.searchOpacity); updateBadge('v_search_opacity', `${settings.searchBgOpacity}%`);
        inputs.brightness.value = settings.bgBrightness; updateSliderFill(inputs.brightness); updateBadge('v_brightness', `${settings.bgBrightness}%`);
        inputs.fade.value = settings.bgFade; updateSliderFill(inputs.fade); updateBadge('v_fade', `${settings.bgFade}ms`);

        inputs.searchWidth.value = settings.searchWidth; updateSliderFill(inputs.searchWidth); updateBadge('v_search_width', `${settings.searchWidth}px`);
        inputs.searchFontSize.value = settings.searchFontSize; updateSliderFill(inputs.searchFontSize); updateBadge('v_search_font', `${(settings.searchFontSize / 10).toFixed(1)}rem`);
        inputs.clockSize.value = settings.clockSize; updateSliderFill(inputs.clockSize); updateBadge('v_clock_size', `${(settings.clockSize / 10).toFixed(1)}rem`);
        inputs.dateSize.value = settings.dateSize; updateSliderFill(inputs.dateSize); updateBadge('v_date_size', `${(settings.dateSize / 10).toFixed(1)}rem`);
        inputs.greetingSize.value = settings.greetingSize; updateSliderFill(inputs.greetingSize); updateBadge('v_greeting_size', `${(settings.greetingSize / 10).toFixed(1)}rem`);
        inputs.weatherSize.value = settings.weatherSize; updateSliderFill(inputs.weatherSize); updateBadge('v_weather_size', `${(settings.weatherSize / 10).toFixed(1)}rem`);
        
        inputs.timeEnable.checked = settings.timeEnabled;
        inputs.time12h.checked = settings.time12h;
        inputs.timeSeconds.checked = settings.timeSeconds;
        inputs.dateEnable.checked = settings.dateEnabled;
        inputs.weatherEnable.checked = settings.weatherEnabled;
        inputs.weatherCity.value = settings.weatherCity;
        inputs.weatherUnit.value = settings.weatherUnit;
        inputs.weatherService.value = settings.weatherService;
        inputs.greetingsEnable.checked = settings.greetingsEnabled;

        document.getElementById('wallhaven-options').classList.toggle('hidden', settings.bgType !== 'wallhaven');
        document.getElementById('wallhaven-query-wrapper').classList.toggle('hidden', settings.wallhavenMode !== 'search');
        document.getElementById('local-options').classList.toggle('hidden', settings.bgType !== 'local');
        document.getElementById('manual-color-wrapper').classList.toggle('hidden', settings.searchAutoColor);

        const opts = { hour: '2-digit', minute: '2-digit', second: settings.timeSeconds ? '2-digit' : undefined, hour12: settings.time12h };
        localStorage.setItem('nova_time_opts', JSON.stringify(opts));

        updateClockAndDate();
    }

    const updateSetting = async (key, val, triggerFunc) => { 
        settings[key] = val; await storage.setSettings(settings); applySettingsToDOM(); 
        if (key === 'font') localStorage.setItem('nova_font_cache', val);
        if (key === 'weatherEnabled') localStorage.setItem('nova_weather_enabled', val);
        if (key === 'timeEnabled') localStorage.setItem('nova_time_enabled', val);
        if (key === 'dateEnabled') localStorage.setItem('nova_date_enabled', val);
        if (key === 'greetingsEnabled') localStorage.setItem('nova_greetings_enabled', val);
        if (key === 'searchAutoColor') localStorage.setItem('nova_search_auto', val);
        if (triggerFunc) triggerFunc();
        preCalculateNextBackground(); 
    };

    [
        inputs.blur, inputs.searchBlur, inputs.brightness, inputs.fade, inputs.searchOpacity,
        inputs.searchWidth, inputs.searchFontSize, inputs.clockSize, inputs.dateSize, 
        inputs.greetingSize, inputs.weatherSize
    ].forEach(slider => {
        slider.addEventListener('input', e => {
            updateSliderFill(e.target);
            const map = { 
                'i_blur': 'bgBlur', 'i_search_blur': 'searchBlur', 'i_brightness': 'bgBrightness', 
                'i_fade': 'bgFade', 'i_search_opacity': 'searchBgOpacity',
                'i_search_width': 'searchWidth', 'i_search_font': 'searchFontSize',
                'i_clock_size': 'clockSize', 'i_date_size': 'dateSize', 
                'i_greeting_size': 'greetingSize', 'i_weather_size': 'weatherSize'
            };
            const val = parseInt(e.target.value);
            updateSetting(map[e.target.id], val);
        });
    });

    inputs.font.addEventListener('change', e => updateSetting('font', e.target.value));
    inputs.textColor.addEventListener('input', e => updateSetting('textColor', e.target.value));
    inputs.engine.addEventListener('change', e => updateSetting('engine', e.target.value));
    
    inputs.searchAutoColor.addEventListener('change', e => {
        updateSetting('searchAutoColor', e.target.checked);
        if (e.target.checked) loadBackground(false, false); 
    });
    inputs.searchBgColor.addEventListener('input', e => updateSetting('searchBgColor', e.target.value));

    inputs.bgType.addEventListener('change', e => updateSetting('bgType', e.target.value, () => loadBackground(false, false)));
    inputs.bgFrequency.addEventListener('change', e => updateSetting('bgFrequency', e.target.value));
    inputs.wallhavenMode.addEventListener('change', e => { settings.wallhavenQueue = []; updateSetting('wallhavenMode', e.target.value, () => loadBackground(true, false)); });
    
    const applyTag = () => { settings.wallhavenQueue = []; updateSetting('wallhavenQuery', inputs.wallhaven.value, () => loadBackground(true, false)); };
    document.getElementById('b_apply_wallhaven').addEventListener('click', applyTag);
    inputs.wallhaven.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyTag(); } });

    inputs.timeEnable.addEventListener('change', e => updateSetting('timeEnabled', e.target.checked));
    inputs.time12h.addEventListener('change', e => updateSetting('time12h', e.target.checked));
    inputs.timeSeconds.addEventListener('change', e => updateSetting('timeSeconds', e.target.checked));
    inputs.dateEnable.addEventListener('change', e => updateSetting('dateEnabled', e.target.checked));
    inputs.weatherEnable.addEventListener('change', e => updateSetting('weatherEnabled', e.target.checked, updateWeather));
    inputs.weatherUnit.addEventListener('change', e => updateSetting('weatherUnit', e.target.value, updateWeather));
    inputs.weatherService.addEventListener('change', e => updateSetting('weatherService', e.target.value, updateWeather));
    inputs.greetingsEnable.addEventListener('change', e => updateSetting('greetingsEnabled', e.target.checked));
    
    const applyCity = () => updateSetting('weatherCity', inputs.weatherCity.value, updateWeather);
    document.getElementById('b_apply_city').addEventListener('click', applyCity);
    inputs.weatherCity.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyCity(); } });

    document.getElementById('b_refresh_bg').addEventListener('click', () => loadBackground(true, false));
    document.getElementById('b_next_wh').addEventListener('click', () => loadBackground(true, false));

    const domSettings = document.getElementById('settings');
    const domSettingsToggleBtn = document.getElementById('settings-toggle-btn');
    const toggleSettings = (forceState) => {
        const state = forceState !== undefined ? forceState : !domSettings.classList.contains('shown');
        domSettings.classList.toggle('shown', state); domInterface.classList.toggle('pushed', state); domSettingsToggleBtn.classList.toggle('active', state);
    };
    domSettingsToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSettings(); });
    document.getElementById('close-settings-btn').addEventListener('click', () => toggleSettings(false));
    document.addEventListener('click', (e) => { if (!domSettings.contains(e.target) && !document.getElementById('show-settings').contains(e.target) && domSettings.classList.contains('shown')) toggleSettings(false); });

    // --- 10. POWER-USER HOTKEYS & ZEN MODE ---
    const shortcutsModal = document.getElementById('shortcuts-modal');
    const toggleShortcutsModal = (forceState) => {
        const state = forceState !== undefined ? forceState : shortcutsModal.classList.contains('hidden');
        shortcutsModal.classList.toggle('hidden', !state);
    };

    document.getElementById('b_show_shortcuts').addEventListener('click', () => toggleShortcutsModal(true));
    document.getElementById('close-shortcuts-btn').addEventListener('click', () => toggleShortcutsModal(false));
    shortcutsModal.addEventListener('click', (e) => {
        if (e.target === shortcutsModal) toggleShortcutsModal(false);
    });

    const toggleZenMode = () => {
        const isZen = document.body.classList.toggle('zen-mode');
        showToast(isZen ? "Zen Mode: UI hidden (Press H or Esc to exit)" : "Zen Mode off");
    };

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

        if (key === 'escape' || code === 'Escape') {
            if (!shortcutsModal.classList.contains('hidden')) {
                toggleShortcutsModal(false);
                return;
            }
            if (document.body.classList.contains('zen-mode')) {
                toggleZenMode();
                return;
            }
            if (domSettings.classList.contains('shown')) {
                toggleSettings(false);
                return;
            }
            return;
        }

        if (isInputFocused) return;

        // Quick focus search: '/' or 'Space'
        if (code === 'Slash' || key === '/' || key === '.' || code === 'Space' || key === ' ') {
            e.preventDefault();
            searchInput.focus();
            return;
        }

        // Toggle Mode (Wallhaven <-> Local): 'M'
        if (code === 'KeyM' || key === 'm' || key === 'ь') {
            e.preventDefault();
            const newType = settings.bgType === 'wallhaven' ? 'local' : 'wallhaven';
            await updateSetting('bgType', newType, () => loadBackground(false, false));
            showToast(`Mode: ${newType === 'wallhaven' ? 'Wallhaven' : 'Local files'}`);
            return;
        }

        // Zen Mode: 'H' or 'Z'
        if (code === 'KeyH' || key === 'h' || key === 'р' || code === 'KeyZ' || key === 'z' || key === 'я') {
            e.preventDefault();
            toggleZenMode();
            return;
        }

        // Toggle Settings: 'O' or ','
        if (code === 'KeyO' || key === 'o' || key === 'щ' || code === 'Comma' || key === ',') {
            e.preventDefault();
            toggleSettings();
            return;
        }

        // Next Wallpaper: 'N' or 'ArrowRight' (silent, no toast)
        if (code === 'KeyN' || key === 'n' || key === 'т' || code === 'ArrowRight' || key === 'arrowright') {
            e.preventDefault();
            loadBackground(true, false);
            return;
        }

        // Previous Wallpaper: 'P' or 'ArrowLeft' (silent, no toast)
        if (code === 'KeyP' || key === 'p' || key === 'з' || code === 'ArrowLeft' || key === 'arrowleft') {
            e.preventDefault();
            if (settings.bgType === 'wallhaven') {
                if (settings.wallhavenHistory.length > 0) {
                    settings.wallhavenQueue.unshift(settings.wallhavenHistory.pop());
                    await storage.setSettings(settings);
                    loadBackground(false, false);
                }
            } else {
                const gallery = await storage.getGallery();
                if (gallery.length > 1) {
                    let idx = gallery.findIndex(img => img.id === settings.selectedLocalBg);
                    idx = (idx - 1 + gallery.length) % gallery.length;
                    settings.selectedLocalBg = gallery[idx].id;
                    await storage.setSettings(settings);
                    loadBackground(false, false);
                }
            }
            return;
        }

        // Save Wallpaper to Local: 'S'
        if (code === 'KeyS' || key === 's' || key === 'ы') {
            e.preventDefault();
            if (settings.bgType === 'wallhaven') {
                await saveCurrentWallhaven();
            } else {
                showToast("Already using Local wallpaper");
            }
            return;
        }
    });

    // --- STARTUP LOGIC ---
    async function startExtension() {
        applySettingsToDOM();
        updateWeather();
        
        const consumedBg = localStorage.getItem('nova_startup_bg');
        if (consumedBg || localStorage.getItem('nova_startup_bg_id')) {
            await loadBackground(false, true); 
        } else {
            await loadBackground(false, true);
        }
    }

    startExtension();
});