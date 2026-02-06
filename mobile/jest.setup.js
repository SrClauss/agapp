// Ensure React Native dev flag exists
global.__DEV__ = true;
// Provide a minimal batched bridge config to satisfy React Native internals during tests
global.__fbBatchedBridgeConfig = global.__fbBatchedBridgeConfig || { remoteModuleConfig: [] };
// Provide a minimal TurboModuleRegistry to satisfy native module lookups in tests
global.TurboModuleRegistry = global.TurboModuleRegistry || { getEnforcing: (name) => ({}) };
// Provide a minimal NativeModules.DeviceInfo shim (avoid requiring react-native)
global.NativeModules = global.NativeModules || {};
global.NativeModules.DeviceInfo = global.NativeModules.DeviceInfo || { getConstants: () => ({}) };
// Provide Dimensions shim globally to avoid requiring react-native in setup
global.Dimensions = global.Dimensions || {
  get: () => ({ width: 400, height: 800, scale: 2, fontScale: 1 }),
  set: () => {},
  screen: { width: 400, height: 800 },
  window: { width: 400, height: 800 }
};

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// Mock SecureStore
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Silence console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
