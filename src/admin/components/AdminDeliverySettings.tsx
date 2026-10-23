import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdmin } from '../context/AdminContext';
import { adminService } from '../services/adminService';
import { DeliveryServiceSettings, DeliveryGovernorateSetting } from '../types';
import {
  EGYPT_GOVERNORATES,
  matchEgyptGovernorate,
  EgyptGovernorateData,
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
  Calendar,
  Layers,
  MapPin,
  Lock,
  Info,
  Server,
  Save,
  Check,
  Ban,
  ArrowRight,
  Plus,
  Trash2,
  Edit3,
  Search,
  X,
  CheckSquare,
  Square,
  FileCode,
  Copy,
  Calculator,
  Sparkles,
} from 'lucide-react';

export const AdminDeliverySettings: React.FC = () => {
  const { hasPermission, showToast } = useAdmin();
  const canManage = hasPermission('delivery.manage');
  const canView = hasPermission('delivery.view');

  // State
  const [settings, setSettings] = useState<DeliveryServiceSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [deliveryFeeInput, setDeliveryFeeInput] = useState<string>('20');

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<{
    enabled: boolean;
    fee: number;
  } | null>(null);

  // Error Alert State for RPC / Security
  const [rpcErrorNotice, setRpcErrorNotice] = useState<string | null>(null);

  // Governorate Settings State (delivery_governorate_settings)
  const [governorates, setGovernorates] = useState<DeliveryGovernorateSetting[]>([]);
  const [isLoadingGovs, setIsLoadingGovs] = useState(false);
  const [govSearchQuery, setGovSearchQuery] = useState('');
  const [isSeedingGovs, setIsSeedingGovs] = useState(false);

  // Redesigned Add / Edit Governorate Modal State
  const [showGovModal, setShowGovModal] = useState(false);
  const [editingGov, setEditingGov] = useState<DeliveryGovernorateSetting | null>(null);
  const [selectedCountry, setSelectedCountry] = useState('EG'); // مصر
  const [selectedGovCode, setSelectedGovCode] = useState('SHG'); // Default Sohag or selected
  const [selectedMarkazes, setSelectedMarkazes] = useState<string[]>([]);
  const [selectAllMarkazes, setSelectAllMarkazes] = useState(true);
  const [govFormData, setGovFormData] = useState({
    governorate_name: 'سوهاج',
    governorate_code: 'SHG',
    delivery_fee: '17',
    estimated_delivery_time: '60-90 دقيقة',
    is_active: true,
    notes: '',
  });
  const [isSavingGov, setIsSavingGov] = useState(false);

  // Inline Fee Quick Edit State
  const [inlineEditingGovId, setInlineEditingGovId] = useState<string | null>(null);
  const [inlineFeeValue, setInlineFeeValue] = useState<string>('');
  const [isSavingInlineFee, setIsSavingInlineFee] = useState(false);

  // Delete Governorate State
  const [govToDelete, setGovToDelete] = useState<DeliveryGovernorateSetting | null>(null);
  const [isDeletingGov, setIsDeletingGov] = useState(false);

  // SQL & RLS Guidance Modal State
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

  // Load Settings
  const loadSettings = useCallback(
    async (showRefreshAnimation = false) => {
      if (showRefreshAnimation) setIsRefreshing(true);
      else setIsLoading(true);
      setRpcErrorNotice(null);

      try {
        const res = await adminService.getDeliverySettings();
        if (res.error) {
          showToast(res.error, 'error');
        } else if (res.settings) {
          setSettings(res.settings);
          setDeliveryEnabled(res.settings.delivery_enabled);
          setDeliveryFeeInput(res.settings.default_delivery_fee.toString());
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

  // Duplicate Check for selected governorate in Add Modal
  const isSelectedGovDuplicate = useMemo(() => {
    if (editingGov) return false;
    return governorates.some(
      (g) =>
        g.governorate_code?.toUpperCase() === selectedGovCode.toUpperCase() ||
        g.governorate_name.trim() === govFormData.governorate_name.trim()
    );
  }, [governorates, selectedGovCode, govFormData.governorate_name, editingGov]);

  // Detected Duplicate Governorate Groups across the whole table (e.g. SOHAG + سوهاج)
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

  const [isMergingDuplicates, setIsMergingDuplicates] = useState(false);
  const handleMergeDuplicates = async () => {
    if (!canManage) {
      showToast('ليس لديك صلاحية لتعديل المحافظات', 'error');
      return;
    }
    setIsMergingDuplicates(true);
    try {
      const res = await adminService.cleanupDuplicateGovernorates();
      if (res.success) {
        showToast(
          res.removedCount > 0
            ? `تم دمج السجلات وتوحيد حالة التفعيل وحذف ${res.removedCount} سجل مكرر (${res.mergedNames.join('، ')})`
            : 'تم فحص السجلات ولا يوجد أي تكرار حالياً',
          'success'
        );
        await loadGovernorates();
      } else {
        showToast(res.error || 'تعذر دمج السجلات المكررة', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'حدث خطأ أثناء دمج السجلات', 'error');
    } finally {
      setIsMergingDuplicates(false);
    }
  };

  // Current official governorate definition based on dropdown
  const currentOfficialGov = useMemo(() => {
    return EGYPT_GOVERNORATES.find((g) => g.code === selectedGovCode) || EGYPT_GOVERNORATES[0];
  }, [selectedGovCode]);

  // Handler: Select Official Governorate in Modal
  const handleSelectOfficialGov = (code: string) => {
    setSelectedGovCode(code);
    const target = EGYPT_GOVERNORATES.find((g) => g.code === code);
    if (target) {
      setGovFormData((prev) => ({
        ...prev,
        governorate_code: target.code,
        governorate_name: target.name_ar,
      }));
      setSelectedMarkazes(target.markazes);
      setSelectAllMarkazes(true);
    }
  };

  // Toggle Markaz Selection
  const toggleMarkazSelection = (markaz: string) => {
    setSelectedMarkazes((prev) => {
      if (prev.includes(markaz)) {
        const next = prev.filter((m) => m !== markaz);
        setSelectAllMarkazes(false);
        return next;
      } else {
        const next = [...prev, markaz];
        if (next.length === currentOfficialGov.markazes.length) {
          setSelectAllMarkazes(true);
        }
        return next;
      }
    });
  };

  const toggleSelectAllMarkazes = () => {
    if (selectAllMarkazes) {
      setSelectedMarkazes([]);
      setSelectAllMarkazes(false);
    } else {
      setSelectedMarkazes(currentOfficialGov.markazes);
      setSelectAllMarkazes(true);
    }
  };

  // Open Modal for Add
  const handleOpenAddModal = () => {
    // Pick first un-added governorate if possible, otherwise default to Sohag or Cairo
    const unaddedGov = EGYPT_GOVERNORATES.find(
      (eg) => !governorates.some((g) => g.governorate_code?.toUpperCase() === eg.code.toUpperCase())
    ) || EGYPT_GOVERNORATES[0];

    setSelectedCountry('EG');
    setSelectedGovCode(unaddedGov.code);
    setSelectedMarkazes(unaddedGov.markazes);
    setSelectAllMarkazes(true);
    setEditingGov(null);
    setGovFormData({
      governorate_name: unaddedGov.name_ar,
      governorate_code: unaddedGov.code,
      delivery_fee: (settings?.default_delivery_fee || 20).toString(),
      estimated_delivery_time: '45-60 دقيقة',
      is_active: true,
      notes: '',
    });
    setShowGovModal(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (gov: DeliveryGovernorateSetting) => {
    setEditingGov(gov);
    setSelectedCountry('EG');

    // Match with official definition
    const matched = matchEgyptGovernorate(gov.governorate_code || gov.governorate_name) || EGYPT_GOVERNORATES[0];
    setSelectedGovCode(matched.code);
    setSelectedMarkazes(matched.markazes);
    setSelectAllMarkazes(true);

    setGovFormData({
      governorate_name: gov.governorate_name,
      governorate_code: gov.governorate_code || matched.code,
      delivery_fee: gov.delivery_fee.toString(),
      estimated_delivery_time: gov.estimated_delivery_time || '45-60 دقيقة',
      is_active: gov.is_active,
      notes: gov.notes || '',
    });
    setShowGovModal(true);
  };

  // Governorate Actions
  const handleToggleGovActive = async (gov: DeliveryGovernorateSetting) => {
    if (!canManage) {
      showToast('ليس لديك صلاحية لتعديل إعدادات المحافظات', 'error');
      return;
    }
    try {
      const nextActive = !gov.is_active;

      // Optimistic update: toggle this row and any duplicate row for the same governorate
      const targetMatch = matchEgyptGovernorate(gov.governorate_code) || matchEgyptGovernorate(gov.governorate_name);
      setGovernorates((prev) =>
        prev.map((item) => {
          const itemMatch = matchEgyptGovernorate(item.governorate_code) || matchEgyptGovernorate(item.governorate_name);
          const isSame =
            item.id === gov.id ||
            (targetMatch && itemMatch && targetMatch.code === itemMatch.code) ||
            item.governorate_name.trim().toLowerCase() === gov.governorate_name.trim().toLowerCase();
          return isSame ? { ...item, is_active: nextActive } : item;
        })
      );

      const res = await adminService.toggleGovernorateActive(
        gov.id,
        nextActive,
        gov.governorate_code,
        gov.delivery_fee,
        gov.governorate_name
      );

      if (res.success) {
        showToast(
          `تم ${nextActive ? 'تفعيل' : 'تعطيل'} خدمة التوصيل لمحافظة ${gov.governorate_name}`,
          'success'
        );
        loadGovernorates();
      } else {
        // Revert on failure
        loadGovernorates();
        showToast(res.error || 'تعذر تغيير حالة المحافظة في قاعدة البيانات', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'حدث خطأ غير متوقع', 'error');
      loadGovernorates();
    }
  };

  // Quick Inline Fee Save
  const handleSaveInlineFee = async (gov: DeliveryGovernorateSetting) => {
    if (!canManage) {
      showToast('ليس لديك صلاحية لتعديل الرسوم', 'error');
      return;
    }
    const feeNum = parseFloat(inlineFeeValue);
    if (isNaN(feeNum) || feeNum < 0) {
      showToast('يرجى إدخال رسوم صحيحة موجبة', 'error');
      return;
    }

    setIsSavingInlineFee(true);
    try {
      const res = await adminService.updateDeliveryGovernorateSetting(gov.id, {
        delivery_fee: feeNum,
        is_active: gov.is_active,
        governorate_code: gov.governorate_code,
        governorate_name: gov.governorate_name,
      });

      if (res.success) {
        showToast(`تم حفظ رسوم محافظة ${gov.governorate_name} بقيمة ${feeNum} ج.م`, 'success');
        setInlineEditingGovId(null);
        setInlineFeeValue('');
        loadGovernorates();
      } else {
        showToast(res.error || 'تعذر حفظ الرسوم في قاعدة البيانات', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'حدث خطأ أثناء حفظ الرسوم', 'error');
    } finally {
      setIsSavingInlineFee(false);
    }
  };

  const handleSaveGov = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      showToast('ليس لديك صلاحية لتعديل إعدادات المحافظات', 'error');
      return;
    }
    const fee = parseFloat(govFormData.delivery_fee);
    if (isNaN(fee) || fee < 0) {
      showToast('يرجى إدخال قيمة رسوم صحيحة (أكبر من أو تساوي 0)', 'error');
      return;
    }
    if (!govFormData.governorate_name.trim()) {
      showToast('يرجى اختيار أو إدخال اسم المحافظة', 'error');
      return;
    }

    if (isSelectedGovDuplicate) {
      showToast('هذه المحافظة مسجلة مسبقاً في النظام. يُرجى تعديلها بدلاً من إضافتها مرة أخرى.', 'error');
      return;
    }

    // Build Markaz Note if custom selection was made
    let markazNote = '';
    if (selectedMarkazes.length > 0 && selectedMarkazes.length < currentOfficialGov.markazes.length) {
      markazNote = `المراكز المشمولة: (${selectedMarkazes.join('، ')})`;
    }
    const combinedNotes = [govFormData.notes.trim(), markazNote].filter(Boolean).join(' | ');

    setIsSavingGov(true);
    try {
      if (editingGov) {
        const res = await adminService.updateDeliveryGovernorateSetting(editingGov.id, {
          governorate_name: govFormData.governorate_name.trim(),
          governorate_code: govFormData.governorate_code.trim().toUpperCase(),
          delivery_fee: fee,
          is_active: govFormData.is_active,
          estimated_delivery_time: govFormData.estimated_delivery_time?.trim() || null,
          notes: combinedNotes || null,
        });

        if (res.success) {
          showToast(`تم حفظ تعديل محافظة ${govFormData.governorate_name} بنجاح`, 'success');
          setShowGovModal(false);
          setEditingGov(null);
          loadGovernorates();
        } else {
          showToast(res.error || 'تعذر تحديث إعدادات المحافظة', 'error');
        }
      } else {
        const res = await adminService.addDeliveryGovernorateSetting({
          governorate_name: govFormData.governorate_name.trim(),
          governorate_code: govFormData.governorate_code.trim().toUpperCase(),
          delivery_fee: fee,
          is_active: govFormData.is_active,
          estimated_delivery_time: govFormData.estimated_delivery_time?.trim() || null,
          notes: combinedNotes || null,
        });

        if (res.success) {
          showToast(`تمت إضافة إعدادات محافظة ${govFormData.governorate_name} بنجاح`, 'success');
          setShowGovModal(false);
          loadGovernorates();
        } else {
          showToast(res.error || 'تعذر إضافة المحافظة', 'error');
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'حدث خطأ أثناء الحفظ', 'error');
    } finally {
      setIsSavingGov(false);
    }
  };

  const handleSeedGovernorates = async () => {
    if (!canManage) {
      showToast('ليس لديك صلاحية لتهيئة المحافظات', 'error');
      return;
    }
    setIsSeedingGovs(true);
    try {
      const res = await adminService.seedDefaultGovernorates(settings?.default_delivery_fee || 20);
      if (res.success) {
        showToast(`تمت تهيئة وتحديث ${res.insertedCount} محافظة بنجاح`, 'success');
        loadGovernorates();
      } else {
        showToast(res.error || 'تعذر تهيئة المحافظات', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'حدث خطأ أثناء التهيئة', 'error');
    } finally {
      setIsSeedingGovs(false);
    }
  };

  const handleConfirmDeleteGov = async () => {
    if (!govToDelete || !canManage) return;
    setIsDeletingGov(true);
    try {
      const res = await adminService.deleteDeliveryGovernorateSetting(govToDelete.id);
      if (res.success) {
        showToast(`تم حذف إعدادات محافظة ${govToDelete.governorate_name} بنجاح`, 'success');
        setGovToDelete(null);
        loadGovernorates();
      } else {
        showToast(res.error || 'تعذر حذف المحافظة', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'حدث خطأ أثناء الحذف', 'error');
    } finally {
      setIsDeletingGov(false);
    }
  };

  // General Delivery Settings Submit
  const handleGeneralSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      showToast('ليس لديك صلاحية لتعديل إعدادات التوصيل', 'error');
      return;
    }

    const feeNumber = parseFloat(deliveryFeeInput);
    if (isNaN(feeNumber) || feeNumber < 0) {
      showToast('يرجى إدخال قيمة رسوم صحيحة (أكبر من أو تساوي 0)', 'error');
      return;
    }

    setPendingChanges({
      enabled: deliveryEnabled,
      fee: feeNumber,
    });
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    if (!pendingChanges) return;

    setIsSaving(true);
    setRpcErrorNotice(null);

    try {
      const result = await adminService.updateDeliverySettings(
        pendingChanges.enabled,
        pendingChanges.fee
      );

      if (result.success) {
        showToast('تم حفظ إعدادات الدليفري بنجاح وتحديث النظام', 'success');
        setShowConfirmModal(false);
        setPendingChanges(null);
        await loadSettings();
      } else {
        setRpcErrorNotice(result.error || 'فشل تنفيذ الدالة في Supabase');
        showToast(result.error || 'تعذر حفظ الإعدادات', 'error');
      }
    } catch (err: any) {
      console.error('Exception updating delivery settings:', err);
      const msg = err?.message || 'حدث خطأ غير متوقع أثناء الحفظ';
      setRpcErrorNotice(msg);
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

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
            <h1 className="text-2xl font-black text-white tracking-tight">إعدادات منظومة التوصيل والمحافظات</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Supabase Live
            </span>
          </div>
          <p className="text-xs text-slate-400">
            التحكم في الرسوم الافتراضية، تخصيص أسعار المحافظات المصرية، وتطبيق قواعد تسعير فواتير طلبات البيت.
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
            title="تحديث البيانات من Supabase"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">تحديث</span>
          </button>
        </div>
      </div>

      {/* RLS or RPC Error Alert Notice */}
      {rpcErrorNotice && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start gap-3 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-white">تنبيه في تحديث الإعدادات</h4>
            <p className="leading-relaxed">{rpcErrorNotice}</p>
          </div>
        </div>
      )}

      {/* Main Grid: Settings Form & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form & Governorate Table */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: General Delivery Settings Form */}
          <form
            onSubmit={handleGeneralSubmit}
            className="bg-slate-900/80 p-5 sm:p-6 rounded-3xl border border-slate-800 space-y-6 shadow-xl relative overflow-hidden"
          >
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">الرسوم الافتراضية وحالة الخدمة العامة</h2>
                <p className="text-[11px] text-slate-400">
                  تُطبق هذه الرسوم تلقائياً على أي محافظة غير مدرجة في قائمة المحافظات المخصصة
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Field 1: Master Service Toggle */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Power className={`w-4 h-4 ${deliveryEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
                    حالة خدمة التوصيل العامة
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      deliveryEnabled
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {deliveryEnabled ? 'مفعلة بالكامل' : 'معطلة بالكامل'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  عند تعطيل هذا المفتاح، تتوقف خدمة التوصيل في تطبيق طلبات البيت بكافة المحافظات فوراً.
                </p>

                <label className="flex items-center gap-3 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={deliveryEnabled}
                    onChange={(e) => setDeliveryEnabled(e.target.checked)}
                    disabled={!canManage || isSaving}
                    className="w-5 h-5 rounded-lg text-emerald-500 focus:ring-0 focus:outline-none bg-slate-900 border-slate-700 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-white">تفعيل خدمة التوصيل في التطبيق</span>
                </label>
              </div>

              {/* Field 2: Default Delivery Fee */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="default_fee_input" className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-400" />
                    الرسوم الافتراضية العامة
                  </label>
                  <span className="text-[10px] text-slate-400">للمحافظات غير المخصصة</span>
                </div>

                <div className="relative">
                  <input
                    id="default_fee_input"
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={deliveryFeeInput}
                    onChange={(e) => setDeliveryFeeInput(e.target.value)}
                    disabled={!canManage || isSaving}
                    className="w-full bg-slate-900 text-white font-mono font-bold text-base px-4 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-emerald-500 transition pl-14"
                    placeholder="20"
                  />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    ج.م
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  القيمة الحالية المسجلة في السيرفر: <strong className="text-white font-mono">{settings?.default_delivery_fee ?? 20} ج.م</strong>
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                disabled={!canManage || isSaving || isLoading}
                className="px-6 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري حفظ الرسوم العامة...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>حفظ الرسوم الافتراضية عبر RPC</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Section 2: Governorate Delivery Settings & Fee Rules */}
          <div className="bg-slate-900/80 p-5 sm:p-6 rounded-3xl border border-slate-800 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">إعدادات المحافظات وتخصيص الرسوم</h2>
                  <p className="text-[11px] text-slate-400">
                    جدول <code className="text-emerald-400 font-mono">delivery_governorate_settings</code> (الأولوية القصوى لتطبيق طلبات البيت)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSeedGovernorates}
                  disabled={isSeedingGovs || !canManage}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="إدراج أو تحديث المحافظات المصرية الرئيسية بتسعير قياسي"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSeedingGovs ? 'animate-spin' : ''}`} />
                  <span>تهيئة المحافظات تلقائياً</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  disabled={!canManage}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة محافظة جديدة</span>
                </button>
              </div>
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

            {/* Duplicate Governorates Warning & Quick Merge Banner */}
            {duplicateGroups.length > 0 && (
              <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-bold text-sm text-amber-200 flex items-center gap-2">
                      <span>تم رصد تكرار لمحافظة: {duplicateGroups.map((d) => d.name).join('، ')}</span>
                      <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40">
                        {duplicateGroups.reduce((acc, d) => acc + d.items.length - 1, 0)} سجل زائد
                      </span>
                    </div>
                    <p className="text-xs text-amber-300/80 mt-1 leading-relaxed">
                      محاكي الفواتير وطلبات العملاء تستخدم حالياً السجل المفعل بقيمة 17 ج.م تلقائياً وبأمان. يمكنك الآن بنقرة واحدة دمج السجلات وحذف السجل المكرر من قاعدة البيانات للحفاظ على نظافة البيانات.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleMergeDuplicates}
                  disabled={isMergingDuplicates || !canManage}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shrink-0 transition shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isMergingDuplicates ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  دمج وحذف التكرار الآن
                </button>
              </div>
            )}

            {/* Governorates Table / List */}
            {isLoadingGovs ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
                <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                <span className="text-xs">جاري تحميل إعدادات المحافظات من قاعدة البيانات...</span>
              </div>
            ) : filteredGovs.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/50 rounded-2xl border border-slate-800 space-y-3">
                <MapPin className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-slate-300">لم يتم العثور على محافظات مخصصة</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  يمكنك إضافة تسعير مخصص لكل محافظة أو تهيئة المحافظات المصرية الرسمية بضغطة زر.
                </p>
                {canManage && (
                  <button
                    type="button"
                    onClick={handleSeedGovernorates}
                    disabled={isSeedingGovs}
                    className="mt-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    تهيئة المحافظات المصرية الافتراضية
                  </button>
                )}
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
                      <th className="p-3.5 text-center">حالة التوصيل</th>
                      <th className="p-3.5">ملاحظات ومراكز</th>
                      <th className="p-3.5 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredGovs.map((gov) => {
                      const isInlineEditing = inlineEditingGovId === gov.id;
                      const duplicateGroup = duplicateGroups.find((d) => d.items.some((it) => it.id === gov.id));
                      const isDuplicateRow = Boolean(
                        duplicateGroup && duplicateGroup.items.length > 1 && duplicateGroup.items[0].id !== gov.id
                      );
                      return (
                        <tr key={gov.id} className={`transition ${isDuplicateRow ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-slate-800/30'}`}>
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

                          {/* Quick Fee Editor / Display */}
                          <td className="p-3.5 text-center">
                            {isInlineEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={inlineFeeValue}
                                  onChange={(e) => setInlineFeeValue(e.target.value)}
                                  className="w-16 bg-slate-950 text-white font-mono font-bold text-xs p-1 rounded border border-emerald-500 text-center"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveInlineFee(gov)}
                                  disabled={isSavingInlineFee}
                                  className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                                  title="حفظ"
                                >
                                  {isSavingInlineFee ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInlineEditingGovId(null)}
                                  className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded cursor-pointer"
                                  title="إلغاء"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!canManage) return;
                                  setInlineEditingGovId(gov.id);
                                  setInlineFeeValue(gov.delivery_fee.toString());
                                }}
                                disabled={!canManage}
                                className="font-mono font-black text-emerald-400 text-xs px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition cursor-pointer group"
                                title="انقر للتعديل السريع للرسوم"
                              >
                                <span>{gov.delivery_fee} ج.م</span>
                                <Edit3 className="w-2.5 h-2.5 inline-block mr-1 opacity-0 group-hover:opacity-100 transition" />
                              </button>
                            )}
                          </td>

                          <td className="p-3.5 text-center text-slate-400 text-[11px]">
                            {gov.estimated_delivery_time || '—'}
                          </td>

                          {/* Toggle Active Switch */}
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleGovActive(gov)}
                              disabled={!canManage}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer flex items-center gap-1.5 mx-auto ${
                                gov.is_active
                                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                  : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                              }`}
                              title={
                                gov.is_active
                                  ? 'التوصيل متاح. انقر للتعطيل ومنع التوصيل في هذه المحافظة'
                                  : 'التوصيل معطل تماماً. انقر للتفعيل'
                              }
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  gov.is_active ? 'bg-emerald-400' : 'bg-rose-500'
                                }`}
                              ></span>
                              <span>{gov.is_active ? 'مفعلة (متاح)' : 'معطلة (غير متاح)'}</span>
                            </button>
                          </td>

                          <td className="p-3.5 text-slate-400 text-[11px] max-w-xs truncate" title={gov.notes || ''}>
                            {gov.notes || '—'}
                          </td>

                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(gov)}
                                disabled={!canManage}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition cursor-pointer"
                                title="تعديل المحافظة والمراكز والرسوم"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setGovToDelete(gov)}
                                disabled={!canManage}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition cursor-pointer"
                                title="حذف المحافظة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
      {/* Confirmation Modal for General Delivery Settings             */}
      {/* ------------------------------------------------------------- */}
      {showConfirmModal && pendingChanges && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => {
            if (!isSaving) {
              setShowConfirmModal(false);
              setPendingChanges(null);
            }
          }}
        >
          <div
            className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 overscroll-contain">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">تأكيد تعديل إعدادات الدليفري</h3>
                  <p className="text-xs text-slate-400">سيتم تطبيق التعديلات فوراً على كافة الطلبات والفواتير</p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">حالة الخدمة الجديدة:</span>
                  <span className={`font-bold ${pendingChanges.enabled ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {pendingChanges.enabled ? 'تفعيل الخدمة' : 'إيقاف الخدمة'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">الرسوم الافتراضية الجديدة:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {pendingChanges.fee} ج.م
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">طريقة التنفيذ:</span>
                  <span className="font-mono text-slate-300">RPC: toggle_delivery_service</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end p-4 border-t border-slate-800 bg-slate-950/95 backdrop-blur shrink-0 sticky bottom-0 z-10">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingChanges(null);
                }}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري التنفيذ...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>تأكيد وحفظ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Redesigned Add / Edit Governorate Modal                       */}
      {/* ------------------------------------------------------------- */}
      {showGovModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => !isSavingGov && setShowGovModal(false)}
        >
          <div
            className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-lg w-full shadow-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:p-5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingGov ? 'تعديل إعدادات المحافظة والمراكز' : 'إضافة محافظة جديدة للتوصيل'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingGov ? editingGov.governorate_name : 'تخصيص تسعير ومراكز المحافظة — تُحفظ المسودة عند الإغلاق'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGovModal(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGov} className="flex flex-col flex-1 min-h-0 text-xs">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                {/* Duplicate Alert if already registered */}
                {isSelectedGovDuplicate && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      تنبيه: محافظة <strong>{govFormData.governorate_name}</strong> مسجلة مسبقاً في النظام. لمنع التكرار، يرجى تعديل السجل الموجود في الجدول.
                    </span>
                  </div>
                )}

                {/* Dropdown 1: Country Selection */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-bold block">1. الدولة (Country) *</label>
                  <select
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="w-full bg-slate-950 text-white px-3.5 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 text-xs"
                  >
                    <option value="EG">مصر (Egypt) - جمهورية مصر العربية</option>
                  </select>
                </div>

                {/* Dropdown 2: Official Egyptian Governorates */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-bold block">2. المحافظة الرسمية (Governorate) *</label>
                  <select
                    value={selectedGovCode}
                    onChange={(e) => handleSelectOfficialGov(e.target.value)}
                    disabled={Boolean(editingGov)}
                    className="w-full bg-slate-950 text-white px-3.5 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 text-xs disabled:opacity-75"
                  >
                    {EGYPT_GOVERNORATES.map((gov) => {
                      const isAlreadyAdded = !editingGov && governorates.some(
                        (g) => g.governorate_code?.toUpperCase() === gov.code.toUpperCase()
                      );
                      return (
                        <option key={gov.code} value={gov.code}>
                          {gov.name_ar} ({gov.name_en}) {isAlreadyAdded ? '— [مسجلة بالفعل]' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Auto-filled Governorate Code */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-bold block">كود المحافظة التلقائي</label>
                    <input
                      type="text"
                      readOnly
                      value={govFormData.governorate_code}
                      className="w-full bg-slate-950/70 text-emerald-400 font-mono font-bold px-3.5 py-2 rounded-xl border border-slate-800 text-xs pointer-events-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-bold block">الاسم المعتمد</label>
                    <input
                      type="text"
                      readOnly
                      value={govFormData.governorate_name}
                      className="w-full bg-slate-950/70 text-white font-bold px-3.5 py-2 rounded-xl border border-slate-800 text-xs pointer-events-none"
                    />
                  </div>
                </div>

                {/* Multi-Select 3: Markazes (Centers) */}
                <div className="space-y-2 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-bold block">
                      3. المراكز والأحياء التابعة لمحافظة {currentOfficialGov.name_ar}:
                    </label>
                    <button
                      type="button"
                      onClick={toggleSelectAllMarkazes}
                      className="text-[11px] text-emerald-400 hover:underline font-bold cursor-pointer"
                    >
                      {selectAllMarkazes ? 'إلغاء تحديد الكل' : 'تحديد جميع المراكز'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                    {currentOfficialGov.markazes.map((markaz) => {
                      const isSelected = selectedMarkazes.includes(markaz);
                      return (
                        <button
                          key={markaz}
                          type="button"
                          onClick={() => toggleMarkazSelection(markaz)}
                          className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer flex items-center gap-1 ${
                            isSelected
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                          }`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Square className="w-3 h-3 text-slate-500" />
                          )}
                          <span>{markaz}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    تم تحديد {selectedMarkazes.length} من أصل {currentOfficialGov.markazes.length} مركز.
                  </p>
                </div>

                {/* Inputs 4 & 5: Fee & Estimated Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-bold block">4. رسوم التوصيل (ج.م) *</label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.5"
                        value={govFormData.delivery_fee}
                        onChange={(e) => setGovFormData({ ...govFormData, delivery_fee: e.target.value })}
                        placeholder="17"
                        className="w-full bg-slate-950 text-white font-mono font-bold px-3.5 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 text-xs pl-12"
                      />
                      <span className="absolute left-3 top-2.5 text-[11px] text-slate-400 font-bold pointer-events-none">
                        ج.م
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-bold block">5. وقت التوصيل المتوقع (اختياري)</label>
                    <input
                      type="text"
                      value={govFormData.estimated_delivery_time}
                      onChange={(e) =>
                        setGovFormData({ ...govFormData, estimated_delivery_time: e.target.value })
                      }
                      placeholder="مثال: 45-60 دقيقة"
                      className="w-full bg-slate-950 text-white px-3.5 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                  </div>
                </div>

                {/* 6. Active Toggle */}
                <div className="pt-1 flex items-center justify-between bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                  <label className="text-slate-200 font-bold flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={govFormData.is_active}
                      onChange={(e) => setGovFormData({ ...govFormData, is_active: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-0 focus:outline-none bg-slate-950 border-slate-800 cursor-pointer"
                    />
                    <span>6. تفعيل خدمة التوصيل لمحافظة {govFormData.governorate_name}</span>
                  </label>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      govFormData.is_active
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {govFormData.is_active ? 'مفعلة' : 'معطلة'}
                  </span>
                </div>

                {/* 7. Notes */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-bold block">7. ملاحظات إضافية</label>
                  <input
                    type="text"
                    value={govFormData.notes}
                    onChange={(e) => setGovFormData({ ...govFormData, notes: e.target.value })}
                    placeholder="ملاحظات حول السائقين أو التوصيل السريع..."
                    className="w-full bg-slate-950 text-white px-3.5 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center gap-2.5 justify-end p-4 border-t border-slate-800 bg-slate-950/95 backdrop-blur shrink-0 sticky bottom-0 z-10">
                <button
                  type="button"
                  onClick={() => {
                    setShowGovModal(false);
                  }}
                  disabled={isSavingGov}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  إغلاق
                </button>
                <button
                  type="submit"
                  disabled={isSavingGov || isSelectedGovDuplicate}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSavingGov ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الحفظ في قاعدة البيانات...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{editingGov ? 'حفظ التعديلات' : 'إضافة المحافظة'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Delete Governorate Confirmation Modal                         */}
      {/* ------------------------------------------------------------- */}
      {govToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => !isDeletingGov && setGovToDelete(null)}
        >
          <div
            className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 overscroll-contain">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20 shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">تأكيد حذف إعدادات المحافظة</h3>
                  <p className="text-xs text-slate-400">سيتم حذف تخصيص الرسوم والعودة للرسوم الافتراضية</p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">المحافظة:</span>
                  <span className="font-bold text-white">{govToDelete.governorate_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">رسوم التوصيل الحالية:</span>
                  <span className="font-mono font-bold text-emerald-400">{govToDelete.delivery_fee} ج.م</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end p-4 border-t border-slate-800 bg-slate-950/95 backdrop-blur shrink-0 sticky bottom-0 z-10">
              <button
                type="button"
                onClick={() => setGovToDelete(null)}
                disabled={isDeletingGov}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteGov}
                disabled={isDeletingGov}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isDeletingGov ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تأكيد الحذف</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
