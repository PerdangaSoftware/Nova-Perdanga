(() => {
    let s = null;
    try {
        const raw = localStorage.getItem('nova_snapshot');
        if (raw) s = JSON.parse(raw)?.settings;
    } catch {}
    if (!s) {
        try {
            const cached = localStorage.getItem('nova_settings_cache');
            if (cached) s = JSON.parse(cached);
        } catch {}
    }
    if (!s) s = {};

    const ranges = [
        ['i_blur', s.bgBlur, 'v_blur', 'px', 0, 20],
        ['i_search_blur', s.searchBlur, 'v_search_blur', 'px', 0, 30],
        ['i_search_opacity', s.searchBgOpacity, 'v_search_opacity', '%', 0, 100],
        ['i_brightness', s.bgBrightness, 'v_brightness', '%', 10, 100],
        ['i_fade', s.bgFade, 'v_fade', 'ms', 0, 3000],
        ['i_search_width', s.searchWidth, 'v_search_width', 'px', 300, 1000],
        ['i_search_font', s.searchFontSize, 'v_search_font', 'rem', 8, 24, 10],
        ['i_clock_size', s.clockSize, 'v_clock_size', 'rem', 40, 150, 10],
        ['i_date_size', s.dateSize, 'v_date_size', 'rem', 10, 30, 10],
        ['i_greeting_size', s.greetingSize, 'v_greeting_size', 'rem', 15, 50, 10],
        ['i_weather_size', s.weatherSize, 'v_weather_size', 'rem', 8, 25, 10],
        ['i_drawer_local_pos', s.bgPosition, 'drawer-v-local-pos', '%', 0, 100]
    ];

    for (const [id, val, badgeId, unit, min, max, divisor] of ranges) {
        if (val === undefined || val === null) continue;
        const input = document.getElementById(id);
        if (input) {
            input.value = val;
            const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
            input.style.setProperty('--slider-fill', `${pct}%`);
            input.style.background = `linear-gradient(to right, #14b8a6 0%, #14b8a6 ${pct}%, rgba(255, 255, 255, 0.12) ${pct}%, rgba(255, 255, 255, 0.12) 100%)`;
        }
        const badge = document.getElementById(badgeId);
        if (badge) {
            const displayVal = divisor ? (val / divisor).toFixed(1) : val;
            badge.textContent = `${displayVal}${unit}`;
        }
    }

    const setChecked = (id, val) => {
        if (val === undefined) return;
        const el = document.getElementById(id);
        if (el) el.checked = Boolean(val);
    };
    setChecked('i_time_enable', s.timeEnabled);
    setChecked('i_time_12h', s.time12h);
    setChecked('i_time_seconds', s.timeSeconds);
    setChecked('i_date_enable', s.dateEnabled);
    setChecked('i_greetings_enable', s.greetingsEnabled);
    setChecked('i_weather_enable', s.weatherEnabled);
    setChecked('i_search_auto_color', s.searchAutoColor);
    setChecked('i_shortcuts_enable', Boolean(s.shortcutsEnabled));

    const setValue = (id, val) => {
        if (!val) return;
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
    setValue('i_font', s.font);
    setValue('i_engine', s.engine);
    setValue('i_bg_type', s.bgType);
    setValue('i_weather_city', s.weatherCity);
    setValue('i_weather_unit', s.weatherUnit);
    setValue('i_weather_service', s.weatherService);
    setValue('i_text_color', s.textColor);
    setValue('i_search_bg_color', s.searchBgColor);
    setValue('i_shortcuts_position', s.shortcutsPosition || 'bottom');
    setValue('i_shortcuts_size', s.shortcutsSize || 'medium');

    const manualColorWrap = document.getElementById('manual-color-wrapper');
    if (manualColorWrap && s.searchAutoColor !== undefined) {
        manualColorWrap.classList.toggle('hidden', s.searchAutoColor);
    }
    const posWrap = document.getElementById('shortcuts-position-wrapper');
    const sizeWrap = document.getElementById('shortcuts-size-wrapper');
    const scEnabled = Boolean(s.shortcutsEnabled);
    if (posWrap) posWrap.classList.toggle('hidden', !scEnabled);
    if (sizeWrap) sizeWrap.classList.toggle('hidden', !scEnabled);
    const whOptions = document.getElementById('wallhaven-options');
    if (whOptions && s.bgType) {
        whOptions.classList.toggle('hidden', s.bgType !== 'wallhaven');
    }

    const countBadge = document.getElementById('v_wallhaven_preview_count');
    const launcherBadge = document.getElementById('v_wallhaven_preview_count_badge');
    const drawerMode = document.getElementById('v_wallhaven_drawer_mode');
    const tabWallhaven = document.getElementById('b_drawer_tab_wallhaven');
    const tabLocal = document.getElementById('b_drawer_tab_local');
    const searchBar = document.getElementById('drawer-search-bar');
    const filterToggle = document.getElementById('b_drawer_filter_toggle');
    const quickFilters = document.getElementById('drawer-quick-filters');
    const btnDrawerSave = document.getElementById('b_drawer_save');
    const btnPrev = document.getElementById('b_prev_wh_preview');
    const btnNext = document.getElementById('b_next_wh_preview');
    const activeCard = document.getElementById('drawer-active-card');
    const uploadCard = document.getElementById('drawer-local-upload-card');
    const grid = document.getElementById('wallhaven-preview-grid');

    const isLocal = s.bgType === 'local';
    if (isLocal) {
        if (drawerMode) drawerMode.textContent = 'Local Files';
        if (tabWallhaven) tabWallhaven.classList.remove('active');
        if (tabLocal) tabLocal.classList.add('active');
        if (btnDrawerSave) btnDrawerSave.classList.add('hidden');
        if (searchBar) searchBar.classList.add('hidden');
        if (filterToggle) filterToggle.classList.add('hidden');
        if (quickFilters) quickFilters.classList.add('hidden');
        if (uploadCard) uploadCard.classList.remove('hidden');

        const localTotal = parseInt(localStorage.getItem('nova_gallery_count') || '0');
        let localOffset = parseInt(localStorage.getItem('nova_local_preview_offset') || '0');
        const localSliceRaw = localStorage.getItem('nova_local_slice_cache');
        let cachedSlice = null;
        if (localSliceRaw) {
            try {
                cachedSlice = JSON.parse(localSliceRaw);
                if (cachedSlice && typeof cachedSlice.offset === 'number') {
                    localOffset = cachedSlice.offset;
                }
            } catch {}
        }
        if (localTotal > 0) {
            const countOnPage = (cachedSlice && Array.isArray(cachedSlice.items) && cachedSlice.items.length > 0)
                ? cachedSlice.items.length
                : Math.min(10, Math.max(1, localTotal - localOffset));
            const fromNum = localOffset + 1;
            const toNum = localOffset + countOnPage;
            const countText = `${fromNum}-${toNum} / ${localTotal}`;
            if (countBadge) countBadge.textContent = countText;
            if (launcherBadge) launcherBadge.textContent = countText;
            const hasMultiple = localTotal > 10;
            if (btnPrev) btnPrev.disabled = !hasMultiple;
            if (btnNext) btnNext.disabled = !hasMultiple;
        }

        if (grid && cachedSlice && Array.isArray(cachedSlice.items) && cachedSlice.items.length > 0) {
            const activeId = localStorage.getItem('nova_startup_bg_id') || s.selectedLocalBg || cachedSlice.activeId;
            const frag = document.createDocumentFragment();
            cachedSlice.items.forEach((img, i) => {
                const item = document.createElement('div');
                const isSelected = (img.id === activeId);
                item.className = 'wh-preview-item' + (isSelected ? ' selected' : '');
                item.dataset.id = img.id;
                item.style.backgroundImage = `url('${img.thumb}')`;
                item.title = `Wallpaper #${cachedSlice.offset + i + 1}${isSelected ? '' : ' (Click to set)'}`;
                frag.appendChild(item);
            });
            grid.replaceChildren(frag);
        }

        if (activeCard) {
            const currentId = localStorage.getItem('nova_startup_bg_id') || s.selectedLocalBg;
            const startupBg = localStorage.getItem('nova_startup_bg');
            if (startupBg || currentId) {
                activeCard.classList.remove('hidden');
                const titleEl = activeCard.querySelector('.active-card-title');
                if (titleEl) titleEl.textContent = 'ON SCREEN (Local)';
                const pulseBadge = activeCard.querySelector('.active-pulse-badge');
                if (pulseBadge) pulseBadge.textContent = '● Active';
                const thumbEl = document.getElementById('active-card-thumb');
                if (thumbEl && startupBg) thumbEl.style.backgroundImage = `url('${startupBg}')`;
                const resEl = document.getElementById('active-card-res');
                if (resEl) resEl.textContent = 'Local File';
                const colorsEl = document.getElementById('active-card-colors');
                if (colorsEl) colorsEl.replaceChildren();
                const viewBtn = document.getElementById('active-card-view-btn');
                if (viewBtn) {
                    viewBtn.style.display = 'inline-flex';
                    const span = viewBtn.querySelector('span');
                    if (span) span.textContent = 'View';
                }
                const delBtn = document.getElementById('active-card-delete-btn');
                if (delBtn) delBtn.classList.remove('hidden');
            }
        }
    } else {
        if (btnDrawerSave) {
            btnDrawerSave.classList.remove('hidden');
            btnDrawerSave.innerHTML = '★ Save';
        }
        if (searchBar) searchBar.classList.remove('hidden');
        if (filterToggle) filterToggle.classList.remove('hidden');
        if (tabWallhaven) tabWallhaven.classList.add('active');
        if (tabLocal) tabLocal.classList.remove('active');
        if (uploadCard) uploadCard.classList.add('hidden');

        let pool = [];
        try {
            pool = JSON.parse(localStorage.getItem('nova_wh_pool') || '[]');
        } catch {}
        let whOffset = parseInt(localStorage.getItem('nova_wh_preview_offset') || '0');
        const whTotal = parseInt(localStorage.getItem('nova_wh_total') || '0');
        const currentActive = localStorage.getItem('nova_startup_bg_wh_url') || localStorage.getItem('nova_active_wh_url') || localStorage.getItem('nova_startup_bg');

        if (currentActive && pool.length > 0) {
            const activeIdx = pool.findIndex(item => item.path === currentActive || (item.path && currentActive && item.path.split('/').pop() === currentActive.split('/').pop()));
            if (activeIdx !== -1) {
                whOffset = Math.floor(activeIdx / 10) * 10;
                localStorage.setItem('nova_wh_preview_offset', String(whOffset));
            }
        }

        const totalCount = whTotal || pool.length;
        if (totalCount > 0) {
            const fromNum = whOffset + 1;
            const toNum = Math.min(whOffset + 10, totalCount);
            const countText = `${fromNum}-${toNum} / ${totalCount}`;
            if (countBadge) countBadge.textContent = countText;
            if (launcherBadge) launcherBadge.textContent = countText;
            const hasMultipleWh = totalCount > 10;
            if (btnPrev) btnPrev.disabled = !hasMultipleWh;
            if (btnNext) btnNext.disabled = !hasMultipleWh;
        }

        if (drawerMode) {
            const mode = s.wallhavenMode || 'search';
            if (mode === 'top') {
                drawerMode.textContent = `Toplist (${s.wallhavenTopRange || '1M'})`;
            } else if (mode === 'search') {
                drawerMode.textContent = s.wallhavenQuery ? `Tag: ${s.wallhavenQuery}` : 'Search';
            } else {
                drawerMode.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
            }
        }

        const currentSlice = (pool.length > 0) ? pool.slice(whOffset, whOffset + 10) : [];
        if (grid && currentSlice.length > 0) {
            const frag = document.createDocumentFragment();
            currentSlice.forEach(img => {
                const item = document.createElement('div');
                const isSelected = Boolean(currentActive && img.path && (currentActive === img.path || (currentActive.split('/').pop() === img.path.split('/').pop())));
                item.className = 'wh-preview-item' + (isSelected ? ' selected' : '');
                item.dataset.path = img.path;
                item.style.backgroundImage = `url('${img.thumb || img.path}')`;
                if (img.resolution) item.title = `${img.resolution}${isSelected ? '' : ' (Click to set)'}`;
                frag.appendChild(item);
            });
            grid.replaceChildren(frag);
        }

        if (activeCard) {
            const currentUrl = localStorage.getItem('nova_startup_bg_wh_url') || localStorage.getItem('nova_active_wh_url') || localStorage.getItem('nova_startup_bg');
            if (currentUrl) {
                activeCard.classList.remove('hidden');
                const titleEl = activeCard.querySelector('.active-card-title');
                if (titleEl) titleEl.textContent = 'ON SCREEN (Wallhaven)';
                const pulseBadge = activeCard.querySelector('.active-pulse-badge');
                if (pulseBadge) pulseBadge.textContent = '● Active';
                const thumbEl = document.getElementById('active-card-thumb');
                const resEl = document.getElementById('active-card-res');
                const colorsEl = document.getElementById('active-card-colors');
                const viewBtn = document.getElementById('active-card-view-btn');
                const delBtn = document.getElementById('active-card-delete-btn');
                if (delBtn) delBtn.classList.add('hidden');

                let meta = null;
                try {
                    const cachedMeta = localStorage.getItem('nova_active_wh_meta');
                    if (cachedMeta) meta = JSON.parse(cachedMeta);
                } catch {}
                if (!meta || !meta.path || (meta.path !== currentUrl && !currentUrl.includes(meta.path.split('/').pop()))) {
                    meta = pool.find(item => item.path === currentUrl || (item.path && currentUrl && item.path.split('/').pop() === currentUrl.split('/').pop()));
                }

                const thumbUrl = meta?.thumb || currentUrl;
                if (thumbEl) thumbEl.style.backgroundImage = `url('${thumbUrl}')`;
                if (resEl) resEl.textContent = meta?.resolution || 'Wallhaven HD';

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
                    viewBtn.href = currentUrl;
                }
            }
        }
    }

    try {
        const timeEl = document.getElementById('time');
        const clockEl = document.getElementById('clock');
        const dateEl = document.getElementById('date');
        if (s.timeEnabled === false) {
            if (timeEl) timeEl.style.display = 'none';
        } else if (clockEl) {
            const now = new Date();
            let h = now.getHours();
            const m = String(now.getMinutes()).padStart(2, '0');
            if (s.time12h) {
                h = h % 12 || 12;
            }
            let timeStr = `${String(h).padStart(2, '0')}:${m}`;
            if (s.timeSeconds) {
                timeStr += `:${String(now.getSeconds()).padStart(2, '0')}`;
            }
            clockEl.textContent = timeStr;
        }
        if (s.dateEnabled === false) {
            if (dateEl) dateEl.style.display = 'none';
        } else if (dateEl) {
            const now = new Date();
            dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        }
    } catch {}

    try {
        const wEl = document.getElementById('weather');
        if (s.weatherEnabled === false) {
            if (wEl) wEl.style.display = 'none';
        } else if (wEl) {
            const rawWeather = localStorage.getItem('nova_weather_cache');
            if (rawWeather) {
                const w = JSON.parse(rawWeather);
                const tempEl = document.getElementById('weather-temp');
                const descEl = document.getElementById('weather-desc');
                const iconEl = document.getElementById('weather-icon');
                if (tempEl && w.temp) tempEl.textContent = w.temp;
                if (descEl && w.desc) descEl.textContent = w.desc;
                if (iconEl && w.icon) iconEl.textContent = w.icon;
                if (w.serviceUrl) wEl.href = w.serviceUrl;
                wEl.classList.remove('hidden');
            }
        }
    } catch {}

    try {
        const bar = document.getElementById('shortcuts-bar');
        const grid = document.getElementById('shortcuts-grid');
        const searchContainer = document.getElementById('search-container');
        if (bar && grid) {
            const isEnabled = Boolean(s.shortcutsEnabled);
            if (!isEnabled) {
                bar.classList.add('hidden');
            } else {
                const pos = s.shortcutsPosition || 'bottom';
                const size = s.shortcutsSize || 'medium';
                bar.classList.remove('hidden', 'size-small', 'size-medium', 'size-large', 'pos-top', 'pos-bottom');
                bar.classList.add(`size-${size}`, `pos-${pos}`);
                if (searchContainer) {
                    searchContainer.classList.remove('shortcuts-pos-top', 'shortcuts-pos-bottom');
                    searchContainer.classList.add(`shortcuts-pos-${pos}`);
                }
            let iconCache = {};
            try {
                const rawIconCache = localStorage.getItem('nova_shortcut_cache_v4');
                if (rawIconCache) iconCache = JSON.parse(rawIconCache);
            } catch {}

            const presetSvgs = {
                web: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" class="shortcut-fallback-icon"><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.6" opacity="0.9"></circle><ellipse cx="12" cy="12" rx="4.5" ry="9.5" stroke="currentColor" stroke-width="1.4" opacity="0.75"></ellipse><path d="M2.5 12h19" stroke="currentColor" stroke-width="1.6" opacity="0.9"></path><path d="M4.5 7h15" stroke="currentColor" stroke-width="1.2" opacity="0.6"></path><path d="M4.5 17h15" stroke="currentColor" stroke-width="1.2" opacity="0.6"></path></svg>',
                film: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="shortcut-fallback-icon"><rect x="2" y="2" width="20" height="20" rx="3"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>',
                code: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="shortcut-fallback-icon"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>',
                star: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" class="shortcut-fallback-icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
                game: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="shortcut-fallback-icon"><rect x="2" y="6" width="20" height="12" rx="4"></rect><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><circle cx="15.5" cy="11.5" r="1" fill="currentColor"></circle><circle cx="17.5" cy="13.5" r="1" fill="currentColor"></circle></svg>',
                music: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="shortcut-fallback-icon"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>',
                chat: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="shortcut-fallback-icon"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>'
            };
            const shortcuts = Array.isArray(s.shortcuts) ? s.shortcuts : [];
            if (shortcuts.length > 0) {
                grid.innerHTML = '';
                shortcuts.slice(0, 8).forEach(item => {
                    const itemEl = document.createElement('a');
                    itemEl.className = 'shortcut-item';
                    itemEl.href = item.url;
                    itemEl.title = `${item.title} (${item.url})`;
                    itemEl.dataset.id = item.id;

                    const circle = document.createElement('div');
                    circle.className = 'shortcut-icon-circle';

                    if (item.customIcon) {
                        if (item.customIcon.startsWith('preset:')) {
                            const presetKey = item.customIcon.slice(7);
                            circle.innerHTML = presetSvgs[presetKey] || presetSvgs.web;
                        } else {
                            const img = document.createElement('img');
                            img.className = 'shortcut-favicon';
                            img.src = item.customIcon;
                            img.alt = item.title;
                            circle.appendChild(img);
                        }
                    } else {
                        const cached = iconCache[item.url];
                        if (cached === 'fallback') {
                            circle.innerHTML = presetSvgs.web;
                        } else {
                            let host = '';
                            try {
                                const u = new URL(item.url.startsWith('http') ? item.url : 'https://' + item.url);
                                host = u.hostname;
                            } catch {}
                            const favUrl = host ? `https://icons.duckduckgo.com/ip3/${host}.ico` : '';
                            if (favUrl) {
                                const img = document.createElement('img');
                                img.className = 'shortcut-favicon';
                                img.src = favUrl;
                                img.alt = item.title;
                                img.onload = () => {
                                    if (img.naturalWidth <= 16 && img.naturalHeight <= 16) {
                                        img.remove();
                                        circle.innerHTML = presetSvgs.web;
                                        try {
                                            iconCache[item.url] = 'fallback';
                                            localStorage.setItem('nova_shortcut_cache_v4', JSON.stringify(iconCache));
                                        } catch {}
                                    }
                                };
                                img.onerror = () => {
                                    img.remove();
                                    circle.innerHTML = presetSvgs.web;
                                    try {
                                        iconCache[item.url] = 'fallback';
                                        localStorage.setItem('nova_shortcut_cache_v4', JSON.stringify(iconCache));
                                    } catch {}
                                };
                                circle.appendChild(img);
                            } else {
                                circle.innerHTML = presetSvgs.web;
                            }
                        }
                    }

                    const titleEl = document.createElement('span');
                    titleEl.className = 'shortcut-title';
                    titleEl.textContent = item.title;

                    itemEl.appendChild(circle);
                    itemEl.appendChild(titleEl);
                    grid.appendChild(itemEl);
                });

                    if (shortcuts.length < 8) {
                        const addBtn = document.createElement('button');
                        addBtn.type = 'button';
                        addBtn.className = 'shortcut-add-btn';
                        addBtn.title = 'Add new shortcut';
                        addBtn.innerHTML = `
                            <div class="shortcut-add-circle">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                            </div>
                            <span class="shortcut-add-title">Add</span>
                        `;
                        grid.appendChild(addBtn);
                    }
                }
            }
        }
    } catch {}
})();