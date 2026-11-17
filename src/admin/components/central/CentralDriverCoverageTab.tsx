import React, { useEffect, useMemo, useState } from 'react';
import {
  CentralDriverAreaCoverage,
  CentralDriverCoveragePool,
  CentralRestaurantSummary,
  CentralScopeLevel,
  CentralServiceType,
  DeliveryDriver,
  DriverCoverageMutationInput,
  GeoArea,
  GeoCenter,
  GeoGovernorate,
} from '../../types';
import {
  CENTRAL_SERVICE_DEFINITIONS,
  GeoLookups,
  centralGeoDeliveryService,
  filterDriversForCoverage,
  getLaunchScopeGovernorates,
  getScopeLevelLabelAr,
  getServiceLabelAr,
  isDriverEligibleForOperations,
} from '../../services/centralGeoDeliveryService';
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  Info,
  Navigation,
  Plus,
  Power,
  RefreshCw,
  Search,
  ShieldAlert,
  Store,
  Trash2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';

interface CentralDriverCoverageTabProps {
  drivers: DeliveryDriver[];
  platformCoverages: CentralDriverAreaCoverage[];
  restaurantCoverages: CentralDriverAreaCoverage[];
  governorates: GeoGovernorate[];
  centers: GeoCenter[];
  restaurants: CentralRestaurantSummary[];
  lookups: GeoLookups;
  restaurantsById: Map<string, CentralRestaurantSummary>;
  driversError?: string | null;
  platformCoverageError?: string | null;
  restaurantCoverageError?: string | null;
  canManageCoverage: boolean;
  isBusy: boolean;
  onSaveCoverageBatch: (
    inputs: DriverCoverageMutationInput[],
    areasMapForLookup: Map<string, GeoArea>
  ) => Promise<{ successCount: number; errors: string[] }>;
  onToggleCoverageActive: (
    pool: CentralDriverCoveragePool,
    coverage: CentralDriverAreaCoverage,
    nextActive: boolean
  ) => Promise<void>;
  onDeleteCoverage: (pool: CentralDriverCoveragePool, id: string) => Promise<void>;
  onRefresh: () => void;
}

