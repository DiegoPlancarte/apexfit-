import 'fake-indexeddb/auto';

// Ensure window and indexedDB globals exist in node test environment
if (typeof global.window === 'undefined') {
  global.window = global;
}
global.window.indexedDB = global.indexedDB;
if (global.IDBKeyRange) {
  global.window.IDBKeyRange = global.IDBKeyRange;
}

// In-memory localStorage mock for node test runner
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

global.localStorage = localStorageMock;
global.window.localStorage = localStorageMock;

// Event and browser API stubs
if (typeof global.CustomEvent === 'undefined') {
  global.CustomEvent = class CustomEvent {
    constructor(type, eventInitDict = {}) {
      this.type = type;
      this.detail = eventInitDict.detail;
    }
  };
}

const eventListeners = {};
global.window.addEventListener = (type, listener) => {
  if (!eventListeners[type]) eventListeners[type] = [];
  eventListeners[type].push(listener);
};
global.window.removeEventListener = (type, listener) => {
  if (!eventListeners[type]) return;
  eventListeners[type] = eventListeners[type].filter((l) => l !== listener);
};
global.window.dispatchEvent = (event) => {
  const listeners = eventListeners[event.type];
  if (listeners) {
    listeners.forEach((l) => l(event));
  }
  return true;
};

if (typeof global.navigator === 'undefined') {
  global.navigator = { onLine: true };
} else {
  try {
    Object.defineProperty(global.navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  } catch {
    // fallback if read-only
  }
}
