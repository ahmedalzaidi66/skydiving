import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ShoppingCart } from 'lucide-react-native';
import { Product, getProductName, getProductImage } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import StarRating from './StarRating';
import WishlistHeart from './WishlistHeart';
import { Colors, Radius, Spacing, FontSize, Shadow } from '@/constants/theme';
import { useUISize } from '@/context/UISizeContext';
import { useWishlistToast } from '@/context/WishlistToastContext';

type Props = {
  product: Product;
  onWishlistLoginRequired?: () => void;
};

export default function ProductCard({ product, onWishlistLoginRequired }: Props) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { language, isRTL } = useLanguage();
  const { productCardSizes, globalSizes } = useUISize();
  const { showCartToast } = useWishlistToast();

  const imageH = productCardSizes.imageHeight;
  const pad    = productCardSizes.cardPadding;
  const cardR  = globalSizes.cardRadius;
  const btnR   = globalSizes.buttonRadius > 0 ? globalSizes.buttonRadius : Radius.full;

  const handleAddToCart = useCallback((e: any) => {
    e.stopPropagation();
    addToCart(product, 1);
    showCartToast('Added to cart');
  }, [product, addToCart, showCartToast]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.card, { borderRadius: cardR }]}
      onPress={() => router.push(`/product/${product.id}`)}
    >
      <View style={[styles.imageContainer, { height: imageH, borderTopLeftRadius: cardR, borderTopRightRadius: cardR }]}>
        <Image
          source={{ uri: getProductImage(product) }}
          style={[StyleSheet.absoluteFillObject, styles.image]}
          resizeMode="cover"
        />
        {product.badge && (
          <View style={[styles.badge, isRTL ? styles.badgeRTL : styles.badgeLTR]}>
            <Text style={[styles.badgeText, { fontSize: Math.max(9, productCardSizes.titleFontSize - 3) }]}>
              {product.badge}
            </Text>
          </View>
        )}
        <WishlistHeart
          product={product}
          size={14}
          variant="card"
          onLoginRequired={onWishlistLoginRequired}
        />
      </View>

      <View style={[styles.info, { padding: pad }]}>
        <Text
          style={[styles.name, {
            fontSize: productCardSizes.titleFontSize,
            textAlign: isRTL ? 'right' : 'left',
          }]}
          numberOfLines={2}
        >
          {getProductName(product, language)}
        </Text>
        <View style={[styles.ratingRow, isRTL && styles.ratingRowRTL]}>
          <StarRating
            rating={product.rating}
            reviewCount={product.review_count}
            size={Math.max(8, productCardSizes.ratingFontSize - 1)}
            showCount={false}
          />
        </View>
        <View style={[styles.priceRow, isRTL && styles.priceRowRTL]}>
          <View style={[styles.priceGroup, isRTL && styles.priceGroupRTL]}>
            <Text style={[styles.price, { fontSize: productCardSizes.priceFontSize }]}>
              ${product.price.toLocaleString()}
            </Text>
            {product.compare_price != null && product.compare_price > product.price && (
              <Text style={[styles.comparePrice, { fontSize: Math.max(9, productCardSizes.priceFontSize - 3) }]}>
                ${product.compare_price.toLocaleString()}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.addBtn, { borderRadius: btnR }]}
            onPress={handleAddToCart}
            activeOpacity={0.8}
          >
            <ShoppingCart size={Math.max(10, productCardSizes.addToCartBtnSize)} color={Colors.white} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.card,
  },
  imageContainer: {
    width: '100%',
    backgroundColor: Colors.backgroundSecondary,
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    objectFit: 'cover',
  } as any,
  badge: {
    position: 'absolute',
    top: 6,
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeLTR: { left: 8 },
  badgeRTL: { right: 8 },
  badgeText: {
    color: Colors.white,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  info: {
    gap: 2,
  },
  name: {
    color: Colors.textPrimary,
    fontWeight: '600',
    lineHeight: 15,
  },
  ratingRow: { flexDirection: 'row' },
  ratingRowRTL: { flexDirection: 'row-reverse' },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  priceRowRTL: { flexDirection: 'row-reverse' },
  priceGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  priceGroupRTL: { flexDirection: 'row-reverse' },
  price: {
    color: Colors.neonBlue,
    fontWeight: '800',
  },
  comparePrice: {
    color: Colors.textMuted,
    fontWeight: '500',
    textDecorationLine: 'line-through',
  },
  addBtn: {
    backgroundColor: Colors.neonBlueDim,
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.neonBlueSubtle,
  },
});
