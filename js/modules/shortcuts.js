import state from './state.js';
import { storage } from './storage.js';

export function getFaviconUrl(url) {
    try {
        let domain = url.trim();
        if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
            domain = 'https://' + domain;
        }
        const parsed = new URL(domain);
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=64`;
    } catch {
        return '';
    }
}

export function formatUrl(raw) {
    let u = raw.trim();
    if (!u) return '';
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
        u = 'https://' + u;
    }
    return u;
}

export function suggestTitleFromUrl(raw) {
    try {
        const u = formatUrl(raw);
        const parsed = new URL(u);
        let host = parsed.hostname.replace(/^www\./i, '');
        const parts = host.split('.');
        const name = parts[0] || host;
        return name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
        return '';
    }
}

export async function deleteShortcut(id) {
    const list = state.settings.shortcuts || [];
    state.settings.shortcuts = list.filter(item => item.id !== id);
    await storage.setSettings(state.settings);
    renderShortcuts();
}

export async function addShortcut(title, url) {
    const list = state.settings.shortcuts || [];
    if (list.length >= 8) return false;
    const finalUrl = formatUrl(url);
    if (!finalUrl) return false;
    const finalTitle = title.trim() || suggestTitleFromUrl(finalUrl) || 'Site';
    const newShortcut = {
        id: 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        title: finalTitle,
        url: finalUrl
    };
    list.push(newShortcut);
    state.settings.shortcuts = list;
    await storage.setSettings(state.settings);
    renderShortcuts();
    return true;
}

export function openAddShortcutDialog() {
    const dialog = document.getElementById('shortcut-dialog');
    const inputUrl = document.getElementById('i_shortcut_url');
    const inputTitle = document.getElementById('i_shortcut_title');
    const imgPreview = document.getElementById('shortcut-dialog-favicon');
    const fallbackPreview = document.getElementById('shortcut-dialog-fallback');

    if (!dialog) return;

    if (inputUrl) inputUrl.value = '';
    if (inputTitle) inputTitle.value = '';
    if (imgPreview) {
        imgPreview.src = '';
        imgPreview.classList.add('hidden');
    }
    if (fallbackPreview) {
        fallbackPreview.textContent = '🌐';
        fallbackPreview.style.display = 'block';
    }

    dialog.showModal();
    if (inputUrl) inputUrl.focus();
}

export function renderShortcuts() {
    const grid = document.getElementById('shortcuts-grid');
    const bar = document.getElementById('shortcuts-bar');
    if (!grid) return;

    const isEnabled = state.settings.shortcutsEnabled !== false;
    if (bar) bar.classList.toggle('hidden', !isEnabled);

    grid.innerHTML = '';
    const shortcuts = Array.isArray(state.settings.shortcuts) ? state.settings.shortcuts : [];

    shortcuts.slice(0, 8).forEach(item => {
        const itemEl = document.createElement('a');
        itemEl.className = 'shortcut-item';
        itemEl.href = item.url;
        itemEl.title = `${item.title} (${item.url})`;

        const circle = document.createElement('div');
        circle.className = 'shortcut-icon-circle';

        const favicon = document.createElement('img');
        favicon.className = 'shortcut-favicon';
        favicon.alt = item.title;
        favicon.loading = 'lazy';

        const letterFallback = document.createElement('span');
        letterFallback.className = 'shortcut-fallback-letter';
        letterFallback.textContent = (item.title || item.url || '?').charAt(0).toUpperCase();

        const faviconUrl = getFaviconUrl(item.url);
        if (faviconUrl) {
            favicon.src = faviconUrl;
            favicon.onerror = () => {
                favicon.style.display = 'none';
                letterFallback.style.display = 'block';
            };
            favicon.onload = () => {
                favicon.style.display = 'block';
                letterFallback.style.display = 'none';
            };
        } else {
            favicon.style.display = 'none';
            letterFallback.style.display = 'block';
        }

        circle.appendChild(favicon);
        circle.appendChild(letterFallback);

        const titleEl = document.createElement('span');
        titleEl.className = 'shortcut-title';
        titleEl.textContent = item.title;

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'shortcut-del-btn';
        delBtn.title = 'Remove shortcut';
        delBtn.setAttribute('aria-label', `Remove ${item.title}`);
        delBtn.innerHTML = '&times;';
        delBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteShortcut(item.id);
        });

        itemEl.appendChild(circle);
        itemEl.appendChild(titleEl);
        itemEl.appendChild(delBtn);

        grid.appendChild(itemEl);
    });

    if (shortcuts.length < 8) {
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'shortcut-add-btn';
        addBtn.title = 'Add new shortcut';
        addBtn.setAttribute('aria-label', 'Add shortcut');

        const addCircle = document.createElement('div');
        addCircle.className = 'shortcut-add-circle';
        addCircle.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
        `;

        const addTitle = document.createElement('span');
        addTitle.className = 'shortcut-add-title';
        addTitle.textContent = 'Add';

        addBtn.appendChild(addCircle);
        addBtn.appendChild(addTitle);
        addBtn.addEventListener('click', () => openAddShortcutDialog());

        grid.appendChild(addBtn);
    }
}

export function initShortcuts() {
    renderShortcuts();

    const dialog = document.getElementById('shortcut-dialog');
    const form = document.getElementById('shortcut-form');
    const inputUrl = document.getElementById('i_shortcut_url');
    const inputTitle = document.getElementById('i_shortcut_title');
    const imgPreview = document.getElementById('shortcut-dialog-favicon');
    const fallbackPreview = document.getElementById('shortcut-dialog-fallback');
    const btnClose = document.getElementById('b_close_shortcut_dialog');
    const btnCancel = document.getElementById('b_cancel_shortcut');

    if (!dialog) return;

    if (inputUrl) {
        let titleWasManual = false;
        inputTitle.addEventListener('input', () => {
            titleWasManual = inputTitle.value.trim().length > 0;
        });

        inputUrl.addEventListener('input', () => {
            const rawVal = inputUrl.value.trim();
            if (!rawVal) {
                if (imgPreview) {
                    imgPreview.src = '';
                    imgPreview.classList.add('hidden');
                }
                if (fallbackPreview) {
                    fallbackPreview.textContent = '🌐';
                    fallbackPreview.style.display = 'block';
                }
                return;
            }

            if (!titleWasManual && inputTitle) {
                inputTitle.value = suggestTitleFromUrl(rawVal);
            }

            const favUrl = getFaviconUrl(rawVal);
            if (favUrl && imgPreview && fallbackPreview) {
                imgPreview.src = favUrl;
                imgPreview.onload = () => {
                    imgPreview.classList.remove('hidden');
                    fallbackPreview.style.display = 'none';
                };
                imgPreview.onerror = () => {
                    imgPreview.classList.add('hidden');
                    fallbackPreview.textContent = (inputTitle?.value || rawVal).charAt(0).toUpperCase() || '🌐';
                    fallbackPreview.style.display = 'block';
                };
            }
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const urlVal = inputUrl?.value || '';
            const titleVal = inputTitle?.value || '';
            if (urlVal.trim()) {
                await addShortcut(titleVal, urlVal);
                dialog.close();
            }
        });
    }

    if (btnClose) {
        btnClose.addEventListener('click', () => dialog.close());
    }

    if (btnCancel) {
        btnCancel.addEventListener('click', () => dialog.close());
    }

    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            dialog.close();
        }
    });
}
