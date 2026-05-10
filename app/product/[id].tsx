import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  Dimensions,
  Modal,
  PanResponder,
  Animated,
  TextInput,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ShoppingCart, Package, Shield, Star,
  ChevronRight, X, ChevronLeft, Tag, Zap,
  Share2,
} from 'lucide-react-native';
import {
  fetchProductById, Product,
  getProductName, getProductDescription, getProductImage,
  getProductImages, supabase,
} from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

export type ColorVariant = {
  id: string;
  name: string;
  hex: string;
  image_url: string | null;
  is_default: boolean;
  sort_order: number;
  stock: number | null;
};

import { useLanguage } from '@/context/LanguageContext';
import StarRating from '@/components/StarRating';
import QuantitySelector from '@/components/QuantitySelector';
import GlossyButton from '@/components/GlossyButton';
import ProductCard from '@/components/ProductCard';
import WishlistHeart from '@/components/WishlistHeart';
import { Spacing, FontSize, Radius, Shadow } from '@/constants/theme';
import { useThemeColors } from '@/context/ThemeContext';

const { width: SCREEN_W } = Dimensions.get('window');
const IMAGE_HEIGHT = Platform.OS === 'web' ? 440 : Math.min(SCREEN_W, 400);

// ── Fullscreen Lightbox ───────────────────────────────────────────────────────

