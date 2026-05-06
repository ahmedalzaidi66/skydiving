import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Spacing } from '@/constants/theme';
import { useThemeColors } from '@/context/ThemeContext';
import { Category, getCategoryName } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { useUISize } from '@/context/UISizeContext';

type Props = {
  selected: string;
  onSelect: (id: string) => void;
  categories?: Category[];
};

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'canopies', label: 'Canopies' },
  { id: 'helmets', label: 'Helmets' },
  { id: 'altimeters', label: 'Altimeters' },
  { id: 'accessories', label: 'Accessories' },
];

export default function CategoryFilter({ selected, onSelect, categories }: Props) {
  const Colors = useThemeColors();
  const { language } = useLanguage();
  const { filterSizes } = useUISize();

  const items = categories && categories.length > 0
    ? [{ id: 'all', label: 'All' }, ...categories.map(c => ({ id: c.slug, label: getCategoryName(c, language) }))]
    : CATEGORIES;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {items.map((cat) => {
        const active = cat.id === selected;
        return (
          <TouchableOpacity
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            activeOpacity={0.8}
            style={[{
              backgroundColor: active ? Colors.neonBlueGlow : Colors.backgroundCard,
              borderWidth: 1,
              borderColor: active ? Colors.neonBlue : Colors.border,
              justifyContent: 'center' as const,
              alignItems: 'center' as const,
              height: filterSizes.buttonHeight,
              paddingHorizontal: filterSizes.paddingH,
              paddingVertical: filterSizes.paddingV,
              borderRadius: filterSizes.borderRadius,
            }]}
          >
            <Text style={{ color: active ? Colors.neonBlue : Colors.textSecondary, fontSize: filterSizes.fontSize, fontWeight: '600' }}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
