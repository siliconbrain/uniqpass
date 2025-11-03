const cacheName = 'v2';

const addResourcesToCache = async (resources) => {
    const cache = await caches.open(cacheName);
    await cache.addAll(resources);
};

const putInCache = async (request, response) => {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
};

const cacheFirst = async (event) => {
    const responseFromCache = await caches.match(event.request, {ignoreSearch: true});
    if (responseFromCache) {
        return responseFromCache;
    }
    const responseFromFetch = await fetch(event.request);
    event.waitUntil(putInCache(event.request, responseFromFetch.clone()));
    return responseFromFetch;
};

self.addEventListener('install', (event) => {
    event.waitUntil(addResourcesToCache([
        '.',
    ]))
});

self.addEventListener('fetch', async (event) => {
    event.respondWith(cacheFirst(event));
});