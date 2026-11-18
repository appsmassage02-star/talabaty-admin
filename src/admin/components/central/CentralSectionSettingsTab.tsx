import React, { useEffect, useMemo, useState } from 'react';
import {
  AppDisabledDisplayMode,
  AppSectionDisplayWidth,
  AppSectionKey,
  AppSectionSetting,
  AppSectionSettingUpdateInput,
  CentralMutationResult,
} from '../../types';
import {
  CENTRAL_SERVICE_DEFINITIONS,
  getServiceDefinition,
} from '../../services/centralGeoDeliveryService';
import {
  AlertTriangle,
  CheckCircle2,
  Coins,
  Eye,
  EyeOff,
  Info,
  Lock,
  Power,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  Sliders,
  Truck,
  XCircle,
} from 'lucide-react';

interface CentralSectionSettingsTabProps {
  settings: AppSectionSetting[];
  settingsError?: string | null;
  settingsConstraintHint?: string | null;
  canManageSectionSettings: boolean;
  canViewPricing: boolean;
  isBusy: boolean;
  onSaveSectionSetting: (
    sectionKey: AppSectionKey,
    updates: AppSectionSettingUpdateInput
  ) => Promise<CentralMutationResult<AppSectionSetting>>;
  onGoToPricingForService: (serviceType: AppSectionKey) => void;
  onRefresh: () => void;
}

interface SectionDraftState {
  section_enabled: boolean;
  section_visible: boolean;
  delivery_enabled: boolean;
  disabled_display_mode: AppDisabledDisplayMode | null;
  display_width: AppSectionDisplayWidth | null;
}

function buildDraftFromSetting(setting: AppSectionSetting): SectionDraftState {
  return {
    section_enabled: Boolean(setting.section_enabled),
    section_visible: Boolean(setting.section_visible),
    delivery_enabled: Boolean(setting.delivery_enabled),
    disabled_display_mode: setting.disabled_display_mode ?? null,
    display_width: setting.display_width ?? null,
  };
}

