// A safe wrapper around localStorage that falls back to in-memory storage 
// if localStorage is blocked by iframe constraints, cookies disabled, or security policies.

const inMemoryStorage: Record<string, string> = {};

export const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`[SafeStorage] Failed to read ${key} from localStorage, using in-memory:`, e);
    }
    return inMemoryStorage[key] !== undefined ? inMemoryStorage[key] : null;
  },

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn(`[SafeStorage] Failed to write ${key} to localStorage, using in-memory:`, e);
    }
    inMemoryStorage[key] = String(value);
  },

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (e) {
      console.warn(`[SafeStorage] Failed to remove ${key} from localStorage:`, e);
    }
    delete inMemoryStorage[key];
  }
};
