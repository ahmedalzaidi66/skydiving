import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Radius } from '@/constants/theme';

const FALLBACK_IMAGE =
  'https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=800';

type Props = {
  heroContent: Record<string, any>;
};

// Native fallback: always image (expo-av not installed)
export default function HeroVideo({ heroContent }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const heroHeight = isMobile ? 252 : 380;

  const imageUrl: string = heroContent.image_url || FALLBACK_IMAGE;
  const title: string = heroContent.title || '';
  const subtitle: string = heroContent.subtitle || '';
  const badgeText: string = heroContent.badge_text || '';
  const ctaText: string = heroContent.cta_primary || '';
  const overlayColor: string = heroContent.overlay_color || 'rgba(5,10,20,0.55)';

  return (
    <View style={[styles.hero, { height: heroHeight }]}>
      <Image source={{ uri: imageUrl }} style={[StyleSheet.absoluteFill, styles.heroImage as any]} resizeMode="cover" />

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
  heroImage: {
    objectFit: 'cover',
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 20,
    alignItems: 'center',
  },
  badge: {
    borderWidth: 1,
    borderColor: 'rgba(0,191,255,0.45)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
    backgroundColor: 'rgba(0,191,255,0.08)',
  },
  badgeText: {
    color: '#00BFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: 0.2,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 12,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroCtaBtn: {
    backgroundColor: '#00BFFF',
    borderRadius: Radius.full,
    paddingHorizontal: 32,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.75,
    shadowRadius: 14,
    elevation: 10,
  },
  heroCtaText: {
    color: '#050A14',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
});
