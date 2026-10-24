import { NativeModules, Platform } from 'react-native';

export type AutoClickStatus = {
  accessibilityEnabled: boolean;
  serviceConnected: boolean;
  controlsVisible: boolean;
  clicking: boolean;
  intervalMs: number;
  radiusDp: number;
};

type AutoClickerNativeModule = {
  getStatus(): Promise<AutoClickStatus>;
  openAccessibilitySettings(): Promise<void>;
  showControls(intervalMs: number, radiusDp: number): Promise<boolean>;
  hideControls(): Promise<boolean>;
  updateSettings(intervalMs: number, radiusDp: number): Promise<boolean>;
  startClicking(): Promise<boolean>;
  stopClicking(): Promise<boolean>;
};

const nativeModule = NativeModules.AutoClicker as
  | AutoClickerNativeModule
  | undefined;

export const autoClickerSupported =
  Platform.OS === 'android' && nativeModule != null;

const emptyStatus: AutoClickStatus = {
  accessibilityEnabled: false,
  serviceConnected: false,
  controlsVisible: false,
  clicking: false,
  intervalMs: 1000,
  radiusDp: 12,
};

function requireModule(): AutoClickerNativeModule {
  if (!nativeModule) {
    throw new Error('ClickIt auto clicking is available on Android only.');
  }
  return nativeModule;
}

export const AutoClicker = {
  getStatus: () =>
    nativeModule ? nativeModule.getStatus() : Promise.resolve(emptyStatus),
  openAccessibilitySettings: () => requireModule().openAccessibilitySettings(),
  showControls: (intervalMs: number, radiusDp: number) =>
    requireModule().showControls(intervalMs, radiusDp),
  hideControls: () => requireModule().hideControls(),
  updateSettings: (intervalMs: number, radiusDp: number) =>
    requireModule().updateSettings(intervalMs, radiusDp),
  startClicking: () => requireModule().startClicking(),
  stopClicking: () => requireModule().stopClicking(),
};
