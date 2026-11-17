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

        if (localStorage.getItem('nova_settings_open') === '1') {
            document.documentElement.classList.add('init-settings-open');
        }
        if (localStorage.getItem('nova_drawer_open') === '1') {
            document.documentElement.classList.add('init-drawer-open');
        }
        if (localStorage.getItem('nova_zen_mode') === '1') {
            document.documentElement.classList.add('zen-mode');
        }

        let hideCss = '';
        if (!timeEnabled) hideCss += '#time { display: none !important; }\n';
        if (!dateEnabled) hideCss += '#date { display: none !important; }\n';
        if (!weatherEnabled) hideCss += '#weather { display: none !important; }\n';
        if (!greetingsEnabled) hideCss += '#greeting { display: none !important; }\n';
        
        const cachedFont = localStorage.getItem('nova_font_cache') || "'Outfit', sans-serif";
        if (cachedFont) {
            hideCss += `:root { --font-family: ${cachedFont}; }\n`;
        }
        
        if (hideCss) {
            const style = document.createElement('style');
            style.textContent = hideCss;
            document.head.appendChild(style);
        }

        if (cachedFont && document.fonts && document.fonts.load) {
            const fontNameMatch = cachedFont.match(/['"]?([^'"]+)['"]?/);
            if (fontNameMatch && fontNameMatch[1]) {
                const fontName = fontNameMatch[1];
                document.fonts.load(`400 16px "${fontName}"`).catch(() => {});
                document.fonts.load(`300 16px "${fontName}"`).catch(() => {});
                document.fonts.load(`500 16px "${fontName}"`).catch(() => {});
            }
        }

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
