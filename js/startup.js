(() => {
    try {
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
        let snapshot = null;
        try {
            const raw = localStorage.getItem('nova_snapshot');
            if (raw) snapshot = JSON.parse(raw);
        } catch {}

        let s = snapshot?.settings || null;
        if (!s) {
            try {
                const cached = localStorage.getItem('nova_settings_cache');
                if (cached) s = JSON.parse(cached);
            } catch {}
        }
        if (!s) s = {};

        const isSettingsOpen = snapshot?.ui?.settingsOpen ?? (localStorage.getItem('nova_settings_open') === '1');
        const isDrawerOpen = snapshot?.ui?.drawerOpen ?? (localStorage.getItem('nova_drawer_open') === '1');
        const isZenMode = snapshot?.ui?.zenMode ?? (localStorage.getItem('nova_zen_mode') === '1');

        if (isSettingsOpen) {
            document.documentElement.classList.add('init-settings-open');
        }
        if (isDrawerOpen) {
            document.documentElement.classList.add('init-drawer-open');
        }
        if (isZenMode) {
            document.documentElement.classList.add('zen-mode');
        }
        if (s.bgType === 'local') {
            document.documentElement.classList.add('init-bg-local');
        }

        const getBoolSetting = (snapVal, key, defaultVal) => {
            if (snapVal !== undefined) return snapVal;
            const val = localStorage.getItem(key);
            return val !== null ? val === 'true' : defaultVal;
        };

        const timeEnabled = getBoolSetting(s.timeEnabled, 'nova_time_enabled', true);
        const dateEnabled = getBoolSetting(s.dateEnabled, 'nova_date_enabled', true);
        const weatherEnabled = getBoolSetting(s.weatherEnabled, 'nova_weather_enabled', true);
        const greetingsEnabled = getBoolSetting(s.greetingsEnabled, 'nova_greetings_enabled', true);

        let hideCss = '';
        if (!timeEnabled) hideCss += 'html:not(.ready) #time { display: none !important; }\n';
        if (!dateEnabled) hideCss += 'html:not(.ready) #date { display: none !important; }\n';
        if (!weatherEnabled) hideCss += 'html:not(.ready) #weather { display: none !important; }\n';
        if (!greetingsEnabled) hideCss += 'html:not(.ready) #greeting { display: none !important; }\n';
        if (s.bgType === 'local') {
            hideCss += 'html:not(.ready) #drawer-search-bar, html:not(.ready) #b_drawer_filter_toggle, html:not(.ready) #drawer-quick-filters, html:not(.ready) #b_drawer_save, html:not(.ready) #drawer-wh-details-card { display: none !important; }\n';
            hideCss += 'html:not(.ready) #drawer-local-upload-card { display: block !important; }\n';
            hideCss += 'html:not(.ready) #local-options { display: block !important; }\n';
            const localTotal = parseInt(localStorage.getItem('nova_gallery_count') || '0');
            const localOffset = parseInt(localStorage.getItem('nova_local_preview_offset') || '0');
            if (localTotal > 0) {
                const countOnPage = Math.min(10, Math.max(1, localTotal - localOffset));
                const rows = Math.ceil(countOnPage / 2);
                const approxHeight = rows * 94 + (rows - 1) * 10;
                hideCss += `html:not(.ready) #wallhaven-preview-grid { min-height: ${approxHeight}px; }\n`;
                const galleryRows = Math.ceil(Math.min(localTotal, 12) / 3);
                hideCss += `html:not(.ready) #local-gallery { min-height: ${galleryRows * 72 + (galleryRows - 1) * 8}px; }\n`;
            }
        } else {
            hideCss += 'html:not(.ready) #wallhaven-preview-grid { min-height: 508px; }\n';
            hideCss += 'html:not(.ready) #local-options { display: none !important; }\n';
        }
        if (s.searchAutoColor === false) {
            hideCss += 'html:not(.ready) #manual-color-wrapper { display: flex !important; }\n';
        } else if (s.searchAutoColor === true) {
            hideCss += 'html:not(.ready) #manual-color-wrapper { display: none !important; }\n';
        }

        const cachedFont = s.font || localStorage.getItem('nova_font_cache') || "'Outfit', sans-serif";
        if (cachedFont) {
            hideCss += `:root { --font-family: ${cachedFont}; }\n`;
        }

        if (s.textColor) {
            hideCss += `:root { --text-color: ${s.textColor}; }\n`;
        }
        if (s.bgBlur !== undefined) hideCss += `:root { --bg-blur: ${s.bgBlur}px; }\n`;
        if (s.searchBlur !== undefined) hideCss += `:root { --search-blur: ${s.searchBlur}px; }\n`;
        if (s.searchBgOpacity !== undefined) hideCss += `:root { --search-bg-opacity: ${s.searchBgOpacity / 100}; }\n`;
        if (s.bgBrightness !== undefined) hideCss += `:root { --bg-brightness: ${s.bgBrightness / 100}; }\n`;
        if (s.bgFade !== undefined) hideCss += `:root { --bg-fade: ${s.bgFade}ms; }\n`;
        if (s.searchWidth !== undefined) hideCss += `:root { --search-width: ${s.searchWidth}px; }\n`;
        if (s.searchFontSize !== undefined) hideCss += `:root { --search-font-size: ${s.searchFontSize / 10}rem; }\n`;
        if (s.clockSize !== undefined) hideCss += `:root { --clock-size: ${s.clockSize / 10}rem; }\n`;
        if (s.dateSize !== undefined) hideCss += `:root { --date-size: ${s.dateSize / 10}rem; }\n`;
        if (s.greetingSize !== undefined) hideCss += `:root { --greeting-size: ${s.greetingSize / 10}rem; }\n`;
        if (s.weatherSize !== undefined) hideCss += `:root { --weather-size: ${s.weatherSize / 10}rem; }\n`;

        if (s.searchAutoColor === false && s.searchBgColor) {
            const hex = s.searchBgColor;
            const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
            if (!isNaN(r)) {
                hideCss += `:root { --search-bg-r: ${r}; --search-bg-g: ${g}; --search-bg-b: ${b}; }\n`;
            }
        } else {
            const savedColor = localStorage.getItem('nova_startup_bg_color');
            if (savedColor) {
                try {
                    const c = JSON.parse(savedColor);
                    hideCss += `:root { --search-bg-r: ${c.r}; --search-bg-g: ${c.g}; --search-bg-b: ${c.b}; }\n`;
                } catch {}
            }
        }

        const ranges = [
            ['i_search_width', s.searchWidth ?? 500, 300, 1000],
            ['i_search_font', s.searchFontSize ?? 12, 8, 24],
            ['i_search_blur', s.searchBlur ?? 10, 0, 30],
            ['i_search_opacity', s.searchBgOpacity ?? 25, 0, 100],
            ['i_clock_size', s.clockSize ?? 80, 40, 150],
            ['i_date_size', s.dateSize ?? 15, 10, 30],
            ['i_greeting_size', s.greetingSize ?? 25, 15, 50],
            ['i_weather_size', s.weatherSize ?? 11, 8, 25],
            ['i_local_pos', s.bgPosition ?? 50, 0, 100],
            ['i_blur', s.bgBlur ?? 0, 0, 20],
            ['i_brightness', s.bgBrightness ?? 100, 10, 100],
            ['i_fade', s.bgFade ?? 1000, 0, 3000]
        ];
        for (const [id, val, min, max] of ranges) {
            const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
            hideCss += `#${id} { --slider-fill: ${pct}% !important; }\n`;
        }

        if (hideCss) {
            const style = document.createElement('style');
            style.id = 'startup-hide-css';
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
