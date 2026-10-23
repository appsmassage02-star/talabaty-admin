import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdmin } from '../context/AdminContext';
import { adminService } from '../services/adminService';
import {
  PharmacyStatsSummary,
  PharmacyOrder,
  PharmacyOrderItem,
  PharmacyOrderFile,
  PharmacyDeliveryOrder,
  PharmacyOrderStatusHistory,
  PharmacyOrderChangeLog,
  PharmacySavedPrescription,
  PharmacySettingsRecord,
  PharmacyDisplayWidth,
  PharmacyDeliveryAreaSetting,
  PharmacyDirectoryRecord,
  PharmacyUserPharmacyRecord,
  DeliveryDriver,
} from '../types';
import { EGYPT_GOVERNORATES } from '../utils/egyptLocations';
import {
  Pill,
  FileText,
  Store,
  Sliders,
  RefreshCw,
  Search,
  Filter,
  Eye,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Bike,
  User,
  Phone,
  MapPin,
  Receipt,
  Image as ImageIcon,
  Download,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  Plus,
  Edit3,
  Trash2,
  Save,
  Power,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  History,
  ClipboardList,
  Check,
  Ban,
  Building2,
  Calendar,
  Layers,
  Maximize2,
} from 'lucide-react';

type PharmacyTabId =
  | 'pharmacy_orders'
  | 'pharmacy_prescriptions'
  | 'pharmacy_pharmacies'
  | 'pharmacy_settings';

