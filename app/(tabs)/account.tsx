import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { User, Mail, Lock, LogOut, Package, Eye, EyeOff, ShieldCheck, Heart, ChevronDown, ChevronUp, Trash2, Plus, Minus, TriangleAlert as AlertTriangle, Tag, Pencil, Zap, X, MessageCircle, Calendar, KeyRound, MailCheck, Sun, Moon, Monitor } from 'lucide-react-native';
import { useWishlist } from '@/context/WishlistContext';
import { useRouter } from 'expo-router';
import { openWhatsApp } from '@/components/WhatsAppButton';
import { supabase, Order, OrderItem } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import AppHeader from '@/components/AppHeader';
import GlossyButton from '@/components/GlossyButton';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, FontSize, Radius, Shadow } from '@/constants/theme';
import { useThemeColors, useTheme, ThemeColors, UserThemeChoice } from '@/context/ThemeContext';
import { UsedGearListing } from '@/app/(tabs)/marketplace';

const SHIPPING_THRESHOLD = 500;
const SHIPPING_FEE = 29.99;

export default function AccountScreen() {
  const { isAuthenticated } = useAuth();
  // confirmedEmail is lifted here so SignupConfirmation survives even if
  // Supabase auto-confirms the session (email confirmation disabled) and
  // isAuthenticated flips to true before the user dismisses the screen.
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState<string | null>(null);

  if (pendingConfirmEmail) {
    return <SignupConfirmationScreen email={pendingConfirmEmail} onDone={() => setPendingConfirmEmail(null)} />;
  }

  if (!isAuthenticated) {
    return <AuthView onSignupSuccess={(email) => setPendingConfirmEmail(email)} />;
  }

  return <ProfileView />;
}

function SignupConfirmation({ email, onGoToLogin }: { email: string; onGoToLogin: () => void }) {
  const C = useThemeColors();
  const scStyles = makeScStyles(C);
  return (
    <View style={scStyles.container}>
      <View style={scStyles.iconWrap}>
        <MailCheck size={52} color={C.neonBlue} strokeWidth={1.5} />
      </View>
      <Text style={scStyles.title}>Account created successfully!</Text>
      <Text style={scStyles.body}>
        We sent a confirmation email to{'\n'}
        <Text style={scStyles.emailHighlight}>{email}</Text>
      </Text>
      <Text style={scStyles.body}>
        Please verify your email before signing in.
      </Text>
      <View style={scStyles.warnBox}>
        <AlertTriangle size={15} color="#F59E0B" strokeWidth={2} />
        <Text style={scStyles.warnText}>
          If you don't see the email, check your Spam / Junk folder.
        </Text>
      </View>
      <GlossyButton
        title="Go to Sign In"
        onPress={onGoToLogin}
        fullWidth
        size="lg"
        style={{ marginTop: Spacing.sm }}
      />
    </View>
  );
}

function SignupConfirmationScreen({ email, onDone }: { email: string; onDone: () => void }) {
  const { t } = useLanguage();
  const C = useThemeColors();
  const styles = makeStyles(C);
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title={t.account} />
      <ScrollView
        contentContainerStyle={styles.authContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.authInner}>
          <SignupConfirmation email={email} onGoToLogin={onDone} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeScStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.lg,
    },
    iconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: C.neonBlueGlow,
      borderWidth: 1.5,
      borderColor: C.neonBlueBorder,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
    title: {
      color: C.textPrimary,
      fontSize: FontSize.lg,
      fontWeight: '800',
      textAlign: 'center',
      lineHeight: 26,
    },
    body: {
      color: C.textSecondary,
      fontSize: FontSize.sm,
      textAlign: 'center',
      lineHeight: 22,
    },
    emailHighlight: {
      color: C.neonBlue,
      fontWeight: '700',
    },
    warnBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.xs,
      backgroundColor: 'rgba(245,158,11,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(245,158,11,0.3)',
      borderRadius: Radius.md,
      padding: Spacing.md,
      width: '100%',
    },
    warnText: {
      flex: 1,
      color: '#F59E0B',
      fontSize: FontSize.xs,
      lineHeight: 18,
      fontWeight: '500',
    },
  });
}

