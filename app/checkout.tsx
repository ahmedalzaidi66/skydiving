import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  CreditCard,
  CircleCheck as CheckCircle,
  MapPin,
  User,
  Phone,
  Mail,
  Lock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { calculateShippingAndTax, type ShippingTaxResult } from '@/lib/shippingTax';
import { captureError } from '@/lib/sentry';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useThemeColors, type ThemeColors } from '@/context/ThemeContext';
import GlossyButton from '@/components/GlossyButton';
import CountryPicker, { getCountryByCode } from '@/components/CountryPicker';
import { Spacing, FontSize, Radius } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentMethod = 'card' | 'paypal' | 'apple' | 'google';

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  countryName: string;
  paymentMethod: PaymentMethod;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  cardName: string;
  billingStreet: string;
  billingCity: string;
  billingZip: string;
  billingCountry: string;
  billingCountryName: string;
  billingSameAsShipping: boolean;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

const PAYMENT_METHOD_IDS: PaymentMethod[] = ['card', 'paypal', 'apple', 'google'];

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits;
}

function getCardBrand(number: string): 'visa' | 'mastercard' | 'amex' | 'discover' | null {
  const d = number.replace(/\s/g, '');
  if (/^4/.test(d)) return 'visa';
  if (/^5[1-5]|^2[2-7]/.test(d)) return 'mastercard';
  if (/^3[47]/.test(d)) return 'amex';
  if (/^6(?:011|5)/.test(d)) return 'discover';
  return null;
}