function Lightbox({ images, initialIndex, onClose }: {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(initialIndex);
  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), []);
  const next = useCallback(() => setCurrent((c) => Math.min(images.length - 1, c + 1)), [images.length]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50) next();
        else if (g.dx > 50) prev();
      },
    })
  ).current;

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={lb.backdrop} {...panResponder.panHandlers}>
        <Image source={{ uri: images[current] }} style={lb.image} resizeMode="contain" />
        <TouchableOpacity style={lb.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <X size={22} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={lb.counter}>
          <Text style={lb.counterText}>{current + 1} / {images.length}</Text>
        </View>
        {current > 0 && (
          <TouchableOpacity style={[lb.navBtn, lb.navLeft]} onPress={prev} activeOpacity={0.8}>
            <ChevronLeft size={28} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        )}
        {current < images.length - 1 && (
          <TouchableOpacity style={[lb.navBtn, lb.navRight]} onPress={next} activeOpacity={0.8}>
            <ChevronRight size={28} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        )}
        {images.length > 1 && (
          <View style={lb.dots}>
            {images.map((_, i) => (
              <TouchableOpacity key={i} onPress={() => setCurrent(i)} activeOpacity={0.7}>
                <View style={[lb.dot, i === current && lb.dotActive]} />
              </TouchableOpacity>
            ))}
          </View>
        )}
        {images.length > 1 && (
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={lb.thumbRow} style={lb.thumbScroll}
          >
            {images.map((img, i) => (
              <TouchableOpacity
                key={i} onPress={() => setCurrent(i)} activeOpacity={0.8}
                style={[lb.thumb, i === current && lb.thumbActive]}
              >
                <Image
                  source={{ uri: img }}
                  style={[StyleSheet.absoluteFillObject, lb.thumbImg]}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const lb = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)', justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: '70%', objectFit: 'contain' } as any,
  closeBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : 32, right: 16,
    width: 42, height: 42, backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 21, justifyContent: 'center', alignItems: 'center',
  },
  counter: {
    position: 'absolute', top: Platform.OS === 'ios' ? 60 : 36,
    left: 0, right: 0, alignItems: 'center',
  },
  counterText: { color: 'rgba(255,255,255,0.7)', fontSize: FontSize.sm, fontWeight: '700' },
  navBtn: {
    position: 'absolute', top: '50%', marginTop: -28,
    width: 52, height: 52, backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 26, justifyContent: 'center', alignItems: 'center',
  },
  navLeft: { left: 12 },
  navRight: { right: 12 },
  dots: { position: 'absolute', bottom: 130, flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { backgroundColor: '#00BFFF', width: 20, borderRadius: 3.5 },
  thumbScroll: { position: 'absolute', bottom: 24, left: 0, right: 0 },
  thumbRow: { paddingHorizontal: 16, gap: 8 },
  thumb: {
    width: 60, height: 60, borderRadius: Radius.sm,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', overflow: 'hidden',
  },
  thumbActive: { borderColor: '#00BFFF', borderWidth: 2 },
  thumbImg: { objectFit: 'cover' } as any,
});

// ── Skeleton loader ───────────────────────────────────────────────────────────

function SkeletonLine({ width: w = '80%', height = 16, bg }: { width?: any; height?: number; bg: string }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={{
        height, width: w, borderRadius: Radius.sm,
        backgroundColor: bg, opacity: pulse,
      }}
    />
  );
}

// ── Product Detail Screen ─────────────────────────────────────────────────────

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addToCart, items } = useCart();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const C = useThemeColors();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [stockMsg, setStockMsg] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [colorVariants, setColorVariants] = useState<ColorVariant[]>([]);
  const [selectedColor, setSelectedColor] = useState<ColorVariant | null>(null);

  // Review form
  const [approvedReviews, setApprovedReviews] = useState<Array<{ id: string; customer_name: string; rating: number; body: string; created_at: string }>>([]);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewBody, setReviewBody] = useState('');
  const [reviewName, setReviewName] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewError, setReviewError] = useState('');

  // Share
  const [shareCopied, setShareCopied] = useState(false);

  // Footer add-to-cart success fade animation
  const successOpacity = useRef(new Animated.Value(0)).current;

  // Track latest fetch to prevent stale state on fast navigation
  const fetchId = useRef(0);

  useEffect(() => {
    if (!id) return;

    const thisFetch = ++fetchId.current;

    setLoading(true);
    setFetchError(null);
    setProduct(null);
    setRelated([]);
    setActiveImageIndex(0);
    setColorVariants([]);
    setSelectedColor(null);
    setApprovedReviews([]);
    setReviewSubmitted(false);
    setReviewRating(0);
    setReviewBody('');
    setReviewName('');

    const timeoutId = setTimeout(() => {
      if (thisFetch !== fetchId.current) return;
      setFetchError('Request timed out. Please check your connection and try again.');
      setLoading(false);
    }, 8000);

    fetchProductById(id, language)
      .then((data) => {
        if (thisFetch !== fetchId.current) return;
        clearTimeout(timeoutId);
        setProduct(data);
        setLoading(false);

        if (!data) return;

        supabase
          .from('product_color_variants')
          .select('id, name, hex, image_url, is_default, sort_order, stock')
          .eq('product_id', data.id)
          .order('sort_order', { ascending: true })
          .then(({ data: variants }) => {
            if (thisFetch !== fetchId.current) return;
            const v = variants as ColorVariant[] | null;
            if (v && v.length > 0) {
              setColorVariants(v);
              setSelectedColor(v.find((c) => c.is_default) ?? v[0]);
            }
          })
          .catch(() => {});

        supabase
          .from('reviews')
          .select('id, customer_name, rating, body, created_at')
          .eq('product_id', data.id)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(8)
          .then(({ data: reviewData }) => {
            if (thisFetch !== fetchId.current) return;
            setApprovedReviews(reviewData ?? []);
          })
          .catch(() => {});
      })
      .catch((err: any) => {
        if (thisFetch !== fetchId.current) return;
        clearTimeout(timeoutId);
        const msg = err?.message ?? 'Failed to load product';
        setFetchError(msg);
        setLoading(false);
      });
  }, [id, language]);

  const handleAddToCart = () => {
    if (!product) return;
    const result = addToCart(
      product, quantity,
      selectedColor
        ? { name: selectedColor.name, hex: selectedColor.hex, image_url: selectedColor.image_url, stock: selectedColor.stock }
        : null
    );
    if (!result.ok) {
      setStockMsg(`Only ${result.available} available`);
      setTimeout(() => setStockMsg(''), 3000);
      return;
    }
    setAddedFeedback(true);
    Animated.sequence([
      Animated.timing(successOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(successOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setAddedFeedback(false));
  };

  const refreshReviews = async (productId: string) => {
    const { data: reviewData } = await supabase
      .from('reviews')
      .select('id, customer_name, rating, body, created_at')
      .eq('product_id', productId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(8);
    setApprovedReviews(reviewData ?? []);

    const { data: productData } = await supabase
      .from('products')
      .select('rating, review_count')
      .eq('id', productId)
      .maybeSingle();
    if (productData && product) {
      setProduct({ ...product, rating: productData.rating, review_count: productData.review_count });
    }
  };

  const handleSubmitReview = async () => {
    if (!user) {
      setReviewError('Please log in to write a review.');
      return;
    }
    if (reviewRating === 0) { setReviewError('Please select a star rating.'); return; }
    const name = reviewName.trim() || (user.email?.split('@')[0] ?? 'Anonymous');
    if (reviewBody.trim().length < 10) { setReviewError('Review must be at least 10 characters.'); return; }
    setReviewError('');
    setReviewSubmitting(true);
    const { error } = await supabase.from('reviews').insert({
      product_id: id,
      user_id: user.id,
      customer_name: name,
      customer_email: user.email ?? '',
      rating: reviewRating,
      body: reviewBody.trim(),
      status: 'pending',
      review_type: 'product',
    });
    setReviewSubmitting(false);
    if (error) {
      setReviewError(error.message ?? 'Failed to submit review. Please try again.');
    } else {
      setReviewSubmitted(true);
      setReviewRating(0);
      setReviewBody('');
      setReviewName('');
      refreshReviews(id as string);
    }
  };

  const cartItem = items.find((i) => i.product.id === id);
  const inCartQty = cartItem?.quantity ?? 0;

  const effectiveStock = (() => {
    if (!product) return 0;
    if (product.unlimited_stock) return 9999;
    if (selectedColor && selectedColor.stock != null) return selectedColor.stock;
    return product.stock;
  })();
  const lowThreshold = product?.low_stock_threshold ?? 5;
  const isOutOfStock = !product?.unlimited_stock && effectiveStock === 0;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.background }}>
        <View style={{ width: '100%', height: IMAGE_HEIGHT, backgroundColor: C.backgroundCard }} />
        <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
          <SkeletonLine width="70%" height={28} bg={C.backgroundCard} />
          <SkeletonLine width="40%" height={18} bg={C.backgroundCard} />
          <SkeletonLine width="30%" height={36} bg={C.backgroundCard} />
          <View style={{ height: Spacing.md }} />
          <SkeletonLine width="100%" height={14} bg={C.backgroundCard} />
          <SkeletonLine width="90%" height={14} bg={C.backgroundCard} />
          <SkeletonLine width="75%" height={14} bg={C.backgroundCard} />
        </View>
      </View>
    );
  }

  if (fetchError || !product) {
    return (
      <View style={{ flex: 1, backgroundColor: C.background, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg }}>
        <Text style={{ color: C.error, fontSize: FontSize.md, fontWeight: '700', textAlign: 'center', marginBottom: Spacing.sm }}>
          {fetchError ?? 'Product not found'}
        </Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.75}>
          <Text style={{ color: C.neonBlue, fontSize: FontSize.sm, fontWeight: '700' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const images = getProductImages(product);
  const colorImage = selectedColor?.image_url ?? null;
  const activeImage = colorImage || images[activeImageIndex] || getProductImage(product);

  const hasDiscount = product.compare_price != null && product.compare_price > product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.compare_price! - product.price) / product.compare_price!) * 100)
    : 0;

  const stockStatus = product.unlimited_stock
    ? 'in'
    : effectiveStock > lowThreshold
    ? 'in'
    : effectiveStock > 0
    ? 'low'
    : 'out';

  const stockColor = stockStatus === 'in' ? C.success : stockStatus === 'low' ? C.warning : C.error;
  const stockLabel = stockStatus === 'in'
    ? t.inStock
    : stockStatus === 'low'
    ? t.onlyLeft.replace('{{n}}', String(effectiveStock))
    : t.outOfStock;

  const handleShare = async () => {
    const slug = product.slug || product.id;
    const url = `${(typeof window !== 'undefined' && window?.location?.origin) ? window.location.origin : 'https://skydiverstore.com'}/product/${slug}`;
    const title = getProductName(product, language);
    const message = `Check this out on Skydiver Man Gear: ${title}`;
    if (Platform.OS !== 'web') {
      try {
        await Share.share({ title, message: `${message}\n${url}`, url });
      } catch {}
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: message, url });
      } catch {}
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      {lightboxIndex !== null && (
        <Lightbox images={images} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}

      <ScrollView showsVerticalScrollIndicator={false} bounces>
        {/* ── Hero image ── */}
        <View style={{ width: '100%', height: IMAGE_HEIGHT, position: 'relative', backgroundColor: C.backgroundSecondary }}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={() => images.length > 0 && setLightboxIndex(activeImageIndex)}
            activeOpacity={0.95}
          >
            <Image
              source={{ uri: activeImage }}
              style={[StyleSheet.absoluteFillObject, { objectFit: 'contain', objectPosition: 'center' } as any]}
              resizeMode="contain"
            />
            <LinearGradient
              colors={['rgba(5,10,20,0.5)', 'transparent', 'rgba(5,10,20,0.92)']}
              style={StyleSheet.absoluteFillObject}
            />
          </TouchableOpacity>

          {/* Top action bar */}
          <View style={[s.topBar, { top: insets.top + 8 }]}>
            <TouchableOpacity
              style={s.topBtn}
              onPress={() => router.back()}
              activeOpacity={0.8}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={20} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.topBtn}
              onPress={handleShare}
              activeOpacity={0.8}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {shareCopied
                ? <Text style={{ color: C.neonBlue, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>Copied!</Text>
                : <Share2 size={18} color="#FFFFFF" strokeWidth={2} />
              }
            </TouchableOpacity>
          </View>

          <View style={[StyleSheet.absoluteFillObject, { zIndex: 10 }]} pointerEvents="box-none">
            {hasDiscount && (
              <View style={s.discountBadge}>
                <Tag size={10} color="#fff" strokeWidth={2.5} />
                <Text style={s.discountBadgeText}>-{discountPct}%</Text>
              </View>
            )}
            {product.badge && !hasDiscount && (
              <View style={[s.badge, { backgroundColor: C.neonBlue }]}>
                <Text style={s.badgeText}>{product.badge}</Text>
              </View>
            )}
            {images.length > 1 && (
              <View style={s.imageCount}>
                <Text style={s.imageCountText}>{activeImageIndex + 1}/{images.length}</Text>
              </View>
            )}
            <View style={s.imageBottom}>
              <View style={s.categoryPill}>
                <Text style={{ color: C.textSecondary, fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 1.5 }}>
                  {product.category.toUpperCase()}
                </Text>
              </View>
              {images.length > 0 && (
                <View style={s.expandHint}>
                  <Zap size={10} color={C.textMuted} strokeWidth={2} />
                  <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '600' }}>Tap to expand</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Thumbnail strip ── */}
        {images.length > 1 && (
          <View style={{ backgroundColor: C.backgroundSecondary, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingVertical: 10, gap: 8 }}
            >
              {images.map((img, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setActiveImageIndex(idx)}
                  activeOpacity={0.8}
                  style={[
                    { width: 60, height: 60, borderRadius: Radius.md, borderWidth: 1.5, borderColor: C.borderLight, overflow: 'hidden', backgroundColor: C.background },
                    idx === activeImageIndex && { borderColor: C.neonBlue, borderWidth: 2 },
                  ]}
                >
                  <Image
                    source={{ uri: img }}
                    style={[StyleSheet.absoluteFillObject, { objectFit: 'cover' } as any]}
                    resizeMode="cover"
                  />
                  {idx === activeImageIndex && (
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: C.neonBlueGlow }]} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Main content ── */}
        <View style={{ padding: Spacing.lg, paddingTop: Spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: 6 }}>
            <Text style={{ color: C.textPrimary, fontSize: FontSize.xxl, fontWeight: '800', lineHeight: 34, letterSpacing: -0.3, flex: 1 }}>
              {getProductName(product, language)}
            </Text>
            <WishlistHeart product={product} size={20} variant="detail" />
          </View>

          <View style={{ marginBottom: Spacing.md }}>
            <StarRating rating={product.rating} reviewCount={product.review_count} size={15} />
          </View>

          <View style={{ marginBottom: Spacing.sm, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm }}>
              <Text style={{ color: C.neonBlue, fontSize: FontSize.xxl + 6, fontWeight: '900', letterSpacing: -1 }}>
                ${product.price.toLocaleString()}
              </Text>
              {hasDiscount && (
                <Text style={{ color: C.textMuted, fontSize: FontSize.lg, fontWeight: '500', textDecorationLine: 'line-through' }}>
                  ${product.compare_price!.toLocaleString()}
                </Text>
              )}
            </View>
            {hasDiscount && (
              <View style={{ alignSelf: 'flex-start', backgroundColor: C.errorDim, borderRadius: Radius.sm, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: C.error + '4D' }}>
                <Text style={{ color: C.error, fontSize: FontSize.xs, fontWeight: '700' }}>
                  You save ${(product.compare_price! - product.price).toLocaleString()} ({discountPct}% off)
                </Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: Spacing.md }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: stockColor }} />
            <Text style={{ fontSize: FontSize.sm, fontWeight: '700', color: stockColor }}>{stockLabel}</Text>
            {selectedColor && selectedColor.stock != null && (
              <Text style={{ color: C.textMuted, fontSize: FontSize.xs, fontWeight: '600' }}>· {selectedColor.name}</Text>
            )}
          </View>

          {product.sku && (
            <Text style={{ color: C.textMuted, fontSize: FontSize.xs, fontWeight: '500', marginBottom: Spacing.sm }}>
              {t.skuLabel}: {product.sku}
            </Text>
          )}

          <View style={{ flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.md, flexWrap: 'wrap' }}>
            <TrustBadge icon={<Shield size={13} color={C.neonBlue} />} label={t.proTested} C={C} />
            <TrustBadge icon={<Package size={13} color={C.neonBlue} />} label={t.freeShipping} C={C} />
            <TrustBadge icon={<Star size={13} color={C.neonBlue} />} label={t.topRated} C={C} />
          </View>

          <View style={{ height: 1, backgroundColor: C.borderLight, marginVertical: Spacing.md }} />

          <Text style={{ color: C.textPrimary, fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.sm }}>
            {t.description}
          </Text>
          <Text style={{ color: C.textSecondary, fontSize: FontSize.md, lineHeight: 26 }}>
            {getProductDescription(product, language)}
          </Text>

          {product.specifications && Object.keys(product.specifications).length > 0 && (
            <>
              <View style={{ height: 1, backgroundColor: C.borderLight, marginVertical: Spacing.md }} />
              <Text style={{ color: C.textPrimary, fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.sm }}>
                {t.specifications}
              </Text>
              <View style={{ borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, overflow: 'hidden', backgroundColor: C.backgroundCard }}>
                {Object.entries(product.specifications).map(([key, val], i, arr) => (
                  <View
                    key={key}
                    style={[
                      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.borderLight, paddingHorizontal: Spacing.md, paddingVertical: 11 },
                      i === arr.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <Text style={{ flex: 1, color: C.textSecondary, fontSize: FontSize.sm, fontWeight: '600' }}>{key}</Text>
                    <Text style={{ flex: 1, color: C.textPrimary, fontSize: FontSize.sm, fontWeight: '500', textAlign: 'right' }}>{String(val)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={{ height: 1, backgroundColor: C.borderLight, marginVertical: Spacing.md }} />

          {inCartQty > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.neonBlueGlow, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.md, borderWidth: 1, borderColor: C.neonBlueBorder }}>
              <ShoppingCart size={14} color={C.neonBlue} strokeWidth={2} />
              <Text style={{ color: C.neonBlue, fontSize: FontSize.sm, fontWeight: '700' }}>{inCartQty} {t.inCart}</Text>
            </View>
          )}

          {stockMsg !== '' && (
            <View style={{ backgroundColor: C.warning + '1A', borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm, borderWidth: 1, borderColor: C.warning + '4D' }}>
              <Text style={{ color: C.warning, fontSize: FontSize.sm, fontWeight: '700', textAlign: 'center' }}>{stockMsg}</Text>
            </View>
          )}

          {colorVariants.length > 0 && (
            <View style={{ gap: 10, marginBottom: Spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: C.textSecondary, fontSize: FontSize.sm, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {t.color ?? 'Color'}
                </Text>
                {selectedColor && (
                  <Text style={{ color: C.neonBlue, fontSize: FontSize.sm, fontWeight: '700' }}>{selectedColor.name}</Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {colorVariants.map((v) => {
                  const active = selectedColor?.id === v.id;
                  const colorOos = !product.unlimited_stock && v.stock != null && v.stock === 0;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[
                        { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'rgba(128,128,128,0.3)', justifyContent: 'center', alignItems: 'center', backgroundColor: v.hex },
                        active && { borderColor: C.white, borderWidth: 2.5 },
                        colorOos && { opacity: 0.3 },
                      ]}
                      onPress={() => !colorOos && setSelectedColor(v)}
                      activeOpacity={colorOos ? 1 : 0.8}
                    >
                      {active && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.9)' }} />}
                      {colorOos && (
                        <View style={{ position: 'absolute', width: '130%' as any, height: 2, backgroundColor: 'rgba(255,255,255,0.8)', transform: [{ rotate: '45deg' }] }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.xs }}>
            <Text style={{ color: C.textPrimary, fontSize: FontSize.lg, fontWeight: '700' }}>{t.quantity}</Text>
            <QuantitySelector
              value={quantity}
              onDecrement={() => setQuantity((q) => Math.max(1, q - 1))}
              onIncrement={() => setQuantity((q) => Math.min(effectiveStock, q + 1))}
              min={1}
              max={effectiveStock}
            />
          </View>

          <View style={{ height: Spacing.xl }} />
        </View>

        {/* ── Customer Reviews ── */}
        <View style={{ borderTopWidth: 1, borderTopColor: C.borderLight, paddingTop: Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md }}>
            <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: C.neonBlue }} />
            <Text style={{ color: C.textPrimary, fontSize: FontSize.lg, fontWeight: '800', letterSpacing: 0.2 }}>Customer Reviews</Text>
            {product.review_count > 0 && (
              <View style={{ backgroundColor: C.neonBlueGlow, borderRadius: Radius.full, borderWidth: 1, borderColor: C.neonBlueBorder, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 4 }}>
                <Text style={{ color: C.neonBlue, fontSize: FontSize.xs, fontWeight: '800' }}>{product.review_count}</Text>
              </View>
            )}
          </View>

          {approvedReviews.length > 0 && (
            <View style={{ gap: Spacing.sm, marginBottom: Spacing.md }}>
              {approvedReviews.map((rv) => (
                <View key={rv.id} style={{ backgroundColor: C.backgroundCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.neonBlue, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                      <Text style={{ color: C.background, fontSize: FontSize.sm, fontWeight: '800' }}>{rv.customer_name?.[0]?.toUpperCase() ?? '?'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.textPrimary, fontSize: FontSize.sm, fontWeight: '700' }}>{rv.customer_name}</Text>
                      <Text style={{ color: C.textMuted, fontSize: FontSize.xs }}>
                        {new Date(rv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={12}
                          color={i < rv.rating ? C.gold : C.border}
                          fill={i < rv.rating ? C.gold : 'transparent'}
                          strokeWidth={1.5}
                        />
                      ))}
                    </View>
                  </View>
                  <Text style={{ color: C.textSecondary, fontSize: FontSize.sm, lineHeight: 20 }}>{rv.body}</Text>
                </View>
              ))}
            </View>
          )}

          {approvedReviews.length === 0 && (
            <Text style={{ color: C.textMuted, fontSize: FontSize.sm, marginBottom: Spacing.md }}>
              No reviews yet. Be the first to review this product.
            </Text>
          )}

          <View style={{ backgroundColor: C.backgroundCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.sm }}>
            <Text style={{ color: C.textPrimary, fontSize: FontSize.md, fontWeight: '800', marginBottom: 4 }}>
              {reviewSubmitted ? 'Review Submitted!' : 'Write a Review'}
            </Text>
            {reviewSubmitted ? (
              <View style={{ backgroundColor: C.successDim, borderRadius: Radius.md, borderWidth: 1, borderColor: C.success + '40', padding: Spacing.md }}>
                <Text style={{ color: C.success, fontSize: FontSize.sm, fontWeight: '600', lineHeight: 20 }}>
                  Thank you! Your review is pending admin approval and will appear once approved.
                </Text>
              </View>
            ) : (
              <>
                <Text style={{ color: C.textMuted, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>Rating *</Text>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => { setReviewRating(s); setReviewError(''); }}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Star
                        size={32}
                        color={s <= reviewRating ? C.gold : C.textMuted}
                        fill={s <= reviewRating ? C.gold : 'transparent'}
                        strokeWidth={1.5}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                {!user && (
                  <>
                    <Text style={{ color: C.textMuted, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>Your Name</Text>
                    <TextInput
                      style={{ backgroundColor: C.backgroundSecondary, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.sm, paddingHorizontal: Spacing.md, paddingVertical: 10 }}
                      value={reviewName}
                      onChangeText={setReviewName}
                      placeholder="Enter your name"
                      placeholderTextColor={C.textMuted}
                    />
                  </>
                )}

                <Text style={{ color: C.textMuted, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>Review *</Text>
                <TextInput
                  style={{ backgroundColor: C.backgroundSecondary, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.sm, paddingHorizontal: Spacing.md, paddingVertical: 10, minHeight: 88, textAlignVertical: 'top' }}
                  value={reviewBody}
                  onChangeText={setReviewBody}
                  placeholder="Share your experience with this product..."
                  placeholderTextColor={C.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                {reviewError !== '' && (
                  <Text style={{ color: C.error, fontSize: FontSize.xs, fontWeight: '600' }}>{reviewError}</Text>
                )}

                <TouchableOpacity
                  style={[{ backgroundColor: C.neonBlue, borderRadius: Radius.full, paddingVertical: 14, alignItems: 'center', marginTop: 4 }, reviewSubmitting && { opacity: 0.5 }]}
                  onPress={handleSubmitReview}
                  activeOpacity={0.8}
                  disabled={reviewSubmitting}
                >
                  {reviewSubmitting ? (
                    <ActivityIndicator size="small" color={C.background} />
                  ) : (
                    <Text style={{ color: C.background, fontSize: FontSize.md, fontWeight: '800' }}>Submit Review</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* ── Related products ── */}
        {related.length > 0 && (
          <View style={{ borderTopWidth: 1, borderTopColor: C.borderLight, paddingTop: Spacing.lg, paddingBottom: Spacing.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, marginBottom: Spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: C.neonBlue }} />
                <Text style={{ color: C.textPrimary, fontSize: FontSize.lg, fontWeight: '800', letterSpacing: 0.2 }}>{t.youMayAlsoLike}</Text>
              </View>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
                onPress={() => router.push('/(tabs)/products' as any)}
                activeOpacity={0.7}
              >
                <Text style={{ color: C.neonBlue, fontSize: FontSize.sm, fontWeight: '700' }}>{t.seeAll}</Text>
                <ChevronRight size={14} color={C.neonBlue} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: Spacing.sm }}
            >
              {related.map((item) => (
                <View key={item.id} style={{ width: 160 }}>
                  <ProductCard product={item} />
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* ── Sticky footer ── */}
      <View style={{ backgroundColor: C.background, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Platform.OS === 'ios' ? 34 : Spacing.md, borderTopWidth: 1, borderTopColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 12 }}>
        {addedFeedback ? (
          <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.successDim, borderRadius: Radius.md, paddingVertical: 14, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: C.success + '4D' }, { opacity: successOpacity }]}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.successDim, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.success + '59' }}>
              <ShoppingCart size={18} color={C.success} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: C.success, fontSize: FontSize.md, fontWeight: '800' }}>{t.addedToCart}</Text>
              <Text style={{ color: C.textSecondary, fontSize: FontSize.xs, fontWeight: '500' }}>
                {quantity} × {getProductName(product, language)}
              </Text>
            </View>
            <Text style={{ color: C.success, fontSize: FontSize.lg, fontWeight: '900' }}>
              ${(product.price * quantity).toLocaleString()}
            </Text>
          </Animated.View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
            <View style={{ gap: 1, minWidth: 80 }}>
              <Text style={{ color: C.textMuted, fontSize: FontSize.xs, fontWeight: '600', letterSpacing: 0.3 }}>{t.total}</Text>
              <Text style={{ color: C.neonBlue, fontSize: FontSize.xl, fontWeight: '900', lineHeight: 26 }}>
                ${(product.price * quantity).toLocaleString()}
              </Text>
              {hasDiscount && (
                <Text style={{ color: C.error, fontSize: FontSize.xs, fontWeight: '700', marginTop: 1 }}>
                  Save ${((product.compare_price! - product.price) * quantity).toLocaleString()}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <GlossyButton
                title={isOutOfStock ? t.outOfStock : t.addToCart}
                onPress={handleAddToCart}
                disabled={isOutOfStock}
                fullWidth
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function TrustBadge({ icon, label, C }: { icon: React.ReactNode; label: string; C: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.neonBlueGlow, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.neonBlueBorder }}>
      {icon}
      <Text style={{ color: C.neonBlue, fontSize: FontSize.xs, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  topBar: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 30,
  },
  topBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(5,10,20,0.72)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  badge: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 112 : 68,
    right: Spacing.md,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 15,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  discountBadge: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 112 : 68,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF4444',
    borderRadius: Radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 5,
    zIndex: 15,
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  discountBadgeText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  imageCount: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 112 : 68,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  imageCountText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: FontSize.xs,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  imageBottom: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryPill: {
    backgroundColor: 'rgba(5,10,20,0.6)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,191,255,0.2)',
  },
  expandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(5,10,20,0.55)',
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,191,255,0.15)',
  },
});
