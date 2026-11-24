import state from './state.js';

export function initSearch() {
    const searchContainer = document.getElementById('search-container');
    const searchForm = document.getElementById('search-form') || searchContainer;
    const searchInput = document.getElementById('searchbar');
    const searchBtn = document.getElementById('search-btn');
    const searchClearBtn = document.getElementById('search-clear-btn');
    const domSearchSuggestions = document.getElementById('search-suggestions');
    const domSearchBangHud = document.getElementById('search-bang-hud');
    if (!searchContainer || !searchForm || !searchInput || !searchClearBtn || !domSearchSuggestions) return;

    let currentSuggFocus = -1;
    let currentSuggestions = [];
    let originalQuery = '';
    let isBangSuggestions = false;
    
    let currentAbortController = null;
    const suggestionCache = new Map();

    const BANGS = {
        '!pss': {
            key: '!pss',
            name: 'Perdanga Software Solutions',
            desc: 'gitlab.com/perdanga/perdanga-software-solutions',
            targetUrl: 'https://gitlab.com/perdanga/perdanga-software-solutions',
            color: '#fc6d26',
            bg: 'rgba(252, 109, 38, 0.15)',
            border: 'rgba(252, 109, 38, 0.3)',
            icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M22.65 14.39L20.17 6.77a.64.64 0 0 0-1.22 0l-2.48 7.62H7.53L5.05 6.77a.64.64 0 0 0-1.22 0L1.35 14.39a1.07 1.07 0 0 0 .39 1.19l10.26 7.45 10.26-7.45a1.07 1.07 0 0 0 .39-1.19z" fill="#fc6d26"/><path d="M12 23.03l4.46-13.72H7.54L12 23.03z" fill="#e24329"/><path d="M12 23.03L7.54 9.31H1.35l10.65 13.72z" fill="#fca326"/><path d="M1.35 14.39l-1.01 3.12a.64.64 0 0 0 .23.71L12 23.03 1.35 14.39z" fill="#e24329"/><path d="M12 23.03l11.43-4.81a.64.64 0 0 0 .23-.71l-1.01-3.12L12 23.03z" fill="#e24329"/><path d="M12 23.03l4.46-13.72h6.19L12 23.03z" fill="#fca326"/></svg>'
        },
        '!nova': {
            key: '!nova',
            name: 'Nova-Perdanga',
            desc: 'github.com/PerdangaSoftware/Nova-Perdanga',
            targetUrl: 'https://github.com/PerdangaSoftware/Nova-Perdanga',
            color: '#14b8a6',
            bg: 'rgba(20, 184, 166, 0.15)',
            border: 'rgba(20, 184, 166, 0.3)',
            icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><circle cx="12" cy="12" r="9.5" stroke="#14b8a6" stroke-width="1.8"></circle><polygon points="12 4 14.5 9.5 20 10.3 16 14.2 17 19.8 12 17.1 7 19.8 8 14.2 4 10.3 9.5 9.5 12 4" fill="#14b8a6"></polygon></svg>'
        },
        '!gh': {
            key: '!gh',
            name: 'GitHub',
            desc: 'github.com',
            targetUrl: 'https://github.com',
            searchUrl: (q) => `https://github.com/search?q=${encodeURIComponent(q)}`,
            color: '#f0f6fc',
            bg: 'rgba(255, 255, 255, 0.12)',
            border: 'rgba(255, 255, 255, 0.25)',
            icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>'
        },
        '!y': {
            key: '!y',
            name: 'YouTube',
            desc: 'youtube.com',
            targetUrl: 'https://www.youtube.com',
            searchUrl: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
            color: '#ff4444',
            bg: 'rgba(255, 0, 51, 0.15)',
            border: 'rgba(255, 0, 51, 0.3)',
            icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>'
        },
        '!wiki': {
            key: '!wiki',
            name: 'Wikipedia',
            desc: 'wikipedia.org',
            targetUrl: 'https://wikipedia.org',
            searchUrl: (q) => {
                const isCyrillic = /[а-яё]/i.test(q);
                const lang = isCyrillic ? 'ru' : 'en';
                return `https://${lang}.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`;
            },
            color: '#ffffff',
            bg: 'rgba(255, 255, 255, 0.12)',
            border: 'rgba(255, 255, 255, 0.25)',
            icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601 1.082 2.646 4.818 10.521 4.818 10.521l.136.046 2.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0 .105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136 1.422l1.582 3.252 1.758-3.504c.293-.64.233-.801.111-.947-.07-.084-.305-.22-.812-.24l-.201-.021c-.052 0-.098-.015-.145-.051-.045-.031-.067-.076-.067-.129v-.427l.061-.045c1.247-.008 4.043 0 4.043 0l.059.045v.436c0 .121-.059.178-.193.178-.646.03-.782.095-1.023.439-.12.186-.375.589-.646 1.039l-2.301 4.273-.065.135 2.792 5.712.17.048 4.396-10.438c.154-.422.129-.722-.064-.895-.197-.172-.346-.273-.857-.295l-.42-.016c-.061 0-.105-.014-.152-.045-.043-.029-.072-.075-.072-.119v-.436l.059-.045h4.961l.041.045v.437c0 .119-.074.18-.209.18-.648.03-1.127.18-1.443.421-.314.255-.557.616-.736 1.067 0 0-4.043 9.258-5.426 12.339-.525 1.007-1.053.917-1.503-.031-.571-1.171-1.773-3.786-2.646-5.71l.053-.036z"/></svg>'
        },
        '!r': {
            key: '!r',
            name: 'Reddit',
            desc: 'reddit.com',
            targetUrl: 'https://www.reddit.com',
            searchUrl: (q) => `https://www.reddit.com/search/?q=${encodeURIComponent(q)}`,
            color: '#ff5722',
            bg: 'rgba(255, 87, 34, 0.15)',
            border: 'rgba(255, 87, 34, 0.3)',
            icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="12" cy="12" r="10" fill="#ff4500"/><path d="M16.67 10.37a1.47 1.47 0 0 0-2.47-.73 6.94 6.94 0 0 0-4.14 0 1.47 1.47 0 0 0-2.47.73 1.46 1.46 0 0 0 .39 1.44 3.73 3.73 0 0 0-.08.76c0 2.22 2.24 4.02 5 4.02s5-1.8 5-4.02c0-.26-.03-.52-.08-.76a1.46 1.46 0 0 0 .85-1.44zm-6.17 1.33c0-.46.37-.83.83-.83s.83.37.83.83-.37.83-.83.83-.83-.37-.83-.83zm4.5 2.5a3.42 3.42 0 0 1-3 0 .25.25 0 0 1 .25-.43 2.92 2.92 0 0 0 2.5 0 .25.25 0 0 1 .25.43zm-.16-1.67c-.46 0-.83-.37-.83-.83s.37-.83.83-.83.83.37.83.83-.37.83-.83.83z" fill="#ffffff"/></svg>'
        }
    };

    const escapeHtml = (str) => {
        return String(str).replace(/[&<>"']/g, (m) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m]));
    };

    const toggleClearBtn = () => {
        if (searchInput.value.length > 0) {
            searchClearBtn.classList.remove('hide');
        } else {
            searchClearBtn.classList.add('hide');
        }
    };

    const hideHud = () => {
        if (domSearchBangHud) {
            domSearchBangHud.classList.add('hide');
        }
        if (searchBtn) {
            searchBtn.classList.remove('is-bang');
            searchBtn.style.removeProperty('--bang-color');
        }
    };

    const renderBangHud = (bang, query) => {
        if (!domSearchBangHud) return;
        const trimmedQuery = query ? query.trim() : '';
        const hasSearch = Boolean(trimmedQuery && typeof bang.searchUrl === 'function');
        const targetText = hasSearch
            ? `Search "${escapeHtml(trimmedQuery)}" on ${escapeHtml(bang.name)} ↗`
            : `${escapeHtml(bang.desc)} ↗`;
        const actionText = hasSearch ? 'Search ↵' : 'Open ↵';

        domSearchBangHud.style.setProperty('--bang-color', bang.color);
        domSearchBangHud.style.setProperty('--bang-bg', bang.bg);
        domSearchBangHud.style.setProperty('--bang-border', bang.border);

        domSearchBangHud.innerHTML = `
            <div class="search-bang-hud-left">
                <div class="search-bang-hud-icon">
                    ${bang.icon}
                </div>
                <div class="search-bang-hud-info">
                    <div class="search-bang-hud-header">
                        <span class="search-bang-hud-badge">${escapeHtml(bang.key)}</span>
                        <span class="search-bang-hud-name">${escapeHtml(bang.name)}</span>
                    </div>
                    <div class="search-bang-hud-target">${targetText}</div>
                </div>
            </div>
            <div class="search-bang-hud-action">
                <span>${actionText}</span>
            </div>
        `;

        domSearchBangHud.classList.remove('hide');
        if (searchBtn) {
            searchBtn.classList.add('is-bang');
            searchBtn.style.setProperty('--bang-color', bang.color);
        }
    };

    if (domSearchBangHud) {
        domSearchBangHud.addEventListener('click', () => {
            searchForm.dispatchEvent(new Event('submit', { cancelable: true }));
        });
    }

    searchClearBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        searchInput.value = '';
        originalQuery = '';
        toggleClearBtn();
        domSearchSuggestions.classList.add('hide');
        hideHud();
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
            const engine = state.settings.engine;
            let res, data, results;
            
            if (engine === 'ddg') {
                res = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(trimmedQuery)}`, { signal });
                data = await res.json();
                results = (data || []).map(i => i.phrase).slice(0, 8);
            } else if (engine === 'qwant') {
                res = await fetch(`https://api.qwant.com/v3/suggest?q=${encodeURIComponent(trimmedQuery)}`, { signal });
                data = await res.json();
                results = (data && data.data && Array.isArray(data.data.items)) ? data.data.items.map(i => i.value).slice(0, 8) : [];
            } else {
                res = await fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(trimmedQuery)}`, { signal });
                data = await res.json();
                results = (data[1] || []).slice(0, 8);
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
        isBangSuggestions = false;
        currentSuggestions = suggestions;
        currentSuggFocus = -1;

        if (!suggestions || suggestions.length === 0) {
            domSearchSuggestions.replaceChildren();
            domSearchSuggestions.classList.add('hide');
            return;
        }

        const items = suggestions.map((sugg, index) => {
            const li = document.createElement('li');
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', 'false');

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('width', '18');
            svg.setAttribute('height', '18');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '2');
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');
            svg.setAttribute('class', 'sugg-icon');

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '11');
            circle.setAttribute('cy', '11');
            circle.setAttribute('r', '8');

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', '21');
            line.setAttribute('y1', '21');
            line.setAttribute('x2', '16.65');
            line.setAttribute('y2', '16.65');

            svg.append(circle, line);

            const span = document.createElement('span');
            span.textContent = sugg;

            li.append(svg, span);

            li.addEventListener('mousedown', (e) => {
                e.preventDefault();
                searchInput.value = sugg;
                domSearchSuggestions.classList.add('hide');
                searchForm.dispatchEvent(new Event('submit', { cancelable: true }));
            });

            li.addEventListener('mouseenter', () => {
                updateSuggFocus(index, false);
            });

            return li;
        });

        domSearchSuggestions.replaceChildren(...items);
        domSearchSuggestions.classList.remove('hide');
    };

    const renderBangSuggestions = (bangList) => {
        isBangSuggestions = true;
        currentSuggestions = bangList.map(b => b.key);
        currentSuggFocus = -1;

        if (!bangList || bangList.length === 0) {
            domSearchSuggestions.replaceChildren();
            domSearchSuggestions.classList.add('hide');
            return;
        }

        const items = bangList.map((bang, index) => {
            const li = document.createElement('li');
            li.className = 'sugg-bang-item';
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', 'false');
            li.style.setProperty('--bang-color', bang.color);
            li.style.setProperty('--bang-bg', bang.bg);
            li.style.setProperty('--bang-border', bang.border);

            li.innerHTML = `
                <div class="sugg-bang-left">
                    <div class="sugg-bang-icon">
                        ${bang.icon}
                    </div>
                    <div class="sugg-bang-info">
                        <div class="sugg-bang-title-row">
                            <span class="sugg-bang-badge">${escapeHtml(bang.key)}</span>
                            <span class="sugg-bang-name">${escapeHtml(bang.name)}</span>
                        </div>
                        <span class="sugg-bang-desc">${escapeHtml(bang.desc)}</span>
                    </div>
                </div>
                <div class="sugg-bang-arrow" title="Open ${escapeHtml(bang.name)}">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="7" y1="17" x2="17" y2="7"></line>
                        <polyline points="7 7 17 7 17 17"></polyline>
                    </svg>
                </div>
            `;

            li.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const arrowClicked = e.target.closest('.sugg-bang-arrow');
                if (arrowClicked) {
                    window.location.href = bang.targetUrl;
                    return;
                }
                const fillValue = bang.searchUrl ? (bang.key + ' ') : bang.key;
                searchInput.value = fillValue;
                originalQuery = searchInput.value;
                toggleClearBtn();
                domSearchSuggestions.classList.add('hide');
                handleSearchInput(searchInput.value);
                searchInput.focus();
            });

            li.addEventListener('mouseenter', () => {
                updateSuggFocus(index, false);
            });

            return li;
        });

        domSearchSuggestions.replaceChildren(...items);
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
                if (isBangSuggestions) {
                    searchInput.value = currentSuggestions[currentSuggFocus] + ' ';
                } else {
                    searchInput.value = currentSuggestions[currentSuggFocus];
                }
            }
        } else if (updateInput) {
            searchInput.value = originalQuery;
        }
    };

    domSearchSuggestions.addEventListener('mouseleave', () => {
        updateSuggFocus(-1, false);
    });

    const handleSearchInput = async (val) => {
        originalQuery = val;
        toggleClearBtn();

        const trimmed = val.trim();
        if (!trimmed) {
            domSearchSuggestions.classList.add('hide');
            hideHud();
            currentSuggestions = [];
            return;
        }

        if (val.startsWith('!')) {
            const spaceIdx = val.indexOf(' ');
            if (spaceIdx !== -1) {
                const bangKey = val.substring(0, spaceIdx).toLowerCase();
                const bang = BANGS[bangKey];
                if (bang) {
                    const query = val.substring(spaceIdx + 1);
                    domSearchSuggestions.classList.add('hide');
                    currentSuggestions = [];
                    renderBangHud(bang, query);
                    return;
                }
            } else {
                const token = val.toLowerCase();
                const exactBang = BANGS[token];
                if (exactBang) {
                    domSearchSuggestions.classList.add('hide');
                    currentSuggestions = [];
                    renderBangHud(exactBang, '');
                    return;
                }

                const matchingBangs = Object.values(BANGS).filter(b => b.key.startsWith(token));
                if (matchingBangs.length > 0) {
                    hideHud();
                    renderBangSuggestions(matchingBangs);
                    return;
                }
            }

            domSearchSuggestions.classList.add('hide');
            hideHud();
            currentSuggestions = [];
            return;
        }

        hideHud();
        const suggs = await fetchSuggestions(val);
        if (suggs !== null) renderSuggestions(suggs);
    };

    searchInput.addEventListener('input', debounce(async (e) => {
        handleSearchInput(e.target.value);
    }, 150));

    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim()) {
            handleSearchInput(searchInput.value);
        }
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            domSearchSuggestions.classList.add('hide');
            hideHud();
            searchInput.value = originalQuery;
            searchInput.blur();
            return;
        }

        if (e.key === 'Tab') {
            if (isBangSuggestions && !domSearchSuggestions.classList.contains('hide') && currentSuggestions.length > 0) {
                e.preventDefault();
                const selectedKey = currentSuggFocus >= 0 ? currentSuggestions[currentSuggFocus] : currentSuggestions[0];
                const selectedBang = BANGS[selectedKey];
                const fillValue = (selectedBang && !selectedBang.searchUrl) ? selectedKey : (selectedKey + ' ');
                searchInput.value = fillValue;
                originalQuery = searchInput.value;
                toggleClearBtn();
                domSearchSuggestions.classList.add('hide');
                handleSearchInput(searchInput.value);
                return;
            }
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
        if (!searchContainer.contains(e.target)) {
            domSearchSuggestions.classList.add('hide');
            hideHud();
        }
    });

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const raw = searchInput.value.trim();
        if (!raw) return;

        domSearchSuggestions.classList.add('hide');
        hideHud();

        if (raw.startsWith('!')) {
            const spaceIdx = raw.indexOf(' ');
            const bangKey = spaceIdx === -1 ? raw.toLowerCase() : raw.substring(0, spaceIdx).toLowerCase();
            const query = spaceIdx === -1 ? '' : raw.substring(spaceIdx + 1).trim();

            const bang = BANGS[bangKey];
            if (bang) {
                const target = (query && typeof bang.searchUrl === 'function') ? bang.searchUrl(query) : bang.targetUrl;
                window.location.href = target;
                return;
            }
        }

        const engines = { 
            google: 'https://www.google.com/search?q=', 
            ddg: 'https://duckduckgo.com/?q=', 
            brave: 'https://search.brave.com/search?q=',
            startpage: 'https://www.startpage.com/sp/search?query=',
            qwant: 'https://www.qwant.com/?q='
        };
        window.location.href = (engines[state.settings.engine] || engines.google) + encodeURIComponent(raw);
    });
}
