let cache: any[] | null = null;

export const getCache = () => cache;
export const setCache = (items: any[]) => {
  cache = items;
};
