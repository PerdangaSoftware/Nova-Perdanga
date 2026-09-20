(() => {
    try {
        const getSetting = (key, defaultVal) => {
            const val = localStorage.getItem(key);
            return val !== null ? val === 'true' : defaultVal;
        };

        const timeEnabled = getSetting('nova_time_enabled', true);
        const dateEnabled = getSetting('nova_date_enabled', true);
        const weatherEnabled = getSetting('nova_weather_enabled', true);
        const greetingsEnabled = getSetting('nova_greetings_enabled', true);

        // 1. Inject synchronous CSS to completely hide elements that were disabled in settings 
        // without causing any layout shifts during loading.
        let hideCss = '';
        if (!timeEnabled) hideCss += '#time { display: none !important; }\n';
        if (!dateEnabled) hideCss += '#date { display: none !important; }\n';
        if (!weatherEnabled) hideCss += '#weather { display: none !important; }\n';
        if (!greetingsEnabled) hideCss += '#greeting { display: none !important; }\n';
        
        // Font: Apply the user's chosen font IMMEDIATELY before first paint to prevent
        // any font-swap flicker. The font is cached in localStorage by app.js.
        const cachedFont = localStorage.getItem('nova_font_cache');
        if (cachedFont) {
            hideCss += `:root { --font-family: ${cachedFont}; }\n`;
        }
        
        if (hideCss) {
            const style = document.createElement('style');
            style.textContent = hideCss;
            document.head.appendChild(style);
        }

        // Preload the user's font using the Font Loading API so it's ready before paint.
        // This eliminates FOUT (Flash of Unstyled Text) for non-default fonts.
        if (cachedFont && document.fonts && document.fonts.load) {
            const fontNameMatch = cachedFont.match(/['"]?([^'"]+)['"]?/);
            if (fontNameMatch && fontNameMatch[1]) {
                const fontName = fontNameMatch[1];
                // Preload all font weights used in the UI
                document.fonts.load(`400 16px "${fontName}"`).catch(() => {});
                document.fonts.load(`300 16px "${fontName}"`).catch(() => {});
                document.fonts.load(`500 16px "${fontName}"`).catch(() => {});
            }
        }

        // 2. Pre-configure the search box coloration seamlessly
        if (localStorage.getItem('nova_search_auto') === 'true') {
            try {
                const savedColor = localStorage.getItem('nova_startup_bg_color');
                if (savedColor) {
                    const c = JSON.parse(savedColor);
                    const rootStyle = document.createElement('style');
                    rootStyle.textContent = `:root { --search-bg-r: ${c.r}; --search-bg-g: ${c.g}; --search-bg-b: ${c.b}; }`;
                    document.head.appendChild(rootStyle);
                }
            } catch(e) {}
        }

        // 3. Initiate instantly grabbing High-Res image from IndexedDB.
        window.novaStartupBgPromise = new Promise((resolve) => {
            const startupBgId = localStorage.getItem('nova_startup_bg_id');
            const startupBgUrl = localStorage.getItem('nova_startup_bg');
            const startupBgType = localStorage.getItem('nova_startup_bg_type') || 'local';
            const startupBgPos = localStorage.getItem('nova_startup_bg_pos') || '50';

            const applyBgStyles = (url) => {
                const bgStyle = document.createElement('style');
                bgStyle.id = 'startup-bg-style';
                bgStyle.textContent = `#bg-1 { background-image: url('${url}'); background-position: center ${startupBgPos}%; }`;
                document.head.appendChild(bgStyle);
            };

            // Only attempt IndexedDB lookup for actual local blob files (type === 'local').
            // This natively prevents any flicker for Wallhaven saved backgrounds that are direct URLs.
            if (startupBgId && startupBgType === 'local') {
                const req = indexedDB.open('NovaPerdangaDB', 1);
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction('images', 'readonly');
                    const store = tx.objectStore('images');
                    const getReq = store.get(startupBgId);
                    
                    getReq.onsuccess = () => {
                        if (getReq.result) {
                            const url = URL.createObjectURL(getReq.result);
                            applyBgStyles(url);
                            resolve({ url, id: startupBgId });
                        } else {
                            if (startupBgUrl) applyBgStyles(startupBgUrl);
                            resolve({ url: startupBgUrl, id: startupBgId });
                        }
                    };
                    getReq.onerror = () => {
                        if (startupBgUrl) applyBgStyles(startupBgUrl);
                        resolve({ url: startupBgUrl, id: startupBgId });
                    };
                };
                req.onerror = () => {
                    if (startupBgUrl) applyBgStyles(startupBgUrl);
                    resolve({ url: startupBgUrl, id: startupBgId });
                };
            } else {
                if (startupBgUrl) applyBgStyles(startupBgUrl);
                resolve({ url: startupBgUrl, id: startupBgId });
            }
        });

    } catch (err) {
        console.error("Startup error:", err);
    }
})();