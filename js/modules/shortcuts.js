import state from './state.js';
import { storage } from './storage.js';

let currentEditingId = null;
let draggedIndex = null;
let isDragging = false;
let dragEndTimeout = null;

let iconCache = {};
try {
    const rawCache = localStorage.getItem('nova_shortcut_icon_cache');
    if (rawCache) iconCache = JSON.parse(rawCache);
} catch {}

function saveIconCache() {
    try {
        localStorage.setItem('nova_shortcut_icon_cache', JSON.stringify(iconCache));
    } catch {}
}

const BADGE_GRADIENTS = [
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #3b82f6, #06b6d4)',
    'linear-gradient(135deg, #10b981, #059669)',
    'linear-gradient(135deg, #f43f5e, #e11d48)',
    'linear-gradient(135deg, #f59e0b, #d97706)',
    'linear-gradient(135deg, #8b5cf6, #ec4899)',
    'linear-gradient(135deg, #06b6d4, #3b82f6)',
    'linear-gradient(135deg, #14b8a6, #0d9488)',
    'linear-gradient(135deg, #a855f7, #6366f1)',
    'linear-gradient(135deg, #f97316, #ef4444)'
];

export function getBadgeGradient(str) {
    let hash = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
        hash = (hash << 5) - hash + s.charCodeAt(i);
        hash |= 0;
    }
    const idx = Math.abs(hash) % BADGE_GRADIENTS.length;
    return BADGE_GRADIENTS[idx];
}

export function getMonogramText(title, url) {
    const raw = (title || '').trim();
    if (raw) {
        const parts = raw.split(/[\s\-_.]+/).filter(Boolean);
        if (parts.length >= 2 && parts[0] && parts[1]) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return raw.slice(0, 2).toUpperCase();
    }
    try {
        const u = new URL(formatUrl(url));
        const host = u.hostname.replace(/^www\./i, '');
        return host.slice(0, 2).toUpperCase();
    } catch {
        return '?';
    }
}

