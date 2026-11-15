import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  CentralDeliveryOwner,
  CentralDriverAreaCoverage,
  CentralDriverCoveragePool,
  CentralMutationResult,
  CentralRestaurantSummary,
  CentralScopeLevel,
  CentralSectionServiceAreaRecord,
  CentralServiceDefinition,
  CentralServiceType,
  DeliveryAreaTariff,
  DeliveryAreaTariffInput,
  DeliveryDriver,
  DriverCoverageMutationInput,
  EffectiveTariffResolution,
  GeoArea,
  GeoCenter,
  GeoCenterAreaCount,
  GeoGovernorate,
  GeoGovernorateAreaCount,
  ServiceSectionDiscrepancy,
  ServiceSectionSummary,
  TariffConflictCheckResult,
  TariffConflictWarning,
} from '../types';

export const CENTRAL_SERVICE_DEFINITIONS: readonly CentralServiceDefinition[] = [
  {
    type: 'household_shortages',
    labelAr: 'طلبات البيت والنواقص',
    shortLabelAr: 'طلبات البيت',
    descriptionAr: 'توصيل طلبات المنزل والنواقص اليومية والمقاضي عبر مناديب المنصة',
    supportsRestaurantOwner: false,
  },
  {
    type: 'pharmacy',
    labelAr: 'الصيدلية والأدوية',
    shortLabelAr: 'الصيدلية',
    descriptionAr: 'توصيل طلبات الأدوية والروشتات ومستلزمات الصيدليات',
    supportsRestaurantOwner: false,
  },
  {
    type: 'ready_food',
    labelAr: 'المطاعم والأكلات الجاهزة',
    shortLabelAr: 'المطاعم',
    descriptionAr: 'توصيل وجبات المطاعم الجاهزة (توصيل المنصة أو التوصيل الذاتي للمطعم)',
    supportsRestaurantOwner: true,
  },
] as const;

export const ALLOWED_CENTRAL_SERVICE_TYPES: readonly CentralServiceType[] = [
  'household_shortages',
  'pharmacy',
  'ready_food',
];

export const ALLOWED_DELIVERY_OWNERS: readonly CentralDeliveryOwner[] = ['platform', 'restaurant'];

export const ALLOWED_SCOPE_LEVELS: readonly CentralScopeLevel[] = ['governorate', 'center', 'area'];

const GEO_GOV_COLUMNS =
  'id, country_name, name_ar, name_en, code, is_active, sort_order, latitude, longitude, source_code, source_system, created_at, updated_at';

const GEO_CENTER_COLUMNS =
  'id, governorate_id, name_ar, name_en, is_active, sort_order, source_code, admin_unit_type, classification_status, source_system, latitude, longitude, created_at, updated_at';

const GEO_AREA_COLUMNS =
  'id, governorate_id, center_id, name_ar, name_en, is_active, sort_order, admin_unit_type, classification_status, source_system, source_code, parent_area_id, latitude, longitude, created_at, updated_at';

const TARIFF_COLUMNS =
  'id, service_type, delivery_owner, restaurant_id, scope_level, governorate_id, center_id, area_id, base_delivery_fee, admin_commission, driver_net_fee, customer_delivery_fee, is_free_delivery, free_delivery_cost_bearer, estimated_delivery_minutes, is_enabled, notes, created_at, updated_at';

const DRIVER_COLUMNS =
  'id, user_id, full_name, phone, email, is_active, status, governorate_code, governorate_name, markaz_name, vehicle_type, vehicle_plate, is_available_for_work, availability_last_seen_at, created_at, updated_at';

export function getServiceDefinition(serviceType: string): CentralServiceDefinition | undefined {
  return CENTRAL_SERVICE_DEFINITIONS.find((d) => d.type === serviceType);
}

export function getServiceLabelAr(serviceType?: string | null): string {
  if (!serviceType) return 'غير محدد';
  return getServiceDefinition(serviceType)?.labelAr || serviceType;
}

export function getScopeLevelLabelAr(scopeLevel?: string | null): string {
  switch (scopeLevel) {
    case 'governorate':
      return 'محافظة كاملة';
    case 'center':
      return 'مركز / قسم';
    case 'area':
      return 'منطقة / حي / قرية';
    default:
      return scopeLevel || 'غير محدد';
  }
}

export function getDeliveryOwnerLabelAr(owner?: string | null): string {
  if (owner === 'platform') return 'توصيل المنصة';
  if (owner === 'restaurant') return 'توصيل المطعم';
  return owner || 'غير محدد';
}

export function getFreeDeliveryBearerLabelAr(bearer?: string | null): string {
  switch (bearer) {
    case 'platform':
      return 'تتحملها المنصة';
    case 'restaurant':
      return 'يتحملها المطعم';
    case 'split':
      return 'مقسمة بين المنصة والمطعم';
    case 'none':
      return 'بدون تحديد جهة تحمل';
    default:
      return bearer ? String(bearer) : 'غير محدد';
  }
}

export function formatCentralDbError(
  error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null | undefined,
  tableName: string
): { message: string; code: string | null; constraintHint: string | null } {
  if (!error) {
    return { message: `تعذر إتمام العملية على جدول ${tableName}`, code: null, constraintHint: null };
  }
  const code = error.code || null;
  const rawMsg = error.message || '';
  const details = error.details || '';
  const hint = error.hint || '';

  if (code === '42501') {
    return {
      code,
      constraintHint: 'صلاحيات قاعدة البيانات أو سياسات RLS تمنع الوصول لهذا الجدول بالحساب الحالي.',
      message: `تم رفض العملية على جدول (${tableName}) بسبب صلاحيات RLS أو GRANT [42501]: ${rawMsg}`,
    };
  }
  if (code === '23514') {
    return {
      code,
      constraintHint:
        'فشل قيد تحقق (CHECK Constraint) في قاعدة البيانات — راجع القيم المسموحة لمستوى النطاق أو التفعيل أو التسعير المجاني في الجدول الفعلي.',
      message: `انتهاك قيد تحقق (CHECK) في جدول (${tableName}) [23514]: ${rawMsg}${details ? ` — ${details}` : ''}`,
    };
  }
  if (code === '23505') {
    return {
      code,
      constraintHint: 'يوجد سجل مطابق بالفعل يخرق فهرس/قيد عدم التكرار (UNIQUE) في قاعدة البيانات.',
      message: `تعارض تكرار سجل (UNIQUE) في جدول (${tableName}) [23505]: ${rawMsg}${details ? ` — ${details}` : ''}`,
    };
  }
  if (code === '23503') {
    return {
      code,
      constraintHint: 'أحد المعرفات المرجعية (FK UUID) غير موجود في الجدول المرتبط.',
      message: `خطأ ارتباط مرجعي (Foreign Key) في جدول (${tableName}) [23503]: ${rawMsg}${details ? ` — ${details}` : ''}`,
    };
  }
  if (code === '42703') {
    return {
      code,
      constraintHint: `أحد الأعمدة المتوقعة غير موجود فعلياً في جدول ${tableName}.`,
      message: `عدم تطابق مخطط العمود في جدول (${tableName}) [42703]: ${rawMsg}${hint ? ` (${hint})` : ''}`,
    };
  }
  if (code === 'PGRST205') {
    return {
      code,
      constraintHint: `الجدول (${tableName}) غير موجود أو غير مكشوف في Schema Cache.`,
      message: `الجدول (${tableName}) غير موجود في Schema Cache [PGRST205]: ${rawMsg}`,
    };
  }
  if (code === '22P02') {
    return {
      code,
      constraintHint: 'صيغة المعرف UUID غير صالحة.',
      message: `صيغة إدخال غير صالحة في جدول (${tableName}) [22P02]: ${rawMsg}`,
    };
  }

  return {
    code,
    constraintHint: details || hint || null,
    message: `فشل العملية على جدول (${tableName})${code ? ` [${code}]` : ''}: ${rawMsg}`,
  };
}

export interface GeoLookups {
  governoratesById: Map<string, GeoGovernorate>;
  centersById: Map<string, GeoCenter>;
  areasById: Map<string, GeoArea>;
}

export function buildGeoLookups(
  governorates: GeoGovernorate[],
  centers: GeoCenter[],
  areas: GeoArea[]
): GeoLookups {
  const governoratesById = new Map<string, GeoGovernorate>();
  governorates.forEach((g) => governoratesById.set(g.id, g));

  const centersById = new Map<string, GeoCenter>();
  centers.forEach((c) => centersById.set(c.id, c));

  const areasById = new Map<string, GeoArea>();
  areas.forEach((a) => areasById.set(a.id, a));

  return { governoratesById, centersById, areasById };
}

