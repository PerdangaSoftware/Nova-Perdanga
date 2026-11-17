export const BackgroundPreloader = (() => {
    const queue = new Map();

    const preload = (url, highPriority = false) => {
        if (!url || !url.startsWith('http')) return null;
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
                
                return { objectUrl, blob };
            } catch (e) {
                return { objectUrl: url, blob: null };
            }
        })();

        queue.set(url, promise);
        return promise;
    };

    const consume = (url) => {
        if (queue.has(url)) {
            const promise = queue.get(url);
            queue.delete(url);
            return promise;
        }
        return null;
    };

    const maintain = (activeUrls) => {
        for (const [url, promise] of queue.entries()) {
            if (!activeUrls.includes(url)) {
                promise.then(res => {
                    if (res && res.objectUrl && res.objectUrl.startsWith('blob:')) {
                        URL.revokeObjectURL(res.objectUrl);
                    }
                });
                queue.delete(url);
            }
        }
    };

    return { preload, consume, maintain };
})();

export default BackgroundPreloader;
