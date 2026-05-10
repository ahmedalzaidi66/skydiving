import React from 'react';
import { View } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import { AdminProvider } from '@/context/AdminContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { CMSProvider } from '@/context/CMSContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { LayoutProvider } from '@/context/LayoutContext';
import { UISizeProvider } from '@/context/UISizeContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { WishlistToastProvider } from '@/context/WishlistToastContext';
import { GearWishlistProvider } from '@/context/GearWishlistContext';
import WhatsAppButton from '@/components/WhatsAppButton';
import GlobalBackButton from '@/components/GlobalBackButton';

function AppShell() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');
  const { preset } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="product/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="checkout" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="marketplace/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="marketplace/create" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={preset === 'light' ? 'dark' : 'light'} />
      {!isAdmin && <WhatsAppButton />}
      {!isAdmin && <GlobalBackButton />}
    </View>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <LanguageProvider>
      <CMSProvider>
      <ThemeProvider>
      <LayoutProvider>
      <UISizeProvider>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <GearWishlistProvider>
            <WishlistToastProvider>
              <AdminProvider>
                <AppShell />
              </AdminProvider>
            </WishlistToastProvider>
            </GearWishlistProvider>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
      </UISizeProvider>
      </LayoutProvider>
      </ThemeProvider>
      </CMSProvider>
    </LanguageProvider>
  );
}