export function validateGeoHierarchySelection(
  params: {
    scope_level: CentralScopeLevel;
    governorate_id?: string | null;
    center_id?: string | null;
    area_id?: string | null;
    requireActiveGeo?: boolean;
  },
  lookups: GeoLookups
): { valid: boolean; error?: string; normalized?: { governorate_id: string; center_id: string | null; area_id: string | null } } {
  if (!ALLOWED_SCOPE_LEVELS.includes(params.scope_level)) {
    return { valid: false, error: 'مستوى النطاق الجغرافي غير صالح.' };
  }

  const govId = (params.governorate_id || '').trim();
  const centerId = (params.center_id || '').trim() || null;
  const areaId = (params.area_id || '').trim() || null;

  if (!govId) {
    return { valid: false, error: 'يجب اختيار المحافظة من جداول geo_governorates.' };
  }

  const gov = lookups.governoratesById.get(govId);
  if (!gov) {
    return { valid: false, error: 'المحافظة المحددة غير موجودة في بيانات geo_governorates المحملة.' };
  }
  if (params.requireActiveGeo && !gov.is_active) {
    return {
      valid: false,
      error: `المحافظة (${gov.name_ar}) غير مفعلة (is_active = false) ولا يمكن تفعيل التوصيل عليها.`,
    };
  }

  if (params.scope_level === 'governorate') {
    if (centerId || areaId) {
      return {
        valid: false,
        error: 'عند اختيار مستوى المحافظة يجب أن يكون المركز والمنطقة فارغين.',
      };
    }
    return { valid: true, normalized: { governorate_id: govId, center_id: null, area_id: null } };
  }

  if (!centerId) {
    return { valid: false, error: 'يجب اختيار المركز أو القسم عند العمل على مستوى المركز أو المنطقة.' };
  }

  const center = lookups.centersById.get(centerId);
  if (!center) {
    return { valid: false, error: 'المركز أو القسم المحدد غير موجود في بيانات geo_centers المحملة.' };
  }
  if (center.governorate_id !== govId) {
    return {
      valid: false,
      error: `تعارض هرمي: المركز (${center.name_ar}) لا يتبع المحافظة المختارة (${gov.name_ar}).`,
    };
  }
  if (params.requireActiveGeo && !center.is_active) {
    return {
      valid: false,
      error: `المركز (${center.name_ar}) غير مفعل (is_active = false) ولا يمكن تفعيل التوصيل عليه.`,
    };
  }

  if (params.scope_level === 'center') {
    if (areaId) {
      return { valid: false, error: 'عند اختيار مستوى المركز يجب أن تكون المنطقة فارغة.' };
    }
    return { valid: true, normalized: { governorate_id: govId, center_id: centerId, area_id: null } };
  }

  // scope_level === 'area'
  if (!areaId) {
    return { valid: false, error: 'يجب اختيار المنطقة عند العمل على مستوى المنطقة.' };
  }

  const area = lookups.areasById.get(areaId);
  if (!area) {
    return { valid: false, error: 'المنطقة المحددة غير موجودة في بيانات geo_areas المحملة.' };
  }
  if (area.center_id !== centerId || area.governorate_id !== govId) {
    return {
      valid: false,
      error: `تعارض هرمي: المنطقة (${area.name_ar}) لا تتبع المركز والمحافظة المختارين.`,
    };
  }
  if (params.requireActiveGeo && !area.is_active) {
    return {
      valid: false,
      error: `المنطقة (${area.name_ar}) غير مفعلة (is_active = false) ولا يمكن تفعيل التوصيل عليها.`,
    };
  }

  return { valid: true, normalized: { governorate_id: govId, center_id: centerId, area_id: areaId } };
}

function parseExplicitNonNegativeNumber(
  raw: number | string | null | undefined,
  fieldLabel: string
): { ok: boolean; value?: number; error?: string } {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { ok: false, error: `حقل "${fieldLabel}" مطلوب ويجب إدخاله صراحةً دون قيم افتراضية.` };
  }
  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return { ok: false, error: `قيمة "${fieldLabel}" يجب أن تكون رقماً صالحاً.` };
  }
  if (num < 0) {
    return { ok: false, error: `لا يُسمح بقيمة سالبة لحقل "${fieldLabel}".` };
  }
  return { ok: true, value: Math.round(num * 100) / 100 };
}

export function validateTariffInput(
  input: DeliveryAreaTariffInput,
  lookups: GeoLookups,
  restaurantsById?: Map<string, CentralRestaurantSummary>
): { valid: boolean; error?: string; payload?: Omit<DeliveryAreaTariff, 'id' | 'created_at' | 'updated_at'> } {
  if (!ALLOWED_CENTRAL_SERVICE_TYPES.includes(input.service_type)) {
    return { valid: false, error: `قسم الخدمة (${input.service_type}) غير مدعوم. الأقسام المعتمدة فقط: household_shortages، pharmacy، ready_food.` };
  }
  if (!ALLOWED_DELIVERY_OWNERS.includes(input.delivery_owner)) {
    return { valid: false, error: 'جهة التوصيل (delivery_owner) يجب أن تكون platform أو restaurant فقط.' };
  }

  const restaurantId = (input.restaurant_id || '').trim() || null;
  if (input.delivery_owner === 'restaurant') {
    if (input.service_type !== 'ready_food') {
      return { valid: false, error: 'التوصيل الذاتي للمطعم (restaurant) مخصص لقسم المطاعم والأكلات الجاهزة (ready_food) فقط.' };
    }
    if (!restaurantId) {
      return { valid: false, error: 'يجب تحديد المطعم عند اختيار جهة التوصيل "توصيل المطعم".' };
    }
    if (restaurantsById && !restaurantsById.has(restaurantId)) {
      return { valid: false, error: 'المطعم المحدد غير موجود في قائمة المطاعم.' };
    }
  } else if (restaurantId) {
    return { valid: false, error: 'يجب عدم ربط مطعم محدد عندما تكون جهة التوصيل "توصيل المنصة".' };
  }

  const geoCheck = validateGeoHierarchySelection(
    {
      scope_level: input.scope_level,
      governorate_id: input.governorate_id,
      center_id: input.center_id,
      area_id: input.area_id,
      requireActiveGeo: Boolean(input.is_enabled),
    },
    lookups
  );
  if (!geoCheck.valid || !geoCheck.normalized) {
    return { valid: false, error: geoCheck.error || 'بيانات النطاق الجغرافي غير صالحة.' };
  }

  const baseRes = parseExplicitNonNegativeNumber(input.base_delivery_fee, 'رسوم التوصيل الأساسية');
  if (!baseRes.ok || baseRes.value === undefined) return { valid: false, error: baseRes.error };

  const commRes = parseExplicitNonNegativeNumber(input.admin_commission, 'عمولة الإدارة');
  if (!commRes.ok || commRes.value === undefined) return { valid: false, error: commRes.error };

  const driverNetRes = parseExplicitNonNegativeNumber(input.driver_net_fee, 'صافي المندوب');
  if (!driverNetRes.ok || driverNetRes.value === undefined) return { valid: false, error: driverNetRes.error };

  const custRes = parseExplicitNonNegativeNumber(input.customer_delivery_fee, 'رسوم العميل');
  if (!custRes.ok || custRes.value === undefined) return { valid: false, error: custRes.error };

  let estimatedMinutes: number | null = null;
  if (
    input.estimated_delivery_minutes !== null &&
    input.estimated_delivery_minutes !== undefined &&
    String(input.estimated_delivery_minutes).trim() !== ''
  ) {
    const m = Number(input.estimated_delivery_minutes);
    if (!Number.isInteger(m) || m <= 0) {
      return { valid: false, error: 'الوقت التقديري للتوصيل بالدقائق يجب أن يكون عدداً صحيحاً أكبر من صفر.' };
    }
    estimatedMinutes = m;
  }

  const isFree = Boolean(input.is_free_delivery);
  const rawBearer = input.free_delivery_cost_bearer ? String(input.free_delivery_cost_bearer).trim() : null;

  if (isFree) {
    if (!rawBearer || rawBearer === 'none') {
      return {
        valid: false,
        error: 'عند تفعيل التوصيل المجاني (is_free_delivery) يجب تحديد الجهة المتحملة للتكلفة صراحةً.',
      };
    }
  }

  // Never implicitly mutate free_delivery_cost_bearer or overwrite fee fields with 0!
  return {
    valid: true,
    payload: {
      service_type: input.service_type,
      delivery_owner: input.delivery_owner,
      restaurant_id: input.delivery_owner === 'restaurant' ? restaurantId : null,
      scope_level: input.scope_level,
      governorate_id: geoCheck.normalized.governorate_id,
      center_id: geoCheck.normalized.center_id,
      area_id: geoCheck.normalized.area_id,
      base_delivery_fee: baseRes.value,
      admin_commission: commRes.value,
      driver_net_fee: driverNetRes.value,
      customer_delivery_fee: custRes.value,
      is_free_delivery: isFree,
      free_delivery_cost_bearer: rawBearer,
      estimated_delivery_minutes: estimatedMinutes,
      is_enabled: Boolean(input.is_enabled),
      notes: input.notes?.trim() || null,
    },
  };
}