export const CentralDriverCoverageTab: React.FC<CentralDriverCoverageTabProps> = ({
  drivers,
  platformCoverages,
  restaurantCoverages,
  governorates,
  centers,
  lookups,
  driversError,
  platformCoverageError,
  restaurantCoverageError,
  canManageCoverage,
  isBusy,
  onSaveCoverageBatch,
  onToggleCoverageActive,
  onDeleteCoverage,
  onRefresh,
}) => {
  const [activePool, setActivePool] = useState<CentralDriverCoveragePool>('platform');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterService, setFilterService] = useState<CentralServiceType | ''>('');
  const [filterGovId, setFilterGovId] = useState('');
  const [filterCenterId, setFilterCenterId] = useState('');
  const [filterAreaId, setFilterAreaId] = useState('');
  const [filterCenterAreas, setFilterCenterAreas] = useState<GeoArea[]>([]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoverage, setEditingCoverage] = useState<CentralDriverAreaCoverage | null>(null);
  const [formDriverId, setFormDriverId] = useState('');
  const [formServices, setFormServices] = useState<CentralServiceType[]>(['household_shortages']);
  const [formScope, setFormScope] = useState<CentralScopeLevel>('area');
  const [formGovId, setFormGovId] = useState('');
  const [formCenterId, setFormCenterId] = useState('');
  const [formAreaIds, setFormAreaIds] = useState<string[]>([]);
  const [formPriority, setFormPriority] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [modalAreas, setModalAreas] = useState<GeoArea[]>([]);
  const [isLoadingModalAreas, setIsLoadingModalAreas] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Launch-scope governorates (strictly enforces Sohag launch scope)
  const launchGovernorates = useMemo(
    () => getLaunchScopeGovernorates(governorates),
    [governorates]
  );

  const filterCenters = useMemo(
    () => (filterGovId ? centers.filter((c) => c.governorate_id === filterGovId && c.is_active) : []),
    [centers, filterGovId]
  );
  const modalCenters = useMemo(
    () => (formGovId ? centers.filter((c) => c.governorate_id === formGovId && c.is_active) : []),
    [centers, formGovId]
  );

  // Load areas when filter center changes
  useEffect(() => {
    let cancelled = false;
    if (!filterCenterId) {
      setFilterCenterAreas([]);
      return;
    }
    centralGeoDeliveryService
      .getGeoAreasByCenter(filterCenterId, filterGovId || undefined, true)
      .then((res) => {
        if (!cancelled) setFilterCenterAreas(res.areas);
      });
    return () => {
      cancelled = true;
    };
  }, [filterGovId, filterCenterId]);

  // Load areas when modal center changes
  useEffect(() => {
    let cancelled = false;
    if (!isModalOpen || !formCenterId || formScope !== 'area') {
      setModalAreas([]);
      return;
    }
    setIsLoadingModalAreas(true);
    centralGeoDeliveryService
      .getGeoAreasByCenter(formCenterId, formGovId || undefined, true)
      .then((res) => {
        if (!cancelled) setModalAreas(res.areas);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingModalAreas(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isModalOpen, formGovId, formCenterId, formScope]);

  const currentCoverages = activePool === 'platform' ? platformCoverages : restaurantCoverages;
  const currentPoolError = activePool === 'platform' ? platformCoverageError : restaurantCoverageError;

  const eligibleDrivers = useMemo(
    () => drivers.filter((d) => isDriverEligibleForOperations(d)),
    [drivers]
  );
  const ineligibleDrivers = useMemo(
    () => drivers.filter((d) => !isDriverEligibleForOperations(d)),
    [drivers]
  );

  const filteredCoverages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return currentCoverages.filter((c) => {
      if (filterService && c.service_type && c.service_type !== filterService) return false;
      if (filterGovId && c.governorate_id !== filterGovId) return false;
      if (filterCenterId && c.center_id !== filterCenterId) return false;
      if (filterAreaId && c.area_id !== filterAreaId) return false;
      if (!q) return true;
      return (
        (c.driver_name || '').toLowerCase().includes(q) ||
        (c.driver_phone || '').toLowerCase().includes(q) ||
        (c.governorate_name_ar || '').toLowerCase().includes(q) ||
        (c.center_name_ar || '').toLowerCase().includes(q) ||
        (c.area_name_ar || '').toLowerCase().includes(q)
      );
    });
  }, [currentCoverages, filterService, filterGovId, filterCenterId, filterAreaId, searchQuery]);

  const availabilityAnalysis = useMemo(() => {
    return filterDriversForCoverage(drivers, currentCoverages, {
      pool: activePool,
      service_type: filterService,
      governorate_id: filterGovId || undefined,
      center_id: filterCenterId || undefined,
      area_id: filterAreaId || undefined,
    });
  }, [drivers, currentCoverages, activePool, filterService, filterGovId, filterCenterId, filterAreaId]);

  const openAssignModal = () => {
    const defaultGov = launchGovernorates[0]?.id || '';
    setEditingCoverage(null);
    setFormDriverId('');
    setFormServices(activePool === 'restaurant' ? ['ready_food'] : ['household_shortages']);
    setFormScope('area');
    setFormGovId(defaultGov);
    setFormCenterId(filterCenterId || '');
    setFormAreaIds(filterAreaId ? [filterAreaId] : []);
    setFormPriority('');
    setFormIsActive(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cov: CentralDriverAreaCoverage) => {
    setEditingCoverage(cov);
    setFormDriverId(cov.driver_id);
    setFormServices([(cov.service_type as CentralServiceType) || (activePool === 'restaurant' ? 'ready_food' : 'household_shortages')]);
    setFormScope('area');
    setFormGovId(cov.governorate_id);
    setFormCenterId(cov.center_id || '');
    setFormAreaIds(cov.area_id ? [cov.area_id] : []);
    setFormPriority(
      cov.priority !== null && cov.priority !== undefined ? String(cov.priority) : ''
    );
    setFormIsActive(Boolean(cov.is_active));
    setModalError(null);
    setIsModalOpen(true);
  };

  const toggleServiceSelection = (svc: CentralServiceType) => {
    if (editingCoverage) {
      setFormServices([svc]);
      return;
    }
    setFormServices((prev) =>
      prev.includes(svc) ? (prev.length > 1 ? prev.filter((x) => x !== svc) : prev) : [...prev, svc]
    );
  };

  const toggleAreaSelection = (areaId: string) => {
    if (editingCoverage) {
      setFormAreaIds([areaId]);
      return;
    }
    setFormAreaIds((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formDriverId) {
      setModalError('يجب اختيار المندوب المؤهل.');
      return;
    }
    if (!formGovId) {
      setModalError('يجب اختيار المحافظة.');
      return;
    }
    if (formScope !== 'governorate' && !formCenterId) {
      setModalError('يجب اختيار المركز أو القسم.');
      return;
    }
    if (formScope === 'area' && formAreaIds.length === 0) {
      setModalError('يجب اختيار منطقة واحدة على الأقل عند التخصيص على مستوى المنطقة.');
      return;
    }

    const areasMap = new Map<string, GeoArea>(lookups.areasById);
    modalAreas.forEach((a) => areasMap.set(a.id, a));

    setIsSubmitting(true);
    try {
      let targetAreas: GeoArea[] = [];

      if (formScope === 'area') {
        targetAreas = formAreaIds
          .map((aid) => areasMap.get(aid))
          .filter((a): a is GeoArea => Boolean(a));
        if (targetAreas.length !== formAreaIds.length) {
          const fetched = await centralGeoDeliveryService.getGeoAreasByIds(formAreaIds);
          fetched.areas.forEach((a) => areasMap.set(a.id, a));
          targetAreas = formAreaIds
            .map((aid) => areasMap.get(aid))
            .filter((a): a is GeoArea => Boolean(a));
        }
      } else if (formScope === 'center') {
        const res = await centralGeoDeliveryService.getGeoAreasByCenter(formCenterId, formGovId, true);
        if (res.error) {
          setModalError(res.error);
          return;
        }
        res.areas.forEach((a) => areasMap.set(a.id, a));
        targetAreas = res.areas;
      } else {
        const res = await centralGeoDeliveryService.getGeoAreasByGovernorate(formGovId, true);
        if (res.error) {
          setModalError(res.error);
          return;
        }
        res.areas.forEach((a) => areasMap.set(a.id, a));
        targetAreas = res.areas;
      }

      if (targetAreas.length === 0) {
        setModalError('لا توجد مناطق مفعلة (is_active = true) داخل النطاق الجغرافي المختار لإسنادها.');
        return;
      }

      const inputs: DriverCoverageMutationInput[] = [];
      const targetServices =
        activePool === 'restaurant' ? (['ready_food'] as CentralServiceType[]) : formServices;

      for (const svc of targetServices) {
        for (const area of targetAreas) {
          inputs.push({
            id: editingCoverage && formScope === 'area' ? editingCoverage.id : undefined,
            pool: activePool,
            driver_id: formDriverId,
            restaurant_id: null,
            service_type: svc,
            scope_level: 'area',
            governorate_id: area.governorate_id,
            center_id: area.center_id,
            area_id: area.id,
            is_active: formIsActive,
            priority: activePool === 'platform' ? formPriority || null : null,
          });
        }
      }

      const result = await onSaveCoverageBatch(inputs, areasMap);
      if (result.errors.length > 0) {
        setModalError(result.errors.slice(0, 5).join(' | '));
      } else if (result.successCount > 0) {
        setIsModalOpen(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Strict Pool Separation */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-white">
              إدارة عمالة التوصيل وتوزيعها على المناطق والخدمات
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              فصل صارم بين عمالة المنصة (<span className="font-mono text-emerald-300">delivery_driver_area_coverage</span>) وعمالة المطاعم (<span className="font-mono text-amber-300">restaurant_driver_area_coverage</span>) عبر معرفات المناطق الحقيقية <span className="font-mono text-sky-300">area_id</span> في <span className="font-mono">geo_areas</span>، مع استبعاد السائقين غير المعتمدين أو المعطلين.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isBusy}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isBusy ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
          {canManageCoverage && (
            <button
              type="button"
              onClick={openAssignModal}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {activePool === 'platform' ? 'توزيع مندوب منصة' : 'توزيع مندوب مطعم'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Pool Switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            setActivePool('platform');
            setFilterService('');
          }}
          className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between ${
            activePool === 'platform'
              ? 'bg-emerald-500/15 border-emerald-500/50'
              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <Bike className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-sm font-black text-white block">مناديب المنصة (Platform Fleet)</span>
              <span className="text-[11px] font-mono text-slate-400">delivery_driver_area_coverage</span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 font-mono tabular-nums text-xs font-bold text-emerald-300">
            {platformCoverages.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActivePool('restaurant');
            setFilterService('ready_food');
          }}
          className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between ${
            activePool === 'restaurant'
              ? 'bg-amber-500/15 border-amber-500/50'
              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <Store className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="text-sm font-black text-white block">مناديب المطاعم (Restaurant Fleet)</span>
              <span className="text-[11px] font-mono text-slate-400">restaurant_driver_area_coverage</span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 font-mono tabular-nums text-xs font-bold text-amber-300">
            {restaurantCoverages.length}
          </span>
        </button>
      </div>

      {/* Real DB Errors */}
      {(driversError || currentPoolError) && (
        <div className="space-y-2">
          {driversError && (
            <div className="bg-rose-950/60 border border-rose-500/40 rounded-2xl p-3.5 text-xs text-rose-200 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="font-mono break-words">{driversError}</span>
            </div>
          )}
          {currentPoolError && (
            <div className="bg-rose-950/60 border border-rose-500/40 rounded-2xl p-3.5 text-xs text-rose-200 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="font-mono break-words">{currentPoolError}</span>
            </div>
          )}
        </div>
      )}

      {/* Eligibility & Scope Filter */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث باسم المندوب أو الهاتف أو المنطقة..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-8 pl-3 py-2 text-white"
            />
          </div>

          <select
            value={filterService}
            disabled={activePool === 'restaurant'}
            onChange={(e) => setFilterService(e.target.value as CentralServiceType | '')}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white disabled:opacity-60"
          >
            <option value="">كل الخدمات</option>
            {CENTRAL_SERVICE_DEFINITIONS.map((d) => (
              <option key={d.type} value={d.type}>
                {d.labelAr}
              </option>
            ))}
          </select>

          <select
            value={filterGovId}
            onChange={(e) => {
              setFilterGovId(e.target.value);
              setFilterCenterId('');
              setFilterAreaId('');
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
          >
            <option value="">محافظة الإطلاق (سوهاج)</option>
            {launchGovernorates.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name_ar}
              </option>
            ))}
          </select>

          <select
            value={filterCenterId}
            disabled={!filterGovId}
            onChange={(e) => {
              setFilterCenterId(e.target.value);
              setFilterAreaId('');
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white disabled:opacity-50"
          >
            <option value="">كل المراكز</option>
            {filterCenters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </select>

          <select
            value={filterAreaId}
            disabled={!filterCenterId}
            onChange={(e) => setFilterAreaId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white disabled:opacity-50"
          >
            <option value="">كل المناطق</option>
            {filterCenterAreas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name_ar}
              </option>
            ))}
          </select>
        </div>

        {/* Eligible vs Ineligible Drivers Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-800/80">
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
            <span className="text-slate-400">إجمالي السائقين المؤهلين</span>
            <span className="font-mono tabular-nums font-black text-emerald-400 text-sm">
              {eligibleDrivers.length}
            </span>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
            <span className="text-slate-400">غير مؤهلين (غير معتمد/معطل)</span>
            <span className="font-mono tabular-nums font-black text-rose-400 text-sm">
              {ineligibleDrivers.length}
            </span>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
            <span className="text-slate-400">مغطّون في النطاق المختار</span>
            <span className="font-mono tabular-nums font-black text-sky-400 text-sm">
              {availabilityAnalysis.eligibleCoveredDrivers.length}
            </span>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
            <span className="text-slate-400">متاحون للعمل الآن في النطاق</span>
            <span className="font-mono tabular-nums font-black text-emerald-300 text-sm">
              {availabilityAnalysis.eligibleCoveredDrivers.filter((x) => x.isCurrentlyAvailable).length}
            </span>
          </div>
        </div>
      </div>

      {/* Availability Split for Selected Area/Service */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 space-y-3">
          <h4 className="text-xs font-black text-emerald-300 flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            <span>
              السائقون المؤهلون والمغطّون للنطاق ({availabilityAnalysis.eligibleCoveredDrivers.length})
            </span>
          </h4>
          {availabilityAnalysis.eligibleCoveredDrivers.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              لا يوجد سائقون مؤهلون مغطّون حسب الفلتر الحالي.
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {availabilityAnalysis.eligibleCoveredDrivers.map(({ driver, matchedCoverages, isCurrentlyAvailable }) => (
                <div
                  key={driver.id}
                  className="p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-bold text-white block">{driver.full_name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{driver.phone}</span>
                  </div>
                  <div className="text-left">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isCurrentlyAvailable
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {isCurrentlyAvailable ? 'متاح للعمل الآن' : 'غير متصل بالعمل حالياً'}
                    </span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      {matchedCoverages.length} نطاق نشط
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 space-y-3">
          <h4 className="text-xs font-black text-rose-300 flex items-center gap-2">
            <UserX className="w-4 h-4" />
            <span>
              غير المتاحين أو غير المؤهلين ({availabilityAnalysis.ineligibleOrUncoveredDrivers.length})
            </span>
          </h4>
          {availabilityAnalysis.ineligibleOrUncoveredDrivers.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">جميع السائقين مؤهلون ومغطّون.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {availabilityAnalysis.ineligibleOrUncoveredDrivers.map(({ driver, reason }) => (
                <div
                  key={driver.id}
                  className="p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-slate-200 block truncate">{driver.full_name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{driver.phone}</span>
                  </div>
                  <span className="text-[10px] text-rose-300/90 text-left shrink-0 max-w-[55%]">
                    {reason}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Coverage Assignments Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden">
        {filteredCoverages.length === 0 ? (
          <div className="py-14 text-center text-xs text-slate-400 space-y-2">
            <Navigation className="w-7 h-7 text-slate-600 mx-auto" />
            <p>لا توجد ارتباطات تغطية مسجلة في هذا القسم حتى الآن.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">المندوب</th>
                  <th className="p-3.5">الخدمة</th>
                  <th className="p-3.5">النطاق الجغرافي (UUID)</th>
                  {activePool === 'platform' && <th className="p-3.5">الأولوية</th>}
                  <th className="p-3.5">أهلية المندوب</th>
                  <th className="p-3.5">حالة التغطية</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCoverages.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/35">
                    <td className="p-3.5">
                      <span className="font-bold text-white block">{c.driver_name}</span>
                      <span className="text-[10px] font-mono text-slate-400">{c.driver_phone || '—'}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold text-slate-200 block">
                        {getServiceLabelAr(c.service_type)}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="text-[10px] text-sky-300 block">
                        {getScopeLevelLabelAr(c.scope_level)}
                      </span>
                      <span className="font-bold text-slate-200">
                        {[
                          c.governorate_name_ar,
                          c.center_name_ar !== '—' ? c.center_name_ar : null,
                          c.area_name_ar !== '—' ? c.area_name_ar : null,
                        ]
                          .filter(Boolean)
                          .join(' / ')}
                      </span>
                    </td>
                    {activePool === 'platform' && (
                      <td className="p-3.5 font-mono tabular-nums text-slate-300">
                        {c.priority !== null && c.priority !== undefined ? c.priority : '—'}
                      </td>
                    )}
                    <td className="p-3.5">
                      {c.driver_is_eligible ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> مؤهل
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                          <AlertTriangle className="w-3 h-3" /> غير مؤهل
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          c.is_active
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {c.is_active ? 'مفعّل' : 'متوقف مؤقتاً'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      {canManageCoverage ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onToggleCoverageActive(activePool, c, !c.is_active)}
                            title={c.is_active ? 'تعطيل التغطية دون حذف المندوب' : 'تفعيل التغطية'}
                            className={`p-1.5 rounded-lg border cursor-pointer ${
                              c.is_active
                                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => openEditModal(c)}
                            title="تعديل التغطية"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 rotate-45" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onDeleteCoverage(activePool, c.id)}
                            title="إزالة التغطية"
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500 block text-center">عرض فقط</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign / Edit Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full border border-slate-800 shadow-2xl text-right text-white flex flex-col max-h-[92vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 shrink-0">
              <h4 className="text-base font-black text-white">
                {editingCoverage
                  ? 'تعديل تغطية المندوب'
                  : activePool === 'platform'
                  ? 'توزيع مندوب منصة على المناطق والخدمات'
                  : 'توزيع مندوب مطعم (restaurant_driver_area_coverage)'}
              </h4>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 text-xs">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {modalError && (
                  <div className="bg-rose-950/70 border border-rose-500/40 rounded-2xl p-3.5 text-rose-200 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span className="break-words">{modalError}</span>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    المندوب المؤهل (معتمد ومفعل إدارياً فقط) *
                  </label>
                  <select
                    required
                    disabled={Boolean(editingCoverage)}
                    value={formDriverId}
                    onChange={(e) => setFormDriverId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white disabled:opacity-60"
                  >
                    <option value="">اختر المندوب...</option>
                    {eligibleDrivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name} — {d.phone} ({d.is_available_for_work ? 'متاح للعمل' : 'غير متصل'})
                      </option>
                    ))}
                  </select>
                  {ineligibleDrivers.length > 0 && (
                    <p className="text-[10px] text-amber-300 mt-1">
                      يوجد {ineligibleDrivers.length} سائقين غير مؤهلين (بانتظار الاعتماد أو معطلين) مستبعدين تلقائياً من الإسناد.
                    </p>
                  )}
                </div>

                {activePool === 'restaurant' && (
                  <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      جدول عمالة المطاعم (<span className="font-mono">restaurant_driver_area_coverage</span>) يربط معرف المندوب بمعرف المنطقة الجغرافية (<span className="font-mono">area_id</span>) فقط مع فصل كامل عن عمالة المنصة؛ بينما يتم عزل تسعيرة كل مطعم في <span className="font-mono">delivery_area_tariffs.restaurant_id</span>.
                    </span>
                  </div>
                )}

                {/* Services Multi-select */}
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <label className="block font-bold text-slate-300">
                    أقسام الخدمات المغطاة {!editingCoverage && activePool === 'platform' ? '(يمكن اختيار أكثر من خدمة)' : ''} *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CENTRAL_SERVICE_DEFINITIONS.filter((d) =>
                      activePool === 'restaurant' ? d.type === 'ready_food' : true
                    ).map((d) => {
                      const selected = formServices.includes(d.type);
                      return (
                        <button
                          key={d.type}
                          type="button"
                          onClick={() => toggleServiceSelection(d.type)}
                          className={`px-3 py-1.5 rounded-xl border font-bold cursor-pointer transition-colors ${
                            selected
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {d.labelAr}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Geo Hierarchy & Multi-Area / Center / Gov Expansion */}
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">مستوى التخصيص *</label>
                      <select
                        disabled={Boolean(editingCoverage)}
                        value={formScope}
                        onChange={(e) => {
                          const next = e.target.value as CentralScopeLevel;
                          setFormScope(next);
                          if (next === 'governorate') {
                            setFormCenterId('');
                            setFormAreaIds([]);
                          } else if (next === 'center') {
                            setFormAreaIds([]);
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white disabled:opacity-60"
                      >
                        <option value="area">مناطق محددة</option>
                        <option value="center">كافة مناطق مركز / قسم</option>
                        <option value="governorate">كافة مناطق محافظة</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        المحافظة * <span className="text-[10px] text-emerald-400 font-normal">(نطاق الإطلاق: سوهاج)</span>
                      </label>
                      <select
                        required
                        value={formGovId}
                        onChange={(e) => {
                          setFormGovId(e.target.value);
                          setFormCenterId('');
                          setFormAreaIds([]);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                      >
                        <option value="">اختر المحافظة...</option>
                        {launchGovernorates.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name_ar}
                          </option>
                        ))}
                      </select>
                    </div>

                    {formScope !== 'governorate' && (
                      <div>
                        <label className="block font-bold text-slate-300 mb-1">المركز / القسم *</label>
                        <select
                          required
                          disabled={!formGovId}
                          value={formCenterId}
                          onChange={(e) => {
                            setFormCenterId(e.target.value);
                            setFormAreaIds([]);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white disabled:opacity-40"
                        >
                          <option value="">اختر المركز...</option>
                          {modalCenters.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name_ar}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {formScope !== 'area' && (
                    <p className="text-[11px] text-sky-300">
                      سيتم توسيع هذا الاختيار تلقائياً وحفظ سجل تغطية لكل منطقة مفعلة (<span className="font-mono">area_id</span>) تابعة للنطاق المختار وفق مخطط قاعدة البيانات.
                    </p>
                  )}

                  {formScope === 'area' && formCenterId && (
                    <div className="space-y-2 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-300">
                          اختر المناطق ({formAreaIds.length} محدد) {isLoadingModalAreas ? '...' : ''}
                        </label>
                        {!editingCoverage && modalAreas.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setFormAreaIds((prev) =>
                                prev.length === modalAreas.length ? [] : modalAreas.map((a) => a.id)
                              )
                            }
                            className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                          >
                            {formAreaIds.length === modalAreas.length ? 'إلغاء تحديد الكل' : 'تحديد كل مناطق المركز'}
                          </button>
                        )}
                      </div>
                      <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-900/70 p-2.5 rounded-xl border border-slate-800">
                        {modalAreas.map((a) => {
                          const checked = formAreaIds.includes(a.id);
                          return (
                            <label
                              key={a.id}
                              className="flex items-center gap-2 text-[11px] text-slate-200 cursor-pointer p-1 rounded hover:bg-slate-800/60"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleAreaSelection(a.id)}
                                className="w-3.5 h-3.5 rounded text-emerald-500 bg-slate-950 border-slate-700"
                              />
                              <span className="truncate">{a.name_ar}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activePool === 'platform' && (
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">الأولوية (Priority - اختياري)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="مثال: 1"
                        value={formPriority}
                        onChange={(e) => setFormPriority(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                      />
                    </div>
                  )}
                  <div className="flex items-center pt-2 sm:pt-5">
                    <label className="flex items-center gap-2 font-bold text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700"
                      />
                      <span>تفعيل ارتباط المندوب بهذه التغطية</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-4 border-t border-slate-800 bg-slate-950/95 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold cursor-pointer"
                >
                  {isSubmitting ? 'جاري الحفظ والتحقق...' : editingCoverage ? 'حفظ التعديلات' : 'حفظ التوزيع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