const STATUS_LABELS: Record<string, { label: string; badgeClass: string }> = {
  pending: {
    label: 'قيد الانتظار',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  pending_review: {
    label: 'قيد المراجعة',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  new: {
    label: 'طلب جديد',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
  accepted: {
    label: 'تم القبول وإسناد مندوب',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  },
  shopping: {
    label: 'جاري تجهيز وصرف الأدوية',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  },
  in_delivery: {
    label: 'جاري التوصيل للعميل',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  },
  delivering: {
    label: 'جاري التوصيل',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  },
  completed: {
    label: 'مكتمل وتم التسليم',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  cancelled: {
    label: 'ملغي',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
  cancellation_pending: {
    label: 'بانتظار البت في إلغاء المندوب',
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  },
};

function getPharmacyStatusMeta(status?: string | null) {
  const key = (status || '').trim().toLowerCase();
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  return {
    label: status || 'غير محدد',
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
  };
}

function formatDateTimeAr(iso?: string | null) {
  if (!iso) return '—';
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

interface PharmacyAttachmentPreviewProps {
  storagePath: string;
  title: string;
  subtitle?: string;
  mimeType?: string | null;
  fileTypeBadge?: string;
  driverNote?: string | null;
  onOpenLightbox: (item: {
    storagePath: string;
    title: string;
    mimeType?: string | null;
    driverNote?: string | null;
  }) => void;
}

/**
 * Reusable Attachment Card for private `pharmacy` Storage bucket files
 * Automatically creates a Signed URL, supports refreshing expired links,
 * downloading, opening in full-screen zoom modal, and diagnosing missing files.
 */
const PharmacyAttachmentCard: React.FC<PharmacyAttachmentPreviewProps> = ({
  storagePath,
  title,
  subtitle,
  mimeType,
  fileTypeBadge,
  driverNote,
  onOpenLightbox,
}) => {
  const { showToast } = useAdmin();
  const [loadingUrl, setLoadingUrl] = useState(true);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [normalizedPath, setNormalizedPath] = useState<string>(storagePath);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMissingFile, setIsMissingFile] = useState(false);
  const [imgRenderError, setImgRenderError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const resolveUrl = useCallback(async () => {
    setLoadingUrl(true);
    setErrorMsg(null);
    setImgRenderError(false);
    const res = await adminService.getPharmacyFileSignedUrl(storagePath, 3600);
    setNormalizedPath(res.normalizedPath || storagePath);
    if (res.success && res.signedUrl) {
      setSignedUrl(res.signedUrl);
      setIsMissingFile(false);
    } else {
      setSignedUrl(null);
      setIsMissingFile(Boolean(res.isMissingFile));
      setErrorMsg(res.error || 'تعذر توليد رابط معاينة الملف');
    }
    setLoadingUrl(false);
  }, [storagePath]);

  useEffect(() => {
    resolveUrl();
  }, [resolveUrl]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await adminService.downloadPharmacyFile(storagePath);
      if (!res.success || !res.blob) {
        showToast(res.error || 'تعذر تنزيل المرفق من التخزين', 'error');
        return;
      }
      const objUrl = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = objUrl;
      const fileName = normalizedPath.split('/').pop() || `pharmacy-attachment-${Date.now()}`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
      showToast('تم تنزيل المرفق بنجاح', 'success');
    } finally {
      setIsDownloading(false);
    }
  };

  const isPdf =
    (mimeType && mimeType.toLowerCase().includes('pdf')) ||
    normalizedPath.toLowerCase().endsWith('.pdf');

  return (
    <div className="bg-slate-950/90 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between">
      {/* Preview Viewport */}
      <div className="relative h-44 bg-slate-900 flex items-center justify-center overflow-hidden border-b border-slate-800/80">
        {fileTypeBadge && (
          <span className="absolute top-2.5 right-2.5 z-10 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-950/85 text-emerald-300 border border-emerald-500/30 backdrop-blur-sm">
            {fileTypeBadge}
          </span>
        )}

        {loadingUrl ? (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
            <span className="text-[11px]">جاري إنشاء رابط موقّع من البكت الخاص...</span>
          </div>
        ) : signedUrl && !imgRenderError ? (
          isPdf ? (
            <div className="flex flex-col items-center gap-2 text-slate-300 p-4 text-center">
              <FileText className="w-10 h-10 text-emerald-400" />
              <span className="text-xs font-bold">مستند PDF مرفق</span>
              <span className="text-[10px] text-slate-400 font-mono dir-ltr truncate max-w-[220px]">
                {normalizedPath}
              </span>
            </div>
          ) : (
            <img
              src={signedUrl}
              alt={title}
              onClick={() =>
                onOpenLightbox({
                  storagePath,
                  title,
                  mimeType,
                  driverNote,
                })
              }
              onError={() => {
                setImgRenderError(true);
                setErrorMsg(
                  'تعذر عرض الصورة؛ قد تكون صلاحية الرابط الموقّع قد انتهت أو أن الملف غير مكتمل في البكت الخاص (pharmacy).'
                );
              }}
              className="w-full h-full object-contain cursor-pointer hover:scale-105 transition-transform duration-200"
            />
          )
        ) : (
          <div className="p-4 text-center space-y-2 max-w-xs">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-bold text-amber-300 leading-relaxed">
              {isMissingFile
                ? 'سجل المرفق موجود في قاعدة البيانات، لكن الملف الفعلي غير موجود في مساحة التخزين (Bucket: pharmacy) أو لم تكتمل عملية رفعه.'
                : errorMsg || 'تعذر تحميل معاينة المرفق'}
            </p>
            <p className="text-[10px] text-slate-500 font-mono dir-ltr break-all">
              {normalizedPath}
            </p>
          </div>
        )}
      </div>

      {/* Metadata & Actions */}
      <div className="p-3.5 space-y-2.5">
        <div>
          <div className="text-xs font-bold text-white truncate">{title}</div>
          {subtitle && <div className="text-[11px] text-slate-400">{subtitle}</div>}
          <div
            className="text-[10px] text-slate-500 font-mono truncate mt-0.5"
            dir="ltr"
            title={normalizedPath}
          >
            pharmacy/{normalizedPath}
          </div>
        </div>

        {driverNote && (
          <div className="p-2 rounded-xl bg-amber-950/30 border border-amber-500/20 text-[11px] text-amber-200">
            <span className="font-bold">ملاحظة المندوب: </span>
            {driverNote}
          </div>
        )}

        <div className="flex items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() =>
              onOpenLightbox({
                storagePath,
                title,
                mimeType,
                driverNote,
              })
            }
            className="flex-1 py-1.5 px-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>تكبير ومعاينة</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
            title="تنزيل الملف"
          >
            {isDownloading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={resolveUrl}
            disabled={loadingUrl}
            className="py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold flex items-center justify-center cursor-pointer transition-colors"
            title="تحديث الرابط الموقّع (Signed URL)"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingUrl ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

export const AdminPharmacyManagement: React.FC = () => {
  const { activeSection, setActiveSection, hasPermission, showToast, sectionFilter, clearSectionFilter } = useAdmin();

  const canViewDelivery = hasPermission('delivery.view');
  const canManageDelivery = hasPermission('delivery.manage');
  const canManageSettings = hasPermission('settings.manage');

  // Synchronize internal tab with sidebar navigation item
  const currentTab: PharmacyTabId = useMemo(() => {
    if (
      activeSection === 'pharmacy_orders' ||
      activeSection === 'pharmacy_prescriptions' ||
      activeSection === 'pharmacy_pharmacies' ||
      activeSection === 'pharmacy_settings'
    ) {
      return activeSection;
    }
    return 'pharmacy_orders';
  }, [activeSection]);

  const handleSelectTab = (tab: PharmacyTabId) => {
    setActiveSection(tab);
  };

  // ============================================================================
  // 1. Overview Stats State
  // ============================================================================
  const [stats, setStats] = useState<PharmacyStatsSummary | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const loadStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const res = await adminService.getPharmacyStatsSummary();
      setStats(res.stats);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  // ============================================================================
  // 2. Pharmacy Orders State (`pharmacy_orders`)
  // ============================================================================
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [ordersTotalCount, setOrdersTotalCount] = useState(0);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [availableGovernorates, setAvailableGovernorates] = useState<string[]>([]);
  const [availableCenters, setAvailableCenters] = useState<string[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [orderStatusFilter, setOrderStatusFilter] = useState<string>(() => sectionFilter?.status || sectionFilter?.statusTab || 'all');
  const [orderGovFilter, setOrderGovFilter] = useState<string>('all');
  const [orderCenterFilter, setOrderCenterFilter] = useState<string>('all');
  const [orderSearch, setOrderSearch] = useState<string>(() => sectionFilter?.search || '');
  const [orderDateFrom, setOrderDateFrom] = useState<string>('');
  const [orderDateTo, setOrderDateTo] = useState<string>('');
  const [orderPage, setOrderPage] = useState<number>(1);
  const orderPageSize = 15;

  const [pendingOpenOrderId, setPendingOpenOrderId] = useState<string | null>(
    () => sectionFilter?.openOrderId || null
  );

  useEffect(() => {
    if (!sectionFilter) return;
    const targetStatus = sectionFilter.status || sectionFilter.statusTab;
    if (targetStatus !== undefined) {
      setOrderStatusFilter(targetStatus);
    }
    if (sectionFilter.search !== undefined) {
      setOrderSearch(sectionFilter.search);
    }
    if (sectionFilter.openOrderId) {
      setPendingOpenOrderId(String(sectionFilter.openOrderId));
    }
    setOrderPage(1);
    clearSectionFilter();
  }, [sectionFilter, clearSectionFilter]);

  // Order Details Drawer/Modal State
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isLoadingOrderDetails, setIsLoadingOrderDetails] = useState(false);
  const [orderDetailsError, setOrderDetailsError] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<{
    order: PharmacyOrder | null;
    items: PharmacyOrderItem[];
    files: PharmacyOrderFile[];
    deliveryOrder: PharmacyDeliveryOrder | null;
    statusHistory: PharmacyOrderStatusHistory[];
    changeLog: PharmacyOrderChangeLog[];
    savedPrescription: PharmacySavedPrescription | null;
  } | null>(null);

  // Active drivers for driver assignment RPC `pharmacy_admin_assign_driver`
  const [availableDrivers, setAvailableDrivers] = useState<DeliveryDriver[]>([]);
  const [selectedDriverIdForAssign, setSelectedDriverIdForAssign] = useState<string>('');
  const [isAssigningDriver, setIsAssigningDriver] = useState(false);

  // Driver cancellation decision RPC `pharmacy_admin_decide_driver_cancel`
  const [cancelDecisionNote, setCancelDecisionNote] = useState<string>('');
  const [isDecidingCancel, setIsDecidingCancel] = useState(false);

  const loadOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    setOrdersError(null);
    try {
      const res = await adminService.getPharmacyOrders({
        status: orderStatusFilter,
        governorate: orderGovFilter,
        center: orderCenterFilter,
        search: orderSearch,
        dateFrom: orderDateFrom || undefined,
        dateTo: orderDateTo || undefined,
        page: orderPage,
        pageSize: orderPageSize,
      });
      if (res.error) {
        setOrdersError(res.error);
      }
      setOrders(res.orders);
      setOrdersTotalCount(res.totalCount);
      setAvailableStatuses(res.availableStatuses);
      setAvailableGovernorates(res.availableGovernorates);
      setAvailableCenters(res.availableCenters);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [
    orderStatusFilter,
    orderGovFilter,
    orderCenterFilter,
    orderSearch,
    orderDateFrom,
    orderDateTo,
    orderPage,
  ]);

  const loadAvailableDrivers = useCallback(async () => {
    try {
      const res = await adminService.getDeliveryDrivers();
      setAvailableDrivers((res.drivers || []).filter((d) => d.is_active));
    } catch {
      // ignore
    }
  }, []);

  const openOrderDetails = useCallback(
    async (orderId: string) => {
      setSelectedOrderId(orderId);
      setIsLoadingOrderDetails(true);
      setOrderDetailsError(null);
      setCancelDecisionNote('');
      try {
        const [detailsRes] = await Promise.all([
          adminService.getPharmacyOrderDetails(orderId),
          loadAvailableDrivers(),
        ]);
        if (detailsRes.error) {
          setOrderDetailsError(detailsRes.error);
        }
        setOrderDetails(detailsRes);
        setSelectedDriverIdForAssign(
          detailsRes.deliveryOrder?.assigned_driver_id || ''
        );
      } finally {
        setIsLoadingOrderDetails(false);
      }
    },
    [loadAvailableDrivers]
  );

  useEffect(() => {
    if (pendingOpenOrderId) {
      const idToOpen = pendingOpenOrderId;
      setPendingOpenOrderId(null);
      openOrderDetails(idToOpen);
    }
  }, [pendingOpenOrderId, openOrderDetails]);

  const handleAssignDriver = async () => {
    if (!selectedOrderId || !selectedDriverIdForAssign) {
      showToast('يرجى اختيار المندوب أولاً', 'error');
      return;
    }
    setIsAssigningDriver(true);
    try {
      const res = await adminService.assignPharmacyOrderDriver(
        selectedOrderId,
        selectedDriverIdForAssign
      );
      if (!res.success) {
        showToast(res.error || 'تعذر إسناد المندوب', 'error');
        return;
      }
      showToast('تم إسناد المندوب للطلب بنجاح وتأكيده في قاعدة البيانات', 'success');
      await Promise.all([openOrderDetails(selectedOrderId), loadOrders(), loadStats()]);
    } finally {
      setIsAssigningDriver(false);
    }
  };

  const handleDecideDriverCancel = async (approve: boolean) => {
    if (!selectedOrderId) return;
    setIsDecidingCancel(true);
    try {
      const res = await adminService.decidePharmacyDriverCancellation(
        selectedOrderId,
        approve,
        cancelDecisionNote
      );
      if (!res.success) {
        showToast(res.error || 'تعذر تنفيذ القرار على طلب إلغاء المندوب', 'error');
        return;
      }
      showToast(
        approve
          ? 'تم قبول طلب اعتذار/إلغاء المندوب بنجاح'
          : 'تم رفض طلب اعتذار/إلغاء المندوب بنجاح',
        'success'
      );
      setCancelDecisionNote('');
      await Promise.all([openOrderDetails(selectedOrderId), loadOrders(), loadStats()]);
    } finally {
      setIsDecidingCancel(false);
    }
  };

  // ============================================================================
  // 3. Saved Prescriptions State (`pharmacy_saved_prescriptions`)
  // ============================================================================
  const [prescriptions, setPrescriptions] = useState<PharmacySavedPrescription[]>([]);
  const [isLoadingPrescriptions, setIsLoadingPrescriptions] = useState(false);
  const [prescriptionsError, setPrescriptionsError] = useState<string | null>(null);
  const [prescriptionSearch, setPrescriptionSearch] = useState('');
  const [selectedPrescription, setSelectedPrescription] =
    useState<PharmacySavedPrescription | null>(null);

  const loadPrescriptions = useCallback(async () => {
    setIsLoadingPrescriptions(true);
    setPrescriptionsError(null);
    try {
      const res = await adminService.getPharmacySavedPrescriptions(100);
      if (res.error) setPrescriptionsError(res.error);
      setPrescriptions(res.prescriptions);
    } finally {
      setIsLoadingPrescriptions(false);
    }
  }, []);

  const filteredPrescriptions = useMemo(() => {
    const q = prescriptionSearch.trim().toLowerCase();
    if (!q) return prescriptions;
    return prescriptions.filter(
      (p) =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.pharmacy_name || '').toLowerCase().includes(q) ||
        (p.user_name || '').toLowerCase().includes(q) ||
        (p.user_email || '').toLowerCase().includes(q)
    );
  }, [prescriptions, prescriptionSearch]);

  // ============================================================================
  // 4. Pharmacies Directory & User Pharmacies (`pharmacy_pharmacies` & `pharmacy_user_pharmacies`)
  // ============================================================================
  const [pharmacies, setPharmacies] = useState<PharmacyDirectoryRecord[]>([]);
  const [userPharmacies, setUserPharmacies] = useState<PharmacyUserPharmacyRecord[]>([]);
  const [isLoadingPharmacies, setIsLoadingPharmacies] = useState(false);
  const [pharmaciesError, setPharmaciesError] = useState<string | null>(null);
  const [pharmacySubView, setPharmacySubView] = useState<'directory' | 'user_links'>('directory');
  const [pharmacySearch, setPharmacySearch] = useState('');

  // Add / Edit Pharmacy Modal
  const [showPharmacyModal, setShowPharmacyModal] = useState(false);
  const [editingPharmacy, setEditingPharmacy] = useState<PharmacyDirectoryRecord | null>(null);
  const [isSavingPharmacy, setIsSavingPharmacy] = useState(false);
  const [pharmacyForm, setPharmacyForm] = useState({
    name: '',
    phone: '',
    governorate_code: 'SHG',
    governorate_name: 'سوهاج',
    center_name: 'سوهاج',
    address: '',
    latitude: '',
    longitude: '',
    is_active: true,
  });

  const loadPharmaciesData = useCallback(async () => {
    setIsLoadingPharmacies(true);
    setPharmaciesError(null);
    try {
      const res = await adminService.getPharmaciesAndUserLinks();
      if (res.error) setPharmaciesError(res.error);
      setPharmacies(res.pharmacies);
      setUserPharmacies(res.userPharmacies);
    } finally {
      setIsLoadingPharmacies(false);
    }
  }, []);

  const openCreatePharmacyModal = () => {
    const defaultGov = EGYPT_GOVERNORATES.find((g) => g.code === 'SHG') || EGYPT_GOVERNORATES[0];
    setPharmacyForm({
      name: '',
      phone: '',
      governorate_code: defaultGov.code,
      governorate_name: defaultGov.name_ar,
      center_name: defaultGov.markazes[0] || '',
      address: '',
      latitude: '',
      longitude: '',
      is_active: true,
    });
    setEditingPharmacy(null);
    setShowPharmacyModal(true);
  };

  const openEditPharmacyModal = (pharm: PharmacyDirectoryRecord) => {
    setEditingPharmacy(pharm);
    setPharmacyForm({
      name: pharm.name || '',
      phone: pharm.phone || '',
      governorate_code: pharm.governorate_code || 'SHG',
      governorate_name: pharm.governorate_name || 'سوهاج',
      center_name: pharm.center_name || '',
      address: pharm.address || '',
      latitude: pharm.latitude !== null && pharm.latitude !== undefined ? String(pharm.latitude) : '',
      longitude:
        pharm.longitude !== null && pharm.longitude !== undefined ? String(pharm.longitude) : '',
      is_active: pharm.is_active,
    });
    setShowPharmacyModal(true);
  };

  const handleSavePharmacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pharmacyForm.name.trim()) {
      showToast('يرجى إدخال اسم الصيدلية', 'error');
      return;
    }
    setIsSavingPharmacy(true);
    try {
      const fallbackAddr =
        [pharmacyForm.center_name?.trim(), pharmacyForm.governorate_name?.trim()]
          .filter(Boolean)
          .join(' - ') || 'العنوان غير محدد';
      const cleanAddr = pharmacyForm.address?.trim() || fallbackAddr;

      const res = await adminService.savePharmacyDirectoryRecord({
        id: editingPharmacy?.id,
        name: pharmacyForm.name.trim(),
        phone: pharmacyForm.phone?.trim() || null,
        governorate_code: pharmacyForm.governorate_code || null,
        governorate_name: pharmacyForm.governorate_name || null,
        center_name: pharmacyForm.center_name || null,
        address: cleanAddr,
        latitude: pharmacyForm.latitude.trim() ? Number(pharmacyForm.latitude) : null,
        longitude: pharmacyForm.longitude.trim() ? Number(pharmacyForm.longitude) : null,
        is_active: pharmacyForm.is_active ?? true,
      });

      if (!res.success) {
        showToast(res.error || 'فشل حفظ بيانات الصيدلية', 'error');
        return;
      }

      showToast(
        editingPharmacy
          ? 'تم تحديث بيانات الصيدلية في قاعدة البيانات بنجاح'
          : 'تمت إضافة الصيدلية إلى الدليل بنجاح',
        'success'
      );
      if (!editingPharmacy) {
        const defaultGov = EGYPT_GOVERNORATES.find((g) => g.code === 'SHG') || EGYPT_GOVERNORATES[0];
        setPharmacyForm({
          name: '',
          phone: '',
          governorate_code: defaultGov.code,
          governorate_name: defaultGov.name_ar,
          center_name: defaultGov.markazes[0] || '',
          address: '',
          latitude: '',
          longitude: '',
          is_active: true,
        });
      }
      setEditingPharmacy(null);
      setShowPharmacyModal(false);
      await Promise.all([loadPharmaciesData(), loadStats()]);
    } finally {
      setIsSavingPharmacy(false);
    }
  };

  const handleTogglePharmacyActive = async (pharm: PharmacyDirectoryRecord) => {
    const res = await adminService.savePharmacyDirectoryRecord({
      id: pharm.id,
      name: pharm.name,
      phone: pharm.phone,
      governorate_code: pharm.governorate_code,
      governorate_name: pharm.governorate_name,
      center_name: pharm.center_name,
      address: pharm.address,
      latitude: pharm.latitude,
      longitude: pharm.longitude,
      is_active: !pharm.is_active,
    });
    if (!res.success) {
      showToast(res.error || 'تعذر تغيير حالة الصيدلية', 'error');
      return;
    }
    showToast(
      !pharm.is_active ? `تم تفعيل صيدلية "${pharm.name}"` : `تم إيقاف صيدلية "${pharm.name}"`,
      'success'
    );
    await Promise.all([loadPharmaciesData(), loadStats()]);
  };

  // ============================================================================
  // 5. General Pharmacy Settings & Delivery Areas (`pharmacy_settings` & `pharmacy_delivery_area_settings`)
  // ============================================================================
  const [pharmacySettings, setPharmacySettings] = useState<PharmacySettingsRecord | null>(null);
  const [settingsExistsInDb, setSettingsExistsInDb] = useState<boolean>(false);
  const [serviceEnabledInput, setServiceEnabledInput] = useState<boolean>(true);
  const [sectionVisibleInput, setSectionVisibleInput] = useState<boolean>(true);
  const [displayWidthInput, setDisplayWidthInput] = useState<PharmacyDisplayWidth>('full');
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [deliveryAreas, setDeliveryAreas] = useState<PharmacyDeliveryAreaSetting[]>([]);
  const [isLoadingAreas, setIsLoadingAreas] = useState(false);
  const [areasError, setAreasError] = useState<string | null>(null);
  const [areaSearch, setAreaSearch] = useState('');
  const [areaGovFilter, setAreaGovFilter] = useState('all');
  const [areaStatusFilter, setAreaStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');

  // Add / Edit Delivery Area Modal
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [editingArea, setEditingArea] = useState<PharmacyDeliveryAreaSetting | null>(null);
  const [areaGovCode, setAreaGovCode] = useState('SHG');
  const [selectedCentersForBulk, setSelectedCentersForBulk] = useState<string[]>([]);
  const [customCenterName, setCustomCenterName] = useState('');
  const [areaServiceEnabled, setAreaServiceEnabled] = useState(true);
  const [areaDeliveryFee, setAreaDeliveryFee] = useState('20');
  const [isSavingArea, setIsSavingArea] = useState(false);

  // Inline Quick Edit for Area Fee
  const [inlineAreaId, setInlineAreaId] = useState<string | null>(null);
  const [inlineAreaFee, setInlineAreaFee] = useState<string>('');
  const [isSavingInlineArea, setIsSavingInlineArea] = useState(false);

  const loadSettingsAndAreas = useCallback(async () => {
    setIsLoadingSettings(true);
    setIsLoadingAreas(true);
    setSettingsError(null);
    setAreasError(null);
    try {
      const [sRes, aRes] = await Promise.all([
        adminService.getPharmacySettings(),
        adminService.getPharmacyDeliveryAreas(),
      ]);

      if (sRes.error) setSettingsError(sRes.error);
      setSettingsExistsInDb(sRes.existsInDb);
      if (sRes.settings) {
        setPharmacySettings(sRes.settings);
        setServiceEnabledInput(sRes.settings.service_enabled);
        setSectionVisibleInput(sRes.settings.section_visible);
        setDisplayWidthInput(sRes.settings.display_width);
      }

      if (aRes.error) setAreasError(aRes.error);
      setDeliveryAreas(aRes.areas);
    } finally {
      setIsLoadingSettings(false);
      setIsLoadingAreas(false);
    }
  }, []);

  const handleSaveGeneralSettings = async () => {
    setIsSavingSettings(true);
    setSettingsError(null);
    try {
      const res = await adminService.updatePharmacySettings({
        service_enabled: serviceEnabledInput,
        section_visible: sectionVisibleInput,
        display_width: displayWidthInput,
      });

      if (!res.success || !res.settings) {
        const msg = res.error || 'فشل حفظ إعدادات الصيدلية في قاعدة البيانات';
        setSettingsError(msg);
        showToast(msg, 'error');
        return;
      }

      setPharmacySettings(res.settings);
      setSettingsExistsInDb(true);
      showToast('تم حفظ إعدادات الصيدلية العامة وتأكيدها في Supabase بنجاح', 'success');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const openAddAreaModal = () => {
    if (editingArea || selectedCentersForBulk.length === 0) {
      const defaultGov = EGYPT_GOVERNORATES.find((g) => g.code === 'SHG') || EGYPT_GOVERNORATES[0];
      setAreaGovCode(defaultGov.code);
      setSelectedCentersForBulk([...defaultGov.markazes]);
      setCustomCenterName('');
      setAreaServiceEnabled(true);
      setAreaDeliveryFee('20');
    }
    setEditingArea(null);
    setShowAreaModal(true);
  };

  const openEditAreaModal = (area: PharmacyDeliveryAreaSetting) => {
    setEditingArea(area);
    setAreaGovCode(area.governorate_code || 'SHG');
    setSelectedCentersForBulk([area.center_name]);
    setCustomCenterName(area.center_name);
    setAreaServiceEnabled(area.service_enabled);
    setAreaDeliveryFee(String(area.delivery_fee ?? 0));
    setShowAreaModal(true);
  };

  const handleSaveAreaModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const feeNum = Number(areaDeliveryFee);
    if (!Number.isFinite(feeNum) || feeNum < 0) {
      showToast('يرجى إدخال رسوم توصيل صحيحة (0 أو أكثر)', 'error');
      return;
    }

    const govObj = EGYPT_GOVERNORATES.find((g) => g.code === areaGovCode);
    const govName = govObj?.name_ar || editingArea?.governorate_name || areaGovCode;

    setIsSavingArea(true);
    try {
      if (editingArea) {
        const res = await adminService.savePharmacyDeliveryArea({
          id: editingArea.id,
          governorate_code: areaGovCode,
          governorate_name: govName,
          center_name: customCenterName.trim() || editingArea.center_name,
          service_enabled: areaServiceEnabled,
          delivery_fee: feeNum,
        });
        if (!res.success) {
          showToast(res.error || 'فشل تحديث المنطقة', 'error');
          return;
        }
        showToast('تم تحديث إعدادات منطقة التوصيل بنجاح', 'success');
      } else {
        const centersToSave = [
          ...selectedCentersForBulk,
          ...(customCenterName.trim() ? [customCenterName.trim()] : []),
        ];
        if (centersToSave.length === 0) {
          showToast('يرجى اختيار مركز واحد على الأقل أو كتابة اسم المركز', 'error');
          return;
        }
        const res = await adminService.saveBulkPharmacyDeliveryAreas({
          governorate_code: areaGovCode,
          governorate_name: govName,
          centers: centersToSave,
          service_enabled: areaServiceEnabled,
          delivery_fee: feeNum,
        });
        if (!res.success) {
          showToast(res.error || 'فشل حفظ المناطق المحددة', 'error');
          return;
        }
        showToast(`تم حفظ وتحديث ${res.savedCount} منطقة توصيل للصيدلية بنجاح`, 'success');
      }

      setShowAreaModal(false);
      await Promise.all([loadSettingsAndAreas(), loadStats()]);
    } finally {
      setIsSavingArea(false);
    }
  };

  const handleToggleAreaEnabled = async (area: PharmacyDeliveryAreaSetting) => {
    const res = await adminService.savePharmacyDeliveryArea({
      id: area.id,
      governorate_code: area.governorate_code,
      governorate_name: area.governorate_name,
      center_name: area.center_name,
      service_enabled: !area.service_enabled,
      delivery_fee: area.delivery_fee,
    });
    if (!res.success) {
      showToast(res.error || 'تعذر تحديث حالة المنطقة', 'error');
      return;
    }
    showToast(
      !area.service_enabled
        ? `تم تفعيل خدمة الصيدلية في مركز ${area.center_name}`
        : `تم إيقاف خدمة الصيدلية في مركز ${area.center_name}`,
      'success'
    );
    await Promise.all([loadSettingsAndAreas(), loadStats()]);
  };

  const handleSaveInlineAreaFee = async (area: PharmacyDeliveryAreaSetting) => {
    const feeNum = Number(inlineAreaFee);
    if (!Number.isFinite(feeNum) || feeNum < 0) {
      showToast('قيمة الرسوم غير صالحة', 'error');
      return;
    }
    setIsSavingInlineArea(true);
    try {
      const res = await adminService.savePharmacyDeliveryArea({
        id: area.id,
        governorate_code: area.governorate_code,
        governorate_name: area.governorate_name,
        center_name: area.center_name,
        service_enabled: area.service_enabled,
        delivery_fee: feeNum,
      });
      if (!res.success) {
        showToast(res.error || 'فشل تحديث الرسوم', 'error');
        return;
      }
      showToast(`تم تحديث رسوم توصيل مركز ${area.center_name} إلى ${feeNum} ج.م`, 'success');
      setInlineAreaId(null);
      await loadSettingsAndAreas();
    } finally {
      setIsSavingInlineArea(false);
    }
  };

  const handleDeleteArea = async (area: PharmacyDeliveryAreaSetting) => {
    const res = await adminService.deletePharmacyDeliveryArea(area.id);
    if (!res.success) {
      showToast(res.error || 'تعذر حذف المنطقة', 'error');
      return;
    }
    showToast(`تم حذف منطقة ${area.center_name} (${area.governorate_name})`, 'success');
    await Promise.all([loadSettingsAndAreas(), loadStats()]);
  };

  const filteredAreas = useMemo(() => {
    return deliveryAreas.filter((a) => {
      if (areaGovFilter !== 'all' && a.governorate_name !== areaGovFilter) return false;
      if (areaStatusFilter === 'enabled' && !a.service_enabled) return false;
      if (areaStatusFilter === 'disabled' && a.service_enabled) return false;
      if (areaSearch.trim()) {
        const q = areaSearch.trim().toLowerCase();
        return (
          a.center_name.toLowerCase().includes(q) ||
          a.governorate_name.toLowerCase().includes(q) ||
          a.governorate_code.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [deliveryAreas, areaGovFilter, areaStatusFilter, areaSearch]);

  // ============================================================================
  // 6. Fullscreen Lightbox for Private `pharmacy` Bucket Attachments
  // ============================================================================
  const [lightboxItem, setLightboxItem] = useState<{
    storagePath: string;
    title: string;
    mimeType?: string | null;
    driverNote?: string | null;
  } | null>(null);
  const [lightboxSignedUrl, setLightboxSignedUrl] = useState<string | null>(null);
  const [lightboxLoading, setLightboxLoading] = useState(false);
  const [lightboxError, setLightboxError] = useState<string | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);

  const loadLightboxUrl = useCallback(async (path: string) => {
    setLightboxLoading(true);
    setLightboxError(null);
    const res = await adminService.getPharmacyFileSignedUrl(path, 3600);
    if (res.success && res.signedUrl) {
      setLightboxSignedUrl(res.signedUrl);
    } else {
      setLightboxSignedUrl(null);
      setLightboxError(res.error || 'تعذر إنشاء رابط المعاينة الموقّع');
    }
    setLightboxLoading(false);
  }, []);

  const openLightbox = useCallback(
    (item: {
      storagePath: string;
      title: string;
      mimeType?: string | null;
      driverNote?: string | null;
    }) => {
      setLightboxItem(item);
      setLightboxZoom(1);
      loadLightboxUrl(item.storagePath);
    },
    [loadLightboxUrl]
  );

  // ============================================================================
  // Initial Data Loading per Active Tab
  // ============================================================================
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (currentTab === 'pharmacy_orders') {
      loadOrders();
    } else if (currentTab === 'pharmacy_prescriptions') {
      loadPrescriptions();
    } else if (currentTab === 'pharmacy_pharmacies') {
      loadPharmaciesData();
    } else if (currentTab === 'pharmacy_settings') {
      loadSettingsAndAreas();
    }
  }, [
    currentTab,
    loadOrders,
    loadPrescriptions,
    loadPharmaciesData,
    loadSettingsAndAreas,
  ]);

  const handleRefreshCurrentTab = () => {
    loadStats();
    if (currentTab === 'pharmacy_orders') loadOrders();
    if (currentTab === 'pharmacy_prescriptions') loadPrescriptions();
    if (currentTab === 'pharmacy_pharmacies') loadPharmaciesData();
    if (currentTab === 'pharmacy_settings') loadSettingsAndAreas();
  };

  if (!canViewDelivery && !canManageSettings) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
        <h3 className="text-base font-bold text-white">صلاحية غير كافية</h3>
        <p className="text-xs text-slate-400">
          ليس لديك صلاحية للوصول إلى نظام إدارة الصيدلية.
        </p>
      </div>
    );
  }

  const totalOrderPages = Math.max(1, Math.ceil(ordersTotalCount / orderPageSize));

  return (
    <div className="space-y-6" dir="rtl">
      {/* =================================================================== */}
      {/* Top Header & Navigation Sub-Tabs                                    */}
      {/* =================================================================== */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-900/95 to-emerald-950/30 border border-slate-800/90 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-950/50">
              <Pill className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black text-white">
                  نظام إدارة الصيدلية والروشتات الطبية
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Supabase Live Schema
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                متابعة طلبات الصيدلية، إسناد المناديب، البت في طلبات الإلغاء، مراجعة الروشتات والمرفقات الخاصة، وإعدادات المناطق
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-center">
            <button
              type="button"
              onClick={handleRefreshCurrentTab}
              className="px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-emerald-400 ${
                  isLoadingStats ||
                  isLoadingOrders ||
                  isLoadingPrescriptions ||
                  isLoadingPharmacies ||
                  isLoadingSettings
                    ? 'animate-spin'
                    : ''
                }`}
              />
              <span>تحديث البيانات</span>
            </button>
          </div>
        </div>

        {/* Sub-Tabs Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => handleSelectTab('pharmacy_orders')}
            className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between ${
              currentTab === 'pharmacy_orders'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-lg shadow-emerald-950/30'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Pill
                className={`w-4 h-4 shrink-0 ${
                  currentTab === 'pharmacy_orders' ? 'text-emerald-400' : 'text-slate-400'
                }`}
              />
              <div className="truncate">
                <div className="text-xs font-bold truncate">طلبات الصيدلية</div>
                <div className="text-[10px] text-slate-400 truncate">الطلبات والحالات والمناديب</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-black font-mono bg-slate-900 text-emerald-300 border border-slate-700">
              {stats?.total_orders ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('pharmacy_prescriptions')}
            className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between ${
              currentTab === 'pharmacy_prescriptions'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-lg shadow-emerald-950/30'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText
                className={`w-4 h-4 shrink-0 ${
                  currentTab === 'pharmacy_prescriptions' ? 'text-emerald-400' : 'text-slate-400'
                }`}
              />
              <div className="truncate">
                <div className="text-xs font-bold truncate">الروشتات المحفوظة</div>
                <div className="text-[10px] text-slate-400 truncate">روشتات العملاء والمرفقات</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-black font-mono bg-slate-900 text-emerald-300 border border-slate-700">
              {stats?.total_saved_prescriptions ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('pharmacy_pharmacies')}
            className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between ${
              currentTab === 'pharmacy_pharmacies'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-lg shadow-emerald-950/30'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Store
                className={`w-4 h-4 shrink-0 ${
                  currentTab === 'pharmacy_pharmacies' ? 'text-emerald-400' : 'text-slate-400'
                }`}
              />
              <div className="truncate">
                <div className="text-xs font-bold truncate">دليل الصيدليات</div>
                <div className="text-[10px] text-slate-400 truncate">الصيدليات وربط المستخدمين</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-black font-mono bg-slate-900 text-emerald-300 border border-slate-700">
              {stats?.total_pharmacies ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('pharmacy_settings')}
            className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between ${
              currentTab === 'pharmacy_settings'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-lg shadow-emerald-950/30'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Sliders
                className={`w-4 h-4 shrink-0 ${
                  currentTab === 'pharmacy_settings' ? 'text-emerald-400' : 'text-slate-400'
                }`}
              />
              <div className="truncate">
                <div className="text-xs font-bold truncate">الإعدادات والمناطق</div>
                <div className="text-[10px] text-slate-400 truncate">الظهور ورسوم المراكز</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-black font-mono bg-slate-900 text-emerald-300 border border-slate-700">
              {stats?.enabled_delivery_areas ?? 0}/{stats?.total_delivery_areas ?? 0}
            </span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 1. Overview & Live Statistics Strip                                 */}
      {/* =================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-slate-900/85 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 block">إجمالي طلبات الصيدلية</span>
          <div className="text-2xl font-black text-white font-mono tabular-nums">
            {stats?.total_orders ?? 0}
          </div>
          <span className="text-[10px] text-slate-400 block">
            قيد المراجعة/الانتظار: {stats?.pending_orders ?? 0}
          </span>
        </div>

        <div className="bg-slate-900/85 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 block">الطلبات النشطة والجارية</span>
          <div className="text-2xl font-black text-cyan-400 font-mono tabular-nums">
            {stats?.active_orders ?? 0}
          </div>
          <span className="text-[10px] text-slate-400 block">مقبولة / تجهيز / توصيل</span>
        </div>

        <div className="bg-slate-900/85 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 block">الطلبات المكتملة</span>
          <div className="text-2xl font-black text-emerald-400 font-mono tabular-nums">
            {stats?.completed_orders ?? 0}
          </div>
          <span className="text-[10px] text-slate-400 block">
            الملغاة: {stats?.cancelled_orders ?? 0}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setOrderStatusFilter(
              orderStatusFilter === 'cancellation_pending' ? 'all' : 'cancellation_pending'
            );
            setOrderPage(1);
            if (currentTab !== 'pharmacy_orders') handleSelectTab('pharmacy_orders');
          }}
          className={`text-right rounded-2xl p-4 space-y-1 transition-all border cursor-pointer ${
            orderStatusFilter === 'cancellation_pending'
              ? 'bg-amber-950/50 border-amber-500/60 shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/30'
              : 'bg-slate-900/85 hover:bg-slate-900 border-slate-800 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 block">طلبات إلغاء المندوب المعلقة</span>
            {orderStatusFilter === 'cancellation_pending' && (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full">
                مفلترة حالياً
              </span>
            )}
          </div>
          <div
            className={`text-2xl font-black font-mono tabular-nums ${
              (stats?.driver_cancellation_requests ?? 0) > 0
                ? 'text-amber-400'
                : 'text-slate-300'
            }`}
          >
            {stats?.driver_cancellation_requests ?? 0}
          </div>
          <span className="text-[10px] text-amber-300/80 block">
            {orderStatusFilter === 'cancellation_pending'
              ? 'إلغاء التصفية وعرض الكل'
              : 'اضغط للتصفية واتخاذ القرار'}
          </span>
        </button>

        <div className="bg-slate-900/85 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 block">إجمالي قيمة الأدوية (المكتملة)</span>
          <div className="text-xl font-black text-emerald-300 font-mono tabular-nums">
            {(stats?.total_medicines_completed ?? 0).toLocaleString()} <span className="text-xs">ج.م</span>
          </div>
          <span className="text-[10px] text-slate-400 block">
            الإجمالي الكلي: {(stats?.total_grand_completed ?? 0).toLocaleString()} ج.م
          </span>
        </div>

        <div className="bg-slate-900/85 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 block">رسوم توصيل الصيدلية (المكتملة)</span>
          <div className="text-xl font-black text-teal-300 font-mono tabular-nums">
            {(stats?.total_delivery_fees_completed ?? 0).toLocaleString()} <span className="text-xs">ج.م</span>
          </div>
          <span className="text-[10px] text-slate-400 block">
            مناطق مفعلة: {stats?.enabled_delivery_areas ?? 0}
          </span>
        </div>
      </div>

      {/* Status & Governorate Distribution Pills if data exists */}
      {stats &&
        (Object.keys(stats.by_status).length > 0 || stats.by_governorate.length > 0) && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400">توزيع الحالات الفعلية:</span>
              {Object.entries(stats.by_status).map(([st, cnt]) => {
                const meta = getPharmacyStatusMeta(st);
                return (
                  <span
                    key={st}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border ${meta.badgeClass}`}
                  >
                    {meta.label}: {cnt}
                  </span>
                );
              })}
            </div>

            {stats.by_governorate.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-400">توزيع المحافظات:</span>
                {stats.by_governorate.slice(0, 5).map((g) => (
                  <span
                    key={g.governorate_name}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-950 text-slate-300 border border-slate-800"
                  >
                    {g.governorate_name}: {g.count}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

      {/* =================================================================== */}
      {/* TAB 1: PHARMACY ORDERS (`pharmacy_orders`)                          */}
      {/* =================================================================== */}
      {currentTab === 'pharmacy_orders' && (
        <div className="space-y-4">
          {/* Quick Filter Status Tabs Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-3 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-lg shadow-slate-950/40">
            {[
              { id: 'all', label: 'كل الطلبات', count: stats?.total_orders ?? 0, badgeColor: 'bg-slate-800 text-slate-300' },
              {
                id: 'cancellation_pending',
                label: '⚠️ طلبات إلغاء المندوب المعلقة',
                count: stats?.driver_cancellation_requests ?? 0,
                badgeColor:
                  (stats?.driver_cancellation_requests ?? 0) > 0
                    ? 'bg-amber-500 text-slate-950 font-black animate-pulse'
                    : 'bg-amber-950/60 text-amber-300 border border-amber-500/30',
                isAlert: true,
              },
              { id: 'pending', label: 'قيد المراجعة', count: stats?.pending_orders ?? 0, badgeColor: 'bg-blue-900/50 text-blue-300' },
              { id: 'accepted', label: 'جاري التجهيز', count: stats?.by_status?.accepted ?? 0, badgeColor: 'bg-indigo-900/50 text-indigo-300' },
              { id: 'in_delivery', label: 'جاري التوصيل', count: stats?.by_status?.in_delivery ?? 0, badgeColor: 'bg-cyan-900/50 text-cyan-300' },
              { id: 'completed', label: 'مكتملة', count: stats?.completed_orders ?? 0, badgeColor: 'bg-emerald-900/50 text-emerald-300' },
              { id: 'cancelled', label: 'ملغاة', count: stats?.cancelled_orders ?? 0, badgeColor: 'bg-rose-900/50 text-rose-300' },
            ].map((tab) => {
              const isActive = orderStatusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setOrderStatusFilter(tab.id);
                    setOrderPage(1);
                  }}
                  className={`flex items-center gap-2 py-2 px-3.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? tab.isAlert
                        ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-950/50 ring-2 ring-amber-400 font-black'
                        : 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
                      : tab.isAlert
                      ? 'bg-amber-950/40 text-amber-300 border border-amber-500/40 hover:bg-amber-900/50'
                      : 'bg-slate-950/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${tab.badgeColor}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filters Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Search */}
              <div className="lg:col-span-2 relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => {
                    setOrderSearch(e.target.value);
                    setOrderPage(1);
                  }}
                  placeholder="بحث برقم الطلب، اسم الصيدلية، عنوان الروشتة، أو العنوان..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-2xl pr-10 pl-3 py-2.5 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={orderStatusFilter}
                  onChange={(e) => {
                    setOrderStatusFilter(e.target.value);
                    setOrderPage(1);
                  }}
                  className={`w-full border rounded-2xl px-3 py-2.5 text-xs text-white outline-none font-bold ${
                    orderStatusFilter === 'cancellation_pending'
                      ? 'bg-amber-950/60 border-amber-500/60 text-amber-300'
                      : 'bg-slate-950 border border-slate-800 focus:border-emerald-500/50'
                  }`}
                >
                  <option value="all">كل الحالات</option>
                  <option value="cancellation_pending" className="text-amber-400 font-bold bg-slate-900">
                    ⚠️ طلبات إلغاء المندوب المعلقة ({stats?.driver_cancellation_requests ?? 0})
                  </option>
                  {Array.from(
                    new Set([
                      'pending',
                      'accepted',
                      'shopping',
                      'in_delivery',
                      'completed',
                      'cancelled',
                      ...availableStatuses.filter((s) => s !== 'cancellation_pending'),
                    ])
                  ).map((st) => (
                    <option key={st} value={st}>
                      {getPharmacyStatusMeta(st).label} ({st})
                    </option>
                  ))}
                </select>
              </div>

              {/* Governorate Filter */}
              <div>
                <select
                  value={orderGovFilter}
                  onChange={(e) => {
                    setOrderGovFilter(e.target.value);
                    setOrderPage(1);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-2xl px-3 py-2.5 text-xs text-white outline-none"
                >
                  <option value="all">كل المحافظات</option>
                  {availableGovernorates.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* Center Filter */}
              <div>
                <select
                  value={orderCenterFilter}
                  onChange={(e) => {
                    setOrderCenterFilter(e.target.value);
                    setOrderPage(1);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-2xl px-3 py-2.5 text-xs text-white outline-none"
                >
                  <option value="all">كل المراكز</option>
                  {availableCenters.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reset Filters */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOrderStatusFilter('all');
                    setOrderGovFilter('all');
                    setOrderCenterFilter('all');
                    setOrderSearch('');
                    setOrderDateFrom('');
                    setOrderDateTo('');
                    setOrderPage(1);
                  }}
                  className="w-full py-2.5 px-3 rounded-2xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold cursor-pointer transition-colors"
                >
                  إعادة ضبط الفلاتر
                </button>
              </div>
            </div>

            {/* Date Range Row */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/70 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400 font-bold">من تاريخ:</span>
                <input
                  type="date"
                  value={orderDateFrom}
                  onChange={(e) => {
                    setOrderDateFrom(e.target.value);
                    setOrderPage(1);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold">إلى تاريخ:</span>
                <input
                  type="date"
                  value={orderDateTo}
                  onChange={(e) => {
                    setOrderDateTo(e.target.value);
                    setOrderPage(1);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div className="mr-auto text-[11px] text-slate-400">
                إجمالي النتائج المطابقة:{' '}
                <span className="text-white font-bold font-mono">{ordersTotalCount}</span> طلب
              </div>
            </div>
          </div>

          {/* Active Cancellation Filter Banner & Quick Alert Banner */}
          {orderStatusFilter === 'cancellation_pending' ? (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/50 text-xs shadow-lg shadow-amber-950/20">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-amber-200 font-bold">
                  تصفية مفعّلة: عرض طلبات اعتذار وإلغاء المندوب المعلقة التي تتطلب قرار المشرف (قبول أو رفض)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOrderStatusFilter('all');
                  setOrderPage(1);
                }}
                className="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs cursor-pointer border border-amber-500/30 transition-colors"
              >
                إلغاء التصفية وعرض جميع الطلبات
              </button>
            </div>
          ) : (stats?.driver_cancellation_requests ?? 0) > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-950/25 border border-amber-500/35 text-xs">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-slate-300">
                  تنبيه: يوجد <strong className="text-amber-400 font-mono font-black">{stats?.driver_cancellation_requests}</strong> طلب إلغاء مندوب معلق بانتظار قرار الإدارة.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOrderStatusFilter('cancellation_pending');
                  setOrderPage(1);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer shadow-md transition-all"
              >
                تصفية وعرض الطلبات المعلقة الآن
              </button>
            </div>
          ) : null}

          {ordersError && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{ordersError}</span>
            </div>
          )}

          {/* Orders Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden">
            {isLoadingOrders ? (
              <div className="p-12 text-center space-y-3">
                <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-400">جاري جلب طلبات الصيدلية من قاعدة البيانات...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Pill className="w-9 h-9 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-slate-300">لا توجد طلبات صيدلية مطابقة</h3>
                <p className="text-xs text-slate-500">
                  لم يتم تسجيل طلبات صيدلية بهذه الفلاتر في جدول pharmacy_orders حتى الآن.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4 font-bold">رقم الطلب</th>
                      <th className="py-3.5 px-4 font-bold">العميل / الأسرة</th>
                      <th className="py-3.5 px-4 font-bold">الصيدلية / الروشتة</th>
                      <th className="py-3.5 px-4 font-bold">المحافظة والمركز</th>
                      <th className="py-3.5 px-4 font-bold">المحتوى</th>
                      <th className="py-3.5 px-4 font-bold">المندوب المعين</th>
                      <th className="py-3.5 px-4 font-bold">التكلفة</th>
                      <th className="py-3.5 px-4 font-bold">الحالة</th>
                      <th className="py-3.5 px-4 font-bold">التاريخ</th>
                      <th className="py-3.5 px-4 font-bold text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {orders.map((ord) => {
                      const stMeta = getPharmacyStatusMeta(ord.status);
                      const hasPendingCancelRequest =
                        Boolean(ord.delivery_order?.cancellation_requested_at) &&
                        !ord.delivery_order?.cancellation_decided_at;

                      return (
                        <tr
                          key={ord.id}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-300">
                            <div>{ord.order_number}</div>
                            {hasPendingCancelRequest && (
                              <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                <AlertTriangle className="w-3 h-3" />
                                طلب إلغاء مندوب
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white">
                              {ord.customer_name || ord.household_name || 'مستخدم مسجل'}
                            </div>
                            {ord.customer_phone && (
                              <div className="text-[11px] text-slate-400 font-mono" dir="ltr">
                                {ord.customer_phone}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-200">
                              {ord.requested_pharmacy_name || 'أقرب صيدلية متاحة'}
                            </div>
                            {ord.prescription_title && (
                              <div className="text-[11px] text-emerald-400 truncate max-w-[180px]">
                                روشتة: {ord.prescription_title}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="text-slate-200 font-bold">
                              {ord.address_governorate_name || '—'}
                              {ord.address_center_name ? ` — ${ord.address_center_name}` : ''}
                            </div>
                            {ord.address_text && (
                              <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                                {ord.address_text}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px]">
                                {ord.items_count ?? 0} صنف
                              </span>
                              <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-emerald-300 font-mono text-[11px]">
                                {ord.files_count ?? 0} مرفق
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {ord.delivery_order?.driver ? (
                              <div>
                                <div className="font-bold text-teal-300">
                                  {ord.delivery_order.driver.full_name}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                                  {ord.delivery_order.driver.phone}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500">لم يُسند بعد</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-mono">
                            <div className="text-white font-bold">
                              توصيل: {Number(ord.delivery_fee || 0).toLocaleString()} ج.م
                            </div>
                            {ord.medicines_total !== null && ord.medicines_total !== undefined && (
                              <div className="text-[11px] text-emerald-300">
                                أدوية: {Number(ord.medicines_total).toLocaleString()} ج.م
                              </div>
                            )}
                            {ord.grand_total !== null && ord.grand_total !== undefined && (
                              <div className="text-[11px] text-amber-300 font-bold">
                                إجمالي: {Number(ord.grand_total).toLocaleString()} ج.م
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-xl text-[11px] font-bold border ${stMeta.badgeClass}`}
                            >
                              {stMeta.label}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-[11px] text-slate-400">
                            {formatDateTimeAr(ord.created_at)}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => openOrderDetails(ord.id)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>التفاصيل والإدارة</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Footer */}
            {ordersTotalCount > orderPageSize && (
              <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  صفحة <strong className="text-white">{orderPage}</strong> من{' '}
                  <strong className="text-white">{totalOrderPages}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={orderPage <= 1}
                    onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>السابق</span>
                  </button>
                  <button
                    type="button"
                    disabled={orderPage >= totalOrderPages}
                    onClick={() => setOrderPage((p) => Math.min(totalOrderPages, p + 1))}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <span>التالي</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: SAVED PRESCRIPTIONS (`pharmacy_saved_prescriptions`)         */}
      {/* =================================================================== */}
      {currentTab === 'pharmacy_prescriptions' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>سجل الروشتات المحفوظة للعملاء (pharmacy_saved_prescriptions)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                عرض الروشتات المحفوظة وعناصرها ومرفقاتها المخزنة في البكت الخاص pharmacy
              </p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={prescriptionSearch}
                onChange={(e) => setPrescriptionSearch(e.target.value)}
                placeholder="بحث بعنوان الروشتة، اسم الصيدلية، أو اسم العميل..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pr-10 pl-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
              />
            </div>
          </div>

          {prescriptionsError && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{prescriptionsError}</span>
            </div>
          )}

          {isLoadingPrescriptions ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">جاري تحميل الروشتات المحفوظة ومرفقاتها...</p>
            </div>
          ) : filteredPrescriptions.length === 0 ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-12 text-center space-y-2">
              <FileText className="w-9 h-9 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-300">لا توجد روشتات محفوظة</h3>
              <p className="text-xs text-slate-500">
                لم يقم المستخدمون بحفظ روشتات في جدول pharmacy_saved_prescriptions حتى الآن.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPrescriptions.map((presc) => (
                <div
                  key={presc.id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 flex flex-col justify-between space-y-4 transition-all"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-black text-white">{presc.title}</h3>
                        <p className="text-[11px] text-slate-400">
                          العميل: {presc.user_name || presc.user_email || presc.user_id}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                        {presc.files?.length || 0} مرفق / {presc.items?.length || 0} صنف
                      </span>
                    </div>

                    {presc.pharmacy_name && (
                      <div className="text-xs text-teal-300 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5" />
                        <span>الصيدلية المفضلة: {presc.pharmacy_name}</span>
                      </div>
                    )}

                    {/* Items preview */}
                    {presc.items && presc.items.length > 0 && (
                      <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400">الأصناف المسجلة:</div>
                        {presc.items.slice(0, 3).map((it) => (
                          <div
                            key={it.id}
                            className="flex items-center justify-between text-xs text-slate-200"
                          >
                            <span>{it.item_name}</span>
                            <span className="font-mono text-emerald-300">
                              {it.requested_quantity} {it.unit || ''}
                            </span>
                          </div>
                        ))}
                        {presc.items.length > 3 && (
                          <div className="text-[10px] text-slate-500">
                            +{presc.items.length - 3} أصناف أخرى...
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">
                      آخر تحديث: {formatDateTimeAr(presc.updated_at)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedPrescription(presc)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>عرض الروشتة والمرفقات</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: PHARMACIES DIRECTORY & USER LINKS (`pharmacy_pharmacies`)    */}
      {/* =================================================================== */}
      {currentTab === 'pharmacy_pharmacies' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPharmacySubView('directory')}
                className={`px-4 py-2 rounded-2xl text-xs font-bold border cursor-pointer transition-all ${
                  pharmacySubView === 'directory'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                دليل الصيدليات المعتمدة ({pharmacies.length})
              </button>
              <button
                type="button"
                onClick={() => setPharmacySubView('user_links')}
                className={`px-4 py-2 rounded-2xl text-xs font-bold border cursor-pointer transition-all ${
                  pharmacySubView === 'user_links'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                صيدليات المستخدمين المرتبطة ({userPharmacies.length})
              </button>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pharmacySearch}
                  onChange={(e) => setPharmacySearch(e.target.value)}
                  placeholder="بحث باسم الصيدلية، الهاتف، أو المركز..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pr-10 pl-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>

              {pharmacySubView === 'directory' && (
                <button
                  type="button"
                  onClick={openCreatePharmacyModal}
                  className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-lg shadow-emerald-950/50"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة صيدلية جديدة</span>
                </button>
              )}
            </div>
          </div>

          {pharmaciesError && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{pharmaciesError}</span>
            </div>
          )}

          {isLoadingPharmacies ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">جاري تحميل بيانات الصيدليات...</p>
            </div>
          ) : pharmacySubView === 'directory' ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden">
              {pharmacies.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <Store className="w-9 h-9 text-slate-600 mx-auto" />
                  <h3 className="text-sm font-bold text-slate-300">
                    لا توجد صيدليات مسجلة في جدول pharmacy_pharmacies
                  </h3>
                  <p className="text-xs text-slate-500">
                    يمكنك إضافة صيدليات معتمدة ليختار منها العملاء أو المناديب مباشرة.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-3.5 px-4 font-bold">اسم الصيدلية</th>
                        <th className="py-3.5 px-4 font-bold">رقم الهاتف</th>
                        <th className="py-3.5 px-4 font-bold">المحافظة والمركز</th>
                        <th className="py-3.5 px-4 font-bold">العنوان التفصيلي</th>
                        <th className="py-3.5 px-4 font-bold">الحالة</th>
                        <th className="py-3.5 px-4 font-bold">تاريخ التحديث</th>
                        <th className="py-3.5 px-4 font-bold text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {pharmacies
                        .filter((p) => {
                          if (!pharmacySearch.trim()) return true;
                          const q = pharmacySearch.trim().toLowerCase();
                          return (
                            p.name.toLowerCase().includes(q) ||
                            (p.phone || '').toLowerCase().includes(q) ||
                            (p.governorate_name || '').toLowerCase().includes(q) ||
                            (p.center_name || '').toLowerCase().includes(q)
                          );
                        })
                        .map((pharm) => (
                          <tr key={pharm.id} className="hover:bg-slate-800/40">
                            <td className="py-3.5 px-4 font-bold text-white">{pharm.name}</td>
                            <td className="py-3.5 px-4 font-mono text-slate-300" dir="ltr">
                              {pharm.phone || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-200">
                              {pharm.governorate_name || '—'}
                              {pharm.center_name ? ` — ${pharm.center_name}` : ''}
                            </td>
                            <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate">
                              {pharm.address || '—'}
                            </td>
                            <td className="py-3.5 px-4">
                              <button
                                type="button"
                                onClick={() => handleTogglePharmacyActive(pharm)}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border cursor-pointer ${
                                  pharm.is_active
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                }`}
                              >
                                {pharm.is_active ? 'نشطة ومفعلة' : 'معطلة'}
                              </button>
                            </td>
                            <td className="py-3.5 px-4 text-[11px] text-slate-400">
                              {formatDateTimeAr(pharm.updated_at)}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => openEditPharmacyModal(pharm)}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>تعديل</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* User Linked Pharmacies Table (`pharmacy_user_pharmacies`) */
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden">
              {userPharmacies.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <Building2 className="w-9 h-9 text-slate-600 mx-auto" />
                  <h3 className="text-sm font-bold text-slate-300">
                    لا توجد صيدليات مرتبطة بالمستخدمين في pharmacy_user_pharmacies
                  </h3>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-3.5 px-4 font-bold">المستخدم</th>
                        <th className="py-3.5 px-4 font-bold">اسم الصيدلية المحفوظة</th>
                        <th className="py-3.5 px-4 font-bold">مرتبطة بدليل الصيدليات</th>
                        <th className="py-3.5 px-4 font-bold">الهاتف</th>
                        <th className="py-3.5 px-4 font-bold">المحافظة والمركز</th>
                        <th className="py-3.5 px-4 font-bold">العنوان</th>
                        <th className="py-3.5 px-4 font-bold">آخر تحديث</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {userPharmacies
                        .filter((u) => {
                          if (!pharmacySearch.trim()) return true;
                          const q = pharmacySearch.trim().toLowerCase();
                          return (
                            u.pharmacy_name.toLowerCase().includes(q) ||
                            (u.user_name || '').toLowerCase().includes(q) ||
                            (u.governorate_name || '').toLowerCase().includes(q) ||
                            (u.center_name || '').toLowerCase().includes(q)
                          );
                        })
                        .map((up) => (
                          <tr key={up.id} className="hover:bg-slate-800/40">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-white">
                                {up.user_name || 'مستخدم'}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {up.user_email || up.user_id}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-emerald-300">
                              {up.pharmacy_name}
                            </td>
                            <td className="py-3.5 px-4">
                              {up.linked_pharmacy ? (
                                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px]">
                                  {up.linked_pharmacy.name}
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[11px]">إدخال مخصص</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-300" dir="ltr">
                              {up.phone || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-200">
                              {up.governorate_name || '—'}
                              {up.center_name ? ` — ${up.center_name}` : ''}
                            </td>
                            <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate">
                              {up.address || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-[11px] text-slate-400">
                              {formatDateTimeAr(up.updated_at)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: GENERAL SETTINGS & DELIVERY AREAS (`pharmacy_settings` & `pharmacy_delivery_area_settings`) */}
      {/* =================================================================== */}
      {currentTab === 'pharmacy_settings' && (
        <div className="space-y-6">
          {/* Card 1: General Pharmacy Settings (`pharmacy_settings`) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <span>إعدادات الصيدلية العامة (جدول pharmacy_settings)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  التحكم المركزي في تفعيل خدمة الصيدلية، إظهار أو إخفاء القسم في تطبيق طلبات البيت، وحجم العرض (Full / Half)
                </p>
              </div>

              {pharmacySettings && (
                <div className="text-[11px] text-slate-400 text-left">
                  <div>آخر تحديث: {formatDateTimeAr(pharmacySettings.updated_at)}</div>
                  {!settingsExistsInDb && (
                    <span className="text-amber-400 font-bold">
                      (لم يُنشأ صف بعد — سيتم إنشاؤه عند الحفظ)
                    </span>
                  )}
                </div>
              )}
            </div>

            {settingsError && (
              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">تنبيه من قاعدة البيانات (Supabase RLS / Query):</div>
                  <div>{settingsError}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Toggle 1: service_enabled */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-white">تفعيل خدمة الصيدلية</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    عمود <code className="text-emerald-300 font-mono">service_enabled</code> — السماح باستقبال طلبات الصيدلية
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setServiceEnabledInput((v) => !v)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                    serviceEnabledInput
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}
                >
                  {serviceEnabledInput ? 'مفعلة (Enabled)' : 'متوقفة (Disabled)'}
                </button>
              </div>

              {/* Toggle 2: section_visible */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-white">إظهار القسم في تطبيق البيت</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    عمود <code className="text-emerald-300 font-mono">section_visible</code> — إظهار أو إخفاء بطاقة الصيدلية
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSectionVisibleInput((v) => !v)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                    sectionVisibleInput
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {sectionVisibleInput ? 'ظاهر (Visible)' : 'مخفي (Hidden)'}
                </button>
              </div>

              {/* Select 3: display_width */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-white">حجم عرض القسم (Display Width)</div>
                  <div className="text-[11px] text-slate-400">
                    عمود <code className="text-emerald-300 font-mono">display_width</code>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDisplayWidthInput('full')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                      displayWidthInput === 'full'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    عرض كامل (full)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayWidthInput('half')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                      displayWidthInput === 'half'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    نصف عرض (half)
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveGeneralSettings}
                disabled={isSavingSettings}
                className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors shadow-lg shadow-emerald-950/50 disabled:opacity-50"
              >
                {isSavingSettings ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>حفظ الإعدادات العامة في Supabase</span>
              </button>
            </div>
          </div>

          {/* Card 2: Delivery Area Settings (`pharmacy_delivery_area_settings`) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-t-0 border-b border-slate-800">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-teal-400" />
                  <span>إعدادات مناطق التوصيل والرسوم (pharmacy_delivery_area_settings)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  تحديد المحافظات والمراكز المغطاة بخدمة الصيدلية ورسوم التوصيل لكل مركز
                </p>
              </div>

              <button
                type="button"
                onClick={openAddAreaModal}
                className="px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-lg shadow-teal-950/50 self-start lg:self-center"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة / ضبط محافظة ومراكزها</span>
              </button>
            </div>

            {/* Area Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={areaSearch}
                  onChange={(e) => setAreaSearch(e.target.value)}
                  placeholder="بحث باسم المحافظة أو المركز..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pr-10 pl-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>

              <select
                value={areaGovFilter}
                onChange={(e) => setAreaGovFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-white outline-none"
              >
                <option value="all">كل المحافظات المسجلة</option>
                {Array.from(new Set(deliveryAreas.map((a) => a.governorate_name))).map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              <select
                value={areaStatusFilter}
                onChange={(e) => setAreaStatusFilter(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-white outline-none"
              >
                <option value="all">جميع الحالات (مفعل ومعطل)</option>
                <option value="enabled">المراكز المفعلة فقط</option>
                <option value="disabled">المراكز المعطلة فقط</option>
              </select>
            </div>

            {areasError && (
              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{areasError}</span>
              </div>
            )}

            {isLoadingAreas ? (
              <div className="p-10 text-center space-y-2">
                <RefreshCw className="w-6 h-6 text-teal-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-400">جاري تحميل إعدادات المناطق...</p>
              </div>
            ) : filteredAreas.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <MapPin className="w-8 h-8 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-slate-300">لا توجد مناطق مسجلة مطابقة</h3>
                <p className="text-xs text-slate-500">
                  اضغط على «إضافة / ضبط محافظة ومراكزها» لإضافة مراكز المحافظة وتحديد رسوم التوصيل.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">كود المحافظة</th>
                      <th className="py-3 px-4 font-bold">المحافظة</th>
                      <th className="py-3 px-4 font-bold">المركز / المدينة</th>
                      <th className="py-3 px-4 font-bold">رسوم التوصيل (delivery_fee)</th>
                      <th className="py-3 px-4 font-bold">حالة الخدمة</th>
                      <th className="py-3 px-4 font-bold">آخر تحديث</th>
                      <th className="py-3 px-4 font-bold text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {filteredAreas.map((area) => (
                      <tr key={area.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {area.governorate_code}
                        </td>
                        <td className="py-3 px-4 font-bold text-white">{area.governorate_name}</td>
                        <td className="py-3 px-4 font-bold text-teal-300">{area.center_name}</td>
                        <td className="py-3 px-4">
                          {inlineAreaId === area.id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={inlineAreaFee}
                                onChange={(e) => setInlineAreaFee(e.target.value)}
                                className="w-24 bg-slate-950 border border-teal-500/50 rounded-lg px-2 py-1 text-xs text-white font-mono"
                              />
                              <button
                                type="button"
                                disabled={isSavingInlineArea}
                                onClick={() => handleSaveInlineAreaFee(area)}
                                className="p-1.5 rounded-lg bg-emerald-600 text-white cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setInlineAreaId(null)}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-emerald-300">
                                {Number(area.delivery_fee).toLocaleString()} ج.م
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setInlineAreaId(area.id);
                                  setInlineAreaFee(String(area.delivery_fee ?? 0));
                                }}
                                className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                              >
                                تعديل سريع
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleAreaEnabled(area)}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border cursor-pointer ${
                              area.service_enabled
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {area.service_enabled ? 'مفعلة' : 'معطلة'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-400">
                          {formatDateTimeAr(area.updated_at)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditAreaModal(area)}
                              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                              title="تعديل"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteArea(area)}
                              className="p-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: FULL ORDER DETAILS & ADMIN ACTIONS                         */}
      {/* =================================================================== */}
      {selectedOrderId && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6 animate-in fade-in duration-150"
          onClick={() => {
            setSelectedOrderId(null);
            setOrderDetails(null);
          }}
        >
          <div
            className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-5xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 bg-slate-950 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Pill className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-black text-white">
                      تفاصيل طلب الصيدلية{' '}
                      <span className="font-mono text-emerald-300">
                        {orderDetails?.order?.order_number || ''}
                      </span>
                    </h3>
                    {orderDetails?.order && (
                      <span
                        className={`px-2.5 py-0.5 rounded-xl text-[11px] font-bold border ${
                          getPharmacyStatusMeta(orderDetails.order.status).badgeClass
                        }`}
                      >
                        {getPharmacyStatusMeta(orderDetails.order.status).label}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    معرف الطلب: <span className="font-mono">{selectedOrderId}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openOrderDetails(selectedOrderId)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                  title="تحديث تفاصيل الطلب"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isLoadingOrderDetails ? 'animate-spin text-emerald-400' : ''}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrderId(null);
                    setOrderDetails(null);
                  }}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 overscroll-contain">
              {isLoadingOrderDetails ? (
                <div className="py-16 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">
                    جاري تحميل كافة تفاصيل الطلب والأصناف والمرفقات وسجل الحالات...
                  </p>
                </div>
              ) : orderDetailsError || !orderDetails?.order ? (
                <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs">
                  {orderDetailsError || 'تعذر العثور على بيانات الطلب'}
                </div>
              ) : (
                <>
                  {/* 1. Basic Order, Customer, Address & Financials Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Customer & Address Info */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                      <h4 className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                        <User className="w-4 h-4" />
                        <span>بيانات العميل والعنوان</span>
                      </h4>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">العميل / الأسرة:</span>
                          <span className="font-bold text-white">
                            {orderDetails.order.customer_name ||
                              orderDetails.order.household_name ||
                              'مستخدم مسجل'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">رقم الهاتف:</span>
                          <span className="font-mono text-emerald-300" dir="ltr">
                            {orderDetails.order.customer_phone || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">المحافظة والمركز:</span>
                          <span className="font-bold text-slate-200">
                            {orderDetails.order.address_governorate_name || '—'} /{' '}
                            {orderDetails.order.address_center_name || '—'}
                          </span>
                        </div>
                        <div className="pt-1 border-t border-slate-800/80">
                          <span className="text-slate-400 block mb-0.5">العنوان التفصيلي:</span>
                          <p className="text-slate-200 leading-relaxed">
                            {orderDetails.order.address_text || '—'}
                          </p>
                        </div>
                        {orderDetails.order.address_latitude !== null &&
                          orderDetails.order.address_longitude !== null && (
                            <div className="pt-1">
                              <a
                                href={`https://www.google.com/maps?q=${orderDetails.order.address_latitude},${orderDetails.order.address_longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-300 hover:underline"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                                <span>
                                  فتح الإحداثيات ({orderDetails.order.address_latitude},{' '}
                                  {orderDetails.order.address_longitude})
                                </span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                      </div>
                    </div>

                    {/* Pharmacy & Prescription Info */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                      <h4 className="text-xs font-black text-teal-400 flex items-center gap-1.5">
                        <Store className="w-4 h-4" />
                        <span>الصيدلية والروشتة</span>
                      </h4>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">وضع اختيار الصيدلية:</span>
                          <span className="font-mono text-slate-200">
                            {orderDetails.order.pharmacy_selection_mode || 'افتراضي'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">الصيدلية المطلوبة:</span>
                          <span className="font-bold text-white">
                            {orderDetails.order.requested_pharmacy_name ||
                              orderDetails.order.requested_pharmacy?.name ||
                              'أي صيدلية متاحة'}
                          </span>
                        </div>
                        {orderDetails.order.prescription_title && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">عنوان الروشتة:</span>
                            <span className="font-bold text-emerald-300">
                              {orderDetails.order.prescription_title}
                            </span>
                          </div>
                        )}
                        {orderDetails.order.customer_notes && (
                          <div className="pt-1 border-t border-slate-800/80">
                            <span className="text-slate-400 block mb-0.5">ملاحظات العميل:</span>
                            <p className="text-amber-200 bg-amber-950/30 border border-amber-500/20 rounded-xl p-2">
                              {orderDetails.order.customer_notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Financials & Timestamps */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                      <h4 className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                        <Receipt className="w-4 h-4" />
                        <span>التكلفة والتوقيتات</span>
                      </h4>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">رسوم التوصيل (delivery_fee):</span>
                          <span className="font-mono font-bold text-white">
                            {Number(orderDetails.order.delivery_fee || 0).toLocaleString()} ج.م
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">قيمة الأدوية (medicines_total):</span>
                          <span className="font-mono font-bold text-emerald-300">
                            {orderDetails.order.medicines_total !== null &&
                            orderDetails.order.medicines_total !== undefined
                              ? `${Number(orderDetails.order.medicines_total).toLocaleString()} ج.م`
                              : 'لم تُسعّر بعد'}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-800">
                          <span className="text-slate-300 font-bold">الإجمالي الكلي (grand_total):</span>
                          <span className="font-mono font-black text-amber-300 text-sm">
                            {orderDetails.order.grand_total !== null &&
                            orderDetails.order.grand_total !== undefined
                              ? `${Number(orderDetails.order.grand_total).toLocaleString()} ج.م`
                              : `${(
                                  Number(orderDetails.order.delivery_fee || 0) +
                                  Number(orderDetails.order.medicines_total || 0)
                                ).toLocaleString()} ج.م`}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[11px] text-slate-400">
                          <div>إنشاء الطلب: {formatDateTimeAr(orderDetails.order.created_at)}</div>
                          {orderDetails.order.accepted_at && (
                            <div>تاريخ القبول: {formatDateTimeAr(orderDetails.order.accepted_at)}</div>
                          )}
                          {orderDetails.order.shopping_started_at && (
                            <div>
                              بدء التجهيز: {formatDateTimeAr(orderDetails.order.shopping_started_at)}
                            </div>
                          )}
                          {orderDetails.order.completed_at && (
                            <div className="text-emerald-400">
                              الإكمال: {formatDateTimeAr(orderDetails.order.completed_at)}
                            </div>
                          )}
                          {orderDetails.order.cancelled_at && (
                            <div className="text-rose-400">
                              الإلغاء: {formatDateTimeAr(orderDetails.order.cancelled_at)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Admin Order Actions: Assign Driver & Decide Driver Cancellation */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Assign / Change Driver via `public.pharmacy_admin_assign_driver` */}
                    <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                          <Bike className="w-4 h-4 text-teal-400" />
                          <span>إسناد أو تغيير المندوب (RPC: pharmacy_admin_assign_driver)</span>
                        </h4>
                        {orderDetails.deliveryOrder?.driver && (
                          <span className="px-2.5 py-0.5 rounded-lg bg-teal-500/15 text-teal-300 border border-teal-500/30 text-[11px] font-bold">
                            الحالي: {orderDetails.deliveryOrder.driver.full_name}
                          </span>
                        )}
                      </div>

                      {orderDetails.order.status === 'completed' ||
                      orderDetails.order.status === 'cancelled' ? (
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                          الطلب في حالة نهائية ({getPharmacyStatusMeta(orderDetails.order.status).label})؛ لا يمكن إعادة إسناد مندوب.
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <select
                            value={selectedDriverIdForAssign}
                            onChange={(e) => setSelectedDriverIdForAssign(e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                          >
                            <option value="">— اختر مندوب توصيل نشط —</option>
                            {availableDrivers.map((drv) => (
                              <option key={drv.id} value={drv.id}>
                                {drv.full_name} ({drv.phone})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={isAssigningDriver || !selectedDriverIdForAssign}
                            onClick={handleAssignDriver}
                            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {isAssigningDriver ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>إسناد المندوب</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Driver Cancellation Request Decision via `public.pharmacy_admin_decide_driver_cancel` */}
                    <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                      <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>
                          قرار طلب إلغاء/اعتذار المندوب (RPC: pharmacy_admin_decide_driver_cancel)
                        </span>
                      </h4>

                      {orderDetails.deliveryOrder?.cancellation_requested_at ? (
                        <div className="space-y-3">
                          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs space-y-1">
                            <div className="text-amber-300 font-bold">
                              تاريخ طلب الإلغاء:{' '}
                              {formatDateTimeAr(orderDetails.deliveryOrder.cancellation_requested_at)}
                            </div>
                            <div className="text-slate-200">
                              <span className="text-slate-400">السبب المذكور: </span>
                              {orderDetails.deliveryOrder.cancellation_reason || 'بدون سبب نصي'}
                            </div>
                            {orderDetails.deliveryOrder.cancellation_decided_at && (
                              <div className="text-emerald-300 pt-1 border-t border-amber-500/20">
                                تم البت في الطلب ({orderDetails.deliveryOrder.cancellation_decision}) بتاريخ{' '}
                                {formatDateTimeAr(orderDetails.deliveryOrder.cancellation_decided_at)}
                              </div>
                            )}
                          </div>

                          {!orderDetails.deliveryOrder.cancellation_decided_at && (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={cancelDecisionNote}
                                onChange={(e) => setCancelDecisionNote(e.target.value)}
                                placeholder="ملاحظة الإدارة على قبول أو رفض اعتذار المندوب (اختياري)..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={isDecidingCancel}
                                  onClick={() => handleDecideDriverCancel(true)}
                                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>قبول إلغاء المندوب</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isDecidingCancel}
                                  onClick={() => handleDecideDriverCancel(false)}
                                  className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>رفض طلب الإلغاء</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                          لا يوجد طلب إلغاء معلق من المندوب لهذا الطلب حالياً.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Order Items (`pharmacy_order_items`) */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-black text-white flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-emerald-400" />
                      <span>أصناف الطلب الطبية (pharmacy_order_items) ({orderDetails.items.length})</span>
                    </h4>

                    {orderDetails.items.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        لا توجد أصناف نصية مسجلة في pharmacy_order_items (قد يعتمد الطلب على صور الروشتة المرفقة).
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                            <tr>
                              <th className="py-2.5 px-3 font-bold">#</th>
                              <th className="py-2.5 px-3 font-bold">اسم الصنف / الدواء</th>
                              <th className="py-2.5 px-3 font-bold">الكمية المطلوبة</th>
                              <th className="py-2.5 px-3 font-bold">الكمية المشتراة</th>
                              <th className="py-2.5 px-3 font-bold">النواقص (shortage_quantity)</th>
                              <th className="py-2.5 px-3 font-bold">سبب النقص / ملاحظة المندوب</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {orderDetails.items.map((item, idx) => (
                              <tr key={item.id}>
                                <td className="py-2.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                                <td className="py-2.5 px-3 font-bold text-white">{item.item_name}</td>
                                <td className="py-2.5 px-3 font-mono text-emerald-300">
                                  {item.requested_quantity} {item.unit || ''}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-teal-300">
                                  {item.purchased_quantity !== null &&
                                  item.purchased_quantity !== undefined
                                    ? `${item.purchased_quantity} ${item.unit || ''}`
                                    : '—'}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-rose-300">
                                  {item.shortage_quantity !== null &&
                                  item.shortage_quantity !== undefined &&
                                  item.shortage_quantity > 0
                                    ? `${item.shortage_quantity} ${item.unit || ''}`
                                    : '0'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-300">
                                  {item.shortage_reason && (
                                    <div className="text-rose-300">سبب النقص: {item.shortage_reason}</div>
                                  )}
                                  {item.driver_note && (
                                    <div className="text-amber-300">ملاحظة: {item.driver_note}</div>
                                  )}
                                  {!item.shortage_reason && !item.driver_note && '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* 4. Order Files (`pharmacy_order_files`) from private `pharmacy` Storage bucket */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-white flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-emerald-400" />
                        <span>
                          مرفقات الطلب من البكت الخاص (pharmacy_order_files) ({orderDetails.files.length})
                        </span>
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        يتم توليد روابط موقّعة (Signed URLs) آمنة لكل ملف
                      </span>
                    </div>

                    {orderDetails.files.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        لا توجد مرفقات مسجلة لهذا الطلب في جدول pharmacy_order_files.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {orderDetails.files.map((file, idx) => (
                          <PharmacyAttachmentCard
                            key={file.id}
                            storagePath={file.storage_path}
                            title={
                              file.file_type === 'invoice' || file.file_type === 'receipt'
                                ? `فاتورة صيدلية #${idx + 1}`
                                : `مرفق روشتة / طلب #${idx + 1}`
                            }
                            subtitle={`النوع: ${file.file_type} • ${formatDateTimeAr(file.created_at)}`}
                            mimeType={file.mime_type}
                            fileTypeBadge={file.file_type}
                            driverNote={file.driver_note}
                            onOpenLightbox={openLightbox}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 5. Linked Saved Prescription if present (`saved_prescription_id`) */}
                  {orderDetails.savedPrescription && (
                    <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
                      <h4 className="text-xs font-black text-emerald-300 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>
                          الروشتة المحفوظة المرتبطة بالطلب: {orderDetails.savedPrescription.title}
                        </span>
                      </h4>

                      {orderDetails.savedPrescription.files &&
                        orderDetails.savedPrescription.files.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {orderDetails.savedPrescription.files.map((spf, idx) => (
                              <PharmacyAttachmentCard
                                key={spf.id}
                                storagePath={spf.storage_path}
                                title={`ملف الروشتة المحفوظة #${idx + 1}`}
                                subtitle={formatDateTimeAr(spf.created_at)}
                                mimeType={spf.mime_type}
                                fileTypeBadge="saved_prescription"
                                onOpenLightbox={openLightbox}
                              />
                            ))}
                          </div>
                        )}
                    </div>
                  )}

                  {/* 6. Status History & Change Log (`pharmacy_order_status_history` & `pharmacy_order_change_log`) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Status History */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                      <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                        <History className="w-4 h-4 text-cyan-400" />
                        <span>
                          سجل تغير الحالات (pharmacy_order_status_history) (
                          {orderDetails.statusHistory.length})
                        </span>
                      </h4>

                      {orderDetails.statusHistory.length === 0 ? (
                        <p className="text-xs text-slate-500">لا يوجد سجل حالات مسجل بعد.</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {orderDetails.statusHistory.map((h) => (
                            <div
                              key={h.id}
                              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-white">
                                  {h.from_status
                                    ? `${getPharmacyStatusMeta(h.from_status).label} ← `
                                    : ''}
                                  <span className="text-emerald-300">
                                    {getPharmacyStatusMeta(h.to_status).label}
                                  </span>
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {formatDateTimeAr(h.created_at)}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                                <span>الدور: {h.changed_by_role || 'النظام'}</span>
                                {h.note && <span className="text-amber-300">ملاحظة: {h.note}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Change Log */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                      <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-purple-400" />
                        <span>
                          سجل التعديلات (pharmacy_order_change_log) ({orderDetails.changeLog.length})
                        </span>
                      </h4>

                      {orderDetails.changeLog.length === 0 ? (
                        <p className="text-xs text-slate-500">لا يوجد سجل تعديلات مسجل على الطلب.</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {orderDetails.changeLog.map((cl) => (
                            <div
                              key={cl.id}
                              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-purple-300">{cl.change_type}</span>
                                <span className="text-[10px] text-slate-400">
                                  {formatDateTimeAr(cl.created_at)}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400">
                                بواسطة: {cl.changed_by_role || 'غير محدد'}
                                {cl.note ? ` — ${cl.note}` : ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Sticky Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/95 backdrop-blur flex items-center justify-between gap-2 shrink-0 sticky bottom-0 z-10">
              <span className="text-[11px] text-slate-400 truncate">
                معرف الطلب: <span className="font-mono">{selectedOrderId}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedOrderId(null);
                  setOrderDetails(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer shrink-0"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: SAVED PRESCRIPTION DETAILS MODAL                           */}
      {/* =================================================================== */}
      {selectedPrescription && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6 animate-in fade-in duration-150"
          onClick={() => setSelectedPrescription(null)}
        >
          <div
            className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 bg-slate-950 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0 gap-2">
              <div className="min-w-0">
                <h3 className="text-base font-black text-white truncate">
                  تفاصيل الروشتة المحفوظة: {selectedPrescription.title}
                </h3>
                <p className="text-xs text-slate-400 truncate">
                  العميل: {selectedPrescription.user_name || selectedPrescription.user_id} • الصيدلية:{' '}
                  {selectedPrescription.pharmacy_name || 'غير محددة'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPrescription(null)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1 overscroll-contain">
              {/* Items */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-emerald-400">
                  عناصر الروشتة (pharmacy_saved_prescription_items) (
                  {selectedPrescription.items?.length || 0})
                </h4>
                {!selectedPrescription.items || selectedPrescription.items.length === 0 ? (
                  <p className="text-xs text-slate-500">لا توجد عناصر نصية مسجلة في هذه الروشتة.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedPrescription.items.map((it) => (
                      <div
                        key={it.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <span className="font-bold text-white">{it.item_name}</span>
                        <span className="font-mono text-emerald-300">
                          {it.requested_quantity} {it.unit || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Files */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-teal-400">
                  مرفقات الروشتة من البكت الخاص (pharmacy_saved_prescription_files) (
                  {selectedPrescription.files?.length || 0})
                </h4>
                {!selectedPrescription.files || selectedPrescription.files.length === 0 ? (
                  <p className="text-xs text-slate-500">لا توجد ملفات مرفقة بهذه الروشتة.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedPrescription.files.map((f, idx) => (
                      <PharmacyAttachmentCard
                        key={f.id}
                        storagePath={f.storage_path}
                        title={`${selectedPrescription.title} — مرفق #${idx + 1}`}
                        subtitle={formatDateTimeAr(f.created_at)}
                        mimeType={f.mime_type}
                        fileTypeBadge="prescription_file"
                        onOpenLightbox={openLightbox}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/95 backdrop-blur flex justify-end shrink-0 sticky bottom-0 z-10">
              <button
                type="button"
                onClick={() => setSelectedPrescription(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: ADD / EDIT PHARMACY DIRECTORY (`pharmacy_pharmacies`)      */}
      {/* =================================================================== */}
      {showPharmacyModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-150"
          onClick={() => !isSavingPharmacy && setShowPharmacyModal(false)}
        >
          <div
            className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 bg-slate-950 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-black text-white">
                  {editingPharmacy ? 'تعديل بيانات الصيدلية' : 'إضافة صيدلية جديدة إلى الدليل'}
                </h3>
                {!editingPharmacy && (
                  <p className="text-[11px] text-slate-400 mt-0.5">تُحفظ البيانات المدخلة تلقائياً عند الإغلاق</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowPharmacyModal(false)}
                className="p-1.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePharmacy} className="flex flex-col flex-1 min-h-0 text-xs">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">اسم الصيدلية *</label>
                  <input
                    type="text"
                    required
                    value={pharmacyForm.name}
                    onChange={(e) => setPharmacyForm((s) => ({ ...s, name: e.target.value }))}
                    placeholder="مثال: صيدلية الشفاء الجديدة"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">رقم الهاتف</label>
                    <input
                      type="text"
                      value={pharmacyForm.phone}
                      onChange={(e) => setPharmacyForm((s) => ({ ...s, phone: e.target.value }))}
                      placeholder="010xxxxxxxx"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">المحافظة</label>
                    <select
                      value={pharmacyForm.governorate_code}
                      onChange={(e) => {
                        const code = e.target.value;
                        const gov = EGYPT_GOVERNORATES.find((g) => g.code === code);
                        setPharmacyForm((s) => ({
                          ...s,
                          governorate_code: code,
                          governorate_name: gov?.name_ar || code,
                          center_name: gov?.markazes[0] || '',
                        }));
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                    >
                      {EGYPT_GOVERNORATES.map((g) => (
                        <option key={g.code} value={g.code}>
                          {g.name_ar} ({g.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">المركز / المدينة</label>
                    <input
                      type="text"
                      value={pharmacyForm.center_name}
                      onChange={(e) =>
                        setPharmacyForm((s) => ({ ...s, center_name: e.target.value }))
                      }
                      placeholder="اسم المركز"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                    />
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl bg-slate-950 border border-slate-800 w-full">
                      <input
                        type="checkbox"
                        checked={pharmacyForm.is_active}
                        onChange={(e) =>
                          setPharmacyForm((s) => ({ ...s, is_active: e.target.checked }))
                        }
                      />
                      <span className="font-bold text-emerald-300">صيدلية نشطة ومفعلة</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    العنوان التفصيلي <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={pharmacyForm.address}
                    onChange={(e) => setPharmacyForm((s) => ({ ...s, address: e.target.value }))}
                    placeholder="الشارع / المعلم البارز أو الميدان..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    حقل إلزامي في قاعدة البيانات لحفظ موقع الصيدلية بدقة
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">خط العرض (Latitude)</label>
                    <input
                      type="number"
                      step="any"
                      value={pharmacyForm.latitude}
                      onChange={(e) => setPharmacyForm((s) => ({ ...s, latitude: e.target.value }))}
                      placeholder="اختياري"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">خط الطول (Longitude)</label>
                    <input
                      type="number"
                      step="any"
                      value={pharmacyForm.longitude}
                      onChange={(e) => setPharmacyForm((s) => ({ ...s, longitude: e.target.value }))}
                      placeholder="اختياري"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800 bg-slate-950/95 backdrop-blur shrink-0 sticky bottom-0 z-10">
                <button
                  type="button"
                  onClick={() => setShowPharmacyModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  إغلاق
                </button>
                <button
                  type="submit"
                  disabled={isSavingPharmacy}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingPharmacy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>حفظ الصيدلية</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 4: ADD / EDIT DELIVERY AREA (`pharmacy_delivery_area_settings`)*/}
      {/* =================================================================== */}
      {showAreaModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-150"
          onClick={() => !isSavingArea && setShowAreaModal(false)}
        >
          <div
            className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 bg-slate-950 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-black text-white">
                {editingArea
                  ? `تعديل منطقة توصيل: ${editingArea.center_name} (${editingArea.governorate_name})`
                  : 'إضافة / ضبط مناطق توصيل الصيدلية'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAreaModal(false)}
                className="p-1.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAreaModal} className="flex flex-col flex-1 min-h-0 text-xs">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">المحافظة</label>
                    <select
                      value={areaGovCode}
                      disabled={Boolean(editingArea)}
                      onChange={(e) => {
                        const code = e.target.value;
                        setAreaGovCode(code);
                        const gov = EGYPT_GOVERNORATES.find((g) => g.code === code);
                        setSelectedCentersForBulk(gov ? [...gov.markazes] : []);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                    >
                      {EGYPT_GOVERNORATES.map((g) => (
                        <option key={g.code} value={g.code}>
                          {g.name_ar} ({g.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      رسوم التوصيل (ج.م) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      required
                      value={areaDeliveryFee}
                      onChange={(e) => setAreaDeliveryFee(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono"
                    />
                  </div>
                </div>

                {!editingArea && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-300">
                        اختر المراكز المشمولة ({selectedCentersForBulk.length})
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const gov = EGYPT_GOVERNORATES.find((g) => g.code === areaGovCode);
                            setSelectedCentersForBulk(gov ? [...gov.markazes] : []);
                          }}
                          className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                        >
                          تحديد الكل
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedCentersForBulk([])}
                          className="text-[11px] text-slate-400 hover:underline cursor-pointer"
                        >
                          إلغاء الكل
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-2.5 rounded-2xl bg-slate-950 border border-slate-800">
                      {(
                        EGYPT_GOVERNORATES.find((g) => g.code === areaGovCode)?.markazes || []
                      ).map((m) => {
                        const checked = selectedCentersForBulk.includes(m);
                        return (
                          <label
                            key={m}
                            className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer ${
                              checked
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                                : 'bg-slate-900 border-slate-800 text-slate-400'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCentersForBulk((prev) => [...prev, m]);
                                } else {
                                  setSelectedCentersForBulk((prev) => prev.filter((x) => x !== m));
                                }
                              }}
                            />
                            <span className="truncate">{m}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {editingArea ? 'اسم المركز *' : 'أو إضافة مركز إضافي يدوياً (اختياري)'}
                  </label>
                  <input
                    type="text"
                    value={customCenterName}
                    onChange={(e) => setCustomCenterName(e.target.value)}
                    placeholder="اكتب اسم المركز..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <input
                    type="checkbox"
                    checked={areaServiceEnabled}
                    onChange={(e) => setAreaServiceEnabled(e.target.checked)}
                  />
                  <span className="font-bold text-emerald-300">
                    تفعيل خدمة توصيل الصيدلية في هذه المنطقة (service_enabled = true)
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800 bg-slate-950/95 backdrop-blur shrink-0 sticky bottom-0 z-10">
                <button
                  type="button"
                  onClick={() => setShowAreaModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  إغلاق
                </button>
                <button
                  type="submit"
                  disabled={isSavingArea}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingArea && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>حفظ إعدادات المنطقة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 5: FULLSCREEN LIGHTBOX FOR PRIVATE `pharmacy` BUCKET FILES    */}
      {/* =================================================================== */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="w-full max-w-5xl h-[92vh] sm:h-[90vh] bg-slate-900/95 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl flex flex-col justify-between overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 bg-slate-950 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            {/* Top Bar */}
            <div className="flex items-center justify-between gap-3 bg-slate-950 border-b border-slate-800 p-3.5 sm:p-4 shrink-0">
              <div className="min-w-0">
                <h4 className="text-sm font-black text-white truncate">{lightboxItem.title}</h4>
                <p className="text-[11px] text-slate-400 font-mono truncate" dir="ltr">
                  pharmacy/{adminService.normalizePharmacyStoragePath(lightboxItem.storagePath)}
                </p>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setLightboxZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  title="تصغير"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-slate-300 px-1.5">
                  {Math.round(lightboxZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  title="تكبير"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => loadLightboxUrl(lightboxItem.storagePath)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 cursor-pointer"
                  title="تحديث الرابط الموقّع"
                >
                  <RefreshCw className={`w-4 h-4 ${lightboxLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxItem(null)}
                  className="p-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Center Canvas */}
            <div className="flex-1 flex items-center justify-center overflow-auto p-4 overscroll-contain">
              {lightboxLoading ? (
                <div className="text-center space-y-2">
                  <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
                  <p className="text-xs text-slate-300">جاري توليد رابط موقّع جديد...</p>
                </div>
              ) : lightboxSignedUrl ? (
                <img
                  src={lightboxSignedUrl}
                  alt={lightboxItem.title}
                  style={{ transform: `scale(${lightboxZoom})` }}
                  className="max-h-[72vh] max-w-[88vw] object-contain transition-transform duration-150 rounded-xl shadow-2xl"
                />
              ) : (
                <div className="p-6 rounded-2xl bg-slate-900 border border-amber-500/40 text-center max-w-md space-y-2">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-xs font-bold text-amber-200">
                    {lightboxError || 'تعذر تحميل الملف من البكت الخاص'}
                  </p>
                </div>
              )}
            </div>

            {lightboxItem.driverNote && (
              <div className="bg-slate-950 border-t border-amber-500/30 p-3 text-center text-xs text-amber-200 shrink-0">
                <strong>ملاحظة المندوب على المرفق:</strong> {lightboxItem.driverNote}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPharmacyManagement;
