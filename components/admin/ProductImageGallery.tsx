import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import {
  Plus,
  X,
  Star,
  GripVertical,
  CircleCheck as CheckCircle,
  CircleAlert as AlertCircle,
  ArrowLeft,
  ArrowRight,
  Link,
} from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { uploadImageToSupabase, validateImageFile, readFileAsDataUrl } from '@/lib/imageUpload';
import ImageEditorModal from '@/components/admin/ImageEditorModal';

export type GalleryImage = {
  id: string;
  url: string;        // full-res URL (used for detail view and DB storage)
  thumbUrl?: string;  // optimized thumbnail for grid display
  isMain: boolean;
};

type Props = {
  images: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
};

type CardStatus = 'idle' | 'uploading' | 'error';

function generateTempId() {
  return 'tmp_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function ProductImageGallery({ images, onChange }: Props) {
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.mobileFallback}>
        <Text style={styles.mobileFallbackTitle}>Feature not available on mobile</Text>
        <Text style={styles.mobileFallbackText}>
          Image gallery management is available in the web admin dashboard.
        </Text>
      </View>
    );
  }

  const [cardStatus, setCardStatus] = useState<Record<string, CardStatus>>({});
  const [cardError, setCardError] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const addDropRef = useRef<HTMLDivElement | null>(null);
  const [addDragOver, setAddDragOver] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editorVisible, setEditorVisible] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingDataUrl, setPendingDataUrl] = useState('');
  const [pendingReplaceId, setPendingReplaceId] = useState<string | undefined>(undefined);

  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlError, setUrlError] = useState('');

  const showSuccess = () => {
    setGlobalSuccess(true);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setGlobalSuccess(false), 3000);
  };

  const openEditorForFile = useCallback(async (file: File, replaceId?: string) => {
    const validErr = validateImageFile(file);
    if (validErr) {
      if (replaceId) {
        setCardStatus(s => ({ ...s, [replaceId]: 'error' }));
        setCardError(e => ({ ...e, [replaceId]: validErr }));
      } else {
        setGlobalError(validErr);
      }
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setPendingFile(file);
    setPendingDataUrl(dataUrl);
    setPendingReplaceId(replaceId);
    setEditorVisible(true);
  }, []);

  const handleEditorSave = useCallback(async (editedFile: File, _previewDataUrl?: string) => {
    setEditorVisible(false);
    const replaceId = pendingReplaceId;
    setPendingFile(null);
    setPendingDataUrl('');
    setPendingReplaceId(undefined);

    const tempId = replaceId ?? generateTempId();
    setCardStatus(s => ({ ...s, [tempId]: 'uploading' }));
    setCardError(e => { const n = { ...e }; delete n[tempId]; return n; });
    setGlobalError('');

    try {
      const result = await uploadImageToSupabase(editedFile, 'products');
      if (result.error) {
        setCardStatus(s => ({ ...s, [tempId]: 'error' }));
        setCardError(e => ({ ...e, [tempId]: result.error! }));
        return;
      }
      setCardStatus(s => { const n = { ...s }; delete n[tempId]; return n; });
      const fullUrl = result.urls?.full ?? result.url!;
      const thumbUrl = result.urls?.thumb ?? result.url!;
      let nextImages: GalleryImage[];
      if (replaceId) {
        nextImages = images.map(img => img.id === replaceId ? { ...img, url: fullUrl, thumbUrl } : img);
      } else {
        nextImages = [...images, { id: tempId, url: fullUrl, thumbUrl, isMain: images.length === 0 }];
      }
      onChange(nextImages);
      showSuccess();
    } catch (err: unknown) {
      setCardStatus(s => ({ ...s, [tempId]: 'error' }));
      setCardError(e => ({ ...e, [tempId]: err instanceof Error ? err.message : 'Upload failed' }));
    }
  }, [images, onChange, pendingReplaceId]);

  const handleEditorCancel = useCallback(() => {
    setEditorVisible(false);
    setPendingFile(null);
    setPendingDataUrl('');
    setPendingReplaceId(undefined);
  }, []);

  const openPickerForNew = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/jpg,image/png,image/webp,image/svg+xml,image/gif';
    input.multiple = true;
    input.onchange = async (e: Event) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? []);
      for (const file of files) await openEditorForFile(file);
    };
    input.click();
  }, [openEditorForFile]);

  const openPickerForReplace = useCallback((id: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/jpg,image/png,image/webp,image/svg+xml,image/gif';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) openEditorForFile(file, id);
    };
    input.click();
  }, [openEditorForFile]);

  const setMainImage = (id: string) => {
    onChange(images.map(img => ({ ...img, isMain: img.id === id })));
  };

  const removeImage = (id: string) => {
    const next = images.filter(img => img.id !== id);
    if (next.length > 0 && !next.some(img => img.isMain)) {
      next[0] = { ...next[0], isMain: true };
    }
    onChange(next);
  };

  const moveImage = (id: string, direction: -1 | 1) => {
    const idx = images.findIndex(i => i.id === id);
    if (idx === -1) return;
    const toIdx = idx + direction;
    if (toIdx < 0 || toIdx >= images.length) return;
    const next = [...images];
    [next[idx], next[toIdx]] = [next[toIdx], next[idx]];
    onChange(next);
  };

  const handleDragDrop = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const fromIdx = images.findIndex(i => i.id === fromId);
    const toIdx = images.findIndex(i => i.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...images];
    const [item] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, item);
    onChange(next);
  };

  const handleUrlAdd = useCallback(() => {
    const url = urlDraft.trim();
    if (!url) { setUrlError('Please enter a URL'); return; }
    try { new URL(url); } catch { setUrlError('Invalid URL'); return; }
    const id = generateTempId();
    onChange([...images, { id, url, isMain: images.length === 0 }]);
    setUrlDraft('');
    setUrlError('');
    setShowUrlInput(false);
    showSuccess();
  }, [urlDraft, images, onChange]);

  useEffect(() => {
    const el = addDropRef.current;
    if (!el) return;
    const onDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setAddDragOver(true); };
    const onDragEnter = (e: DragEvent) => { e.preventDefault(); setAddDragOver(true); };
    const onDragLeave = (e: DragEvent) => {
      if (!el.contains(e.relatedTarget as Node)) setAddDragOver(false);
    };
    const onDrop = async (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      setAddDragOver(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      for (const file of files) await openEditorForFile(file);
    };
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragenter', onDragEnter);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragenter', onDragEnter);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, [openEditorForFile]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.label}>Product Images</Text>
          {images.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{images.length}</Text>
            </View>
          )}
        </View>
        <Text style={styles.hint}>Drag to reorder · Star = primary · Saved on product save</Text>
      </View>

      {globalSuccess && (
        <View style={styles.successBanner}>
          <CheckCircle size={13} color={Colors.success} strokeWidth={2.5} />
          <Text style={styles.successText}>Image added</Text>
        </View>
      )}

      {globalError !== '' && (
        <View style={styles.errorBanner}>
          <AlertCircle size={13} color={Colors.error} strokeWidth={2.5} />
          <Text style={styles.errorText}>{globalError}</Text>
          <TouchableOpacity onPress={() => setGlobalError('')} style={styles.errorDismiss}>
            <X size={12} color={Colors.error} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
        {images.map((img, idx) => (
          <ImageCard
            key={img.id}
            img={img}
            index={idx}
            total={images.length}
            status={cardStatus[img.id] ?? 'idle'}
            error={cardError[img.id]}
            isHovered={hoveredId === img.id}
            isDraggedOver={dragOverId === img.id}
            onHover={(id) => setHoveredId(id)}
            onSetMain={() => setMainImage(img.id)}
            onReplace={() => openPickerForReplace(img.id)}
            onRemove={() => removeImage(img.id)}
            onMoveLeft={() => moveImage(img.id, -1)}
            onMoveRight={() => moveImage(img.id, 1)}
            onDragStart={() => setDraggedId(img.id)}
            onDragOver={() => setDragOverId(img.id)}
            onDragEnd={() => {
              if (draggedId && dragOverId && draggedId !== dragOverId) {
                handleDragDrop(draggedId, dragOverId);
              }
              setDraggedId(null);
              setDragOverId(null);
            }}
          />
        ))}

        {/* Upload from computer */}
        <div
          ref={addDropRef}
          style={{
            width: 120, height: 120, borderRadius: Radius.md,
            borderWidth: 2, borderStyle: 'dashed',
            borderColor: addDragOver ? Colors.neonBlue : Colors.border,
            backgroundColor: addDragOver ? Colors.neonBlueGlow : Colors.backgroundSecondary,
            display: 'flex', flexDirection: 'column' as any,
            alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, gap: 6,
            transition: 'all 0.15s ease',
          }}
          onClick={openPickerForNew}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: addDragOver ? Colors.neonBlueGlow : Colors.backgroundCard,
            border: `1px solid ${addDragOver ? Colors.neonBlue : Colors.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Plus size={18} color={addDragOver ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />
          </div>
          <span style={{ color: addDragOver ? Colors.neonBlue : Colors.textMuted, fontSize: 10, fontWeight: 700, textAlign: 'center' as any }}>
            {addDragOver ? 'Drop here' : 'Add Images'}
          </span>
          <span style={{ color: Colors.textMuted, fontSize: 9, textAlign: 'center' as any }}>
            Click or drop files
          </span>
        </div>

        {/* Add by URL */}
        <div
          style={{
            width: 120, height: 120, borderRadius: Radius.md,
            borderWidth: 2, borderStyle: 'dashed',
            borderColor: Colors.border,
            backgroundColor: Colors.backgroundSecondary,
            display: 'flex', flexDirection: 'column' as any,
            alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, gap: 6,
          }}
          onClick={() => { setShowUrlInput(v => !v); setUrlDraft(''); setUrlError(''); }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: Colors.backgroundCard,
            border: `1px solid ${Colors.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Link size={16} color={Colors.textMuted} strokeWidth={2} />
          </div>
          <span style={{ color: Colors.textMuted, fontSize: 10, fontWeight: 700, textAlign: 'center' as any }}>
            Add by URL
          </span>
        </div>
      </ScrollView>

      {images.length > 1 && (
        <View style={styles.reorderHint}>
          <GripVertical size={11} color={Colors.textMuted} strokeWidth={2} />
          <Text style={styles.reorderHintText}>Drag cards or use ← → arrows to reorder</Text>
        </View>
      )}

      {showUrlInput && (
        <View style={styles.urlPanel}>
          <Text style={styles.urlPanelLabel}>Add image by URL</Text>
          <View style={styles.urlInputRow}>
            <Link size={13} color={Colors.textMuted} strokeWidth={2} />
            <TextInput
              style={styles.urlInput}
              value={urlDraft}
              onChangeText={(v) => { setUrlDraft(v); setUrlError(''); }}
              placeholder="https://images.pexels.com/..."
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleUrlAdd}
              autoFocus
            />
          </View>
          {urlError !== '' && (
            <View style={styles.urlError}>
              <AlertCircle size={11} color={Colors.error} strokeWidth={2} />
              <Text style={styles.urlErrorText}>{urlError}</Text>
            </View>
          )}
          <View style={styles.urlBtnRow}>
            <TouchableOpacity style={styles.urlApplyBtn} onPress={handleUrlAdd} activeOpacity={0.8}>
              <CheckCircle size={13} color={Colors.background} strokeWidth={2.5} />
              <Text style={styles.urlApplyText}>Add Image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.urlCancelBtn} onPress={() => setShowUrlInput(false)} activeOpacity={0.7}>
              <Text style={styles.urlCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {editorVisible && pendingFile && (
        <ImageEditorModal
          visible={editorVisible}
          sourceDataUrl={pendingDataUrl}
          sourceFile={pendingFile}
          preset="product"
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      )}
    </View>
  );
}

type CardProps = {
  img: GalleryImage;
  index: number;
  total: number;
  status: CardStatus;
  error?: string;
  isHovered: boolean;
  isDraggedOver: boolean;
  onHover: (id: string | null) => void;
  onSetMain: () => void;
  onReplace: () => void;
  onRemove: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
};

function ImageCard({
  img, index, total, status, error, isHovered, isDraggedOver,
  onHover, onSetMain, onReplace, onRemove, onMoveLeft, onMoveRight,
  onDragStart, onDragOver, onDragEnd,
}: CardProps) {
  const [imgErr, setImgErr] = useState(false);

  const cardStyle: any = {
    width: 120, height: 120, borderRadius: Radius.md,
    position: 'relative', flexShrink: 0,
    borderWidth: 2, borderStyle: 'solid',
    borderColor: img.isMain ? Colors.neonBlue : isDraggedOver ? Colors.warning : Colors.border,
    overflow: 'hidden', cursor: 'grab',
    transition: 'all 0.15s ease',
    opacity: status === 'uploading' ? 0.7 : 1,
    transform: isDraggedOver ? 'scale(1.03)' : 'scale(1)',
    boxShadow: img.isMain ? `0 0 0 1px ${Colors.neonBlue}55, 0 0 16px ${Colors.neonBlue}22` : 'none',
  };

  return (
    <div
      style={cardStyle}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDragEnd={onDragEnd}
      onMouseEnter={() => onHover(img.id)}
      onMouseLeave={() => onHover(null)}
    >
      {status === 'uploading' ? (
        <View style={cs.loadingState}>
          <ActivityIndicator color={Colors.neonBlue} size="small" />
          <Text style={cs.loadingText}>Uploading…</Text>
        </View>
      ) : imgErr ? (
        <View style={cs.errorState}>
          <AlertCircle size={16} color={Colors.error} strokeWidth={2} />
          <Text style={cs.errorStateText}>Failed</Text>
        </View>
      ) : (
        <Image
          source={{ uri: img.thumbUrl || img.url }}
          style={[StyleSheet.absoluteFillObject, { objectFit: 'cover' } as any]}
          resizeMode="cover"
          onError={() => setImgErr(true)}
        />
      )}

      {img.isMain && (
        <View style={cs.mainBadge}>
          <Star size={9} color={Colors.background} fill={Colors.background} strokeWidth={0} />
          <Text style={cs.mainBadgeText}>PRIMARY</Text>
        </View>
      )}

      <View style={cs.indexBadge}>
        <Text style={cs.indexText}>{index + 1}/{total}</Text>
      </View>

      {error && (
        <View style={cs.errorTooltip}>
          <Text style={cs.errorTooltipText} numberOfLines={2}>{error}</Text>
        </View>
      )}

      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(5,10,20,0.82)',
        display: 'flex', flexDirection: 'column' as any,
        alignItems: 'center', justifyContent: 'center', gap: 4,
        opacity: isHovered ? 1 : 0,
        transition: 'opacity 0.15s ease',
      }}>
        {!img.isMain && (
          <button onClick={(e) => { e.stopPropagation(); onSetMain(); }} style={btnStyle('primary')}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Set Primary
          </button>
        )}
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={(e) => { e.stopPropagation(); onMoveLeft(); }} disabled={index === 0}
            style={{ ...iconBtn, opacity: index === 0 ? 0.35 : 1 }} title="Move left">←</button>
          <button onClick={(e) => { e.stopPropagation(); onMoveRight(); }} disabled={index === total - 1}
            style={{ ...iconBtn, opacity: index === total - 1 ? 0.35 : 1 }} title="Move right">→</button>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onReplace(); }} style={btnStyle('secondary')}>Replace</button>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} style={btnStyle('danger')}>Remove</button>
      </div>
    </div>
  );
}

