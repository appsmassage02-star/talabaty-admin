/**
 * TypeScript Interfaces for Prepared Food & Restaurants Administration
 * Strictly matched against authoritative Supabase database schema
 */

export type SectionVisibility = 'visible' | 'hidden';
export type DisabledDisplayMode = 'show_disabled' | 'hide';

export interface RestaurantSectionSettings {
  id: string;
  section_enabled: boolean;
  global_max_delivery_radius_km: number;
  no_driver_timeout_minutes: number;
  section_visibility?: SectionVisibility;
  disabled_display_mode?: DisabledDisplayMode;
  created_at: string;
  updated_at: string;
}

export type FoodMoneySettlementMode = 'per_order' | 'daily' | 'weekly' | 'monthly';

export interface Restaurant {
  id: string;
  owner_user_id: string | null;
  name: string;
  description: string | null;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  image_url: string | null;
  is_active: boolean;
  is_open: boolean;
  max_delivery_radius_km: number;
  commission_percent: number;
  delivery_fee: number;
  food_money_settlement_mode: string;
  created_at: string;
  updated_at: string;
  // Egyptian administrative address columns (public.restaurants)
  country_name?: string | null;
  governorate_id?: string | null;
  center_id?: string | null;
  area_id?: string | null;
  street?: string | null;
  detailed_address?: string | null;
  // Enriched display helper names
  governorate_name?: string | null;
  center_name?: string | null;
  area_name?: string | null;
  // Joined/aggregated helper fields
  categories?: RestaurantCategory[];
  items_count?: number;
  orders_count?: number;
}

