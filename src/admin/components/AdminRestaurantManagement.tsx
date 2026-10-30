import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdmin } from '../context/AdminContext';
import { restaurantAdminService } from '../services/restaurantAdminService';
import { RestaurantImageUploader } from './RestaurantImageUploader';
import { RestaurantLocationPickerModal } from './RestaurantLocationPickerModal';
import { resolveRestaurantImageSrc } from '../services/restaurantImageService';

// Safe number-to-input-value helper to prevent React NaN attribute warnings
const toInputNumber = (val: any, fallback: string | number = ''): string | number => {
  if (val === undefined || val === null) return fallback;
  const num = Number(val);
  return isNaN(num) ? fallback : num;
};

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
  FoodGovernorate,
  FoodCenter,
  FoodArea,
  RestaurantServiceArea,
  RestaurantSectionServiceArea,
  RestaurantAreaDeliveryFee,
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
  Navigation,
  Crosshair,
  Compass,
  Truck,
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

  // Independent Status Filters per domain
  const [restaurantStatusFilter, setRestaurantStatusFilter] = useState<'all' | 'active' | 'inactive' | 'open' | 'closed'>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'pending' | 'restaurant_confirmed' | 'cooking' | 'ready_for_pickup' | 'in_delivery' | 'completed' | 'cancelled'>('all');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<'all' | 'pending' | 'assigned' | 'picked_up' | 'delivered' | 'cancelled'>('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | 'issued' | 'paid' | 'pending' | 'cancelled'>('all');
  const [settlementStatusFilter, setSettlementStatusFilter] = useState<'all' | 'pending' | 'open' | 'closed' | 'completed'>('all');
  const [complaintStatusFilter, setComplaintStatusFilter] = useState<'all' | 'open' | 'pending' | 'resolved' | 'closed'>('all');

  // Modals & Details State
  const [activeOrderDetails, setActiveOrderDetails] = useState<RestaurantOrder | null>(null);
  const [isLoadingOrderDetails, setIsLoadingOrderDetails] = useState(false);

  const [isRestaurantModalOpen, setIsRestaurantModalOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Partial<Restaurant> & { category_ids?: string[] } | null>(null);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);

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

  // Egyptian Administrative Address Hierarchy State
  const [governorates, setGovernorates] = useState<FoodGovernorate[]>([]);
  const [restaurantCenters, setRestaurantCenters] = useState<FoodCenter[]>([]);
  const [restaurantAreas, setRestaurantAreas] = useState<FoodArea[]>([]);
  const [isLoadingAddressHierarchy, setIsLoadingAddressHierarchy] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Delivery Service Areas & Fees State
  const [isServiceAreasModalOpen, setIsServiceAreasModalOpen] = useState(false);
  const [selectedRestaurantForAreas, setSelectedRestaurantForAreas] = useState<Restaurant | null>(null);
  const [restaurantServiceAreas, setRestaurantServiceAreas] = useState<RestaurantServiceArea[]>([]);
  const [isLoadingServiceAreas, setIsLoadingServiceAreas] = useState(false);
  const [serviceAreaCenters, setServiceAreaCenters] = useState<FoodCenter[]>([]);
  const [serviceAreaAreas, setServiceAreaAreas] = useState<FoodArea[]>([]);
  const [newServiceAreaForm, setNewServiceAreaForm] = useState({
    governorate_id: '',
    center_id: '',
    area_id: '',
    delivery_fee: 15,
    is_active: true,
  });
  const [isSavingServiceArea, setIsSavingServiceArea] = useState(false);

  // Section Service Areas State (public.restaurant_section_service_areas)
  const [sectionServiceAreas, setSectionServiceAreas] = useState<RestaurantSectionServiceArea[]>([]);
  const [isLoadingSectionAreas, setIsLoadingSectionAreas] = useState(false);
  const [sectionAreaCenters, setSectionAreaCenters] = useState<FoodCenter[]>([]);
  const [sectionAreaAreas, setSectionAreaAreas] = useState<FoodArea[]>([]);
  const [isLoadingSectionHierarchy, setIsLoadingSectionHierarchy] = useState(false);
  const [newSectionScope, setNewSectionScope] = useState<{
    governorate_id: string;
    center_id: string;
    area_id: string;
    is_active: boolean;
  }>({
    governorate_id: '',
    center_id: '',
    area_id: '',
    is_active: true,
  });
  const [isSavingSectionArea, setIsSavingSectionArea] = useState(false);

  // Dedicated Independent Restaurant Commission Quick-Edit State
  const [editingCommissionRestaurant, setEditingCommissionRestaurant] = useState<{
    id: string;
    name: string;
    commission_percent: number;
  } | null>(null);
  const [commissionInputValue, setCommissionInputValue] = useState<number | string>(10);
  const [isSavingCommission, setIsSavingCommission] = useState(false);

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
      isActive: restaurantStatusFilter === 'active' ? true : restaurantStatusFilter === 'inactive' ? false : 'all',
      isOpen: restaurantStatusFilter === 'open' ? true : restaurantStatusFilter === 'closed' ? false : 'all',
    });
    if (res.error) showToast(res.error, 'error');
    setRestaurants(res.restaurants || []);
    setIsLoading(false);
  }, [searchQuery, restaurantStatusFilter, showToast]);

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
      status: orderStatusFilter,
      search: searchQuery,
    });
    if (res.error) showToast(res.error, 'error');
    setOrders(res.orders || []);
    setIsLoading(false);
  }, [selectedRestaurantFilter, orderStatusFilter, searchQuery, showToast]);

  const loadDelivery = useCallback(async () => {
    setIsLoading(true);
    const res = await restaurantAdminService.getDeliveryOrders({
      status: deliveryStatusFilter,
    });
    if (res.error) showToast(res.error, 'error');
    setDeliveryOrders(res.deliveryOrders || []);
    setIsLoading(false);
  }, [deliveryStatusFilter, showToast]);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    const res = await restaurantAdminService.getInvoices({
      status: invoiceStatusFilter,
      search: searchQuery,
    });
    if (res.error) showToast(res.error, 'error');
    setInvoices(res.invoices || []);
    setIsLoading(false);
  }, [invoiceStatusFilter, searchQuery, showToast]);

  const loadSettlements = useCallback(async () => {
    setIsLoading(true);
    const [txRes, setRes] = await Promise.all([
      restaurantAdminService.getFinancialTransactions({ restaurantId: selectedRestaurantFilter }),
      restaurantAdminService.getSettlements({ restaurantId: selectedRestaurantFilter, status: settlementStatusFilter }),
    ]);
    if (txRes.error) showToast(txRes.error, 'error');
    if (setRes.error) showToast(setRes.error, 'error');
    setTransactions(txRes.transactions || []);
    setSettlements(setRes.settlements || []);
    setIsLoading(false);
  }, [selectedRestaurantFilter, settlementStatusFilter, showToast]);

  const loadComplaints = useCallback(async () => {
    setIsLoading(true);
    const res = await restaurantAdminService.getComplaints({
      restaurantId: selectedRestaurantFilter,
      status: complaintStatusFilter,
    });
    if (res.error) showToast(res.error, 'error');
    setComplaints(res.complaints || []);
    setIsLoading(false);
  }, [selectedRestaurantFilter, complaintStatusFilter, showToast]);

  const loadSettingsAndHistory = useCallback(async () => {
    setIsLoading(true);
    setIsLoadingSectionAreas(true);
    const [secRes, ownRes, areasRes] = await Promise.all([
      restaurantAdminService.getSectionSettings(),
      restaurantAdminService.getOwnershipHistory(selectedRestaurantFilter),
      restaurantAdminService.getSectionServiceAreas(),
    ]);
    if (secRes.error) showToast(secRes.error, 'error');
    if (ownRes.error) showToast(ownRes.error, 'error');
    if (areasRes.error) showToast(areasRes.error, 'error');
    setSectionSettings(secRes.settings || null);
    setOwnershipHistory(ownRes.history || []);
    setSectionServiceAreas(areasRes.sectionAreas || []);
    setIsLoading(false);
    setIsLoadingSectionAreas(false);
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
    // Preload Egyptian governorates list
    restaurantAdminService.getFoodGovernorates().then((g) => {
      if (g.governorates) setGovernorates(g.governorates);
    });
  }, [loadStats]);

  // =========================================================================
  // RESTAURANT ADDRESS & GPS HANDLERS
  // =========================================================================
  const handleOpenAddRestaurant = useCallback(() => {
    if (!hasPermission('restaurants.manage')) {
      showToast('ليس لديك صلاحية لإضافة مطعم جديد', 'error');
      return;
    }
    setRestaurantCenters([]);
    setRestaurantAreas([]);
    setEditingRestaurant({
      name: '',
      phone: '',
      address: '',
      country_name: 'مصر',
      governorate_id: null,
      center_id: null,
      area_id: null,
      street: '',
      detailed_address: '',
      latitude: undefined,
      longitude: undefined,
      is_active: true,
      is_open: true,
      max_delivery_radius_km: 15,
      commission_percent: 10,
      delivery_fee: 15,
      food_money_settlement_mode: 'per_order',
      category_ids: [],
    });
    setIsRestaurantModalOpen(true);
  }, [hasPermission, showToast]);

  const handleOpenEditRestaurant = useCallback(async (rest: Restaurant) => {
    if (!hasPermission('restaurants.manage')) {
      showToast('ليس لديك صلاحية لتعديل بيانات المطعم', 'error');
      return;
    }
    // Load category links directly from DB to ensure complete pre-population
    let currentCategoryIds = rest.categories?.map((c) => c.id) || [];
    try {
      const linkedIds = await restaurantAdminService.getRestaurantCategoryIds(rest.id);
      if (linkedIds && linkedIds.length > 0) {
        currentCategoryIds = linkedIds;
      }
    } catch {}

    const safeSettlementMode =
      rest.food_money_settlement_mode &&
      ['per_order', 'daily', 'weekly', 'monthly'].includes(rest.food_money_settlement_mode)
        ? rest.food_money_settlement_mode
        : 'per_order';

    setEditingRestaurant({
      ...rest,
      country_name: rest.country_name || 'مصر',
      governorate_id: rest.governorate_id || null,
      center_id: rest.center_id || null,
      area_id: rest.area_id || null,
      street: rest.street || '',
      detailed_address: rest.detailed_address || '',
      food_money_settlement_mode: safeSettlementMode,
      category_ids: currentCategoryIds,
    });
    setIsRestaurantModalOpen(true);

    // Cascading address load for the existing restaurant
    if (rest.governorate_id) {
      setIsLoadingAddressHierarchy(true);
      const cRes = await restaurantAdminService.getFoodCenters(rest.governorate_id);
      setRestaurantCenters(cRes.centers || []);
      if (rest.center_id) {
        const aRes = await restaurantAdminService.getFoodAreas(rest.center_id, rest.governorate_id);
        setRestaurantAreas(aRes.areas || []);
      } else {
        setRestaurantAreas([]);
      }
      setIsLoadingAddressHierarchy(false);
    } else {
      setRestaurantCenters([]);
      setRestaurantAreas([]);
    }
  }, [hasPermission, showToast]);

  const handleRestaurantGovChange = async (govId: string) => {
    setEditingRestaurant((prev) =>
      prev
        ? {
            ...prev,
            governorate_id: govId || null,
            center_id: null,
            area_id: null,
          }
        : null
    );
    setRestaurantAreas([]);
    if (govId) {
      setIsLoadingAddressHierarchy(true);
      const res = await restaurantAdminService.getFoodCenters(govId);
      setRestaurantCenters(res.centers || []);
      setIsLoadingAddressHierarchy(false);
    } else {
      setRestaurantCenters([]);
    }
  };

  const handleRestaurantCenterChange = async (centerId: string) => {
    setEditingRestaurant((prev) =>
      prev
        ? {
            ...prev,
            center_id: centerId || null,
            area_id: null,
          }
        : null
    );
    if (centerId && editingRestaurant?.governorate_id) {
      setIsLoadingAddressHierarchy(true);
      const res = await restaurantAdminService.getFoodAreas(centerId, editingRestaurant.governorate_id);
      setRestaurantAreas(res.areas || []);
      setIsLoadingAddressHierarchy(false);
    } else {
      setRestaurantAreas([]);
    }
  };

  const handleDetectGPSLocation = () => {
    if (!navigator.geolocation) {
      showToast('متصفحك لا يدعم تحديد الموقع الجغرافي (GPS)', 'error');
      return;
    }

    setIsDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingLocation(false);
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setEditingRestaurant((prev) =>
          prev
            ? {
                ...prev,
                latitude: lat,
                longitude: lng,
              }
            : null
        );
        showToast(`تم التقاط الإحداثيات بنجاح: (${lat}, ${lng})`, 'success');
      },
      (err) => {
        setIsDetectingLocation(false);
        let msg = 'تعذر الحصول على إحداثيات الموقع الحالي.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'تم رفض صلاحية الوصول للموقع الجغرافي. يرجى تفعيل إذن الموقع من إعدادات المتصفح (رمز القفل بجانب شريط العنوان) أو الضغط على "تحديد الموقع على الخريطة" لاختيار الموقع يدوياً.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'بيانات إشارة GPS غير متوفرة حالياً من جهازك. يرجى التأكد من تشغيل خدمات الموقع بالجهاز أو تحديد الموقع عبر الخريطة.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'انتهت مهلة انتظار استجابة نظام GPS (15 ثانية). يمكنك المحاولة مرة أخرى أو تحديد الموقع مباشرة عبر الخريطة.';
        }
        showToast(msg, 'error');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // =========================================================================
  // DELIVERY SERVICE AREAS HANDLERS
  // =========================================================================
  const handleOpenServiceAreasModal = async (rest: Restaurant) => {
    setSelectedRestaurantForAreas(rest);
    setIsServiceAreasModalOpen(true);
    setIsLoadingServiceAreas(true);
    setNewServiceAreaForm({
      governorate_id: rest.governorate_id || '',
      center_id: rest.center_id || '',
      area_id: '',
      delivery_fee: rest.delivery_fee || 15,
      is_active: true,
    });

    if (rest.governorate_id) {
      const cRes = await restaurantAdminService.getFoodCenters(rest.governorate_id);
      setServiceAreaCenters(cRes.centers || []);
      if (rest.center_id) {
        const aRes = await restaurantAdminService.getFoodAreas(rest.center_id, rest.governorate_id);
        setServiceAreaAreas(aRes.areas || []);
      } else {
        setServiceAreaAreas([]);
      }
    } else {
      setServiceAreaCenters([]);
      setServiceAreaAreas([]);
    }

    const res = await restaurantAdminService.getRestaurantServiceAreas(rest.id);
    if (res.error) {
      showToast(res.error, 'error');
    }
    setRestaurantServiceAreas(res.serviceAreas || []);
    setIsLoadingServiceAreas(false);
  };

  const handleServiceAreaGovChange = async (govId: string) => {
    setNewServiceAreaForm((prev) => ({
      ...prev,
      governorate_id: govId,
      center_id: '',
      area_id: '',
    }));
    setServiceAreaAreas([]);
    if (govId) {
      const res = await restaurantAdminService.getFoodCenters(govId);
      setServiceAreaCenters(res.centers || []);
    } else {
      setServiceAreaCenters([]);
    }
  };

  const handleServiceAreaCenterChange = async (centerId: string) => {
    setNewServiceAreaForm((prev) => ({
      ...prev,
      center_id: centerId,
      area_id: '',
    }));
    if (centerId && newServiceAreaForm.governorate_id) {
      const res = await restaurantAdminService.getFoodAreas(centerId, newServiceAreaForm.governorate_id);
      setServiceAreaAreas(res.areas || []);
    } else {
      setServiceAreaAreas([]);
    }
  };

  const handleAddServiceArea = async () => {
    if (!hasPermission('restaurants.manage')) {
      showToast('ليس لديك صلاحية لتعديل نطاقات التوصيل', 'error');
      return;
    }
    if (!selectedRestaurantForAreas) return;
    if (!newServiceAreaForm.area_id) {
      showToast('يرجى اختيار المنطقة لإضافتها إلى نطاق التوصيل', 'error');
      return;
    }
    const fee = Number(newServiceAreaForm.delivery_fee);
    if (isNaN(fee) || fee < 0) {
      showToast('يرجى إدخال رسوم توصيل صحيحة (صفر أو أكثر)', 'error');
      return;
    }

    setIsSavingServiceArea(true);
    const res = await restaurantAdminService.upsertRestaurantServiceAreaAndFee({
      restaurant_id: selectedRestaurantForAreas.id,
      governorate_id: newServiceAreaForm.governorate_id || null,
      center_id: newServiceAreaForm.center_id || null,
      area_id: newServiceAreaForm.area_id,
      delivery_fee: fee,
      is_active: newServiceAreaForm.is_active,
    });
    setIsSavingServiceArea(false);

    if (res.success) {
      // Reload list and verify listRes.error
      const listRes = await restaurantAdminService.getRestaurantServiceAreas(selectedRestaurantForAreas.id);
      if (listRes.error) {
        showToast(`تم حفظ منطقة التوصيل بنجاح، ولكن تعذر تحديث القائمة: ${listRes.error}`, 'warning');
      } else {
        showToast('تم حفظ نطاق ورسوم التوصيل بنجاح', 'success');
        setRestaurantServiceAreas(listRes.serviceAreas || []);
        // Only reset area_id upon verified reload
        setNewServiceAreaForm((prev) => ({ ...prev, area_id: '' }));
      }
    } else {
      showToast(res.error || 'تعذر حفظ نطاق التوصيل', 'error');
    }
  };

  const handleToggleServiceAreaActive = async (serviceArea: RestaurantServiceArea) => {
    if (!hasPermission('restaurants.manage')) {
      showToast('ليس لديك صلاحية لتعديل نطاقات التوصيل', 'error');
      return;
    }
    const nextState = !serviceArea.is_active;
    const res = await restaurantAdminService.toggleRestaurantServiceArea(serviceArea.id, nextState);
    if (res.success) {
      if (selectedRestaurantForAreas) {
        const listRes = await restaurantAdminService.getRestaurantServiceAreas(selectedRestaurantForAreas.id);
        if (listRes.error) {
          showToast(`تم تحديث حالة المنطقة، ولكن تعذر إعادة تحميل القائمة: ${listRes.error}`, 'warning');
          // Optimistically update existing state without wiping list
          setRestaurantServiceAreas((prev) =>
            prev.map((sa) => (sa.id === serviceArea.id ? { ...sa, is_active: nextState } : sa))
          );
        } else {
          showToast(nextState ? 'تم تفعيل التوصيل للمنطقة' : 'تم تعطيل التوصيل للمنطقة مؤقتاً', 'success');
          setRestaurantServiceAreas(listRes.serviceAreas || []);
        }
      } else {
        showToast(nextState ? 'تم تفعيل التوصيل للمنطقة' : 'تم تعطيل التوصيل للمنطقة مؤقتاً', 'success');
      }
    } else {
      showToast(res.error || 'تعذر تغيير حالة المنطقة', 'error');
    }
  };

  const handleDeleteServiceArea = async (serviceArea: RestaurantServiceArea) => {
    if (!hasPermission('restaurants.manage')) {
      showToast('ليس لديك صلاحية لإزالة نطاقات التوصيل', 'error');
      return;
    }
    const res = await restaurantAdminService.deleteRestaurantServiceArea(serviceArea.id);
    if (res.success) {
      if (selectedRestaurantForAreas) {
        const listRes = await restaurantAdminService.getRestaurantServiceAreas(selectedRestaurantForAreas.id);
        if (listRes.error) {
          showToast(`تمت إزالة المنطقة من نطاق التوصيل، ولكن تعذر إعادة قراءة القائمة: ${listRes.error}`, 'warning');
          // Filter out deleted record locally without resetting to empty
          setRestaurantServiceAreas((prev) => prev.filter((sa) => sa.id !== serviceArea.id));
        } else {
          showToast('تمت إزالة المنطقة من نطاق التوصيل بنجاح', 'success');
          setRestaurantServiceAreas(listRes.serviceAreas || []);
        }
      } else {
        showToast('تمت إزالة المنطقة من نطاق التوصيل بنجاح', 'success');
      }
    } else {
      showToast(res.error || 'تعذر إزالة المنطقة', 'error');
    }
  };

  // =========================================================================
  // SECTION GEOGRAPHIC SERVICE AREAS HANDLERS (public.restaurant_section_service_areas)
  // =========================================================================
  const handleSectionGovChange = async (govId: string) => {
    setNewSectionScope({
      governorate_id: govId,
      center_id: '',
      area_id: '',
      is_active: true,
    });
    setSectionAreaAreas([]);
    if (govId) {
      setIsLoadingSectionHierarchy(true);
      const res = await restaurantAdminService.getFoodCenters(govId);
      setSectionAreaCenters(res.centers || []);
      setIsLoadingSectionHierarchy(false);
    } else {
      setSectionAreaCenters([]);
    }
  };

  const handleSectionCenterChange = async (centerId: string) => {
    setNewSectionScope((prev) => ({
      ...prev,
      center_id: centerId,
      area_id: '',
    }));
    if (centerId && newSectionScope.governorate_id) {
      setIsLoadingSectionHierarchy(true);
      const res = await restaurantAdminService.getFoodAreas(centerId, newSectionScope.governorate_id);
      setSectionAreaAreas(res.areas || []);
      setIsLoadingSectionHierarchy(false);
    } else {
      setSectionAreaAreas([]);
    }
  };

  const handleAddSectionServiceArea = async () => {
    if (!hasPermission('restaurants.manage')) {
      showToast('ليس لديك صلاحية لتعديل نطاقات تشغيل القسم', 'error');
      return;
    }
    if (!newSectionScope.governorate_id) {
      showToast('يرجى اختيار المحافظة على الأقل لتحديد نطاق التشغيل', 'warning');
      return;
    }

    // Client-side deduplication check
    const isDup = sectionServiceAreas.some((sa) => {
      const matchGov = sa.governorate_id === newSectionScope.governorate_id;
      const matchCenter = (sa.center_id || null) === (newSectionScope.center_id || null);
      const matchArea = (sa.area_id || null) === (newSectionScope.area_id || null);
      return matchGov && matchCenter && matchArea;
    });

    if (isDup) {
      showToast('هذا النطاق الجغرافي مضاف بالفعل في قائمة نطاقات تشغيل القسم', 'warning');
      return;
    }

    setIsSavingSectionArea(true);
    const res = await restaurantAdminService.createSectionServiceArea({
      governorate_id: newSectionScope.governorate_id,
      center_id: newSectionScope.center_id || null,
      area_id: newSectionScope.area_id || null,
      is_active: newSectionScope.is_active,
    });
    setIsSavingSectionArea(false);

    if (res.success) {
      showToast('تمت إضافة النطاق الجغرافي لقسم المطاعم بنجاح', 'success');
      // Reset center and area, keep governorate for ease of adding more
      setNewSectionScope((prev) => ({
        ...prev,
        center_id: '',
        area_id: '',
      }));
      setSectionAreaAreas([]);
      // Reload section areas
      const reloadRes = await restaurantAdminService.getSectionServiceAreas();
      setSectionServiceAreas(reloadRes.sectionAreas || []);
    } else {
      showToast(res.error || 'فشل إضافة النطاق الجغرافي', 'error');
    }
  };

  const handleToggleSectionAreaActive = async (item: RestaurantSectionServiceArea) => {
    if (!hasPermission('restaurants.manage')) {
      showToast('ليس لديك صلاحية لتعديل نطاقات القسم', 'error');
      return;
    }
    const nextStatus = !item.is_active;
    const res = await restaurantAdminService.toggleSectionServiceArea(item.id, nextStatus);
    if (res.success) {
      showToast(nextStatus ? 'تم تفعيل النطاق الجغرافي' : 'تم تعطيل النطاق الجغرافي', 'success');
      setSectionServiceAreas((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, is_active: nextStatus } : a))
      );
    } else {
      showToast(res.error || 'تعذر تغيير حالة النطاق', 'error');
    }
  };

  const handleDeleteSectionArea = async (item: RestaurantSectionServiceArea) => {
    if (!hasPermission('restaurants.manage')) {
      showToast('ليس لديك صلاحية لحذف نطاقات القسم', 'error');
      return;
    }
    const res = await restaurantAdminService.deleteSectionServiceArea(item.id);
    if (res.success) {
      showToast('تم حذف النطاق الجغرافي من نطاقات عمل القسم', 'success');
      setSectionServiceAreas((prev) => prev.filter((a) => a.id !== item.id));
    } else {
      showToast(res.error || 'تعذر حذف النطاق', 'error');
    }
  };

  const handleSaveQuickCommission = async () => {
    if (!hasPermission('restaurants.manage')) {
      showToast('ليس لديك صلاحية لتعديل عمولة المطعم', 'error');
      return;
    }
    if (!editingCommissionRestaurant) return;
    const num = Number(commissionInputValue);
    if (isNaN(num) || num < 0 || num > 100) {
      showToast('يرجى إدخال نسبة عمولة صحيحة بين 0% و 100%', 'error');
      return;
    }
    setIsSavingCommission(true);
    const res = await restaurantAdminService.updateRestaurant(editingCommissionRestaurant.id, {
      commission_percent: num,
    });
    setIsSavingCommission(false);
    if (res.success) {
      showToast(`تم تحديث عمولة مطعم "${editingCommissionRestaurant.name}" إلى ${num}% بنجاح`, 'success');
      const updatedId = editingCommissionRestaurant.id;
      setEditingCommissionRestaurant(null);
      setRestaurants((prev) =>
        prev.map((r) => (r.id === updatedId ? { ...r, commission_percent: num } : r))
      );
    } else {
      showToast(res.error || 'تعذر تحديث نسبة العمولة', 'error');
    }
  };

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
                value={restaurantStatusFilter}
                onChange={(e) => setRestaurantStatusFilter(e.target.value as any)}
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
              onClick={handleOpenAddRestaurant}
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
                onClick={handleOpenAddRestaurant}
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
                      {resolveRestaurantImageSrc(rest.image_url) ? (
                        <img
                          src={resolveRestaurantImageSrc(rest.image_url)!}
                          alt={rest.name}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-800 shrink-0"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
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
                        {rest.is_active ? 'نشط إدارياً' : 'معطل إدارياً'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                          rest.is_open
                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {rest.is_open ? 'مفتوح للطلبات' : 'مغلق مؤقتاً'}
                      </span>
                    </div>
                  </div>

                  {/* Administrative Address Hierarchy Badge */}
                  {(rest.governorate_name || rest.center_name || rest.area_name) && (
                    <div className="text-[11px] text-amber-400/90 flex items-center gap-1 font-medium bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                      <Building className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="line-clamp-1">
                        {[rest.governorate_name, rest.center_name, rest.area_name].filter(Boolean).join(' › ')}
                      </span>
                    </div>
                  )}

                  <div className="text-xs text-slate-400 line-clamp-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 inline ml-1 shrink-0" />
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
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCommissionRestaurant({
                          id: rest.id,
                          name: rest.name,
                          commission_percent: rest.commission_percent ?? 10,
                        });
                        setCommissionInputValue(rest.commission_percent ?? 10);
                      }}
                      className="flex items-center gap-1.5 hover:text-amber-300 transition cursor-pointer group py-0.5 px-1.5 rounded-lg hover:bg-slate-800/80 -mr-1.5"
                      title="انقر لتعديل نسبة العمولة بشكل مستقل"
                    >
                      <span>العمولة: </span>
                      <span className="font-bold text-amber-400 font-mono">{rest.commission_percent}%</span>
                      <Edit3 className="w-3 h-3 text-slate-500 group-hover:text-amber-400 transition" />
                    </button>
                    <div>
                      <span>نطاق التوصيل: </span>
                      <span className="font-bold text-slate-200 font-mono">{rest.max_delivery_radius_km} كم</span>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-end gap-1.5">
                    {/* 1. Independent Restaurant Active Toggle */}
                    <button
                      onClick={async () => {
                        if (!hasPermission('restaurants.manage')) {
                          showToast('ليس لديك صلاحية لتعديل حالة المطعم الإدارية', 'error');
                          return;
                        }
                        const actionText = rest.is_active ? 'تعطيل' : 'تفعيل';
                        if (!confirm(`هل أنت متأكد من ${actionText} مطعم "${rest.name}"؟ ستبقى جميع الطلبات والسجلات التاريخية محفوظة دون تغيير.`)) return;
                        const res = await restaurantAdminService.toggleRestaurantActive(rest.id, rest.is_active);
                        if (res.success) {
                          showToast(rest.is_active ? 'تم تعطيل المطعم إدارياً مع حفظ جميع سجلاته' : 'تم تفعيل المطعم بنجاح للعمل على المنصة', 'success');
                          setRestaurants((prev) =>
                            prev.map((r) => (r.id === rest.id ? { ...r, is_active: !rest.is_active } : r))
                          );
                        } else {
                          showToast(res.error || 'تعذر تعديل حالة التفعيل', 'error');
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition ${
                        rest.is_active
                          ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30'
                          : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30'
                      }`}
                      title={rest.is_active ? 'تعطيل المطعم إدارياً' : 'تفعيل المطعم'}
                    >
                      {rest.is_active ? <Ban className="w-3 h-3 text-rose-400" /> : <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                      <span>{rest.is_active ? 'تعطيل إداري' : 'تفعيل المطعم'}</span>
                    </button>

                    {/* 2. Operational Open/Close Toggle */}
                    <button
                      onClick={async () => {
                        if (!hasPermission('restaurants.manage')) {
                          showToast('ليس لديك صلاحية لتعديل حالة تشغيل المطعم', 'error');
                          return;
                        }
                        const res = await restaurantAdminService.toggleRestaurantOpen(rest.id, rest.is_open);
                        if (res.success) {
                          showToast(rest.is_open ? 'تم إغلاق المطعم مؤقتاً لاستقبال الطلبات' : 'تم فتح المطعم لاستقبال الطلبات', 'success');
                          setRestaurants((prev) =>
                            prev.map((r) => (r.id === rest.id ? { ...r, is_open: !rest.is_open } : r))
                          );
                        } else {
                          showToast(res.error || 'تعذر تحديث الحالة', 'error');
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold cursor-pointer"
                      title="تغيير حالة الفتح أو الإغلاق المؤقت لاستقبال الطلبات اليومية"
                    >
                      {rest.is_open ? 'إغلاق مؤقت' : 'فتح المطعم'}
                    </button>

                    {/* 3. Delivery Areas & Fees */}
                    <button
                      onClick={() => handleOpenServiceAreasModal(rest)}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                      title="إدارة مناطق ورسوم التوصيل"
                    >
                      <Truck className="w-3 h-3 text-blue-400" />
                      <span>مناطق ورسوم التوصيل</span>
                    </button>

                    {/* 4. Full Edit */}
                    <button
                      onClick={() => handleOpenEditRestaurant(rest)}
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
                        if (!hasPermission('restaurants.manage')) {
                          showToast('ليس لديك صلاحية لحذف التصنيفات', 'error');
                          return;
                        }
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
                      {resolveRestaurantImageSrc(item.image_url) ? (
                        <img
                          src={resolveRestaurantImageSrc(item.image_url)!}
                          alt={item.name}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-800 shrink-0"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
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
                          if (!hasPermission('restaurants.manage')) {
                            showToast('ليس لديك صلاحية لحذف الأصناف', 'error');
                            return;
                          }
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
                if (!hasPermission('restaurants.manage')) {
                  showToast('ليس لديك صلاحية لإضافة مجموعات اختيارات', 'error');
                  return;
                }
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
                        if (!hasPermission('restaurants.manage')) {
                          showToast('ليس لديك صلاحية لتعديل مجموعات الاختيار', 'error');
                          return;
                        }
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
                        if (!hasPermission('restaurants.manage')) {
                          showToast('ليس لديك صلاحية لحذف مجموعة الاختيار', 'error');
                          return;
                        }
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
                if (!hasPermission('restaurants.manage')) {
                  showToast('ليس لديك صلاحية لإضافة عروض جديدة', 'error');
                  return;
                }
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
                        if (!hasPermission('restaurants.manage')) {
                          showToast('ليس لديك صلاحية لتعديل العروض', 'error');
                          return;
                        }
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
                        if (!hasPermission('restaurants.manage')) {
                          showToast('ليس لديك صلاحية لحذف العرض', 'error');
                          return;
                        }
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
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value as any)}
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-200">عمليات توصيل طلبات المطاعم (متابعة تشغيلية)</h3>
              <p className="text-[11px] text-slate-400">متابعة حالة المناديب والطلبات في الوقت الفعلي من قاعدة البيانات</p>
            </div>
            <select
              value={deliveryStatusFilter}
              onChange={(e) => setDeliveryStatusFilter(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none"
            >
              <option value="all">كل الحالات</option>
              <option value="pending">بانتظار التعيين (pending)</option>
              <option value="assigned">تم تعيين مندوب (assigned)</option>
              <option value="picked_up">تم الاستلام من المطعم (picked_up)</option>
              <option value="delivered">تم التسليم للعميل (delivered)</option>
              <option value="cancelled">ملغي (cancelled)</option>
            </select>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span>جاري تحميل عمليات التوصيل...</span>
            </div>
          ) : deliveryOrders.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
              <Bike className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">لا توجد عمليات توصيل مطابقة للفلتر</div>
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-200">فواتير طلبات المطاعم (سجل مالي للقراءة)</h3>
              <p className="text-[11px] text-slate-400">الفواتير المحررة آلياً من منصة الطلبات مع تفاصيل المبالغ</p>
            </div>
            <select
              value={invoiceStatusFilter}
              onChange={(e) => setInvoiceStatusFilter(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none"
            >
              <option value="all">كل الحالات</option>
              <option value="issued">مصدرة (issued)</option>
              <option value="paid">مدفوعة (paid)</option>
              <option value="pending">معلقة (pending)</option>
              <option value="cancelled">ملغاة (cancelled)</option>
            </select>
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
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-purple-400" />
                <span>سجل التسويات الدورية (عرض ومراجعة)</span>
              </h3>
              <select
                value={settlementStatusFilter}
                onChange={(e) => setSettlementStatusFilter(e.target.value as any)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none"
              >
                <option value="all">كل الحالات</option>
                <option value="pending">قيد الانتظار (pending)</option>
                <option value="open">مفتوحة (open)</option>
                <option value="closed">مغلقة (closed)</option>
                <option value="completed">مكتملة (completed)</option>
              </select>
            </div>

            {settlements.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl text-xs text-slate-500">
                لا توجد تسويات دورية مسجلة مطابقة للفلتر
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-200">شكاوى العملاء على المطاعم والطلبات</h3>
              <p className="text-[11px] text-slate-400">متابعة شكاوى المستخدمين وتوثيق الحلول المتخذة</p>
            </div>
            <select
              value={complaintStatusFilter}
              onChange={(e) => setComplaintStatusFilter(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none"
            >
              <option value="all">كل حالات الشكاوى</option>
              <option value="open">مفتوحة (open)</option>
              <option value="pending">قيد المراجعة (pending)</option>
              <option value="resolved">تم الحل (resolved)</option>
              <option value="closed">مغلقة (closed)</option>
            </select>
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

            {/* Architecture & Routing Status Overview Card */}
            {sectionSettings && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4.5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">
                        حالة منظومة قسم المطاعم والتوجيه التشغيلي
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        التحكم الإداري المستقل في مسار استقبال الطلبات ورؤية الواجهة للعملاء
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 ${
                        sectionSettings.section_enabled
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${sectionSettings.section_enabled ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      <span>{sectionSettings.section_enabled ? 'استقبال الطلبات: مفعّل' : 'استقبال الطلبات: معطّل'}</span>
                    </span>

                    <span
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 ${
                        sectionSettings.section_visibility === 'visible'
                          ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{sectionSettings.section_visibility === 'visible' ? 'الظهور بالتطبيق: مرئي' : 'الظهور بالتطبيق: مخفي'}</span>
                    </span>

                    <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-800/90 text-amber-300 border border-slate-700">
                      نمط التعطيل: {sectionSettings.disabled_display_mode === 'show_disabled' ? 'إظهار شارة غير متاح' : 'إخفاء القسم تلقائياً'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                    <div className="font-bold text-amber-400 flex items-center gap-1.5 text-[11px]">
                      <Sliders className="w-3.5 h-3.5" />
                      <span>فصل الظهور عن التشغيل (Decoupled Visibility):</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      حالة الظهور (<span className="text-slate-200 font-mono">section_visibility</span>) تتحكم في إظهار أيقونة وقسم المطاعم للمستخدمين في التطبيق. بينما حالة التشغيل (<span className="text-slate-200 font-mono">section_enabled</span>) تتحكم في فتح أو إغلاق مسار استقبال الطلبات الجديدة.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                    <div className="font-bold text-emerald-400 flex items-center gap-1.5 text-[11px]">
                      <Navigation className="w-3.5 h-3.5" />
                      <span>التوثيق المعماري ومطابقة قاعدة البيانات:</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      جدول <span className="text-slate-200 font-mono">restaurant_section_settings</span> يعتمد حصراً على الأعمدة الرسمية: <span className="text-slate-300 font-mono">section_enabled, section_visibility, disabled_display_mode</span>. ولا يحتوي على عمود رسالة نصية مخصصة (<span className="text-rose-300 font-mono">disabled_message</span>)، والتطبيق يعتمد القيم المعتمدة نظامياً.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!sectionSettings ? (
              <div className="p-8 text-center text-xs text-slate-500">
                لم يتم العثور على سجل إعدادات القسم الحالي في جدول restaurant_section_settings.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Setting 1: Section Enabled */}
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="text-xs text-slate-400 font-bold">1. حالة تشغيل قسم المطاعم</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-300 font-medium">
                        {sectionSettings.section_enabled ? 'مفعل ومتاح حالياً' : 'معطل مؤقتاً'}
                      </span>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={async () => {
                          if (!hasPermission('restaurants.manage')) {
                            showToast('ليس لديك صلاحية لتعديل إعدادات القسم', 'error');
                            return;
                          }
                          setIsSaving(true);
                          const next = !sectionSettings.section_enabled;
                          const res = await restaurantAdminService.updateSectionSettings(sectionSettings.id, {
                            section_enabled: next,
                          });
                          setIsSaving(false);
                          if (res.success && res.settings) {
                            setSectionSettings(res.settings);
                            showToast(next ? 'تم تفعيل قسم المطاعم بنجاح' : 'تم تعطيل قسم المطاعم مؤقتاً', 'success');
                          } else {
                            showToast(res.error || 'تعذر حفظ الإعداد', 'error');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                          sectionSettings.section_enabled
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                            : 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm'
                        }`}
                      >
                        {sectionSettings.section_enabled ? 'تعطيل القسم' : 'تفعيل القسم'}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      يتحكم في إمكانية استقبال وإرسال طلبات الطعام الجديدة من العملاء.
                    </p>
                  </div>

                  {/* Setting 2: Section Visibility */}
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="text-xs text-slate-400 font-bold">2. رؤية القسم في التطبيق (section_visibility)</div>
                    <div className="flex items-center gap-2">
                      <select
                        value={sectionSettings.section_visibility || 'visible'}
                        onChange={(e) =>
                          setSectionSettings({
                            ...sectionSettings,
                            section_visibility: e.target.value as any,
                          })
                        }
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500"
                      >
                        <option value="visible">مرئي للجميع (visible)</option>
                        <option value="hidden">مخفي بالكامل (hidden)</option>
                      </select>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={async () => {
                          if (!hasPermission('restaurants.manage')) {
                            showToast('ليس لديك صلاحية لتعديل إعدادات القسم', 'error');
                            return;
                          }
                          setIsSaving(true);
                          const res = await restaurantAdminService.updateSectionSettings(sectionSettings.id, {
                            section_visibility: sectionSettings.section_visibility || 'visible',
                          });
                          setIsSaving(false);
                          if (res.success && res.settings) {
                            setSectionSettings(res.settings);
                            showToast('تم حفظ إعداد ظهور القسم بنجاح', 'success');
                          } else {
                            showToast(res.error || 'تعذر الحفظ', 'error');
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer hover:bg-amber-400 transition"
                      >
                        حفظ
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      تحديد ما إذا كان قسم المطاعم يظهر في واجهة مستخدمي التطبيق أو يتم إخفاؤه تماماً.
                    </p>
                  </div>

                  {/* Setting 3: Disabled Display Mode */}
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="text-xs text-slate-400 font-bold">3. العرض عند التعطيل (disabled_display_mode)</div>
                    <div className="flex items-center gap-2">
                      <select
                        value={sectionSettings.disabled_display_mode || 'show_disabled'}
                        onChange={(e) =>
                          setSectionSettings({
                            ...sectionSettings,
                            disabled_display_mode: e.target.value as any,
                          })
                        }
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500"
                      >
                        <option value="show_disabled">إظهار كمعطل مع تنبيه (show_disabled)</option>
                        <option value="hide">إخفاء القسم تلقائياً (hide)</option>
                      </select>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={async () => {
                          if (!hasPermission('restaurants.manage')) {
                            showToast('ليس لديك صلاحية لتعديل إعدادات القسم', 'error');
                            return;
                          }
                          setIsSaving(true);
                          const res = await restaurantAdminService.updateSectionSettings(sectionSettings.id, {
                            disabled_display_mode: sectionSettings.disabled_display_mode || 'show_disabled',
                          });
                          setIsSaving(false);
                          if (res.success && res.settings) {
                            setSectionSettings(res.settings);
                            showToast('تم حفظ طريقة العرض عند التعطيل بنجاح', 'success');
                          } else {
                            showToast(res.error || 'تعذر الحفظ', 'error');
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer hover:bg-amber-400 transition"
                      >
                        حفظ
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      سلوك الواجهة عندما يكون القسم معطلاً: إما يظهر للمستخدم كغير متاح أو يختفي كلياً.
                    </p>
                  </div>

                  {/* Setting 4: Global Max Delivery Radius */}
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="text-xs text-slate-400 font-bold">4. نطاق التوصيل الأقصى للقسم</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={toInputNumber(sectionSettings.global_max_delivery_radius_km, 25)}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          setSectionSettings({
                            ...sectionSettings,
                            global_max_delivery_radius_km: v === '' ? 25 : (isNaN(Number(v)) ? 25 : Number(v)),
                          });
                        }}
                        className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                      <span className="text-xs text-slate-400">كم</span>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={async () => {
                          if (!hasPermission('restaurants.manage')) {
                            showToast('ليس لديك صلاحية لتعديل إعدادات القسم', 'error');
                            return;
                          }
                          setIsSaving(true);
                          const res = await restaurantAdminService.updateSectionSettings(sectionSettings.id, {
                            global_max_delivery_radius_km: sectionSettings.global_max_delivery_radius_km,
                          });
                          setIsSaving(false);
                          if (res.success && res.settings) {
                            setSectionSettings(res.settings);
                            showToast('تم حفظ نطاق التوصيل الأقصى', 'success');
                          } else {
                            showToast(res.error || 'تعذر الحفظ', 'error');
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer hover:bg-amber-400 transition"
                      >
                        حفظ
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      الحد الأقصى المطلق لنطاق التوصيل المسموح به لأي مطعم على المنصة.
                    </p>
                  </div>

                  {/* Setting 5: No Driver Timeout */}
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="text-xs text-slate-400 font-bold">5. مهلة انتظار السائق قبل الإلغاء</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={toInputNumber(sectionSettings.no_driver_timeout_minutes, 10)}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          setSectionSettings({
                            ...sectionSettings,
                            no_driver_timeout_minutes: v === '' ? 10 : (isNaN(Number(v)) ? 10 : Number(v)),
                          });
                        }}
                        className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                      <span className="text-xs text-slate-400">دقيقة</span>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={async () => {
                          if (!hasPermission('restaurants.manage')) {
                            showToast('ليس لديك صلاحية لتعديل إعدادات القسم', 'error');
                            return;
                          }
                          setIsSaving(true);
                          const res = await restaurantAdminService.updateSectionSettings(sectionSettings.id, {
                            no_driver_timeout_minutes: sectionSettings.no_driver_timeout_minutes,
                          });
                          setIsSaving(false);
                          if (res.success && res.settings) {
                            setSectionSettings(res.settings);
                            showToast('تم حفظ مهلة انتظار السائق', 'success');
                          } else {
                            showToast(res.error || 'تعذر الحفظ', 'error');
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer hover:bg-amber-400 transition"
                      >
                        حفظ
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      الوقت المسموح به للعثور على مندوب توصيل قبل تحويل الطلب لحالة الإلغاء التلقائي.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ===================================================================
              SECTION GEOGRAPHIC SERVICE AREAS (public.restaurant_section_service_areas)
              =================================================================== */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span>إدارة نطاقات التشغيل الجغرافية لقسم المطاعم</span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {sectionServiceAreas.length} نطاق مسجل
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  تحديد المحافظات والمراكز والمناطق التي يغطيها قسم المطاعم بالكامل وفق جدول (restaurant_section_service_areas)
                </p>
              </div>

              <button
                type="button"
                onClick={async () => {
                  setIsLoadingSectionAreas(true);
                  const res = await restaurantAdminService.getSectionServiceAreas();
                  if (res.sectionAreas) setSectionServiceAreas(res.sectionAreas);
                  setIsLoadingSectionAreas(false);
                  showToast('تم تحديث قائمة نطاقات تشغيل القسم', 'info');
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer self-start sm:self-center"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSectionAreas ? 'animate-spin' : ''}`} />
                <span>تحديث النطاقات</span>
              </button>
            </div>

            {/* Scope Addition Form */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>إضافة نطاق جغرافي جديد لتشغيل القسم</span>
                </span>
                {isLoadingSectionHierarchy && (
                  <span className="text-[11px] text-amber-400 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>جاري تحميل الهيكل الجغرافي...</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Governorate */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-xs">1. المحافظة *</label>
                  <select
                    value={newSectionScope.governorate_id}
                    onChange={(e) => handleSectionGovChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 text-xs"
                  >
                    <option value="">اختر المحافظة...</option>
                    {governorates
                      .filter((g) => g.is_active)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name_ar}
                        </option>
                      ))}
                  </select>
                </div>

                {/* 2. Center (Optional for Governorate-wide scope) */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-xs">
                    2. المركز / القسم (اختياري)
                  </label>
                  <select
                    value={newSectionScope.center_id}
                    onChange={(e) => handleSectionCenterChange(e.target.value)}
                    disabled={!newSectionScope.governorate_id || sectionAreaCenters.length === 0}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 text-xs disabled:opacity-50"
                  >
                    <option value="">كامل المحافظة (بدون تحديد مركز)</option>
                    {sectionAreaCenters
                      .filter((c) => c.is_active)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name_ar}
                        </option>
                      ))}
                  </select>
                </div>

                {/* 3. Area (Optional for Center-wide scope) */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-xs">
                    3. المنطقة / الحي (اختياري)
                  </label>
                  <select
                    value={newSectionScope.area_id}
                    onChange={(e) => setNewSectionScope((prev) => ({ ...prev, area_id: e.target.value }))}
                    disabled={!newSectionScope.center_id || sectionAreaAreas.length === 0}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 text-xs disabled:opacity-50"
                  >
                    <option value="">كامل المركز (بدون تحديد منطقة)</option>
                    {sectionAreaAreas
                      .filter((a) => a.is_active)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name_ar}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Scope Level Helper & Action Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                <div className="text-xs">
                  <span className="text-slate-400">مستوى النطاق المحدد: </span>
                  {newSectionScope.area_id ? (
                    <span className="font-bold text-emerald-400">منطقة محددة (أدق مستوى)</span>
                  ) : newSectionScope.center_id ? (
                    <span className="font-bold text-amber-400">مركز / قسم بالكامل</span>
                  ) : newSectionScope.governorate_id ? (
                    <span className="font-bold text-blue-400">محافظة كاملة بجميع مراكزها ومناطقها</span>
                  ) : (
                    <span className="text-slate-500">يرجى اختيار المحافظة</span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!newSectionScope.governorate_id || isSavingSectionArea}
                  onClick={handleAddSectionServiceArea}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-md shadow-emerald-950/20"
                >
                  {isSavingSectionArea ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>إضافة نطاق تشغيل للقسم</span>
                </button>
              </div>
            </div>

            {/* Registered Section Scopes List */}
            {isLoadingSectionAreas ? (
              <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>جاري تحميل نطاقات التشغيل...</span>
              </div>
            ) : sectionServiceAreas.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800/60">
                لا توجد نطاقات جغرافية مسجلة حالياً لقسم المطاعم في جدول restaurant_section_service_areas.
                <div className="text-[11px] text-slate-400 mt-1">
                  قم بإضافة محافظة أو مركز أو منطقة أعلاه لتحديد النطاق الجغرافي الذي يقدم فيه القسم خدماته.
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">النطاق الجغرافي</th>
                        <th className="py-3 px-4">مستوى النطاق</th>
                        <th className="py-3 px-4">الحالة التشغيلية</th>
                        <th className="py-3 px-4">تاريخ الإضافة</th>
                        <th className="py-3 px-4 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {sectionServiceAreas.map((area) => (
                        <tr key={area.id} className="hover:bg-slate-900/40 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2 font-bold text-white">
                              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>
                                {area.level === 'area' ? (
                                  <>
                                    <span className="text-slate-400">{area.governorate_name_ar}</span>
                                    <span className="text-slate-600 mx-1">›</span>
                                    <span className="text-slate-300">{area.center_name_ar}</span>
                                    <span className="text-slate-600 mx-1">›</span>
                                    <span className="text-emerald-400 font-black">{area.area_name_ar}</span>
                                  </>
                                ) : area.level === 'center' ? (
                                  <>
                                    <span className="text-slate-400">{area.governorate_name_ar}</span>
                                    <span className="text-slate-600 mx-1">›</span>
                                    <span className="text-amber-300 font-black">مركز {area.center_name_ar} (كامل المركز)</span>
                                  </>
                                ) : (
                                  <span className="text-blue-300 font-black">
                                    محافظة {area.governorate_name_ar} (كامل نطاق المحافظة)
                                  </span>
                                )}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {area.level === 'area' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                منطقة محددة
                              </span>
                            ) : area.level === 'center' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                مركز / قسم كامل
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                محافظة كاملة
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => handleToggleSectionAreaActive(area)}
                              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer transition flex items-center gap-1.5 ${
                                area.is_active
                                  ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${area.is_active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                              <span>{area.is_active ? 'نطاق نشط ومفعل' : 'معطل مؤقتاً'}</span>
                            </button>
                          </td>

                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                            {formatDate(area.created_at)}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteSectionArea(area)}
                              title="حذف هذا النطاق من قسم المطاعم"
                              className="p-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

            {/* Delivery Area Snapshot (منطقة التوصيل المعتمدة للطلب) */}
            {(activeOrderDetails.delivery_area_name_snapshot || activeOrderDetails.delivery_governorate_name_snapshot) && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <span className="text-amber-400 font-bold block text-[11px]">منطقة التوصيل المعتمدة (Snapshot):</span>
                    <span className="text-white font-bold text-xs">
                      {[
                        activeOrderDetails.delivery_governorate_name_snapshot,
                        activeOrderDetails.delivery_center_name_snapshot,
                        activeOrderDetails.delivery_area_name_snapshot,
                      ]
                        .filter(Boolean)
                        .join(' › ')}
                    </span>
                  </div>
                </div>
                <div className="text-left shrink-0">
                  <span className="text-[10px] text-slate-400 block">رسوم توصيل المنطقة:</span>
                  <span className="font-mono font-bold text-emerald-400 text-xs">
                    {formatCurrency(activeOrderDetails.delivery_fee)}
                  </span>
                </div>
              </div>
            )}

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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <Store className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {editingRestaurant.id ? 'تعديل بيانات المطعم' : 'إضافة مطعم جديد'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    تسجيل بيانات المطعم، العنوان الإداري المصري، وإحداثيات الموقع الجغرافي
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRestaurantModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Basic Information */}
              <div className="space-y-3">
                <div className="font-bold text-slate-300 flex items-center gap-1.5 text-xs border-b border-slate-800/80 pb-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  <span>البيانات الأساسية للمطعم</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <label className="block text-slate-300 font-bold mb-1">رقم الهاتف *</label>
                    <input
                      type="text"
                      value={editingRestaurant.phone || ''}
                      onChange={(e) => setEditingRestaurant({ ...editingRestaurant, phone: e.target.value })}
                      placeholder="01xxxxxxxxx"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">الوصف</label>
                  <textarea
                    value={editingRestaurant.description || ''}
                    onChange={(e) => setEditingRestaurant({ ...editingRestaurant, description: e.target.value })}
                    placeholder="وصف مختصر للمطعم والأكلات المميزة وقائمة الطعام..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 h-16"
                  />
                </div>

                <div>
                  <RestaurantImageUploader
                    label="صورة المطعم (الشعار / الواجهة)"
                    value={editingRestaurant.image_url}
                    restaurantId={editingRestaurant.id || null}
                    targetType="restaurant"
                    targetId={editingRestaurant.id}
                    onChange={(newPath) => setEditingRestaurant({ ...editingRestaurant, image_url: newPath })}
                    helpText="يتم رفع الصورة لحاوية الكتالوج restaurant-product-images مع التحقق وحفظ مسارها في قاعدة طلباتي."
                  />
                </div>
              </div>

              {/* Prominent Restaurant Categories Section */}
              <div className="space-y-3 bg-slate-950/70 p-4 rounded-2xl border border-amber-500/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-black text-white text-xs flex items-center gap-2">
                        <span>تصنيفات المطعم والأكلات *</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {editingRestaurant.category_ids?.length || 0} محدد
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        اختر تصنيفاً واحداً على الأقل لربط المطعم به وظهوره للعملاء في نتائج البحث والفلترة
                      </p>
                    </div>
                  </div>

                  {categories.length > 0 && (
                    <div className="flex items-center gap-1.5 self-start sm:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          const allIds = categories.map((c) => c.id);
                          setEditingRestaurant({ ...editingRestaurant, category_ids: allIds });
                        }}
                        className="text-[11px] text-amber-400 hover:text-amber-300 font-bold px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition cursor-pointer"
                      >
                        تحديد الكل
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRestaurant({ ...editingRestaurant, category_ids: [] });
                        }}
                        className="text-[11px] text-slate-400 hover:text-slate-300 font-bold px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
                      >
                        إلغاء التحديد
                      </button>
                    </div>
                  )}
                </div>

                {categories.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>لا توجد تصنيفات معرفة حالياً في جدول التصنيفات. يمكنك إضافتها لاحقاً من تبويب التصنيفات، أو المتابعة الآن.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1.5 scrollbar-thin">
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
                          className={`p-2.5 rounded-xl border text-right transition cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500 text-white shadow-sm'
                              : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-amber-400' : 'bg-slate-600'}`} />
                            <span className="text-xs font-bold truncate">{c.name}</span>
                          </div>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {editingRestaurant.category_ids && editingRestaurant.category_ids.length === 0 && categories.length > 0 && (
                  <div className="text-[11px] text-amber-400 font-bold flex items-center gap-1.5 pt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>يُفضل تحديد تصنيف واحد على الأقل لضمان ظهور المطعم في تصنيفات العملاء</span>
                  </div>
                )}
              </div>

              {/* Egyptian Administrative Address Hierarchy */}
              <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                    <Building className="w-4 h-4 text-amber-400" />
                    <span>الهيكل الإداري للعنوان (مصر) *</span>
                  </div>
                  {isLoadingAddressHierarchy && (
                    <div className="flex items-center gap-1 text-[11px] text-amber-400">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>جاري تحميل البيانات...</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">1. المحافظة *</label>
                    <select
                      value={editingRestaurant.governorate_id || ''}
                      onChange={(e) => handleRestaurantGovChange(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 text-xs"
                    >
                      <option value="">اختر المحافظة</option>
                      {governorates.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name_ar}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">2. المركز / القسم *</label>
                    <select
                      value={editingRestaurant.center_id || ''}
                      onChange={(e) => handleRestaurantCenterChange(e.target.value)}
                      disabled={!editingRestaurant.governorate_id || restaurantCenters.length === 0}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 text-xs disabled:opacity-50"
                    >
                      <option value="">اختر المركز أو القسم</option>
                      {restaurantCenters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name_ar}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">3. المنطقة / الحي / القرية *</label>
                    <select
                      value={editingRestaurant.area_id || ''}
                      onChange={(e) => setEditingRestaurant({ ...editingRestaurant, area_id: e.target.value || null })}
                      disabled={!editingRestaurant.center_id || restaurantAreas.length === 0}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 text-xs disabled:opacity-50"
                    >
                      <option value="">اختر المنطقة</option>
                      {restaurantAreas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name_ar}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">الشارع (street)</label>
                    <input
                      type="text"
                      value={editingRestaurant.street || ''}
                      onChange={(e) => setEditingRestaurant({ ...editingRestaurant, street: e.target.value })}
                      placeholder="اسم الشارع أو الشارع الرئيسي"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">تفاصيل العنوان / علامة مميزة (detailed_address)</label>
                    <input
                      type="text"
                      value={editingRestaurant.detailed_address || ''}
                      onChange={(e) => setEditingRestaurant({ ...editingRestaurant, detailed_address: e.target.value })}
                      placeholder="رقم المبنى، الطابق، بجوار علامة شهيرة..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-300 font-bold">العنوان المجمع الكامل (address) *</label>
                    <button
                      type="button"
                      onClick={() => {
                        const govObj = governorates.find((g) => g.id === editingRestaurant.governorate_id);
                        const cenObj = restaurantCenters.find((c) => c.id === editingRestaurant.center_id);
                        const areaObj = restaurantAreas.find((a) => a.id === editingRestaurant.area_id);
                        const parts = [
                          editingRestaurant.detailed_address,
                          editingRestaurant.street,
                          areaObj?.name_ar,
                          cenObj?.name_ar,
                          govObj?.name_ar,
                        ].filter(Boolean);
                        if (parts.length > 0) {
                          setEditingRestaurant({ ...editingRestaurant, address: parts.join(' - ') });
                          showToast('تم تكوين العنوان الكامل من الهيكل الإداري', 'success');
                        } else {
                          showToast('يرجى اختيار المحافظة والمركز والمنطقة أولاً', 'warning');
                        }
                      }}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
                    >
                      توليد تلقائي من الهيكل الإداري
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editingRestaurant.address || ''}
                    onChange={(e) => setEditingRestaurant({ ...editingRestaurant, address: e.target.value })}
                    placeholder="العنوان الكامل المعروض للعملاء والمندوبين..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* GPS Coordinates & Map Location */}
              <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span>إحداثيات الموقع الجغرافي الدقيق *</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setIsMapPickerOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition shadow-sm"
                    >
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                      <span>تحديد الموقع على الخريطة (دبوس تفاعلي)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDetectGPSLocation}
                      disabled={isDetectingLocation}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
                    >
                      {isDetectingLocation ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Navigation className="w-3.5 h-3.5" />
                      )}
                      <span>{isDetectingLocation ? 'جاري التقاط الإحداثيات...' : 'تحديد موقعي الحالي (GPS)'}</span>
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400">
                  يرجى تحديد الموقع الجغرافي الفعلي للمطعم لضمان حساب رسوم التوصيل والمسافات للعملاء بدقة. يمنع استخدام إحداثيات افتراضية عشوائية.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">خط العرض (Latitude) *</label>
                    <input
                      type="number"
                      step="any"
                      value={toInputNumber(editingRestaurant.latitude, '')}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        setEditingRestaurant({
                          ...editingRestaurant,
                          latitude: v === '' ? undefined : (isNaN(Number(v)) ? undefined : parseFloat(v)),
                        });
                      }}
                      placeholder="مثال: 30.0444"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">خط الطول (Longitude) *</label>
                    <input
                      type="number"
                      step="any"
                      value={toInputNumber(editingRestaurant.longitude, '')}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        setEditingRestaurant({
                          ...editingRestaurant,
                          longitude: v === '' ? undefined : (isNaN(Number(v)) ? undefined : parseFloat(v)),
                        });
                      }}
                      placeholder="مثال: 31.2357"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Map Preview Link */}
                {editingRestaurant.latitude !== undefined &&
                  editingRestaurant.longitude !== undefined &&
                  !isNaN(Number(editingRestaurant.latitude)) &&
                  !isNaN(Number(editingRestaurant.longitude)) && (
                    <div className="pt-1 flex items-center justify-between text-[11px]">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>تم تعيين الإحداثيات: {Number(editingRestaurant.latitude).toFixed(4)}, {Number(editingRestaurant.longitude).toFixed(4)}</span>
                      </span>
                      <a
                        href={`https://www.google.com/maps?q=${editingRestaurant.latitude},${editingRestaurant.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>معاينة على خرائط Google</span>
                      </a>
                    </div>
                  )}
              </div>

              {/* Operational & Financial Settings */}
              <div className="space-y-3">
                <div className="font-bold text-slate-300 flex items-center gap-1.5 text-xs border-b border-slate-800/80 pb-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>الإعدادات المالية ونطاق التوصيل الأساسي</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">نسبة العمولة %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={toInputNumber(editingRestaurant.commission_percent, 10)}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        setEditingRestaurant({
                          ...editingRestaurant,
                          commission_percent: v === '' ? undefined : (isNaN(Number(v)) ? 0 : parseFloat(v)),
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">رسوم التوصيل الأساسية للمطعم (ج.م)</label>
                    <input
                      type="number"
                      min="0"
                      value={toInputNumber(editingRestaurant.delivery_fee, 15)}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        setEditingRestaurant({
                          ...editingRestaurant,
                          delivery_fee: v === '' ? undefined : (isNaN(Number(v)) ? 0 : parseFloat(v)),
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">
                    طريقة تسوية أموال الطعام (food_money_settlement_mode) *
                  </label>
                  <select
                    value={editingRestaurant.food_money_settlement_mode || 'per_order'}
                    onChange={(e) =>
                      setEditingRestaurant({
                        ...editingRestaurant,
                        food_money_settlement_mode: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 text-xs"
                  >
                    <option value="per_order">تسوية مع كل طلب (Per Order)</option>
                    <option value="daily">تسوية يومية (Daily)</option>
                    <option value="weekly">تسوية أسبوعية (Weekly)</option>
                    <option value="monthly">تسوية شهرية (Monthly)</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    تحدد دورة تحويل مستحقات المطعم المالية وفق قيد قاعدة البيانات المعتمد (restaurants_food_money_settlement_mode_check).
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3.5 border-t border-slate-800 flex items-center justify-end gap-2.5">
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
                  if (!hasPermission('restaurants.manage')) {
                    showToast('ليس لديك صلاحية لتعديل أو إضافة المطاعم', 'error');
                    return;
                  }
                  if (!editingRestaurant.name?.trim()) {
                    showToast('يرجى إدخال اسم المطعم', 'error');
                    return;
                  }
                  if (!editingRestaurant.phone?.trim()) {
                    showToast('يرجى إدخال رقم هاتف المطعم', 'error');
                    return;
                  }
                  if (!editingRestaurant.address?.trim() && !editingRestaurant.governorate_id) {
                    showToast('يرجى تحديد عنوان المطعم أو اختيار المحافظة والمنطقة', 'error');
                    return;
                  }

                  const latVal = editingRestaurant.latitude;
                  const lngVal = editingRestaurant.longitude;
                  if (
                    latVal === undefined ||
                    lngVal === undefined ||
                    isNaN(Number(latVal)) ||
                    isNaN(Number(lngVal))
                  ) {
                    showToast('يرجى تحديد إحداثيات الموقع (GPS) بشكل دقيق', 'error');
                    return;
                  }

                  const latNum = Number(latVal);
                  const lngNum = Number(lngVal);
                  if (latNum < -90 || latNum > 90) {
                    showToast('خط العرض يجب أن يكون بين -90 و 90 درجة', 'error');
                    return;
                  }
                  if (lngNum < -180 || lngNum > 180) {
                    showToast('خط الطول يجب أن يكون بين -180 و 180 درجة', 'error');
                    return;
                  }

                  const commission = Number(editingRestaurant.commission_percent ?? 10);
                  if (isNaN(commission) || commission < 0 || commission > 100) {
                    showToast('نسبة العمولة يجب أن تكون بين 0% و 100%', 'error');
                    return;
                  }

                  if (categories.length > 0 && (!editingRestaurant.category_ids || editingRestaurant.category_ids.length === 0)) {
                    showToast('يرجى تحديد تصنيف واحد على الأقل للمطعم قبل الحفظ', 'error');
                    return;
                  }

                  const safeMode =
                    editingRestaurant.food_money_settlement_mode &&
                    ['per_order', 'daily', 'weekly', 'monthly'].includes(editingRestaurant.food_money_settlement_mode)
                      ? editingRestaurant.food_money_settlement_mode
                      : 'per_order';

                  const payloadToSave = {
                    ...editingRestaurant,
                    food_money_settlement_mode: safeMode,
                  };

                  setIsSaving(true);
                  if (editingRestaurant.id) {
                    const res = await restaurantAdminService.updateRestaurant(
                      editingRestaurant.id,
                      payloadToSave
                    );
                    setIsSaving(false);
                    if (res.success) {
                      if (res.isPartial && res.partialWarning) {
                        showToast(res.partialWarning, 'warning');
                      } else {
                        showToast('تم تعديل المطعم بنجاح وحفظ بيانات العنوان', 'success');
                      }
                      setIsRestaurantModalOpen(false);
                      loadRestaurants();
                    } else {
                      showToast(res.error || 'تعذر حفظ التعديلات', 'error');
                    }
                  } else {
                    const res = await restaurantAdminService.createRestaurant(payloadToSave as any);
                    setIsSaving(false);
                    if (res.success) {
                      if (res.isPartial && res.partialWarning) {
                        showToast(res.partialWarning, 'warning');
                      } else {
                        showToast('تمت إضافة المطعم بنجاح', 'success');
                      }
                      setIsRestaurantModalOpen(false);
                      loadRestaurants();
                    } else {
                      showToast(res.error || 'تعذر إضافة المطعم', 'error');
                    }
                  }
                }}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>حفظ المطعم</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          INDEPENDENT RESTAURANT COMMISSION MODAL
          ===================================================================== */}
      {editingCommissionRestaurant && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <PercentIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">تعديل نسبة عمولة المطعم</h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-[240px]">
                    {editingCommissionRestaurant.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCommissionRestaurant(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  نسبة العمولة من مبيعات الطعام (%) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={toInputNumber(commissionInputValue, 10)}
                    onChange={(e) => setCommissionInputValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 font-mono text-sm"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                    %
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  يجب أن تكون النسبة بين 0% و 100%. هذه النسبة مستقلة تماماً عن رسوم التوصيل الثابتة للمناطق أو نطاق الكيلومترات.
                </p>
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <label className="block text-slate-400 font-bold mb-1.5 text-[11px]">
                  نسب مقترحة سريعة:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[0, 5, 8, 10, 12, 15, 20, 25].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCommissionInputValue(preset)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer transition ${
                        Number(commissionInputValue) === preset
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingCommissionRestaurant(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSavingCommission}
                onClick={handleSaveQuickCommission}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingCommission ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>حفظ العمولة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          INTERACTIVE MAP PIN PICKER MODAL (OpenStreetMap / Leaflet)
          ===================================================================== */}
      <RestaurantLocationPickerModal
        isOpen={isMapPickerOpen}
        initialLat={editingRestaurant?.latitude}
        initialLng={editingRestaurant?.longitude}
        restaurantName={editingRestaurant?.name}
        onConfirm={(lat, lng) => {
          setEditingRestaurant((prev) =>
            prev ? { ...prev, latitude: lat, longitude: lng } : null
          );
          showToast(`تم تعيين إحداثيات الخريطة بنجاح: (${lat}, ${lng})`, 'success');
        }}
        onClose={() => setIsMapPickerOpen(false)}
      />

      {/* =====================================================================
          RESTAURANT DELIVERY SERVICE AREAS & FEES MODAL
          ===================================================================== */}
      {isServiceAreasModalOpen && selectedRestaurantForAreas && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                  <Truck className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    مناطق ورسوم التوصيل: {selectedRestaurantForAreas.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    تحديد المناطق والقرى التي يخدمها هذا المطعم وتعيين رسوم التوصيل الخاصة بكل منطقة
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsServiceAreasModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Add Service Area Form */}
            <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3 text-xs">
              <div className="font-bold text-slate-200 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-blue-400" />
                <span>إضافة منطقة جديدة لنطاق التوصيل</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">المحافظة</label>
                  <select
                    value={newServiceAreaForm.governorate_id}
                    onChange={(e) => handleServiceAreaGovChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white outline-none text-xs"
                  >
                    <option value="">اختر المحافظة</option>
                    {governorates.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name_ar}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">المركز / القسم</label>
                  <select
                    value={newServiceAreaForm.center_id}
                    onChange={(e) => handleServiceAreaCenterChange(e.target.value)}
                    disabled={!newServiceAreaForm.governorate_id || serviceAreaCenters.length === 0}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white outline-none text-xs disabled:opacity-50"
                  >
                    <option value="">اختر المركز</option>
                    {serviceAreaCenters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_ar}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">المنطقة *</label>
                  <select
                    value={newServiceAreaForm.area_id}
                    onChange={(e) => setNewServiceAreaForm({ ...newServiceAreaForm, area_id: e.target.value })}
                    disabled={!newServiceAreaForm.center_id || serviceAreaAreas.length === 0}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white outline-none text-xs disabled:opacity-50"
                  >
                    <option value="">اختر المنطقة</option>
                    {serviceAreaAreas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name_ar}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">رسوم التوصيل لهذه المنطقة (ج.م) *</label>
                    <input
                      type="number"
                      min="0"
                      value={toInputNumber(newServiceAreaForm.delivery_fee, 15)}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        setNewServiceAreaForm({
                          ...newServiceAreaForm,
                          delivery_fee: v === '' ? 0 : (isNaN(Number(v)) ? 0 : parseFloat(v)),
                        });
                      }}
                      className="w-28 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-white outline-none font-mono text-xs"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-slate-300 font-medium cursor-pointer mt-4">
                    <input
                      type="checkbox"
                      checked={newServiceAreaForm.is_active}
                      onChange={(e) =>
                        setNewServiceAreaForm({
                          ...newServiceAreaForm,
                          is_active: e.target.checked,
                        })
                      }
                      className="rounded accent-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span>تفعيل التوصيل للمنطقة</span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleAddServiceArea}
                  disabled={isSavingServiceArea || !newServiceAreaForm.area_id}
                  className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
                >
                  {isSavingServiceArea ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>إضافة / حفظ المنطقة</span>
                </button>
              </div>
            </div>

            {/* List of Configured Service Areas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300">
                  المناطق المشمولة بالتوصيل ({restaurantServiceAreas.length}):
                </h4>
                {isLoadingServiceAreas && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                )}
              </div>

              {isLoadingServiceAreas ? (
                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
                  <span>جاري تحميل مناطق التوصيل...</span>
                </div>
              ) : restaurantServiceAreas.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-slate-800 text-xs text-slate-400 space-y-1">
                  <Truck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <div className="font-bold text-slate-300">لا توجد مناطق توصيل مخصصة حتى الآن</div>
                  <div className="text-[11px] text-slate-500">
                    أضف مناطق وقرى من النموذج أعلاه لربطها مباشرة بقاعدة بيانات التوصيل.
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {restaurantServiceAreas.map((sa) => (
                    <div
                      key={sa.id}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                        <div>
                          <div className="font-bold text-white">
                            {[sa.governorate_name_ar, sa.center_name_ar, sa.area_name_ar]
                              .filter(Boolean)
                              .join(' › ')}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            رسوم التوصيل: <span className="font-mono text-emerald-400 font-bold">{formatCurrency(sa.delivery_fee)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleServiceAreaActive(sa)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer transition ${
                            sa.is_active
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {sa.is_active ? 'نشط' : 'معطل'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteServiceArea(sa)}
                          className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 cursor-pointer transition"
                          title="إزالة المنطقة من نطاق التوصيل"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsServiceAreasModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                إغلاق
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
                  value={toInputNumber(editingCategory?.sort_order, 1)}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setEditingCategory({ ...editingCategory, sort_order: v === '' ? 1 : (parseInt(v) || 0) });
                  }}
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
                  if (!hasPermission('restaurants.manage')) {
                    showToast('ليس لديك صلاحية لإدارة التصنيفات', 'error');
                    return;
                  }
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
                  value={toInputNumber(editingMenuCategory?.sort_order, 1)}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setEditingMenuCategory({ ...editingMenuCategory, sort_order: v === '' ? 1 : (parseInt(v) || 0) });
                  }}
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
                  if (!hasPermission('restaurants.manage')) {
                    showToast('ليس لديك صلاحية لإدارة أقسام القائمة', 'error');
                    return;
                  }
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

              <div>
                <label className="block text-slate-300 font-bold mb-1">السعر (ج.م) *</label>
                <input
                  type="number"
                  value={toInputNumber(editingMenuItem?.price, 50)}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setEditingMenuItem({ ...editingMenuItem, price: v === '' ? 0 : (parseFloat(v) || 0) });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none font-mono"
                />
              </div>

              <div>
                <RestaurantImageUploader
                  label="صورة الصنف / المنتج"
                  value={editingMenuItem.image_url}
                  restaurantId={editingMenuItem.restaurant_id || null}
                  targetType="menu_item"
                  targetId={editingMenuItem.id}
                  onChange={(newPath) => setEditingMenuItem({ ...editingMenuItem, image_url: newPath })}
                  helpText="الصورة تُربط بمعرّف المطعم وتُخزن في حاوية الكتالوج restaurant-product-images ثم يُحفظ مسارها في سجل الصنف."
                />
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
                  if (!hasPermission('restaurants.manage')) {
                    showToast('ليس لديك صلاحية لإدارة أصناف الطعام', 'error');
                    return;
                  }
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
          ADD / EDIT OPTION GROUP MODAL
          ===================================================================== */}
      {isOptionModalOpen && editingOption && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">
                {editingOption.id ? 'تعديل مجموعة الاختيارات' : 'إضافة مجموعة اختيارات جديدة'}
              </h3>
              <button
                onClick={() => setIsOptionModalOpen(false)}
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
                    value={editingOption.restaurant_id || ''}
                    onChange={(e) => setEditingOption({ ...editingOption, restaurant_id: e.target.value })}
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
                  <label className="block text-slate-300 font-bold mb-1">الصنف المرتبط *</label>
                  <select
                    value={editingOption.menu_item_id || ''}
                    onChange={(e) => setEditingOption({ ...editingOption, menu_item_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="">— اختر الصنف —</option>
                    {menuItems
                      .filter((mi) => !editingOption.restaurant_id || mi.restaurant_id === editingOption.restaurant_id)
                      .map((mi) => (
                        <option key={mi.id} value={mi.id}>
                          {mi.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">اسم المجموعة *</label>
                <input
                  type="text"
                  value={editingOption.name || ''}
                  onChange={(e) => setEditingOption({ ...editingOption, name: e.target.value })}
                  placeholder="مثال: الحجم، نوع الخبز، إضافات الجبنة..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">الحد الأدنى للاختيار</label>
                  <input
                    type="number"
                    min="0"
                    value={toInputNumber(editingOption?.min_select, 0)}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setEditingOption({ ...editingOption, min_select: v === '' ? 0 : (parseInt(v) || 0) });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">الحد الأقصى للاختيار</label>
                  <input
                    type="number"
                    min="1"
                    value={toInputNumber(editingOption?.max_select, 1)}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setEditingOption({ ...editingOption, max_select: v === '' ? 1 : (parseInt(v) || 1) });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="opt_required"
                  checked={editingOption.required ?? false}
                  onChange={(e) => setEditingOption({ ...editingOption, required: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500"
                />
                <label htmlFor="opt_required" className="text-slate-300 font-bold cursor-pointer">
                  مجموعة اختيار إجبارية على العميل
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOptionModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  if (!hasPermission('restaurants.manage')) {
                    showToast('ليس لديك صلاحية لإدارة مجموعات الاختيار', 'error');
                    return;
                  }
                  if (!editingOption.name?.trim() || !editingOption.restaurant_id || !editingOption.menu_item_id) {
                    showToast('المطعم، الصنف واسم المجموعة مطلوبين', 'error');
                    return;
                  }
                  const minS = Number(editingOption.min_select ?? 0);
                  const maxS = Number(editingOption.max_select ?? 1);
                  if (minS < 0 || maxS < 1 || minS > maxS) {
                    showToast('الحد الأدنى لا يمكن أن يتجاوز الحد الأقصى', 'error');
                    return;
                  }
                  setIsSaving(true);
                  if (editingOption.id) {
                    const res = await restaurantAdminService.updateItemOption(editingOption.id, editingOption);
                    setIsSaving(false);
                    if (res.success) {
                      showToast('تم تعديل مجموعة الاختيار بنجاح', 'success');
                      setIsOptionModalOpen(false);
                      loadOptions();
                    } else {
                      showToast(res.error || 'تعذر تعديل المجموعة', 'error');
                    }
                  } else {
                    const res = await restaurantAdminService.createItemOption(editingOption as any);
                    setIsSaving(false);
                    if (res.success) {
                      showToast('تمت إضافة مجموعة الاختيار بنجاح', 'success');
                      setIsOptionModalOpen(false);
                      loadOptions();
                    } else {
                      showToast(res.error || 'تعذر إضافة المجموعة', 'error');
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
          ADD / EDIT OFFER MODAL
          ===================================================================== */}
      {isOfferModalOpen && editingOffer && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">
                {editingOffer.id ? 'تعديل العرض الترويجي' : 'إضافة عرض ترويجي جديد'}
              </h3>
              <button
                onClick={() => setIsOfferModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">المطعم *</label>
                <select
                  value={editingOffer.restaurant_id || ''}
                  onChange={(e) => setEditingOffer({ ...editingOffer, restaurant_id: e.target.value })}
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
                <label className="block text-slate-300 font-bold mb-1">عنوان العرض *</label>
                <input
                  type="text"
                  value={editingOffer.title || ''}
                  onChange={(e) => setEditingOffer({ ...editingOffer, title: e.target.value })}
                  placeholder="مثال: خصم 20% على المشويات"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">الوصف</label>
                <textarea
                  value={editingOffer.description || ''}
                  onChange={(e) => setEditingOffer({ ...editingOffer, description: e.target.value })}
                  placeholder="تفاصيل وشروط العرض..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none h-16"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">نوع الخصم</label>
                  <select
                    value={editingOffer.discount_type || 'percentage'}
                    onChange={(e) => setEditingOffer({ ...editingOffer, discount_type: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="percentage">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت (ج.م)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">قيمة الخصم *</label>
                  <input
                    type="number"
                    value={toInputNumber(editingOffer.discount_value, 10)}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setEditingOffer({ ...editingOffer, discount_value: v === '' ? 0 : (parseFloat(v) || 0) });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">تاريخ البدء *</label>
                  <input
                    type="date"
                    value={editingOffer.starts_at?.slice(0, 10) || ''}
                    onChange={(e) => setEditingOffer({ ...editingOffer, starts_at: new Date(e.target.value).toISOString() })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">تاريخ الانتهاء *</label>
                  <input
                    type="date"
                    value={editingOffer.ends_at?.slice(0, 10) || ''}
                    onChange={(e) => setEditingOffer({ ...editingOffer, ends_at: new Date(e.target.value).toISOString() })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOfferModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  if (!hasPermission('restaurants.manage')) {
                    showToast('ليس لديك صلاحية لإدارة العروض', 'error');
                    return;
                  }
                  if (!editingOffer.title?.trim() || !editingOffer.restaurant_id) {
                    showToast('المطعم وعنوان العرض مطلوبان', 'error');
                    return;
                  }
                  const discVal = Number(editingOffer.discount_value ?? 0);
                  if (discVal <= 0) {
                    showToast('قيمة الخصم يجب أن تكون أكبر من صفر', 'error');
                    return;
                  }
                  if (editingOffer.discount_type === 'percentage' && discVal > 100) {
                    showToast('نسبة الخصم لا يمكن أن تتجاوز 100%', 'error');
                    return;
                  }
                  setIsSaving(true);
                  if (editingOffer.id) {
                    const res = await restaurantAdminService.updateOffer(editingOffer.id, editingOffer);
                    setIsSaving(false);
                    if (res.success) {
                      showToast('تم تعديل العرض بنجاح', 'success');
                      setIsOfferModalOpen(false);
                      loadOffers();
                    } else {
                      showToast(res.error || 'تعذر حفظ العرض', 'error');
                    }
                  } else {
                    const res = await restaurantAdminService.createOffer(editingOffer as any);
                    setIsSaving(false);
                    if (res.success) {
                      showToast('تمت إضافة العرض بنجاح', 'success');
                      setIsOfferModalOpen(false);
                      loadOffers();
                    } else {
                      showToast(res.error || 'تعذر إضافة العرض', 'error');
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
                  if (!hasPermission('restaurants.manage')) {
                    showToast('ليس لديك صلاحية لتوثيق حل الشكاوى', 'error');
                    return;
                  }
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
