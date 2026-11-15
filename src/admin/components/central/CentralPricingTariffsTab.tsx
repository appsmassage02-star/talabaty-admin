import React, { useEffect, useMemo, useState } from 'react';
import {
  CentralDeliveryOwner,
  CentralFreeDeliveryCostBearer,
  CentralRestaurantSummary,
  CentralScopeLevel,
  CentralSectionServiceAreaRecord,
  CentralServiceType,
  DeliveryAreaTariff,
  DeliveryAreaTariffBatchInput,
  DeliveryAreaTariffInput,
  GeoArea,
  GeoCenter,
  GeoGovernorate,
  TariffAreaConflictDetail,
} from '../../types';
import {
  CENTRAL_SERVICE_DEFINITIONS,
  GeoLookups,
  centralGeoDeliveryService,
  detectBatchTariffConflicts,
  detectTariffConflicts,
  getDeliveryOwnerLabelAr,
  getFreeDeliveryBearerLabelAr,
  getScopeLevelLabelAr,
  getServiceLabelAr,
  previewGeneratedTariffValues,
  resolveEffectiveTariff,
  validateTariffInput,
} from '../../services/centralGeoDeliveryService';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  CheckSquare,
  Coins,
  Edit2,
  Gift,
  Lock,
  Plus,
  Power,
  RefreshCw,
  Search,
  ShieldAlert,
  Square,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';

interface CentralPricingTariffsTabProps {
  tariffs: DeliveryAreaTariff[];
  governorates: GeoGovernorate[];
  centers: GeoCenter[];
  restaurants: CentralRestaurantSummary[];
  sectionServiceAreas: CentralSectionServiceAreaRecord[];
  lookups: GeoLookups;
  restaurantsById: Map<string, CentralRestaurantSummary>;
  initialServiceFilter?: CentralServiceType | '';
  tariffsError?: string | null;
  tariffsConstraintHint?: string | null;
  canManagePricing: boolean;
  isBusy: boolean;
  onSaveTariff: (input: DeliveryAreaTariffInput) => Promise<{ success: boolean; data?: DeliveryAreaTariff; error?: string }>;
  onSaveTariffBatch: (input: DeliveryAreaTariffBatchInput) => Promise<{
    success: boolean;
    data?: DeliveryAreaTariff[];
    error?: string;
    areaConflicts?: TariffAreaConflictDetail[];
  }>;
  onToggleTariff: (tariff: DeliveryAreaTariff, nextEnabled: boolean) => Promise<void>;
  onDeleteTariff: (tariff: DeliveryAreaTariff) => Promise<void>;
  onRefresh: () => void;
}

