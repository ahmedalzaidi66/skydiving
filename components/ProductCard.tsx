import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ShoppingCart } from 'lucide-react-native';
import { Product, getProductName, getProductImage, toThumbUrl } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { useThemeColors } from '@/context/ThemeContext';
import StarRating from './StarRating';
import WishlistHeart from './WishlistHeart';
import { Radius, Shadow } from '@/constants/theme';
import { useUISize } from '@/context/UISizeContext';
import { useWishlistToast } from '@/context/WishlistToastContext';

type Props = {
  product: Product;
  onWishlistLoginRequired?: () => void;
};

export default function ProductCard({ product, onWishlistLoginRequired }: Props) {
  const router = useRouter();
  const Colors = useThemeColors();
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
      style={[{ flex: 1, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.neonBlueBorder, overflow: 'hidden', borderRadius: cardR, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 8, elevation: 3 }]}
      onPress={() => router.push(`/product/${product.id}`)}
    >
      <View style={{ height: imageH, width: '100%', backgroundColor: Colors.backgroundSecondary, position: 'relative', overflow: 'hidden', borderTopLeftRadius: cardR, borderTopRightRadius: cardR }}>
        <Image
          source={{ uri: toThumbUrl(getProductImage(product)) }}
          style={[StyleSheet.absoluteFillObject]}
          resizeMode="cover"
        />
        {product.badge && (
          <View style={[{ position: 'absolute', top: 6, backgroundColor: Colors.neonBlue, borderRadius: Radius.sm, paddingHorizontal: 5, paddingVertical: 2 }, isRTL ? { right: 8 } : { left: 8 }]}>
            <Text style={{ color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.5, fontSize: Math.max(9, productCardSizes.titleFontSize - 3) }}>
              {product.badge}
            </Text>
          </View>
        )}
        <WishlistHeart product={product} size={14} variant="card" onLoginRequired={onWishlistLoginRequired} />
      </View>

      <View style={{ padding: pad, gap: 2 }}>
        <Text style={{ color: Colors.textPrimary, fontWeight: '600', lineHeight: 15, fontSize: productCardSizes.titleFontSize, textAlign: isRTL ? 'right' : 'left' }} numberOfLines={2}>
          {getProductName(product, language)}
        </Text>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <StarRating rating={product.rating} reviewCount={product.review_count} size={Math.max(8, productCardSizes.ratingFontSize - 1)} showCount={false} />
        </View>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'baseline', gap: 4 }}>
            <Text style={{ color: Colors.neonBlue, fontWeight: '800', fontSize: productCardSizes.priceFontSize }}>
              ${product.price.toLocaleString()}
            </Text>
            {product.compare_price != null && product.compare_price > product.price && (
              <Text style={{ color: Colors.textMuted, fontWeight: '500', textDecorationLine: 'line-through', fontSize: Math.max(9, productCardSizes.priceFontSize - 3) }}>
                ${product.compare_price.toLocaleString()}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={{ backgroundColor: Colors.neonBlue, width: 26, height: 26, justifyContent: 'center', alignItems: 'center', borderRadius: btnR, shadowColor: Colors.neonBlue, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 5, elevation: 3 }}
            onPress={handleAddToCart}
            activeOpacity={0.8}
          >
            <ShoppingCart size={Math.max(10, productCardSizes.addToCartBtnSize)} color="#FFFFFF" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}
