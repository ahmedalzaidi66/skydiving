import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  TriangleAlert as AlertTriangle,
  CircleCheck,
  Camera,
  X,
  Plus,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { validateImageFile } from '@/lib/imageUpload';
import GlossyButton from '@/components/GlossyButton';
import { Spacing, FontSize, Radius } from '@/constants/theme';
import { useThemeColors } from '@/context/ThemeContext';
import { UsedGearListing } from '@/app/(tabs)/marketplace';

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'] as const;
type Condition = typeof CONDITIONS[number];

const CATEGORIES = [
  'complete_rig', 'parachute_rig', 'helmet', 'suit',
  'altimeter', 'aad', 'accessories', 'other',
] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_LABELS: Record<Category, string> = {
  complete_rig: 'Complete Rig',
  parachute_rig: 'Parachute / Rig',
  helmet: 'Helmet',
  suit: 'Suit',
  altimeter: 'Altimeter',
  aad: 'AAD',
  accessories: 'Accessories',
  other: 'Other',
};

const RIG_CATEGORIES: Category[] = ['complete_rig', 'parachute_rig'];

type ImageEntry = { uri: string; file?: File; isUrl?: boolean };

type FormState = {
  title: string;
  category: Category;
  condition: Condition;
  make: string; model: string; color: string; size: string;
  dom: string; serial_number: string; total_jumps: string;
  location: string; shipping_included: boolean;
  price: string; description: string; contact: string;
  main_make: string; main_model: string; main_size: string;
  main_dom: string; main_jumps: string; main_serial: string;
  reserve_make: string; reserve_model: string; reserve_size: string;
  reserve_dom: string; reserve_repacks: string; reserve_serial: string;
  aad_make: string; aad_model: string; aad_dom: string;
  aad_eol: string; aad_jumps: string; aad_needs_service: boolean; aad_serial: string;
  imageUrlFallback: string;
};

type FormErrors = Partial<Record<keyof FormState | 'submit' | 'load', string>>;

