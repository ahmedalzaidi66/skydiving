import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Radius } from '@/constants/theme';

const FALLBACK_IMAGE =
  'https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=800';

type Props = {
  heroContent: Record<string, any>;
};

export default function HeroVideo({ heroContent }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const heroHeight = isMobile ? 320 : 420;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  const mediaType: 'image' | 'video' = heroContent.media_type === 'video' ? 'video' : 'image';
  const videoUrl: string = heroContent.video_url || '';
  const imageUrl: string = heroContent.image_url || FALLBACK_IMAGE;

  const title: string = heroContent.title || '';
  const subtitle: string = heroContent.subtitle || '';
  const badgeText: string = heroContent.badge_text || '';
  const ctaText: string = heroContent.cta_primary || '';
  const overlayColor: string = heroContent.overlay_color || 'rgba(5,10,20,0.55)';

  const useVideo = mediaType === 'video' && videoUrl.length > 0 && !videoFailed;

  // Reset failed state when video URL changes
  useEffect(() => {
    setVideoFailed(false);
  }, [videoUrl]);

  // Attempt autoplay when video is used
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !useVideo) return;
    el.muted = true;
    el.play().catch(() => setVideoFailed(true));
  }, [useVideo, videoUrl]);

  return (
    <View style={[styles.hero, { height: heroHeight }]}>
      {/* ── Background media ───────────────────────────────────────────── */}
      {useVideo ? (
        // @ts-ignore — react-native-web passes unknown props to the underlying DOM element
        <video
          ref={videoRef}
          key={videoUrl}
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          onError={() => {
            console.warn('[HeroVideo.web] video failed to load:', videoUrl);
            setVideoFailed(true);
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <img
          src={imageUrl}
          alt="hero"
          onError={(e) => console.warn('[HeroVideo.web] image failed to load:', imageUrl)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* CMS-driven overlay */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} />

      {/* Cinematic gradient for text legibility */}
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.0)',
          'rgba(0,0,0,0.15)',
          'rgba(5,10,20,0.65)',
          'rgba(5,10,20,0.95)',
        ]}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Text content ───────────────────────────────────────────────── */}
      <View style={styles.heroContent}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeText.toUpperCase()}</Text>
        </View>

        <Text style={styles.heroTitle}>{title}</Text>

        {subtitle.length > 0 && (
          <Text style={styles.heroSubtitle}>{subtitle}</Text>
        )}

        <TouchableOpacity
          style={styles.heroCtaBtn}
          activeOpacity={0.82}
          onPress={() => router.push('/(tabs)/products' as any)}
        >
          <Text style={styles.heroCtaText}>{ctaText.toUpperCase()}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#020810',
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 28,
    alignItems: 'center',
  },
  badge: {
    borderWidth: 1,
    borderColor: 'rgba(0,191,255,0.45)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 14,
    backgroundColor: 'rgba(0,191,255,0.08)',
  },
  badgeText: {
    color: '#00BFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: 0.2,
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 12,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 18,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroCtaBtn: {
    backgroundColor: '#00BFFF',
    borderRadius: Radius.full,
    paddingHorizontal: 52,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.75,
    shadowRadius: 18,
    elevation: 10,
  },
  heroCtaText: {
    color: '#050A14',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 3,
  },
});
