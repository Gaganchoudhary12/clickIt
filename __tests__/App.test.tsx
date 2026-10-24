/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { AutoClicker } from '../src/native/autoClicker';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../src/native/autoClicker', () => ({
  AutoClicker: {
    getStatus: jest.fn(() =>
      Promise.resolve({
        accessibilityEnabled: false,
        serviceConnected: false,
        controlsVisible: false,
        clicking: false,
        intervalMs: 1000,
        radiusDp: 12,
      }),
    ),
    openAccessibilitySettings: jest.fn(() => Promise.resolve()),
    showControls: jest.fn(() => Promise.resolve(true)),
    hideControls: jest.fn(() => Promise.resolve(true)),
    updateSettings: jest.fn(() => Promise.resolve(true)),
    startClicking: jest.fn(() => Promise.resolve(true)),
    stopClicking: jest.fn(() => Promise.resolve(true)),
  },
  autoClickerSupported: true,
}));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

test('renders correctly', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await ReactTestRenderer.act(() => {
    renderer.unmount();
  });
});

test('requires disclosure consent before opening Accessibility settings', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ testID: 'primary-action' }).props.onPress();
  });

  expect(
    renderer.root.findByProps({ testID: 'accessibility-disclosure-modal' })
      .props.visible,
  ).toBe(true);
  expect(AutoClicker.openAccessibilitySettings).not.toHaveBeenCalled();

  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({ testID: 'accessibility-disclosure-decline' })
      .props.onPress();
  });
  expect(
    renderer.root.findByProps({ testID: 'accessibility-disclosure-modal' })
      .props.visible,
  ).toBe(false);
  expect(AutoClicker.openAccessibilitySettings).not.toHaveBeenCalled();

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ testID: 'primary-action' }).props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    await renderer.root
      .findByProps({ testID: 'accessibility-disclosure-continue' })
      .props.onPress();
  });

  expect(
    renderer.root.findByProps({ testID: 'accessibility-disclosure-modal' })
      .props.visible,
  ).toBe(false);
  expect(AutoClicker.openAccessibilitySettings).toHaveBeenCalledTimes(1);

  await ReactTestRenderer.act(() => {
    renderer.unmount();
  });
});
