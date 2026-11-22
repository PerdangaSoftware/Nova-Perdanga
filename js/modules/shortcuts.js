import state from './state.js';
import { storage } from './storage.js';

let currentEditingId = null;
let currentEditingCustomIcon = '';
let draggedIndex = null;
let isDragging = false;
let dragEndTimeout = null;

let iconCache = {};
try {
    const rawCache = localStorage.getItem('nova_shortcut_cache_v3');
    if (rawCache) iconCache = JSON.parse(rawCache);
} catch {}

function saveIconCache() {
    try {
        localStorage.setItem('nova_shortcut_cache_v3', JSON.stringify(iconCache));
    } catch {}
}

const PRESET_SVGS = {
    web: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="shortcut-fallback-icon"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>',
    film: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="shortcut-fallback-icon"><rect x="2" y="2" width="20" height="20" rx="3"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>',
    code: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="shortcut-fallback-icon"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>',
    star: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" class="shortcut-fallback-icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
    game: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="shortcut-fallback-icon"><rect x="2" y="6" width="20" height="12" rx="4"></rect><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><circle cx="15.5" cy="11.5" r="1" fill="currentColor"></circle><circle cx="17.5" cy="13.5" r="1" fill="currentColor"></circle></svg>',
    music: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="shortcut-fallback-icon"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>'
};

export function getPresetSvg(name) {
    return PRESET_SVGS[name] || PRESET_SVGS.web;
}

export function createFallbackIcon() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = PRESET_SVGS.web;
    return wrapper.firstElementChild;
}

