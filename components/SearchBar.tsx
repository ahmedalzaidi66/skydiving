import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { Radius, Spacing, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/context/ThemeContext';
import { useUISize } from '@/context/UISizeContext';
import { useLanguage } from '@/context/LanguageContext';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

export default function SearchBar({ value, onChangeText, placeholder }: Props) {
  const Colors = useThemeColors();
  const { searchSizes } = useUISize();
  const { t } = useLanguage();
  const resolvedPlaceholder = placeholder ?? t.searchGear;

  return (
    <View style={[{
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: Colors.backgroundInput,
      borderRadius: searchSizes.borderRadius,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
      gap: Spacing.sm,
      height: searchSizes.barHeight,
      marginTop: searchSizes.marginTop,
      marginBottom: searchSizes.marginBottom,
    }]}>
      <Search size={searchSizes.iconSize} color={Colors.textMuted} strokeWidth={2} />
      <TextInput
        style={{ flex: 1, color: Colors.textPrimary, fontSize: searchSizes.fontSize, padding: 0, margin: 0 }}
        value={value}
        onChangeText={onChangeText}
        placeholder={resolvedPlaceholder}
        placeholderTextColor={Colors.textMuted}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} activeOpacity={0.7}>
          <X size={searchSizes.iconSize - 2} color={Colors.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      )}
    </View>
  );
}
