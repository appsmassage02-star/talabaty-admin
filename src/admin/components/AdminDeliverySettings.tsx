import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdmin } from '../context/AdminContext';
import { adminService } from '../services/adminService';
import { DeliveryServiceSettings, DeliveryGovernorateSetting } from '../types';
import {
  matchEgyptGovernorate,
} from '../utils/egyptLocations';
import {
  calculateDeliveryFee,
  DeliveryCalculationResult,
} from '../utils/deliveryCalculator';
import {
  Sliders,
  RefreshCw,
  Power,
  Coins,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Lock,
  Server,
  Check,
  Ban,
  ArrowRight,
  Search,
  X,
  FileCode,
  Copy,
  Calculator,
} from 'lucide-react';

export const AdminDeliverySettings: React.FC = () => {
  const { hasPermission, showToast, navigateToSection } = useAdmin();
  const canView = hasPermission('delivery.view');

  // Read-only state (legacy archive — all mutations permanently disabled)
  const [settings, setSettings] = useState<DeliveryServiceSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Governorate Settings State (delivery_governorate_settings — read-only archive)
  const [governorates, setGovernorates] = useState<DeliveryGovernorateSetting[]>([]);
  const [isLoadingGovs, setIsLoadingGovs] = useState(false);
  const [govSearchQuery, setGovSearchQuery] = useState('');

  // SQL & RLS Guidance Modal State (read-only reference copy)
  const [showSqlGuideModal, setShowSqlGuideModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Interactive Live Simulator State
  const [simGovInput, setSimGovInput] = useState('سوهاج');
  const [simResult, setSimResult] = useState<DeliveryCalculationResult | null>(null);

  // Load Governorates
  const loadGovernorates = useCallback(async () => {
    setIsLoadingGovs(true);
    try {
      const res = await adminService.getDeliveryGovernorateSettings();
      if (res.governorates) {
        setGovernorates(res.governorates);
      }
    } catch (err) {
      console.warn('Failed to load governorate settings:', err);
    } finally {
      setIsLoadingGovs(false);
    }
  }, []);

  // Filtered Governorates for Search
  const filteredGovs = useMemo(() => {
    if (!govSearchQuery.trim()) return governorates;
    const q = govSearchQuery.toLowerCase().trim();
    return governorates.filter(
      (g) =>
        g.governorate_name.toLowerCase().includes(q) ||
        (g.governorate_code && g.governorate_code.toLowerCase().includes(q)) ||
        (g.notes && g.notes.toLowerCase().includes(q))
    );
  }, [governorates, govSearchQuery]);

  // Load Settings (Read-Only)
  const loadSettings = useCallback(
    async (showRefreshAnimation = false) => {
      if (showRefreshAnimation) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const res = await adminService.getDeliverySettings();
        if (res.error) {
          showToast(res.error, 'error');
        } else if (res.settings) {
          setSettings(res.settings);
        }
      } catch (err: any) {
        console.error('Error loading delivery settings:', err);
        showToast('حدث خطأ أثناء تحميل إعدادات الدليفري', 'error');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }

      // Also refresh governorates
      loadGovernorates();
    },
    [showToast, loadGovernorates]
  );

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Re-run simulator whenever governorates or settings change or input changes
  useEffect(() => {
    const result = calculateDeliveryFee(simGovInput, governorates, settings);
    setSimResult(result);
  }, [simGovInput, governorates, settings]);

  // Detected Duplicate Governorate Groups (read-only informational display)
  const duplicateGroups = useMemo(() => {
    const map = new Map<string, DeliveryGovernorateSetting[]>();
    for (const g of governorates) {
      const match = matchEgyptGovernorate(g.governorate_code) || matchEgyptGovernorate(g.governorate_name);
      const key = match ? match.code : g.governorate_name.trim().toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    }
    const duplicates: { key: string; name: string; items: DeliveryGovernorateSetting[] }[] = [];
    for (const [key, items] of map.entries()) {
      if (items.length > 1) {
        const arabicItem = items.find((i) => !/^[A-Za-z\s_-]+$/.test(i.governorate_name));
        const displayName = arabicItem ? arabicItem.governorate_name : items[0].governorate_name;
        duplicates.push({ key, name: displayName, items });
      }
    }
    return duplicates;
  }, [governorates]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'غير محدد';
    try {
      return new Intl.DateTimeFormat('ar-EG', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  const sqlPolicyScript = `-- ==============================================================================
-- Supabase SQL: Enable RLS Policies for delivery_governorate_settings
-- Run this script in Supabase SQL Editor if direct mutations are blocked by RLS.
-- ==============================================================================

-- 1. Enable RLS
ALTER TABLE public.delivery_governorate_settings ENABLE ROW LEVEL SECURITY;

-- 2. SELECT Policy: Allow all users (customers, drivers, admin) to read delivery fees
DROP POLICY IF EXISTS "Allow public read access on delivery_governorate_settings" ON public.delivery_governorate_settings;
CREATE POLICY "Allow public read access on delivery_governorate_settings"
  ON public.delivery_governorate_settings
  FOR SELECT
  USING (true);

-- 3. INSERT Policy: Allow active admins to insert governorates
DROP POLICY IF EXISTS "Allow admin insert on delivery_governorate_settings" ON public.delivery_governorate_settings;
CREATE POLICY "Allow admin insert on delivery_governorate_settings"
  ON public.delivery_governorate_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- 4. UPDATE Policy: Allow active admins to update fees and status
DROP POLICY IF EXISTS "Allow admin update on delivery_governorate_settings" ON public.delivery_governorate_settings;
CREATE POLICY "Allow admin update on delivery_governorate_settings"
  ON public.delivery_governorate_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- 5. DELETE Policy: Allow active admins to remove governorates
DROP POLICY IF EXISTS "Allow admin delete on delivery_governorate_settings" ON public.delivery_governorate_settings;
CREATE POLICY "Allow admin delete on delivery_governorate_settings"
  ON public.delivery_governorate_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- 6. Safe & Idempotent RPC function (prevents duplicating rows when updating by code or name)
CREATE OR REPLACE FUNCTION public.admin_set_governorate_delivery(
  p_delivery_fee numeric,
  p_governorate_code text,
  p_is_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First try to update existing row by code or name
  UPDATE public.delivery_governorate_settings
  SET
    delivery_fee = p_delivery_fee,
    is_active = p_is_active,
    updated_at = NOW()
  WHERE UPPER(governorate_code) = UPPER(p_governorate_code)
     OR UPPER(governorate_name) = UPPER(p_governorate_code);

  -- Only insert if row does not exist
  IF NOT FOUND THEN
    INSERT INTO public.delivery_governorate_settings (
      governorate_name,
      governorate_code,
      delivery_fee,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      p_governorate_code,
      UPPER(p_governorate_code),
      p_delivery_fee,
      p_is_active,
      NOW(),
      NOW()
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_governorate_delivery(numeric, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_delivery_service(boolean, numeric) TO authenticated;

-- 7. One-line database cleanup for Sohag duplicates:
DELETE FROM public.delivery_governorate_settings
WHERE governorate_code = 'SOHAG' AND governorate_name = 'SOHAG'
  AND EXISTS (SELECT 1 FROM public.delivery_governorate_settings WHERE governorate_name = 'سوهاج');
UPDATE public.delivery_governorate_settings
SET is_active = true, delivery_fee = 17, governorate_code = 'SHG'
WHERE governorate_name = 'سوهاج';
`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlPolicyScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
    showToast('تم نسخ كود SQL بنجاح', 'success');
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-slate-900/50 rounded-3xl border border-slate-800" dir="rtl">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4 border border-rose-500/20">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">غير مصرح بالدخول</h2>
        <p className="text-sm text-slate-400 max-w-md">
          عذراً، ليس لديك الصلاحيات المطلوبة للاطلاع على إعدادات منظومة التوصيل والمحافظات.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black text-white tracking-tight">إعدادات منظومة التوصيل والمحافظات (أرشيف للقراءة فقط)</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              للقراءة فقط — معطل عن الحفظ
            </span>
          </div>
          <p className="text-xs text-slate-400">
            شاشة مرجعية مؤرشفة للرسوم القديمة. جميع عمليات الإضافة والتعديل والحفظ والتفعيل معطلة هنا لصالح المنظومة المركزية الموحدة.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowSqlGuideModal(true)}
            className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-2 text-xs font-bold cursor-pointer"
            title="عرض كود SQL وسياسات الأمان RLS"
          >
            <FileCode className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">دليل RLS و SQL</span>
          </button>

          <button
            type="button"
            onClick={() => loadSettings(true)}
            disabled={isRefreshing || isLoading}
            className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-2 text-xs font-bold cursor-pointer disabled:opacity-50"
            title="تحديث العرض من Supabase"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">تحديث</span>
          </button>
        </div>
      </div>

      {/* Legacy / Archived Notice Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-amber-950/35 border border-amber-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-black text-amber-200 text-sm">
                شاشة قديمة / مؤرشفة (معطلة بالكامل — للقراءة فقط)
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-[10px]">
                جميع التعديلات والحفظ والحذف موقوفة نهائياً
              </span>
            </div>
            <p className="text-amber-100/80 leading-relaxed">
              تم توحيد إدارة التغطية والتسعير حصرياً عبر جدول <code className="font-mono text-emerald-300">delivery_area_tariffs</code> وجداول <code className="font-mono text-sky-300">geo_*</code> داخل قسم «إدارة المناطق والتوصيل والتسعير والعمالة»، وتم إيقاف كافة عمليات الحفظ والتعديل والإضافة والحذف والدمج في هذه الشاشة القديمة لمنع تعارض الأسعار أو الكتابة في <code className="font-mono">delivery_governorate_settings</code>.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigateToSection('central_pricing')}
          className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-2 shrink-0 cursor-pointer transition shadow-md shadow-emerald-500/20"
        >
          <span>الانتقال إلى التسعير والتغطية المركزية</span>
          <ArrowRight className="w-4 h-4 rotate-180" />
        </button>
      </div>

      {/* Main Grid: Read-Only Archived View & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Read-Only Snapshot & Governorate Archive Table */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Read-Only General Delivery Settings Snapshot */}
          <div className="bg-slate-900/80 p-5 sm:p-6 rounded-3xl border border-slate-800 space-y-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">الرسوم الافتراضية وحالة الخدمة العامة (للقراءة فقط)</h2>
                  <p className="text-[11px] text-slate-400">
                    عرض مرجعي للقيم المخزنة مسبقاً — تم تعطيل الحفظ وتنفيذ RPC من هذه الشاشة
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                وضع القراءة فقط
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Field 1: Master Service Status (Read-Only) */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3 opacity-85">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Power className={`w-4 h-4 ${settings?.delivery_enabled ? 'text-emerald-400' : 'text-slate-500'}`} />
                    حالة خدمة التوصيل المسجلة
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      settings?.delivery_enabled
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {settings?.delivery_enabled ? 'مفعلة' : 'معطلة'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  القيمة المعروضة للقراءة المرجعية فقط. تم إيقاف تعديل الحالة العامة من هذه الشاشة القديمة.
                </p>
              </div>

              {/* Field 2: Default Delivery Fee (Read-Only) */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3 opacity-85">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-400" />
                    الرسوم الافتراضية القديمة المسجلة
                  </span>
                  <span className="text-[10px] text-slate-400">أرشيف</span>
                </div>

                <div className="bg-slate-900 text-white font-mono font-black text-base px-4 py-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span>{settings?.default_delivery_fee ?? 20}</span>
                  <span className="text-xs font-bold text-slate-400">ج.م</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Governorate Delivery Settings Archive (Read-Only) */}
          <div className="bg-slate-900/80 p-5 sm:p-6 rounded-3xl border border-slate-800 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">أرشيف جدول المحافظات القديم (للقراءة فقط)</h2>
                  <p className="text-[11px] text-slate-400">
                    جدول <code className="text-amber-400 font-mono">delivery_governorate_settings</code> — كافة أزرار الإضافة والتهيئة والتعديل والحذف والتفعيل والدمج معطلة نهائياً
                  </p>
                </div>
              </div>

              <span className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-amber-300 text-xs font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>أرشيف للقراءة فقط</span>
              </span>
            </div>

            {/* Search and Stats Summary */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="البحث باسم أو كود المحافظة أو الملاحظات..."
                  value={govSearchQuery}
                  onChange={(e) => setGovSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
                {govSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setGovSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>إجمالي المحافظات: <strong className="text-white font-mono">{governorates.length}</strong></span>
                <span>•</span>
                <span>المفعلة: <strong className="text-emerald-400 font-mono">{governorates.filter((g) => g.is_active).length}</strong></span>
                <span>•</span>
                <span>المعطلة: <strong className="text-rose-400 font-mono">{governorates.filter((g) => !g.is_active).length}</strong></span>
              </div>
            </div>

            {/* Governorates Read-Only Archive Table */}
            {isLoadingGovs ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
                <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                <span className="text-xs">جاري تحميل أرشيف المحافظات من قاعدة البيانات...</span>
              </div>
            ) : filteredGovs.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/50 rounded-2xl border border-slate-800 space-y-3">
                <MapPin className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-slate-300">لا توجد سجلات محافظات مطابقة في الأرشيف</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  تتم إدارة المحافظات والتسعيرات المعتمدة من قسم «التسعير والتغطية المركزية» فقط.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-800 rounded-2xl">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-[11px] font-bold">
                      <th className="p-3.5">المحافظة</th>
                      <th className="p-3.5 text-center">كود المحافظة</th>
                      <th className="p-3.5 text-center">رسوم التوصيل (ج.م)</th>
                      <th className="p-3.5 text-center">وقت التوصيل</th>
                      <th className="p-3.5 text-center">الحالة بالأرشيف</th>
                      <th className="p-3.5">ملاحظات ومراكز</th>
                      <th className="p-3.5 text-center">الصلاحية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredGovs.map((gov) => {
                      const duplicateGroup = duplicateGroups.find((d) => d.items.some((it) => it.id === gov.id));
                      const isDuplicateRow = Boolean(
                        duplicateGroup && duplicateGroup.items.length > 1 && duplicateGroup.items[0].id !== gov.id
                      );
                      return (
                        <tr key={gov.id} className={`transition ${isDuplicateRow ? 'bg-amber-500/5' : 'hover:bg-slate-800/30'}`}>
                          <td className="p-3.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${
                                  gov.is_active ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-500'
                                }`}
                              ></span>
                              <span className="font-bold text-white text-xs">{gov.governorate_name}</span>
                              {isDuplicateRow && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-full font-medium">
                                  سجل مكرر
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="p-3.5 text-center font-mono text-slate-400 text-[11px]">
                            {gov.governorate_code || '—'}
                          </td>

                          <td className="p-3.5 text-center">
                            <span className="font-mono font-black text-emerald-400 text-xs px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg inline-block">
                              {gov.delivery_fee} ج.م
                            </span>
                          </td>

                          <td className="p-3.5 text-center text-slate-400 text-[11px]">
                            {gov.estimated_delivery_time || '—'}
                          </td>

                          <td className="p-3.5 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 ${
                                gov.is_active
                                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                  : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  gov.is_active ? 'bg-emerald-400' : 'bg-rose-500'
                                }`}
                              ></span>
                              <span>{gov.is_active ? 'مفعلة' : 'معطلة'}</span>
                            </span>
                          </td>

                          <td className="p-3.5 text-slate-400 text-[11px] max-w-xs truncate" title={gov.notes || ''}>
                            {gov.notes || '—'}
                          </td>

                          <td className="p-3.5 text-center">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold inline-flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              للقراءة فقط
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Strict Fee Priority Explanation Banner */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
              <h4 className="font-bold text-slate-200 flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-400" />
                <span>قاعدة أولوية احتساب رسوم التوصيل في تطبيق «طلبات البيت»:</span>
              </h4>
              <div className="space-y-1.5 text-slate-400 leading-relaxed text-[11px]">
                <p>
                  <strong className="text-emerald-400 font-bold">أ) المحافظات المسجلة والمفعلة (is_active = true):</strong> يتم تطبيق رسوم التوصيل المخصصة للمحافظة (مثال: سوهاج = 17 ج.م).
                </p>
                <p>
                  <strong className="text-rose-400 font-bold">ب) المحافظات المسجلة والمعطلة (is_active = false):</strong> تكون خدمة التوصيل <span className="text-rose-300 underline font-bold">غير متاحة تماماً</span> لهذه المحافظة ولا يتم الرجوع للرسوم الافتراضية إطلاقاً.
                </p>
                <p>
                  <strong className="text-amber-400 font-bold">ج) المحافظات غير المسجلة بقائمة التخصيص:</strong> فقط في هذه الحالة يتم تطبيق الرسوم الافتراضية العامة (<span className="font-mono text-white">{settings?.default_delivery_fee ?? 20} ج.م</span>).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Status, Inspector & Live Calculator */}
        <div className="space-y-6">
          {/* Card 1: Interactive Live Delivery Fee Simulator */}
          <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">محاكي احتساب فاتورة التوصيل</h3>
                <p className="text-[10px] text-slate-400">اختبر تطابق الرسوم مع فواتير التطبيق مباشرة</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-300 text-[11px] font-bold block">اختر أو اكتب المحافظة / العنوان:</label>
                <div className="flex gap-1.5">
                  <select
                    value={simGovInput}
                    onChange={(e) => setSimGovInput(e.target.value)}
                    className="flex-1 bg-slate-950 text-white px-3 py-2 rounded-xl border border-slate-800 text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value="سوهاج">سوهاج (محافظة مسجلة)</option>
                    <option value="سوهاج - مركز المراغة">سوهاج - مركز المراغة</option>
                    <option value="القاهرة">القاهرة</option>
                    <option value="الجيزة">الجيزة</option>
                    <option value="الإسكندرية">الإسكندرية</option>
                    <option value="محافظة تجريبية غير مسجلة">محافظة غير مسجلة (اختبار الافتراضي)</option>
                  </select>
                </div>
              </div>

              {simResult && (
                <div
                  className={`p-3.5 rounded-2xl border space-y-2 text-xs ${
                    simResult.available
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold">حالة التوصيل:</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                        simResult.available
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {simResult.available ? 'متاح للتوصيل' : 'خدمة التوصيل غير متوفرة'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="font-bold">رسوم التوصيل بالفاتورة:</span>
                    <span className="font-mono font-black text-sm text-white">
                      {simResult.delivery_fee} ج.م
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                    <span>مصدر القاعدة المطبقة:</span>
                    <span className="font-bold text-slate-200">
                      {simResult.source === 'governorate_custom'
                        ? 'تخصيص المحافظة المباشر'
                        : simResult.source === 'general_default'
                        ? 'الرسوم الافتراضية العامة'
                        : 'معطلة (لا تراجع للافتراضي)'}
                    </span>
                  </div>

                  {simResult.errorMessage && (
                    <p className="text-[11px] text-rose-400 pt-1 leading-relaxed">
                      {simResult.errorMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Current Live State */}
          <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              الحالة التشغيلية المباشرة
            </h3>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-400">حالة الخدمة:</span>
                {settings?.delivery_enabled ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    مفعلة (Active)
                  </span>
                ) : (
                  <span className="text-rose-400 font-bold flex items-center gap-1">
                    <Ban className="w-3.5 h-3.5" />
                    متوقفة (Inactive)
                  </span>
                )}
              </div>

              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-400">الرسوم الافتراضية:</span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  {settings?.default_delivery_fee ?? 20} ج.م
                </span>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-400">المحافظات المخصصة:</span>
                <span className="font-mono font-bold text-white">
                  {governorates.length} محافظة
                </span>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-400">تاريخ آخر تحديث:</span>
                <span className="text-slate-300 font-mono text-[11px]">
                  {formatDate(settings?.updated_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Security and Architecture */}
          <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 space-y-3.5 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              الأمان والامتثال في قاعدة البيانات
            </h3>

            <div className="text-xs text-slate-400 space-y-2.5 leading-relaxed">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0"></div>
                <p>
                  يتم التغيير عبر RPC و Edge Function <code className="text-emerald-400 font-mono">admin-api</code> مع التحقق من جدول المشرفين <code className="text-slate-300 font-mono">admin_users</code>.
                </p>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0"></div>
                <p>
                  لا يتم تضمين أي <code className="text-amber-400 font-mono">service_role</code> في المتصفح للحفاظ على الأمان المطلق.
                </p>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0"></div>
                <p>
                  كل عملية يتم تسجيلها تلقائياً داخل سجل الرقابة <code className="text-slate-300 font-mono">admin_audit_logs</code>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* ------------------------------------------------------------- */}
      {/* SQL & RLS Guidance Modal                                      */}
      {/* ------------------------------------------------------------- */}
      {showSqlGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowSqlGuideModal(false)}
        >
          <div
            className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full shadow-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:p-5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">دليل سياسات الأمان RLS في Supabase</h3>
                  <p className="text-xs text-slate-400">كود SQL الجاهز لتفعيل أذونات القراءة والتعديل لجدول المحافظات</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlGuideModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain flex flex-col">
              <div className="text-xs text-slate-300 space-y-2 leading-relaxed shrink-0">
                <p>
                  إذا ظهرت رسالة خطأ تمنع حفظ الرسوم أو إضافة محافظة بسبب <strong className="text-amber-400">Row-Level Security (RLS)</strong>، قم بنسخ الكود أدناه وتشغيله في <strong>Supabase SQL Editor</strong> لمنح المشرفين صلاحية إدارة جدول المحافظات بشكل آمن.
                </p>
              </div>

              <div className="relative flex-1 bg-slate-950 rounded-2xl border border-slate-800 p-3 overflow-y-auto min-h-[200px]">
                <button
                  type="button"
                  onClick={copySqlToClipboard}
                  className="absolute top-2.5 left-2.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">تم النسخ!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ SQL</span>
                    </>
                  )}
                </button>
                <pre className="text-[11px] font-mono text-emerald-300/90 whitespace-pre-wrap leading-relaxed text-left" dir="ltr">
                  {sqlPolicyScript}
                </pre>
              </div>
            </div>

            <div className="flex justify-end p-4 border-t border-slate-800 bg-slate-950/95 backdrop-blur shrink-0 sticky bottom-0 z-10">
              <button
                type="button"
                onClick={() => setShowSqlGuideModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
