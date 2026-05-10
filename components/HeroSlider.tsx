import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Animated,
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
};

type Props = {
  slides: HeroSlide[];
  /** Fallback single-slide content (from CMS) when no slides in DB */
  fallback?: Record<string, any>;
  autoPlayMs?: number;
};

const FALLBACK_IMAGE =
  'https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=800';

const AUTO_PLAY_MS = 5000;

// Normalise a button_url value to an expo-router path
function resolveHref(url: string): string {
  if (!url || url.trim() === '') return '/(tabs)/products';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (!url.startsWith('/')) return '/' + url;
  return url;
}

// Build a normalised slide array from the DB rows; fall back to CMS content.
function buildSlides(
  dbSlides: HeroSlide[],
  fallback?: Record<string, any>,
): HeroSlide[] {
  if (dbSlides.length > 0) return dbSlides;
  if (!fallback) return [];
  return [
    {
      id: '__fallback__',
      image_url: fallback.image_url || FALLBACK_IMAGE,
      title: fallback.title || '',
      subtitle: fallback.subtitle || '',
      badge: fallback.badge_text || '',
      button_text: fallback.cta_primary || 'Shop Now',
      button_url: '/(tabs)/products',
      sort_order: 0,
      is_active: true,
    },
  ];
}

export default function HeroSlider({ slides, fallback, autoPlayMs = AUTO_PLAY_MS }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const heroHeight = isMobile ? 200 : 400;

  const normalised = buildSlides(slides, fallback);
  const [activeIdx, setActiveIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fade animation for slide transitions
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goTo = useCallback(
    (idx: number, direction: 'next' | 'prev' = 'next') => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
      setActiveIdx(idx);
    },
    [fadeAnim],
  );

  const next = useCallback(() => {
    const nextIdx = (activeIdx + 1) % normalised.length;
    goTo(nextIdx, 'next');
  }, [activeIdx, normalised.length, goTo]);

  const prev = useCallback(() => {
    const prevIdx = (activeIdx - 1 + normalised.length) % normalised.length;
    goTo(prevIdx, 'prev');
  }, [activeIdx, normalised.length, goTo]);

  // Auto-play
  useEffect(() => {
    if (normalised.length <= 1) return;
    timerRef.current = setInterval(() => {
      setActiveIdx((i) => {
        const next = (i + 1) % normalised.length;
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
          Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
        return next;
      });
    }, autoPlayMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [normalised.length, autoPlayMs, fadeAnim]);

  // Reset index if slides change (e.g. after admin edit)
  useEffect(() => {
    if (activeIdx >= normalised.length) setActiveIdx(0);
  }, [normalised.length, activeIdx]);

  if (normalised.length === 0) return null;

  const slide = normalised[Math.min(activeIdx, normalised.length - 1)];
  const showArrows = normalised.length > 1 && !isMobile;
  const showDots = normalised.length > 1;

  return (
    <View style={[styles.root, { height: heroHeight }]}>
      {/* Background image with fade */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        {Platform.OS === 'web' ? (
          // @ts-ignore — web img element
          <img
            src={slide.image_url || FALLBACK_IMAGE}
            alt={slide.title}
            style={{
              position: 'absolute',
              top: 0, left: 0, width: '100%', height: '100%',
              objectFit: 'cover',
              pointerEvents: 'none',
            }}
          />
        ) : (
          <Image
            source={{ uri: slide.image_url || FALLBACK_IMAGE }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        )}
      </Animated.View>

      {/* Dark overlay */}
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

      {/* Cinematic gradient */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.12)', 'rgba(5,10,20,0.62)', 'rgba(5,10,20,0.96)']}
        locations={[0, 0.3, 0.68, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Left / Right arrows */}
      {showArrows && (
        <>
          <TouchableOpacity style={[styles.arrow, styles.arrowLeft]} onPress={prev} activeOpacity={0.8}>
            <ChevronLeft size={20} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.arrow, styles.arrowRight]} onPress={next} activeOpacity={0.8}>
            <ChevronRight size={20} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </>
      )}

      {/* Slide content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
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
          <Text style={styles.subtitle} numberOfLines={2}>
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
        <View style={styles.dots}>
          {normalised.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => goTo(i)}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={[styles.dot, i === activeIdx && styles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Slide counter (mobile) */}
      {normalised.length > 1 && isMobile && (
        <View style={styles.counter}>
          <Text style={styles.counterText}>{activeIdx + 1} / {normalised.length}</Text>
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
  overlay: {
    backgroundColor: 'rgba(5,10,20,0.30)',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 40, // leaves room above dots
    alignItems: 'center',
  },
  badge: {
    borderWidth: 1,
    borderColor: 'rgba(0,191,255,0.50)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 7,
    backgroundColor: 'rgba(0,191,255,0.10)',
  },
  badgeText: {
    color: '#00BFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 27,
    letterSpacing: 0.2,
    marginBottom: 5,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 12,
  },
  titleMobile: {
    fontSize: 18,
    lineHeight: 23,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    lineHeight: 16,
  },
  cta: {
    backgroundColor: '#00BFFF',
    borderRadius: Radius.full,
    paddingHorizontal: 26,
    paddingVertical: 8,
    alignItems: 'center',
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.70,
    shadowRadius: 14,
    elevation: 10,
  },
  ctaText: {
    color: '#050A14',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  // Arrows
  arrow: {
    position: 'absolute',
    top: '50%',
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(5,10,20,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -18,
  },
  arrowLeft: { left: 12 },
  arrowRight: { right: 12 },
  // Dots
  dots: {
    position: 'absolute',
    bottom: 10,
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
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00BFFF',
  },
  // Counter (mobile only)
  counter: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: 'rgba(5,10,20,0.60)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  counterText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 9,
    fontWeight: '700',
  },
});
