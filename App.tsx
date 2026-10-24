import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  AutoClicker,
  AutoClickStatus,
  autoClickerSupported,
} from './src/native/autoClicker';
import {
  AccessibilityDisclosureModal,
  PrivacyPolicyModal,
} from './src/components/ComplianceModals';

const DEFAULT_STATUS: AutoClickStatus = {
  accessibilityEnabled: false,
  serviceConnected: false,
  controlsVisible: false,
  clicking: false,
  intervalMs: 1000,
  radiusDp: 12,
};

const INTERVAL_PRESETS = [250, 500, 1000, 2000];
const RADIUS_PRESETS = [0, 8, 16, 32];

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const hydrated = useRef(false);
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [intervalMs, setIntervalMs] = useState(DEFAULT_STATUS.intervalMs);
  const [radiusDp, setRadiusDp] = useState(DEFAULT_STATUS.radiusDp);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAccessibilityDisclosure, setShowAccessibilityDisclosure] =
    useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const nextStatus = await AutoClicker.getStatus();
      setStatus(nextStatus);
      if (!hydrated.current) {
        setIntervalMs(nextStatus.intervalMs);
        setRadiusDp(nextStatus.radiusDp);
        hydrated.current = true;
      }
    } catch (statusError) {
      setError(messageFromError(statusError));
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const timer = setInterval(refreshStatus, 750);
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        refreshStatus();
      }
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [refreshStatus]);

  const runAction = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await action();
        await refreshStatus();
      } catch (actionError) {
        setError(messageFromError(actionError));
      } finally {
        setBusy(false);
      }
    },
    [refreshStatus],
  );

  const saveSettings = useCallback(
    (nextInterval: number, nextRadius: number) => {
      const safeInterval = Math.min(60000, Math.max(100, nextInterval));
      const safeRadius = Math.min(100, Math.max(0, nextRadius));
      setIntervalMs(safeInterval);
      setRadiusDp(safeRadius);
      setError(null);
      AutoClicker.updateSettings(safeInterval, safeRadius).catch(
        settingsError => {
          setError(messageFromError(settingsError));
        },
      );
    },
    [],
  );

  const handlePrimaryAction = () => {
    if (!autoClickerSupported) {
      setError('ClickIt auto clicking is available on Android only.');
      return;
    }
    if (!status.accessibilityEnabled) {
      setShowAccessibilityDisclosure(true);
      return;
    }
    if (!status.serviceConnected) {
      setError('The accessibility service is starting. Try again in a moment.');
      refreshStatus();
      return;
    }
    if (!status.controlsVisible) {
      runAction(() => AutoClicker.showControls(intervalMs, radiusDp));
      return;
    }
    runAction(() =>
      status.clicking
        ? AutoClicker.stopClicking()
        : AutoClicker.startClicking(),
    );
  };

  const continueToAccessibilitySettings = () => {
    setShowAccessibilityDisclosure(false);
    return runAction(() => AutoClicker.openAccessibilitySettings());
  };

  const primaryLabel = getPrimaryLabel(status, busy);
  const statusLabel = status.clicking
    ? 'CLICKING'
    : status.controlsVisible
    ? 'READY'
    : status.accessibilityEnabled
    ? 'ENABLED'
    : 'SETUP NEEDED';

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <View style={styles.logoDot} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.appName}>clickIt</Text>
            <Text style={styles.tagline}>One target. Repeatable taps.</Text>
          </View>
          <View
            style={[
              styles.statusPill,
              status.clicking && styles.statusPillActive,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                status.clicking && styles.statusDotActive,
              ]}
            />
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.targetPreview}>
            <View style={styles.targetPreviewRing} />
            <View style={styles.targetPreviewDot} />
          </View>
          <Text style={styles.heroTitle}>
            {status.clicking
              ? 'Auto click is running'
              : 'Your floating tap control'}
          </Text>
          <Text style={styles.heroBody}>
            {status.clicking
              ? `Tapping every ${formatInterval(
                  intervalMs,
                )} within a ${radiusDp} dp radius.`
              : 'Place the purple target over any app, then use the floating bubble to start or stop.'}
          </Text>

          <Pressable
            accessibilityLabel={primaryLabel}
            accessibilityRole="button"
            disabled={busy}
            onPress={handlePrimaryAction}
            testID="primary-action"
            style={({ pressed }) => [
              styles.primaryButton,
              status.clicking && styles.stopButton,
              pressed && styles.buttonPressed,
              busy && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonIcon}>
              {status.clicking ? '■' : '▶'}
            </Text>
            <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
          </Pressable>

          {status.controlsVisible && (
            <Pressable
              accessibilityRole="button"
              onPress={() => runAction(() => AutoClicker.hideControls())}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                Hide floating controls
              </Text>
            </Pressable>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        <Text style={styles.sectionLabel}>CLICK BEHAVIOUR</Text>
        <View style={styles.settingsCard}>
          <SettingHeader
            title="Interval"
            description="Time between completed taps"
            value={formatInterval(intervalMs)}
            onMinus={() => saveSettings(intervalMs - 100, radiusDp)}
            onPlus={() => saveSettings(intervalMs + 100, radiusDp)}
          />
          <View style={styles.chipRow}>
            {INTERVAL_PRESETS.map(value => (
              <PresetChip
                key={value}
                label={formatInterval(value)}
                selected={intervalMs === value}
                onPress={() => saveSettings(value, radiusDp)}
              />
            ))}
          </View>

          <View style={styles.divider} />

          <SettingHeader
            title="Tap radius"
            description="Each tap lands inside this circle"
            value={`${radiusDp} dp`}
            onMinus={() => saveSettings(intervalMs, radiusDp - 1)}
            onPlus={() => saveSettings(intervalMs, radiusDp + 1)}
          />
          <View style={styles.chipRow}>
            {RADIUS_PRESETS.map(value => (
              <PresetChip
                key={value}
                label={value === 0 ? 'Exact' : `${value} dp`}
                selected={radiusDp === value}
                onPress={() => saveSettings(intervalMs, value)}
              />
            ))}
          </View>
        </View>

        <Text style={styles.sectionLabel}>HOW TO USE</Text>
        <View style={styles.guideCard}>
          <GuideStep
            number="1"
            title="Enable ClickIt"
            body="Open Accessibility settings and turn on the ClickIt service."
          />
          <GuideStep
            number="2"
            title="Position the target"
            body="Show the controls, switch to any app, and drag the purple target."
          />
          <GuideStep
            number="3"
            title="Tap the green bubble"
            body="It turns red while clicking. Tap it again whenever you want to stop."
            last
          />
        </View>

        <View style={styles.privacyNote}>
          <Text style={styles.privacyIcon}>✓</Text>
          <View style={styles.privacyCopy}>
            <Text style={styles.privacyText}>
              ClickIt uses Accessibility only for taps you explicitly start.
              Screen content retrieval is disabled and no usage data is
              collected.
            </Text>
            <Pressable
              accessibilityLabel="Open privacy and acceptable use"
              accessibilityRole="button"
              onPress={() => setShowPrivacyPolicy(true)}
              style={({ pressed }) => pressed && styles.inlineButtonPressed}
            >
              <Text style={styles.privacyLink}>
                Privacy &amp; acceptable use
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <AccessibilityDisclosureModal
        onContinue={continueToAccessibilitySettings}
        onDecline={() => setShowAccessibilityDisclosure(false)}
        visible={showAccessibilityDisclosure}
      />
      <PrivacyPolicyModal
        onClose={() => setShowPrivacyPolicy(false)}
        visible={showPrivacyPolicy}
      />
    </View>
  );
}

type SettingHeaderProps = {
  title: string;
  description: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
};

function SettingHeader({
  title,
  description,
  value,
  onMinus,
  onPlus,
}: SettingHeaderProps) {
  return (
    <View style={styles.settingHeader}>
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <View style={styles.stepper}>
        <Pressable
          accessibilityLabel={`Decrease ${title}`}
          accessibilityRole="button"
          onPress={onMinus}
          style={({ pressed }) => [
            styles.stepButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.stepButtonText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{value}</Text>
        <Pressable
          accessibilityLabel={`Increase ${title}`}
          accessibilityRole="button"
          onPress={onPlus}
          style={({ pressed }) => [
            styles.stepButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.stepButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

type PresetChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function PresetChip({ label, selected, onPress }: PresetChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

type GuideStepProps = {
  number: string;
  title: string;
  body: string;
  last?: boolean;
};

function GuideStep({ number, title, body, last }: GuideStepProps) {
  return (
    <View style={styles.guideStep}>
      <View style={styles.guideRail}>
        <View style={styles.guideNumber}>
          <Text style={styles.guideNumberText}>{number}</Text>
        </View>
        {!last && <View style={styles.guideLine} />}
      </View>
      <View style={[styles.guideCopy, last && styles.guideCopyLast]}>
        <Text style={styles.guideTitle}>{title}</Text>
        <Text style={styles.guideBody}>{body}</Text>
      </View>
    </View>
  );
}

function getPrimaryLabel(status: AutoClickStatus, busy: boolean): string {
  if (busy) return 'Please wait…';
  if (!status.accessibilityEnabled) return 'Enable accessibility';
  if (!status.serviceConnected) return 'Service is starting…';
  if (!status.controlsVisible) return 'Show floating controls';
  return status.clicking ? 'Stop clicking' : 'Start clicking';
}

function formatInterval(milliseconds: number): string {
  if (milliseconds < 1000) return `${milliseconds} ms`;
  const seconds = milliseconds / 1000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} s`;
}

function messageFromError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Something went wrong. Please try again.';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0E1A' },
  content: { paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#7C5CFC',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 7,
  },
  logoDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  headerCopy: { flex: 1, marginLeft: 12 },
  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  tagline: { fontSize: 12, color: '#8790A7', marginTop: 1 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171D2D',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
  },
  statusPillActive: { backgroundColor: '#113526' },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#677087',
    marginRight: 6,
  },
  statusDotActive: { backgroundColor: '#38D58A' },
  statusText: {
    fontSize: 10,
    color: '#C8CEDE',
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  heroCard: {
    backgroundColor: '#131929',
    borderWidth: 1,
    borderColor: '#242C41',
    borderRadius: 26,
    padding: 22,
    alignItems: 'center',
  },
  targetPreview: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  targetPreviewRing: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: '#765EF0',
    backgroundColor: 'rgba(124, 92, 252, 0.10)',
  },
  targetPreviewDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#7C5CFC',
    borderWidth: 5,
    borderColor: '#E8E4FF',
  },
  heroTitle: {
    fontSize: 21,
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 21,
    color: '#9CA5BB',
    textAlign: 'center',
    marginTop: 7,
    marginBottom: 20,
  },
  primaryButton: {
    minHeight: 54,
    alignSelf: 'stretch',
    borderRadius: 17,
    backgroundColor: '#7C5CFC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  stopButton: { backgroundColor: '#E14D5A' },
  primaryButtonIcon: { color: '#FFFFFF', fontSize: 17, marginRight: 10 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryButton: { paddingVertical: 13, paddingHorizontal: 16, marginTop: 5 },
  secondaryButtonText: { color: '#9E90FF', fontSize: 14, fontWeight: '700' },
  buttonPressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.6 },
  errorText: {
    color: '#FF9098',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 11,
    color: '#69748D',
    fontWeight: '800',
    letterSpacing: 1.3,
    marginTop: 25,
    marginBottom: 10,
    marginLeft: 3,
  },
  settingsCard: {
    backgroundColor: '#111726',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#20283B',
    padding: 18,
  },
  settingHeader: { flexDirection: 'row', alignItems: 'center' },
  settingCopy: { flex: 1, paddingRight: 12 },
  settingTitle: { color: '#F5F6FA', fontSize: 16, fontWeight: '700' },
  settingDescription: { color: '#778198', fontSize: 12, marginTop: 4 },
  stepper: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0F1D',
    borderRadius: 12,
    overflow: 'hidden',
  },
  stepButton: {
    width: 34,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: { fontSize: 22, color: '#9381FF', fontWeight: '500' },
  stepValue: {
    minWidth: 55,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 15 },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: '#1A2132',
    borderWidth: 1,
    borderColor: '#252D42',
  },
  chipSelected: { backgroundColor: '#2B235A', borderColor: '#7760F0' },
  chipText: { fontSize: 12, color: '#8B95AC', fontWeight: '700' },
  chipTextSelected: { color: '#C8C0FF' },
  divider: { height: 1, backgroundColor: '#222A3C', marginVertical: 19 },
  guideCard: {
    backgroundColor: '#111726',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#20283B',
    padding: 18,
  },
  guideStep: { flexDirection: 'row' },
  guideRail: { width: 34, alignItems: 'center' },
  guideNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2A2357',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#705BE1',
  },
  guideNumberText: { color: '#C8C0FF', fontSize: 13, fontWeight: '800' },
  guideLine: {
    width: 1,
    flex: 1,
    backgroundColor: '#30384B',
    marginVertical: 5,
  },
  guideCopy: { flex: 1, paddingLeft: 12, paddingBottom: 22 },
  guideCopyLast: { paddingBottom: 0 },
  guideTitle: {
    color: '#F3F4F8',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 3,
  },
  guideBody: { color: '#7E899F', fontSize: 13, lineHeight: 19, marginTop: 4 },
  privacyNote: {
    flexDirection: 'row',
    backgroundColor: '#0F251F',
    borderRadius: 17,
    padding: 15,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#1C463A',
  },
  privacyIcon: {
    color: '#43D391',
    fontSize: 16,
    fontWeight: '900',
    marginRight: 10,
  },
  privacyCopy: { flex: 1 },
  privacyText: { flex: 1, color: '#83A99B', fontSize: 12, lineHeight: 18 },
  privacyLink: {
    alignSelf: 'flex-start',
    color: '#73DBB0',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 7,
    textDecorationLine: 'underline',
  },
  inlineButtonPressed: { opacity: 0.65 },
});

export default App;
