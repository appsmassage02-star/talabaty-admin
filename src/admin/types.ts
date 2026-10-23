/**
 * Types & Interfaces for Talabat Al-Bayt Super Admin Control Center
 */

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'CONTENT_MANAGER' | 'READ_ONLY';

export type UserAccountStatus = 'active' | 'blocked' | 'incomplete' | 'unlinked' | 'admin' | 'user';

export type AdminPermission =
  | 'dashboard.view'
  | 'users.view'
  | 'users.block'
  | 'users.unblock'
  | 'users.delete'
  | 'users.edit'
  | 'delivery.view'
  | 'delivery.manage'
  | 'categories.view'
  | 'categories.create'
  | 'categories.edit'
  | 'categories.update'
  | 'categories.delete'
  | 'products.view'
  | 'products.create'
  | 'products.edit'
  | 'products.update'
  | 'products.delete'
  | 'notifications.send'
  | 'analytics.view'
  | 'households.view'
  | 'invoices.view'
  | 'settings.manage'
  | 'admins.manage'
  | 'admins.delete'
  | 'audit.view'
  | 'restaurants.view'
  | 'restaurants.manage';

export * from './types/restaurantAdminTypes';

export interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  full_name?: string;
  role: AdminRole;
  custom_permissions?: AdminPermission[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface AdminUserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  household_id?: string | null;
  household_name?: string;
  role: 'admin' | 'home' | 'guest';
  is_blocked?: boolean;
  blocked_reason?: string;
  blocked_at?: string;
  blocked_by?: string;
  status: UserAccountStatus;
  missing_items_count?: number;
  invoices_count?: number;
  household_members_count?: number;
  created_at: string;
  updated_at: string;
  last_sign_in_at?: string;
}

export interface AdminHousehold {
  id: string;
  name: string;
  admin_id: string;
  admin_name: string;
  admin_phone: string;
  pair_code?: string;
  created_at: string;
  updated_at: string;
  members_count: number;
  missing_items_count: number;
  invoices_count: number;
  total_spent: number;
  members?: Array<{
    id: string;
    user_id: string;
    role: string;
    user_name: string;
    user_phone?: string;
    joined_at: string;
  }>;
}

export interface GlobalCategorySubcategory {
  id: string;
  nameAr: string;
  nameEn?: string;
  name_ar?: string;
  name_en?: string;
  items?: string[];
}

