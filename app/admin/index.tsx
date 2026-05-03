import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAdmin } from '@/context/AdminContext';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/theme';

export default function AdminIndex() {
  const router = useRouter();
  const { isAdminAuthenticated, isHydrated } = useAdmin();

  useEffect(() => {
    if (!isHydrated) return;
    if (isAdminAuthenticated) {
      router.replace('/admin/panel?tab=dashboard' as any);
    } else {
      router.replace('/admin/login');
    }
  }, [isHydrated, isAdminAuthenticated]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color={Colors.neonBlue} />
    </View>
  );
}
