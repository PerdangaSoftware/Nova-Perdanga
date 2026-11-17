import state, { emit, on } from './state.js';
import { storage, idb } from './storage.js';
import { createZip, parseZip, generateThumbnail, base64ToBlob } from './utils.js';
import { loadBackground, preCalculateNextBackground } from './background.js';

export async function renderGallery() {
    const localGallery = document.getElementById('local-gallery');
    if (!localGallery) return;

    const settings = state.settings;
    const gallery = await storage.getGallery();
    
    const counterEl = document.getElementById('gallery-count');
    if (counterEl) counterEl.textContent = gallery.length;

    const existingItems = Array.from(localGallery.children);
    const needsRebuild = existingItems.length !== gallery.length || !existingItems.every((el, i) => el.dataset.id === gallery[i].id);

    if (needsRebuild) {
        localGallery.innerHTML = '';
        gallery.forEach(img => {
            const div = document.createElement('div');
            div.className = `gallery-item ${settings.selectedLocalBg === img.id ? 'selected' : ''}`;
            div.style.backgroundImage = `url(${img.thumb || img.url})`; 
            div.dataset.id = img.id; 
            div.onclick = async () => {
                if (settings.selectedLocalBg === img.id) return;
                settings.selectedLocalBg = img.id;
                await storage.setSettings(settings);
                renderGallery(); 
                if (settings.bgType === 'local') loadBackground(false, false);
            };
            localGallery.appendChild(div);
        });
    } else {
        existingItems.forEach(el => {
            if (el.dataset.id === settings.selectedLocalBg) el.classList.add('selected');
            else el.classList.remove('selected');
        });
    }
    
    const hasSelected = gallery.some(img => img.id === settings.selectedLocalBg);
    const btnRemove = document.getElementById('b_local_remove');
    const btnView = document.getElementById('b_view_local');
    const btnDownload = document.getElementById('b_download_local');
    const btnDownloadAllLocal = document.getElementById('b_download_all_local');
    const btnOptionsLocal = document.getElementById('b_local_options');
    const localImageOptions = document.getElementById('local-image-options');
    const inputLocalPos = document.getElementById('i_local_pos');

    if (btnRemove) btnRemove.disabled = !hasSelected;
    if (btnView) btnView.disabled = !hasSelected;
    if (btnDownload) btnDownload.disabled = !hasSelected;
    if (btnDownloadAllLocal) btnDownloadAllLocal.disabled = gallery.length === 0;
    if (btnOptionsLocal) btnOptionsLocal.disabled = !hasSelected;

    if (hasSelected && inputLocalPos) {
        const currentImg = gallery.find(img => img.id === settings.selectedLocalBg);
        inputLocalPos.value = currentImg && currentImg.positionY !== undefined ? currentImg.positionY : 50;
        const fillVal = ((inputLocalPos.value - inputLocalPos.min) / (inputLocalPos.max - inputLocalPos.min)) * 100;
        inputLocalPos.style.background = `linear-gradient(to right, var(--accent-blue) 0%, var(--accent-blue) ${fillVal}%, var(--border-color) ${fillVal}%, var(--border-color) 100%)`;
        const badge = document.getElementById('v_local_pos');
        if (badge) badge.textContent = `${inputLocalPos.value}%`;
    } else if (localImageOptions) {
        localImageOptions.classList.add('hidden');
    }
}

export async function uploadLocalImages(files) {
    if (!files || !files.length) return;
    const settings = state.settings;
    const gallery = await storage.getGallery();
    
    for (const file of files) {
        const thumb = await generateThumbnail(file);
        const newImg = { 
            id: 'img_' + Date.now() + Math.random().toString(36).substring(2, 7), 
            thumb: thumb, 
            type: 'local', 
            positionY: 50 
        };
        await idb.set(newImg.id, file); 
        gallery.unshift(newImg);
        settings.selectedLocalBg = newImg.id;
    }
    
    await storage.setGallery(gallery);
    await storage.setSettings(settings);
    renderGallery();
    if (settings.bgType === 'local') loadBackground(false, false);
    emit('preview:sync');
}