export function detectTariffConflicts(
  candidate: {
    id?: string;
    service_type: CentralServiceType;
    delivery_owner: CentralDeliveryOwner;
    restaurant_id?: string | null;
    scope_level: CentralScopeLevel;
    governorate_id: string;
    center_id?: string | null;
    area_id?: string | null;
    is_enabled: boolean;
  },
  existingTariffs: DeliveryAreaTariff[]
): TariffConflictCheckResult {
  const conflicts: TariffConflictWarning[] = [];
  const normRestId = candidate.restaurant_id || null;
  const normCenterId = candidate.center_id || null;
  const normAreaId = candidate.area_id || null;

  for (const row of existingTariffs) {
    if (candidate.id && row.id === candidate.id) continue;
    if (row.service_type !== candidate.service_type) continue;
    if (row.governorate_id !== candidate.governorate_id) continue;

    const rowRestId = row.restaurant_id || null;
    const rowCenterId = row.center_id || null;
    const rowAreaId = row.area_id || null;

    // Exact matching record conflict (blocking regardless of enabled status so duplicate scope records are never created)
    if (
      row.delivery_owner === candidate.delivery_owner &&
      rowRestId === normRestId &&
      row.scope_level === candidate.scope_level &&
      rowCenterId === normCenterId &&
      rowAreaId === normAreaId
    ) {
      conflicts.push({
        kind: 'exact_duplicate',
        severity: 'blocking',
        message: `يوجد بالفعل سجل تسعيرة مطابق لنفس القسم والجهة والمستوى والنطاق الجغرافي (${row.is_enabled ? 'مفعّل' : 'معطّل'}). عدّل السجل القائم بدل التكرار.`,
        conflictingTariff: row,
      });
      continue;
    }

    // Cross-owner overlap for the same scope in ready_food
    if (
      row.delivery_owner !== candidate.delivery_owner &&
      row.scope_level === candidate.scope_level &&
      rowCenterId === normCenterId &&
      rowAreaId === normAreaId
    ) {
      conflicts.push({
        kind: 'cross_owner_exists',
        severity: 'warning',
        message: `يوجد تسعيرة أخرى لنفس النطاق الجغرافي تابعة لـ "${getDeliveryOwnerLabelAr(row.delivery_owner)}" (${row.is_enabled ? 'مفعّلة' : 'معطّلة'}).`,
        conflictingTariff: row,
      });
    }

    // Hierarchical parent/child overlap warnings for active tariffs of the same owner
    if (row.delivery_owner === candidate.delivery_owner && rowRestId === normRestId && row.is_enabled) {
      if (candidate.scope_level === 'area') {
        const isParentCenter = row.scope_level === 'center' && rowCenterId === normCenterId && !rowAreaId;
        const isParentGov = row.scope_level === 'governorate' && !rowCenterId && !rowAreaId;
        if (isParentCenter || isParentGov) {
          conflicts.push({
            kind: 'parent_scope_exists',
            severity: 'warning',
            message: `يوجد سجل مفعّل أعلى (${getScopeLevelLabelAr(row.scope_level)}) لهذا النطاق؛ تسعيرة المنطقة ستحظى بأولوية التخصيص الأعلى.`,
            conflictingTariff: row,
          });
        }
      } else if (candidate.scope_level === 'center') {
        const isParentGov = row.scope_level === 'governorate' && !rowCenterId && !rowAreaId;
        const isChildArea = row.scope_level === 'area' && rowCenterId === normCenterId;
        if (isParentGov) {
          conflicts.push({
            kind: 'parent_scope_exists',
            severity: 'warning',
            message: 'يوجد سجل مفعّل على مستوى المحافظة؛ تسعيرة المركز ستتجاوز المحافظة ضمن هذا المركز.',
            conflictingTariff: row,
          });
        } else if (isChildArea) {
          conflicts.push({
            kind: 'child_scope_exists',
            severity: 'warning',
            message: `توجد تسعيرة مفعّلة على مستوى منطقة فرعية (${row.area_name_ar || row.area_id}) داخل هذا المركز وتبقى ذات أولوية أعلى من المركز.`,
            conflictingTariff: row,
          });
        }
      } else if (candidate.scope_level === 'governorate') {
        if (row.scope_level === 'center' || row.scope_level === 'area') {
          conflicts.push({
            kind: 'child_scope_exists',
            severity: 'warning',
            message: `توجد تسعيرة فرعية مفعّلة (${getScopeLevelLabelAr(row.scope_level)}) داخل هذه المحافظة وستتجاوز تسعيرة المحافظة في نطاقها.`,
            conflictingTariff: row,
          });
        }
      }
    }
  }

  return {
    hasBlockingConflict: conflicts.some((c) => c.severity === 'blocking'),
    conflicts,
  };
}

export function resolveEffectiveTariff(
  query: {
    service_type: CentralServiceType;
    delivery_owner: CentralDeliveryOwner;
    restaurant_id?: string | null;
    governorate_id: string;
    center_id?: string | null;
    area_id?: string | null;
  },
  allTariffs: DeliveryAreaTariff[],
  lookups: GeoLookups,
  sectionServiceAreas: CentralSectionServiceAreaRecord[] = []
): EffectiveTariffResolution {
  const trace: string[] = [];
  const gov = lookups.governoratesById.get(query.governorate_id);
  const center = query.center_id ? lookups.centersById.get(query.center_id) : undefined;
  const area = query.area_id ? lookups.areasById.get(query.area_id) : undefined;

  if (!gov) {
    return {
      isServiced: false,
      unavailableReason: 'المحافظة المحددة غير موجودة في geo_governorates.',
      matchedTariff: null,
      candidateTariffs: [],
      trace: ['فشل: لم يتم العثور على المحافظة في geo_governorates.'],
    };
  }
  if (!gov.is_active) {
    return {
      isServiced: false,
      unavailableReason: `المحافظة (${gov.name_ar}) غير مفعلة في geo_governorates.`,
      matchedTariff: null,
      candidateTariffs: [],
      trace: [`توقف: المحافظة (${gov.name_ar}) حالتها is_active = false.`],
    };
  }
  trace.push(`المحافظة (${gov.name_ar}) مفعلة في geo_governorates.`);

  if (query.center_id) {
    if (!center || center.governorate_id !== query.governorate_id) {
      return {
        isServiced: false,
        unavailableReason: 'المركز غير موجود أو لا يتبع المحافظة المختارة.',
        matchedTariff: null,
        candidateTariffs: [],
        trace: [...trace, 'فشل التحقق من تبعية المركز للمحافظة.'],
      };
    }
    if (!center.is_active) {
      return {
        isServiced: false,
        unavailableReason: `المركز (${center.name_ar}) غير مفعل في geo_centers.`,
        matchedTariff: null,
        candidateTariffs: [],
        trace: [...trace, `توقف: المركز (${center.name_ar}) حالته is_active = false.`],
      };
    }
    trace.push(`المركز (${center.name_ar}) مفعل ويتبع المحافظة.`);
  }

  if (query.area_id) {
    if (!area || area.governorate_id !== query.governorate_id || (query.center_id && area.center_id !== query.center_id)) {
      return {
        isServiced: false,
        unavailableReason: 'المنطقة غير موجودة أو لا تتبع المركز والمحافظة المختارين.',
        matchedTariff: null,
        candidateTariffs: [],
        trace: [...trace, 'فشل التحقق من تبعية المنطقة للمركز والمحافظة.'],
      };
    }
    if (!area.is_active) {
      return {
        isServiced: false,
        unavailableReason: `المنطقة (${area.name_ar}) غير مفعلة في geo_areas.`,
        matchedTariff: null,
        candidateTariffs: [],
        trace: [...trace, `توقف: المنطقة (${area.name_ar}) حالتها is_active = false.`],
      };
    }
    trace.push(`المنطقة (${area.name_ar}) مفعلة وتابعة للتسلسل الهرمي.`);
  }

  let sectionAreaMatchNote: string | null = null;
  if (query.service_type === 'ready_food' && sectionServiceAreas.length > 0) {
    const matchedSec = sectionServiceAreas.find((s) => {
      if (!s.is_active) return false;
      if (s.area_id && query.area_id && s.area_id === query.area_id) return true;
      if (!s.area_id && s.center_id && query.center_id && s.center_id === query.center_id) return true;
      if (!s.area_id && !s.center_id && s.governorate_id === query.governorate_id) return true;
      return false;
    });
    sectionAreaMatchNote = matchedSec
      ? `النطاق مفعّل أيضاً في جدول restaurant_section_service_areas (${getScopeLevelLabelAr(matchedSec.scope_level)}).`
      : 'تنبيه تناسق: هذا النطاق غير مفعّل حالياً في جدول restaurant_section_service_areas (تغطية قسم المطاعم).';
  }

  const targetRestId = query.delivery_owner === 'restaurant' ? query.restaurant_id || null : null;

  const candidates = allTariffs.filter((t) => {
    if (t.service_type !== query.service_type) return false;
    if (t.delivery_owner !== query.delivery_owner) return false;
    if (query.delivery_owner === 'restaurant' && (t.restaurant_id || null) !== targetRestId) return false;
    if (query.delivery_owner === 'platform' && t.restaurant_id) return false;
    if (t.governorate_id !== query.governorate_id) return false;

    if (t.scope_level === 'area') {
      return Boolean(query.area_id && t.area_id === query.area_id && (!query.center_id || t.center_id === query.center_id));
    }
    if (t.scope_level === 'center') {
      return Boolean(query.center_id && t.center_id === query.center_id && !t.area_id);
    }
    return t.scope_level === 'governorate' && !t.center_id && !t.area_id;
  });

  const priorityRank = (scope: CentralScopeLevel): number => (scope === 'area' ? 1 : scope === 'center' ? 2 : 3);
  const sortedCandidates = [...candidates].sort((a, b) => priorityRank(a.scope_level) - priorityRank(b.scope_level));

  const areaEnabled = query.area_id
    ? sortedCandidates.find((t) => t.scope_level === 'area' && t.is_enabled)
    : undefined;
  const areaDisabled = query.area_id
    ? sortedCandidates.find((t) => t.scope_level === 'area' && !t.is_enabled)
    : undefined;

  const centerEnabled = query.center_id
    ? sortedCandidates.find((t) => t.scope_level === 'center' && t.is_enabled)
    : undefined;
  const centerDisabled = query.center_id
    ? sortedCandidates.find((t) => t.scope_level === 'center' && !t.is_enabled)
    : undefined;

  const govEnabled = sortedCandidates.find((t) => t.scope_level === 'governorate' && t.is_enabled);

  if (areaEnabled) {
    trace.push('تطابق مباشر مع تسعيرة مفعّلة على مستوى المنطقة (الأولوية الأعلى).');
    return {
      isServiced: true,
      matchedTariff: areaEnabled,
      matchedScopeLevel: 'area',
      candidateTariffs: sortedCandidates,
      trace,
      sectionAreaMatchNote,
    };
  }
  if (areaDisabled) {
    trace.push('يوجد سجل على مستوى المنطقة لكنه معطّل (is_enabled = false). تم التحقق من المستويات الأعلى كمرشحات.');
  }

  if (centerEnabled) {
    trace.push('تم تطبيق التسعيرة المفعّلة على مستوى المركز (الأولوية الثانية).');
    return {
      isServiced: true,
      matchedTariff: centerEnabled,
      matchedScopeLevel: 'center',
      candidateTariffs: sortedCandidates,
      trace,
      sectionAreaMatchNote,
    };
  }
  if (centerDisabled) {
    trace.push('يوجد سجل على مستوى المركز لكنه معطّل (is_enabled = false).');
  }

  if (govEnabled) {
    trace.push('تم تطبيق التسعيرة المفعّلة على مستوى المحافظة (الأولوية الثالثة).');
    return {
      isServiced: true,
      matchedTariff: govEnabled,
      matchedScopeLevel: 'governorate',
      candidateTariffs: sortedCandidates,
      trace,
      sectionAreaMatchNote,
    };
  }

  trace.push('لا توجد أي تسعيرة مفعّلة (is_enabled = true) تنطبق على هذا النطاق.');
  return {
    isServiced: false,
    unavailableReason: 'لا توجد تسعيرة توصيل مفعّلة لهذا النطاق والقسم والجهة في جدول delivery_area_tariffs.',
    matchedTariff: null,
    matchedScopeLevel: null,
    candidateTariffs: sortedCandidates,
    trace,
    sectionAreaMatchNote,
  };
}