export function getFaviconUrl(url) {
    try {
        let domain = url.trim();
        if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
            domain = 'https://' + domain;
        }
        const parsed = new URL(domain);
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=128&default_icon=none`;
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

export async function updateShortcut(id, title, url, customIcon = undefined) {
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
    if (customIcon !== undefined) {
        if (customIcon) {
            item.customIcon = customIcon;
        } else {
            delete item.customIcon;
        }
    }
    await storage.setSettings(state.settings);
    renderShortcuts();
    return true;
}

export async function addShortcut(title, url, customIcon = undefined) {
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
    if (customIcon) {
        newShortcut.customIcon = customIcon;
    }
    list.push(newShortcut);
    state.settings.shortcuts = list;
    await storage.setSettings(state.settings);
    renderShortcuts();
    return true;
}

function updatePresetButtonsState() {
    document.querySelectorAll('.preset-icon-btn[data-preset]').forEach(btn => {
        const p = 'preset:' + btn.dataset.preset;
        btn.classList.toggle('active', currentEditingCustomIcon === p);
    });
}

function updateDialogPreview(rawUrl) {
    const previewCircle = document.getElementById('shortcut-dialog-icon-preview');
    const imgPreview = document.getElementById('shortcut-dialog-favicon');
    const fallbackPreview = document.getElementById('shortcut-dialog-fallback');
    if (!previewCircle || !imgPreview) return;

    if (fallbackPreview) fallbackPreview.style.display = 'none';

    if (currentEditingCustomIcon) {
        if (currentEditingCustomIcon.startsWith('preset:')) {
            imgPreview.src = '';
            imgPreview.classList.add('hidden');
            const pKey = currentEditingCustomIcon.slice(7);
            previewCircle.innerHTML = getPresetSvg(pKey);
            return;
        }
        imgPreview.src = currentEditingCustomIcon;
        imgPreview.classList.remove('hidden');
        const oldSvg = previewCircle.querySelector('.shortcut-fallback-icon');
        if (oldSvg) oldSvg.remove();
        return;
    }

    const trimmed = (rawUrl || '').trim();
    if (!trimmed) {
        imgPreview.src = '';
        imgPreview.classList.add('hidden');
        let oldSvg = previewCircle.querySelector('.shortcut-fallback-icon');
        if (!oldSvg) previewCircle.appendChild(createFallbackIcon());
        return;
    }

    const favUrl = getFaviconUrl(trimmed);
    if (favUrl) {
        imgPreview.src = favUrl;
        imgPreview.onload = () => {
            imgPreview.classList.remove('hidden');
            const oldSvg = previewCircle.querySelector('.shortcut-fallback-icon');
            if (oldSvg) oldSvg.remove();
        };
        imgPreview.onerror = () => {
            imgPreview.classList.add('hidden');
            let oldSvg = previewCircle.querySelector('.shortcut-fallback-icon');
            if (!oldSvg) previewCircle.appendChild(createFallbackIcon());
        };
    } else {
        imgPreview.classList.add('hidden');
        let oldSvg = previewCircle.querySelector('.shortcut-fallback-icon');
        if (!oldSvg) previewCircle.appendChild(createFallbackIcon());
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
        currentEditingCustomIcon = editItem.customIcon || '';
        if (dialogTitle) dialogTitle.textContent = 'Edit Shortcut';
        if (saveBtn) saveBtn.textContent = 'Save';
        if (inputUrl) inputUrl.value = editItem.url;
        if (inputTitle) inputTitle.value = editItem.title;
        updatePresetButtonsState();
        updateDialogPreview(editItem.url);
    } else {
        currentEditingId = null;
        currentEditingCustomIcon = '';
        if (dialogTitle) dialogTitle.textContent = 'Add Shortcut';
        if (saveBtn) saveBtn.textContent = 'Add';
        if (inputUrl) inputUrl.value = '';
        if (inputTitle) inputTitle.value = '';
        updatePresetButtonsState();
        updateDialogPreview('');
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

        if (item.customIcon) {
            if (item.customIcon.startsWith('preset:')) {
                const pKey = item.customIcon.slice(7);
                circle.innerHTML = getPresetSvg(pKey);
            } else {
                const img = document.createElement('img');
                img.className = 'shortcut-favicon';
                img.src = item.customIcon;
                img.alt = item.title;
                circle.appendChild(img);
            }
        } else {
            const cachedStatus = iconCache[item.url];
            if (cachedStatus === 'fallback') {
                circle.appendChild(createFallbackIcon());
            } else {
                const favicon = document.createElement('img');
                favicon.className = 'shortcut-favicon';
                favicon.alt = item.title;
                favicon.loading = 'eager';

                const faviconUrl = getFaviconUrl(item.url);
                if (faviconUrl) {
                    favicon.src = faviconUrl;
                    favicon.onload = () => {
                        if (iconCache[item.url] !== 'ok') {
                            iconCache[item.url] = 'ok';
                            saveIconCache();
                        }
                    };
                    favicon.onerror = () => {
                        favicon.remove();
                        circle.appendChild(createFallbackIcon());
                        iconCache[item.url] = 'fallback';
                        saveIconCache();
                    };
                    circle.appendChild(favicon);
                } else {
                    circle.appendChild(createFallbackIcon());
                }
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
    const btnUpload = document.getElementById('b_shortcut_upload_icon');
    const inputFile = document.getElementById('i_shortcut_icon_file');
    const btnResetIcon = document.getElementById('b_shortcut_reset_icon');

    if (!dialog) return;

    if (btnUpload && inputFile) {
        btnUpload.addEventListener('click', () => inputFile.click());
        inputFile.addEventListener('change', () => {
            const file = inputFile.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = () => {
                    currentEditingCustomIcon = reader.result;
                    updatePresetButtonsState();
                    updateDialogPreview(inputUrl?.value || '');
                };
                reader.readAsDataURL(file);
            }
        });
    }

    document.querySelectorAll('.preset-icon-btn[data-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
            const p = 'preset:' + btn.dataset.preset;
            currentEditingCustomIcon = (currentEditingCustomIcon === p) ? '' : p;
            updatePresetButtonsState();
            updateDialogPreview(inputUrl?.value || '');
        });
    });

    if (btnResetIcon) {
        btnResetIcon.addEventListener('click', () => {
            currentEditingCustomIcon = '';
            if (inputFile) inputFile.value = '';
            updatePresetButtonsState();
            updateDialogPreview(inputUrl?.value || '');
        });
    }

    if (inputUrl) {
        let titleWasManual = false;
        inputTitle.addEventListener('input', () => {
            titleWasManual = inputTitle.value.trim().length > 0;
            updateDialogPreview(inputUrl.value.trim());
        });

        inputUrl.addEventListener('input', () => {
            const rawVal = inputUrl.value.trim();
            if (!rawVal) {
                updateDialogPreview('');
                return;
            }

            if (!titleWasManual && inputTitle && !currentEditingId) {
                inputTitle.value = suggestTitleFromUrl(rawVal);
            }

            updateDialogPreview(rawVal);
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const urlVal = inputUrl?.value || '';
            const titleVal = inputTitle?.value || '';
            if (urlVal.trim()) {
                if (currentEditingId) {
                    await updateShortcut(currentEditingId, titleVal, urlVal, currentEditingCustomIcon);
                } else {
                    await addShortcut(titleVal, urlVal, currentEditingCustomIcon);
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
    createFallbackIcon,
    getPresetSvg
};
