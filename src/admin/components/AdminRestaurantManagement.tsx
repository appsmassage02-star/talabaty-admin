import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdmin } from '../context/AdminContext';
import { restaurantAdminService } from '../services/restaurantAdminService';
import {
  Restaurant,
  RestaurantCategory,
  RestaurantMenuCategory,
  RestaurantMenuItem,
  RestaurantItemOption,
  RestaurantItemOptionValue,
  RestaurantOffer,
  RestaurantOrder,
  RestaurantDeliveryOrder,
  RestaurantInvoice,
  RestaurantFinancialTransaction,
  RestaurantSettlement,
  RestaurantCollectionReceipt,
  RestaurantComplaint,
  RestaurantOwnershipHistory,
  RestaurantSectionSettings,
  RestaurantOverviewStats,
} from '../types/restaurantAdminTypes';
import {
  UtensilsCrossed,
  Store,
  Tag,
  BookOpen,
  ListPlus,
  Percent,
  PackageCheck,
  Bike,
  Receipt,
  Wallet,
  AlertTriangle,
  Sliders,
  RefreshCw,
  Search,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  Save,
  MapPin,
  Phone,
  DollarSign,
  Layers,
  Clock,
  User,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Coins,
  FileText,
  Percent as PercentIcon,
  Check,
  Ban,
  Building,
} from 'lucide-react';

export type RestaurantNavTab =
  | 'restaurant_overview'
  | 'restaurant_restaurants'
  | 'restaurant_categories'
  | 'restaurant_menu'
  | 'restaurant_options'
  | 'restaurant_offers'
  | 'restaurant_orders'
  | 'restaurant_delivery'
  | 'restaurant_invoices'
  | 'restaurant_settlements'
  | 'restaurant_complaints'
  | 'restaurant_settings';

const TABS: { id: RestaurantNavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'restaurant_overview', label: 'نظرة عامة', icon: UtensilsCrossed },
  { id: 'restaurant_restaurants', label: 'المطاعم', icon: Store },
  { id: 'restaurant_categories', label: 'تصنيفات المطاعم', icon: Tag },
  { id: 'restaurant_menu', label: 'قوائم الطعام والأصناف', icon: BookOpen },
  { id: 'restaurant_options', label: 'الإضافات والاختيارات', icon: ListPlus },
  { id: 'restaurant_offers', label: 'العروض والخصومات', icon: Percent },
  { id: 'restaurant_orders', label: 'طلبات المطاعم', icon: PackageCheck },
  { id: 'restaurant_delivery', label: 'عمليات التوصيل', icon: Bike },
  { id: 'restaurant_invoices', label: 'الفواتير', icon: Receipt },
  { id: 'restaurant_settlements', label: 'الحسابات والتسويات', icon: Wallet },
  { id: 'restaurant_complaints', label: 'الشكاوى', icon: AlertTriangle },
  { id: 'restaurant_settings', label: 'إعدادات القسم', icon: Sliders },
];

