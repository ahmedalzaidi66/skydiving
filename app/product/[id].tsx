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
import { Colors, Spacing, FontSize, Radius, Shadow } from '@/constants/theme';

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
          <X size={22} color={Colors.white} strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={lb.counter}>
          <Text style={lb.counterText}>{current + 1} / {images.length}</Text>
        </View>
        {current > 0 && (
          <TouchableOpacity style={[lb.navBtn, lb.navLeft]} onPress={prev} activeOpacity={0.8}>
            <ChevronLeft size={28} color={Colors.white} strokeWidth={2.5} />
          </TouchableOpacity>
        )}
        {current < images.length - 1 && (
          <TouchableOpacity style={[lb.navBtn, lb.navRight]} onPress={next} activeOpacity={0.8}>
            <ChevronRight size={28} color={Colors.white} strokeWidth={2.5} />
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
  dotActive: { backgroundColor: Colors.neonBlue, width: 20, borderRadius: 3.5 },
  thumbScroll: { position: 'absolute', bottom: 24, left: 0, right: 0 },
  thumbRow: { paddingHorizontal: 16, gap: 8 },
  thumb: {
    width: 60, height: 60, borderRadius: Radius.sm,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', overflow: 'hidden',
  },
  thumbActive: { borderColor: Colors.neonBlue, borderWidth: 2 },
  thumbImg: { objectFit: 'cover' } as any,
});

// ── Skeleton loader ───────────────────────────────────────────────────────────

function SkeletonLine({ width: w = '80%', height = 16 }: { width?: any; height?: number }) {
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
        backgroundColor: Colors.backgroundCard, opacity: pulse,
      }}
    />
  );
}

