import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAdmin } from '@/context/AdminContext';
import { Colors } from '@/constants/theme';

import DashboardScreenGuarded from '@/app/admin/dashboard';
import ProductsScreenGuarded from '@/app/admin/products';
import CategoriesScreenGuarded from '@/app/admin/categories';
import OrdersScreenGuarded from '@/app/admin/orders';
import CustomersScreenGuarded from '@/app/admin/customers';
import EmployeesScreenGuarded from '@/app/admin/employees';
import ReviewsScreenGuarded from '@/app/admin/reviews';
import CouponsScreenGuarded from '@/app/admin/coupons';
import ContentScreenGuarded from '@/app/admin/content';
import AdminAboutScreen from '@/app/admin/about';
import PageBuilderScreenGuarded from '@/app/admin/builder';
import LayoutAdminScreenGuarded from '@/app/admin/layout';
import UISizesScreenGuarded from '@/app/admin/sizes';
import SettingsScreenGuarded from '@/app/admin/settings';
import PermissionsScreenGuarded from '@/app/admin/permissions';
import MarketplaceScreenGuarded from '@/app/admin/marketplace';
import CampaignsScreenGuarded from '@/app/admin/campaigns';
import ShippingTaxScreen from '@/app/admin/shipping';
import AdminSectionsScreen from '@/app/admin/sections';
import GearReportsScreen from '@/app/admin/gear-reports';
import ActivityScreenGuarded from '@/app/admin/activity';

const TAB_SCREENS: Record<string, React.ComponentType> = {
  dashboard:   DashboardScreenGuarded,
  products:    ProductsScreenGuarded,
  categories:  CategoriesScreenGuarded,
  orders:      OrdersScreenGuarded,
  customers:   CustomersScreenGuarded,
  employees:   EmployeesScreenGuarded,
  reviews:     ReviewsScreenGuarded,
  coupons:     CouponsScreenGuarded,
  content:     ContentScreenGuarded,
  about:       AdminAboutScreen,
  builder:     PageBuilderScreenGuarded,
  layout:      LayoutAdminScreenGuarded,
  sizes:       UISizesScreenGuarded,
  settings:    SettingsScreenGuarded,
  permissions: PermissionsScreenGuarded,
  marketplace: MarketplaceScreenGuarded,
  campaigns:   CampaignsScreenGuarded,
  shipping:     ShippingTaxScreen,
  sections:     AdminSectionsScreen,
  'gear-reports': GearReportsScreen,
  activity:        ActivityScreenGuarded,
};

export default function AdminPanel() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { isHydrated } = useAdmin();

  if (!isHydrated) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.neonBlue} size="large" />
      </View>
    );
  }

  const activeTab = (tab as string) || 'dashboard';
  const Screen = TAB_SCREENS[activeTab] ?? DashboardScreenGuarded;

  return (
    <View style={styles.fill}>
      <Screen />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loader: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
