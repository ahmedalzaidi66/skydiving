import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Animated,
  PanResponder,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Radius } from '@/constants/theme';

export type HeroSlide = {
  id: string;
  image_url: string;
  title: string;
  subtitle: string;
  badge: string;
  button_text: string;
  button_url: string;
  sort_order: number;
  is_active: boolean;
  overlay_color?: string;
};

type Props = {
  slides: HeroSlide[];
  /** Fallback single-slide content (from CMS) when no slides in DB */
  fallback?: Record<string, any>;
  autoPlayMs?: number;
};

const FALLBACK_IMAGE =
  'https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=1200';

const DEFAULT_OVERLAY = 'rgba(5,10,20,0.45)';
const AUTO_PLAY_MS = 4500;
const SWIPE_THRESHOLD = 50;

function resolveHref(url: string): string {
  if (!url || url.trim() === '') return '/(tabs)/products';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (!url.startsWith('/')) return '/' + url;
  return url;
}

function buildSlides(dbSlides: HeroSlide[], fallback?: Record<string, any>): HeroSlide[] {
  if (dbSlides.length > 0) return dbSlides;
  if (!fallback) return [];
  return [{
    id: '__fallback__',
    image_url: fallback.image_url || FALLBACK_IMAGE,
    title: fallback.title || '',
    subtitle: fallback.subtitle || '',
    badge: fallback.badge_text || '',
    button_text: fallback.cta_primary || 'Shop Now',
    button_url: '/(tabs)/products',
    sort_order: 0,
    is_active: true,
    overlay_color: fallback.overlay_color || DEFAULT_OVERLAY,
  }];
}

