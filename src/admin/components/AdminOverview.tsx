import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdmin } from '../context/AdminContext';
import {
  adminService,
  resolveDocumentSrc,
  isDirectDocumentSrc,
} from '../services/adminService';
import {
  AdminDateFilter,
  OperationalCommandCenterData,
  PharmacyStatsSummary,
  DeliveryOrder,
  DeliveryOrderItem,
  DeliveryOrderStatusHistory,
  DeliveryDriver,
  DriverDocumentType,
  DriverDocumentColumn,
  PharmacyOrder,
  PharmacyOrderItem,
  PharmacyDeliveryOrder,
  PharmacyDirectoryRecord,
  PharmacySavedPrescription,
  PharmacyOrderFile,
} from '../types';
import {
  Users,
  Receipt,
  Package,
  Bell,
  ArrowUpRight,
  RefreshCw,
  Bike,
  UserX,
  Send,
  Pill,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  MapPin,
  Search,
  ChevronLeft,
  Inbox,
  Image as ImageIcon,
  Eye,
  X,
  Phone,
  ShieldAlert,
  Check,
  Maximize2,
  ExternalLink,
} from 'lucide-react';

interface DriverDocMetaItem {
  type: DriverDocumentType;
  column: DriverDocumentColumn;
  title: string;
  shortLabel: string;
}

const OVERVIEW_DRIVER_DOC_TYPES: DriverDocMetaItem[] = [
  {
    type: 'id_card_front',
    column: 'id_card_front_path',
    title: 'بطاقة الهوية (الوجه الأمامي)',
    shortLabel: 'هوية أمامي',
  },
  {
    type: 'id_card_back',
    column: 'id_card_back_path',
    title: 'بطاقة الهوية (الوجه الخلفي)',
    shortLabel: 'هوية خلفي',
  },
  {
    type: 'driver_license',
    column: 'driver_license_path',
    title: 'رخصة القيادة الشخصية',
    shortLabel: 'رخصة قيادة',
  },
  {
    type: 'vehicle_license',
    column: 'vehicle_license_path',
    title: 'رخصة تسيير المركبة',
    shortLabel: 'رخصة مركبة',
  },
];

interface OverviewDocPreviewState {
  hasStoredPath: boolean;
  rawPath: string | null;
  url: string | null;
  loading: boolean;
  broken: boolean;
  error: string | null;
}

