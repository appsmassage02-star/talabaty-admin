import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import {
  CentralDriverAreaCoverage,
  CentralDriverCoveragePool,
  CentralRestaurantSummary,
  CentralServiceType,
  DeliveryAreaTariff,
  DeliveryAreaTariffBatchInput,
  DeliveryAreaTariffInput,
  DeliveryDriver,
  DeliverySystemSettings,
  DriverCoverageMutationInput,
  GeoArea,
  GeoCenter,
  GeoGovernorate,
  TariffAreaConflictDetail,
} from '../types';
import {
  GeoLookups,
  buildGeoLookups,
  buildServiceSectionSummaries,
  centralGeoDeliveryService,
} from '../services/centralGeoDeliveryService';
import { CentralServicesTab } from './central/CentralServicesTab';
import { CentralGeoExplorerTab } from './central/CentralGeoExplorerTab';
import { CentralPricingTariffsTab } from './central/CentralPricingTariffsTab';
import { CentralDriverCoverageTab } from './central/CentralDriverCoverageTab';
import {
  AlertTriangle,
  Coins,
  Globe,
  Layers,
  Lock,
  Navigation,
  RefreshCw,
  Trash2,
} from 'lucide-react';

type CentralTabId = 'central_services' | 'central_geo' | 'central_pricing' | 'central_drivers';

