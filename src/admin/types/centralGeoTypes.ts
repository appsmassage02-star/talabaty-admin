/**
 * Central Geographic, Service Sections, Delivery Pricing & Driver Coverage Types
 * Target Database: Talabat Al-Bayt DEV (itbfqpjwgjvvybffunkm)
 * Strictly isolated from legacy food_* and delivery_governorate_settings tables.
 */

export type CentralServiceType = 'household_shortages' | 'pharmacy' | 'ready_food';

export type CentralDeliveryOwner = 'platform' | 'restaurant';

export type CentralScopeLevel = 'governorate' | 'center' | 'area';

export type CentralFreeDeliveryCostBearer = 'platform' | 'restaurant';

export type CentralDriverCoveragePool = 'platform' | 'restaurant';

export interface CentralServiceDefinition {
  type: CentralServiceType;
  labelAr: string;
  shortLabelAr: string;
  descriptionAr: string;
  supportsRestaurantOwner: boolean;
}

export interface GeoJsonGeometry {
  type: 'Polygon' | 'MultiPolygon' | string;
  coordinates: any;
  crs?: any;
}

export interface GeoGovernorate {
  id: string;
  country_name?: string | null;
  name_ar: string;
  name_en?: string | null;
  code?: string | null;
  is_active: boolean;
  sort_order?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  centroid?: any | null;
  boundary?: GeoJsonGeometry | null;
  boundary_source?: string | null;
  boundary_updated_at?: string | null;
  source_code?: string | null;
  source_system?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GeoCenter {
  id: string;
  governorate_id: string;
  name_ar: string;
  name_en?: string | null;
  is_active: boolean;
  sort_order?: number | null;
  source_code?: string | null;
  admin_unit_type?: string | null;
  classification_status?: string | null;
  source_system?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  centroid?: any | null;
  boundary?: GeoJsonGeometry | null;
  boundary_source?: string | null;
  boundary_updated_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GeoArea {
  id: string;
  governorate_id: string;
  center_id: string;
  name_ar: string;
  name_en?: string | null;
  is_active: boolean;
  sort_order?: number | null;
  admin_unit_type?: string | null;
  classification_status?: string | null;
  source_system?: string | null;
  source_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  centroid?: any | null;
  boundary?: GeoJsonGeometry | null;
  boundary_source?: string | null;
  boundary_updated_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DeliverySystemSettings {
  id: string;
  gps_required_for_new_orders: boolean | null;
  geofence_enforcement_enabled: boolean | null;
  driver_tracking_enabled: boolean | null;
  max_accepted_gps_accuracy_m: number | null;
  updated_by?: string | null;
  updated_at?: string | null;
}

export interface GeoCenterAreaCount {
  center_id: string;
  governorate_id: string;
  total_areas: number;
  active_areas: number;
  inactive_areas: number;
}

export interface GeoGovernorateAreaCount {
  governorate_id: string;
  total_centers: number;
  active_centers: number;
  inactive_centers: number;
  total_areas: number;
  active_areas: number;
  inactive_areas: number;
}

export interface CentralRestaurantSummary {
  id: string;
  name: string;
  is_active: boolean;
  is_open?: boolean;
  governorate_id?: string | null;
  center_id?: string | null;
  area_id?: string | null;
}

export interface DeliveryAreaTariff {
  id: string;
  service_type: CentralServiceType;
  delivery_owner: CentralDeliveryOwner;
  restaurant_id?: string | null;
  scope_level: CentralScopeLevel;
  governorate_id: string;
  center_id?: string | null;
  area_id?: string | null;
  base_delivery_fee: number;
  admin_commission: number;
  driver_net_fee: number;
  customer_delivery_fee: number;
  is_free_delivery: boolean;
  free_delivery_cost_bearer?: CentralFreeDeliveryCostBearer | null;
  estimated_delivery_minutes?: number | null;
  is_enabled: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  // Enriched UI display helpers (derived exclusively from geo_* & restaurants)
  governorate_name_ar?: string | null;
  center_name_ar?: string | null;
  area_name_ar?: string | null;
  restaurant_name?: string | null;
  geo_is_active?: boolean;
}

export interface DeliveryAreaTariffInput {
  id?: string;
  service_type: CentralServiceType;
  delivery_owner: CentralDeliveryOwner;
  restaurant_id?: string | null;
  scope_level: CentralScopeLevel;
  governorate_id: string;
  center_id?: string | null;
  area_id?: string | null;
  base_delivery_fee: number | string;
  admin_commission: number | string;
  is_free_delivery: boolean;
  free_delivery_cost_bearer?: CentralFreeDeliveryCostBearer | null;
  estimated_delivery_minutes?: number | string | null;
  is_enabled: boolean;
  notes?: string | null;
}

export interface DeliveryAreaTariffBatchInput {
  service_type: CentralServiceType;
  delivery_owner: CentralDeliveryOwner;
  restaurant_id?: string | null;
  scope_level: 'area';
  governorate_id: string;
  center_id: string;
  area_ids: string[];
  base_delivery_fee: number | string;
  admin_commission: number | string;
  is_free_delivery: boolean;
  free_delivery_cost_bearer?: CentralFreeDeliveryCostBearer | null;
  estimated_delivery_minutes?: number | string | null;
  is_enabled: boolean;
  notes?: string | null;
}

export interface TariffAreaConflictDetail {
  areaId: string;
  areaName: string;
  severity: 'blocking' | 'warning';
  kind: TariffConflictWarning['kind'];
  message: string;
  conflictingTariff: DeliveryAreaTariff;
}

export interface TariffConflictWarning {
  kind: 'exact_duplicate' | 'parent_scope_exists' | 'child_scope_exists' | 'cross_owner_exists';
  severity: 'blocking' | 'warning';
  message: string;
  conflictingTariff: DeliveryAreaTariff;
}

export interface TariffConflictCheckResult {
  hasBlockingConflict: boolean;
  conflicts: TariffConflictWarning[];
}

export interface EffectiveTariffResolution {
  isServiced: boolean;
  unavailableReason?: string | null;
  matchedTariff: DeliveryAreaTariff | null;
  matchedScopeLevel?: CentralScopeLevel | null;
  candidateTariffs: DeliveryAreaTariff[];
  trace: string[];
}

export interface CentralDriverAreaCoverage {
  id: string;
  pool: CentralDriverCoveragePool;
  driver_id: string;
  restaurant_id?: string | null;
  service_type?: CentralServiceType | string | null;
  governorate_id: string;
  center_id?: string | null;
  area_id?: string | null;
  scope_level?: CentralScopeLevel;
  is_active: boolean;
  priority?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  // Enriched helpers
  driver_name?: string | null;
  driver_phone?: string | null;
  driver_status?: string | null;
  driver_is_active?: boolean | null;
  driver_is_available_for_work?: boolean | null;
  driver_is_eligible?: boolean;
  restaurant_name?: string | null;
  governorate_name_ar?: string | null;
  center_name_ar?: string | null;
  area_name_ar?: string | null;
}

export interface DriverCoverageMutationInput {
  id?: string;
  pool: CentralDriverCoveragePool;
  driver_id: string;
  restaurant_id?: string | null;
  service_type: CentralServiceType;
  scope_level: CentralScopeLevel;
  governorate_id: string;
  center_id?: string | null;
  area_id?: string | null;
  is_active: boolean;
  priority?: number | string | null;
  notes?: string | null;
}

export interface CentralSectionServiceAreaRecord {
  id: string;
  governorate_id?: string | null;
  center_id?: string | null;
  area_id?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  scope_level: CentralScopeLevel;
  governorate_name_ar?: string | null;
  center_name_ar?: string | null;
  area_name_ar?: string | null;
}

export interface ServiceSectionDiscrepancy {
  id: string;
  service_type: CentralServiceType;
  scope_level: CentralScopeLevel;
  governorate_id?: string | null;
  center_id?: string | null;
  area_id?: string | null;
  location_label: string;
  issue: string;
}

export interface ServiceSectionSummary {
  definition: CentralServiceDefinition;
  totalTariffsCount: number;
  enabledTariffsCount: number;
  disabledTariffsCount: number;
  freeDeliveryCount: number;
  coveredGovernorateIds: string[];
  coveredCenterIds: string[];
  coveredAreaIds: string[];
  platformTariffsCount: number;
  restaurantTariffsCount: number;
  discrepancies: ServiceSectionDiscrepancy[];
}

export interface CentralMutationResult<T = any> {
  success: boolean;
  data?: T;
  verifiedFromDb?: boolean;
  error?: string;
  errorCode?: string | null;
  constraintHint?: string | null;
}
