import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  AppDisabledDisplayMode,
  AppSectionDisplayWidth,
  AppSectionKey,
  AppSectionSetting,
  AppSectionSettingUpdateInput,
  CentralDeliveryOwner,
  CentralDriverAreaCoverage,
  CentralDriverCoveragePool,
  CentralFreeDeliveryCostBearer,
  CentralMutationResult,
  CentralRestaurantSummary,
  CentralScopeLevel,
  CentralServiceDefinition,
  CentralServiceType,
  DeliveryAreaTariff,
  DeliveryAreaTariffBatchInput,
  DeliveryAreaTariffInput,
  DeliveryDriver,
  DeliverySystemSettings,
  DriverCoverageMutationInput,
  EffectiveTariffResolution,
  GeoArea,
  GeoCenter,
  GeoCenterAreaCount,
  GeoGovernorate,
  GeoGovernorateAreaCount,
  LAUNCH_SCOPE_GOVERNORATE_CODES,
  ServiceSectionDiscrepancy,
  ServiceSectionSummary,
  TariffAreaConflictDetail,
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
  'id, governorate_id, center_id, name_ar, name_en, is_active, sort_order, admin_unit_type, classification_status, source_system, source_code, latitude, longitude, created_at, updated_at';

const TARIFF_COLUMNS =
  'id, service_type, delivery_owner, restaurant_id, scope_level, governorate_id, center_id, area_id, base_delivery_fee, admin_commission, driver_net_fee, customer_delivery_fee, is_free_delivery, free_delivery_cost_bearer, estimated_delivery_minutes, is_enabled, notes, created_at, updated_at';

const PLATFORM_COVERAGE_COLUMNS =
  'id, driver_id, service_type, area_id, is_active, priority, created_at, updated_at';

const RESTAURANT_COVERAGE_COLUMNS = 'id, driver_id, area_id, is_active, created_at';

const DRIVER_COLUMNS =
  'id, user_id, full_name, phone, is_active, status, governorate_code, governorate_name, markaz_name, vehicle_type, vehicle_plate, is_available_for_work, availability_last_seen_at, created_at, updated_at';

export const APP_SECTION_SETTINGS_COLUMNS =
  'section_key, section_enabled, section_visible, delivery_enabled, disabled_display_mode, display_width, updated_at, updated_by';

export const ALLOWED_APP_DISABLED_DISPLAY_MODES: readonly AppDisabledDisplayMode[] = [
  'show_disabled',
  'hide',
];

export const ALLOWED_APP_SECTION_DISPLAY_WIDTHS: readonly AppSectionDisplayWidth[] = [
  'full',
  'half',
];

export function normalizeAppSectionSettingRow(row: any): AppSectionSetting {
  const modeRaw = row?.disabled_display_mode;
  const widthRaw = row?.display_width;
  return {
    section_key: row.section_key as AppSectionKey,
    section_enabled: Boolean(row?.section_enabled),
    section_visible: Boolean(row?.section_visible),
    delivery_enabled: Boolean(row?.delivery_enabled),
    disabled_display_mode:
      modeRaw === 'show_disabled' || modeRaw === 'hide' ? modeRaw : null,
    display_width: widthRaw === 'full' || widthRaw === 'half' ? widthRaw : null,
    updated_at: row?.updated_at || null,
    updated_by: row?.updated_by || null,
  };
}

export function validateAppSectionSettingUpdate(
  sectionKey: AppSectionKey,
  updates: AppSectionSettingUpdateInput
): { valid: boolean; error?: string; payload?: Record<string, any> } {
  if (!ALLOWED_CENTRAL_SERVICE_TYPES.includes(sectionKey)) {
    return {
      valid: false,
      error: `مفتاح القسم (${sectionKey}) غير معتمد. المفاتيح المعتمدة فقط: household_shortages، pharmacy، ready_food.`,
    };
  }

  const payload: Record<string, any> = {};

  if (updates.section_enabled !== undefined) {
    if (typeof updates.section_enabled !== 'boolean') {
      return { valid: false, error: 'قيمة تشغيل القسم (section_enabled) يجب أن تكون منطقية true أو false.' };
    }
    payload.section_enabled = updates.section_enabled;
  }

  if (updates.section_visible !== undefined) {
    if (typeof updates.section_visible !== 'boolean') {
      return { valid: false, error: 'قيمة إظهار القسم (section_visible) يجب أن تكون منطقية true أو false.' };
    }
    payload.section_visible = updates.section_visible;
  }

  if (updates.delivery_enabled !== undefined) {
    if (typeof updates.delivery_enabled !== 'boolean') {
      return { valid: false, error: 'قيمة خدمة التوصيل (delivery_enabled) يجب أن تكون منطقية true أو false.' };
    }
    payload.delivery_enabled = updates.delivery_enabled;
  }

  if (updates.disabled_display_mode !== undefined) {
    if (
      updates.disabled_display_mode !== null &&
      !ALLOWED_APP_DISABLED_DISPLAY_MODES.includes(updates.disabled_display_mode)
    ) {
      return {
        valid: false,
        error: 'قيمة طريقة العرض عند التعطيل (disabled_display_mode) غير صالحة؛ القيم المسموحة هي show_disabled أو hide أو فارغ.',
      };
    }
    payload.disabled_display_mode = updates.disabled_display_mode;
  }

  if (updates.display_width !== undefined) {
    if (
      updates.display_width !== null &&
      !ALLOWED_APP_SECTION_DISPLAY_WIDTHS.includes(updates.display_width)
    ) {
      return {
        valid: false,
        error: 'قيمة عرض البطاقة (display_width) غير صالحة؛ القيم المسموحة هي full أو half أو فارغ.',
      };
    }
    payload.display_width = updates.display_width;
  }

  if (Object.keys(payload).length === 0) {
    return { valid: false, error: 'لا توجد تعديلات محددة للحفظ في إعدادات القسم.' };
  }

  return { valid: true, payload };
}

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
      return 'تتحملها المنصة (platform)';
    case 'restaurant':
      return 'يتحملها المطعم (restaurant)';
    default:
      return 'غير محدد';
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

