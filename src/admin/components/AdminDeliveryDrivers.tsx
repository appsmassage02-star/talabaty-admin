import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAdmin } from '../context/AdminContext';
import { adminService, resolveDocumentSrc, isDirectDocumentSrc } from '../services/adminService';
import {
  DeliveryDriver,
  DeliveryDriverStatsSummary,
  DeliveryDriverOrder,
  DriverDocumentType,
  DriverDocumentColumn,
} from '../types';
import {
  Bike,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  RefreshCw,
  Phone,
  Calendar,
  Filter,
  User,
  Package,
  CheckCircle,
  AlertTriangle,
  X,
  MapPin,
  FileText,
  Power,
  Mail,
  FileCheck,
  FileImage,
  Upload,
  Download,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  Copy,
  CheckCheck,
  Maximize2,
  ShieldCheck,
  Info,
} from 'lucide-react';

export { resolveDocumentSrc };

interface DocumentMeta {
  type: DriverDocumentType;
  column: DriverDocumentColumn;
  fileName: string;
  shortLabel: string;
  title: string;
  subtitle: string;
  description: string;
}

const DRIVER_DOCUMENT_TYPES: DocumentMeta[] = [
  {
    type: 'id_card_front',
    column: 'id_card_front_path',
    fileName: 'id_card_front.webp',
    shortLabel: 'هوية أمامي',
    title: 'بطاقة الهوية (الوجه الأمامي)',
    subtitle: 'id_card_front_path',
    description: 'صورة الوجه الأمامي لبطاقة الرقم القومي',
  },
  {
    type: 'id_card_back',
    column: 'id_card_back_path',
    fileName: 'id_card_back.webp',
    shortLabel: 'هوية خلفي',
    title: 'بطاقة الهوية (ظهر البطاقة)',
    subtitle: 'id_card_back_path',
    description: 'صورة ظهر بطاقة الرقم القومي',
  },
  {
    type: 'driver_license',
    column: 'driver_license_path',
    fileName: 'driver_license.webp',
    shortLabel: 'رخصة قيادة',
    title: 'رخصة القيادة الشخصية',
    subtitle: 'driver_license_path',
    description: 'صورة رخصة القيادة الشخصية السارية',
  },
  {
    type: 'vehicle_license',
    column: 'vehicle_license_path',
    fileName: 'vehicle_license.webp',
    shortLabel: 'رخصة مركبة',
    title: 'رخصة تسيير المركبة',
    subtitle: 'vehicle_license_path',
    description: 'صورة رخصة تسيير المركبة (أمام/خلف)',
  },
];

interface DocAccessState {
  loading: boolean;
  signedUrl: string | null;
  fallbackPublicUrl: string | null;
  error: string | null;
  imageBroken: boolean;
}

const INITIAL_DOC_ACCESS: Record<DriverDocumentType, DocAccessState> = {
  id_card_front: { loading: false, signedUrl: null, fallbackPublicUrl: null, error: null, imageBroken: false },
  id_card_back: { loading: false, signedUrl: null, fallbackPublicUrl: null, error: null, imageBroken: false },
  driver_license: { loading: false, signedUrl: null, fallbackPublicUrl: null, error: null, imageBroken: false },
  vehicle_license: { loading: false, signedUrl: null, fallbackPublicUrl: null, error: null, imageBroken: false },
};

function formatDocumentSourceInfo(rawPath?: string | null, column?: string): {
  badgeText: string;
  displayPath: string;
  isBase64: boolean;
} {
  if (!rawPath || !rawPath.trim()) {
    return {
      badgeText: 'غير مرفوع',
      displayPath: `${column || 'document'}: فارغ`,
      isBase64: false,
    };
  }
  const trimmed = rawPath.trim();
  if (trimmed.startsWith('data:image/')) {
    const mimeMatch = trimmed.match(/^data:image\/([a-zA-Z0-9+.-]+);/);
    const ext = mimeMatch ? mimeMatch[1].toUpperCase() : 'IMG';
    const approxKb = Math.max(1, Math.round((trimmed.length * 0.75) / 1024));
    return {
      badgeText: `Base64 (${ext})`,
      displayPath: `صورة مدمجة مباشرة (${ext} • ~${approxKb} KB)`,
      isBase64: true,
    };
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return {
      badgeText: 'رابط مباشر',
      displayPath: trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed,
      isBase64: false,
    };
  }
  return {
    badgeText: 'Storage Bucket',
    displayPath: trimmed,
    isBase64: false,
  };
}