function formatUpdatedAt(iso?: string | null): string {
  if (!iso) return 'غير مسجل';
  try {
    return new Date(iso).toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getOperationalStatusSummary(draft: SectionDraftState): {
  label: string;
  description: string;
  badgeClass: string;
} {
  if (!draft.section_visible) {
    return {
      label: 'مخفي عن العملاء',
      description: draft.section_enabled
        ? 'البطاقة مخفية في تطبيق العميل رغم أن حالة التشغيل مفعلة (وضع الإخفاء التام).'
        : 'القسم مخفي من تطبيق العميل ومتوقف عن استقبال الطلبات الجديدة.',
      badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
    };
  }

  if (!draft.section_enabled) {
    const modeDesc =
      draft.disabled_display_mode === 'hide'
        ? 'مع وضع disabled_display_mode = hide سيتم إخفاء القسم عند تعطيله.'
        : draft.disabled_display_mode === 'show_disabled'
        ? 'مع وضع disabled_display_mode = show_disabled يظهر القسم للعميل كغير متاح مؤقتاً.'
        : 'سلوك العرض عند التعطيل يعتمد على الإعداد الافتراضي للتطبيق.';
    return {
      label: 'القسم متوقف عن الطلبات',
      description: `القسم ظاهر في القائمة لكنه لا يستقبل طلبات جديدة حالياً. ${modeDesc}`,
      badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    };
  }

  if (!draft.delivery_enabled) {
    return {
      label: 'ظاهر ومفعّل — التوصيل متوقف',
      description:
        'القسم ظاهر ومفعل لكن خدمة التوصيل لهذا القسم متوقفة حالياً (لا يؤثر على رسوم المناطق أو الأقسام الأخرى أو الطلبات المقبولة).',
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    };
  }

  return {
    label: 'يعمل بالكامل والتوصيل مفعل',
    description:
      'القسم ظاهر للعملاء، متاح للطلبات الجديدة، وخدمة التوصيل لهذا القسم مفعلة وفق نطاقات التغطية والرسوم المعتمدة.',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  };
}

export const CentralSectionSettingsTab: React.FC<CentralSectionSettingsTabProps> = ({
  settings,
  settingsError,
  settingsConstraintHint,
  canManageSectionSettings,
  canViewPricing,
  isBusy,
  onSaveSectionSetting,
  onGoToPricingForService,
  onRefresh,
}) => {
  const settingsByKey = useMemo(() => {
    const map = new Map<AppSectionKey, AppSectionSetting>();
    settings.forEach((s) => map.set(s.section_key, s));
    return map;
  }, [settings]);

  const [drafts, setDrafts] = useState<Partial<Record<AppSectionKey, SectionDraftState>>>({});
  const [savingKey, setSavingKey] = useState<AppSectionKey | null>(null);
  const [cardFeedback, setCardFeedback] = useState<
    Partial<Record<AppSectionKey, { type: 'success' | 'error'; message: string }>>
  >({});

  // Sync drafts whenever authoritative DB settings reload
  useEffect(() => {
    const nextDrafts: Partial<Record<AppSectionKey, SectionDraftState>> = {};
    settings.forEach((row) => {
      nextDrafts[row.section_key] = buildDraftFromSetting(row);
    });
    setDrafts(nextDrafts);
  }, [settings]);

  const updateDraftField = <K extends keyof SectionDraftState>(
    sectionKey: AppSectionKey,
    field: K,
    value: SectionDraftState[K]
  ) => {
    setCardFeedback((prev) => {
      const next = { ...prev };
      delete next[sectionKey];
      return next;
    });
    setDrafts((prev) => {
      const existing = prev[sectionKey];
      if (!existing) return prev;
      return {
        ...prev,
        [sectionKey]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  const handleResetSection = (sectionKey: AppSectionKey) => {
    const original = settingsByKey.get(sectionKey);
    if (!original) return;
    setDrafts((prev) => ({
      ...prev,
      [sectionKey]: buildDraftFromSetting(original),
    }));
    setCardFeedback((prev) => {
      const next = { ...prev };
      delete next[sectionKey];
      return next;
    });
  };

  const isSectionDirty = (sectionKey: AppSectionKey): boolean => {
    const original = settingsByKey.get(sectionKey);
    const draft = drafts[sectionKey];
    if (!original || !draft) return false;
    return (
      draft.section_enabled !== Boolean(original.section_enabled) ||
      draft.section_visible !== Boolean(original.section_visible) ||
      draft.delivery_enabled !== Boolean(original.delivery_enabled) ||
      (draft.disabled_display_mode ?? null) !== (original.disabled_display_mode ?? null) ||
      (draft.display_width ?? null) !== (original.display_width ?? null)
    );
  };

  const handleSaveSection = async (sectionKey: AppSectionKey) => {
    if (!canManageSectionSettings) {
      setCardFeedback((prev) => ({
        ...prev,
        [sectionKey]: {
          type: 'error',
          message: 'ليس لديك صلاحية تعديل إعدادات الأقسام.',
        },
      }));
      return;
    }

    const original = settingsByKey.get(sectionKey);
    const draft = drafts[sectionKey];
    if (!original || !draft) return;

    const updates: AppSectionSettingUpdateInput = {};
    if (draft.section_enabled !== Boolean(original.section_enabled)) {
      updates.section_enabled = draft.section_enabled;
    }
    if (draft.section_visible !== Boolean(original.section_visible)) {
      updates.section_visible = draft.section_visible;
    }
    if (draft.delivery_enabled !== Boolean(original.delivery_enabled)) {
      updates.delivery_enabled = draft.delivery_enabled;
    }
    if ((draft.disabled_display_mode ?? null) !== (original.disabled_display_mode ?? null)) {
      updates.disabled_display_mode = draft.disabled_display_mode;
    }
    if ((draft.display_width ?? null) !== (original.display_width ?? null)) {
      updates.display_width = draft.display_width;
    }

    if (Object.keys(updates).length === 0) {
      setCardFeedback((prev) => ({
        ...prev,
        [sectionKey]: {
          type: 'error',
          message: 'لا توجد تعديلات جديدة لحفظها في هذا القسم.',
        },
      }));
      return;
    }

    setSavingKey(sectionKey);
    setCardFeedback((prev) => {
      const next = { ...prev };
      delete next[sectionKey];
      return next;
    });

    try {
      const res = await onSaveSectionSetting(sectionKey, updates);
      if (!res.success || !res.verifiedFromDb || !res.data) {
        setCardFeedback((prev) => ({
          ...prev,
          [sectionKey]: {
            type: 'error',
            message: res.error || 'فشل حفظ وتأكيد إعدادات القسم من قاعدة البيانات.',
          },
        }));
        return;
      }

      setDrafts((prev) => ({
        ...prev,
        [sectionKey]: buildDraftFromSetting(res.data!),
      }));
      setCardFeedback((prev) => ({
        ...prev,
        [sectionKey]: {
          type: 'success',
          message: 'تم الحفظ وإعادة القراءة من app_section_settings وتأكيد التطابق بنجاح.',
        },
      }));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white">
                  إعدادات الأقسام المركزية (app_section_settings)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  المصدر الموحد الوحيد
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                التحكم المستقل لكل قسم في التشغيل، الظهور، وخدمة التوصيل العامة، مع فصل تام عن تسعير المناطق الجغرافية (delivery_area_tariffs).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isBusy || savingKey !== null}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-emerald-400 ${isBusy ? 'animate-spin' : ''}`}
            />
            <span>إعادة القراءة من القاعدة</span>
          </button>
        </div>

        {/* Semantic Clarification Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80 text-[11px]">
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-1">
            <div className="font-bold text-emerald-300 flex items-center gap-1.5">
              <Power className="w-3.5 h-3.5" />
              <span>1. تشغيل القسم (section_enabled)</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              يتحكم في السماح باستقبال طلبات جديدة للقسم. إيقافه لا يكسر الطلبات المقبولة مسبقاً ولا يؤثر على الأقسام الأخرى.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-1">
            <div className="font-bold text-sky-300 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              <span>2. الظهور للعميل (section_visible)</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              يتحكم في إظهار بطاقة القسم أو إخفائها في تطبيق العميل بشكل مستقل عن حالة التوصيل أو التشغيل.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-1">
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              <span>3. خدمة التوصيل (delivery_enabled)</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              تفعيل أو إيقاف التوصيل للقسم بالكامل فقط؛ أما رسوم التوصيل والمناطق المغطاة فتُدار من تبويب «التسعير والرسوم».
            </p>
          </div>
        </div>
      </div>

      {/* Read-only permission fence banner */}
      {!canManageSectionSettings && (
        <div className="bg-amber-950/35 border border-amber-500/35 rounded-2xl p-4 flex items-start gap-2.5 text-xs text-amber-200">
          <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            وضع العرض فقط: حسابك يمتلك صلاحية الاطلاع على إعدادات الأقسام دون صلاحية التعديل والحفظ الإداري.
          </span>
        </div>
      )}

      {/* Database Error Banner */}
      {settingsError && (
        <div className="bg-rose-950/50 border border-rose-500/40 rounded-2xl p-4 flex items-start gap-3 text-xs text-rose-200">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-rose-300">
              تعذر قراءة جدول app_section_settings من قاعدة البيانات
            </p>
            <p className="font-mono text-[11px] text-rose-200/90 break-words">{settingsError}</p>
            {settingsConstraintHint && (
              <p className="text-[11px] text-rose-300/90">{settingsConstraintHint}</p>
            )}
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isBusy && settings.length === 0 ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-300">
            جاري تحميل إعدادات الأقسام الحية من app_section_settings...
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {CENTRAL_SERVICE_DEFINITIONS.map((def) => {
            const sectionKey = def.type;
            const liveRow = settingsByKey.get(sectionKey);
            const draft = drafts[sectionKey];
            const dirty = isSectionDirty(sectionKey);
            const isSavingThis = savingKey === sectionKey;
            const feedback = cardFeedback[sectionKey];
            const serviceDef = getServiceDefinition(sectionKey);

            if (!liveRow || !draft) {
              return (
                <div
                  key={sectionKey}
                  className="bg-slate-900/90 border border-rose-500/30 rounded-3xl p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-base font-black text-white">{def.labelAr}</h4>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                        {sectionKey}
                      </span>
                    </div>
                    <div className="p-4 rounded-2xl bg-rose-950/35 border border-rose-500/30 text-xs text-rose-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>
                        لم يتم العثور على صف مسجل لهذا القسم في جدول <code className="font-mono">app_section_settings</code>. لا تعرض الواجهة قيماً افتراضية غير مؤكدة.
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            const statusMeta = getOperationalStatusSummary(draft);

            return (
              <div
                key={sectionKey}
                className={`bg-slate-900/90 border rounded-3xl p-5 flex flex-col justify-between gap-5 transition-all ${
                  dirty
                    ? 'border-amber-500/50 shadow-lg shadow-amber-950/20'
                    : 'border-slate-800'
                }`}
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800/80">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-black text-white">
                          {serviceDef?.labelAr || sectionKey}
                        </h4>
                        {dirty && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            تعديلات غير محفوظة
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-emerald-400/90">{sectionKey}</p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${statusMeta.badgeClass}`}
                    >
                      {statusMeta.label}
                    </span>
                  </div>

                  {/* Operational Explanation */}
                  <div className="p-3 rounded-2xl bg-slate-950/75 border border-slate-800/80 text-[11px] text-slate-300 leading-relaxed flex items-start gap-2">
                    <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{statusMeta.description}</span>
                  </div>

                  {/* Control 1: section_enabled */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Power className="w-3.5 h-3.5 text-emerald-400" />
                        <span>تشغيل القسم</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        <code className="font-mono text-slate-300">section_enabled</code> — استقبال الطلبات الجديدة
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canManageSectionSettings || isSavingThis}
                      onClick={() =>
                        updateDraftField(sectionKey, 'section_enabled', !draft.section_enabled)
                      }
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 shrink-0 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        draft.section_enabled
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                      }`}
                    >
                      {draft.section_enabled ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>مفعل</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" />
                          <span>متوقف</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Control 2: section_visible */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        {draft.section_visible ? (
                          <Eye className="w-3.5 h-3.5 text-sky-400" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>إظهار القسم للعميل</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        <code className="font-mono text-slate-300">section_visible</code> — الظهور في واجهة التطبيق
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canManageSectionSettings || isSavingThis}
                      onClick={() =>
                        updateDraftField(sectionKey, 'section_visible', !draft.section_visible)
                      }
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 shrink-0 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        draft.section_visible
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-sky-500/30'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {draft.section_visible ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>ظاهر</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>مخفي</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Control 3: delivery_enabled */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-amber-400" />
                        <span>خدمة التوصيل للقسم</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        <code className="font-mono text-slate-300">delivery_enabled</code> — تشغيل/إيقاف توصيل القسم
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canManageSectionSettings || isSavingThis}
                      onClick={() =>
                        updateDraftField(sectionKey, 'delivery_enabled', !draft.delivery_enabled)
                      }
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 shrink-0 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        draft.delivery_enabled
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                      }`}
                    >
                      {draft.delivery_enabled ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>مفعل</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" />
                          <span>متوقف</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Control 4: disabled_display_mode */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-bold text-white">
                        طريقة العرض عند التعطيل
                      </label>
                      <code className="text-[10px] font-mono text-slate-400">
                        disabled_display_mode
                      </code>
                    </div>
                    <select
                      value={draft.disabled_display_mode ?? ''}
                      disabled={!canManageSectionSettings || isSavingThis}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateDraftField(
                          sectionKey,
                          'disabled_display_mode',
                          val === 'show_disabled' || val === 'hide' ? val : null
                        );
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 disabled:opacity-50"
                    >
                      <option value="">غير محدد (الافتراضي في التطبيق — null)</option>
                      <option value="show_disabled">
                        إظهار القسم كغير متاح مع تنبيه (show_disabled)
                      </option>
                      <option value="hide">إخفاء القسم تلقائياً عند التعطيل (hide)</option>
                    </select>
                  </div>

                  {/* Control 5: display_width */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-bold text-white">
                        عرض بطاقة القسم في التطبيق
                      </label>
                      <code className="text-[10px] font-mono text-slate-400">display_width</code>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        disabled={!canManageSectionSettings || isSavingThis}
                        onClick={() => updateDraftField(sectionKey, 'display_width', 'full')}
                        className={`py-2 px-2 rounded-xl text-[11px] font-bold border cursor-pointer transition disabled:opacity-50 ${
                          draft.display_width === 'full'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        عرض كامل (full)
                      </button>
                      <button
                        type="button"
                        disabled={!canManageSectionSettings || isSavingThis}
                        onClick={() => updateDraftField(sectionKey, 'display_width', 'half')}
                        className={`py-2 px-2 rounded-xl text-[11px] font-bold border cursor-pointer transition disabled:opacity-50 ${
                          draft.display_width === 'half'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        نصف عرض (half)
                      </button>
                      <button
                        type="button"
                        disabled={!canManageSectionSettings || isSavingThis}
                        onClick={() => updateDraftField(sectionKey, 'display_width', null)}
                        className={`py-2 px-2 rounded-xl text-[11px] font-bold border cursor-pointer transition disabled:opacity-50 ${
                          draft.display_width === null
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        افتراضي (null)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer: Feedback, Metadata, Actions */}
                <div className="space-y-3 pt-3 border-t border-slate-800/80">
                  {feedback && (
                    <div
                      className={`p-3 rounded-2xl border text-[11px] flex items-start gap-2 ${
                        feedback.type === 'success'
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                          : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                      }`}
                    >
                      {feedback.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <span>{feedback.message}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>آخر تحديث: {formatUpdatedAt(liveRow.updated_at)}</span>
                    {canViewPricing && (
                      <button
                        type="button"
                        onClick={() => onGoToPricingForService(sectionKey)}
                        className="text-emerald-400 hover:text-emerald-300 font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>التسعير والمناطق</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {dirty && (
                      <button
                        type="button"
                        disabled={isSavingThis}
                        onClick={() => handleResetSection(sectionKey)}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>تراجع</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={!canManageSectionSettings || !dirty || isSavingThis}
                      onClick={() => handleSaveSection(sectionKey)}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isSavingThis ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      <span>
                        {isSavingThis
                          ? 'جاري الحفظ والتحقق...'
                          : dirty
                          ? 'حفظ إعدادات القسم وتأكيدها'
                          : 'محفوظ ومطابق للقاعدة'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