export function isLaunchScopeGovernorate(
  gov?: Pick<GeoGovernorate, 'code' | 'name_ar' | 'name_en'> | null
): boolean {
  if (!gov) return false;
  const code = (gov.code || '').trim().toUpperCase();
  if (code && LAUNCH_SCOPE_GOVERNORATE_CODES.includes(code)) {
    return true;
  }
  const ar = gov.name_ar || '';
  const en = (gov.name_en || '').trim().toLowerCase();
  return ar.includes('سوهاج') || en.includes('sohag');
}

export function getLaunchScopeGovernorates(governorates: GeoGovernorate[]): GeoGovernorate[] {
  return governorates.filter((g) => g.is_active && isLaunchScopeGovernorate(g));
}

export function validateGeoHierarchySelection(
  params: {
    scope_level: CentralScopeLevel;
    governorate_id?: string | null;
    center_id?: string | null;
    area_id?: string | null;
    requireActiveGeo?: boolean;
    enforceLaunchScope?: boolean;
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
  if (params.enforceLaunchScope && !isLaunchScopeGovernorate(gov)) {
    return {
      valid: false,
      error: `نطاق الإطلاق الحالي مقتصر على محافظة سوهاج فقط (${LAUNCH_SCOPE_GOVERNORATE_CODES.join('، ')})؛ لا يُسمح بإعداد أو حفظ تغطية أو تسعيرة لمحافظة (${gov.name_ar}) حالياً.`,
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

export type ValidatedTariffWritablePayload = Omit<
  DeliveryAreaTariff,
  'id' | 'created_at' | 'updated_at' | 'driver_net_fee' | 'customer_delivery_fee'
>;

export function previewGeneratedTariffValues(params: {
  base_delivery_fee: number | string | null | undefined;
  admin_commission: number | string | null | undefined;
  delivery_owner: CentralDeliveryOwner;
  is_free_delivery: boolean;
}): {
  expectedDriverNetFee: number | null;
  expectedCustomerDeliveryFee: number | null;
} {
  const baseRaw = params.base_delivery_fee;
  const commRaw = params.admin_commission;
  const hasBase =
    baseRaw !== null &&
    baseRaw !== undefined &&
    String(baseRaw).trim() !== '' &&
    Number.isFinite(Number(baseRaw)) &&
    Number(baseRaw) >= 0;
  const hasComm =
    commRaw !== null &&
    commRaw !== undefined &&
    String(commRaw).trim() !== '' &&
    Number.isFinite(Number(commRaw)) &&
    Number(commRaw) >= 0;

  const baseVal = hasBase ? Math.round(Number(baseRaw) * 100) / 100 : null;
  const commVal = hasComm ? Math.round(Number(commRaw) * 100) / 100 : null;

  const expectedCustomerDeliveryFee = params.is_free_delivery ? 0 : baseVal;
  let expectedDriverNetFee: number | null = null;
  if (params.delivery_owner === 'restaurant') {
    expectedDriverNetFee = 0;
  } else if (baseVal !== null && commVal !== null) {
    expectedDriverNetFee = Math.round((baseVal - commVal) * 100) / 100;
  }

  return {
    expectedDriverNetFee,
    expectedCustomerDeliveryFee,
  };
}

export function validateTariffInput(
  input: DeliveryAreaTariffInput,
  lookups: GeoLookups,
  restaurantsById?: Map<string, CentralRestaurantSummary>
): { valid: boolean; error?: string; payload?: ValidatedTariffWritablePayload } {
  if (!ALLOWED_CENTRAL_SERVICE_TYPES.includes(input.service_type)) {
    return { valid: false, error: `قسم الخدمة (${input.service_type}) غير مدعوم. الأقسام المعتمدة فقط: household_shortages، pharmacy، ready_food.` };
  }
  if (!ALLOWED_DELIVERY_OWNERS.includes(input.delivery_owner)) {
    return { valid: false, error: 'جهة التوصيل (delivery_owner) يجب أن تكون platform أو restaurant فقط.' };
  }

  const restaurantId = (input.restaurant_id || '').trim() || null;

  // Enforce delivery_area_tariffs_service_restaurant_chk & delivery_area_tariffs_owner_chk:
  // - ready_food ALWAYS requires restaurant_id for BOTH delivery_owner = 'platform' and 'restaurant'.
  // - household_shortages & pharmacy MUST have delivery_owner = 'platform' and restaurant_id = null.
  if (input.service_type === 'ready_food') {
    if (!restaurantId) {
      return {
        valid: false,
        error: 'يجب تحديد المطعم لقسم الأكلات الجاهزة (ready_food) سواء مع توصيل المنصة أو توصيل المطعم.',
      };
    }
    if (restaurantsById && !restaurantsById.has(restaurantId)) {
      return { valid: false, error: 'المطعم المحدد غير موجود في قائمة المطاعم.' };
    }
  } else {
    if (input.delivery_owner === 'restaurant') {
      return { valid: false, error: 'التوصيل الذاتي للمطعم (restaurant) مخصص لقسم المطاعم والأكلات الجاهزة (ready_food) فقط.' };
    }
    if (restaurantId) {
      return { valid: false, error: 'يجب عدم ربط مطعم محدد مع قسم نواقص البيت أو الصيدليات (restaurant_id يجب أن يكون فارغاً).' };
    }
  }

  const geoCheck = validateGeoHierarchySelection(
    {
      scope_level: input.scope_level,
      governorate_id: input.governorate_id,
      center_id: input.center_id,
      area_id: input.area_id,
      requireActiveGeo: true,
      enforceLaunchScope: true,
    },
    lookups
  );
  if (!geoCheck.valid || !geoCheck.normalized) {
    return { valid: false, error: geoCheck.error || 'بيانات النطاق الجغرافي غير صالحة.' };
  }

  const baseRes = parseExplicitNonNegativeNumber(input.base_delivery_fee, 'رسوم التوصيل الأساسية');
  if (!baseRes.ok || baseRes.value === undefined) return { valid: false, error: baseRes.error };

  // Enforce delivery_area_tariffs_owner_chk & delivery_area_tariffs_active_area_complete_chk:
  // - When delivery_owner === 'restaurant', admin_commission MUST be numeric 0 (positive values rejected, never null).
  let adminCommissionValue = 0;
  if (input.delivery_owner === 'restaurant') {
    const rawComm = input.admin_commission;
    if (rawComm !== null && rawComm !== undefined && String(rawComm).trim() !== '') {
      const parsedComm = Number(rawComm);
      if (!Number.isFinite(parsedComm) || parsedComm < 0) {
        return { valid: false, error: 'عمولة الإدارة لتوصيل المطعم يجب أن تكون 0 تلقائياً.' };
      }
      if (parsedComm > 0) {
        return {
          valid: false,
          error: 'لا توجد عمولة إدارية على توصيل المطعم: يجب أن تكون عمولة الإدارة 0 ولا يُسمح بقيمة موجبة عند اختيار توصيل المطعم.',
        };
      }
    }
    adminCommissionValue = 0;
  } else {
    const commRes = parseExplicitNonNegativeNumber(input.admin_commission, 'عمولة الإدارة');
    if (!commRes.ok || commRes.value === undefined) return { valid: false, error: commRes.error };
    adminCommissionValue = commRes.value;
  }

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

  // Enforce delivery_area_tariffs_free_bearer_chk:
  // - Only 'platform' (when owner='platform') or 'restaurant' (when owner='restaurant') when is_free_delivery = true.
  // - Strictly null when is_free_delivery = false. Never 'split' or 'none'.
  const isFree = Boolean(input.is_free_delivery);
  const rawBearer = input.free_delivery_cost_bearer ? String(input.free_delivery_cost_bearer).trim() : null;

  if (rawBearer === 'split' || rawBearer === 'none') {
    return {
      valid: false,
      error: 'القيم split أو none غير مدعومة في جدول التسعيرات المركزية؛ القيم المسموحة فقط platform أو restaurant عند التوصيل المجاني أو NULL عند إيقافه.',
    };
  }

  let finalBearer: CentralFreeDeliveryCostBearer | null = null;
  if (isFree) {
    const expectedBearer: CentralFreeDeliveryCostBearer =
      input.delivery_owner === 'restaurant' ? 'restaurant' : 'platform';
    if (rawBearer && rawBearer !== expectedBearer) {
      return {
        valid: false,
        error:
          input.delivery_owner === 'restaurant'
            ? 'عند تفعيل التوصيل المجاني مع توصيل المطعم يجب أن تكون جهة التحمل (restaurant) فقط.'
            : 'عند تفعيل التوصيل المجاني مع توصيل المنصة يجب أن تكون جهة التحمل (platform) فقط.',
      };
    }
    finalBearer = expectedBearer;
  } else {
    finalBearer = null;
  }

  // Note: driver_net_fee & customer_delivery_fee are PostgreSQL GENERATED ALWAYS AS STORED columns
  // and must NEVER be validated as manual user input or included in INSERT/UPDATE payloads.
  return {
    valid: true,
    payload: {
      service_type: input.service_type,
      delivery_owner: input.delivery_owner,
      restaurant_id: input.service_type === 'ready_food' ? restaurantId : null,
      scope_level: input.scope_level,
      governorate_id: geoCheck.normalized.governorate_id,
      center_id: geoCheck.normalized.center_id,
      area_id: geoCheck.normalized.area_id,
      base_delivery_fee: baseRes.value,
      admin_commission: adminCommissionValue,
      is_free_delivery: isFree,
      free_delivery_cost_bearer: finalBearer,
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
  const normRestId =
    candidate.service_type === 'ready_food' ? candidate.restaurant_id || null : null;
  const normCenterId = candidate.center_id || null;
  const normAreaId = candidate.area_id || null;

  for (const row of existingTariffs) {
    if (candidate.id && row.id === candidate.id) continue;
    if (row.service_type !== candidate.service_type) continue;
    if (row.governorate_id !== candidate.governorate_id) continue;

    const rowRestId = row.service_type === 'ready_food' ? row.restaurant_id || null : null;
    const rowCenterId = row.center_id || null;
    const rowAreaId = row.area_id || null;
    const restLabel = row.restaurant_name ? ` للمطعم "${row.restaurant_name}"` : '';

    // Exact matching record conflict (blocking regardless of enabled status so duplicate scope records are never created)
    // Note: For ready_food, restaurant_id is part of identity for BOTH platform & restaurant owners.
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
        message: `يوجد بالفعل سجل تسعيرة مطابق${restLabel} لنفس القسم والجهة والمستوى والنطاق الجغرافي (${row.is_enabled ? 'مفعّل' : 'معطّل'}). عدّل السجل القائم بدل التكرار.`,
        conflictingTariff: row,
      });
      continue;
    }

    // Cross-owner overlap for the SAME restaurant in ready_food (never warn across different restaurants)
    if (
      row.delivery_owner !== candidate.delivery_owner &&
      (candidate.service_type !== 'ready_food' || rowRestId === normRestId) &&
      row.scope_level === candidate.scope_level &&
      rowCenterId === normCenterId &&
      rowAreaId === normAreaId
    ) {
      conflicts.push({
        kind: 'cross_owner_exists',
        severity: 'warning',
        message: `يوجد تسعيرة أخرى${restLabel} لنفس النطاق الجغرافي تابعة لـ "${getDeliveryOwnerLabelAr(row.delivery_owner)}" (${row.is_enabled ? 'مفعّلة' : 'معطّلة'}).`,
        conflictingTariff: row,
      });
    }

    // Hierarchical parent/child overlap warnings for active tariffs of the same owner & restaurant
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

export function detectBatchTariffConflicts(
  candidate: {
    service_type: CentralServiceType;
    delivery_owner: CentralDeliveryOwner;
    restaurant_id?: string | null;
    governorate_id: string;
    center_id: string;
    area_ids: string[];
    is_enabled: boolean;
  },
  existingTariffs: DeliveryAreaTariff[],
  lookups: GeoLookups
): {
  hasBlockingConflict: boolean;
  blockingDetails: TariffAreaConflictDetail[];
  warningDetails: TariffAreaConflictDetail[];
} {
  const uniqueAreaIds = Array.from(new Set(candidate.area_ids.map((id) => id.trim()).filter(Boolean)));
  const blockingDetails: TariffAreaConflictDetail[] = [];
  const warningDetails: TariffAreaConflictDetail[] = [];

  for (const areaId of uniqueAreaIds) {
    const areaName = lookups.areasById.get(areaId)?.name_ar || areaId;
    const areaRes = detectTariffConflicts(
      {
        service_type: candidate.service_type,
        delivery_owner: candidate.delivery_owner,
        restaurant_id: candidate.restaurant_id || null,
        scope_level: 'area',
        governorate_id: candidate.governorate_id,
        center_id: candidate.center_id,
        area_id: areaId,
        is_enabled: candidate.is_enabled,
      },
      existingTariffs
    );
    for (const c of areaRes.conflicts) {
      const detail: TariffAreaConflictDetail = {
        areaId,
        areaName,
        severity: c.severity,
        kind: c.kind,
        message: c.message,
        conflictingTariff: c.conflictingTariff,
      };
      if (c.severity === 'blocking') {
        blockingDetails.push(detail);
      } else {
        warningDetails.push(detail);
      }
    }
  }

  return {
    hasBlockingConflict: blockingDetails.length > 0,
    blockingDetails,
    warningDetails,
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
  lookups: GeoLookups
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

  if (query.service_type === 'ready_food' && !query.restaurant_id) {
    return {
      isServiced: false,
      unavailableReason: 'يجب اختيار المطعم المحدد لحساب التعريفة الفعالة لقسم الأكلات الجاهزة (ready_food).',
      matchedTariff: null,
      candidateTariffs: [],
      trace: [...trace, 'توقف: لم يتم تحديد restaurant_id لقسم ready_food.'],
    };
  }

  const targetRestId = query.service_type === 'ready_food' ? query.restaurant_id || null : null;

  const candidates = allTariffs.filter((t) => {
    if (t.service_type !== query.service_type) return false;
    if (t.delivery_owner !== query.delivery_owner) return false;
    if (query.service_type === 'ready_food') {
      if ((t.restaurant_id || null) !== targetRestId) return false;
    } else {
      if (t.restaurant_id) return false;
    }
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

  if (!input.area_id) {
    return {
      valid: false,
      error: 'يجب تحديد المنطقة الجغرافية (area_id من geo_areas) لربط تغطية المندوب وفق مخطط قاعدة البيانات.',
    };
  }

  const geoCheck = validateGeoHierarchySelection(
    {
      scope_level: 'area',
      governorate_id: input.governorate_id,
      center_id: input.center_id,
      area_id: input.area_id,
      requireActiveGeo: true,
      enforceLaunchScope: true,
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

  const normRest = null;

  const duplicate = existingCoverages.find((c) => {
    if (input.id && c.id === input.id) return false;
    if (c.pool !== input.pool) return false;
    if (c.driver_id !== input.driver_id) return false;
    if (input.pool === 'platform' && (c.service_type || null) !== input.service_type) return false;
    if ((c.area_id || null) !== geoCheck.normalized!.area_id) return false;
    return true;
  });

  if (duplicate) {
    return {
      valid: false,
      error: `تعارض تكرار: المندوب (${driver.full_name}) مرتبط بالفعل بنفس المنطقة الجغرافية ونفس الخدمة (${duplicate.is_active ? 'مفعّل' : 'معطّل'}).`,
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

    async getGeoAreasByCenter(
      centerId: string,
      governorateId?: string,
      onlyActive: boolean = true
    ): Promise<{ areas: GeoArea[]; error?: string }> {
      if (!client || !centerId) return { areas: [] };
      const res = await fetchAllRowsPaged<GeoArea>((from, to) => {
        let q = client
          .from('geo_areas')
          .select(GEO_AREA_COLUMNS)
          .eq('center_id', centerId)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('name_ar', { ascending: true });
        if (governorateId) q = q.eq('governorate_id', governorateId);
        if (onlyActive) q = q.eq('is_active', true);
        return q.range(from, to);
      });
      if (!res.success) {
        const formatted = formatCentralDbError({ code: res.errorCode, message: res.error }, 'geo_areas');
        return { areas: [], error: formatted.message };
      }
      return { areas: res.data };
    },

    async getGeoAreasByGovernorate(
      governorateId: string,
      onlyActive: boolean = true
    ): Promise<{ areas: GeoArea[]; error?: string }> {
      if (!client || !governorateId) return { areas: [] };
      const res = await fetchAllRowsPaged<GeoArea>((from, to) => {
        let q = client
          .from('geo_areas')
          .select(GEO_AREA_COLUMNS)
          .eq('governorate_id', governorateId)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('name_ar', { ascending: true });
        if (onlyActive) q = q.eq('is_active', true);
        return q.range(from, to);
      });
      if (!res.success) {
        const formatted = formatCentralDbError({ code: res.errorCode, message: res.error }, 'geo_areas');
        return { areas: [], error: formatted.message };
      }
      return { areas: res.data };
    },

    async getGeoBoundariesForGovernorate(governorateId: string): Promise<{
      governorate: GeoGovernorate | null;
      centers: GeoCenter[];
      areas: GeoArea[];
      error?: string;
    }> {
      if (!client || !governorateId) {
        return { governorate: null, centers: [], areas: [], error: 'معرف المحافظة غير محدد' };
      }
      const [govRes, centersRes, areasRes] = await Promise.all([
        client
          .from('geo_governorates')
          .select(
            'id, name_ar, name_en, code, is_active, latitude, longitude, centroid, boundary, boundary_source, boundary_updated_at'
          )
          .eq('id', governorateId)
          .maybeSingle(),
        fetchAllRowsPaged<GeoCenter>((from, to) =>
          client
            .from('geo_centers')
            .select(
              'id, governorate_id, name_ar, name_en, is_active, admin_unit_type, latitude, longitude, centroid, boundary, boundary_source, boundary_updated_at'
            )
            .eq('governorate_id', governorateId)
            .order('sort_order', { ascending: true, nullsFirst: false })
            .order('id', { ascending: true })
            .range(from, to)
        ),
        fetchAllRowsPaged<GeoArea>((from, to) =>
          client
            .from('geo_areas')
            .select(
              'id, governorate_id, center_id, name_ar, name_en, is_active, admin_unit_type, classification_status, latitude, longitude, centroid, boundary, boundary_source, boundary_updated_at'
            )
            .eq('governorate_id', governorateId)
            .order('sort_order', { ascending: true, nullsFirst: false })
            .order('id', { ascending: true })
            .range(from, to)
        ),
      ]);

      const errs = [
        govRes.error ? formatCentralDbError(govRes.error, 'geo_governorates').message : null,
        !centersRes.success
          ? formatCentralDbError({ code: centersRes.errorCode, message: centersRes.error }, 'geo_centers').message
          : null,
        !areasRes.success
          ? formatCentralDbError({ code: areasRes.errorCode, message: areasRes.error }, 'geo_areas').message
          : null,
      ].filter(Boolean);

      return {
        governorate: (govRes.data as GeoGovernorate) || null,
        centers: centersRes.success ? centersRes.data : [],
        areas: areasRes.success ? areasRes.data : [],
        error: errs.length > 0 ? errs.join(' | ') : undefined,
      };
    },

    async getDeliverySystemSettings(): Promise<{
      settings: DeliverySystemSettings | null;
      error?: string;
      errorCode?: string | null;
      constraintHint?: string | null;
    }> {
      if (!client) return { settings: null, error: 'Supabase غير متصل' };
      const { data, error } = await client
        .from('delivery_system_settings')
        .select(
          'id, gps_required_for_new_orders, geofence_enforcement_enabled, driver_tracking_enabled, max_accepted_gps_accuracy_m, updated_by, updated_at'
        )
        .limit(1)
        .maybeSingle();

      if (error) {
        const formatted = formatCentralDbError(error, 'delivery_system_settings');
        let diagnosticHint = formatted.constraintHint || '';
        if (formatted.code === '42501') {
          try {
            const sessionRes = await client.auth?.getSession?.();
            const hasSession = Boolean(sessionRes?.data?.session?.user);
            diagnosticHint = hasSession
              ? `${diagnosticHint} الجلسة الحالية مصادق عليها (authenticated)، ما يعني أن المنع ناتج عن سياسات RLS أو صلاحيات GRANT SELECT لجدول delivery_system_settings في Supabase.`
              : `${diagnosticHint} لا توجد جلسة مشرف مصادق عليها (الجلسة الحالية anon)، كما قد يمنع RLS/GRANT القراءة حتى مع وجود سياسة ناقصة.`;
          } catch {
            // Keep base formatted hint if auth context cannot be inspected
          }
        }
        return {
          settings: null,
          error: formatted.message,
          errorCode: formatted.code,
          constraintHint: diagnosticHint || formatted.constraintHint,
        };
      }

      if (!data) {
        return {
          settings: null,
          error: 'لا يوجد سجل إعدادات في جدول delivery_system_settings حالياً.',
        };
      }

      return {
        settings: {
          id: data.id,
          gps_required_for_new_orders:
            data.gps_required_for_new_orders === null || data.gps_required_for_new_orders === undefined
              ? null
              : Boolean(data.gps_required_for_new_orders),
          geofence_enforcement_enabled:
            data.geofence_enforcement_enabled === null || data.geofence_enforcement_enabled === undefined
              ? null
              : Boolean(data.geofence_enforcement_enabled),
          driver_tracking_enabled:
            data.driver_tracking_enabled === null || data.driver_tracking_enabled === undefined
              ? null
              : Boolean(data.driver_tracking_enabled),
          max_accepted_gps_accuracy_m:
            data.max_accepted_gps_accuracy_m === null || data.max_accepted_gps_accuracy_m === undefined
              ? null
              : Number(data.max_accepted_gps_accuracy_m),
          updated_by: data.updated_by || null,
          updated_at: data.updated_at || null,
        },
      };
    },

    async getAppSectionSettings(): Promise<{
      settings: AppSectionSetting[];
      error?: string;
      errorCode?: string | null;
      constraintHint?: string | null;
    }> {
      if (!client) return { settings: [], error: 'Supabase غير متصل' };
      const { data, error } = await client
        .from('app_section_settings')
        .select(APP_SECTION_SETTINGS_COLUMNS)
        .order('section_key', { ascending: true });

      if (error) {
        const formatted = formatCentralDbError(error, 'app_section_settings');
        return {
          settings: [],
          error: formatted.message,
          errorCode: formatted.code,
          constraintHint: formatted.constraintHint,
        };
      }

      const validRows = (data || [])
        .filter((row: any) => ALLOWED_CENTRAL_SERVICE_TYPES.includes(row?.section_key))
        .map(normalizeAppSectionSettingRow);

      return { settings: validRows };
    },

    async getAppSectionSettingByKey(sectionKey: AppSectionKey): Promise<{
      setting: AppSectionSetting | null;
      error?: string;
      errorCode?: string | null;
      constraintHint?: string | null;
    }> {
      if (!client) return { setting: null, error: 'Supabase غير متصل' };
      if (!ALLOWED_CENTRAL_SERVICE_TYPES.includes(sectionKey)) {
        return { setting: null, error: `مفتاح القسم (${sectionKey}) غير معتمد.` };
      }

      const { data, error } = await client
        .from('app_section_settings')
        .select(APP_SECTION_SETTINGS_COLUMNS)
        .eq('section_key', sectionKey)
        .maybeSingle();

      if (error) {
        const formatted = formatCentralDbError(error, 'app_section_settings');
        return {
          setting: null,
          error: formatted.message,
          errorCode: formatted.code,
          constraintHint: formatted.constraintHint,
        };
      }

      if (!data) {
        return {
          setting: null,
          error: `لم يتم العثور على سجل إعدادات للقسم (${sectionKey}) في جدول app_section_settings.`,
        };
      }

      return { setting: normalizeAppSectionSettingRow(data) };
    },

    async updateAppSectionSetting(
      sectionKey: AppSectionKey,
      updates: AppSectionSettingUpdateInput,
      callerUserId?: string | null
    ): Promise<CentralMutationResult<AppSectionSetting>> {
      if (!client) return { success: false, error: 'Supabase غير متصل' };

      const validation = validateAppSectionSettingUpdate(sectionKey, updates);
      if (!validation.valid || !validation.payload) {
        return { success: false, error: validation.error || 'بيانات تحديث القسم غير صالحة.' };
      }

      let resolvedUserId = callerUserId || null;
      if (!resolvedUserId && client.auth?.getUser) {
        try {
          const authRes = await client.auth.getUser();
          resolvedUserId = authRes?.data?.user?.id || null;
        } catch {
          // Leave null if client does not expose auth.getUser
        }
      }

      const nowIso = new Date().toISOString();
      const dbPayload: Record<string, any> = {
        ...validation.payload,
        updated_at: nowIso,
        ...(resolvedUserId ? { updated_by: resolvedUserId } : {}),
      };

      const { data: updatedRows, error } = await client
        .from('app_section_settings')
        .update(dbPayload)
        .eq('section_key', sectionKey)
        .select(APP_SECTION_SETTINGS_COLUMNS);

      if (error) {
        const formatted = formatCentralDbError(error, 'app_section_settings');
        return {
          success: false,
          verifiedFromDb: false,
          error: formatted.message,
          errorCode: formatted.code,
          constraintHint: formatted.constraintHint,
        };
      }

      if (!updatedRows || updatedRows.length === 0) {
        return {
          success: false,
          verifiedFromDb: false,
          error: `لم يتم تحديث أي سجل في جدول app_section_settings للقسم (${sectionKey}). تحقق من وجود السجل وصلاحيات UPDATE للمشرف في سياسات RLS.`,
        };
      }

      // Mandatory Read-After-Write Verification
      const { data: verifiedRow, error: verifyErr } = await client
        .from('app_section_settings')
        .select(APP_SECTION_SETTINGS_COLUMNS)
        .eq('section_key', sectionKey)
        .maybeSingle();

      if (verifyErr || !verifiedRow) {
        const formattedVerify = verifyErr
          ? formatCentralDbError(verifyErr, 'app_section_settings')
          : null;
        return {
          success: false,
          verifiedFromDb: false,
          error: `تم إرسال التحديث لكن تعذر تأكيد القيم عند إعادة القراءة من app_section_settings${formattedVerify ? `: ${formattedVerify.message}` : ''}.`,
          errorCode: formattedVerify?.code || null,
          constraintHint: formattedVerify?.constraintHint || null,
        };
      }

      const normalized = normalizeAppSectionSettingRow(verifiedRow);

      // Assert every requested column persisted truthfully
      const mismatches: string[] = [];
      if (
        validation.payload.section_enabled !== undefined &&
        normalized.section_enabled !== validation.payload.section_enabled
      ) {
        mismatches.push('section_enabled');
      }
      if (
        validation.payload.section_visible !== undefined &&
        normalized.section_visible !== validation.payload.section_visible
      ) {
        mismatches.push('section_visible');
      }
      if (
        validation.payload.delivery_enabled !== undefined &&
        normalized.delivery_enabled !== validation.payload.delivery_enabled
      ) {
        mismatches.push('delivery_enabled');
      }
      if (
        validation.payload.disabled_display_mode !== undefined &&
        normalized.disabled_display_mode !== validation.payload.disabled_display_mode
      ) {
        mismatches.push('disabled_display_mode');
      }
      if (
        validation.payload.display_width !== undefined &&
        normalized.display_width !== validation.payload.display_width
      ) {
        mismatches.push('display_width');
      }

      if (mismatches.length > 0) {
        return {
          success: false,
          verifiedFromDb: false,
          error: `القيم المعاد قراءتها من app_section_settings لم تطابق التعديلات المطلوبة في الحقول: ${mismatches.join('، ')}.`,
        };
      }

      await auditLogger('central_section_settings.update', 'app_section_settings', sectionKey, dbPayload);

      return {
        success: true,
        verifiedFromDb: true,
        data: normalized,
      };
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
      // Strictly omit DB-generated columns (driver_net_fee, customer_delivery_fee) from INSERT/UPDATE payload
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

      // Mandatory Read-After-Write Verification (reads PostgreSQL-computed driver_net_fee & customer_delivery_fee)
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

    async saveDeliveryAreaTariffsBatch(
      input: DeliveryAreaTariffBatchInput,
      existingTariffs: DeliveryAreaTariff[],
      lookups: GeoLookups,
      restaurantsById?: Map<string, CentralRestaurantSummary>
    ): Promise<CentralMutationResult<DeliveryAreaTariff[]> & { areaConflicts?: TariffAreaConflictDetail[] }> {
      if (!client) return { success: false, error: 'Supabase غير متصل' };

      const uniqueAreaIds = Array.from(
        new Set((input.area_ids || []).map((id) => (id || '').trim()).filter(Boolean))
      );
      if (uniqueAreaIds.length === 0) {
        return { success: false, error: 'يجب اختيار منطقة واحدة على الأقل لإضافة التسعيرة.' };
      }

      // 1) Validate pricing & base hierarchy fields via first area
      const baseValidation = validateTariffInput(
        {
          service_type: input.service_type,
          delivery_owner: input.delivery_owner,
          restaurant_id: input.restaurant_id,
          scope_level: 'area',
          governorate_id: input.governorate_id,
          center_id: input.center_id,
          area_id: uniqueAreaIds[0],
          base_delivery_fee: input.base_delivery_fee,
          admin_commission: input.admin_commission,
          is_free_delivery: input.is_free_delivery,
          free_delivery_cost_bearer: input.free_delivery_cost_bearer,
          estimated_delivery_minutes: input.estimated_delivery_minutes,
          is_enabled: input.is_enabled,
          notes: input.notes,
        },
        lookups,
        restaurantsById
      );
      if (!baseValidation.valid || !baseValidation.payload) {
        return { success: false, error: baseValidation.error || 'بيانات التسعيرة غير مكتملة أو غير صالحة.' };
      }

      // 2) Verify EVERY selected area belongs to center + governorate, Sohag launch scope, and is_active = true
      //    (strictly enforced regardless of whether is_enabled is true or false)
      for (const areaId of uniqueAreaIds) {
        const areaGeoCheck = validateGeoHierarchySelection(
          {
            scope_level: 'area',
            governorate_id: input.governorate_id,
            center_id: input.center_id,
            area_id: areaId,
            requireActiveGeo: true,
            enforceLaunchScope: true,
          },
          lookups
        );
        if (!areaGeoCheck.valid) {
          return {
            success: false,
            error: areaGeoCheck.error || `بيانات المنطقة (${areaId}) غير صالحة.`,
          };
        }
      }

      // 3) Check duplicate/conflict across ALL selected areas BEFORE attempting DB write
      const batchConflicts = detectBatchTariffConflicts(
        {
          service_type: baseValidation.payload.service_type,
          delivery_owner: baseValidation.payload.delivery_owner,
          restaurant_id: baseValidation.payload.restaurant_id,
          governorate_id: baseValidation.payload.governorate_id,
          center_id: baseValidation.payload.center_id || input.center_id,
          area_ids: uniqueAreaIds,
          is_enabled: baseValidation.payload.is_enabled,
        },
        existingTariffs,
        lookups
      );

      if (batchConflicts.hasBlockingConflict) {
        const summaryLines = batchConflicts.blockingDetails.map(
          (d) => `• ${d.areaName}: ${d.message}`
        );
        return {
          success: false,
          areaConflicts: batchConflicts.blockingDetails,
          error: `تعذر حفظ الدفعة لوجود تسعيرة مطابقة بالفعل للمناطق التالية:\n${summaryLines.join('\n')}`,
        };
      }

      // 4) Single-statement atomic batch INSERT (omits driver_net_fee & customer_delivery_fee)
      const nowIso = new Date().toISOString();
      const baseWritableRow = {
        service_type: baseValidation.payload.service_type,
        delivery_owner: baseValidation.payload.delivery_owner,
        restaurant_id: baseValidation.payload.restaurant_id,
        scope_level: 'area' as const,
        governorate_id: baseValidation.payload.governorate_id,
        center_id: baseValidation.payload.center_id,
        base_delivery_fee: baseValidation.payload.base_delivery_fee,
        admin_commission: baseValidation.payload.admin_commission,
        is_free_delivery: baseValidation.payload.is_free_delivery,
        free_delivery_cost_bearer: baseValidation.payload.free_delivery_cost_bearer,
        estimated_delivery_minutes: baseValidation.payload.estimated_delivery_minutes,
        is_enabled: baseValidation.payload.is_enabled,
        notes: baseValidation.payload.notes,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const rowsToInsert = uniqueAreaIds.map((areaId) => ({
        ...baseWritableRow,
        area_id: areaId,
      }));

      const { data: insertedRows, error } = await client
        .from('delivery_area_tariffs')
        .insert(rowsToInsert)
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

      if (!insertedRows || insertedRows.length !== rowsToInsert.length) {
        return {
          success: false,
          verifiedFromDb: false,
          error: `لم يكتمل إدراج جميع المناطق المطلوبة (${insertedRows?.length || 0} من ${rowsToInsert.length}) في delivery_area_tariffs.`,
        };
      }

      // 5) Mandatory Read-After-Write Verification of all inserted records
      const insertedIds = insertedRows.map((r: any) => r.id).filter(Boolean);
      const { data: verifiedRows, error: verifyErr } = await client
        .from('delivery_area_tariffs')
        .select(TARIFF_COLUMNS)
        .in('id', insertedIds);

      if (verifyErr || !verifiedRows || verifiedRows.length !== rowsToInsert.length) {
        return {
          success: false,
          verifiedFromDb: false,
          error: `تعذر تأكيد حفظ جميع سجلات التسعيرة عند إعادة القراءة من قاعدة البيانات (${verifiedRows?.length || 0}/${rowsToInsert.length})${verifyErr ? `: ${verifyErr.message}` : ''}.`,
        };
      }

      const verifiedAreaSet = new Set(verifiedRows.map((r: any) => r.area_id));
      const missingAreaIds = uniqueAreaIds.filter((aid) => !verifiedAreaSet.has(aid));
      if (missingAreaIds.length > 0) {
        return {
          success: false,
          verifiedFromDb: false,
          error: `بعض المناطق المختارة لم تظهر عند إعادة القراءة من قاعدة البيانات (${missingAreaIds.join(', ')}).`,
        };
      }

      await auditLogger(
        uniqueAreaIds.length > 1 ? 'central_tariff.batch_create' : 'central_tariff.create',
        'delivery_area_tariffs',
        insertedIds[0],
        {
          ...baseWritableRow,
          area_ids: uniqueAreaIds,
          inserted_count: verifiedRows.length,
        }
      );

      return {
        success: true,
        verifiedFromDb: true,
        data: verifiedRows as DeliveryAreaTariff[],
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
            enforceLaunchScope: true,
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
            .select(PLATFORM_COVERAGE_COLUMNS)
            .order('id', { ascending: true })
            .range(from, to)
        ),
        fetchAllRowsPaged<any>((from, to) =>
          client
            .from('restaurant_driver_area_coverage')
            .select(RESTAURANT_COVERAGE_COLUMNS)
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
          const area = r.area_id ? lookups?.areasById.get(r.area_id) || extraAreaMap.get(r.area_id) : undefined;
          const derivedGovId = r.governorate_id || area?.governorate_id || '';
          const derivedCenterId = r.center_id || area?.center_id || null;
          const gov = derivedGovId ? lookups?.governoratesById.get(derivedGovId) : undefined;
          const center = derivedCenterId ? lookups?.centersById.get(derivedCenterId) : undefined;
          const rest = r.restaurant_id ? restaurantsById?.get(r.restaurant_id) : undefined;
          const scope_level: CentralScopeLevel = r.area_id ? 'area' : derivedCenterId ? 'center' : 'governorate';

          return {
            id: r.id,
            pool,
            driver_id: r.driver_id,
            restaurant_id: r.restaurant_id || null,
            service_type: r.service_type || (pool === 'restaurant' ? 'ready_food' : null),
            governorate_id: derivedGovId,
            center_id: derivedCenterId,
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
            governorate_name_ar: gov?.name_ar || derivedGovId || '—',
            center_name_ar: center?.name_ar || (derivedCenterId ? derivedCenterId : '—'),
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

      const isPlatformPool = validation.normalized.pool === 'platform';
      const tableName = isPlatformPool
        ? 'delivery_driver_area_coverage'
        : 'restaurant_driver_area_coverage';

      const nowIso = new Date().toISOString();
      let targetId = input.id;
      const selectCols = isPlatformPool ? PLATFORM_COVERAGE_COLUMNS : RESTAURANT_COVERAGE_COLUMNS;
      // Strictly write only columns verified to exist in Talabat Al-Bayt DEV
      const dbRow: Record<string, any> = isPlatformPool
        ? {
            driver_id: validation.normalized.driver_id,
            service_type: validation.normalized.service_type,
            area_id: validation.normalized.area_id,
            is_active: validation.normalized.is_active,
            updated_at: nowIso,
            ...(validation.normalized.priority !== null
              ? { priority: validation.normalized.priority }
              : targetId
              ? { priority: null }
              : {}),
          }
        : {
            driver_id: validation.normalized.driver_id,
            area_id: validation.normalized.area_id,
            is_active: validation.normalized.is_active,
          };

      if (targetId) {
        const { data: updatedRows, error } = await client
          .from(tableName)
          .update(dbRow)
          .eq('id', targetId)
          .select(selectCols);

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
          .select(selectCols);

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
        .select(selectCols)
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
          governorate_id: validation.normalized.governorate_id,
          center_id: validation.normalized.center_id,
          pool: validation.normalized.pool,
          scope_level: verified.area_id ? 'area' : 'governorate',
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

      const areaObj = coverage.area_id ? lookups.areasById.get(coverage.area_id) : undefined;
      const effectiveGovId = coverage.governorate_id || areaObj?.governorate_id || '';
      const effectiveCenterId = coverage.center_id || areaObj?.center_id || null;

      if (nextIsActive) {
        if (!isDriverEligibleForOperations(driver)) {
          return {
            success: false,
            error: 'لا يمكن تفعيل تغطية لمندوب غير معتمد أو معطل إدارياً.',
          };
        }
        const geoCheck = validateGeoHierarchySelection(
          {
            scope_level: coverage.area_id ? 'area' : effectiveCenterId ? 'center' : 'governorate',
            governorate_id: effectiveGovId,
            center_id: effectiveCenterId,
            area_id: coverage.area_id,
            requireActiveGeo: true,
            enforceLaunchScope: true,
          },
          lookups
        );
        if (!geoCheck.valid) {
          return { success: false, error: geoCheck.error || 'النطاق الجغرافي غير مفعل.' };
        }
      }

      const tableName =
        pool === 'platform' ? 'delivery_driver_area_coverage' : 'restaurant_driver_area_coverage';
      const selectCols =
        pool === 'platform' ? PLATFORM_COVERAGE_COLUMNS : RESTAURANT_COVERAGE_COLUMNS;

      const updatePayload: Record<string, any> =
        pool === 'platform'
          ? { is_active: Boolean(nextIsActive), updated_at: new Date().toISOString() }
          : { is_active: Boolean(nextIsActive) };

      const { data: updatedRows, error } = await client
        .from(tableName)
        .update(updatePayload)
        .eq('id', coverage.id)
        .select(selectCols);

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
        .select(selectCols)
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
          governorate_id: effectiveGovId,
          center_id: effectiveCenterId,
          scope_level: verified.area_id ? 'area' : effectiveCenterId ? 'center' : 'governorate',
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