export function initGallery() {
    on('gallery:updated', () => renderGallery());

    const localUpload = document.getElementById('i_local_upload');
    if (localUpload) {
        localUpload.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files.length) return;
            
            const addBtn = document.querySelector('.add-new-btn');
            if (addBtn) {
                addBtn.innerHTML = "Processing...";
                addBtn.style.pointerEvents = "none";
            }
            
            await uploadLocalImages(files);

            if (addBtn) {
                addBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Add new';
                addBtn.style.pointerEvents = "auto";
            }
            e.target.value = '';
        });
    }

    const drawerUpload = document.getElementById('i_drawer_local_upload');
    if (drawerUpload) {
        drawerUpload.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files.length) return;
            await uploadLocalImages(files);
            e.target.value = '';
        });
    }

    const btnRemove = document.getElementById('b_local_remove');
    if (btnRemove) {
        btnRemove.addEventListener('click', async () => {
            const settings = state.settings;
            let gallery = await storage.getGallery();
            const imgToRemove = gallery.find(img => img.id === settings.selectedLocalBg);
            if (imgToRemove && imgToRemove.type === 'local') await idb.remove(imgToRemove.id);
            
            gallery = gallery.filter(img => img.id !== settings.selectedLocalBg);
            settings.selectedLocalBg = gallery.length > 0 ? gallery[0].id : "";
            await storage.setGallery(gallery); 
            await storage.setSettings(settings);
            renderGallery();
            loadBackground(false, false);
        });
    }

    const btnView = document.getElementById('b_view_local');
    if (btnView) {
        btnView.addEventListener('click', async () => {
            const settings = state.settings;
            const gallery = await storage.getGallery();
            const current = gallery.find(img => img.id === settings.selectedLocalBg);
            if (current) {
                if (current.type === 'local') {
                    const blob = await idb.get(current.id);
                    if (blob) window.open(URL.createObjectURL(blob), '_blank');
                } else {
                    window.open(current.url, '_blank');
                }
            }
        });
    }

    const btnDownload = document.getElementById('b_download_local');
    if (btnDownload) {
        btnDownload.addEventListener('click', async () => {
            const settings = state.settings;
            const gallery = await storage.getGallery();
            const current = gallery.find(img => img.id === settings.selectedLocalBg);
            if (!current) return;

            const btn = document.getElementById('b_download_local');
            const origText = btn.innerHTML;
            btn.innerHTML = "Saving...";
            btn.style.pointerEvents = "none";

            try {
                let url;
                let filename = 'Nova_Wallpaper_' + Date.now() + '.jpg';

                if (current.type === 'local') {
                    const blob = await idb.get(current.id);
                    if (blob) url = URL.createObjectURL(blob);
                } else if (current.type === 'wallhaven' || current.url) {
                    const res = await fetch(current.url);
                    const blob = await res.blob();
                    url = URL.createObjectURL(blob);
                    const parts = current.url.split('/');
                    filename = parts[parts.length - 1] || filename;
                }

                if (url) {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    if (current.type === 'local' || url.startsWith('blob:')) {
                        setTimeout(() => URL.revokeObjectURL(url), 5000);
                    }
                }
            } catch (e) {
                if (current.url) window.open(current.url, '_blank');
            }

            btn.innerHTML = origText;
            btn.style.pointerEvents = "auto";
        });
    }

    const btnDownloadAllLocal = document.getElementById('b_download_all_local');
    if (btnDownloadAllLocal) {
        btnDownloadAllLocal.addEventListener('click', async () => {
            const gallery = await storage.getGallery();
            if (!gallery || gallery.length === 0) return;

            const origText = btnDownloadAllLocal.innerHTML;
            btnDownloadAllLocal.style.pointerEvents = 'none';
            btnDownloadAllLocal.disabled = true;

            try {
                const filesToZip = [];
                const usedNames = new Set();

                for (let i = 0; i < gallery.length; i++) {
                    btnDownloadAllLocal.innerHTML = `Packaging (${i + 1}/${gallery.length})...`;
                    await new Promise(r => setTimeout(r, 10));

                    const item = gallery[i];
                    let blob = null;
                    let filename = '';

                    if (item.type === 'local') {
                        blob = await idb.get(item.id);
                        if (!blob && item.thumb && item.thumb.startsWith('data:')) {
                            blob = await base64ToBlob(item.thumb);
                        }
                    } else if (item.type === 'wallhaven' || item.url) {
                        try {
                            const res = await fetch(item.url);
                            if (res.ok) blob = await res.blob();
                        } catch (err) {}

                        if (!blob && item.thumb && item.thumb.startsWith('http')) {
                            try {
                                const res = await fetch(item.thumb);
                                if (res.ok) blob = await res.blob();
                            } catch (err) {}
                        }

                        if (item.url) {
                            const parts = item.url.split('/');
                            filename = parts[parts.length - 1] || '';
                        }
                    }

                    if (blob) {
                        let ext = '.jpg';
                        if (blob.type === 'image/png') ext = '.png';
                        else if (blob.type === 'image/webp') ext = '.webp';
                        else if (blob.type === 'image/gif') ext = '.gif';
                        else if (blob.type === 'image/jpeg') ext = '.jpg';

                        if (!filename) {
                            filename = `wallpaper_${String(i + 1).padStart(2, '0')}${ext}`;
                        } else if (!filename.includes('.')) {
                            filename += ext;
                        }

                        let finalName = filename;
                        let counter = 1;
                        while (usedNames.has(finalName)) {
                            const dotIdx = filename.lastIndexOf('.');
                            if (dotIdx !== -1) {
                                finalName = `${filename.slice(0, dotIdx)}_${counter}${filename.slice(dotIdx)}`;
                            } else {
                                finalName = `${filename}_${counter}`;
                            }
                            counter++;
                        }
                        usedNames.add(finalName);

                        const arrayBuffer = await blob.arrayBuffer();
                        filesToZip.push({ name: finalName, data: new Uint8Array(arrayBuffer) });
                    }
                }

                if (filesToZip.length === 0) throw new Error("No wallpapers found");

                btnDownloadAllLocal.innerHTML = "Creating ZIP...";
                await new Promise(r => setTimeout(r, 10));

                const zipBlob = createZip(filesToZip);
                const zipUrl = URL.createObjectURL(zipBlob);
                const a = document.createElement('a');
                a.href = zipUrl;
                a.download = `Nova_Wallpapers_${Date.now()}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(zipUrl), 10000);

                btnDownloadAllLocal.innerHTML = "Saved ✓";
                btnDownloadAllLocal.style.color = "var(--accent-green)";
            } catch (e) {
                btnDownloadAllLocal.innerHTML = "Error!";
                btnDownloadAllLocal.style.color = "var(--accent-red)";
            }

            setTimeout(() => {
                btnDownloadAllLocal.innerHTML = origText;
                btnDownloadAllLocal.style.color = "";
                btnDownloadAllLocal.style.pointerEvents = "auto";
                btnDownloadAllLocal.disabled = false;
            }, 2000);
        });
    }

    const btnOptionsLocal = document.getElementById('b_local_options');
    const localImageOptions = document.getElementById('local-image-options');
    if (btnOptionsLocal && localImageOptions) {
        btnOptionsLocal.addEventListener('click', () => {
            localImageOptions.classList.toggle('hidden');
        });
    }

    const inputLocalPos = document.getElementById('i_local_pos');
    if (inputLocalPos) {
        inputLocalPos.addEventListener('input', (e) => {
            const fillVal = ((e.target.value - e.target.min) / (e.target.max - e.target.min)) * 100;
            e.target.style.background = `linear-gradient(to right, var(--accent-blue) 0%, var(--accent-blue) ${fillVal}%, var(--border-color) ${fillVal}%, var(--border-color) 100%)`;
            const badge = document.getElementById('v_local_pos');
            if (badge) badge.textContent = `${e.target.value}%`;
            if (state.settings.bgType === 'local') {
                const posY = parseInt(e.target.value);
                const activeEl = document.getElementById(`bg-${state.activeBg}`);
                if (activeEl) activeEl.style.backgroundPosition = `center ${posY}%`;
            }
        });

        inputLocalPos.addEventListener('change', async (e) => {
            const settings = state.settings;
            const gallery = await storage.getGallery();
            const currentImg = gallery.find(img => img.id === settings.selectedLocalBg);
            if (currentImg) {
                currentImg.positionY = parseInt(e.target.value);
                await storage.setGallery(gallery);
                if (settings.bgType === 'local') preCalculateNextBackground();
            }
        });
    }

    const btnExport = document.getElementById('b_export');
    if (btnExport) {
        btnExport.addEventListener('click', async () => {
            const origText = btnExport.innerHTML;
            btnExport.innerHTML = "Exporting..."; 
            btnExport.style.pointerEvents = "none";

            try {
                const gallery = await storage.getGallery();
                const currentSettings = await storage.getSettings();
                const zipFiles = [];

                const cleanSettings = { ...currentSettings };
                if (cleanSettings.wallhavenQueue && cleanSettings.wallhavenQueue.length > 10) {
                    cleanSettings.wallhavenQueue = cleanSettings.wallhavenQueue.slice(0, 10);
                }
                if (cleanSettings.wallhavenHistory && cleanSettings.wallhavenHistory.length > 10) {
                    cleanSettings.wallhavenHistory = cleanSettings.wallhavenHistory.slice(-10);
                }

                const cleanGallery = gallery.map(item => {
                    const entry = { ...item };
                    delete entry.thumb;
                    return entry;
                });

                for (let i = 0; i < gallery.length; i++) {
                    const item = gallery[i];
                    btnExport.innerHTML = `Exporting (${i + 1}/${gallery.length})...`;
                    await new Promise(r => setTimeout(r, 0));

                    let blob = null;
                    if (item.type === 'local') {
                        blob = await idb.get(item.id);
                    } else if (item.url) {
                        blob = await idb.get(item.id);
                    }

                    if (blob) {
                        const arrayBuffer = await blob.arrayBuffer();
                        zipFiles.push({
                            name: `images/${item.id}`,
                            data: new Uint8Array(arrayBuffer)
                        });
                    }
                }

                const timerData = await new Promise(res => 
                    chrome.storage.local.get(['nova_timer_settings', 'nova_timer_state'], res)
                );

                const configObj = { 
                    version: "1.4", 
                    settings: cleanSettings, 
                    gallery: cleanGallery, 
                    timerSettings: timerData.nova_timer_settings,
                    timerState: timerData.nova_timer_state
                };

                const configString = JSON.stringify(configObj);
                const configBytes = new TextEncoder().encode(configString);
                zipFiles.unshift({
                    name: "config.json",
                    data: configBytes
                });

                btnExport.innerHTML = "Creating ZIP...";
                await new Promise(r => setTimeout(r, 0));

                const zipBlob = createZip(zipFiles);
                const downloadUrl = URL.createObjectURL(zipBlob);
                
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", downloadUrl);
                downloadAnchorNode.setAttribute("download", "novaperdanga_backup.zip");
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                document.body.removeChild(downloadAnchorNode);
                
                setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
                
                btnExport.innerHTML = "Success ✓";
                btnExport.style.color = "var(--accent-green)";
            } catch (err) {
                btnExport.innerHTML = "Error!";
                btnExport.style.color = "var(--accent-red)";
            }
            
            setTimeout(() => { 
                btnExport.innerHTML = origText; 
                btnExport.style.color = ""; 
                btnExport.style.pointerEvents = "auto"; 
            }, 2000);
        });
    }

    const inputImport = document.getElementById('i_import');
    if (inputImport) {
        inputImport.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const btnLabel = document.getElementById('b_import_label');
            const origText = btnLabel ? btnLabel.innerHTML : '';
            if (btnLabel) {
                btnLabel.innerHTML = "Importing..."; 
                btnLabel.style.pointerEvents = "none";
            }

            try {
                const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
                const isZip = (head[0] === 0x50 && head[1] === 0x4B && head[2] === 0x03 && head[3] === 0x04) || file.name.endsWith('.zip');

                if (isZip) {
                    if (btnLabel) btnLabel.innerHTML = "Reading ZIP...";
                    await new Promise(r => setTimeout(r, 0));

                    const files = await parseZip(file);
                    if (!files['config.json']) throw new Error("Missing config.json in backup archive");

                    const configText = new TextDecoder().decode(files['config.json']);
                    const importedData = JSON.parse(configText);

                    if (importedData.settings) await storage.setSettings(importedData.settings);
                    if (importedData.timerSettings) {
                        await chrome.storage.local.set({ nova_timer_settings: importedData.timerSettings });
                    }
                    if (importedData.timerState) {
                        await chrome.storage.local.set({ nova_timer_state: importedData.timerState });
                    }

                    if (importedData.gallery) {
                        const total = importedData.gallery.length;
                        for (let i = 0; i < total; i++) {
                            const item = importedData.gallery[i];
                            if (btnLabel) btnLabel.innerHTML = `Importing (${i + 1}/${total})...`;
                            await new Promise(r => setTimeout(r, 0));

                            const imgKey = `images/${item.id}`;
                            if (files[imgKey]) {
                                const imgData = files[imgKey];
                                
                                let mime = 'image/jpeg';
                                if (imgData[0] === 0x89 && imgData[1] === 0x50 && imgData[2] === 0x4E && imgData[3] === 0x47) mime = 'image/png';
                                else if (imgData[0] === 0x52 && imgData[1] === 0x49 && imgData[2] === 0x46 && imgData[3] === 0x46) mime = 'image/webp';
                                else if (imgData[0] === 0x47 && imgData[1] === 0x49 && imgData[2] === 0x46) mime = 'image/gif';

                                const blob = new Blob([imgData], { type: mime });
                                await idb.set(item.id, blob);

                                item.thumb = await generateThumbnail(blob);
                            }
                        }
                        await storage.setGallery(importedData.gallery);
                    }
                } else {
                    const fileContent = await file.text();
                    await new Promise(r => setTimeout(r, 10)); 
                    
                    const importedData = JSON.parse(fileContent);
                    if (importedData.settings) await storage.setSettings(importedData.settings);
                    
                    if (importedData.timerSettings) {
                        await chrome.storage.local.set({ nova_timer_settings: importedData.timerSettings });
                    }
                    if (importedData.timerState) {
                        await chrome.storage.local.set({ nova_timer_state: importedData.timerState });
                    }

                    if (importedData.images) {
                        const imageEntries = Object.entries(importedData.images);
                        for (let i = 0; i < imageEntries.length; i++) {
                            const [id, base64] = imageEntries[i];
                            if (btnLabel) btnLabel.innerHTML = `Importing (${i + 1}/${imageEntries.length})...`;
                            await new Promise(r => setTimeout(r, 0));

                            const blob = await base64ToBlob(base64);
                            await idb.set(id, blob);

                            if (importedData.gallery) {
                                const gItem = importedData.gallery.find(g => g.id === id);
                                if (gItem && (!gItem.thumb || !gItem.thumb.startsWith('data:'))) {
                                    gItem.thumb = await generateThumbnail(blob);
                                }
                            }
                        }
                    }

                    if (importedData.gallery) await storage.setGallery(importedData.gallery);
                }

                if (btnLabel) {
                    btnLabel.innerHTML = "Success! Reloading...";
                    btnLabel.style.color = "var(--accent-green)";
                }
                setTimeout(() => window.location.reload(), 1200);
            } catch (err) {
                if (btnLabel) {
                    btnLabel.innerHTML = "Invalid File";
                    btnLabel.style.color = "var(--accent-red)";
                    setTimeout(() => { 
                        btnLabel.innerHTML = origText; 
                        btnLabel.style.pointerEvents = "auto"; 
                        btnLabel.style.color = "";
                    }, 2000);
                }
            }

            e.target.value = '';
        });
    }
}