export const AdminOverview: React.FC = () => {
  const {
    stats,
    isStatsLoading,
    statsError,
    refreshStats,
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    navigateToSection,
    hasPermission,
    showToast,
  } = useAdmin();

  // Explicit Permission Checks (UI visibility + handler enforcement; true protection is enforced on DB/Server)
  const canViewDeliveryOrders =
    hasPermission('delivery.view') || hasPermission('orders.view');
  const canManageDeliveryOrders =
    hasPermission('delivery.manage') || hasPermission('orders.manage');
  const canViewPharmacyOrders =
    hasPermission('pharmacy.view') || hasPermission('orders.view');
  const canManagePharmacyOrders =
    hasPermission('pharmacy.manage') ||
    hasPermission('delivery.manage') ||
    hasPermission('orders.manage');
  const canApproveDrivers =
    hasPermission('drivers.approve') || hasPermission('delivery.manage');

  const canViewOrderBySource = useCallback(
    (source: 'delivery' | 'pharmacy') =>
      source === 'delivery' ? canViewDeliveryOrders : canViewPharmacyOrders,
    [canViewDeliveryOrders, canViewPharmacyOrders]
  );

  const canDecideCancelBySource = useCallback(
    (source: 'delivery' | 'pharmacy') =>
      source === 'delivery' ? canManageDeliveryOrders : canManagePharmacyOrders,
    [canManageDeliveryOrders, canManagePharmacyOrders]
  );

  const [commandData, setCommandData] = useState<OperationalCommandCenterData | null>(null);
  const [isCommandLoading, setIsCommandLoading] = useState<boolean>(true);
  const [commandError, setCommandError] = useState<string | null>(null);

  const [pharmacyStats, setPharmacyStats] = useState<PharmacyStatsSummary | null>(null);
  const [isPharmacyLoading, setIsPharmacyLoading] = useState<boolean>(true);
  const [pharmacyError, setPharmacyError] = useState<string | null>(null);

  const [assignedSearch, setAssignedSearch] = useState<string>('');
  const [activeQueueTab, setActiveQueueTab] = useState<
    'assigned' | 'pending_review' | 'cancellations' | 'drivers'
  >('assigned');

  // =========================================================================
  // Phase 3 — 1. Order Details Quick Preview Modal / Bottom Sheet State
  // =========================================================================
  const [orderPreviewTarget, setOrderPreviewTarget] = useState<{
    id: string;
    source: 'delivery' | 'pharmacy';
    orderNumber?: string;
  } | null>(null);
  const [isLoadingOrderPreview, setIsLoadingOrderPreview] = useState<boolean>(false);
  const [orderPreviewError, setOrderPreviewError] = useState<string | null>(null);
  const [deliveryPreviewData, setDeliveryPreviewData] = useState<{
    order: DeliveryOrder | null;
    items: DeliveryOrderItem[];
    history: DeliveryOrderStatusHistory[];
    driver: DeliveryDriver | null;
  } | null>(null);
  const [pharmacyPreviewData, setPharmacyPreviewData] = useState<{
    order: PharmacyOrder | null;
    items: PharmacyOrderItem[];
    deliveryOrder: PharmacyDeliveryOrder | null;
    pharmacy: PharmacyDirectoryRecord | null;
    prescription: PharmacySavedPrescription | null;
    files: PharmacyOrderFile[];
  } | null>(null);

  // =========================================================================
  // Phase 3 — 2. Cancellation Decision Confirmation Modal / Bottom Sheet State
  // =========================================================================
  const [cancelDecisionModal, setCancelDecisionModal] = useState<{
    orderId: string;
    orderNumber: string;
    source: 'delivery' | 'pharmacy';
    customerName: string;
    driverName?: string | null;
    reason?: string | null;
    decision: 'approve_cancel' | 'reject_cancel';
  } | null>(null);
  const [cancelAdminNote, setCancelAdminNote] = useState<string>('');
  const [isSubmittingCancelDecision, setIsSubmittingCancelDecision] = useState<boolean>(false);
  const [cancelDecisionError, setCancelDecisionError] = useState<string | null>(null);

  // =========================================================================
  // Phase 3 — 3. New Driver Document Preview & Approval/Rejection State
  // =========================================================================
  const [driverReviewModal, setDriverReviewModal] = useState<{
    driverId: string;
    initialName: string;
    initialPhone: string;
    initialAction?: 'inspect' | 'approve' | 'reject';
  } | null>(null);
  const [isLoadingDriverReview, setIsLoadingDriverReview] = useState<boolean>(false);
  const [driverReviewError, setDriverReviewError] = useState<string | null>(null);
  const [reviewedDriver, setReviewedDriver] = useState<DeliveryDriver | null>(null);
  const [driverDocPreviews, setDriverDocPreviews] = useState<
    Record<DriverDocumentType, OverviewDocPreviewState>
  >({
    id_card_front: { hasStoredPath: false, rawPath: null, url: null, loading: false, broken: false, error: null },
    id_card_back: { hasStoredPath: false, rawPath: null, url: null, loading: false, broken: false, error: null },
    driver_license: { hasStoredPath: false, rawPath: null, url: null, loading: false, broken: false, error: null },
    vehicle_license: { hasStoredPath: false, rawPath: null, url: null, loading: false, broken: false, error: null },
  });
  const [driverDecisionStep, setDriverDecisionStep] = useState<'none' | 'approve' | 'reject'>('none');
  const [driverDecisionNote, setDriverDecisionNote] = useState<string>('');
  const [isSubmittingDriverDecision, setIsSubmittingDriverDecision] = useState<boolean>(false);
  const [driverDecisionSubmitError, setDriverDecisionSubmitError] = useState<string | null>(null);
  const [lightboxDocPreview, setLightboxDocPreview] = useState<{
    title: string;
    url: string;
    driverName: string;
  } | null>(null);

  const loadOperationalData = useCallback(async () => {
    setIsCommandLoading(true);
    setCommandError(null);
    setIsPharmacyLoading(true);
    setPharmacyError(null);

    try {
      const [cmdRes, pharmRes] = await Promise.all([
        adminService.getOperationalCommandCenterData(),
        adminService.getPharmacyStatsSummary(),
      ]);

      setCommandData(cmdRes?.data ?? null);
      if (cmdRes?.error) {
        setCommandError(cmdRes.error);
      }

      setPharmacyStats(pharmRes?.stats ?? null);
      if (pharmRes?.error) {
        setPharmacyError(pharmRes.error);
      }
    } catch (e: any) {
      setCommandError(e?.message || 'تعذر جلب بيانات مركز المتابعة من قاعدة البيانات');
    } finally {
      setIsCommandLoading(false);
      setIsPharmacyLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOperationalData();
  }, [loadOperationalData]);

  const handleFullRefresh = async () => {
    await Promise.all([refreshStats(), loadOperationalData()]);
  };

  // =========================================================================
  // Phase 3 Handlers: Open Order Quick Preview (Delivery or Pharmacy)
  // =========================================================================
  const handleOpenOrderQuickPreview = useCallback(
    async (
      orderId: string,
      source: 'delivery' | 'pharmacy',
      orderNumber?: string,
      e?: React.MouseEvent
    ) => {
      if (e) e.stopPropagation();
      if (!canViewOrderBySource(source)) {
        showToast('عفواً، لا تملك صلاحية عرض تفاصيل هذا القسم', 'error');
        return;
      }

      setOrderPreviewTarget({ id: orderId, source, orderNumber });
      setIsLoadingOrderPreview(true);
      setOrderPreviewError(null);
      setDeliveryPreviewData(null);
      setPharmacyPreviewData(null);

      try {
        if (source === 'delivery') {
          const res = await adminService.getDeliveryOrderDetails(orderId);
          if (res.error || !res.order) {
            setOrderPreviewError(res.error || 'تعذر جلب تفاصيل طلب الدليفري من قاعدة البيانات');
          } else {
            setDeliveryPreviewData({
              order: res.order,
              items: Array.isArray(res.items) ? res.items : [],
              history: Array.isArray(res.history) ? res.history : [],
              driver: res.driver || null,
            });
          }
        } else {
          const res = await adminService.getPharmacyOrderDetails(orderId);
          if (res.error || !res.order) {
            setOrderPreviewError(res.error || 'تعذر جلب تفاصيل طلب الصيدلية من قاعدة البيانات');
          } else {
            setPharmacyPreviewData({
              order: res.order,
              items: Array.isArray(res.items) ? res.items : [],
              deliveryOrder: res.deliveryOrder || null,
              pharmacy: (res.order as any)?.requested_pharmacy || null,
              prescription: res.savedPrescription || null,
              files: Array.isArray(res.files) ? res.files : [],
            });
          }
        }
      } catch (err: any) {
        setOrderPreviewError(err?.message || 'حدث خطأ غير متوقع أثناء جلب تفاصيل الطلب');
      } finally {
        setIsLoadingOrderPreview(false);
      }
    },
    [canViewOrderBySource, showToast]
  );

  const handleCloseOrderQuickPreview = useCallback(() => {
    setOrderPreviewTarget(null);
    setOrderPreviewError(null);
    setDeliveryPreviewData(null);
    setPharmacyPreviewData(null);
  }, []);

  // =========================================================================
  // Phase 3 Handlers: Cancellation Decision with Confirmation & Guard
  // =========================================================================
  const handlePromptCancellationDecision = useCallback(
    (
      params: {
        orderId: string;
        orderNumber: string;
        source: 'delivery' | 'pharmacy';
        customerName: string;
        driverName?: string | null;
        reason?: string | null;
        decision: 'approve_cancel' | 'reject_cancel';
      },
      e?: React.MouseEvent
    ) => {
      if (e) e.stopPropagation();
      if (!canDecideCancelBySource(params.source)) {
        showToast('عفواً، لا تملك صلاحية اتخاذ قرار الإلغاء لهذا الطلب', 'error');
        return;
      }
      setCancelDecisionError(null);
      setCancelDecisionModal(params);
    },
    [canDecideCancelBySource, showToast]
  );

  const handleExecuteCancellationDecision = async () => {
    if (!cancelDecisionModal || isSubmittingCancelDecision) return;

    if (!canDecideCancelBySource(cancelDecisionModal.source)) {
      const msg = 'عفواً، لا تملك الصلاحية الإدارية اللازمة لتنفيذ قرار الإلغاء';
      setCancelDecisionError(msg);
      showToast(msg, 'error');
      return;
    }

    setIsSubmittingCancelDecision(true);
    setCancelDecisionError(null);

    try {
      const trimmedNote = cancelAdminNote.trim() || undefined;
      let success = false;
      let errMessage: string | undefined;

      const isApprove = cancelDecisionModal.decision === 'approve_cancel';

      if (cancelDecisionModal.source === 'delivery') {
        const res = await adminService.decideCancellation(
          cancelDecisionModal.orderId,
          isApprove,
          trimmedNote
        );
        success = res.success;
        errMessage = res.error;
      } else {
        const res = await adminService.decidePharmacyDriverCancellation(
          cancelDecisionModal.orderId,
          isApprove,
          trimmedNote
        );
        success = res.success;
        errMessage = res.error;
      }

      if (!success) {
        const failMsg = errMessage || 'تعذر تنفيذ قرار الإلغاء في قاعدة البيانات';
        setCancelDecisionError(failMsg);
        showToast(failMsg, 'error');
        return;
      }

      const successText =
        cancelDecisionModal.decision === 'approve_cancel'
          ? `تم قبول إلغاء الطلب #${cancelDecisionModal.orderNumber} وتحديث حالته بنجاح`
          : `تم رفض طلب الإلغاء للطلب #${cancelDecisionModal.orderNumber} وإعادته للتنفيذ`;

      showToast(successText, 'success');

      const decidedOrderId = cancelDecisionModal.orderId;
      const decidedSource = cancelDecisionModal.source;

      setCancelDecisionModal(null);
      setCancelAdminNote('');
      setCancelDecisionError(null);

      await handleFullRefresh();

      if (orderPreviewTarget && orderPreviewTarget.id === decidedOrderId) {
        await handleOpenOrderQuickPreview(decidedOrderId, decidedSource);
      }
    } catch (err: any) {
      const failMsg = err?.message || 'حدث خطأ أثناء إرسال قرار الإلغاء';
      setCancelDecisionError(failMsg);
      showToast(failMsg, 'error');
    } finally {
      setIsSubmittingCancelDecision(false);
    }
  };

  // =========================================================================
  // Phase 3 Handlers: Driver Document Preview & Approval/Rejection
  // =========================================================================
  const resolveDriverDocsForOverview = useCallback(async (driver: DeliveryDriver | null) => {
    const emptyState: Record<DriverDocumentType, OverviewDocPreviewState> = {
      id_card_front: { hasStoredPath: false, rawPath: null, url: null, loading: false, broken: false, error: null },
      id_card_back: { hasStoredPath: false, rawPath: null, url: null, loading: false, broken: false, error: null },
      driver_license: { hasStoredPath: false, rawPath: null, url: null, loading: false, broken: false, error: null },
      vehicle_license: { hasStoredPath: false, rawPath: null, url: null, loading: false, broken: false, error: null },
    };

    if (!driver) {
      setDriverDocPreviews(emptyState);
      return;
    }

    const nextState = { ...emptyState };
    const docsNeedingSignedUrl: DriverDocMetaItem[] = [];

    for (const meta of OVERVIEW_DRIVER_DOC_TYPES) {
      const raw = driver[meta.column] || driver.documents?.[meta.column] || null;
      const cleanPath = typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;

      if (!cleanPath) {
        nextState[meta.type] = {
          hasStoredPath: false,
          rawPath: null,
          url: null,
          loading: false,
          broken: false,
          error: null,
        };
      } else if (isDirectDocumentSrc(cleanPath)) {
        const directUrl = resolveDocumentSrc(cleanPath);
        nextState[meta.type] = {
          hasStoredPath: Boolean(directUrl),
          rawPath: cleanPath,
          url: directUrl,
          loading: false,
          broken: !directUrl,
          error: directUrl ? null : 'مسار المستند غير صالح',
        };
      } else {
        const fallbackUrl = resolveDocumentSrc(cleanPath);
        nextState[meta.type] = {
          hasStoredPath: true,
          rawPath: cleanPath,
          url: fallbackUrl,
          loading: true,
          broken: false,
          error: null,
        };
        docsNeedingSignedUrl.push(meta);
      }
    }

    setDriverDocPreviews(nextState);

    if (docsNeedingSignedUrl.length === 0) return;

    await Promise.all(
      docsNeedingSignedUrl.map(async (meta) => {
        const raw = driver[meta.column] || driver.documents?.[meta.column] || null;
        const cleanPath = typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
        if (!cleanPath) return;

        const signedRes = await adminService.getDriverDocumentSignedUrl(cleanPath, 3600);
        const publicFallback = resolveDocumentSrc(cleanPath);
        const finalUrl = signedRes.signedUrl || publicFallback;

        setDriverDocPreviews((prev) => ({
          ...prev,
          [meta.type]: {
            hasStoredPath: true,
            rawPath: cleanPath,
            url: finalUrl,
            loading: false,
            broken: !finalUrl,
            error: finalUrl ? null : signedRes.error || 'تعذر جلب رابط المستند',
          },
        }));
      })
    );
  }, []);

  const handleOpenDriverReview = useCallback(
    async (
      drv: {
        id: string;
        full_name: string;
        phone: string;
      },
      initialAction: 'inspect' | 'approve' | 'reject' = 'inspect',
      e?: React.MouseEvent
    ) => {
      if (e) e.stopPropagation();
      if (!canViewDeliveryOrders && !canApproveDrivers) {
        showToast('عفواً، لا تملك صلاحية استعراض بيانات السائقين', 'error');
        return;
      }

      setDriverReviewModal({
        driverId: drv.id,
        initialName: drv.full_name,
        initialPhone: drv.phone,
        initialAction,
      });
      setIsLoadingDriverReview(true);
      setDriverReviewError(null);
      setReviewedDriver(null);
      setDriverDecisionStep(initialAction === 'approve' ? 'approve' : initialAction === 'reject' ? 'reject' : 'none');
      setDriverDecisionSubmitError(null);

      try {
        const res = await adminService.getDeliveryDriverDetails(drv.id);
        if (res.error || !res.driver) {
          setDriverReviewError(res.error || 'تعذر جلب ملف السائق والمستندات من قاعدة البيانات');
        } else {
          setReviewedDriver(res.driver);
          await resolveDriverDocsForOverview(res.driver);
        }
      } catch (err: any) {
        setDriverReviewError(err?.message || 'حدث خطأ أثناء تحميل بيانات السائق');
      } finally {
        setIsLoadingDriverReview(false);
      }
    },
    [canViewDeliveryOrders, canApproveDrivers, resolveDriverDocsForOverview, showToast]
  );

  // Strict calculation of verified uploaded documents for the reviewed driver
  const reviewedDriverDocsSummary = useMemo(() => {
    let uploadedCount = 0;
    let readyPreviewCount = 0;
    let brokenCount = 0;
    let anyLoading = false;

    for (const meta of OVERVIEW_DRIVER_DOC_TYPES) {
      const st = driverDocPreviews[meta.type];
      if (st.loading) anyLoading = true;
      if (st.hasStoredPath) {
        uploadedCount += 1;
        if (st.broken || !st.url) {
          brokenCount += 1;
        } else {
          readyPreviewCount += 1;
        }
      }
    }

    const meetsApprovalRequirements =
      Boolean(reviewedDriver) &&
      !anyLoading &&
      uploadedCount === 4 &&
      readyPreviewCount === 4 &&
      brokenCount === 0;

    return {
      uploadedCount,
      readyPreviewCount,
      brokenCount,
      anyLoading,
      meetsApprovalRequirements,
    };
  }, [driverDocPreviews, reviewedDriver]);

  const handleExecuteDriverDecision = async () => {
    if (!reviewedDriver || isSubmittingDriverDecision) return;
    if (!canApproveDrivers) {
      const msg = 'عفواً، لا تملك صلاحية اعتماد أو رفض السائقين';
      setDriverDecisionSubmitError(msg);
      showToast(msg, 'error');
      return;
    }

    if (driverDecisionStep === 'approve') {
      if (!reviewedDriverDocsSummary.meetsApprovalRequirements) {
        const msg = `لا يمكن اعتماد السائق قبل استكمال رفع الوثائق الأربع المطلوبة والتحقق من سلامتها (المرفوع والجاهز حاليًا: ${reviewedDriverDocsSummary.readyPreviewCount}/4)`;
        setDriverDecisionSubmitError(msg);
        showToast(msg, 'error');
        return;
      }

      setIsSubmittingDriverDecision(true);
      setDriverDecisionSubmitError(null);
      try {
        const res = await adminService.approveDriver(reviewedDriver.id);
        if (!res.success) {
          const failMsg = res.error || 'تعذر اعتماد السائق في قاعدة البيانات';
          setDriverDecisionSubmitError(failMsg);
          showToast(failMsg, 'error');
          return;
        }
        showToast(`تم اعتماد وتفعيل السائق ${reviewedDriver.full_name} بنجاح`, 'success');
        setDriverReviewModal(null);
        setReviewedDriver(null);
        setDriverDecisionStep('none');
        setDriverDecisionNote('');
        await handleFullRefresh();
      } catch (err: any) {
        const failMsg = err?.message || 'حدث خطأ أثناء اعتماد السائق';
        setDriverDecisionSubmitError(failMsg);
        showToast(failMsg, 'error');
      } finally {
        setIsSubmittingDriverDecision(false);
      }
    } else if (driverDecisionStep === 'reject') {
      const reason = driverDecisionNote.trim();
      if (!reason) {
        const msg = 'يرجى كتابة سبب رفض طلب انضمام السائق قبل التأكيد';
        setDriverDecisionSubmitError(msg);
        showToast(msg, 'error');
        return;
      }

      setIsSubmittingDriverDecision(true);
      setDriverDecisionSubmitError(null);
      try {
        const res = await adminService.rejectDriver(reviewedDriver.id, reason);
        if (!res.success) {
          const failMsg = res.error || 'تعذر رفض طلب السائق في قاعدة البيانات';
          setDriverDecisionSubmitError(failMsg);
          showToast(failMsg, 'error');
          return;
        }
        showToast(`تم رفض طلب انضمام السائق ${reviewedDriver.full_name}`, 'info');
        setDriverReviewModal(null);
        setReviewedDriver(null);
        setDriverDecisionStep('none');
        setDriverDecisionNote('');
        await handleFullRefresh();
      } catch (err: any) {
        const failMsg = err?.message || 'حدث خطأ أثناء رفض طلب السائق';
        setDriverDecisionSubmitError(failMsg);
        showToast(failMsg, 'error');
      } finally {
        setIsSubmittingDriverDecision(false);
      }
    }
  };

  const filterLabels: Record<AdminDateFilter, string> = {
    today: 'اليوم',
    yesterday: 'أمس',
    last_7_days: 'آخر 7 أيام',
    last_30_days: 'آخر 30 يوم',
    this_month: 'هذا الشهر',
    last_month: 'الشهر السابق',
    custom: 'فترة مخصصة',
  };

  const isAnyLoading = isStatsLoading || isCommandLoading;

  /**
   * Renders a numeric metric while strictly distinguishing between:
   * 1. Loading state (جاري التحميل)
   * 2. Error / unavailable state (خطأ أو غير متاح)
   * 3. Confirmed zero (0 فعلي)
   * 4. Positive real number
   */
  const renderMetricValue = (
    value: number | null | undefined,
    options?: {
      loading?: boolean;
      error?: string | null;
      suffix?: string;
      zeroLabel?: string;
      sizeClass?: string;
    }
  ) => {
    const loading = options?.loading ?? isStatsLoading;
    const err = options?.error ?? statsError;
    const sizeClass = options?.sizeClass || 'text-2xl sm:text-3xl';

    if (loading) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-xl animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          <span>جاري التحميل...</span>
        </span>
      );
    }

    if (err && (value === null || value === undefined)) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2.5 py-1 rounded-xl">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>تعذر الجلب</span>
        </span>
      );
    }

    if (value === null || value === undefined) {
      return (
        <span className="inline-flex items-center text-xs font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-xl">
          غير متاح
        </span>
      );
    }

    return (
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={`${sizeClass} font-black font-mono text-white tracking-tight`}>
          {value.toLocaleString('en-US')}
        </span>
        {options?.suffix && (
          <span className="text-xs font-bold text-slate-400">{options.suffix}</span>
        )}
        {value === 0 && options?.zeroLabel && (
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-900/90 border border-slate-800 px-2 py-0.5 rounded-lg">
            {options.zeroLabel}
          </span>
        )}
      </div>
    );
  };

  // Safe array references from commandData
  const assignedOrdersList = useMemo(
    () =>
      Array.isArray(commandData?.assignedOrdersWithDrivers)
        ? commandData.assignedOrdersWithDrivers
        : [],
    [commandData]
  );

  const pendingReviewList = useMemo(
    () => (Array.isArray(commandData?.pendingReviewOrders) ? commandData.pendingReviewOrders : []),
    [commandData]
  );

  const cancellationRequestsList = useMemo(
    () =>
      Array.isArray(commandData?.cancellationRequests) ? commandData.cancellationRequests : [],
    [commandData]
  );

  const pendingDriversList = useMemo(
    () => (Array.isArray(commandData?.pendingDrivers) ? commandData.pendingDrivers : []),
    [commandData]
  );

  // Group assigned orders by driver name so the admin can also see workload per driver at a glance
  const driverWorkloads = useMemo(() => {
    if (assignedOrdersList.length === 0) return [];
    const map = new Map<
      string,
      {
        driverId: string;
        driverName: string;
        driverPhone: string | null;
        count: number;
        deliveryCount: number;
        pharmacyCount: number;
      }
    >();

    for (const ord of assignedOrdersList) {
      const key = ord.driver_id || ord.driver_name || 'unassigned';
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (ord.source === 'delivery') existing.deliveryCount += 1;
        else existing.pharmacyCount += 1;
      } else {
        map.set(key, {
          driverId: ord.driver_id || '',
          driverName: ord.driver_name || 'مندوب توصيل',
          driverPhone: ord.driver_phone || null,
          count: 1,
          deliveryCount: ord.source === 'delivery' ? 1 : 0,
          pharmacyCount: ord.source === 'pharmacy' ? 1 : 0,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [assignedOrdersList]);

  const filteredAssignedOrders = useMemo(() => {
    const q = assignedSearch.trim().toLowerCase();
    if (!q) return assignedOrdersList;
    return assignedOrdersList.filter(
      (o) =>
        (o.driver_name || '').toLowerCase().includes(q) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.order_number || '').toLowerCase().includes(q) ||
        (o.driver_phone && o.driver_phone.includes(q)) ||
        (o.governorate_name && o.governorate_name.toLowerCase().includes(q))
    );
  }, [assignedOrdersList, assignedSearch]);

  // Real calculated operational totals (null if stats/commandData not loaded yet)
  const pendingDeliveryOrders = stats
    ? stats.delivery_pending_review_orders ?? commandData?.counts?.delivery_pending_review ?? 0
    : commandData?.counts
    ? commandData.counts.delivery_pending_review
    : null;

  const pendingPharmacyOrders = stats
    ? stats.pharmacy_pending_orders ?? pharmacyStats?.pending_orders ?? 0
    : pharmacyStats
    ? pharmacyStats.pending_orders
    : commandData?.counts
    ? commandData.counts.pharmacy_pending_review
    : null;

  const totalPendingReviewOrders =
    pendingDeliveryOrders !== null || pendingPharmacyOrders !== null
      ? (pendingDeliveryOrders ?? 0) + (pendingPharmacyOrders ?? 0)
      : null;

  const cancellationPendingDelivery = stats
    ? stats.delivery_cancellation_orders ?? commandData?.counts?.delivery_cancellation_pending ?? 0
    : commandData?.counts
    ? commandData.counts.delivery_cancellation_pending
    : null;

  const cancelledDelivery = stats ? stats.delivery_cancelled_orders ?? 0 : null;

  const cancelledPharmacy = pharmacyStats
    ? pharmacyStats.cancelled_orders
    : stats
    ? stats.pharmacy_cancellation_orders ?? 0
    : commandData?.counts
    ? commandData.counts.pharmacy_cancellation_pending
    : null;

  const totalCancellationAttention =
    cancellationPendingDelivery !== null || cancelledDelivery !== null || cancelledPharmacy !== null
      ? (cancellationPendingDelivery ?? 0) + (cancelledDelivery ?? 0) + (cancelledPharmacy ?? 0)
      : null;

  const assignedDeliveryOrders = stats
    ? stats.delivery_assigned_orders ?? commandData?.counts?.delivery_assigned_active ?? 0
    : commandData?.counts
    ? commandData.counts.delivery_assigned_active
    : null;

  const assignedPharmacyOrders = stats
    ? stats.pharmacy_assigned_orders ?? commandData?.counts?.pharmacy_assigned_active ?? 0
    : commandData?.counts
    ? commandData.counts.pharmacy_assigned_active
    : null;

  const totalAssignedOrders = commandData
    ? assignedOrdersList.length
    : assignedDeliveryOrders !== null || assignedPharmacyOrders !== null
    ? (assignedDeliveryOrders ?? 0) + (assignedPharmacyOrders ?? 0)
    : null;

  const completedDeliveryOrders = stats
    ? stats.delivery_completed_orders ?? commandData?.counts?.delivery_completed ?? 0
    : commandData?.counts
    ? commandData.counts.delivery_completed
    : null;

  const completedPharmacyOrders = stats
    ? stats.pharmacy_completed_orders ?? pharmacyStats?.completed_orders ?? 0
    : pharmacyStats
    ? pharmacyStats.completed_orders
    : commandData?.counts
    ? commandData.counts.pharmacy_completed
    : null;

  const totalCompletedOrders =
    completedDeliveryOrders !== null || completedPharmacyOrders !== null
      ? (completedDeliveryOrders ?? 0) + (completedPharmacyOrders ?? 0)
      : null;

  const pendingNewDrivers = stats
    ? stats.delivery_pending_drivers ?? commandData?.counts?.drivers_pending_approval ?? 0
    : commandData
    ? pendingDriversList.length
    : null;

  const blockedUsersCount = stats
    ? stats.blocked_users ?? commandData?.counts?.users_blocked ?? 0
    : commandData?.counts
    ? commandData.counts.users_blocked
    : null;

  const inactiveDriversCount = stats
    ? stats.delivery_inactive_drivers ?? commandData?.counts?.drivers_inactive ?? 0
    : commandData?.counts
    ? commandData.counts.drivers_inactive
    : null;

  const totalDisabledAccounts =
    blockedUsersCount !== null || inactiveDriversCount !== null
      ? (blockedUsersCount ?? 0) + (inactiveDriversCount ?? 0)
      : null;

  const activeNotificationsCount = stats
    ? stats.active_notifications_count ?? stats.total_notifications ?? 0
    : commandData?.counts
    ? commandData.counts.notifications_active
    : null;

  const getOrderStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'pending_review' || s === 'submitted' || s === 'pending' || s === 'new') {
      return {
        label: 'قيد المراجعة',
        cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      };
    }
    if (s === 'cancellation_pending') {
      return {
        label: 'طلب إلغاء معلق',
        cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      };
    }
    if (s === 'accepted' || s === 'assigned' || s === 'confirmed') {
      return {
        label: 'مسند ومقبول',
        cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      };
    }
    if (s === 'shopping' || s === 'preparing' || s === 'in_progress' || s === 'shopping_completed') {
      return {
        label: 'جاري التجهيز والشراء',
        cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      };
    }
    if (s === 'out_for_delivery' || s === 'on_the_way' || s === 'picked_up') {
      return {
        label: 'في الطريق للعميل',
        cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      };
    }
    if (s === 'completed' || s === 'delivered') {
      return {
        label: 'مكتمل',
        cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      };
    }
    if (s === 'cancelled' || s === 'rejected') {
      return {
        label: 'ملغي',
        cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      };
    }
    return {
      label: status || 'غير محدد',
      cls: 'bg-slate-800 text-slate-300 border-slate-700',
    };
  };

  const formatTimeAgo = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return 'الآن';
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `منذ ${diffDays} يوم`;
    return d.toLocaleDateString('ar-EG');
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200 text-right" dir="rtl">
      {/* =================================================================== */}
      {/* 1. رأس مركز متابعة المهام الإدارية والفلاتر الزمنية                 */}
      {/* =================================================================== */}
      <section className="bg-slate-900/85 p-4 sm:p-5 rounded-3xl border border-slate-800/90 space-y-4 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>مركز العمليات والمتابعة المباشرة — اتصال فعلي بـ Supabase</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-black text-white">
              مركز متابعة المهام الإدارية والعمليات الجارية
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              الأولوية للطلبات قيد المراجعة، طلبات الإلغاء، الطلبات المسندة للسائقين بأسمائهم، طلبات انضمام المناديب، والحسابات المعطلة. اضغط على أي بطاقة لفتح قائمتها المفلترة مباشرة.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-auto">
            <button
              type="button"
              onClick={handleFullRefresh}
              disabled={isAnyLoading}
              className="min-h-[42px] px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-60 text-white rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isAnyLoading ? 'animate-spin' : ''}`} />
              <span>{isAnyLoading ? 'جاري التحديث...' : 'تحديث المهام الآن'}</span>
            </button>
          </div>
        </div>

        {/* Time Filter Bar */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-400 shrink-0">
            نطاق احتساب المؤشرات التراكمية:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-bold">
            {(
              [
                'today',
                'yesterday',
                'last_7_days',
                'last_30_days',
                'this_month',
                'last_month',
                'custom',
              ] as AdminDateFilter[]
            ).map((f) => {
              const isSelected = dateFilter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setDateFilter(f)}
                  className={`px-3 py-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 font-black'
                      : 'bg-slate-950/90 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
                  }`}
                >
                  {filterLabels[f]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {dateFilter === 'custom' && (
          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-400">من:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-400">إلى:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>
            <button
              type="button"
              onClick={refreshStats}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              تطبيق النطاق
            </button>
          </div>
        )}

        {/* Explicit Error Banner if DB connection or query failed */}
        {(statsError || commandError || pharmacyError) && (
          <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <span className="font-black block">تنبيه اتصال بقاعدة البيانات:</span>
                <span className="text-rose-300/90">
                  {statsError || commandError || pharmacyError}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleFullRefresh}
              className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 text-xs font-bold self-start sm:self-auto cursor-pointer"
            >
              إعادة المحاولة
            </button>
          </div>
        )}
      </section>

      {/* =================================================================== */}
      {/* 2. بطاقات الأولويات التشغيلية السبع (Priority Operational Cards)    */}
      {/* كل بطاقة تفتح قائمة الحالات المطابقة مباشرة                         */}
      {/* =================================================================== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <h2 className="text-base sm:text-lg font-black text-white">
              أولويات المتابعة الفورية والمهام الحرجة
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            اضغط على البطاقة أو الأزرار الفرعية لفتح القائمة المفلترة مباشرة
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4">
          {/* 1. الطلبات قيد المراجعة (Pending Review Orders) */}
          <div
            onClick={() =>
              navigateToSection('delivery_orders', { statusTab: 'pending_review' })
            }
            className="group bg-slate-900/90 hover:bg-slate-900 border border-amber-500/30 hover:border-amber-400 rounded-3xl p-4 sm:p-5 transition-all flex flex-col justify-between cursor-pointer shadow-md"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-black">
                  <Clock className="w-3.5 h-3.5" />
                  <span>أولوية قصوى</span>
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
              </div>

              <div>
                <h3 className="text-sm font-black text-white">الطلبات قيد المراجعة</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  طلبات تنتظر المراجعة أو التسعير أو الإسناد
                </p>
              </div>

              {renderMetricValue(totalPendingReviewOrders, {
                loading: isStatsLoading && isPharmacyLoading && isCommandLoading,
                zeroLabel: 'لا توجد طلبات معلقة',
              })}
            </div>

            <div
              className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() =>
                  navigateToSection('delivery_orders', { statusTab: 'pending_review' })
                }
                className="px-2.5 py-2 rounded-xl bg-slate-950 hover:bg-amber-500/15 border border-slate-800 hover:border-amber-500/40 text-right transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-400 block">قيد المراجعة دليفري</span>
                <span className="text-xs font-black font-mono text-amber-300">
                  {isStatsLoading && isCommandLoading ? '...' : (pendingDeliveryOrders ?? '—')}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  navigateToSection('pharmacy_orders', { status: 'pending_review' })
                }
                className="px-2.5 py-2 rounded-xl bg-slate-950 hover:bg-amber-500/15 border border-slate-800 hover:border-amber-500/40 text-right transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-400 block">قيد المراجعة صيدلية</span>
                <span className="text-xs font-black font-mono text-amber-300">
                  {isStatsLoading && isPharmacyLoading && isCommandLoading
                    ? '...'
                    : (pendingPharmacyOrders ?? '—')}
                </span>
              </button>
            </div>
          </div>

          {/* 2. طلبات الإلغاء والطلبات الملغاة (Cancellation Requests & Cancelled) */}
          <div
            onClick={() =>
              navigateToSection('delivery_orders', {
                statusTab:
                  (cancellationPendingDelivery ?? 0) > 0 ? 'cancellation_pending' : 'cancelled',
              })
            }
            className="group bg-slate-900/90 hover:bg-slate-900 border border-rose-500/30 hover:border-rose-400 rounded-3xl p-4 sm:p-5 transition-all flex flex-col justify-between cursor-pointer shadow-md"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30 text-xs font-black">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>قرارات الإلغاء</span>
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 transition-colors" />
              </div>

              <div>
                <h3 className="text-sm font-black text-white">طلبات الإلغاء والملغاة</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  طلبات إلغاء بانتظار قرار الإدارة والطلبات الملغاة
                </p>
              </div>

              {renderMetricValue(totalCancellationAttention, {
                loading: isStatsLoading && isCommandLoading,
                zeroLabel: 'لا توجد حالات إلغاء',
              })}
            </div>

            <div
              className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() =>
                  navigateToSection('delivery_orders', { statusTab: 'cancellation_pending' })
                }
                className="px-2 py-2 rounded-xl bg-rose-950/30 hover:bg-rose-500/20 border border-rose-500/30 text-right transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-rose-300 block truncate">بانتظار القرار</span>
                <span className="text-xs font-black font-mono text-rose-200">
                  {isStatsLoading && isCommandLoading
                    ? '...'
                    : (cancellationPendingDelivery ?? '—')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigateToSection('delivery_orders', { statusTab: 'cancelled' })}
                className="px-2 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-right transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-400 block truncate">ملغي دليفري</span>
                <span className="text-xs font-black font-mono text-slate-200">
                  {isStatsLoading ? '...' : (cancelledDelivery ?? '—')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigateToSection('pharmacy_orders', { status: 'cancelled' })}
                className="px-2 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-right transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-400 block truncate">ملغي صيدلية</span>
                <span className="text-xs font-black font-mono text-slate-200">
                  {isStatsLoading && isPharmacyLoading ? '...' : (cancelledPharmacy ?? '—')}
                </span>
              </button>
            </div>
          </div>

          {/* 3. الطلبات المسندة للسائق مع اسمه (Assigned Orders with Driver Name) */}
          <div
            onClick={() => navigateToSection('delivery_orders', { statusTab: 'accepted' })}
            className="group bg-slate-900/90 hover:bg-slate-900 border border-sky-500/30 hover:border-sky-400 rounded-3xl p-4 sm:p-5 transition-all flex flex-col justify-between cursor-pointer shadow-md"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-500/15 text-sky-300 border border-sky-500/30 text-xs font-black">
                  <Truck className="w-3.5 h-3.5" />
                  <span>قيد التنفيذ والإسناد</span>
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition-colors" />
              </div>

              <div>
                <h3 className="text-sm font-black text-white">الطلبات المسندة للسائقين</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  الطلبات النشطة حاليًا مع اسم السائق المكلف بالتوصيل
                </p>
              </div>

              {renderMetricValue(totalAssignedOrders, {
                loading: isCommandLoading && isStatsLoading,
                zeroLabel: 'لا توجد طلبات مسندة حاليًا',
              })}
            </div>

            <div
              className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => navigateToSection('delivery_orders', { statusTab: 'accepted' })}
                className="px-2.5 py-2 rounded-xl bg-slate-950 hover:bg-sky-500/15 border border-slate-800 hover:border-sky-500/40 text-right transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-400 block">مسند دليفري</span>
                <span className="text-xs font-black font-mono text-sky-300">
                  {isStatsLoading && isCommandLoading ? '...' : (assignedDeliveryOrders ?? '—')}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  navigateToSection('pharmacy_orders', { status: 'out_for_delivery' })
                }
                className="px-2.5 py-2 rounded-xl bg-slate-950 hover:bg-sky-500/15 border border-slate-800 hover:border-sky-500/40 text-right transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-400 block">مسند صيدلية</span>
                <span className="text-xs font-black font-mono text-sky-300">
                  {isStatsLoading && isCommandLoading ? '...' : (assignedPharmacyOrders ?? '—')}
                </span>
              </button>
            </div>
          </div>

          {/* 4. الطلبات المكتملة (Completed Orders) */}
          <div
            onClick={() => navigateToSection('delivery_orders', { statusTab: 'completed' })}
            className="group bg-slate-900/90 hover:bg-slate-900 border border-emerald-500/30 hover:border-emerald-400 rounded-3xl p-4 sm:p-5 transition-all flex flex-col justify-between cursor-pointer shadow-md"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-black">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تم التسليم بنجاح</span>
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
              </div>

              <div>
                <h3 className="text-sm font-black text-white">الطلبات المكتملة</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  إجمالي الطلبات التي تم توصيلها وإغلاقها بنجاح
                </p>
              </div>

              {renderMetricValue(totalCompletedOrders, {
                loading: isStatsLoading && isPharmacyLoading && isCommandLoading,
                zeroLabel: 'لا توجد طلبات مكتملة بعد',
              })}
            </div>

            <div
              className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => navigateToSection('delivery_orders', { statusTab: 'completed' })}
                className="px-2.5 py-2 rounded-xl bg-slate-950 hover:bg-emerald-500/15 border border-slate-800 hover:border-emerald-500/40 text-right transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-400 block">مكتمل دليفري</span>
                <span className="text-xs font-black font-mono text-emerald-300">
                  {isStatsLoading && isCommandLoading ? '...' : (completedDeliveryOrders ?? '—')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigateToSection('pharmacy_orders', { status: 'completed' })}
                className="px-2.5 py-2 rounded-xl bg-slate-950 hover:bg-emerald-500/15 border border-slate-800 hover:border-emerald-500/40 text-right transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-400 block">مكتمل صيدلية</span>
                <span className="text-xs font-black font-mono text-emerald-300">
                  {isStatsLoading && isPharmacyLoading && isCommandLoading
                    ? '...'
                    : (completedPharmacyOrders ?? '—')}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Second Row of Priority Cards: 5. New Drivers, 6. Disabled Accounts, 7. Notifications */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          {/* 5. طلبات السائقين الجدد (New Driver Requests) */}
          <div
            onClick={() =>
              navigateToSection('delivery_drivers', { approvalFilter: 'pending_approval' })
            }
            className="group bg-slate-900/90 hover:bg-slate-900 border border-indigo-500/30 hover:border-indigo-400 rounded-3xl p-4 sm:p-5 transition-all flex flex-col justify-between cursor-pointer shadow-md"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-xs font-black">
                  <Bike className="w-3.5 h-3.5" />
                  <span>طلبات انضمام السائقين</span>
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
              </div>

              <div>
                <h3 className="text-sm font-black text-white">طلبات السائقين الجدد</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  سائقون جدد بانتظار فحص الوثائق والموافقة الإدارية
                </p>
              </div>

              {renderMetricValue(pendingNewDrivers, {
                loading: isStatsLoading && isCommandLoading,
                zeroLabel: 'لا توجد طلبات انضمام معلقة',
              })}
            </div>

            <div
              className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() =>
                  navigateToSection('delivery_drivers', { approvalFilter: 'pending_approval' })
                }
                className="text-indigo-300 hover:text-indigo-200 font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>مراجعة طلبات الانضمام</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] text-slate-400 font-mono">
                إجمالي النشطين: {isStatsLoading ? '...' : (stats?.delivery_active_drivers ?? '—')}
              </span>
            </div>
          </div>

          {/* 6. الحسابات المعطلة والموقوفة (Disabled / Blocked Accounts) */}
          <div
            onClick={() => navigateToSection('users', { status: 'BLOCKED' })}
            className="group bg-slate-900/90 hover:bg-slate-900 border border-rose-500/25 hover:border-rose-400 rounded-3xl p-4 sm:p-5 transition-all flex flex-col justify-between cursor-pointer shadow-md"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30 text-xs font-black">
                  <UserX className="w-3.5 h-3.5" />
                  <span>الحسابات المعطلة والموقوفة</span>
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 transition-colors" />
              </div>

              <div>
                <h3 className="text-sm font-black text-white">الحسابات المعطلة (مستخدمون وسائقون)</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  حسابات العملاء المحظورة أو السائقين غير المفعلين حاليًا
                </p>
              </div>

              {renderMetricValue(totalDisabledAccounts, {
                loading: isStatsLoading && isCommandLoading,
                zeroLabel: 'لا توجد حسابات معطلة',
              })}
            </div>

            <div
              className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => navigateToSection('users', { status: 'BLOCKED' })}
                className="px-2.5 py-2 rounded-xl bg-slate-950 hover:bg-rose-500/15 border border-slate-800 hover:border-rose-500/40 text-right transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-400 block">مستخدمون محظورون</span>
                <span className="text-xs font-black font-mono text-rose-300">
                  {isStatsLoading && isCommandLoading ? '...' : (blockedUsersCount ?? '—')}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  navigateToSection('delivery_drivers', { activeFilter: 'inactive' })
                }
                className="px-2.5 py-2 rounded-xl bg-slate-950 hover:bg-rose-500/15 border border-slate-800 hover:border-rose-500/40 text-right transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-400 block">سائقون غير نشطين</span>
                <span className="text-xs font-black font-mono text-amber-300">
                  {isStatsLoading && isCommandLoading ? '...' : (inactiveDriversCount ?? '—')}
                </span>
              </button>
            </div>
          </div>

          {/* 7. الإشعارات والتنبيهات (Notifications) */}
          <div
            onClick={() => navigateToSection('notifications', { status: 'active' })}
            className="group bg-slate-900/90 hover:bg-slate-900 border border-teal-500/30 hover:border-teal-400 rounded-3xl p-4 sm:p-5 transition-all flex flex-col justify-between cursor-pointer shadow-md"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-teal-500/15 text-teal-300 border border-teal-500/30 text-xs font-black">
                  <Bell className="w-3.5 h-3.5" />
                  <span>مركز الإشعارات</span>
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 transition-colors" />
              </div>

              <div>
                <h3 className="text-sm font-black text-white">الإشعارات النشطة والمرسلة</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  متابعة التنبيهات النشطة وإرسال إشعارات فورية للمستخدمين
                </p>
              </div>

              {renderMetricValue(activeNotificationsCount, {
                loading: isStatsLoading && isCommandLoading,
                zeroLabel: 'لا توجد إشعارات نشطة',
              })}
            </div>

            <div
              className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => navigateToSection('notifications', { status: 'active' })}
                className="px-2.5 py-2 rounded-xl bg-slate-950 hover:bg-teal-500/15 border border-slate-800 hover:border-teal-500/40 text-right transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-400 block">الإشعارات النشطة</span>
                <span className="text-xs font-bold text-teal-300">عرض النشطة</span>
              </button>

              <button
                type="button"
                onClick={() => navigateToSection('notifications_broadcast')}
                className="px-2.5 py-2 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-right transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-teal-300 block">إجراء سريع</span>
                <span className="text-xs font-black text-white flex items-center gap-1">
                  <Send className="w-3 h-3" />
                  <span>بث إشعار</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 3. اللوحة التفاعلية للمهام الجارية والطلبات المسندة للسائق مع اسمه  */}
      {/* =================================================================== */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 space-y-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-400" />
              <span>قوائم المتابعة المباشرة والطلبات المسندة للسائقين</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              معاينة حية من قاعدة البيانات للطلبات المسندة مع اسم السائق، الطلبات قيد المراجعة، طلبات الإلغاء، وطلبات السائقين الجدد
            </p>
          </div>

          {/* Queue Switcher Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveQueueTab('assigned')}
              className={`px-3.5 py-2 rounded-xl transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeQueueTab === 'assigned'
                  ? 'bg-sky-500 text-slate-950 font-black'
                  : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>المسندة للسائقين</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-md bg-slate-950/20">
                {isCommandLoading ? '...' : assignedOrdersList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveQueueTab('pending_review')}
              className={`px-3.5 py-2 rounded-xl transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeQueueTab === 'pending_review'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>قيد المراجعة</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-md bg-slate-950/20">
                {isCommandLoading ? '...' : pendingReviewList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveQueueTab('cancellations')}
              className={`px-3.5 py-2 rounded-xl transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeQueueTab === 'cancellations'
                  ? 'bg-rose-500 text-white font-black'
                  : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>طلبات الإلغاء</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-md bg-slate-950/20">
                {isCommandLoading ? '...' : cancellationRequestsList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveQueueTab('drivers')}
              className={`px-3.5 py-2 rounded-xl transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeQueueTab === 'drivers'
                  ? 'bg-indigo-500 text-white font-black'
                  : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>السائقون الجدد</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-md bg-slate-950/20">
                {isCommandLoading ? '...' : pendingDriversList.length}
              </span>
            </button>
          </div>
        </div>

        {/* TAB 1: الطلبات المسندة للسائق مع اسمه */}
        {activeQueueTab === 'assigned' && (
          <div className="space-y-4">
            {/* Driver Workload Summary Chips (Click any driver chip to open their assigned orders) */}
            {driverWorkloads.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-400 flex items-center justify-between">
                  <span>توزيع الطلبات الجارية حسب اسم السائق (اضغط لفتح طلبات السائق):</span>
                  <span className="text-[11px] font-mono text-sky-400">
                    {driverWorkloads.length} سائق مكلف حاليًا
                  </span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
                  {driverWorkloads.map((dw) => (
                    <button
                      key={dw.driverId || dw.driverName}
                      type="button"
                      onClick={() =>
                        navigateToSection('delivery_orders', {
                          driverId: dw.driverId,
                          statusTab: 'all',
                        })
                      }
                      className="px-3 py-2 rounded-2xl bg-slate-950 hover:bg-sky-500/15 border border-sky-500/30 hover:border-sky-400 flex items-center gap-2.5 shrink-0 transition-all cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center font-black text-xs">
                        {dw.driverName.charAt(0)}
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-white block">
                          {dw.driverName}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {dw.deliveryCount > 0 ? `${dw.deliveryCount} دليفري` : ''}
                          {dw.deliveryCount > 0 && dw.pharmacyCount > 0 ? ' • ' : ''}
                          {dw.pharmacyCount > 0 ? `${dw.pharmacyCount} صيدلية` : ''}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-sky-500 text-slate-950 font-black font-mono text-xs">
                        {dw.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Assigned Orders by Driver Name or Order Number */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={assignedSearch}
                  onChange={(e) => setAssignedSearch(e.target.value)}
                  placeholder="ابحث باسم السائق، اسم العميل، أو رقم الطلب..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500/50 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigateToSection('delivery_orders', { statusTab: 'accepted' })}
                  className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-sky-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>فتح كل طلبات الدليفري المسندة</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {isCommandLoading ? (
              <div className="py-10 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
                <span>جاري تحميل الطلبات المسندة وأسماء السائقين من قاعدة البيانات...</span>
              </div>
            ) : commandError ? (
              <div className="p-6 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-center space-y-2">
                <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
                <p className="text-xs font-bold text-rose-200">{commandError}</p>
              </div>
            ) : filteredAssignedOrders.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center space-y-2">
                <Inbox className="w-7 h-7 text-slate-500 mx-auto" />
                <p className="text-xs font-bold text-slate-300">
                  {assignedSearch
                    ? 'لا توجد طلبات مسندة تطابق بحثك الحالي'
                    : 'العدد الفعلي (0) — لا توجد طلبات جارية مسندة للسائقين في هذه اللحظة'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredAssignedOrders.map((item) => {
                  const statusInfo = getOrderStatusBadge(item.status);
                  const canViewThisOrder = canViewOrderBySource(item.source);
                  return (
                    <div
                      key={`${item.source}-${item.id}`}
                      onClick={() => {
                        if (canViewThisOrder) {
                          handleOpenOrderQuickPreview(item.id, item.source, item.order_number);
                        } else if (item.source === 'delivery') {
                          navigateToSection('delivery_orders', {
                            driverId: item.driver_id,
                            statusTab: 'all',
                          });
                        } else {
                          navigateToSection('pharmacy_orders', {
                            search: item.order_number,
                          });
                        }
                      }}
                      className="p-4 rounded-2xl bg-slate-950/90 hover:bg-slate-950 border border-slate-800 hover:border-sky-500/40 transition-all flex flex-col justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                                item.source === 'delivery'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                              }`}
                            >
                              {item.source === 'delivery' ? 'طلب دليفري' : 'طلب صيدلية'}
                            </span>
                            <span className="text-xs font-black font-mono text-white">
                              #{item.order_number}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${statusInfo.cls}`}
                            >
                              {statusInfo.label}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-200">
                            العميل: {item.customer_name}
                          </div>
                        </div>

                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {formatTimeAgo(item.updated_at)}
                        </span>
                      </div>

                      {/* Highlighted Driver Name Box */}
                      <div className="p-2.5 rounded-xl bg-sky-950/30 border border-sky-500/25 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Bike className="w-4 h-4 text-sky-400 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[10px] text-sky-300/80 block">
                              السائق المكلف بالطلب:
                            </span>
                            <span className="text-xs font-black text-white truncate block">
                              {item.driver_name}
                            </span>
                          </div>
                        </div>
                        {item.driver_phone && (
                          <span
                            className="text-[11px] font-mono text-sky-300 bg-slate-900/90 px-2 py-1 rounded-lg border border-sky-500/20 shrink-0"
                            dir="ltr"
                          >
                            {item.driver_phone}
                          </span>
                        )}
                      </div>

                      <div
                        className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800/70"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="flex items-center gap-1 truncate max-w-[45%]">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">
                            {item.governorate_name || 'العنوان مسجل بالطلب'}
                          </span>
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {canViewThisOrder && (
                            <button
                              type="button"
                              onClick={(e) =>
                                handleOpenOrderQuickPreview(
                                  item.id,
                                  item.source,
                                  item.order_number,
                                  e
                                )
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>تفاصيل الطلب</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (item.source === 'delivery') {
                                navigateToSection('delivery_orders', {
                                  driverId: item.driver_id,
                                  statusTab: 'all',
                                  openOrderId: item.id,
                                });
                              } else {
                                navigateToSection('pharmacy_orders', {
                                  search: item.order_number,
                                  openOrderId: item.id,
                                });
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span>فتح بالقسم</span>
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: الطلبات قيد المراجعة */}
        {activeQueueTab === 'pending_review' && (
          <div className="space-y-3">
            {isCommandLoading ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                جاري تحميل الطلبات قيد المراجعة...
              </div>
            ) : pendingReviewList.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center space-y-2">
                <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-slate-300">
                  العدد الفعلي (0) — لا توجد طلبات متأخرة قيد المراجعة حاليًا
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingReviewList.map((ord) => {
                  const statusInfo = getOrderStatusBadge(ord.status);
                  const canViewThisOrder = canViewOrderBySource(ord.source);
                  return (
                    <div
                      key={`${ord.source}-${ord.id}`}
                      onClick={() => {
                        if (canViewThisOrder) {
                          handleOpenOrderQuickPreview(ord.id, ord.source, ord.order_number);
                        } else if (ord.source === 'delivery') {
                          navigateToSection('delivery_orders', { statusTab: 'pending_review' });
                        } else {
                          navigateToSection('pharmacy_orders', { status: 'pending_review' });
                        }
                      }}
                      className="p-4 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-amber-500/25 hover:border-amber-400 transition-all flex flex-col justify-between gap-2.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                              ord.source === 'delivery'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                            }`}
                          >
                            {ord.source === 'delivery' ? 'دليفري' : 'صيدلية'}
                          </span>
                          <span className="text-xs font-black font-mono text-white">
                            #{ord.order_number}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${statusInfo.cls}`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatTimeAgo(ord.created_at)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-200">
                          العميل: {ord.customer_name}
                        </span>
                        {ord.total_amount !== null && ord.total_amount !== undefined && (
                          <span className="font-mono text-amber-300 text-[11px] font-bold">
                            {ord.total_amount.toLocaleString('en-US')} ج.م
                          </span>
                        )}
                      </div>

                      <div
                        className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800/70"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="truncate max-w-[40%]">{ord.governorate_name || '—'}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {canViewThisOrder && (
                            <button
                              type="button"
                              onClick={(e) =>
                                handleOpenOrderQuickPreview(
                                  ord.id,
                                  ord.source,
                                  ord.order_number,
                                  e
                                )
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>تفاصيل الطلب</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (ord.source === 'delivery') {
                                navigateToSection('delivery_orders', {
                                  statusTab: 'pending_review',
                                  openOrderId: ord.id,
                                });
                              } else {
                                navigateToSection('pharmacy_orders', {
                                  status: 'pending_review',
                                  openOrderId: ord.id,
                                });
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span>مراجعة بالقسم</span>
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: طلبات الإلغاء */}
        {activeQueueTab === 'cancellations' && (
          <div className="space-y-3">
            {isCommandLoading ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                جاري تحميل طلبات الإلغاء...
              </div>
            ) : cancellationRequestsList.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center space-y-2">
                <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-slate-300">
                  العدد الفعلي (0) — لا توجد طلبات إلغاء معلقة بانتظار قرار حاليًا
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {cancellationRequestsList.map((ord) => {
                  const canViewThisOrder = canViewOrderBySource(ord.source);
                  const canDecideThisCancel = canDecideCancelBySource(ord.source);
                  return (
                    <div
                      key={`${ord.source}-${ord.id}`}
                      onClick={() => {
                        if (canViewThisOrder) {
                          handleOpenOrderQuickPreview(ord.id, ord.source, ord.order_number);
                        } else if (ord.source === 'delivery') {
                          navigateToSection('delivery_orders', {
                            statusTab: 'cancellation_pending',
                          });
                        } else {
                          navigateToSection('pharmacy_orders', {
                            search: ord.order_number,
                          });
                        }
                      }}
                      className="p-4 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-rose-500/25 hover:border-rose-400 transition-all flex flex-col justify-between gap-2.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg border bg-rose-500/15 text-rose-300 border-rose-500/30">
                            {ord.source === 'delivery' ? 'دليفري' : 'صيدلية'}
                          </span>
                          <span className="text-xs font-black font-mono text-white">
                            #{ord.order_number}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-rose-500/20 text-rose-300 border-rose-500/40">
                            طلب إلغاء معلق
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatTimeAgo(ord.requested_at)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-200">
                          العميل: {ord.customer_name}
                        </span>
                        {ord.driver_name && (
                          <span className="text-[11px] font-bold text-sky-300">
                            السائق: {ord.driver_name}
                          </span>
                        )}
                      </div>

                      {ord.reason && (
                        <div className="p-2 rounded-xl bg-rose-950/30 border border-rose-500/20 text-[11px] text-rose-200">
                          <span className="font-bold">السبب: </span>
                          {ord.reason}
                        </div>
                      )}

                      <div
                        className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-2.5 border-t border-slate-800/70"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1.5">
                          {canViewThisOrder && (
                            <button
                              type="button"
                              onClick={(e) =>
                                handleOpenOrderQuickPreview(
                                  ord.id,
                                  ord.source,
                                  ord.order_number,
                                  e
                                )
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-sky-400" />
                              <span>تفاصيل الطلب</span>
                            </button>
                          )}
                        </div>

                        {canDecideThisCancel ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isSubmittingCancelDecision}
                              onClick={(e) =>
                                handlePromptCancellationDecision(
                                  {
                                    orderId: ord.id,
                                    orderNumber: ord.order_number,
                                    source: ord.source,
                                    customerName: ord.customer_name,
                                    driverName: ord.driver_name,
                                    reason: ord.reason,
                                    decision: 'approve_cancel',
                                  },
                                  e
                                )
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>قبول الإلغاء</span>
                            </button>
                            <button
                              type="button"
                              disabled={isSubmittingCancelDecision}
                              onClick={(e) =>
                                handlePromptCancellationDecision(
                                  {
                                    orderId: ord.id,
                                    orderNumber: ord.order_number,
                                    source: ord.source,
                                    customerName: ord.customer_name,
                                    driverName: ord.driver_name,
                                    reason: ord.reason,
                                    decision: 'reject_cancel',
                                  },
                                  e
                                )
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-50 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>رفض الإلغاء</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                            للعرض فقط — يتطلب صلاحية إدارة الطلبات
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: طلبات السائقين الجدد */}
        {activeQueueTab === 'drivers' && (
          <div className="space-y-3">
            {isCommandLoading ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                جاري تحميل طلبات السائقين الجدد...
              </div>
            ) : pendingDriversList.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center space-y-2">
                <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-slate-300">
                  العدد الفعلي (0) — لا توجد طلبات انضمام سائقين معلقة حاليًا
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingDriversList.map((drv) => {
                  const docsComplete = (drv.docs_count ?? 0) === 4;
                  return (
                    <div
                      key={drv.id}
                      onClick={() => handleOpenDriverReview(drv, 'inspect')}
                      className="p-4 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-indigo-500/25 hover:border-indigo-400 transition-all flex flex-col justify-between gap-2.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-black text-xs">
                            {(drv.full_name || 'س').charAt(0)}
                          </div>
                          <div>
                            <span className="text-xs font-black text-white block">
                              {drv.full_name}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400" dir="ltr">
                              {drv.phone}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border ${
                            docsComplete
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          الوثائق المرفوعة: {drv.docs_count ?? 0}/4
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400">
                        {[drv.governorate_name, drv.vehicle_type]
                          .filter(Boolean)
                          .join(' • ') || 'بيانات المركبة مسجلة'}
                      </div>

                      <div
                        className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-2.5 border-t border-slate-800/70"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => handleOpenDriverReview(drv, 'inspect', e)}
                          className="px-2.5 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>معاينة المستندات ({drv.docs_count ?? 0}/4)</span>
                        </button>

                        {canApproveDrivers ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={!docsComplete}
                              title={
                                docsComplete
                                  ? 'فحص المستندات وتأكيد اعتماد السائق'
                                  : `لا يمكن الاعتماد قبل استكمال الوثائق الأربع (${drv.docs_count ?? 0}/4)`
                              }
                              onClick={(e) => handleOpenDriverReview(drv, 'approve', e)}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-black flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>اعتماد</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleOpenDriverReview(drv, 'reject', e)}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>رفض</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                            للعرض فقط
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* =================================================================== */}
      {/* 4. ملخص الأقسام التشغيلية الأخرى (مباشر وحقيقي بدون بيانات وهمية)   */}
      {/* =================================================================== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base sm:text-lg font-black text-white">
            الوصول السريع لسائر الإدارات والمؤشرات الفعلية
          </h2>
          <span className="text-[11px] text-slate-400">
            بيانات حقيقية مباشرة من الجداول بدون أي تقديرات اصطناعية
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {/* الصيدليات والروشتات */}
          <div
            onClick={() => navigateToSection('pharmacy_orders')}
            className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-3xl p-4 space-y-3 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
                <Pill className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-purple-300">إدارة الصيدلية</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block">
                إجمالي طلبات الصيدلية
              </span>
              {renderMetricValue(
                stats?.pharmacy_total_orders ?? pharmacyStats?.total_orders ?? null,
                {
                  loading: isStatsLoading && isPharmacyLoading,
                  sizeClass: 'text-xl sm:text-2xl',
                }
              )}
            </div>
            <div
              className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => navigateToSection('pharmacy_prescriptions')}
                className="text-slate-300 hover:text-white font-semibold cursor-pointer"
              >
                الروشتات: {pharmacyStats?.total_saved_prescriptions ?? '—'}
              </button>
              <button
                type="button"
                onClick={() => navigateToSection('pharmacy_pharmacies')}
                className="text-purple-300 hover:text-purple-200 font-bold cursor-pointer"
              >
                الصيدليات: {pharmacyStats?.active_pharmacies ?? '—'}
              </button>
            </div>
          </div>

          {/* المستخدمون والأسر */}
          <div
            onClick={() => navigateToSection('users')}
            className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-4 space-y-3 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-emerald-300">المستخدمون والأسر</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block">
                إجمالي الحسابات المسجلة
              </span>
              {renderMetricValue(stats ? stats.total_users : null, {
                loading: isStatsLoading,
                sizeClass: 'text-xl sm:text-2xl',
              })}
            </div>
            <div
              className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => navigateToSection('households')}
                className="text-slate-300 hover:text-white font-semibold cursor-pointer"
              >
                الأسر: {stats ? stats.total_households : '—'}
              </button>
              <button
                type="button"
                onClick={() => navigateToSection('team')}
                className="text-emerald-300 hover:text-emerald-200 font-bold cursor-pointer"
              >
                المشرفون: {stats ? stats.total_admins : '—'}
              </button>
            </div>
          </div>

          {/* الفواتير والمشتريات والنواقص */}
          <div
            onClick={() => navigateToSection('invoices_purchases')}
            className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-3xl p-4 space-y-3 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300">
                <Receipt className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-amber-300">الفواتير والنواقص</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block">إجمالي الفواتير المسجلة</span>
              {renderMetricValue(stats ? stats.total_invoices : null, {
                loading: isStatsLoading,
                sizeClass: 'text-xl sm:text-2xl',
              })}
            </div>
            <div
              className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => navigateToSection('invoices_missing_items')}
                className="text-slate-300 hover:text-white font-semibold cursor-pointer"
              >
                النواقص: {stats ? stats.total_missing_items : '—'}
              </button>
              <button
                type="button"
                onClick={() => navigateToSection('invoices_archive')}
                className="text-amber-300 hover:text-amber-200 font-bold cursor-pointer"
              >
                الأرشيف: {stats ? stats.archived_invoices_count : '—'}
              </button>
            </div>
          </div>

          {/* الكتالوج وصور التطبيقات والنظام */}
          <div
            onClick={() => navigateToSection('products')}
            className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-sky-500/40 rounded-3xl p-4 space-y-3 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-300">
                <Package className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-sky-300">الكتالوج والأصول</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block">إجمالي المنتجات والسلع</span>
              {renderMetricValue(stats ? stats.total_products : null, {
                loading: isStatsLoading,
                sizeClass: 'text-xl sm:text-2xl',
              })}
            </div>
            <div
              className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => navigateToSection('categories')}
                className="text-slate-300 hover:text-white font-semibold cursor-pointer"
              >
                الفئات: {stats ? stats.total_categories : '—'}
              </button>
              <button
                type="button"
                onClick={() => navigateToSection('app_assets')}
                className="text-sky-300 hover:text-sky-200 font-bold flex items-center gap-1 cursor-pointer"
              >
                <ImageIcon className="w-3 h-3" />
                <span>صور التطبيق</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 5. الحيز المعماري المستقبلي للشكاوى والمهام (بدون تفعيل وهمي)        */}
      {/* =================================================================== */}
      <section className="bg-slate-900/50 border border-dashed border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-slate-200">
              وحدة الشكاوى وتذاكر الدعم والمهام المجدولة
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold">
              حيز معماري مهيأ للمرحلة القادمة — غير مفعّل حاليًا
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            تم تخصيص هذا الموضع لاستيعاب نظام شكاوى العملاء وبلاغات السائقين والمهام الإدارية في المرحلة القادمة فور ربط الجداول المخصصة لها في Supabase، دون عرض أي بيانات أو أزرار وهمية.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasPermission('audit.view') && (
            <button
              type="button"
              onClick={() => navigateToSection('audit_logs')}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>سجل الرقابة الحالي</span>
            </button>
          )}
        </div>
      </section>

      {/* =================================================================== */}
      {/* Phase 3 — MODAL 1: Order Details Quick Preview (Bottom Sheet)        */}
      {/* =================================================================== */}
      {orderPreviewTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={handleCloseOrderQuickPreview}
        >
          <div
            className="w-full sm:max-w-2xl max-h-[92vh] bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 bg-slate-950/60 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700" />
            </div>

            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 ${
                    orderPreviewTarget.source === 'delivery'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                  }`}
                >
                  {orderPreviewTarget.source === 'delivery' ? (
                    <Truck className="w-5 h-5" />
                  ) : (
                    <Pill className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-black text-white">
                      تفاصيل {orderPreviewTarget.source === 'delivery' ? 'طلب الدليفري' : 'طلب الصيدلية'}
                    </h3>
                    <span className="font-mono text-xs font-black text-emerald-400">
                      #{orderPreviewTarget.orderNumber ||
                        deliveryPreviewData?.order?.order_number ||
                        pharmacyPreviewData?.order?.order_number ||
                        orderPreviewTarget.id.slice(0, 8)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    معاينة مباشرة للبيانات الفعلية المسجلة في قاعدة البيانات
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseOrderQuickPreview}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 flex-1 text-xs">
              {isLoadingOrderPreview ? (
                <div className="py-14 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                  <span>جاري جلب تفاصيل الطلب من قاعدة البيانات...</span>
                </div>
              ) : orderPreviewError ? (
                <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-center space-y-3">
                  <AlertTriangle className="w-7 h-7 text-rose-400 mx-auto" />
                  <p className="text-xs font-bold text-rose-200">{orderPreviewError}</p>
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenOrderQuickPreview(
                        orderPreviewTarget.id,
                        orderPreviewTarget.source,
                        orderPreviewTarget.orderNumber
                      )
                    }
                    className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 text-xs font-bold cursor-pointer"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              ) : orderPreviewTarget.source === 'delivery' && deliveryPreviewData?.order ? (
                (() => {
                  const ord = deliveryPreviewData.order;
                  const drv = deliveryPreviewData.driver;
                  const items = deliveryPreviewData.items;
                  const statusBadge = getOrderStatusBadge(ord.status);
                  const isCancelPending = ord.status === 'cancellation_pending';
                  const canDecideCancel = canDecideCancelBySource('delivery');

                  return (
                    <div className="space-y-4">
                      {/* Status & Timestamps */}
                      <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">الحالة الحالية:</span>
                          <span
                            className={`text-xs font-black px-2.5 py-1 rounded-xl border ${statusBadge.cls}`}
                          >
                            {statusBadge.label}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          تاريخ الإنشاء: {new Date(ord.created_at).toLocaleString('ar-EG')}
                        </span>
                      </div>

                      {/* Pending Cancellation Banner & Quick Decision */}
                      {isCancelPending && (
                        <div className="p-4 rounded-2xl bg-rose-950/35 border border-rose-500/35 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <span className="text-xs font-black text-rose-300 flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4" />
                                <span>طلب إلغاء معلق بانتظار قرار الإدارة</span>
                              </span>
                              {ord.cancellation_reason && (
                                <p className="text-xs text-rose-200">
                                  <span className="font-bold">سبب الإلغاء: </span>
                                  {ord.cancellation_reason}
                                </p>
                              )}
                            </div>
                            {ord.cancellation_requested_at && (
                              <span className="text-[10px] font-mono text-rose-300/80 shrink-0">
                                {formatTimeAgo(ord.cancellation_requested_at)}
                              </span>
                            )}
                          </div>

                          {canDecideCancel ? (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                disabled={isSubmittingCancelDecision}
                                onClick={() =>
                                  handlePromptCancellationDecision({
                                    orderId: ord.id,
                                    orderNumber: ord.order_number,
                                    source: 'delivery',
                                    customerName: ord.customer_name,
                                    driverName: drv?.full_name || ord.driver_name || null,
                                    reason: ord.cancellation_reason,
                                    decision: 'approve_cancel',
                                  })
                                }
                                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black flex items-center gap-1.5 cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                                <span>قبول الإلغاء</span>
                              </button>
                              <button
                                type="button"
                                disabled={isSubmittingCancelDecision}
                                onClick={() =>
                                  handlePromptCancellationDecision({
                                    orderId: ord.id,
                                    orderNumber: ord.order_number,
                                    source: 'delivery',
                                    customerName: ord.customer_name,
                                    driverName: drv?.full_name || ord.driver_name || null,
                                    reason: ord.cancellation_reason,
                                    decision: 'reject_cancel',
                                  })
                                }
                                className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-50 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1.5 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                                <span>رفض الإلغاء وإعادة الطلب للتنفيذ</span>
                              </button>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400">
                              للعرض فقط — يتطلب صلاحية إدارة الطلبات لاتخاذ قرار الإلغاء.
                            </div>
                          )}
                        </div>
                      )}

                      {/* Customer & Address Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-500 block">
                            بيانات العميل
                          </span>
                          <div className="text-sm font-black text-white">{ord.customer_name}</div>
                          <div className="text-xs font-mono text-emerald-400 flex items-center gap-1.5" dir="ltr">
                            <Phone className="w-3.5 h-3.5" />
                            <span>{ord.customer_phone || 'غير مسجل'}</span>
                          </div>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-500 block">
                            العنوان والنطاق الجغرافي
                          </span>
                          <div className="text-xs font-bold text-white">
                            {[ord.governorate, ord.markaz, ord.city_or_village]
                              .filter(Boolean)
                              .join(' — ') || 'غير محدد'}
                          </div>
                          <div className="text-[11px] text-slate-300">
                            {ord.full_address || 'لا يوجد تفصيل إضافي للعنوان'}
                          </div>
                        </div>
                      </div>

                      {/* Assigned Driver */}
                      <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <Bike className="w-5 h-5 text-sky-400 shrink-0" />
                          <div>
                            <span className="text-[10px] text-slate-400 block">
                              المندوب المكلف بالتوصيل
                            </span>
                            <span className="text-xs font-black text-white">
                              {drv?.full_name || ord.driver_name || 'لم يتم إسناد سائق بعد'}
                            </span>
                          </div>
                        </div>
                        {(drv?.phone || ord.driver_phone) && (
                          <span
                            className="font-mono text-xs text-sky-300 bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-800"
                            dir="ltr"
                          >
                            {drv?.phone || ord.driver_phone}
                          </span>
                        )}
                      </div>

                      {/* Financial Summary */}
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">قيمة المشتريات</span>
                          <span className="text-sm font-black font-mono text-white">
                            {ord.items_subtotal !== null && ord.items_subtotal !== undefined
                              ? `${ord.items_subtotal.toLocaleString('en-US')} ج.م`
                              : 'غير محدد'}
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">رسوم التوصيل</span>
                          <span className="text-sm font-black font-mono text-sky-300">
                            {ord.delivery_fee !== null && ord.delivery_fee !== undefined
                              ? `${ord.delivery_fee.toLocaleString('en-US')} ج.م`
                              : 'غير محدد'}
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-950/70 border border-emerald-500/30">
                          <span className="text-[10px] text-emerald-300 block">الإجمالي الكلي</span>
                          <span className="text-sm font-black font-mono text-emerald-400">
                            {ord.total_amount !== null && ord.total_amount !== undefined
                              ? `${ord.total_amount.toLocaleString('en-US')} ج.م`
                              : 'غير محدد'}
                          </span>
                        </div>
                      </div>

                      {/* Order Items */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-white">
                            أصناف الطلب المسجلة ({items.length})
                          </span>
                        </div>
                        {items.length === 0 ? (
                          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-slate-400 text-center">
                            لا توجد أصناف تفصيلية مسجلة لهذا الطلب
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-slate-800 overflow-hidden divide-y divide-slate-800/80 bg-slate-950/70">
                            {items.map((it) => (
                              <div
                                key={it.id}
                                className="p-3 flex items-center justify-between gap-2"
                              >
                                <div>
                                  <span className="font-bold text-white block">
                                    {it.item_name}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    الكمية: {it.quantity} {it.unit || ''}
                                  </span>
                                </div>
                                <span className="font-mono text-xs font-bold text-emerald-300">
                                  {it.total_price !== null && it.total_price !== undefined
                                    ? `${Number(it.total_price).toLocaleString('en-US')} ج.م`
                                    : it.unit_price !== null && it.unit_price !== undefined
                                    ? `${Number(it.unit_price).toLocaleString('en-US')} ج.م`
                                    : '—'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {ord.notes && (
                        <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                          <span className="text-[10px] font-bold text-slate-400 block mb-1">
                            ملاحظات الطلب:
                          </span>
                          <p className="text-xs text-slate-200 whitespace-pre-wrap">{ord.notes}</p>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : orderPreviewTarget.source === 'pharmacy' && pharmacyPreviewData?.order ? (
                (() => {
                  const ord = pharmacyPreviewData.order;
                  const deliv = pharmacyPreviewData.deliveryOrder;
                  const pharm = pharmacyPreviewData.pharmacy;
                  const items = pharmacyPreviewData.items;
                  const statusBadge = getOrderStatusBadge(deliv?.status || ord.status);
                  const isCancelPending =
                    Boolean(deliv?.driver_cancel_requested) ||
                    ord.status === 'cancellation_pending' ||
                    deliv?.status === 'cancellation_pending';
                  const canDecideCancel = canDecideCancelBySource('pharmacy');

                  return (
                    <div className="space-y-4">
                      {/* Status & Timestamps */}
                      <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">حالة الطلب:</span>
                          <span
                            className={`text-xs font-black px-2.5 py-1 rounded-xl border ${statusBadge.cls}`}
                          >
                            {statusBadge.label}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          تاريخ الإنشاء: {new Date(ord.created_at).toLocaleString('ar-EG')}
                        </span>
                      </div>

                      {/* Pending Cancellation Banner & Decision */}
                      {isCancelPending && (
                        <div className="p-4 rounded-2xl bg-rose-950/35 border border-rose-500/35 space-y-3">
                          <div className="space-y-1">
                            <span className="text-xs font-black text-rose-300 flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4" />
                              <span>طلب إلغاء توصيل صيدلية بانتظار قرار الإدارة</span>
                            </span>
                            {(deliv?.driver_cancel_reason || ord.cancellation_reason) && (
                              <p className="text-xs text-rose-200">
                                <span className="font-bold">سبب الإلغاء: </span>
                                {deliv?.driver_cancel_reason || ord.cancellation_reason}
                              </p>
                            )}
                          </div>

                          {canDecideCancel ? (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                disabled={isSubmittingCancelDecision}
                                onClick={() =>
                                  handlePromptCancellationDecision({
                                    orderId: ord.id,
                                    orderNumber: ord.order_number || ord.id.slice(0, 8),
                                    source: 'pharmacy',
                                    customerName: ord.customer_name || 'عميل صيدلية',
                                    driverName: deliv?.driver_name || null,
                                    reason: deliv?.driver_cancel_reason || ord.cancellation_reason,
                                    decision: 'approve_cancel',
                                  })
                                }
                                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black flex items-center gap-1.5 cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                                <span>قبول الإلغاء</span>
                              </button>
                              <button
                                type="button"
                                disabled={isSubmittingCancelDecision}
                                onClick={() =>
                                  handlePromptCancellationDecision({
                                    orderId: ord.id,
                                    orderNumber: ord.order_number || ord.id.slice(0, 8),
                                    source: 'pharmacy',
                                    customerName: ord.customer_name || 'عميل صيدلية',
                                    driverName: deliv?.driver_name || null,
                                    reason: deliv?.driver_cancel_reason || ord.cancellation_reason,
                                    decision: 'reject_cancel',
                                  })
                                }
                                className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-50 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1.5 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                                <span>رفض الإلغاء وإعادة الطلب للتنفيذ</span>
                              </button>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400">
                              للعرض فقط — يتطلب صلاحية إدارة الصيدلية/الطلبات لاتخاذ قرار الإلغاء.
                            </div>
                          )}
                        </div>
                      )}

                      {/* Customer & Pharmacy Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-500 block">
                            بيانات العميل والعنوان
                          </span>
                          <div className="text-sm font-black text-white">
                            {ord.customer_name || 'عميل صيدلية'}
                          </div>
                          {ord.customer_phone && (
                            <div className="text-xs font-mono text-emerald-400" dir="ltr">
                              {ord.customer_phone}
                            </div>
                          )}
                          <div className="text-[11px] text-slate-300">
                            {[ord.governorate, ord.center, ord.detailed_address]
                              .filter(Boolean)
                              .join(' — ') || '—'}
                          </div>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-500 block">
                            الصيدلية والمندوب المكلف
                          </span>
                          <div className="text-xs font-bold text-purple-300">
                            الصيدلية: {pharm?.name || ord.pharmacy_name || 'غير محددة'}
                          </div>
                          <div className="text-xs font-bold text-sky-300">
                            السائق: {deliv?.driver_name || 'لم يتم إسناد سائق بعد'}
                          </div>
                          {deliv?.driver_phone && (
                            <div className="text-[11px] font-mono text-slate-400" dir="ltr">
                              {deliv.driver_phone}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Financials */}
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">قيمة الأدوية</span>
                          <span className="text-sm font-black font-mono text-white">
                            {ord.items_total !== null && ord.items_total !== undefined
                              ? `${Number(ord.items_total).toLocaleString('en-US')} ج.م`
                              : 'غير محدد'}
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">رسوم التوصيل</span>
                          <span className="text-sm font-black font-mono text-sky-300">
                            {ord.delivery_fee !== null && ord.delivery_fee !== undefined
                              ? `${Number(ord.delivery_fee).toLocaleString('en-US')} ج.م`
                              : 'غير محدد'}
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-950/70 border border-purple-500/30">
                          <span className="text-[10px] text-purple-300 block">الإجمالي الكلي</span>
                          <span className="text-sm font-black font-mono text-purple-300">
                            {ord.total_amount !== null && ord.total_amount !== undefined
                              ? `${Number(ord.total_amount).toLocaleString('en-US')} ج.م`
                              : 'غير محدد'}
                          </span>
                        </div>
                      </div>

                      {/* Pharmacy Items */}
                      <div className="space-y-2">
                        <span className="text-xs font-black text-white block">
                          الأدوية والأصناف المسجلة ({items.length})
                        </span>
                        {items.length === 0 ? (
                          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-slate-400 text-center">
                            لا توجد أصناف مسجلة أو الطلب مرفق بروشتة طبية فقط ({pharmacyPreviewData.files.length} مرفقات)
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-slate-800 overflow-hidden divide-y divide-slate-800/80 bg-slate-950/70">
                            {items.map((it) => (
                              <div
                                key={it.id}
                                className="p-3 flex items-center justify-between gap-2"
                              >
                                <div>
                                  <span className="font-bold text-white block">
                                    {it.medicine_name || it.requested_name || 'صنف دوائي'}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    الكمية: {it.quantity}
                                  </span>
                                </div>
                                <span className="font-mono text-xs font-bold text-purple-300">
                                  {it.total_price !== null && it.total_price !== undefined
                                    ? `${Number(it.total_price).toLocaleString('en-US')} ج.م`
                                    : it.unit_price !== null && it.unit_price !== undefined
                                    ? `${Number(it.unit_price).toLocaleString('en-US')} ج.م`
                                    : '—'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : null}
            </div>

            {/* Sticky Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const target = orderPreviewTarget;
                  handleCloseOrderQuickPreview();
                  if (target.source === 'delivery') {
                    navigateToSection('delivery_orders', {
                      openOrderId: target.id,
                      statusTab: 'all',
                    });
                  } else {
                    navigateToSection('pharmacy_orders', {
                      openOrderId: target.id,
                    });
                  }
                }}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>
                  فتح في قسم {orderPreviewTarget.source === 'delivery' ? 'طلبات الدليفري' : 'طلبات الصيدلية'} الكامل
                </span>
              </button>

              <button
                type="button"
                onClick={handleCloseOrderQuickPreview}
                className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* Phase 3 — MODAL 2: Cancellation Decision Confirmation Bottom Sheet  */}
      {/* =================================================================== */}
      {cancelDecisionModal && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => {
            if (!isSubmittingCancelDecision) {
              setCancelDecisionModal(null);
              setCancelDecisionError(null);
            }
          }}
        >
          <div
            className="w-full sm:max-w-lg max-h-[90vh] bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden flex justify-center pt-3 pb-1 bg-slate-950/60 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700" />
            </div>

            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                    cancelDecisionModal.decision === 'approve_cancel'
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                      : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  {cancelDecisionModal.decision === 'approve_cancel' ? (
                    <XCircle className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    {cancelDecisionModal.decision === 'approve_cancel'
                      ? 'تأكيد قبول إلغاء الطلب'
                      : 'تأكيد رفض طلب الإلغاء'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    الطلب #{cancelDecisionModal.orderNumber} ({cancelDecisionModal.source === 'delivery' ? 'دليفري' : 'صيدلية'})
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isSubmittingCancelDecision}
                onClick={() => {
                  setCancelDecisionModal(null);
                  setCancelDecisionError(null);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 flex-1 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">العميل:</span>
                  <span className="font-bold text-white">{cancelDecisionModal.customerName}</span>
                </div>
                {cancelDecisionModal.driverName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">السائق:</span>
                    <span className="font-bold text-sky-300">{cancelDecisionModal.driverName}</span>
                  </div>
                )}
                {cancelDecisionModal.reason && (
                  <div className="pt-1.5 border-t border-slate-800/80 text-rose-200">
                    <span className="font-bold">سبب طلب الإلغاء: </span>
                    {cancelDecisionModal.reason}
                  </div>
                )}
              </div>

              <div
                className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
                  cancelDecisionModal.decision === 'approve_cancel'
                    ? 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                    : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                }`}
              >
                {cancelDecisionModal.decision === 'approve_cancel'
                  ? 'عند التأكيد سيتم قبول طلب الإلغاء رسميًا وتحويل حالة الطلب في قاعدة البيانات إلى "ملغي".'
                  : 'عند التأكيد سيتم رفض طلب الإلغاء وإعادة الطلب إلى مسار التوصيل النشط.'}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  ملاحظة الإدارة للسجل (اختياري):
                </label>
                <textarea
                  rows={2}
                  value={cancelAdminNote}
                  onChange={(e) => setCancelAdminNote(e.target.value)}
                  disabled={isSubmittingCancelDecision}
                  placeholder="أضف ملاحظة توضيحية تحفظ في سجل القرار..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-2xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                />
              </div>

              {cancelDecisionError && (
                <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{cancelDecisionError}</span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                disabled={isSubmittingCancelDecision}
                onClick={() => {
                  setCancelDecisionModal(null);
                  setCancelDecisionError(null);
                }}
                className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold cursor-pointer"
              >
                تراجع
              </button>

              <button
                type="button"
                disabled={isSubmittingCancelDecision}
                onClick={handleExecuteCancellationDecision}
                className={`px-5 py-2.5 rounded-2xl text-white text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                  cancelDecisionModal.decision === 'approve_cancel'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {isSubmittingCancelDecision ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري التنفيذ...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>
                      {cancelDecisionModal.decision === 'approve_cancel'
                        ? 'تأكيد قبول الإلغاء'
                        : 'تأكيد رفض الإلغاء'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* Phase 3 — MODAL 3: New Driver Document Preview & Approval/Rejection */}
      {/* =================================================================== */}
      {driverReviewModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => {
            if (!isSubmittingDriverDecision) {
              setDriverReviewModal(null);
              setDriverDecisionSubmitError(null);
            }
          }}
        >
          <div
            className="w-full sm:max-w-3xl max-h-[92vh] bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 bg-slate-950/60 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700" />
            </div>

            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 flex items-center justify-center shrink-0">
                  <Bike className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-black text-white truncate">
                      فحص مستندات واعتماد السائق — {reviewedDriver?.full_name || driverReviewModal.initialName}
                    </h3>
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-xl border ${
                        reviewedDriverDocsSummary.meetsApprovalRequirements
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      الوثائق الصالحة: {reviewedDriverDocsSummary.readyPreviewCount}/4
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono" dir="ltr">
                    {reviewedDriver?.phone || driverReviewModal.initialPhone}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isSubmittingDriverDecision}
                onClick={() => {
                  setDriverReviewModal(null);
                  setDriverDecisionSubmitError(null);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-50 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 flex-1 text-xs">
              {isLoadingDriverReview ? (
                <div className="py-14 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                  <span>جاري جلب ملف السائق والتحقق الفعلي من المستندات المرفوعة...</span>
                </div>
              ) : driverReviewError ? (
                <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-center space-y-3">
                  <AlertTriangle className="w-7 h-7 text-rose-400 mx-auto" />
                  <p className="text-xs font-bold text-rose-200">{driverReviewError}</p>
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenDriverReview(
                        {
                          id: driverReviewModal.driverId,
                          full_name: driverReviewModal.initialName,
                          phone: driverReviewModal.initialPhone,
                        },
                        driverReviewModal.initialAction
                      )
                    }
                    className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 text-xs font-bold cursor-pointer"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              ) : reviewedDriver ? (
                <>
                  {/* Driver Info Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">الاسم الكامل</span>
                      <span className="text-xs font-black text-white mt-0.5 block">
                        {reviewedDriver.full_name}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">المحافظة والمركز</span>
                      <span className="text-xs font-bold text-white mt-0.5 block">
                        {[reviewedDriver.governorate_name, reviewedDriver.center_name]
                          .filter(Boolean)
                          .join(' — ') || 'غير محدد'}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">نوع المركبة</span>
                      <span className="text-xs font-bold text-indigo-300 mt-0.5 block">
                        {reviewedDriver.vehicle_type || 'غير محدد'}
                      </span>
                    </div>
                  </div>

                  {/* Strict Approval Requirement Notice */}
                  {!reviewedDriverDocsSummary.meetsApprovalRequirements && (
                    <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/35 flex items-start gap-2.5 text-amber-200">
                      <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-black block">
                          متطلبات الاعتماد غير مستوفاة حاليًا ({reviewedDriverDocsSummary.readyPreviewCount}/4 مستندات متاحة)
                        </span>
                        <p className="text-[11px] text-amber-200/90 leading-relaxed">
                          لا يمكن اعتماد السائق إلا بعد التأكد من رفع جميع المستندات الأربع المطلوبة فعليًا وظهورها بشكل سليم. يمكنك رفض الطلب مع ذكر السبب أو فتح ملف السائق في قسم الدليفري لاستكمال المستندات.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 4 Documents Grid */}
                  <div className="space-y-2">
                    <span className="text-xs font-black text-white block">
                      المستندات الأربع المطلوبة للاعتماد (معاينة فعلية من التخزين):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {OVERVIEW_DRIVER_DOC_TYPES.map((meta) => {
                        const docState = driverDocPreviews[meta.type];
                        const isAvailable =
                          docState.hasStoredPath && Boolean(docState.url) && !docState.broken;

                        return (
                          <div
                            key={meta.type}
                            className={`p-3 rounded-2xl border flex flex-col justify-between gap-2.5 ${
                              isAvailable
                                ? 'bg-slate-950/80 border-slate-800'
                                : 'bg-slate-950/40 border-rose-500/25'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-white text-xs">{meta.title}</span>
                              {docState.loading ? (
                                <span className="text-[10px] font-bold text-slate-400 px-2 py-0.5 rounded-lg bg-slate-800">
                                  جاري التحقق...
                                </span>
                              ) : isAvailable ? (
                                <span className="text-[10px] font-bold text-emerald-300 px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
                                  مرفوع ومتاح
                                </span>
                              ) : docState.hasStoredPath && docState.broken ? (
                                <span className="text-[10px] font-bold text-rose-300 px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/30">
                                  ملف تالف / تعذر التحميل
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-300 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30">
                                  غير مرفوع
                                </span>
                              )}
                            </div>

                            {docState.loading ? (
                              <div className="h-36 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                                <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                              </div>
                            ) : isAvailable && docState.url ? (
                              <div className="relative group h-36 rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                                <img
                                  src={docState.url}
                                  alt={meta.title}
                                  onError={() => {
                                    setDriverDocPreviews((prev) => ({
                                      ...prev,
                                      [meta.type]: {
                                        ...prev[meta.type],
                                        broken: true,
                                        error: 'تعذر عرض ملف الصورة',
                                      },
                                    }));
                                  }}
                                  className="w-full h-full object-cover cursor-pointer"
                                  onClick={() =>
                                    setLightboxDocPreview({
                                      title: meta.title,
                                      url: docState.url!,
                                      driverName: reviewedDriver.full_name,
                                    })
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLightboxDocPreview({
                                      title: meta.title,
                                      url: docState.url!,
                                      driverName: reviewedDriver.full_name,
                                    })
                                  }
                                  className="absolute bottom-2 left-2 px-2.5 py-1 rounded-xl bg-slate-950/85 hover:bg-slate-900 text-white text-[11px] font-bold flex items-center gap-1 border border-slate-700 cursor-pointer"
                                >
                                  <Maximize2 className="w-3 h-3 text-indigo-400" />
                                  <span>تكبير المستند</span>
                                </button>
                              </div>
                            ) : (
                              <div className="h-36 rounded-xl bg-slate-900/60 border border-dashed border-slate-800 flex flex-col items-center justify-center gap-1.5 text-slate-500 p-3 text-center">
                                <AlertTriangle className="w-5 h-5 text-amber-400/80" />
                                <span className="text-[11px] font-bold text-slate-400">
                                  {docState.error || 'لم يقم السائق برفع هذا المستند بعد'}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Confirmation Box when Approve or Reject is selected */}
                  {canApproveDrivers && driverDecisionStep !== 'none' && (
                    <div
                      className={`p-4 rounded-2xl border space-y-3 ${
                        driverDecisionStep === 'approve'
                          ? 'bg-emerald-950/30 border-emerald-500/35'
                          : 'bg-rose-950/30 border-rose-500/35'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white">
                          {driverDecisionStep === 'approve'
                            ? 'تأكيد اعتماد وتفعيل حساب السائق'
                            : 'تأكيد رفض طلب انضمام السائق'}
                        </span>
                        <button
                          type="button"
                          disabled={isSubmittingDriverDecision}
                          onClick={() => {
                            setDriverDecisionStep('none');
                            setDriverDecisionSubmitError(null);
                          }}
                          className="text-[11px] font-bold text-slate-400 hover:text-white cursor-pointer"
                        >
                          تغيير الإجراء
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-300 block">
                          {driverDecisionStep === 'approve'
                            ? 'ملاحظات الاعتماد (اختياري):'
                            : 'سبب رفض طلب السائق (إلزامي):'}
                        </label>
                        <textarea
                          rows={2}
                          value={driverDecisionNote}
                          onChange={(e) => setDriverDecisionNote(e.target.value)}
                          disabled={isSubmittingDriverDecision}
                          placeholder={
                            driverDecisionStep === 'approve'
                              ? 'أضف ملاحظة إدارية عند الاعتماد (اختياري)...'
                              : 'اكتب سبب الرفض بوضوح ليتم حفظه في ملف السائق...'
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                        />
                      </div>

                      {driverDecisionSubmitError && (
                        <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-[11px] flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>{driverDecisionSubmitError}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={isSubmittingDriverDecision}
                          onClick={() => {
                            setDriverDecisionStep('none');
                            setDriverDecisionSubmitError(null);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                        >
                          تراجع
                        </button>
                        <button
                          type="button"
                          disabled={
                            isSubmittingDriverDecision ||
                            (driverDecisionStep === 'approve' &&
                              !reviewedDriverDocsSummary.meetsApprovalRequirements)
                          }
                          onClick={handleExecuteDriverDecision}
                          className={`px-4 py-2 rounded-xl text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                            driverDecisionStep === 'approve'
                              ? 'bg-emerald-600 hover:bg-emerald-500'
                              : 'bg-rose-600 hover:bg-rose-500'
                          }`}
                        >
                          {isSubmittingDriverDecision ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>جاري الحفظ...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>
                                {driverDecisionStep === 'approve'
                                  ? 'تأكيد اعتماد السائق الآن'
                                  : 'تأكيد رفض الطلب'}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Sticky Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                {canApproveDrivers && reviewedDriver && driverDecisionStep === 'none' && (
                  <>
                    <button
                      type="button"
                      disabled={!reviewedDriverDocsSummary.meetsApprovalRequirements}
                      onClick={() => {
                        setDriverDecisionSubmitError(null);
                        setDriverDecisionStep('approve');
                      }}
                      className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>اعتماد السائق</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDriverDecisionSubmitError(null);
                        setDriverDecisionStep('reject');
                      }}
                      className="px-4 py-2.5 rounded-2xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>رفض الطلب</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const targetId = driverReviewModal.driverId;
                    setDriverReviewModal(null);
                    navigateToSection('delivery_drivers', {
                      approvalFilter: 'pending_approval',
                      openDriverId: targetId,
                    });
                  }}
                  className="px-3.5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                  <span>فتح في قسم الدليفري الكامل</span>
                </button>
              </div>

              <button
                type="button"
                disabled={isSubmittingDriverDecision}
                onClick={() => {
                  setDriverReviewModal(null);
                  setDriverDecisionSubmitError(null);
                }}
                className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Document Image Lightbox */}
      {lightboxDocPreview && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-between p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxDocPreview(null)}
        >
          <div
            className="w-full max-w-4xl flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h4 className="text-sm font-black text-white">{lightboxDocPreview.title}</h4>
              <p className="text-[11px] text-slate-400">السائق: {lightboxDocPreview.driverName}</p>
            </div>
            <button
              type="button"
              onClick={() => setLightboxDocPreview(null)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div
            className="flex-1 w-full flex items-center justify-center overflow-auto py-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxDocPreview.url}
              alt={lightboxDocPreview.title}
              className="max-w-full max-h-[78vh] object-contain rounded-2xl border border-slate-800 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
