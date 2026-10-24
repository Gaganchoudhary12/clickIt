import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../theme/colors';

type AccessibilityDisclosureModalProps = {
  visible: boolean;
  onContinue: () => void;
  onDecline: () => void;
};

export function AccessibilityDisclosureModal({
  visible,
  onContinue,
  onDecline,
}: AccessibilityDisclosureModalProps) {
  return (
    <Modal
      animationType="fade"
      hardwareAccelerated
      onRequestClose={onDecline}
      statusBarTranslucent
      testID="accessibility-disclosure-modal"
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          style={styles.card}
          testID="accessibility-disclosure"
        >
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>◎</Text>
            </View>
            <Text style={styles.eyebrow}>ACCESSIBILITY ACCESS</Text>
            <Text style={styles.title}>
              Permission needed for automatic taps
            </Text>
            <Text style={styles.body}>
              To repeat taps across other apps, ClickIt needs Android&apos;s
              AccessibilityService permission. When you start it, the service
              displays a floating target and control, then taps only at the
              location, interval, and radius you choose.
            </Text>

            <View style={styles.detailBox}>
              <DisclosurePoint>
                ClickIt does not read screen content or inspect content in other
                apps.
              </DisclosurePoint>
              <DisclosurePoint>
                Tap settings and overlay positions are stored only on this
                device.
              </DisclosurePoint>
              <DisclosurePoint last>
                No personal information or usage data is collected, sent, or
                shared.
              </DisclosurePoint>
            </View>

            <Text style={styles.caption}>
              Continue opens Android Accessibility settings. You can choose Not
              now or disable ClickIt there at any time.
            </Text>

            <Pressable
              accessibilityLabel="Continue to Accessibility settings"
              accessibilityRole="button"
              onPress={onContinue}
              testID="accessibility-disclosure-continue"
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Not now"
              accessibilityRole="button"
              onPress={onDecline}
              testID="accessibility-disclosure-decline"
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Not now</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

type PrivacyPolicyModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function PrivacyPolicyModal({
  visible,
  onClose,
}: PrivacyPolicyModalProps) {
  return (
    <Modal
      animationType="slide"
      hardwareAccelerated
      onRequestClose={onClose}
      statusBarTranslucent
      testID="privacy-policy-modal"
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          style={styles.card}
          testID="privacy-policy"
        >
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.eyebrow}>CLICKIT</Text>
            <Text style={styles.title}>Privacy &amp; acceptable use</Text>
            <Text style={styles.updated}>Effective October 24, 2026</Text>

            <PolicySection title="AccessibilityService">
              ClickIt uses Android AccessibilityService only to display its
              floating target and controls over other apps and to perform taps
              that you explicitly start. The app does not retrieve or inspect
              screen content and does not make decisions based on content from
              another app.
            </PolicySection>

            <PolicySection title="Information stored on your device">
              Your selected interval, tap radius, floating-control visibility,
              and overlay positions are saved locally on your device. This lets
              ClickIt restore your settings. ClickIt does not collect, transmit,
              sell, or share personal information or usage data.
            </PolicySection>

            <PolicySection title="Retention and your choices">
              Local settings remain until you clear ClickIt&apos;s app data or
              uninstall the app. You may decline Accessibility access, disable
              it later in Android Settings, hide the floating controls, or stop
              tapping at any time.
            </PolicySection>

            <PolicySection title="Acceptable use">
              Do not use ClickIt to click advertisements, confirm purchases,
              interact with permission or security dialogs, cheat in games,
              bypass service limits, or interfere with another app or service
              without authorization. You are responsible for following the rules
              of every app and service you use.
            </PolicySection>

            <PolicySection title="Contact">
              The current support contact and public privacy-policy link are
              provided on ClickIt&apos;s Google Play listing.
            </PolicySection>

            <Pressable
              accessibilityLabel="Close privacy and acceptable use"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.primaryButton,
                styles.closeButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Close</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

type DisclosurePointProps = {
  children: React.ReactNode;
  last?: boolean;
};

function DisclosurePoint({ children, last }: DisclosurePointProps) {
  return (
    <View style={[styles.point, last && styles.pointLast]}>
      <Text style={styles.pointIcon}>✓</Text>
      <Text style={styles.pointText}>{children}</Text>
    </View>
  );
}

type PolicySectionProps = {
  title: string;
  children: React.ReactNode;
};

function PolicySection({ title, children }: PolicySectionProps) {
  return (
    <View style={styles.policySection}>
      <Text style={styles.policyTitle}>{title}</Text>
      <Text style={styles.policyBody}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.modalBackdrop,
    paddingHorizontal: 18,
    paddingVertical: 30,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '92%',
    overflow: 'hidden',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  scrollContent: { padding: 22 },
  iconCircle: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBright,
    marginBottom: 17,
  },
  iconText: { color: colors.primaryPale, fontSize: 27, fontWeight: '700' },
  eyebrow: {
    color: colors.primaryBright,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: 7,
  },
  title: {
    color: colors.text,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
    marginBottom: 12,
  },
  updated: {
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: -5,
    marginBottom: 20,
  },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  detailBox: {
    marginTop: 18,
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.successBorder,
    backgroundColor: colors.successNote,
  },
  point: { flexDirection: 'row', marginBottom: 12 },
  pointLast: { marginBottom: 0 },
  pointIcon: {
    width: 22,
    color: colors.success,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
  },
  pointText: {
    flex: 1,
    color: colors.successText,
    fontSize: 13,
    lineHeight: 20,
  },
  caption: {
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 16,
    marginBottom: 20,
  },
  primaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
  secondaryButtonText: {
    color: colors.primaryPale,
    fontSize: 14,
    fontWeight: '700',
  },
  buttonPressed: { opacity: 0.72 },
  policySection: { marginBottom: 18 },
  policyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  policyBody: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  closeButton: { marginTop: 2 },
});