export interface FoodGovernorate {
  id: string;
  country_name?: string;
  name_ar: string;
  name_en?: string | null;
  code?: string | null;
  is_active: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface FoodCenter {
  id: string;
  governorate_id: string;
  name_ar: string;
  name_en?: string | null;
  is_active: boolean;
  sort_order?: number;
  source_code?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface FoodArea {
  id: string;
  governorate_id: string;
  center_id: string;
  name_ar: string;
  name_en?: string | null;
  is_active: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface RestaurantServiceArea {
  id: string;
  restaurant_id: string;
  governorate_id?: string | null;
  center_id?: string | null;
  area_id: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  // Joined / enriched display fields
  delivery_fee?: number;
  governorate_name_ar?: string;
  center_name_ar?: string;
  area_name_ar?: string;
}

export interface RestaurantSectionServiceArea {
  id: string;
  governorate_id?: string | null;
  center_id?: string | null;
  area_id?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  // Joined / enriched display helper fields
  governorate_name_ar?: string;
  center_name_ar?: string;
  area_name_ar?: string;
  level?: 'governorate' | 'center' | 'area';
}

export interface RestaurantAreaDeliveryFee {
  id: string;
  restaurant_id: string;
  area_id: string;
  delivery_fee: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RestaurantCategory {
  id: string;
  name: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  restaurants_count?: number;
}

export interface RestaurantCategoryLink {
  restaurant_id: string;
  category_id: string;
}

export interface RestaurantMenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  items_count?: number;
}

export interface RestaurantMenuItem {
  id: string;
  restaurant_id: string;
  category_id: string; // references restaurant_menu_categories.id
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  is_available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined helper fields
  category_name?: string;
  restaurant_name?: string;
  options_count?: number;
}

export interface RestaurantItemOption {
  id: string;
  restaurant_id: string;
  menu_item_id: string;
  name: string;
  required: boolean;
  min_select: number;
  max_select: number;
  sort_order: number;
  values?: RestaurantItemOptionValue[];
}

export interface RestaurantItemOptionValue {
  id: string;
  option_id: string;
  name: string;
  extra_price: number;
  is_available: boolean;
  sort_order: number;
}

export type RestaurantDiscountType = 'percentage' | 'fixed' | 'amount';

export interface RestaurantOffer {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
  restaurant_name?: string;
}

export interface RestaurantOrder {
  id: string;
  order_number: string;
  customer_user_id: string | null;
  restaurant_id: string;
  fulfillment_route: string | null;
  status: string;
  restaurant_name_snapshot: string | null;
  restaurant_phone_snapshot: string | null;
  restaurant_latitude_snapshot: number | null;
  restaurant_longitude_snapshot: number | null;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  food_subtotal: number;
  discount_amount: number;
  delivery_fee: number;
  customer_total: number;
  commission_percent_snapshot: number | null;
  driver_fee_share: number | null;
  admin_fee_share: number | null;
  restaurant_fee_share: number | null;
  payment_method: string;
  restaurant_confirmed_at: string | null;
  restaurant_rejected_at: string | null;
  restaurant_confirmation_method: string | null;
  cancellation_reason: string | null;
  idempotency_key: string | null;
  delivery_area_id?: string | null;
  delivery_governorate_name_snapshot?: string | null;
  delivery_center_name_snapshot?: string | null;
  delivery_area_name_snapshot?: string | null;
  created_at: string;
  updated_at: string;
  // Joined helper fields
  items?: RestaurantOrderItem[];
  status_history?: RestaurantOrderStatusHistory[];
  delivery_order?: RestaurantDeliveryOrder | null;
  invoice?: RestaurantInvoice | null;
}

export interface RestaurantOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  discount_amount: number;
  line_total: number;
  customer_approved_price_change: boolean | null;
  created_at: string;
  options?: RestaurantOrderItemOption[];
}

export interface RestaurantOrderItemOption {
  id: string;
  order_item_id: string;
  option_name_snapshot: string;
  value_name_snapshot: string;
  extra_price_snapshot: number;
}

export interface RestaurantOrderStatusHistory {
  id: string;
  order_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

export interface RestaurantDeliveryOrder {
  id: string;
  order_id: string;
  driver_user_id: string | null;
  status: string;
  driver_commission: number | null;
  area_commission_rule_snapshot: any;
  restaurant_phone_confirmed_at: string | null;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined helper fields
  driver_name?: string;
  driver_phone?: string;
  order_number?: string;
  customer_name?: string;
  delivery_address?: string;
}

export interface RestaurantDeliveryStatusHistory {
  id: string;
  delivery_order_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

export interface RestaurantInvoice {
  id: string;
  order_id: string;
  invoice_number: string;
  status: string;
  food_subtotal: number;
  discount_amount: number;
  delivery_fee: number;
  total_amount: number;
  issued_at: string | null;
  created_at: string;
  items?: RestaurantInvoiceItem[];
}

export interface RestaurantInvoiceItem {
  id: string;
  invoice_id: string;
  item_name_snapshot: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  line_total: number;
}

export interface RestaurantFinancialTransaction {
  id: string;
  order_id: string | null;
  restaurant_id: string | null;
  driver_user_id: string | null;
  transaction_type: string;
  amount: number;
  direction: 'in' | 'out' | 'credit' | 'debit' | string;
  status: string;
  idempotency_key: string | null;
  reverses_transaction_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  confirmed_at: string | null;
  restaurant_name?: string;
}

export interface RestaurantSettlement {
  id: string;
  restaurant_id: string | null;
  driver_user_id: string | null;
  settlement_type: string;
  period_start: string;
  period_end: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  agreement_snapshot: any;
  created_at: string;
  closed_at: string | null;
  restaurant_name?: string;
  items_count?: number;
}

export interface RestaurantSettlementItem {
  id: string;
  settlement_id: string;
  transaction_id: string;
  amount: number;
}

export interface RestaurantCollectionReceipt {
  id: string;
  order_id: string | null;
  restaurant_id: string | null;
  driver_user_id: string | null;
  settlement_id: string | null;
  amount: number;
  receipt_image_path: string | null;
  received_by: string | null;
  notes: string | null;
  received_at: string;
  restaurant_name?: string;
}

export interface RestaurantComplaint {
  id: string;
  order_id: string | null;
  customer_user_id: string | null;
  restaurant_id: string | null;
  subject: string;
  description: string;
  status: string;
  resolution_note: string | null;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
  restaurant_name?: string;
  customer_name?: string;
  order_number?: string;
}

export interface RestaurantOwnershipHistory {
  id: string;
  restaurant_id: string;
  previous_owner_user_id: string | null;
  new_owner_user_id: string | null;
  approved_by: string | null;
  status: string;
  requested_at: string;
  approved_at: string | null;
  notes: string | null;
  restaurant_name?: string;
}

export interface RestaurantOverviewStats {
  totalRestaurants: number;
  activeRestaurants: number;
  openRestaurants: number;
  totalCategories: number;
  totalMenuItems: number;
  availableMenuItems: number;
  totalOrders: number;
  pendingOrders: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalSales: number;
  totalDeliveryFees: number;
  pendingComplaints: number;
  activeOffers: number;
  pendingSettlements: number;
}