export function isDriverEligibleForOperations(driver?: Pick<DeliveryDriver, 'status' | 'is_active'> | null): boolean {
  if (!driver) return false;
  return driver.status === 'approved' && Boolean(driver.is_active);
}

export function validateDriverCoverageInput(
  input: DriverCoverageMutationInput,
  driver: DeliveryDriver | undefined,
  existingCoverages: CentralDriverAreaCoverage[],
  lookups: GeoLookups,
  restaurantsById?: Map<string, CentralRestaurantSummary>
): {
  valid: boolean;
  error?: string;
  normalized?: {
    pool: CentralDriverCoveragePool;
    driver_id: string;
    restaurant_id: string | null;
    service_type: CentralServiceType;
    governorate_id: string;
    center_id: string | null;
    area_id: string | null;
    is_active: boolean;
    priority: number | null;
    notes: string | null;
  };
} {
  if (!input.driver_id) {
    return { valid: false, error: 'يجب اختيار المندوب.' };
  }
  if (!driver) {
    return { valid: false, error: 'بيانات المندوب غير موجودة.' };
  }
  if (!isDriverEligibleForOperations(driver)) {
    return {
      valid: false,
      error: `المندوب (${driver.full_name}) غير مؤهل للتشغيل (الحالة: ${driver.status || 'غير معتمد'}، التفعيل الإداري: ${driver.is_active ? 'مفعل' : 'معطل'}). يجب اعتماد وتفعيل المندوب أولاً.`,
    };
  }

  if (!ALLOWED_CENTRAL_SERVICE_TYPES.includes(input.service_type)) {
    return { valid: false, error: 'نوع الخدمة غير صالح.' };
  }

  if (input.pool === 'restaurant') {
    if (input.service_type !== 'ready_food') {
      return { valid: false, error: 'عمالة المطاعم (restaurant_driver_area_coverage) مخصصة لقسم ready_food فقط.' };
    }
    if (input.restaurant_id && restaurantsById && !restaurantsById.has(input.restaurant_id)) {
      return { valid: false, error: 'المطعم المحدد غير موجود.' };
    }
  }

  const geoCheck = validateGeoHierarchySelection(
    {
      scope_level: input.scope_level,
      governorate_id: input.governorate_id,
      center_id: input.center_id,
      area_id: input.area_id,
      requireActiveGeo: Boolean(input.is_active),
    },
    lookups
  );
  if (!geoCheck.valid || !geoCheck.normalized) {
    return { valid: false, error: geoCheck.error || 'النطاق الجغرافي غير صالح.' };
  }

  let priority: number | null = null;
  if (input.priority !== null && input.priority !== undefined && String(input.priority).trim() !== '') {
    const p = Number(input.priority);
    if (!Number.isInteger(p) || p < 0) {
      return { valid: false, error: 'الأولوية يجب أن تكون رقماً صحيحاً أكبر من أو يساوي صفر.' };
    }
    priority = p;
  }

  const normRest = input.pool === 'restaurant' ? (input.restaurant_id || '').trim() || null : null;

  const duplicate = existingCoverages.find((c) => {
    if (input.id && c.id === input.id) return false;
    if (c.pool !== input.pool) return false;
    if (c.driver_id !== input.driver_id) return false;
    if ((c.service_type || null) !== input.service_type) return false;
    if (input.pool === 'restaurant' && (c.restaurant_id || null) !== normRest) return false;
    if (c.governorate_id !== geoCheck.normalized!.governorate_id) return false;
    if ((c.center_id || null) !== geoCheck.normalized!.center_id) return false;
    if ((c.area_id || null) !== geoCheck.normalized!.area_id) return false;
    return true;
  });

  if (duplicate) {
    return {
      valid: false,
      error: `تعارض تكرار: المندوب (${driver.full_name}) مرتبط بالفعل بنفس النطاق الجغرافي ونفس الخدمة (${duplicate.is_active ? 'مفعّل' : 'معطّل'}).`,
    };
  }

  return {
    valid: true,
    normalized: {
      pool: input.pool,
      driver_id: input.driver_id,
      restaurant_id: normRest,
      service_type: input.service_type,
      governorate_id: geoCheck.normalized.governorate_id,
      center_id: geoCheck.normalized.center_id,
      area_id: geoCheck.normalized.area_id,
      is_active: Boolean(input.is_active),
      priority,
      notes: input.notes?.trim() || null,
    },
  };
}

export function buildServiceSectionSummaries(
  tariffs: DeliveryAreaTariff[],
  sectionServiceAreas: CentralSectionServiceAreaRecord[],
  lookups: GeoLookups
): ServiceSectionSummary[] {
  return CENTRAL_SERVICE_DEFINITIONS.map((def) => {
    const svcTariffs = tariffs.filter((t) => t.service_type === def.type);
    const enabled = svcTariffs.filter((t) => t.is_enabled);
    const disabled = svcTariffs.filter((t) => !t.is_enabled);
    const free = svcTariffs.filter((t) => t.is_free_delivery);

    const govSet = new Set<string>();
    const centerSet = new Set<string>();
    const areaSet = new Set<string>();
    enabled.forEach((t) => {
      if (t.governorate_id) govSet.add(t.governorate_id);
      if (t.center_id) centerSet.add(t.center_id);
      if (t.area_id) areaSet.add(t.area_id);
    });

    const discrepancies: ServiceSectionDiscrepancy[] = [];

    // Check discrepancies when tariffs reference inactive geo nodes
    svcTariffs.forEach((t) => {
      const gov = lookups.governoratesById.get(t.governorate_id);
      const center = t.center_id ? lookups.centersById.get(t.center_id) : undefined;
      const area = t.area_id ? lookups.areasById.get(t.area_id) : undefined;
      const label = [gov?.name_ar, center?.name_ar, area?.name_ar].filter(Boolean).join(' / ') || t.governorate_id;
      if (t.is_enabled && gov && !gov.is_active) {
        discrepancies.push({
          id: `inactive-gov-${t.id}`,
          service_type: def.type,
          scope_level: t.scope_level,
          governorate_id: t.governorate_id,
          center_id: t.center_id,
          area_id: t.area_id,
          location_label: label,
          issue: 'التسعيرة مفعّلة لكن المحافظة غير مفعلة في geo_governorates.',
        });
      }
      if (t.is_enabled && center && !center.is_active) {
        discrepancies.push({
          id: `inactive-center-${t.id}`,
          service_type: def.type,
          scope_level: t.scope_level,
          governorate_id: t.governorate_id,
          center_id: t.center_id,
          area_id: t.area_id,
          location_label: label,
          issue: 'التسعيرة مفعّلة لكن المركز غير مفعل في geo_centers.',
        });
      }
      if (t.is_enabled && area && !area.is_active) {
        discrepancies.push({
          id: `inactive-area-${t.id}`,
          service_type: def.type,
          scope_level: t.scope_level,
          governorate_id: t.governorate_id,
          center_id: t.center_id,
          area_id: t.area_id,
          location_label: label,
          issue: 'التسعيرة مفعّلة لكن المنطقة غير مفعلة في geo_areas.',
        });
      }
    });

    // Check overlap/contradiction between restaurant_section_service_areas and delivery_area_tariffs for ready_food
    if (def.type === 'ready_food') {
      sectionServiceAreas.forEach((sec) => {
        const label = [sec.governorate_name_ar, sec.center_name_ar, sec.area_name_ar].filter((v) => v && v !== '—').join(' / ') || sec.id;
        const matchingTariff = svcTariffs.find(
          (t) =>
            t.governorate_id === sec.governorate_id &&
            (t.center_id || null) === (sec.center_id || null) &&
            (t.area_id || null) === (sec.area_id || null)
        );
        if (sec.is_active && !matchingTariff) {
          discrepancies.push({
            id: `sec-without-tariff-${sec.id}`,
            service_type: 'ready_food',
            scope_level: sec.scope_level,
            governorate_id: sec.governorate_id,
            center_id: sec.center_id,
            area_id: sec.area_id,
            location_label: label,
            issue: 'مفعّل في restaurant_section_service_areas ولا توجد له تسعيرة مطابقة في delivery_area_tariffs.',
          });
        } else if (matchingTariff && sec.is_active !== matchingTariff.is_enabled) {
          discrepancies.push({
            id: `sec-tariff-mismatch-${sec.id}`,
            service_type: 'ready_food',
            scope_level: sec.scope_level,
            governorate_id: sec.governorate_id,
            center_id: sec.center_id,
            area_id: sec.area_id,
            location_label: label,
            issue: `تعارض حالة التفعيل بين restaurant_section_service_areas (${sec.is_active ? 'مفعّل' : 'معطّل'}) و delivery_area_tariffs (${matchingTariff.is_enabled ? 'مفعّل' : 'معطّل'}).`,
          });
        }
      });
    }

    return {
      definition: def,
      totalTariffsCount: svcTariffs.length,
      enabledTariffsCount: enabled.length,
      disabledTariffsCount: disabled.length,
      freeDeliveryCount: free.length,
      coveredGovernorateIds: Array.from(govSet),
      coveredCenterIds: Array.from(centerSet),
      coveredAreaIds: Array.from(areaSet),
      platformTariffsCount: svcTariffs.filter((t) => t.delivery_owner === 'platform').length,
      restaurantTariffsCount: svcTariffs.filter((t) => t.delivery_owner === 'restaurant').length,
      discrepancies,
    };
  });
}