export function getFaviconUrl(url) {
    try {
        let domain = url.trim();
        if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
            domain = 'https://' + domain;
        }
        const parsed = new URL(domain);
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=128`;
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
    const item = list.find(s => s.id === id);
    if (item && iconCache[item.url]) {
        delete iconCache[item.url];
        saveIconCache();
    }
    state.settings.shortcuts = list.filter(item => item.id !== id);
    await storage.setSettings(state.settings);
    renderShortcuts();
}

export async function updateShortcut(id, title, url) {
    const list = state.settings.shortcuts || [];
    const item = list.find(s => s.id === id);
    if (!item) return false;
    const finalUrl = formatUrl(url);
    if (!finalUrl) return false;
    if (item.url !== finalUrl && iconCache[item.url]) {
        delete iconCache[item.url];
    }
    delete iconCache[finalUrl];
    saveIconCache();
    item.url = finalUrl;
    item.title = title.trim() || suggestTitleFromUrl(finalUrl) || 'Site';
    await storage.setSettings(state.settings);
    renderShortcuts();
    return true;
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

function updateDialogPreview(rawUrl, rawTitle) {
    const previewCircle = document.getElementById('shortcut-dialog-icon-preview');
    const imgPreview = document.getElementById('shortcut-dialog-favicon');
    const fallbackPreview = document.getElementById('shortcut-dialog-fallback');
    if (!previewCircle || !imgPreview || !fallbackPreview) return;

    const trimmed = (rawUrl || '').trim();
    if (!trimmed) {
        imgPreview.src = '';
        imgPreview.classList.add('hidden');
        previewCircle.classList.remove('is-fallback-badge');
        previewCircle.style.removeProperty('--badge-gradient');
        fallbackPreview.textContent = '🌐';
        fallbackPreview.style.display = 'block';
        return;
    }

    const titleText = rawTitle || suggestTitleFromUrl(trimmed) || trimmed;
    const monoText = getMonogramText(titleText, trimmed);
    const grad = getBadgeGradient(titleText);

    const applyFallback = () => {
        imgPreview.src = '';
        imgPreview.classList.add('hidden');
        previewCircle.classList.add('is-fallback-badge');
        previewCircle.style.setProperty('--badge-gradient', grad);
        fallbackPreview.textContent = monoText;
        fallbackPreview.style.display = 'block';
    };

    const favUrl = getFaviconUrl(trimmed);
    if (favUrl) {
        imgPreview.src = favUrl;
        imgPreview.onload = () => {
            if (imgPreview.naturalWidth <= 16 && imgPreview.naturalHeight <= 16) {
                applyFallback();
                return;
            }
            imgPreview.classList.remove('hidden');
            previewCircle.classList.remove('is-fallback-badge');
            previewCircle.style.removeProperty('--badge-gradient');
            fallbackPreview.style.display = 'none';
        };
        imgPreview.onerror = () => {
            applyFallback();
        };
    } else {
        applyFallback();
    }
}

export function openAddShortcutDialog(editItem = null) {
    const dialog = document.getElementById('shortcut-dialog');
    const dialogTitle = document.getElementById('shortcut-dialog-title');
    const inputUrl = document.getElementById('i_shortcut_url');
    const inputTitle = document.getElementById('i_shortcut_title');
    const saveBtn = document.getElementById('b_save_shortcut');

    if (!dialog) return;

    if (editItem) {
        currentEditingId = editItem.id;
        if (dialogTitle) dialogTitle.textContent = 'Edit Shortcut';
        if (saveBtn) saveBtn.textContent = 'Save';
        if (inputUrl) inputUrl.value = editItem.url;
        if (inputTitle) inputTitle.value = editItem.title;
        updateDialogPreview(editItem.url, editItem.title);
    } else {
        currentEditingId = null;
        if (dialogTitle) dialogTitle.textContent = 'Add Shortcut';
        if (saveBtn) saveBtn.textContent = 'Add';
        if (inputUrl) inputUrl.value = '';
        if (inputTitle) inputTitle.value = '';
        updateDialogPreview('', '');
    }

    dialog.showModal();
    if (inputUrl) inputUrl.focus();
}

export function applyShortcutsLayout() {
    const bar = document.getElementById('shortcuts-bar');
    const searchContainer = document.getElementById('search-container');
    const isEnabled = state.settings.shortcutsEnabled !== false;
    const pos = state.settings.shortcutsPosition || 'bottom';
    const size = state.settings.shortcutsSize || 'medium';

    if (bar) {
        bar.classList.toggle('hidden', !isEnabled);
        bar.classList.remove('size-small', 'size-medium', 'size-large', 'pos-top', 'pos-bottom');
        bar.classList.add(`size-${size}`);
        bar.classList.add(`pos-${pos}`);
    }

    if (searchContainer) {
        searchContainer.classList.remove('shortcuts-pos-top', 'shortcuts-pos-bottom');
        if (isEnabled) {
            searchContainer.classList.add(`shortcuts-pos-${pos}`);
        }
    }
}

export function renderShortcuts() {
    applyShortcutsLayout();

    const grid = document.getElementById('shortcuts-grid');
    const bar = document.getElementById('shortcuts-bar');
    if (!grid) return;

    const isEnabled = state.settings.shortcutsEnabled !== false;
    if (bar) bar.classList.toggle('hidden', !isEnabled);

    grid.innerHTML = '';
    const shortcuts = Array.isArray(state.settings.shortcuts) ? state.settings.shortcuts : [];

    shortcuts.slice(0, 8).forEach((item, index) => {
        const itemEl = document.createElement('a');
        itemEl.className = 'shortcut-item';
        itemEl.href = item.url;
        itemEl.title = `${item.title} (${item.url})`;
        itemEl.setAttribute('draggable', 'true');

        itemEl.addEventListener('dragstart', (e) => {
            draggedIndex = index;
            isDragging = true;
            itemEl.classList.add('is-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(index));
        });

        itemEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (draggedIndex !== null && draggedIndex !== index) {
                itemEl.classList.add('drag-over');
            }
        });

        itemEl.addEventListener('dragleave', () => {
            itemEl.classList.remove('drag-over');
        });

        itemEl.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            itemEl.classList.remove('drag-over');
            if (draggedIndex !== null && draggedIndex !== index) {
                const list = [...state.settings.shortcuts];
                const [moved] = list.splice(draggedIndex, 1);
                list.splice(index, 0, moved);
                state.settings.shortcuts = list;
                await storage.setSettings(state.settings);
                renderShortcuts();
            }
        });

        itemEl.addEventListener('dragend', () => {
            itemEl.classList.remove('is-dragging');
            document.querySelectorAll('.shortcut-item').forEach(el => el.classList.remove('drag-over'));
            draggedIndex = null;
            clearTimeout(dragEndTimeout);
            dragEndTimeout = setTimeout(() => {
                isDragging = false;
            }, 100);
        });

        itemEl.addEventListener('click', (e) => {
            if (isDragging) {
                e.preventDefault();
                e.stopPropagation();
            }
        });

        itemEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            openAddShortcutDialog(item);
        });

        const circle = document.createElement('div');
        circle.className = 'shortcut-icon-circle';

        const monogram = document.createElement('span');
        monogram.className = 'shortcut-fallback-letter';
        monogram.textContent = getMonogramText(item.title, item.url);

        const cachedStatus = iconCache[item.url];

        if (cachedStatus === 'fallback') {
            circle.classList.add('is-fallback-badge');
            circle.style.setProperty('--badge-gradient', getBadgeGradient(item.title || item.url));
            circle.appendChild(monogram);
        } else {
            circle.appendChild(monogram);

            const favicon = document.createElement('img');
            favicon.className = 'shortcut-favicon';
            favicon.alt = item.title;
            favicon.loading = 'eager';

            if (cachedStatus === 'ok') {
                favicon.classList.add('loaded');
                monogram.style.display = 'none';
            }

            const faviconUrl = getFaviconUrl(item.url);
            if (faviconUrl) {
                favicon.src = faviconUrl;
                favicon.onload = () => {
                    if (favicon.naturalWidth <= 16 && favicon.naturalHeight <= 16) {
                        favicon.remove();
                        circle.classList.add('is-fallback-badge');
                        circle.style.setProperty('--badge-gradient', getBadgeGradient(item.title || item.url));
                        monogram.style.display = 'block';
                        iconCache[item.url] = 'fallback';
                        saveIconCache();
                        return;
                    }
                    favicon.classList.add('loaded');
                    monogram.style.display = 'none';
                    circle.classList.remove('is-fallback-badge');
                    circle.style.removeProperty('--badge-gradient');
                    if (iconCache[item.url] !== 'ok') {
                        iconCache[item.url] = 'ok';
                        saveIconCache();
                    }
                };
                favicon.onerror = () => {
                    favicon.remove();
                    circle.classList.add('is-fallback-badge');
                    circle.style.setProperty('--badge-gradient', getBadgeGradient(item.title || item.url));
                    monogram.style.display = 'block';
                    iconCache[item.url] = 'fallback';
                    saveIconCache();
                };
                circle.appendChild(favicon);
            } else {
                circle.classList.add('is-fallback-badge');
                circle.style.setProperty('--badge-gradient', getBadgeGradient(item.title || item.url));
                monogram.style.display = 'block';
            }
        }

        const titleEl = document.createElement('span');
        titleEl.className = 'shortcut-title';
        titleEl.textContent = item.title;

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'shortcut-edit-btn';
        editBtn.title = 'Edit shortcut';
        editBtn.setAttribute('aria-label', `Edit ${item.title}`);
        editBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
        `;
        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openAddShortcutDialog(item);
        });

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
        itemEl.appendChild(editBtn);
        itemEl.appendChild(delBtn);

        grid.appendChild(itemEl);
    });

    if (shortcuts.length < 8) {
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'shortcut-add-btn';
        addBtn.title = 'Add new shortcut';
        addBtn.setAttribute('aria-label', 'Add shortcut');

        addBtn.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            addBtn.classList.add('drag-over');
        });

        addBtn.addEventListener('dragleave', () => {
            addBtn.classList.remove('drag-over');
        });

        addBtn.addEventListener('drop', async (e) => {
            e.preventDefault();
            addBtn.classList.remove('drag-over');
            if (draggedIndex !== null && draggedIndex !== shortcuts.length - 1) {
                const list = [...state.settings.shortcuts];
                const [moved] = list.splice(draggedIndex, 1);
                list.push(moved);
                state.settings.shortcuts = list;
                await storage.setSettings(state.settings);
                renderShortcuts();
            }
        });

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
    const btnClose = document.getElementById('b_close_shortcut_dialog');
    const btnCancel = document.getElementById('b_cancel_shortcut');

    if (!dialog) return;

    if (inputUrl) {
        let titleWasManual = false;
        inputTitle.addEventListener('input', () => {
            titleWasManual = inputTitle.value.trim().length > 0;
            updateDialogPreview(inputUrl.value.trim(), inputTitle.value.trim());
        });

        inputUrl.addEventListener('input', () => {
            const rawVal = inputUrl.value.trim();
            if (!rawVal) {
                updateDialogPreview('', '');
                return;
            }

            if (!titleWasManual && inputTitle && !currentEditingId) {
                inputTitle.value = suggestTitleFromUrl(rawVal);
            }

            updateDialogPreview(rawVal, inputTitle?.value || '');
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const urlVal = inputUrl?.value || '';
            const titleVal = inputTitle?.value || '';
            if (urlVal.trim()) {
                if (currentEditingId) {
                    await updateShortcut(currentEditingId, titleVal, urlVal);
                } else {
                    await addShortcut(titleVal, urlVal);
                }
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

export default {
    getFaviconUrl,
    formatUrl,
    suggestTitleFromUrl,
    deleteShortcut,
    updateShortcut,
    addShortcut,
    openAddShortcutDialog,
    applyShortcutsLayout,
    renderShortcuts,
    initShortcuts,
    getBadgeGradient,
    getMonogramText
};
