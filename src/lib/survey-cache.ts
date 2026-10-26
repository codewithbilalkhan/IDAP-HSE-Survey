// lib/survey-cache.ts
let cache: any[] | null = null;

const cacheSubs = new Set<() => void>();
let cacheVersion = 0;

export const subscribeCache = (l: () => void) => {
  cacheSubs.add(l);
  return () => {
    cacheSubs.delete(l);
  };
};
export const getCacheVersion = () => cacheVersion;

const notifyCache = () => {
  cacheVersion++;
  cacheSubs.forEach((l) => l());
};

export const getCache = () => cache;
export const setCache = (items: any[]) => {
  cache = items;
  notifyCache();
};

export const clearCache = () => {
  cache = null;
  notifyCache();
};