const iconBtn: any = {
  width: 28, height: 22, background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4,
  cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 700,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function btnStyle(variant: 'primary' | 'secondary' | 'danger'): any {
  const base: any = {
    display: 'flex', alignItems: 'center', gap: 4,
    borderRadius: 5, padding: '3px 7px', cursor: 'pointer',
    fontSize: 10, fontWeight: 700, width: 90,
  };
  if (variant === 'primary') return { ...base, background: Colors.neonBlueGlow, border: `1px solid ${Colors.neonBlue}`, color: Colors.neonBlue };
  if (variant === 'danger') return { ...base, background: 'rgba(255,68,68,0.15)', border: `1px solid rgba(255,68,68,0.4)`, color: '#ff6b6b' };
  return { ...base, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#aac8e0' };
}

const cs = StyleSheet.create({
  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4, backgroundColor: Colors.backgroundSecondary },
  loadingText: { color: Colors.textMuted, fontSize: 9 },
  errorState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4, backgroundColor: Colors.backgroundSecondary },
  errorStateText: { color: Colors.error, fontSize: 9 },
  mainBadge: {
    position: 'absolute', top: 5, left: 5,
    backgroundColor: Colors.neonBlue, borderRadius: Radius.full,
    paddingHorizontal: 5, paddingVertical: 2,
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  mainBadgeText: { color: Colors.background, fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  indexBadge: {
    position: 'absolute', bottom: 5, right: 5,
    backgroundColor: 'rgba(5,10,20,0.75)', borderRadius: Radius.full,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  indexText: { color: Colors.textSecondary, fontSize: 8, fontWeight: '700' },
  errorTooltip: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.errorDim, padding: 4 },
  errorTooltipText: { color: Colors.error, fontSize: 8 },
});

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md },
  header: { marginBottom: Spacing.sm },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  label: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  countBadge: {
    backgroundColor: Colors.neonBlueGlow, borderWidth: 1, borderColor: Colors.neonBlueBorder,
    borderRadius: Radius.full, minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  countText: { color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '800' },
  hint: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 16 },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,230,118,0.1)', borderWidth: 1, borderColor: 'rgba(0,230,118,0.3)',
    borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 8,
  },
  successText: { color: Colors.success, fontSize: FontSize.xs, fontWeight: '600' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.errorDim, borderWidth: 1, borderColor: Colors.error + '44',
    borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 8,
  },
  errorText: { color: Colors.error, fontSize: FontSize.xs, flex: 1 },
  errorDismiss: { padding: 2 },
  galleryRow: { flexDirection: 'row', gap: 10, paddingBottom: 4, paddingRight: 4 },
  reorderHint: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  reorderHintText: { color: Colors.textMuted, fontSize: 10 },
  urlPanel: {
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.sm,
    marginTop: 8, marginBottom: 4, gap: 8,
  },
  urlPanelLabel: {
    color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  urlInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 8,
  },
  urlInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm },
  urlError: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  urlErrorText: { color: Colors.error, fontSize: FontSize.xs },
  urlBtnRow: { flexDirection: 'row', gap: 8 },
  urlApplyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.neonBlue, borderRadius: Radius.sm, paddingVertical: 9,
  },
  urlApplyText: { color: Colors.background, fontSize: FontSize.xs, fontWeight: '800' },
  urlCancelBtn: {
    paddingHorizontal: 16, paddingVertical: 9,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center',
  },
  urlCancelText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  mobileFallback: {
    backgroundColor: Colors.backgroundCard, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, alignItems: 'center', gap: 6, marginBottom: Spacing.md,
  },
  mobileFallbackTitle: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '700', textAlign: 'center' },
  mobileFallbackText: { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'center', lineHeight: 18 },
});