function listingToForm(l: UsedGearListing): FormState {
  return {
    title: l.title ?? '',
    category: (l.category as Category) ?? 'complete_rig',
    condition: (l.condition as Condition) ?? 'good',
    make: l.make ?? '',
    model: l.model ?? '',
    color: l.color ?? '',
    size: l.size ?? '',
    dom: l.dom ?? '',
    serial_number: l.serial_number ?? '',
    total_jumps: l.total_jumps != null ? String(l.total_jumps) : '',
    location: l.location ?? '',
    shipping_included: l.shipping_included ?? false,
    price: String(l.price ?? ''),
    description: l.description ?? '',
    contact: l.contact ?? '',
    main_make: l.main_make ?? '',
    main_model: l.main_model ?? '',
    main_size: l.main_size ?? '',
    main_dom: l.main_dom ?? '',
    main_jumps: l.main_jumps != null ? String(l.main_jumps) : '',
    main_serial: l.main_serial ?? '',
    reserve_make: l.reserve_make ?? '',
    reserve_model: l.reserve_model ?? '',
    reserve_size: l.reserve_size ?? '',
    reserve_dom: l.reserve_dom ?? '',
    reserve_repacks: l.reserve_repacks != null ? String(l.reserve_repacks) : '',
    reserve_serial: l.reserve_serial ?? '',
    aad_make: l.aad_make ?? '',
    aad_model: l.aad_model ?? '',
    aad_dom: l.aad_dom ?? '',
    aad_eol: l.aad_eol ?? '',
    aad_jumps: l.aad_jumps != null ? String(l.aad_jumps) : '',
    aad_needs_service: l.aad_needs_service ?? false,
    aad_serial: l.aad_serial ?? '',
    imageUrlFallback: '',
  };
}

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const C = useThemeColors();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<FormState | null>(null);
  const [originalStatus, setOriginalStatus] = useState<string>('');
  const [originalAdminNote, setOriginalAdminNote] = useState<string>('');
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('used_gear_listings')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setErrors({ load: 'Listing not found.' });
          setLoading(false);
          return;
        }
        const l = data as UsedGearListing;
        if (l.status === 'sold') {
          setErrors({ load: 'Sold listings cannot be edited.' });
          setLoading(false);
          return;
        }
        if (l.user_id !== user?.id) {
          setErrors({ load: 'You can only edit your own listings.' });
          setLoading(false);
          return;
        }
        setForm(listingToForm(l));
        setOriginalStatus(l.status);
        setOriginalAdminNote(l.admin_note ?? '');
        setImages((l.images ?? []).map((uri) => ({ uri, isUrl: true })));
        setLoading(false);
      });
  }, [id, user?.id]);

  if (!isAuthenticated) {
    return (
      <View style={[s.container, { backgroundColor: C.background }]}>
        <View style={[s.header, { backgroundColor: C.background, borderBottomColor: C.border }]}>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: C.navy, borderColor: C.neonBlueBorder }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color={C.textPrimary} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: C.textPrimary }]}>Edit Listing</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={s.centeredState}>
          <AlertTriangle size={48} color={C.warning} strokeWidth={1.5} />
          <Text style={[s.stateTitle, { color: C.textPrimary }]}>Sign in required</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: C.background }]}>
        <View style={s.centeredState}>
          <ActivityIndicator color={C.neonBlue} size="large" />
        </View>
      </View>
    );
  }

  if (errors.load || !form) {
    return (
      <View style={[s.container, { backgroundColor: C.background }]}>
        <View style={[s.header, { backgroundColor: C.background, borderBottomColor: C.border }]}>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: C.navy, borderColor: C.neonBlueBorder }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color={C.textPrimary} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: C.textPrimary }]}>Edit Listing</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={s.centeredState}>
          <AlertTriangle size={48} color={C.warning} strokeWidth={1.5} />
          <Text style={[s.stateTitle, { color: C.textPrimary }]}>{errors.load ?? 'Error loading listing'}</Text>
          <TouchableOpacity
            style={[s.backLink, { backgroundColor: C.neonBlueGlow, borderColor: C.neonBlueBorder }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={[s.backLinkText, { color: C.neonBlue }]}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (success) {
    return (
      <View style={[s.container, { backgroundColor: C.background }]}>
        <View style={s.centeredState}>
          <CircleCheck size={72} color={C.success} strokeWidth={1.5} />
          <Text style={[s.stateTitle, { color: C.textPrimary }]}>Listing updated!</Text>
          <TouchableOpacity
            style={[s.backLink, { backgroundColor: C.neonBlueGlow, borderColor: C.neonBlueBorder }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={[s.backLinkText, { color: C.neonBlue }]}>Back to profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isRig = RIG_CATEGORIES.includes(form.category as Category);

  const setField = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((f) => f ? { ...f, [key]: val } : f);
    if (errors[key as keyof FormErrors]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const condLabel = (c: Condition) => {
    const map: Record<Condition, string> = {
      new: 'New', like_new: 'Like New', good: 'Good', fair: 'Fair', poor: 'Poor',
    };
    return map[c];
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.title.trim() || form.title.trim().length < 3) e.title = 'Required';
    if (!form.price.trim() || isNaN(Number(form.price)) || Number(form.price) < 0)
      e.price = 'Enter a valid price';
    if (!form.contact.trim()) e.contact = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const pickImage = () => {
    if (Platform.OS === 'web') {
      if (!fileInputRef.current) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = handleFileChange;
        fileInputRef.current = input;
      }
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    setUploadingImg(true);
    const entries: ImageEntry[] = [];
    for (const file of Array.from(input.files)) {
      const err = validateImageFile(file);
      if (err) continue;
      entries.push({ uri: URL.createObjectURL(file), file });
    }
    setImages((prev) => [...prev, ...entries]);
    setUploadingImg(false);
    input.value = '';
  };

  const addUrlImage = () => {
    const url = form.imageUrlFallback.trim();
    if (url.startsWith('http')) {
      setImages((prev) => [...prev, { uri: url, isUrl: true }]);
      setField('imageUrlFallback', '');
    }
  };

  const removeImage = (idx: number) => setImages((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!validate() || !form) return;
    setSaving(true);

    const { data: { user: sessionUser }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !sessionUser) {
      setErrors({ submit: `Not authenticated: ${userErr?.message ?? 'please sign in again'}` });
      setSaving(false);
      return;
    }

    const imageUrls: string[] = [];
    for (const img of images) {
      if (img.isUrl && img.uri.startsWith('http')) {
        imageUrls.push(img.uri);
        continue;
      }
      if (!img.file) continue;
      const ext = img.file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `gear/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('uploads')
        .upload(path, img.file, { contentType: img.file.type, upsert: false });
      if (uploadErr) {
        console.error('[EditListing] storage upload failed:', uploadErr.message, uploadErr);
        setErrors({ submit: `Image upload failed: ${uploadErr.message}` });
        setSaving(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
      console.log('[EditListing] uploaded image:', urlData.publicUrl);
      imageUrls.push(urlData.publicUrl);
    }

    console.log('[EditListing] imageUrls before update:', imageUrls);

    const payload = {
      title: form.title.trim().slice(0, 120),
      category: form.category,
      condition: form.condition,
      make: form.make.trim(),
      model: form.model.trim(),
      color: form.color.trim(),
      size: form.size.trim(),
      dom: form.dom.trim(),
      serial_number: form.serial_number.trim(),
      total_jumps: form.total_jumps !== '' ? Number(form.total_jumps) : null,
      location: form.location.trim(),
      shipping_included: form.shipping_included,
      price: Number(form.price),
      description: form.description.trim(),
      contact: form.contact.trim(),
      main_image_url: imageUrls[0] ?? null,
      images: imageUrls,
      status: 'pending',
      admin_note: '',
      updated_at: new Date().toISOString(),
      main_make: form.main_make.trim(),
      main_model: form.main_model.trim(),
      main_size: form.main_size.trim(),
      main_dom: form.main_dom.trim(),
      main_jumps: form.main_jumps !== '' ? Number(form.main_jumps) : null,
      main_serial: form.main_serial.trim(),
      reserve_make: form.reserve_make.trim(),
      reserve_model: form.reserve_model.trim(),
      reserve_size: form.reserve_size.trim(),
      reserve_dom: form.reserve_dom.trim(),
      reserve_repacks: form.reserve_repacks !== '' ? Number(form.reserve_repacks) : null,
      reserve_serial: form.reserve_serial.trim(),
      aad_make: form.aad_make.trim(),
      aad_model: form.aad_model.trim(),
      aad_dom: form.aad_dom.trim(),
      aad_eol: form.aad_eol.trim(),
      aad_jumps: form.aad_jumps !== '' ? Number(form.aad_jumps) : null,
      aad_needs_service: form.aad_needs_service,
      aad_serial: form.aad_serial.trim(),
    };

    const { error } = await supabase
      .from('used_gear_listings')
      .update({ ...payload, main_image_url: imageUrls[0] ?? null, images: imageUrls })
      .eq('id', id)
      .eq('user_id', sessionUser.id);

    setSaving(false);
    if (!error) {
      setSuccess(true);
    } else {
      console.error('[EditListing] save failed', {
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
      });
      setErrors({ submit: `Save failed: ${error.message}${(error as any).hint ? ` — ${(error as any).hint}` : ''}` });
    }
  };

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: C.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[s.header, { backgroundColor: C.background, borderBottomColor: C.border }]}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: C.navy, borderColor: C.neonBlueBorder }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={22} color={C.textPrimary} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: C.textPrimary }]}>Edit Listing</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {originalStatus === 'rejected' && !!originalAdminNote ? (
          <View style={[s.rejectionBanner, { backgroundColor: C.errorDim, borderColor: C.error }]}>
            <AlertTriangle size={13} color={C.error} strokeWidth={2} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[s.rejectionBannerTitle, { color: C.error }]}>Rejected — reason from admin:</Text>
              <Text style={[s.rejectionBannerNote, { color: C.textPrimary }]}>{originalAdminNote}</Text>
              <Text style={[s.rejectionBannerHint, { color: C.textMuted }]}>Fix the issue above and save to resubmit for review.</Text>
            </View>
          </View>
        ) : (
          <View style={[s.pendingBadge, { backgroundColor: 'rgba(255,179,0,0.08)', borderColor: 'rgba(255,179,0,0.25)' }]}>
            <AlertTriangle size={13} color={C.warning} strokeWidth={2} />
            <Text style={[s.pendingBadgeText, { color: C.warning }]}>
              {originalStatus === 'approved'
                ? 'Editing will hide this listing until admin re-approves it.'
                : 'Pending review — you can still edit this listing'}
            </Text>
          </View>
        )}

        {/* ── Photos ── */}
        <SectionCard title="Photos" C={C}>
          <View style={s.imageGrid}>
            {images.map((img, idx) => (
              <View key={idx} style={[s.imgThumbWrap, { borderColor: C.border }]}>
                <Image source={{ uri: img.uri }} style={s.imgThumb} resizeMode="cover" />
                {idx === 0 && (
                  <View style={s.mainBadge}>
                    <Text style={s.mainBadgeText}>Main</Text>
                  </View>
                )}
                <TouchableOpacity style={s.imgRemoveBtn} onPress={() => removeImage(idx)} activeOpacity={0.8}>
                  <X size={14} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[s.addImgBtn, { backgroundColor: C.neonBlueGlow, borderColor: C.neonBlueBorder }]}
              onPress={pickImage}
              activeOpacity={0.75}
            >
              {uploadingImg ? (
                <ActivityIndicator size="small" color={C.neonBlue} />
              ) : (
                <>
                  <Camera size={22} color={C.neonBlue} strokeWidth={2} />
                  <Text style={[s.addImgText, { color: C.neonBlue }]}>Add Photo</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          <View style={{ gap: 6, marginTop: Spacing.sm }}>
            <Text style={[s.fieldLabel, { color: C.textMuted }]}>Image URL (optional)</Text>
            <View style={s.urlRow}>
              <TextInput
                style={[s.input, { flex: 1, backgroundColor: C.backgroundInput, borderColor: C.border, color: C.textPrimary }]}
                value={form.imageUrlFallback}
                onChangeText={(v) => setField('imageUrlFallback', v)}
                placeholder="https://..."
                placeholderTextColor={C.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[s.urlAddBtn, { backgroundColor: C.neonBlueGlow, borderColor: C.neonBlueBorder }]}
                onPress={addUrlImage}
                activeOpacity={0.8}
              >
                <Plus size={18} color={C.neonBlue} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>
        </SectionCard>

        {/* ── Listing Details ── */}
        <SectionCard title="Listing Details" C={C}>
          <Field label="Title *" value={form.title} onChange={(v) => setField('title', v)} error={errors.title} placeholder="e.g. Javelin J4K Complete Rig" C={C} />

          <View style={s.fieldWrap}>
            <Text style={[s.fieldLabel, { color: C.textMuted }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    s.pill,
                    { backgroundColor: C.backgroundCard, borderColor: C.border },
                    form.category === cat && { backgroundColor: C.neonBlueGlow, borderColor: C.neonBlueBorder },
                  ]}
                  onPress={() => setField('category', cat)}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    s.pillText,
                    { color: C.textMuted },
                    form.category === cat && { color: C.neonBlue, fontWeight: '700' },
                  ]}>
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={s.fieldWrap}>
            <Text style={[s.fieldLabel, { color: C.textMuted }]}>Condition</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
              {CONDITIONS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    s.pill,
                    { backgroundColor: C.backgroundCard, borderColor: C.border },
                    form.condition === c && { backgroundColor: C.neonBlueGlow, borderColor: C.neonBlueBorder },
                  ]}
                  onPress={() => setField('condition', c)}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    s.pillText,
                    { color: C.textMuted },
                    form.condition === c && { color: C.neonBlue, fontWeight: '700' },
                  ]}>
                    {condLabel(c)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Field label="Price (USD) *" value={form.price} onChange={(v) => setField('price', v)} error={errors.price} placeholder="0" keyboardType="numeric" C={C} />
            </View>
            <View style={s.toggleWrap}>
              <Text style={[s.fieldLabel, { color: C.textMuted }]}>Shipping Included</Text>
              <TouchableOpacity
                style={[
                  s.toggleBtn,
                  { backgroundColor: C.backgroundInput, borderColor: C.border },
                  form.shipping_included && { backgroundColor: C.neonBlueGlow, borderColor: C.neonBlueBorder },
                ]}
                onPress={() => setField('shipping_included', !form.shipping_included)}
                activeOpacity={0.8}
              >
                <Text style={[
                  s.toggleBtnText,
                  { color: C.textMuted },
                  form.shipping_included && { color: C.neonBlue },
                ]}>
                  {form.shipping_included ? 'Yes' : 'No'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <Field label="Location" value={form.location} onChange={(v) => setField('location', v)} placeholder="e.g. Perris, CA" C={C} />
        </SectionCard>

        {/* ── Equipment Details ── */}
        <SectionCard title="Equipment Details" C={C}>
          <View style={s.row}>
            <View style={{ flex: 1 }}><Field label="Make / Brand" value={form.make} onChange={(v) => setField('make', v)} placeholder="e.g. Sunpath" C={C} /></View>
            <View style={{ flex: 1 }}><Field label="Model" value={form.model} onChange={(v) => setField('model', v)} placeholder="e.g. Javelin" C={C} /></View>
          </View>
          <View style={s.row}>
            <View style={{ flex: 1 }}><Field label="Size" value={form.size} onChange={(v) => setField('size', v)} placeholder="e.g. J4K" C={C} /></View>
            <View style={{ flex: 1 }}><Field label="Color" value={form.color} onChange={(v) => setField('color', v)} placeholder="e.g. Blue/Black" C={C} /></View>
          </View>
          <View style={s.row}>
            <View style={{ flex: 1 }}><Field label="DOM" value={form.dom} onChange={(v) => setField('dom', v)} placeholder="e.g. 2019-06" C={C} /></View>
            <View style={{ flex: 1 }}><Field label="Total Jumps" value={form.total_jumps} onChange={(v) => setField('total_jumps', v)} placeholder="e.g. 200" keyboardType="numeric" C={C} /></View>
          </View>
          <Field label="Serial Number" value={form.serial_number} onChange={(v) => setField('serial_number', v)} placeholder="e.g. J-12345" C={C} />
        </SectionCard>

        {/* ── Rig Sub-Components ── */}
        {isRig && (
          <>
            <SectionCard title="Main Canopy" C={C}>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Field label="Make" value={form.main_make} onChange={(v) => setField('main_make', v)} placeholder="e.g. Performance Designs" C={C} /></View>
                <View style={{ flex: 1 }}><Field label="Model" value={form.main_model} onChange={(v) => setField('main_model', v)} placeholder="e.g. Sabre2" C={C} /></View>
              </View>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Field label="Size" value={form.main_size} onChange={(v) => setField('main_size', v)} placeholder="e.g. 170" C={C} /></View>
                <View style={{ flex: 1 }}><Field label="DOM" value={form.main_dom} onChange={(v) => setField('main_dom', v)} placeholder="e.g. 2018-03" C={C} /></View>
              </View>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Field label="Jumps" value={form.main_jumps} onChange={(v) => setField('main_jumps', v)} placeholder="e.g. 350" keyboardType="numeric" C={C} /></View>
                <View style={{ flex: 1 }}><Field label="Serial" value={form.main_serial} onChange={(v) => setField('main_serial', v)} placeholder="Serial number" C={C} /></View>
              </View>
            </SectionCard>

            <SectionCard title="Reserve" C={C}>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Field label="Make" value={form.reserve_make} onChange={(v) => setField('reserve_make', v)} placeholder="e.g. Precision Aerodynamics" C={C} /></View>
                <View style={{ flex: 1 }}><Field label="Model" value={form.reserve_model} onChange={(v) => setField('reserve_model', v)} placeholder="e.g. Raven" C={C} /></View>
              </View>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Field label="Size" value={form.reserve_size} onChange={(v) => setField('reserve_size', v)} placeholder="e.g. 176" C={C} /></View>
                <View style={{ flex: 1 }}><Field label="DOM" value={form.reserve_dom} onChange={(v) => setField('reserve_dom', v)} placeholder="e.g. 2017-11" C={C} /></View>
              </View>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Field label="Repacks" value={form.reserve_repacks} onChange={(v) => setField('reserve_repacks', v)} placeholder="e.g. 3" keyboardType="numeric" C={C} /></View>
                <View style={{ flex: 1 }}><Field label="Serial" value={form.reserve_serial} onChange={(v) => setField('reserve_serial', v)} placeholder="Serial number" C={C} /></View>
              </View>
            </SectionCard>

            <SectionCard title="AAD" C={C}>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Field label="Make" value={form.aad_make} onChange={(v) => setField('aad_make', v)} placeholder="e.g. Cypres" C={C} /></View>
                <View style={{ flex: 1 }}><Field label="Model" value={form.aad_model} onChange={(v) => setField('aad_model', v)} placeholder="e.g. Expert" C={C} /></View>
              </View>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Field label="DOM" value={form.aad_dom} onChange={(v) => setField('aad_dom', v)} placeholder="e.g. 2020-01" C={C} /></View>
                <View style={{ flex: 1 }}><Field label="EOL" value={form.aad_eol} onChange={(v) => setField('aad_eol', v)} placeholder="e.g. 2028-01" C={C} /></View>
              </View>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Field label="Jumps" value={form.aad_jumps} onChange={(v) => setField('aad_jumps', v)} placeholder="e.g. 180" keyboardType="numeric" C={C} /></View>
                <View style={{ flex: 1 }}><Field label="Serial" value={form.aad_serial} onChange={(v) => setField('aad_serial', v)} placeholder="Serial number" C={C} /></View>
              </View>
              <View style={s.fieldWrap}>
                <Text style={[s.fieldLabel, { color: C.textMuted }]}>Needs Service</Text>
                <View style={s.pillRow}>
                  {([false, true] as const).map((val) => (
                    <TouchableOpacity
                      key={String(val)}
                      style={[
                        s.pill,
                        { backgroundColor: C.backgroundCard, borderColor: C.border },
                        form.aad_needs_service === val && { backgroundColor: C.neonBlueGlow, borderColor: C.neonBlueBorder },
                      ]}
                      onPress={() => setField('aad_needs_service', val)}
                      activeOpacity={0.75}
                    >
                      <Text style={[
                        s.pillText,
                        { color: C.textMuted },
                        form.aad_needs_service === val && { color: C.neonBlue, fontWeight: '700' },
                      ]}>
                        {val ? 'Yes' : 'No'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </SectionCard>
          </>
        )}

        {/* ── Description & Contact ── */}
        <SectionCard title="Description & Contact" C={C}>
          <Field
            label="Description"
            value={form.description}
            onChange={(v) => setField('description', v)}
            placeholder="Describe the gear..."
            multiline
            numberOfLines={5}
            C={C}
          />
          <Field
            label="Contact *"
            value={form.contact}
            onChange={(v) => setField('contact', v)}
            error={errors.contact}
            placeholder="+1 555 000 0000"
            keyboardType="phone-pad"
            C={C}
          />
        </SectionCard>

        {errors.submit && (
          <View style={[s.errorBanner, { backgroundColor: C.errorDim, borderColor: C.error }]}>
            <Text style={[s.errorText, { color: C.error }]}>{errors.submit}</Text>
          </View>
        )}

        <GlossyButton
          title="Save Changes"
          onPress={handleSave}
          loading={saving}
          fullWidth
          size="lg"
          style={{ marginTop: Spacing.sm }}
        />

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionCard({ title, children, C }: { title: string; children: React.ReactNode; C: ReturnType<typeof useThemeColors> }) {
  return (
    <View style={[s.sectionCard, { backgroundColor: C.backgroundCard, borderColor: C.border }]}>
      <Text style={[s.sectionTitle, { color: C.textSecondary, backgroundColor: C.neonBlueGlow, borderBottomColor: C.border }]}>
        {title}
      </Text>
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

function Field({
  label, value, onChange, error, placeholder, keyboardType, multiline, numberOfLines, C,
}: {
  label: string; value: string; onChange: (v: string) => void;
  error?: string; placeholder?: string; keyboardType?: any;
  multiline?: boolean; numberOfLines?: number;
  C: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={[s.fieldLabel, { color: C.textMuted }]}>{label}</Text>
      <TextInput
        style={[
          s.input,
          { backgroundColor: C.backgroundInput, borderColor: C.border, color: C.textPrimary },
          multiline && { height: (numberOfLines ?? 3) * 22 + 24, textAlignVertical: 'top' },
          !!error && { borderColor: C.error },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {error ? <Text style={[s.errorText, { color: C.error }]}>{error}</Text> : null}
    </View>
  );
}

// Layout-only styles — no color values
const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 56 : Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700' },
  content: { padding: Spacing.md, gap: Spacing.md },
  pendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: Radius.md, borderWidth: 1,
    padding: Spacing.sm,
  },
  pendingBadgeText: { flex: 1, fontSize: FontSize.xs, fontWeight: '600', lineHeight: 17 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  input: {
    borderRadius: Radius.md, borderWidth: 1,
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
  },
  errorText: { fontSize: FontSize.xs, fontWeight: '600' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingBottom: 4 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Radius.full, borderWidth: 1,
  },
  pillText: { fontSize: FontSize.sm, fontWeight: '600' },
  row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  toggleWrap: { gap: 6, alignItems: 'flex-start', minWidth: 120 },
  toggleBtn: {
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: Radius.md, borderWidth: 1,
  },
  toggleBtnText: { fontSize: FontSize.md, fontWeight: '700' },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  imgThumbWrap: {
    width: 88, height: 88, borderRadius: Radius.md, overflow: 'hidden',
    position: 'relative', borderWidth: 1,
  },
  imgThumb: { width: '100%', height: '100%' },
  mainBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,191,255,0.8)', paddingVertical: 2, alignItems: 'center',
  },
  mainBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  imgRemoveBtn: {
    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(5,10,20,0.85)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  addImgBtn: {
    width: 88, height: 88, borderRadius: Radius.md,
    borderWidth: 1.5, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  addImgText: { fontSize: 10, fontWeight: '700' },
  urlRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  urlAddBtn: {
    width: 44, height: 44, borderRadius: Radius.md,
    borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  rejectionBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: Radius.md, borderWidth: 1,
    padding: Spacing.md,
  },
  rejectionBannerTitle: { fontSize: FontSize.xs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  rejectionBannerNote: { fontSize: FontSize.sm, fontWeight: '600', lineHeight: 18 },
  rejectionBannerHint: { fontSize: FontSize.xs, fontWeight: '500' },
  errorBanner: {
    borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, alignItems: 'center',
  },
  centeredState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, gap: Spacing.md },
  stateTitle: { fontSize: FontSize.xl, fontWeight: '700', textAlign: 'center' },
  backLink: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.full,
    borderWidth: 1,
  },
  backLinkText: { fontSize: FontSize.md, fontWeight: '700' },
  sectionCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  sectionBody: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
});
