import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../context/AdminContext';
import { adminService } from '../services/adminService';
import {
  DeliveryCustomer,
  DeliveryCustomersStatsSummary,
  DeliveryOrder,
  DeliveryOrderStatus,
} from '../types';
import { exportToCSV } from '../utils/exportUtils';
import {
  UserCheck,
  Search,
  RefreshCw,
  Download,
  Filter,
  X,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  Copy,
  Check,
  AlertTriangle,
  Info,
  ShieldAlert,
  User,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  FileText,
  BadgeAlert,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export const AdminDeliveryCustomers: React.FC = () => {
  const { hasPermission, showToast } = useAdmin();
  const canManage = hasPermission('delivery.manage');

  // Customers & Stats State
  const [customers, setCustomers] = useState<DeliveryCustomer[]>([]);
  const [stats, setStats] = useState<DeliveryCustomersStatsSummary>({
    total_customers: 0,
    registered_customers: 0,
    guest_customers: 0,
    repeat_customers: 0,
    total_orders: 0,
    total_revenue: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [governorateFilter, setGovernorateFilter] = useState('all');
  const [markazFilter, setMarkazFilter] = useState('all');
  const [accountStatusFilter, setAccountStatusFilter] = useState<string>('all');
  const [repeatFilter, setRepeatFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Dropdown Location Options
  const [locationOptions, setLocationOptions] = useState<{
    governorates: string[];
    markazes: string[];
  }>({ governorates: [], markazes: [] });

  // Selected Customer Details Modal
  const [selectedCustomer, setSelectedCustomer] = useState<DeliveryCustomer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<DeliveryOrder[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Copy Phone Helper
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const handleCopyPhone = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  // Load Locations for Dropdowns
  useEffect(() => {
    async function loadLocations() {
      try {
        const locs = await adminService.getDeliveryLocations();
        setLocationOptions(locs);
      } catch (err) {
        console.warn('Could not load delivery locations:', err);
      }
    }
    loadLocations();
  }, []);

  // Fetch Delivery Customers
  const loadCustomers = useCallback(
    async (showRefreshAnimation = false) => {
      if (showRefreshAnimation) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const res = await adminService.getDeliveryCustomers({
          search: searchQuery,
          governorate: governorateFilter,
          markaz: markazFilter,
          accountStatus: accountStatusFilter as any,
          repeatFilter: repeatFilter as any,
          page,
          pageSize,
        });

        if (res.error) {
          showToast(res.error, 'error');
        } else {
          setCustomers(res.customers);
          setStats(res.stats);
          setTotalCount(res.totalCount);
        }
      } catch (err: any) {
        console.error('Error fetching delivery customers:', err);
        showToast(err?.message || 'حدث خطأ أثناء تحميل عملاء الدليفري', 'error');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [searchQuery, governorateFilter, markazFilter, accountStatusFilter, repeatFilter, page, showToast]
  );

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Open Details Modal
  const handleOpenDetails = async (customer: DeliveryCustomer) => {
    setSelectedCustomer(customer);
    setIsLoadingDetails(true);
    try {
      const res = await adminService.getDeliveryCustomerDetails(customer.customer_phone);
      if (res.error) {
        showToast(res.error, 'error');
      } else {
        if (res.customer) setSelectedCustomer(res.customer);
        setCustomerOrders(res.orders);
      }
    } catch (err: any) {
      console.error('Error loading customer details:', err);
      showToast('تعذر تحميل تفاصيل العميل', 'error');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setGovernorateFilter('all');
    setMarkazFilter('all');
    setAccountStatusFilter('all');
    setRepeatFilter('all');
    setPage(1);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    governorateFilter !== 'all' ||
    markazFilter !== 'all' ||
    accountStatusFilter !== 'all' ||
    repeatFilter !== 'all';

  // Export to CSV
  const handleExport = () => {
    if (customers.length === 0) {
      showToast('لا توجد بيانات عملاء لتصديرها', 'error');
      return;
    }
    const dataToExport = customers.map((c) => ({
      'اسم العميل': c.customer_name,
      'رقم الهاتف': c.customer_phone,
      'البريد الإلكتروني': c.email || '—',
      'المحافظة': c.governorate_name || '—',
      'المركز': c.markaz_name || '—',
      'العنوان التفصيلي': c.detailed_address || '—',
      'حالة الحساب': c.account_status === 'registered' ? 'مسجل' : c.account_status === 'blocked' ? 'محظور' : 'طلب مباشر',
      'تصنيف الثقة': 'غير مصنف',
      'إجمالي الطلبات': c.orders_count,
      'الطلبات المكتملة': c.completed_orders_count,
      'الطلبات الملغاة': c.cancelled_orders_count,
      'الطلبات الجارية': c.pending_orders_count,
      'إجمالي الإنفاق (ج.م)': c.total_spent,
      'تاريخ آخر طلب': c.last_order_date ? new Date(c.last_order_date).toLocaleDateString('ar-EG') : '—',
      'حالة آخر طلب': c.last_order_status || '—',
    }));
    exportToCSV('delivery_customers_export', dataToExport);
    showToast('تم تصدير قائمة عملاء الدليفري بنجاح', 'success');
  };

  // Format Dates
  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  // Helper for Order Status Badge
  const getOrderStatusBadge = (status: DeliveryOrderStatus) => {
    switch (status) {
      case 'pending_review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            جديد للمراجعة
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <ShoppingBag className="w-3.5 h-3.5" />
            جاري التوصيل
          </span>
        );
      case 'cancellation_pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            طلب إلغاء معلق
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            مكتمل ومسلّم
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <XCircle className="w-3.5 h-3.5" />
            ملغي
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400">
            {status}
          </span>
        );
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir="rtl">
      {/* ------------------------------------------------------------- */}
      {/* 1. Header Card */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900/80 p-5 sm:p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-inner">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white">عملاء الدليفري</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                مرتبط بالطلبات الفعلية
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              إدارة ومتابعة سجلات العملاء الذين أجروا طلبات دليفري حقيقية مع الإحصائيات وسجل التوصيل
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => loadCustomers(true)}
            disabled={isLoading || isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700/60 transition shadow-sm active:scale-95 disabled:opacity-50"
            title="تحديث البيانات الآن"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>تحديث</span>
          </button>

          <button
            onClick={handleExport}
            disabled={customers.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700/60 transition shadow-sm active:scale-95 disabled:opacity-50"
            title="تصدير بيانات العملاء إلى ملف CSV"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>تصدير CSV</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. Statistical Metric Cards */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Customers */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">إجمالي العملاء</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-white font-mono">{stats.total_customers}</span>
            <span className="text-[10px] text-slate-500 font-bold">عميل فعلي</span>
          </div>
        </div>

        {/* Registered with Account */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">مسجلون بحساب</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-400 font-mono">{stats.registered_customers}</span>
            <span className="text-[10px] text-emerald-500/70 font-bold">profiles</span>
          </div>
        </div>

        {/* Guest / Direct Orders */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">طلب مباشر (زائر)</span>
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-400 font-mono">{stats.guest_customers}</span>
            <span className="text-[10px] text-blue-500/70 font-bold">عبر الهاتف</span>
          </div>
        </div>

        {/* Repeat Customers */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">عملاء متكررون</span>
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-400 font-mono">{stats.repeat_customers}</span>
            <span className="text-[10px] text-amber-500/70 font-bold">&gt; طلب واحد</span>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">إجمالي طلباتهم</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-purple-400 font-mono">{stats.total_orders}</span>
            <span className="text-[10px] text-purple-500/70 font-bold">طلب دليفري</span>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">إجمالي المبيعات</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-400 font-mono">
              {stats.total_revenue.toLocaleString('ar-EG')}
            </span>
            <span className="text-[10px] text-emerald-500/70 font-bold">ج.م</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. Search & Filters Bar */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900/80 p-4 rounded-3xl border border-slate-800 space-y-3.5 shadow-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="ابحث بالاسم، رقم الهاتف، أو البريد الإلكتروني..."
              className="w-full bg-slate-950 text-slate-200 pr-10 pl-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 text-xs placeholder:text-slate-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-3 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Governorate Filter */}
          <div>
            <select
              value={governorateFilter}
              onChange={(e) => {
                setGovernorateFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 text-xs transition cursor-pointer"
            >
              <option value="all">كل المحافظات</option>
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
              onChange={(e) => {
                setMarkazFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 text-xs transition cursor-pointer"
            >
              <option value="all">كل المراكز / المناطق</option>
              {locationOptions.markazes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Account Status Filter */}
          <div>
            <select
              value={accountStatusFilter}
              onChange={(e) => {
                setAccountStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 text-xs transition cursor-pointer"
            >
              <option value="all">كل حالات الحساب</option>
              <option value="registered">مسجل في التطبيق (profiles)</option>
              <option value="guest">طلب مباشر (بدون حساب)</option>
              <option value="blocked">محظور</option>
            </select>
          </div>
        </div>

        {/* Secondary Row: Repeat Orders Filter & Reset */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800/60 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-emerald-400" />
              تكرار الطلبات:
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setRepeatFilter('all');
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  repeatFilter === 'all'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => {
                  setRepeatFilter('repeat');
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  repeatFilter === 'repeat'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                عملاء متكررون (&gt; 1 طلب)
              </button>
              <button
                onClick={() => {
                  setRepeatFilter('single');
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  repeatFilter === 'single'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                طلب واحد فقط
              </button>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition border border-rose-500/20"
            >
              <X className="w-3.5 h-3.5" />
              مسح الفلاتر
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. Customers Table */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900/80 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-white">قائمة عملاء طلبات الدليفري</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-bold">
              {totalCount} عميل
            </span>
          </div>
          <span className="text-xs text-slate-400">
            صفحة {page} من {totalPages}
          </span>
        </div>

        {isLoading ? (
          <div className="p-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
            <p className="text-sm text-slate-300 font-bold">جاري استخراج وتجميع بيانات عملاء الدليفري...</p>
            <p className="text-xs text-slate-500">يتم استخراج العملاء من جدول delivery_orders ومطابقتهم مع profiles</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto border border-slate-700">
              <UserCheck className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">لا يوجد عملاء يطابقون خيارات البحث</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {hasActiveFilters
                  ? 'جرب تعديل خيارات الفلترة أو مسح كلمات البحث لعرض كل العملاء'
                  : 'لم يتم العثور على أي طلبات دليفري مسجلة في النظام حتى الآن'}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700"
              >
                مسح كل الفلاتر
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-bold">
                  <th className="py-3.5 px-4">العميل</th>
                  <th className="py-3.5 px-4">رقم الهاتف</th>
                  <th className="py-3.5 px-4">المحافظة / المركز</th>
                  <th className="py-3.5 px-4 text-center">الطلبات</th>
                  <th className="py-3.5 px-4">إجمالي الإنفاق</th>
                  <th className="py-3.5 px-4">آخر طلب</th>
                  <th className="py-3.5 px-4">حالة الحساب</th>
                  <th className="py-3.5 px-4">تصنيف الثقة</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {customers.map((cust) => (
                  <tr
                    key={cust.id}
                    className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                    onClick={() => handleOpenDetails(cust)}
                  >
                    {/* Customer Info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 text-slate-300 font-bold flex items-center justify-center text-xs border border-slate-700 shrink-0">
                          {cust.customer_name ? cust.customer_name.charAt(0) : 'ع'}
                        </div>
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-100 flex items-center gap-1.5">
                            <span>{cust.customer_name}</span>
                            {cust.orders_count > 1 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                                متكرر ({cust.orders_count})
                              </span>
                            )}
                          </div>
                          {cust.email && (
                            <p className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-500" />
                              <span className="truncate max-w-[150px] font-mono">{cust.email}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Phone with copy */}
                    <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-slate-300 text-xs font-semibold">
                          {cust.customer_phone || '—'}
                        </span>
                        {cust.customer_phone && (
                          <button
                            onClick={(e) => handleCopyPhone(cust.customer_phone, e)}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition"
                            title="نسخ رقم الهاتف"
                          >
                            {copiedPhone === cust.customer_phone ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-200">
                          {cust.governorate_name || '—'} {cust.markaz_name ? `• ${cust.markaz_name}` : ''}
                        </div>
                        {cust.detailed_address && (
                          <p className="text-[11px] text-slate-400 truncate max-w-[180px]" title={cust.detailed_address}>
                            {cust.detailed_address}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Orders Summary */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <span
                          className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono font-bold"
                          title="إجمالي الطلبات"
                        >
                          {cust.orders_count}
                        </span>
                        {cust.completed_orders_count > 0 && (
                          <span
                            className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold text-[10px] border border-emerald-500/20"
                            title="مكتمل"
                          >
                            ✓ {cust.completed_orders_count}
                          </span>
                        )}
                        {cust.cancelled_orders_count > 0 && (
                          <span
                            className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-mono font-bold text-[10px] border border-rose-500/20"
                            title="ملغي"
                          >
                            ✕ {cust.cancelled_orders_count}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Total Spent */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-black text-emerald-400 text-xs">
                        {cust.total_spent.toLocaleString('ar-EG')} ج.م
                      </span>
                    </td>

                    {/* Last Order */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <span className="text-[11px] text-slate-400 block font-mono">
                          {formatDate(cust.last_order_date)}
                        </span>
                        {cust.last_order_status && getOrderStatusBadge(cust.last_order_status)}
                      </div>
                    </td>

                    {/* Account Status */}
                    <td className="py-3.5 px-4">
                      {cust.account_status === 'registered' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          مسجل بالتطبيق
                        </span>
                      ) : cust.account_status === 'blocked' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                          محظور
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                          طلب مباشر
                        </span>
                      )}
                    </td>

                    {/* Trust Status (Mandatory: Unclassified) */}
                    <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800/80 text-slate-300 border border-slate-700">
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                        <span>غير مصنف</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenDetails(cust)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-200 text-xs font-bold transition shadow-sm border border-slate-700 active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-400 group-hover:text-white" />
                        <span>التفاصيل</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs text-slate-400">
              عرض {(page - 1) * pageSize + 1} إلى {Math.min(page * pageSize, totalCount)} من إجمالي {totalCount} عميل
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition ${
                    page === p
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. Customer Details Modal */}
      {/* ------------------------------------------------------------- */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedCustomer(null)}
        >
          <div
            className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 bg-slate-950/40 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-inner shrink-0">
                  <User className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-black text-white">{selectedCustomer.customer_name}</h2>
                    {selectedCustomer.account_status === 'registered' ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                        حساب مسجل في التطبيق
                      </span>
                    ) : selectedCustomer.account_status === 'blocked' ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20">
                        حساب محظور
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
                        طلب مباشر (عبر الهاتف)
                      </span>
                    )}
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700">
                      تصنيف الثقة: غير مصنف
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 font-mono">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      {selectedCustomer.customer_phone}
                    </span>
                    {selectedCustomer.email && (
                      <span className="flex items-center gap-1 font-mono">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        {selectedCustomer.email}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {selectedCustomer.governorate_name} • {selectedCustomer.markaz_name}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedCustomer(null)}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 overscroll-contain">
              {/* Order Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
                  <span className="text-[11px] text-slate-400 font-medium">إجمالي الطلبات</span>
                  <div className="text-xl font-black text-white font-mono mt-1">
                    {selectedCustomer.orders_count}
                  </div>
                </div>

                <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
                  <span className="text-[11px] text-slate-400 font-medium">الطلبات المكتملة</span>
                  <div className="text-xl font-black text-emerald-400 font-mono mt-1">
                    {selectedCustomer.completed_orders_count}
                  </div>
                </div>

                <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
                  <span className="text-[11px] text-slate-400 font-medium">الطلبات الملغاة</span>
                  <div className="text-xl font-black text-rose-400 font-mono mt-1">
                    {selectedCustomer.cancelled_orders_count}
                  </div>
                </div>

                <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
                  <span className="text-[11px] text-slate-400 font-medium">إجمالي الإنفاق</span>
                  <div className="text-xl font-black text-emerald-400 font-mono mt-1">
                    {selectedCustomer.total_spent.toLocaleString('ar-EG')} ج.م
                  </div>
                </div>
              </div>

              {/* Administrative Compliance Notice (Read-Only Status Banner) */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1 text-xs">
                  <h4 className="font-bold text-slate-200">الضوابط الإدارية وحالة الثقة</h4>
                  <p className="text-slate-400 leading-relaxed">
                    حالة العميل معروضة حالياً للقراءة والمتابعة التشغيلية. لا يُعتبر العميل غير موثوق لمجرد وجود طلب
                    ملغي أو مرفوض. يتطلب تفعيل إجراءات التحذير أو الحظر أو إنذارات عدم المصداقية اعتماد RPCs أمنية
                    وجداول مخصصة لسجل التحذيرات ونظام إشعارات يربط الرسالة بتطبيق العميل مباشرة.
                  </p>
                </div>
              </div>

              {/* Location & Account Details */}
              <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  بيانات العنوان والتسجيل
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">العنوان المسجل:</span>
                    <p className="text-slate-200 font-semibold mt-0.5 break-words">
                      {selectedCustomer.detailed_address || 'لم يُحدد عنوان تفصيلي'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">المحافظة والمركز:</span>
                    <p className="text-slate-200 font-semibold mt-0.5">
                      {selectedCustomer.governorate_name} • {selectedCustomer.markaz_name}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">تاريخ أول طلب / إنشاء الحساب:</span>
                    <p className="text-slate-200 font-mono mt-0.5">
                      {formatDate(selectedCustomer.account_created_at)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">تاريخ آخر طلب:</span>
                    <p className="text-slate-200 font-mono mt-0.5">
                      {formatDate(selectedCustomer.last_order_date)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer Orders History Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-emerald-400" />
                    سجل طلبات الدليفري للعميل ({customerOrders.length})
                  </h3>
                </div>

                {isLoadingDetails ? (
                  <div className="p-8 text-center space-y-2 bg-slate-950/40 rounded-2xl border border-slate-800">
                    <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
                    <p className="text-xs text-slate-400">جاري تحميل سجل الطلبات...</p>
                  </div>
                ) : customerOrders.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800">
                    لا توجد طلبات مسجلة لهذا العميل.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-800 overflow-x-auto">
                    <table className="w-full text-right text-xs min-w-[540px]">
                      <thead>
                        <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                          <th className="py-2.5 px-3">رقم الطلب</th>
                          <th className="py-2.5 px-3">التاريخ</th>
                          <th className="py-2.5 px-3">الإجمالي</th>
                          <th className="py-2.5 px-3">الدليفري المسند</th>
                          <th className="py-2.5 px-3">الحالة</th>
                          <th className="py-2.5 px-3">ملاحظات / سبب الإلغاء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-950/30">
                        {customerOrders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-slate-800/30 transition">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-200">
                              {ord.order_number || ord.id.slice(0, 8)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                              {formatDate(ord.created_at)}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                              {Number(ord.total_amount).toLocaleString('ar-EG')} ج.م
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">
                              {ord.driver ? (
                                <span className="font-semibold text-slate-200">{ord.driver.full_name}</span>
                              ) : (
                                <span className="text-slate-500 italic">غير مسند</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">{getOrderStatusBadge(ord.status)}</td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-400">
                              {ord.cancellation_reason ? (
                                <span className="text-rose-400 font-semibold" title={ord.cancellation_reason}>
                                  سبب الإلغاء: {ord.cancellation_reason}
                                </span>
                              ) : ord.delivery_notes ? (
                                <span className="truncate max-w-[200px] block" title={ord.delivery_notes}>
                                  {ord.delivery_notes}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/95 backdrop-blur shrink-0 sticky bottom-0 z-10">
              <span className="text-xs text-slate-500 truncate max-w-[65%]">
                معرف السجل: <code className="font-mono text-slate-400">{selectedCustomer.id}</code>
              </span>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
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
