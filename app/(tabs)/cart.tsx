import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Trash2, ShoppingBag, ArrowRight } from 'lucide-react-native';
import { useCart, CartItem } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import AppHeader from '@/components/AppHeader';
import GlossyButton from '@/components/GlossyButton';
import QuantitySelector from '@/components/QuantitySelector';
import { Colors, Spacing, FontSize, Radius, Shadow } from '@/constants/theme';

// Shipping is calculated dynamically at checkout based on country rules.
// Cart shows a placeholder message only.

export default function CartScreen() {
  const router = useRouter();
  const { items, removeFromCart, updateQuantity, subtotal, totalItems } = useCart();
  const { t } = useLanguage();
  const [stockWarning, setStockWarning] = useState<string | null>(null);

  // Shipping & tax calculated at checkout based on destination country
  const total = subtotal;

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <AppHeader title={t.yourCart} />
        <EmptyCart />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title={t.yourCart} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.product.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>{t.orderSummary}</Text>
            <SummaryRow label={t.subtotal} value={`$${subtotal.toFixed(2)}`} />
            <View style={styles.shippingNote}>
              <Text style={styles.shippingNoteText}>
                Shipping & tax calculated at checkout based on your country
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t.subtotal}</Text>
              <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
            </View>
          </View>
        }
        ListHeaderComponent={
          <>
            <Text style={styles.itemCount}>
              {totalItems} {totalItems === 1 ? t.item : t.items}
            </Text>
            {stockWarning && (
              <View style={styles.stockWarnBanner}>
                <Text style={styles.stockWarnText}>{stockWarning}</Text>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => (
          <CartItemCard
            item={item}
            onRemove={() => removeFromCart(item.product.id)}
            onUpdateQty={(qty) => {
              const result = updateQuantity(item.product.id, qty, item.selectedColor?.name ?? null);
              if (!result.ok && result.available != null) {
                setStockWarning(`Only ${result.available} available for ${item.product.name}`);
                setTimeout(() => setStockWarning(null), 3500);
              }
            }}
          />
        )}
      />
      <View style={styles.footer}>
        <GlossyButton
          title={t.proceedToCheckout}
          onPress={() => router.push('/checkout')}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
}

function CartItemCard({
  item,
  onRemove,
  onUpdateQty,
}: {
  item: CartItem;
  onRemove: () => void;
  onUpdateQty: (qty: number) => void;
}) {
  const lineTotal = item.product.price * item.quantity;

  return (
    <View style={styles.card}>
      <View style={styles.cardImageWrap}>
        <Image
          source={{ uri: item.product.image_url }}
          style={[StyleSheet.absoluteFillObject, styles.cardImage]}
          resizeMode="cover"
        />
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardName} numberOfLines={2}>
            {item.product.name}
          </Text>
          <TouchableOpacity onPress={onRemove} activeOpacity={0.7} style={styles.removeBtn}>
            <Trash2 size={16} color={Colors.error} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <Text style={styles.cardCategory}>
          {item.product.category.toUpperCase()}
        </Text>
        {item.selectedColor && (
          <View style={styles.colorRow}>
            <View style={[styles.colorDot, { backgroundColor: item.selectedColor.hex }]} />
            <Text style={styles.colorName}>{item.selectedColor.name}</Text>
          </View>
        )}
        <View style={styles.cardBottomRow}>
          <QuantitySelector
            value={item.quantity}
            onDecrement={() => onUpdateQty(item.quantity - 1)}
            onIncrement={() => onUpdateQty(item.quantity + 1)}
            min={0}
            max={item.product.stock}
          />
          <Text style={styles.lineTotal}>${lineTotal.toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, highlight && styles.summaryHighlight]}>
        {value}
      </Text>
    </View>
  );
}

function EmptyCart() {
  const router = useRouter();
  const { t } = useLanguage();
  return (
    <View style={styles.emptyContainer}>
      <ShoppingBag size={48} color={Colors.textMuted} strokeWidth={1.5} />
      <Text style={styles.emptyTitle}>{t.cartEmpty}</Text>
      <Text style={styles.emptySubtitle}>{t.cartEmptySubtitle}</Text>
      <View style={{ marginTop: Spacing.lg, width: '60%' }}>
        <GlossyButton
          title={t.browseGear}
          onPress={() => router.push('/(tabs)/products' as any)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  itemCount: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.card,
  },
  cardImageWrap: {
    width: 82,
    height: 90,
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  },
  cardImage: {
    objectFit: 'cover',
  } as any,
  cardInfo: {
    flex: 1,
    padding: Spacing.sm,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  cardName: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    lineHeight: 18,
  },
  removeBtn: {
    padding: 4,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  colorName: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  stockWarnBanner: {
    backgroundColor: 'rgba(255,179,0,0.12)',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,179,0,0.35)',
  },
  stockWarnText: {
    color: Colors.warning,
    fontSize: FontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardCategory: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 1,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lineTotal: {
    color: Colors.neonBlue,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  summary: {
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
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 2,
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
  summaryValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  summaryHighlight: {
    color: Colors.success,
    fontWeight: '700',
  },
  shippingHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontStyle: 'italic',
  },
  shippingNote: {
    backgroundColor: 'rgba(0,191,255,0.06)',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    padding: Spacing.sm,
    marginVertical: 4,
  },
  shippingNoteText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  totalValue: {
    color: Colors.neonBlue,
    fontSize: FontSize.xl,
    fontWeight: '900',
  },
  footer: {
    padding: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 28 : Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