// ── Product Detail Screen ─────────────────────────────────────────────────────

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addToCart, items } = useCart();
  const { t, language } = useLanguage();
  const { user } = useAuth();
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

    // Reset to initial state immediately for fast navigation feel
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

    // 8s timeout — prevents infinite skeleton on slow/hung connections
    const timeoutId = setTimeout(() => {
      if (thisFetch !== fetchId.current) return;
      console.warn('[product/[id]] fetch timed out after 8s');
      setFetchError('Request timed out. Please check your connection and try again.');
      setLoading(false);
    }, 8000);

    // Phase 1: Fetch main product — render as soon as it arrives
    fetchProductById(id, language)
      .then((data) => {
        if (thisFetch !== fetchId.current) return;
        clearTimeout(timeoutId);
        setProduct(data);
        setLoading(false);

        if (!data) return;

        // Phase 2: Lazy-load secondary data — each call is independent so a
        // failure in one does not block the others from resolving.
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

        // Related products disabled — use getRelatedProducts(data, language, 4) to re-enable
      })
      .catch((err: any) => {
        if (thisFetch !== fetchId.current) return;
        clearTimeout(timeoutId);
        const msg = err?.message ?? 'Failed to load product';
        console.error('[product/[id]] fetch error:', msg, err);
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

  const handleSubmitReview = async () => {
    if (reviewRating === 0) { setReviewError('Please select a star rating.'); return; }
    const name = reviewName.trim() || (user?.email?.split('@')[0] ?? 'Anonymous');
    if (reviewBody.trim().length < 10) { setReviewError('Review must be at least 10 characters.'); return; }
    setReviewError('');
    setReviewSubmitting(true);
    const { error } = await supabase.from('reviews').insert({
      product_id: id,
      user_id: user?.id ?? null,
      customer_name: name,
      customer_email: user?.email ?? '',
      rating: reviewRating,
      body: reviewBody.trim(),
      status: 'pending',
      review_type: 'product',
    });
    setReviewSubmitting(false);
    if (error) {
      setReviewError('Failed to submit review. Please try again.');
    } else {
      setReviewSubmitted(true);
      setReviewRating(0);
      setReviewBody('');
      setReviewName('');
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
      <View style={styles.container}>
        <View style={[styles.imageWrapper, { backgroundColor: Colors.backgroundCard }]} />
        <View style={styles.skeletonContent}>
          <SkeletonLine width="70%" height={28} />
          <SkeletonLine width="40%" height={18} />
          <SkeletonLine width="30%" height={36} />
          <View style={{ height: Spacing.md }} />
          <SkeletonLine width="100%" height={14} />
          <SkeletonLine width="90%" height={14} />
          <SkeletonLine width="75%" height={14} />
        </View>
      </View>
    );
  }

  if (fetchError || !product) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: Spacing.lg }]}>
        <Text style={{ color: Colors.error, fontSize: FontSize.md, fontWeight: '700', textAlign: 'center', marginBottom: Spacing.sm }}>
          {fetchError ?? 'Product not found'}
        </Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.75}>
          <Text style={{ color: Colors.neonBlue, fontSize: FontSize.sm, fontWeight: '700' }}>Go back</Text>
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

  const stockColor = stockStatus === 'in' ? Colors.success : stockStatus === 'low' ? Colors.warning : Colors.error;
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
    <View style={styles.container}>
      {lightboxIndex !== null && (
        <Lightbox images={images} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}

      {/* Share button — absolute top-left */}
      <TouchableOpacity
        style={styles.shareBtn}
        onPress={handleShare}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {shareCopied
          ? <Text style={styles.shareCopiedText}>Copied!</Text>
          : <Share2 size={18} color={Colors.white} strokeWidth={2} />
        }
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} bounces>
        {/* ── Hero image ── */}
        <View style={styles.imageWrapper}>
          <TouchableOpacity
            style={styles.imageContainer}
            onPress={() => images.length > 0 && setLightboxIndex(activeImageIndex)}
            activeOpacity={0.95}
          >
            <Image
              source={{ uri: activeImage }}
              style={[StyleSheet.absoluteFillObject, styles.image]}
              resizeMode="contain"
            />
            <LinearGradient
              colors={['rgba(5,10,20,0.5)', 'transparent', 'rgba(5,10,20,0.92)']}
              style={StyleSheet.absoluteFillObject}
            />
          </TouchableOpacity>

          <View style={styles.imageOverlay} pointerEvents="box-none">
            {/* Discount badge */}
            {hasDiscount && (
              <View style={styles.discountBadge}>
                <Tag size={10} color="#fff" strokeWidth={2.5} />
                <Text style={styles.discountBadgeText}>-{discountPct}%</Text>
              </View>
            )}

            {/* Product badge (e.g. "New", "Best Seller") */}
            {product.badge && !hasDiscount && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{product.badge}</Text>
              </View>
            )}

            {images.length > 1 && (
              <View style={styles.imageCount}>
                <Text style={styles.imageCountText}>{activeImageIndex + 1}/{images.length}</Text>
              </View>
            )}

            <View style={styles.imageBottom}>
              <View style={styles.categoryPill}>
                <Text style={styles.categoryTag}>{product.category.toUpperCase()}</Text>
              </View>
              {images.length > 0 && (
                <View style={styles.expandHint}>
                  <Zap size={10} color={Colors.textMuted} strokeWidth={2} />
                  <Text style={styles.expandHintText}>Tap to expand</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Thumbnail strip ── */}
        {images.length > 1 && (
          <View style={styles.thumbnailContainer}>
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailRow}
            >
              {images.map((img, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setActiveImageIndex(idx)}
                  activeOpacity={0.8}
                  style={[styles.thumbnail, idx === activeImageIndex && styles.thumbnailActive]}
                >
                  <Image
                    source={{ uri: img }}
                    style={[StyleSheet.absoluteFillObject, styles.thumbnailImage]}
                    resizeMode="cover"
                  />
                  {idx === activeImageIndex && <View style={styles.thumbnailActiveOverlay} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Main content ── */}
        <View style={styles.content}>
          {/* Name + wishlist */}
          <View style={styles.nameRow}>
            <Text style={[styles.name, { flex: 1 }]}>{getProductName(product, language)}</Text>
            <WishlistHeart product={product} size={20} variant="detail" />
          </View>

          {/* Rating */}
          <View style={styles.ratingRow}>
            <StarRating rating={product.rating} reviewCount={product.review_count} size={15} />
          </View>

          {/* Price block */}
          <View style={styles.priceBlock}>
            <View style={styles.priceRow}>
              <Text style={styles.price}>${product.price.toLocaleString()}</Text>
              {hasDiscount && (
                <Text style={styles.comparePrice}>${product.compare_price!.toLocaleString()}</Text>
              )}
            </View>
            {hasDiscount && (
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsText}>
                  You save ${(product.compare_price! - product.price).toLocaleString()} ({discountPct}% off)
                </Text>
              </View>
            )}
          </View>

          {/* Stock status */}
          <View style={[styles.stockRow, { marginBottom: Spacing.md }]}>
            <View style={[styles.stockDot, { backgroundColor: stockColor }]} />
            <Text style={[styles.stockText, { color: stockColor }]}>{stockLabel}</Text>
            {selectedColor && selectedColor.stock != null && (
              <Text style={styles.colorStockLabel}>· {selectedColor.name}</Text>
            )}
          </View>

          {product.sku && (
            <Text style={styles.sku}>{t.skuLabel}: {product.sku}</Text>
          )}

          {/* Trust badges */}
          <View style={styles.trustRow}>
            <TrustBadge icon={<Shield size={13} color={Colors.neonBlue} />} label={t.proTested} />
            <TrustBadge icon={<Package size={13} color={Colors.neonBlue} />} label={t.freeShipping} />
            <TrustBadge icon={<Star size={13} color={Colors.neonBlue} />} label={t.topRated} />
          </View>

          <View style={styles.divider} />

          {/* Description */}
          <Text style={styles.sectionTitle}>{t.description}</Text>
          <Text style={styles.description}>{getProductDescription(product, language)}</Text>

          {/* Specs */}
          {product.specifications && Object.keys(product.specifications).length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>{t.specifications}</Text>
              <View style={styles.specsTable}>
                {Object.entries(product.specifications).map(([key, val], i, arr) => (
                  <View
                    key={key}
                    style={[styles.specRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}
                  >
                    <Text style={styles.specKey}>{key}</Text>
                    <Text style={styles.specVal}>{String(val)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={styles.divider} />

          {/* In-cart banner */}
          {inCartQty > 0 && (
            <View style={styles.inCartBanner}>
              <ShoppingCart size={14} color={Colors.neonBlue} strokeWidth={2} />
              <Text style={styles.inCartText}>{inCartQty} {t.inCart}</Text>
            </View>
          )}

          {/* Stock warning */}
          {stockMsg !== '' && (
            <View style={styles.stockWarningBanner}>
              <Text style={styles.stockWarningText}>{stockMsg}</Text>
            </View>
          )}

          {/* Color picker */}
          {colorVariants.length > 0 && (
            <View style={styles.colorSection}>
              <View style={styles.colorLabelRow}>
                <Text style={styles.colorLabel}>{t.color ?? 'Color'}</Text>
                {selectedColor && (
                  <Text style={styles.colorSelectedName}>{selectedColor.name}</Text>
                )}
              </View>
              <View style={styles.colorSwatchRow}>
                {colorVariants.map((v) => {
                  const active = selectedColor?.id === v.id;
                  const colorOos = !product.unlimited_stock && v.stock != null && v.stock === 0;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: v.hex },
                        active && styles.colorSwatchActive,
                        colorOos && styles.colorSwatchOos,
                      ]}
                      onPress={() => !colorOos && setSelectedColor(v)}
                      activeOpacity={colorOos ? 1 : 0.8}
                    >
                      {active && <View style={styles.colorSwatchCheck} />}
                      {colorOos && <View style={styles.colorSwatchStrike} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Quantity */}
          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>{t.quantity}</Text>
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
        <View style={styles.reviewsSection}>
          <View style={styles.reviewsSectionHeader}>
            <View style={styles.relatedAccent} />
            <Text style={styles.relatedTitle}>Customer Reviews</Text>
            {product.review_count > 0 && (
              <View style={styles.reviewsCountBadge}>
                <Text style={styles.reviewsCountText}>{product.review_count}</Text>
              </View>
            )}
          </View>

          {approvedReviews.length > 0 && (
            <View style={styles.reviewsList}>
              {approvedReviews.map((rv) => (
                <View key={rv.id} style={styles.reviewCard}>
                  <View style={styles.reviewCardHeader}>
                    <View style={styles.reviewAvatar}>
                      <Text style={styles.reviewAvatarText}>{rv.customer_name?.[0]?.toUpperCase() ?? '?'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewAuthor}>{rv.customer_name}</Text>
                      <Text style={styles.reviewDate}>
                        {new Date(rv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={styles.reviewStars}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={12}
                          color={i < rv.rating ? Colors.gold : Colors.border}
                          fill={i < rv.rating ? Colors.gold : 'transparent'}
                          strokeWidth={1.5}
                        />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.reviewBodyText}>{rv.body}</Text>
                </View>
              ))}
            </View>
          )}

          {approvedReviews.length === 0 && (
            <Text style={styles.noReviewsText}>No reviews yet. Be the first to review this product.</Text>
          )}

          {/* Submit review form */}
          <View style={styles.reviewForm}>
            <Text style={styles.reviewFormTitle}>
              {reviewSubmitted ? 'Review Submitted!' : 'Write a Review'}
            </Text>
            {reviewSubmitted ? (
              <View style={styles.reviewSuccessBox}>
                <Text style={styles.reviewSuccessText}>
                  Thank you! Your review is pending admin approval and will appear once approved.
                </Text>
              </View>
            ) : (
              <>
                {/* Star picker */}
                <Text style={styles.reviewFieldLabel}>Rating *</Text>
                <View style={styles.reviewStarPicker}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => { setReviewRating(s); setReviewError(''); }}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Star
                        size={32}
                        color={s <= reviewRating ? Colors.gold : Colors.textMuted}
                        fill={s <= reviewRating ? Colors.gold : 'transparent'}
                        strokeWidth={1.5}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                {!user && (
                  <>
                    <Text style={styles.reviewFieldLabel}>Your Name</Text>
                    <TextInput
                      style={styles.reviewInput}
                      value={reviewName}
                      onChangeText={setReviewName}
                      placeholder="Enter your name"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </>
                )}

                <Text style={styles.reviewFieldLabel}>Review *</Text>
                <TextInput
                  style={[styles.reviewInput, styles.reviewTextArea]}
                  value={reviewBody}
                  onChangeText={setReviewBody}
                  placeholder="Share your experience with this product..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                {reviewError !== '' && (
                  <Text style={styles.reviewErrorText}>{reviewError}</Text>
                )}

                <TouchableOpacity
                  style={[styles.reviewSubmitBtn, reviewSubmitting && { opacity: 0.5 }]}
                  onPress={handleSubmitReview}
                  activeOpacity={0.8}
                  disabled={reviewSubmitting}
                >
                  {reviewSubmitting ? (
                    <ActivityIndicator size="small" color={Colors.background} />
                  ) : (
                    <Text style={styles.reviewSubmitBtnText}>Submit Review</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* ── Related products ── */}
        {related.length > 0 && (
          <View style={styles.relatedSection}>
            <View style={styles.relatedHeader}>
              <View style={styles.relatedTitleGroup}>
                <View style={styles.relatedAccent} />
                <Text style={styles.relatedTitle}>{t.youMayAlsoLike}</Text>
              </View>
              <TouchableOpacity
                style={styles.relatedSeeAll}
                onPress={() => router.push('/(tabs)/products' as any)}
                activeOpacity={0.7}
              >
                <Text style={styles.relatedSeeAllText}>{t.seeAll}</Text>
                <ChevronRight size={14} color={Colors.neonBlue} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.relatedScroll}
            >
              {related.map((item) => (
                <View key={item.id} style={styles.relatedCard}>
                  <ProductCard product={item} />
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* ── Sticky footer ── */}
      <View style={styles.footer}>
        {addedFeedback ? (
          <Animated.View style={[styles.successBanner, { opacity: successOpacity }]}>
            <View style={styles.successIconWrap}>
              <ShoppingCart size={18} color={Colors.success} strokeWidth={2} />
            </View>
            <View style={styles.successTextWrap}>
              <Text style={styles.successTitle}>{t.addedToCart}</Text>
              <Text style={styles.successSub}>
                {quantity} × {getProductName(product, language)}
              </Text>
            </View>
            <Text style={styles.successPrice}>
              ${(product.price * quantity).toLocaleString()}
            </Text>
          </Animated.View>
        ) : (
          <View style={styles.footerRow}>
            <View style={styles.footerPrice}>
              <Text style={styles.footerPriceLabel}>{t.total}</Text>
              <Text style={styles.footerPriceValue}>
                ${(product.price * quantity).toLocaleString()}
              </Text>
              {hasDiscount && (
                <Text style={styles.footerSavings}>
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

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.trustBadge}>
      {icon}
      <Text style={styles.trustLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  skeletonContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  imageWrapper: {
    width: '100%',
    height: IMAGE_HEIGHT,
    position: 'relative',
    backgroundColor: Colors.backgroundSecondary,
  },
  imageContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  image: {
    objectFit: 'contain',
    objectPosition: 'center',
  } as any,
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  shareBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 24,
    right: Spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(5,10,20,0.72)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    elevation: 8,
  },
  shareCopiedText: {
    color: Colors.neonBlue,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badge: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 30,
    right: Spacing.md,
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 15,
  },
  badgeText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  discountBadge: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 30,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.error,
    borderRadius: Radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 5,
    zIndex: 15,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  discountBadgeText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  imageCount: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 32,
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
  categoryTag: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
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
    borderColor: Colors.border,
  },
  expandHintText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  thumbnailContainer: {
    backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  thumbnailRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 8,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  thumbnailActive: {
    borderColor: Colors.neonBlue,
    borderWidth: 2,
    shadowColor: Colors.neonBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  thumbnailActiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.neonBlueGlow,
  },
  thumbnailImage: {
    objectFit: 'cover',
  } as any,
  content: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: 6,
  },
  name: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxl,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  ratingRow: {
    marginBottom: Spacing.md,
  },
  priceBlock: {
    marginBottom: Spacing.sm,
    gap: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  price: {
    color: Colors.neonBlue,
    fontSize: FontSize.xxl + 6,
    fontWeight: '900',
    letterSpacing: -1,
    ...Shadow.neonBlueSubtle,
  },
  comparePrice: {
    color: Colors.textMuted,
    fontSize: FontSize.lg,
    fontWeight: '500',
    textDecorationLine: 'line-through',
  },
  savingsBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.errorDim,
    borderRadius: Radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.error + '4D',
  },
  savingsText: {
    color: Colors.error,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  stockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stockText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  colorStockLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  sku: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  trustRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
  },
  trustLabel: {
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    lineHeight: 26,
  },
  specsTable: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.backgroundCard,
  },
  specRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
  },
  specKey: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  specVal: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '500',
    textAlign: 'right',
  },
  inCartBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
  },
  inCartText: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  stockWarningBanner: {
    backgroundColor: Colors.warning + '1A',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.warning + '4D',
  },
  stockWarningText: {
    color: Colors.warning,
    fontSize: FontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
  },
  colorSection: {
    gap: 10,
    marginBottom: Spacing.md,
  },
  colorLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  colorSelectedName: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  colorSwatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSwatchActive: {
    borderColor: Colors.white,
    borderWidth: 2.5,
    shadowColor: Colors.white,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 4,
  },
  colorSwatchCheck: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  colorSwatchOos: {
    opacity: 0.3,
  },
  colorSwatchStrike: {
    position: 'absolute',
    width: '130%' as any,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
    transform: [{ rotate: '45deg' }],
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.xs,
  },
  qtyLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  footer: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 34 : Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  footerPrice: {
    gap: 1,
    minWidth: 80,
  },
  footerPriceLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  footerPriceValue: {
    color: Colors.neonBlue,
    fontSize: FontSize.xl,
    fontWeight: '900',
    lineHeight: 26,
  },
  footerSavings: {
    color: Colors.error,
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginTop: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.successDim,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.success + '4D',
  },
  successIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.successDim,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.success + '59',
  },
  successTextWrap: {
    flex: 1,
    gap: 2,
  },
  successTitle: {
    color: Colors.success,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  successSub: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  successPrice: {
    color: Colors.success,
    fontSize: FontSize.lg,
    fontWeight: '900',
  },
  relatedSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  relatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  relatedTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  relatedAccent: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: Colors.neonBlue,
  },
  relatedTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  relatedSeeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  relatedSeeAllText: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  relatedScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  relatedCard: {
    width: 160,
  },
  reviewsSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  reviewsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  reviewsCountBadge: {
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 4,
  },
  reviewsCountText: {
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  reviewsList: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  reviewCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 8,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  reviewAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.neonBlue,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  reviewAvatarText: {
    color: Colors.background,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  reviewAuthor: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  reviewDate: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewBodyText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  noReviewsText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
  reviewForm: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  reviewFormTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '800',
    marginBottom: 4,
  },
  reviewSuccessBox: {
    backgroundColor: Colors.successDim,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.success + '40',
    padding: Spacing.md,
  },
  reviewSuccessText: {
    color: Colors.success,
    fontSize: FontSize.sm,
    fontWeight: '600',
    lineHeight: 20,
  },
  reviewFieldLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  reviewStarPicker: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  reviewTextArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  reviewErrorText: {
    color: Colors.error,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  reviewSubmitBtn: {
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.full,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  reviewSubmitBtnText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
});
