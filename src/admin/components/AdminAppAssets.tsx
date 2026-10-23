import React, { useState, useEffect, useRef } from 'react';
import { useAdmin } from '../context/AdminContext';
import { adminService } from '../services/adminService';
import {
  getLatestConfirmedLocalAsset,
  syncAdminAssetsInBackground,
} from '../services/appAssetCacheService';
import {
  AllAppAssetsMap,
  AppAssetKey,
  AppAssetRecord,
  AppAssetType,
  AppAssetUploadRecord,
} from '../types';
import {
  Image as ImageIcon,
  Upload,
  RefreshCw,
  CheckCircle2,
  Clock,
  HardDrive,
  FileImage,
  Hash,
  ShieldCheck,
  AlertTriangle,
  Database,
  Home,
  Bike,
  LayoutDashboard,
  History,
  ChevronDown,
} from 'lucide-react';

function formatBytes(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || isNaN(Number(bytes)) || Number(bytes) <= 0) {
    return 'غير متوفر';
  }
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return 'لم يتم التحديث بعد';
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

interface AppGroupConfig {
  appKey: AppAssetKey;
  titleAr: string;
  subtitleAr: string;
  badgeColor: string;
  borderAccent: string;
  icon: any;
  slots: Record<
    AppAssetType,
    {
      titleAr: string;
      descriptionAr: string;
    }
  >;
}

const APP_ASSET_GROUPS: AppGroupConfig[] = [
  {
    appKey: 'home',
    titleAr: '1. تطبيق طلبات البيت',
    subtitleAr: 'إدارة صور الهيدر وشاشة البداية الخاصة بتطبيق المستخدمين والأسر (app_key = home)',
    badgeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    borderAccent: 'border-blue-500/30',
    icon: Home,
    slots: {
      header: {
        titleAr: 'صورة الهيدر — تطبيق طلبات البيت',
        descriptionAr:
          'تُعرض في الشريط العلوي لتطبيق طلبات البيت (home/header). تُحدّث مركزيًا عبر جدول app_assets.',
      },
      splash: {
        titleAr: 'صورة شاشة البداية — تطبيق طلبات البيت',
        descriptionAr:
          'تُعرض عند بدء تشغيل تطبيق طلبات البيت (home/splash) من آخر نسخة مؤكدة محليًا وتُحدّث في الخلفية.',
      },
    },
  },
  {
    appKey: 'driver',
    titleAr: '2. تطبيق الدليفري',
    subtitleAr: 'إدارة صور الهيدر وشاشة البداية الخاصة بتطبيق مناديب التوصيل (app_key = driver)',
    badgeColor: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
    borderAccent: 'border-teal-500/30',
    icon: Bike,
    slots: {
      header: {
        titleAr: 'صورة الهيدر — تطبيق الدليفري',
        descriptionAr:
          'تُعرض في الشريط العلوي لتطبيق مناديب الدليفري (driver/header). تُحدّث مركزيًا عبر جدول app_assets.',
      },
      splash: {
        titleAr: 'صورة شاشة البداية — تطبيق الدليفري',
        descriptionAr:
          'تُعرض عند بدء تشغيل تطبيق الدليفري (driver/splash) من آخر نسخة مؤكدة محليًا وتُحدّث في الخلفية.',
      },
    },
  },
  {
    appKey: 'admin',
    titleAr: '3. لوحة التحكم الإدارية',
    subtitleAr: 'إدارة صور الهيدر وشاشة البداية الخاصة بلوحة التحكم الإدارية (app_key = admin)',
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    borderAccent: 'border-emerald-500/30',
    icon: LayoutDashboard,
    slots: {
      header: {
        titleAr: 'صورة الهيدر — لوحة التحكم الإدارية',
        descriptionAr:
          'تُعرض في الشريط العلوي للوحة التحكم الإدارية وشاشة الدخول (admin/header). تُطبّق فورًا عند تحديثها واعتمادها.',
      },
      splash: {
        titleAr: 'صورة شاشة البداية — لوحة التحكم الإدارية',
        descriptionAr:
          'تُعرض فورًا من الذاكرة المحلية المؤكدة عند بدء تشغيل لوحة الإدارة (admin/splash)، ويُطبّق الإصدار الجديد في التشغيل التالي.',
      },
    },
  },
];