export const AdminCentralGeoOperations: React.FC = () => {
  const { activeSection, navigateToSection, hasPermission, showToast } = useAdmin();

  const currentTab: CentralTabId = useMemo(() => {
    if (
      activeSection === 'central_services' ||
      activeSection === 'central_geo' ||
      activeSection === 'central_pricing' ||
      activeSection === 'central_drivers'
    ) {
      return activeSection;
    }
    return 'central_services';
  }, [activeSection]);

  const canViewAreas = hasPermission('central_areas.view');
  const canManageAreas = hasPermission('central_areas.manage');
  const canViewPricing = hasPermission('central_pricing.view');
  const canManagePricing = hasPermission('central_pricing.manage');
  const canViewCoverage = hasPermission('central_driver_coverage.view');
  const canManageCoverage = hasPermission('central_driver_coverage.manage');

  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  // Core data from Talabat Al-Bayt DEV
  const [governorates, setGovernorates] = useState<GeoGovernorate[]>([]);
  const [centers, setCenters] = useState<GeoCenter[]>([]);
  const [lightAreas, setLightAreas] = useState<
    Array<{ id: string; governorate_id: string; center_id: string; is_active: boolean }>
  >([]);
  const [restaurants, setRestaurants] = useState<CentralRestaurantSummary[]>([]);
  const [tariffs, setTariffs] = useState<DeliveryAreaTariff[]>([]);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [platformCoverages, setPlatformCoverages] = useState<CentralDriverAreaCoverage[]>([]);
  const [restaurantCoverages, setRestaurantCoverages] = useState<CentralDriverAreaCoverage[]>([]);
  const [deliverySystemSettings, setDeliverySystemSettings] = useState<DeliverySystemSettings | null>(null);

  // Errors per data source (truthful DB error propagation)
  const [geoError, setGeoError] = useState<string | null>(null);
  const [tariffsError, setTariffsError] = useState<string | null>(null);
  const [tariffsConstraintHint, setTariffsConstraintHint] = useState<string | null>(null);
  const [driversError, setDriversError] = useState<string | null>(null);
  const [platformCoverageError, setPlatformCoverageError] = useState<string | null>(null);
  const [restaurantCoverageError, setRestaurantCoverageError] = useState<string | null>(null);
  const [deliverySystemSettingsError, setDeliverySystemSettingsError] = useState<string | null>(null);

  const [pricingInitialService, setPricingInitialService] = useState<CentralServiceType | ''>('');

  // In-app delete confirmation modal (never window.confirm)
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: 'tariff'; tariff: DeliveryAreaTariff; label: string }
    | { kind: 'coverage'; pool: CentralDriverCoveragePool; id: string; label: string }
    | null
  >(null);

  const loadAllCentralData = useCallback(async () => {
    setIsLoading(true);
    setGeoError(null);
    setTariffsError(null);
    setTariffsConstraintHint(null);
    setDriversError(null);
    setPlatformCoverageError(null);
    setRestaurantCoverageError(null);
    setDeliverySystemSettingsError(null);

    try {
      const [govRes, centerRes, lightAreasRes, restRes] = await Promise.all([
        centralGeoDeliveryService.getGeoGovernorates(),
        centralGeoDeliveryService.getGeoCenters(),
        centralGeoDeliveryService.getAllGeoAreasLightweight(),
        centralGeoDeliveryService.getRestaurants(),
      ]);

      const geoErrs = [govRes.error, centerRes.error, lightAreasRes.error].filter(Boolean);
      if (geoErrs.length > 0) {
        setGeoError(geoErrs.join(' | '));
      }

      setGovernorates(govRes.governorates);
      setCenters(centerRes.centers);
      setLightAreas(lightAreasRes.areas);
      setRestaurants(restRes.restaurants);

      const baseLookups = buildGeoLookups(govRes.governorates, centerRes.centers, []);
      const restMap = new Map<string, CentralRestaurantSummary>();
      restRes.restaurants.forEach((r) => restMap.set(r.id, r));

      const [tariffsRes, fleetRes, sysSettingsRes] = await Promise.all([
        centralGeoDeliveryService.getDeliveryAreaTariffs(baseLookups, restMap),
        centralGeoDeliveryService.getDriversAndCoverage(baseLookups, restMap),
        centralGeoDeliveryService.getDeliverySystemSettings(),
      ]);

      if (tariffsRes.error) {
        setTariffsError(tariffsRes.error);
        setTariffsConstraintHint(tariffsRes.constraintHint || null);
      }
      setTariffs(tariffsRes.tariffs);

      if (fleetRes.driversError) setDriversError(fleetRes.driversError);
      if (fleetRes.platformCoverageError) setPlatformCoverageError(fleetRes.platformCoverageError);
      if (fleetRes.restaurantCoverageError) setRestaurantCoverageError(fleetRes.restaurantCoverageError);
      setDrivers(fleetRes.drivers);
      setPlatformCoverages(fleetRes.platformCoverages);
      setRestaurantCoverages(fleetRes.restaurantCoverages);

      if (sysSettingsRes.error) {
        setDeliverySystemSettingsError(sysSettingsRes.error);
      }
      setDeliverySystemSettings(sysSettingsRes.settings);
    } catch (e: any) {
      setGeoError(e?.message || 'حدث خطأ غير متوقع أثناء تحميل البيانات المركزية');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllCentralData();
  }, [loadAllCentralData]);

  const baseLookups: GeoLookups = useMemo(
    () => buildGeoLookups(governorates, centers, []),
    [governorates, centers]
  );

  const restaurantsById = useMemo(() => {
    const map = new Map<string, CentralRestaurantSummary>();
    restaurants.forEach((r) => map.set(r.id, r));
    return map;
  }, [restaurants]);

  const geoStats = useMemo(
    () => centralGeoDeliveryService.computeGeoHierarchyCounts(governorates, centers, lightAreas),
    [governorates, centers, lightAreas]
  );

  const serviceSummaries = useMemo(
    () => buildServiceSectionSummaries(tariffs, baseLookups),
    [tariffs, baseLookups]
  );

  // Handlers
  const handleSaveTariff = async (
    input: DeliveryAreaTariffInput
  ): Promise<{ success: boolean; data?: DeliveryAreaTariff; error?: string }> => {
    if (!canManagePricing) {
      return { success: false, error: 'ليس لديك صلاحية إدارة التسعير (central_pricing.manage).' };
    }
    setIsMutating(true);
    try {
      // Load target center's areas if needed so parent-child validation runs against authoritative DB records
      let effectiveLookups = baseLookups;
      if (input.scope_level === 'area' && input.center_id && input.area_id) {
        const areaRes = await centralGeoDeliveryService.getGeoAreasByIds([input.area_id]);
        effectiveLookups = buildGeoLookups(governorates, centers, areaRes.areas);
      }

      const res = await centralGeoDeliveryService.saveDeliveryAreaTariff(
        input,
        tariffs,
        effectiveLookups,
        restaurantsById
      );

      if (!res.success || !res.data) {
        showToast(res.error || 'فشل حفظ التسعيرة', 'error');
        return { success: false, error: res.error };
      }

      showToast(
        `${input.id ? 'تم تحديث التسعيرة' : 'تمت إضافة التسعيرة'} — قيم قاعدة البيانات: صافي المندوب ${res.data.driver_net_fee} ج.م | رسوم العميل ${res.data.customer_delivery_fee} ج.م`,
        'success'
      );
      await loadAllCentralData();
      return { success: true, data: res.data };
    } finally {
      setIsMutating(false);
    }
  };

  const handleSaveTariffBatch = async (
    input: DeliveryAreaTariffBatchInput
  ): Promise<{
    success: boolean;
    data?: DeliveryAreaTariff[];
    error?: string;
    areaConflicts?: TariffAreaConflictDetail[];
  }> => {
    if (!canManagePricing) {
      return { success: false, error: 'ليس لديك صلاحية إدارة التسعير (central_pricing.manage).' };
    }
    setIsMutating(true);
    try {
      const uniqueAreaIds = Array.from(new Set(input.area_ids.map((id) => id.trim()).filter(Boolean)));
      let effectiveLookups = baseLookups;
      if (uniqueAreaIds.length > 0) {
        const areaRes = await centralGeoDeliveryService.getGeoAreasByIds(uniqueAreaIds);
        if (areaRes.error) {
          showToast(areaRes.error, 'error');
          return { success: false, error: areaRes.error };
        }
        effectiveLookups = buildGeoLookups(governorates, centers, areaRes.areas);
      }

      const res = await centralGeoDeliveryService.saveDeliveryAreaTariffsBatch(
        input,
        tariffs,
        effectiveLookups,
        restaurantsById
      );

      if (!res.success || !res.data) {
        showToast(res.error || 'فشل حفظ التسعيرة للمناطق المختارة', 'error');
        return {
          success: false,
          error: res.error,
          areaConflicts: res.areaConflicts,
        };
      }

      const sample = res.data[0];
      showToast(
        `تم حفظ ${res.data.length} تسعيرة والتحقق منها من قاعدة البيانات — صافي المندوب ${sample.driver_net_fee} ج.م | رسوم العميل ${sample.customer_delivery_fee} ج.م`,
        'success'
      );
      await loadAllCentralData();
      return { success: true, data: res.data };
    } finally {
      setIsMutating(false);
    }
  };

  const handleToggleTariffEnabled = async (tariff: DeliveryAreaTariff, nextEnabled: boolean) => {
    const allowed =
      currentTab === 'central_services' ? canManageAreas || canManagePricing : canManagePricing;
    if (!allowed) {
      showToast('ليس لديك صلاحية تعديل حالة التفعيل', 'error');
      return;
    }

    setIsMutating(true);
    try {
      let effectiveLookups = baseLookups;
      if (tariff.area_id) {
        const areaRes = await centralGeoDeliveryService.getGeoAreasByIds([tariff.area_id]);
        effectiveLookups = buildGeoLookups(governorates, centers, areaRes.areas);
      }

      const res = await centralGeoDeliveryService.toggleDeliveryAreaTariffEnabled(
        tariff,
        nextEnabled,
        effectiveLookups
      );
      if (!res.success) {
        showToast(res.error || 'تعذر تغيير حالة التفعيل', 'error');
        return;
      }
      showToast(
        nextEnabled ? 'تم تفعيل التسعيرة وتأكيدها من قاعدة البيانات' : 'تم تعطيل التسعيرة وتأكيدها من قاعدة البيانات',
        'success'
      );
      await loadAllCentralData();
    } finally {
      setIsMutating(false);
    }
  };

  const handleRequestDeleteTariff = async (tariff: DeliveryAreaTariff) => {
    if (!canManagePricing) {
      showToast('ليس لديك صلاحية حذف التسعير', 'error');
      return;
    }
    const label = [tariff.governorate_name_ar, tariff.center_name_ar !== '—' ? tariff.center_name_ar : null, tariff.area_name_ar !== '—' ? tariff.area_name_ar : null]
      .filter(Boolean)
      .join(' / ');
    setPendingDelete({ kind: 'tariff', tariff, label });
  };

  const handleSaveCoverageBatch = async (
    inputs: DriverCoverageMutationInput[],
    areasMapForLookup: Map<string, GeoArea>
  ): Promise<{ successCount: number; errors: string[] }> => {
    if (!canManageCoverage) {
      return {
        successCount: 0,
        errors: ['ليس لديك صلاحية إدارة توزيع العمالة (central_driver_coverage.manage).'],
      };
    }

    setIsMutating(true);
    const errors: string[] = [];
    let successCount = 0;

    try {
      const driverById = new Map<string, DeliveryDriver>();
      drivers.forEach((d) => driverById.set(d.id, d));

      const mergedLookups = buildGeoLookups(
        governorates,
        centers,
        Array.from(areasMapForLookup.values())
      );

      for (const item of inputs) {
        const poolExisting = item.pool === 'platform' ? platformCoverages : restaurantCoverages;
        const driver = driverById.get(item.driver_id);

        const res = await centralGeoDeliveryService.saveDriverCoverage(
          item,
          driver,
          poolExisting,
          mergedLookups,
          restaurantsById
        );
        if (res.success) {
          successCount += 1;
        } else if (res.error) {
          errors.push(res.error);
        }
      }

      if (successCount > 0) {
        showToast(`تم حفظ وتأكيد ${successCount} سجل تغطية من قاعدة البيانات`, 'success');
        await loadAllCentralData();
      }
      if (errors.length > 0 && successCount === 0) {
        showToast(errors[0], 'error');
      }
      return { successCount, errors };
    } finally {
      setIsMutating(false);
    }
  };

  const handleToggleCoverageActive = async (
    pool: CentralDriverCoveragePool,
    coverage: CentralDriverAreaCoverage,
    nextActive: boolean
  ) => {
    if (!canManageCoverage) {
      showToast('ليس لديك صلاحية تعديل حالة تغطية العمالة', 'error');
      return;
    }
    setIsMutating(true);
    try {
      const driver = drivers.find((d) => d.id === coverage.driver_id);
      let effectiveLookups = baseLookups;
      if (coverage.area_id) {
        const areaRes = await centralGeoDeliveryService.getGeoAreasByIds([coverage.area_id]);
        effectiveLookups = buildGeoLookups(governorates, centers, areaRes.areas);
      }

      const res = await centralGeoDeliveryService.toggleDriverCoverageActive(
        pool,
        coverage,
        driver,
        nextActive,
        effectiveLookups
      );
      if (!res.success) {
        showToast(res.error || 'تعذر تغيير حالة تغطية المندوب', 'error');
        return;
      }
      showToast(
        nextActive ? 'تم تفعيل تغطية المندوب وتأكيدها من قاعدة البيانات' : 'تم إيقاف تغطية المندوب دون حذف حسابه',
        'success'
      );
      await loadAllCentralData();
    } finally {
      setIsMutating(false);
    }
  };

  const handleRequestDeleteCoverage = async (pool: CentralDriverCoveragePool, id: string) => {
    if (!canManageCoverage) {
      showToast('ليس لديك صلاحية حذف التغطية', 'error');
      return;
    }
    setPendingDelete({
      kind: 'coverage',
      pool,
      id,
      label: pool === 'platform' ? 'تغطية مندوب المنصة' : 'تغطية مندوب المطعم',
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsMutating(true);
    try {
      if (pendingDelete.kind === 'tariff') {
        const res = await centralGeoDeliveryService.deleteDeliveryAreaTariff(pendingDelete.tariff.id);
        if (!res.success) {
          showToast(res.error || 'تعذر حذف التسعيرة', 'error');
        } else {
          showToast('تم حذف التسعيرة وتأكيد زوالها من قاعدة البيانات', 'info');
          await loadAllCentralData();
        }
      } else {
        const res = await centralGeoDeliveryService.deleteDriverCoverage(
          pendingDelete.pool,
          pendingDelete.id
        );
        if (!res.success) {
          showToast(res.error || 'تعذر حذف التغطية', 'error');
        } else {
          showToast('تم حذف تغطية المندوب وتأكيد زوالها من قاعدة البيانات', 'info');
          await loadAllCentralData();
        }
      }
      setPendingDelete(null);
    } finally {
      setIsMutating(false);
    }
  };

  // Permission Check for Current Tab
  const hasCurrentTabAccess = useMemo(() => {
    switch (currentTab) {
      case 'central_services':
      case 'central_geo':
        return canViewAreas;
      case 'central_pricing':
        return canViewPricing;
      case 'central_drivers':
        return canViewCoverage;
      default:
        return false;
    }
  }, [currentTab, canViewAreas, canViewPricing, canViewCoverage]);

  const tabItems: Array<{
    id: CentralTabId;
    label: string;
    icon: React.FC<{ className?: string }>;
    visible: boolean;
  }> = [
    { id: 'central_services', label: 'أقسام الخدمات', icon: Layers, visible: canViewAreas },
    { id: 'central_geo', label: 'المناطق الجغرافية', icon: Globe, visible: canViewAreas },
    { id: 'central_pricing', label: 'التسعير والرسوم', icon: Coins, visible: canViewPricing },
    { id: 'central_drivers', label: 'عمالة التوصيل', icon: Navigation, visible: canViewCoverage },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Section Header & Tab Navigation */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2.5">
              <Globe className="w-6 h-6 text-emerald-400" />
              <span>إدارة المناطق والتوصيل والتسعير والعمالة</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              الإدارة المركزية الموحدة والمربوطة مباشرة بقاعدة بيانات Talabat Al-Bayt DEV (معزولة تماماً عن الإعدادات القديمة).
            </p>
          </div>
          {isLoading && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-emerald-400 font-bold">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>جاري مزامنة البيانات الحية...</span>
            </div>
          )}
        </div>

        {/* Sub-Tabs */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">
          {tabItems
            .filter((t) => t.visible)
            .map((tab) => {
              const Icon = tab.icon;
              const active = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => navigateToSection(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
                    active
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                      : 'bg-slate-950/70 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
        </div>
      </div>

      {/* Geo Loading Error */}
      {geoError && (
        <div className="bg-rose-950/50 border border-rose-500/40 rounded-2xl p-4 flex items-start gap-2.5 text-xs text-rose-200">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span className="font-mono break-words">{geoError}</span>
        </div>
      )}

      {/* Content Gate */}
      {!hasCurrentTabAccess ? (
        <div className="bg-slate-900/90 border border-rose-500/30 rounded-3xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center mx-auto text-rose-400">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-white">غير مصرح بالوصول إلى هذا التبويب</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            حسابك لا يمتلك الصلاحية المطلوبة لعرض هذه البيانات. تواصل مع المدير الأعلى للنظام لمنح الصلاحية المحددة.
          </p>
        </div>
      ) : currentTab === 'central_services' ? (
        <CentralServicesTab
          summaries={serviceSummaries}
          tariffs={tariffs}
          tariffsError={tariffsError}
          canManageAreas={canManageAreas}
          canViewPricing={canViewPricing}
          isBusy={isLoading || isMutating}
          onToggleTariffEnabled={handleToggleTariffEnabled}
          onGoToPricingForService={(svc) => {
            setPricingInitialService(svc);
            navigateToSection('central_pricing');
          }}
          onRefresh={loadAllCentralData}
        />
      ) : currentTab === 'central_geo' ? (
        <CentralGeoExplorerTab
          governorates={governorates}
          centers={centers}
          govCounts={geoStats.byGovernorate}
          centerCounts={geoStats.byCenter}
          geoTotals={geoStats.totals}
          deliverySystemSettings={deliverySystemSettings}
          deliverySystemSettingsError={deliverySystemSettingsError}
          onRefresh={loadAllCentralData}
          isLoadingBase={isLoading}
        />
      ) : currentTab === 'central_pricing' ? (
        <CentralPricingTariffsTab
          tariffs={tariffs}
          governorates={governorates}
          centers={centers}
          restaurants={restaurants}
          lookups={baseLookups}
          restaurantsById={restaurantsById}
          initialServiceFilter={pricingInitialService}
          tariffsError={tariffsError}
          tariffsConstraintHint={tariffsConstraintHint}
          canManagePricing={canManagePricing}
          isBusy={isLoading || isMutating}
          onSaveTariff={handleSaveTariff}
          onSaveTariffBatch={handleSaveTariffBatch}
          onToggleTariff={handleToggleTariffEnabled}
          onDeleteTariff={handleRequestDeleteTariff}
          onRefresh={loadAllCentralData}
        />
      ) : (
        <CentralDriverCoverageTab
          drivers={drivers}
          platformCoverages={platformCoverages}
          restaurantCoverages={restaurantCoverages}
          governorates={governorates}
          centers={centers}
          restaurants={restaurants}
          lookups={baseLookups}
          restaurantsById={restaurantsById}
          driversError={driversError}
          platformCoverageError={platformCoverageError}
          restaurantCoverageError={restaurantCoverageError}
          canManageCoverage={canManageCoverage}
          isBusy={isLoading || isMutating}
          onSaveCoverageBatch={handleSaveCoverageBatch}
          onToggleCoverageActive={handleToggleCoverageActive}
          onDeleteCoverage={handleRequestDeleteCoverage}
          onRefresh={loadAllCentralData}
        />
      )}

      {/* Delete Confirmation Modal */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full border border-rose-500/30 shadow-2xl p-6 space-y-4 text-right text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center mx-auto text-rose-400">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h4 className="text-base font-black text-rose-400">تأكيد الحذف النهائي</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                هل أنت متأكد من حذف <strong className="text-white">{pendingDelete.label}</strong>؟ لا يمكن التراجع عن هذا الإجراء وسيتم التحقق من الحذف من قاعدة البيانات.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isMutating}
                onClick={() => setPendingDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white cursor-pointer"
              >
                {isMutating ? 'جاري الحذف...' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
