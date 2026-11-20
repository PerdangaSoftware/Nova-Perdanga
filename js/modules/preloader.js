import { idb } from './storage.js';

export const BackgroundPreloader = (() => {
    const queue = new Map();
    const lruCache = new Map();
    const MAX_LRU = 12;

    const addToLru = (key, data) => {
        if (lruCache.has(key)) {
            lruCache.delete(key);
        } else if (lruCache.size >= MAX_LRU) {
            const oldestKey = lruCache.keys().next().value;
            const evicted = lruCache.get(oldestKey);
            if (evicted && evicted.objectUrl && evicted.objectUrl.startsWith('blob:')) {
                URL.revokeObjectURL(evicted.objectUrl);
            }
            lruCache.delete(oldestKey);
        }
        lruCache.set(key, data);
    };

    const preload = (url, highPriority = false) => {
        if (!url || !url.startsWith('http')) return null;
        if (lruCache.has(url)) {
            const data = lruCache.get(url);
            lruCache.delete(url);
            lruCache.set(url, data);
            return Promise.resolve(data);
        }
        if (queue.has(url)) return queue.get(url);

        const promise = (async () => {
            try {
                const res = await fetch(url, { priority: highPriority ? 'high' : 'low' });
                if (!res.ok) throw new Error("Fetch failed");
                const blob = await res.blob();
                const objectUrl = URL.createObjectURL(blob);
                
                const img = new Image();
                img.src = objectUrl;
                await img.decode().catch(() => null);
                
                const result = { objectUrl, blob };
                addToLru(url, result);
                queue.delete(url);
                return result;
            } catch (e) {
                queue.delete(url);
                return { objectUrl: url, blob: null };
            }
        })();

        queue.set(url, promise);
        return promise;
    };

    const preloadLocal = (id, existingBlob = null) => {
        if (!id) return null;
        if (lruCache.has(id)) {
            const data = lruCache.get(id);
            lruCache.delete(id);
            lruCache.set(id, data);
            return Promise.resolve(data);
        }
        if (queue.has(id)) return queue.get(id);

        const promise = (async () => {
            try {
                let blob = existingBlob;
                if (!blob) {
                    blob = await idb.get(id);
                }
                if (!blob) {
                    queue.delete(id);
                    return null;
                }
                const objectUrl = URL.createObjectURL(blob);
                const img = new Image();
                img.src = objectUrl;
                await img.decode().catch(() => null);
                const result = { objectUrl, blob };
                addToLru(id, result);
                queue.delete(id);
                return result;
            } catch (e) {
                queue.delete(id);
                return null;
            }
        })();

        queue.set(id, promise);
        return promise;
    };

    const get = (key) => {
        if (!key) return null;
        if (lruCache.has(key)) {
            const data = lruCache.get(key);
            lruCache.delete(key);
            lruCache.set(key, data);
            return Promise.resolve(data);
        }
        if (queue.has(key)) {
            return queue.get(key);
        }
        return null;
    };

    const consume = (url) => {
        return get(url);
    };

    const maintain = (activeUrls) => {
        if (!Array.isArray(activeUrls)) return;
        for (const [url, promise] of queue.entries()) {
            if (!activeUrls.includes(url)) {
                queue.delete(url);
            }
        }
    };

    return { preload, preloadLocal, get, consume, maintain };
})();

export default BackgroundPreloader;