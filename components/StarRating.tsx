import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

type Props = {
  rating: number;
  reviewCount?: number;
  size?: number;
  showCount?: boolean;
};

export default function StarRating({ rating, reviewCount, size = 14, showCount = true }: Props) {
  const Colors = useThemeColors();

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          color={star <= Math.round(rating) ? Colors.gold : Colors.textMuted}
          fill={star <= Math.round(rating) ? Colors.gold : 'transparent'}
          strokeWidth={1.5}
          style={{ marginRight: 1 }}
        />
      ))}
      <Text style={{ color: Colors.gold, fontWeight: '600', marginLeft: 4, fontSize: size - 1 }}>
        {rating.toFixed(1)}
      </Text>
      {showCount && reviewCount !== undefined && (
        <Text style={{ color: Colors.textMuted, marginLeft: 2, fontSize: size - 1 }}>
          ({reviewCount})
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
