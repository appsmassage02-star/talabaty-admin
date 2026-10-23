import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../context/AdminContext';
import { adminService } from '../services/adminService';
import { supabase } from '../../lib/supabase';
import {
  DeliveryOrder,
  DeliveryOrderItem,
  DeliveryOrderStatusHistory,
  DeliveryOrdersStatsSummary,
  DeliveryDriver,
  DeliveryOrderStatus,
} from '../types';
import {
  PackageCheck,
  Search,
  Filter,
  RefreshCw,
  Eye,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Phone,
  User,
  Bike,
  Building,
  Calendar,
  FileText,
  ShieldCheck,
  X,
  Check,
  Copy,
  CheckCheck,
  AlertCircle,
  ShoppingBag,
  Info,
  Ban,
  Sparkles,
  HeartPulse,
  Layers,
} from 'lucide-react';

export const AdminDeliveryOrders: React.FC = () => {
  const { hasPermission, showToast, adminUser, sectionFilter, clearSectionFilter } = useAdmin();
  const canManage = hasPermission('delivery.manage');

  // Orders & Stats State
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [stats, setStats] = useState<DeliveryOrdersStatsSummary>({
    total: 0,
    pending_review: 0,
    accepted: 0,
    cancellation_pending: 0,
    completed: 0,
    cancelled: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters State
  const [sourceFilter, setSourceFilter] = useState<'all' | 'delivery' | 'pharmacy'>('all');
  const [activeTab, setActiveTab] = useState<string>(() => sectionFilter?.statusTab || 'all');
  const [searchQuery, setSearchQuery] = useState<string>(() => sectionFilter?.search || '');
  const [governorateFilter, setGovernorateFilter] = useState('all');
  const [markazFilter, setMarkazFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState<string>(() => sectionFilter?.driverId || 'all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [pendingOpenOrderId, setPendingOpenOrderId] = useState<string | null>(
    () => sectionFilter?.openOrderId || null
  );

  useEffect(() => {
    if (!sectionFilter) return;
    if (sectionFilter.statusTab !== undefined) {
      setActiveTab(sectionFilter.statusTab);
    }
    if (sectionFilter.driverId !== undefined) {
      setDriverFilter(sectionFilter.driverId);
    }
    if (sectionFilter.search !== undefined) {
      setSearchQuery(sectionFilter.search);
    }
    if (sectionFilter.openOrderId) {
      setPendingOpenOrderId(String(sectionFilter.openOrderId));
    }
    clearSectionFilter();
  }, [sectionFilter, clearSectionFilter]);

  // Dropdowns data (Real DB)
  const [driversList, setDriversList] = useState<
    Array<{ id: string; full_name: string; phone: string; is_active: boolean }>
  >([]);
  const [locationOptions, setLocationOptions] = useState<{
    governorates: string[];
    markazes: string[];
  }>({ governorates: [], markazes: [] });

  // Selected Order for Details Modal
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<DeliveryOrder | null>(null);
  const [orderItems, setOrderItems] = useState<DeliveryOrderItem[]>([]);
  const [orderHistory, setOrderHistory] = useState<DeliveryOrderStatusHistory[]>([]);
  const [assignedDriver, setAssignedDriver] = useState<DeliveryDriver | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Decision Modal State for Cancellation (cancellation_pending)
  const [cancellationAction, setCancellationAction] = useState<{
    order: DeliveryOrder;
    approve: boolean; // true = approve cancellation (cancelled), false = reject cancellation (accepted)
  } | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  // Direct Admin Order Cancellation State (any active order)
  const [orderToDirectCancel, setOrderToDirectCancel] = useState<DeliveryOrder | null>(null);
  const [directCancelReason, setDirectCancelReason] = useState('');
  const [isDirectCancelling, setIsDirectCancelling] = useState(false);

  // Copy Phone Helper
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const handleCopyPhone = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  // Load Dropdown Options (Drivers and Locations)
  useEffect(() => {
    const fetchOptions = async () => {
      const [drivers, locs] = await Promise.all([
        adminService.getDeliveryDriversList(),
        adminService.getDeliveryLocations(),
      ]);
      setDriversList(drivers);
      setLocationOptions(locs);
    };
    fetchOptions();
  }, []);

  // Fetch Orders
  const loadOrders = useCallback(
    async (showLoadingSpinner = true) => {
      if (showLoadingSpinner) setIsLoading(true);
      setIsRefreshing(true);
      try {
        const res = await adminService.getDeliveryOrders({
          statusTab: activeTab,
          source: sourceFilter,
          search: searchQuery,
          governorate: governorateFilter,
          markaz: markazFilter,
          driverId: driverFilter,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          limit: 100,
        });

        if (res.error) {
          showToast(res.error, 'error');
        } else {
          setOrders(res.orders);
          setStats(res.stats);
        }
      } catch (err: any) {
        console.error('Failed to load orders:', err);
        showToast('تعذر تحميل طلبات الدليفري', 'error');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      activeTab,
      sourceFilter,
      searchQuery,
      governorateFilter,
      markazFilter,
      driverFilter,
      dateFrom,
      dateTo,
      showToast,
    ]
  );

  useEffect(() => {
    loadOrders(true);
  }, [loadOrders]);

  // Realtime Subscription on delivery_orders table
  useEffect(() => {
    if (!supabase) return;

    try {
      const channel = supabase
        .channel('admin_delivery_orders_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'delivery_orders' },
          () => {
            // Live update: silently refresh orders & stats without showing big spinner
            loadOrders(false);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn('Realtime subscription on delivery_orders not available:', err);
    }
  }, [loadOrders]);

  // Open Details Modal
  const handleOpenDetails = async (orderId: string) => {
    setSelectedOrderId(orderId);
    setIsLoadingDetails(true);
    try {
      const res = await adminService.getDeliveryOrderDetails(orderId);
      if (res.error) {
        showToast(res.error, 'error');
      } else {
        setOrderDetails(res.order);
        setOrderItems(res.items);
        setOrderHistory(res.history);
        setAssignedDriver(res.driver);
      }
    } catch (err: any) {
      showToast('تعذر تحميل تفاصيل الطلب', 'error');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (pendingOpenOrderId) {
      const idToOpen = pendingOpenOrderId;
      setPendingOpenOrderId(null);
      handleOpenDetails(idToOpen);
    }
  }, [pendingOpenOrderId]);

  // Close Details Modal
  const handleCloseDetails = () => {
    setSelectedOrderId(null);
    setOrderDetails(null);
    setOrderItems([]);
    setOrderHistory([]);
    setAssignedDriver(null);
  };

  // Handle Cancellation Decision via secured RPC
  const handleSubmitDecision = async () => {
    if (!cancellationAction) return;
    if (!canManage) {
      showToast('عفواً، لا تملك صلاحية delivery.manage لتنفيذ هذا الإجراء الإداري', 'error');
      return;
    }

    setIsSubmittingDecision(true);
    try {
      const res = await adminService.decideCancellation(
        cancellationAction.order.id,
        cancellationAction.approve,
        decisionNote.trim() || undefined
      );

      if (res.success) {
        const actionText = cancellationAction.approve
          ? 'تمت الموافقة على إلغاء الطلب بنجاح وتحويل حالته إلى "ملغى"'
          : 'تم رفض طلب الإلغاء وإعادة الطلب إلى السائق بحالة "جاري التوصيل"';
        showToast(actionText, 'success');

        // Close decision prompt
        setCancellationAction(null);
        setDecisionNote('');

        // Refresh current modal details if open
        if (selectedOrderId === cancellationAction.order.id) {
          handleOpenDetails(cancellationAction.order.id);
        }

        // Refresh orders list and badge counters
        loadOrders(false);
      } else {
        showToast(res.error || 'تعذر تنفيذ قرار الإلغاء', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'حدث خطأ أثناء معالجة القرار', 'error');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Handle Direct Admin Order Cancellation
  const handleConfirmDirectCancel = async () => {
    if (!orderToDirectCancel) return;
    if (!canManage) {
      showToast('عفواً، لا تملك صلاحية delivery.manage لإلغاء الطلب', 'error');
      return;
    }
    if (!directCancelReason.trim()) {
      showToast('يرجى كتابة سبب الإلغاء لتوثيقه في السجل', 'error');
      return;
    }

    setIsDirectCancelling(true);
    try {
      const res = await adminService.adminCancelOrder(
        orderToDirectCancel.id,
        directCancelReason.trim(),
        adminUser?.email
      );

      if (res.success) {
        showToast('تم إلغاء الطلب بنجاح وتوثيقه في سجل حركات الطلب في Supabase', 'success');
        const cancelledId = orderToDirectCancel.id;
        setOrderToDirectCancel(null);
        setDirectCancelReason('');

        // Refresh modal details if open
        if (selectedOrderId === cancelledId) {
          handleOpenDetails(cancelledId);
        }
        // Refresh orders list and badge counters
        loadOrders(false);
      } else {
        showToast(res.error || 'تعذر إلغاء الطلب عبر Supabase', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'حدث خطأ أثناء إلغاء الطلب', 'error');
    } finally {
      setIsDirectCancelling(false);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setGovernorateFilter('all');
    setMarkazFilter('all');
    setDriverFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  // Helper for Status Badge & Labels
  const getStatusMeta = (status: DeliveryOrderStatus | string) => {
    switch (status) {
      case 'pending_review':
        return {
          label: 'جديد / قيد المراجعة',
          dotColor: 'bg-blue-500',
          badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
          icon: Clock,
        };
      case 'accepted':
        return {
          label: 'جاري التوصيل',
          dotColor: 'bg-indigo-500',
          badgeBg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          icon: Bike,
        };
      case 'cancellation_pending':
        return {
          label: 'مطلوب إلغاؤه',
          dotColor: 'bg-amber-500 animate-pulse',
          badgeBg: 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-400/30',
          icon: AlertTriangle,
        };
      case 'completed':
        return {
          label: 'مكتمل / تم التسليم',
          dotColor: 'bg-emerald-500',
          badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: CheckCircle2,
        };
      case 'cancelled':
        return {
          label: 'ملغى',
          dotColor: 'bg-rose-500',
          badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
          icon: XCircle,
        };
      default:
        return {
          label: status,
          dotColor: 'bg-slate-400',
          badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: Info,
        };
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('ar-EG', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      }).format(d);
    } catch {
      return isoString;
    }
  };

  const formatCurrency = (num?: number | null) => {
    if (num === null || num === undefined) return '0.00 ج.م';
    return `${Number(num).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
  };

  return (
    <div id="admin-delivery-orders-page" className="space-y-6">
      {/* ---------------------------------------------------------------------
          Page Header
      --------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shadow-xs">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">طلبات الدليفري</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  مزامنة لحظية نشطة
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                متابعة دورة حياة الطلبات المباشرة، فحص المنتجات، والبت الآمن في طلبات الإلغاء
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => loadOrders(false)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors disabled:opacity-60 cursor-pointer"
            title="تحديث البيانات من السيرفر"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------
          Section Source Selector (كل الأقسام | دليفري البقالة | قسم الصيدلية)
      --------------------------------------------------------------------- */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-600 ml-1">تصفية حسب القسم:</span>
          {[
            { id: 'all', label: 'كل الأقسام والطلبات', icon: Layers },
            { id: 'delivery', label: 'طلبات البقالة والدليفري', icon: ShoppingBag },
            { id: 'pharmacy', label: 'طلبات قسم الصيدلية والروشتات 🏥', icon: HeartPulse },
          ].map((item) => {
            const isSelected = sourceFilter === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSourceFilter(item.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? item.id === 'pharmacy'
                      ? 'bg-teal-600 text-white shadow-sm ring-1 ring-teal-500'
                      : 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        <div className="text-xs text-slate-500 font-medium">
          {sourceFilter === 'pharmacy' ? (
            <span className="text-teal-700 font-bold bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
              يتم عرض طلبات قسم الصيدلية والروشتات الطبية فقط
            </span>
          ) : sourceFilter === 'delivery' ? (
            <span className="text-indigo-700 font-bold bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
              يتم عرض طلبات دليفري البقالة والسوبرماركت فقط
            </span>
          ) : (
            <span className="text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              عرض موحد لطلبات البقالة وقسم الصيدلية
            </span>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------------
          KPI Summary Cards
      --------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">إجمالي الطلبات</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2">
            {stats.total.toLocaleString('ar-EG')}
          </div>
          <span className="text-[11px] text-slate-400">جميع الحالات</span>
        </div>

        {/* Pending Review (New) */}
        <div className="bg-white p-4 rounded-xl border border-blue-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-700">طلبات جديدة</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-blue-900 mt-2">
            {stats.pending_review.toLocaleString('ar-EG')}
          </div>
          <span className="text-[11px] text-blue-500">بانتظار الإسناد</span>
        </div>

        {/* Accepted (In Delivery) */}
        <div className="bg-white p-4 rounded-xl border border-indigo-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-700">جاري التوصيل</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Bike className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-indigo-900 mt-2">
            {stats.accepted.toLocaleString('ar-EG')}
          </div>
          <span className="text-[11px] text-indigo-500">مع سائق الدليفري</span>
        </div>

        {/* Cancellation Pending (Requires Admin Action) */}
        <div
          className={`p-4 rounded-xl border shadow-xs transition-all ${
            stats.cancellation_pending > 0
              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20'
              : 'bg-white border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800">طلبات الإلغاء</span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-900 mt-2 flex items-center gap-1.5">
            {stats.cancellation_pending.toLocaleString('ar-EG')}
            {stats.cancellation_pending > 0 && (
              <span className="text-[10px] bg-amber-600 text-white font-semibold px-1.5 py-0.5 rounded-full">
                مطلوب البت
              </span>
            )}
          </div>
          <span className="text-[11px] text-amber-600">بانتظار قرار الإدارة</span>
        </div>

        {/* Completed */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700">مكتملة</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-900 mt-2">
            {stats.completed.toLocaleString('ar-EG')}
          </div>
          <span className="text-[11px] text-emerald-500">تم التسليم بنجاح</span>
        </div>

        {/* Cancelled */}
        <div className="bg-white p-4 rounded-xl border border-rose-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-700">ملغاة</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-rose-900 mt-2">
            {stats.cancelled.toLocaleString('ar-EG')}
          </div>
          <span className="text-[11px] text-rose-500">تم إلغاؤها</span>
        </div>
      </div>

      {/* ---------------------------------------------------------------------
          Status Tabs (Main Navigation between Order Statuses)
      --------------------------------------------------------------------- */}
      <div className="border-b border-slate-200 bg-white rounded-t-2xl px-4 pt-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'الكل', count: stats.total, badgeColor: 'bg-slate-100 text-slate-700' },
            {
              id: 'pending_review',
              label: 'الطلبات الجديدة',
              count: stats.pending_review,
              badgeColor: 'bg-blue-100 text-blue-800',
            },
            {
              id: 'accepted',
              label: 'جاري التوصيل',
              count: stats.accepted,
              badgeColor: 'bg-indigo-100 text-indigo-800',
            },
            {
              id: 'cancellation_pending',
              label: 'طلبات الإلغاء',
              count: stats.cancellation_pending,
              badgeColor:
                stats.cancellation_pending > 0
                  ? 'bg-amber-500 text-white font-bold animate-pulse'
                  : 'bg-amber-100 text-amber-800',
            },
            {
              id: 'completed',
              label: 'مكتملة',
              count: stats.completed,
              badgeColor: 'bg-emerald-100 text-emerald-800',
            },
            {
              id: 'cancelled',
              label: 'ملغاة',
              count: stats.cancelled,
              badgeColor: 'bg-rose-100 text-rose-800',
            },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 py-3 px-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tab.badgeColor}`}
                >
                  {tab.count.toLocaleString('ar-EG')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------------------------------------------------------------
          Search & Filters Bar
      --------------------------------------------------------------------- */}
      <div className="bg-white p-4 rounded-b-2xl border border-t-0 border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Text Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث برقم الطلب، اسم العميل، أو رقم الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Governorate Filter */}
          <div>
            <select
              value={governorateFilter}
              onChange={(e) => setGovernorateFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
            >
              <option value="all">جميع المحافظات</option>
              {locationOptions.governorates.map((gov) => (
                <option key={gov} value={gov}>
                  {gov}
                </option>
              ))}
            </select>
          </div>

          {/* Markaz Filter */}
          <div>
            <select
              value={markazFilter}
              onChange={(e) => setMarkazFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
            >
              <option value="all">جميع المراكز</option>
              {locationOptions.markazes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Driver Filter */}
          <div>
            <select
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
            >
              <option value="all">جميع السائقين</option>
              <option value="unassigned">غير مسند لسائق</option>
              {driversList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name} ({d.phone})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Filters & Clear */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500 font-medium">من:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">إلى:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {(searchQuery ||
            governorateFilter !== 'all' ||
            markazFilter !== 'all' ||
            driverFilter !== 'all' ||
            dateFrom ||
            dateTo) && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>إلغاء الفلاتر</span>
            </button>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------------
          Orders Table / List
      --------------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-sm text-slate-500 mt-3 font-medium">جاري تحميل طلبات الدليفري...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-4">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">لا توجد طلبات تطابق معايير البحث</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              جرب تغيير التبويب المختار أو إعادة تعيين الفلاتر لعرض طلبات أخرى
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
            >
              إعادة تعيين الفلاتر
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-medium text-slate-500">
                <tr>
                  <th className="py-3.5 px-4">رقم الطلب والتاريخ</th>
                  <th className="py-3.5 px-4">العميل والهاتف</th>
                  <th className="py-3.5 px-4">العنوان والمنطقة</th>
                  <th className="py-3.5 px-4">الدليفري المسند</th>
                  <th className="py-3.5 px-4">الإجمالي</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => {
                  const statusMeta = getStatusMeta(order.status);
                  const StatusIcon = statusMeta.icon;
                  const isCancellationPending = order.status === 'cancellation_pending';

                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isCancellationPending ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* Order Number & Timestamp */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 font-mono text-sm">
                              {order.order_number || `#${order.id.slice(0, 8)}`}
                            </span>
                            {order.order_source === 'pharmacy' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                                <HeartPulse className="w-3 h-3 text-teal-600" />
                                <span>صيدلية</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                <ShoppingBag className="w-3 h-3 text-indigo-600" />
                                <span>بقالة</span>
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(order.created_at)}
                          </span>
                          {order.pharmacy_name && (
                            <span className="text-[11px] text-teal-700 font-semibold flex items-center gap-1 mt-0.5">
                              <span>🏥 {order.pharmacy_name}</span>
                            </span>
                          )}
                          {order.prescription_title && (
                            <span className="text-[10px] text-slate-500 truncate max-w-[180px] mt-0.2">
                              💊 {order.prescription_title}
                            </span>
                          )}
                          {order.household_name && !order.pharmacy_name && (
                            <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Building className="w-3 h-3 text-slate-400" />
                              {order.household_name}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer Info */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {order.customer_name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-xs text-slate-600 font-mono dir-ltr">
                              {order.customer_phone || order.phone_number || '—'}
                            </span>
                            {(order.customer_phone || order.phone_number) && (
                              <button
                                onClick={(e) =>
                                  handleCopyPhone(
                                    order.customer_phone || order.phone_number || '',
                                    e
                                  )
                                }
                                className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                                title="نسخ رقم الهاتف"
                              >
                                {copiedPhone ===
                                (order.customer_phone || order.phone_number) ? (
                                  <CheckCheck className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Address */}
                      <td className="py-4 px-4 max-w-xs">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1 text-xs font-medium text-slate-800">
                            <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span>
                              {[order.governorate_name, order.markaz_name]
                                .filter(Boolean)
                                .join(' - ') || 'الموقع غير محدد'}
                            </span>
                          </div>
                          <span
                            className="text-xs text-slate-500 mt-1 line-clamp-1"
                            title={order.detailed_address}
                          >
                            {order.detailed_address || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Assigned Driver */}
                      <td className="py-4 px-4">
                        {order.driver ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  order.driver.is_active ? 'bg-emerald-500' : 'bg-rose-400'
                                }`}
                                title={order.driver.is_active ? 'سائق نشط' : 'سائق غير نشط'}
                              />
                              <span className="font-medium text-slate-800 text-xs">
                                {order.driver.full_name}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {order.driver.phone}
                            </span>
                            {order.driver.vehicle_type && (
                              <span className="text-[10px] text-indigo-600 mt-0.5">
                                مركبة: {order.driver.vehicle_type}
                              </span>
                            )}
                          </div>
                        ) : order.assigned_driver_id || order.status === 'completed' || order.accepted_at ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            <Bike className="w-3 h-3 text-slate-400" />
                            سائق محذوف
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600">
                            <Clock className="w-3 h-3 text-slate-400" />
                            غير مسند
                          </span>
                        )}
                      </td>

                      {/* Financials & Items Count */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-sm">
                            {formatCurrency(order.total_amount)}
                          </span>
                          <span className="text-[11px] text-slate-400 mt-0.5">
                            توصيل: {formatCurrency(order.delivery_fee)}
                          </span>
                          {order.items_count !== undefined && order.items_count > 0 && (
                            <span className="text-[10px] text-slate-500">
                              ({order.items_count} منتجات)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusMeta.badgeBg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotColor}`} />
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusMeta.label}
                          </span>

                          {/* Cancellation alert pill */}
                          {isCancellationPending && order.cancellation_reason && (
                            <span
                              className="text-[11px] text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded max-w-[170px] truncate"
                              title={order.cancellation_reason}
                            >
                              السبب: {order.cancellation_reason}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenDetails(order.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                            title="عرض تفاصيل الطلب والمنتجات"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>عرض</span>
                          </button>

                          {/* Quick Cancellation Decision Button if pending */}
                          {isCancellationPending && (
                            <button
                              onClick={() => {
                                handleOpenDetails(order.id);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer"
                              title="البت في طلب الإلغاء"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              <span>بت في الإلغاء</span>
                            </button>
                          )}
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

      {/* ---------------------------------------------------------------------
          Order Details Modal (Products, Financials, History, Driver)
      --------------------------------------------------------------------- */}
      {selectedOrderId && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-150"
          onClick={handleCloseDetails}
        >
          <div
            className="relative bg-white w-full max-w-3xl rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-slate-200 overflow-hidden max-h-[92vh] sm:max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 bg-slate-50/80 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-300" />
            </div>

            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0 gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">
                      تفاصيل الطلب{' '}
                      <span className="font-mono text-indigo-700">
                        {orderDetails?.order_number || `#${selectedOrderId.slice(0, 8)}`}
                      </span>
                    </h3>
                    {orderDetails && (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          getStatusMeta(orderDetails.status).badgeBg
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            getStatusMeta(orderDetails.status).dotColor
                          }`}
                        />
                        {getStatusMeta(orderDetails.status).label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    تاريخ الإنشاء: {formatDate(orderDetails?.created_at)}
                    {orderDetails?.household_name && ` • منزل: ${orderDetails.household_name}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {orderDetails &&
                  orderDetails.status !== 'completed' &&
                  orderDetails.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() => setOrderToDirectCancel(orderDetails)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="إلغاء هذا الطلب كإجراء إداري"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>إلغاء الطلب</span>
                    </button>
                  )}
                <button
                  onClick={handleCloseDetails}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 overscroll-contain">
              {isLoadingDetails ? (
                <div className="py-16 text-center">
                  <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-500 font-medium">
                    جاري جلب تفاصيل الطلب والمنتجات وسجل الحالات...
                  </p>
                </div>
              ) : !orderDetails ? (
                <div className="py-12 text-center text-slate-500">
                  <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                  <p>تعذر العثور على بيانات الطلب</p>
                </div>
              ) : (
                <>
                  {/* -------------------------------------------------------------
                      Visual Order Journey Map (خريطة رحلة طلب الدليفري)
                  ------------------------------------------------------------- */}
                  <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">
                            خريطة وتطور رحلة الطلب (Order Journey Timeline)
                          </h4>
                          <span className="text-[10px] text-slate-500">
                            المسار الميداني لدورة الطلب من الإنشاء وحتى التسليم
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600">
                        آخر تحديث:{' '}
                        {formatDate(orderDetails.updated_at || orderDetails.created_at)}
                      </span>
                    </div>

                    {/* Stepper Stages */}
                    {orderDetails.status === 'cancelled' ? (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                            <XCircle className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-rose-900 block">
                              تم إلغاء الطلب رسمياً
                            </span>
                            <span className="text-[11px] text-rose-700 block">
                              {orderDetails.cancellation_reason
                                ? `سبب الإلغاء: ${orderDetails.cancellation_reason}`
                                : 'تم الإلغاء بواسطة الإدارة أو النظام'}
                            </span>
                          </div>
                        </div>
                        {orderDetails.cancellation_decided_at && (
                          <span className="text-[10px] text-rose-600 font-mono">
                            {formatDate(orderDetails.cancellation_decided_at)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 pt-2 text-center">
                        {/* Step 1: Created */}
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-emerald-600 text-white shadow-xs">
                            <Check className="w-4 h-4" />
                          </div>
                          <span className="text-[11px] font-bold text-slate-900 mt-1.5 block">إنشاء الطلب</span>
                          <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                            {formatDate(orderDetails.created_at)}
                          </span>
                        </div>

                        {/* Step 2: Driver Assigned */}
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              ['accepted', 'cancellation_pending', 'completed'].includes(
                                orderDetails.status
                              )
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-blue-600 text-white animate-pulse'
                            }`}
                          >
                            {['accepted', 'cancellation_pending', 'completed'].includes(
                              orderDetails.status
                            ) ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Clock className="w-4 h-4" />
                            )}
                          </div>
                          <span className="text-[11px] font-bold text-slate-900 mt-1.5 block">قبول السائق</span>
                          <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                            {orderDetails.accepted_at
                              ? formatDate(orderDetails.accepted_at)
                              : orderDetails.assigned_driver_id
                              ? 'تم الإسناد'
                              : 'بانتظار سائق'}
                          </span>
                        </div>

                        {/* Step 3: In Delivery */}
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              orderDetails.status === 'completed'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : orderDetails.status === 'accepted' ||
                                  orderDetails.status === 'cancellation_pending'
                                ? 'bg-indigo-600 text-white animate-pulse'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {orderDetails.status === 'completed' ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Bike className="w-4 h-4" />
                            )}
                          </div>
                          <span className="text-[11px] font-bold text-slate-900 mt-1.5 block">قيد التوصيل</span>
                          <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                            {orderDetails.status === 'cancellation_pending'
                              ? 'طلب إلغاء معلق'
                              : orderDetails.status === 'accepted'
                              ? 'مع المندوب'
                              : '—'}
                          </span>
                        </div>

                        {/* Step 4: Delivered */}
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              orderDetails.status === 'completed'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <span className="text-[11px] font-bold text-slate-900 mt-1.5 block">تم التسليم</span>
                          <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                            {orderDetails.delivered_at
                              ? formatDate(orderDetails.delivered_at)
                              : orderDetails.status === 'completed'
                              ? 'مكتمل'
                              : '—'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* -------------------------------------------------------------
                      CANCELLATION DECISION HERO (When status is cancellation_pending)
                  ------------------------------------------------------------- */}
                  {orderDetails.status === 'cancellation_pending' && (
                    <div className="p-5 rounded-xl bg-amber-50 border border-amber-300 ring-1 ring-amber-400/20 shadow-xs space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-base font-bold text-amber-900">
                            طلب إلغاء مقدم من السائق / العميل
                          </h4>
                          <p className="text-xs text-amber-700 mt-0.5">
                            يتطلب هذا الطلب قراراً إدارياً فورياً؛ إما بالموافقة على الإلغاء (تحويل
                            الطلب إلى "ملغى") أو برفض الإلغاء (إعادة الطلب إلى السائق بحالة "جاري
                            التوصيل").
                          </p>
                          <div className="mt-3 bg-white/80 p-3 rounded-lg border border-amber-200 text-xs text-slate-700 space-y-1">
                            <div>
                              <span className="font-semibold text-amber-900">سبب الإلغاء المسجل: </span>
                              <span className="font-medium">
                                {orderDetails.cancellation_reason || 'لم يتم تحديد سبب تفصيلي'}
                              </span>
                            </div>
                            {orderDetails.cancellation_requested_at && (
                              <div className="text-slate-500">
                                <span>وقت تقديم الطلب: </span>
                                <span>{formatDate(orderDetails.cancellation_requested_at)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Admin Decision Actions */}
                      <div className="pt-3 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-amber-800">
                          <ShieldCheck className="w-4 h-4 text-amber-600" />
                          <span>تُنفذ القرارات حصرياً عبر RPC الإدارية المؤمنة بقاعدة البيانات</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Reject Cancellation (Returns order to driver as accepted) */}
                          <button
                            onClick={() =>
                              setCancellationAction({ order: orderDetails, approve: false })
                            }
                            disabled={!canManage}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 transition-colors disabled:opacity-50 cursor-pointer"
                            title="رفض الإلغاء وإعادة الطلب للسائق"
                          >
                            <Check className="w-4 h-4 text-emerald-700" />
                            <span>رفض الإلغاء وإعادة الطلب للسائق</span>
                          </button>

                          {/* Approve Cancellation (Order becomes cancelled) */}
                          <button
                            onClick={() =>
                              setCancellationAction({ order: orderDetails, approve: true })
                            }
                            disabled={!canManage}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-800 bg-rose-100 hover:bg-rose-200 border border-rose-300 transition-colors disabled:opacity-50 cursor-pointer"
                            title="الموافقة على الإلغاء وإلغاء الطلب نهائياً"
                          >
                            <X className="w-4 h-4 text-rose-700" />
                            <span>الموافقة على الإلغاء</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Previous Decision Note (If was cancelled or resolved before) */}
                  {orderDetails.cancellation_decision_note && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span>ملاحظة قرار الإدارة السابق:</span>
                      </div>
                      <p className="text-slate-600 pr-5">
                        {orderDetails.cancellation_decision_note}
                      </p>
                      {orderDetails.cancellation_decided_at && (
                        <span className="text-[10px] text-slate-400 block pr-5">
                          تاريخ البت: {formatDate(orderDetails.cancellation_decided_at)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Pharmacy Order Indicator Banner */}
                  {orderDetails.order_source === 'pharmacy' && (
                    <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <HeartPulse className="w-4 h-4 text-teal-600 shrink-0" />
                        <div>
                          <span className="font-bold text-teal-900 block">طلب تابع لقسم الصيدلية والروشتات الطبية</span>
                          <span className="text-teal-700 block text-[11px]">
                            {orderDetails.pharmacy_name ? `الصيدلية: ${orderDetails.pharmacy_name}` : ''}
                            {orderDetails.prescription_title ? ` | الروشتة: ${orderDetails.prescription_title}` : ''}
                          </span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-teal-100 text-teal-800 font-bold text-[10px] shrink-0">
                        قسم الصيدلية
                      </span>
                    </div>
                  )}

                  {/* -------------------------------------------------------------
                      Grid: Customer Info & Driver Info
                  ------------------------------------------------------------- */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Customer Info Card */}
                    <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <User className="w-4 h-4 text-indigo-600" />
                          بيانات العميل والتوصيل
                        </span>
                      </div>

                      <div className="text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">اسم العميل:</span>
                          <span className="font-semibold text-slate-900">
                            {orderDetails.customer_name}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">رقم الهاتف:</span>
                          <div className="flex items-center gap-1">
                            <span className="font-mono font-medium text-slate-900 dir-ltr">
                              {orderDetails.customer_phone || orderDetails.phone_number || '—'}
                            </span>
                            {(orderDetails.customer_phone || orderDetails.phone_number) && (
                              <button
                                onClick={(e) =>
                                  handleCopyPhone(
                                    orderDetails.customer_phone ||
                                      orderDetails.phone_number ||
                                      '',
                                    e
                                  )
                                }
                                className="text-slate-400 hover:text-slate-600"
                                title="نسخ"
                              >
                                {copiedPhone ===
                                (orderDetails.customer_phone || orderDetails.phone_number) ? (
                                  <CheckCheck className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">المحافظة والمركز:</span>
                          <span className="font-medium text-slate-800">
                            {[orderDetails.governorate_name, orderDetails.markaz_name]
                              .filter(Boolean)
                              .join(' - ') || '—'}
                          </span>
                        </div>
                        <div className="pt-1">
                          <span className="text-slate-500 block mb-0.5">العنوان التفصيلي:</span>
                          <p className="text-slate-800 bg-white p-2 rounded-lg border border-slate-200/80 leading-relaxed">
                            {orderDetails.detailed_address || 'لم يتم تحديد عنوان تفصيلي'}
                          </p>
                        </div>
                        {(orderDetails.delivery_notes || orderDetails.notes) && (
                          <div className="pt-1">
                            <span className="text-slate-500 block mb-0.5">
                              ملاحظات العميل / الطلب:
                            </span>
                            <p className="text-slate-700 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 leading-relaxed">
                              {orderDetails.delivery_notes || orderDetails.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Assigned Driver Card */}
                    <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Bike className="w-4 h-4 text-indigo-600" />
                          سائق الدليفري المسند
                        </span>
                        {assignedDriver && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              assignedDriver.is_active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                assignedDriver.is_active ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                            {assignedDriver.is_active ? 'نشط' : 'غير نشط'}
                          </span>
                        )}
                      </div>

                      {assignedDriver ? (
                        <div className="text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">اسم السائق:</span>
                            <span className="font-semibold text-slate-900">
                              {assignedDriver.full_name}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">رقم الهاتف:</span>
                            <div className="flex items-center gap-1">
                              <span className="font-mono font-medium text-slate-900 dir-ltr">
                                {assignedDriver.phone}
                              </span>
                              <button
                                onClick={(e) => handleCopyPhone(assignedDriver.phone, e)}
                                className="text-slate-400 hover:text-slate-600"
                                title="نسخ"
                              >
                                {copiedPhone === assignedDriver.phone ? (
                                  <CheckCheck className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">نوع المركبة:</span>
                            <span className="font-medium text-slate-800">
                              {assignedDriver.vehicle_type || 'غير محدد'}
                            </span>
                          </div>
                          {orderDetails.accepted_at && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">تاريخ قبول الطلب:</span>
                              <span className="text-slate-700">
                                {formatDate(orderDetails.accepted_at)}
                              </span>
                            </div>
                          )}
                          {orderDetails.delivered_at && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">تاريخ التسليم:</span>
                              <span className="text-emerald-700 font-medium">
                                {formatDate(orderDetails.delivered_at)}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : orderDetails.assigned_driver_id ||
                        orderDetails.status === 'completed' ||
                        orderDetails.accepted_at ? (
                        <div className="py-5 text-center space-y-1.5">
                          <div className="w-10 h-10 rounded-full bg-slate-200/70 text-slate-500 flex items-center justify-center mx-auto">
                            <Bike className="w-5 h-5" />
                          </div>
                          <p className="text-xs font-bold text-slate-700">
                            تم حذف حساب السائق السابق
                          </p>
                          <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                            تم الاحتفاظ بهذا الطلب وسجله التاريخي والفاتورة المرتبطة به بالكامل بعد حذف حساب الدليفري.
                          </p>
                        </div>
                      ) : (
                        <div className="py-6 text-center space-y-2">
                          <div className="w-10 h-10 rounded-full bg-slate-200/70 text-slate-400 flex items-center justify-center mx-auto">
                            <Bike className="w-5 h-5" />
                          </div>
                          <p className="text-xs font-medium text-slate-600">
                            لم يتم إسناد هذا الطلب لأي سائق بعد
                          </p>
                          <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                            يتاح الطلب حالياً في تطبيق الدليفري للسائقين النشطين لقبوله، أو انتظار
                            توفير دالة إسناد إداري آمنة.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* -------------------------------------------------------------
                      Order Items Table (public.delivery_order_items / linked invoice)
                  ------------------------------------------------------------- */}
                  <div className="space-y-3">
                    {/* Linked Invoice Callout if order originated from household invoice */}
                    {orderDetails.linked_invoice && (
                      <div className="p-3.5 bg-indigo-50/90 border border-indigo-200/90 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-indigo-950 block">
                              مرتبط بفاتورة مشتريات من تطبيق «طلبات البيت»: {orderDetails.linked_invoice.invoice_number}
                            </span>
                            <span className="text-[11px] text-indigo-700 block mt-0.5">
                              التصنيف: {orderDetails.linked_invoice.category_arabic || orderDetails.linked_invoice.category || 'عام'} • إجمالي الفاتورة: {formatCurrency(orderDetails.linked_invoice.total_price || 0)} {orderDetails.linked_invoice.date ? `• التاريخ: ${orderDetails.linked_invoice.date}` : ''}
                            </span>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-200/70 text-indigo-900 shrink-0 self-start sm:self-auto">
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          تم توريد الأصناف تلقائياً من الفاتورة
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <ShoppingBag className="w-4 h-4 text-indigo-600" />
                        <span>محتويات وسلة الطلب ({orderItems.length} صنف)</span>
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        مصدر البيانات: {orderItems.some((i) => i.source === 'invoice_products') ? 'فاتورة طلبات البيت (invoices.products)' : 'delivery_order_items'}
                      </span>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      {orderItems.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          لا توجد أصناف مسجلة في هذا الطلب
                        </div>
                      ) : (
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                            <tr>
                              <th className="py-2.5 px-3">المنتج</th>
                              <th className="py-2.5 px-3">التصنيف</th>
                              <th className="py-2.5 px-3 text-center">الكمية</th>
                              <th className="py-2.5 px-3">سعر الوحدة</th>
                              <th className="py-2.5 px-3">الإجمالي</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {orderItems.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50/60">
                                <td className="py-2.5 px-3 font-semibold text-slate-900">
                                  <div className="flex items-center gap-2">
                                    <span>{item.product_name}</span>
                                    {item.source === 'invoice_products' && (
                                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
                                        صنف فاتورة
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-slate-500">
                                  {item.category_name || 'عام'}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-medium text-slate-800">
                                  {item.quantity}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-600">
                                  {formatCurrency(item.unit_price)}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                  {formatCurrency(item.total_price)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {/* Financial Summary Footer */}
                      <div className="bg-slate-50/80 p-3.5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 text-xs">
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2 text-slate-500">
                            <span>قيمة المنتجات:</span>
                            <span className="font-bold text-slate-800 font-mono">
                              {formatCurrency(orderDetails.subtotal)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-500">
                            <span>رسوم التوصيل:</span>
                            <span className="font-bold text-slate-800 font-mono">
                              {formatCurrency(orderDetails.delivery_fee)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200">
                            <span className="font-semibold">الإجمالي الكلي:</span>
                            <span className="font-bold font-mono text-sm">
                              {formatCurrency(orderDetails.total_amount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* -------------------------------------------------------------
                      Status History Timeline (public.delivery_order_status_history)
                  ------------------------------------------------------------- */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-indigo-600" />
                        <span>سجل تحركات الحالة والقرارات (Status Timeline)</span>
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        مصدر البيانات: delivery_order_status_history
                      </span>
                    </div>

                    {orderHistory.length === 0 ? (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                        لا توجد سجلات تاريخية مسجلة لهذا الطلب
                      </div>
                    ) : (
                      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                        {orderHistory.map((hist, idx) => (
                          <div
                            key={hist.id || idx}
                            className="relative flex items-start gap-3 text-xs pb-3 last:pb-0 border-b border-slate-100 last:border-b-0"
                          >
                            <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="w-2 h-2 rounded-full bg-indigo-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-900">
                                    {getStatusMeta(hist.new_status).label}
                                  </span>
                                  {hist.old_status && (
                                    <span className="text-[11px] text-slate-400">
                                      (سابقاً: {getStatusMeta(hist.old_status).label})
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {formatDate(hist.created_at)}
                                </span>
                              </div>
                              {(hist.note || hist.notes) && (
                                <p className="text-slate-600 mt-1 bg-slate-50 p-2 rounded border border-slate-100">
                                  {hist.note || hist.notes}
                                </p>
                              )}
                              {(hist.changed_by || hist.changed_by_role) && (
                                <span className="text-[10px] text-slate-400 mt-1 block">
                                  بواسطة: {hist.changed_by || hist.changed_by_role}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/95 backdrop-blur flex items-center justify-between gap-2 shrink-0 sticky bottom-0 z-10">
              <span className="text-xs text-slate-400 truncate">
                المعرف الفريد: <span className="font-mono">{orderDetails?.id || selectedOrderId}</span>
              </span>
              <button
                onClick={handleCloseDetails}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          Cancellation Decision Confirmation Dialog
      --------------------------------------------------------------------- */}
      {cancellationAction && (
        <div
          className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-150"
          onClick={() => !isSubmittingDecision && setCancellationAction(null)}
        >
          <div
            className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-300" />
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    cancellationAction.approve
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {cancellationAction.approve ? (
                    <XCircle className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    {cancellationAction.approve
                      ? 'تأكيد الموافقة على إلغاء الطلب'
                      : 'تأكيد رفض طلب الإلغاء وإعادة الطلب للسائق'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    طلب رقم:{' '}
                    <span className="font-mono font-bold text-indigo-700">
                      {cancellationAction.order.order_number ||
                        `#${cancellationAction.order.id.slice(0, 8)}`}
                    </span>
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <p>
                  {cancellationAction.approve ? (
                    <span>
                      عند التأكيد، سيتم استدعاء الدالة المؤمنة وتحويل حالة الطلب نهائياً إلى{' '}
                      <strong className="text-rose-700">"ملغى" (cancelled)</strong> مع توثيق قرار
                      الإدارة في السجل.
                    </span>
                  ) : (
                    <span>
                      عند التأكيد، سيتم رفض طلب الإلغاء وإعادة حالة الطلب إلى{' '}
                      <strong className="text-indigo-700">"جاري التوصيل" (accepted)</strong> ليبقى
                      مسنداً لسائقه.
                    </span>
                  )}
                </p>
              </div>

              {/* Admin Decision Note Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">
                  {cancellationAction.approve
                    ? 'ملاحظات الإدارة (اختياري - تُحفظ كمسودة عند الإغلاق):'
                    : 'سبب الرفض وملاحظات الإدارة (موصى بها - تُحفظ كمسودة عند الإغلاق):'}
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    cancellationAction.approve
                      ? 'اكتب أي توضيحات إدارية لقرار الإلغاء...'
                      : 'مثال: تم التواصل مع العميل وهو بانتظار استلام الطلب الآن...'
                  }
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            {/* Dialog Actions */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 bg-slate-50/95 backdrop-blur shrink-0 sticky bottom-0 z-10">
              <button
                onClick={() => {
                  setCancellationAction(null);
                }}
                disabled={isSubmittingDecision}
                className="px-4 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                إغلاق
              </button>

              <button
                onClick={handleSubmitDecision}
                disabled={isSubmittingDecision}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer ${
                  cancellationAction.approve
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isSubmittingDecision && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {cancellationAction.approve ? 'تأكيد الإلغاء' : 'تأكيد الرفض وإعادة الطلب'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          Direct Admin Cancellation Modal
      --------------------------------------------------------------------- */}
      {orderToDirectCancel && (
        <div
          className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-150"
          onClick={() => !isDirectCancelling && setOrderToDirectCancel(null)}
        >
          <div
            className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-300" />
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">إلغاء الطلب إدارياً</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    طلب رقم:{' '}
                    <span className="font-mono font-bold text-rose-700">
                      {orderToDirectCancel.order_number || `#${orderToDirectCancel.id.slice(0, 8)}`}
                    </span>
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  سبب الإلغاء الإداري (مطلوب - يُحفظ كمسودة عند الإغلاق):
                </label>
                <textarea
                  rows={3}
                  placeholder="اكتب سبب إلغاء الطلب لتوثيقه في سجل الطلب..."
                  value={directCancelReason}
                  onChange={(e) => setDirectCancelReason(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 bg-slate-50/95 backdrop-blur shrink-0 sticky bottom-0 z-10">
              <button
                onClick={() => setOrderToDirectCancel(null)}
                disabled={isDirectCancelling}
                className="px-4 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                إغلاق
              </button>
              <button
                onClick={handleConfirmDirectCancel}
                disabled={isDirectCancelling || !directCancelReason.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isDirectCancelling && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>تأكيد إلغاء الطلب</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
