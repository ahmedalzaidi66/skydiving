import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Eye, EyeOff, CircleCheck } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import GlossyButton from '@/components/GlossyButton';
import AppHeader from '@/components/AppHeader';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase sets the session from the URL hash (access_token) automatically.
  // We listen for PASSWORD_RECOVERY to confirm the session is active.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSessionReady(true);
      }
    });

    // Also check if there is already an active session (page reload case)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    if (loading) return;
    if (password.length < 6) {
      setError(t.passwordMinLength);
      return;
    }
    if (password !== confirm) {
      setError(t.passwordsNoMatch);
      return;
    }
    setLoading(true);
    setError('');
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <View style={styles.container}>
        <AppHeader title="Reset Password" />
        <View style={styles.successWrap}>
          <CircleCheck size={56} color={Colors.success ?? '#22C55E'} strokeWidth={1.5} />
          <Text style={styles.successTitle}>Password Updated</Text>
          <Text style={styles.successSub}>Your password has been changed successfully.</Text>
          <GlossyButton
            title="Go to Account"
            onPress={() => router.replace('/(tabs)/account' as any)}
            fullWidth
            size="lg"
          />
        </View>
      </View>
    );
  }

  if (!sessionReady) {
    return (
      <View style={styles.container}>
        <AppHeader title="Reset Password" />
        <View style={styles.pendingWrap}>
          <Text style={styles.pendingText}>
            Verifying your reset link…{'\n'}If nothing happens, try clicking the link in your email again.
          </Text>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/account' as any)} style={styles.backLink}>
            <Text style={styles.backLinkText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title="Reset Password" showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Choose a new password</Text>
        <Text style={styles.sub}>Must be at least 6 characters.</Text>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <PasswordField
          label="New Password"
          value={password}
          onChange={setPassword}
          show={showPw}
          onToggleShow={() => setShowPw((p) => !p)}
          placeholder="Min 6 characters"
        />
        <PasswordField
          label="Confirm New Password"
          value={confirm}
          onChange={setConfirm}
          show={showPw}
          placeholder="Re-enter password"
        />
        <GlossyButton
          title="Update Password"
          onPress={handleReset}
          loading={loading}
          disabled={loading}
          fullWidth
          size="lg"
          style={{ marginTop: Spacing.md }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow?: () => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <Lock size={16} color={Colors.textMuted} strokeWidth={2} />
        <View style={styles.fieldInputWrap}>
          {/* TextInput via inline import to avoid circular deps */}
          <TextInputField
            value={value}
            onChange={onChange}
            secureTextEntry={!show}
            placeholder={placeholder}
          />
        </View>
        {onToggleShow && (
          <TouchableOpacity onPress={onToggleShow} activeOpacity={0.7}>
            {show ? (
              <EyeOff size={16} color={Colors.textMuted} />
            ) : (
              <Eye size={16} color={Colors.textMuted} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

import { TextInput } from 'react-native';

function TextInputField({
  value, onChange, secureTextEntry, placeholder,
}: {
  value: string; onChange: (v: string) => void; secureTextEntry?: boolean; placeholder?: string;
}) {
  return (
    <TextInput
      style={styles.textInput}
      value={value}
      onChangeText={onChange}
      secureTextEntry={secureTextEntry}
      placeholder={placeholder}
      placeholderTextColor={Colors.textMuted}
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  heading: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '800',
    marginTop: Spacing.md,
  },
  sub: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  errorBanner: {
    backgroundColor: 'rgba(255,59,48,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.3)',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  fieldWrap: { gap: 6 },
  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  fieldInputWrap: { flex: 1 },
  textInput: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    padding: 0,
    margin: 0,
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  successTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  successSub: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  pendingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  pendingText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
  backLink: { paddingVertical: Spacing.sm },
  backLinkText: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