export interface GlobalCategory {
  id: string;
  name_ar: string;
  name_en: string;
  description?: string | null;
  icon_name?: string | null;
  image_url: string;
  color?: string | null;
  bg_light?: string | null;
  badge_color?: string | null;
  subcategories?: GlobalCategorySubcategory[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Computed / UI compatibility fields
  common_items?: string[];
  products_count?: number;
  linked_households_count?: number;
}

export interface GlobalProduct {
  id: string;
  global_category_id: string;
  subcategory_id?: string | null;
  name_ar: string;
  name_en?: string | null;
  image_url?: string | null;
  default_unit: string;
  default_quantity: string;
  estimated_price?: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Computed / UI compatibility fields
  category_id?: string;
  category_name_ar?: string;
  subcategory_name_ar?: string;
  unit?: string;
  description?: string;
  aliases?: string[];
  is_featured?: boolean;
}

export interface AdminAuditLog {
  id: string;
  admin_user_id?: string;
  admin_email: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface AdminNotificationView {
  id: string;
  notification_id: string;
  user_id?: string | null;
  household_id?: string | null;
  dismissed_at?: string | null;
  created_at: string;
  // Enriched fields from profiles / households
  user_name?: string;
  user_email?: string;
  household_name?: string;
}

export interface AdminNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  icon_name?: string | null;
  image_url?: string | null;
  action_type?: string | null;
  action_route?: string | null;
  is_active: boolean;
  start_at?: string | null;
  end_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  // Computed stats from admin_notification_views
  views_count?: number;
  dismissed_count?: number;
  unique_users_count?: number;
  unique_households_count?: number;
}

export interface AppAnnouncement {
  id: string;
  title: string;
  message: string;
  body?: string;
  type: string;
  icon_name?: string | null;
  image_url?: string | null;
  action_type?: string | null;
  action_route?: string | null;
  target_type?: string;
  target_id?: string;
  target_role?: string;
  is_active: boolean;
  start_at?: string | null;
  end_at?: string | null;
  expires_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
  views_count?: number;
  dismissed_count?: number;
}

export interface SystemSetting {
  key: string;
  value: any;
  description?: string;
  updated_by?: string;
  updated_at: string;
}

export interface AdminSectionFilter {
  statusTab?: string;
  status?: string;
  driverId?: string;
  approvalFilter?: string;
  activeFilter?: string;
  search?: string;
  timestamp?: number;
}

export interface OperationalAssignedOrderSummary {
  id: string;
  order_number: string;
  source: 'delivery' | 'pharmacy';
  customer_name: string;
  governorate_name?: string | null;
  status: string;
  driver_id: string;
  driver_name: string;
  driver_phone?: string | null;
  total_amount?: number | null;
  updated_at: string;
}

export interface OperationalPendingOrderSummary {
  id: string;
  order_number: string;
  source: 'delivery' | 'pharmacy';
  customer_name: string;
  governorate_name?: string | null;
  status: string;
  total_amount?: number | null;
  created_at: string;
}

export interface OperationalCancellationSummary {
  id: string;
  order_number: string;
  source: 'delivery' | 'pharmacy';
  customer_name: string;
  driver_name?: string | null;
  reason?: string | null;
  requested_at?: string | null;
}

export interface OperationalDriverApplicationSummary {
  id: string;
  full_name: string;
  phone: string;
  governorate_name?: string | null;
  vehicle_type?: string | null;
  status?: string | null;
  is_active: boolean;
  docs_count: number;
  created_at: string;
}

export interface OperationalDisabledAccountSummary {
  id: string;
  name: string;
  contact: string;
  account_type: 'user' | 'driver';
  reason?: string | null;
  updated_at?: string | null;
}

export interface OperationalCommandCenterData {
  pendingReviewOrders: OperationalPendingOrderSummary[];
  cancellationRequests: OperationalCancellationSummary[];
  assignedOrdersWithDrivers: OperationalAssignedOrderSummary[];
  recentCompletedOrders: OperationalAssignedOrderSummary[];
  pendingDrivers: OperationalDriverApplicationSummary[];
  disabledAccounts: OperationalDisabledAccountSummary[];
  recentNotifications: AdminBroadcastNotification[];
  counts: {
    delivery_pending_review: number;
    pharmacy_pending_review: number;
    delivery_cancellation_pending: number;
    pharmacy_cancellation_pending: number;
    delivery_assigned_active: number;
    pharmacy_assigned_active: number;
    delivery_completed: number;
    pharmacy_completed: number;
    drivers_pending_approval: number;
    drivers_inactive: number;
    users_blocked: number;
    notifications_active: number;
    notifications_total: number;
  };
  fetchedAt: string;
}

export interface AdminOverviewStats {
  total_users: number;
  active_users: number;
  new_users: number;
  blocked_users: number;
  total_households: number;
  total_missing_items: number;
  total_invoices: number;
  total_purchases_sum: number;
  total_categories: number;
  total_products: number;
  total_notifications: number;
  generated_at: string;
  // Extended live metrics for modular Dashboard sections
  delivery_total_orders?: number;
  delivery_active_orders?: number;
  delivery_pending_review_orders?: number;
  delivery_assigned_orders?: number;
  delivery_cancellation_orders?: number;
  delivery_completed_orders?: number;
  delivery_cancelled_orders?: number;
  delivery_total_drivers?: number;
  delivery_active_drivers?: number;
  delivery_inactive_drivers?: number;
  delivery_pending_drivers?: number;
  delivery_total_customers?: number;
  total_admins?: number;
  archived_invoices_count?: number;
  pharmacy_total_orders?: number;
  pharmacy_pending_orders?: number;
  pharmacy_active_orders?: number;
  pharmacy_assigned_orders?: number;
  pharmacy_cancellation_orders?: number;
  pharmacy_completed_orders?: number;
  pharmacy_total_pharmacies?: number;
  pharmacy_active_areas?: number;
  active_notifications_count?: number;
}

export interface AdminInvoiceRecord {
  id: string;
  invoice_number?: string | number | null;
  household_id?: string | null;
  household_name?: string;
  category?: string | null;
  store_name?: string | null;
  total_price: number;
  products?: Array<{
    id?: string;
    name?: string;
    price?: number;
    quantity?: string | number;
  }>;
  date?: string | null;
  created_at: string;
  is_archived?: boolean;
}

export interface AdminMissingItemRecord {
  id: string;
  household_id?: string | null;
  household_name?: string;
  name: string;
  category?: string | null;
  quantity?: string | number | null;
  completed?: boolean;
  added_at: string;
}

export type AdminDateFilter =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'custom';

export type AdminNavSection =
  | 'overview'
  | 'delivery_drivers'
  | 'delivery_orders'
  | 'delivery_customers'
  | 'delivery_settings'
  | 'pharmacy_orders'
  | 'pharmacy_prescriptions'
  | 'pharmacy_pharmacies'
  | 'pharmacy_settings'
  | 'users'
  | 'households'
  | 'team'
  | 'categories'
  | 'products'
  | 'invoices_overview'
  | 'invoices_purchases'
  | 'invoices_missing_items'
  | 'invoices_archive'
  | 'analytics'
  | 'audit_logs'
  | 'notifications'
  | 'notifications_broadcast'
  | 'app_assets'
  | 'settings'
  | 'settings_rls';

export type AppAssetKey = 'home' | 'driver' | 'admin';

export type AppAssetType = 'header' | 'splash';

export interface AppAssetUploadRecord {
  id: string;
  app_key: AppAssetKey | string;
  asset_type: AppAssetType;
  storage_path: string;
  public_url: string;
  original_filename?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  is_current: boolean;
  uploaded_by?: string | null;
  created_at: string;
}

export interface AppAssetRecord {
  id: string;
  app_key: AppAssetKey | string;
  asset_type: AppAssetType;
  upload_id?: string | null;
  version: number;
  is_active: boolean;
  updated_at: string;
  updated_by?: string | null;
  upload?: AppAssetUploadRecord | null;
}

export type AppAssetsByTypeMap = Record<AppAssetType, AppAssetRecord | null>;

export type AllAppAssetsMap = Record<AppAssetKey, AppAssetsByTypeMap>;

export interface LocalConfirmedAppAsset {
  app_key: AppAssetKey;
  asset_type: AppAssetType;
  version: number;
  upload_id: string;
  storage_path: string;
  public_url: string;
  local_data_url: string;
  original_filename?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  width?: number | null;
  height?: number | null;
  updated_at?: string | null;
  confirmed_at: string;
}

export type DriverDocumentType =
  | 'id_card_front'
  | 'id_card_back'
  | 'driver_license'
  | 'vehicle_license';

export type DriverDocumentColumn =
  | 'id_card_front_path'
  | 'id_card_back_path'
  | 'driver_license_path'
  | 'vehicle_license_path';

export interface DriverDocuments {
  id_card_front_path?: string | null;
  id_card_back_path?: string | null;
  driver_license_path?: string | null;
  vehicle_license_path?: string | null;
}

export interface DeliveryDriver {
  id: string;
  user_id?: string | null;
  full_name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  detailed_address?: string | null;
  is_active: boolean;
  status?: 'pending_approval' | 'approved' | 'rejected' | string | null;
  governorate_code?: string | null;
  governorate_name?: string | null;
  markaz_name?: string | null;
  national_id?: string | null;
  vehicle_type?: string | null;
  vehicle_plate?: string | null;
  id_card_front_path?: string | null;
  id_card_back_path?: string | null;
  driver_license_path?: string | null;
  vehicle_license_path?: string | null;
  documents?: DriverDocuments;
  notes?: string | null;
  role?: string | null;
  rejection_reason?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  created_at: string;
  updated_at: string;
  // Computed stats from delivery_orders
  active_orders_count?: number;
  completed_orders_count?: number;
  cancelled_orders_count?: number;
  total_orders_count?: number;
}

export interface DeliveryDriverStatsSummary {
  total_drivers: number;
  active_drivers: number;
  inactive_drivers: number;
  total_assigned_orders: number;
  completed_orders: number;
}

export type DeliveryOrderStatus =
  | 'pending_review'
  | 'accepted'
  | 'shopping'
  | 'shopping_completed'
  | 'cancellation_pending'
  | 'cancelled'
  | 'completed';

export interface DeliveryDriverOrder {
  id: string;
  order_number?: string | null;
  customer_name: string;
  customer_phone: string;
  detailed_address: string;
  governorate_name?: string | null;
  markaz_name?: string | null;
  total_amount: number;
  delivery_fee: number;
  status: DeliveryOrderStatus;
  cancellation_reason?: string | null;
  cancellation_decision_note?: string | null;
  created_at: string;
  accepted_at?: string | null;
  delivered_at?: string | null;
}

export interface DeliveryOrder {
  id: string;
  order_number?: string | null;
  household_id: string;
  household_name?: string | null;
  invoice_id?: string | null;
  address_id?: string | null;
  customer_name: string;
  customer_phone: string;
  phone_number?: string | null;
  country?: string | null;
  governorate_name: string;
  markaz_name: string;
  governorate?: string | null;
  center?: string | null;
  detailed_address: string;
  subtotal: number;
  items_total?: number | null;
  delivery_fee: number;
  total_amount: number;
  delivery_notes?: string | null;
  notes?: string | null;
  assigned_driver_id?: string | null;
  status: DeliveryOrderStatus;
  cancellation_reason?: string | null;
  cancellation_requested_at?: string | null;
  cancellation_requested_by?: string | null;
  cancellation_decision_note?: string | null;
  cancellation_decided_at?: string | null;
  created_at: string;
  accepted_at?: string | null;
  delivered_at?: string | null;
  updated_at: string;
  // Related driver info joined in memory / query
  driver?: {
    id: string;
    full_name: string;
    phone: string;
    vehicle_type?: string | null;
    is_active?: boolean;
  } | null;
  items_count?: number;
  linked_invoice?: LinkedInvoiceSummary | null;
  // Department source (Grocery Delivery vs Pharmacy)
  order_source?: 'delivery' | 'pharmacy';
  pharmacy_order_id?: string | null;
  pharmacy_name?: string | null;
  prescription_title?: string | null;
}

export interface LinkedInvoiceSummary {
  id: string;
  invoice_number: string;
  category_arabic?: string | null;
  category?: string | null;
  total_price?: number;
  date?: string | null;
  notes?: string | null;
  products_count?: number;
}

export interface DeliveryOrderItem {
  id: string;
  order_id: string;
  product_id?: string | null;
  product_name: string;
  category_id?: string | null;
  category_name?: string | null;
  quantity: string;
  unit_price: number;
  total_price: number;
  created_at: string;
  source?: 'delivery_order_items' | 'invoice_products';
  invoice_number?: string | null;
}

export interface DeliveryOrderStatusHistory {
  id: string;
  order_id: string;
  old_status?: string | null;
  new_status: string;
  changed_by?: string | null;
  changed_by_role?: string | null;
  note?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface DeliveryOrdersStatsSummary {
  total: number;
  pending_review: number;
  accepted: number;
  cancellation_pending: number;
  completed: number;
  cancelled: number;
}

export type AdminCategory = {
  id: string;
  name: string;
  name_ar: string;
  name_en: string;
  description?: string | null;
  icon?: string;
  icon_name?: string | null;
  image?: string;
  image_url: string;
  color?: string | null;
  bg_light?: string | null;
  badge_color?: string | null;
  subcategories?: GlobalCategorySubcategory[];
  common_items?: string[];
  sort_order: number;
  is_active: boolean;
  products_count?: number;
  linked_households_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type AdminProduct = {
  id: string;
  global_category_id: string;
  category_id?: string;
  subcategory_id?: string | null;
  subcategory_name_ar?: string;
  category?: {
    id: string;
    name: string;
    name_ar?: string;
    icon?: string;
    color?: string | null;
  };
  name: string;
  name_ar: string;
  name_en?: string | null;
  default_unit: string;
  default_quantity: string;
  estimated_price?: number | null;
  image_url?: string | null;
  sort_order: number;
  is_active: boolean;
  aliases?: string[];
  is_featured?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type AdminBroadcastNotification = {
  id: string;
  title: string;
  body: string;
  type: string;
  icon_name?: string | null;
  image_url?: string | null;
  action_type?: string | null;
  action_route?: string | null;
  is_active: boolean;
  start_at?: string | null;
  end_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
  sent_at: string;
  priority: string;
  target_type?: string;
  target_role?: string;
  target_id?: string;
  views_count: number;
  dismissed_count: number;
  unique_users_count: number;
  unique_households_count: number;
};

export interface DeliveryCustomer {
  id: string;
  customer_name: string;
  customer_phone: string;
  phone_number?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  governorate_name: string;
  markaz_name: string;
  detailed_address: string;
  household_id?: string | null;
  profile_id?: string | null;
  account_created_at?: string | null;
  account_status: 'registered' | 'guest' | 'blocked';
  trust_status: 'unclassified' | 'trusted' | 'untrusted';
  orders_count: number;
  completed_orders_count: number;
  cancelled_orders_count: number;
  pending_orders_count: number;
  total_spent: number;
  last_order_id?: string;
  last_order_date?: string;
  last_order_status?: DeliveryOrderStatus;
  last_order_amount?: number;
  first_order_date?: string;
}

export interface DeliveryCustomerFilters {
  search?: string;
  governorate?: string;
  markaz?: string;
  accountStatus?: 'all' | 'registered' | 'guest' | 'blocked';
  repeatFilter?: 'all' | 'repeat' | 'single';
  page?: number;
  pageSize?: number;
}

export interface DeliveryCustomersStatsSummary {
  total_customers: number;
  registered_customers: number;
  guest_customers: number;
  repeat_customers: number;
  total_orders: number;
  total_revenue: number;
}

export interface DeliveryCustomerDetails extends DeliveryCustomer {
  orders: DeliveryOrder[];
}

export interface DeliveryServiceSettings {
  id: string;
  delivery_enabled: boolean;
  default_delivery_fee: number;
  created_at?: string;
  updated_at?: string;
}

export interface DeliveryGovernorateSetting {
  id: string;
  governorate_code: string;
  governorate_name: string;
  is_active: boolean;
  delivery_fee: number;
  estimated_delivery_time?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// Pharmacy Management Types (Bound strictly to live Supabase pharmacy_* schema)
// ============================================================================

export type PharmacyDisplayWidth = 'full' | 'half';

export interface PharmacySettingsRecord {
  id: string;
  service_enabled: boolean;
  section_visible: boolean;
  display_width: PharmacyDisplayWidth;
  updated_at: string;
  updated_by?: string | null;
}

export interface PharmacyDeliveryAreaSetting {
  id: string;
  governorate_code: string;
  governorate_name: string;
  center_name: string;
  service_enabled: boolean;
  delivery_fee: number;
  updated_at: string;
  updated_by?: string | null;
}

export interface PharmacyDirectoryRecord {
  id: string;
  name: string;
  phone?: string | null;
  governorate_code?: string | null;
  governorate_name?: string | null;
  center_name?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface PharmacyUserPharmacyRecord {
  id: string;
  user_id: string;
  pharmacy_id?: string | null;
  pharmacy_name: string;
  phone?: string | null;
  governorate_code?: string | null;
  governorate_name?: string | null;
  center_name?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
  updated_at: string;
  // Optional joined info
  user_name?: string | null;
  user_email?: string | null;
  linked_pharmacy?: PharmacyDirectoryRecord | null;
}

export interface PharmacyOrderItem {
  id: string;
  order_id: string;
  item_name: string;
  requested_quantity: number;
  purchased_quantity?: number | null;
  shortage_quantity?: number | null;
  unit?: string | null;
  shortage_reason?: string | null;
  driver_note?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PharmacyDeliveryOrder {
  id: string;
  pharmacy_order_id: string;
  assigned_driver_id?: string | null;
  accepted_at?: string | null;
  shopping_started_at?: string | null;
  delivery_started_at?: string | null;
  completed_at?: string | null;
  cancellation_requested_at?: string | null;
  cancellation_reason?: string | null;
  cancellation_decision?: string | null;
  cancellation_decided_at?: string | null;
  cancellation_decided_by?: string | null;
  created_at: string;
  updated_at: string;
  driver?: {
    id: string;
    full_name: string;
    phone: string;
    vehicle_type?: string | null;
    is_active?: boolean;
  } | null;
}

export interface PharmacyOrderStatusHistory {
  id: string;
  order_id: string;
  from_status?: string | null;
  to_status: string;
  changed_by?: string | null;
  changed_by_role?: string | null;
  note?: string | null;
  created_at: string;
}

export interface PharmacyOrderChangeLog {
  id: string;
  order_id: string;
  change_type: string;
  changed_by?: string | null;
  changed_by_role?: string | null;
  before_data?: Record<string, any> | null;
  after_data?: Record<string, any> | null;
  note?: string | null;
  created_at: string;
}

export interface PharmacyOrderFile {
  id: string;
  order_id: string;
  file_type: string;
  storage_path: string;
  mime_type?: string | null;
  display_order?: number | null;
  driver_note?: string | null;
  source_saved_file_id?: string | null;
  created_at: string;
}

export interface PharmacySavedPrescriptionFile {
  id: string;
  prescription_id: string;
  storage_path: string;
  mime_type?: string | null;
  display_order?: number | null;
  created_at: string;
}

export interface PharmacySavedPrescriptionItem {
  id: string;
  prescription_id: string;
  item_name: string;
  requested_quantity: number;
  unit?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PharmacySavedPrescription {
  id: string;
  user_id: string;
  title: string;
  pharmacy_id?: string | null;
  pharmacy_name?: string | null;
  created_at: string;
  updated_at: string;
  files?: PharmacySavedPrescriptionFile[];
  items?: PharmacySavedPrescriptionItem[];
  user_name?: string | null;
  user_email?: string | null;
}

export interface PharmacyOrder {
  id: string;
  order_number: string;
  user_id: string;
  household_id?: string | null;
  saved_prescription_id?: string | null;
  prescription_title?: string | null;
  pharmacy_selection_mode?: string | null;
  requested_pharmacy_id?: string | null;
  requested_pharmacy_name?: string | null;
  source_address_id?: string | null;
  address_governorate_code?: string | null;
  address_governorate_name?: string | null;
  address_center_name?: string | null;
  address_text?: string | null;
  address_latitude?: number | null;
  address_longitude?: number | null;
  customer_notes?: string | null;
  delivery_fee: number;
  medicines_total?: number | null;
  grand_total?: number | null;
  status: string;
  accepted_at?: string | null;
  shopping_started_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
  // Enriched relations from live tables
  customer_name?: string | null;
  customer_phone?: string | null;
  household_name?: string | null;
  requested_pharmacy?: PharmacyDirectoryRecord | null;
  delivery_order?: PharmacyDeliveryOrder | null;
  items_count?: number;
  files_count?: number;
}

export interface PharmacyStatsSummary {
  total_orders: number;
  pending_orders: number;
  active_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  driver_cancellation_requests: number;
  total_delivery_fees_completed: number;
  total_medicines_completed: number;
  total_grand_completed: number;
  total_pharmacies: number;
  active_pharmacies: number;
  total_user_pharmacies: number;
  total_saved_prescriptions: number;
  total_delivery_areas: number;
  enabled_delivery_areas: number;
  by_status: Record<string, number>;
  by_governorate: Array<{ governorate_name: string; count: number }>;
}