export function filterDriversForCoverage(
  drivers: DeliveryDriver[],
  coverages: CentralDriverAreaCoverage[],
  params: {
    pool: CentralDriverCoveragePool;
    service_type?: CentralServiceType | '';
    governorate_id?: string;
    center_id?: string;
    area_id?: string;
    restaurant_id?: string;
  }
): {
  eligibleCoveredDrivers: Array<{ driver: DeliveryDriver; matchedCoverages: CentralDriverAreaCoverage[]; isCurrentlyAvailable: boolean }>;
  ineligibleOrUncoveredDrivers: Array<{ driver: DeliveryDriver; reason: string }>;
} {
  const poolCoverages = coverages.filter((c) => c.pool === params.pool);
  const eligibleCoveredDrivers: Array<{
    driver: DeliveryDriver;
    matchedCoverages: CentralDriverAreaCoverage[];
    isCurrentlyAvailable: boolean;
  }> = [];
  const ineligibleOrUncoveredDrivers: Array<{ driver: DeliveryDriver; reason: string }> = [];

  for (const driver of drivers) {
    if (!isDriverEligibleForOperations(driver)) {
      ineligibleOrUncoveredDrivers.push({
        driver,
        reason: `الحساب غير مؤهل (status=${driver.status || '—'}, is_active=${driver.is_active ? 'true' : 'false'})`,
      });
      continue;
    }

    const matching = poolCoverages.filter((c) => {
      if (c.driver_id !== driver.id) return false;
      if (!c.is_active) return false;
      if (params.service_type && c.service_type && c.service_type !== params.service_type) return false;
      if (params.pool === 'restaurant' && params.restaurant_id && c.restaurant_id && c.restaurant_id !== params.restaurant_id) {
        return false;
      }
      if (params.governorate_id && c.governorate_id !== params.governorate_id) return false;
      if (params.center_id && c.center_id && c.center_id !== params.center_id) return false;
      if (params.area_id && c.area_id && c.area_id !== params.area_id) return false;
      return true;
    });

    if (matching.length === 0) {
      ineligibleOrUncoveredDrivers.push({
        driver,
        reason: 'لا يمتلك تغطية مفعّلة مطابقة للنطاق والخدمة المحددة',
      });
      continue;
    }

    eligibleCoveredDrivers.push({
      driver,
      matchedCoverages: matching.sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999)),
      isCurrentlyAvailable: Boolean(driver.is_available_for_work),
    });
  }

  return { eligibleCoveredDrivers, ineligibleOrUncoveredDrivers };
}

export type AuditLoggerFn = (action: string, entityType: string, entityId: string, details: Record<string, any>) => Promise<void>;