function AuthView({ onSignupSuccess }: { onSignupSuccess: (email: string) => void }) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const { t } = useLanguage();
  const router = useRouter();
  const C = useThemeColors();
  const styles = makeStyles(C);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title={t.account} />
      <ScrollView
        contentContainerStyle={styles.authContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.authInner}>
          <View style={styles.authHeader}>
            <User size={40} color={C.neonBlue} strokeWidth={1.5} />
            <Text style={styles.authTitle}>
              {tab === 'login' ? t.welcomeBack : t.createAccount}
            </Text>
            <Text style={styles.authSubtitle}>
              {tab === 'login' ? t.signInSubtitle : t.registerSubtitle}
            </Text>
          </View>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={styles.authTab}
              onPress={() => setTab('login')}
              activeOpacity={0.8}
            >
              {tab === 'login' && (
                <LinearGradient
                  colors={['#0099CC', '#00BFFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                />
              )}
              <Text style={tab === 'login' ? styles.authTabTextActive : styles.authTabText}>
                {t.login}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.authTab}
              onPress={() => setTab('register')}
              activeOpacity={0.8}
            >
              {tab === 'register' && (
                <LinearGradient
                  colors={['#0099CC', '#00BFFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                />
              )}
              <Text style={tab === 'register' ? styles.authTabTextActive : styles.authTabText}>
                {t.register}
              </Text>
            </TouchableOpacity>
          </View>

          {tab === 'login' ? (
            <LoginForm />
          ) : (
            <RegisterForm onSuccess={onSignupSuccess} />
          )}

          <TouchableOpacity
            style={styles.adminLinkBtn}
            onPress={() => router.push('/admin')}
            activeOpacity={0.8}
          >
            <ShieldCheck size={14} color={C.textMuted} strokeWidth={2} />
            <Text style={styles.adminLinkBtnText}>Admin Panel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ForgotPasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const C = useThemeColors();
  const fpStyles = makeFpStyles(C);
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await forgotPassword(email);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Failed to send reset email.');
      return;
    }
    setSent(true);
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    setSent(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={fpStyles.overlay}>
        <View style={fpStyles.modal}>
          <View style={fpStyles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <KeyRound size={18} color={C.neonBlue} strokeWidth={2} />
              <Text style={fpStyles.title}>Reset Password</Text>
            </View>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.8}>
              <X size={20} color={C.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          {sent ? (
            <View style={fpStyles.sentWrap}>
              <Text style={fpStyles.sentText}>
                A password reset link has been sent to{'\n'}
                <Text style={{ color: C.neonBlue }}>{email}</Text>
              </Text>
              <Text style={fpStyles.sentHint}>Check your inbox and follow the link to set a new password.</Text>
              <GlossyButton title="Done" onPress={handleClose} fullWidth size="md" />
            </View>
          ) : (
            <>
              {error ? <ErrorBanner message={error} /> : null}
              <Text style={fpStyles.desc}>Enter your account email and we'll send you a reset link.</Text>
              <AuthField
                label="Email"
                value={email}
                onChange={setEmail}
                icon={<Mail size={16} color={C.textMuted} />}
                keyboardType="email-address"
                placeholder="your@email.com"
              />
              <GlossyButton
                title={loading ? 'Sending…' : 'Send Reset Link'}
                onPress={handleSend}
                loading={loading}
                disabled={loading}
                fullWidth
                size="lg"
                style={{ marginTop: Spacing.sm }}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function makeFpStyles(C: ThemeColors) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: C.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: C.neonBlueBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: C.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  desc: {
    color: C.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  sentWrap: {
    gap: Spacing.md,
  },
  sentText: {
    color: C.textPrimary,
    fontSize: FontSize.sm,
    lineHeight: 22,
    textAlign: 'center',
  },
  sentHint: {
    color: C.textMuted,
    fontSize: FontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
  });
}

function LoginForm() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const C = useThemeColors();
  const styles = makeStyles(C);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotVisible, setForgotVisible] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    if (!email.trim() || !email.includes('@')) {
      setError(t.invalidEmail);
      return;
    }
    if (!password.trim()) {
      setError(t.passwordRequired);
      return;
    }
    setLoading(true);
    setError('');
    const result = await login(email, password);
    if (!result.success) setError(result.error ?? t.invalidCredentials);
    setLoading(false);
  };

  return (
    <View style={styles.form}>
      <ForgotPasswordModal visible={forgotVisible} onClose={() => setForgotVisible(false)} />
      {error ? <ErrorBanner message={error} /> : null}
      <AuthField
        label={t.email}
        value={email}
        onChange={setEmail}
        icon={<Mail size={16} color={C.textMuted} />}
        keyboardType="email-address"
        placeholder={t.emailPlaceholder}
      />
      <AuthField
        label={t.password}
        value={password}
        onChange={setPassword}
        icon={<Lock size={16} color={C.textMuted} />}
        secureTextEntry={!showPw}
        placeholder="••••••••"
        right={
          <TouchableOpacity onPress={() => setShowPw((p) => !p)}>
            {showPw ? (
              <EyeOff size={16} color={C.textMuted} />
            ) : (
              <Eye size={16} color={C.textMuted} />
            )}
          </TouchableOpacity>
        }
      />
      <TouchableOpacity
        onPress={() => setForgotVisible(true)}
        activeOpacity={0.7}
        style={styles.forgotBtn}
      >
        <Text style={styles.forgotBtnText}>Forgot password?</Text>
      </TouchableOpacity>
      <GlossyButton
        title={t.signIn}
        onPress={handleLogin}
        loading={loading}
        disabled={loading}
        fullWidth
        size="lg"
        style={{ marginTop: 4, height: 46, borderRadius: 16 }}
        textStyle={{ fontSize: 15 }}
      />
    </View>
  );
}

function validateBirthday(day: string, month: string, year: string): string | null {
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (!day || !month || !year) return 'Birthday is required';
  if (isNaN(d) || d < 1 || d > 31) return 'Enter a valid day (1–31)';
  if (isNaN(m) || m < 1 || m > 12) return 'Enter a valid month (1–12)';
  const currentYear = new Date().getFullYear();
  if (isNaN(y) || y < 1900 || y > currentYear - 5) return `Enter a valid year (1900–${currentYear - 5})`;
  const date = new Date(y, m - 1, d);
  if (date.getMonth() !== m - 1 || date.getDate() !== d) return 'Enter a valid date';
  return null;
}

function toBirthdayISO(day: string, month: string, year: string): string {
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseBirthdayISO(iso: string): { day: string; month: string; year: string } {
  const [y, m, d] = iso.split('-');
  return { day: String(parseInt(d, 10)), month: String(parseInt(m, 10)), year: y };
}

function BirthdayFields({
  day, month, year,
  onDay, onMonth, onYear,
}: {
  day: string; month: string; year: string;
  onDay: (v: string) => void; onMonth: (v: string) => void; onYear: (v: string) => void;
}) {
  const C = useThemeColors();
  const bdInputStyles = makeBdInputStyles(C);
  const { isRTL } = useLanguage();
  const label = isRTL ? 'تاريخ الميلاد' : 'Birthday';

  return (
    <View style={bdInputStyles.wrapper}>
      <View style={bdInputStyles.labelRow}>
        <Calendar size={14} color={C.neonBlue} strokeWidth={2} />
        <Text style={bdInputStyles.label}>{label}</Text>
        <Text style={bdInputStyles.required}>*</Text>
      </View>
      <View style={bdInputStyles.row}>
        <View style={bdInputStyles.col}>
          <Text style={bdInputStyles.subLabel}>{isRTL ? 'يوم' : 'Day'}</Text>
          <TextInput
            style={bdInputStyles.input}
            value={day}
            onChangeText={(v) => onDay(v.replace(/\D/g, '').slice(0, 2))}
            placeholder="DD"
            placeholderTextColor={C.textMuted}
            keyboardType="number-pad"
            maxLength={2}
            textAlign="center"
          />
        </View>
        <Text style={bdInputStyles.sep}>/</Text>
        <View style={bdInputStyles.col}>
          <Text style={bdInputStyles.subLabel}>{isRTL ? 'شهر' : 'Month'}</Text>
          <TextInput
            style={bdInputStyles.input}
            value={month}
            onChangeText={(v) => onMonth(v.replace(/\D/g, '').slice(0, 2))}
            placeholder="MM"
            placeholderTextColor={C.textMuted}
            keyboardType="number-pad"
            maxLength={2}
            textAlign="center"
          />
        </View>
        <Text style={bdInputStyles.sep}>/</Text>
        <View style={[bdInputStyles.col, { flex: 2 }]}>
          <Text style={bdInputStyles.subLabel}>{isRTL ? 'سنة' : 'Year'}</Text>
          <TextInput
            style={bdInputStyles.input}
            value={year}
            onChangeText={(v) => onYear(v.replace(/\D/g, '').slice(0, 4))}
            placeholder="YYYY"
            placeholderTextColor={C.textMuted}
            keyboardType="number-pad"
            maxLength={4}
            textAlign="center"
          />
        </View>
      </View>
    </View>
  );
}

function makeBdInputStyles(C: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      borderWidth: 1,
      borderColor: C.neonBlueBorder,
      borderRadius: Radius.md,
      backgroundColor: C.backgroundSecondary,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    label: {
      color: C.textSecondary,
      fontSize: FontSize.xs,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    required: {
      color: C.error,
      fontSize: FontSize.xs,
      fontWeight: '700',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
    },
    col: {
      flex: 1,
      gap: 4,
    },
    subLabel: {
      color: C.textMuted,
      fontSize: 10,
      fontWeight: '600',
      textAlign: 'center',
      letterSpacing: 0.3,
    },
    input: {
      backgroundColor: C.backgroundInput,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: Spacing.xs,
      paddingVertical: Spacing.sm,
      color: C.textPrimary,
      fontSize: 13,
      fontWeight: '600',
      height: 38,
      textAlignVertical: 'center',
    },
    sep: {
      color: C.textMuted,
      fontSize: FontSize.lg,
      fontWeight: '300',
      paddingBottom: 6,
    },
  });
}

function RegisterForm({ onSuccess }: { onSuccess: (email: string) => void }) {
  const { register } = useAuth();
  const { t } = useLanguage();
  const C = useThemeColors();
  const styles = makeStyles(C);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [bdDay, setBdDay] = useState('');
  const [bdMonth, setBdMonth] = useState('');
  const [bdYear, setBdYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (loading) return;
    if (!firstName.trim()) { setError(t.firstNameRequired); return; }
    if (!lastName.trim()) { setError(t.lastNameRequired); return; }
    if (!email.trim() || !email.includes('@')) { setError(t.validEmailRequired); return; }
    if (password.length < 6) { setError(t.passwordMinLength); return; }
    if (password !== confirm) { setError(t.passwordsNoMatch); return; }
    const bdError = validateBirthday(bdDay, bdMonth, bdYear);
    if (bdError) { setError(bdError); return; }
    setLoading(true);
    setError('');
    try {
      const result = await register(firstName, lastName, email, password, toBirthdayISO(bdDay, bdMonth, bdYear));
      if (!result.success) {
        const msg = result.error ?? 'Registration failed. Please try again.';
        console.error('[RegisterForm] register failed:', msg);
        setError(
          msg.toLowerCase().includes('rate limit')
            ? 'Please wait a minute before trying again.'
            : msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')
            ? 'An account with this email already exists. Try signing in.'
            : msg
        );
        return;
      }
      onSuccess(email.trim().toLowerCase());
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.form}>
      {error ? <ErrorBanner message={error} /> : null}
      <View style={styles.nameRow}>
        <View style={{ flex: 1 }}>
          <AuthField label={t.firstName} value={firstName} onChange={setFirstName} placeholder="John" />
        </View>
        <View style={{ flex: 1 }}>
          <AuthField label={t.lastName} value={lastName} onChange={setLastName} placeholder="Doe" />
        </View>
      </View>
      <AuthField
        label={t.email}
        value={email}
        onChange={setEmail}
        icon={<Mail size={16} color={C.textMuted} />}
        keyboardType="email-address"
        placeholder={t.emailPlaceholder}
      />
      <AuthField
        label={t.password}
        value={password}
        onChange={setPassword}
        icon={<Lock size={16} color={C.textMuted} />}
        secureTextEntry={!showPw}
        placeholder={t.passwordPlaceholder}
        right={
          <TouchableOpacity onPress={() => setShowPw((p) => !p)}>
            {showPw ? <EyeOff size={16} color={C.textMuted} /> : <Eye size={16} color={C.textMuted} />}
          </TouchableOpacity>
        }
      />
      <AuthField
        label={t.confirmPassword}
        value={confirm}
        onChange={setConfirm}
        icon={<Lock size={16} color={C.textMuted} />}
        secureTextEntry={!showPw}
        placeholder={t.confirmPassword}
      />
      <BirthdayFields
        day={bdDay} month={bdMonth} year={bdYear}
        onDay={setBdDay} onMonth={setBdMonth} onYear={setBdYear}
      />
      <GlossyButton
        title={t.createAccount}
        onPress={handleRegister}
        loading={loading}
        disabled={loading}
        fullWidth
        size="lg"
        style={{ marginTop: 4, height: 46, borderRadius: 16 }}
        textStyle={{ fontSize: 15 }}
      />
    </View>
  );
}

function WhatsAppContactCard() {
  const { t } = useLanguage();
  const C = useThemeColors();
  const styles = makeStyles(C);
  return (
    <TouchableOpacity
      style={styles.whatsappCard}
      onPress={() => openWhatsApp()}
      activeOpacity={0.82}
    >
      <View style={styles.whatsappIconWrap}>
        <MessageCircle size={22} color="#25D366" strokeWidth={2} fill="#25D366" />
      </View>
      <View style={styles.whatsappCardText}>
        <Text style={styles.whatsappCardTitle}>{(t as any).whatsappContact}</Text>
        <Text style={styles.whatsappCardSub}>{(t as any).whatsappContactSub}</Text>
      </View>
      <View style={styles.whatsappArrow}>
        <Text style={styles.whatsappArrowText}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

function EditBirthdayModal({
  visible,
  current,
  onClose,
  onSaved,
}: {
  visible: boolean;
  current: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const C = useThemeColors();
  const bdStyles = makeBdStyles(C);
  const { updateProfile } = useAuth();
  const parsed = current ? parseBirthdayISO(current) : { day: '', month: '', year: '' };
  const [day, setDay] = useState(parsed.day);
  const [month, setMonth] = useState(parsed.month);
  const [year, setYear] = useState(parsed.year);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (visible) {
      const p = current ? parseBirthdayISO(current) : { day: '', month: '', year: '' };
      setDay(p.day); setMonth(p.month); setYear(p.year);
      setError('');
    }
  }, [visible, current]);

  const handleSave = async () => {
    const bdError = validateBirthday(day, month, year);
    if (bdError) { setError(bdError); return; }
    setSaving(true);
    setError('');
    const result = await updateProfile({ birthday: toBirthdayISO(day, month, year) });
    setSaving(false);
    if (!result.success) { setError(result.error ?? 'Failed to save'); return; }
    onSaved();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={bdStyles.overlay}>
        <View style={bdStyles.modal}>
          <View style={bdStyles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} color={C.neonBlue} strokeWidth={2} />
              <Text style={bdStyles.title}>Edit Birthday</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.8}>
              <X size={20} color={C.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          {error ? <ErrorBanner message={error} /> : null}
          <BirthdayFields
            day={day} month={month} year={year}
            onDay={setDay} onMonth={setMonth} onYear={setYear}
          />
          <GlossyButton
            title={saving ? 'Saving…' : 'Save Birthday'}
            onPress={handleSave}
            loading={saving}
            fullWidth
            size="lg"
          />
        </View>
      </View>
    </Modal>
  );
}

const THEME_OPTIONS: { value: UserThemeChoice; label: string; Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }> }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark',  label: 'Dark',  Icon: Moon },
  { value: 'system',label: 'System',Icon: Monitor },
];

function ThemeSelector() {
  const C = useThemeColors();
  const { userChoice, setThemePreset } = useTheme();
  const styles = makeStyles(C);
  return (
    <View style={styles.themeSelectorRow}>
      <Text style={styles.langLabel}>Theme</Text>
      <View style={styles.themeOptions}>
        {THEME_OPTIONS.map(({ value, label, Icon }) => {
          const active = userChoice === value;
          return (
            <TouchableOpacity
              key={value}
              style={[styles.themeOption, active && styles.themeOptionActive]}
              onPress={() => setThemePreset(value)}
              activeOpacity={0.75}
            >
              <Icon size={14} color={active ? C.white : C.textMuted} strokeWidth={2} />
              <Text style={[styles.themeOptionText, active && styles.themeOptionTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function ProfileView() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const C = useThemeColors();
  const bdStyles = makeBdStyles(C);
  const styles = makeStyles(C);
  const { count: wishlistCount } = useWishlist();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [editBdVisible, setEditBdVisible] = useState(false);

  useEffect(() => {
    if (!user?.email) {
      setLoadingOrders(false);
      return;
    }
    supabase
      .from('orders')
      .select('*')
      .eq('customer_email', user.email)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setOrders(data);
        setLoadingOrders(false);
      });
  }, [user]);

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <View style={styles.container}>
      <AppHeader title={t.account} />
      <ScrollView contentContainerStyle={styles.profileContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || 'SG'}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
          <TouchableOpacity onPress={() => { logout(); }} style={styles.logoutBtn} activeOpacity={0.8}>
            <LogOut size={18} color={C.error} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Birthday row */}
        <TouchableOpacity
          style={bdStyles.row}
          onPress={() => setEditBdVisible(true)}
          activeOpacity={0.8}
        >
          <Calendar size={16} color={C.neonBlue} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={bdStyles.rowLabel}>Birthday</Text>
            {user?.birthday ? (
              <Text style={bdStyles.rowValue}>
                {new Date(user.birthday + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            ) : (
              <Text style={bdStyles.rowEmpty}>Tap to add your birthday</Text>
            )}
          </View>
          <Pencil size={14} color={C.textMuted} strokeWidth={2} />
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <StatCard label={t.jumps} value="0+" />
          <StatCard label={t.orders} value={String(orders.length)} />
          <StatCard label={t.level} value="Pro" />
        </View>

        <TouchableOpacity
          style={styles.wishlistBtn}
          onPress={() => router.push('/(tabs)/wishlist' as any)}
          activeOpacity={0.85}
        >
          <View style={styles.wishlistBtnLeft}>
            <Heart size={18} color="#FF4D6D" fill="#FF4D6D" strokeWidth={2} />
            <Text style={styles.wishlistBtnText}>{t.myWishlist ?? 'My Wishlist'}</Text>
          </View>
          {wishlistCount > 0 && (
            <View style={styles.wishlistBtnBadge}>
              <Text style={styles.wishlistBtnBadgeText}>{wishlistCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.langRow}>
          <Text style={styles.langLabel}>{t.language}</Text>
          <LanguageSwitcher />
        </View>

        <ThemeSelector />

        <TouchableOpacity
          style={styles.adminPanelBtn}
          onPress={() => router.push('/admin')}
          activeOpacity={0.8}
        >
          <ShieldCheck size={18} color={C.neonBlue} strokeWidth={2} />
          <Text style={styles.adminPanelBtnText}>Admin Panel</Text>
        </TouchableOpacity>

        <WhatsAppContactCard />

        <MyGearListings />

        <View style={styles.sectionHeader}>
          <Package size={18} color={C.neonBlue} strokeWidth={2} />
          <Text style={styles.sectionTitle}>{t.orderHistory}</Text>
        </View>

        {loadingOrders ? (
          <View style={styles.loadingOrders}>
            <Text style={styles.loadingText}>{t.loadingOrders}</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyOrders}>
            <Package size={40} color={C.textMuted} strokeWidth={1.5} />
            <Text style={styles.emptyOrdersText}>{t.noOrdersYet}</Text>
            <Text style={styles.emptyOrdersSubtext}>{t.purchasesWillAppear}</Text>
          </View>
        ) : (
          <View style={styles.ordersList}>
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onOrderChanged={(updated) =>
                  setOrders((prev) =>
                    prev.map((o) => (o.id === updated.id ? updated : o))
                  )
                }
              />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      <EditBirthdayModal
        visible={editBdVisible}
        current={user?.birthday ?? null}
        onClose={() => setEditBdVisible(false)}
        onSaved={() => {}}
      />
    </View>
  );
}

function getStatusColor(status: string, C: ThemeColors): string {
  switch (status) {
    case 'pending':    return C.warning;
    case 'confirmed':  return C.success;
    case 'processing': return C.neonBlue;
    case 'shipped':    return '#7C83FF';
    case 'delivered':  return C.success;
    case 'cancelled':  return C.error;
    default:           return C.textMuted;
  }
}

function OrderCard({
  order: initialOrder,
  onOrderChanged,
}: {
  order: Order;
  onOrderChanged: (updated: Order) => void;
}) {
  const { t } = useLanguage();
  const C = useThemeColors();
  const styles = makeStyles(C);
  const [order, setOrder] = useState<Order>(initialOrder);
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  const isPending = order.status === 'pending';
  const canEdit = isPending;
  const statusColor = getStatusColor(order.status, C);

  const date = new Date(order.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const loadItems = useCallback(async () => {
    if (items.length > 0) return;
    setLoadingItems(true);
    const { data } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });
    setItems(data ?? []);
    setLoadingItems(false);
  }, [order.id, items.length]);

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) loadItems();
  };

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 2500);
  };

  const recalcAndSave = async (updatedItems: OrderItem[]) => {
    setSaving(true);
    const subtotal = updatedItems.reduce(
      (sum, it) => sum + Number(it.unit_price) * Number(it.quantity),
      0
    );
    const shipping = subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const total = subtotal + shipping;

    const { error } = await supabase
      .from('orders')
      .update({ subtotal, shipping, total })
      .eq('id', order.id);

    if (!error) {
      const updated = { ...order, subtotal, shipping, total };
      setOrder(updated);
      onOrderChanged(updated);
    }
    setSaving(false);
    showFeedback(t.orderUpdated);
  };

  const handleRemoveItem = async (item: OrderItem) => {
    const { error } = await supabase
      .from('order_items')
      .delete()
      .eq('id', item.id);

    if (error) return;

    const updated = items.filter((i) => i.id !== item.id);
    setItems(updated);

    if (updated.length === 0) {
      // Cancel the order if all items removed
      await handleCancel();
    } else {
      await recalcAndSave(updated);
    }
  };

  const handleQtyChange = async (item: OrderItem, delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty < 1) return;

    const { error } = await supabase
      .from('order_items')
      .update({ quantity: newQty, total_price: Number(item.unit_price) * newQty })
      .eq('id', item.id);

    if (error) return;

    const updated = items.map((i) =>
      i.id === item.id ? { ...i, quantity: newQty } : i
    );
    setItems(updated);
    await recalcAndSave(updated);
  };

  const handleCancel = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', order.id);

    setSaving(false);
    if (!error) {
      const updated = { ...order, status: 'cancelled' };
      setOrder(updated);
      onOrderChanged(updated);
      showFeedback(t.orderCancelled);
    }
  };

  const confirmCancel = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(t.confirmCancelOrder)) handleCancel();
    } else {
      Alert.alert(t.cancelOrder, t.confirmCancelOrder, [
        { text: t.cancel, style: 'cancel' },
        { text: t.cancelOrder, style: 'destructive', onPress: handleCancel },
      ]);
    }
  };

  return (
    <View style={[styles.orderCard, order.status === 'cancelled' && styles.orderCardCancelled]}>
      {/* Header row — always visible */}
      <TouchableOpacity
        style={styles.orderCardHeader}
        onPress={handleExpand}
        activeOpacity={0.75}
      >
        <View style={styles.orderHeaderLeft}>
          <Text style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.orderDate}>{date}</Text>
        </View>
        <View style={styles.orderHeaderRight}>
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </Text>
          </View>
          <Text style={styles.orderTotal}>${Number(order.total).toFixed(2)}</Text>
          {expanded
            ? <ChevronUp size={16} color={C.textMuted} strokeWidth={2} />
            : <ChevronDown size={16} color={C.textMuted} strokeWidth={2} />
          }
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.orderExpanded}>
          <View style={styles.orderDivider} />

          {/* Locked notice for non-pending orders */}
          {!canEdit && order.status !== 'cancelled' && (
            <View style={styles.lockedNotice}>
              <AlertTriangle size={14} color={C.warning} strokeWidth={2} />
              <Text style={styles.lockedNoticeText}>{t.cannotEditOrder}</Text>
            </View>
          )}

          {/* Items */}
          {loadingItems ? (
            <ActivityIndicator color={C.neonBlue} size="small" style={{ marginVertical: 12 }} />
          ) : items.length === 0 ? (
            <Text style={styles.noItemsText}>{t.noItems}</Text>
          ) : (
            <View style={styles.itemsList}>
              {items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.product_name}</Text>
                    <Text style={styles.itemPrice}>${Number(item.unit_price).toFixed(2)} each</Text>
                  </View>

                  {canEdit ? (
                    <View style={styles.itemControls}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => handleQtyChange(item, -1)}
                        activeOpacity={0.7}
                        disabled={saving}
                      >
                        <Minus size={12} color={C.textPrimary} strokeWidth={2.5} />
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => handleQtyChange(item, 1)}
                        activeOpacity={0.7}
                        disabled={saving}
                      >
                        <Plus size={12} color={C.textPrimary} strokeWidth={2.5} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => handleRemoveItem(item)}
                        activeOpacity={0.7}
                        disabled={saving}
                      >
                        <Trash2 size={14} color={C.error} strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.itemQtyStatic}>×{item.quantity}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Totals */}
          <View style={styles.orderTotalsRow}>
            <Text style={styles.orderTotalsLabel}>
              {t.subtotal}: <Text style={styles.orderTotalsValue}>${Number(order.subtotal).toFixed(2)}</Text>
            </Text>
            <Text style={styles.orderTotalsLabel}>
              {t.shipping}: <Text style={styles.orderTotalsValue}>
                {Number(order.shipping) === 0 ? t.free : `$${Number(order.shipping).toFixed(2)}`}
              </Text>
            </Text>
          </View>

          {/* Feedback banner */}
          {feedback !== '' && (
            <View style={styles.feedbackBanner}>
              <Text style={styles.feedbackText}>{feedback}</Text>
            </View>
          )}

          {/* Cancel button — only for pending */}
          {canEdit && (
            <TouchableOpacity
              style={[styles.cancelOrderBtn, saving && styles.btnDisabled]}
              onPress={confirmCancel}
              activeOpacity={0.75}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={C.error} />
              ) : (
                <Text style={styles.cancelOrderBtnText}>
                  {t.cancelOrder}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function getGearStatusColors(C: ThemeColors): Record<string, string> {
  return {
    pending:  C.warning,
    approved: C.success,
    rejected: C.error,
    sold:     C.textMuted,
  };
}

const GEAR_STATUS_LABELS: Record<string, string> = {
  pending:  'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  sold:     'Sold',
};

const REMINDER_DAYS = 30;

type BoostRecord = {
  id: string;
  listing_id: string;
  status: string;
  expires_at: string | null;
  is_reboost: boolean;
};

function MyGearListings() {
  const { user } = useAuth();
  const router = useRouter();
  const C = useThemeColors();
  const styles = makeStyles(C);
  const [listings, setListings] = useState<UsedGearListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingSold, setMarkingSold] = useState<string | null>(null);
  const [reminderItem, setReminderItem] = useState<UsedGearListing | null>(null);

  // Boost state
  const [boostTarget, setBoostTarget] = useState<UsedGearListing | null>(null);
  const [isReboost, setIsReboost] = useState(false);
  const [boostPrice, setBoostPrice] = useState('9.99');
  const [boostDuration, setBoostDuration] = useState('7');
  const [reboostDiscountPct, setReboostDiscountPct] = useState(50);
  const [boostPaymentNote, setBoostPaymentNote] = useState('');
  const [boostSubmitting, setBoostSubmitting] = useState(false);
  const [boostSuccess, setBoostSuccess] = useState(false);
  const [boostRecords, setBoostRecords] = useState<BoostRecord[]>([]);

  const fetchMyListings = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    const [listingsRes, boostsRes, settingsRes] = await Promise.all([
      supabase
        .from('used_gear_listings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('listing_boosts')
        .select('id, listing_id, status, expires_at, is_reboost')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('site_settings')
        .select('key, value')
        .in('key', ['boost_price_usd', 'boost_duration_days', 'reboost_discount_pct']),
    ]);

    const rows = (listingsRes.data ?? []) as UsedGearListing[];
    setListings(rows);
    setBoostRecords((boostsRes.data ?? []) as BoostRecord[]);

    if (settingsRes.data) {
      settingsRes.data.forEach((row: { key: string; value: string }) => {
        if (row.key === 'boost_price_usd') setBoostPrice(row.value);
        if (row.key === 'boost_duration_days') setBoostDuration(row.value);
        if (row.key === 'reboost_discount_pct') setReboostDiscountPct(parseInt(row.value, 10));
      });
    }

    setLoading(false);

    // Check 30-day reminder: first approved listing due for a reminder
    const now = Date.now();
    const due = rows.find((l) => {
      if (l.status !== 'approved') return false;
      const lastReminder = (l as any).last_reminder_sent_at
        ? new Date((l as any).last_reminder_sent_at).getTime()
        : new Date(l.created_at).getTime();
      return now - lastReminder >= REMINDER_DAYS * 24 * 60 * 60 * 1000;
    });
    if (due) setReminderItem(due);
  }, [user?.id]);

  const getBoostRecord = (listingId: string): BoostRecord | null =>
    boostRecords.find((b) => b.listing_id === listingId) ?? null;

  const getBoostStatus = (listingId: string): string | null => {
    const boost = getBoostRecord(listingId);
    if (!boost) return null;
    if (boost.status === 'active' && boost.expires_at && new Date(boost.expires_at) > new Date()) return 'boosted';
    if (boost.status === 'active') return 'expired';
    return boost.status;
  };

  const canReboost = (listingId: string): boolean => {
    return boostRecords.some((b) => b.listing_id === listingId);
  };

  const reboostPrice = (basePrice: string): string => {
    const price = parseFloat(basePrice);
    const discounted = price * (1 - reboostDiscountPct / 100);
    return discounted.toFixed(2);
  };

  const openBoostModal = (item: UsedGearListing, reboost = false) => {
    setBoostTarget(item);
    setIsReboost(reboost);
    setBoostPaymentNote('');
    setBoostSuccess(false);
  };

  const submitBoost = async () => {
    if (!boostTarget || !user?.id) return;
    setBoostSubmitting(true);
    const price = isReboost ? parseFloat(reboostPrice(boostPrice)) : parseFloat(boostPrice);
    await supabase.from('listing_boosts').insert({
      listing_id: boostTarget.id,
      user_id: user.id,
      status: 'pending_approval',
      price_paid: price,
      duration_days: parseInt(boostDuration, 10),
      is_reboost: isReboost,
    });
    setBoostSubmitting(false);
    setBoostSuccess(true);
    const { data } = await supabase
      .from('listing_boosts')
      .select('id, listing_id, status, expires_at, is_reboost')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setBoostRecords((data ?? []) as BoostRecord[]);
  };

  useEffect(() => { fetchMyListings(); }, [fetchMyListings]);

  const handleMarkSold = (item: UsedGearListing) => {
    const doSell = async () => {
      setMarkingSold(item.id);
      await supabase
        .from('used_gear_listings')
        .update({ status: 'sold' })
        .eq('id', item.id)
        .eq('user_id', user!.id);
      setListings((prev) => prev.map((l) => l.id === item.id ? { ...l, status: 'sold' } : l));
      setMarkingSold(null);
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Mark this listing as sold? It will stay visible on the marketplace with a "Sold" badge.')) doSell();
    } else {
      Alert.alert('Mark as Sold', 'Mark as sold? It will stay visible with a Sold badge.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark Sold', onPress: doSell },
      ]);
    }
  };

  const dismissReminder = async (item: UsedGearListing) => {
    setReminderItem(null);
    await supabase
      .from('used_gear_listings')
      .update({ last_reminder_sent_at: new Date().toISOString() } as any)
      .eq('id', item.id)
      .eq('user_id', user!.id);
  };

  return (
    <View style={styles.gearSection}>
      {/* 30-day reminder banner */}
      {reminderItem && (
        <View style={styles.reminderBanner}>
          <AlertTriangle size={14} color={C.warning} strokeWidth={2} />
          <Text style={styles.reminderText}>
            Is "{reminderItem.title}" still available, or has it sold?
          </Text>
          <View style={styles.reminderActions}>
            <TouchableOpacity
              style={styles.reminderSoldBtn}
              onPress={() => { handleMarkSold(reminderItem); dismissReminder(reminderItem); }}
              activeOpacity={0.8}
            >
              <Text style={styles.reminderSoldBtnText}>Mark Sold</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reminderStillAvailableBtn}
              onPress={() => dismissReminder(reminderItem)}
              activeOpacity={0.8}
            >
              <Text style={styles.reminderStillAvailableBtnText}>Still Available</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.gearSectionHeader}>
        <View style={styles.sectionHeader}>
          <Tag size={18} color={C.neonBlue} strokeWidth={2} />
          <Text style={styles.sectionTitle}>My Gear Listings</Text>
        </View>
        <TouchableOpacity
          style={styles.newListingBtn}
          onPress={() => router.push('/marketplace/create' as any)}
          activeOpacity={0.8}
        >
          <Plus size={14} color={C.neonBlue} strokeWidth={2.5} />
          <Text style={styles.newListingBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={C.neonBlue} size="small" style={{ paddingVertical: Spacing.md }} />
      ) : listings.length === 0 ? (
        <View style={styles.gearEmpty}>
          <Tag size={32} color={C.textMuted} strokeWidth={1.5} />
          <Text style={styles.gearEmptyText}>No gear listings yet</Text>
          <TouchableOpacity
            style={styles.gearEmptyBtn}
            onPress={() => router.push('/marketplace/create' as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.gearEmptyBtnText}>Sell Your Gear</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.gearList}>
          {listings.map((item) => {
            const statusColor = getGearStatusColors(C)[item.status] ?? C.textMuted;
            const statusLabel = GEAR_STATUS_LABELS[item.status] ?? item.status;
            const thumb = item.main_image_url || item.images?.[0];
            const isSold = item.status === 'sold';
            const isRejected = item.status === 'rejected';
            const isApproved = item.status === 'approved';
            const canEdit = !isSold;

            return (
              <View key={item.id} style={[styles.gearCard, isSold && styles.gearCardSold]}>
                <View style={styles.gearCardInner}>
                  {/* Thumbnail */}
                  <View style={styles.gearThumbWrap}>
                    {thumb ? (
                      <Image source={{ uri: thumb }} style={[styles.gearThumb, isSold && { opacity: 0.5 }]} resizeMode="cover" />
                    ) : (
                      <View style={[styles.gearThumb, styles.gearThumbPlaceholder]}>
                        <Tag size={18} color={C.textMuted} strokeWidth={1.5} />
                      </View>
                    )}
                    {isSold && (
                      <View style={styles.gearSoldOverlay}>
                        <Text style={styles.gearSoldOverlayText}>SOLD</Text>
                      </View>
                    )}
                  </View>

                  {/* Info */}
                  <View style={styles.gearInfo}>
                    <Text style={[styles.gearTitle, isSold && styles.gearTitleSold]} numberOfLines={2}>{item.title}</Text>
                    <Text style={[styles.gearPrice, isSold && styles.gearPriceSold]}>${Number(item.price).toLocaleString()}</Text>
                    <Text style={styles.gearDate}>
                      {new Date(item.created_at).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </Text>
                  </View>

                  {/* Status + actions */}
                  <View style={styles.gearRight}>
                    <View style={[styles.gearStatusBadge, { borderColor: statusColor + '80', backgroundColor: statusColor + '18' }]}>
                      <Text style={[styles.gearStatusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                    {(() => {
                      const boostStatus = getBoostStatus(item.id);
                      const canBoost = (item.status === 'approved' || item.status === 'pending') && !isSold;
                      return (
                        <>
                          {canBoost && boostStatus && (
                            <View style={[
                              styles.boostStatusBadge,
                              boostStatus === 'boosted'
                                ? styles.boostStatusActive
                                : (boostStatus === 'pending_approval' || boostStatus === 'pending_payment')
                                ? styles.boostStatusPending
                                : styles.boostStatusExpired,
                            ]}>
                              <Zap size={9} color={boostStatus === 'boosted' ? C.gold : C.textMuted} strokeWidth={2.5} />
                              <Text style={[
                                styles.boostStatusText,
                                { color: boostStatus === 'boosted' ? C.gold : C.textMuted },
                              ]}>
                                {boostStatus === 'boosted' ? 'Boosted'
                                  : boostStatus === 'pending_approval' ? 'Boost Pending'
                                  : boostStatus === 'pending_payment' ? 'Boost Pending'
                                  : boostStatus === 'rejected' ? 'Boost Rejected'
                                  : 'Boost Expired'}
                              </Text>
                            </View>
                          )}
                          {canEdit && (
                            <View style={styles.gearActions}>
                              <TouchableOpacity
                                style={styles.gearEditBtn}
                                onPress={() => router.push(`/marketplace/edit/${item.id}` as any)}
                                activeOpacity={0.8}
                              >
                                <Pencil size={13} color={C.neonBlue} strokeWidth={2.5} />
                              </TouchableOpacity>
                              {canBoost && !canReboost(item.id) && (
                                <TouchableOpacity
                                  style={styles.gearBoostBtn}
                                  onPress={() => openBoostModal(item, false)}
                                  activeOpacity={0.8}
                                >
                                  <Zap size={11} color={C.gold} strokeWidth={2.5} />
                                  <Text style={styles.gearBoostBtnText}>Boost (${boostPrice})</Text>
                                </TouchableOpacity>
                              )}
                              {canBoost && canReboost(item.id) && (
                                <TouchableOpacity
                                  style={styles.gearReboostBtn}
                                  onPress={() => openBoostModal(item, true)}
                                  activeOpacity={0.8}
                                >
                                  <Zap size={11} color={C.gold} strokeWidth={2.5} />
                                  <Text style={styles.gearReboostBtnText}>Re-Boost (${reboostPrice(boostPrice)})</Text>
                                </TouchableOpacity>
                              )}
                              {isApproved && (
                                <TouchableOpacity
                                  style={styles.gearSoldBtn}
                                  onPress={() => handleMarkSold(item)}
                                  activeOpacity={0.8}
                                  disabled={markingSold === item.id}
                                >
                                  {markingSold === item.id ? (
                                    <ActivityIndicator size="small" color={C.textMuted} />
                                  ) : (
                                    <Text style={styles.gearSoldBtnText}>Sold</Text>
                                  )}
                                </TouchableOpacity>
                              )}
                            </View>
                          )}
                        </>
                      );
                    })()}
                  </View>
                </View>

                {/* Rejection note */}
                {isRejected && !!item.admin_note && (
                  <View style={styles.rejectionNote}>
                    <AlertTriangle size={12} color={C.error} strokeWidth={2} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.rejectionNoteText}>{item.admin_note}</Text>
                      <TouchableOpacity
                        onPress={() => router.push(`/marketplace/edit/${item.id}` as any)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.rejectionEditLink}>Edit and resubmit →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Boost Modal */}
      <Modal
        visible={!!boostTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setBoostTarget(null)}
      >
        <View style={styles.boostOverlay}>
          <View style={styles.boostModal}>
            <View style={styles.boostModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Zap size={18} color={C.gold} strokeWidth={2.5} />
                <Text style={styles.boostModalTitle}>{isReboost ? 'Re-boost Listing' : 'Boost Listing'}</Text>
              </View>
              <TouchableOpacity onPress={() => setBoostTarget(null)} activeOpacity={0.8}>
                <X size={20} color={C.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {boostSuccess ? (
              <View style={styles.boostSuccessWrap}>
                <Zap size={36} color={C.gold} strokeWidth={2} />
                <Text style={styles.boostSuccessTitle}>{isReboost ? 'Re-boost Requested!' : 'Boost Requested!'}</Text>
                <Text style={styles.boostSuccessText}>
                  {isReboost
                    ? 'Your re-boost request has been submitted. Once approved your listing will jump back to the top of the marketplace.'
                    : 'Your boost request has been submitted. Once payment is confirmed by our team, your listing will appear at the top of the marketplace with a Featured badge.'}
                </Text>
                <TouchableOpacity
                  style={styles.boostSuccessBtn}
                  onPress={() => setBoostTarget(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.boostSuccessBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {isReboost && (
                  <View style={styles.reboostBanner}>
                    <Zap size={13} color={C.gold} strokeWidth={2.5} />
                    <Text style={styles.reboostBannerText}>
                      Returning customer discount: {reboostDiscountPct}% off — only ${reboostPrice(boostPrice)} (was ${boostPrice})
                    </Text>
                  </View>
                )}

                <Text style={styles.boostListingName} numberOfLines={2}>{boostTarget?.title}</Text>

                <View style={styles.boostPricingCard}>
                  <View style={styles.boostPricingRow}>
                    <Text style={styles.boostPricingLabel}>{isReboost ? 'Re-boost Price' : 'Boost Price'}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {isReboost && (
                        <Text style={styles.boostOriginalPrice}>${boostPrice}</Text>
                      )}
                      <Text style={styles.boostPricingValue}>
                        ${isReboost ? reboostPrice(boostPrice) : boostPrice}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.boostPricingRow}>
                    <Text style={styles.boostPricingLabel}>Duration</Text>
                    <Text style={styles.boostPricingValue}>{boostDuration} days</Text>
                  </View>
                </View>

                <View style={styles.boostBenefits}>
                  <Text style={styles.boostBenefitsTitle}>{isReboost ? 'What happens:' : 'What you get:'}</Text>
                  {isReboost ? (
                    <>
                      <Text style={styles.boostBenefitItem}>· Your listing jumps back to the top of the marketplace</Text>
                      <Text style={styles.boostBenefitItem}>· Featured ribbon resets for {boostDuration} more days</Text>
                      <Text style={styles.boostBenefitItem}>· {reboostDiscountPct}% loyalty discount applied</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.boostBenefitItem}>· Your listing appears at the top of search results</Text>
                      <Text style={styles.boostBenefitItem}>· Gold "FEATURED" ribbon on your listing card</Text>
                      <Text style={styles.boostBenefitItem}>· More visibility for {boostDuration} days</Text>
                    </>
                  )}
                </View>

                <View style={styles.boostPaymentSection}>
                  <Text style={styles.boostPaymentLabel}>Payment Note (optional)</Text>
                  <TextInput
                    style={styles.boostPaymentInput}
                    value={boostPaymentNote}
                    onChangeText={setBoostPaymentNote}
                    placeholder="e.g. Paid via bank transfer on April 30"
                    placeholderTextColor={C.textMuted}
                    multiline
                    numberOfLines={2}
                  />
                  <Text style={styles.boostPaymentDisclaimer}>
                    Payment processing coming soon. Submit your request and our team will contact you to arrange payment.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.boostConfirmBtn, boostSubmitting && { opacity: 0.5 }]}
                  onPress={submitBoost}
                  activeOpacity={0.8}
                  disabled={boostSubmitting}
                >
                  {boostSubmitting ? (
                    <ActivityIndicator size="small" color={C.background} />
                  ) : (
                    <>
                      <Zap size={16} color={C.background} strokeWidth={2.5} />
                      <Text style={styles.boostConfirmBtnText}>
                        {isReboost
                          ? `Request Re-boost — $${reboostPrice(boostPrice)}`
                          : `Request Boost — $${boostPrice}`}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  const C = useThemeColors();
  const styles = makeStyles(C);
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function AuthField({
  label,
  value,
  onChange,
  icon,
  keyboardType,
  placeholder,
  secureTextEntry,
  right,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon?: React.ReactNode;
  keyboardType?: any;
  placeholder?: string;
  secureTextEntry?: boolean;
  right?: React.ReactNode;
}) {
  const C = useThemeColors();
  const styles = makeStyles(C);
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={C.textMuted}
          secureTextEntry={secureTextEntry}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {right}
      </View>
    </View>
  );
}

function ErrorBanner({ message }: { message: string }) {
  const C = useThemeColors();
  const styles = makeStyles(C);
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  authContent: {
    padding: Spacing.md,
    gap: 8,
    alignItems: 'center',
  },
  authInner: {
    width: '100%',
    maxWidth: 300,
    gap: 8,
  },
  authHeader: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  authTitle: {
    color: C.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  authSubtitle: {
    color: C.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: C.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
    padding: 2,
    gap: 2,
    height: 36,
  },
  authTab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    overflow: 'hidden',
  },
  authTabText: {
    color: C.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  authTabTextActive: {
    color: C.white,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  form: {
    gap: 6,
    width: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    gap: 6,
  },
  fieldWrapper: {
    gap: 3,
  },
  fieldLabel: {
    color: C.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.backgroundInput,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 10,
    height: 42,
  },
  fieldInput: {
    flex: 1,
    color: C.textPrimary,
    fontSize: 13,
    padding: 0,
  },
  errorBanner: {
    backgroundColor: C.errorDim,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: C.error,
  },
  errorText: {
    color: C.error,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  profileContent: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.backgroundCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: C.border,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadow.card,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.neonBlueDim,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: C.neonBlue,
  },
  avatarText: {
    color: C.white,
    fontSize: FontSize.xl,
    fontWeight: '900',
  },
  profileInfo: {
    flex: 1,
    gap: 3,
  },
  profileName: {
    color: C.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  profileEmail: {
    color: C.textMuted,
    fontSize: FontSize.sm,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    backgroundColor: C.errorDim,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.error,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: C.neonBlue,
    fontSize: FontSize.xl,
    fontWeight: '900',
  },
  statLabel: {
    color: C.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  langLabel: {
    color: C.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  themeSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  themeOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.backgroundInput,
  },
  themeOptionActive: {
    backgroundColor: C.neonBlue,
    borderColor: C.neonBlue,
  },
  themeOptionText: {
    color: C.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  themeOptionTextActive: {
    color: C.white,
  },
  wishlistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,77,109,0.08)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,77,109,0.25)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  wishlistBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  wishlistBtnText: {
    color: '#FF4D6D',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  wishlistBtnBadge: {
    backgroundColor: '#FF4D6D',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  wishlistBtnBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  adminPanelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: C.neonBlueGlow,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.neonBlueBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  adminPanelBtnText: {
    color: C.neonBlue,
    fontSize: FontSize.md,
    fontWeight: '700',
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    color: C.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  loadingOrders: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  loadingText: {
    color: C.textMuted,
    fontSize: FontSize.md,
  },
  emptyOrders: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyOrdersText: {
    color: C.textSecondary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  emptyOrdersSubtext: {
    color: C.textMuted,
    fontSize: FontSize.md,
  },
  ordersList: {
    gap: Spacing.sm,
  },
  orderCard: {
    backgroundColor: C.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    ...Shadow.card,
  },
  orderCardCancelled: {
    opacity: 0.65,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  orderHeaderLeft: {
    gap: 3,
    flex: 1,
    marginRight: Spacing.sm,
  },
  orderHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  orderId: {
    color: C.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statusBadge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  orderDate: {
    color: C.textMuted,
    fontSize: FontSize.xs,
  },
  orderTotal: {
    color: C.neonBlue,
    fontSize: FontSize.md,
    fontWeight: '900',
  },
  orderExpanded: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  orderDivider: {
    height: 1,
    backgroundColor: C.borderLight,
    marginBottom: Spacing.sm,
  },
  lockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,179,0,0.08)',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,179,0,0.25)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    marginBottom: Spacing.sm,
  },
  lockedNoticeText: {
    color: C.warning,
    fontSize: FontSize.xs,
    fontWeight: '600',
    flex: 1,
  },
  noItemsText: {
    color: C.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  itemsList: {
    gap: Spacing.xs ?? 4,
    marginBottom: Spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.background,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.borderLight,
    gap: Spacing.sm,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    color: C.textPrimary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    lineHeight: 16,
  },
  itemPrice: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '500',
  },
  itemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.backgroundCard,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyValue: {
    color: C.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'center',
  },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.errorDim,
    borderWidth: 1,
    borderColor: C.error,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  itemQtyStatic: {
    color: C.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'right',
  },
  orderTotalsRow: {
    gap: 3,
    marginBottom: Spacing.sm,
  },
  orderTotalsLabel: {
    color: C.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  orderTotalsValue: {
    color: C.textPrimary,
    fontWeight: '700',
  },
  feedbackBanner: {
    backgroundColor: C.success + '18',
    borderRadius: Radius.sm,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  feedbackText: {
    color: C.success,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  cancelOrderBtn: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: C.error,
    backgroundColor: C.errorDim,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  cancelOrderBtnText: {
    color: C.error,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 2,
  },
  forgotBtnText: {
    color: C.neonBlue,
    fontSize: 11,
    fontWeight: '600',
  },
  adminLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  adminLinkBtnText: {
    color: C.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  // ── WhatsApp contact card ─────────────────────────────────────────────────
  whatsappCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(37, 211, 102, 0.08)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.28)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  whatsappIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(37, 211, 102, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.3)',
    flexShrink: 0,
  },
  whatsappCardText: {
    flex: 1,
    gap: 2,
  },
  whatsappCardTitle: {
    color: '#25D366',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  whatsappCardSub: {
    color: C.textMuted,
    fontSize: FontSize.xs,
  },
  whatsappArrow: {
    paddingLeft: 4,
  },
  whatsappArrowText: {
    color: '#25D366',
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 24,
  },
  // ── My Gear Listings ──────────────────────────────────────────────────────
  gearSection: {
    gap: Spacing.sm,
  },
  gearSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newListingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: C.neonBlueBorder,
    backgroundColor: C.neonBlueGlow,
  },
  newListingBtnText: {
    color: C.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  gearEmpty: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
    backgroundColor: C.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  gearEmptyText: {
    color: C.textMuted,
    fontSize: FontSize.md,
  },
  gearEmptyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: C.neonBlueBorder,
    backgroundColor: C.neonBlueGlow,
    marginTop: 4,
  },
  gearEmptyBtnText: {
    color: C.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  gearList: {
    gap: Spacing.sm,
  },
  gearCard: {
    backgroundColor: C.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  gearCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  gearThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    overflow: 'hidden',
    flexShrink: 0,
  },
  gearThumb: {
    width: 64,
    height: 64,
  },
  gearThumbPlaceholder: {
    backgroundColor: C.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gearInfo: {
    flex: 1,
    gap: 3,
  },
  gearTitle: {
    color: C.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    lineHeight: 18,
  },
  gearPrice: {
    color: C.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  gearDate: {
    color: C.textMuted,
    fontSize: FontSize.xs,
  },
  gearRight: {
    alignItems: 'flex-end',
    gap: Spacing.sm,
    flexShrink: 0,
  },
  gearStatusBadge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  gearStatusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  gearActions: {
    flexDirection: 'row',
    gap: 6,
  },
  gearEditBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.neonBlueBorder,
    backgroundColor: C.neonBlueGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gearDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.error,
    backgroundColor: C.errorDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectionNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255,68,68,0.06)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,68,68,0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
  },
  rejectionNoteText: {
    color: C.error,
    fontSize: FontSize.xs,
    fontWeight: '600',
    lineHeight: 16,
  },
  rejectionEditLink: {
    color: C.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  // Sold state
  gearCardSold: {
    opacity: 0.7,
    borderColor: C.borderLight,
  },
  gearSoldOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,10,20,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.md,
  },
  gearSoldOverlayText: {
    color: C.white,
    fontSize: FontSize.xs,
    fontWeight: '900',
    letterSpacing: 2,
  },
  gearTitleSold: {
    color: C.textMuted,
    textDecorationLine: 'line-through' as const,
  },
  gearPriceSold: {
    color: C.textMuted,
    textDecorationLine: 'line-through' as const,
  },
  gearSoldBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: C.borderLight,
    backgroundColor: C.backgroundSecondary,
  },
  gearSoldBtnText: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  // Re-boost button
  gearReboostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
    backgroundColor: 'rgba(255,215,0,0.1)',
  },
  gearReboostBtnText: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '800',
  },
  // Boost button
  gearBoostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
    backgroundColor: 'rgba(255,215,0,0.1)',
  },
  gearBoostBtnText: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '800',
  },
  // Boost status badge (on card)
  boostStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
  },
  boostStatusActive: {
    borderColor: 'rgba(255,215,0,0.4)',
    backgroundColor: 'rgba(255,215,0,0.1)',
  },
  boostStatusPending: {
    borderColor: 'rgba(255,179,0,0.3)',
    backgroundColor: 'rgba(255,179,0,0.08)',
  },
  boostStatusExpired: {
    borderColor: 'rgba(74,122,153,0.3)',
    backgroundColor: 'transparent',
  },
  boostStatusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  // Boost modal
  boostOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5,10,20,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  boostModal: {
    backgroundColor: C.backgroundCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 420,
    gap: Spacing.md,
  },
  boostModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  boostModalTitle: {
    color: C.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  reboostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  reboostBannerText: {
    color: C.gold,
    fontSize: FontSize.xs,
    fontWeight: '700',
    flex: 1,
  },
  boostOriginalPrice: {
    color: C.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textDecorationLine: 'line-through' as const,
  },
  boostListingName: {
    color: C.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
  },
  boostPricingCard: {
    backgroundColor: C.backgroundSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  boostPricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  boostPricingLabel: {
    color: C.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  boostPricingValue: {
    color: C.gold,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  boostBenefits: {
    gap: 4,
  },
  boostBenefitsTitle: {
    color: C.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  boostBenefitItem: {
    color: C.textMuted,
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  boostPaymentSection: {
    gap: Spacing.sm,
  },
  boostPaymentLabel: {
    color: C.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  boostPaymentInput: {
    backgroundColor: C.backgroundInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: C.border,
    color: C.textPrimary,
    fontSize: FontSize.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  boostPaymentDisclaimer: {
    color: C.textMuted,
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  boostConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.gold,
    borderRadius: Radius.md,
    paddingVertical: 14,
  },
  boostConfirmBtnText: {
    color: C.background,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  boostSuccessWrap: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  boostSuccessTitle: {
    color: C.gold,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  boostSuccessText: {
    color: C.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  boostSuccessBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: 11,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
    backgroundColor: 'rgba(255,215,0,0.1)',
    marginTop: 4,
  },
  boostSuccessBtnText: {
    color: C.gold,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  // Birthday
  birthdayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  birthdayPart: {
    flex: 1,
  },
  birthdayInput: {
    backgroundColor: C.backgroundInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    color: C.textPrimary,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  birthdaySep: {
    color: C.textMuted,
    fontSize: FontSize.lg,
    fontWeight: '300',
    paddingHorizontal: 2,
  },
  // Reminder banner
  reminderBanner: {
    backgroundColor: 'rgba(255,179,0,0.08)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,179,0,0.3)',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  reminderText: {
    color: C.warning,
    fontSize: FontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
  },
  reminderActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  reminderSoldBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: C.error,
    backgroundColor: C.errorDim,
    alignItems: 'center',
  },
  reminderSoldBtnText: {
    color: C.error,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  reminderStillAvailableBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: C.neonBlueBorder,
    backgroundColor: C.neonBlueGlow,
    alignItems: 'center',
  },
  reminderStillAvailableBtnText: {
    color: C.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  });
}

function makeBdStyles(C: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: C.backgroundCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
    },
    rowLabel: {
      color: C.textMuted,
      fontSize: FontSize.xs,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    rowValue: {
      color: C.textPrimary,
      fontSize: FontSize.md,
      fontWeight: '600',
      marginTop: 2,
    },
    rowEmpty: {
      color: C.textMuted,
      fontSize: FontSize.sm,
      fontStyle: 'italic',
      marginTop: 2,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(5,10,20,0.88)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.lg,
    },
    modal: {
      backgroundColor: C.backgroundCard,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: C.neonBlueBorder,
      padding: Spacing.lg,
      width: '100%',
      maxWidth: 380,
      gap: Spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      color: C.textPrimary,
      fontSize: FontSize.lg,
      fontWeight: '800',
    },
  });
}
