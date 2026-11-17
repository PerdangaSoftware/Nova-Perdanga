export function showToast(message, duration = 2200) {
    const container = document.getElementById('toast-container') || document.body;
    const toast = document.createElement('div');
    toast.className = 'nova-toast';
    toast.textContent = message;
    container.appendChild(toast);
    
    requestAnimationFrame(() => toast.classList.add('show'));
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

export async function extractAverageColor(url) {
    try {
        const colorMap = JSON.parse(localStorage.getItem('nova_wh_colors') || '{}');
        if (colorMap[url]) {
            const hex = colorMap[url];
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return { r, g, b };
        }

        let objectUrl = url;
        let isBlob = false;
        
        if (url.startsWith('http')) {
            const res = await fetch(url);
            const blob = await res.blob();
            objectUrl = URL.createObjectURL(blob);
            isBlob = true;
        }

        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                canvas.width = 64; 
                canvas.height = 64;
                ctx.drawImage(img, 0, 0, 64, 64);
                if (isBlob) URL.revokeObjectURL(objectUrl);

                const data = ctx.getImageData(0, 0, 64, 64).data;
                let r = 0, g = 0, b = 0, count = 0;
                let maxVibrant = 0, domR = 0, domG = 0, domB = 0;

                for (let i = 0; i < data.length; i += 16) {
                    let pr = data[i], pg = data[i+1], pb = data[i+2];
                    let max = Math.max(pr, pg, pb), min = Math.min(pr, pg, pb);
                    let sat = max === 0 ? 0 : (max - min) / max;
                    
                    if (sat * max > maxVibrant) {
                        maxVibrant = sat * max;
                        domR = pr; 
                        domG = pg; 
                        domB = pb;
                    }
                    r += pr; 
                    g += pg; 
                    b += pb; 
                    count++;
                }
                
                let avgR = r / count, avgG = g / count, avgB = b / count;
                let finalR = Math.round((avgR + domR) / 2);
                let finalG = Math.round((avgG + domG) / 2);
                let finalB = Math.round((avgB + domB) / 2);
                
                resolve({ r: finalR, g: finalG, b: finalB });
            };
            img.onerror = () => {
                if (isBlob) URL.revokeObjectURL(objectUrl);
                resolve(null);
            };
            img.src = objectUrl;
        });
    } catch (e) { 
        return null; 
    }
}

export function crc32(uint8) {
    const crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        crcTable[i] = c;
    }

    let crc = 0xFFFFFFFF;
    for (let i = 0; i < uint8.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ uint8[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function createZip(files) {
    const textEncoder = new TextEncoder();
    const localHeaders = [];
    const centralEntries = [];
    let offset = 0;

    const crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        crcTable[i] = c;
    }

    function calcCrc(uint8) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < uint8.length; i++) {
            crc = (crc >>> 8) ^ crcTable[(crc ^ uint8[i]) & 0xFF];
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    for (const file of files) {
        const nameBytes = textEncoder.encode(file.name);
        const crc = calcCrc(file.data);
        const size = file.data.length;

        const localHeader = new Uint8Array(30 + nameBytes.length);
        const lv = new DataView(localHeader.buffer);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(4, 20, true);
        lv.setUint16(6, 0x0800, true);
        lv.setUint16(8, 0, true);
        lv.setUint16(10, dosTime, true);
        lv.setUint16(12, dosDate, true);
        lv.setUint32(14, crc, true);
        lv.setUint32(18, size, true);
        lv.setUint32(22, size, true);
        lv.setUint16(26, nameBytes.length, true);
        lv.setUint16(28, 0, true);
        localHeader.set(nameBytes, 30);

        localHeaders.push(localHeader, file.data);

        const cdEntry = new Uint8Array(46 + nameBytes.length);
        const cv = new DataView(cdEntry.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 20, true);
        cv.setUint16(8, 0x0800, true);
        cv.setUint16(10, 0, true);
        cv.setUint16(12, dosTime, true);
        cv.setUint16(14, dosDate, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, size, true);
        cv.setUint32(24, size, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint16(30, 0, true);
        cv.setUint16(32, 0, true);
        cv.setUint16(34, 0, true);
        cv.setUint16(36, 0, true);
        cv.setUint32(38, 0, true);
        cv.setUint32(42, offset, true);
        cdEntry.set(nameBytes, 46);

        centralEntries.push(cdEntry);
        offset += localHeader.length + size;
    }

    const cdOffset = offset;
    let cdSize = 0;
    for (const entry of centralEntries) {
        cdSize += entry.length;
    }

    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, cdOffset, true);
    ev.setUint16(20, 0, true);

    return new Blob([...localHeaders, ...centralEntries, eocd], { type: 'application/zip' });
}

export async function parseZip(blob) {
    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const textDecoder = new TextDecoder();
    const files = {};

    let eocdOffset = -1;
    for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
            eocdOffset = i;
            break;
        }
    }

    if (eocdOffset !== -1) {
        const cdOffset = view.getUint32(eocdOffset + 16, true);
        const cdTotal = view.getUint16(eocdOffset + 10, true);
        let cur = cdOffset;

        for (let i = 0; i < cdTotal && cur + 46 <= buffer.byteLength; i++) {
            if (view.getUint32(cur, true) !== 0x02014b50) break;
            const compSize = view.getUint32(cur + 20, true);
            const nameLen = view.getUint16(cur + 28, true);
            const extraLen = view.getUint16(cur + 30, true);
            const commLen = view.getUint16(cur + 32, true);
            const localOffset = view.getUint32(cur + 42, true);

            const nameBytes = bytes.subarray(cur + 46, cur + 46 + nameLen);
            const filename = textDecoder.decode(nameBytes);

            if (localOffset + 30 <= buffer.byteLength && view.getUint32(localOffset, true) === 0x04034b50) {
                const locNameLen = view.getUint16(localOffset + 26, true);
                const locExtraLen = view.getUint16(localOffset + 28, true);
                const dataStart = localOffset + 30 + locNameLen + locExtraLen;
                files[filename] = bytes.subarray(dataStart, dataStart + compSize);
            }

            cur += 46 + nameLen + extraLen + commLen;
        }
    } else {
        let offset = 0;
        while (offset + 30 <= buffer.byteLength) {
            if (view.getUint32(offset, true) !== 0x04034b50) break;
            const compSize = view.getUint32(offset + 18, true);
            const nameLen = view.getUint16(offset + 26, true);
            const extraLen = view.getUint16(offset + 28, true);
            const filename = textDecoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLen));
            const dataStart = offset + 30 + nameLen + extraLen;
            files[filename] = bytes.subarray(dataStart, dataStart + compSize);
            offset = dataStart + compSize;
        }
    }

    return files;
}

export function generateThumbnail(file, maxWidth = 300, quality = 0.6) {
    return new Promise(resolve => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
            let w = img.width, h = img.height;
            if (w > maxWidth) { 
                h = Math.round((maxWidth / w) * h); 
                w = maxWidth; 
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; 
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(objectUrl);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = objectUrl;
    });
}

export const base64ToBlob = async (base64) => {
    const res = await fetch(base64);
    return await res.blob();
};