async function defaultAuditLogger(
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, any>
): Promise<void> {
  if (!supabase) return;
  try {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from('admin_audit_logs').insert({
      admin_user_id: u?.user?.id || null,
      admin_email: u?.user?.email || 'admin@talabatalbayt.app',
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: details || {},
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Could not record central geo audit log:', e);
  }
}

export function createCentralGeoDeliveryService(
  client: any = supabase,
  auditLogger: AuditLoggerFn = defaultAuditLogger
) {
  async function fetchAllRowsPaged<T = any>(
    buildQueryForRange: (from: number, to: number) => any,
    pageSize: number = 1000
  ): Promise<{ success: boolean; data: T[]; error?: string; errorCode?: string | null }> {
    if (!client) {
      return { success: false, data: [], error: 'Supabase client غير مهيأ' };
    }
    let from = 0;
    const allData: T[] = [];
    const seenIds = new Set<string>();
    while (true) {
      const { data, error } = await buildQueryForRange(from, from + pageSize - 1);
      if (error) {
        return {
          success: false,
          data: [],
          error: error.message || 'فشل جلب إحدى صفحات البيانات',
          errorCode: error.code || null,
        };
      }
      const rows = (data || []) as T[];
      for (const row of rows) {
        const rowId = (row as any)?.id;
        if (rowId !== undefined && rowId !== null) {
          const key = String(rowId);
          if (seenIds.has(key)) continue;
          seenIds.add(key);
        }
        allData.push(row);
      }
      if (rows.length < pageSize) {
        break;
      }
      from += pageSize;
    }
    return { success: true, data: allData };
  }

  return {
    async getGeoGovernorates(): Promise<{
      governorates: GeoGovernorate[];
      error?: string;
      errorCode?: string | null;
    }> {
      if (!client) return { governorates: [], error: 'Supabase غير متصل' };
      const res = await fetchAllRowsPaged<GeoGovernorate>((from, to) =>
        client
          .from('geo_governorates')
          .select(GEO_GOV_COLUMNS)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('id', { ascending: true })
          .range(from, to)
      );
      if (!res.success) {
        const formatted = formatCentralDbError({ code: res.errorCode, message: res.error }, 'geo_governorates');
        return { governorates: [], error: formatted.message, errorCode: res.errorCode };
      }
      return { governorates: res.data };
    },

    async getGeoCenters(governorateId?: string): Promise<{
      centers: GeoCenter[];
      error?: string;
      errorCode?: string | null;
    }> {
      if (!client) return { centers: [], error: 'Supabase غير متصل' };
      const res = await fetchAllRowsPaged<GeoCenter>((from, to) => {
        let q = client
          .from('geo_centers')
          .select(GEO_CENTER_COLUMNS)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('id', { ascending: true });
        if (governorateId) {
          q = q.eq('governorate_id', governorateId);
        }
        return q.range(from, to);
      });
      if (!res.success) {
        const formatted = formatCentralDbError({ code: res.errorCode, message: res.error }, 'geo_centers');
        return { centers: [], error: formatted.message, errorCode: res.errorCode };
      }
      return { centers: res.data };
    },

    async getGeoAreasPage(params: {
      governorateId?: string;
      centerId?: string;
      search?: string;
      activeFilter?: 'all' | 'active' | 'inactive';
      limit?: number;
      offset?: number;
    }): Promise<{
      areas: GeoArea[];
      total: number;
      error?: string;
      errorCode?: string | null;
    }> {
      if (!client) return { areas: [], total: 0, error: 'Supabase غير متصل' };
      const limit = params.limit ?? 100;
      const offset = params.offset ?? 0;

      let q = client
        .from('geo_areas')
        .select(GEO_AREA_COLUMNS, { count: 'exact' })
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true });

      if (params.governorateId) q = q.eq('governorate_id', params.governorateId);
      if (params.centerId) q = q.eq('center_id', params.centerId);
      if (params.activeFilter === 'active') q = q.eq('is_active', true);
      if (params.activeFilter === 'inactive') q = q.eq('is_active', false);
      if (params.search && params.search.trim()) {
        const safeSearch = params.search.trim();
        q = q.or(`name_ar.ilike.%${safeSearch}%,name_en.ilike.%${safeSearch}%`);
      }

      const { data, count, error } = await q.range(offset, offset + limit - 1);
      if (error) {
        const formatted = formatCentralDbError(error, 'geo_areas');
        return { areas: [], total: 0, error: formatted.message, errorCode: formatted.code };
      }
      return {
        areas: (data || []) as GeoArea[],
        total: Number(count ?? (data || []).length),
      };
    },

    async getGeoAreasByIds(areaIds: string[]): Promise<{ areas: GeoArea[]; error?: string }> {
      if (!client || areaIds.length === 0) return { areas: [] };
      const unique = Array.from(new Set(areaIds.filter(Boolean)));
      const all: GeoArea[] = [];
      for (let i = 0; i < unique.length; i += 200) {
        const chunk = unique.slice(i, i + 200);
        const { data, error } = await client
          .from('geo_areas')
          .select(GEO_AREA_COLUMNS)
          .in('id', chunk);
        if (error) {
          const formatted = formatCentralDbError(error, 'geo_areas');
          return { areas: all, error: formatted.message };
        }
        if (data) all.push(...(data as GeoArea[]));
      }
      return { areas: all };
    },

    async getAllGeoAreasLightweight(): Promise<{
      areas: Array<{ id: string; governorate_id: string; center_id: string; is_active: boolean }>;
      error?: string;
    }> {
      if (!client) return { areas: [], error: 'Supabase غير متصل' };
      const res = await fetchAllRowsPaged<{ id: string; governorate_id: string; center_id: string; is_active: boolean }>(
        (from, to) =>
          client
            .from('geo_areas')
            .select('id, governorate_id, center_id, is_active')
            .order('id', { ascending: true })
            .range(from, to),
        1000
      );
      if (!res.success) {
        return { areas: [], error: res.error };
      }
      return { areas: res.data };
    },

    computeGeoHierarchyCounts(
      governorates: GeoGovernorate[],
      centers: GeoCenter[],
      lightAreas: Array<{ id: string; governorate_id: string; center_id: string; is_active: boolean }>
    ): {
      byGovernorate: Map<string, GeoGovernorateAreaCount>;
      byCenter: Map<string, GeoCenterAreaCount>;
      totals: {
        totalGovernorates: number;
        activeGovernorates: number;
        totalCenters: number;
        activeCenters: number;
        totalAreas: number;
        activeAreas: number;
      };
    } {
      const byCenter = new Map<string, GeoCenterAreaCount>();
      const byGovernorate = new Map<string, GeoGovernorateAreaCount>();

      governorates.forEach((g) => {
        byGovernorate.set(g.id, {
          governorate_id: g.id,
          total_centers: 0,
          active_centers: 0,
          inactive_centers: 0,
          total_areas: 0,
          active_areas: 0,
          inactive_areas: 0,
        });
      });

      centers.forEach((c) => {
        byCenter.set(c.id, {
          center_id: c.id,
          governorate_id: c.governorate_id,
          total_areas: 0,
          active_areas: 0,
          inactive_areas: 0,
        });
        const gStat = byGovernorate.get(c.governorate_id);
        if (gStat) {
          gStat.total_centers += 1;
          if (c.is_active) gStat.active_centers += 1;
          else gStat.inactive_centers += 1;
        }
      });

      let activeAreasTotal = 0;
      lightAreas.forEach((a) => {
        if (a.is_active) activeAreasTotal += 1;
        const cStat = byCenter.get(a.center_id);
        if (cStat) {
          cStat.total_areas += 1;
          if (a.is_active) cStat.active_areas += 1;
          else cStat.inactive_areas += 1;
        }
        const gStat = byGovernorate.get(a.governorate_id);
        if (gStat) {
          gStat.total_areas += 1;
          if (a.is_active) gStat.active_areas += 1;
          else gStat.inactive_areas += 1;
        }
      });

      return {
        byGovernorate,
        byCenter,
        totals: {
          totalGovernorates: governorates.length,
          activeGovernorates: governorates.filter((g) => g.is_active).length,
          totalCenters: centers.length,
          activeCenters: centers.filter((c) => c.is_active).length,
          totalAreas: lightAreas.length,
          activeAreas: activeAreasTotal,
        },
      };
    },

    async getRestaurants(): Promise<{ restaurants: CentralRestaurantSummary[]; error?: string }> {
      if (!client) return { restaurants: [], error: 'Supabase غير متصل' };
      const res = await fetchAllRowsPaged<CentralRestaurantSummary>((from, to) =>
        client
          .from('restaurants')
          .select('id, name, is_active, is_open, governorate_id, center_id, area_id')
          .order('id', { ascending: true })
          .range(from, to)
      );
      if (!res.success) {
        const formatted = formatCentralDbError({ code: res.errorCode, message: res.error }, 'restaurants');
        return { restaurants: [], error: formatted.message };
      }
      return { restaurants: res.data };
    },

    async getRestaurantSectionServiceAreas(lookups?: GeoLookups): Promise<{
      sectionAreas: CentralSectionServiceAreaRecord[];
      error?: string;
    }> {
      if (!client) return { sectionAreas: [], error: 'Supabase غير متصل' };
      const res = await fetchAllRowsPaged<any>((from, to) =>
        client
          .from('restaurant_section_service_areas')
          .select('id, governorate_id, center_id, area_id, is_active, created_at, updated_at')
          .order('id', { ascending: true })
          .range(from, to)
      );
      if (!res.success) {
        const formatted = formatCentralDbError(
          { code: res.errorCode, message: res.error },
          'restaurant_section_service_areas'
        );
        return { sectionAreas: [], error: formatted.message };
      }

      const missingAreaIds = res.data
        .map((r) => r.area_id)
        .filter((aid: string | null) => aid && !(lookups?.areasById.has(aid)));

      const fetchedAreas = missingAreaIds.length > 0 ? await this.getGeoAreasByIds(missingAreaIds) : { areas: [] };
      const extraAreaMap = new Map<string, GeoArea>();
      fetchedAreas.areas.forEach((a) => extraAreaMap.set(a.id, a));

      const records: CentralSectionServiceAreaRecord[] = res.data.map((r) => {
        const scope_level: CentralScopeLevel = r.area_id ? 'area' : r.center_id ? 'center' : 'governorate';
        const gov = r.governorate_id ? lookups?.governoratesById.get(r.governorate_id) : undefined;
        const center = r.center_id ? lookups?.centersById.get(r.center_id) : undefined;
        const area = r.area_id
          ? lookups?.areasById.get(r.area_id) || extraAreaMap.get(r.area_id)
          : undefined;

        return {
          id: r.id,
          governorate_id: r.governorate_id || null,
          center_id: r.center_id || null,
          area_id: r.area_id || null,
          is_active: Boolean(r.is_active),
          created_at: r.created_at,
          updated_at: r.updated_at,
          scope_level,
          governorate_name_ar: gov?.name_ar || (r.governorate_id ? r.governorate_id : '—'),
          center_name_ar: center?.name_ar || (r.center_id ? r.center_id : '—'),
          area_name_ar: area?.name_ar || (r.area_id ? r.area_id : '—'),
        };
      });

      return { sectionAreas: records };
    },

    async toggleRestaurantSectionServiceArea(
      id: string,
      isActive: boolean
    ): Promise<CentralMutationResult<CentralSectionServiceAreaRecord>> {
      if (!client) return { success: false, error: 'Supabase غير متصل' };
      const nowIso = new Date().toISOString();
      const { data: updatedRows, error } = await client
        .from('restaurant_section_service_areas')
        .update({ is_active: Boolean(isActive), updated_at: nowIso })
        .eq('id', id)
        .select('id, governorate_id, center_id, area_id, is_active, created_at, updated_at');

      if (error) {
        const formatted = formatCentralDbError(error, 'restaurant_section_service_areas');
        return {
          success: false,
          error: formatted.message,
          errorCode: formatted.code,
          constraintHint: formatted.constraintHint,
        };
      }
      if (!updatedRows || updatedRows.length === 0) {
        return {
          success: false,
          error: 'لم يتم تعديل السجل في restaurant_section_service_areas (تحقق من صلاحيات RLS للتحديث).',
        };
      }

      // Mandatory Read-After-Write Verification
      const { data: verified, error: verifyErr } = await client
        .from('restaurant_section_service_areas')
        .select('id, governorate_id, center_id, area_id, is_active, created_at, updated_at')
        .eq('id', id)
        .maybeSingle();

      if (verifyErr || !verified || Boolean(verified.is_active) !== Boolean(isActive)) {
        return {
          success: false,
          error: `تعذر تأكيد التحديث عند إعادة القراءة من restaurant_section_service_areas${verifyErr ? `: ${verifyErr.message}` : ''}.`,
          verifiedFromDb: false,
        };
      }

      await auditLogger('central_service_section.toggle', 'restaurant_section_service_areas', id, {
        is_active: Boolean(isActive),
      });

      return {
        success: true,
        verifiedFromDb: true,
        data: {
          ...verified,
          scope_level: verified.area_id ? 'area' : verified.center_id ? 'center' : 'governorate',
        },
      };
    },

    async getDeliveryAreaTariffs(
      lookups?: GeoLookups,
      restaurantsById?: Map<string, CentralRestaurantSummary>
    ): Promise<{
      tariffs: DeliveryAreaTariff[];
      error?: string;
      errorCode?: string | null;
      constraintHint?: string | null;
    }> {
      if (!client) return { tariffs: [], error: 'Supabase غير متصل' };
      const res = await fetchAllRowsPaged<any>((from, to) =>
        client
          .from('delivery_area_tariffs')
          .select(TARIFF_COLUMNS)
          .order('id', { ascending: true })
          .range(from, to)
      );
      if (!res.success) {
        const formatted = formatCentralDbError(
          { code: res.errorCode, message: res.error },
          'delivery_area_tariffs'
        );
        return {
          tariffs: [],
          error: formatted.message,
          errorCode: formatted.code,
          constraintHint: formatted.constraintHint,
        };
      }

      const missingAreaIds = res.data
        .map((r) => r.area_id)
        .filter((aid: string | null) => aid && !(lookups?.areasById.has(aid)));
      const fetchedAreas = missingAreaIds.length > 0 ? await this.getGeoAreasByIds(missingAreaIds) : { areas: [] };
      const extraAreaMap = new Map<string, GeoArea>();
      fetchedAreas.areas.forEach((a) => extraAreaMap.set(a.id, a));

      const enriched: DeliveryAreaTariff[] = res.data.map((r) => {
        const gov = r.governorate_id ? lookups?.governoratesById.get(r.governorate_id) : undefined;
        const center = r.center_id ? lookups?.centersById.get(r.center_id) : undefined;
        const area = r.area_id
          ? lookups?.areasById.get(r.area_id) || extraAreaMap.get(r.area_id)
          : undefined;
        const rest = r.restaurant_id ? restaurantsById?.get(r.restaurant_id) : undefined;

        const geoActive =
          (gov ? gov.is_active : true) &&
          (center ? center.is_active : true) &&
          (area ? area.is_active : true);

        return {
          id: r.id,
          service_type: r.service_type,
          delivery_owner: r.delivery_owner,
          restaurant_id: r.restaurant_id || null,
          scope_level: r.scope_level,
          governorate_id: r.governorate_id,
          center_id: r.center_id || null,
          area_id: r.area_id || null,
          base_delivery_fee: Number(r.base_delivery_fee),
          admin_commission: Number(r.admin_commission),
          driver_net_fee: Number(r.driver_net_fee),
          customer_delivery_fee: Number(r.customer_delivery_fee),
          is_free_delivery: Boolean(r.is_free_delivery),
          free_delivery_cost_bearer: r.free_delivery_cost_bearer ?? null,
          estimated_delivery_minutes:
            r.estimated_delivery_minutes !== null && r.estimated_delivery_minutes !== undefined
              ? Number(r.estimated_delivery_minutes)
              : null,
          is_enabled: Boolean(r.is_enabled),
          notes: r.notes || null,
          created_at: r.created_at,
          updated_at: r.updated_at,
          governorate_name_ar: gov?.name_ar || r.governorate_id || '—',
          center_name_ar: center?.name_ar || (r.center_id ? r.center_id : '—'),
          area_name_ar: area?.name_ar || (r.area_id ? r.area_id : '—'),
          restaurant_name: rest?.name || (r.restaurant_id ? r.restaurant_id : null),
          geo_is_active: geoActive,
        };
      });

      return { tariffs: enriched };
    },

    async saveDeliveryAreaTariff(
      input: DeliveryAreaTariffInput,
      existingTariffs: DeliveryAreaTariff[],
      lookups: GeoLookups,
      restaurantsById?: Map<string, CentralRestaurantSummary>
    ): Promise<CentralMutationResult<DeliveryAreaTariff>> {
      if (!client) return { success: false, error: 'Supabase غير متصل' };

      const validation = validateTariffInput(input, lookups, restaurantsById);
      if (!validation.valid || !validation.payload) {
        return { success: false, error: validation.error || 'بيانات التسعيرة غير مكتملة أو غير صالحة.' };
      }

      const conflictCheck = detectTariffConflicts(
        {
          id: input.id,
          ...validation.payload,
        },
        existingTariffs
      );

      if (conflictCheck.hasBlockingConflict) {
        const firstBlocking = conflictCheck.conflicts.find((c) => c.severity === 'blocking');
        return {
          success: false,
          error: firstBlocking?.message || 'يوجد تعارض تكرار في السجلات يمنع الحفظ.',
        };
      }

      const nowIso = new Date().toISOString();
      const dbRow: Record<string, any> = {
        service_type: validation.payload.service_type,
        delivery_owner: validation.payload.delivery_owner,
        restaurant_id: validation.payload.restaurant_id,
        scope_level: validation.payload.scope_level,
        governorate_id: validation.payload.governorate_id,
        center_id: validation.payload.center_id,
        area_id: validation.payload.area_id,
        base_delivery_fee: validation.payload.base_delivery_fee,
        admin_commission: validation.payload.admin_commission,
        driver_net_fee: validation.payload.driver_net_fee,
        customer_delivery_fee: validation.payload.customer_delivery_fee,
        is_free_delivery: validation.payload.is_free_delivery,
        free_delivery_cost_bearer: validation.payload.free_delivery_cost_bearer,
        estimated_delivery_minutes: validation.payload.estimated_delivery_minutes,
        is_enabled: validation.payload.is_enabled,
        notes: validation.payload.notes,
        updated_at: nowIso,
      };

      let targetId = input.id;

      if (targetId) {
        const { data: updatedRows, error } = await client
          .from('delivery_area_tariffs')
          .update(dbRow)
          .eq('id', targetId)
          .select(TARIFF_COLUMNS);

        if (error) {
          const formatted = formatCentralDbError(error, 'delivery_area_tariffs');
          return {
            success: false,
            error: formatted.message,
            errorCode: formatted.code,
            constraintHint: formatted.constraintHint,
          };
        }
        if (!updatedRows || updatedRows.length === 0) {
          return {
            success: false,
            error: 'لم يتم تعديل السجل في delivery_area_tariffs (تحقق من وجود السجل وصلاحيات RLS للتحديث).',
          };
        }
      } else {
        const { data: insertedRows, error } = await client
          .from('delivery_area_tariffs')
          .insert([{ ...dbRow, created_at: nowIso }])
          .select(TARIFF_COLUMNS);

        if (error) {
          const formatted = formatCentralDbError(error, 'delivery_area_tariffs');
          return {
            success: false,
            error: formatted.message,
            errorCode: formatted.code,
            constraintHint: formatted.constraintHint,
          };
        }
        if (!insertedRows || insertedRows.length === 0) {
          return {
            success: false,
            error: 'لم يتم حفظ السجل في delivery_area_tariffs (تحقق من صلاحيات INSERT في سياسات RLS).',
          };
        }
        targetId = insertedRows[0].id;
      }

      // Mandatory Read-After-Write Verification
      const { data: verified, error: verifyErr } = await client
        .from('delivery_area_tariffs')
        .select(TARIFF_COLUMNS)
        .eq('id', targetId)
        .maybeSingle();

      if (verifyErr || !verified) {
        return {
          success: false,
          verifiedFromDb: false,
          error: `تعذر تأكيد حفظ التسعيرة عند إعادة القراءة من قاعدة البيانات${verifyErr ? `: ${verifyErr.message}` : ' (السجل غير مرئي بعد الحفظ)'}.`,
        };
      }

      await auditLogger(
        input.id ? 'central_tariff.update' : 'central_tariff.create',
        'delivery_area_tariffs',
        verified.id,
        dbRow
      );

      return {
        success: true,
        verifiedFromDb: true,
        data: verified as DeliveryAreaTariff,
      };
    },

    async toggleDeliveryAreaTariffEnabled(
      tariff: DeliveryAreaTariff,
      nextIsEnabled: boolean,
      lookups: GeoLookups
    ): Promise<CentralMutationResult<DeliveryAreaTariff>> {
      if (!client) return { success: false, error: 'Supabase غير متصل' };

      if (nextIsEnabled) {
        const geoCheck = validateGeoHierarchySelection(
          {
            scope_level: tariff.scope_level,
            governorate_id: tariff.governorate_id,
            center_id: tariff.center_id,
            area_id: tariff.area_id,
            requireActiveGeo: true,
          },
          lookups
        );
        if (!geoCheck.valid) {
          return { success: false, error: geoCheck.error || 'لا يمكن تفعيل تسعيرة على منطقة غير مفعلة.' };
        }
      }

      const { data: updatedRows, error } = await client
        .from('delivery_area_tariffs')
        .update({ is_enabled: Boolean(nextIsEnabled), updated_at: new Date().toISOString() })
        .eq('id', tariff.id)
        .select(TARIFF_COLUMNS);

      if (error) {
        const formatted = formatCentralDbError(error, 'delivery_area_tariffs');
        return {
          success: false,
          error: formatted.message,
          errorCode: formatted.code,
          constraintHint: formatted.constraintHint,
        };
      }
      if (!updatedRows || updatedRows.length === 0) {
        return {
          success: false,
          error: 'لم يتم تحديث حالة التفعيل في delivery_area_tariffs (تحقق من صلاحيات RLS).',
        };
      }

      const { data: verified, error: verifyErr } = await client
        .from('delivery_area_tariffs')
        .select(TARIFF_COLUMNS)
        .eq('id', tariff.id)
        .maybeSingle();

      if (verifyErr || !verified || Boolean(verified.is_enabled) !== Boolean(nextIsEnabled)) {
        return {
          success: false,
          verifiedFromDb: false,
          error: `تعذر تأكيد تغيير حالة التفعيل عند إعادة القراءة من قاعدة البيانات${verifyErr ? `: ${verifyErr.message}` : ''}.`,
        };
      }

      await auditLogger('central_tariff.toggle_enabled', 'delivery_area_tariffs', tariff.id, {
        is_enabled: Boolean(nextIsEnabled),
      });

      return { success: true, verifiedFromDb: true, data: verified as DeliveryAreaTariff };
    },

    async deleteDeliveryAreaTariff(id: string): Promise<CentralMutationResult<null>> {
      if (!client) return { success: false, error: 'Supabase غير متصل' };
      const { error } = await client.from('delivery_area_tariffs').delete().eq('id', id);
      if (error) {
        const formatted = formatCentralDbError(error, 'delivery_area_tariffs');
        return {
          success: false,
          error: formatted.message,
          errorCode: formatted.code,
          constraintHint: formatted.constraintHint,
        };
      }

      const { data: remaining, error: checkErr } = await client
        .from('delivery_area_tariffs')
        .select('id')
        .eq('id', id)
        .maybeSingle();

      if (checkErr) {
        return {
          success: false,
          verifiedFromDb: false,
          error: `تم إرسال طلب الحذف لكن تعذر التحقق بعد الحذف: ${checkErr.message}`,
        };
      }
      if (remaining) {
        return {
          success: false,
          verifiedFromDb: false,
          error: 'السجل ما زال موجوداً بعد محاولة الحذف (قد تمنع سياسة RLS عملية DELETE).',
        };
      }

      await auditLogger('central_tariff.delete', 'delivery_area_tariffs', id, {});
      return { success: true, verifiedFromDb: true, data: null };
    },

    async getDriversAndCoverage(
      lookups?: GeoLookups,
      restaurantsById?: Map<string, CentralRestaurantSummary>
    ): Promise<{
      drivers: DeliveryDriver[];
      platformCoverages: CentralDriverAreaCoverage[];
      restaurantCoverages: CentralDriverAreaCoverage[];
      driversError?: string | null;
      platformCoverageError?: string | null;
      restaurantCoverageError?: string | null;
    }> {
      if (!client) {
        return {
          drivers: [],
          platformCoverages: [],
          restaurantCoverages: [],
          driversError: 'Supabase غير متصل',
        };
      }

      const [driversRes, platCovRes, restCovRes] = await Promise.all([
        fetchAllRowsPaged<DeliveryDriver>((from, to) =>
          client
            .from('delivery_drivers')
            .select(DRIVER_COLUMNS)
            .order('id', { ascending: true })
            .range(from, to)
        ),
        fetchAllRowsPaged<any>((from, to) =>
          client
            .from('delivery_driver_area_coverage')
            .select('*')
            .order('id', { ascending: true })
            .range(from, to)
        ),
        fetchAllRowsPaged<any>((from, to) =>
          client
            .from('restaurant_driver_area_coverage')
            .select('*')
            .order('id', { ascending: true })
            .range(from, to)
        ),
      ]);

      const drivers = driversRes.success ? driversRes.data : [];
      const driverById = new Map<string, DeliveryDriver>();
      drivers.forEach((d) => driverById.set(d.id, d));

      const allRawAreaIds = [
        ...(platCovRes.success ? platCovRes.data.map((r: any) => r.area_id) : []),
        ...(restCovRes.success ? restCovRes.data.map((r: any) => r.area_id) : []),
      ].filter((id: string | null) => Boolean(id) && !(lookups?.areasById.has(id)));

      const fetchedAreas = allRawAreaIds.length > 0 ? await this.getGeoAreasByIds(allRawAreaIds) : { areas: [] };
      const extraAreaMap = new Map<string, GeoArea>();
      fetchedAreas.areas.forEach((a) => extraAreaMap.set(a.id, a));

      const enrichCoverage = (rawRows: any[], pool: CentralDriverCoveragePool): CentralDriverAreaCoverage[] =>
        rawRows.map((r) => {
          const drv = r.driver_id ? driverById.get(r.driver_id) : undefined;
          const gov = r.governorate_id ? lookups?.governoratesById.get(r.governorate_id) : undefined;
          const center = r.center_id ? lookups?.centersById.get(r.center_id) : undefined;
          const area = r.area_id ? lookups?.areasById.get(r.area_id) || extraAreaMap.get(r.area_id) : undefined;
          const rest = r.restaurant_id ? restaurantsById?.get(r.restaurant_id) : undefined;
          const scope_level: CentralScopeLevel = r.area_id ? 'area' : r.center_id ? 'center' : 'governorate';

          return {
            id: r.id,
            pool,
            driver_id: r.driver_id,
            restaurant_id: r.restaurant_id || null,
            service_type: r.service_type || (pool === 'restaurant' ? 'ready_food' : null),
            governorate_id: r.governorate_id,
            center_id: r.center_id || null,
            area_id: r.area_id || null,
            scope_level,
            is_active: Boolean(r.is_active),
            priority: r.priority !== null && r.priority !== undefined ? Number(r.priority) : null,
            notes: r.notes || null,
            created_at: r.created_at,
            updated_at: r.updated_at,
            driver_name: drv?.full_name || r.driver_id,
            driver_phone: drv?.phone || null,
            driver_status: drv?.status || null,
            driver_is_active: drv?.is_active ?? null,
            driver_is_available_for_work: drv?.is_available_for_work ?? null,
            driver_is_eligible: isDriverEligibleForOperations(drv),
            restaurant_name: rest?.name || (r.restaurant_id ? r.restaurant_id : null),
            governorate_name_ar: gov?.name_ar || r.governorate_id || '—',
            center_name_ar: center?.name_ar || (r.center_id ? r.center_id : '—'),
            area_name_ar: area?.name_ar || (r.area_id ? r.area_id : '—'),
          };
        });

      return {
        drivers,
        platformCoverages: platCovRes.success ? enrichCoverage(platCovRes.data, 'platform') : [],
        restaurantCoverages: restCovRes.success ? enrichCoverage(restCovRes.data, 'restaurant') : [],
        driversError: driversRes.success
          ? null
          : formatCentralDbError({ code: driversRes.errorCode, message: driversRes.error }, 'delivery_drivers').message,
        platformCoverageError: platCovRes.success
          ? null
          : formatCentralDbError(
              { code: platCovRes.errorCode, message: platCovRes.error },
              'delivery_driver_area_coverage'
            ).message,
        restaurantCoverageError: restCovRes.success
          ? null
          : formatCentralDbError(
              { code: restCovRes.errorCode, message: restCovRes.error },
              'restaurant_driver_area_coverage'
            ).message,
      };
    },

    async saveDriverCoverage(
      input: DriverCoverageMutationInput,
      driver: DeliveryDriver | undefined,
      existingPoolCoverages: CentralDriverAreaCoverage[],
      lookups: GeoLookups,
      restaurantsById?: Map<string, CentralRestaurantSummary>
    ): Promise<CentralMutationResult<CentralDriverAreaCoverage>> {
      if (!client) return { success: false, error: 'Supabase غير متصل' };

      const validation = validateDriverCoverageInput(
        input,
        driver,
        existingPoolCoverages,
        lookups,
        restaurantsById
      );
      if (!validation.valid || !validation.normalized) {
        return { success: false, error: validation.error || 'بيانات ربط المندوب غير صالحة.' };
      }

      const tableName =
        validation.normalized.pool === 'platform'
          ? 'delivery_driver_area_coverage'
          : 'restaurant_driver_area_coverage';

      const nowIso = new Date().toISOString();
      const dbRow: Record<string, any> = {
        driver_id: validation.normalized.driver_id,
        service_type: validation.normalized.service_type,
        governorate_id: validation.normalized.governorate_id,
        center_id: validation.normalized.center_id,
        area_id: validation.normalized.area_id,
        is_active: validation.normalized.is_active,
        updated_at: nowIso,
      };

      if (validation.normalized.priority !== null) {
        dbRow.priority = validation.normalized.priority;
      }
      if (validation.normalized.notes !== null) {
        dbRow.notes = validation.normalized.notes;
      }
      if (validation.normalized.pool === 'restaurant' && validation.normalized.restaurant_id) {
        dbRow.restaurant_id = validation.normalized.restaurant_id;
      }

      let targetId = input.id;
      if (targetId) {
        const { data: updatedRows, error } = await client
          .from(tableName)
          .update(dbRow)
          .eq('id', targetId)
          .select('*');

        if (error) {
          const formatted = formatCentralDbError(error, tableName);
          return {
            success: false,
            error: formatted.message,
            errorCode: formatted.code,
            constraintHint: formatted.constraintHint,
          };
        }
        if (!updatedRows || updatedRows.length === 0) {
          return {
            success: false,
            error: `لم يتم تعديل التغطية في جدول ${tableName} (تحقق من صلاحيات UPDATE في سياسات RLS).`,
          };
        }
      } else {
        const { data: insertedRows, error } = await client
          .from(tableName)
          .insert([{ ...dbRow, created_at: nowIso }])
          .select('*');

        if (error) {
          const formatted = formatCentralDbError(error, tableName);
          return {
            success: false,
            error: formatted.message,
            errorCode: formatted.code,
            constraintHint: formatted.constraintHint,
          };
        }
        if (!insertedRows || insertedRows.length === 0) {
          return {
            success: false,
            error: `لم يتم إضافة التغطية في جدول ${tableName} (تحقق من صلاحيات INSERT في سياسات RLS).`,
          };
        }
        targetId = insertedRows[0].id;
      }

      // Mandatory Read-After-Write Verification
      const { data: verified, error: verifyErr } = await client
        .from(tableName)
        .select('*')
        .eq('id', targetId)
        .maybeSingle();

      if (verifyErr || !verified) {
        return {
          success: false,
          verifiedFromDb: false,
          error: `تعذر تأكيد حفظ تغطية المندوب عند إعادة القراءة من ${tableName}${verifyErr ? `: ${verifyErr.message}` : ''}.`,
        };
      }

      await auditLogger(
        input.id ? 'central_driver_coverage.update' : 'central_driver_coverage.create',
        tableName,
        verified.id,
        dbRow
      );

      return {
        success: true,
        verifiedFromDb: true,
        data: {
          ...verified,
          pool: validation.normalized.pool,
          scope_level: verified.area_id ? 'area' : verified.center_id ? 'center' : 'governorate',
        },
      };
    },

    async toggleDriverCoverageActive(
      pool: CentralDriverCoveragePool,
      coverage: CentralDriverAreaCoverage,
      driver: DeliveryDriver | undefined,
      nextIsActive: boolean,
      lookups: GeoLookups
    ): Promise<CentralMutationResult<CentralDriverAreaCoverage>> {
      if (!client) return { success: false, error: 'Supabase غير متصل' };

      if (nextIsActive) {
        if (!isDriverEligibleForOperations(driver)) {
          return {
            success: false,
            error: 'لا يمكن تفعيل تغطية لمندوب غير معتمد أو معطل إدارياً.',
          };
        }
        const geoCheck = validateGeoHierarchySelection(
          {
            scope_level: coverage.scope_level || (coverage.area_id ? 'area' : coverage.center_id ? 'center' : 'governorate'),
            governorate_id: coverage.governorate_id,
            center_id: coverage.center_id,
            area_id: coverage.area_id,
            requireActiveGeo: true,
          },
          lookups
        );
        if (!geoCheck.valid) {
          return { success: false, error: geoCheck.error || 'النطاق الجغرافي غير مفعل.' };
        }
      }

      const tableName =
        pool === 'platform' ? 'delivery_driver_area_coverage' : 'restaurant_driver_area_coverage';

      const { data: updatedRows, error } = await client
        .from(tableName)
        .update({ is_active: Boolean(nextIsActive), updated_at: new Date().toISOString() })
        .eq('id', coverage.id)
        .select('*');

      if (error) {
        const formatted = formatCentralDbError(error, tableName);
        return {
          success: false,
          error: formatted.message,
          errorCode: formatted.code,
          constraintHint: formatted.constraintHint,
        };
      }
      if (!updatedRows || updatedRows.length === 0) {
        return {
          success: false,
          error: `لم يتم تعديل حالة التغطية في جدول ${tableName} (تحقق من صلاحيات RLS).`,
        };
      }

      const { data: verified, error: verifyErr } = await client
        .from(tableName)
        .select('*')
        .eq('id', coverage.id)
        .maybeSingle();

      if (verifyErr || !verified || Boolean(verified.is_active) !== Boolean(nextIsActive)) {
        return {
          success: false,
          verifiedFromDb: false,
          error: `تعذر تأكيد تغيير حالة التغطية عند إعادة القراءة من ${tableName}${verifyErr ? `: ${verifyErr.message}` : ''}.`,
        };
      }

      await auditLogger('central_driver_coverage.toggle_active', tableName, coverage.id, {
        is_active: Boolean(nextIsActive),
      });

      return {
        success: true,
        verifiedFromDb: true,
        data: {
          ...verified,
          pool,
          scope_level: verified.area_id ? 'area' : verified.center_id ? 'center' : 'governorate',
        },
      };
    },

    async deleteDriverCoverage(
      pool: CentralDriverCoveragePool,
      id: string
    ): Promise<CentralMutationResult<null>> {
      if (!client) return { success: false, error: 'Supabase غير متصل' };
      const tableName =
        pool === 'platform' ? 'delivery_driver_area_coverage' : 'restaurant_driver_area_coverage';

      const { error } = await client.from(tableName).delete().eq('id', id);
      if (error) {
        const formatted = formatCentralDbError(error, tableName);
        return {
          success: false,
          error: formatted.message,
          errorCode: formatted.code,
          constraintHint: formatted.constraintHint,
        };
      }

      const { data: remaining, error: checkErr } = await client
        .from(tableName)
        .select('id')
        .eq('id', id)
        .maybeSingle();

      if (checkErr || remaining) {
        return {
          success: false,
          verifiedFromDb: false,
          error: checkErr
            ? `تعذر التحقق من حذف التغطية في ${tableName}: ${checkErr.message}`
            : `السجل ما زال موجوداً في ${tableName} بعد محاولة الحذف.`,
        };
      }

      await auditLogger('central_driver_coverage.delete', tableName, id, {});
      return { success: true, verifiedFromDb: true, data: null };
    },
  };
}

export const centralGeoDeliveryService = createCentralGeoDeliveryService(
  isSupabaseConfigured ? supabase : null,
  defaultAuditLogger
);