interface AppAssetSlotCardProps {
  appKey: AppAssetKey;
  assetType: AppAssetType;
  titleAr: string;
  descriptionAr: string;
  badgeColor: string;
  record: AppAssetRecord | null;
  slotUploadsHistory: AppAssetUploadRecord[];
  canManageAssets: boolean;
  isUploading: boolean;
  errorMsg: string | null;
  onSelectFile: (appKey: AppAssetKey, assetType: AppAssetType, file: File) => Promise<void> | void;
}

const AppAssetSlotCard: React.FC<AppAssetSlotCardProps> = ({
  appKey,
  assetType,
  titleAr,
  descriptionAr,
  badgeColor,
  record,
  slotUploadsHistory,
  canManageAssets,
  isUploading,
  errorMsg,
  onSelectFile,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [showSlotHistory, setShowSlotHistory] = useState(false);

  const slotCode = `${appKey}/${assetType}`;
  const localConfirmed = appKey === 'admin' ? getLatestConfirmedLocalAsset(assetType) : null;
  const upload = record?.upload || slotUploadsHistory.find((u) => u.is_current) || null;

  const previewUrl =
    upload?.public_url ||
    localConfirmed?.local_data_url ||
    localConfirmed?.public_url ||
    null;

  const currentVersion = record?.version ?? localConfirmed?.version ?? 0;
  const isActive = record ? record.is_active !== false : Boolean(upload);

  const filename =
    upload?.original_filename ||
    localConfirmed?.original_filename ||
    (upload?.storage_path ? upload.storage_path.split('/').pop() : null) ||
    'لم يتم رفع ملف مخصص بعد';

  const fileSize =
    upload?.file_size_bytes ??
    upload?.file_size ??
    localConfirmed?.file_size_bytes ??
    null;

  const width = upload?.width ?? localConfirmed?.width ?? null;
  const height = upload?.height ?? localConfirmed?.height ?? null;
  const dimensionsText = width && height ? `${width} × ${height} px` : 'غير متوفر';
  const lastUpdated =
    record?.updated_at || upload?.created_at || localConfirmed?.updated_at || null;
  const storagePath =
    upload?.storage_path || localConfirmed?.storage_path || `${appKey}/${assetType}/<uuid>.<ext>`;

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await onSelectFile(appKey, assetType, file);
    } finally {
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  return (
    <div className="bg-slate-900/90 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
      {/* Card Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2.5 py-0.5 rounded-lg border font-mono text-xs font-bold ${badgeColor}`}
              dir="ltr"
            >
              {slotCode}
            </span>
            <span className="px-2.5 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 font-mono text-xs font-black">
              Version: {currentVersion}
            </span>
            {previewUrl && isActive ? (
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>مفعّلة (Current)</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-400 text-[11px] font-semibold">
                الوضع الافتراضي (Fallback)
              </span>
            )}
          </div>
          <h4 className="text-base font-black text-white pt-1">{titleAr}</h4>
          <p className="text-xs text-slate-400 leading-relaxed">{descriptionAr}</p>
        </div>

        <div className="w-10 h-10 rounded-2xl bg-slate-950 border border-slate-800 text-emerald-400 flex items-center justify-center shrink-0">
          <ImageIcon className="w-5 h-5" />
        </div>
      </div>

      {/* Current Image Preview Area */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-300">المعاينة الحالية:</span>
          <span className="font-mono text-[11px] text-slate-400" dir="ltr">
            {assetType === 'header' ? 'Header Slot' : 'Splash Slot'}
          </span>
        </div>

        <div
          className={`relative rounded-2xl border border-slate-800 bg-slate-950/90 overflow-hidden flex items-center justify-center ${
            assetType === 'header' ? 'h-40' : 'h-52'
          }`}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={titleAr}
              className="max-h-full max-w-full object-contain p-3 transition-transform duration-200"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-4 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-lg">
                ط
              </div>
              <span className="text-xs font-bold text-slate-400">
                لا توجد صورة مرفوعة في {slotCode} حالياً
              </span>
              <span className="text-[11px] text-slate-500">
                يستخدم التطبيق الشعار المدمج الافتراضي حتى يتم رفع صورة مركزية
              </span>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center space-y-2 text-white p-4 text-center">
              <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin" />
              <span className="text-xs font-bold text-emerald-300">
                جاري رفع الصورة إلى {slotCode} وتحديث السجل المركزي وزيادة الإصدار...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Metadata Grid: Filename, File Size, Dimensions, Last Updated, Version */}
      <div className="grid grid-cols-2 gap-2.5 text-xs">
        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/90 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <FileImage className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>اسم الملف:</span>
          </div>
          <span className="font-bold text-white block truncate" title={filename}>
            {filename}
          </span>
        </div>

        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/90 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <HardDrive className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>حجم الملف:</span>
          </div>
          <span className="font-mono font-bold text-slate-200 block">
            {formatBytes(fileSize)}
          </span>
        </div>

        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/90 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <ImageIcon className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span>الأبعاد (Dimensions):</span>
          </div>
          <span className="font-mono font-bold text-slate-200 block" dir="ltr">
            {dimensionsText}
          </span>
        </div>

        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/90 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>تاريخ آخر تحديث:</span>
          </div>
          <span className="font-bold text-slate-200 block">{formatDateTime(lastUpdated)}</span>
        </div>

        <div className="col-span-2 p-3 bg-slate-950 rounded-2xl border border-slate-800/90 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Hash className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>رقم الإصدار الحالي (app_assets.version):</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-black text-emerald-400 text-sm">
              Version {currentVersion}
            </span>
            {localConfirmed && (
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                محليًا: v{localConfirmed.version}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Storage Path Info */}
      <div className="px-3.5 py-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-slate-400 shrink-0">مسار التخزين (app-assets):</span>
        <span className="font-mono text-slate-300 truncate" dir="ltr">
          {storagePath}
        </span>
      </div>

      {/* Error Banner if Upload Failed */}
      {errorMsg && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Upload / Replace Action Button */}
      <div className="pt-1">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif,.png,.jpg,.jpeg,.webp,.svg,.gif"
          onChange={handleInputChange}
          className="hidden"
        />
        <button
          type="button"
          disabled={isUploading || !canManageAssets}
          onClick={() => {
            if (inputRef.current) {
              inputRef.current.value = '';
              inputRef.current.click();
            }
          }}
          className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {isUploading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>جاري الرفع والاعتماد...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span>{previewUrl ? 'رفع / استبدال الصورة الحالية' : 'رفع صورة جديدة'}</span>
            </>
          )}
        </button>
      </div>

      {/* Per-Slot Upload History Accordion */}
      <div className="border-t border-slate-800/80 pt-3">
        <button
          type="button"
          onClick={() => setShowSlotHistory((prev) => !prev)}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-emerald-400" />
            <span>سجل الرفع السابق لـ ({slotCode})</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 font-mono text-[10px] text-slate-300">
              {slotUploadsHistory.length}
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${showSlotHistory ? 'rotate-180' : ''}`}
          />
        </button>

        {showSlotHistory && (
          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
            {slotUploadsHistory.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/70 text-[11px] text-slate-500 text-center">
                لا توجد عمليات رفع مسجلة لـ {slotCode} حتى الآن
              </div>
            ) : (
              slotUploadsHistory.map((up) => (
                <div
                  key={up.id}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-2 text-[11px]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                      {up.public_url ? (
                        <img
                          src={up.public_url}
                          alt={up.original_filename || slotCode}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-slate-200 block truncate">
                        {up.original_filename || up.storage_path.split('/').pop()}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        {formatBytes(up.file_size_bytes ?? up.file_size)}
                        {up.width && up.height ? ` · ${up.width}×${up.height}` : ''} ·{' '}
                        {formatDateTime(up.created_at)}
                      </span>
                    </div>
                  </div>
                  {up.is_current ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-[10px] shrink-0">
                      الحالية
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] shrink-0">
                      سابقة
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const AdminAppAssets: React.FC = () => {
  const { hasPermission, showToast, activeSection, setActiveSection, refreshAppAssets } = useAdmin();

  const [assetsByApp, setAssetsByApp] = useState<AllAppAssetsMap>({
    home: { header: null, splash: null },
    driver: { header: null, splash: null },
    admin: { header: null, splash: null },
  });
  const [uploadsHistory, setUploadsHistory] = useState<AppAssetUploadRecord[]>([]);
  const [historyFilterApp, setHistoryFilterApp] = useState<'all' | AppAssetKey>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingSlotKey, setUploadingSlotKey] = useState<string | null>(null);
  const [slotErrors, setSlotErrors] = useState<Record<string, string | null>>({});

  const canManageAssets = hasPermission('settings.manage');

  const loadAssets = async () => {
    setIsLoading(true);
    try {
      const res = await adminService.getAllAppAssets();
      setAssetsByApp(res.assetsByApp);
      setUploadsHistory(res.uploadsHistory || []);
    } catch (e) {
      console.warn('Error loading all app assets:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const handleSelectFile = async (
    appKey: AppAssetKey,
    assetType: AppAssetType,
    file: File
  ) => {
    if (!canManageAssets) {
      showToast('ليس لديك صلاحية تعديل صور التطبيق', 'error');
      return;
    }

    const slotKey = `${appKey}/${assetType}`;
    setSlotErrors((prev) => ({ ...prev, [slotKey]: null }));
    setUploadingSlotKey(slotKey);

    try {
      const res = await adminService.uploadAppAsset(appKey, assetType, file);
      if (!res.success || !res.asset) {
        const errMsg = res.error || 'فشل رفع الصورة وتحديث السجل المركزي';
        setSlotErrors((prev) => ({ ...prev, [slotKey]: errMsg }));
        showToast(errMsg, 'error');
        return;
      }

      setAssetsByApp((prev) => ({
        ...prev,
        [appKey]: {
          ...prev[appKey],
          [assetType]: res.asset!,
        },
      }));

      if (appKey === 'admin') {
        await refreshAppAssets();
      }
      await loadAssets();

      showToast(
        `تم رفع وتحديث الصورة (${slotKey}) بنجاح — الإصدار الحالي v${res.asset.version}`,
        'success'
      );
    } catch (err: any) {
      const errMsg = err?.message || 'حدث خطأ غير متوقع أثناء الرفع';
      setSlotErrors((prev) => ({ ...prev, [slotKey]: errMsg }));
      showToast(errMsg, 'error');
    } finally {
      setUploadingSlotKey(null);
    }
  };

  const handleManualSync = async () => {
    setIsLoading(true);
    try {
      await syncAdminAssetsInBackground();
      await refreshAppAssets();
      await loadAssets();
      showToast('تم فحص ومزامنة صور التطبيقات الثلاثة من النظام المركزي (app_assets)', 'success');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUploadsHistory =
    historyFilterApp === 'all'
      ? uploadsHistory
      : uploadsHistory.filter((u) => u.app_key === historyFilterApp);

  return (
    <div className="space-y-8 animate-in fade-in duration-200" dir="rtl">
      {/* Top Header & Navigation Tabs */}
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              إدارة صور التطبيقات المركزية (app_assets)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              الإدارة المركزية الموحدة لصور الهيدر (Header) وشاشة البداية (Splash) لتطبيق طلبات البيت، تطبيق الدليفري، ولوحة التحكم الإدارية.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveSection('settings')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeSection === 'settings'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              إعدادات النظام و Supabase
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('app_assets')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeSection === 'app_assets'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              إدارة صور التطبيق
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('settings_rls')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeSection === 'settings_rls'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              الأمان والحماية (RLS)
            </button>
          </div>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isLoading}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center space-x-1.5 space-x-reverse cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>مزامنة وفحص الإصدارات</span>
          </button>
        </div>
      </div>

      {/* Central Architecture Summary Strip */}
      <div className="bg-slate-900/70 rounded-2xl p-4 border border-slate-800/90 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-slate-300">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <span className="font-bold text-white">
              الربط المركزي الموحد (app_assets + app_asset_uploads + app-assets):{' '}
            </span>
            <span>
              تُدار هنا صور التطبيقات الثلاثة (<code className="text-blue-400 font-mono">home</code>،{' '}
              <code className="text-teal-400 font-mono">driver</code>،{' '}
              <code className="text-emerald-400 font-mono">admin</code>) للنوعين (
              <code className="text-amber-400 font-mono">header</code> و{' '}
              <code className="text-amber-400 font-mono">splash</code>) مع زيادة{' '}
              <code className="text-emerald-400 font-mono">version</code> ذريًا بعد نجاح الرفع فقط.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-blue-400">
            home (2)
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-teal-400">
            driver (2)
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-400">
            admin (2)
          </span>
          <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300">
            Bucket: app-assets
          </span>
        </div>
      </div>

      {/* 3 Application Groups (home, driver, admin) × 2 Asset Slots (header, splash) = 6 Cards */}
      <div className="space-y-8">
        {APP_ASSET_GROUPS.map((group) => {
          const GroupIcon = group.icon;
          const appAssets = assetsByApp[group.appKey];

          return (
            <section
              key={group.appKey}
              className={`bg-slate-950/50 rounded-3xl p-4 sm:p-6 border ${group.borderAccent} space-y-5`}
            >
              {/* Group Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${group.badgeColor}`}
                  >
                    <GroupIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-black text-white">
                        {group.titleAr}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-lg border font-mono text-xs font-bold ${group.badgeColor}`}
                        dir="ltr"
                      >
                        app_key: {group.appKey}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{group.subtitleAr}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
                    {group.appKey}/header:{' '}
                    <strong className="text-emerald-400">
                      v{appAssets.header?.version ?? 0}
                    </strong>
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
                    {group.appKey}/splash:{' '}
                    <strong className="text-emerald-400">
                      v{appAssets.splash?.version ?? 0}
                    </strong>
                  </span>
                </div>
              </div>

              {/* 2 Cards per App: header & splash */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {(['header', 'splash'] as AppAssetType[]).map((assetType) => {
                  const slotKey = `${group.appKey}/${assetType}`;
                  const slotHistory = uploadsHistory.filter(
                    (u) => u.app_key === group.appKey && u.asset_type === assetType
                  );

                  return (
                    <AppAssetSlotCard
                      key={slotKey}
                      appKey={group.appKey}
                      assetType={assetType}
                      titleAr={group.slots[assetType].titleAr}
                      descriptionAr={group.slots[assetType].descriptionAr}
                      badgeColor={group.badgeColor}
                      record={appAssets[assetType]}
                      slotUploadsHistory={slotHistory}
                      canManageAssets={canManageAssets}
                      isUploading={uploadingSlotKey === slotKey}
                      errorMsg={slotErrors[slotKey] || null}
                      onSelectFile={handleSelectFile}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Comprehensive Uploads History Table across all 3 apps */}
      <div className="bg-slate-900/90 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              سجل الرفع المركزي الشامل (app_asset_uploads)
            </h3>
            <span className="text-xs font-mono text-slate-400">
              ({filteredUploadsHistory.length} سجل)
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            {(
              [
                { id: 'all', label: 'الكل (All)' },
                { id: 'home', label: 'طلبات البيت (home)' },
                { id: 'driver', label: 'الدليفري (driver)' },
                { id: 'admin', label: 'لوحة الإدارة (admin)' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setHistoryFilterApp(tab.id)}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  historyFilterApp === tab.id
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredUploadsHistory.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/60 rounded-2xl border border-slate-800/70">
            لا توجد سجلات رفع سابقة في جدول{' '}
            <code className="font-mono text-slate-400">app_asset_uploads</code> ضمن هذا الفلتر حتى الآن.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">التطبيق والنوع</th>
                  <th className="py-2.5 px-3">معاينة</th>
                  <th className="py-2.5 px-3">اسم الملف الأصلي</th>
                  <th className="py-2.5 px-3">مسار التخزين (storage_path)</th>
                  <th className="py-2.5 px-3">الحجم والأبعاد</th>
                  <th className="py-2.5 px-3">الحالة (is_current)</th>
                  <th className="py-2.5 px-3">تاريخ الرفع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUploadsHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-950/50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-400" dir="ltr">
                      {item.app_key}/{item.asset_type}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden">
                        {item.public_url ? (
                          <img
                            src={item.public_url}
                            alt={item.original_filename || item.asset_type}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white max-w-[160px] truncate">
                      {item.original_filename || '—'}
                    </td>
                    <td
                      className="py-2.5 px-3 font-mono text-[11px] text-slate-400 max-w-[220px] truncate"
                      dir="ltr"
                    >
                      {item.storage_path}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">
                      {formatBytes(item.file_size_bytes ?? item.file_size)}
                      {item.width && item.height ? ` (${item.width}×${item.height})` : ''}
                    </td>
                    <td className="py-2.5 px-3">
                      {item.is_current ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-[11px]">
                          الحالية (Current)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-400 text-[11px]">
                          سابقة
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {formatDateTime(item.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
