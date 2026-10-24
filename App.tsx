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
import { colors } from './src/theme/colors';

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
              : 'Place the tap target over any app, then use the floating bubble to start or stop.'}
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
            body="Show the controls, switch to any app, and drag the tap target."
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
  root: { flex: 1, backgroundColor: colors.background },
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
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryBright,
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
    borderColor: colors.white,
  },
  headerCopy: { flex: 1, marginLeft: 12 },
  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  tagline: { fontSize: 12, color: colors.textSubtle, marginTop: 1 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
  },
  statusPillActive: { backgroundColor: colors.successSurface },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.textSubtle,
    marginRight: 6,
  },
  statusDotActive: { backgroundColor: colors.success },
  statusText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
    borderColor: colors.primaryBright,
    backgroundColor: colors.targetWash,
  },
  targetPreviewDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primaryBright,
    borderWidth: 5,
    borderColor: colors.primaryPale,
  },
  heroTitle: {
    fontSize: 21,
    color: colors.text,
    fontWeight: '800',
    textAlign: 'center',
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 7,
    marginBottom: 20,
  },
  primaryButton: {
    minHeight: 54,
    alignSelf: 'stretch',
    borderRadius: 17,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  stopButton: { backgroundColor: colors.danger },
  primaryButtonIcon: { color: colors.white, fontSize: 17, marginRight: 10 },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  secondaryButton: { paddingVertical: 13, paddingHorizontal: 16, marginTop: 5 },
  secondaryButtonText: {
    color: colors.primaryBright,
    fontSize: 14,
    fontWeight: '700',
  },
  buttonPressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.6 },
  errorText: {
    color: colors.dangerText,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 11,
    color: colors.textSubtle,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginTop: 25,
    marginBottom: 10,
    marginLeft: 3,
  },
  settingsCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  settingHeader: { flexDirection: 'row', alignItems: 'center' },
  settingCopy: { flex: 1, paddingRight: 12 },
  settingTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  settingDescription: {
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: 4,
  },
  stepper: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceInset,
    borderRadius: 12,
    overflow: 'hidden',
  },
  stepButton: {
    width: 34,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {
    fontSize: 22,
    color: colors.primaryBright,
    fontWeight: '500',
  },
  stepValue: {
    minWidth: 55,
    textAlign: 'center',
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 15 },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBright,
  },
  chipText: { fontSize: 12, color: colors.textSubtle, fontWeight: '700' },
  chipTextSelected: { color: colors.primaryPale },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 19 },
  guideCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  guideStep: { flexDirection: 'row' },
  guideRail: { width: 34, alignItems: 'center' },
  guideNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryBright,
  },
  guideNumberText: {
    color: colors.primaryPale,
    fontSize: 13,
    fontWeight: '800',
  },
  guideLine: {
    width: 1,
    flex: 1,
    backgroundColor: colors.borderStrong,
    marginVertical: 5,
  },
  guideCopy: { flex: 1, paddingLeft: 12, paddingBottom: 22 },
  guideCopyLast: { paddingBottom: 0 },
  guideTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 3,
  },
  guideBody: {
    color: colors.textSubtle,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  privacyNote: {
    flexDirection: 'row',
    backgroundColor: colors.successNote,
    borderRadius: 17,
    padding: 15,
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  privacyIcon: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '900',
    marginRight: 10,
  },
  privacyCopy: { flex: 1 },
  privacyText: {
    flex: 1,
    color: colors.successText,
    fontSize: 12,
    lineHeight: 18,
  },
  privacyLink: {
    alignSelf: 'flex-start',
    color: colors.primaryBright,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 7,
    textDecorationLine: 'underline',
  },
  inlineButtonPressed: { opacity: 0.65 },
});

export default App;
