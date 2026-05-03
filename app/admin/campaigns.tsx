import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { Bell, Mail, MessageCircle, Users, User, Send, Clock, ChevronDown, ChevronUp, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Search, X } from 'lucide-react-native';
import { supabase, adminSupabase } from '@/lib/supabase';
import { useAdmin } from '@/context/AdminContext';
import { useLanguage } from '@/context/LanguageContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

type Campaign = {
  id: string;
  title: string;
  message: string;
  product_link: string | null;
  offer_code: string | null;
  audience: 'all' | 'single';
  channels: string[];
  status: string;
  sent_count: number;
  created_by: string;
  created_at: string;
};

type Customer = {
  id: string;
  email: string;
  name: string;
};

const CHANNELS = [
  { key: 'in_app',   label: 'In-App',   icon: Bell,          available: true  },
  { key: 'email',    label: 'Email',     icon: Mail,          available: false },
  { key: 'whatsapp', label: 'WhatsApp',  icon: MessageCircle, available: false },
] as const;

function CampaignsContent() {
  const { admin } = useAdmin();
  const { t } = useLanguage();

  // Compose form
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [productLink, setProductLink] = useState('');
  const [offerCode, setOfferCode] = useState('');
  const [audience, setAudience] = useState<'all' | 'single'>('all');
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set(['in_app']));
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState('');

  // Customer picker
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // State
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // History
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    setCampaigns((data ?? []) as Campaign[]);
    setLoadingHistory(false);
  };

  const fetchCustomers = useCallback(async (q: string) => {
    setLoadingCustomers(true);
    const { data } = await supabase
      .from('orders')
      .select('customer_email, customer_first_name, customer_last_name')
      .ilike('customer_email', `%${q}%`)
      .limit(20);

    // Deduplicate by email and resolve user_id
    const seen = new Set<string>();
    const rows: Customer[] = [];
    for (const row of (data ?? []) as any[]) {
      if (!seen.has(row.customer_email)) {
        seen.add(row.customer_email);
        rows.push({
          id: row.customer_email, // use email as surrogate until user_id resolved
          email: row.customer_email,
          name: `${row.customer_first_name ?? ''} ${row.customer_last_name ?? ''}`.trim() || row.customer_email,
        });
      }
    }

    // Try to resolve auth user IDs via used_gear_listings
    const resolvedRows = await Promise.all(
      rows.map(async (c) => {
        const { data: listing } = await supabase
          .from('used_gear_listings')
          .select('user_id')
          .eq('user_email', c.email)
          .limit(1)
          .maybeSingle();
        return { ...c, id: (listing as any)?.user_id ?? c.email };
      })
    );

    setCustomers(resolvedRows);
    setLoadingCustomers(false);
  }, []);

  useEffect(() => {
    if (audience === 'single') {
      fetchCustomers(customerSearch);
    }
  }, [audience, customerSearch]);

  const toggleChannel = (key: string) => {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const showFeedback = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  const doSend = async () => {
    if (!title.trim() || !message.trim()) {
      showFeedback(t.campaignFieldsRequired, true);
      return;
    }
    if (audience === 'single' && !targetUserId) {
      showFeedback(t.campaignSelectCustomer, true);
      return;
    }
    if (selectedChannels.size === 0) {
      showFeedback(t.campaignSelectChannel, true);
      return;
    }

    setSending(true);
    let sentCount = 0;
    const channels = Array.from(selectedChannels);

    try {
      if (selectedChannels.has('in_app')) {
        if (audience === 'all') {
          // Fetch all unique auth user IDs from used_gear_listings + orders cross-ref
          const { data: listingUsers } = await supabase
            .from('used_gear_listings')
            .select('user_id')
            .not('user_id', 'is', null);

          const userIds = Array.from(
            new Set((listingUsers ?? []).map((r: any) => r.user_id).filter(Boolean))
          ) as string[];

          if (userIds.length > 0) {
            const notifs = userIds.map((uid) => ({
              user_id: uid,
              type: 'order_update' as const,
              title: title.trim(),
              message: message.trim() + (offerCode ? `\n🎁 Code: ${offerCode}` : '') + (productLink ? `\n🔗 ${productLink}` : ''),
              metadata: {
                campaign: true,
                offer_code: offerCode || null,
                product_link: productLink || null,
              },
            }));
            await adminSupabase().from('notifications').insert(notifs);
            sentCount = userIds.length;
          }
        } else if (targetUserId && !targetUserId.includes('@')) {
          // Single user with real UUID
          await adminSupabase().from('notifications').insert({
            user_id: targetUserId,
            type: 'order_update' as const,
            title: title.trim(),
            message: message.trim() + (offerCode ? `\n🎁 Code: ${offerCode}` : '') + (productLink ? `\n🔗 ${productLink}` : ''),
            metadata: {
              campaign: true,
              offer_code: offerCode || null,
              product_link: productLink || null,
            },
          });
          sentCount = 1;
        }
      }

      // Save campaign record
      await adminSupabase().from('campaigns').insert({
        title: title.trim(),
        message: message.trim(),
        product_link: productLink.trim() || null,
        offer_code: offerCode.trim() || null,
        audience,
        target_user_id: audience === 'single' && targetUserId && !targetUserId.includes('@') ? targetUserId : null,
        channels,
        status: 'sent',
        sent_count: sentCount,
        created_by: admin?.name ?? 'Admin',
      });

      await fetchHistory();
      showFeedback(t.campaignSentSuccess);

      // Reset form
      setTitle('');
      setMessage('');
      setProductLink('');
      setOfferCode('');
      setAudience('all');
      setSelectedChannels(new Set(['in_app']));
      setTargetUserId(null);
      setTargetEmail('');
      setHistoryOpen(true);
    } catch {
      showFeedback(t.campaignSendFailed, true);
    }

    setSending(false);
  };

  const confirmSend = () => {
    if (audience === 'all') {
      if (Platform.OS === 'web') {
        if (window.confirm(t.campaignConfirmAll)) doSend();
      } else {
        Alert.alert(t.campaigns, t.campaignConfirmAll, [
          { text: t.cancel, style: 'cancel' },
          { text: t.send, style: 'destructive', onPress: doSend },
        ]);
      }
    } else {
      doSend();
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.email.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
      {/* ── Compose ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.newCampaign}</Text>

        {/* Audience */}
        <Text style={styles.fieldLabel}>{t.campaignAudience}</Text>
        <View style={styles.audienceRow}>
          <TouchableOpacity
            style={[styles.audienceBtn, audience === 'all' && styles.audienceBtnActive]}
            onPress={() => { setAudience('all'); setTargetUserId(null); setTargetEmail(''); }}
            activeOpacity={0.7}
          >
            <Users size={16} color={audience === 'all' ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />
            <Text style={[styles.audienceBtnText, audience === 'all' && styles.audienceBtnTextActive]}>
              {t.allCustomers}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.audienceBtn, audience === 'single' && styles.audienceBtnActive]}
            onPress={() => setAudience('single')}
            activeOpacity={0.7}
          >
            <User size={16} color={audience === 'single' ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />
            <Text style={[styles.audienceBtnText, audience === 'single' && styles.audienceBtnTextActive]}>
              {t.singleCustomer}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Customer picker */}
        {audience === 'single' && (
          <View style={styles.pickerWrap}>
            {targetUserId ? (
              <View style={styles.selectedCustomerRow}>
                <User size={14} color={Colors.neonBlue} strokeWidth={2} />
                <Text style={styles.selectedCustomerText} numberOfLines={1}>{targetEmail}</Text>
                <TouchableOpacity onPress={() => { setTargetUserId(null); setTargetEmail(''); }}>
                  <X size={14} color={Colors.textMuted} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.searchRow}>
                  <Search size={14} color={Colors.textMuted} strokeWidth={2} />
                  <TextInput
                    style={styles.searchInput}
                    value={customerSearch}
                    onChangeText={setCustomerSearch}
                    placeholder={t.searchCustomers}
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {loadingCustomers && <ActivityIndicator size="small" color={Colors.neonBlue} />}
                </View>
                {filteredCustomers.length > 0 && (
                  <View style={styles.customerList}>
                    {filteredCustomers.slice(0, 8).map((c) => (
                      <TouchableOpacity
                        key={c.email}
                        style={styles.customerRow}
                        onPress={() => { setTargetUserId(c.id); setTargetEmail(c.email); }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.customerName}>{c.name}</Text>
                        <Text style={styles.customerEmail}>{c.email}</Text>
                        {c.id.includes('@') && (
                          <Text style={styles.noUidNote}>{t.campaignNoUid}</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* Channels */}
        <Text style={styles.fieldLabel}>{t.campaignChannels}</Text>
        <View style={styles.channelsRow}>
          {CHANNELS.map((ch) => {
            const Icon = ch.icon;
            const active = selectedChannels.has(ch.key);
            return (
              <TouchableOpacity
                key={ch.key}
                style={[styles.channelBtn, active && styles.channelBtnActive, !ch.available && styles.channelBtnDisabled]}
                onPress={() => ch.available && toggleChannel(ch.key)}
                activeOpacity={ch.available ? 0.7 : 1}
              >
                <Icon size={16} color={active && ch.available ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />
                <View>
                  <Text style={[styles.channelLabel, active && ch.available && styles.channelLabelActive]}>
                    {ch.label}
                  </Text>
                  {!ch.available && (
                    <Text style={styles.channelUnavailable}>{t.providerNotConnected}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Title */}
        <Text style={styles.fieldLabel}>{t.campaignTitle} *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder={t.campaignTitlePlaceholder}
          placeholderTextColor={Colors.textMuted}
          maxLength={100}
        />

        {/* Message */}
        <Text style={styles.fieldLabel}>{t.campaignMessage} *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={message}
          onChangeText={setMessage}
          placeholder={t.campaignMessagePlaceholder}
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={500}
        />

        {/* Optional fields */}
        <Text style={styles.fieldLabel}>{t.campaignProductLink} ({t.optional})</Text>
        <TextInput
          style={styles.input}
          value={productLink}
          onChangeText={setProductLink}
          placeholder="https://..."
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          keyboardType="url"
        />

        <Text style={styles.fieldLabel}>{t.campaignOfferCode} ({t.optional})</Text>
        <TextInput
          style={styles.input}
          value={offerCode}
          onChangeText={setOfferCode}
          placeholder={t.campaignOfferCodePlaceholder}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="characters"
        />

        {/* Status messages */}
        {errorMsg !== '' && (
          <View style={styles.errorBanner}>
            <AlertCircle size={14} color={Colors.error} strokeWidth={2} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}
        {successMsg !== '' && (
          <View style={styles.successBanner}>
            <CheckCircle size={14} color={Colors.success} strokeWidth={2} />
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        )}

        {/* Send button */}
        <TouchableOpacity
          style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
          onPress={confirmSend}
          activeOpacity={0.8}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={Colors.background} />
          ) : (
            <>
              <Send size={18} color={Colors.background} strokeWidth={2.5} />
              <Text style={styles.sendBtnText}>
                {audience === 'all' ? t.sendToAll : t.sendToCustomer}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── History ── */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.historyHeader}
          onPress={() => setHistoryOpen((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={styles.historyHeaderLeft}>
            <Clock size={16} color={Colors.textSecondary} strokeWidth={2} />
            <Text style={styles.sectionTitle}>{t.campaignHistory}</Text>
            {campaigns.length > 0 && (
              <View style={styles.historyCountPill}>
                <Text style={styles.historyCountText}>{campaigns.length}</Text>
              </View>
            )}
          </View>
          {historyOpen ? (
            <ChevronUp size={16} color={Colors.textMuted} strokeWidth={2} />
          ) : (
            <ChevronDown size={16} color={Colors.textMuted} strokeWidth={2} />
          )}
        </TouchableOpacity>

        {historyOpen && (
          loadingHistory ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Colors.neonBlue} />
            </View>
          ) : campaigns.length === 0 ? (
            <Text style={styles.emptyText}>{t.noCampaignsYet}</Text>
          ) : (
            campaigns.map((c) => <CampaignHistoryRow key={c.id} campaign={c} />)
          )
        )}
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

function CampaignHistoryRow({ campaign }: { campaign: Campaign }) {
  const { t } = useLanguage();
  const channelIcons: Record<string, any> = { in_app: Bell, email: Mail, whatsapp: MessageCircle };

  return (
    <View style={styles.historyRow}>
      <View style={styles.historyRowTop}>
        <Text style={styles.historyTitle} numberOfLines={1}>{campaign.title}</Text>
        <View style={styles.historyMeta}>
          {campaign.channels.map((ch) => {
            const Icon = channelIcons[ch] ?? Bell;
            return <Icon key={ch} size={12} color={Colors.textMuted} strokeWidth={2} />;
          })}
          <View style={[styles.statusPill, { backgroundColor: Colors.success + '22' }]}>
            <Text style={[styles.statusPillText, { color: Colors.success }]}>{campaign.status}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.historyMsg} numberOfLines={2}>{campaign.message}</Text>
      <View style={styles.historyFooter}>
        <Text style={styles.historyFooterText}>
          {campaign.audience === 'all' ? t.allCustomers : t.singleCustomer}
          {' · '}
          {campaign.sent_count} {t.campaignDelivered}
          {campaign.offer_code ? ` · ${campaign.offer_code}` : ''}
        </Text>
        <Text style={styles.historyDate}>
          {new Date(campaign.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          })}
        </Text>
      </View>
    </View>
  );
}

function CampaignsScreen() {
  const { t } = useLanguage();
  const { isMobile } = useAdminLayout();

  if (isMobile) {
    return (
      <AdminMobileDashboard title={t.campaigns} showBack>
        <CampaignsContent />
      </AdminMobileDashboard>
    );
  }

  return (
    <AdminWebDashboard title={t.campaigns}>
      <CampaignsContent />
    </AdminWebDashboard>
  );
}

export default function CampaignsScreenGuarded() {
  return (
    <AdminGuard permission="manage_customers">
      <CampaignsScreen />
    </AdminGuard>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '800',
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: Spacing.sm,
  },
  audienceRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  audienceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
  },
  audienceBtnActive: {
    borderColor: Colors.neonBlueBorder,
    backgroundColor: Colors.neonBlueGlow,
  },
  audienceBtnText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  audienceBtnTextActive: {
    color: Colors.neonBlue,
  },
  pickerWrap: {
    marginBottom: Spacing.sm,
  },
  selectedCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
  },
  selectedCustomerText: {
    flex: 1,
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    padding: 0,
  },
  customerList: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    overflow: 'hidden',
  },
  customerRow: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  customerName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  customerEmail: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  noUidNote: {
    color: Colors.warning,
    fontSize: 10,
    marginTop: 2,
  },
  channelsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    flexWrap: 'wrap',
  },
  channelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
    flex: 1,
    minWidth: 100,
  },
  channelBtnActive: {
    borderColor: Colors.neonBlueBorder,
    backgroundColor: Colors.neonBlueGlow,
  },
  channelBtnDisabled: {
    opacity: 0.55,
  },
  channelLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  channelLabelActive: {
    color: Colors.neonBlue,
  },
  channelUnavailable: {
    color: Colors.warning,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  input: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    marginBottom: 4,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 11,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.error + '18',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.error + '44',
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  errorText: {
    flex: 1,
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.success + '18',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.success + '44',
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  successText: {
    flex: 1,
    color: Colors.success,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.full,
    paddingVertical: 15,
    marginTop: Spacing.md,
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  sendBtnText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  // History
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  historyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyCountPill: {
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
  },
  historyCountText: {
    color: Colors.neonBlue,
    fontSize: 10,
    fontWeight: '800',
  },
  historyRow: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    gap: 4,
  },
  historyRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusPill: {
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  historyMsg: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    lineHeight: 17,
  },
  historyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  historyFooterText: {
    color: Colors.textMuted,
    fontSize: 10,
  },
  historyDate: {
    color: Colors.textMuted,
    fontSize: 10,
  },
  centered: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