export const AdminRestaurantManagement: React.FC = () => {
  const { activeSection, setActiveSection, showToast, hasPermission } = useAdmin();

  // Active Tab synchronized with navigation sidebar
  const currentTab: RestaurantNavTab = useMemo(() => {
    const matched = TABS.find((t) => t.id === activeSection);
    return matched ? matched.id : 'restaurant_overview';
  }, [activeSection]);

  const handleTabChange = (tabId: RestaurantNavTab) => {
    setActiveSection(tabId);
  };

  // =========================================================================
  // GLOBAL RESTAURANT STATE
  // =========================================================================
  const [stats, setStats] = useState<RestaurantOverviewStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [categories, setCategories] = useState<RestaurantCategory[]>([]);
  const [menuCategories, setMenuCategories] = useState<RestaurantMenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<RestaurantMenuItem[]>([]);
  const [options, setOptions] = useState<RestaurantItemOption[]>([]);
  const [offers, setOffers] = useState<RestaurantOffer[]>([]);
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [deliveryOrders, setDeliveryOrders] = useState<RestaurantDeliveryOrder[]>([]);
  const [invoices, setInvoices] = useState<RestaurantInvoice[]>([]);
  const [transactions, setTransactions] = useState<RestaurantFinancialTransaction[]>([]);
  const [settlements, setSettlements] = useState<RestaurantSettlement[]>([]);
  const [complaints, setComplaints] = useState<RestaurantComplaint[]>([]);
  const [ownershipHistory, setOwnershipHistory] = useState<RestaurantOwnershipHistory[]>([]);
  const [sectionSettings, setSectionSettings] = useState<RestaurantSectionSettings | null>(null);

  // Common UI State
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRestaurantFilter, setSelectedRestaurantFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals & Details State
  const [activeOrderDetails, setActiveOrderDetails] = useState<RestaurantOrder | null>(null);
  const [isLoadingOrderDetails, setIsLoadingOrderDetails] = useState(false);

  const [isRestaurantModalOpen, setIsRestaurantModalOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Partial<Restaurant> & { category_ids?: string[] } | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Partial<RestaurantCategory> | null>(null);

  const [isMenuCategoryModalOpen, setIsMenuCategoryModalOpen] = useState(false);
  const [editingMenuCategory, setEditingMenuCategory] = useState<Partial<RestaurantMenuCategory> | null>(null);

  const [isMenuItemModalOpen, setIsMenuItemModalOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<Partial<RestaurantMenuItem> | null>(null);

  const [isOptionModalOpen, setIsOptionModalOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<Partial<RestaurantItemOption> & { valuesList?: Partial<RestaurantItemOptionValue>[] } | null>(null);

  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Partial<RestaurantOffer> | null>(null);

  const [resolvingComplaint, setResolvingComplaint] = useState<RestaurantComplaint | null>(null);
  const [complaintResolutionNote, setComplaintResolutionNote] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  // =========================================================================
  // DATA LOADERS
  // =========================================================================
  const loadStats = useCallback(async () => {
    setIsLoadingStats(true);
    const res = await restaurantAdminService.getOverviewStats();
    if (res.stats) setStats(res.stats);
    setIsLoadingStats(false);
  }, []);

  const loadRestaurants = useCallback(async () => {
    setIsLoading(true);
    const res = await restaurantAdminService.getRestaurants({
      search: searchQuery,
      isActive: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : 'all',
      isOpen: statusFilter === 'open' ? true : statusFilter === 'closed' ? false : 'all',
    });
    if (res.error) showToast(res.error, 'error');
    setRestaurants(res.restaurants || []);
    setIsLoading(false);
  }, [searchQuery, statusFilter, showToast]);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    const res = await restaurantAdminService.getCategories();
    if (res.error) showToast(res.error, 'error');
    setCategories(res.categories || []);
    setIsLoading(false);
  }, [showToast]);

  const loadMenu = useCallback(async () => {
    setIsLoading(true);
    const [mcRes, miRes] = await Promise.all([
      restaurantAdminService.getMenuCategories(selectedRestaurantFilter),
      restaurantAdminService.getMenuItems({
        restaurantId: selectedRestaurantFilter,
        search: searchQuery,
      }),
    ]);
    if (mcRes.error) showToast(mcRes.error, 'error');
    if (miRes.error) showToast(miRes.error, 'error');
    setMenuCategories(mcRes.menuCategories || []);
    setMenuItems(miRes.menuItems || []);
    setIsLoading(false);
  }, [selectedRestaurantFilter, searchQuery, showToast]);

  const loadOptions = useCallback(async () => {
    setIsLoading(true);
    const res = await restaurantAdminService.getItemOptions(undefined, selectedRestaurantFilter);
    if (res.error) showToast(res.error, 'error');
    setOptions(res.options || []);
    setIsLoading(false);
  }, [selectedRestaurantFilter, showToast]);

  const loadOffers = useCallback(async () => {
    setIsLoading(true);
    const res = await restaurantAdminService.getOffers(selectedRestaurantFilter);
    if (res.error) showToast(res.error, 'error');
    setOffers(res.offers || []);
    setIsLoading(false);
  }, [selectedRestaurantFilter, showToast]);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    const res = await restaurantAdminService.getOrders({
      restaurantId: selectedRestaurantFilter,
      status: statusFilter,
      search: searchQuery,
    });
    if (res.error) showToast(res.error, 'error');
    setOrders(res.orders || []);
    setIsLoading(false);
  }, [selectedRestaurantFilter, statusFilter, searchQuery, showToast]);

  const loadDelivery = useCallback(async () => {
    setIsLoading(true);
    const res = await restaurantAdminService.getDeliveryOrders({
      status: statusFilter,
    });
    if (res.error) showToast(res.error, 'error');
    setDeliveryOrders(res.deliveryOrders || []);
    setIsLoading(false);
  }, [statusFilter, showToast]);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    const res = await restaurantAdminService.getInvoices({
      status: statusFilter,
      search: searchQuery,
    });
    if (res.error) showToast(res.error, 'error');
    setInvoices(res.invoices || []);
    setIsLoading(false);
  }, [statusFilter, searchQuery, showToast]);

  const loadSettlements = useCallback(async () => {
    setIsLoading(true);
    const [txRes, setRes] = await Promise.all([
      restaurantAdminService.getFinancialTransactions({ restaurantId: selectedRestaurantFilter }),
      restaurantAdminService.getSettlements({ restaurantId: selectedRestaurantFilter, status: statusFilter }),
    ]);
    if (txRes.error) showToast(txRes.error, 'error');
    if (setRes.error) showToast(setRes.error, 'error');
    setTransactions(txRes.transactions || []);
    setSettlements(setRes.settlements || []);
    setIsLoading(false);
  }, [selectedRestaurantFilter, statusFilter, showToast]);

  const loadComplaints = useCallback(async () => {
    setIsLoading(true);
    const res = await restaurantAdminService.getComplaints({
      restaurantId: selectedRestaurantFilter,
      status: statusFilter,
    });
    if (res.error) showToast(res.error, 'error');
    setComplaints(res.complaints || []);
    setIsLoading(false);
  }, [selectedRestaurantFilter, statusFilter, showToast]);

  const loadSettingsAndHistory = useCallback(async () => {
    setIsLoading(true);
    const [secRes, ownRes] = await Promise.all([
      restaurantAdminService.getSectionSettings(),
      restaurantAdminService.getOwnershipHistory(selectedRestaurantFilter),
    ]);
    if (secRes.error) showToast(secRes.error, 'error');
    if (ownRes.error) showToast(ownRes.error, 'error');
    setSectionSettings(secRes.settings || null);
    setOwnershipHistory(ownRes.history || []);
    setIsLoading(false);
  }, [selectedRestaurantFilter, showToast]);

  // Main Effect to route active tab loading
  useEffect(() => {
    loadStats();
    // Preload restaurants list for dropdowns
    restaurantAdminService.getRestaurants().then((r) => {
      if (r.restaurants) setRestaurants(r.restaurants);
    });
    // Preload categories list
    restaurantAdminService.getCategories().then((c) => {
      if (c.categories) setCategories(c.categories);
    });
  }, [loadStats]);

  useEffect(() => {
    switch (currentTab) {
      case 'restaurant_overview':
        loadStats();
        break;
      case 'restaurant_restaurants':
        loadRestaurants();
        break;
      case 'restaurant_categories':
        loadCategories();
        break;
      case 'restaurant_menu':
        loadMenu();
        break;
      case 'restaurant_options':
        loadOptions();
        break;
      case 'restaurant_offers':
        loadOffers();
        break;
      case 'restaurant_orders':
        loadOrders();
        break;
      case 'restaurant_delivery':
        loadDelivery();
        break;
      case 'restaurant_invoices':
        loadInvoices();
        break;
      case 'restaurant_settlements':
        loadSettlements();
        break;
      case 'restaurant_complaints':
        loadComplaints();
        break;
      case 'restaurant_settings':
        loadSettingsAndHistory();
        break;
    }
  }, [
    currentTab,
    loadStats,
    loadRestaurants,
    loadCategories,
    loadMenu,
    loadOptions,
    loadOffers,
    loadOrders,
    loadDelivery,
    loadInvoices,
    loadSettlements,
    loadComplaints,
    loadSettingsAndHistory,
  ]);

  // Open Order Details Modal
  const handleOpenOrderDetails = async (orderId: string) => {
    setIsLoadingOrderDetails(true);
    const res = await restaurantAdminService.getOrderDetails(orderId);
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      setActiveOrderDetails(res.order);
    }
    setIsLoadingOrderDetails(false);
  };

  // Helper formatting currency
  const formatCurrency = (val: number | string | null | undefined) => {
    const num = Number(val || 0);
    return `${num.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م`;
  };

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ar-EG', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6 pb-16" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-950/30 shrink-0">
              <UtensilsCrossed className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  إدارة المطاعم والأكلات الجاهزة
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  لوحة التحكم المتكاملة
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                التحكم المركزي في المطاعم، القوائم، الأصناف، الطلبات، التوصيل، الحسابات والشكاوى
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              onClick={() => {
                loadStats();
                switch (currentTab) {
                  case 'restaurant_restaurants': loadRestaurants(); break;
                  case 'restaurant_categories': loadCategories(); break;
                  case 'restaurant_menu': loadMenu(); break;
                  case 'restaurant_options': loadOptions(); break;
                  case 'restaurant_offers': loadOffers(); break;
                  case 'restaurant_orders': loadOrders(); break;
                  case 'restaurant_delivery': loadDelivery(); break;
                  case 'restaurant_invoices': loadInvoices(); break;
                  case 'restaurant_settlements': loadSettlements(); break;
                  case 'restaurant_complaints': loadComplaints(); break;
                  case 'restaurant_settings': loadSettingsAndHistory(); break;
                }
                showToast('تم تحديث البيانات من قاعدة البيانات', 'info');
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-700 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isLoadingStats ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </button>
          </div>
        </div>

        {/* Scrollable Sub-Navigation Tabs */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          TAB 1: OVERVIEW (نظرة عامة)
          ===================================================================== */}
      {currentTab === 'restaurant_overview' && (
        <div className="space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>إجمالي المطاعم</span>
                <Store className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {stats?.totalRestaurants ?? 0}
              </div>
              <div className="text-[11px] text-emerald-400 font-medium">
                {stats?.activeRestaurants ?? 0} نشط • {stats?.openRestaurants ?? 0} مفتوح حالياً
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>إجمالي الطلبات</span>
                <PackageCheck className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {stats?.totalOrders ?? 0}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                {stats?.pendingOrders ?? 0} بانتظار المراجعة • {stats?.activeOrders ?? 0} جاري
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>مبيعات الطعام المكتملة</span>
                <Coins className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                {formatCurrency(stats?.totalSales)}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                رسوم التوصيل: {formatCurrency(stats?.totalDeliveryFees)}
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>الشكاوى المفتوحة</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-black text-rose-400 font-mono">
                {stats?.pendingComplaints ?? 0}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                {stats?.activeOffers ?? 0} عروض وخصومات سارية
              </div>
            </div>
          </div>

          {/* Quick Access Action Shortcuts */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>الوصول السريع لمهام قسم المطاعم</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              <button
                onClick={() => {
                  setEditingRestaurant({});
                  setIsRestaurantModalOpen(true);
                }}
                className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/60 transition text-right flex items-center gap-3 cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">إضافة مطعم جديد</div>
                  <div className="text-[10px] text-slate-500">تسجيل وتحديد الموقع والعمولة</div>
                </div>
              </button>

              <button
                onClick={() => handleTabChange('restaurant_orders')}
                className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800/60 transition text-right flex items-center gap-3 cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition">
                  <PackageCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">متابعة الطلبات الحية</div>
                  <div className="text-[10px] text-slate-500">مراجعة الحالات والتأكيد</div>
                </div>
              </button>

              <button
                onClick={() => handleTabChange('restaurant_menu')}
                className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/60 transition text-right flex items-center gap-3 cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">قوائم الطعام والأسعار</div>
                  <div className="text-[10px] text-slate-500">الأصناف والتوافر والإضافات</div>
                </div>
              </button>

              <button
                onClick={() => handleTabChange('restaurant_settlements')}
                className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-800/60 transition text-right flex items-center gap-3 cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">التسويات المالية</div>
                  <div className="text-[10px] text-slate-500">حسابات المطاعم والتحصيل</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: RESTAURANTS (المطاعم)
          ===================================================================== */}
      {currentTab === 'restaurant_restaurants' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو الهاتف أو العنوان..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500/50"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none"
              >
                <option value="all">كل الحالات</option>
                <option value="active">النشطة فقط</option>
                <option value="inactive">المعطلة</option>
                <option value="open">المفتوحة حالياً</option>
                <option value="closed">المغلقة حالياً</option>
              </select>
            </div>

            <button
              onClick={() => {
                setEditingRestaurant({
                  name: '',
                  phone: '',
                  address: '',
                  latitude: 30.0444,
                  longitude: 31.2357,
                  is_active: true,
                  is_open: true,
                  max_delivery_radius_km: 15,
                  commission_percent: 10,
                  delivery_fee: 15,
                  food_money_settlement_mode: 'periodic_settlement',
                  category_ids: [],
                });
                setIsRestaurantModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مطعم</span>
            </button>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span>جاري تحميل بيانات المطاعم من Supabase...</span>
            </div>
          ) : restaurants.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
              <Store className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">لم يتم العثور على أي مطاعم مسجلة</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                يمكنك الآن تسجيل أول مطعم في النظام وتحديد نطاق التوصيل ونسبة العمولة.
              </p>
              <button
                onClick={() => {
                  setEditingRestaurant({});
                  setIsRestaurantModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مطعم جديد</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {restaurants.map((rest) => (
                <div
                  key={rest.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 space-y-3.5 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {rest.image_url ? (
                        <img
                          src={rest.image_url}
                          alt={rest.name}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-800 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                          <Store className="w-6 h-6 text-amber-400" />
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-white leading-snug">{rest.name}</h4>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span dir="ltr">{rest.phone}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                          rest.is_active
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {rest.is_active ? 'نشط' : 'معطل'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                          rest.is_open
                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {rest.is_open ? 'مفتوح' : 'مغلق'}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 line-clamp-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 inline ml-1" />
                    <span>{rest.address}</span>
                  </div>

                  {/* Categories Pills */}
                  {rest.categories && rest.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {rest.categories.map((c) => (
                        <span
                          key={c.id}
                          className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700"
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <div>
                      <span>العمولة: </span>
                      <span className="font-bold text-slate-200">{rest.commission_percent}%</span>
                    </div>
                    <div>
                      <span>نطاق التوصيل: </span>
                      <span className="font-bold text-slate-200">{rest.max_delivery_radius_km} كم</span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      onClick={async () => {
                        const res = await restaurantAdminService.toggleRestaurantOpen(rest.id, rest.is_open);
                        if (res.success) {
                          showToast('تم تحديث حالة الفتح بنجاح', 'success');
                          loadRestaurants();
                        } else {
                          showToast(res.error || 'تعذر تحديث الحالة', 'error');
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold cursor-pointer"
                    >
                      {rest.is_open ? 'إغلاق مؤقت' : 'فتح المطعم'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingRestaurant({
                          ...rest,
                          category_ids: rest.categories?.map((c) => c.id) || [],
                        });
                        setIsRestaurantModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>تعديل</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: CATEGORIES (تصنيفات المطاعم)
          ===================================================================== */}
      {currentTab === 'restaurant_categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200">تصنيفات ومطابخ المطاعم</h3>
            <button
              onClick={() => {
                setEditingCategory({
                  name: '',
                  sort_order: categories.length + 1,
                  is_active: true,
                });
                setIsCategoryModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة تصنيف</span>
            </button>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span>جاري تحميل التصنيفات...</span>
            </div>
          ) : categories.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
              <Tag className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">لا توجد تصنيفات مطاعم حتى الآن</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                أضف تصنيفات مثل: مأكولات شرقية، برجر وسندوتشات، بيتزا، مشويات...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 font-mono">
                      ترتيب #{cat.sort_order}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        cat.is_active
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {cat.is_active ? 'نشط' : 'معطل'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {cat.image_url ? (
                      <img
                        src={cat.image_url}
                        alt={cat.name}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-800"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                        <Tag className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-bold text-white">{cat.name}</h4>
                      <p className="text-xs text-slate-400">
                        {cat.restaurants_count ?? 0} مطاعم مرتبطة
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingCategory(cat);
                        setIsCategoryModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`هل أنت متأكد من حذف التصنيف "${cat.name}"؟`)) return;
                        const res = await restaurantAdminService.deleteCategory(cat.id);
                        if (res.success) {
                          showToast('تم حذف التصنيف بنجاح', 'success');
                          loadCategories();
                        } else {
                          showToast(res.error || 'تعذر حذف التصنيف', 'error');
                        }
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 4: MENU & ITEMS (قوائم الطعام والأصناف)
          ===================================================================== */}
      {currentTab === 'restaurant_menu' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <select
                value={selectedRestaurantFilter}
                onChange={(e) => setSelectedRestaurantFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none"
              >
                <option value="all">كل المطاعم</option>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ابحث في الأصناف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditingMenuCategory({
                    restaurant_id: selectedRestaurantFilter !== 'all' ? selectedRestaurantFilter : (restaurants[0]?.id || ''),
                    name: '',
                    sort_order: 1,
                    is_active: true,
                  });
                  setIsMenuCategoryModalOpen(true);
                }}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-slate-700"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة قسم قائمة</span>
              </button>

              <button
                onClick={() => {
                  setEditingMenuItem({
                    restaurant_id: selectedRestaurantFilter !== 'all' ? selectedRestaurantFilter : (restaurants[0]?.id || ''),
                    category_id: menuCategories[0]?.id || '',
                    name: '',
                    description: '',
                    price: 50,
                    is_available: true,
                    sort_order: 1,
                  });
                  setIsMenuItemModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة صنف</span>
              </button>
            </div>
          </div>

          {/* Menu Categories Bar */}
          {menuCategories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs text-slate-500 shrink-0">الأقسام:</span>
              {menuCategories.map((mc) => (
                <div
                  key={mc.id}
                  className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center gap-2 shrink-0"
                >
                  <span>{mc.name}</span>
                  <button
                    onClick={() => {
                      setEditingMenuCategory(mc);
                      setIsMenuCategoryModalOpen(true);
                    }}
                    className="text-slate-500 hover:text-amber-400"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span>جاري تحميل الأصناف وقوائم الطعام...</span>
            </div>
          ) : menuItems.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
              <BookOpen className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">لا توجد أصناف في هذه القائمة</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                تأكد من اختيار مطعم وإنشاء قسم قائمة طعام، ثم أضف الأصناف والأسعار.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-800 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                          <BookOpen className="w-6 h-6 text-amber-400" />
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-white">{item.name}</h4>
                        <div className="text-[11px] text-amber-400 font-semibold mt-0.5">
                          {item.restaurant_name} • {item.category_name}
                        </div>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <div className="text-sm font-black text-emerald-400 font-mono">
                        {formatCurrency(item.price)}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold mt-1 inline-block ${
                          item.is_available
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-rose-500/15 text-rose-300'
                        }`}
                      >
                        {item.is_available ? 'متاح' : 'غير متوفر'}
                      </span>
                    </div>
                  </div>

                  {item.description && (
                    <p className="text-xs text-slate-400 line-clamp-2">{item.description}</p>
                  )}

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {item.options_count ?? 0} مجموعات إضافات
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingMenuItem(item);
                          setIsMenuItemModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>تعديل</span>
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`هل أنت متأكد من حذف الصنف "${item.name}"؟`)) return;
                          const res = await restaurantAdminService.deleteMenuItem(item.id);
                          if (res.success) {
                            showToast('تم حذف الصنف بنجاح', 'success');
                            loadMenu();
                          } else {
                            showToast(res.error || 'تعذر حذف الصنف', 'error');
                          }
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 5: OPTIONS & ADDONS (الإضافات والاختيارات)
          ===================================================================== */}
      {currentTab === 'restaurant_options' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <select
                value={selectedRestaurantFilter}
                onChange={(e) => setSelectedRestaurantFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none"
              >
                <option value="all">كل المطاعم</option>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                setEditingOption({
                  restaurant_id: selectedRestaurantFilter !== 'all' ? selectedRestaurantFilter : (restaurants[0]?.id || ''),
                  menu_item_id: menuItems[0]?.id || '',
                  name: '',
                  required: false,
                  min_select: 0,
                  max_select: 1,
                  sort_order: 1,
                  valuesList: [],
                });
                setIsOptionModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مجموعة اختيارات</span>
            </button>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span>جاري تحميل مجموعات الاختيارات...</span>
            </div>
          ) : options.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
              <ListPlus className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">لا توجد مجموعات اختيارات مسجلة</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                يمكنك ربط كل صنف بمجموعات اختيارات مثل: الحجم (صغير، وسط، كبير) أو إضافات الجبنة والصلصة.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {options.map((opt) => (
                <div
                  key={opt.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white">{opt.name}</h4>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        opt.required
                          ? 'bg-rose-500/15 text-rose-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {opt.required ? 'إلزامي' : 'اختياري'} (من {opt.min_select} إلى {opt.max_select})
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] text-slate-500 font-semibold">قيم المجموعة:</div>
                    {opt.values && opt.values.length > 0 ? (
                      <div className="space-y-1">
                        {opt.values.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
                          >
                            <span className="text-slate-200">{v.name}</span>
                            <span className="font-mono font-bold text-emerald-400">
                              {v.extra_price > 0 ? `+${formatCurrency(v.extra_price)}` : 'مجاناً'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic">لا توجد قيم محددة بعد</div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingOption(opt);
                        setIsOptionModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>تعديل المجموعة</span>
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`هل أنت متأكد من حذف مجموعة الاختيارات "${opt.name}"؟`)) return;
                        const res = await restaurantAdminService.deleteItemOption(opt.id);
                        if (res.success) {
                          showToast('تم حذف المجموعة بنجاح', 'success');
                          loadOptions();
                        } else {
                          showToast(res.error || 'تعذر حذف المجموعة', 'error');
                        }
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 6: OFFERS (العروض والخصومات)
          ===================================================================== */}
      {currentTab === 'restaurant_offers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200">عروض وخصومات المطاعم</h3>
            <button
              onClick={() => {
                setEditingOffer({
                  restaurant_id: selectedRestaurantFilter !== 'all' ? selectedRestaurantFilter : (restaurants[0]?.id || ''),
                  title: '',
                  description: '',
                  discount_type: 'percentage',
                  discount_value: 15,
                  starts_at: new Date().toISOString().slice(0, 10),
                  ends_at: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
                  is_active: true,
                });
                setIsOfferModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة عرض جديد</span>
            </button>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span>جاري تحميل العروض...</span>
            </div>
          ) : offers.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
              <PercentIcon className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">لا توجد عروض ترويجية نشطة</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                أنشئ عروض خصم بنسبة مئوية أو قيمة ثابتة مع تحديد تواريخ البداية والنهاية.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{offer.title}</h4>
                      <div className="text-xs text-amber-400 mt-0.5">{offer.restaurant_name}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        offer.is_active
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {offer.is_active ? 'نشط' : 'معطل'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400">قيمة الخصم:</span>
                    <span className="text-base font-black text-emerald-400 font-mono">
                      {offer.discount_type === 'percentage'
                        ? `${offer.discount_value}%`
                        : formatCurrency(offer.discount_value)}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-1">
                    <div>من: {formatDate(offer.starts_at)}</div>
                    <div>إلى: {formatDate(offer.ends_at)}</div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingOffer(offer);
                        setIsOfferModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>تعديل</span>
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`هل أنت متأكد من حذف العرض "${offer.title}"؟`)) return;
                        const res = await restaurantAdminService.deleteOffer(offer.id);
                        if (res.success) {
                          showToast('تم حذف العرض بنجاح', 'success');
                          loadOffers();
                        } else {
                          showToast(res.error || 'تعذر حذف العرض', 'error');
                        }
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 7: ORDERS (طلبات المطاعم)
          ===================================================================== */}
      {currentTab === 'restaurant_orders' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ابحث برقم الطلب، العميل، الهاتف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none"
              >
                <option value="all">كل الحالات</option>
                <option value="pending">قيد الانتظار</option>
                <option value="restaurant_confirmed">تم تأكيد المطعم</option>
                <option value="cooking">جاري التحضير</option>
                <option value="ready_for_pickup">جاهز للاستلام</option>
                <option value="in_delivery">جاري التوصيل</option>
                <option value="completed">مكتمل ومسلم</option>
                <option value="cancelled">ملغي</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span>جاري تحميل طلبات المطاعم من Supabase...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
              <PackageCheck className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">لا توجد طلبات مطاعم مطابقة</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                ستظهر هنا فوراً الطلبات المقدمة من عملاء التطبيق لجميع المطاعم.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">رقم الطلب</th>
                      <th className="py-3 px-4">المطعم</th>
                      <th className="py-3 px-4">العميل</th>
                      <th className="py-3 px-4">العنوان</th>
                      <th className="py-3 px-4">الإجمالي</th>
                      <th className="py-3 px-4">الحالة</th>
                      <th className="py-3 px-4">التاريخ</th>
                      <th className="py-3 px-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">
                          {ord.order_number}
                        </td>
                        <td className="py-3 px-4 font-bold text-white">
                          {ord.restaurant_name_snapshot || 'مطعم'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-200">{ord.customer_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono" dir="ltr">
                            {ord.customer_phone}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                          {ord.delivery_address}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                          {formatCurrency(ord.customer_total)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {formatDate(ord.created_at)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleOpenOrderDetails(ord.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>التفاصيل</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 8: DELIVERY (عمليات التوصيل)
          ===================================================================== */}
      {currentTab === 'restaurant_delivery' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200">عمليات توصيل طلبات المطاعم</h3>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span>جاري تحميل عمليات التوصيل...</span>
            </div>
          ) : deliveryOrders.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
              <Bike className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">لا توجد عمليات توصيل حالية</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deliveryOrders.map((d) => (
                <div key={d.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-amber-400 text-xs">
                      {d.order_number || `طلب #${d.order_id.slice(0, 6)}`}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300">
                      {d.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-300 space-y-1">
                    <div>
                      <span className="text-slate-500">العميل: </span>
                      {d.customer_name || 'غير محدد'}
                    </div>
                    <div>
                      <span className="text-slate-500">العنوان: </span>
                      {d.delivery_address || '—'}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>عمولة السائق:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {formatCurrency(d.driver_commission)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 9: INVOICES (الفواتير)
          ===================================================================== */}
      {currentTab === 'restaurant_invoices' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200">فواتير طلبات المطاعم</h3>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span>جاري تحميل الفواتير...</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
              <Receipt className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">لا توجد فواتير مصدرة حتى الآن</div>
            </div>
          ) : (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">رقم الفاتورة</th>
                      <th className="py-3 px-4">قيمة الطعام</th>
                      <th className="py-3 px-4">الخصم</th>
                      <th className="py-3 px-4">التوصيل</th>
                      <th className="py-3 px-4">الإجمالي الكلي</th>
                      <th className="py-3 px-4">الحالة</th>
                      <th className="py-3 px-4">تاريخ الإصدار</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">
                          {inv.invoice_number}
                        </td>
                        <td className="py-3 px-4">{formatCurrency(inv.food_subtotal)}</td>
                        <td className="py-3 px-4 text-rose-400">-{formatCurrency(inv.discount_amount)}</td>
                        <td className="py-3 px-4">{formatCurrency(inv.delivery_fee)}</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                          {formatCurrency(inv.total_amount)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{formatDate(inv.issued_at || inv.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 10: SETTLEMENTS & FINANCES (الحسابات والتسويات)
          ===================================================================== */}
      {currentTab === 'restaurant_settlements' && (
        <div className="space-y-6">
          {/* Financial Transactions List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>الحركات المالية المسجلة</span>
            </h3>

            {transactions.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl text-xs text-slate-500">
                لا توجد حركات مالية مسجلة حالياً
              </div>
            ) : (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">نوع الحركة</th>
                      <th className="py-3 px-4">المبلغ</th>
                      <th className="py-3 px-4">الاتجاه</th>
                      <th className="py-3 px-4">الحالة</th>
                      <th className="py-3 px-4">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="py-3 px-4 font-bold text-slate-200">{tx.transaction_type}</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="py-3 px-4 text-slate-400">{tx.direction}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{formatDate(tx.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Settlements History */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-purple-400" />
              <span>سجل التسويات الدورية</span>
            </h3>

            {settlements.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl text-xs text-slate-500">
                لا توجد تسويات دورية مسجلة
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {settlements.map((s) => (
                  <div key={s.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">{s.settlement_type}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                        {s.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      الفترة: {formatDate(s.period_start)} إلى {formatDate(s.period_end)}
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                      <span>المستحق: {formatCurrency(s.amount_due)}</span>
                      <span className="font-bold text-emerald-400">المدفوع: {formatCurrency(s.amount_paid)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 11: COMPLAINTS (الشكاوى)
          ===================================================================== */}
      {currentTab === 'restaurant_complaints' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200">شكاوى العملاء على المطاعم والطلبات</h3>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span>جاري تحميل الشكاوى...</span>
            </div>
          ) : complaints.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <div className="text-sm font-bold text-slate-300">لا توجد أي شكاوى مسجلة حالياً</div>
            </div>
          ) : (
            <div className="space-y-3">
              {complaints.map((c) => (
                <div key={c.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">{c.subject}</h4>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {c.restaurant_name && <span>المطعم: {c.restaurant_name} • </span>}
                        {c.order_number && <span>طلب #{c.order_number} • </span>}
                        <span>{formatDate(c.created_at)}</span>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                        c.status === 'resolved'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {c.status === 'resolved' ? 'تم الحل' : 'مفتوحة'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    {c.description}
                  </p>

                  {c.resolution_note && (
                    <div className="text-xs text-emerald-300 bg-emerald-950/30 p-3 rounded-xl border border-emerald-500/20 space-y-1">
                      <div className="font-bold">ملاحظة حل الشكوى:</div>
                      <div>{c.resolution_note}</div>
                      {c.resolved_at && <div className="text-[10px] text-slate-500">تم في: {formatDate(c.resolved_at)}</div>}
                    </div>
                  )}

                  {c.status !== 'resolved' && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => {
                          setResolvingComplaint(c);
                          setComplaintResolutionNote('');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold cursor-pointer"
                      >
                        تسجيل حل الشكوى
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 12: SETTINGS (إعدادات القسم وسجل الملكية)
          ===================================================================== */}
      {currentTab === 'restaurant_settings' && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>إعدادات قسم المطاعم العامة</span>
            </h3>

            {!sectionSettings ? (
              <div className="p-8 text-center text-xs text-slate-500">
                لم يتم العثور على سجل إعدادات القسم الحالي في جدول restaurant_section_settings.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="text-xs text-slate-400 font-bold">تفعيل القسم كاملاً</div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={async () => {
                        setIsSaving(true);
                        const res = await restaurantAdminService.updateSectionSettings(sectionSettings.id, {
                          section_enabled: !sectionSettings.section_enabled,
                        });
                        setIsSaving(false);
                        if (res.success && res.settings) {
                          setSectionSettings(res.settings);
                          showToast('تم تحديث حالة تفعيل القسم بنجاح', 'success');
                        } else {
                          showToast(res.error || 'تعذر حفظ الإعداد', 'error');
                        }
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                        sectionSettings.section_enabled
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {sectionSettings.section_enabled ? 'مفعل للمستخدمين' : 'معطل مؤقتاً'}
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="text-xs text-slate-400 font-bold">نطاق التوصيل العام الأقصى</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={sectionSettings.global_max_delivery_radius_km}
                      onChange={(e) =>
                        setSectionSettings({
                          ...sectionSettings,
                          global_max_delivery_radius_km: Number(e.target.value),
                        })
                      }
                      className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                    <span className="text-xs text-slate-400">كيلومتر</span>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={async () => {
                        setIsSaving(true);
                        const res = await restaurantAdminService.updateSectionSettings(sectionSettings.id, {
                          global_max_delivery_radius_km: sectionSettings.global_max_delivery_radius_km,
                        });
                        setIsSaving(false);
                        if (res.success) {
                          showToast('تم حفظ نطاق التوصيل', 'success');
                        } else {
                          showToast(res.error || 'تعذر الحفظ', 'error');
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      حفظ
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="text-xs text-slate-400 font-bold">مهلة انتظار السائق قبل الإلغاء</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={sectionSettings.no_driver_timeout_minutes}
                      onChange={(e) =>
                        setSectionSettings({
                          ...sectionSettings,
                          no_driver_timeout_minutes: Number(e.target.value),
                        })
                      }
                      className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                    <span className="text-xs text-slate-400">دقيقة</span>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={async () => {
                        setIsSaving(true);
                        const res = await restaurantAdminService.updateSectionSettings(sectionSettings.id, {
                          no_driver_timeout_minutes: sectionSettings.no_driver_timeout_minutes,
                        });
                        setIsSaving(false);
                        if (res.success) {
                          showToast('تم حفظ مهلة السائق', 'success');
                        } else {
                          showToast(res.error || 'تعذر الحفظ', 'error');
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      حفظ
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Ownership History */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <span>سجل طلبات تغيير ملكية المطاعم</span>
            </h3>

            {ownershipHistory.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/50 rounded-2xl">
                لا توجد طلبات تغيير ملكية مسجلة في جدول restaurant_ownership_history
              </div>
            ) : (
              <div className="space-y-2">
                {ownershipHistory.map((h) => (
                  <div key={h.id} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-200">طلب تغيير المالك - الحالة: {h.status}</div>
                      <div className="text-[11px] text-slate-500">
                        تاريخ الطلب: {formatDate(h.requested_at)}
                      </div>
                    </div>
                    {h.approved_at && (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300">
                        تمت الموافقة: {formatDate(h.approved_at)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          ORDER DETAILS MODAL
          ===================================================================== */}
      {activeOrderDetails && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-white">
                  تفاصيل الطلب: #{activeOrderDetails.order_number}
                </h3>
                <div className="text-xs text-slate-400 mt-0.5">
                  تاريخ الإنشاء: {formatDate(activeOrderDetails.created_at)}
                </div>
              </div>
              <button
                onClick={() => setActiveOrderDetails(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Customer & Restaurant Snapshot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <div className="text-slate-400 font-bold">بيانات العميل:</div>
                <div className="text-white font-bold">{activeOrderDetails.customer_name}</div>
                <div className="text-slate-300" dir="ltr">{activeOrderDetails.customer_phone}</div>
                <div className="text-slate-400">{activeOrderDetails.delivery_address}</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <div className="text-slate-400 font-bold">المطعم (بيانات Snapshot التاريخية):</div>
                <div className="text-white font-bold">{activeOrderDetails.restaurant_name_snapshot || '—'}</div>
                <div className="text-slate-300" dir="ltr">{activeOrderDetails.restaurant_phone_snapshot || '—'}</div>
                <div className="text-slate-400">طريقة الدفع: {activeOrderDetails.payment_method}</div>
              </div>
            </div>

            {/* Items Snapshot Table */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300">الأصناف المطلوبة:</div>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">الصنف</th>
                      <th className="py-2.5 px-3">الكمية</th>
                      <th className="py-2.5 px-3">سعر الوحدة</th>
                      <th className="py-2.5 px-3">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(activeOrderDetails.items || []).map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-white">{item.item_name_snapshot}</div>
                          {item.options && item.options.length > 0 && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {item.options
                                .map((o) => `${o.option_name_snapshot}: ${o.value_name_snapshot} (+${o.extra_price_snapshot})`)
                                .join(' • ')}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono">{item.quantity}</td>
                        <td className="py-2.5 px-3 font-mono">{formatCurrency(item.unit_price_snapshot)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                          {formatCurrency(item.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals Summary */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>المجموع الفرعي للطعام:</span>
                <span>{formatCurrency(activeOrderDetails.food_subtotal)}</span>
              </div>
              <div className="flex justify-between text-rose-400">
                <span>الخصم:</span>
                <span>-{formatCurrency(activeOrderDetails.discount_amount)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>رسوم التوصيل:</span>
                <span>{formatCurrency(activeOrderDetails.delivery_fee)}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-black text-emerald-400">
                <span>إجمالي العميل النهائي:</span>
                <span>{formatCurrency(activeOrderDetails.customer_total)}</span>
              </div>
            </div>

            {/* Status History */}
            {activeOrderDetails.status_history && activeOrderDetails.status_history.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-400">سجل تغير الحالات:</div>
                <div className="space-y-1 text-xs">
                  {activeOrderDetails.status_history.map((h) => (
                    <div key={h.id} className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-300">{h.old_status || 'البداية'} ← {h.new_status}</span>
                      <span className="text-[10px] text-slate-500">{formatDate(h.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          ADD / EDIT RESTAURANT MODAL
          ===================================================================== */}
      {isRestaurantModalOpen && editingRestaurant && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">
                {editingRestaurant.id ? 'تعديل بيانات المطعم' : 'إضافة مطعم جديد'}
              </h3>
              <button
                onClick={() => setIsRestaurantModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">اسم المطعم *</label>
                <input
                  type="text"
                  value={editingRestaurant.name || ''}
                  onChange={(e) => setEditingRestaurant({ ...editingRestaurant, name: e.target.value })}
                  placeholder="مثال: مطعم الشرق للمشويات"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">الوصف</label>
                <textarea
                  value={editingRestaurant.description || ''}
                  onChange={(e) => setEditingRestaurant({ ...editingRestaurant, description: e.target.value })}
                  placeholder="وصف مختصر للمطعم والأكلات المميزة..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 h-16"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">رقم الهاتف *</label>
                  <input
                    type="text"
                    value={editingRestaurant.phone || ''}
                    onChange={(e) => setEditingRestaurant({ ...editingRestaurant, phone: e.target.value })}
                    placeholder="01xxxxxxxxx"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">رابط الصورة (Image URL)</label>
                  <input
                    type="text"
                    value={editingRestaurant.image_url || ''}
                    onChange={(e) => setEditingRestaurant({ ...editingRestaurant, image_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">العنوان بالتفصيل *</label>
                <input
                  type="text"
                  value={editingRestaurant.address || ''}
                  onChange={(e) => setEditingRestaurant({ ...editingRestaurant, address: e.target.value })}
                  placeholder="الشارع، المنطقة، المحافظة"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">خط العرض (Latitude) *</label>
                  <input
                    type="number"
                    step="any"
                    value={editingRestaurant.latitude ?? 30.0444}
                    onChange={(e) => setEditingRestaurant({ ...editingRestaurant, latitude: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">خط الطول (Longitude) *</label>
                  <input
                    type="number"
                    step="any"
                    value={editingRestaurant.longitude ?? 31.2357}
                    onChange={(e) => setEditingRestaurant({ ...editingRestaurant, longitude: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">نسبة العمولة %</label>
                  <input
                    type="number"
                    value={editingRestaurant.commission_percent ?? 10}
                    onChange={(e) => setEditingRestaurant({ ...editingRestaurant, commission_percent: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">نطاق التوصيل (كم)</label>
                  <input
                    type="number"
                    value={editingRestaurant.max_delivery_radius_km ?? 15}
                    onChange={(e) => setEditingRestaurant({ ...editingRestaurant, max_delivery_radius_km: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">رسوم التوصيل</label>
                  <input
                    type="number"
                    value={editingRestaurant.delivery_fee ?? 15}
                    onChange={(e) => setEditingRestaurant({ ...editingRestaurant, delivery_fee: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              {/* Category Links Selector */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">التصنيفات المرتبطة بالمطعم</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 rounded-xl bg-slate-950 border border-slate-800">
                  {categories.map((c) => {
                    const isSelected = (editingRestaurant.category_ids || []).includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          const current = editingRestaurant.category_ids || [];
                          const next = isSelected
                            ? current.filter((id) => id !== c.id)
                            : [...current, c.id];
                          setEditingRestaurant({ ...editingRestaurant, category_ids: next });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRestaurantModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  if (!editingRestaurant.name || !editingRestaurant.phone || !editingRestaurant.address) {
                    showToast('يرجى ملء الحقول الإلزامية (الاسم، الهاتف، العنوان)', 'error');
                    return;
                  }
                  setIsSaving(true);
                  if (editingRestaurant.id) {
                    const res = await restaurantAdminService.updateRestaurant(
                      editingRestaurant.id,
                      editingRestaurant
                    );
                    setIsSaving(false);
                    if (res.success) {
                      showToast('تم تعديل المطعم بنجاح', 'success');
                      setIsRestaurantModalOpen(false);
                      loadRestaurants();
                    } else {
                      showToast(res.error || 'تعذر حفظ التعديلات', 'error');
                    }
                  } else {
                    const res = await restaurantAdminService.createRestaurant(editingRestaurant as any);
                    setIsSaving(false);
                    if (res.success) {
                      showToast('تمت إضافة المطعم بنجاح', 'success');
                      setIsRestaurantModalOpen(false);
                      loadRestaurants();
                    } else {
                      showToast(res.error || 'تعذر إضافة المطعم', 'error');
                    }
                  }
                }}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>حفظ المطعم</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ADD / EDIT CATEGORY MODAL
          ===================================================================== */}
      {isCategoryModalOpen && editingCategory && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">
                {editingCategory.id ? 'تعديل التصنيف' : 'إضافة تصنيف مطاعم'}
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">اسم التصنيف *</label>
                <input
                  type="text"
                  value={editingCategory.name || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  placeholder="مثال: مشويات، شاورما، بيتزا..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">رابط الأيقونة أو الصورة</label>
                <input
                  type="text"
                  value={editingCategory.image_url || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">الترتيب</label>
                <input
                  type="number"
                  value={editingCategory.sort_order ?? 1}
                  onChange={(e) => setEditingCategory({ ...editingCategory, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  if (!editingCategory.name?.trim()) {
                    showToast('اسم التصنيف مطلوب', 'error');
                    return;
                  }
                  setIsSaving(true);
                  if (editingCategory.id) {
                    const res = await restaurantAdminService.updateCategory(editingCategory.id, editingCategory);
                    setIsSaving(false);
                    if (res.success) {
                      showToast('تم تعديل التصنيف بنجاح', 'success');
                      setIsCategoryModalOpen(false);
                      loadCategories();
                    } else {
                      showToast(res.error || 'تعذر حفظ التعديل', 'error');
                    }
                  } else {
                    const res = await restaurantAdminService.createCategory(editingCategory as any);
                    setIsSaving(false);
                    if (res.success) {
                      showToast('تمت إضافة التصنيف بنجاح', 'success');
                      setIsCategoryModalOpen(false);
                      loadCategories();
                    } else {
                      showToast(res.error || 'تعذر إضافة التصنيف', 'error');
                    }
                  }
                }}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ADD / EDIT MENU CATEGORY MODAL
          ===================================================================== */}
      {isMenuCategoryModalOpen && editingMenuCategory && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">
                {editingMenuCategory.id ? 'تعديل قسم القائمة' : 'إضافة قسم قائمة طعام'}
              </h3>
              <button
                onClick={() => setIsMenuCategoryModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">المطعم *</label>
                <select
                  value={editingMenuCategory.restaurant_id || ''}
                  onChange={(e) => setEditingMenuCategory({ ...editingMenuCategory, restaurant_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value="">— اختر المطعم —</option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">اسم قسم القائمة *</label>
                <input
                  type="text"
                  value={editingMenuCategory.name || ''}
                  onChange={(e) => setEditingMenuCategory({ ...editingMenuCategory, name: e.target.value })}
                  placeholder="مثال: وجبات التوفير، مقبلات، مشروبات..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">ترتيب العرض</label>
                <input
                  type="number"
                  value={editingMenuCategory.sort_order ?? 1}
                  onChange={(e) => setEditingMenuCategory({ ...editingMenuCategory, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsMenuCategoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  if (!editingMenuCategory.name?.trim() || !editingMenuCategory.restaurant_id) {
                    showToast('المطعم واسم القسم مطلوبان', 'error');
                    return;
                  }
                  setIsSaving(true);
                  if (editingMenuCategory.id) {
                    const res = await restaurantAdminService.updateMenuCategory(editingMenuCategory.id, editingMenuCategory);
                    setIsSaving(false);
                    if (res.success) {
                      showToast('تم تعديل قسم القائمة بنجاح', 'success');
                      setIsMenuCategoryModalOpen(false);
                      loadMenu();
                    } else {
                      showToast(res.error || 'تعذر التعديل', 'error');
                    }
                  } else {
                    const res = await restaurantAdminService.createMenuCategory(editingMenuCategory as any);
                    setIsSaving(false);
                    if (res.success) {
                      showToast('تمت إضافة قسم القائمة بنجاح', 'success');
                      setIsMenuCategoryModalOpen(false);
                      loadMenu();
                    } else {
                      showToast(res.error || 'تعذر إضافة قسم القائمة', 'error');
                    }
                  }
                }}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ADD / EDIT MENU ITEM MODAL
          ===================================================================== */}
      {isMenuItemModalOpen && editingMenuItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">
                {editingMenuItem.id ? 'تعديل صنف' : 'إضافة صنف طعام جديد'}
              </h3>
              <button
                onClick={() => setIsMenuItemModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">المطعم *</label>
                  <select
                    value={editingMenuItem.restaurant_id || ''}
                    onChange={(e) => setEditingMenuItem({ ...editingMenuItem, restaurant_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="">— اختر المطعم —</option>
                    {restaurants.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">قسم القائمة *</label>
                  <select
                    value={editingMenuItem.category_id || ''}
                    onChange={(e) => setEditingMenuItem({ ...editingMenuItem, category_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="">— اختر قسم القائمة —</option>
                    {menuCategories
                      .filter((mc) => !editingMenuItem.restaurant_id || mc.restaurant_id === editingMenuItem.restaurant_id)
                      .map((mc) => (
                        <option key={mc.id} value={mc.id}>
                          {mc.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">اسم الصنف *</label>
                <input
                  type="text"
                  value={editingMenuItem.name || ''}
                  onChange={(e) => setEditingMenuItem({ ...editingMenuItem, name: e.target.value })}
                  placeholder="مثال: ساندوتش برجر دبل كلاسيك"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">الوصف والمكونات</label>
                <textarea
                  value={editingMenuItem.description || ''}
                  onChange={(e) => setEditingMenuItem({ ...editingMenuItem, description: e.target.value })}
                  placeholder="مكونات الصنف والتفاصيل..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none h-16"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">السعر (ج.م) *</label>
                  <input
                    type="number"
                    value={editingMenuItem.price ?? 50}
                    onChange={(e) => setEditingMenuItem({ ...editingMenuItem, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">رابط صورة الصنف</label>
                  <input
                    type="text"
                    value={editingMenuItem.image_url || ''}
                    onChange={(e) => setEditingMenuItem({ ...editingMenuItem, image_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingMenuItem.is_available ?? true}
                    onChange={(e) => setEditingMenuItem({ ...editingMenuItem, is_available: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-0"
                  />
                  <span className="text-slate-300 font-bold">متوفر حالياً للطلب</span>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsMenuItemModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  if (!editingMenuItem.name?.trim() || !editingMenuItem.restaurant_id || !editingMenuItem.category_id) {
                    showToast('المطعم، القسم، واسم الصنف مطلوبين', 'error');
                    return;
                  }
                  setIsSaving(true);
                  if (editingMenuItem.id) {
                    const res = await restaurantAdminService.updateMenuItem(editingMenuItem.id, editingMenuItem);
                    setIsSaving(false);
                    if (res.success) {
                      showToast('تم تعديل الصنف بنجاح', 'success');
                      setIsMenuItemModalOpen(false);
                      loadMenu();
                    } else {
                      showToast(res.error || 'تعذر حفظ الصنف', 'error');
                    }
                  } else {
                    const res = await restaurantAdminService.createMenuItem(editingMenuItem as any);
                    setIsSaving(false);
                    if (res.success) {
                      showToast('تمت إضافة الصنف بنجاح', 'success');
                      setIsMenuItemModalOpen(false);
                      loadMenu();
                    } else {
                      showToast(res.error || 'تعذر إضافة الصنف', 'error');
                    }
                  }
                }}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          RESOLVE COMPLAINT MODAL
          ===================================================================== */}
      {resolvingComplaint && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">توثيق حل الشكوى</h3>
              <button
                onClick={() => setResolvingComplaint(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-bold">موضوع الشكوى: </span>
                <span className="text-white">{resolvingComplaint.subject}</span>
              </div>
              <p className="p-3 bg-slate-950 rounded-xl text-slate-300 border border-slate-800">
                {resolvingComplaint.description}
              </p>

              <div>
                <label className="block text-slate-300 font-bold mb-1">ملاحظة الحل والإجراء المتخذ *</label>
                <textarea
                  value={complaintResolutionNote}
                  onChange={(e) => setComplaintResolutionNote(e.target.value)}
                  placeholder="تم التواصل مع العميل والمطعم وحل المشكلة وتعويض العميل..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none h-24"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setResolvingComplaint(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  if (!complaintResolutionNote.trim()) {
                    showToast('ملاحظة حل الشكوى مطلوبة', 'error');
                    return;
                  }
                  setIsSaving(true);
                  const res = await restaurantAdminService.resolveComplaint(
                    resolvingComplaint.id,
                    complaintResolutionNote,
                    'resolved'
                  );
                  setIsSaving(false);
                  if (res.success) {
                    showToast('تم توثيق حل الشكوى بنجاح', 'success');
                    setResolvingComplaint(null);
                    loadComplaints();
                  } else {
                    showToast(res.error || 'تعذر توثيق الحل', 'error');
                  }
                }}
                className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold"
              >
                تأكيد الحل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
