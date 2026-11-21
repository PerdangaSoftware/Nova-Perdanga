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

    const manualColorWrap = document.getElementById('manual-color-wrapper');
    if (manualColorWrap && s.searchAutoColor !== undefined) {
        manualColorWrap.classList.toggle('hidden', s.searchAutoColor);
    }
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
})();