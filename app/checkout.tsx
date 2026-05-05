import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  ArrowLeft,
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
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import GlossyButton from '@/components/GlossyButton';
import { Colors, Spacing, FontSize, Radius, Shadow } from '@/constants/theme';

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
  paymentMethod: PaymentMethod;
  // Card fields (UI only — not sent to server)
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  cardName: string;
  billingStreet: string;
  billingCity: string;
  billingZip: string;
  billingCountry: string;
  billingSameAsShipping: boolean;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

const PAYMENT_METHOD_IDS: PaymentMethod[] = ['card', 'paypal', 'apple', 'google'];

// ─── Card number formatter ─────────────────────────────────────────────────

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

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CheckoutScreen() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [form, setForm] = useState<FormData>({
    firstName: (user as any)?.firstName ?? '',
    lastName: (user as any)?.lastName ?? '',
    email: user?.email ?? '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
    paymentMethod: 'card',
    cardNumber: '',
    cardExpiry: '',
    cardCvv: '',
    cardName: '',
    billingStreet: '',
    billingCity: '',
    billingZip: '',
    billingCountry: '',
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

  const refreshRates = useCallback(async (country: string) => {
    if (!country.trim()) return;
    setRatesLoading(true);
    const result = await calculateShippingAndTax(country.trim(), subtotal);
    setRates(result);
    setRatesLoading(false);
  }, [subtotal]);

  useEffect(() => {
    refreshRates(form.country);
  }, [form.country, subtotal]);

  const shipping = rates.shipping;
  const tax = rates.tax;
  const total = subtotal + shipping + tax;

  const setField = useCallback((key: keyof FormData, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }, [errors]);

  // Card number — format on input
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
    if (!form.country.trim() || form.country.trim().length > 100)     newErrors.country   = t.fieldRequired;

    // Card UI validation
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
    if (!validate()) return;
    setLoading(true);

    try {
      // Resolve auth identity — never trust the editable email field for logged-in users
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user ?? null;

      console.log('[CHECKOUT USER]', authUser);

      const resolvedEmail: string = authUser?.email
        ? authUser.email
        : form.email.trim().toLowerCase();
      const resolvedUserId: string | null = authUser?.id ?? null;

      console.log('[CHECKOUT RESOLVED]', { resolvedUserId, resolvedEmail });

      if (!authUser && (!resolvedEmail || !resolvedEmail.includes('@'))) {
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
        country:             form.country.trim().slice(0, 100),
        payment_method:      PAYMENT_METHOD_IDS.includes(form.paymentMethod) ? form.paymentMethod : 'card',
        subtotal,
        shipping,
        tax,
        total,
        status: 'confirmed',
      };

      console.log('[CHECKOUT ORDER PAYLOAD]', orderPayload);

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderPayload)
        .select()
        .maybeSingle();

      if (orderError || !order) {
        console.error('[CHECKOUT ORDER ERROR]', orderError);
        setErrors({ email: orderError?.message ?? 'Failed to place order. Please try again.' });
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
        console.error('[checkout] order_items insert error:', itemsError);
        setErrors({ email: itemsError.message });
        return;
      }

      await supabase.rpc('decrement_stock_on_order', { p_order_id: order.id });

      clearCart();
      setOrderSuccess(order.id.slice(0, 8).toUpperCase());
    } catch {
      setErrors({ email: 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (orderSuccess) {
    return <OrderSuccessScreen orderId={orderSuccess} onContinue={() => router.push('/(tabs)')} />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.checkout}</Text>
        {/* Secure badge */}
        <View style={styles.secureBadge}>
          <Lock size={12} color={Colors.success} strokeWidth={2.5} />
          <Text style={styles.secureBadgeText}>Secure</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Shipping info ── */}
        <SectionLabel title={t.shippingInfo} icon={<User size={16} color={Colors.neonBlue} />} />
        <View style={styles.row}>
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
          icon={<Mail size={14} color={Colors.textMuted} />}
        />
        <FormField
          label={t.phone}
          value={form.phone}
          onChange={(v) => setField('phone', v)}
          error={errors.phone}
          keyboardType="phone-pad"
          autoCapitalize="none"
          icon={<Phone size={14} color={Colors.textMuted} />}
        />

        {/* ── Address ── */}
        <SectionLabel title={t.address} icon={<MapPin size={16} color={Colors.neonBlue} />} />
        <FormField
          label={t.address}
          value={form.street}
          onChange={(v) => setField('street', v)}
          error={errors.street}
        />
        <View style={styles.row}>
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
        <View style={styles.row}>
          <FormField
            label={t.zip}
            value={form.zip}
            onChange={(v) => setField('zip', v)}
            error={errors.zip}
            keyboardType="numeric"
            autoCapitalize="none"
            style={{ flex: 1 }}
          />
          <FormField
            label={t.country}
            value={form.country}
            onChange={(v) => setField('country', v)}
            error={errors.country}
            style={{ flex: 2 }}
          />
        </View>

        {/* ── Payment method ── */}
        <SectionLabel title={t.paymentMethod} icon={<CreditCard size={16} color={Colors.neonBlue} />} />

        {/* Secure payment notice */}
        <View style={styles.secureNotice}>
          <ShieldCheck size={14} color={Colors.success} strokeWidth={2} />
          <Text style={styles.secureNoticeText}>
            Your payment information is encrypted and never stored on our servers.
          </Text>
        </View>

        {/* Payment method selector tabs */}
        <View style={styles.paymentTabs}>
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

        {/* Payment method panels */}
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
            onBillingCountry={(v) => setField('billingCountry', v)}
          />
        )}
        {form.paymentMethod === 'paypal' && <PayPalPanel />}
        {form.paymentMethod === 'apple' && <WalletPayPanel type="apple" />}
        {form.paymentMethod === 'google' && <WalletPayPanel type="google" />}

        {/* ── Order summary ── */}
        <View style={styles.orderSummary}>
          <Text style={styles.summaryTitle}>{t.orderSummary}</Text>
          {items.map((item) => (
            <View key={item.product.id} style={styles.summaryItem}>
              <Text style={styles.summaryItemName} numberOfLines={1}>
                {item.product.name} ×{item.quantity}
              </Text>
              <Text style={styles.summaryItemPrice}>
                ${(item.product.price * item.quantity).toLocaleString()}
              </Text>
            </View>
          ))}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t.subtotal}</Text>
            <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>{t.shipping}</Text>
              {rates.freeShipping && rates.shippingRuleName && (
                <Text style={styles.freeShippingNote}>Free shipping applied</Text>
              )}
            </View>
            {ratesLoading ? (
              <Text style={styles.summaryValue}>...</Text>
            ) : (
              <Text style={[styles.summaryValue, shipping === 0 && { color: Colors.success }]}>
                {shipping === 0 ? t.free : `$${shipping.toFixed(2)}`}
              </Text>
            )}
          </View>
          {tax > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {rates.taxLabel || 'Tax'} ({rates.taxPercentage}%)
              </Text>
              {ratesLoading ? (
                <Text style={styles.summaryValue}>...</Text>
              ) : (
                <Text style={styles.summaryValue}>${tax.toFixed(2)}</Text>
              )}
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>{t.total}</Text>
            <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
          </View>
        </View>

        {errors.email && (
          <View style={styles.globalError}>
            <Info size={14} color={Colors.error} strokeWidth={2} />
            <Text style={styles.globalErrorText}>{errors.email}</Text>
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

        {/* Bottom trust row */}
        <View style={styles.trustRow}>
          <Lock size={12} color={Colors.textMuted} strokeWidth={2} />
          <Text style={styles.trustText}>256-bit SSL encryption</Text>
          <View style={styles.trustDot} />
          <ShieldCheck size={12} color={Colors.textMuted} strokeWidth={2} />
          <Text style={styles.trustText}>PCI DSS compliant</Text>
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
  return (
    <TouchableOpacity
      style={[styles.paymentTab, active && styles.paymentTabActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.paymentTabIcon}>{icon}</View>
      <Text style={[styles.paymentTabLabel, active && styles.paymentTabLabelActive]} numberOfLines={1}>
        {label}
      </Text>
      {active && <View style={styles.paymentTabDot} />}
    </TouchableOpacity>
  );
}

// ─── Card payment panel ────────────────────────────────────────────────────────

function CardPaymentPanel({
  form, errors,
  showBillingAddress, onToggleBilling,
  onCardNumber, onCardExpiry, onCardCvv, onCardName,
  onBillingSame, onBillingStreet, onBillingCity, onBillingZip, onBillingCountry,
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
  onBillingCountry: (v: string) => void;
}) {
  const brand = getCardBrand(form.cardNumber);

  return (
    <View style={styles.cardPanel}>
      {/* Card number */}
      <View style={styles.cardFieldGroup}>
        <Text style={styles.cardFieldLabel}>Card Number</Text>
        <View style={[styles.cardFieldRow, !!errors.cardNumber && styles.cardFieldRowError]}>
          <CreditCard size={16} color={Colors.textMuted} strokeWidth={1.8} />
          <TextInput
            style={styles.cardInput}
            value={form.cardNumber}
            onChangeText={onCardNumber}
            placeholder="1234  5678  9012  3456"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numeric"
            autoComplete="cc-number"
            autoCorrect={false}
            autoCapitalize="none"
            maxLength={19}
          />
          {brand && (
            <View style={styles.cardBrandBadge}>
              <Text style={styles.cardBrandText}>{brand.toUpperCase()}</Text>
            </View>
          )}
        </View>
        {errors.cardNumber && <Text style={styles.cardFieldError}>{errors.cardNumber}</Text>}
      </View>

      {/* Expiry + CVV row */}
      <View style={styles.row}>
        <View style={[styles.cardFieldGroup, { flex: 1 }]}>
          <Text style={styles.cardFieldLabel}>Expiry Date</Text>
          <View style={[styles.cardFieldRow, !!errors.cardExpiry && styles.cardFieldRowError]}>
            <TextInput
              style={styles.cardInput}
              value={form.cardExpiry}
              onChangeText={onCardExpiry}
              placeholder="MM/YY"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              autoComplete="cc-exp"
              autoCorrect={false}
              autoCapitalize="none"
              maxLength={5}
            />
          </View>
          {errors.cardExpiry && <Text style={styles.cardFieldError}>{errors.cardExpiry}</Text>}
        </View>

        <View style={[styles.cardFieldGroup, { flex: 1 }]}>
          <View style={styles.cvvLabelRow}>
            <Text style={styles.cardFieldLabel}>CVV</Text>
            <View style={styles.cvvHint}>
              <Lock size={10} color={Colors.textMuted} strokeWidth={2} />
              <Text style={styles.cvvHintText}>3–4 digits</Text>
            </View>
          </View>
          <View style={[styles.cardFieldRow, !!errors.cardCvv && styles.cardFieldRowError]}>
            <TextInput
              style={styles.cardInput}
              value={form.cardCvv}
              onChangeText={onCardCvv}
              placeholder="•••"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              secureTextEntry
              autoComplete="cc-csc"
              autoCorrect={false}
              autoCapitalize="none"
              maxLength={4}
            />
          </View>
          {errors.cardCvv && <Text style={styles.cardFieldError}>{errors.cardCvv}</Text>}
        </View>
      </View>

      {/* Cardholder name */}
      <View style={styles.cardFieldGroup}>
        <Text style={styles.cardFieldLabel}>Cardholder Name</Text>
        <View style={[styles.cardFieldRow, !!errors.cardName && styles.cardFieldRowError]}>
          <TextInput
            style={styles.cardInput}
            value={form.cardName}
            onChangeText={onCardName}
            placeholder="As printed on the card"
            placeholderTextColor={Colors.textMuted}
            autoCorrect={false}
            autoCapitalize="words"
          />
        </View>
        {errors.cardName && <Text style={styles.cardFieldError}>{errors.cardName}</Text>}
      </View>

      {/* Billing address toggle */}
      <TouchableOpacity
        style={styles.billingToggle}
        onPress={onToggleBilling}
        activeOpacity={0.8}
      >
        <View style={styles.billingToggleLeft}>
          <MapPin size={14} color={Colors.textMuted} strokeWidth={2} />
          <Text style={styles.billingToggleText}>Billing address</Text>
          <View style={styles.billingOptionalBadge}>
            <Text style={styles.billingOptionalText}>Optional</Text>
          </View>
        </View>
        {showBillingAddress
          ? <ChevronUp size={16} color={Colors.textMuted} strokeWidth={2} />
          : <ChevronDown size={16} color={Colors.textMuted} strokeWidth={2} />}
      </TouchableOpacity>

      {showBillingAddress && (
        <View style={styles.billingAddressSection}>
          <TouchableOpacity
            style={styles.sameAsShippingRow}
            onPress={() => onBillingSame(!form.billingSameAsShipping)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, form.billingSameAsShipping && styles.checkboxChecked]}>
              {form.billingSameAsShipping && (
                <CheckCircle size={14} color={Colors.background} strokeWidth={2.5} />
              )}
            </View>
            <Text style={styles.sameAsShippingText}>Same as shipping address</Text>
          </TouchableOpacity>

          {!form.billingSameAsShipping && (
            <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
              <FormField
                label="Street"
                value={form.billingStreet}
                onChange={onBillingStreet}
              />
              <View style={styles.row}>
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
              <FormField
                label="Country"
                value={form.billingCountry}
                onChange={onBillingCountry}
              />
            </View>
          )}
        </View>
      )}

      {/* Accepted cards */}
      <View style={styles.acceptedCards}>
        {['VISA', 'MC', 'AMEX', 'DISC'].map((b) => (
          <View key={b} style={styles.acceptedCardChip}>
            <Text style={styles.acceptedCardText}>{b}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── PayPal panel ─────────────────────────────────────────────────────────────

function PayPalPanel() {
  return (
    <View style={styles.walletPanel}>
      <View style={styles.paypalLogo}>
        <Text style={styles.paypalLogoBlue}>Pay</Text>
        <Text style={styles.paypalLogoNavy}>Pal</Text>
      </View>
      <Text style={styles.walletTitle}>Pay with PayPal</Text>
      <View style={styles.comingSoonBadge}>
        <Info size={13} color={Colors.warning} strokeWidth={2} />
        <Text style={styles.comingSoonText}>
          PayPal connection will be enabled later
        </Text>
      </View>
      <Text style={styles.walletSubtitle}>
        You will be redirected to PayPal to complete your purchase securely once this option is live.
      </Text>
    </View>
  );
}

// ─── Apple Pay / Google Pay placeholder panel ─────────────────────────────────

function WalletPayPanel({ type }: { type: 'apple' | 'google' }) {
  const isApple = type === 'apple';
  return (
    <View style={styles.walletPanel}>
      <View style={[styles.walletIconCircle, isApple ? styles.walletIconApple : styles.walletIconGoogle]}>
        <Text style={styles.walletIconText}>{isApple ? '' : 'G'}</Text>
      </View>
      <Text style={styles.walletTitle}>{isApple ? 'Apple Pay' : 'Google Pay'}</Text>
      <View style={styles.comingSoonBadge}>
        <Info size={13} color={Colors.warning} strokeWidth={2} />
        <Text style={styles.comingSoonText}>
          {isApple ? 'Apple Pay' : 'Google Pay'} will be enabled later
        </Text>
      </View>
      <Text style={styles.walletSubtitle}>
        Complete your purchase quickly with {isApple ? 'Face ID / Touch ID' : 'your Google account'} once this option is live.
      </Text>
    </View>
  );
}

// ─── Icon components ──────────────────────────────────────────────────────────

function CardIcon({ active }: { active: boolean }) {
  return <CreditCard size={18} color={active ? Colors.neonBlue : Colors.textMuted} strokeWidth={1.8} />;
}

function PayPalIcon({ active }: { active: boolean }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      <Text style={{ color: active ? '#009cde' : Colors.textMuted, fontWeight: '900', fontSize: 13 }}>P</Text>
      <Text style={{ color: active ? '#003087' : Colors.textMuted, fontWeight: '900', fontSize: 13 }}>P</Text>
    </View>
  );
}

function AppleIcon({ active }: { active: boolean }) {
  return (
    <Text style={{ color: active ? Colors.textPrimary : Colors.textMuted, fontSize: 16, fontWeight: '600', lineHeight: 18 }}>

    </Text>
  );
}

function GoogleIcon({ active }: { active: boolean }) {
  return (
    <Text style={{ color: active ? '#4285F4' : Colors.textMuted, fontSize: 14, fontWeight: '900', lineHeight: 18 }}>
      G
    </Text>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionLabel({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <View style={styles.sectionLabel}>
      {icon}
      <Text style={styles.sectionLabelText}>{title}</Text>
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
  return (
    <View style={[styles.fieldWrapper, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldRow, !!error && styles.fieldRowError]}>
        {icon && <View style={{ marginRight: 6 }}>{icon}</View>}
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize={autoCapitalize ?? 'words'}
          autoCorrect={false}
        />
      </View>
      {error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

// ─── Order success screen ─────────────────────────────────────────────────────

function OrderSuccessScreen({ orderId, onContinue }: { orderId: string; onContinue: () => void }) {
  const { t } = useLanguage();
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
    <View style={styles.successContainer}>
      {/* Pulsing rings */}
      <View style={styles.successIconArea}>
        <Animated.View style={[styles.successRing, { transform: [{ scale: ring1 }] }]} />
        <Animated.View style={[styles.successRing, styles.successRingOuter, { transform: [{ scale: ring2 }] }]} />
        <Animated.View style={[styles.successIconCircle, { transform: [{ scale: iconScale }] }]}>
          <CheckCircle size={48} color={Colors.success} strokeWidth={1.5} />
        </Animated.View>
      </View>

      <Text style={styles.successTitle}>{t.orderPlaced}</Text>
      <Text style={styles.successSubtitle}>{t.orderPlacedSubtitle}</Text>

      <View style={styles.orderIdBox}>
        <Text style={styles.orderIdLabel}>Order ID</Text>
        <Text style={styles.orderIdValue}>#{orderId}</Text>
      </View>

      {/* What's next */}
      <View style={styles.successNextSteps}>
        <SuccessStep icon="📦" text="Your order is being confirmed" />
        <SuccessStep icon="📧" text="You'll receive a confirmation email" />
        <SuccessStep icon="🚚" text="We'll notify you when it ships" />
      </View>

      <View style={{ width: '85%', marginTop: Spacing.md }}>
        <GlossyButton title={t.continueShopping} onPress={onContinue} fullWidth />
      </View>
    </View>
  );
}

function SuccessStep({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.successStep}>
      <Text style={styles.successStepIcon}>{icon}</Text>
      <Text style={styles.successStepText}>{text}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 56 : Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: 'rgba(5,10,20,0.82)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,191,255,0.55)',
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,230,118,0.1)',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  secureBadgeText: {
    color: Colors.success,
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
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  fieldWrapper: {
    gap: 4,
  },
  fieldLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  fieldRowError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorDim,
  },
  fieldInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    padding: 0,
  },
  fieldError: {
    color: Colors.error,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },

  // ── Secure notice ──
  secureNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(0,230,118,0.06)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.18)',
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  secureNoticeText: {
    flex: 1,
    color: Colors.success,
    fontSize: FontSize.xs,
    fontWeight: '600',
    lineHeight: 16,
  },

  // ── Payment tabs ──
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
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 13,
    paddingHorizontal: 4,
    position: 'relative',
  },
  paymentTabActive: {
    borderColor: Colors.neonBlue,
    borderWidth: 2,
    backgroundColor: 'rgba(0,191,255,0.1)',
    shadowColor: Colors.neonBlue,
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
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  paymentTabLabelActive: {
    color: Colors.neonBlue,
    fontWeight: '800',
  },
  paymentTabDot: {
    position: 'absolute',
    bottom: 5,
    width: 16,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.neonBlue,
    shadowColor: Colors.neonBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },

  // ── Card panel ──
  cardPanel: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardFieldGroup: {
    gap: 6,
  },
  cardFieldLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  cardFieldRowError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorDim,
  },
  cardInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    padding: 0,
    letterSpacing: 0.5,
  },
  cardFieldError: {
    color: Colors.error,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  cardBrandBadge: {
    backgroundColor: 'rgba(0,191,255,0.15)',
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
  },
  cardBrandText: {
    color: Colors.neonBlue,
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
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  billingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  billingToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  billingToggleText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  billingOptionalBadge: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  billingOptionalText: {
    color: Colors.textMuted,
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
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundInput,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.neonBlue,
    borderColor: Colors.neonBlue,
  },
  sameAsShippingText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  acceptedCards: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  acceptedCardChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  acceptedCardText: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // ── Wallet/PayPal panel ──
  walletPanel: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  walletIconGoogle: {
    backgroundColor: 'rgba(66,133,244,0.08)',
    borderColor: 'rgba(66,133,244,0.25)',
  },
  walletIconText: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  walletTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
    textAlign: 'center',
  },
  walletSubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,179,0,0.1)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,179,0,0.3)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  comingSoonText: {
    flex: 1,
    color: Colors.warning,
    fontSize: FontSize.sm,
    fontWeight: '700',
    lineHeight: 18,
  },

  // ── Order summary ──
  orderSummary: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  summaryTitle: {
    color: Colors.textPrimary,
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
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  summaryItemPrice: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  freeShippingNote: {
    color: Colors.success,
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  summaryValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  totalRow: {
    marginTop: 4,
  },
  totalLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  totalValue: {
    color: Colors.neonBlue,
    fontSize: FontSize.xl,
    fontWeight: '900',
  },

  // ── Global error ──
  globalError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.errorDim,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.3)',
    padding: Spacing.sm,
  },
  globalErrorText: {
    flex: 1,
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
  },

  // ── Trust row ──
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.md,
    opacity: 0.6,
  },
  trustText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  trustDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
  },

  // ── Success ──
  successContainer: {
    flex: 1,
    backgroundColor: Colors.background,
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
    borderColor: 'rgba(0,230,118,0.3)',
    backgroundColor: 'rgba(0,230,118,0.04)',
  },
  successRingOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderColor: 'rgba(0,230,118,0.15)',
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,230,118,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,230,118,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  successTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxl + 4,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  successSubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: -Spacing.sm,
  },
  orderIdBox: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: 4,
    width: '80%',
  },
  orderIdLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  orderIdValue: {
    color: Colors.neonBlue,
    fontSize: FontSize.xxl,
    fontWeight: '900',
    letterSpacing: 2,
  },
  successNextSteps: {
    width: '100%',
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    lineHeight: 20,
  },
});