// ─── Styles factory ───────────────────────────────────────────────────────────

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingTop: Platform.OS === 'ios' ? 56 : Spacing.lg,
      paddingBottom: Spacing.md,
      backgroundColor: C.background,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    headerSpacer: {
      width: 48,
    },
    headerTitle: {
      color: C.textPrimary,
      fontSize: FontSize.lg,
      fontWeight: '700',
    },
    secureBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: C.successDim,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: C.success + '40',
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    secureBadgeText: {
      color: C.success,
      fontSize: FontSize.xs,
      fontWeight: '700',
    },
    content: {
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    row: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    sectionLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
    },
    sectionLabelText: {
      color: C.textPrimary,
      fontSize: FontSize.lg,
      fontWeight: '700',
    },
    fieldWrapper: {
      gap: 4,
    },
    fieldLabel: {
      color: C.textMuted,
      fontSize: FontSize.xs,
      fontWeight: '600',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.backgroundInput,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
    },
    fieldRowError: {
      borderColor: C.error,
      backgroundColor: C.errorDim,
    },
    fieldInput: {
      flex: 1,
      color: C.textPrimary,
      fontSize: FontSize.md,
      padding: 0,
    },
    fieldError: {
      color: C.error,
      fontSize: FontSize.xs,
      fontWeight: '500',
    },
    secureNotice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: C.successDim,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: C.success + '30',
      padding: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    secureNoticeText: {
      flex: 1,
      color: C.success,
      fontSize: FontSize.xs,
      fontWeight: '600',
      lineHeight: 16,
    },
    paymentTabs: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    paymentTab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      backgroundColor: C.backgroundCard,
      borderRadius: Radius.md,
      borderWidth: 1.5,
      borderColor: C.border,
      paddingVertical: 13,
      paddingHorizontal: 4,
      position: 'relative',
    },
    paymentTabActive: {
      borderColor: C.neonBlue,
      borderWidth: 2,
      backgroundColor: C.neonBlueGlow,
      shadowColor: C.neonBlue,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 4,
    },
    paymentTabIcon: {
      height: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    paymentTabLabel: {
      color: C.textMuted,
      fontSize: 10,
      fontWeight: '600',
      textAlign: 'center',
      letterSpacing: 0.2,
    },
    paymentTabLabelActive: {
      color: C.neonBlue,
      fontWeight: '800',
    },
    paymentTabDot: {
      position: 'absolute',
      bottom: 5,
      width: 16,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: C.neonBlue,
      shadowColor: C.neonBlue,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 4,
      elevation: 2,
    },
    cardPanel: {
      backgroundColor: C.backgroundCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: C.border,
      padding: Spacing.md,
      gap: Spacing.md,
      marginBottom: Spacing.sm,
    },
    cardFieldGroup: {
      gap: 6,
    },
    cardFieldLabel: {
      color: C.textMuted,
      fontSize: FontSize.xs,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    cardFieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: C.backgroundInput,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
    },
    cardFieldRowError: {
      borderColor: C.error,
      backgroundColor: C.errorDim,
    },
    cardInput: {
      flex: 1,
      color: C.textPrimary,
      fontSize: FontSize.md,
      padding: 0,
      letterSpacing: 0.5,
    },
    cardFieldError: {
      color: C.error,
      fontSize: FontSize.xs,
      fontWeight: '600',
    },
    cardBrandBadge: {
      backgroundColor: C.neonBlueGlow,
      borderRadius: Radius.sm,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: C.neonBlueBorder,
    },
    cardBrandText: {
      color: C.neonBlue,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1,
    },
    cvvLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cvvHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    cvvHintText: {
      color: C.textMuted,
      fontSize: FontSize.xs,
      fontWeight: '500',
    },
    billingToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: C.borderLight,
    },
    billingToggleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    billingToggleText: {
      color: C.textSecondary,
      fontSize: FontSize.sm,
      fontWeight: '600',
    },
    billingOptionalBadge: {
      backgroundColor: C.backgroundSecondary,
      borderRadius: Radius.full,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    billingOptionalText: {
      color: C.textMuted,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    billingAddressSection: {
      gap: Spacing.sm,
    },
    sameAsShippingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: C.border,
      backgroundColor: C.backgroundInput,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: C.neonBlue,
      borderColor: C.neonBlue,
    },
    sameAsShippingText: {
      color: C.textSecondary,
      fontSize: FontSize.sm,
      fontWeight: '600',
    },
    acceptedCards: {
      flexDirection: 'row',
      gap: 6,
      paddingTop: Spacing.xs,
      borderTopWidth: 1,
      borderTopColor: C.borderLight,
    },
    acceptedCardChip: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: Radius.sm,
      backgroundColor: C.backgroundSecondary,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    acceptedCardText: {
      color: C.textMuted,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    walletPanel: {
      backgroundColor: C.backgroundCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: C.border,
      padding: Spacing.lg,
      gap: Spacing.md,
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    paypalLogo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    paypalLogoBlue: {
      color: '#009cde',
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -1,
    },
    paypalLogoNavy: {
      color: '#003087',
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -1,
    },
    walletIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
    },
    walletIconApple: {
      backgroundColor: C.borderLight,
      borderColor: C.border,
    },
    walletIconGoogle: {
      backgroundColor: C.neonBlueGlow,
      borderColor: C.neonBlueBorder,
    },
    walletIconText: {
      color: C.textPrimary,
      fontSize: 22,
      fontWeight: '800',
      lineHeight: 26,
    },
    walletTitle: {
      color: C.textPrimary,
      fontSize: FontSize.lg,
      fontWeight: '800',
      textAlign: 'center',
    },
    walletSubtitle: {
      color: C.textMuted,
      fontSize: FontSize.sm,
      textAlign: 'center',
      lineHeight: 20,
    },
    comingSoonBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.warning + '1A',
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: C.warning + '4D',
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
    },
    comingSoonText: {
      flex: 1,
      color: C.warning,
      fontSize: FontSize.sm,
      fontWeight: '700',
      lineHeight: 18,
    },
    orderSummary: {
      backgroundColor: C.backgroundCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: C.border,
      padding: Spacing.md,
      marginTop: Spacing.md,
      gap: Spacing.sm,
    },
    summaryTitle: {
      color: C.textPrimary,
      fontSize: FontSize.lg,
      fontWeight: '700',
      marginBottom: 4,
    },
    summaryItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    summaryItemName: {
      flex: 1,
      color: C.textSecondary,
      fontSize: FontSize.sm,
    },
    summaryItemPrice: {
      color: C.textPrimary,
      fontSize: FontSize.sm,
      fontWeight: '600',
    },
    summaryDivider: {
      height: 1,
      backgroundColor: C.borderLight,
      marginVertical: 4,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    summaryLabel: {
      color: C.textSecondary,
      fontSize: FontSize.md,
    },
    freeShippingNote: {
      color: C.success,
      fontSize: FontSize.xs,
      fontWeight: '600',
      marginTop: 2,
    },
    summaryValue: {
      color: C.textPrimary,
      fontSize: FontSize.md,
      fontWeight: '600',
    },
    totalRow: {
      marginTop: 4,
    },
    totalLabel: {
      color: C.textPrimary,
      fontSize: FontSize.xl,
      fontWeight: '800',
    },
    totalValue: {
      color: C.neonBlue,
      fontSize: FontSize.xl,
      fontWeight: '900',
    },
    globalError: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: C.errorDim,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: C.error + '4D',
      padding: Spacing.sm,
    },
    globalErrorText: {
      flex: 1,
      color: C.error,
      fontSize: FontSize.sm,
      fontWeight: '600',
      lineHeight: 18,
    },
    trustRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: Spacing.md,
      opacity: 0.6,
    },
    trustText: {
      color: C.textMuted,
      fontSize: FontSize.xs,
      fontWeight: '600',
    },
    trustDot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: C.textMuted,
    },
    successContainer: {
      flex: 1,
      backgroundColor: C.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
      gap: Spacing.lg,
    },
    successIconArea: {
      width: 120,
      height: 120,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
    successRing: {
      position: 'absolute',
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 1.5,
      borderColor: C.success + '4D',
      backgroundColor: C.successDim,
    },
    successRingOuter: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderColor: C.success + '26',
    },
    successIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: C.successDim,
      borderWidth: 1.5,
      borderColor: C.success + '66',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: C.success,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 8,
    },
    successTitle: {
      color: C.textPrimary,
      fontSize: FontSize.xxl + 4,
      fontWeight: '900',
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    successSubtitle: {
      color: C.textSecondary,
      fontSize: FontSize.md,
      textAlign: 'center',
      lineHeight: 24,
      marginTop: -Spacing.sm,
    },
    orderIdBox: {
      backgroundColor: C.backgroundCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: C.neonBlueBorder,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      gap: 4,
      width: '80%',
    },
    orderIdLabel: {
      color: C.textMuted,
      fontSize: FontSize.xs,
      fontWeight: '700',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    orderIdValue: {
      color: C.neonBlue,
      fontSize: FontSize.xxl,
      fontWeight: '900',
      letterSpacing: 2,
    },
    successNextSteps: {
      width: '100%',
      gap: Spacing.sm,
      backgroundColor: C.backgroundCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: C.border,
      padding: Spacing.md,
    },
    successStep: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    successStepIcon: {
      fontSize: 20,
      lineHeight: 24,
    },
    successStepText: {
      flex: 1,
      color: C.textSecondary,
      fontSize: FontSize.sm,
      fontWeight: '600',
      lineHeight: 20,
    },
  });
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CheckoutScreen() {
  const router = useRouter();
  const C = useThemeColors();
  const S = useMemo(() => makeStyles(C), [C]);
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const { t, language } = useLanguage();

  const [form, setForm] = useState<FormData>({
    firstName: (user as any)?.firstName ?? '',
    lastName: (user as any)?.lastName ?? '',
    email: user?.email ?? '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    countryName: '',
    paymentMethod: 'card',
    cardNumber: '',
    cardExpiry: '',
    cardCvv: '',
    cardName: '',
    billingStreet: '',
    billingCity: '',
    billingZip: '',
    billingCountry: '',
    billingCountryName: '',
    billingSameAsShipping: true,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [showBillingAddress, setShowBillingAddress] = useState(false);
  const [rates, setRates] = useState<ShippingTaxResult>({
    shipping: 0, tax: 0, taxLabel: '', taxPercentage: 0,
    freeShipping: false, shippingRuleName: null,
  });

  const refreshRates = useCallback(async (countryCode: string, countryName: string) => {
    if (!countryCode) return;
    setRatesLoading(true);
    const result = await calculateShippingAndTax(countryCode, countryName, subtotal);
    setRates(result);
    setRatesLoading(false);
  }, [subtotal]);

  useEffect(() => {
    refreshRates(form.country, form.countryName);
  }, [form.country, form.countryName, subtotal]);

  const shipping = rates.shipping;
  const tax = rates.tax;
  const total = subtotal + shipping + tax;

  const setField = useCallback((key: keyof FormData, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }, [errors]);

  const handleCardNumber = useCallback((raw: string) => {
    setField('cardNumber', formatCardNumber(raw));
  }, [setField]);

  const handleCardExpiry = useCallback((raw: string) => {
    setField('cardExpiry', formatExpiry(raw));
  }, [setField]);

  const handleCardCvv = useCallback((raw: string) => {
    setField('cardCvv', raw.replace(/\D/g, '').slice(0, 4));
  }, [setField]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const phoneRe = /^[+\d\s\-().]{7,20}$/;
    const zipRe   = /^[A-Za-z0-9\s\-]{3,10}$/;

    if (!form.firstName.trim() || form.firstName.trim().length > 60) newErrors.firstName = t.fieldRequired;
    if (!form.lastName.trim()  || form.lastName.trim().length  > 60) newErrors.lastName  = t.fieldRequired;
    if (!emailRe.test(form.email.trim()))                             newErrors.email     = t.validEmailRequired;
    if (!phoneRe.test(form.phone.trim()))                             newErrors.phone     = t.fieldRequired;
    if (!form.street.trim()  || form.street.trim().length  > 200)    newErrors.street    = t.fieldRequired;
    if (!form.city.trim()    || form.city.trim().length    > 100)     newErrors.city      = t.fieldRequired;
    if (!form.state.trim()   || form.state.trim().length   > 100)     newErrors.state     = t.fieldRequired;
    if (!zipRe.test(form.zip.trim()))                                 newErrors.zip       = t.fieldRequired;
    if (!form.country)                                                  newErrors.country   = t.fieldRequired;

    if (form.paymentMethod === 'card') {
      const cardDigits = form.cardNumber.replace(/\s/g, '');
      if (cardDigits.length < 13 || cardDigits.length > 16) newErrors.cardNumber = 'Enter a valid card number';
      const expiryParts = form.cardExpiry.split('/');
      if (expiryParts.length !== 2 || expiryParts[0].length !== 2 || expiryParts[1].length !== 2)
        newErrors.cardExpiry = 'MM/YY';
      if (form.cardCvv.length < 3) newErrors.cardCvv = 'Required';
      if (!form.cardName.trim()) newErrors.cardName = t.fieldRequired;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePlaceOrder = async () => {
    if (loading) return;
    if (!validate()) return;
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();

      const sessionUser = session?.user ?? null;
      const resolvedUserId: string | null = sessionUser?.id ?? null;
      const resolvedEmail: string = sessionUser?.email
        ? sessionUser.email
        : form.email.trim().toLowerCase();

      if (!sessionUser && (!resolvedEmail || !resolvedEmail.includes('@'))) {
        setErrors({ email: 'A valid email address is required for guest checkout.' });
        setLoading(false);
        return;
      }

      for (const i of items) {
        if (i.product.unlimited_stock) continue;

        if (i.selectedColor?.name) {
          const { data: cv } = await supabase
            .from('product_color_variants')
            .select('stock')
            .eq('product_id', i.product.id)
            .eq('name', i.selectedColor.name)
            .maybeSingle();
          const colorStock = (cv as any)?.stock;
          if (colorStock != null && colorStock < i.quantity) {
            setErrors({ email: `"${i.product.name}" (${i.selectedColor.name}) only has ${colorStock} left.` });
            setLoading(false);
            return;
          }
          if (colorStock == null) {
            const { data: p } = await supabase
              .from('products')
              .select('stock, unlimited_stock')
              .eq('id', i.product.id)
              .maybeSingle();
            if (p && !p.unlimited_stock && p.stock < i.quantity) {
              setErrors({ email: `"${i.product.name}" only has ${p.stock} left.` });
              setLoading(false);
              return;
            }
          }
        } else {
          const { data: p } = await supabase
            .from('products')
            .select('stock, unlimited_stock')
            .eq('id', i.product.id)
            .maybeSingle();
          if (p && !p.unlimited_stock && p.stock < i.quantity) {
            setErrors({ email: `"${i.product.name}" only has ${p.stock} left.` });
            setLoading(false);
            return;
          }
        }
      }

      const orderPayload = {
        user_id:             resolvedUserId,
        customer_email:      resolvedEmail.slice(0, 254),
        customer_first_name: form.firstName.trim().slice(0, 60),
        customer_last_name:  form.lastName.trim().slice(0, 60),
        customer_phone:      form.phone.trim().slice(0, 20),
        street:              form.street.trim().slice(0, 200),
        city:                form.city.trim().slice(0, 100),
        state:               form.state.trim().slice(0, 100),
        zip:                 form.zip.trim().slice(0, 10),
        country:             (form.countryName || form.country).slice(0, 100),
        payment_method:      PAYMENT_METHOD_IDS.includes(form.paymentMethod) ? form.paymentMethod : 'card',
        subtotal,
        shipping,
        tax,
        total,
        status: 'pending',
      };

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderPayload)
        .select()
        .maybeSingle();

      if (orderError || !order) {
        const msg = orderError?.message ?? 'Failed to place order. Please try again.';
        captureError(orderError ?? new Error('order insert returned no data'), {
          action: 'checkout/place_order',
          extra: { itemCount: items.length },
        });
        setErrors({ email: msg.includes('network') || msg.includes('fetch') ? 'No internet connection. Please check your network and try again.' : msg });
        return;
      }

      const orderItems = items.map((i) => ({
        order_id: order.id,
        product_id: i.product.id,
        product_name: i.product.name,
        product_image: i.selectedColor?.image_url || i.product.image_url,
        quantity: i.quantity,
        unit_price: i.product.price,
        selected_color: i.selectedColor?.name ?? null,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) {
        setErrors({ email: itemsError.message });
        return;
      }

      await supabase.rpc('decrement_stock_on_order', { p_order_id: order.id });

      clearCart();
      setOrderSuccess(order.id.slice(0, 8).toUpperCase());
    } catch (e: any) {
      captureError(e, { action: 'checkout/place_order' });
      const msg: string = e?.message ?? '';
      if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
        setErrors({ email: 'No internet connection. Please check your network and try again.' });
      } else {
        setErrors({ email: 'Something went wrong. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  if (orderSuccess) {
    return <OrderSuccessScreen orderId={orderSuccess} onContinue={() => router.push('/(tabs)')} />;
  }

  return (
    <KeyboardAvoidingView
      style={S.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={S.header}>
        <View style={S.headerSpacer} />
        <Text style={S.headerTitle}>{t.checkout}</Text>
        <View style={S.secureBadge}>
          <Lock size={12} color={C.success} strokeWidth={2.5} />
          <Text style={S.secureBadgeText}>Secure</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={S.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Shipping info ── */}
        <SectionLabel title={t.shippingInfo} icon={<User size={16} color={C.neonBlue} />} />
        <View style={S.row}>
          <FormField
            label={t.firstName}
            value={form.firstName}
            onChange={(v) => setField('firstName', v)}
            error={errors.firstName}
            style={{ flex: 1 }}
          />
          <FormField
            label={t.lastName}
            value={form.lastName}
            onChange={(v) => setField('lastName', v)}
            error={errors.lastName}
            style={{ flex: 1 }}
          />
        </View>
        <FormField
          label={t.email}
          value={form.email}
          onChange={(v) => setField('email', v)}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          icon={<Mail size={14} color={C.textMuted} />}
        />
        <FormField
          label={t.phone}
          value={form.phone}
          onChange={(v) => setField('phone', v)}
          error={errors.phone}
          keyboardType="phone-pad"
          autoCapitalize="none"
          icon={<Phone size={14} color={C.textMuted} />}
        />

        {/* ── Address ── */}
        <SectionLabel title={t.address} icon={<MapPin size={16} color={C.neonBlue} />} />
        <FormField
          label={t.address}
          value={form.street}
          onChange={(v) => setField('street', v)}
          error={errors.street}
        />
        <View style={S.row}>
          <FormField
            label={t.city}
            value={form.city}
            onChange={(v) => setField('city', v)}
            error={errors.city}
            style={{ flex: 2 }}
          />
          <FormField
            label={t.state}
            value={form.state}
            onChange={(v) => setField('state', v)}
            error={errors.state}
            style={{ flex: 1 }}
          />
        </View>
        <View style={S.row}>
          <FormField
            label={t.zip}
            value={form.zip}
            onChange={(v) => setField('zip', v)}
            error={errors.zip}
            keyboardType="numeric"
            autoCapitalize="none"
            style={{ flex: 1 }}
          />
          <View style={{ flex: 2 }}>
            <CountryPicker
              value={form.country}
              onChange={(code, name) => {
                setForm((f) => ({ ...f, country: code, countryName: name }));
                if (errors.country) setErrors((e) => ({ ...e, country: undefined }));
              }}
              language={language}
              label={t.country}
              error={errors.country}
            />
          </View>
        </View>

        {/* ── Payment method ── */}
        <SectionLabel title={t.paymentMethod} icon={<CreditCard size={16} color={C.neonBlue} />} />

        <View style={S.secureNotice}>
          <ShieldCheck size={14} color={C.success} strokeWidth={2} />
          <Text style={S.secureNoticeText}>
            Your payment information is encrypted and never stored on our servers.
          </Text>
        </View>

        <View style={S.paymentTabs}>
          <PaymentTab
            id="card"
            label="Card"
            active={form.paymentMethod === 'card'}
            onPress={() => setField('paymentMethod', 'card')}
            icon={<CardIcon active={form.paymentMethod === 'card'} />}
          />
          <PaymentTab
            id="paypal"
            label="PayPal"
            active={form.paymentMethod === 'paypal'}
            onPress={() => setField('paymentMethod', 'paypal')}
            icon={<PayPalIcon active={form.paymentMethod === 'paypal'} />}
          />
          <PaymentTab
            id="apple"
            label="Apple Pay"
            active={form.paymentMethod === 'apple'}
            onPress={() => setField('paymentMethod', 'apple')}
            icon={<AppleIcon active={form.paymentMethod === 'apple'} />}
          />
          <PaymentTab
            id="google"
            label="G Pay"
            active={form.paymentMethod === 'google'}
            onPress={() => setField('paymentMethod', 'google')}
            icon={<GoogleIcon active={form.paymentMethod === 'google'} />}
          />
        </View>

        {form.paymentMethod === 'card' && (
          <CardPaymentPanel
            form={form}
            errors={errors}
            showBillingAddress={showBillingAddress}
            onToggleBilling={() => setShowBillingAddress((v) => !v)}
            onCardNumber={handleCardNumber}
            onCardExpiry={handleCardExpiry}
            onCardCvv={handleCardCvv}
            onCardName={(v) => setField('cardName', v)}
            onBillingSame={(v) => setField('billingSameAsShipping', v)}
            onBillingStreet={(v) => setField('billingStreet', v)}
            onBillingCity={(v) => setField('billingCity', v)}
            onBillingZip={(v) => setField('billingZip', v)}
            onBillingCountry={(code, name) =>
              setForm((f) => ({ ...f, billingCountry: code, billingCountryName: name }))
            }
            language={language}
          />
        )}
        {form.paymentMethod === 'paypal' && <PayPalPanel />}
        {form.paymentMethod === 'apple' && <WalletPayPanel type="apple" />}
        {form.paymentMethod === 'google' && <WalletPayPanel type="google" />}

        {/* ── Order summary ── */}
        <View style={S.orderSummary}>
          <Text style={S.summaryTitle}>{t.orderSummary}</Text>
          {items.map((item) => (
            <View key={item.product.id} style={S.summaryItem}>
              <Text style={S.summaryItemName} numberOfLines={1}>
                {item.product.name} ×{item.quantity}
              </Text>
              <Text style={S.summaryItemPrice}>
                ${(item.product.price * item.quantity).toLocaleString()}
              </Text>
            </View>
          ))}
          <View style={S.summaryDivider} />
          <View style={S.summaryRow}>
            <Text style={S.summaryLabel}>{t.subtotal}</Text>
            <Text style={S.summaryValue}>${subtotal.toFixed(2)}</Text>
          </View>
          <View style={S.summaryRow}>
            <View style={{ flex: 1 }}>
              <Text style={S.summaryLabel}>{t.shipping}</Text>
              {rates.freeShipping && rates.shippingRuleName && (
                <Text style={S.freeShippingNote}>Free shipping applied</Text>
              )}
            </View>
            {ratesLoading ? (
              <Text style={S.summaryValue}>...</Text>
            ) : (
              <Text style={[S.summaryValue, shipping === 0 && { color: C.success }]}>
                {shipping === 0 ? t.free : `$${shipping.toFixed(2)}`}
              </Text>
            )}
          </View>
          {tax > 0 && (
            <View style={S.summaryRow}>
              <Text style={S.summaryLabel}>
                {rates.taxLabel || 'Tax'} ({rates.taxPercentage}%)
              </Text>
              {ratesLoading ? (
                <Text style={S.summaryValue}>...</Text>
              ) : (
                <Text style={S.summaryValue}>${tax.toFixed(2)}</Text>
              )}
            </View>
          )}
          <View style={[S.summaryRow, S.totalRow]}>
            <Text style={S.totalLabel}>{t.total}</Text>
            <Text style={S.totalValue}>${total.toFixed(2)}</Text>
          </View>
        </View>

        {errors.email && (
          <View style={S.globalError}>
            <Info size={14} color={C.error} strokeWidth={2} />
            <Text style={S.globalErrorText}>{errors.email}</Text>
          </View>
        )}

        <GlossyButton
          title={loading ? 'Processing...' : t.placeOrder}
          onPress={handlePlaceOrder}
          loading={loading}
          fullWidth
          size="lg"
          style={{ marginTop: Spacing.md }}
        />

        <View style={S.trustRow}>
          <Lock size={12} color={C.textMuted} strokeWidth={2} />
          <Text style={S.trustText}>256-bit SSL encryption</Text>
          <View style={S.trustDot} />
          <ShieldCheck size={12} color={C.textMuted} strokeWidth={2} />
          <Text style={S.trustText}>PCI DSS compliant</Text>
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Payment tab button ────────────────────────────────────────────────────────

function PaymentTab({
  label, active, onPress, icon,
}: { id: string; label: string; active: boolean; onPress: () => void; icon: React.ReactNode }) {
  const C = useThemeColors();
  const S = useMemo(() => makeStyles(C), [C]);
  return (
    <TouchableOpacity
      style={[S.paymentTab, active && S.paymentTabActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={S.paymentTabIcon}>{icon}</View>
      <Text style={[S.paymentTabLabel, active && S.paymentTabLabelActive]} numberOfLines={1}>
        {label}
      </Text>
      {active && <View style={S.paymentTabDot} />}
    </TouchableOpacity>
  );
}

// ─── Card payment panel ────────────────────────────────────────────────────────

function CardPaymentPanel({
  form, errors,
  showBillingAddress, onToggleBilling,
  onCardNumber, onCardExpiry, onCardCvv, onCardName,
  onBillingSame, onBillingStreet, onBillingCity, onBillingZip, onBillingCountry,
  language,
}: {
  form: FormData;
  errors: FormErrors;
  showBillingAddress: boolean;
  onToggleBilling: () => void;
  onCardNumber: (v: string) => void;
  onCardExpiry: (v: string) => void;
  onCardCvv: (v: string) => void;
  onCardName: (v: string) => void;
  onBillingSame: (v: boolean) => void;
  onBillingStreet: (v: string) => void;
  onBillingCity: (v: string) => void;
  onBillingZip: (v: string) => void;
  onBillingCountry: (code: string, name: string) => void;
  language: string;
}) {
  const C = useThemeColors();
  const S = useMemo(() => makeStyles(C), [C]);
  const brand = getCardBrand(form.cardNumber);

  return (
    <View style={S.cardPanel}>
      <View style={S.cardFieldGroup}>
        <Text style={S.cardFieldLabel}>Card Number</Text>
        <View style={[S.cardFieldRow, !!errors.cardNumber && S.cardFieldRowError]}>
          <CreditCard size={16} color={C.textMuted} strokeWidth={1.8} />
          <TextInput
            style={S.cardInput}
            value={form.cardNumber}
            onChangeText={onCardNumber}
            placeholder="1234  5678  9012  3456"
            placeholderTextColor={C.textMuted}
            keyboardType="numeric"
            autoComplete="cc-number"
            autoCorrect={false}
            autoCapitalize="none"
            maxLength={19}
          />
          {brand && (
            <View style={S.cardBrandBadge}>
              <Text style={S.cardBrandText}>{brand.toUpperCase()}</Text>
            </View>
          )}
        </View>
        {errors.cardNumber && <Text style={S.cardFieldError}>{errors.cardNumber}</Text>}
      </View>

      <View style={S.row}>
        <View style={[S.cardFieldGroup, { flex: 1 }]}>
          <Text style={S.cardFieldLabel}>Expiry Date</Text>
          <View style={[S.cardFieldRow, !!errors.cardExpiry && S.cardFieldRowError]}>
            <TextInput
              style={S.cardInput}
              value={form.cardExpiry}
              onChangeText={onCardExpiry}
              placeholder="MM/YY"
              placeholderTextColor={C.textMuted}
              keyboardType="numeric"
              autoComplete="cc-exp"
              autoCorrect={false}
              autoCapitalize="none"
              maxLength={5}
            />
          </View>
          {errors.cardExpiry && <Text style={S.cardFieldError}>{errors.cardExpiry}</Text>}
        </View>

        <View style={[S.cardFieldGroup, { flex: 1 }]}>
          <View style={S.cvvLabelRow}>
            <Text style={S.cardFieldLabel}>CVV</Text>
            <View style={S.cvvHint}>
              <Lock size={10} color={C.textMuted} strokeWidth={2} />
              <Text style={S.cvvHintText}>3–4 digits</Text>
            </View>
          </View>
          <View style={[S.cardFieldRow, !!errors.cardCvv && S.cardFieldRowError]}>
            <TextInput
              style={S.cardInput}
              value={form.cardCvv}
              onChangeText={onCardCvv}
              placeholder="•••"
              placeholderTextColor={C.textMuted}
              keyboardType="numeric"
              secureTextEntry
              autoComplete="cc-csc"
              autoCorrect={false}
              autoCapitalize="none"
              maxLength={4}
            />
          </View>
          {errors.cardCvv && <Text style={S.cardFieldError}>{errors.cardCvv}</Text>}
        </View>
      </View>

      <View style={S.cardFieldGroup}>
        <Text style={S.cardFieldLabel}>Cardholder Name</Text>
        <View style={[S.cardFieldRow, !!errors.cardName && S.cardFieldRowError]}>
          <TextInput
            style={S.cardInput}
            value={form.cardName}
            onChangeText={onCardName}
            placeholder="As printed on the card"
            placeholderTextColor={C.textMuted}
            autoCorrect={false}
            autoCapitalize="words"
          />
        </View>
        {errors.cardName && <Text style={S.cardFieldError}>{errors.cardName}</Text>}
      </View>

      <TouchableOpacity
        style={S.billingToggle}
        onPress={onToggleBilling}
        activeOpacity={0.8}
      >
        <View style={S.billingToggleLeft}>
          <MapPin size={14} color={C.textMuted} strokeWidth={2} />
          <Text style={S.billingToggleText}>Billing address</Text>
          <View style={S.billingOptionalBadge}>
            <Text style={S.billingOptionalText}>Optional</Text>
          </View>
        </View>
        {showBillingAddress
          ? <ChevronUp size={16} color={C.textMuted} strokeWidth={2} />
          : <ChevronDown size={16} color={C.textMuted} strokeWidth={2} />}
      </TouchableOpacity>

      {showBillingAddress && (
        <View style={S.billingAddressSection}>
          <TouchableOpacity
            style={S.sameAsShippingRow}
            onPress={() => onBillingSame(!form.billingSameAsShipping)}
            activeOpacity={0.8}
          >
            <View style={[S.checkbox, form.billingSameAsShipping && S.checkboxChecked]}>
              {form.billingSameAsShipping && (
                <CheckCircle size={14} color={C.background} strokeWidth={2.5} />
              )}
            </View>
            <Text style={S.sameAsShippingText}>Same as shipping address</Text>
          </TouchableOpacity>

          {!form.billingSameAsShipping && (
            <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
              <FormField
                label="Street"
                value={form.billingStreet}
                onChange={onBillingStreet}
              />
              <View style={S.row}>
                <FormField
                  label="City"
                  value={form.billingCity}
                  onChange={onBillingCity}
                  style={{ flex: 2 }}
                />
                <FormField
                  label="ZIP"
                  value={form.billingZip}
                  onChange={onBillingZip}
                  keyboardType="numeric"
                  autoCapitalize="none"
                  style={{ flex: 1 }}
                />
              </View>
              <CountryPicker
                value={form.billingCountry}
                onChange={onBillingCountry}
                language={language}
                label="Country"
              />
            </View>
          )}
        </View>
      )}

      <View style={S.acceptedCards}>
        {['VISA', 'MC', 'AMEX', 'DISC'].map((b) => (
          <View key={b} style={S.acceptedCardChip}>
            <Text style={S.acceptedCardText}>{b}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── PayPal panel ─────────────────────────────────────────────────────────────

function PayPalPanel() {
  const C = useThemeColors();
  const S = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={S.walletPanel}>
      <View style={S.paypalLogo}>
        <Text style={S.paypalLogoBlue}>Pay</Text>
        <Text style={S.paypalLogoNavy}>Pal</Text>
      </View>
      <Text style={S.walletTitle}>Pay with PayPal</Text>
      <View style={S.comingSoonBadge}>
        <Info size={13} color={C.warning} strokeWidth={2} />
        <Text style={S.comingSoonText}>
          PayPal connection will be enabled later
        </Text>
      </View>
      <Text style={S.walletSubtitle}>
        You will be redirected to PayPal to complete your purchase securely once this option is live.
      </Text>
    </View>
  );
}

// ─── Apple Pay / Google Pay placeholder panel ─────────────────────────────────

function WalletPayPanel({ type }: { type: 'apple' | 'google' }) {
  const C = useThemeColors();
  const S = useMemo(() => makeStyles(C), [C]);
  const isApple = type === 'apple';
  return (
    <View style={S.walletPanel}>
      <View style={[S.walletIconCircle, isApple ? S.walletIconApple : S.walletIconGoogle]}>
        <Text style={S.walletIconText}>{isApple ? '' : 'G'}</Text>
      </View>
      <Text style={S.walletTitle}>{isApple ? 'Apple Pay' : 'Google Pay'}</Text>
      <View style={S.comingSoonBadge}>
        <Info size={13} color={C.warning} strokeWidth={2} />
        <Text style={S.comingSoonText}>
          {isApple ? 'Apple Pay' : 'Google Pay'} will be enabled later
        </Text>
      </View>
      <Text style={S.walletSubtitle}>
        Complete your purchase quickly with {isApple ? 'Face ID / Touch ID' : 'your Google account'} once this option is live.
      </Text>
    </View>
  );
}

// ─── Icon components ──────────────────────────────────────────────────────────

function CardIcon({ active }: { active: boolean }) {
  const C = useThemeColors();
  return <CreditCard size={18} color={active ? C.neonBlue : C.textMuted} strokeWidth={1.8} />;
}

function PayPalIcon({ active }: { active: boolean }) {
  const C = useThemeColors();
  return (
    <View style={{ flexDirection: 'row' }}>
      <Text style={{ color: active ? '#009cde' : C.textMuted, fontWeight: '900', fontSize: 13 }}>P</Text>
      <Text style={{ color: active ? '#003087' : C.textMuted, fontWeight: '900', fontSize: 13 }}>P</Text>
    </View>
  );
}

function AppleIcon({ active }: { active: boolean }) {
  const C = useThemeColors();
  return (
    <Text style={{ color: active ? C.textPrimary : C.textMuted, fontSize: 16, fontWeight: '600', lineHeight: 18 }}>

    </Text>
  );
}

function GoogleIcon({ active }: { active: boolean }) {
  const C = useThemeColors();
  return (
    <Text style={{ color: active ? '#4285F4' : C.textMuted, fontSize: 14, fontWeight: '900', lineHeight: 18 }}>
      G
    </Text>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionLabel({ title, icon }: { title: string; icon: React.ReactNode }) {
  const C = useThemeColors();
  const S = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={S.sectionLabel}>
      {icon}
      <Text style={S.sectionLabelText}>{title}</Text>
    </View>
  );
}

function FormField({
  label, value, onChange, error, keyboardType, autoCapitalize, icon, style,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  keyboardType?: any;
  autoCapitalize?: any;
  icon?: React.ReactNode;
  style?: object;
}) {
  const C = useThemeColors();
  const S = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={[S.fieldWrapper, style]}>
      <Text style={S.fieldLabel}>{label}</Text>
      <View style={[S.fieldRow, !!error && S.fieldRowError]}>
        {icon && <View style={{ marginRight: 6 }}>{icon}</View>}
        <TextInput
          style={S.fieldInput}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          placeholderTextColor={C.textMuted}
          autoCapitalize={autoCapitalize ?? 'words'}
          autoCorrect={false}
        />
      </View>
      {error && <Text style={S.fieldError}>{error}</Text>}
    </View>
  );
}

// ─── Order success screen ─────────────────────────────────────────────────────

function OrderSuccessScreen({ orderId, onContinue }: { orderId: string; onContinue: () => void }) {
  const { t } = useLanguage();
  const C = useThemeColors();
  const S = useMemo(() => makeStyles(C), [C]);
  const ring1 = useRef(new Animated.Value(0.6)).current;
  const ring2 = useRef(new Animated.Value(0.6)).current;
  const iconScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(iconScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 14,
    }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(ring1, { toValue: 1.4, duration: 1200, useNativeDriver: true }),
        Animated.timing(ring1, { toValue: 0.6, duration: 0, useNativeDriver: true }),
      ])
    ).start();
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(ring2, { toValue: 1.4, duration: 1200, useNativeDriver: true }),
          Animated.timing(ring2, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    }, 400);
  }, []);

  return (
    <View style={S.successContainer}>
      <View style={S.successIconArea}>
        <Animated.View style={[S.successRing, { transform: [{ scale: ring1 }] }]} />
        <Animated.View style={[S.successRing, S.successRingOuter, { transform: [{ scale: ring2 }] }]} />
        <Animated.View style={[S.successIconCircle, { transform: [{ scale: iconScale }] }]}>
          <CheckCircle size={48} color={C.success} strokeWidth={1.5} />
        </Animated.View>
      </View>

      <Text style={S.successTitle}>{t.orderPlaced}</Text>
      <Text style={S.successSubtitle}>{t.orderPlacedSubtitle}</Text>

      <View style={S.orderIdBox}>
        <Text style={S.orderIdLabel}>Order ID</Text>
        <Text style={S.orderIdValue}>#{orderId}</Text>
      </View>

      <View style={S.successNextSteps}>
        <SuccessStep icon="⏳" text="Your order is pending admin approval" />
        <SuccessStep icon="📧" text="You'll be notified once it's confirmed" />
        <SuccessStep icon="🚚" text="Shipping details will follow after approval" />
      </View>

      <View style={{ width: '85%', marginTop: Spacing.md }}>
        <GlossyButton title={t.continueShopping} onPress={onContinue} fullWidth />
      </View>
    </View>
  );
}

function SuccessStep({ icon, text }: { icon: string; text: string }) {
  const C = useThemeColors();
  const S = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={S.successStep}>
      <Text style={S.successStepIcon}>{icon}</Text>
      <Text style={S.successStepText}>{text}</Text>
    </View>
  );
}
