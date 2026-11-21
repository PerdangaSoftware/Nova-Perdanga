import state from './state.js';

export function initSearch() {
    const searchContainer = document.getElementById('search-container');
    const searchForm = document.getElementById('search-form') || searchContainer;
    const searchInput = document.getElementById('searchbar');
    const searchClearBtn = document.getElementById('search-clear-btn');
    const domSearchSuggestions = document.getElementById('search-suggestions');
    if (!searchContainer || !searchForm || !searchInput || !searchClearBtn || !domSearchSuggestions) return;

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
        if (!searchContainer.contains(e.target)) {
            domSearchSuggestions.classList.add('hide');
        }
    });

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
            brave: 'https://search.brave.com/search?q=',
            startpage: 'https://www.startpage.com/sp/search?query=',
            qwant: 'https://www.qwant.com/?q='
        };
        window.location.href = (engines[state.settings.engine] || engines.google) + encodeURIComponent(raw);
    });
}