export default function HeroSlider({ slides, fallback, autoPlayMs = AUTO_PLAY_MS }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const heroHeight = isMobile ? 210 : 420;

  const normalised = buildSlides(slides, fallback);
  const count = normalised.length;

  const [activeIdx, setActiveIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAnimating = useRef(false);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (count <= 1) return;
    timerRef.current = setInterval(() => advance(1), autoPlayMs);
  }, [count, autoPlayMs]);

  // Crossfade to a new slide index
  const goTo = useCallback((idx: number) => {
    if (isAnimating.current || count === 0) return;
    const target = ((idx % count) + count) % count;
    isAnimating.current = true;
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start(() => { isAnimating.current = false; });
    setActiveIdx(target);
    resetTimer();
  }, [count, fadeAnim, resetTimer]);

  function advance(dir: 1 | -1) {
    setActiveIdx(i => {
      const next = ((i + dir) % count + count) % count;
      isAnimating.current = true;
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start(() => { isAnimating.current = false; });
      return next;
    });
  }

  // Auto-play
  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  // Guard index in range
  useEffect(() => {
    if (count > 0 && activeIdx >= count) setActiveIdx(0);
  }, [count, activeIdx]);

  // Swipe — native PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -SWIPE_THRESHOLD) { advance(1); resetTimer(); }
        else if (g.dx > SWIPE_THRESHOLD) { advance(-1); resetTimer(); }
      },
    }),
  ).current;

  if (count === 0) return null;

  const slide = normalised[Math.min(activeIdx, count - 1)];
  const overlayColor = slide.overlay_color || DEFAULT_OVERLAY;
  const showArrows = count > 1 && !isMobile;
  const showDots = count > 1;

  // Web swipe via pointer drag
  const webSwipeRef = useRef<number | null>(null);
  const handleWebPointerDown = (e: any) => { webSwipeRef.current = e.clientX; };
  const handleWebPointerUp = (e: any) => {
    if (webSwipeRef.current === null) return;
    const dx = e.clientX - webSwipeRef.current;
    webSwipeRef.current = null;
    if (dx < -SWIPE_THRESHOLD) { advance(1); resetTimer(); }
    else if (dx > SWIPE_THRESHOLD) { advance(-1); resetTimer(); }
  };

  return (
    <View
      style={[styles.root, { height: heroHeight }]}
      {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
      // @ts-ignore — web pointer events for swipe
      onPointerDown={Platform.OS === 'web' ? handleWebPointerDown : undefined}
      onPointerUp={Platform.OS === 'web' ? handleWebPointerUp : undefined}
    >
      {/* Background image — fades on transition */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        {Platform.OS === 'web' ? (
          // @ts-ignore
          <img
            src={slide.image_url || FALLBACK_IMAGE}
            alt={slide.title || 'hero'}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', userSelect: 'none' }}
            draggable={false}
          />
        ) : (
          <Image source={{ uri: slide.image_url || FALLBACK_IMAGE }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
      </Animated.View>

      {/* Per-slide dark overlay */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor, opacity: fadeAnim }]} />

      {/* Cinematic gradient — always present, fades with content */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.10)', 'rgba(5,10,20,0.60)', 'rgba(5,10,20,0.97)']}
        locations={[0, 0.28, 0.65, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Prev / Next arrows (desktop) */}
      {showArrows && (
        <>
          <TouchableOpacity
            style={[styles.arrow, styles.arrowLeft]}
            onPress={() => { advance(-1); resetTimer(); }}
            activeOpacity={0.8}
          >
            <ChevronLeft size={20} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.arrow, styles.arrowRight]}
            onPress={() => { advance(1); resetTimer(); }}
            activeOpacity={0.8}
          >
            <ChevronRight size={20} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </>
      )}

      {/* Slide content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]} pointerEvents="box-none">
        {slide.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{slide.badge.toUpperCase()}</Text>
          </View>
        ) : null}

        {slide.title ? (
          <Text style={[styles.title, isMobile && styles.titleMobile]} numberOfLines={3}>
            {slide.title}
          </Text>
        ) : null}

        {slide.subtitle ? (
          <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]} numberOfLines={2}>
            {slide.subtitle}
          </Text>
        ) : null}

        {slide.button_text ? (
          <TouchableOpacity
            style={styles.cta}
            activeOpacity={0.82}
            onPress={() => router.push(resolveHref(slide.button_url) as any)}
          >
            <Text style={styles.ctaText}>{slide.button_text.toUpperCase()}</Text>
          </TouchableOpacity>
        ) : null}
      </Animated.View>

      {/* Dot indicators */}
      {showDots && (
        <View style={styles.dots} pointerEvents="box-none">
          {normalised.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => goTo(i)}
              activeOpacity={0.8}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Animated.View style={[styles.dot, i === activeIdx && styles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Slide counter badge — mobile only */}
      {count > 1 && isMobile && (
        <View style={styles.counter} pointerEvents="none">
          <Text style={styles.counterText}>{activeIdx + 1}/{count}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#020810',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 44,
    alignItems: 'center',
  },
  badge: {
    borderWidth: 1,
    borderColor: 'rgba(0,191,255,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
    backgroundColor: 'rgba(0,191,255,0.12)',
  },
  badgeText: {
    color: '#00BFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 29,
    letterSpacing: 0.1,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 14,
  },
  titleMobile: {
    fontSize: 19,
    lineHeight: 24,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 17,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  subtitleMobile: {
    fontSize: 11,
  },
  cta: {
    backgroundColor: '#00BFFF',
    borderRadius: Radius.full,
    paddingHorizontal: 28,
    paddingVertical: 9,
    alignItems: 'center',
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.72,
    shadowRadius: 16,
    elevation: 10,
  },
  ctaText: {
    color: '#050A14',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  arrow: {
    position: 'absolute',
    top: '50%' as any,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(5,10,20,0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -19,
  },
  arrowLeft: { left: 14 },
  arrowRight: { right: 14 },
  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  dotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00BFFF',
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  counter: {
    position: 'absolute',
    top: 12,
    right: 14,
    backgroundColor: 'rgba(5,10,20,0.58)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  counterText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
