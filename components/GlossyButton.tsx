import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '@/context/ThemeContext';
import { Radius, FontSize, Shadow } from '@/constants/theme';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
};

export default function GlossyButton({
  title, onPress, loading = false, disabled = false,
  variant = 'primary', size = 'md', style, textStyle, fullWidth = false,
}: Props) {
  const Colors = useThemeColors();
  const heights = { sm: 40, md: 50, lg: 58 };
  const fontSizes = { sm: FontSize.sm, md: FontSize.md, lg: FontSize.lg };
  const isDisabled = disabled || loading;
  const fullW: ViewStyle = fullWidth ? { width: '100%' } : {};

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[styles.wrapper, fullW, isDisabled ? styles.disabled : {}, style]}
      >
        <LinearGradient
          colors={isDisabled ? [Colors.navy, Colors.backgroundSecondary] : ['#00BFFF', '#007ACC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, { height: heights[size] }, !isDisabled && Shadow.neonBlue]}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} size="small" />
            : <Text style={[{ color: Colors.white, fontWeight: '700', letterSpacing: 0.5, fontSize: fontSizes[size] }, textStyle]}>{title}</Text>
          }
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (variant === 'outline') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[{
          borderRadius: Radius.full,
          borderWidth: 1.5,
          borderColor: Colors.neonBlue,
          justifyContent: 'center' as const,
          alignItems: 'center' as const,
          paddingHorizontal: 24,
          backgroundColor: Colors.neonBlueGlow,
          height: heights[size],
        }, fullW, isDisabled ? styles.disabled : {}, style]}
      >
        {loading
          ? <ActivityIndicator color={Colors.neonBlue} size="small" />
          : <Text style={[{ color: Colors.neonBlue, fontWeight: '700', letterSpacing: 0.5, fontSize: fontSizes[size] }, textStyle]}>{title}</Text>
        }
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[{ height: heights[size], justifyContent: 'center' as const, alignItems: 'center' as const }, fullW, isDisabled ? styles.disabled : {}, style]}
    >
      {loading
        ? <ActivityIndicator color={Colors.neonBlue} size="small" />
        : <Text style={[{ color: Colors.neonBlue, fontWeight: '600', fontSize: fontSizes[size] }, textStyle]}>{title}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  gradient: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    borderRadius: Radius.full,
  },
  disabled: {
    opacity: 0.5,
  },
});