export const CentralPricingTariffsTab: React.FC<CentralPricingTariffsTabProps> = ({
  tariffs,
  governorates,
  centers,
  restaurants,
  sectionServiceAreas,
  lookups,
  restaurantsById,
  initialServiceFilter = '',
  tariffsError,
  tariffsConstraintHint,
  canManagePricing,
  isBusy,
  onSaveTariff,
  onSaveTariffBatch,
  onToggleTariff,
  onDeleteTariff,
  onRefresh,
}) => {
  // Filters
  const [filterService, setFilterService] = useState<string>(initialServiceFilter);
  const [filterOwner, setFilterOwner] = useState<string>('');
  const [filterRestaurantId, setFilterRestaurantId] = useState<string>('');
  const [filterScope, setFilterScope] = useState<string>('');
  const [filterGovId, setFilterGovId] = useState<string>('');
  const [filterCenterId, setFilterCenterId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [filterFree, setFilterFree] = useState<'all' | 'free' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (initialServiceFilter) {
      setFilterService(initialServiceFilter);
    }
  }, [initialServiceFilter]);

  // Effective Tariff Simulator State
  const [showSimulator, setShowSimulator] = useState(false);
  const [simService, setSimService] = useState<CentralServiceType>('household_shortages');
  const [simOwner, setSimOwner] = useState<CentralDeliveryOwner>('platform');
  const [simRestaurantId, setSimRestaurantId] = useState<string>('');
  const [simGovId, setSimGovId] = useState<string>('');
  const [simCenterId, setSimCenterId] = useState<string>('');
  const [simAreaId, setSimAreaId] = useState<string>('');
  const [simCenterAreas, setSimCenterAreas] = useState<GeoArea[]>([]);
  const [isLoadingSimAreas, setIsLoadingSimAreas] = useState(false);

  // Add / Edit Modal State (ZERO hardcoded fee or governorate defaults!)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [editingTariff, setEditingTariff] = useState<DeliveryAreaTariff | null>(null);
  const [formService, setFormService] = useState<CentralServiceType>('household_shortages');
  const [formOwner, setFormOwner] = useState<CentralDeliveryOwner>('platform');
  const [formRestaurantId, setFormRestaurantId] = useState<string>('');
  const [formScope, setFormScope] = useState<CentralScopeLevel>('area');
  const [formGovId, setFormGovId] = useState<string>('');
  const [formCenterId, setFormCenterId] = useState<string>('');
  const [formAreaId, setFormAreaId] = useState<string>('');
  const [formAreaIds, setFormAreaIds] = useState<string[]>([]);
  const [areaPickerSearch, setAreaPickerSearch] = useState<string>('');
  const [formBaseFee, setFormBaseFee] = useState<string>('');
  const [formAdminComm, setFormAdminComm] = useState<string>('');
  const [formIsFree, setFormIsFree] = useState<boolean>(false);
  const [formBearer, setFormBearer] = useState<string>('');
  const [formMinutes, setFormMinutes] = useState<string>('');
  const [formIsEnabled, setFormIsEnabled] = useState<boolean>(true);
  const [formNotes, setFormNotes] = useState<string>('');
  const [modalCenterAreas, setModalCenterAreas] = useState<GeoArea[]>([]);
  const [isLoadingModalAreas, setIsLoadingModalAreas] = useState(false);
  const [modalSubmitError, setModalSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSavedDbSummary, setLastSavedDbSummary] = useState<{
    count: number;
    isEdit: boolean;
    driverNetFee: number;
    customerDeliveryFee: number;
  } | null>(null);

  // Active geo lists (strictly exclude inactive records from available selection)
  const activeGovernorates = useMemo(() => governorates.filter((g) => g.is_active), [governorates]);
  const filterCenters = useMemo(
    () => (filterGovId ? centers.filter((c) => c.governorate_id === filterGovId) : centers),
    [centers, filterGovId]
  );

  const modalCenters = useMemo(
    () =>
      formGovId
        ? centers.filter((c) => c.governorate_id === formGovId && c.is_active)
        : [],
    [centers, formGovId]
  );

  const simCenters = useMemo(
    () => (simGovId ? centers.filter((c) => c.governorate_id === simGovId && c.is_active) : []),
    [centers, simGovId]
  );

  // Fetch areas when center changes in Modal
  useEffect(() => {
    let cancelled = false;
    if (!isModalOpen || !formCenterId || formScope !== 'area') {
      setModalCenterAreas([]);
      return;
    }
    setIsLoadingModalAreas(true);
    centralGeoDeliveryService
      .getGeoAreasPage({
        governorateId: formGovId || undefined,
        centerId: formCenterId,
        activeFilter: 'active',
        limit: 1000,
        offset: 0,
      })
      .then((res) => {
        if (!cancelled) setModalCenterAreas(res.areas);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingModalAreas(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isModalOpen, formGovId, formCenterId, formScope]);

  // Fetch areas when center changes in Simulator
  useEffect(() => {
    let cancelled = false;
    if (!showSimulator || !simCenterId) {
      setSimCenterAreas([]);
      return;
    }
    setIsLoadingSimAreas(true);
    centralGeoDeliveryService
      .getGeoAreasPage({
        governorateId: simGovId || undefined,
        centerId: simCenterId,
        activeFilter: 'active',
        limit: 1000,
        offset: 0,
      })
      .then((res) => {
        if (!cancelled) setSimCenterAreas(res.areas);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSimAreas(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showSimulator, simGovId, simCenterId]);

  const modalLookups = useMemo<GeoLookups>(() => {
    const mergedAreas = new Map<string, GeoArea>(lookups.areasById);
    modalCenterAreas.forEach((a) => mergedAreas.set(a.id, a));
    return {
      governoratesById: lookups.governoratesById,
      centersById: lookups.centersById,
      areasById: mergedAreas,
    };
  }, [lookups, modalCenterAreas]);

  const simLookups = useMemo<GeoLookups>(() => {
    const mergedAreas = new Map<string, GeoArea>(lookups.areasById);
    simCenterAreas.forEach((a) => mergedAreas.set(a.id, a));
    return {
      governoratesById: lookups.governoratesById,
      centersById: lookups.centersById,
      areasById: mergedAreas,
    };
  }, [lookups, simCenterAreas]);

  const filteredTariffs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tariffs.filter((t) => {
      if (filterService && t.service_type !== filterService) return false;
      if (filterOwner && t.delivery_owner !== filterOwner) return false;
      if (filterRestaurantId && (t.restaurant_id || '') !== filterRestaurantId) return false;
      if (filterScope && t.scope_level !== filterScope) return false;
      if (filterGovId && t.governorate_id !== filterGovId) return false;
      if (filterCenterId && t.center_id !== filterCenterId) return false;
      if (filterStatus === 'enabled' && !t.is_enabled) return false;
      if (filterStatus === 'disabled' && t.is_enabled) return false;
      if (filterFree === 'free' && !t.is_free_delivery) return false;
      if (filterFree === 'paid' && t.is_free_delivery) return false;
      if (!q) return true;
      return (
        (t.governorate_name_ar || '').toLowerCase().includes(q) ||
        (t.center_name_ar || '').toLowerCase().includes(q) ||
        (t.area_name_ar || '').toLowerCase().includes(q) ||
        (t.restaurant_name || '').toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q)
      );
    });
  }, [
    tariffs,
    filterService,
    filterOwner,
    filterRestaurantId,
    filterScope,
    filterGovId,
    filterCenterId,
    filterStatus,
    filterFree,
    searchQuery,
  ]);

  const filteredModalAreas = useMemo(() => {
    const q = areaPickerSearch.trim().toLowerCase();
    if (!q) return modalCenterAreas;
    return modalCenterAreas.filter(
      (a) =>
        a.name_ar.toLowerCase().includes(q) ||
        (a.name_en || '').toLowerCase().includes(q)
    );
  }, [modalCenterAreas, areaPickerSearch]);

  const existingAreaIdsForContext = useMemo(() => {
    const set = new Set<string>();
    if (!formGovId || !formCenterId) return set;
    if (formService === 'ready_food' && !formRestaurantId) return set;
    const normRestId = formService === 'ready_food' ? formRestaurantId || null : null;
    for (const t of tariffs) {
      if (
        t.scope_level === 'area' &&
        t.area_id &&
        t.service_type === formService &&
        t.delivery_owner === formOwner &&
        (t.restaurant_id || null) === normRestId &&
        t.governorate_id === formGovId &&
        t.center_id === formCenterId
      ) {
        set.add(t.area_id);
      }
    }
    return set;
  }, [tariffs, formService, formOwner, formRestaurantId, formGovId, formCenterId]);

  const generatedPreview = useMemo(
    () =>
      previewGeneratedTariffValues({
        base_delivery_fee: formBaseFee,
        admin_commission: formOwner === 'restaurant' ? 0 : formAdminComm,
        delivery_owner: formOwner,
        is_free_delivery: formIsFree,
      }),
    [formBaseFee, formAdminComm, formOwner, formIsFree]
  );

  // Live conflict check BEFORE saving inside Modal (single or batch)
  const liveModalConflicts = useMemo(() => {
    if (!isModalOpen || !formGovId) return null;
    if (formService === 'ready_food' && !formRestaurantId) return null;
    if (!editingId && formScope === 'area') return null;
    if (formScope === 'center' && !formCenterId) return null;
    if (formScope === 'area' && (!formCenterId || !formAreaId)) return null;
    return detectTariffConflicts(
      {
        id: editingId,
        service_type: formService,
        delivery_owner: formOwner,
        restaurant_id: formService === 'ready_food' ? formRestaurantId || null : null,
        scope_level: formScope,
        governorate_id: formGovId,
        center_id: formScope === 'governorate' ? null : formCenterId || null,
        area_id: formScope === 'area' ? formAreaId || null : null,
        is_enabled: formIsEnabled,
      },
      tariffs
    );
  }, [
    isModalOpen,
    editingId,
    formService,
    formOwner,
    formRestaurantId,
    formScope,
    formGovId,
    formCenterId,
    formAreaId,
    formIsEnabled,
    tariffs,
  ]);

  const liveBatchConflicts = useMemo(() => {
    if (!isModalOpen || editingId || formScope !== 'area' || !formGovId || !formCenterId || formAreaIds.length === 0) {
      return null;
    }
    if (formService === 'ready_food' && !formRestaurantId) return null;
    return detectBatchTariffConflicts(
      {
        service_type: formService,
        delivery_owner: formOwner,
        restaurant_id: formService === 'ready_food' ? formRestaurantId || null : null,
        governorate_id: formGovId,
        center_id: formCenterId,
        area_ids: formAreaIds,
        is_enabled: formIsEnabled,
      },
      tariffs,
      modalLookups
    );
  }, [
    isModalOpen,
    editingId,
    formScope,
    formService,
    formOwner,
    formRestaurantId,
    formGovId,
    formCenterId,
    formAreaIds,
    formIsEnabled,
    tariffs,
    modalLookups,
  ]);

  const hasAnyModalBlockingConflict = Boolean(
    liveModalConflicts?.hasBlockingConflict || liveBatchConflicts?.hasBlockingConflict
  );

  const effectivePreview = useMemo(() => {
    if (!showSimulator || !simGovId) return null;
    return resolveEffectiveTariff(
      {
        service_type: simService,
        delivery_owner: simOwner,
        restaurant_id: simService === 'ready_food' ? simRestaurantId || null : null,
        governorate_id: simGovId,
        center_id: simCenterId || null,
        area_id: simAreaId || null,
      },
      tariffs,
      simLookups,
      sectionServiceAreas
    );
  }, [
    showSimulator,
    simService,
    simOwner,
    simRestaurantId,
    simGovId,
    simCenterId,
    simAreaId,
    tariffs,
    simLookups,
    sectionServiceAreas,
  ]);

  const openCreateModal = () => {
    const defaultService = (filterService as CentralServiceType) || 'household_shortages';
    setEditingId(undefined);
    setEditingTariff(null);
    setFormService(defaultService);
    setFormOwner('platform');
    setFormRestaurantId(defaultService === 'ready_food' && filterRestaurantId ? filterRestaurantId : '');
    setFormScope('area');
    setFormGovId('');
    setFormCenterId('');
    setFormAreaId('');
    setFormAreaIds([]);
    setAreaPickerSearch('');
    setFormBaseFee('');
    setFormAdminComm('');
    setFormIsFree(false);
    setFormBearer('');
    setFormMinutes('');
    setFormIsEnabled(true);
    setFormNotes('');
    setModalSubmitError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (t: DeliveryAreaTariff) => {
    const isFree = Boolean(t.is_free_delivery);
    const syncedBearer: CentralFreeDeliveryCostBearer | '' = isFree
      ? t.delivery_owner === 'restaurant'
        ? 'restaurant'
        : 'platform'
      : '';
    setEditingId(t.id);
    setEditingTariff(t);
    setFormService(t.service_type);
    setFormOwner(t.delivery_owner);
    setFormRestaurantId(t.service_type === 'ready_food' ? t.restaurant_id || '' : '');
    setFormScope(t.scope_level);
    setFormGovId(t.governorate_id);
    setFormCenterId(t.center_id || '');
    setFormAreaId(t.area_id || '');
    setFormAreaIds(t.area_id ? [t.area_id] : []);
    setAreaPickerSearch('');
    setFormBaseFee(String(t.base_delivery_fee));
    setFormAdminComm(t.delivery_owner === 'restaurant' ? '0' : String(t.admin_commission));
    setFormIsFree(isFree);
    setFormBearer(syncedBearer);
    setFormMinutes(
      t.estimated_delivery_minutes !== null && t.estimated_delivery_minutes !== undefined
        ? String(t.estimated_delivery_minutes)
        : ''
    );
    setFormIsEnabled(Boolean(t.is_enabled));
    setFormNotes(t.notes || '');
    setModalSubmitError(null);
    setIsModalOpen(true);
  };

  const toggleAreaSelection = (areaId: string) => {
    setFormAreaIds((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  };

  const selectAllFilteredAreas = () => {
    const filteredIds = filteredModalAreas.map((a) => a.id);
    setFormAreaIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const clearSelectedAreas = () => {
    setFormAreaIds([]);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalSubmitError(null);

    const effectiveRestaurantId =
      formService === 'ready_food' ? formRestaurantId.trim() || null : null;
    const effectiveAdminCommission = formOwner === 'restaurant' ? 0 : formAdminComm;
    const effectiveBearer: CentralFreeDeliveryCostBearer | null = formIsFree
      ? formOwner === 'restaurant'
        ? 'restaurant'
        : 'platform'
      : null;

    // Create mode on 'area' scope supports multi-area batch creation (1 or many areas atomically)
    if (!editingId && formScope === 'area') {
      const uniqueAreaIds: string[] = Array.from(
        new Set<string>(formAreaIds.map((id) => id.trim()).filter(Boolean))
      );
      if (uniqueAreaIds.length === 0) {
        setModalSubmitError('يجب اختيار منطقة واحدة على الأقل لإضافة التسعيرة.');
        return;
      }

      const preCheck = validateTariffInput(
        {
          service_type: formService,
          delivery_owner: formOwner,
          restaurant_id: effectiveRestaurantId,
          scope_level: 'area',
          governorate_id: formGovId,
          center_id: formCenterId || null,
          area_id: uniqueAreaIds[0],
          base_delivery_fee: formBaseFee,
          admin_commission: effectiveAdminCommission,
          is_free_delivery: formIsFree,
          free_delivery_cost_bearer: effectiveBearer,
          estimated_delivery_minutes: formMinutes || null,
          is_enabled: formIsEnabled,
          notes: formNotes,
        },
        modalLookups,
        restaurantsById
      );
      if (!preCheck.valid) {
        setModalSubmitError(preCheck.error || 'يرجى التحقق من المدخلات');
        return;
      }

      if (liveBatchConflicts?.hasBlockingConflict) {
        const lines = liveBatchConflicts.blockingDetails.map(
          (d) => `• ${d.areaName}: ${d.message}`
        );
        setModalSubmitError(`تعذر الحفظ لوجود تكرار في المناطق التالية:\n${lines.join('\n')}`);
        return;
      }

      const batchInput: DeliveryAreaTariffBatchInput = {
        service_type: formService,
        delivery_owner: formOwner,
        restaurant_id: effectiveRestaurantId,
        scope_level: 'area',
        governorate_id: formGovId,
        center_id: formCenterId,
        area_ids: uniqueAreaIds,
        base_delivery_fee: formBaseFee,
        admin_commission: effectiveAdminCommission,
        is_free_delivery: formIsFree,
        free_delivery_cost_bearer: effectiveBearer,
        estimated_delivery_minutes: formMinutes || null,
        is_enabled: formIsEnabled,
        notes: formNotes,
      };

      setIsSubmitting(true);
      try {
        const res = await onSaveTariffBatch(batchInput);
        if (res.success && res.data && res.data.length > 0) {
          setLastSavedDbSummary({
            count: res.data.length,
            isEdit: false,
            driverNetFee: Number(res.data[0].driver_net_fee),
            customerDeliveryFee: Number(res.data[0].customer_delivery_fee),
          });
          setIsModalOpen(false);
        } else {
          setModalSubmitError(res.error || 'تعذر حفظ التسعيرة للمناطق المختارة في قاعدة البيانات.');
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Single create (governorate / center) or Edit existing row
    const input: DeliveryAreaTariffInput = {
      id: editingId,
      service_type: formService,
      delivery_owner: formOwner,
      restaurant_id: effectiveRestaurantId,
      scope_level: formScope,
      governorate_id: formGovId,
      center_id: formScope === 'governorate' ? null : formCenterId || null,
      area_id: formScope === 'area' ? formAreaId || null : null,
      base_delivery_fee: formBaseFee,
      admin_commission: effectiveAdminCommission,
      is_free_delivery: formIsFree,
      free_delivery_cost_bearer: effectiveBearer,
      estimated_delivery_minutes: formMinutes || null,
      is_enabled: formIsEnabled,
      notes: formNotes,
    };

    const preCheck = validateTariffInput(input, modalLookups, restaurantsById);
    if (!preCheck.valid) {
      setModalSubmitError(preCheck.error || 'يرجى التحقق من المدخلات');
      return;
    }

    if (liveModalConflicts?.hasBlockingConflict) {
      const blocking = liveModalConflicts.conflicts.find((c) => c.severity === 'blocking');
      setModalSubmitError(blocking?.message || 'يوجد سجل مطابق يمنع الحفظ.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onSaveTariff(input);
      if (res.success) {
        if (res.data) {
          setLastSavedDbSummary({
            count: 1,
            isEdit: Boolean(editingId),
            driverNetFee: Number(res.data.driver_net_fee),
            customerDeliveryFee: Number(res.data.customer_delivery_fee),
          });
        }
        setIsModalOpen(false);
      } else {
        setModalSubmitError(res.error || 'تعذر حفظ التسعيرة في قاعدة البيانات.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-white">
              إدارة رسوم التوصيل والتسعير المركزي (delivery_area_tariffs)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              تسعير مستقل للأساسي والعمولة وصافي المندوب ورسوم العميل دون أي افتراض تساوي، مع منع التكرار وعرض التعارضات والتوصيل الفعلي.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSimulator((v) => !v)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
              showSimulator
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>معاينة التعريفة الفعالة</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isBusy}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isBusy ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>

          {canManagePricing && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة تسعيرة جديدة</span>
            </button>
          )}
        </div>
      </div>

      {/* DB Read-After-Write Calculated Confirmation Banner */}
      {lastSavedDbSummary && (
        <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5 text-emerald-200">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
            <div>
              <p className="font-bold text-emerald-300">
                {lastSavedDbSummary.isEdit
                  ? 'تم تحديث التسعيرة وإعادة قراءة القيم المحسوبة من قاعدة البيانات'
                  : `تم حفظ ${lastSavedDbSummary.count} تسعيرة وإعادة قراءة القيم المحسوبة من قاعدة البيانات`}
              </p>
              <p className="text-[11px] text-emerald-100/90 mt-1 font-mono">
                صافي مستحق المندوب (driver_net_fee):{' '}
                <strong className="text-sky-300">{lastSavedDbSummary.driverNetFee} ج.م</strong>
                {'  |  '}
                رسوم العميل (customer_delivery_fee):{' '}
                <strong className="text-emerald-300">{lastSavedDbSummary.customerDeliveryFee} ج.م</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLastSavedDbSummary(null)}
            className="p-1 rounded-lg bg-slate-900/60 text-emerald-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Real DB Constraint / RLS Error Banner */}
      {tariffsError && (
        <div className="bg-rose-950/60 border border-rose-500/40 rounded-2xl p-4 space-y-2 text-xs">
          <div className="flex items-start gap-2.5 text-rose-300 font-bold">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
            <div>
              <p>تعذر تحميل جدول delivery_area_tariffs من Supabase</p>
              <p className="font-mono text-[11px] text-rose-200 mt-1 break-words">{tariffsError}</p>
              {tariffsConstraintHint && (
                <p className="text-[11px] text-amber-300 mt-1">{tariffsConstraintHint}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Effective Tariff Resolution Simulator */}
      {showSimulator && (
        <div className="bg-slate-900/95 border border-sky-500/30 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-black text-sky-300 flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              <span>محاكاة التعريفة الفعالة بعد تطبيق أولوية المستويات (منطقة ← مركز ← محافظة)</span>
            </h4>
            <button
              type="button"
              onClick={() => setShowSimulator(false)}
              className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">القسم</label>
              <select
                value={simService}
                onChange={(e) => {
                  const val = e.target.value as CentralServiceType;
                  setSimService(val);
                  if (val !== 'ready_food') {
                    setSimOwner('platform');
                    setSimRestaurantId('');
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white"
              >
                {CENTRAL_SERVICE_DEFINITIONS.map((d) => (
                  <option key={d.type} value={d.type}>
                    {d.labelAr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">جهة التوصيل</label>
              <select
                value={simOwner}
                onChange={(e) => setSimOwner(e.target.value as CentralDeliveryOwner)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white"
              >
                <option value="platform">توصيل المنصة</option>
                {simService === 'ready_food' && <option value="restaurant">توصيل المطعم</option>}
              </select>
            </div>

            {simService === 'ready_food' && (
              <div>
                <label className="block text-[11px] font-bold text-amber-300 mb-1">المطعم المحدد *</label>
                <select
                  value={simRestaurantId}
                  onChange={(e) => setSimRestaurantId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white"
                >
                  <option value="">اختر المطعم...</option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">المحافظة</label>
              <select
                value={simGovId}
                onChange={(e) => {
                  setSimGovId(e.target.value);
                  setSimCenterId('');
                  setSimAreaId('');
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white"
              >
                <option value="">اختر المحافظة...</option>
                {activeGovernorates.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name_ar}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">المركز / القسم</label>
              <select
                value={simCenterId}
                disabled={!simGovId}
                onChange={(e) => {
                  setSimCenterId(e.target.value);
                  setSimAreaId('');
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white disabled:opacity-50"
              >
                <option value="">الكل / بدون مركز محدد</option>
                {simCenters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_ar}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                المنطقة {isLoadingSimAreas ? '(جاري التحميل...)' : ''}
              </label>
              <select
                value={simAreaId}
                disabled={!simCenterId || isLoadingSimAreas}
                onChange={(e) => setSimAreaId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white disabled:opacity-50"
              >
                <option value="">الكل / بدون منطقة محددة</option>
                {simCenterAreas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name_ar}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {effectivePreview && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {effectivePreview.isServiced && effectivePreview.matchedTariff ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      التوصيل متاح — مطبق على مستوى ({getScopeLevelLabelAr(effectivePreview.matchedScopeLevel)})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-bold">
                      <XCircle className="w-4 h-4" />
                      غير مغطى بالتسعير حالياً
                    </span>
                  )}
                </div>
                {effectivePreview.sectionAreaMatchNote && (
                  <span className="text-[11px] text-amber-300">{effectivePreview.sectionAreaMatchNote}</span>
                )}
              </div>

              {effectivePreview.matchedTariff ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">رسوم العميل</span>
                    <span className="font-mono font-black text-emerald-300 text-sm">
                      {effectivePreview.matchedTariff.customer_delivery_fee} ج.م
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">الرسوم الأساسية</span>
                    <span className="font-mono font-bold text-white text-sm">
                      {effectivePreview.matchedTariff.base_delivery_fee} ج.م
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">عمولة الإدارة</span>
                    <span className="font-mono font-bold text-amber-300 text-sm">
                      {effectivePreview.matchedTariff.admin_commission} ج.م
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">صافي المندوب</span>
                    <span className="font-mono font-bold text-sky-300 text-sm">
                      {effectivePreview.matchedTariff.driver_net_fee} ج.م
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">التوصيل المجاني</span>
                    <span className="font-bold text-slate-200">
                      {effectivePreview.matchedTariff.is_free_delivery
                        ? `نعم (${getFreeDeliveryBearerLabelAr(effectivePreview.matchedTariff.free_delivery_cost_bearer)})`
                        : 'لا'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-rose-300 font-bold">{effectivePreview.unavailableReason}</p>
              )}

              <div className="pt-2 border-t border-slate-800/80 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 block">مسار التحقق والقرار:</span>
                {effectivePreview.trace.map((line, idx) => (
                  <p key={idx} className="text-[11px] text-slate-300">
                    • {line}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالمحافظة، المركز، المنطقة، المطعم..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-8 pl-3 py-2 text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <select
          value={filterService}
          onChange={(e) => {
            const val = e.target.value;
            setFilterService(val);
            if (val && val !== 'ready_food') {
              setFilterRestaurantId('');
            }
          }}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
        >
          <option value="">كل أقسام الخدمات</option>
          {CENTRAL_SERVICE_DEFINITIONS.map((d) => (
            <option key={d.type} value={d.type}>
              {d.labelAr}
            </option>
          ))}
        </select>

        <select
          value={filterOwner}
          onChange={(e) => setFilterOwner(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
        >
          <option value="">كل جهات التوصيل</option>
          <option value="platform">توصيل المنصة (platform)</option>
          <option value="restaurant">توصيل المطعم (restaurant)</option>
        </select>

        {(!filterService || filterService === 'ready_food') && (
          <select
            value={filterRestaurantId}
            onChange={(e) => setFilterRestaurantId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
          >
            <option value="">كل المطاعم (الأكلات الجاهزة)</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}

        <select
          value={filterScope}
          onChange={(e) => setFilterScope(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
        >
          <option value="">كل مستويات النطاق</option>
          <option value="governorate">محافظة كاملة</option>
          <option value="center">مركز / قسم</option>
          <option value="area">منطقة / حي / قرية</option>
        </select>

        <select
          value={filterGovId}
          onChange={(e) => {
            setFilterGovId(e.target.value);
            setFilterCenterId('');
          }}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
        >
          <option value="">كل المحافظات</option>
          {governorates.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name_ar}
            </option>
          ))}
        </select>

        <select
          value={filterCenterId}
          onChange={(e) => setFilterCenterId(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
        >
          <option value="">كل المراكز والأقسام</option>
          {filterCenters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_ar}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | 'enabled' | 'disabled')}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
        >
          <option value="all">كل حالات التفعيل</option>
          <option value="enabled">المفعلة فقط</option>
          <option value="disabled">المعطلة فقط</option>
        </select>

        <select
          value={filterFree}
          onChange={(e) => setFilterFree(e.target.value as 'all' | 'free' | 'paid')}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
        >
          <option value="all">الكل (مجاني ومدفوع)</option>
          <option value="free">التوصيل المجاني فقط</option>
          <option value="paid">التوصيل المدفوع فقط</option>
        </select>
      </div>

      {/* Tariffs Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden">
        {filteredTariffs.length === 0 ? (
          <div className="py-16 text-center space-y-2 text-xs text-slate-400">
            <Coins className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="font-bold text-slate-300">لا توجد تسعيرات مطابقة للفلاتر المحددة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">القسم والجهة</th>
                  <th className="p-3.5">النطاق الجغرافي</th>
                  <th className="p-3.5">الرسوم الأساسية</th>
                  <th className="p-3.5">عمولة الإدارة</th>
                  <th className="p-3.5">صافي المندوب</th>
                  <th className="p-3.5">رسوم العميل</th>
                  <th className="p-3.5">التوصيل المجاني والمدة</th>
                  <th className="p-3.5">الحالة</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTariffs.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/35">
                    <td className="p-3.5">
                      <span className="font-black text-white block">{getServiceLabelAr(t.service_type)}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {getDeliveryOwnerLabelAr(t.delivery_owner)}
                      </span>
                      {t.service_type === 'ready_food' && t.restaurant_name && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                          المطعم: {t.restaurant_name}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 text-sky-300 border border-slate-700 inline-block mb-1">
                        {getScopeLevelLabelAr(t.scope_level)}
                      </span>
                      <div className="font-bold text-slate-200">
                        {[
                          t.governorate_name_ar,
                          t.center_name_ar !== '—' ? t.center_name_ar : null,
                          t.area_name_ar !== '—' ? t.area_name_ar : null,
                        ]
                          .filter(Boolean)
                          .join(' / ')}
                      </div>
                      {t.geo_is_active === false && (
                        <span className="text-[10px] text-rose-400 block">نطاق جغرافي غير مفعل</span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-white">{t.base_delivery_fee} ج.م</td>
                    <td className="p-3.5 font-mono font-bold text-amber-300">{t.admin_commission} ج.م</td>
                    <td className="p-3.5 font-mono font-bold text-sky-300">{t.driver_net_fee} ج.م</td>
                    <td className="p-3.5 font-mono font-black text-emerald-300">{t.customer_delivery_fee} ج.م</td>
                    <td className="p-3.5">
                      {t.is_free_delivery ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                          <Gift className="w-3 h-3" />
                          {getFreeDeliveryBearerLabelAr(t.free_delivery_cost_bearer)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">مدفوع</span>
                      )}
                      {t.estimated_delivery_minutes && (
                        <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                          ~{t.estimated_delivery_minutes} دقيقة
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          t.is_enabled
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {t.is_enabled ? 'مفعّل' : 'معطّل'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      {canManagePricing ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onToggleTariff(t, !t.is_enabled)}
                            title={t.is_enabled ? 'تعطيل التسعيرة' : 'تفعيل التسعيرة'}
                            className={`p-1.5 rounded-lg border cursor-pointer ${
                              t.is_enabled
                                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => openEditModal(t)}
                            title="تعديل التسعيرة"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onDeleteTariff(t)}
                            title="حذف التسعيرة"
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

      {/* Add / Edit Tariff Modal */}
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
                {editingId ? 'تعديل تسعيرة التوصيل' : 'إضافة تسعيرة توصيل مركزية'}
              </h4>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="flex flex-col flex-1 min-h-0 text-xs">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {modalSubmitError && (
                  <div className="bg-rose-950/70 border border-rose-500/40 rounded-2xl p-3.5 text-rose-200 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span className="break-words leading-relaxed whitespace-pre-line">{modalSubmitError}</span>
                  </div>
                )}

                {liveModalConflicts && liveModalConflicts.conflicts.length > 0 && (
                  <div className="space-y-1.5">
                    {liveModalConflicts.conflicts.map((c, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-2xl border flex items-start gap-2 ${
                          c.severity === 'blocking'
                            ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                            : 'bg-amber-950/50 border-amber-500/40 text-amber-200'
                        }`}
                      >
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{c.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {liveBatchConflicts &&
                  (liveBatchConflicts.blockingDetails.length > 0 ||
                    liveBatchConflicts.warningDetails.length > 0) && (
                    <div className="space-y-1.5">
                      {liveBatchConflicts.blockingDetails.map((d, idx) => (
                        <div
                          key={`blk-${d.areaId}-${idx}`}
                          className="p-3 rounded-2xl border bg-rose-950/60 border-rose-500/40 text-rose-200 flex items-start gap-2"
                        >
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                          <span>
                            <strong className="text-rose-100">[{d.areaName}]</strong> {d.message}
                          </span>
                        </div>
                      ))}
                      {liveBatchConflicts.warningDetails.slice(0, 4).map((d, idx) => (
                        <div
                          key={`wrn-${d.areaId}-${idx}`}
                          className="p-3 rounded-2xl border bg-amber-950/50 border-amber-500/40 text-amber-200 flex items-start gap-2"
                        >
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                          <span>
                            <strong className="text-amber-100">[{d.areaName}]</strong> {d.message}
                          </span>
                        </div>
                      ))}
                      {liveBatchConflicts.warningDetails.length > 4 && (
                        <p className="text-[11px] text-amber-300 px-1">
                          + {liveBatchConflicts.warningDetails.length - 4} تنبيهات هرمية أخرى على بقية المناطق المختارة.
                        </p>
                      )}
                    </div>
                  )}

                {/* Service & Owner */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">قسم الخدمة *</label>
                    <select
                      value={formService}
                      onChange={(e) => {
                        const val = e.target.value as CentralServiceType;
                        setFormService(val);
                        setModalSubmitError(null);
                        if (val !== 'ready_food') {
                          setFormOwner('platform');
                          setFormRestaurantId('');
                          if (formIsFree) setFormBearer('platform');
                        } else {
                          setFormRestaurantId('');
                          setFormAreaId('');
                          setFormAreaIds([]);
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                    >
                      {CENTRAL_SERVICE_DEFINITIONS.map((d) => (
                        <option key={d.type} value={d.type}>
                          {d.labelAr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">جهة التوصيل *</label>
                    <select
                      value={formOwner}
                      onChange={(e) => {
                        const val = e.target.value as CentralDeliveryOwner;
                        setFormOwner(val);
                        setModalSubmitError(null);
                        if (val === 'restaurant') {
                          setFormAdminComm('0');
                        } else if (editingTariff?.delivery_owner === 'restaurant' || formAdminComm === '0') {
                          setFormAdminComm('');
                        }
                        if (formIsFree) {
                          setFormBearer(val);
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                    >
                      <option value="platform">توصيل المنصة (platform)</option>
                      {formService === 'ready_food' && (
                        <option value="restaurant">توصيل المطعم (restaurant)</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">مستوى النطاق *</label>
                    <select
                      value={formScope}
                      onChange={(e) => {
                        const next = e.target.value as CentralScopeLevel;
                        setFormScope(next);
                        if (next === 'governorate') {
                          setFormCenterId('');
                          setFormAreaId('');
                          setFormAreaIds([]);
                        } else if (next === 'center') {
                          setFormAreaId('');
                          setFormAreaIds([]);
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                    >
                      <option value="area">منطقة / حي / قرية</option>
                      <option value="center">مركز / قسم</option>
                      <option value="governorate">محافظة كاملة</option>
                    </select>
                  </div>
                </div>

                {formService === 'ready_food' && (
                  <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-1.5">
                    <label className="block font-bold text-amber-200">
                      المطعم المحدد (إلزامي لقسم الأكلات الجاهزة) *
                    </label>
                    <select
                      required
                      value={formRestaurantId}
                      onChange={(e) => {
                        setFormRestaurantId(e.target.value);
                        setModalSubmitError(null);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                    >
                      <option value="">اختر المطعم...</option>
                      {restaurants.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} {!r.is_active ? '(غير مفعل)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-amber-300/90 leading-relaxed">
                      يشترط النظام وقاعدة البيانات ربط تسعيرة الأكلات الجاهزة بمطعم محدد سواء كانت جهة التوصيل «توصيل المنصة (طلباتي)» أو «توصيل المطعم».
                    </p>
                  </div>
                )}

                {/* Geo Hierarchy Selection (Strictly geo_*) */}
                <div className="space-y-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">المحافظة (geo_governorates) *</label>
                      <select
                        required
                        value={formGovId}
                        onChange={(e) => {
                          setFormGovId(e.target.value);
                          setFormCenterId('');
                          setFormAreaId('');
                          setFormAreaIds([]);
                          setAreaPickerSearch('');
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                      >
                        <option value="">اختر المحافظة...</option>
                        {activeGovernorates.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name_ar}
                          </option>
                        ))}
                      </select>
                    </div>

                    {formScope !== 'governorate' && (
                      <div>
                        <label className="block font-bold text-slate-300 mb-1">المركز / القسم (geo_centers) *</label>
                        <select
                          required
                          disabled={!formGovId}
                          value={formCenterId}
                          onChange={(e) => {
                            setFormCenterId(e.target.value);
                            setFormAreaId('');
                            setFormAreaIds([]);
                            setAreaPickerSearch('');
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

                  {/* Single-area select in Edit mode */}
                  {formScope === 'area' && editingId && (
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        المنطقة (geo_areas) * {isLoadingModalAreas ? '⏳' : ''}
                      </label>
                      <select
                        required
                        disabled={!formCenterId || isLoadingModalAreas}
                        value={formAreaId}
                        onChange={(e) => setFormAreaId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white disabled:opacity-40"
                      >
                        <option value="">اختر المنطقة...</option>
                        {modalCenterAreas.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name_ar}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Multi-area selector in Create mode */}
                  {formScope === 'area' && !editingId && (
                    <div className="space-y-2.5 pt-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="font-bold text-slate-300">
                          المناطق المفعلة ضمن المركز (geo_areas) * — يمكنك اختيار منطقة واحدة أو عدة مناطق
                          {isLoadingModalAreas ? ' ⏳' : ''}
                        </label>
                        {formCenterId && modalCenterAreas.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={selectAllFilteredAreas}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-[11px] cursor-pointer"
                            >
                              تحديد الكل ({filteredModalAreas.length})
                            </button>
                            <button
                              type="button"
                              onClick={clearSelectedAreas}
                              disabled={formAreaIds.length === 0}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-300 font-bold text-[11px] cursor-pointer"
                            >
                              إلغاء التحديد
                            </button>
                          </div>
                        )}
                      </div>

                      {!formCenterId ? (
                        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-slate-400 text-[11px]">
                          اختر المحافظة ثم المركز لعرض المناطق المفعلة التابعة له.
                        </div>
                      ) : isLoadingModalAreas ? (
                        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-slate-400 text-[11px]">
                          جاري تحميل المناطق المفعلة من جدول geo_areas...
                        </div>
                      ) : modalCenterAreas.length === 0 ? (
                        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-[11px]">
                          لا توجد مناطق مفعلة (is_active = true) تابعة لهذا المركز.
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={areaPickerSearch}
                              onChange={(e) => setAreaPickerSearch(e.target.value)}
                              placeholder="ابحث داخل مناطق المركز المختار..."
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-white text-[11px]"
                            />
                          </div>

                          <div className="max-h-44 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                            {filteredModalAreas.map((a) => {
                              const checked = formAreaIds.includes(a.id);
                              const alreadyHasTariff = existingAreaIdsForContext.has(a.id);
                              return (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() => toggleAreaSelection(a.id)}
                                  className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border text-right transition-colors cursor-pointer ${
                                    checked
                                      ? alreadyHasTariff
                                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                                        : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                                  }`}
                                >
                                  <span className="flex items-center gap-2 min-w-0">
                                    {checked ? (
                                      <CheckSquare className="w-4 h-4 shrink-0 text-emerald-400" />
                                    ) : (
                                      <Square className="w-4 h-4 shrink-0 text-slate-500" />
                                    )}
                                    <span className="truncate font-bold">{a.name_ar}</span>
                                  </span>
                                  {alreadyHasTariff && (
                                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                      مسعّرة مسبقاً
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {formAreaIds.length > 0 && (
                            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-emerald-500/25 space-y-1.5">
                              <p className="text-[11px] font-bold text-emerald-300">
                                المناطق المختارة ({formAreaIds.length}):
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {formAreaIds.map((id) => {
                                  const areaName = modalLookups.areasById.get(id)?.name_ar || id;
                                  const isDup = existingAreaIdsForContext.has(id);
                                  return (
                                    <span
                                      key={id}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${
                                        isDup
                                          ? 'bg-rose-500/15 text-rose-200 border-rose-500/40'
                                          : 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
                                      }`}
                                    >
                                      <span>{areaName}</span>
                                      <button
                                        type="button"
                                        onClick={() => toggleAreaSelection(id)}
                                        className="hover:text-white cursor-pointer"
                                        aria-label={`إزالة ${areaName}`}
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Writable Fee Inputs (Zero hardcoded defaults) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">رسوم التوصيل الأساسية *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="أدخل القيمة"
                      value={formBaseFee}
                      onChange={(e) => setFormBaseFee(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      {formOwner === 'restaurant' ? 'عمولة الإدارة' : 'عمولة الإدارة *'}
                    </label>
                    {formOwner === 'restaurant' ? (
                      <div className="w-full bg-slate-950/80 border border-emerald-500/30 rounded-xl px-3 py-2.5 text-emerald-300 font-bold flex items-center justify-between gap-2">
                        <span>لا توجد عمولة إدارية على توصيل المطعم</span>
                        <span className="font-mono text-[11px] bg-emerald-500/15 px-2 py-0.5 rounded-lg border border-emerald-500/30 shrink-0">
                          0 ج.م تلقائياً
                        </span>
                      </div>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        placeholder="أدخل القيمة"
                        value={formAdminComm}
                        onChange={(e) => setFormAdminComm(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono"
                      />
                    )}
                  </div>
                </div>

                {/* Read-Only DB-Generated Columns Box (Never edited or sent in payload) */}
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-sky-500/25 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-sky-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>قيم محسوبة تلقائياً داخل قاعدة البيانات (للقراءة فقط)</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      GENERATED ALWAYS AS STORED
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <p className="text-[11px] text-slate-400 font-bold">صافي مستحق المندوب (driver_net_fee)</p>
                      {editingTariff ? (
                        <div className="mt-1 space-y-0.5">
                          <p className="font-mono font-black text-sky-300 text-sm">
                            {editingTariff.driver_net_fee} ج.م{' '}
                            <span className="text-[10px] font-normal text-slate-400">(القيمة الحالية من DB)</span>
                          </p>
                          {generatedPreview.expectedDriverNetFee !== null &&
                            generatedPreview.expectedDriverNetFee !== editingTariff.driver_net_fee && (
                              <p className="text-[10px] text-amber-300 font-mono">
                                المتوقع بعد الحفظ: {generatedPreview.expectedDriverNetFee} ج.م
                              </p>
                            )}
                        </div>
                      ) : (
                        <p className="mt-1 font-mono font-bold text-sky-300">
                          {generatedPreview.expectedDriverNetFee !== null
                            ? `${generatedPreview.expectedDriverNetFee} ج.م (تقدير مبدئي قبل الحفظ)`
                            : 'يُحسب تلقائياً في قاعدة البيانات بعد الحفظ'}
                        </p>
                      )}
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <p className="text-[11px] text-slate-400 font-bold">رسوم التوصيل للعميل (customer_delivery_fee)</p>
                      {editingTariff ? (
                        <div className="mt-1 space-y-0.5">
                          <p className="font-mono font-black text-emerald-300 text-sm">
                            {editingTariff.customer_delivery_fee} ج.م{' '}
                            <span className="text-[10px] font-normal text-slate-400">(القيمة الحالية من DB)</span>
                          </p>
                          {generatedPreview.expectedCustomerDeliveryFee !== null &&
                            generatedPreview.expectedCustomerDeliveryFee !== editingTariff.customer_delivery_fee && (
                              <p className="text-[10px] text-amber-300 font-mono">
                                المتوقع بعد الحفظ: {generatedPreview.expectedCustomerDeliveryFee} ج.م
                              </p>
                            )}
                        </div>
                      ) : (
                        <p className="mt-1 font-mono font-bold text-emerald-300">
                          {generatedPreview.expectedCustomerDeliveryFee !== null
                            ? `${generatedPreview.expectedCustomerDeliveryFee} ج.م (تقدير مبدئي قبل الحفظ)`
                            : 'يُحسب تلقائياً في قاعدة البيانات بعد الحفظ'}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    لا يتم إدخال أو إرسال هذين الحقلين في طلب الحفظ؛ تقوم قاعدة البيانات بحسابهما وتخزينهما تلقائياً ثم يعيد النظام قراءتهما وعرضهما بعد الحفظ.
                  </p>
                </div>

                {/* Free Delivery Options & Minutes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <div className="space-y-2.5">
                    <label className="flex items-center gap-2 font-bold text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsFree}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormIsFree(checked);
                          setFormBearer(checked ? formOwner : '');
                        }}
                        className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700"
                      />
                      <span>توصيل مجاني للعميل (is_free_delivery)</span>
                    </label>

                    <div>
                      <label className="block font-bold text-slate-400 mb-1">
                        الجهة المتحملة لتكلفة التوصيل المجاني {formIsFree ? '*' : '(معطل — NULL تلقائياً)'}
                      </label>
                      {formIsFree ? (
                        <select
                          value={formBearer || formOwner}
                          required
                          onChange={(e) => setFormBearer(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                        >
                          {formOwner === 'platform' ? (
                            <option value="platform">تتحملها المنصة (platform)</option>
                          ) : (
                            <option value="restaurant">يتحملها المطعم (restaurant)</option>
                          )}
                        </select>
                      ) : (
                        <div className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-500">
                          غير مفعل (يُحفظ كـ NULL تلقائياً عند التوصيل المدفوع)
                        </div>
                      )}
                      {formIsFree && (
                        <p className="text-[10px] text-sky-300 mt-1">
                          تُحدد جهة التحمل تلقائياً بما يطابق جهة التوصيل ({formOwner === 'platform' ? 'platform للمنصة' : 'restaurant للمطعم'}) دون تصفير الرسوم الأساسية أو صافي المندوب.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">الوقت التقديري (بالدقائق)</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="مثال: 35"
                        value={formMinutes}
                        onChange={(e) => setFormMinutes(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <label className="flex items-center gap-2 font-bold text-slate-200 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={formIsEnabled}
                        onChange={(e) => setFormIsEnabled(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700"
                      />
                      <span>تفعيل التسعيرة مباشرة (is_enabled)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">ملاحظات إدارية (notes)</label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="تفاصيل إضافية حول هذه التسعيرة..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
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
                  disabled={isSubmitting || hasAnyModalBlockingConflict}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold cursor-pointer"
                >
                  {isSubmitting
                    ? 'جاري الحفظ والتحقق...'
                    : editingId
                    ? 'حفظ التعديلات'
                    : formScope === 'area'
                    ? 'إضافة التسعيرة للمناطق المختارة'
                    : 'حفظ التسعيرة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