export const AdminDeliveryDrivers: React.FC = () => {
  const { hasPermission, showToast, sectionFilter, clearSectionFilter } = useAdmin();
  const canManageDelivery = hasPermission('delivery.manage');

  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [stats, setStats] = useState<DeliveryDriverStatsSummary>({
    total_drivers: 0,
    active_drivers: 0,
    inactive_drivers: 0,
    total_assigned_orders: 0,
    completed_orders: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>(() => sectionFilter?.search || '');
  const [activeFilter, setActiveFilter] = useState<string>(() => sectionFilter?.activeFilter || 'all'); // 'all' | 'active' | 'inactive'
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [approvalFilter, setApprovalFilter] = useState<string>(() => sectionFilter?.approvalFilter || 'all'); // 'all' | 'pending_approval' | 'approved' | 'rejected'
  const [governorateFilter, setGovernorateFilter] = useState<string>('all');
  const [docsFilter, setDocsFilter] = useState<string>('all'); // 'all' | 'complete' | 'incomplete'
  const [pendingOpenDriverId, setPendingOpenDriverId] = useState<string | null>(
    () => sectionFilter?.openDriverId || null
  );

  useEffect(() => {
    if (!sectionFilter) return;
    if (sectionFilter.approvalFilter !== undefined) {
      setApprovalFilter(sectionFilter.approvalFilter);
    }
    if (sectionFilter.activeFilter !== undefined) {
      setActiveFilter(sectionFilter.activeFilter);
    }
    if (sectionFilter.search !== undefined) {
      setSearchQuery(sectionFilter.search);
    }
    if (sectionFilter.openDriverId) {
      setPendingOpenDriverId(String(sectionFilter.openDriverId));
    }
    clearSectionFilter();
  }, [sectionFilter, clearSectionFilter]);

  // Selected driver for Details Modal
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [driverDetails, setDriverDetails] = useState<DeliveryDriver | null>(null);
  const [driverOrders, setDriverOrders] = useState<DeliveryDriverOrder[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Signed URL access state per document in bucket "driver-documents"
  const [docAccess, setDocAccess] = useState<Record<DriverDocumentType, DocAccessState>>(INITIAL_DOC_ACCESS);
  const [downloadingDocType, setDownloadingDocType] = useState<DriverDocumentType | null>(null);

  // Toggle active confirmation
  const [driverToToggle, setDriverToToggle] = useState<DeliveryDriver | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  // Approve driver confirmation
  const [driverToApprove, setDriverToApprove] = useState<DeliveryDriver | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // Reject driver confirmation
  const [driverToReject, setDriverToReject] = useState<DeliveryDriver | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Delete driver account confirmation
  const [driverToDelete, setDriverToDelete] = useState<DeliveryDriver | null>(null);
  const [isDeletingDriver, setIsDeletingDriver] = useState(false);
  const [deleteDriverError, setDeleteDriverError] = useState<string | null>(null);

  // Document Lightbox (Viewer / Zoom / Rotate)
  const [lightboxDoc, setLightboxDoc] = useState<{
    title: string;
    url: string;
    path: string;
    fileName: string;
    driverName: string;
    type: DriverDocumentType;
  } | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [rotationDegrees, setRotationDegrees] = useState(0);

  // Document Uploading / Replacement state
  const [uploadingDocType, setUploadingDocType] = useState<DriverDocumentType | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Document Deletion Confirmation Modal
  const [docToDelete, setDocToDelete] = useState<{
    driverId: string;
    docType: DriverDocumentType;
    title: string;
    path: string;
  } | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  // Copy helper
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const handleCopy = (text: string, key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('تم النسخ إلى الحافظة', 'info');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Helper: get stored path for a document from a driver record
  const getDriverDocPath = (driver: DeliveryDriver | null, docMeta: DocumentMeta): string | null => {
    if (!driver) return null;
    const raw = driver[docMeta.column] || driver.documents?.[docMeta.column] || null;
    return raw && raw.trim() ? raw.trim() : null;
  };

  // Count uploaded docs for a driver
  const getDocsCount = useCallback((d: DeliveryDriver) => {
    let count = 0;
    if (d.id_card_front_path || d.documents?.id_card_front_path) count++;
    if (d.id_card_back_path || d.documents?.id_card_back_path) count++;
    if (d.driver_license_path || d.documents?.driver_license_path) count++;
    if (d.vehicle_license_path || d.documents?.vehicle_license_path) count++;
    return count;
  }, []);

  // Resolve Document Image URLs (Direct Base64 / HTTP URLs immediately without network calls; Storage Fallback via getPublicUrl & createSignedUrl)
  const resolveDriverDocumentsSignedUrls = useCallback(async (driver: DeliveryDriver | null) => {
    if (!driver) {
      setDocAccess(INITIAL_DOC_ACCESS);
      return;
    }

    // Build initial state: Direct Base64/HTTP URLs and getPublicUrl are resolved synchronously without waiting!
    const initialState = {} as Record<DriverDocumentType, DocAccessState>;
    const storageDocsToSign: DocumentMeta[] = [];

    for (const meta of DRIVER_DOCUMENT_TYPES) {
      const path = getDriverDocPath(driver, meta);
      if (!path) {
        initialState[meta.type] = {
          loading: false,
          signedUrl: null,
          fallbackPublicUrl: null,
          error: null,
          imageBroken: false,
        };
      } else if (isDirectDocumentSrc(path)) {
        // Direct Base64 Data URL or HTTP/HTTPS link -> zero network calls!
        const directSrc = resolveDocumentSrc(path);
        initialState[meta.type] = {
          loading: false,
          signedUrl: directSrc,
          fallbackPublicUrl: directSrc,
          error: null,
          imageBroken: false,
        };
      } else {
        // Storage Fallback path inside bucket "driver-documents"
        const publicSrc = resolveDocumentSrc(path);
        initialState[meta.type] = {
          loading: !publicSrc,
          signedUrl: publicSrc,
          fallbackPublicUrl: publicSrc,
          error: null,
          imageBroken: false,
        };
        storageDocsToSign.push(meta);
      }
    }

    setDocAccess(initialState);

    if (storageDocsToSign.length === 0) {
      return;
    }

    await Promise.all(
      storageDocsToSign.map(async (meta) => {
        const path = getDriverDocPath(driver, meta);
        if (!path) return;

        const res = await adminService.getDriverDocumentSignedUrl(path, 3600);
        const publicSrc = resolveDocumentSrc(path);
        const bestUrl = res.signedUrl || publicSrc;

        if (bestUrl) {
          setDocAccess((prev) => ({
            ...prev,
            [meta.type]: {
              loading: false,
              signedUrl: bestUrl,
              fallbackPublicUrl: publicSrc,
              error: null,
              imageBroken: false,
            },
          }));
        } else {
          setDocAccess((prev) => ({
            ...prev,
            [meta.type]: {
              loading: false,
              signedUrl: null,
              fallbackPublicUrl: null,
              error: res.error || 'تعذر تحميل المستند',
              imageBroken: true,
            },
          }));
        }
      })
    );
  }, []);

  // Load Drivers
  const loadDrivers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminService.getDeliveryDrivers({
        search: searchQuery,
        isActive:
          activeFilter === 'active' ? true : activeFilter === 'inactive' ? false : undefined,
        vehicleType: vehicleFilter !== 'all' ? vehicleFilter : undefined,
        status: approvalFilter !== 'all' ? approvalFilter : undefined,
        governorate: governorateFilter !== 'all' ? governorateFilter : undefined,
      });

      let loaded = res.drivers;
      if (docsFilter === 'complete') {
        loaded = loaded.filter((d) => getDocsCount(d) === 4);
      } else if (docsFilter === 'incomplete') {
        loaded = loaded.filter((d) => getDocsCount(d) < 4);
      }

      setDrivers(loaded);
      setStats(res.stats);
    } catch (err) {
      console.warn('Failed to load delivery drivers:', err);
      showToast('تعذر تحميل بيانات الدليفري', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [
    searchQuery,
    activeFilter,
    vehicleFilter,
    approvalFilter,
    governorateFilter,
    docsFilter,
    getDocsCount,
    showToast,
  ]);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  // Derived Governorates
  const availableGovernorates = useMemo(() => {
    const set = new Set<string>();
    drivers.forEach((d) => {
      if (d.governorate_name && d.governorate_name.trim()) {
        set.add(d.governorate_name.trim());
      }
    });
    return Array.from(set).sort();
  }, [drivers]);

  // Open Details Modal
  const handleOpenDetails = async (driver: DeliveryDriver) => {
    setSelectedDriverId(driver.id);
    setIsLoadingDetails(true);
    setDocAccess(INITIAL_DOC_ACCESS);
    try {
      const res = await adminService.getDeliveryDriverDetails(driver.id);
      const targetDriver = res.driver || driver;
      setDriverDetails(targetDriver);
      setDriverOrders(res.orders || []);
      await resolveDriverDocumentsSignedUrls(targetDriver);
    } catch (err) {
      console.warn('Failed to load driver details:', err);
      setDriverDetails(driver);
      setDriverOrders([]);
      await resolveDriverDocumentsSignedUrls(driver);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (!pendingOpenDriverId || isLoading) return;
    const idToOpen = pendingOpenDriverId;
    setPendingOpenDriverId(null);
    const existing = drivers.find((d) => d.id === idToOpen);
    if (existing) {
      handleOpenDetails(existing);
    } else {
      adminService.getDeliveryDriverDetails(idToOpen).then((res) => {
        if (res.driver) {
          handleOpenDetails(res.driver);
        }
      });
    }
  }, [pendingOpenDriverId, isLoading, drivers]);

  // Confirm Approve Driver (admin_approve_driver)
  const handleConfirmApprove = async () => {
    if (!driverToApprove) return;
    if (!canManageDelivery) {
      showToast('عفواً، لا تملك صلاحية اعتماد السائقين', 'error');
      return;
    }
    const uploadedCount = getDocsCount(driverToApprove);
    if (uploadedCount < 4) {
      showToast(
        `لا يمكن اعتماد السائق قبل استكمال رفع الوثائق الأربع المطلوبة (المرفوع حاليًا: ${uploadedCount}/4)`,
        'error'
      );
      return;
    }
    setIsApproving(true);
    try {
      const res = await adminService.approveDriver(driverToApprove.id);
      if (res.success) {
        showToast(`تم اعتماد وتفعيل السائق ${driverToApprove.full_name} بنجاح في Supabase`, 'success');
        setDriverToApprove(null);
        if (selectedDriverId === driverToApprove.id) {
          const updated = await adminService.getDeliveryDriverDetails(driverToApprove.id);
          if (updated.driver) {
            setDriverDetails(updated.driver);
          }
        }
        await loadDrivers();
      } else {
        showToast(res.error || 'تعذر اعتماد السائق', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'حدث خطأ أثناء اعتماد السائق', 'error');
    } finally {
      setIsApproving(false);
    }
  };

  // Confirm Reject Driver (admin_reject_driver)
  const handleConfirmReject = async () => {
    if (!driverToReject) return;
    setIsRejecting(true);
    try {
      const res = await adminService.rejectDriver(driverToReject.id, rejectionReason.trim());
      if (res.success) {
        showToast(`تم رفض طلب السائق ${driverToReject.full_name} وتسجيل السبب في Supabase`, 'info');
        setDriverToReject(null);
        setRejectionReason('');
        if (selectedDriverId === driverToReject.id) {
          const updated = await adminService.getDeliveryDriverDetails(driverToReject.id);
          if (updated.driver) {
            setDriverDetails(updated.driver);
          }
        }
        await loadDrivers();
      } else {
        showToast(res.error || 'تعذر رفض السائق', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'حدث خطأ أثناء رفض السائق', 'error');
    } finally {
      setIsRejecting(false);
    }
  };

  // Confirm Toggle Active (admin_toggle_driver_active)
  const handleConfirmToggleActive = async () => {
    if (!driverToToggle) return;
    setIsToggling(true);
    try {
      const newStatus = !driverToToggle.is_active;
      const res = await adminService.toggleDriverActive(driverToToggle.id, newStatus);
      if (res.success) {
        showToast(
          newStatus
            ? `تم تفعيل حساب السائق ${driverToToggle.full_name} بنجاح`
            : `تم إيقاف حساب السائق ${driverToToggle.full_name}`,
          'success'
        );
        setDriverToToggle(null);
        if (selectedDriverId === driverToToggle.id) {
          const updated = await adminService.getDeliveryDriverDetails(driverToToggle.id);
          if (updated.driver) {
            setDriverDetails(updated.driver);
          }
        }
        await loadDrivers();
      } else {
        showToast(res.error || 'تعذر تعديل حالة السائق', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'حدث خطأ أثناء تعديل الحالة', 'error');
    } finally {
      setIsToggling(false);
    }
  };

  // Confirm Delete Driver Account (deleteDeliveryDriverAccount)
  const handleConfirmDeleteDriver = async () => {
    if (!driverToDelete || isDeletingDriver) return;
    setIsDeletingDriver(true);
    setDeleteDriverError(null);
    try {
      const res = await adminService.deleteDeliveryDriverAccount(driverToDelete.id);
      if (res.success && res.driverDeleted) {
        if (res.authDeleted) {
          showToast(
            `تم حذف حساب الدليفري (${driverToDelete.full_name}) ومستنداته بالكامل من delivery_drivers و auth.users مع الاحتفاظ بالطلبات التاريخية`,
            'success'
          );
        } else {
          showToast(
            res.authWarning ||
              `تم حذف سجل الدليفري (${driverToDelete.full_name}) ومستنداته فعليًا. حذف auth.users يحتاج إلى مسار Backend / Edge Function آمن.`,
            'info'
          );
        }

        if (selectedDriverId === driverToDelete.id) {
          setSelectedDriverId(null);
          setDriverDetails(null);
          setDriverOrders([]);
        }
        setDriverToDelete(null);
        setDeleteDriverError(null);
        await loadDrivers();
      } else {
        const errMsg = res.error || 'تعذر حذف حساب الدليفري';
        setDeleteDriverError(errMsg);
        showToast(errMsg, 'error');
      }
    } catch (err: any) {
      const errMsg = err?.message || 'حدث خطأ أثناء حذف حساب الدليفري';
      setDeleteDriverError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsDeletingDriver(false);
    }
  };

  // Handle Document Upload / Replace
  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    driverId: string,
    docType: DriverDocumentType
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDocType(docType);
    try {
      const res = await adminService.uploadDriverDocument(driverId, docType, file);
      if (res.success && res.path) {
        showToast('تم رفع المستند وتحديث مساره في سجل السائق بنجاح', 'success');
        // Reload driver data from Supabase and refresh Signed URLs
        const updated = await adminService.getDeliveryDriverDetails(driverId);
        if (updated.driver) {
          setDriverDetails(updated.driver);
          await resolveDriverDocumentsSignedUrls(updated.driver);
        }
        await loadDrivers();
      } else {
        showToast(res.error || 'تعذر رفع المستند', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'حدث خطأ أثناء رفع المستند', 'error');
    } finally {
      setUploadingDocType(null);
      if (e.target) e.target.value = '';
    }
  };

  // Handle Direct Download from bucket "driver-documents"
  const handleDownloadDocument = async (
    storagePath: string,
    fileName: string,
    docTitle: string,
    docType: DriverDocumentType
  ) => {
    setDownloadingDocType(docType);
    try {
      const res = await adminService.downloadDriverDocument(storagePath);
      if (res.success && res.blob) {
        const blobUrl = URL.createObjectURL(res.blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
        showToast(`تم بدء تحميل ${docTitle}`, 'success');
      } else {
        showToast(res.error || 'تعذر تحميل المستند', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'تعذر تحميل المستند', 'error');
    } finally {
      setDownloadingDocType(null);
    }
  };

  // Handle Confirm Delete Document (Does NOT delete driver or change status/is_active)
  const handleConfirmDeleteDoc = async () => {
    if (!docToDelete) return;
    setIsDeletingDoc(true);
    try {
      const res = await adminService.deleteDriverDocument(
        docToDelete.driverId,
        docToDelete.docType
      );
      if (res.success) {
        showToast(`تم حذف ${docToDelete.title} وتفريغ مساره بأمان دون المساس بحساب السائق`, 'success');
        const targetId = docToDelete.driverId;
        setDocToDelete(null);

        // Reload driver data from Supabase and refresh Signed URLs
        const updated = await adminService.getDeliveryDriverDetails(targetId);
        if (updated.driver) {
          setDriverDetails(updated.driver);
          await resolveDriverDocumentsSignedUrls(updated.driver);
        }
        await loadDrivers();
      } else {
        showToast(res.error || 'تعذر حذف المستند', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'حدث خطأ أثناء حذف المستند', 'error');
    } finally {
      setIsDeletingDoc(false);
    }
  };

  // Helper: Open Lightbox Viewer
  const openLightbox = (
    title: string,
    url: string,
    path: string,
    fileName: string,
    driverName: string,
    type: DriverDocumentType
  ) => {
    setLightboxDoc({ title, url, path, fileName, driverName, type });
    setZoomScale(1);
    setRotationDegrees(0);
  };

  // Helper formatting vehicle type
  const formatVehicleType = (type?: string | null) => {
    switch (type) {
      case 'motorcycle':
        return 'دراجة نارية (موتوسيكل)';
      case 'car':
        return 'سيارة';
      case 'bicycle':
        return 'دراجة هوائية';
      case 'tricycle':
        return 'تروسيكل';
      default:
        return type || 'غير محدد';
    }
  };

  // Helper formatting order status
  const formatOrderStatus = (status: string) => {
    switch (status) {
      case 'pending_review':
        return { label: 'قيد المراجعة', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'accepted':
        return { label: 'جاري التوصيل', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
      case 'cancellation_pending':
        return { label: 'بانتظار قرار الإلغاء', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
      case 'cancelled':
        return { label: 'ملغي', color: 'bg-slate-800 text-slate-400 border-slate-700' };
      case 'completed':
        return { label: 'تم التسليم', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      default:
        return { label: status, color: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* ------------------------------------------------------------------- */}
      {/* 1. Header Section */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl shadow-inner">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                إدارة مناديب الدليفري والوثائق
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                مراجعة واعتماد السائقين والتحقق الكامل من المستندات الأربعة (الهوية، رخصة القيادة، رخصة المركبة)
              </p>
            </div>
          </div>
        </div>

        {/* Quick Refresh */}
        <div className="flex items-center space-x-2 space-x-reverse">
          <button
            type="button"
            onClick={loadDrivers}
            disabled={isLoading}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center space-x-2 space-x-reverse cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>تحديث البيانات الحقيقية</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 2. Key Metrics Bar */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Drivers */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex items-center space-x-3 space-x-reverse shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Bike className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 block">إجمالي السائقين</span>
            <span className="text-xl font-black text-white font-mono mt-0.5 block">
              {stats.total_drivers}
            </span>
          </div>
        </div>

        {/* Active Drivers */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex items-center space-x-3 space-x-reverse shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 block">سائقين نشطين</span>
            <div className="flex items-center space-x-1.5 space-x-reverse mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xl font-black text-emerald-400 font-mono">
                {stats.active_drivers}
              </span>
            </div>
          </div>
        </div>

        {/* Inactive / Suspended Drivers */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex items-center space-x-3 space-x-reverse shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 block">غير نشط / معطل</span>
            <span className="text-xl font-black text-rose-400 font-mono mt-0.5 block">
              {stats.inactive_drivers}
            </span>
          </div>
        </div>

        {/* Assigned Orders */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex items-center space-x-3 space-x-reverse shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 block">طلبات تم إسنادها</span>
            <span className="text-xl font-black text-amber-400 font-mono mt-0.5 block">
              {stats.total_assigned_orders}
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 3. Search and Filters Bar */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search by Name, Phone, Email, Governorate, or Center */}
          <div className="md:col-span-3 relative">
            <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="البحث بالاسم، الهاتف، البريد، المحافظة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter by Approval Status */}
          <div className="md:col-span-2">
            <select
              value={approvalFilter}
              onChange={(e) => setApprovalFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors font-medium"
            >
              <option value="all">حالة الاعتماد: الكل</option>
              <option value="pending_approval">⏳ قيد المراجعة</option>
              <option value="approved">🟢 مقبول / معتمد</option>
              <option value="rejected">🔴 مرفوض</option>
            </select>
          </div>

          {/* Filter by Activity Status */}
          <div className="md:col-span-2">
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors font-medium"
            >
              <option value="all">حالة النشاط: الكل</option>
              <option value="active">🟢 نشط</option>
              <option value="inactive">🔴 غير نشط</option>
            </select>
          </div>

          {/* Filter by Governorate */}
          <div className="md:col-span-2">
            <select
              value={governorateFilter}
              onChange={(e) => setGovernorateFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors font-medium"
            >
              <option value="all">المحافظة: الكل</option>
              {availableGovernorates.map((gov) => (
                <option key={gov} value={gov}>
                  {gov}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Uploaded Documents */}
          <div className="md:col-span-2">
            <select
              value={docsFilter}
              onChange={(e) => setDocsFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors font-medium"
            >
              <option value="all">المستندات: الكل</option>
              <option value="complete">✅ مستندات مكتملة (4/4)</option>
              <option value="incomplete">⚠️ مستندات ناقصة (&lt; 4)</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="md:col-span-1">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveFilter('all');
                setVehicleFilter('all');
                setApprovalFilter('all');
                setGovernorateFilter('all');
                setDocsFilter('all');
              }}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-1 space-x-reverse"
              title="إعادة ضبط الفلاتر"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>مسح</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 4. Drivers Table */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin" />
            <span className="text-xs font-medium">جاري تحميل بيانات السائقين والوثائق من Supabase...</span>
          </div>
        ) : drivers.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Bike className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-300">لا يوجد حسابات دليفري مطابقة</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              لم يتم العثور على مناديب توصيل مسجلين وفقاً لمعايير البحث المحددة.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/60 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="p-4">السائق</th>
                  <th className="p-4">الهاتف والبريد</th>
                  <th className="p-4 text-center">المحافظة / المركز</th>
                  <th className="p-4 text-center">المستندات (4)</th>
                  <th className="p-4 text-center">حالة الاعتماد</th>
                  <th className="p-4 text-center">حالة النشاط</th>
                  <th className="p-4 text-center">المركبة</th>
                  <th className="p-4 text-center">الطلبات</th>
                  <th className="p-4 text-center">تاريخ التسجيل</th>
                  <th className="p-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {drivers.map((driver) => {
                  const isPending =
                    driver.status === 'pending_approval' || (!driver.is_active && !driver.status);
                  const isApproved = driver.status === 'approved';
                  const isRejected = driver.status === 'rejected';
                  const docsCount = getDocsCount(driver);

                  return (
                    <tr
                      key={driver.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Name & Avatar */}
                      <td className="p-4">
                        <div className="flex items-center space-x-3 space-x-reverse">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 text-sm shadow-sm shrink-0">
                            {driver.full_name ? driver.full_name.charAt(0) : 'د'}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-white block text-xs group-hover:text-emerald-400 transition-colors truncate max-w-[150px]">
                              {driver.full_name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono block">
                              ID: {driver.id.substring(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Phone & Email */}
                      <td className="p-4 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 font-mono font-bold text-slate-300 dir-ltr text-right">
                            <span>{driver.phone}</span>
                            <button
                              type="button"
                              onClick={(e) => handleCopy(driver.phone, `phone-${driver.id}`, e)}
                              className="text-slate-500 hover:text-slate-300 p-0.5 rounded cursor-pointer"
                              title="نسخ رقم الهاتف"
                            >
                              {copiedKey === `phone-${driver.id}` ? (
                                <CheckCheck className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          {driver.email && (
                            <span className="text-[10px] text-slate-400 truncate block max-w-[160px] font-mono" title={driver.email}>
                              {driver.email}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Governorate & Center */}
                      <td className="p-4 text-center">
                        {driver.governorate_name ? (
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-slate-200 text-xs flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-emerald-400" />
                              {driver.governorate_name}
                            </span>
                            {driver.markaz_name && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                {driver.markaz_name}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">غير محدد</span>
                        )}
                      </td>

                      {/* Uploaded Documents Count & Mini Thumbnails (4 docs) */}
                      <td className="p-4 text-center">
                        <div className="inline-flex flex-col items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(driver)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer transition-colors ${
                              docsCount === 4
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25'
                                : docsCount > 0
                                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                            }`}
                            title="انقر لمراجعة وثائق السائق الأربعة"
                          >
                            <FileCheck className="w-3 h-3" />
                            <span>{docsCount} / 4 مستندات</span>
                          </button>

                          {/* Mini Thumbnails / Indicators for the 4 Documents */}
                          <div className="flex items-center justify-center gap-1">
                            {DRIVER_DOCUMENT_TYPES.map((docMeta) => {
                              const rawDocPath = getDriverDocPath(driver, docMeta);
                              const thumbSrc = resolveDocumentSrc(rawDocPath);
                              if (thumbSrc) {
                                return (
                                  <button
                                    key={docMeta.type}
                                    type="button"
                                    onClick={() =>
                                      openLightbox(
                                        docMeta.title,
                                        thumbSrc,
                                        rawDocPath!,
                                        docMeta.fileName,
                                        driver.full_name,
                                        docMeta.type
                                      )
                                    }
                                    className="w-6 h-6 rounded-md overflow-hidden border border-emerald-500/40 bg-slate-900 hover:scale-110 hover:border-emerald-400 transition-transform cursor-pointer shrink-0"
                                    title={`${docMeta.title} (انقر للتكبير)`}
                                  >
                                    <img
                                      src={thumbSrc}
                                      alt={docMeta.shortLabel}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  </button>
                                );
                              }
                              return (
                                <span
                                  key={docMeta.type}
                                  className="w-6 h-6 rounded-md border border-dashed border-slate-700 bg-slate-900/50 text-slate-600 flex items-center justify-center text-[9px] font-bold"
                                  title={`${docMeta.title}: غير مرفوع`}
                                >
                                  -
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </td>

                      {/* Approval Status */}
                      <td className="p-4 text-center">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400">
                            <Clock className="w-3 h-3" />
                            <span>قيد المراجعة</span>
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>مقبول</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400">
                            <XCircle className="w-3 h-3" />
                            <span>مرفوض</span>
                          </span>
                        )}
                      </td>

                      {/* Active Indicator */}
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => setDriverToToggle(driver)}
                          className={`inline-flex items-center space-x-1.5 space-x-reverse px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                            driver.is_active
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                          }`}
                          title="انقر لتبديل حالة النشاط"
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              driver.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                            }`}
                          />
                          <span>{driver.is_active ? 'نشط' : 'غير نشط'}</span>
                        </button>
                      </td>

                      {/* Vehicle Type */}
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 text-[11px] font-medium inline-block">
                          {formatVehicleType(driver.vehicle_type)}
                        </span>
                      </td>

                      {/* Orders Count */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1 text-[11px] font-mono font-bold">
                          <span className="text-blue-400" title="طلبات جارية">
                            {driver.active_orders_count || 0}
                          </span>
                          <span className="text-slate-600">/</span>
                          <span className="text-emerald-400" title="طلبات مكتملة">
                            {driver.completed_orders_count || 0}
                          </span>
                        </div>
                      </td>

                      {/* Created At */}
                      <td className="p-4 text-center text-[11px] text-slate-400 font-medium">
                        {new Date(driver.created_at).toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5 space-x-reverse">
                          {/* View Details & Documents Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(driver)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                            title="عرض ملف ومستندات السائق"
                          >
                            <Eye className="w-4 h-4 text-blue-400" />
                          </button>

                          {/* Approval / Rejection Quick Actions */}
                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => setDriverToApprove(driver)}
                                className="px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl transition-colors cursor-pointer flex items-center space-x-1 space-x-reverse text-[11px] font-bold"
                                title="اعتماد السائق رسمياً"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>قبول</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDriverToReject(driver)}
                                className="p-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition-colors cursor-pointer"
                                title="رفض طلب السائق"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {isRejected && (
                            <button
                              type="button"
                              onClick={() => setDriverToApprove(driver)}
                              className="px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl transition-colors cursor-pointer flex items-center space-x-1 space-x-reverse text-[11px] font-bold"
                              title="إعادة اعتماد السائق"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>قبول</span>
                            </button>
                          )}

                          {/* Explicit Delete Driver Account Button */}
                          <button
                            type="button"
                            disabled={isDeletingDriver}
                            onClick={() => {
                              if (isDeletingDriver) return;
                              setDeleteDriverError(null);
                              setDriverToDelete(driver);
                            }}
                            className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-rose-400 border border-rose-500/30 rounded-xl transition-colors cursor-pointer flex items-center space-x-1 space-x-reverse text-[11px] font-bold"
                            title="حذف الحساب"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف الحساب</span>
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
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 5. Driver Details & Documents Management Modal */}
      {/* ------------------------------------------------------------------- */}
      {selectedDriverId && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => {
            setSelectedDriverId(null);
            setDriverDetails(null);
            setDriverOrders([]);
          }}
        >
          <div
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-4xl w-full border-t sm:border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 bg-slate-950/50 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 shrink-0">
              <div className="flex items-center space-x-3 space-x-reverse min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner shrink-0">
                  <Bike className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white truncate">
                      ملف الدليفري — {driverDetails?.full_name || 'جاري التحميل...'}
                    </h3>
                    {driverDetails && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          driverDetails.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : driverDetails.status === 'rejected'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {driverDetails.status === 'approved'
                          ? 'مقبول'
                          : driverDetails.status === 'rejected'
                          ? 'مرفوض'
                          : 'قيد المراجعة'}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 block truncate">
                    رقم السائق: <code className="font-mono text-emerald-400">{driverDetails?.id}</code>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedDriverId(null);
                  setDriverDetails(null);
                  setDriverOrders([]);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs text-slate-200 flex-1 overscroll-contain">
              {isLoadingDetails ? (
                <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-400">
                  <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                  <span>جاري جلب تفاصيل السائق والمستندات وسجل الطلبات...</span>
                </div>
              ) : driverDetails ? (
                <>
                  {/* Basic Profile Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Name */}
                    <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block">الاسم الكامل</span>
                      <span className="text-sm font-bold text-white mt-1 block">
                        {driverDetails.full_name}
                      </span>
                    </div>

                    {/* Phone with copy */}
                    <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block">رقم الهاتف</span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-bold text-white font-mono dir-ltr">
                          {driverDetails.phone}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleCopy(driverDetails.phone, 'modal-phone', e)}
                          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer"
                          title="نسخ"
                        >
                          {copiedKey === 'modal-phone' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Email with copy */}
                    <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block">البريد الإلكتروني</span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-medium text-slate-300 font-mono truncate max-w-[170px]" title={driverDetails.email || ''}>
                          {driverDetails.email || 'غير مسجل في الملف الشخصي'}
                        </span>
                        {driverDetails.email && (
                          <button
                            type="button"
                            onClick={(e) => handleCopy(driverDetails.email!, 'modal-email', e)}
                            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer"
                            title="نسخ"
                          >
                            {copiedKey === 'modal-email' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Governorate & Center */}
                    <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block">المحافظة والمركز</span>
                      <span className="text-xs font-bold text-slate-200 mt-1 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        {driverDetails.governorate_name || 'غير محدد'}
                        {driverDetails.markaz_name ? ` - ${driverDetails.markaz_name}` : ''}
                      </span>
                    </div>

                    {/* Detailed Address */}
                    <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block">العنوان</span>
                      <span className="text-xs font-medium text-slate-300 mt-1 block truncate" title={driverDetails.detailed_address || driverDetails.address || ''}>
                        {driverDetails.detailed_address || driverDetails.address || (driverDetails.markaz_name ? `${driverDetails.markaz_name}، ${driverDetails.governorate_name || ''}` : 'غير محدد')}
                      </span>
                    </div>

                    {/* Activity Status */}
                    <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block">حالة النشاط الحالية</span>
                      <div className="mt-1 flex items-center space-x-1.5 space-x-reverse font-bold">
                        {driverDetails.is_active ? (
                          <span className="text-emerald-400 flex items-center space-x-1.5 space-x-reverse">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>نشط (متاح لتلقي الطلبات)</span>
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center space-x-1.5 space-x-reverse">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            <span>غير نشط (متوقف عن العمل)</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Vehicle Type */}
                    <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block">نوع المركبة</span>
                      <span className="text-xs font-bold text-slate-200 mt-1 block">
                        {formatVehicleType(driverDetails.vehicle_type)}
                      </span>
                    </div>

                    {/* Vehicle Plate (if any) */}
                    <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block">رقم اللوحة (إن وجد)</span>
                      <span className="text-xs font-mono font-bold text-slate-300 mt-1 block">
                        {driverDetails.vehicle_plate || 'غير مسجل (الاعتماد على رخصة المركبة)'}
                      </span>
                    </div>

                    {/* Registration Date */}
                    <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block">تاريخ التسجيل</span>
                      <span className="text-xs font-mono font-bold text-slate-300 mt-1 block">
                        {new Date(driverDetails.created_at).toLocaleString('ar-EG')}
                      </span>
                    </div>
                    {/* National ID */}
                    <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block">الرقم القومي</span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-mono font-bold text-slate-200 dir-ltr">
                          {driverDetails.national_id || 'غير مسجل نصياً (راجع صورة الهوية)'}
                        </span>
                        {driverDetails.national_id && (
                          <button
                            type="button"
                            onClick={(e) => handleCopy(driverDetails.national_id!, 'modal-nid', e)}
                            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer"
                            title="نسخ الرقم القومي"
                          >
                            {copiedKey === 'modal-nid' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rejection Reason if present */}
                  {driverDetails.rejection_reason && (
                    <div className="p-3.5 bg-rose-500/10 rounded-xl border border-rose-500/30 space-y-1">
                      <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>سبب الرفض الإداري المسجل في Supabase:</span>
                      </span>
                      <p className="text-xs text-rose-200 leading-relaxed font-medium">
                        {driverDetails.rejection_reason}
                      </p>
                    </div>
                  )}

                  {/* Approved Date if approved */}
                  {driverDetails.approved_at && (
                    <div className="p-3.5 bg-emerald-500/10 rounded-xl border border-emerald-500/30 flex items-center justify-between text-xs">
                      <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تاريخ الاعتماد الإداري:</span>
                      </span>
                      <span className="font-mono text-emerald-300">
                        {new Date(driverDetails.approved_at).toLocaleString('ar-EG')}
                      </span>
                    </div>
                  )}

                  {/* ------------------------------------------------------------- */}
                  {/* مستندات ووثائق السائق (4 بطاقات: Base64 أو driver-documents) */}
                  {/* ------------------------------------------------------------- */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <FileCheck className="w-4 h-4 text-emerald-400" />
                          <span>وثائق ومستندات السائق المرفوعة</span>
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          قراءة وعرض مباشر لوثائق السائق المخزنة في جدول{' '}
                          <span className="font-mono text-slate-300">delivery_drivers</span> (صيغة{' '}
                          <span className="font-mono text-emerald-400">Base64 Data URL</span> أو باكت{' '}
                          <span className="font-mono text-emerald-400">driver-documents</span>)
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => resolveDriverDocumentsSignedUrls(driverDetails)}
                          className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="إعادة فحص وتحديث روابط عرض المستندات"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>تحديث العرض</span>
                        </button>
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                            getDocsCount(driverDetails) === 4
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          }`}
                        >
                          {getDocsCount(driverDetails)} / 4 مستندات متوفرة
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {DRIVER_DOCUMENT_TYPES.map((docMeta) => {
                        const storedPath = getDriverDocPath(driverDetails, docMeta);
                        const isPresent = Boolean(storedPath);
                        const directOrPublicSrc = resolveDocumentSrc(storedPath);
                        const access = docAccess[docMeta.type] || {
                          loading: false,
                          signedUrl: null,
                          fallbackPublicUrl: null,
                          error: null,
                          imageBroken: false,
                        };

                        const resolvedImageSrc = access.signedUrl || directOrPublicSrc;
                        const canDisplayImage =
                          isPresent &&
                          !access.loading &&
                          Boolean(resolvedImageSrc) &&
                          !access.imageBroken;

                        const sourceInfo = formatDocumentSourceInfo(storedPath, docMeta.column);
                        const isCurrentlyUploading = uploadingDocType === docMeta.type;
                        const isCurrentlyDownloading = downloadingDocType === docMeta.type;

                        return (
                          <div
                            key={docMeta.type}
                            className={`p-4 rounded-2xl border transition-all ${
                              isPresent
                                ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                                : 'bg-slate-950/30 border-dashed border-slate-800'
                            }`}
                          >
                            {/* Card Header: Title + Status (موجود / غير موجود) */}
                            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800/80">
                              <div className="min-w-0">
                                <span className="font-bold text-white text-xs block">
                                  {docMeta.title}
                                </span>
                                <span
                                  className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate"
                                  title={sourceInfo.displayPath}
                                >
                                  {sourceInfo.displayPath}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isPresent && (
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-300">
                                    {sourceInfo.badgeText}
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${
                                    isPresent
                                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                      : 'bg-slate-800 border-slate-700 text-slate-400'
                                  }`}
                                >
                                  {isPresent ? 'مرفوع' : 'غير مرفوع'}
                                </span>
                              </div>
                            </div>

                            {/* Preview Area */}
                            <div className="my-3">
                              {!isPresent ? (
                                <div className="aspect-video bg-slate-950/40 rounded-xl border border-dashed border-slate-800/80 flex flex-col items-center justify-center p-4 text-center">
                                  <FileImage className="w-8 h-8 text-slate-600 mb-1.5" />
                                  <span className="text-xs text-slate-400 font-bold">
                                    المستند غير مرفوع
                                  </span>
                                  <span className="text-[10px] text-slate-500 mt-1">
                                    {docMeta.description}
                                  </span>
                                </div>
                              ) : access.loading ? (
                                <div className="aspect-video bg-slate-900/70 rounded-xl border border-slate-800 flex flex-col items-center justify-center p-4 text-center">
                                  <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mb-2" />
                                  <span className="text-xs text-slate-300 font-bold">
                                    جاري تجهيز معاينة المستند...
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono mt-1">
                                    {docMeta.column}
                                  </span>
                                </div>
                              ) : !canDisplayImage ? (
                                <div className="aspect-video bg-rose-950/20 rounded-xl border border-rose-500/30 flex flex-col items-center justify-center p-4 text-center">
                                  <AlertTriangle className="w-7 h-7 text-rose-400 mb-1.5" />
                                  <span className="text-xs font-bold text-rose-300">
                                    تعذر عرض صورة المستند
                                  </span>
                                  <span className="text-[10px] text-slate-400 mt-1 max-w-xs line-clamp-2">
                                    {access.error || 'الرابط أو بيانات الصورة غير صالحة'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => resolveDriverDocumentsSignedUrls(driverDetails)}
                                    className="mt-2 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>إعادة المحاولة</span>
                                  </button>
                                </div>
                              ) : (
                                <div
                                  onClick={() =>
                                    openLightbox(
                                      docMeta.title,
                                      resolvedImageSrc!,
                                      storedPath!,
                                      docMeta.fileName,
                                      driverDetails.full_name,
                                      docMeta.type
                                    )
                                  }
                                  className="relative group/img aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center cursor-pointer"
                                >
                                  <img
                                    src={resolvedImageSrc!}
                                    alt={docMeta.title}
                                    className="w-full h-full object-contain bg-slate-950 transition-transform duration-200 group-hover/img:scale-105"
                                    onError={() => {
                                      setDocAccess((prev) => {
                                        const curr = prev[docMeta.type];
                                        // If signedUrl failed and we have a different fallbackPublicUrl, try fallbackPublicUrl first
                                        if (
                                          curr?.fallbackPublicUrl &&
                                          curr.signedUrl !== curr.fallbackPublicUrl
                                        ) {
                                          return {
                                            ...prev,
                                            [docMeta.type]: {
                                              ...curr,
                                              signedUrl: curr.fallbackPublicUrl,
                                              error: null,
                                              imageBroken: false,
                                            },
                                          };
                                        }
                                        return {
                                          ...prev,
                                          [docMeta.type]: {
                                            ...curr,
                                            signedUrl: null,
                                            error: 'تعذر تحميل المستند',
                                            imageBroken: true,
                                          },
                                        };
                                      });
                                    }}
                                  />
                                  {/* Hover Overlay with Full-size Button */}
                                  <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openLightbox(
                                          docMeta.title,
                                          resolvedImageSrc!,
                                          storedPath!,
                                          docMeta.fileName,
                                          driverDetails.full_name,
                                          docMeta.type
                                        );
                                      }}
                                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg transition-transform hover:scale-105 cursor-pointer flex items-center gap-1.5"
                                      title="فتح الصورة بالحجم الكامل"
                                    >
                                      <Maximize2 className="w-4 h-4" />
                                      <span>فتح وتكبير المستند</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Hidden file input for upload / replace */}
                            <input
                              type="file"
                              accept="image/webp,image/jpeg,image/png"
                              ref={(el) => (fileInputRefs.current[docMeta.type] = el)}
                              className="hidden"
                              onChange={(e) => handleFileChange(e, driverDetails.id, docMeta.type)}
                            />

                            {/* Card Action Buttons */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-800/80">
                              {isPresent ? (
                                <>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {/* فتح الصورة بالحجم الكامل */}
                                    <button
                                      type="button"
                                      disabled={!canDisplayImage}
                                      onClick={() => {
                                        if (canDisplayImage && resolvedImageSrc && storedPath) {
                                          openLightbox(
                                            docMeta.title,
                                            resolvedImageSrc,
                                            storedPath,
                                            docMeta.fileName,
                                            driverDetails.full_name,
                                            docMeta.type
                                          );
                                        } else {
                                          showToast('تعذر تحميل المستند لعرضه بالحجم الكامل', 'error');
                                        }
                                      }}
                                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                                      title="فتح الصورة بالحجم الكامل"
                                    >
                                      <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>تكبير المستند</span>
                                    </button>

                                    {/* تحميل الصورة */}
                                    <button
                                      type="button"
                                      disabled={isCurrentlyDownloading || !storedPath}
                                      onClick={() =>
                                        storedPath &&
                                        handleDownloadDocument(
                                          storedPath,
                                          docMeta.fileName,
                                          docMeta.title,
                                          docMeta.type
                                        )
                                      }
                                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                      title="تحميل الصورة"
                                    >
                                      {isCurrentlyDownloading ? (
                                        <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                                      ) : (
                                        <Download className="w-3.5 h-3.5 text-blue-400" />
                                      )}
                                      <span>تحميل الصورة</span>
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    {/* استبدال الصورة */}
                                    <button
                                      type="button"
                                      disabled={isCurrentlyUploading}
                                      onClick={() => fileInputRefs.current[docMeta.type]?.click()}
                                      className="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                      title="استبدال الصورة"
                                    >
                                      {isCurrentlyUploading ? (
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Upload className="w-3.5 h-3.5" />
                                      )}
                                      <span>{isCurrentlyUploading ? 'جاري الرفع...' : 'استبدال'}</span>
                                    </button>

                                    {/* حذف الصورة */}
                                    <button
                                      type="button"
                                      disabled={isCurrentlyUploading || isDeletingDoc}
                                      onClick={() =>
                                        storedPath &&
                                        setDocToDelete({
                                          driverId: driverDetails.id,
                                          docType: docMeta.type,
                                          title: docMeta.title,
                                          path: storedPath,
                                        })
                                      }
                                      className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                                      title="حذف الصورة"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>حذف</span>
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isCurrentlyUploading}
                                  onClick={() => fileInputRefs.current[docMeta.type]?.click()}
                                  className="w-full py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                                >
                                  {isCurrentlyUploading ? (
                                    <>
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      <span>جاري رفع المستند...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-3.5 h-3.5" />
                                      <span>رفع {docMeta.title}</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Driver Orders Statistics Breakdown */}
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold text-slate-300">إحصائيات الطلبات المرتبطة بهذا السائق</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center">
                        <span className="text-[10px] text-blue-300 block font-bold">طلبات جارية الآن</span>
                        <span className="text-lg font-black text-blue-400 font-mono mt-0.5 block">
                          {driverDetails.active_orders_count || 0}
                        </span>
                      </div>
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                        <span className="text-[10px] text-emerald-300 block font-bold">طلبات مكتملة بنجاح</span>
                        <span className="text-lg font-black text-emerald-400 font-mono mt-0.5 block">
                          {driverDetails.completed_orders_count || 0}
                        </span>
                      </div>
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
                        <span className="text-[10px] text-rose-300 block font-bold">طلبات ملغاة / مرفوضة</span>
                        <span className="text-lg font-black text-rose-400 font-mono mt-0.5 block">
                          {driverDetails.cancelled_orders_count || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Orders History Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-300">
                        سجل الطلبات المسندة ({driverOrders.length})
                      </h4>
                      <span className="text-[10px] text-slate-500">مصدر البيانات: delivery_orders</span>
                    </div>

                    {driverOrders.length === 0 ? (
                      <div className="p-6 bg-slate-950/60 rounded-xl border border-slate-800 text-center text-slate-500 text-xs">
                        لا توجد طلبات مسندة لهذا السائق حتى الآن.
                      </div>
                    ) : (
                      <div className="border border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                        <table className="w-full text-right border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-slate-950 border-b border-slate-800 text-slate-400">
                              <th className="p-2.5">رقم الطلب</th>
                              <th className="p-2.5">العميل</th>
                              <th className="p-2.5">العنوان</th>
                              <th className="p-2.5 text-center">الحالة</th>
                              <th className="p-2.5 text-center">المبلغ الإجمالي</th>
                              <th className="p-2.5 text-center">التاريخ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {driverOrders.map((ord) => {
                              const st = formatOrderStatus(ord.status);
                              return (
                                <tr key={ord.id} className="hover:bg-slate-800/30">
                                  <td className="p-2.5 font-mono text-slate-300 font-bold">
                                    {ord.order_number || ord.id.substring(0, 8)}
                                  </td>
                                  <td className="p-2.5">
                                    <span className="font-bold text-white block">{ord.customer_name}</span>
                                    <span className="text-[10px] text-slate-500 font-mono dir-ltr text-right block">
                                      {ord.customer_phone}
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-slate-300 max-w-[150px] truncate">
                                    {ord.detailed_address || `${ord.governorate_name || ''} ${ord.markaz_name || ''}`}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${st.color}`}>
                                      {st.label}
                                    </span>
                                    {ord.cancellation_reason && (
                                      <span
                                        className="text-[9px] text-rose-400 block mt-0.5 truncate max-w-[120px]"
                                        title={ord.cancellation_reason}
                                      >
                                        السبب: {ord.cancellation_reason}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-center font-mono font-bold text-emerald-400">
                                    {ord.total_amount} ج.م
                                  </td>
                                  <td className="p-2.5 text-center text-slate-500 font-mono">
                                    {new Date(ord.created_at).toLocaleDateString('ar-EG')}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/95 backdrop-blur flex items-center justify-between flex-wrap gap-2 shrink-0 sticky bottom-0 z-10">
              <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-2">
                {driverDetails && (
                  <>
                    {/* Approve / Accept Button */}
                    {driverDetails.status !== 'approved' && (
                      <button
                        type="button"
                        onClick={() => setDriverToApprove(driverDetails)}
                        className="px-3 py-2 rounded-xl text-xs font-bold border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 transition-colors cursor-pointer flex items-center space-x-1.5 space-x-reverse shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>اعتماد وقبول السائق</span>
                      </button>
                    )}

                    {/* Reject Button */}
                    {driverDetails.status !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() => setDriverToReject(driverDetails)}
                        className="px-3 py-2 rounded-xl text-xs font-bold border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 transition-colors cursor-pointer flex items-center space-x-1.5 space-x-reverse shadow-sm"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>رفض طلب السائق</span>
                      </button>
                    )}

                    {/* Active Toggle Button */}
                    <button
                      type="button"
                      onClick={() => setDriverToToggle(driverDetails)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center space-x-1.5 space-x-reverse ${
                        driverDetails.is_active
                          ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{driverDetails.is_active ? 'إيقاف نشاط السائق' : 'تفعيل نشاط السائق'}</span>
                    </button>

                    {/* Delete Driver Account Button */}
                    <button
                      type="button"
                      disabled={isDeletingDriver}
                      onClick={() => {
                        if (isDeletingDriver) return;
                        setDeleteDriverError(null);
                        setDriverToDelete(driverDetails);
                      }}
                      className="px-3 py-2 rounded-xl text-xs font-bold border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-50 disabled:cursor-not-allowed text-rose-400 transition-colors cursor-pointer flex items-center space-x-1.5 space-x-reverse shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف الحساب</span>
                    </button>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedDriverId(null);
                  setDriverDetails(null);
                  setDriverOrders([]);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 6. Document Lightbox (Viewer / Zoom / Rotate / Fullscreen) */}
      {/* ------------------------------------------------------------------- */}
      {lightboxDoc && (
        <div
          className="fixed inset-0 z-60 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setLightboxDoc(null)}
        >
          <div
            className="relative w-full max-w-5xl h-[92vh] sm:h-[88vh] bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 bg-slate-950/70 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            {/* Lightbox Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <FileImage className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{lightboxDoc.title}</h3>
                  <span className="text-[11px] text-slate-400 block truncate">
                    السائق: {lightboxDoc.driverName} •{' '}
                    <span className="font-mono">
                      {formatDocumentSourceInfo(lightboxDoc.path, lightboxDoc.type).displayPath}
                    </span>
                  </span>
                </div>
              </div>

              {/* Quick Switch Between Driver's 4 Documents (if driverDetails is open) */}
              {driverDetails && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {DRIVER_DOCUMENT_TYPES.map((meta) => {
                    const p = getDriverDocPath(driverDetails, meta);
                    const url = docAccess[meta.type]?.signedUrl || resolveDocumentSrc(p);
                    const isActiveTab = lightboxDoc.type === meta.type;
                    return (
                      <button
                        key={meta.type}
                        type="button"
                        disabled={!url || !p}
                        onClick={() => {
                          if (url && p) {
                            openLightbox(
                              meta.title,
                              url,
                              p,
                              meta.fileName,
                              driverDetails.full_name,
                              meta.type
                            );
                          }
                        }}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                          isActiveTab
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {meta.shortLabel}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.min(z + 0.25, 3))}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors cursor-pointer"
                  title="تكبير"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.max(z - 0.25, 0.5))}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors cursor-pointer"
                  title="تصغير"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoomScale(1);
                    setRotationDegrees(0);
                  }}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="إعادة ضبط الحجم"
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() => setRotationDegrees((r) => (r + 90) % 360)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors cursor-pointer"
                  title="تدوير 90 درجة"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadDocument(
                      lightboxDoc.path,
                      lightboxDoc.fileName,
                      lightboxDoc.title,
                      lightboxDoc.type
                    )
                  }
                  className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors cursor-pointer"
                  title="تحميل الصورة"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxDoc(null)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lightbox Image Stage */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/90 select-none overscroll-contain">
              <div
                className="transition-transform duration-150 origin-center"
                style={{
                  transform: `scale(${zoomScale}) rotate(${rotationDegrees}deg)`,
                }}
              >
                <img
                  src={lightboxDoc.url}
                  alt={lightboxDoc.title}
                  className="max-h-[70vh] max-w-[85vw] object-contain rounded-xl shadow-2xl"
                />
              </div>
            </div>

            {/* Lightbox Footer Bar */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/95 backdrop-blur text-center text-xs text-slate-400 flex items-center justify-between px-6 shrink-0 sticky bottom-0 z-10">
              <span>نسبة التكبير: {Math.round(zoomScale * 100)}% • التدوير: {rotationDegrees}°</span>
              <button
                type="button"
                onClick={() =>
                  handleDownloadDocument(
                    lightboxDoc.path,
                    lightboxDoc.fileName,
                    lightboxDoc.title,
                    lightboxDoc.type
                  )
                }
                className="text-emerald-400 hover:underline flex items-center gap-1 font-bold text-xs cursor-pointer"
              >
                <span>تحميل الصورة الأصلية ({lightboxDoc.fileName})</span>
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 7. Delete Document Confirmation Modal (Safe, driver intact) */}
      {/* ------------------------------------------------------------------- */}
      {docToDelete && (
        <div
          className="fixed inset-0 z-60 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => !isDeletingDoc && setDocToDelete(null)}
        >
          <div
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full border-t sm:border border-slate-800 shadow-2xl text-right text-white flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border bg-rose-500/10 text-rose-400 border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="text-base font-bold text-white">تأكيد حذف المستند</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  هل أنت متأكد من رغبتك في حذف <strong className="text-rose-400">{docToDelete.title}</strong>؟
                </p>
                <p className="text-[10px] font-mono text-slate-400 bg-slate-950/70 p-2 rounded-lg border border-slate-800 break-all">
                  {formatDocumentSourceInfo(docToDelete.path, docToDelete.docType).displayPath}
                </p>
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30 text-[11px] text-emerald-300 text-right space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>ضمان سلامة الحساب وحالة الاعتماد:</span>
                  </div>
                  <p>
                    سيتم تفريغ العمود المقابل في <span className="font-mono">delivery_drivers</span> فقط، دون حذف سجل السائق أو تغيير حالة اعتماده (<span className="font-mono">status</span>) أو نشاطه (<span className="font-mono">is_active</span>).
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 space-x-reverse p-4 border-t border-slate-800 bg-slate-950/95 backdrop-blur shrink-0 sticky bottom-0 z-10">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                disabled={isDeletingDoc}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDoc}
                disabled={isDeletingDoc}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5 space-x-reverse"
              >
                {isDeletingDoc ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <span>تأكيد الحذف</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 8. Approve Driver Confirmation Modal (admin_approve_driver) */}
      {/* ------------------------------------------------------------------- */}
      {driverToApprove && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => !isApproving && setDriverToApprove(null)}
        >
          <div
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full border-t sm:border border-slate-800 shadow-2xl text-right text-white flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="text-base font-bold text-white">اعتماد وقبول حساب السائق</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  هل أنت متأكد من اعتماد وقبول السائق <strong className="text-white">{driverToApprove.full_name}</strong>؟
                </p>
                <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 text-right">
                  ℹ️ يتم استدعاء الدالة الرسمية <code className="font-mono text-emerald-400">admin_approve_driver</code> في Supabase لتفعيل وتوثيق حساب السائق بعد مراجعة المستندات.
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 space-x-reverse p-4 border-t border-slate-800 bg-slate-950/95 backdrop-blur shrink-0 sticky bottom-0 z-10">
              <button
                type="button"
                onClick={() => setDriverToApprove(null)}
                disabled={isApproving}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={isApproving}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/30 cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5 space-x-reverse"
              >
                {isApproving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الاعتماد...</span>
                  </>
                ) : (
                  <span>تأكيد الاعتماد والقبول</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 9. Reject Driver Confirmation Modal (admin_reject_driver) */}
      {/* ------------------------------------------------------------------- */}
      {driverToReject && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => !isRejecting && setDriverToReject(null)}
        >
          <div
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full border-t sm:border border-slate-800 shadow-2xl text-right text-white flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border bg-rose-500/10 text-rose-400 border-rose-500/20">
                <XCircle className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="text-base font-bold text-white">رفض طلب السائق</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  هل أنت متأكد من رفض طلب السائق <strong className="text-white">{driverToReject.full_name}</strong>؟
                </p>
              </div>

              <div className="space-y-1.5 text-right">
                <label className="text-xs font-semibold text-slate-300 block">سبب الرفض (اختياري - يُحفظ كمسودة عند الإغلاق)</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="مثال: رخصة القيادة منتهية أو صورة بطاقة الرقم القومي غير واضحة..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 resize-none"
                />
                <div className="p-2 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                  ℹ️ يتم استدعاء دالة <code className="font-mono text-rose-400">admin_reject_driver</code> في Supabase لتسجيل سبب الرفض وحفظه في السجل.
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 space-x-reverse p-4 border-t border-slate-800 bg-slate-950/95 backdrop-blur shrink-0 sticky bottom-0 z-10">
              <button
                type="button"
                onClick={() => setDriverToReject(null)}
                disabled={isRejecting}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isRejecting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5 space-x-reverse"
              >
                {isRejecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الرفض...</span>
                  </>
                ) : (
                  <span>تأكيد الرفض</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 10. Toggle Activity Confirmation Modal (admin_toggle_driver_active) */}
      {/* ------------------------------------------------------------------- */}
      {driverToToggle && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => !isToggling && setDriverToToggle(null)}
        >
          <div
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full border-t sm:border border-slate-800 shadow-2xl text-right text-white flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border ${
                  driverToToggle.is_active
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}
              >
                <Power className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="text-base font-bold text-white">
                  {driverToToggle.is_active ? 'تعطيل / إيقاف نشاط السائق' : 'تفعيل نشاط السائق'}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  هل تريد بالتاكيد{' '}
                  {driverToToggle.is_active ? 'إيقاف حساب السائق' : 'تفعيل حساب السائق'}{' '}
                  <strong className="text-white">{driverToToggle.full_name}</strong>؟
                </p>
                <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 text-right">
                  ℹ️ يتم استدعاء دالة <code className="font-mono text-emerald-400">admin_toggle_driver_active</code> في Supabase لتحديث حالة النشاط والتحقق الفعلي من الحفظ.
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 space-x-reverse p-4 border-t border-slate-800 bg-slate-950/95 backdrop-blur shrink-0 sticky bottom-0 z-10">
              <button
                type="button"
                onClick={() => setDriverToToggle(null)}
                disabled={isToggling}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleActive}
                disabled={isToggling}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5 space-x-reverse ${
                  driverToToggle.is_active
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                }`}
              >
                {isToggling ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري التحديث...</span>
                  </>
                ) : (
                  <span>{driverToToggle.is_active ? 'تأكيد الإيقاف' : 'تأكيد التفعيل'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 11. Delete Delivery Driver Account Confirmation Modal               */}
      {/* ------------------------------------------------------------------- */}
      {driverToDelete && (
        <div
          className="fixed inset-0 z-60 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => {
            if (!isDeletingDriver) {
              setDriverToDelete(null);
              setDeleteDriverError(null);
            }
          }}
        >
          <div
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full border-t sm:border border-rose-500/30 shadow-2xl text-right text-white flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border bg-rose-500/10 text-rose-400 border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-base font-bold text-white">حذف حساب الدليفري</h3>
                <p className="text-xs font-bold text-slate-200">
                  هل أنت متأكد من حذف هذا الحساب؟
                </p>

                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-0.5">
                  <div className="font-bold text-white">{driverToDelete.full_name}</div>
                  <div className="text-[11px] font-mono text-slate-400 dir-ltr">{driverToDelete.phone}</div>
                  {driverToDelete.email && (
                    <div className="text-[11px] font-mono text-slate-400">{driverToDelete.email}</div>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-right">
                  سيتم حذف حساب الدليفري وبيانات الحساب والمستندات الخاصة به،
                  <br />
                  لكن لن يتم حذف الطلبات السابقة أو السجلات التاريخية المرتبطة به.
                </p>

                <p className="text-xs font-bold text-rose-400">
                  هذا الإجراء لا يمكن التراجع عنه.
                </p>
              </div>

              {(driverToDelete.active_orders_count || 0) > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2 text-right">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    تنبيه: لدى هذا السائق حالياً ({driverToDelete.active_orders_count}) طلب نشط قيد التوصيل أو المراجعة. لا يمكن حذف الحساب قبل إتمام أو إلغاء الطلبات النشطة أولاً.
                  </span>
                </div>
              )}

              {deleteDriverError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2 text-right">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{deleteDriverError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-3 space-x-reverse p-4 border-t border-slate-800 bg-slate-950/95 backdrop-blur shrink-0 sticky bottom-0 z-10">
              <button
                type="button"
                onClick={() => {
                  setDriverToDelete(null);
                  setDeleteDriverError(null);
                }}
                disabled={isDeletingDriver}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDriver}
                disabled={isDeletingDriver || (driverToDelete.active_orders_count || 0) > 0}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5 space-x-reverse"
              >
                {isDeletingDriver ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف الحساب</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
