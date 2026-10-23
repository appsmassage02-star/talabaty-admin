import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { calculateDeliveryFee, DeliveryCalculationResult } from '../utils/deliveryCalculator';
import { matchEgyptGovernorate, normalizeLocationText } from '../utils/egyptLocations';
import {
  AdminUser,
  AdminUserProfile,
  AdminHousehold,
  GlobalCategory,
  GlobalCategorySubcategory,
  GlobalProduct,
  AdminCategory,
  AdminProduct,
  AdminAuditLog,
  AdminNotification,
  AdminNotificationView,
  AdminBroadcastNotification,
  AppAnnouncement,
  SystemSetting,
  AdminOverviewStats,
  AdminRole,
  DeliveryDriver,
  DriverDocuments,
  DriverDocumentType,
  DriverDocumentColumn,
  DeliveryDriverStatsSummary,
  DeliveryDriverOrder,
  DeliveryOrderStatus,
  DeliveryOrder,
  DeliveryOrderItem,
  DeliveryOrderStatusHistory,
  DeliveryOrdersStatsSummary,
  DeliveryCustomer,
  DeliveryCustomerFilters,
  DeliveryCustomersStatsSummary,
  DeliveryCustomerDetails,
  DeliveryServiceSettings,
  DeliveryGovernorateSetting,
  AdminInvoiceRecord,
  AdminMissingItemRecord,
  AllAppAssetsMap,
  AppAssetKey,
  AppAssetType,
  AppAssetRecord,
  AppAssetUploadRecord,
  LocalConfirmedAppAsset,
  PharmacyDisplayWidth,
  PharmacySettingsRecord,
  PharmacyDeliveryAreaSetting,
  PharmacyDirectoryRecord,
  PharmacyUserPharmacyRecord,
  PharmacyOrder,
  PharmacyOrderItem,
  PharmacyDeliveryOrder,
  PharmacyOrderStatusHistory,
  PharmacyOrderChangeLog,
  PharmacyOrderFile,
  PharmacySavedPrescription,
  PharmacySavedPrescriptionFile,
  PharmacySavedPrescriptionItem,
  PharmacyStatsSummary,
  OperationalCommandCenterData,
  OperationalAssignedOrderSummary,
  OperationalPendingOrderSummary,
  OperationalCancellationSummary,
  OperationalDriverApplicationSummary,
  OperationalDisabledAccountSummary,
} from '../types';
import {
  fetchRemoteAdminAppAssets,
  fetchRemoteAllAppAssets,
  getLatestConfirmedLocalAsset,
  commitConfirmedLocalAsset,
  verifyImageReadable,
  arrayBufferToBase64DataUrl,
  SUPPORTED_APP_KEYS,
  SUPPORTED_ASSET_TYPES,
} from './appAssetCacheService';

/**
 * Unified helper function to resolve driver document image source:
 * 1. Direct case: Base64 Data URL (`data:image/jpeg;base64,...`, `data:image/webp;base64,...`, etc.)
 *    or direct HTTP/HTTPS URL (`http://` or `https://`) -> returned directly without any network calls.
 * 2. Storage Fallback case: Relative storage path (e.g. `drivers/${user_id}/documents/id_card_front.webp`)
 *    inside Supabase bucket `driver-documents` -> resolved via `getPublicUrl`.
 */
export function resolveDocumentSrc(path?: string | null): string | null {
  if (!path || typeof path !== 'string') return null;
  const trimmed = path.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }

  // إذا كان مسار تخزين في باكت Supabase
  if (!supabase) return null;
  let cleanPath = trimmed.replace(/^\/+/, '');
  if (cleanPath.startsWith('driver-documents/')) {
    cleanPath = cleanPath.slice('driver-documents/'.length);
  }
  const { data } = supabase.storage.from('driver-documents').getPublicUrl(cleanPath);
  return data?.publicUrl || null;
}

export function isDirectDocumentSrc(path?: string | null): boolean {
  if (!path || typeof path !== 'string') return false;
  const trimmed = path.trim();
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  );
}

export const adminService = {
  resolveDocumentSrc,
  isDirectDocumentSrc,
  // --------------------------------------------------------------------------
  // Admin Auth & Authorization Check (Strict Authoritative DB-Enforced)
  // --------------------------------------------------------------------------
  async checkAdminStatus(userId: string): Promise<{
    isAdmin: boolean;
    adminRecord: AdminUser | null;
    error?: string;
  }> {
    if (!supabase || !userId) {
      return { isAdmin: false, adminRecord: null };
    }

    try {
      // Query the authoritative admin_users table directly
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (!error && data) {
        return { isAdmin: true, adminRecord: data as AdminUser };
      }

      if (error) {
        console.warn('Admin status check query error:', error);
        return { isAdmin: false, adminRecord: null, error: error.message };
      }

      return { isAdmin: false, adminRecord: null };
    } catch (e: any) {
      console.warn('Admin status check exception:', e);
      return { isAdmin: false, adminRecord: null, error: e?.message };
    }
  },

  // --------------------------------------------------------------------------
  // Overview Statistics (Strict Real Database Aggregation)
  // --------------------------------------------------------------------------
  async getOverviewStats(startDate?: string, endDate?: string): Promise<AdminOverviewStats | null> {
    if (!supabase) return null;

    try {
      // Fetch auxiliary live counts for Delivery Management, Admin Team, Central Catalog & Notifications in parallel
      const [
        rpcResult,
        deliveryOrdersRes,
        deliveryDriversRes,
        adminsCountRes,
        globalProductsCountRes,
        globalCategoriesCountRes,
        adminNotificationsRes,
        pharmacyOrdersRes,
        pharmacyDeliveryOrdersRes,
        pharmacyPharmaciesRes,
        pharmacyAreasRes,
        profilesRes,
      ] = await Promise.all([
        supabase.rpc('admin_get_overview_stats', {
          p_start_date: startDate || null,
          p_end_date: endDate || null,
        }),
        supabase.from('delivery_orders').select('id, status, customer_phone, household_id, assigned_driver_id'),
        supabase.from('delivery_drivers').select('id, is_active, status'),
        supabase.from('admin_users').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('global_products').select('*', { count: 'exact', head: true }),
        supabase.from('global_categories').select('*', { count: 'exact', head: true }),
        supabase.from('admin_notifications').select('id, is_active'),
        supabase.from('pharmacy_orders').select('id, status'),
        supabase.from('pharmacy_delivery_orders').select('id, pharmacy_order_id, assigned_driver_id, cancellation_requested_at, cancellation_decision'),
        supabase.from('pharmacy_pharmacies').select('id, is_active'),
        supabase.from('pharmacy_delivery_area_settings').select('id, service_enabled'),
        supabase.from('profiles').select('id, is_blocked, status'),
      ]);

      const pOrders = pharmacyOrdersRes.data || [];
      const pDeliveryOrders = pharmacyDeliveryOrdersRes.data || [];
      const pPharmacies = pharmacyPharmaciesRes.data || [];
      const pAreas = pharmacyAreasRes.data || [];
      const pharmacyTotalOrders = pOrders.length;
      const pharmacyPendingOrders = pOrders.filter(
        (o: any) => o.status === 'pending' || o.status === 'pending_review' || o.status === 'new'
      ).length;
      const pharmacyCompletedOrders = pOrders.filter((o: any) => o.status === 'completed').length;
      const pharmacyActiveOrders = pOrders.filter(
        (o: any) => o.status !== 'completed' && o.status !== 'cancelled'
      ).length;

      const pOrderStatusMap = new Map<string, string>();
      pOrders.forEach((o: any) => pOrderStatusMap.set(o.id, o.status));

      const pharmacyAssignedOrders = pDeliveryOrders.filter((d: any) => {
        const st = pOrderStatusMap.get(d.pharmacy_order_id);
        return Boolean(d.assigned_driver_id) && st && st !== 'completed' && st !== 'cancelled';
      }).length;

      const pharmacyCancellationOrders = pDeliveryOrders.filter((d: any) => {
        const st = pOrderStatusMap.get(d.pharmacy_order_id);
        return (
          (Boolean(d.cancellation_requested_at) && !d.cancellation_decision) ||
          st === 'cancellation_pending'
        );
      }).length;

      const pharmacyTotalPharmacies = pPharmacies.length;
      const pharmacyActiveAreas = pAreas.filter((a: any) => Boolean(a.service_enabled)).length;

      const dOrders = deliveryOrdersRes.data || [];
      const dDrivers = deliveryDriversRes.data || [];
      const customerSet = new Set<string>();
      dOrders.forEach((o: any) => {
        const key = o.household_id || o.customer_phone || o.id;
        if (key) customerSet.add(String(key));
      });

      const deliveryTotalOrders = dOrders.length;
      const deliveryPendingReviewOrders = dOrders.filter((o: any) => o.status === 'pending_review').length;
      const deliveryAssignedOrders = dOrders.filter(
        (o: any) =>
          o.status === 'accepted' ||
          o.status === 'shopping' ||
          o.status === 'shopping_completed' ||
          (Boolean(o.assigned_driver_id) && o.status !== 'completed' && o.status !== 'cancelled')
      ).length;
      const deliveryCancellationOrders = dOrders.filter((o: any) => o.status === 'cancellation_pending').length;
      const deliveryActiveOrders = dOrders.filter(
        (o: any) =>
          o.status === 'pending_review' ||
          o.status === 'accepted' ||
          o.status === 'shopping' ||
          o.status === 'shopping_completed' ||
          o.status === 'cancellation_pending'
      ).length;
      const deliveryCompletedOrders = dOrders.filter((o: any) => o.status === 'completed').length;
      const deliveryCancelledOrders = dOrders.filter((o: any) => o.status === 'cancelled').length;

      const deliveryTotalDrivers = dDrivers.length;
      const deliveryActiveDrivers = dDrivers.filter((d: any) => Boolean(d.is_active)).length;
      const deliveryInactiveDrivers = dDrivers.filter((d: any) => !Boolean(d.is_active)).length;
      const deliveryPendingDrivers = dDrivers.filter(
        (d: any) => d.status === 'pending_approval' || (!d.status && !d.is_active)
      ).length;

      const notifsList = adminNotificationsRes.data || [];
      const totalNotificationsCount = notifsList.length;
      const activeNotificationsCount = notifsList.filter((n: any) => Boolean(n.is_active)).length;

      const localBlocked = this.getLocalBlockedUsers();
      const profilesList = profilesRes.data || [];
      const blockedUsersCount = profilesList.filter(
        (p: any) => Boolean(p.is_blocked || p.status === 'blocked' || localBlocked[p.id])
      ).length;

      const archivedIds = await this.getArchivedInvoiceIds();

      if (!rpcResult.error && rpcResult.data) {
        const base = rpcResult.data as AdminOverviewStats;
        return {
          ...base,
          blocked_users: Math.max(base.blocked_users ?? 0, blockedUsersCount),
          total_categories: globalCategoriesCountRes.count ?? base.total_categories ?? 0,
          total_products: globalProductsCountRes.count ?? base.total_products ?? 0,
          total_notifications: totalNotificationsCount,
          active_notifications_count: activeNotificationsCount,
          delivery_total_orders: deliveryTotalOrders,
          delivery_active_orders: deliveryActiveOrders,
          delivery_pending_review_orders: deliveryPendingReviewOrders,
          delivery_assigned_orders: deliveryAssignedOrders,
          delivery_cancellation_orders: deliveryCancellationOrders,
          delivery_completed_orders: deliveryCompletedOrders,
          delivery_cancelled_orders: deliveryCancelledOrders,
          delivery_total_drivers: deliveryTotalDrivers,
          delivery_active_drivers: deliveryActiveDrivers,
          delivery_inactive_drivers: deliveryInactiveDrivers,
          delivery_pending_drivers: deliveryPendingDrivers,
          delivery_total_customers: customerSet.size,
          total_admins: adminsCountRes.count ?? 0,
          archived_invoices_count: archivedIds.length,
          pharmacy_total_orders: pharmacyTotalOrders,
          pharmacy_pending_orders: pharmacyPendingOrders,
          pharmacy_active_orders: pharmacyActiveOrders,
          pharmacy_assigned_orders: pharmacyAssignedOrders,
          pharmacy_cancellation_orders: pharmacyCancellationOrders,
          pharmacy_completed_orders: pharmacyCompletedOrders,
          pharmacy_total_pharmacies: pharmacyTotalPharmacies,
          pharmacy_active_areas: pharmacyActiveAreas,
        };
      }

      // 2. Direct aggregation fallback from database
      const [
        { count: totalHouseholds },
        { count: totalMissingItems },
        { data: invoicesData },
      ] = await Promise.all([
        supabase.from('households').select('*', { count: 'exact', head: true }),
        supabase.from('missing_items').select('*', { count: 'exact', head: true }),
        supabase.from('invoices').select('total_price'),
      ]);

      const sumInvoices = (invoicesData || []).reduce((acc: number, cur: any) => acc + (Number(cur.total_price) || 0), 0);
      const totalUsersCount = profilesList.length;

      return {
        total_users: totalUsersCount,
        active_users: Math.max(0, totalUsersCount - blockedUsersCount),
        new_users: 0,
        blocked_users: blockedUsersCount,
        total_households: totalHouseholds ?? 0,
        total_missing_items: totalMissingItems ?? 0,
        total_invoices: (invoicesData || []).length,
        total_purchases_sum: sumInvoices,
        total_categories: globalCategoriesCountRes.count ?? 0,
        total_products: globalProductsCountRes.count ?? 0,
        total_notifications: totalNotificationsCount,
        active_notifications_count: activeNotificationsCount,
        generated_at: new Date().toISOString(),
        delivery_total_orders: deliveryTotalOrders,
        delivery_active_orders: deliveryActiveOrders,
        delivery_pending_review_orders: deliveryPendingReviewOrders,
        delivery_assigned_orders: deliveryAssignedOrders,
        delivery_cancellation_orders: deliveryCancellationOrders,
        delivery_completed_orders: deliveryCompletedOrders,
        delivery_cancelled_orders: deliveryCancelledOrders,
        delivery_total_drivers: deliveryTotalDrivers,
        delivery_active_drivers: deliveryActiveDrivers,
        delivery_inactive_drivers: deliveryInactiveDrivers,
        delivery_pending_drivers: deliveryPendingDrivers,
        delivery_total_customers: customerSet.size,
        total_admins: adminsCountRes.count ?? 0,
        archived_invoices_count: archivedIds.length,
        pharmacy_total_orders: pharmacyTotalOrders,
        pharmacy_pending_orders: pharmacyPendingOrders,
        pharmacy_active_orders: pharmacyActiveOrders,
        pharmacy_assigned_orders: pharmacyAssignedOrders,
        pharmacy_cancellation_orders: pharmacyCancellationOrders,
        pharmacy_completed_orders: pharmacyCompletedOrders,
        pharmacy_total_pharmacies: pharmacyTotalPharmacies,
        pharmacy_active_areas: pharmacyActiveAreas,
      };
    } catch (err) {
      console.warn('Error fetching overview stats:', err);
      return null;
    }
  },

  // --------------------------------------------------------------------------
  // Operational Command Center Snapshot (Real Live Queues & Priorities)
  // --------------------------------------------------------------------------
  async getOperationalCommandCenterData(): Promise<{
    data: OperationalCommandCenterData | null;
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { data: null, error: 'Supabase غير متصل' };
    }

    try {
      const [
        deliveryOrdersRes,
        deliveryDriversRes,
        pharmacyOrdersRes,
        pharmacyDeliveryOrdersRes,
        profilesRes,
        adminUsersRes,
        notificationsRes,
      ] = await Promise.all([
        supabase
          .from('delivery_orders')
          .select(
            'id, order_number, customer_name, household_name, governorate_name, status, assigned_driver_id, total_amount, cancellation_reason, cancellation_requested_at, created_at, updated_at'
          )
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('delivery_drivers')
          .select(
            'id, full_name, phone, governorate_name, vehicle_type, status, is_active, id_card_front_path, id_card_back_path, driver_license_path, vehicle_license_path, created_at, updated_at'
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('pharmacy_orders')
          .select(
            'id, order_number, user_id, prescription_title, requested_pharmacy_name, address_governorate_name, status, grand_total, delivery_fee, created_at, updated_at'
          )
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('pharmacy_delivery_orders')
          .select(
            'id, pharmacy_order_id, assigned_driver_id, cancellation_requested_at, cancellation_reason, cancellation_decision, created_at, updated_at'
          ),
        supabase
          .from('profiles')
          .select('id, full_name, email, phone, is_blocked, status, blocked_reason, blocked_at, updated_at')
          .order('created_at', { ascending: false }),
        supabase.from('admin_users').select('user_id, email'),
        this.getAdminNotifications(),
      ]);

      if (deliveryOrdersRes.error && pharmacyOrdersRes.error && deliveryDriversRes.error) {
        return {
          data: null,
          error:
            deliveryOrdersRes.error.message ||
            'تعذر جلب بيانات مركز المهام الإدارية من قاعدة البيانات',
        };
      }

      const dOrders = (deliveryOrdersRes.data || []) as any[];
      const dDrivers = (deliveryDriversRes.data || []) as any[];
      const pOrders = (pharmacyOrdersRes.data || []) as any[];
      const pDeliveryOrders = (pharmacyDeliveryOrdersRes.data || []) as any[];
      const profiles = (profilesRes.data || []) as any[];
      const adminUsers = (adminUsersRes.data || []) as any[];

      // Map drivers by ID
      const driversById = new Map<string, any>();
      dDrivers.forEach((drv) => {
        if (drv.id) driversById.set(drv.id, drv);
      });

      // Map profiles by ID
      const profilesById = new Map<string, any>();
      profiles.forEach((prof) => {
        if (prof.id) profilesById.set(prof.id, prof);
      });

      // Map pharmacy_delivery_orders by pharmacy_order_id
      const pDeliveryByOrderId = new Map<string, any>();
      pDeliveryOrders.forEach((pdo) => {
        if (pdo.pharmacy_order_id) pDeliveryByOrderId.set(pdo.pharmacy_order_id, pdo);
      });

      // 1. Pending Review Orders (Delivery + Pharmacy)
      const pendingReviewOrders: OperationalPendingOrderSummary[] = [];
      let deliveryPendingCount = 0;
      let pharmacyPendingCount = 0;

      for (const o of dOrders) {
        if (o.status === 'pending_review') {
          deliveryPendingCount++;
          pendingReviewOrders.push({
            id: o.id,
            order_number: o.order_number || `#${String(o.id).slice(0, 6)}`,
            source: 'delivery',
            customer_name: o.customer_name || o.household_name || 'عميل دليفري',
            governorate_name: o.governorate_name || null,
            status: o.status,
            total_amount: o.total_amount !== null && o.total_amount !== undefined ? Number(o.total_amount) : null,
            created_at: o.created_at,
          });
        }
      }

      for (const po of pOrders) {
        if (po.status === 'pending' || po.status === 'pending_review' || po.status === 'new') {
          pharmacyPendingCount++;
          const prof = po.user_id ? profilesById.get(po.user_id) : null;
          pendingReviewOrders.push({
            id: po.id,
            order_number: po.order_number || `#${String(po.id).slice(0, 6)}`,
            source: 'pharmacy',
            customer_name:
              prof?.full_name ||
              po.prescription_title ||
              po.requested_pharmacy_name ||
              'طلب صيدلية',
            governorate_name: po.address_governorate_name || null,
            status: po.status,
            total_amount:
              po.grand_total !== null && po.grand_total !== undefined
                ? Number(po.grand_total)
                : Number(po.delivery_fee || 0),
            created_at: po.created_at,
          });
        }
      }

      pendingReviewOrders.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // 2. Cancellation Requests (Delivery + Pharmacy)
      const cancellationRequests: OperationalCancellationSummary[] = [];
      let deliveryCancelCount = 0;
      let pharmacyCancelCount = 0;

      for (const o of dOrders) {
        if (o.status === 'cancellation_pending') {
          deliveryCancelCount++;
          const drv = o.assigned_driver_id ? driversById.get(o.assigned_driver_id) : null;
          cancellationRequests.push({
            id: o.id,
            order_number: o.order_number || `#${String(o.id).slice(0, 6)}`,
            source: 'delivery',
            customer_name: o.customer_name || o.household_name || 'عميل دليفري',
            driver_name: drv?.full_name || null,
            reason: o.cancellation_reason || 'طلب إلغاء من السائق بانتظار قرار الإدارة',
            requested_at: o.cancellation_requested_at || o.updated_at || o.created_at,
          });
        }
      }

      for (const po of pOrders) {
        const pdo = pDeliveryByOrderId.get(po.id);
        const isCancelPending =
          po.status === 'cancellation_pending' ||
          (pdo && Boolean(pdo.cancellation_requested_at) && !pdo.cancellation_decision);

        if (isCancelPending) {
          pharmacyCancelCount++;
          const drv = pdo?.assigned_driver_id ? driversById.get(pdo.assigned_driver_id) : null;
          const prof = po.user_id ? profilesById.get(po.user_id) : null;
          cancellationRequests.push({
            id: po.id,
            order_number: po.order_number || `#${String(po.id).slice(0, 6)}`,
            source: 'pharmacy',
            customer_name:
              prof?.full_name || po.prescription_title || po.requested_pharmacy_name || 'طلب صيدلية',
            driver_name: drv?.full_name || null,
            reason: pdo?.cancellation_reason || 'طلب اعتذار/إلغاء مندوب الصيدلية',
            requested_at: pdo?.cancellation_requested_at || po.updated_at || po.created_at,
          });
        }
      }

      // 3. Assigned Orders with Driver Name (Active) & Recent Completed Orders
      const assignedOrdersWithDrivers: OperationalAssignedOrderSummary[] = [];
      const recentCompletedOrders: OperationalAssignedOrderSummary[] = [];
      let deliveryAssignedCount = 0;
      let pharmacyAssignedCount = 0;
      let deliveryCompletedCount = 0;
      let pharmacyCompletedCount = 0;

      for (const o of dOrders) {
        const drv = o.assigned_driver_id ? driversById.get(o.assigned_driver_id) : null;
        const driverName = drv?.full_name || (o.assigned_driver_id ? 'مندوب معين' : 'غير مسند');

        if (o.status === 'completed') {
          deliveryCompletedCount++;
          recentCompletedOrders.push({
            id: o.id,
            order_number: o.order_number || `#${String(o.id).slice(0, 6)}`,
            source: 'delivery',
            customer_name: o.customer_name || o.household_name || 'عميل دليفري',
            governorate_name: o.governorate_name || null,
            status: o.status,
            driver_id: o.assigned_driver_id || '',
            driver_name: driverName,
            driver_phone: drv?.phone || null,
            total_amount: o.total_amount !== null && o.total_amount !== undefined ? Number(o.total_amount) : null,
            updated_at: o.updated_at || o.created_at,
          });
        } else if (
          o.status === 'accepted' ||
          o.status === 'shopping' ||
          o.status === 'shopping_completed' ||
          (Boolean(o.assigned_driver_id) && o.status !== 'cancelled' && o.status !== 'pending_review')
        ) {
          deliveryAssignedCount++;
          assignedOrdersWithDrivers.push({
            id: o.id,
            order_number: o.order_number || `#${String(o.id).slice(0, 6)}`,
            source: 'delivery',
            customer_name: o.customer_name || o.household_name || 'عميل دليفري',
            governorate_name: o.governorate_name || null,
            status: o.status,
            driver_id: o.assigned_driver_id || '',
            driver_name: driverName,
            driver_phone: drv?.phone || null,
            total_amount: o.total_amount !== null && o.total_amount !== undefined ? Number(o.total_amount) : null,
            updated_at: o.updated_at || o.created_at,
          });
        }
      }

      for (const po of pOrders) {
        const pdo = pDeliveryByOrderId.get(po.id);
        const drv = pdo?.assigned_driver_id ? driversById.get(pdo.assigned_driver_id) : null;
        const prof = po.user_id ? profilesById.get(po.user_id) : null;
        const customerName =
          prof?.full_name || po.prescription_title || po.requested_pharmacy_name || 'طلب صيدلية';
        const driverName = drv?.full_name || (pdo?.assigned_driver_id ? 'مندوب صيدلية' : 'غير مسند');

        if (po.status === 'completed') {
          pharmacyCompletedCount++;
          recentCompletedOrders.push({
            id: po.id,
            order_number: po.order_number || `#${String(po.id).slice(0, 6)}`,
            source: 'pharmacy',
            customer_name: customerName,
            governorate_name: po.address_governorate_name || null,
            status: po.status,
            driver_id: pdo?.assigned_driver_id || '',
            driver_name: driverName,
            driver_phone: drv?.phone || null,
            total_amount:
              po.grand_total !== null && po.grand_total !== undefined
                ? Number(po.grand_total)
                : Number(po.delivery_fee || 0),
            updated_at: po.updated_at || po.created_at,
          });
        } else if (
          Boolean(pdo?.assigned_driver_id) &&
          po.status !== 'cancelled' &&
          po.status !== 'completed'
        ) {
          pharmacyAssignedCount++;
          assignedOrdersWithDrivers.push({
            id: po.id,
            order_number: po.order_number || `#${String(po.id).slice(0, 6)}`,
            source: 'pharmacy',
            customer_name: customerName,
            governorate_name: po.address_governorate_name || null,
            status: po.status,
            driver_id: pdo.assigned_driver_id,
            driver_name: driverName,
            driver_phone: drv?.phone || null,
            total_amount:
              po.grand_total !== null && po.grand_total !== undefined
                ? Number(po.grand_total)
                : Number(po.delivery_fee || 0),
            updated_at: po.updated_at || po.created_at,
          });
        }
      }

      assignedOrdersWithDrivers.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      recentCompletedOrders.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      // 4. New / Pending Drivers & Disabled Accounts
      const pendingDrivers: OperationalDriverApplicationSummary[] = [];
      const disabledAccounts: OperationalDisabledAccountSummary[] = [];
      let driversPendingCount = 0;
      let driversInactiveCount = 0;

      for (const drv of dDrivers) {
        let docsCount = 0;
        if (drv.id_card_front_path) docsCount++;
        if (drv.id_card_back_path) docsCount++;
        if (drv.driver_license_path) docsCount++;
        if (drv.vehicle_license_path) docsCount++;

        const isPendingApproval =
          drv.status === 'pending_approval' || (!drv.status && !drv.is_active);

        if (isPendingApproval) {
          driversPendingCount++;
          pendingDrivers.push({
            id: drv.id,
            full_name: drv.full_name || 'سائق جديد',
            phone: drv.phone || '—',
            governorate_name: drv.governorate_name || null,
            vehicle_type: drv.vehicle_type || null,
            status: drv.status || 'pending_approval',
            is_active: Boolean(drv.is_active),
            docs_count: docsCount,
            created_at: drv.created_at || new Date().toISOString(),
          });
        }

        if (!drv.is_active) {
          driversInactiveCount++;
          if (!isPendingApproval) {
            disabledAccounts.push({
              id: drv.id,
              name: drv.full_name || 'مندوب دليفري',
              contact: drv.phone || '—',
              account_type: 'driver',
              reason: drv.status === 'rejected' ? 'مرفوض' : 'حساب سائق غير نشط / موقوف',
              updated_at: drv.updated_at || drv.created_at,
            });
          }
        }
      }

      const adminUserIds = new Set<string>(adminUsers.map((a) => a.user_id).filter(Boolean));
      const adminEmails = new Set<string>(
        adminUsers.map((a) => a.email?.toLowerCase().trim()).filter(Boolean)
      );
      const localBlocked = this.getLocalBlockedUsers();
      let usersBlockedCount = 0;

      for (const p of profiles) {
        if (adminUserIds.has(p.id)) continue;
        if (p.email && adminEmails.has(p.email.toLowerCase().trim())) continue;

        const isBlocked = Boolean(
          p.is_blocked || p.status === 'blocked' || localBlocked[p.id]
        );
        if (isBlocked) {
          usersBlockedCount++;
          disabledAccounts.push({
            id: p.id,
            name: p.full_name || 'مستخدم محظور',
            contact: p.phone || p.email || '—',
            account_type: 'user',
            reason: p.blocked_reason || localBlocked[p.id]?.reason || 'حساب مستخدم محظور',
            updated_at: p.blocked_at || localBlocked[p.id]?.blocked_at || p.updated_at,
          });
        }
      }

      const notifs = notificationsRes || [];
      const activeNotifsCount = notifs.filter((n) => Boolean(n.is_active)).length;

      return {
        data: {
          pendingReviewOrders,
          cancellationRequests,
          assignedOrdersWithDrivers,
          recentCompletedOrders: recentCompletedOrders.slice(0, 15),
          pendingDrivers,
          disabledAccounts,
          recentNotifications: notifs.slice(0, 6),
          counts: {
            delivery_pending_review: deliveryPendingCount,
            pharmacy_pending_review: pharmacyPendingCount,
            delivery_cancellation_pending: deliveryCancelCount,
            pharmacy_cancellation_pending: pharmacyCancelCount,
            delivery_assigned_active: deliveryAssignedCount,
            pharmacy_assigned_active: pharmacyAssignedCount,
            delivery_completed: deliveryCompletedCount,
            pharmacy_completed: pharmacyCompletedCount,
            drivers_pending_approval: driversPendingCount,
            drivers_inactive: driversInactiveCount,
            users_blocked: usersBlockedCount,
            notifications_active: activeNotifsCount,
            notifications_total: notifs.length,
          },
          fetchedAt: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      return {
        data: null,
        error: err?.message || 'حدث خطأ أثناء تحميل بيانات مركز المتابعة الإداري',
      };
    }
  },

  // --------------------------------------------------------------------------
  // Invoices, Purchases, Missing Items & Invoice Archiving Management
  // --------------------------------------------------------------------------
  async getArchivedInvoiceIds(): Promise<string[]> {
    try {
      const raw = localStorage.getItem('talabat_admin_archived_invoices');
      const localList: string[] = raw ? JSON.parse(raw) : [];
      if (!supabase) return localList;

      const { data } = await supabase
        .from('app_system_settings')
        .select('value')
        .eq('key', 'archived_invoice_ids')
        .maybeSingle();

      if (data?.value && Array.isArray(data.value)) {
        const merged = Array.from(new Set([...localList, ...data.value.map(String)]));
        localStorage.setItem('talabat_admin_archived_invoices', JSON.stringify(merged));
        return merged;
      }
      return localList;
    } catch {
      return [];
    }
  },

  async setInvoiceArchivedState(
    invoiceIds: string[],
    archive: boolean
  ): Promise<{ success: boolean; archivedIds: string[]; error?: string }> {
    try {
      const current = await this.getArchivedInvoiceIds();
      const set = new Set<string>(current);
      invoiceIds.forEach((id) => {
        if (archive) set.add(id);
        else set.delete(id);
      });
      const updated: string[] = Array.from(set);
      localStorage.setItem('talabat_admin_archived_invoices', JSON.stringify(updated));

      if (supabase) {
        await supabase.from('app_system_settings').upsert(
          {
            key: 'archived_invoice_ids',
            value: updated,
            description: 'قائمة معرفات فواتير المشتريات المؤرشفة في إدارة الفواتير',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );

        await this.logAuditAction(
          archive ? 'INVOICES_ARCHIVED' : 'INVOICES_UNARCHIVED',
          'INVOICE',
          invoiceIds.join(','),
          { count: invoiceIds.length, archive }
        );
      }

      return { success: true, archivedIds: updated };
    } catch (err: any) {
      return {
        success: false,
        archivedIds: [],
        error: err?.message || 'تعذر تحديث حالة أرشفة الفواتير',
      };
    }
  },

  async getInvoicesAndPurchasingData(): Promise<{
    invoices: AdminInvoiceRecord[];
    missingItems: AdminMissingItemRecord[];
    archivedIds: string[];
  }> {
    if (!supabase) return { invoices: [], missingItems: [], archivedIds: [] };

    try {
      const [invoicesRes, missingRes, householdsRes, archivedIds] = await Promise.all([
        supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('missing_items').select('*').order('added_at', { ascending: false }).limit(400),
        supabase.from('households').select('id, name'),
        this.getArchivedInvoiceIds(),
      ]);

      const householdMap = new Map<string, string>();
      (householdsRes.data || []).forEach((h: any) => {
        if (h.id) householdMap.set(h.id, h.name || 'منزل مسجل');
      });

      const archivedSet = new Set(archivedIds);

      const invoices: AdminInvoiceRecord[] = (invoicesRes.data || []).map((inv: any) => {
        let parsedProducts: any[] = [];
        if (Array.isArray(inv.products)) {
          parsedProducts = inv.products;
        } else if (typeof inv.products === 'string') {
          try {
            const p = JSON.parse(inv.products);
            if (Array.isArray(p)) parsedProducts = p;
          } catch {
            parsedProducts = [];
          }
        }

        return {
          id: inv.id,
          invoice_number: inv.invoice_number ?? null,
          household_id: inv.household_id || null,
          household_name: inv.household_id
            ? householdMap.get(inv.household_id) || `منزل #${String(inv.household_id).slice(0, 6)}`
            : 'أسرة عامة',
          category: inv.category || inv.store_name || 'مشتريات منزلية',
          store_name: inv.store_name || inv.category || 'متجر عام',
          total_price: Number(inv.total_price) || 0,
          products: parsedProducts,
          date: inv.date || inv.created_at,
          created_at: inv.created_at || inv.date || new Date().toISOString(),
          is_archived: archivedSet.has(inv.id),
        };
      });

      const missingItems: AdminMissingItemRecord[] = (missingRes.data || []).map((item: any) => ({
        id: item.id,
        household_id: item.household_id || null,
        household_name: item.household_id
          ? householdMap.get(item.household_id) || `منزل #${String(item.household_id).slice(0, 6)}`
          : 'أسرة عامة',
        name: item.name || 'صنف غير مسمى',
        category: item.category || 'عام',
        quantity: item.quantity ?? '1',
        completed: Boolean(item.completed),
        added_at: item.added_at || item.created_at || new Date().toISOString(),
      }));

      return {
        invoices,
        missingItems,
        archivedIds,
      };
    } catch (err) {
      console.warn('Error loading invoices and purchasing data:', err);
      return { invoices: [], missingItems: [], archivedIds: [] };
    }
  },

  // --------------------------------------------------------------------------
  // Analytics Aggregation (Real Database Records)
  // --------------------------------------------------------------------------
  async getAnalyticsData(): Promise<{
    topCategories: { name: string; count: number; amount: number; pct: number; color: string }[];
    topItems: { name: string; category: string; requests: number; status: 'high' | 'medium' | 'low' }[];
  }> {
    if (!supabase) return { topCategories: [], topItems: [] };
    try {
      const [
        { data: invoices },
        { data: missingItems },
        { data: categories },
      ] = await Promise.all([
        supabase.from('invoices').select('total_price, store_name, created_at, date'),
        supabase.from('missing_items').select('name, category, completed, quantity'),
        supabase.from('global_categories').select('id, name_ar, color'),
      ]);

      // Aggregate top requested items from missing_items
      const itemCounts: Record<string, { count: number; category: string }> = {};
      (missingItems || []).forEach((item: any) => {
        const name = (item.name || '').trim();
        if (!name) return;
        if (!itemCounts[name]) {
          itemCounts[name] = { count: 0, category: item.category || 'عام' };
        }
        itemCounts[name].count += 1;
      });

      const sortedItems = Object.entries(itemCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([name, val], idx) => ({
          name,
          category: val.category,
          requests: val.count,
          status: (idx < 3 ? 'high' : idx < 7 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
        }));

      const catColorPalette = [
        'bg-emerald-500',
        'bg-amber-500',
        'bg-rose-500',
        'bg-cyan-500',
        'bg-purple-500',
        'bg-blue-500',
      ];

      const totalInvoicesSum = (invoices || []).reduce((acc: number, cur: any) => acc + (Number(cur.total_price) || 0), 0);

      const topCats = (categories || []).map((cat: any, idx: number) => {
        const catItemsCount = (missingItems || []).filter((it: any) => it.category === cat.name_ar || it.category === cat.id).length;
        const count = catItemsCount || 0;
        const pct = (missingItems || []).length > 0 ? Math.round((count / (missingItems || []).length) * 100) : 0;
        const amount = totalInvoicesSum > 0 && pct > 0 ? Math.round((totalInvoicesSum * pct) / 100) : 0;
        return {
          name: cat.name_ar,
          count,
          amount,
          pct,
          color: catColorPalette[idx % catColorPalette.length],
        };
      }).filter((c: any) => c.count > 0 || (categories || []).length <= 6);

      return {
        topCategories: topCats,
        topItems: sortedItems,
      };
    } catch (e) {
      console.warn('Analytics loading error:', e);
      return { topCategories: [], topItems: [] };
    }
  },

  // --------------------------------------------------------------------------
  // Users Management (Primary Source: public.profiles, excluding admin_users)
  // --------------------------------------------------------------------------
  async getUsers(params?: {
    search?: string;
    status?: string;
    role?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ users: AdminUserProfile[]; total: number }> {
    if (!supabase) return { users: [], total: 0 };

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 25;

    try {
      // 1. Fetch admin users to exclude admin/manager accounts from the app users list
      const { data: adminData } = await supabase
        .from('admin_users')
        .select('user_id, email');
      
      const adminUserIds = new Set<string>(
        (adminData || []).map((a: any) => a.user_id).filter(Boolean)
      );
      const adminEmails = new Set<string>(
        (adminData || []).map((a: any) => a.email?.toLowerCase().trim()).filter(Boolean)
      );

      // 2. Query registered users strictly from public.profiles
      let query = supabase.from('profiles').select('*');

      if (params?.search && params.search.trim()) {
        const s = params.search.trim();
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
        if (isUUID) {
          query = query.eq('id', s);
        } else {
          query = query.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
        }
      }

      const { data: profilesData, error: profilesError } = await query.order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // 3. Fetch households to link household admin/membership roles
      const { data: householdsData } = await supabase
        .from('households')
        .select('id, name, admin_id');
      const householdMap = new Map<string, { id: string; name: string }>();
      (householdsData || []).forEach((h: any) => {
        if (h.admin_id) householdMap.set(h.admin_id, { id: h.id, name: h.name });
      });

      // 4. Map profiles, strictly excluding admin/manager accounts ("وليس المدير")
      const localBlockedUsers = this.getLocalBlockedUsers();
      let mapped: AdminUserProfile[] = (profilesData || [])
        .filter((p: any) => {
          if (adminUserIds.has(p.id)) return false;
          if (p.email && adminEmails.has(p.email.toLowerCase().trim())) return false;
          return true;
        })
        .map((p: any) => {
          const hh = householdMap.get(p.id);
          const householdId = hh?.id || null;
          const householdName = hh?.name || undefined;
          const role = hh ? 'admin' : 'guest';

          const isBlocked = Boolean(
            p.is_blocked ||
            p.status === 'blocked' ||
            localBlockedUsers[p.id]
          );
          const blockedReason = p.blocked_reason || localBlockedUsers[p.id]?.reason;
          const blockedAt = p.blocked_at || localBlockedUsers[p.id]?.blocked_at;

          let status: any = 'active';
          if (isBlocked) status = 'blocked';
          else if (!p.full_name || !p.email) status = 'incomplete';
          else if (!householdId) status = 'unlinked';
          else if (role === 'admin') status = 'admin';
          else status = 'user';

          return {
            id: p.id,
            email: p.email || '—',
            full_name: p.full_name || 'مستخدم بدون اسم',
            phone: p.phone || '',
            avatar_url: p.avatar_url || '',
            household_id: householdId,
            household_name: householdName,
            role: role as 'admin' | 'home' | 'guest',
            is_blocked: isBlocked,
            blocked_reason: blockedReason,
            blocked_at: blockedAt,
            blocked_by: p.blocked_by,
            status: status,
            created_at: p.created_at || p.updated_at || new Date().toISOString(),
            updated_at: p.updated_at || new Date().toISOString(),
            last_sign_in_at: p.last_sign_in_at,
          };
        });

      // 5. Apply UI filters
      if (params?.status && params.status !== 'all') {
        if (params.status === 'blocked') mapped = mapped.filter((u) => u.is_blocked);
        if (params.status === 'active') mapped = mapped.filter((u) => !u.is_blocked);
      }

      if (params?.role && params.role !== 'all') {
        mapped = mapped.filter((u) => u.role === params.role);
      }

      const total = mapped.length;
      const offset = (page - 1) * pageSize;
      const paginatedUsers = mapped.slice(offset, offset + pageSize);

      return { users: paginatedUsers, total };
    } catch (err) {
      console.warn('Error fetching users from profiles:', err);
      return { users: [], total: 0 };
    }
  },

  async getUserDetails(userId: string): Promise<any> {
    if (!supabase || !userId) return null;
    try {
      const [
        { data: profile },
        { data: households },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('households').select('*').eq('admin_id', userId),
      ]);

      let missingItems: any[] = [];
      let invoices: any[] = [];

      const userHouseholdIds = (households || []).map((h: any) => h.id);
      if (userHouseholdIds.length > 0) {
        const [mRes, iRes] = await Promise.all([
          supabase.from('missing_items').select('*').in('household_id', userHouseholdIds).order('added_at', { ascending: false }).limit(20),
          supabase.from('invoices').select('*').in('household_id', userHouseholdIds).order('date', { ascending: false }).limit(20),
        ]);
        missingItems = mRes.data || [];
        invoices = iRes.data || [];
      }

      return {
        profile,
        households: households || [],
        missingItems,
        invoices,
      };
    } catch (err) {
      console.error('Error fetching user details:', err);
      return null;
    }
  },

  getLocalBlockedUsers(): Record<string, { reason: string; blocked_at: string }> {
    try {
      const val = localStorage.getItem('tb_admin_blocked_users');
      return val ? JSON.parse(val) : {};
    } catch {
      return {};
    }
  },

  saveLocalBlockedUsers(data: Record<string, { reason: string; blocked_at: string }>) {
    try {
      localStorage.setItem('tb_admin_blocked_users', JSON.stringify(data));
    } catch {}
  },

  async blockUser(targetUserId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase غير متصل' };

    try {
      // 1. Keep local cache for immediate UI reactivity
      const blockedCache = this.getLocalBlockedUsers();
      blockedCache[targetUserId] = { reason, blocked_at: new Date().toISOString() };
      this.saveLocalBlockedUsers(blockedCache);

      // 2. Try secure RPC
      try {
        const { data, error } = await supabase.rpc('admin_block_user', {
          p_target_user_id: targetUserId,
          p_reason: reason,
        });
        if (!error && data?.success) {
          await this.logAuditAction('USER_BLOCKED', 'USER', targetUserId, { reason });
          return { success: true };
        }
      } catch (_) {}

      // 3. Update public.profiles status directly
      const payloads = [
        {
          status: 'blocked',
          is_blocked: true,
          blocked_reason: reason,
          blocked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          status: 'blocked',
          updated_at: new Date().toISOString(),
        },
        {
          is_blocked: true,
          updated_at: new Date().toISOString(),
        },
      ];

      for (const payload of payloads) {
        const { error: updateErr } = await supabase
          .from('profiles')
          .update(payload)
          .eq('id', targetUserId);

        if (!updateErr) {
          break;
        }
      }

      // 4. Log audit
      await this.logAuditAction('USER_BLOCKED', 'USER', targetUserId, { reason });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل حظر المستخدم' };
    }
  },

  async unblockUser(targetUserId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase غير متصل' };

    try {
      // 1. Remove from local cache
      const blockedCache = this.getLocalBlockedUsers();
      delete blockedCache[targetUserId];
      this.saveLocalBlockedUsers(blockedCache);

      // 2. Try RPC
      try {
        const { data, error } = await supabase.rpc('admin_unblock_user', {
          p_target_user_id: targetUserId,
        });
        if (!error && data?.success) {
          await this.logAuditAction('USER_UNBLOCKED', 'USER', targetUserId, {});
          return { success: true };
        }
      } catch (_) {}

      // 3. Update public.profiles status directly
      const payloads = [
        {
          status: 'active',
          is_blocked: false,
          blocked_reason: null,
          blocked_at: null,
          blocked_by: null,
          updated_at: new Date().toISOString(),
        },
        {
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        {
          is_blocked: false,
          updated_at: new Date().toISOString(),
        },
      ];

      for (const payload of payloads) {
        const { error: updateErr } = await supabase
          .from('profiles')
          .update(payload)
          .eq('id', targetUserId);

        if (!updateErr) {
          break;
        }
      }

      await this.logAuditAction('USER_UNBLOCKED', 'USER', targetUserId, {});

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل إلغاء الحظر' };
    }
  },

  async deleteUserAccount(targetUserId: string): Promise<{
    success: boolean;
    profileDeleted?: boolean;
    authDeleted?: boolean;
    authWarning?: string;
    blockedByActiveOrders?: boolean;
    activeOrdersCount?: number;
    error?: string;
  }> {
    if (!supabase) return { success: false, error: 'Supabase غير متصل' };
    if (!targetUserId) return { success: false, error: 'معرف المستخدم مطلوب' };

    const ACTIVE_ORDER_STATUSES = [
      'pending_review',
      'accepted',
      'shopping',
      'shopping_completed',
      'cancellation_pending',
    ];

    try {
      // 1. Protect administrative accounts from accidental deletion via Users screen
      const { data: adminCheck } = await supabase
        .from('admin_users')
        .select('id, role, email')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (adminCheck) {
        return {
          success: false,
          error: 'لا يمكن حذف حساب مشرف إداري من شاشة المستخدمين. يرجى استخدام إدارة فريق المشرفين.',
        };
      }

      // 2. Fetch current profile record to verify existence and capture audit metadata
      const { data: profileRow, error: profileFetchErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq('id', targetUserId)
        .maybeSingle();

      if (profileFetchErr) {
        return {
          success: false,
          error: `تعذر التحقق من سجل المستخدم في جدول profiles: ${profileFetchErr.message}`,
        };
      }

      if (!profileRow) {
        return {
          success: false,
          error: 'لم يتم العثور على سجل المستخدم في جدول profiles أو تم حذفه مسبقًا.',
        };
      }

      // 3. Check linked households (both admin_id and household_members) & active delivery orders
      const [
        { data: adminHouseholds, error: hhErr },
        { data: memberHouseholds, error: hmErr },
      ] = await Promise.all([
        supabase.from('households').select('id').eq('admin_id', targetUserId),
        supabase.from('household_members').select('household_id').eq('user_id', targetUserId),
      ]);

      if (hhErr) {
        return {
          success: false,
          error: `تعذر فحص أسر المستخدم قبل الحذف: ${hhErr.message}`,
        };
      }
      if (hmErr) {
        return {
          success: false,
          error: `تعذر فحص عضوية الأسرة للمستخدم قبل الحذف: ${hmErr.message}`,
        };
      }

      const adminHouseholdIds = (adminHouseholds || []).map((h: any) => h.id).filter(Boolean);
      const memberHouseholdIds = (memberHouseholds || []).map((m: any) => m.household_id).filter(Boolean);
      const allUserHouseholdIds = Array.from(new Set([...adminHouseholdIds, ...memberHouseholdIds]));

      if (allUserHouseholdIds.length > 0) {
        const { data: householdOrders, error: hhOrdersErr } = await supabase
          .from('delivery_orders')
          .select('id, status')
          .in('household_id', allUserHouseholdIds);

        if (hhOrdersErr) {
          return {
            success: false,
            error: `تعذر فحص طلبات التوصيل المرتبطة بأسرة المستخدم قبل الحذف: ${hhOrdersErr.message}`,
          };
        }

        const activeHouseholdOrders = (householdOrders || []).filter(
          (o: any) => ACTIVE_ORDER_STATUSES.includes(o.status) || !['completed', 'cancelled'].includes(o.status)
        );

        if (activeHouseholdOrders.length > 0) {
          return {
            success: false,
            blockedByActiveOrders: true,
            activeOrdersCount: activeHouseholdOrders.length,
            error: `لا يمكن حذف هذا الحساب حاليًا لوجود (${activeHouseholdOrders.length}) طلب توصيل نشط قيد التنفيذ أو المراجعة مرتبط بأسرة المستخدم. يرجى إتمام أو إلغاء الطلب النشط أولًا.`,
          };
        }
      }

      // Check active delivery orders by user's phone number
      if (profileRow.phone && profileRow.phone.trim()) {
        const cleanPhone = profileRow.phone.trim();
        const { data: phoneOrders, error: phoneOrdersErr } = await supabase
          .from('delivery_orders')
          .select('id, status')
          .or(`customer_phone.eq.${cleanPhone},phone_number.eq.${cleanPhone}`);

        if (phoneOrdersErr) {
          return {
            success: false,
            error: `تعذر فحص طلبات التوصيل المرتبطة برقم هاتف المستخدم قبل الحذف: ${phoneOrdersErr.message}`,
          };
        }

        const activePhoneOrders = (phoneOrders || []).filter(
          (o: any) => ACTIVE_ORDER_STATUSES.includes(o.status) || !['completed', 'cancelled'].includes(o.status)
        );

        if (activePhoneOrders.length > 0) {
          return {
            success: false,
            blockedByActiveOrders: true,
            activeOrdersCount: activePhoneOrders.length,
            error: `لا يمكن حذف هذا الحساب حاليًا لوجود (${activePhoneOrders.length}) طلب توصيل نشط قيد التنفيذ أو المراجعة مرتبط برقم هاتف المستخدم. يرجى إتمام أو إلغاء الطلب النشط أولًا.`,
          };
        }
      }

      // Check if user also has a delivery_drivers record with active orders
      const { data: linkedDriver } = await supabase
        .from('delivery_drivers')
        .select('id')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (linkedDriver?.id) {
        const { data: driverOrders } = await supabase
          .from('delivery_orders')
          .select('id, status')
          .eq('assigned_driver_id', linkedDriver.id);

        const activeDriverOrders = (driverOrders || []).filter(
          (o: any) => ACTIVE_ORDER_STATUSES.includes(o.status) || !['completed', 'cancelled'].includes(o.status)
        );

        if (activeDriverOrders.length > 0) {
          return {
            success: false,
            blockedByActiveOrders: true,
            activeOrdersCount: activeDriverOrders.length,
            error: `لا يمكن حذف هذا الحساب لأنه مرتبط بسجل دليفري لديه (${activeDriverOrders.length}) طلب توصيل نشط قيد التنفيذ.`,
          };
        }
      }

      // 4. Remove direct account membership rows (NEVER delete households, invoices, missing_items, or delivery_orders)
      try {
        await supabase.from('household_members').delete().eq('user_id', targetUserId);
      } catch (_) {}

      // 5. Delete the user's record from public.profiles (strictly preserving invoices & orders)
      let { error: deleteProfileErr } = await supabase
        .from('profiles')
        .delete()
        .eq('id', targetUserId);

      // If Foreign Key constraint (23503) blocks deleting profiles, safely detach nullable references
      // without deleting any historical records, households, invoices, or orders
      if (deleteProfileErr && deleteProfileErr.code === '23503') {
        if (adminHouseholdIds.length > 0) {
          try {
            await supabase
              .from('households')
              .update({ admin_id: null })
              .eq('admin_id', targetUserId);
          } catch (_) {}
        }

        try {
          await supabase
            .from('delivery_orders')
            .update({ cancellation_requested_by: null })
            .eq('cancellation_requested_by', targetUserId)
            .in('status', ['completed', 'cancelled']);
        } catch (_) {}

        if (linkedDriver?.id) {
          try {
            await supabase
              .from('delivery_drivers')
              .update({ user_id: null })
              .eq('id', linkedDriver.id);
          } catch (_) {}
        }

        const retryProfileDel = await supabase
          .from('profiles')
          .delete()
          .eq('id', targetUserId);
        deleteProfileErr = retryProfileDel.error;
      }

      if (deleteProfileErr) {
        if (deleteProfileErr.code === '23503') {
          return {
            success: false,
            profileDeleted: false,
            error: `تعذر حذف سجل المستخدم من profiles بسبب ارتباط مرجعي (Foreign Key 23503): ${deleteProfileErr.message}. لم يتم حذف أي فواتير أو بيانات تاريخية حفاظًا على سلامة السجلات.`,
          };
        }
        return {
          success: false,
          profileDeleted: false,
          error: `رفضت قاعدة البيانات حذف سجل المستخدم من جدول profiles (${deleteProfileErr.code || 'Error'}): ${deleteProfileErr.message}`,
        };
      }

      // 6. Verify that the row in public.profiles was actually deleted in the database
      const { data: verifyProfileStillExists, error: verifyProfileErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', targetUserId)
        .maybeSingle();

      if (verifyProfileErr) {
        return {
          success: false,
          profileDeleted: false,
          error: `تعذر التحقق من اختفاء سجل المستخدم من جدول profiles: ${verifyProfileErr.message}`,
        };
      }

      if (verifyProfileStillExists) {
        return {
          success: false,
          profileDeleted: false,
          error:
            'لم يتم حذف سجل المستخدم فعليًا من جدول profiles (تحقق من صلاحية DELETE للمشرف في سياسات RLS على جدول profiles).',
        };
      }

      // 7. Attempt auth.users deletion via secure Edge Function (admin-api) if deployed
      let authDeleted = false;
      try {
        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('admin-api', {
          body: {
            action: 'delete-user',
            payload: { targetUserId, confirmation: 'DELETE' },
          },
        });
        if (!edgeErr && edgeData?.success && edgeData?.authDeleted === true) {
          authDeleted = true;
        }
      } catch (_) {
        authDeleted = false;
      }

      const authWarning = authDeleted
        ? undefined
        : 'تم حذف سجل المستخدم فعليًا من جدول (profiles) مع الحفاظ الكامل على الفواتير والطلبات التاريخية. الجزء المتبقي: حذف المستخدم من (auth.users) يحتاج إلى مسار Backend / Edge Function آمن بصلاحية SUPABASE_SERVICE_ROLE_KEY.';

      // 8. Clean up local blocked cache ONLY after database deletion is verified
      const blockedCache = this.getLocalBlockedUsers();
      if (blockedCache[targetUserId]) {
        delete blockedCache[targetUserId];
        this.saveLocalBlockedUsers(blockedCache);
      }

      await this.logAuditAction('USER_ACCOUNT_DELETED', 'USER', targetUserId, {
        deleted_user_id: targetUserId,
        full_name: profileRow.full_name,
        email: profileRow.email,
        phone: profileRow.phone,
        preserved_households_count: allUserHouseholdIds.length,
        profile_deleted: true,
        auth_deleted: authDeleted,
      });

      return {
        success: true,
        profileDeleted: true,
        authDeleted,
        authWarning,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'فشل حذف حساب المستخدم',
      };
    }
  },

  async deleteUser(targetUserId: string, _confirmationText?: string): Promise<{ success: boolean; error?: string; authWarning?: string }> {
    return this.deleteUserAccount(targetUserId);
  },

  // --------------------------------------------------------------------------
  // Households Management
  // --------------------------------------------------------------------------
  async getHouseholds(params?: { search?: string; page?: number; pageSize?: number }): Promise<{
    households: AdminHousehold[];
    total: number;
  }> {
    if (!supabase) return { households: [], total: 0 };

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 20;
    const offset = (page - 1) * pageSize;

    try {
      let query = supabase.from('households').select('*', { count: 'exact' });

      if (params?.search && params.search.trim()) {
        const s = params.search.trim();
        query = query.or(`name.ilike.%${s}%,admin_name.ilike.%${s}%,admin_phone.ilike.%${s}%,id.ilike.%${s}%`);
      }

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) return { households: [], total: count || 0 };

      const householdIds = data.map((h: any) => h.id);

      // Query real related counts from database
      const [
        { data: membersData },
        { data: itemsData },
        { data: invoicesData },
      ] = await Promise.all([
        supabase.from('household_members').select('household_id').in('household_id', householdIds),
        supabase.from('missing_items').select('household_id').in('household_id', householdIds),
        supabase.from('invoices').select('household_id, total_price').in('household_id', householdIds),
      ]);

      const memberCountMap: Record<string, number> = {};
      (membersData || []).forEach((m: any) => {
        memberCountMap[m.household_id] = (memberCountMap[m.household_id] || 0) + 1;
      });

      const itemsCountMap: Record<string, number> = {};
      (itemsData || []).forEach((i: any) => {
        itemsCountMap[i.household_id] = (itemsCountMap[i.household_id] || 0) + 1;
      });

      const invoicesCountMap: Record<string, number> = {};
      const totalSpentMap: Record<string, number> = {};
      (invoicesData || []).forEach((inv: any) => {
        invoicesCountMap[inv.household_id] = (invoicesCountMap[inv.household_id] || 0) + 1;
        totalSpentMap[inv.household_id] = (totalSpentMap[inv.household_id] || 0) + (Number(inv.total_price) || 0);
      });

      // Enhance with real computed counts
      const mapped: AdminHousehold[] = data.map((h: any) => ({
        id: h.id,
        name: h.name,
        admin_id: h.admin_id,
        admin_name: h.admin_name || 'غير محدد',
        admin_phone: h.admin_phone || '',
        pair_code: h.pair_code,
        created_at: h.created_at,
        updated_at: h.updated_at,
        members_count: memberCountMap[h.id] || 1,
        missing_items_count: itemsCountMap[h.id] || 0,
        invoices_count: invoicesCountMap[h.id] || 0,
        total_spent: totalSpentMap[h.id] || 0,
      }));

      return { households: mapped, total: count || mapped.length };
    } catch (err) {
      console.warn('Error fetching households:', err);
      return { households: [], total: 0 };
    }
  },

  async getHouseholdDetails(householdId: string): Promise<any> {
    if (!supabase || !householdId) return null;
    try {
      const [
        { data: household },
        { data: members },
        { data: missingItems },
        { data: invoices },
        { data: budget },
        { data: permissions },
      ] = await Promise.all([
        supabase.from('households').select('*').eq('id', householdId).maybeSingle(),
        supabase.from('household_members').select('*').eq('household_id', householdId),
        supabase.from('missing_items').select('*').eq('household_id', householdId).order('added_at', { ascending: false }),
        supabase.from('invoices').select('*').eq('household_id', householdId).order('date', { ascending: false }),
        supabase.from('household_budgets').select('*').eq('household_id', householdId).maybeSingle(),
        supabase.from('household_permissions').select('*').eq('household_id', householdId).maybeSingle(),
      ]);

      return {
        household,
        members: members || [],
        missingItems: missingItems || [],
        invoices: invoices || [],
        budget,
        permissions,
      };
    } catch (err) {
      console.error('Error fetching household details:', err);
      return null;
    }
  },

  // --------------------------------------------------------------------------
  // Global Categories Management (Central Table: public.global_categories)
  // --------------------------------------------------------------------------
  async getGlobalCategories(): Promise<GlobalCategory[]> {
    if (!supabase) return [];
    try {
      const [catsRes, prodsRes, hhCatsRes] = await Promise.all([
        supabase
          .from('global_categories')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase.from('global_products').select('id, global_category_id'),
        supabase.from('categories').select('id, source_global_category_id'),
      ]);

      if (catsRes.error) throw catsRes.error;

      const prodCounts: Record<string, number> = {};
      (prodsRes.data || []).forEach((p: any) => {
        if (p.global_category_id) {
          prodCounts[p.global_category_id] = (prodCounts[p.global_category_id] || 0) + 1;
        }
      });

      const hhCounts: Record<string, number> = {};
      (hhCatsRes.data || []).forEach((hc: any) => {
        if (hc.source_global_category_id) {
          hhCounts[hc.source_global_category_id] = (hhCounts[hc.source_global_category_id] || 0) + 1;
        }
      });

      return (catsRes.data || []).map((row: any) => {
        const subcats: GlobalCategorySubcategory[] = Array.isArray(row.subcategories)
          ? row.subcategories.map((sc: any) => ({
              id: sc.id || `sub_${Math.random().toString(36).slice(2, 7)}`,
              nameAr: sc.nameAr || sc.name_ar || sc.name || '',
              nameEn: sc.nameEn || sc.name_en || '',
              items: Array.isArray(sc.items) ? sc.items : [],
            }))
          : [];

        const derivedCommonItems = subcats.flatMap((sc) => sc.items || []);

        return {
          id: row.id,
          name_ar: row.name_ar || '',
          name_en: row.name_en || row.name_ar || '',
          description: row.description ?? null,
          icon_name: row.icon_name ?? null,
          image_url: row.image_url || '',
          color: row.color || 'emerald',
          bg_light: row.bg_light || 'bg-emerald-50 text-emerald-800 border-emerald-200',
          badge_color: row.badge_color || 'bg-emerald-100 text-emerald-800',
          subcategories: subcats,
          sort_order: Number(row.sort_order ?? 0),
          is_active: row.is_active ?? true,
          created_at: row.created_at,
          updated_at: row.updated_at,
          common_items: derivedCommonItems,
          products_count: prodCounts[row.id] || 0,
          linked_households_count: hhCounts[row.id] || 0,
        };
      });
    } catch (err) {
      console.warn('Error fetching global categories:', err);
      return [];
    }
  },

  async upsertGlobalCategory(
    category: Partial<GlobalCategory>
  ): Promise<{ success: boolean; data?: GlobalCategory; error?: string }> {
    if (!supabase || !category.id || !category.name_ar) {
      return { success: false, error: 'بيانات القسم غير مكتملة (المعرف والاسم بالعربية مطلوبان)' };
    }

    const colorThemeMap: Record<string, { bg_light: string; badge_color: string }> = {
      emerald: {
        bg_light: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        badge_color: 'bg-emerald-100 text-emerald-800',
      },
      amber: {
        bg_light: 'bg-amber-50 text-amber-800 border-amber-200',
        badge_color: 'bg-amber-100 text-amber-800',
      },
      rose: {
        bg_light: 'bg-rose-50 text-rose-800 border-rose-200',
        badge_color: 'bg-rose-100 text-rose-800',
      },
      orange: {
        bg_light: 'bg-orange-50 text-orange-800 border-orange-200',
        badge_color: 'bg-orange-100 text-orange-800',
      },
      indigo: {
        bg_light: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        badge_color: 'bg-indigo-100 text-indigo-800',
      },
      cyan: {
        bg_light: 'bg-cyan-50 text-cyan-800 border-cyan-200',
        badge_color: 'bg-cyan-100 text-cyan-800',
      },
      purple: {
        bg_light: 'bg-purple-50 text-purple-800 border-purple-200',
        badge_color: 'bg-purple-100 text-purple-800',
      },
      blue: {
        bg_light: 'bg-blue-50 text-blue-800 border-blue-200',
        badge_color: 'bg-blue-100 text-blue-800',
      },
    };

    try {
      const chosenColor = category.color || 'emerald';
      const theme = colorThemeMap[chosenColor] || colorThemeMap.emerald;
      const nowIso = new Date().toISOString();

      // Exact columns existing in public.global_categories
      const payload: Record<string, any> = {
        id: category.id.trim(),
        name_ar: category.name_ar.trim(),
        name_en: (category.name_en || category.name_ar).trim(),
        description: category.description !== undefined ? category.description : '',
        icon_name: category.icon_name !== undefined ? category.icon_name : '🛒',
        image_url:
          category.image_url ||
          'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
        color: chosenColor,
        bg_light: category.bg_light || theme.bg_light,
        badge_color: category.badge_color || theme.badge_color,
        subcategories: Array.isArray(category.subcategories) ? category.subcategories : [],
        sort_order: Number(category.sort_order ?? 0),
        is_active: category.is_active ?? true,
        updated_at: nowIso,
      };

      const { data: savedRow, error } = await supabase
        .from('global_categories')
        .upsert(payload, { onConflict: 'id' })
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (!savedRow) {
        return {
          success: false,
          error: 'لم يتم تأكيد حفظ القسم في جدول global_categories (تحقق من صلاحيات المشرف RLS).',
        };
      }

      // Sync linked non-custom household categories referencing source_global_category_id
      try {
        await supabase
          .from('categories')
          .update({
            name_ar: payload.name_ar,
            name_en: payload.name_en,
            description: payload.description,
            image_url: payload.image_url,
            color: payload.color,
            bg_light: payload.bg_light,
            badge_color: payload.badge_color,
            sort_order: payload.sort_order,
            is_active: payload.is_active,
            updated_at: nowIso,
          })
          .eq('source_global_category_id', payload.id)
          .eq('is_custom', false);
      } catch (_) {}

      await this.logAuditAction('CATEGORY_UPSERTED', 'CATEGORY', payload.id, {
        name_ar: payload.name_ar,
        name_en: payload.name_en,
        is_active: payload.is_active,
      });

      return { success: true, data: savedRow as GlobalCategory };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل حفظ القسم في global_categories' };
    }
  },

  async toggleCategoryActive(categoryId: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase غير متصل' };

    try {
      const nowIso = new Date().toISOString();
      const { data: updatedRow, error } = await supabase
        .from('global_categories')
        .update({ is_active: isActive, updated_at: nowIso })
        .eq('id', categoryId)
        .select('id, is_active')
        .maybeSingle();

      if (error) throw error;
      if (!updatedRow) {
        return { success: false, error: 'لم يتم العثور على القسم أو تعذر تحديث حالته في قاعدة البيانات' };
      }

      // Sync active status to linked household categories
      try {
        await supabase
          .from('categories')
          .update({ is_active: isActive, updated_at: nowIso })
          .eq('source_global_category_id', categoryId)
          .eq('is_custom', false);
      } catch (_) {}

      await this.logAuditAction(
        isActive ? 'CATEGORY_ACTIVATED' : 'CATEGORY_DEACTIVATED',
        'CATEGORY',
        categoryId,
        { is_active: isActive }
      );

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل تغيير حالة القسم' };
    }
  },

  async deleteGlobalCategory(categoryId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase غير متصل' };

    try {
      // 1. Check if global_products reference this category
      const { count: linkedProductsCount, error: prodCheckErr } = await supabase
        .from('global_products')
        .select('*', { count: 'exact', head: true })
        .eq('global_category_id', categoryId);

      if (prodCheckErr) throw prodCheckErr;

      if ((linkedProductsCount || 0) > 0) {
        return {
          success: false,
          error: `لا يمكن حذف هذا القسم لأنه مرتبط بـ (${linkedProductsCount}) منتج في جدول global_products. يرجى نقل المنتجات أو حذفها أولاً، أو تعطيل القسم بدلاً من حذفه.`,
        };
      }

      // 2. Detach any household categories referencing source_global_category_id so household data is preserved
      await supabase
        .from('categories')
        .update({ source_global_category_id: null, is_custom: true })
        .eq('source_global_category_id', categoryId);

      // 3. Delete from global_categories
      const { error } = await supabase.from('global_categories').delete().eq('id', categoryId);
      if (error) throw error;

      // 4. Verify deletion in database
      const { data: verifyStillExists } = await supabase
        .from('global_categories')
        .select('id')
        .eq('id', categoryId)
        .maybeSingle();

      if (verifyStillExists) {
        return {
          success: false,
          error: 'لم يتم حذف القسم فعليًا من جدول global_categories (تحقق من صلاحية DELETE في RLS).',
        };
      }

      await this.logAuditAction('CATEGORY_DELETED', 'CATEGORY', categoryId, {});

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل حذف القسم' };
    }
  },

  // --------------------------------------------------------------------------
  // Global Products Catalog Management (Central Table: public.global_products)
  // --------------------------------------------------------------------------
  async getProducts(params?: {
    categoryId?: string;
    subcategoryId?: string;
    search?: string;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ products: AdminProduct[]; total: number }> {
    if (!supabase) return { products: [], total: 0 };

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 30;
    const offset = (page - 1) * pageSize;

    try {
      // Load categories map to enrich product category & subcategory labels
      const { data: catsData } = await supabase
        .from('global_categories')
        .select('id, name_ar, name_en, icon_name, color, subcategories');

      const catMap = new Map<string, any>();
      (catsData || []).forEach((c: any) => {
        catMap.set(c.id, c);
      });

      let query = supabase.from('global_products').select('*', { count: 'exact' });

      if (params?.categoryId && params.categoryId !== 'all') {
        query = query.eq('global_category_id', params.categoryId);
      }

      if (params?.subcategoryId && params.subcategoryId !== 'all') {
        query = query.eq('subcategory_id', params.subcategoryId);
      }

      if (params?.isActive !== undefined) {
        query = query.eq('is_active', params.isActive);
      }

      if (params?.search && params.search.trim()) {
        const s = params.search.trim();
        query = query.or(`name_ar.ilike.%${s}%,name_en.ilike.%${s}%,id.ilike.%${s}%`);
      }

      const { data, count, error } = await query
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      const mapped: AdminProduct[] = (data || []).map((row: any) => {
        const cat = catMap.get(row.global_category_id);
        let subcatNameAr = '';
        if (row.subcategory_id && cat && Array.isArray(cat.subcategories)) {
          const foundSub = cat.subcategories.find((sc: any) => sc.id === row.subcategory_id);
          if (foundSub) {
            subcatNameAr = foundSub.nameAr || foundSub.name_ar || foundSub.name || '';
          }
        }

        return {
          id: row.id,
          global_category_id: row.global_category_id,
          category_id: row.global_category_id,
          subcategory_id: row.subcategory_id ?? null,
          subcategory_name_ar: subcatNameAr || undefined,
          category: cat
            ? {
                id: cat.id,
                name: cat.name_ar,
                name_ar: cat.name_ar,
                icon: cat.icon_name || '🛒',
                color: cat.color || 'emerald',
              }
            : undefined,
          name: row.name_ar,
          name_ar: row.name_ar,
          name_en: row.name_en ?? '',
          default_unit: row.default_unit || 'قطعة',
          default_quantity: String(row.default_quantity ?? '1'),
          estimated_price:
            row.estimated_price !== null && row.estimated_price !== undefined
              ? Number(row.estimated_price)
              : null,
          image_url: row.image_url ?? '',
          sort_order: Number(row.sort_order ?? 0),
          is_active: row.is_active ?? true,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      });

      return { products: mapped, total: count || 0 };
    } catch (err) {
      console.warn('Error fetching global_products:', err);
      return { products: [], total: 0 };
    }
  },

  async upsertProduct(
    product: Partial<GlobalProduct>
  ): Promise<{ success: boolean; data?: GlobalProduct; error?: string }> {
    const globalCategoryId = product.global_category_id || product.category_id;
    if (!supabase || !product.id || !product.name_ar || !globalCategoryId) {
      return {
        success: false,
        error: 'بيانات المنتج غير مكتملة (المعرف، الاسم بالعربية، والقسم الرئيسي مطلوبة)',
      };
    }

    try {
      const nowIso = new Date().toISOString();
      // Exact columns in public.global_products
      const payload: Record<string, any> = {
        id: product.id.trim(),
        global_category_id: globalCategoryId,
        subcategory_id: product.subcategory_id ? product.subcategory_id.trim() : null,
        name_ar: product.name_ar.trim(),
        name_en: (product.name_en || '').trim() || null,
        image_url: (product.image_url || '').trim() || null,
        default_unit: (product.default_unit || product.unit || 'قطعة').trim(),
        default_quantity: String(product.default_quantity ?? '1').trim(),
        estimated_price:
          product.estimated_price !== undefined &&
          product.estimated_price !== null &&
          String(product.estimated_price) !== ''
            ? Number(product.estimated_price)
            : null,
        sort_order: Number(product.sort_order ?? 0),
        is_active: product.is_active ?? true,
        updated_at: nowIso,
      };

      const { data: savedRow, error } = await supabase
        .from('global_products')
        .upsert(payload, { onConflict: 'id' })
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (!savedRow) {
        return {
          success: false,
          error: 'لم يتم تأكيد حفظ المنتج في جدول global_products (تحقق من صلاحيات المشرف RLS).',
        };
      }

      await this.logAuditAction('PRODUCT_UPSERTED', 'PRODUCT', payload.id, {
        name_ar: payload.name_ar,
        global_category_id: payload.global_category_id,
        estimated_price: payload.estimated_price,
      });

      return { success: true, data: savedRow as GlobalProduct };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل حفظ المنتج في global_products' };
    }
  },

  async toggleProductActive(productId: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase غير متصل' };

    try {
      const { data: updatedRow, error } = await supabase
        .from('global_products')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', productId)
        .select('id, is_active')
        .maybeSingle();

      if (error) throw error;
      if (!updatedRow) {
        return { success: false, error: 'تعذر تحديث حالة المنتج في جدول global_products' };
      }

      await this.logAuditAction(
        isActive ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED',
        'PRODUCT',
        productId,
        { is_active: isActive }
      );

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل تغيير حالة المنتج' };
    }
  },

  async deleteProduct(productId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase غير متصل' };

    try {
      const { error } = await supabase.from('global_products').delete().eq('id', productId);
      if (error) throw error;

      // Verify deletion in database
      const { data: verifyStillExists } = await supabase
        .from('global_products')
        .select('id')
        .eq('id', productId)
        .maybeSingle();

      if (verifyStillExists) {
        return {
          success: false,
          error: 'لم يتم حذف المنتج فعليًا من جدول global_products (تحقق من صلاحية DELETE في RLS).',
        };
      }

      await this.logAuditAction('PRODUCT_DELETED', 'PRODUCT', productId, {});

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل حذف المنتج' };
    }
  },

  // --------------------------------------------------------------------------
  // Audit Logs
  // --------------------------------------------------------------------------
  async getAuditLogs(params?: {
    adminEmail?: string;
    action?: string;
    entityType?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ logs: AdminAuditLog[]; total: number }> {
    if (!supabase) return { logs: [], total: 0 };

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 30;
    const offset = (page - 1) * pageSize;

    try {
      let query = supabase.from('admin_audit_logs').select('*', { count: 'exact' });

      if (params?.action && params.action !== 'all') {
        query = query.eq('action', params.action);
      }
      if (params?.entityType && params.entityType !== 'all') {
        query = query.eq('entity_type', params.entityType);
      }
      if (params?.adminEmail && params.adminEmail.trim()) {
        query = query.ilike('admin_email', `%${params.adminEmail.trim()}%`);
      }

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      return { logs: (data || []) as AdminAuditLog[], total: count || 0 };
    } catch (err) {
      console.warn('Error fetching audit logs:', err);
      return { logs: [], total: 0 };
    }
  },

  async logAuditAction(action: string, entityType: string, entityId: string, details: any): Promise<void> {
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
      console.warn('Could not record audit log:', e);
    }
  },

  // --------------------------------------------------------------------------
  // Central Notifications Management (public.admin_notifications & public.admin_notification_views)
  // --------------------------------------------------------------------------
  async getAdminNotifications(): Promise<AdminBroadcastNotification[]> {
    if (!supabase) return [];
    try {
      const [notifsRes, viewsRes] = await Promise.all([
        supabase
          .from('admin_notifications')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('admin_notification_views')
          .select('id, notification_id, user_id, household_id, dismissed_at, created_at'),
      ]);

      if (notifsRes.error) throw notifsRes.error;

      const viewsByNotif = new Map<
        string,
        {
          total: number;
          dismissed: number;
          users: Set<string>;
          households: Set<string>;
        }
      >();

      (viewsRes.data || []).forEach((v: any) => {
        const nid = v.notification_id;
        if (!nid) return;
        if (!viewsByNotif.has(nid)) {
          viewsByNotif.set(nid, {
            total: 0,
            dismissed: 0,
            users: new Set<string>(),
            households: new Set<string>(),
          });
        }
        const entry = viewsByNotif.get(nid)!;
        entry.total += 1;
        if (v.dismissed_at) entry.dismissed += 1;
        if (v.user_id) entry.users.add(String(v.user_id));
        if (v.household_id) entry.households.add(String(v.household_id));
      });

      return (notifsRes.data || []).map((row: any) => {
        const stat = viewsByNotif.get(row.id);
        return {
          id: row.id,
          title: row.title || '',
          body: row.body || '',
          type: row.type || 'top_banner',
          icon_name: row.icon_name ?? null,
          image_url: row.image_url ?? null,
          action_type: row.action_type ?? 'none',
          action_route: row.action_route ?? null,
          is_active: row.is_active ?? true,
          start_at: row.start_at ?? null,
          end_at: row.end_at ?? null,
          created_by: row.created_by ?? null,
          created_at: row.created_at,
          updated_at: row.updated_at,
          sent_at: row.created_at,
          priority: row.type || 'top_banner',
          target_type: 'all',
          views_count: stat ? stat.total : 0,
          dismissed_count: stat ? stat.dismissed : 0,
          unique_users_count: stat ? stat.users.size : 0,
          unique_households_count: stat ? stat.households.size : 0,
        };
      });
    } catch (err) {
      console.warn('Error fetching admin_notifications:', err);
      return [];
    }
  },

  async getNotificationViewsDetails(notificationId: string): Promise<AdminNotificationView[]> {
    if (!supabase || !notificationId) return [];
    try {
      const { data: views, error } = await supabase
        .from('admin_notification_views')
        .select('*')
        .eq('notification_id', notificationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!views || views.length === 0) return [];

      const userIds = Array.from(new Set(views.map((v: any) => v.user_id).filter(Boolean)));
      const householdIds = Array.from(new Set(views.map((v: any) => v.household_id).filter(Boolean)));

      const [profilesRes, householdsRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from('profiles').select('id, full_name, email').in('id', userIds)
          : Promise.resolve({ data: [] }),
        householdIds.length > 0
          ? supabase.from('households').select('id, name').in('id', householdIds)
          : Promise.resolve({ data: [] }),
      ]);

      const userMap = new Map<string, { full_name?: string; email?: string }>();
      (profilesRes.data || []).forEach((p: any) => {
        userMap.set(p.id, { full_name: p.full_name, email: p.email });
      });

      const hhMap = new Map<string, string>();
      (householdsRes.data || []).forEach((h: any) => {
        hhMap.set(h.id, h.name);
      });

      return views.map((v: any) => {
        const u = v.user_id ? userMap.get(v.user_id) : undefined;
        const hhName = v.household_id ? hhMap.get(v.household_id) : undefined;
        return {
          id: v.id,
          notification_id: v.notification_id,
          user_id: v.user_id ?? null,
          household_id: v.household_id ?? null,
          dismissed_at: v.dismissed_at ?? null,
          created_at: v.created_at,
          user_name: u?.full_name || (v.user_id ? `مستخدم #${String(v.user_id).slice(0, 6)}` : undefined),
          user_email: u?.email || undefined,
          household_name: hhName || (v.household_id ? `منزل #${String(v.household_id).slice(0, 6)}` : undefined),
        };
      });
    } catch (err) {
      console.warn('Error fetching notification views details:', err);
      return [];
    }
  },

  async createAdminNotification(payload: {
    title: string;
    body: string;
    type?: string;
    icon_name?: string | null;
    image_url?: string | null;
    action_type?: string | null;
    action_route?: string | null;
    is_active?: boolean;
    start_at?: string | null;
    end_at?: string | null;
  }): Promise<{ success: boolean; data?: AdminNotification; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase غير متصل' };
    if (!payload.title?.trim() || !payload.body?.trim()) {
      return { success: false, error: 'عنوان ونص الإشعار مطلوبان' };
    }

    try {
      const { data: u } = await supabase.auth.getUser();
      const nowIso = new Date().toISOString();

      // Exact columns in public.admin_notifications
      const record: Record<string, any> = {
        title: payload.title.trim(),
        body: payload.body.trim(),
        type: payload.type || 'top_banner',
        icon_name: payload.icon_name?.trim() || null,
        image_url: payload.image_url?.trim() || null,
        action_type: payload.action_type && payload.action_type !== 'none' ? payload.action_type : null,
        action_route:
          payload.action_type && payload.action_type !== 'none' && payload.action_route?.trim()
            ? payload.action_route.trim()
            : null,
        is_active: payload.is_active ?? true,
        start_at: payload.start_at || nowIso,
        end_at: payload.end_at || null,
        created_by: u?.user?.id || null,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const { data: insertedRow, error } = await supabase
        .from('admin_notifications')
        .insert(record)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (!insertedRow) {
        return {
          success: false,
          error: 'لم يتم تأكيد إنشاء الإشعار في جدول admin_notifications (تحقق من صلاحيات المشرف RLS).',
        };
      }

      await this.logAuditAction('NOTIFICATION_SENT', 'NOTIFICATION', insertedRow.id, {
        title: record.title,
        type: record.type,
        is_active: record.is_active,
      });

      return { success: true, data: insertedRow as AdminNotification };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل إرسال الإشعار في جدول admin_notifications' };
    }
  },

  async updateAdminNotification(
    notificationId: string,
    updates: Partial<{
      title: string;
      body: string;
      type: string;
      icon_name: string | null;
      image_url: string | null;
      action_type: string | null;
      action_route: string | null;
      is_active: boolean;
      start_at: string | null;
      end_at: string | null;
    }>
  ): Promise<{ success: boolean; data?: AdminNotification; error?: string }> {
    if (!supabase || !notificationId) {
      return { success: false, error: 'معرف الإشعار مطلوب' };
    }

    try {
      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.title !== undefined) payload.title = updates.title.trim();
      if (updates.body !== undefined) payload.body = updates.body.trim();
      if (updates.type !== undefined) payload.type = updates.type;
      if (updates.icon_name !== undefined) payload.icon_name = updates.icon_name?.trim() || null;
      if (updates.image_url !== undefined) payload.image_url = updates.image_url?.trim() || null;
      if (updates.action_type !== undefined) {
        payload.action_type = updates.action_type && updates.action_type !== 'none' ? updates.action_type : null;
      }
      if (updates.action_route !== undefined) {
        payload.action_route = updates.action_route?.trim() || null;
      }
      if (updates.is_active !== undefined) payload.is_active = Boolean(updates.is_active);
      if (updates.start_at !== undefined) payload.start_at = updates.start_at || null;
      if (updates.end_at !== undefined) payload.end_at = updates.end_at || null;

      const { data: updatedRow, error } = await supabase
        .from('admin_notifications')
        .update(payload)
        .eq('id', notificationId)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (!updatedRow) {
        return { success: false, error: 'لم يتم العثور على الإشعار أو تعذر تحديثه في قاعدة البيانات' };
      }

      await this.logAuditAction('NOTIFICATION_UPDATED', 'NOTIFICATION', notificationId, payload);

      return { success: true, data: updatedRow as AdminNotification };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل تحديث الإشعار' };
    }
  },

  async toggleAdminNotificationActive(
    notificationId: string,
    isActive: boolean
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateAdminNotification(notificationId, { is_active: isActive });
  },

  async deleteAdminNotification(notificationId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !notificationId) {
      return { success: false, error: 'معرف الإشعار مطلوب' };
    }

    try {
      // Remove view records first so FK never blocks deletion
      await supabase.from('admin_notification_views').delete().eq('notification_id', notificationId);

      const { error } = await supabase.from('admin_notifications').delete().eq('id', notificationId);
      if (error) throw error;

      const { data: verifyStillExists } = await supabase
        .from('admin_notifications')
        .select('id')
        .eq('id', notificationId)
        .maybeSingle();

      if (verifyStillExists) {
        return {
          success: false,
          error: 'لم يتم حذف الإشعار فعليًا من جدول admin_notifications (تحقق من صلاحية DELETE في RLS).',
        };
      }

      await this.logAuditAction('NOTIFICATION_DELETED', 'NOTIFICATION', notificationId, {});

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل حذف الإشعار' };
    }
  },

  async getAnnouncements(): Promise<AppAnnouncement[]> {
    const list = await this.getAdminNotifications();
    return list.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.body,
      body: n.body,
      type: n.type,
      icon_name: n.icon_name,
      image_url: n.image_url,
      action_type: n.action_type,
      action_route: n.action_route,
      is_active: n.is_active,
      start_at: n.start_at,
      end_at: n.end_at,
      expires_at: n.end_at,
      created_by: n.created_by,
      created_at: n.created_at,
      updated_at: n.updated_at,
      views_count: n.views_count,
      dismissed_count: n.dismissed_count,
    }));
  },

  async sendAnnouncement(payload: {
    title: string;
    message: string;
    type?: string;
    icon_name?: string | null;
    image_url?: string | null;
    action_type?: string | null;
    action_route?: string | null;
    is_active?: boolean;
    start_at?: string | null;
    end_at?: string | null;
    targetType?: string;
    targetId?: string;
    targetRole?: string;
  }): Promise<{ success: boolean; error?: string }> {
    return this.createAdminNotification({
      title: payload.title,
      body: payload.message,
      type: payload.type || 'top_banner',
      icon_name: payload.icon_name,
      image_url: payload.image_url,
      action_type: payload.action_type,
      action_route: payload.action_route,
      is_active: payload.is_active ?? true,
      start_at: payload.start_at,
      end_at: payload.end_at,
    });
  },

  // --------------------------------------------------------------------------
  // Admin Users & Super Admin Management
  // --------------------------------------------------------------------------
  async getAdminUsers(): Promise<AdminUser[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as AdminUser[];
    } catch (err) {
      console.warn('Error fetching admin users:', err);
      return [];
    }
  },

  async upsertAdminUser(admin: {
    user_id: string;
    email: string;
    full_name?: string;
    role: AdminRole;
    custom_permissions?: string[];
    is_active?: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !admin.user_id || !admin.email) {
      return { success: false, error: 'بيانات المشرف غير مكتملة' };
    }

    try {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        user_id: admin.user_id,
        email: admin.email,
        full_name: admin.full_name || '',
        role: admin.role,
        custom_permissions: admin.custom_permissions || [],
        is_active: admin.is_active ?? true,
        updated_at: new Date().toISOString(),
      };

      if (u?.user?.id) payload.created_by = u.user.id;

      const { error } = await supabase.from('admin_users').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;

      await this.logAuditAction('ADMIN_UPDATED', 'ADMIN', admin.user_id, { role: admin.role });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل تحديث المشرف' };
    }
  },

  async deleteAdminUser(adminUserId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase غير متصل' };

    try {
      const { error } = await supabase.from('admin_users').delete().eq('id', adminUserId);
      if (error) throw error;

      await this.logAuditAction('ADMIN_DELETED', 'ADMIN', adminUserId, {});

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل حذف المشرف' };
    }
  },

  // --------------------------------------------------------------------------
  // System Settings & Feature Flags
  // --------------------------------------------------------------------------
  async getSystemSettings(): Promise<Record<string, any>> {
    if (!supabase) return {};
    try {
      const { data, error } = await supabase.from('app_system_settings').select('*');
      if (error) throw error;

      const result: Record<string, any> = {};
      (data || []).forEach((row: any) => {
        result[row.key] = row.value;
      });
      return result;
    } catch (err) {
      console.warn('Error fetching system settings:', err);
      return {};
    }
  },

  async saveSystemSetting(key: string, value: any, description?: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !key) return { success: false, error: 'مفتاح الإعداد مطلوب' };

    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from('app_system_settings').upsert(
        {
          key,
          value,
          description,
          updated_by: u?.user?.id || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );

      if (error) throw error;

      await this.logAuditAction('SETTINGS_SAVED', 'SETTINGS', key, { value });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل حفظ الإعداد' };
    }
  },

  async deleteHousehold(householdId: string, confirmationText: string): Promise<{ success: boolean; error?: string }> {

    if (!supabase) return { success: false, error: 'Supabase غير متصل' };
    if (confirmationText !== 'DELETE') {
      return { success: false, error: 'يجب كتابة DELETE لتأكيد الحذف' };
    }

    try {
      await supabase.from('household_members').delete().eq('household_id', householdId);
      await supabase.from('missing_items').delete().eq('household_id', householdId);
      await supabase.from('invoices').delete().eq('household_id', householdId);
      const { error } = await supabase.from('households').delete().eq('id', householdId);
      if (error) throw error;

      await this.logAuditAction('HOUSEHOLD_DELETED', 'HOUSEHOLD', householdId, {});
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل حذف المنزل' };
    }
  },

  // --------------------------------------------------------------------------
  // Categories & Products Helpers
  // --------------------------------------------------------------------------
  async getCategories(): Promise<AdminCategory[]> {
    const raw = await this.getGlobalCategories();
    return (raw || []).map((c) => ({
      id: c.id,
      name: c.name_ar || c.name_en,
      name_ar: c.name_ar,
      name_en: c.name_en,
      description: c.description ?? '',
      icon: c.icon_name || '🛒',
      icon_name: c.icon_name || '🛒',
      image: c.image_url,
      image_url: c.image_url,
      color: c.color || 'emerald',
      bg_light: c.bg_light,
      badge_color: c.badge_color,
      subcategories: c.subcategories || [],
      common_items: c.common_items || [],
      sort_order: c.sort_order ?? 0,
      is_active: c.is_active ?? true,
      products_count: c.products_count ?? 0,
      linked_households_count: c.linked_households_count ?? 0,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));
  },

  async createCategory(cat: Partial<AdminCategory>): Promise<{ success: boolean; error?: string }> {
    const nameAr = (cat.name_ar || cat.name || '').trim();
    const nameEn = (cat.name_en || cat.name || nameAr).trim();
    const cleanId =
      cat.id?.trim() ||
      nameEn
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') ||
      `cat_${Date.now()}`;

    return this.upsertGlobalCategory({
      id: cleanId,
      name_ar: nameAr,
      name_en: nameEn,
      description: cat.description ?? '',
      icon_name: cat.icon_name || cat.icon || '🛒',
      image_url:
        cat.image_url ||
        cat.image ||
        'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
      color: cat.color || 'emerald',
      bg_light: cat.bg_light,
      badge_color: cat.badge_color,
      subcategories: cat.subcategories || [],
      sort_order: Number(cat.sort_order ?? 0),
      is_active: cat.is_active ?? true,
    });
  },

  async updateCategory(id: string, cat: Partial<AdminCategory>): Promise<{ success: boolean; error?: string }> {
    // Support quick toggle active when only is_active is passed
    if (
      cat.is_active !== undefined &&
      cat.name === undefined &&
      cat.name_ar === undefined &&
      cat.subcategories === undefined
    ) {
      return this.toggleCategoryActive(id, Boolean(cat.is_active));
    }

    const nameAr = (cat.name_ar || cat.name || '').trim();
    const nameEn = (cat.name_en || cat.name || nameAr).trim();

    return this.upsertGlobalCategory({
      id,
      name_ar: nameAr,
      name_en: nameEn,
      description: cat.description ?? '',
      icon_name: cat.icon_name || cat.icon || '🛒',
      image_url:
        cat.image_url ||
        cat.image ||
        'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
      color: cat.color || 'emerald',
      bg_light: cat.bg_light,
      badge_color: cat.badge_color,
      subcategories: cat.subcategories || [],
      sort_order: Number(cat.sort_order ?? 0),
      is_active: cat.is_active ?? true,
    });
  },

  async deleteCategory(id: string): Promise<{ success: boolean; error?: string }> {
    return this.deleteGlobalCategory(id);
  },

  async createProduct(prod: Partial<AdminProduct>): Promise<{ success: boolean; error?: string }> {
    const nameAr = (prod.name_ar || prod.name || '').trim();
    const nameEn = (prod.name_en || '').trim() || null;
    const globalCatId = prod.global_category_id || prod.category_id || '';
    const cleanId = prod.id?.trim() || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    return this.upsertProduct({
      id: cleanId,
      global_category_id: globalCatId,
      subcategory_id: prod.subcategory_id || null,
      name_ar: nameAr,
      name_en: nameEn,
      default_unit: prod.default_unit || 'قطعة',
      default_quantity: String(prod.default_quantity ?? '1'),
      estimated_price:
        prod.estimated_price !== undefined && prod.estimated_price !== null
          ? Number(prod.estimated_price)
          : null,
      image_url: prod.image_url || null,
      sort_order: Number(prod.sort_order ?? 0),
      is_active: prod.is_active ?? true,
    });
  },

  async updateProduct(id: string, prod: Partial<AdminProduct>): Promise<{ success: boolean; error?: string }> {
    // Support quick toggle active when only is_active is passed
    if (
      prod.is_active !== undefined &&
      prod.name === undefined &&
      prod.name_ar === undefined &&
      prod.global_category_id === undefined &&
      prod.category_id === undefined
    ) {
      return this.toggleProductActive(id, Boolean(prod.is_active));
    }

    const nameAr = (prod.name_ar || prod.name || '').trim();
    const nameEn = (prod.name_en || '').trim() || null;
    const globalCatId = prod.global_category_id || prod.category_id || '';

    return this.upsertProduct({
      id,
      global_category_id: globalCatId,
      subcategory_id: prod.subcategory_id || null,
      name_ar: nameAr,
      name_en: nameEn,
      default_unit: prod.default_unit || 'قطعة',
      default_quantity: String(prod.default_quantity ?? '1'),
      estimated_price:
        prod.estimated_price !== undefined && prod.estimated_price !== null
          ? Number(prod.estimated_price)
          : null,
      image_url: prod.image_url || null,
      sort_order: Number(prod.sort_order ?? 0),
      is_active: prod.is_active ?? true,
    });
  },

  // --------------------------------------------------------------------------
  // Notifications Helpers
  // --------------------------------------------------------------------------
  async getBroadcastHistory(): Promise<AdminBroadcastNotification[]> {
    return this.getAdminNotifications();
  },

  async sendBroadcastNotification(payload: {
    title: string;
    body: string;
    type?: string;
    priority?: string;
    icon_name?: string | null;
    image_url?: string | null;
    action_type?: string | null;
    action_route?: string | null;
    is_active?: boolean;
    start_at?: string | null;
    end_at?: string | null;
    target_type?: string;
    target_role?: string;
    target_id?: string;
  }): Promise<{ success: boolean; error?: string }> {
    return this.createAdminNotification({
      title: payload.title,
      body: payload.body,
      type: payload.type || payload.priority || 'top_banner',
      icon_name: payload.icon_name,
      image_url: payload.image_url,
      action_type: payload.action_type,
      action_route: payload.action_route,
      is_active: payload.is_active ?? true,
      start_at: payload.start_at,
      end_at: payload.end_at,
    });
  },

  // --------------------------------------------------------------------------
  // Admins & Roles Helpers
  // --------------------------------------------------------------------------
  async getAdmins(): Promise<AdminUser[]> {
    return this.getAdminUsers();
  },

  async createAdmin(admin: any): Promise<{ success: boolean; error?: string }> {
    return this.upsertAdminUser({
      user_id: admin.user_id,
      email: admin.email,
      full_name: admin.full_name,
      role: admin.role,
      is_active: admin.is_active ?? true,
    });
  },

  async updateAdminRole(id: string, role: AdminRole, is_active: boolean): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase غير متصل' };
    const { error } = await supabase
      .from('admin_users')
      .update({ role, is_active, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return { success: false, error: error.message };
    await this.logAuditAction('ADMIN_ROLE_UPDATED', 'ADMIN', id, { role, is_active });
    return { success: true };
  },

  async removeAdmin(id: string): Promise<{ success: boolean; error?: string }> {
    return this.deleteAdminUser(id);
  },

  async updateSystemSettings(settings: Record<string, any>): Promise<{ success: boolean; error?: string }> {
    let success = true;
    for (const [k, v] of Object.entries(settings)) {
      const res = await this.saveSystemSetting(k, v);
      if (!res.success) success = false;
    }
    return { success };
  },

  // --------------------------------------------------------------------------
  // Delivery Drivers Management (Phase 1)
  // --------------------------------------------------------------------------
  async getDeliveryDrivers(filters?: {
    search?: string;
    isActive?: boolean;
    vehicleType?: string;
    status?: string;
    governorate?: string;
  }): Promise<{ drivers: DeliveryDriver[]; stats: DeliveryDriverStatsSummary }> {
    if (!supabase) {
      return {
        drivers: [],
        stats: {
          total_drivers: 0,
          active_drivers: 0,
          inactive_drivers: 0,
          total_assigned_orders: 0,
          completed_orders: 0,
        },
      };
    }

    try {
      // 1. Fetch drivers from public.delivery_drivers
      let query = supabase
        .from('delivery_drivers')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }

      if (filters?.vehicleType && filters.vehicleType !== 'all') {
        query = query.eq('vehicle_type', filters.vehicleType);
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.governorate && filters.governorate !== 'all') {
        query = query.eq('governorate_name', filters.governorate);
      }

      const { data: driversData, error: driversError } = await query;
      if (driversError) throw driversError;

      const rawDrivers = (driversData || []) as any[];

      // 2. Client-side search if provided (covers full_name, phone, governorate, national_id)
      let filteredDrivers = rawDrivers;
      if (filters?.search && filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        filteredDrivers = rawDrivers.filter(
          (d) =>
            d.full_name?.toLowerCase().includes(q) ||
            d.phone?.includes(q) ||
            d.governorate_name?.toLowerCase().includes(q) ||
            d.markaz_name?.toLowerCase().includes(q) ||
            d.national_id?.includes(q)
        );
      }

      // 3. Fetch delivery_orders to calculate real stats
      let ordersData: any[] = [];
      try {
        const { data: ords } = await supabase
          .from('delivery_orders')
          .select('id, assigned_driver_id, status');
        if (ords) ordersData = ords;
      } catch (err) {
        console.warn('Could not fetch delivery_orders for stats aggregation:', err);
      }

      // Group orders by assigned_driver_id
      const ordersByDriver: Record<string, { active: number; completed: number; cancelled: number; total: number }> = {};
      let totalCompletedAll = 0;
      let totalAssignedAll = 0;

      for (const ord of ordersData) {
        if (!ord.assigned_driver_id) continue;
        totalAssignedAll++;
        if (!ordersByDriver[ord.assigned_driver_id]) {
          ordersByDriver[ord.assigned_driver_id] = { active: 0, completed: 0, cancelled: 0, total: 0 };
        }
        ordersByDriver[ord.assigned_driver_id].total++;

        if (ord.status === 'completed') {
          ordersByDriver[ord.assigned_driver_id].completed++;
          totalCompletedAll++;
        } else if (ord.status === 'cancelled') {
          ordersByDriver[ord.assigned_driver_id].cancelled++;
        } else if (
          ['pending_review', 'accepted', 'shopping', 'shopping_completed', 'cancellation_pending'].includes(ord.status) ||
          !['completed', 'cancelled'].includes(ord.status)
        ) {
          ordersByDriver[ord.assigned_driver_id].active++;
        }
      }

      // 2. Fetch associated profiles to get emails
      const userIds = Array.from(new Set(rawDrivers.map((d) => d.user_id).filter(Boolean)));
      const profileEmailsMap: Record<string, string> = {};
      if (userIds.length > 0) {
        try {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, email')
            .in('id', userIds);
          if (profilesData) {
            for (const p of profilesData) {
              if (p.id && p.email) profileEmailsMap[p.id] = p.email;
            }
          }
        } catch (e) {
          console.warn('Could not fetch driver emails from profiles:', e);
        }
      }

      const drivers: DeliveryDriver[] = filteredDrivers.map((d) => {
        const driverOrders = ordersByDriver[d.id] || { active: 0, completed: 0, cancelled: 0, total: 0 };
        const docs: DriverDocuments = {
          id_card_front_path: d.id_card_front_path || null,
          id_card_back_path: d.id_card_back_path || null,
          driver_license_path: d.driver_license_path || null,
          vehicle_license_path: d.vehicle_license_path || null,
        };
        return {
          id: d.id,
          user_id: d.user_id,
          full_name: d.full_name,
          phone: d.phone,
          email: d.user_id ? profileEmailsMap[d.user_id] || null : null,
          address: d.address || d.detailed_address || null,
          detailed_address: d.detailed_address || d.address || null,
          is_active: Boolean(d.is_active),
          status: d.status || (d.is_active ? 'approved' : 'pending_approval'),
          governorate_code: d.governorate_code || null,
          governorate_name: d.governorate_name || null,
          markaz_name: d.markaz_name || null,
          national_id: d.national_id || null,
          vehicle_type: d.vehicle_type || null,
          vehicle_plate: d.vehicle_plate || null,
          id_card_front_path: d.id_card_front_path || null,
          id_card_back_path: d.id_card_back_path || null,
          driver_license_path: d.driver_license_path || null,
          vehicle_license_path: d.vehicle_license_path || null,
          documents: docs,
          notes: d.notes || null,
          role: d.role || null,
          rejection_reason: d.rejection_reason || null,
          approved_at: d.approved_at || null,
          approved_by: d.approved_by || null,
          created_at: d.created_at,
          updated_at: d.updated_at,
          active_orders_count: driverOrders.active,
          completed_orders_count: driverOrders.completed,
          cancelled_orders_count: driverOrders.cancelled,
          total_orders_count: driverOrders.total,
        };
      });

      const activeCount = rawDrivers.filter((d) => d.is_active).length;
      const inactiveCount = rawDrivers.filter((d) => !d.is_active).length;

      return {
        drivers,
        stats: {
          total_drivers: rawDrivers.length,
          active_drivers: activeCount,
          inactive_drivers: inactiveCount,
          total_assigned_orders: totalAssignedAll,
          completed_orders: totalCompletedAll,
        },
      };
    } catch (err: any) {
      console.error('Error in getDeliveryDrivers:', err);
      return {
        drivers: [],
        stats: {
          total_drivers: 0,
          active_drivers: 0,
          inactive_drivers: 0,
          total_assigned_orders: 0,
          completed_orders: 0,
        },
      };
    }
  },

  async getDeliveryDriverDetails(driverId: string): Promise<{
    driver: DeliveryDriver | null;
    orders: DeliveryDriverOrder[];
    error?: string;
  }> {
    if (!supabase || !driverId) return { driver: null, orders: [] };

    try {
      // 1. Fetch driver
      const { data: driverData, error: driverErr } = await supabase
        .from('delivery_drivers')
        .select('*')
        .eq('id', driverId)
        .maybeSingle();

      if (driverErr || !driverData) {
        return { driver: null, orders: [], error: driverErr?.message || 'السائق غير موجود' };
      }

      // 2. Fetch associated email from profiles if user_id present
      let driverEmail: string | null = null;
      if (driverData.user_id) {
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', driverData.user_id)
            .maybeSingle();
          if (prof?.email) driverEmail = prof.email;
        } catch (e) {
          console.warn('Could not fetch email for driver:', e);
        }
      }

      // 3. Fetch orders assigned to this driver
      const { data: ordersData, error: ordersErr } = await supabase
        .from('delivery_orders')
        .select(`
          id,
          order_number,
          customer_name,
          customer_phone,
          detailed_address,
          governorate_name,
          markaz_name,
          total_amount,
          delivery_fee,
          status,
          cancellation_reason,
          cancellation_decision_note,
          created_at,
          accepted_at,
          delivered_at
        `)
        .eq('assigned_driver_id', driverId)
        .order('created_at', { ascending: false });

      if (ordersErr) {
        console.warn('Error fetching orders for driver:', ordersErr);
      }

      const orders = (ordersData || []) as DeliveryDriverOrder[];

      const activeCount = orders.filter(
        (o) =>
          ['pending_review', 'accepted', 'shopping', 'shopping_completed', 'cancellation_pending'].includes(o.status) ||
          !['completed', 'cancelled'].includes(o.status)
      ).length;
      const completedCount = orders.filter((o) => o.status === 'completed').length;
      const cancelledCount = orders.filter((o) => o.status === 'cancelled').length;

      // 4. Read actual document path columns from delivery_drivers
      const docs: DriverDocuments = {
        id_card_front_path: driverData.id_card_front_path || null,
        id_card_back_path: driverData.id_card_back_path || null,
        driver_license_path: driverData.driver_license_path || null,
        vehicle_license_path: driverData.vehicle_license_path || null,
      };

      const driver: DeliveryDriver = {
        id: driverData.id,
        user_id: driverData.user_id,
        full_name: driverData.full_name,
        phone: driverData.phone,
        email: driverEmail,
        address: driverData.address || driverData.detailed_address || null,
        detailed_address: driverData.detailed_address || driverData.address || null,
        is_active: Boolean(driverData.is_active),
        status: driverData.status || (driverData.is_active ? 'approved' : 'pending_approval'),
        governorate_code: driverData.governorate_code || null,
        governorate_name: driverData.governorate_name || null,
        markaz_name: driverData.markaz_name || null,
        national_id: driverData.national_id || null,
        vehicle_type: driverData.vehicle_type || null,
        vehicle_plate: driverData.vehicle_plate || null,
        id_card_front_path: driverData.id_card_front_path || null,
        id_card_back_path: driverData.id_card_back_path || null,
        driver_license_path: driverData.driver_license_path || null,
        vehicle_license_path: driverData.vehicle_license_path || null,
        documents: docs,
        notes: driverData.notes || null,
        role: driverData.role || null,
        rejection_reason: driverData.rejection_reason || null,
        approved_at: driverData.approved_at || null,
        approved_by: driverData.approved_by || null,
        created_at: driverData.created_at,
        updated_at: driverData.updated_at,
        active_orders_count: activeCount,
        completed_orders_count: completedCount,
        cancelled_orders_count: cancelledCount,
        total_orders_count: orders.length,
      };

      return { driver, orders };
    } catch (err: any) {
      return { driver: null, orders: [], error: err?.message || 'خطأ في جلب تفاصيل السائق' };
    }
  },

  /**
   * Maps a DriverDocumentType to its exact column in public.delivery_drivers
   */
  getDriverDocumentColumnName(docType: DriverDocumentType): DriverDocumentColumn {
    switch (docType) {
      case 'id_card_front':
        return 'id_card_front_path';
      case 'id_card_back':
        return 'id_card_back_path';
      case 'driver_license':
        return 'driver_license_path';
      case 'vehicle_license':
        return 'vehicle_license_path';
    }
  },

  /**
   * Normalizes a storage path stored in *_path column (removes leading slashes or accidental bucket prefix)
   */
  normalizeDriverStoragePath(rawPath: string): string {
    let clean = rawPath.trim().replace(/^\/+/, '');
    if (clean.startsWith('driver-documents/')) {
      clean = clean.slice('driver-documents/'.length);
    }
    return clean;
  },

  /**
   * Resolves a usable image URL for a driver document:
   * - If `storagePath` is a Base64 Data URL (`data:image/...`) or direct URL (`http://` / `https://`),
   *   returns it immediately without any network request.
   * - If `storagePath` is a relative path in bucket `driver-documents`, resolves both `getPublicUrl`
   *   and attempts `createSignedUrl` (falling back to `getPublicUrl` if signed URL fails).
   */
  async getDriverDocumentSignedUrl(
    storagePath: string,
    expiresInSeconds = 3600
  ): Promise<{
    success: boolean;
    signedUrl: string | null;
    publicUrl?: string | null;
    isDirect?: boolean;
    error?: string;
  }> {
    if (!storagePath || typeof storagePath !== 'string' || !storagePath.trim()) {
      return { success: false, signedUrl: null, error: 'مسار المستند غير موجود' };
    }

    const trimmed = storagePath.trim();

    // 1. Direct Base64 Data URL or HTTP/HTTPS URL — no network request needed
    if (isDirectDocumentSrc(trimmed)) {
      return {
        success: true,
        signedUrl: trimmed,
        publicUrl: trimmed,
        isDirect: true,
      };
    }

    // 2. Storage Fallback in bucket "driver-documents"
    if (!supabase) {
      return { success: false, signedUrl: null, error: 'Supabase غير متصل' };
    }

    const cleanPath = this.normalizeDriverStoragePath(trimmed);
    const publicUrl = resolveDocumentSrc(cleanPath);

    try {
      const { data, error } = await supabase.storage
        .from('driver-documents')
        .createSignedUrl(cleanPath, expiresInSeconds);

      if (!error && data?.signedUrl) {
        return {
          success: true,
          signedUrl: data.signedUrl,
          publicUrl,
          isDirect: false,
        };
      }

      // Fallback to getPublicUrl if createSignedUrl is not permitted or bucket is public
      if (publicUrl) {
        return {
          success: true,
          signedUrl: publicUrl,
          publicUrl,
          isDirect: false,
        };
      }

      return {
        success: false,
        signedUrl: null,
        publicUrl: null,
        error: error?.message || 'تعذر تحميل المستند',
      };
    } catch (err: any) {
      if (publicUrl) {
        return {
          success: true,
          signedUrl: publicUrl,
          publicUrl,
          isDirect: false,
        };
      }
      return {
        success: false,
        signedUrl: null,
        error: err?.message || 'تعذر تحميل المستند',
      };
    }
  },

  /**
   * Downloads a driver document from Base64 Data URL, direct HTTP/HTTPS URL, or bucket "driver-documents"
   */
  async downloadDriverDocument(
    storagePath: string
  ): Promise<{ success: boolean; blob?: Blob; mimeType?: string; error?: string }> {
    if (!storagePath || typeof storagePath !== 'string' || !storagePath.trim()) {
      return { success: false, error: 'مسار المستند غير موجود' };
    }

    const trimmed = storagePath.trim();

    try {
      // Case 1: Base64 Data URL (`data:image/jpeg;base64,...` or `data:image/webp;base64,...`)
      if (trimmed.startsWith('data:image/')) {
        const commaIndex = trimmed.indexOf(',');
        if (commaIndex === -1) {
          return { success: false, error: 'صيغة Base64 للمستند غير صالحة' };
        }
        const header = trimmed.slice(0, commaIndex);
        const base64Data = trimmed.slice(commaIndex + 1);
        const mimeMatch = header.match(/^data:([^;]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/webp';

        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });
        return { success: true, blob, mimeType };
      }

      // Case 2: Direct HTTP/HTTPS URL
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const response = await fetch(trimmed);
        if (!response.ok) {
          return { success: false, error: 'تعذر تحميل الصورة من الرابط المباشر' };
        }
        const blob = await response.blob();
        return { success: true, blob, mimeType: blob.type };
      }

      // Case 3: Relative path in Supabase Storage bucket "driver-documents"
      if (!supabase) {
        return { success: false, error: 'Supabase غير متصل' };
      }

      const cleanPath = this.normalizeDriverStoragePath(trimmed);
      const { data, error } = await supabase.storage
        .from('driver-documents')
        .download(cleanPath);

      if (!error && data) {
        return {
          success: true,
          blob: data,
          mimeType: data.type,
        };
      }

      // Fallback: fetch via publicUrl if direct storage download fails
      const publicUrl = resolveDocumentSrc(cleanPath);
      if (publicUrl) {
        const resp = await fetch(publicUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          return { success: true, blob, mimeType: blob.type };
        }
      }

      return {
        success: false,
        error: error?.message || 'تعذر تحميل المستند من مساحة التخزين',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'تعذر تحميل المستند',
      };
    }
  },

  /**
   * Converts an image File to WebP Blob (with reasonable max dimension for fast loading)
   */
  async convertImageFileToWebp(file: File): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        try {
          const maxDim = 1600;
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                resolve(file);
              }
            },
            'image/webp',
            0.85
          );
        } catch {
          resolve(file);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };

      img.src = objectUrl;
    });
  },

  /**
   * Converts a Blob to a Base64 Data URL string (`data:image/webp;base64,...`)
   */
  async blobToBase64DataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('تعذر تحويل الصورة إلى Base64 Data URL'));
        }
      };
      reader.onerror = () => reject(new Error('حدث خطأ أثناء قراءة ملف الصورة'));
      reader.readAsDataURL(blob);
    });
  },

  /**
   * Uploads or replaces a driver document:
   * - Converts image to WebP and converts to Base64 Data URL (primary format used in the driver app)
   *   OR uploads to bucket "driver-documents" if configured, updating the corresponding *_path column in public.delivery_drivers.
   * - Does NOT modify status, is_active, user_id, or any other driver fields.
   */
  async uploadDriverDocument(
    driverId: string,
    docType: DriverDocumentType,
    file: File
  ): Promise<{ success: boolean; path?: string; signedUrl?: string | null; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase غير متصل' };

    try {
      // 1. Validate file type & size
      if (!file.type.startsWith('image/')) {
        return { success: false, error: 'يرجى اختيار ملف صورة صالح (WebP, PNG, JPG)' };
      }

      const maxSizeBytes = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSizeBytes) {
        return { success: false, error: 'حجم الملف يتجاوز الحد المسموح به (10 ميجابايت)' };
      }

      const columnName = this.getDriverDocumentColumnName(docType);

      // 2. Fetch driver record to obtain user_id and current value in column
      const { data: driverData, error: driverErr } = await supabase
        .from('delivery_drivers')
        .select('id, user_id, id_card_front_path, id_card_back_path, driver_license_path, vehicle_license_path')
        .eq('id', driverId)
        .maybeSingle();

      if (driverErr || !driverData) {
        return {
          success: false,
          error: driverErr?.message || 'لم يتم العثور على سجل السائق في قاعدة البيانات',
        };
      }

      const targetUserId = driverData.user_id;
      const oldPath: string | null = (driverData as any)[columnName] || null;

      // 3. Convert image to WebP blob & Base64 Data URL
      const webpBlob = await this.convertImageFileToWebp(file);
      const base64DataUrl = await this.blobToBase64DataUrl(webpBlob);

      // Determine whether to store as Base64 Data URL (primary driver app format) or Storage path
      let finalStoredValue = base64DataUrl;

      // If the existing record uses a relative storage path and user_id exists, try uploading to bucket first,
      // and automatically fall back to Base64 Data URL if Storage upload is unavailable or restricted
      const existingUsesStoragePath =
        oldPath && !isDirectDocumentSrc(oldPath) && Boolean(targetUserId);

      if (existingUsesStoragePath && targetUserId) {
        const targetStoragePath = `drivers/${targetUserId}/documents/${docType}.webp`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('driver-documents')
          .upload(targetStoragePath, webpBlob, {
            contentType: 'image/webp',
            cacheControl: '3600',
            upsert: true,
          });

        if (!uploadErr && uploadData) {
          finalStoredValue = targetStoragePath;
        }
      }

      // 4. Update ONLY the corresponding *_path column in public.delivery_drivers
      const { data: updatedDriverRow, error: updateErr } = await supabase
        .from('delivery_drivers')
        .update({
          [columnName]: finalStoredValue,
        })
        .eq('id', driverId)
        .select('id, user_id, id_card_front_path, id_card_back_path, driver_license_path, vehicle_license_path')
        .maybeSingle();

      if (updateErr || !updatedDriverRow) {
        return {
          success: false,
          error: `تعذر تحديث العمود (${columnName}) في delivery_drivers: ${
            updateErr?.message || 'رفضت سياسة الصلاحيات (RLS Policy) تعديل سجل السائق'
          }`,
        };
      }

      // 5. If oldPath was a relative path in Storage and different from finalStoredValue, clean it up safely
      if (oldPath && !isDirectDocumentSrc(oldPath)) {
        const cleanOldPath = this.normalizeDriverStoragePath(oldPath);
        if (cleanOldPath && cleanOldPath !== finalStoredValue) {
          try {
            await supabase.storage.from('driver-documents').remove([cleanOldPath]);
          } catch (cleanupErr) {
            console.warn('Non-fatal cleanup warning for old document path:', cleanupErr);
          }
        }
      }

      // 6. Resolve immediate display URL
      const resolvedUrl = resolveDocumentSrc(finalStoredValue);

      // 7. Audit Log
      await this.logAuditAction(
        'DRIVER_DOCUMENT_UPDATED',
        'DELIVERY_DRIVER',
        driverId,
        {
          driver_id: driverId,
          user_id: targetUserId,
          column: columnName,
          storage_mode: isDirectDocumentSrc(finalStoredValue) ? 'base64_data_url' : 'storage_bucket',
        }
      );

      return {
        success: true,
        path: finalStoredValue,
        signedUrl: resolvedUrl,
      };
    } catch (err: any) {
      console.error('Exception in uploadDriverDocument:', err);
      return { success: false, error: err?.message || 'فشل في رفع المستند' };
    }
  },

  /**
   * Deletes a driver document (removes from bucket "driver-documents" if stored as a bucket path)
   * and sets the corresponding *_path column in public.delivery_drivers to null.
   * Does NOT delete the driver record and does NOT alter status, is_active, or user_id.
   */
  async deleteDriverDocument(
    driverId: string,
    docType: DriverDocumentType
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase غير متصل' };

    try {
      const columnName = this.getDriverDocumentColumnName(docType);

      // 1. Fetch current driver record to get the stored value
      const { data: driverData, error: driverErr } = await supabase
        .from('delivery_drivers')
        .select('id, user_id, id_card_front_path, id_card_back_path, driver_license_path, vehicle_license_path')
        .eq('id', driverId)
        .maybeSingle();

      if (driverErr || !driverData) {
        return {
          success: false,
          error: driverErr?.message || 'لم يتم العثور على سجل السائق',
        };
      }

      const currentPath: string | null = (driverData as any)[columnName] || null;
      if (!currentPath) {
        return { success: false, error: 'المستند غير موجود بالفعل في سجل السائق' };
      }

      // 2. If the stored value is a relative Storage path (not Base64 Data URL / HTTP URL), remove from bucket
      if (!isDirectDocumentSrc(currentPath)) {
        const cleanPath = this.normalizeDriverStoragePath(currentPath);
        if (cleanPath) {
          try {
            await supabase.storage.from('driver-documents').remove([cleanPath]);
          } catch (storageErr) {
            console.warn('Storage remove warning during deleteDriverDocument:', storageErr);
          }
        }
      }

      // 3. Set ONLY the corresponding *_path column in public.delivery_drivers to null
      const { data: updatedDriverRow, error: updateErr } = await supabase
        .from('delivery_drivers')
        .update({
          [columnName]: null,
        })
        .eq('id', driverId)
        .select('id, user_id, id_card_front_path, id_card_back_path, driver_license_path, vehicle_license_path')
        .maybeSingle();

      if (updateErr || !updatedDriverRow) {
        return {
          success: false,
          error: `فشل تفريغ العمود (${columnName}) في سجل السائق: ${
            updateErr?.message || 'رفضت سياسة الصلاحيات (RLS Policy) تحديث السجل'
          }`,
        };
      }

      // 4. Audit Log
      await this.logAuditAction(
        'DRIVER_DOCUMENT_DELETED',
        'DELIVERY_DRIVER',
        driverId,
        {
          driver_id: driverId,
          column: columnName,
          was_direct_data_url: isDirectDocumentSrc(currentPath),
        }
      );

      return { success: true };
    } catch (err: any) {
      console.error('Exception in deleteDriverDocument:', err);
      return { success: false, error: err?.message || 'فشل في حذف المستند' };
    }
  },

  async approveDriver(
    driverId: string
  ): Promise<{ success: boolean; error?: string; rlsBlocked?: boolean }> {
    if (!supabase) return { success: false, error: 'Supabase غير متصل' };

    try {
      const { data, error } = await supabase.rpc('admin_approve_driver', {
        p_driver_id: driverId,
      });

      if (error) {
        console.error('admin_approve_driver error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        const isRls = error.message.toLowerCase().includes('policy') || error.code === '42501';
        return {
          success: false,
          error: isRls
            ? `صلاحية اعتماد السائق مقيدة في Supabase (${error.code || '42501'}). تأكد من امتلاك حساب المشرف صلاحية تنفيذ الدالة.`
            : (error.message || 'فشل اعتماد السائق عبر Supabase'),
          rlsBlocked: isRls,
        };
      }

      // Re-fetch driver from Supabase to verify persistence
      const { data: verifiedDriver, error: fetchErr } = await supabase
        .from('delivery_drivers')
        .select('id, full_name, is_active')
        .eq('id', driverId)
        .maybeSingle();

      if (fetchErr) {
        console.warn('Post-approval verification query warning:', fetchErr);
      } else {
        console.log('Post-approval verified driver state:', verifiedDriver);
      }

      await this.logAuditAction(
        'DRIVER_APPROVED',
        'DELIVERY_DRIVER',
        driverId,
        { driver_id: driverId, is_active: verifiedDriver?.is_active ?? true }
      );

      return { success: true };
    } catch (err: any) {
      console.error('Exception in approveDriver:', err);
      return { success: false, error: err?.message || 'فشل اعتماد السائق' };
    }
  },

  async rejectDriver(
    driverId: string,
    rejectionReason?: string
  ): Promise<{ success: boolean; error?: string; rlsBlocked?: boolean }> {
    if (!supabase) return { success: false, error: 'Supabase غير متصل' };

    try {
      const { data, error } = await supabase.rpc('admin_reject_driver', {
        p_driver_id: driverId,
        p_rejection_reason: rejectionReason || 'تم الرفض بواسطة الإدارة',
      });

      if (error) {
        console.error('admin_reject_driver error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        const isRls = error.message.toLowerCase().includes('policy') || error.code === '42501';
        return {
          success: false,
          error: isRls
            ? `صلاحية رفض السائق مقيدة في Supabase (${error.code || '42501'}).`
            : (error.message || 'فشل رفض السائق عبر Supabase'),
          rlsBlocked: isRls,
        };
      }

      // Re-fetch driver from Supabase to verify persistence
      const { data: verifiedDriver, error: fetchErr } = await supabase
        .from('delivery_drivers')
        .select('id, full_name, is_active')
        .eq('id', driverId)
        .maybeSingle();

      if (fetchErr) {
        console.warn('Post-rejection verification query warning:', fetchErr);
      } else {
        console.log('Post-rejection verified driver state:', verifiedDriver);
      }

      await this.logAuditAction(
        'DRIVER_REJECTED',
        'DELIVERY_DRIVER',
        driverId,
        { driver_id: driverId, reason: rejectionReason }
      );

      return { success: true };
    } catch (err: any) {
      console.error('Exception in rejectDriver:', err);
      return { success: false, error: err?.message || 'فشل رفض السائق' };
    }
  },

  async toggleDriverActive(
    driverId: string,
    isActive: boolean
  ): Promise<{ success: boolean; error?: string; rlsBlocked?: boolean }> {
    if (!supabase) return { success: false, error: 'Supabase غير متصل' };

    try {
      const { data, error } = await supabase.rpc('admin_toggle_driver_active', {
        p_driver_id: driverId,
        p_is_active: isActive,
      });

      if (error) {
        console.error('admin_toggle_driver_active error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        const isRls = error.message.toLowerCase().includes('policy') || error.code === '42501';
        return {
          success: false,
          error: isRls
            ? `تحديث حالة السائق مقيد بسياسة أمان Supabase (${error.code || '42501'}). تأكد من امتلاك حساب المشرف صلاحية تنفيذ الدالة.`
            : (error.message || 'فشل تعديل حالة السائق عبر Supabase'),
          rlsBlocked: isRls,
        };
      }

      // Re-fetch driver from Supabase to verify persistence
      const { data: verifiedDriver, error: fetchErr } = await supabase
        .from('delivery_drivers')
        .select('id, full_name, is_active')
        .eq('id', driverId)
        .maybeSingle();

      if (fetchErr) {
        console.warn('Post-toggle verification query warning:', fetchErr);
      } else {
        console.log('Post-toggle verified driver state:', verifiedDriver);
      }

      await this.logAuditAction(
        isActive ? 'DRIVER_ACTIVATED' : 'DRIVER_DEACTIVATED',
        'DELIVERY_DRIVER',
        driverId,
        { is_active: isActive, verified: verifiedDriver?.is_active }
      );

      return { success: true };
    } catch (err: any) {
      console.error('Exception in toggleDriverActive:', err);
      return { success: false, error: err?.message || 'فشل تعديل حالة السائق' };
    }
  },

  /**
   * Safe Delivery Driver Account Deletion:
   * - Blocks deletion if the driver has any active orders ('pending_review', 'accepted', 'shopping', 'shopping_completed', 'cancellation_pending').
   * - Preserves ALL historical orders ('completed', 'cancelled'), order items, status history, and financial records.
   * - Deletes the driver's own documents from Supabase Storage bucket "driver-documents" and verifies no Storage error occurred.
   * - Safely detaches delivery_orders.assigned_driver_id = NULL on historical orders if required by FK constraint, with rollback if deletion fails.
   * - Deletes driver record from public.delivery_drivers and verifies actual deletion in the database.
   */
  async deleteDeliveryDriverAccount(driverId: string): Promise<{
    success: boolean;
    driverDeleted?: boolean;
    documentsDeletedCount?: number;
    profileDeleted?: boolean;
    authDeleted?: boolean;
    blockedByActiveOrders?: boolean;
    activeOrdersCount?: number;
    preservedHistoricalOrdersCount?: number;
    storageWarning?: string;
    authWarning?: string;
    error?: string;
  }> {
    if (!supabase) return { success: false, error: 'Supabase غير متصل' };
    if (!driverId) return { success: false, error: 'معرف السائق مطلوب' };

    const ACTIVE_ORDER_STATUSES = [
      'pending_review',
      'accepted',
      'shopping',
      'shopping_completed',
      'cancellation_pending',
    ];

    try {
      // 1. Fetch current driver record from public.delivery_drivers
      const { data: driverData, error: driverFetchErr } = await supabase
        .from('delivery_drivers')
        .select(
          'id, user_id, full_name, phone, status, is_active, id_card_front_path, id_card_back_path, driver_license_path, vehicle_license_path'
        )
        .eq('id', driverId)
        .maybeSingle();

      if (driverFetchErr) {
        return {
          success: false,
          error: `تعذر قراءة سجل السائق من جدول delivery_drivers: ${driverFetchErr.message}`,
        };
      }

      if (!driverData) {
        return {
          success: false,
          error: 'لم يتم العثور على سجل السائق في جدول delivery_drivers أو تم حذفه مسبقًا.',
        };
      }

      // 2. Check all delivery_orders assigned to this driver
      const { data: driverOrders, error: ordersFetchErr } = await supabase
        .from('delivery_orders')
        .select('id, order_number, status')
        .eq('assigned_driver_id', driverId);

      if (ordersFetchErr) {
        return {
          success: false,
          error: `تعذر فحص الطلبات المرتبطة بالسائق قبل الحذف: ${ordersFetchErr.message}`,
        };
      }

      const allAssignedOrders = driverOrders || [];
      const activeOrders = allAssignedOrders.filter(
        (o: any) =>
          ACTIVE_ORDER_STATUSES.includes(o.status) || !['completed', 'cancelled'].includes(o.status)
      );
      const historicalOrders = allAssignedOrders.filter((o: any) =>
        ['completed', 'cancelled'].includes(o.status)
      );

      // 3. Strictly block deletion if the driver has any active orders in operational statuses
      if (activeOrders.length > 0) {
        return {
          success: false,
          blockedByActiveOrders: true,
          activeOrdersCount: activeOrders.length,
          error: `لا يمكن حذف حساب الدليفري لأن السائق لديه (${activeOrders.length}) طلب نشط حاليًا في حالة تشغيل (${activeOrders
            .map((o: any) => o.status)
            .join('، ')}). يجب إتمام الطلبات النشطة أو إلغاؤها أو إعادة إسنادها أولًا قبل حذف الحساب.`,
        };
      }

      // 4. Delete known driver documents from Supabase Storage bucket "driver-documents"
      // Only delete relative storage paths (skip Base64 Data URLs or direct HTTP URLs which live in the table row itself)
      const rawStoredPaths = [
        driverData.id_card_front_path,
        driverData.id_card_back_path,
        driverData.driver_license_path,
        driverData.vehicle_license_path,
      ]
        .filter(
          (p): p is string =>
            Boolean(p && typeof p === 'string' && p.trim() && !isDirectDocumentSrc(p))
        )
        .map((p) => this.normalizeDriverStoragePath(p));

      const safeDriverPaths = Array.from(new Set(rawStoredPaths)).filter((cleanPath) => {
        if (!cleanPath || cleanPath.includes('..')) return false;
        // Ensure we never touch another driver's folder
        if (driverData.user_id && cleanPath.startsWith('drivers/')) {
          return cleanPath.startsWith(`drivers/${driverData.user_id}/`);
        }
        return true;
      });

      let documentsDeletedCount = 0;

      if (safeDriverPaths.length > 0) {
        try {
          const { data: removedFiles, error: removeErr } = await supabase.storage
            .from('driver-documents')
            .remove(safeDriverPaths);

          if (!removeErr && removedFiles) {
            documentsDeletedCount = removedFiles.length;
          }
        } catch (storageCleanErr) {
          console.warn('Non-fatal storage cleanup warning:', storageCleanErr);
        }
      }

      // 5. Delete driver record from public.delivery_drivers (NEVER deleting historical orders!)
      const historicalOrderIds = historicalOrders.map((o: any) => o.id).filter(Boolean);
      let unlinkedHistoricalOrders = false;

      let { error: deleteDriverErr } = await supabase
        .from('delivery_drivers')
        .delete()
        .eq('id', driverId);

      // If Foreign Key constraint (23503) on delivery_orders.assigned_driver_id blocks deleting the driver row,
      // safely detach assigned_driver_id = NULL on completed/cancelled historical orders ONLY
      if (deleteDriverErr && deleteDriverErr.code === '23503' && historicalOrderIds.length > 0) {
        const { error: unlinkErr } = await supabase
          .from('delivery_orders')
          .update({ assigned_driver_id: null })
          .in('id', historicalOrderIds)
          .in('status', ['completed', 'cancelled']);

        if (unlinkErr) {
          return {
            success: false,
            driverDeleted: false,
            error: `تعذر فصل ارتباط السائق عن الطلبات التاريخية (${unlinkErr.code || 'Error'}): ${unlinkErr.message}. تم الاحتفاظ بالحساب وبالطلبات التاريخية دون أي تعديل.`,
          };
        }

        unlinkedHistoricalOrders = true;

        const retryDel = await supabase
          .from('delivery_drivers')
          .delete()
          .eq('id', driverId);
        deleteDriverErr = retryDel.error;
      }

      if (deleteDriverErr) {
        // Rollback assigned_driver_id on historical orders if we unlinked them
        if (unlinkedHistoricalOrders && historicalOrderIds.length > 0) {
          try {
            await supabase
              .from('delivery_orders')
              .update({ assigned_driver_id: driverId })
              .in('id', historicalOrderIds);
          } catch (_) {}
        }

        if (deleteDriverErr.code === '23503') {
          return {
            success: false,
            driverDeleted: false,
            error: `تعذر حذف سجل السائق من delivery_drivers بسبب قيد المفتاح الأجنبي (Foreign Key 23503): ${deleteDriverErr.message}. لم يتم المساس بأي طلبات تاريخية.`,
          };
        }
        return {
          success: false,
          driverDeleted: false,
          error: `رفضت قاعدة البيانات حذف سجل السائق من جدول delivery_drivers (${deleteDriverErr.code || 'Error'}): ${deleteDriverErr.message}`,
        };
      }

      // 6. Verify that the driver row was actually deleted from public.delivery_drivers
      const { data: verifyDriverStillExists, error: verifyDriverErr } = await supabase
        .from('delivery_drivers')
        .select('id')
        .eq('id', driverId)
        .maybeSingle();

      if (verifyDriverErr || verifyDriverStillExists) {
        if (unlinkedHistoricalOrders && historicalOrderIds.length > 0) {
          try {
            await supabase
              .from('delivery_orders')
              .update({ assigned_driver_id: driverId })
              .in('id', historicalOrderIds);
          } catch (_) {}
        }

        return {
          success: false,
          driverDeleted: false,
          error: verifyDriverErr
            ? `تعذر التحقق من حذف سجل السائق من delivery_drivers: ${verifyDriverErr.message}`
            : 'لم يتم حذف سجل السائق فعليًا من جدول delivery_drivers (تأكد من صلاحية DELETE للمشرف في سياسات RLS).',
        };
      }

      // 7. Delete linked public.profiles row if user_id exists (and is not an admin) & check Auth User
      let profileDeleted = false;
      let authDeleted = false;
      const targetUserId = driverData.user_id;

      if (targetUserId) {
        try {
          const { data: isAdminUser } = await supabase
            .from('admin_users')
            .select('id')
            .eq('user_id', targetUserId)
            .maybeSingle();

          if (!isAdminUser) {
            const { error: profDelErr } = await supabase
              .from('profiles')
              .delete()
              .eq('id', targetUserId);

            if (!profDelErr) {
              const { data: checkProf } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', targetUserId)
                .maybeSingle();
              profileDeleted = !checkProf;
            }

            try {
              const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('admin-api', {
                body: {
                  action: 'delete-user',
                  payload: { targetUserId, confirmation: 'DELETE' },
                },
              });
              if (!edgeErr && edgeData?.success && edgeData?.authDeleted === true) {
                authDeleted = true;
              }
            } catch (_) {
              authDeleted = false;
            }
          }
        } catch (_) {}
      }

      const authWarning = authDeleted
        ? undefined
        : 'تم حذف سجل الدليفري من جدول (delivery_drivers) فعليًا مع الحفاظ الكامل على الطلبات التاريخية. الجزء المتبقي: حذف حساب المصادقة من (auth.users) يحتاج إلى مسار Backend / Edge Function آمن بصلاحية SUPABASE_SERVICE_ROLE_KEY.';

      // 8. Audit Log
      await this.logAuditAction('DRIVER_ACCOUNT_DELETED', 'DELIVERY_DRIVER', driverId, {
        driver_id: driverId,
        user_id: targetUserId || null,
        full_name: driverData.full_name,
        phone: driverData.phone,
        documents_deleted_count: documentsDeletedCount,
        preserved_historical_orders_count: historicalOrders.length,
        profile_deleted: profileDeleted,
        auth_deleted: authDeleted,
      });

      return {
        success: true,
        driverDeleted: true,
        documentsDeletedCount,
        profileDeleted,
        authDeleted,
        preservedHistoricalOrdersCount: historicalOrders.length,
        authWarning,
      };
    } catch (err: any) {
      console.error('Exception in deleteDeliveryDriverAccount:', err);
      return {
        success: false,
        error: err?.message || 'فشل حذف حساب الدليفري',
      };
    }
  },

  // --------------------------------------------------------------------------
  // Delivery Orders Management (Phase 2)
  // --------------------------------------------------------------------------
  async getDeliveryOrders(filters?: {
    statusTab?: string;
    source?: 'all' | 'delivery' | 'pharmacy';
    search?: string;
    governorate?: string;
    markaz?: string;
    driverId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    orders: DeliveryOrder[];
    stats: DeliveryOrdersStatsSummary;
    totalCount: number;
    error?: string;
  }> {
    const defaultStats: DeliveryOrdersStatsSummary = {
      total: 0,
      pending_review: 0,
      accepted: 0,
      cancellation_pending: 0,
      completed: 0,
      cancelled: 0,
    };

    if (!supabase) {
      return { orders: [], stats: defaultStats, totalCount: 0, error: 'Supabase غير متصل' };
    }

    try {
      const stats = { ...defaultStats };
      let deliveryOrders: DeliveryOrder[] = [];
      let deliveryCount = 0;

      // 1. Fetch grocery delivery orders (if source !== 'pharmacy')
      if (filters?.source !== 'pharmacy') {
        const { data: allStatuses, error: statsErr } = await supabase
          .from('delivery_orders')
          .select('status');

        if (!statsErr && allStatuses) {
          stats.total += allStatuses.length;
          for (const row of allStatuses) {
            const st = row.status;
            if (st === 'accepted' || st === 'shopping' || st === 'shopping_completed') {
              stats.accepted++;
            } else if (st && stats[st as keyof DeliveryOrdersStatsSummary] !== undefined) {
              (stats[st as keyof DeliveryOrdersStatsSummary] as number)++;
            }
          }
        }

        let query = supabase
          .from('delivery_orders')
          .select('*', { count: 'exact' });

        if (filters?.statusTab && filters.statusTab !== 'all') {
          if (filters.statusTab === 'accepted') {
            query = query.in('status', ['accepted', 'shopping', 'shopping_completed']);
          } else {
            query = query.eq('status', filters.statusTab);
          }
        }

        if (filters?.governorate && filters.governorate !== 'all') {
          query = query.eq('governorate_name', filters.governorate);
        }
        if (filters?.markaz && filters.markaz !== 'all') {
          query = query.eq('markaz_name', filters.markaz);
        }

        if (filters?.driverId && filters.driverId !== 'all') {
          if (filters.driverId === 'unassigned') {
            query = query.is('assigned_driver_id', null);
          } else {
            query = query.eq('assigned_driver_id', filters.driverId);
          }
        }

        if (filters?.dateFrom) {
          query = query.gte('created_at', filters.dateFrom);
        }
        if (filters?.dateTo) {
          const toDate = new Date(filters.dateTo);
          toDate.setHours(23, 59, 59, 999);
          query = query.lte('created_at', toDate.toISOString());
        }

        query = query.order('created_at', { ascending: false });

        const limit = filters?.limit || 100;
        const offset = filters?.offset || 0;
        query = query.range(offset, offset + limit - 1);

        const { data: ordersData, count: dCount, error: ordersError } = await query;
        if (ordersError) throw ordersError;

        deliveryCount = dCount ?? (ordersData?.length || 0);
        let rawOrders = (ordersData || []) as any[];

        if (filters?.search && filters.search.trim()) {
          const q = filters.search.trim().toLowerCase();
          rawOrders = rawOrders.filter(
            (o) =>
              (o.order_number && o.order_number.toLowerCase().includes(q)) ||
              (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
              (o.customer_phone && o.customer_phone.includes(q)) ||
              (o.phone_number && o.phone_number.includes(q)) ||
              (o.id && o.id.toLowerCase().includes(q))
          );
        }

        const orderIds = rawOrders.map((o) => o.id);
        const itemCountsMap: Record<string, number> = {};
        if (orderIds.length > 0) {
          const { data: itemsCountData } = await supabase
            .from('delivery_order_items')
            .select('order_id');
          if (itemsCountData) {
            for (const item of itemsCountData) {
              if (item.order_id) {
                itemCountsMap[item.order_id] = (itemCountsMap[item.order_id] || 0) + 1;
              }
            }
          }
        }

        deliveryOrders = rawOrders.map((o) => ({
          id: o.id,
          order_number: o.order_number || null,
          household_id: o.household_id,
          household_name: o.household_name || null,
          invoice_id: o.invoice_id || null,
          address_id: o.address_id || null,
          customer_name: o.customer_name,
          customer_phone: o.customer_phone || o.phone_number || '',
          phone_number: o.phone_number || null,
          country: o.country || 'مصر',
          governorate_name: o.governorate_name || o.governorate || '',
          markaz_name: o.markaz_name || o.center || '',
          governorate: o.governorate || null,
          center: o.center || null,
          detailed_address: o.detailed_address || '',
          subtotal: Number(o.subtotal || o.items_total || 0),
          items_total: o.items_total ? Number(o.items_total) : null,
          delivery_fee: Number(o.delivery_fee || 0),
          total_amount: Number(o.total_amount || 0),
          delivery_notes: o.delivery_notes || o.notes || null,
          notes: o.notes || null,
          assigned_driver_id: o.assigned_driver_id || null,
          status: o.status as DeliveryOrderStatus,
          cancellation_reason: o.cancellation_reason || null,
          cancellation_requested_at: o.cancellation_requested_at || null,
          cancellation_requested_by: o.cancellation_requested_by || null,
          cancellation_decision_note: o.cancellation_decision_note || null,
          cancellation_decided_at: o.cancellation_decided_at || null,
          created_at: o.created_at,
          accepted_at: o.accepted_at || null,
          delivered_at: o.delivered_at || null,
          updated_at: o.updated_at,
          items_count: itemCountsMap[o.id] || 0,
          order_source: 'delivery' as const,
        }));
      }

      // 2. Fetch pharmacy delivery orders (if source !== 'delivery')
      let pharmacyMappedOrders: DeliveryOrder[] = [];
      if (filters?.source !== 'delivery') {
        try {
          // Accurate status calculation across all pharmacy orders
          const { data: pAllStatuses } = await supabase
            .from('pharmacy_orders')
            .select('status, id');

          if (pAllStatuses && pAllStatuses.length > 0) {
            if (filters?.source === 'pharmacy') {
              stats.total = 0;
              stats.pending_review = 0;
              stats.accepted = 0;
              stats.cancellation_pending = 0;
              stats.completed = 0;
              stats.cancelled = 0;
            }

            const { data: pCancelDevs } = await supabase
              .from('pharmacy_delivery_orders')
              .select('pharmacy_order_id')
              .not('cancellation_requested_at', 'is', null)
              .is('cancellation_decision', null);
            const pCancelIds = new Set((pCancelDevs || []).map((c: any) => c.pharmacy_order_id));

            for (const row of pAllStatuses) {
              stats.total++;
              if (row.status === 'cancellation_pending' || pCancelIds.has(row.id)) {
                stats.cancellation_pending++;
              } else if (
                ['accepted', 'shopping', 'in_delivery', 'preparing', 'ready_for_pickup'].includes(
                  row.status
                )
              ) {
                stats.accepted++;
              } else if (['completed', 'delivered'].includes(row.status)) {
                stats.completed++;
              } else if (row.status === 'cancelled') {
                stats.cancelled++;
              } else {
                stats.pending_review++;
              }
            }
          }

          let pQuery = supabase
            .from('pharmacy_orders')
            .select(`
              id,
              order_number,
              user_id,
              household_id,
              prescription_title,
              requested_pharmacy_name,
              address_text,
              address_governorate_name,
              address_center_name,
              delivery_fee,
              medicines_total,
              grand_total,
              status,
              created_at,
              updated_at
            `);

          if (filters?.governorate && filters.governorate !== 'all') {
            pQuery = pQuery.eq('address_governorate_name', filters.governorate);
          }
          if (filters?.markaz && filters.markaz !== 'all') {
            pQuery = pQuery.eq('address_center_name', filters.markaz);
          }
          if (filters?.dateFrom) {
            pQuery = pQuery.gte('created_at', filters.dateFrom);
          }
          if (filters?.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            pQuery = pQuery.lte('created_at', toDate.toISOString());
          }

          pQuery = pQuery.order('created_at', { ascending: false }).limit(filters?.limit || 100);

          const { data: pOrdersRows } = await pQuery;
          if (pOrdersRows && pOrdersRows.length > 0) {
            const pIds = pOrdersRows.map((p) => p.id);
            const { data: pdoRows } = await supabase
              .from('pharmacy_delivery_orders')
              .select('*')
              .in('pharmacy_order_id', pIds);

            const pdoMap = new Map<string, any>();
            for (const pdo of pdoRows || []) {
              pdoMap.set(pdo.pharmacy_order_id, pdo);
            }

            const pUserIds = Array.from(new Set(pOrdersRows.map((p) => p.user_id).filter(Boolean)));
            const profMap = new Map<string, any>();
            if (pUserIds.length > 0) {
              const { data: profs } = await supabase
                .from('profiles')
                .select('id, full_name, phone')
                .in('id', pUserIds);
              for (const pr of profs || []) {
                profMap.set(pr.id, pr);
              }
            }

            for (const po of pOrdersRows) {
              const pdo = pdoMap.get(po.id);
              const prof = po.user_id ? profMap.get(po.user_id) : null;
              const assignedDrvId = pdo?.assigned_driver_id || null;

              if (filters?.driverId && filters.driverId !== 'all') {
                if (filters.driverId === 'unassigned') {
                  if (assignedDrvId) continue;
                } else {
                  if (assignedDrvId !== filters.driverId) continue;
                }
              }

              let mappedStatus: DeliveryOrderStatus = 'pending_review';
              if (
                po.status === 'cancellation_pending' ||
                (pdo?.cancellation_requested_at && !pdo?.cancellation_decision)
              ) {
                mappedStatus = 'cancellation_pending';
              } else if (po.status === 'completed' || po.status === 'delivered') {
                mappedStatus = 'completed';
              } else if (po.status === 'cancelled') {
                mappedStatus = 'cancelled';
              } else if (
                po.status === 'accepted' ||
                po.status === 'shopping' ||
                po.status === 'in_delivery' ||
                po.status === 'preparing' ||
                po.status === 'ready_for_pickup'
              ) {
                mappedStatus = 'accepted';
              } else {
                mappedStatus = 'pending_review';
              }

              if (filters?.statusTab && filters.statusTab !== 'all') {
                if (filters.statusTab !== mappedStatus) {
                  continue;
                }
              }

              if (filters?.search && filters.search.trim()) {
                const q = filters.search.trim().toLowerCase();
                const num = (po.order_number || '').toLowerCase();
                const cName = (prof?.full_name || '').toLowerCase();
                const cPhone = prof?.phone || '';
                const pTitle = (po.prescription_title || '').toLowerCase();
                const phName = (po.requested_pharmacy_name || '').toLowerCase();
                const addr = (po.address_text || '').toLowerCase();

                if (
                  !num.includes(q) &&
                  !cName.includes(q) &&
                  !cPhone.includes(q) &&
                  !pTitle.includes(q) &&
                  !phName.includes(q) &&
                  !addr.includes(q) &&
                  !po.id.toLowerCase().includes(q)
                ) {
                  continue;
                }
              }

              pharmacyMappedOrders.push({
                id: po.id,
                order_number: po.order_number || `#PH-${po.id.slice(0, 6)}`,
                household_id: po.household_id || '',
                customer_name: prof?.full_name || 'عميل صيدلية',
                customer_phone: prof?.phone || '',
                governorate_name: po.address_governorate_name || '',
                markaz_name: po.address_center_name || '',
                detailed_address: po.address_text || po.requested_pharmacy_name || 'طلب صيدلية',
                subtotal: Number(po.medicines_total || 0),
                delivery_fee: Number(po.delivery_fee || 0),
                total_amount: Number(po.grand_total || 0),
                assigned_driver_id: assignedDrvId,
                status: mappedStatus,
                cancellation_reason: pdo?.cancellation_reason || null,
                cancellation_requested_at: pdo?.cancellation_requested_at || null,
                cancellation_decision_note: pdo?.cancellation_decision || null,
                cancellation_decided_at: pdo?.cancellation_decided_at || null,
                created_at: po.created_at,
                updated_at: po.updated_at,
                order_source: 'pharmacy' as const,
                pharmacy_order_id: po.id,
                pharmacy_name: po.requested_pharmacy_name || null,
                prescription_title: po.prescription_title || null,
              });
            }
          }
        } catch (pharmErr) {
          console.warn('Pharmacy orders loading for delivery panel error:', pharmErr);
        }
      }

      // 3. Combine and sort
      let allOrders = [...deliveryOrders, ...pharmacyMappedOrders];
      allOrders.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // 4. Batch fetch drivers for all assigned orders
      const allDriverIds = Array.from(
        new Set(allOrders.map((o) => o.assigned_driver_id).filter(Boolean))
      );
      if (allDriverIds.length > 0) {
        const { data: driversData } = await supabase
          .from('delivery_drivers')
          .select('id, full_name, phone, vehicle_type, is_active')
          .in('id', allDriverIds);

        if (driversData) {
          const driversMap = new Map<string, any>();
          for (const d of driversData) {
            driversMap.set(d.id, d);
          }
          for (const ord of allOrders) {
            if (ord.assigned_driver_id) {
              ord.driver = driversMap.get(ord.assigned_driver_id) || null;
            }
          }
        }
      }

      return {
        orders: allOrders,
        stats,
        totalCount: deliveryCount + pharmacyMappedOrders.length,
      };
    } catch (err: any) {
      console.error('Error in getDeliveryOrders:', err);
      return {
        orders: [],
        stats: defaultStats,
        totalCount: 0,
        error: err?.message || 'فشل في جلب طلبات الدليفري',
      };
    }
  },

  async getDeliveryOrderDetails(orderId: string): Promise<{
    order: DeliveryOrder | null;
    items: DeliveryOrderItem[];
    history: DeliveryOrderStatusHistory[];
    driver: DeliveryDriver | null;
    error?: string;
  }> {
    if (!supabase || !orderId) {
      return { order: null, items: [], history: [], driver: null, error: 'معرف الطلب غير صحيح' };
    }

    try {
      // 1. Fetch the order
      const { data: orderData, error: orderErr } = await supabase
        .from('delivery_orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (orderErr || !orderData) {
        // Fallback: check if this is a pharmacy order!
        const pharmDetails = await this.getPharmacyOrderDetails(orderId);
        if (pharmDetails.order) {
          const po = pharmDetails.order;
          const mappedOrder: DeliveryOrder = {
            id: po.id,
            order_number: po.order_number || `#PH-${po.id.slice(0, 8)}`,
            household_id: po.household_id || '',
            household_name: null,
            invoice_id: null,
            address_id: po.source_address_id || null,
            customer_name: po.user_name || 'عميل صيدلية',
            customer_phone: po.user_phone || '',
            phone_number: po.user_phone || null,
            country: 'مصر',
            governorate_name: po.address_governorate_name || '',
            markaz_name: po.address_center_name || '',
            governorate: po.address_governorate_code || null,
            center: po.address_center_name || null,
            detailed_address: po.address_text || po.requested_pharmacy_name || 'طلب صيدلية',
            subtotal: Number(po.medicines_total || 0),
            items_total: Number(po.medicines_total || 0),
            delivery_fee: Number(po.delivery_fee || 0),
            total_amount: Number(po.grand_total || 0),
            delivery_notes: po.customer_notes || null,
            notes: po.customer_notes || null,
            assigned_driver_id: pharmDetails.deliveryOrder?.assigned_driver_id || null,
            status: (po.status === 'cancellation_pending' ||
            (pharmDetails.deliveryOrder?.cancellation_requested_at &&
              !pharmDetails.deliveryOrder?.cancellation_decision)
              ? 'cancellation_pending'
              : po.status === 'completed'
              ? 'completed'
              : po.status === 'cancelled'
              ? 'cancelled'
              : 'accepted') as DeliveryOrderStatus,
            cancellation_reason: pharmDetails.deliveryOrder?.cancellation_reason || null,
            cancellation_requested_at: pharmDetails.deliveryOrder?.cancellation_requested_at || null,
            cancellation_requested_by: null,
            cancellation_decision_note: pharmDetails.deliveryOrder?.cancellation_decision || null,
            cancellation_decided_at: pharmDetails.deliveryOrder?.cancellation_decided_at || null,
            created_at: po.created_at,
            accepted_at: po.accepted_at || null,
            delivered_at: po.completed_at || null,
            updated_at: po.updated_at,
            items_count: pharmDetails.items.length,
            order_source: 'pharmacy',
            pharmacy_order_id: po.id,
            pharmacy_name: po.requested_pharmacy_name || pharmDetails.pharmacy?.name || null,
            prescription_title: po.prescription_title || null,
          };

          const mappedItems: DeliveryOrderItem[] = pharmDetails.items.map((it) => ({
            id: it.id,
            order_id: po.id,
            product_id: null,
            product_name: it.item_name,
            category_id: null,
            category_name: 'دواء / مستلزم صيدلية',
            quantity: String(it.requested_quantity || 1),
            unit_price: 0,
            total_price: 0,
            created_at: it.created_at,
            source: 'delivery_order_items',
          }));

          const mappedHistory: DeliveryOrderStatusHistory[] = pharmDetails.statusHistory.map((h) => ({
            id: h.id,
            order_id: po.id,
            old_status: h.old_status,
            new_status: h.new_status,
            changed_by: h.changed_by,
            changed_by_role: h.changed_by_role,
            note: h.notes,
            created_at: h.created_at,
          }));

          return {
            order: mappedOrder,
            items: mappedItems,
            history: mappedHistory,
            driver: (pharmDetails.deliveryOrder?.driver as any) || null,
          };
        }

        return {
          order: null,
          items: [],
          history: [],
          driver: null,
          error: orderErr?.message || 'لم يتم العثور على الطلب',
        };
      }

      // 2. Fetch items from public.delivery_order_items
      const { data: itemsData, error: itemsErr } = await supabase
        .from('delivery_order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (itemsErr) {
        console.warn('Error fetching order items:', itemsErr);
      }

      let items: DeliveryOrderItem[] = (itemsData || []).map((it) => ({
        id: it.id,
        order_id: it.order_id,
        product_id: it.product_id || null,
        product_name: it.product_name,
        category_id: it.category_id || null,
        category_name: it.category_name || null,
        quantity: it.quantity || '1',
        unit_price: Number(it.unit_price || 0),
        total_price: Number(it.total_price || 0),
        created_at: it.created_at,
        source: 'delivery_order_items',
      }));

      // Fetch linked invoice if invoice_id is present
      let linkedInvoice: any = null;
      if (orderData.invoice_id) {
        try {
          const { data: invData } = await supabase
            .from('invoices')
            .select('*')
            .eq('id', orderData.invoice_id)
            .maybeSingle();

          if (invData) {
            linkedInvoice = {
              id: invData.id,
              invoice_number: invData.invoice_number,
              category_arabic: invData.category_arabic,
              category: invData.category,
              total_price: invData.total_price ? Number(invData.total_price) : 0,
              date: invData.date,
              notes: invData.notes,
              products_count: Array.isArray(invData.products) ? invData.products.length : 0,
            };

            // If delivery_order_items is empty, transition and populate products directly from the invoice!
            if (items.length === 0 && Array.isArray(invData.products) && invData.products.length > 0) {
              items = invData.products.map((p: any, idx: number) => {
                const price = Number(p.price || p.unit_price || 0);
                const rawQty = p.quantity !== undefined ? String(p.quantity) : '1';
                const normalizedQty = rawQty.replace(/[٠-٩]/g, (d: string) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
                const numQty = parseFloat(normalizedQty) || 1;
                const total = price > 0 ? price * numQty : (Number(p.total) || price);
                return {
                  id: p.id || `inv-item-${idx}`,
                  order_id: orderId,
                  product_id: p.product_id || null,
                  product_name: p.name || p.product_name || 'صنف مشتريات',
                  category_id: null,
                  category_name: invData.category_arabic || invData.category || 'فاتورة طلبات البيت',
                  quantity: rawQty,
                  unit_price: price,
                  total_price: total > 0 ? total : price,
                  created_at: invData.created_at || orderData.created_at,
                  source: 'invoice_products' as const,
                  invoice_number: invData.invoice_number,
                };
              });
            }
          }
        } catch (invErr) {
          console.warn('Could not fetch linked invoice in getDeliveryOrderDetails:', invErr);
        }
      }

      // 3. Fetch status history from public.delivery_order_status_history
      let history: DeliveryOrderStatusHistory[] = [];
      try {
        const { data: histData, error: histErr } = await supabase
          .from('delivery_order_status_history')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false });

        if (!histErr && histData) {
          history = histData.map((h) => ({
            id: h.id,
            order_id: h.order_id,
            old_status: h.old_status || h.previous_status || null,
            new_status: h.new_status,
            changed_by: h.changed_by || null,
            changed_by_role: h.changed_by_role || null,
            note: h.note || h.notes || null,
            notes: h.notes || null,
            created_at: h.created_at,
          }));
        }
      } catch (err) {
        console.warn('Could not fetch delivery_order_status_history:', err);
      }

      // 4. Fetch assigned driver details if exists
      let driver: DeliveryDriver | null = null;
      if (orderData.assigned_driver_id) {
        const { data: driverData } = await supabase
          .from('delivery_drivers')
          .select('*')
          .eq('id', orderData.assigned_driver_id)
          .maybeSingle();

        if (driverData) {
          driver = driverData as DeliveryDriver;
        }
      }

      const order: DeliveryOrder = {
        id: orderData.id,
        order_number: orderData.order_number || null,
        household_id: orderData.household_id,
        household_name: orderData.household_name || null,
        invoice_id: orderData.invoice_id || null,
        linked_invoice: linkedInvoice,
        address_id: orderData.address_id || null,
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone || orderData.phone_number || '',
        phone_number: orderData.phone_number || null,
        country: orderData.country || 'مصر',
        governorate_name: orderData.governorate_name || orderData.governorate || '',
        markaz_name: orderData.markaz_name || orderData.center || '',
        governorate: orderData.governorate || null,
        center: orderData.center || null,
        detailed_address: orderData.detailed_address || '',
        subtotal: Number(orderData.subtotal || orderData.items_total || 0),
        items_total: orderData.items_total ? Number(orderData.items_total) : null,
        delivery_fee: Number(orderData.delivery_fee || 0),
        total_amount: Number(orderData.total_amount || 0),
        delivery_notes: orderData.delivery_notes || orderData.notes || null,
        notes: orderData.notes || null,
        assigned_driver_id: orderData.assigned_driver_id || null,
        status: orderData.status as DeliveryOrderStatus,
        cancellation_reason: orderData.cancellation_reason || null,
        cancellation_requested_at: orderData.cancellation_requested_at || null,
        cancellation_requested_by: orderData.cancellation_requested_by || null,
        cancellation_decision_note: orderData.cancellation_decision_note || null,
        cancellation_decided_at: orderData.cancellation_decided_at || null,
        created_at: orderData.created_at,
        accepted_at: orderData.accepted_at || null,
        delivered_at: orderData.delivered_at || null,
        updated_at: orderData.updated_at,
        driver,
        items_count: items.length,
      };

      return { order, items, history, driver };
    } catch (err: any) {
      console.error('Error in getDeliveryOrderDetails:', err);
      return {
        order: null,
        items: [],
        history: [],
        driver: null,
        error: err?.message || 'فشل في جلب تفاصيل الطلب',
      };
    }
  },

  async decideCancellation(
    orderId: string,
    approve: boolean,
    decisionNote?: string
  ): Promise<{ success: boolean; newStatus?: string; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase غير متصل' };

    try {
      // 1. Attempt admin_decide_cancellation (primary secured RPC)
      let rpcRes = await supabase.rpc('admin_decide_cancellation', {
        p_order_id: orderId,
        p_approve: approve,
        p_decision_note: decisionNote || null,
      });

      if (rpcRes.error) {
        console.warn('admin_decide_cancellation failed, attempting admin_resolve_cancellation fallback:', rpcRes.error);
        const fallbackRes = await supabase.rpc('admin_resolve_cancellation', {
          p_order_id: orderId,
          p_approve: approve,
          p_admin_notes: decisionNote || null,
        });

        if (fallbackRes.error) {
          console.warn('Both cancellation RPCs failed, attempting direct delivery_orders update fallback:', fallbackRes.error);
          const nowIso = new Date().toISOString();
          const expectedStatus = approve ? 'cancelled' : 'accepted';
          const { error: directErr } = await supabase
            .from('delivery_orders')
            .update({
              status: expectedStatus,
              cancellation_decision_note: decisionNote || null,
              cancellation_decided_at: nowIso,
              updated_at: nowIso,
            })
            .eq('id', orderId);

          if (directErr) {
            throw new Error(fallbackRes.error.message || rpcRes.error.message);
          }
          rpcRes = { data: { new_status: expectedStatus }, error: null } as any;
        } else {
          rpcRes = fallbackRes;
        }
      }

      const expectedNewStatus = approve ? 'cancelled' : 'accepted';
      const actualNewStatus =
        typeof rpcRes.data === 'object' && rpcRes.data?.new_status
          ? rpcRes.data.new_status
          : expectedNewStatus;

      await this.logAuditAction(
        approve ? 'CANCELLATION_APPROVED' : 'CANCELLATION_REJECTED',
        'DELIVERY_ORDER',
        orderId,
        {
          approve,
          decision_note: decisionNote || null,
          new_status: actualNewStatus,
        }
      );

      return { success: true, newStatus: actualNewStatus };
    } catch (err: any) {
      console.error('Error in decideCancellation RPC:', err);
      return { success: false, error: err?.message || 'فشل تنفيذ قرار الإلغاء' };
    }
  },

  async adminCancelOrder(
    orderId: string,
    reason: string,
    adminEmail?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase غير متصل' };

    try {
      // 1. Fetch current order details
      const { data: orderData, error: orderErr } = await supabase
        .from('delivery_orders')
        .select('id, status, assigned_driver_id')
        .eq('id', orderId)
        .maybeSingle();

      if (orderErr || !orderData) {
        return { success: false, error: 'لم يتم العثور على الطلب المراد إلغاؤه' };
      }

      const previousStatus = orderData.status;

      // 2. If order was cancellation_pending, call the standard RPC first
      if (previousStatus === 'cancellation_pending') {
        const res = await this.decideCancellation(orderId, true, reason);
        if (res.success) return { success: true };
      }

      // 3. Update delivery_orders directly
      const nowIso = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from('delivery_orders')
        .update({
          status: 'cancelled',
          cancellation_reason: reason,
          cancellation_decision_note: reason,
          cancellation_decided_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', orderId);

      if (updateErr) {
        // Fallback to RPC if direct update had policy restriction
        const rpcRes = await supabase.rpc('admin_decide_cancellation', {
          p_order_id: orderId,
          p_approve: true,
          p_decision_note: reason,
        });
        if (rpcRes.error) {
          throw new Error(rpcRes.error.message || updateErr.message);
        }
      }

      // 4. Record entry in delivery_order_status_history
      try {
        await supabase.from('delivery_order_status_history').insert({
          order_id: orderId,
          old_status: previousStatus,
          new_status: 'cancelled',
          changed_by: adminEmail || 'الإدارة',
          changed_by_role: 'ADMIN',
          note: reason,
          created_at: nowIso,
        });
      } catch (histErr) {
        console.warn('Could not insert to delivery_order_status_history:', histErr);
      }

      // 5. Verify persistence in Supabase
      const { data: verifiedOrder } = await supabase
        .from('delivery_orders')
        .select('id, status')
        .eq('id', orderId)
        .maybeSingle();

      if (verifiedOrder && verifiedOrder.status !== 'cancelled') {
        return { success: false, error: 'لم يتم اعتماد حالة الإلغاء في قاعدة البيانات' };
      }

      // 6. Log Audit
      await this.logAuditAction(
        'ORDER_CANCELLED_BY_ADMIN',
        'DELIVERY_ORDER',
        orderId,
        {
          order_id: orderId,
          reason,
          previous_status: previousStatus,
          cancelled_by: adminEmail || 'ADMIN',
        }
      );

      return { success: true };
    } catch (err: any) {
      console.error('Exception in adminCancelOrder:', err);
      return { success: false, error: err?.message || 'فشل إلغاء الطلب' };
    }
  },

  async getDeliveryDriversList(): Promise<Array<{ id: string; full_name: string; phone: string; is_active: boolean }>> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('delivery_drivers')
        .select('id, full_name, phone, is_active')
        .order('full_name', { ascending: true });

      if (error || !data) return [];
      return data;
    } catch {
      return [];
    }
  },

  async getDeliveryLocations(): Promise<{ governorates: string[]; markazes: string[] }> {
    if (!supabase) return { governorates: [], markazes: [] };
    try {
      const { data, error } = await supabase
        .from('delivery_orders')
        .select('governorate_name, markaz_name');

      if (error || !data) return { governorates: [], markazes: [] };

      const govs = Array.from(new Set(data.map((d) => d.governorate_name).filter(Boolean))) as string[];
      const marks = Array.from(new Set(data.map((d) => d.markaz_name).filter(Boolean))) as string[];

      return { governorates: govs.sort(), markazes: marks.sort() };
    } catch {
      return { governorates: [], markazes: [] };
    }
  },

  // --------------------------------------------------------------------------
  // Delivery Customers Management (Primary Source: delivery_orders correlated with profiles)
  // --------------------------------------------------------------------------
  async getDeliveryCustomers(filters?: DeliveryCustomerFilters): Promise<{
    customers: DeliveryCustomer[];
    stats: DeliveryCustomersStatsSummary;
    totalCount: number;
    error?: string;
  }> {
    const defaultStats: DeliveryCustomersStatsSummary = {
      total_customers: 0,
      registered_customers: 0,
      guest_customers: 0,
      repeat_customers: 0,
      total_orders: 0,
      total_revenue: 0,
    };

    if (!supabase) {
      return { customers: [], stats: defaultStats, totalCount: 0, error: 'Supabase غير متصل' };
    }

    try {
      // 1. Fetch all delivery orders to aggregate customer-level metrics
      const { data: orders, error: ordersErr } = await supabase
        .from('delivery_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersErr) {
        return { customers: [], stats: defaultStats, totalCount: 0, error: ordersErr.message };
      }

      if (!orders || orders.length === 0) {
        return { customers: [], stats: defaultStats, totalCount: 0 };
      }

      // 2. Extract distinct customer phone numbers to query matching registered profiles
      const normalizePhone = (p: string | null | undefined) => (p || '').replace(/[\s\-\(\)]/g, '').trim();
      
      const distinctPhones = Array.from(
        new Set(
          orders
            .map((o) => normalizePhone(o.customer_phone || o.phone_number))
            .filter(Boolean)
        )
      );

      // 3. Batch query profiles that correspond to these customer phone numbers
      const profileMap = new Map<string, any>();
      if (distinctPhones.length > 0) {
        try {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name, email, phone, avatar_url, created_at, status, is_blocked');

          if (profilesData && profilesData.length > 0) {
            profilesData.forEach((p: any) => {
              if (p.phone) {
                profileMap.set(normalizePhone(p.phone), p);
              }
            });
          }
        } catch (profileErr) {
          console.warn('Could not batch query profiles for delivery customers:', profileErr);
        }
      }

      // 4. Group delivery orders by customer (identified primarily by normalized phone)
      const customerOrdersGroup = new Map<string, any[]>();
      for (const order of orders) {
        const phone = normalizePhone(order.customer_phone || order.phone_number) || 'unknown_' + (order.household_id || order.id);
        if (!customerOrdersGroup.has(phone)) {
          customerOrdersGroup.set(phone, []);
        }
        customerOrdersGroup.get(phone)!.push(order);
      }

      // 5. Build DeliveryCustomer aggregated records
      const allCustomers: DeliveryCustomer[] = [];
      const localBlockedUsers = this.getLocalBlockedUsers();

      customerOrdersGroup.forEach((custOrders, phoneKey) => {
        custOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const latestOrder = custOrders[0];
        const oldestOrder = custOrders[custOrders.length - 1];

        const matchedProfile = profileMap.get(phoneKey);
        const customerName = latestOrder.customer_name || matchedProfile?.full_name || 'عميل دليفري';
        const rawPhone = latestOrder.customer_phone || latestOrder.phone_number || matchedProfile?.phone || phoneKey;

        const isBlocked = Boolean(
          matchedProfile?.is_blocked ||
          matchedProfile?.status === 'blocked' ||
          (matchedProfile?.id && localBlockedUsers[matchedProfile.id])
        );

        let accountStatus: 'registered' | 'guest' | 'blocked' = 'guest';
        if (isBlocked) {
          accountStatus = 'blocked';
        } else if (matchedProfile) {
          accountStatus = 'registered';
        }

        const completedOrders = custOrders.filter((o) => o.status === 'completed');
        const cancelledOrders = custOrders.filter((o) => o.status === 'cancelled');
        const pendingOrders = custOrders.filter((o) =>
          ['pending_review', 'accepted', 'cancellation_pending'].includes(o.status)
        );

        const totalSpent = completedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

        allCustomers.push({
          id: matchedProfile?.id || `cust_${phoneKey}`,
          customer_name: customerName,
          customer_phone: rawPhone,
          phone_number: latestOrder.phone_number || null,
          email: matchedProfile?.email || null,
          avatar_url: matchedProfile?.avatar_url || null,
          governorate_name: latestOrder.governorate_name || '',
          markaz_name: latestOrder.markaz_name || '',
          detailed_address: latestOrder.detailed_address || '',
          household_id: latestOrder.household_id || null,
          profile_id: matchedProfile?.id || null,
          account_created_at: matchedProfile?.created_at || oldestOrder.created_at,
          account_status: accountStatus,
          trust_status: 'unclassified',
          orders_count: custOrders.length,
          completed_orders_count: completedOrders.length,
          cancelled_orders_count: cancelledOrders.length,
          pending_orders_count: pendingOrders.length,
          total_spent: totalSpent,
          last_order_id: latestOrder.id,
          last_order_date: latestOrder.created_at,
          last_order_status: latestOrder.status,
          last_order_amount: Number(latestOrder.total_amount) || 0,
          first_order_date: oldestOrder.created_at,
        });
      });

      // 6. Compute summary stats
      const stats: DeliveryCustomersStatsSummary = {
        total_customers: allCustomers.length,
        registered_customers: allCustomers.filter((c) => c.account_status === 'registered').length,
        guest_customers: allCustomers.filter((c) => c.account_status === 'guest').length,
        repeat_customers: allCustomers.filter((c) => c.orders_count > 1).length,
        total_orders: orders.length,
        total_revenue: orders
          .filter((o) => o.status === 'completed')
          .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
      };

      // 7. Filter customer records
      let filtered = [...allCustomers];

      if (filters?.search && filters.search.trim()) {
        const s = filters.search.trim().toLowerCase();
        filtered = filtered.filter((c) =>
          (c.customer_name && c.customer_name.toLowerCase().includes(s)) ||
          (c.customer_phone && c.customer_phone.includes(s)) ||
          (c.email && c.email.toLowerCase().includes(s)) ||
          (c.last_order_id && c.last_order_id.toLowerCase().includes(s))
        );
      }

      if (filters?.governorate && filters.governorate !== 'all') {
        filtered = filtered.filter((c) => c.governorate_name === filters.governorate);
      }

      if (filters?.markaz && filters.markaz !== 'all') {
        filtered = filtered.filter((c) => c.markaz_name === filters.markaz);
      }

      if (filters?.accountStatus && filters.accountStatus !== 'all') {
        filtered = filtered.filter((c) => c.account_status === filters.accountStatus);
      }

      if (filters?.repeatFilter && filters.repeatFilter !== 'all') {
        if (filters.repeatFilter === 'repeat') {
          filtered = filtered.filter((c) => c.orders_count > 1);
        } else if (filters.repeatFilter === 'single') {
          filtered = filtered.filter((c) => c.orders_count === 1);
        }
      }

      // Sort by latest order date descending
      filtered.sort((a, b) => {
        const dateA = a.last_order_date ? new Date(a.last_order_date).getTime() : 0;
        const dateB = b.last_order_date ? new Date(b.last_order_date).getTime() : 0;
        return dateB - dateA;
      });

      // 8. Pagination
      const page = filters?.page || 1;
      const pageSize = filters?.pageSize || 20;
      const startIndex = (page - 1) * pageSize;
      const paginated = filtered.slice(startIndex, startIndex + pageSize);

      return {
        customers: paginated,
        stats,
        totalCount: filtered.length,
      };
    } catch (err: any) {
      console.error('Error in getDeliveryCustomers:', err);
      return { customers: [], stats: defaultStats, totalCount: 0, error: err?.message || 'فشل جلب العملاء' };
    }
  },

  async getDeliveryCustomerDetails(customerPhone: string): Promise<{
    customer: DeliveryCustomer | null;
    orders: DeliveryOrder[];
    error?: string;
  }> {
    if (!supabase) {
      return { customer: null, orders: [], error: 'Supabase غير متصل' };
    }

    try {
      const normalizePhone = (p: string | null | undefined) => (p || '').replace(/[\s\-\(\)]/g, '').trim();
      const targetPhone = normalizePhone(customerPhone);

      // 1. Fetch all orders for this customer
      const { data: rawOrders, error: ordersErr } = await supabase
        .from('delivery_orders')
        .select('*')
        .or(`customer_phone.ilike.%${targetPhone}%,phone_number.ilike.%${targetPhone}%`)
        .order('created_at', { ascending: false });

      if (ordersErr) {
        return { customer: null, orders: [], error: ordersErr.message };
      }

      const orders = (rawOrders || []).filter(
        (o) => normalizePhone(o.customer_phone) === targetPhone || normalizePhone(o.phone_number) === targetPhone
      );

      if (orders.length === 0) {
        return { customer: null, orders: [], error: 'لم يتم العثور على طلبات لهذا العميل' };
      }

      // 2. Batch fetch driver profiles for assigned drivers
      const driverIds = Array.from(new Set(orders.map((o) => o.assigned_driver_id).filter(Boolean))) as string[];
      const driverMap = new Map<string, any>();
      if (driverIds.length > 0) {
        try {
          const { data: driversData } = await supabase
            .from('delivery_drivers')
            .select('id, full_name, phone, vehicle_type, is_active')
            .in('id', driverIds);

          if (driversData) {
            driversData.forEach((d) => driverMap.set(d.id, d));
          }
        } catch (_) {}
      }

      // 3. Batch fetch items count for each order
      const orderIds = orders.map((o) => o.id);
      const itemsCountMap = new Map<string, number>();
      if (orderIds.length > 0) {
        try {
          const { data: itemsData } = await supabase
            .from('delivery_order_items')
            .select('order_id')
            .in('order_id', orderIds);

          if (itemsData) {
            itemsData.forEach((item) => {
              itemsCountMap.set(item.order_id, (itemsCountMap.get(item.order_id) || 0) + 1);
            });
          }
        } catch (_) {}
      }

      // Attach driver and items_count
      const enrichedOrders: DeliveryOrder[] = orders.map((o) => ({
        ...o,
        driver: o.assigned_driver_id ? driverMap.get(o.assigned_driver_id) || null : null,
        items_count: itemsCountMap.get(o.id) || 0,
      }));

      // 4. Fetch linked profile from public.profiles
      let matchedProfile: any = null;
      try {
        const { data: pData } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, avatar_url, created_at, status, is_blocked')
          .ilike('phone', `%${targetPhone}%`)
          .maybeSingle();
        matchedProfile = pData;
      } catch (_) {}

      const latestOrder = orders[0];
      const oldestOrder = orders[orders.length - 1];
      const localBlockedUsers = this.getLocalBlockedUsers();
      const isBlocked = Boolean(
        matchedProfile?.is_blocked ||
        matchedProfile?.status === 'blocked' ||
        (matchedProfile?.id && localBlockedUsers[matchedProfile.id])
      );

      let accountStatus: 'registered' | 'guest' | 'blocked' = 'guest';
      if (isBlocked) accountStatus = 'blocked';
      else if (matchedProfile) accountStatus = 'registered';

      const completedOrders = orders.filter((o) => o.status === 'completed');
      const cancelledOrders = orders.filter((o) => o.status === 'cancelled');
      const pendingOrders = orders.filter((o) =>
        ['pending_review', 'accepted', 'cancellation_pending'].includes(o.status)
      );

      const customer: DeliveryCustomer = {
        id: matchedProfile?.id || `cust_${targetPhone}`,
        customer_name: latestOrder.customer_name || matchedProfile?.full_name || 'عميل دليفري',
        customer_phone: latestOrder.customer_phone || targetPhone,
        phone_number: latestOrder.phone_number || null,
        email: matchedProfile?.email || null,
        avatar_url: matchedProfile?.avatar_url || null,
        governorate_name: latestOrder.governorate_name || '',
        markaz_name: latestOrder.markaz_name || '',
        detailed_address: latestOrder.detailed_address || '',
        household_id: latestOrder.household_id || null,
        profile_id: matchedProfile?.id || null,
        account_created_at: matchedProfile?.created_at || oldestOrder.created_at,
        account_status: accountStatus,
        trust_status: 'unclassified',
        orders_count: orders.length,
        completed_orders_count: completedOrders.length,
        cancelled_orders_count: cancelledOrders.length,
        pending_orders_count: pendingOrders.length,
        total_spent: completedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
        last_order_id: latestOrder.id,
        last_order_date: latestOrder.created_at,
        last_order_status: latestOrder.status,
        last_order_amount: Number(latestOrder.total_amount) || 0,
        first_order_date: oldestOrder.created_at,
      };

      return { customer, orders: enrichedOrders };
    } catch (err: any) {
      console.error('Error in getDeliveryCustomerDetails:', err);
      return { customer: null, orders: [], error: err?.message || 'فشل جلب تفاصيل العميل' };
    }
  },

  // --------------------------------------------------------------------------
  // Delivery Settings Management (Strict Database-Driven with RPC Invocation)
  // --------------------------------------------------------------------------
  async getDeliverySettings(): Promise<{
    settings: DeliveryServiceSettings | null;
    error?: string;
  }> {
    if (!supabase) {
      return { settings: null, error: 'Supabase غير متصل' };
    }

    try {
      const { data, error } = await supabase
        .from('delivery_settings')
        .select('id, delivery_enabled, default_delivery_fee, created_at, updated_at')
        .eq('id', 'default')
        .maybeSingle();

      if (error) {
        return { settings: null, error: error.message };
      }

      if (!data) {
        // Return default structure if no record found
        return {
          settings: {
            id: 'default',
            delivery_enabled: true,
            default_delivery_fee: 15,
          },
        };
      }

      return {
        settings: {
          id: data.id,
          delivery_enabled: Boolean(data.delivery_enabled),
          default_delivery_fee: Number(data.default_delivery_fee || 0),
          created_at: data.created_at,
          updated_at: data.updated_at,
        },
      };
    } catch (err: any) {
      console.error('Error in getDeliverySettings:', err);
      return { settings: null, error: err?.message || 'فشل جلب إعدادات الدليفري' };
    }
  },

  async updateDeliverySettings(
    enabled: boolean,
    defaultFee: number
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Supabase غير متصل' };
    }

    // Input validation
    if (typeof defaultFee !== 'number' || isNaN(defaultFee) || defaultFee < 0) {
      return { success: false, error: 'رسوم التوصيل الافتراضية يجب أن تكون قيمة رقمية صحيحة أكبر من أو تساوي صفراً' };
    }

    try {
      // 1. Mandatory requirement: Attempt execution via the existing RPC function
      // Expected parameters: p_enabled (boolean), p_default_fee (numeric)
      const { data, error: rpcErr } = await supabase.rpc('toggle_delivery_service', {
        p_enabled: enabled,
        p_default_fee: defaultFee,
      });

      if (rpcErr) {
        console.warn('RPC toggle_delivery_service invocation returned error:', rpcErr);

        // Analyze specific permission/RLS denial on the RPC
        if (rpcErr.code === '42501' || rpcErr.message?.includes('permission denied')) {
          return {
            success: false,
            error: 'تم رفض الإجراء (42501): صلاحيات الدالة toggle_delivery_service في قاعدة البيانات تتطلب ترخيص أمني (GRANT EXECUTE) للمستخدم الحالي. تم حظر التعديل المباشر منعاً لتجاوز RLS.',
          };
        }

        return {
          success: false,
          error: `فشل استدعاء دالة تحديث الخدمة (${rpcErr.code}): ${rpcErr.message}`,
        };
      }

      // Log action in audit log if successful
      try {
        await this.logAuditAction('delivery.settings_update', 'delivery_settings', 'default', {
          delivery_enabled: enabled,
          default_delivery_fee: defaultFee,
          method: 'rpc_toggle_delivery_service',
        });
      } catch (_) {}

      return { success: true };
    } catch (err: any) {
      console.error('Error updating delivery settings:', err);
      return { success: false, error: err?.message || 'حدث خطأ غير متوقع أثناء تحديث الإعدادات' };
    }
  },

  // --------------------------------------------------------------------------
  // Delivery Governorate Settings Management (Table: public.delivery_governorate_settings)
  // --------------------------------------------------------------------------
  async getDeliveryGovernorateSettings(): Promise<{
    governorates: DeliveryGovernorateSetting[];
    error?: string;
  }> {
    if (!supabase) return { governorates: [] };

    try {
      const { data, error } = await supabase
        .from('delivery_governorate_settings')
        .select('*')
        .order('governorate_name', { ascending: true });

      if (error) {
        console.warn('Error querying delivery_governorate_settings:', error);
        return { governorates: [], error: error.message };
      }

      const list: DeliveryGovernorateSetting[] = (data || []).map((row: any) => ({
        id: row.id,
        governorate_code: row.governorate_code,
        governorate_name: row.governorate_name,
        is_active: Boolean(row.is_active),
        delivery_fee: Number(row.delivery_fee) || 0,
        estimated_delivery_time: row.estimated_delivery_time || null,
        notes: row.notes || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      return { governorates: list };
    } catch (err: any) {
      console.error('getDeliveryGovernorateSettings failed:', err);
      return { governorates: [], error: err?.message || 'تعذر جلب إعدادات المحافظات' };
    }
  },

  async updateDeliveryGovernorateSetting(
    id: string,
    updates: {
      delivery_fee?: number;
      is_active?: boolean;
      estimated_delivery_time?: string | null;
      notes?: string | null;
      governorate_name?: string;
      governorate_code?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !id) return { success: false, error: 'المعرف مفقود' };

    if (updates.delivery_fee !== undefined && (isNaN(updates.delivery_fee) || updates.delivery_fee < 0)) {
      return { success: false, error: 'رسوم التوصيل يجب أن تكون قيمة موجبة أو صفر' };
    }

    try {
      // 1. Fetch current row to ensure we know the exact record details
      let currentGovCode = updates.governorate_code;
      let currentGovName = updates.governorate_name;
      let currentFee = updates.delivery_fee;
      let currentActive = updates.is_active;

      const { data: existing } = await supabase
        .from('delivery_governorate_settings')
        .select('id, governorate_code, governorate_name, delivery_fee, is_active')
        .eq('id', id)
        .maybeSingle();

      if (existing) {
        if (!currentGovCode) currentGovCode = existing.governorate_code;
        if (!currentGovName) currentGovName = existing.governorate_name;
        if (currentFee === undefined) currentFee = Number(existing.delivery_fee);
        if (currentActive === undefined) currentActive = Boolean(existing.is_active);
      }

      // 2. PRIORITY 1: Direct update by ID (Safest and never creates duplicates)
      const payload: any = {
        updated_at: new Date().toISOString(),
      };
      if (updates.delivery_fee !== undefined) payload.delivery_fee = updates.delivery_fee;
      if (updates.is_active !== undefined) payload.is_active = updates.is_active;
      if (updates.estimated_delivery_time !== undefined) payload.estimated_delivery_time = updates.estimated_delivery_time;
      if (updates.notes !== undefined) payload.notes = updates.notes;
      if (updates.governorate_name !== undefined) payload.governorate_name = updates.governorate_name;
      if (updates.governorate_code !== undefined) payload.governorate_code = updates.governorate_code;

      const { data: directData, error: directError } = await supabase
        .from('delivery_governorate_settings')
        .update(payload)
        .eq('id', id)
        .select();

      if (!directError && directData && directData.length > 0) {
        await this.logAuditAction('delivery.governorate_update', 'delivery_governorate_settings', id, { ...updates, method: 'direct_id_update' });

        // If this governorate has any duplicate rows in DB, synchronize them so they do not contradict
        try {
          if (currentGovName || currentGovCode) {
            await this.syncDuplicateGovernorateRows(id, currentGovName, currentGovCode, currentActive, currentFee);
          }
        } catch (_) {}

        return { success: true };
      }

      // 3. PRIORITY 2: Edge Function admin-api
      try {
        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('admin-api', {
          body: {
            action: 'update-delivery-governorate',
            payload: { id, governorate_code: currentGovCode, updates },
          },
        });
        if (!edgeErr && edgeData?.success) {
          await this.logAuditAction('delivery.governorate_update', 'delivery_governorate_settings', id, { ...updates, method: 'edge_function' });
          return { success: true };
        }
      } catch (_) {}

      // 4. PRIORITY 3: Database RPC admin_set_governorate_delivery
      if (currentGovCode && currentFee !== undefined && currentActive !== undefined) {
        try {
          const { error: rpcErr } = await supabase.rpc('admin_set_governorate_delivery', {
            p_delivery_fee: currentFee,
            p_governorate_code: currentGovCode,
            p_is_active: currentActive,
          });

          if (!rpcErr) {
            if (updates.notes !== undefined || updates.estimated_delivery_time !== undefined || updates.governorate_name !== undefined) {
              await supabase
                .from('delivery_governorate_settings')
                .update({
                  notes: updates.notes,
                  estimated_delivery_time: updates.estimated_delivery_time,
                  governorate_name: updates.governorate_name,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', id);
            }
            await this.logAuditAction('delivery.governorate_update', 'delivery_governorate_settings', id, { ...updates, method: 'rpc_admin_set_governorate_delivery' });
            return { success: true };
          }
        } catch (_) {}
      }

      if (directError) {
        console.error('Error updating delivery_governorate_settings:', directError);
        return { success: false, error: `خطأ قاعدة البيانات: ${directError.message}` };
      }

      return {
        success: false,
        error: 'لم يتم حفظ التعديل؛ يرجى التأكد من صلاحيات RLS أو استخدام دالة RPC المعتمدة.',
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر تحديث إعدادات المحافظة' };
    }
  },

  /**
   * Helper to ensure any duplicate rows in delivery_governorate_settings for the same governorate
   * don't remain in a contradictory state (e.g. SOHAG active vs سوهاج inactive).
   */
  async syncDuplicateGovernorateRows(
    excludeId: string,
    govName?: string,
    govCode?: string,
    isActive?: boolean,
    deliveryFee?: number
  ): Promise<void> {
    if (!supabase || (!govName && !govCode)) return;
    try {
      const { data: allRows } = await supabase.from('delivery_governorate_settings').select('id, governorate_name, governorate_code');
      if (!allRows || allRows.length <= 1) return;

      const targetMatch = matchEgyptGovernorate(govCode || '') || matchEgyptGovernorate(govName || '');
      const targetCode = targetMatch?.code?.toUpperCase();

      for (const row of allRows) {
        if (row.id === excludeId) continue;
        const rowMatch = matchEgyptGovernorate(row.governorate_code || '') || matchEgyptGovernorate(row.governorate_name || '');
        const rowCode = rowMatch?.code?.toUpperCase();

        const isSameGov =
          (targetCode && rowCode && targetCode === rowCode) ||
          (govName && normalizeLocationText(row.governorate_name) === normalizeLocationText(govName)) ||
          (govCode && (row.governorate_code || '').toUpperCase() === govCode.toUpperCase());

        if (isSameGov) {
          const syncPayload: any = { updated_at: new Date().toISOString() };
          if (isActive !== undefined) syncPayload.is_active = isActive;
          if (deliveryFee !== undefined) syncPayload.delivery_fee = deliveryFee;
          await supabase.from('delivery_governorate_settings').update(syncPayload).eq('id', row.id);
        }
      }
    } catch (_) {}
  },

  /**
   * Cleans up and merges duplicate governorate rows (e.g. SOHAG + سوهاج),
   * preserving the official Arabic record with the active status and custom fee,
   * while safely deleting redundant entries.
   */
  async cleanupDuplicateGovernorates(): Promise<{
    success: boolean;
    removedCount: number;
    mergedNames: string[];
    error?: string;
  }> {
    if (!supabase) return { success: false, removedCount: 0, mergedNames: [], error: 'Supabase غير متصل' };

    try {
      const { data: rows, error: fetchErr } = await supabase
        .from('delivery_governorate_settings')
        .select('*');

      if (fetchErr || !rows) {
        return { success: false, removedCount: 0, mergedNames: [], error: fetchErr?.message || 'فشل جلب المحافظات' };
      }

      // Group rows by canonical official governorate or normalized Arabic name
      const groups = new Map<string, any[]>();
      for (const r of rows) {
        const match = matchEgyptGovernorate(r.governorate_code) || matchEgyptGovernorate(r.governorate_name);
        const key = match ? match.code : normalizeLocationText(r.governorate_name);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      }

      let removedCount = 0;
      const mergedNames: string[] = [];

      for (const [key, groupRows] of groups.entries()) {
        if (groupRows.length > 1) {
          // Identify canonical row (prefer Arabic name over Latin uppercase)
          const arabicRow = groupRows.find((r) => !/^[A-Za-z\s_-]+$/.test(r.governorate_name));
          const canonical = arabicRow || groupRows[0];

          // Determine merged values:
          // If ANY row in the duplicate group was active, the canonical becomes ACTIVE
          const hasAnyActive = groupRows.some((r) => Boolean(r.is_active));
          // Find the customized fee (prefer highest or non-default)
          const customFeeRow = groupRows.find((r) => Number(r.delivery_fee) > 0);
          const fee = customFeeRow ? Number(customFeeRow.delivery_fee) : Number(canonical.delivery_fee);

          const officialMatch = matchEgyptGovernorate(canonical.governorate_code) || matchEgyptGovernorate(canonical.governorate_name);
          const canonicalName = officialMatch?.name_ar || canonical.governorate_name;
          const canonicalCode = officialMatch?.code || canonical.governorate_code;

          // 1. Update canonical row
          await supabase
            .from('delivery_governorate_settings')
            .update({
              governorate_name: canonicalName,
              governorate_code: canonicalCode,
              is_active: hasAnyActive,
              delivery_fee: fee,
              updated_at: new Date().toISOString(),
            })
            .eq('id', canonical.id);

          // 2. Delete redundant rows
          for (const duplicateRow of groupRows) {
            if (duplicateRow.id !== canonical.id) {
              await supabase
                .from('delivery_governorate_settings')
                .delete()
                .eq('id', duplicateRow.id);
              removedCount++;
            }
          }

          mergedNames.push(canonicalName);
          await this.logAuditAction('delivery.governorate_merge_duplicates', 'delivery_governorate_settings', canonical.id, {
            mergedGroup: key,
            canonicalName,
            removedCount: groupRows.length - 1,
          });
        }
      }

      return { success: true, removedCount, mergedNames };
    } catch (err: any) {
      console.error('cleanupDuplicateGovernorates error:', err);
      return { success: false, removedCount: 0, mergedNames: [], error: err?.message || 'تعذر دمج السجلات المكررة' };
    }
  },

  async addDeliveryGovernorateSetting(setting: {
    governorate_code: string;
    governorate_name: string;
    delivery_fee: number;
    is_active?: boolean;
    estimated_delivery_time?: string | null;
    notes?: string | null;
  }): Promise<{ success: boolean; data?: DeliveryGovernorateSetting; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase غير مهيأ' };

    if (!setting.governorate_code?.trim() || !setting.governorate_name?.trim()) {
      return { success: false, error: 'كود المحافظة واسمها حقول إلزامية' };
    }

    if (typeof setting.delivery_fee !== 'number' || isNaN(setting.delivery_fee) || setting.delivery_fee < 0) {
      return { success: false, error: 'رسوم التوصيل يجب أن تكون قيمة عددية صالحة' };
    }

    try {
      const govCode = setting.governorate_code.trim().toUpperCase();
      const govName = setting.governorate_name.trim();
      const isActive = setting.is_active !== undefined ? setting.is_active : true;

      // 0. Check if a record already exists for this governorate to PREVENT DUPLICATION
      const { data: existingRows } = await supabase
        .from('delivery_governorate_settings')
        .select('id, governorate_name, governorate_code');

      if (existingRows && existingRows.length > 0) {
        const officialMatch = matchEgyptGovernorate(govCode) || matchEgyptGovernorate(govName);
        const existingDuplicate = existingRows.find((r: any) => {
          const rMatch = matchEgyptGovernorate(r.governorate_code) || matchEgyptGovernorate(r.governorate_name);
          if (officialMatch && rMatch && officialMatch.code === rMatch.code) return true;
          if ((r.governorate_code || '').toUpperCase() === govCode) return true;
          if (normalizeLocationText(r.governorate_name) === normalizeLocationText(govName)) return true;
          return false;
        });

        if (existingDuplicate) {
          // Update the existing record instead of inserting a duplicate!
          const updateRes = await this.updateDeliveryGovernorateSetting(existingDuplicate.id, {
            governorate_name: govName,
            governorate_code: govCode,
            delivery_fee: setting.delivery_fee,
            is_active: isActive,
            estimated_delivery_time: setting.estimated_delivery_time,
            notes: setting.notes,
          });

          if (updateRes.success) {
            return {
              success: true,
              data: {
                id: existingDuplicate.id,
                governorate_code: govCode,
                governorate_name: govName,
                delivery_fee: setting.delivery_fee,
                is_active: isActive,
                estimated_delivery_time: setting.estimated_delivery_time || null,
                notes: setting.notes || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            };
          }
        }
      }

      // 1. Try Edge Function admin-api
      try {
        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('admin-api', {
          body: {
            action: 'add-delivery-governorate',
            payload: { setting },
          },
        });
        if (!edgeErr && edgeData?.success && edgeData?.data) {
          await this.logAuditAction('delivery.governorate_add', 'delivery_governorate_settings', edgeData.data.id || govCode, setting);
          return { success: true, data: edgeData.data };
        }
      } catch (_) {}

      // 2. Try Direct Insert
      const newRow = {
        governorate_code: govCode,
        governorate_name: govName,
        delivery_fee: setting.delivery_fee,
        is_active: isActive,
        estimated_delivery_time: setting.estimated_delivery_time?.trim() || null,
        notes: setting.notes?.trim() || null,
      };

      const { data, error } = await supabase
        .from('delivery_governorate_settings')
        .insert([newRow])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'كود المحافظة أو اسمها مسجل بالفعل في النظام' };
        }
        if (error.code === '42501' || error.message?.includes('violates row-level security')) {
          return {
            success: false,
            error: 'تعذر إضافة المحافظة بسبب سياسة حماية مستوى الصف (RLS). جدول delivery_governorate_settings يتطلب إضافة سياسة INSERT للأدمن في Supabase.',
          };
        }
        return { success: false, error: error.message };
      }

      await this.logAuditAction('delivery.governorate_add', 'delivery_governorate_settings', data.id, newRow);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر إضافة المحافظة' };
    }
  },

  async toggleGovernorateActive(
    id: string,
    isActive: boolean,
    governorateCode?: string,
    deliveryFee?: number,
    governorateName?: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateDeliveryGovernorateSetting(id, {
      is_active: isActive,
      governorate_code: governorateCode,
      delivery_fee: deliveryFee,
      governorate_name: governorateName,
    });
  },

  async deleteDeliveryGovernorateSetting(id: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !id) return { success: false, error: 'المعرف مفقود' };
    try {
      // 1. Direct Delete FIRST (Safest and fastest)
      const { data, error } = await supabase
        .from('delivery_governorate_settings')
        .delete()
        .eq('id', id)
        .select();

      if (!error) {
        await this.logAuditAction('delivery.governorate_delete', 'delivery_governorate_settings', id, {});
        return { success: true };
      }

      // 2. Try Edge Function admin-api fallback
      try {
        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('admin-api', {
          body: {
            action: 'delete-delivery-governorate',
            payload: { id },
          },
        });
        if (!edgeErr && edgeData?.success) {
          await this.logAuditAction('delivery.governorate_delete', 'delivery_governorate_settings', id, {});
          return { success: true };
        }
      } catch (_) {}

      return { success: false, error: error?.message || 'تعذر حذف المحافظة' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر حذف المحافظة' };
    }
  },

  /**
   * Evaluates delivery fee and availability for any customer location input.
   * Adheres strictly to the 3 Priority Rules.
   */
  async calculateOrderDeliveryFee(customerLocation: string): Promise<DeliveryCalculationResult> {
    const [govsRes, settingsRes] = await Promise.all([
      this.getDeliveryGovernorateSettings(),
      this.getDeliverySettings(),
    ]);

    return calculateDeliveryFee(
      customerLocation,
      govsRes.governorates || [],
      settingsRes.settings
    );
  },

  async seedDefaultGovernorates(defaultFee: number = 15): Promise<{
    success: boolean;
    insertedCount: number;
    error?: string;
  }> {
    if (!supabase) return { success: false, insertedCount: 0, error: 'Supabase غير مهيأ' };

    const DEFAULT_EGYPT_GOVERNORATES = [
      { governorate_code: 'CAI', governorate_name: 'القاهرة', delivery_fee: defaultFee, estimated_delivery_time: '30-45 دقيقة' },
      { governorate_code: 'GZ', governorate_name: 'الجيزة', delivery_fee: defaultFee, estimated_delivery_time: '30-45 دقيقة' },
      { governorate_code: 'ALX', governorate_name: 'الإسكندرية', delivery_fee: defaultFee + 5, estimated_delivery_time: '40-60 دقيقة' },
      { governorate_code: 'QLB', governorate_name: 'القليوبية', delivery_fee: defaultFee + 5, estimated_delivery_time: '35-50 دقيقة' },
      { governorate_code: 'SHR', governorate_name: 'الشرقية', delivery_fee: defaultFee + 10, estimated_delivery_time: '45-60 دقيقة' },
      { governorate_code: 'DK', governorate_name: 'الدقهلية', delivery_fee: defaultFee + 10, estimated_delivery_time: '45-60 دقيقة' },
      { governorate_code: 'GH', governorate_name: 'الغربية', delivery_fee: defaultFee + 10, estimated_delivery_time: '45-60 دقيقة' },
      { governorate_code: 'MNF', governorate_name: 'المنوفية', delivery_fee: defaultFee + 10, estimated_delivery_time: '45-60 دقيقة' },
      { governorate_code: 'BH', governorate_name: 'البحيرة', delivery_fee: defaultFee + 15, estimated_delivery_time: '50-70 دقيقة' },
      { governorate_code: 'KFS', governorate_name: 'كفر الشيخ', delivery_fee: defaultFee + 15, estimated_delivery_time: '50-70 دقيقة' },
      { governorate_code: 'DT', governorate_name: 'دمياط', delivery_fee: defaultFee + 15, estimated_delivery_time: '50-70 دقيقة' },
      { governorate_code: 'PTS', governorate_name: 'بورسعيد', delivery_fee: defaultFee + 15, estimated_delivery_time: '50-70 دقيقة' },
      { governorate_code: 'ISM', governorate_name: 'الإسماعيلية', delivery_fee: defaultFee + 15, estimated_delivery_time: '50-70 دقيقة' },
      { governorate_code: 'SUZ', governorate_name: 'السويس', delivery_fee: defaultFee + 15, estimated_delivery_time: '50-70 دقيقة' },
      { governorate_code: 'FYM', governorate_name: 'الفيوم', delivery_fee: defaultFee + 20, estimated_delivery_time: '60-80 دقيقة' },
      { governorate_code: 'BNS', governorate_name: 'بني سويف', delivery_fee: defaultFee + 20, estimated_delivery_time: '60-80 دقيقة' },
      { governorate_code: 'MN', governorate_name: 'المنيا', delivery_fee: defaultFee + 25, estimated_delivery_time: '60-90 دقيقة' },
      { governorate_code: 'AST', governorate_name: 'أسيوط', delivery_fee: defaultFee + 25, estimated_delivery_time: '60-90 دقيقة' },
      { governorate_code: 'SHG', governorate_name: 'سوهاج', delivery_fee: defaultFee + 30, estimated_delivery_time: '60-90 دقيقة' },
      { governorate_code: 'QN', governorate_name: 'قنا', delivery_fee: defaultFee + 30, estimated_delivery_time: '60-90 دقيقة' },
      { governorate_code: 'LX', governorate_name: 'الأقصر', delivery_fee: defaultFee + 35, estimated_delivery_time: '60-90 دقيقة' },
      { governorate_code: 'ASW', governorate_name: 'أسوان', delivery_fee: defaultFee + 35, estimated_delivery_time: '60-90 دقيقة' },
      { governorate_code: 'RS', governorate_name: 'البحر الأحمر', delivery_fee: defaultFee + 45, estimated_delivery_time: '2-3 أيام' },
      { governorate_code: 'NV', governorate_name: 'الوادي الجديد', delivery_fee: defaultFee + 45, estimated_delivery_time: '2-3 أيام' },
      { governorate_code: 'MT', governorate_name: 'مطروح', delivery_fee: defaultFee + 35, estimated_delivery_time: '1-2 أيام' },
      { governorate_code: 'SIN', governorate_name: 'شمال سيناء', delivery_fee: defaultFee + 45, estimated_delivery_time: '2-3 أيام' },
      { governorate_code: 'SIS', governorate_name: 'جنوب سيناء', delivery_fee: defaultFee + 45, estimated_delivery_time: '2-3 أيام' },
    ];

    try {
      const rows = DEFAULT_EGYPT_GOVERNORATES.map((g) => ({
        ...g,
        is_active: true,
      }));

      const { data, error } = await supabase
        .from('delivery_governorate_settings')
        .upsert(rows, { onConflict: 'governorate_code' })
        .select();

      if (error) {
        console.error('Error seeding default governorates:', error);
        return { success: false, insertedCount: 0, error: error.message };
      }

      await this.logAuditAction('delivery.governorate_seed', 'delivery_governorate_settings', 'all', {
        count: data?.length || 0,
      });

      return { success: true, insertedCount: data?.length || 0 };
    } catch (err: any) {
      return { success: false, insertedCount: 0, error: err?.message || 'تعذر تهيئة المحافظات' };
    }
  },

  // --------------------------------------------------------------------------
  // App Assets Management (home, driver, admin × header, splash via app_assets & app_asset_uploads)
  // --------------------------------------------------------------------------
  async getAllAppAssets(): Promise<{
    assetsByApp: AllAppAssetsMap;
    uploadsHistory: AppAssetUploadRecord[];
  }> {
    const assetsByApp = await fetchRemoteAllAppAssets();
    let uploadsHistory: AppAssetUploadRecord[] = [];

    if (supabase && isSupabaseConfigured) {
      try {
        const { data: upList } = await supabase
          .from('app_asset_uploads')
          .select('*')
          .in('app_key', SUPPORTED_APP_KEYS)
          .in('asset_type', SUPPORTED_ASSET_TYPES)
          .order('created_at', { ascending: false })
          .limit(60);
        if (Array.isArray(upList)) {
          uploadsHistory = upList as AppAssetUploadRecord[];
        }
      } catch {
        // Ignore history fetch errors when offline
      }
    }

    // Fallback for admin app to local confirmed cache if offline or remote not reachable
    for (const type of ['header', 'splash'] as AppAssetType[]) {
      if (!assetsByApp.admin[type]) {
        const local = getLatestConfirmedLocalAsset(type);
        if (local) {
          assetsByApp.admin[type] = {
            id: local.upload_id,
            app_key: 'admin',
            asset_type: type,
            upload_id: local.upload_id,
            version: local.version,
            is_active: true,
            updated_at: local.updated_at || local.confirmed_at,
            updated_by: null,
            upload: {
              id: local.upload_id,
              app_key: 'admin',
              asset_type: type,
              storage_path: local.storage_path,
              public_url: local.local_data_url || local.public_url,
              original_filename: local.original_filename || null,
              mime_type: local.mime_type || null,
              file_size_bytes: local.file_size_bytes ?? null,
              width: local.width ?? null,
              height: local.height ?? null,
              is_current: true,
              created_at: local.updated_at || local.confirmed_at,
            },
          };
        }
      }
    }

    return {
      assetsByApp,
      uploadsHistory,
    };
  },

  async getAdminAppAssets(): Promise<{
    header: AppAssetRecord | null;
    splash: AppAssetRecord | null;
    uploadsHistory: AppAssetUploadRecord[];
  }> {
    const { assetsByApp, uploadsHistory } = await this.getAllAppAssets();
    return {
      header: assetsByApp.admin.header,
      splash: assetsByApp.admin.splash,
      uploadsHistory: uploadsHistory.filter((u) => u.app_key === 'admin'),
    };
  },

  async uploadAppAsset(
    appKey: AppAssetKey,
    assetType: AppAssetType,
    file: File
  ): Promise<{
    success: boolean;
    asset?: AppAssetRecord;
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'اتصال Supabase غير متوفر حالياً' };
    }

    if (!SUPPORTED_APP_KEYS.includes(appKey)) {
      return { success: false, error: 'معرف التطبيق غير صالح (مسموح فقط: home أو driver أو admin)' };
    }

    if (assetType !== 'header' && assetType !== 'splash') {
      return { success: false, error: 'نوع الصورة غير صالح (مسموح فقط: header أو splash)' };
    }

    if (!file) {
      return { success: false, error: 'يرجى اختيار ملف صورة أولاً' };
    }

    // 1. Resolve extension & MIME type reliably (even if OS/Android file picker leaves file.type empty)
    const rawExt = (file.name ? file.name.split('.').pop() || '' : '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    const extToMimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      gif: 'image/gif',
    };

    const mimeExtMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/gif': 'gif',
    };

    const allowedMimeTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/svg+xml',
      'image/gif',
    ];

    const normalizedFileType = (file.type || '').toLowerCase().trim();
    const resolvedMimeType = allowedMimeTypes.includes(normalizedFileType)
      ? normalizedFileType === 'image/jpg'
        ? 'image/jpeg'
        : normalizedFileType
      : extToMimeMap[rawExt] || '';

    if (!resolvedMimeType || !allowedMimeTypes.includes(resolvedMimeType)) {
      return {
        success: false,
        error: 'نوع الملف غير مدعوم. يرجى اختيار صورة بصيغة PNG أو JPG أو WEBP أو SVG.',
      };
    }

    const ext = rawExt && extToMimeMap[rawExt] ? rawExt : mimeExtMap[resolvedMimeType] || 'png';

    // 2. Validate file size (max 10 MB)
    const maxBytes = 10 * 1024 * 1024;
    if (typeof file.size === 'number' && file.size > maxBytes) {
      return {
        success: false,
        error: 'حجم الصورة يتجاوز الحد المسموح به (10 ميجابايت كحد أقصى).',
      };
    }

    try {
      // Read file into an in-memory Blob + Data URL using a 3-stage resilient strategy
      // so mobile/WebView transient file handles never fail with FileReader NotReadableError
      let uploadBlob: Blob | null = null;
      let localDataUrl = '';
      let preReadDimensions: { valid: boolean; width: number; height: number } | null = null;

      // Strategy A: Read raw ArrayBuffer directly into memory
      try {
        let arrayBuf: ArrayBuffer | null = null;
        if (typeof file.arrayBuffer === 'function') {
          arrayBuf = await file.arrayBuffer();
        } else if (typeof Response !== 'undefined') {
          arrayBuf = await new Response(file).arrayBuffer();
        }
        if (arrayBuf && arrayBuf.byteLength > 0) {
          uploadBlob = new Blob([arrayBuf], { type: resolvedMimeType });
          localDataUrl = arrayBufferToBase64DataUrl(arrayBuf, resolvedMimeType);
        }
      } catch {
        // Proceed to Strategy B
      }

      // Strategy B: Fallback to FileReader.readAsDataURL
      if (!uploadBlob || !localDataUrl) {
        try {
          const dataUrlFromReader = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
                if (reader.result.startsWith('data:image/')) {
                  resolve(reader.result);
                } else {
                  const base64Idx = reader.result.indexOf(';base64,');
                  if (base64Idx !== -1) {
                    resolve(`data:${resolvedMimeType}${reader.result.slice(base64Idx)}`);
                  } else {
                    resolve(reader.result);
                  }
                }
              } else {
                reject(new Error('Empty reader result'));
              }
            };
            reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
            reader.readAsDataURL(file);
          });

          if (dataUrlFromReader) {
            localDataUrl = dataUrlFromReader;
            const res = await fetch(dataUrlFromReader);
            const b = await res.blob();
            uploadBlob = new Blob([b], { type: resolvedMimeType });
          }
        } catch {
          // Proceed to Strategy C
        }
      }

      // Strategy C: Fallback via URL.createObjectURL + HTMLImageElement + Canvas
      if (!uploadBlob || !localDataUrl) {
        try {
          const objectUrl = URL.createObjectURL(file);
          try {
            const decoded = await new Promise<{
              dataUrl: string;
              blob: Blob;
              width: number;
              height: number;
            }>((resolve, reject) => {
              const img = new Image();
              img.onload = () => {
                const w = img.naturalWidth || img.width || 512;
                const h = img.naturalHeight || img.height || 512;
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  reject(new Error('Canvas context unavailable'));
                  return;
                }
                ctx.drawImage(img, 0, 0, w, h);
                const outMime =
                  resolvedMimeType === 'image/jpeg' || resolvedMimeType === 'image/webp'
                    ? resolvedMimeType
                    : 'image/png';
                const dUrl = canvas.toDataURL(outMime, 0.95);
                canvas.toBlob(
                  (b) => {
                    if (b && dUrl) {
                      resolve({ dataUrl: dUrl, blob: b, width: w, height: h });
                    } else {
                      reject(new Error('Canvas blob conversion failed'));
                    }
                  },
                  outMime,
                  0.95
                );
              };
              img.onerror = () => reject(new Error('Image objectURL load failed'));
              img.src = objectUrl;
            });

            uploadBlob = decoded.blob;
            localDataUrl = decoded.dataUrl;
            preReadDimensions = {
              valid: true,
              width: decoded.width,
              height: decoded.height,
            };
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        } catch {
          // All 3 strategies failed
        }
      }

      if (!uploadBlob || uploadBlob.size <= 0 || !localDataUrl) {
        return {
          success: false,
          error:
            'تعذر قراءة ملف الصورة من الجهاز. يرجى التأكد من أن الصورة محفوظة محلياً على الجهاز والمحاولة مرة أخرى.',
        };
      }

      let dimensions = preReadDimensions || (await verifyImageReadable(uploadBlob));
      if (!dimensions.valid) {
        dimensions = await verifyImageReadable(localDataUrl);
      }
      if (!dimensions.valid) {
        return {
          success: false,
          error: 'ملف الصورة غير صالح أو تالف ولا يمكن عرضه.',
        };
      }

      const finalFileSize = uploadBlob.size || file.size || 0;

      // Check current authenticated admin user
      const { data: authData } = await supabase.auth.getUser();
      const callerId = authData?.user?.id || null;

      // 3. Generate unique UUID storage path: <appKey>/<assetType>/<uuid>.<ext>
      const uuid =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              const v = c === 'x' ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            });

      const storagePath = `${appKey}/${assetType}/${uuid}.${ext}`;

      // 4. Upload in-memory Blob to Storage bucket "app-assets" (without deleting old image)
      const { error: uploadErr } = await supabase.storage
        .from('app-assets')
        .upload(storagePath, uploadBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: resolvedMimeType,
        });

      if (uploadErr) {
        return {
          success: false,
          error: `فشل رفع الصورة إلى التخزين (app-assets): ${uploadErr.message}`,
        };
      }

      const { data: pubUrlData } = supabase.storage.from('app-assets').getPublicUrl(storagePath);
      const publicUrl = pubUrlData?.publicUrl || '';

      if (!publicUrl) {
        return {
          success: false,
          error: 'تعذر استخراج الرابط العام للصورة بعد الرفع.',
        };
      }

      const nowIso = new Date().toISOString();

      // 5. Insert new record into app_asset_uploads (initially is_current: false so old image stays current until confirmed)
      const baseInsertPayload: Record<string, any> = {
        app_key: appKey,
        asset_type: assetType,
        storage_path: storagePath,
        public_url: publicUrl,
        original_filename: file.name || `${assetType}.${ext}`,
        mime_type: resolvedMimeType,
        file_size_bytes: finalFileSize,
        width: dimensions.width || null,
        height: dimensions.height || null,
        is_current: false,
        uploaded_by: callerId,
      };

      let insertedUpload: any = null;
      const { data: insData, error: insErr } = await supabase
        .from('app_asset_uploads')
        .insert([baseInsertPayload])
        .select('*')
        .single();

      if (insErr) {
        // Fallback if schema uses file_size instead of file_size_bytes
        if (insErr.message?.includes('file_size_bytes')) {
          const { file_size_bytes, ...restPayload } = baseInsertPayload;
          const retryRes = await supabase
            .from('app_asset_uploads')
            .insert([{ ...restPayload, file_size: file.size }])
            .select('*')
            .single();
          if (retryRes.error || !retryRes.data) {
            return {
              success: false,
              error: `فشل تسجيل الصورة في app_asset_uploads: ${retryRes.error?.message || insErr.message}`,
            };
          }
          insertedUpload = retryRes.data;
        } else {
          return {
            success: false,
            error: `فشل تسجيل الصورة في app_asset_uploads: ${insErr.message}`,
          };
        }
      } else {
        insertedUpload = insData;
      }

      const newUploadId = insertedUpload.id as string;

      // 6. Unset is_current on previous uploads for ${appKey}/${assetType}, then set is_current = true on the new upload
      await supabase
        .from('app_asset_uploads')
        .update({ is_current: false })
        .eq('app_key', appKey)
        .eq('asset_type', assetType)
        .neq('id', newUploadId);

      const { data: currentUpdatedUpload, error: markCurrentErr } = await supabase
        .from('app_asset_uploads')
        .update({ is_current: true })
        .eq('id', newUploadId)
        .select('*')
        .single();

      if (markCurrentErr) {
        return {
          success: false,
          error: `فشل اعتماد الصورة الحالية في app_asset_uploads: ${markCurrentErr.message}`,
        };
      }

      const finalUploadRecord: AppAssetUploadRecord = (currentUpdatedUpload || {
        ...insertedUpload,
        is_current: true,
      }) as AppAssetUploadRecord;

      // 7. Update app_assets and increment version ONLY after upload & registration succeeded
      const { data: existingAsset } = await supabase
        .from('app_assets')
        .select('*')
        .eq('app_key', appKey)
        .eq('asset_type', assetType)
        .maybeSingle();

      // First attach upload_id, updated_at, updated_by on app_assets if row exists
      if (existingAsset) {
        const { error: preUpdateErr } = await supabase
          .from('app_assets')
          .update({
            upload_id: newUploadId,
            is_active: true,
            updated_at: nowIso,
            updated_by: callerId,
          })
          .eq('id', existingAsset.id);

        if (preUpdateErr) {
          return {
            success: false,
            error: `فشل تحديث سجل app_assets: ${preUpdateErr.message}`,
          };
        }
      }

      // Call public.increment_app_asset_version(p_app_key, p_asset_type)
      let newVersion: number | null = null;
      const { data: rpcVersionData, error: rpcErr } = await supabase.rpc(
        'increment_app_asset_version',
        {
          p_app_key: appKey,
          p_asset_type: assetType,
        }
      );

      if (!rpcErr && typeof rpcVersionData === 'number') {
        newVersion = rpcVersionData;
      } else if (
        !rpcErr &&
        rpcVersionData &&
        typeof (rpcVersionData as any).version === 'number'
      ) {
        newVersion = (rpcVersionData as any).version;
      }

      // Ensure app_assets row has upload_id, updated_at, updated_by, and version synchronized
      const { data: checkAssetAfterRpc } = await supabase
        .from('app_assets')
        .select('*')
        .eq('app_key', appKey)
        .eq('asset_type', assetType)
        .maybeSingle();

      let finalAssetRow: any = null;

      if (checkAssetAfterRpc) {
        const computedVersion =
          newVersion ??
          (existingAsset
            ? Number(existingAsset.version || 1) + 1
            : Number(checkAssetAfterRpc.version || 1));

        const { data: updatedAssetRow, error: finalUpdateErr } = await supabase
          .from('app_assets')
          .update({
            upload_id: newUploadId,
            version: computedVersion,
            is_active: true,
            updated_at: nowIso,
            updated_by: callerId,
          })
          .eq('id', checkAssetAfterRpc.id)
          .select('*')
          .single();

        if (finalUpdateErr) {
          return {
            success: false,
            error: `فشل تأكيد تحديث سجل app_assets: ${finalUpdateErr.message}`,
          };
        }
        finalAssetRow = updatedAssetRow;
      } else {
        const initialVersion = newVersion ?? 1;
        const { data: insertedAssetRow, error: insAssetErr } = await supabase
          .from('app_assets')
          .insert([
            {
              app_key: appKey,
              asset_type: assetType,
              upload_id: newUploadId,
              version: initialVersion,
              is_active: true,
              updated_at: nowIso,
              updated_by: callerId,
            },
          ])
          .select('*')
          .single();

        if (insAssetErr) {
          return {
            success: false,
            error: `فشل إنشاء سجل app_assets: ${insAssetErr.message}`,
          };
        }
        finalAssetRow = insertedAssetRow;
      }

      const finalVersion = Number(finalAssetRow?.version ?? newVersion ?? 1);

      // 8. If this asset is for the Admin app itself, update Local Confirmed Asset Cache
      if (appKey === 'admin') {
        const confirmedLocal: LocalConfirmedAppAsset = {
          app_key: 'admin',
          asset_type: assetType,
          version: finalVersion,
          upload_id: newUploadId,
          storage_path: storagePath,
          public_url: publicUrl,
          local_data_url: localDataUrl,
          original_filename: file.name || `${assetType}.${ext}`,
          mime_type: resolvedMimeType,
          file_size_bytes: finalFileSize,
          width: dimensions.width,
          height: dimensions.height,
          updated_at: finalAssetRow?.updated_at || nowIso,
          confirmed_at: nowIso,
        };

        // Header applies immediately in live UI; Splash is saved for next startup
        await commitConfirmedLocalAsset(confirmedLocal, assetType === 'header');
      }

      // Log admin audit action
      await this.logAuditAction('app_assets.upload', 'app_assets', `${appKey}/${assetType}`, {
        app_key: appKey,
        asset_type: assetType,
        upload_id: newUploadId,
        version: finalVersion,
        storage_path: storagePath,
        original_filename: file.name || `${assetType}.${ext}`,
        file_size_bytes: finalFileSize,
      });

      const resultAsset: AppAssetRecord = {
        id: finalAssetRow.id,
        app_key: appKey,
        asset_type: assetType,
        upload_id: newUploadId,
        version: finalVersion,
        is_active: true,
        updated_at: finalAssetRow.updated_at || nowIso,
        updated_by: callerId,
        upload: finalUploadRecord,
      };

      return {
        success: true,
        asset: resultAsset,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'حدث خطأ غير متوقع أثناء رفع الصورة وتحديث السجل',
      };
    }
  },

  async uploadAdminAppAsset(
    assetType: AppAssetType,
    file: File
  ): Promise<{
    success: boolean;
    asset?: AppAssetRecord;
    error?: string;
  }> {
    return this.uploadAppAsset('admin', assetType, file);
  },

  // ==========================================================================
  // Pharmacy Management System (Bound strictly to live Supabase pharmacy_* schema)
  // ==========================================================================

  /**
   * Normalizes a storage path inside the private `pharmacy` Storage bucket.
   * Strips leading slashes or accidental `pharmacy/` bucket prefix without altering internal folders.
   */
  normalizePharmacyStoragePath(rawPath: string): string {
    let clean = (rawPath || '').trim().replace(/^\/+/, '');
    if (clean.startsWith('pharmacy/')) {
      clean = clean.slice('pharmacy/'.length);
    }
    return clean;
  },

  /**
   * Resolves a Signed URL for a file stored in the private `pharmacy` bucket.
   * Never fabricates a broken public URL for private storage objects.
   */
  async getPharmacyFileSignedUrl(
    storagePath: string,
    expiresInSeconds: number = 3600
  ): Promise<{
    success: boolean;
    signedUrl: string | null;
    bucket: string;
    normalizedPath: string;
    expiresAt: number;
    isMissingFile?: boolean;
    error?: string;
  }> {
    const bucket = 'pharmacy';
    if (!storagePath || typeof storagePath !== 'string' || !storagePath.trim()) {
      return {
        success: false,
        signedUrl: null,
        bucket,
        normalizedPath: '',
        expiresAt: 0,
        isMissingFile: true,
        error: 'مسار الملف في السجل فارغ أو غير صالح',
      };
    }

    const trimmed = storagePath.trim();
    if (trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return {
        success: true,
        signedUrl: trimmed,
        bucket: 'direct',
        normalizedPath: trimmed,
        expiresAt: Date.now() + expiresInSeconds * 1000,
      };
    }

    if (!supabase || !isSupabaseConfigured) {
      return {
        success: false,
        signedUrl: null,
        bucket,
        normalizedPath: trimmed,
        expiresAt: 0,
        error: 'اتصال Supabase غير مهيأ',
      };
    }

    const cleanPath = this.normalizePharmacyStoragePath(trimmed);
    if (!cleanPath) {
      return {
        success: false,
        signedUrl: null,
        bucket,
        normalizedPath: '',
        expiresAt: 0,
        isMissingFile: true,
        error: 'مسار التخزين غير صالح',
      };
    }

    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(cleanPath, expiresInSeconds);

      if (error || !data?.signedUrl) {
        const msg = error?.message || 'تعذر إنشاء رابط موقّع للملف';
        const isNotFound =
          msg.toLowerCase().includes('object not found') ||
          msg.toLowerCase().includes('not found') ||
          (error as any)?.statusCode === '404';
        return {
          success: false,
          signedUrl: null,
          bucket,
          normalizedPath: cleanPath,
          expiresAt: 0,
          isMissingFile: isNotFound,
          error: isNotFound
            ? `سجل المرفق موجود في قاعدة البيانات (${cleanPath})، لكن الملف الفعلي غير موجود في مساحة التخزين (Bucket: ${bucket}) أو لم تكتمل عملية رفعه.`
            : `تعذر الوصول إلى الملف في مساحة التخزين (${bucket}): ${msg}`,
        };
      }

      return {
        success: true,
        signedUrl: data.signedUrl,
        bucket,
        normalizedPath: cleanPath,
        expiresAt: Date.now() + expiresInSeconds * 1000,
      };
    } catch (err: any) {
      return {
        success: false,
        signedUrl: null,
        bucket,
        normalizedPath: cleanPath,
        expiresAt: 0,
        error: err?.message || 'خطأ أثناء إنشاء الرابط الموقّع للمرفق',
      };
    }
  },

  /**
   * Downloads a file from the private `pharmacy` Storage bucket.
   */
  async downloadPharmacyFile(
    storagePath: string
  ): Promise<{ success: boolean; blob?: Blob; mimeType?: string; error?: string }> {
    const bucket = 'pharmacy';
    if (!storagePath || !storagePath.trim()) {
      return { success: false, error: 'مسار الملف غير متوفر' };
    }
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }

    const trimmed = storagePath.trim();
    const cleanPath = this.normalizePharmacyStoragePath(trimmed);

    try {
      const { data, error } = await supabase.storage.from(bucket).download(cleanPath);
      if (!error && data && data.size > 0) {
        return {
          success: true,
          blob: data,
          mimeType: data.type || 'application/octet-stream',
        };
      }

      // Fallback via fresh signed URL if direct download was blocked
      const signed = await this.getPharmacyFileSignedUrl(cleanPath, 300);
      if (signed.success && signed.signedUrl) {
        const res = await fetch(signed.signedUrl);
        if (res.ok) {
          const blob = await res.blob();
          if (blob && blob.size > 0) {
            return {
              success: true,
              blob,
              mimeType: blob.type || 'application/octet-stream',
            };
          }
        }
      }

      return {
        success: false,
        error:
          signed.error ||
          error?.message ||
          `الملف (${cleanPath}) غير متاح للتنزيل من الـ Bucket (${bucket})`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'تعذر تنزيل المرفق من التخزين',
      };
    }
  },

  /**
   * 1. Pharmacy Statistics Summary from actual database tables
   */
  async getPharmacyStatsSummary(): Promise<{
    stats: PharmacyStatsSummary;
    error?: string;
  }> {
    const emptyStats: PharmacyStatsSummary = {
      total_orders: 0,
      pending_orders: 0,
      active_orders: 0,
      completed_orders: 0,
      cancelled_orders: 0,
      driver_cancellation_requests: 0,
      total_delivery_fees_completed: 0,
      total_medicines_completed: 0,
      total_grand_completed: 0,
      total_pharmacies: 0,
      active_pharmacies: 0,
      total_user_pharmacies: 0,
      total_saved_prescriptions: 0,
      total_delivery_areas: 0,
      enabled_delivery_areas: 0,
      by_status: {},
      by_governorate: [],
    };

    if (!supabase || !isSupabaseConfigured) {
      return { stats: emptyStats, error: 'Supabase غير متصل' };
    }

    try {
      const [
        ordersRes,
        deliveryOrdersRes,
        pharmaciesRes,
        userPharmaciesRes,
        savedPrescriptionsRes,
        areasRes,
      ] = await Promise.all([
        supabase
          .from('pharmacy_orders')
          .select(
            'id, status, address_governorate_name, delivery_fee, medicines_total, grand_total'
          ),
        supabase
          .from('pharmacy_delivery_orders')
          .select('id, cancellation_requested_at, cancellation_decided_at'),
        supabase.from('pharmacy_pharmacies').select('id, is_active'),
        supabase.from('pharmacy_user_pharmacies').select('id', { count: 'exact', head: true }),
        supabase.from('pharmacy_saved_prescriptions').select('id', { count: 'exact', head: true }),
        supabase.from('pharmacy_delivery_area_settings').select('id, service_enabled'),
      ]);

      if (ordersRes.error) {
        return { stats: emptyStats, error: ordersRes.error.message };
      }

      const orders = ordersRes.data || [];
      const deliveryOrders = deliveryOrdersRes.data || [];
      const pharmacies = pharmaciesRes.data || [];
      const areas = areasRes.data || [];

      const byStatus: Record<string, number> = {};
      const govCounts: Record<string, number> = {};

      let pendingOrders = 0;
      let activeOrders = 0;
      let completedOrders = 0;
      let cancelledOrders = 0;
      let totalDeliveryFeesCompleted = 0;
      let totalMedicinesCompleted = 0;
      let totalGrandCompleted = 0;

      for (const o of orders as any[]) {
        const st = String(o.status || 'unknown');
        byStatus[st] = (byStatus[st] || 0) + 1;

        const gov = (o.address_governorate_name || 'غير محدد').trim();
        govCounts[gov] = (govCounts[gov] || 0) + 1;

        if (st === 'completed') {
          completedOrders++;
          const delivFee = Number(o.delivery_fee || 0);
          const medTotal = Number(o.medicines_total || 0);
          const grand =
            o.grand_total !== null && o.grand_total !== undefined
              ? Number(o.grand_total)
              : delivFee + medTotal;
          totalDeliveryFeesCompleted += delivFee;
          totalMedicinesCompleted += medTotal;
          totalGrandCompleted += grand;
        } else if (st === 'cancelled') {
          cancelledOrders++;
        } else {
          activeOrders++;
          if (st === 'pending' || st === 'pending_review' || st === 'new') {
            pendingOrders++;
          }
        }
      }

      const driverCancelRequests = (deliveryOrders as any[]).filter(
        (d) => Boolean(d.cancellation_requested_at) && !d.cancellation_decided_at
      ).length;

      const byGovernorate = Object.entries(govCounts)
        .map(([governorate_name, count]) => ({ governorate_name, count }))
        .sort((a, b) => b.count - a.count);

      return {
        stats: {
          total_orders: orders.length,
          pending_orders: pendingOrders,
          active_orders: activeOrders,
          completed_orders: completedOrders,
          cancelled_orders: cancelledOrders,
          driver_cancellation_requests: driverCancelRequests,
          total_delivery_fees_completed: totalDeliveryFeesCompleted,
          total_medicines_completed: totalMedicinesCompleted,
          total_grand_completed: totalGrandCompleted,
          total_pharmacies: pharmacies.length,
          active_pharmacies: (pharmacies as any[]).filter((p) => Boolean(p.is_active)).length,
          total_user_pharmacies: userPharmaciesRes.count ?? 0,
          total_saved_prescriptions: savedPrescriptionsRes.count ?? 0,
          total_delivery_areas: areas.length,
          enabled_delivery_areas: (areas as any[]).filter((a) => Boolean(a.service_enabled)).length,
          by_status: byStatus,
          by_governorate: byGovernorate,
        },
      };
    } catch (err: any) {
      return {
        stats: emptyStats,
        error: err?.message || 'تعذر جلب إحصاءات الصيدلية',
      };
    }
  },

  /**
   * 2. Paginated & Filtered Pharmacy Orders List
   * Uses ONLY actual columns from `public.pharmacy_orders` and related tables.
   */
  async getPharmacyOrders(filters?: {
    status?: string;
    governorate?: string;
    center?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    orders: PharmacyOrder[];
    totalCount: number;
    availableStatuses: string[];
    availableGovernorates: string[];
    availableCenters: string[];
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return {
        orders: [],
        totalCount: 0,
        availableStatuses: [],
        availableGovernorates: [],
        availableCenters: [],
        error: 'Supabase غير متصل',
      };
    }

    try {
      const page = Math.max(1, filters?.page || 1);
      const pageSize = Math.min(100, Math.max(5, filters?.pageSize || 20));
      const offset = (page - 1) * pageSize;

      // 1. Fetch distinct filter options from existing pharmacy_orders rows
      const { data: metaRows } = await supabase
        .from('pharmacy_orders')
        .select('status, address_governorate_name, address_center_name');

      const availableStatuses = Array.from(
        new Set((metaRows || []).map((r: any) => r.status).filter(Boolean))
      ) as string[];
      const availableGovernorates = Array.from(
        new Set((metaRows || []).map((r: any) => r.address_governorate_name).filter(Boolean))
      ) as string[];
      const availableCenters = Array.from(
        new Set((metaRows || []).map((r: any) => r.address_center_name).filter(Boolean))
      ) as string[];

      // 2. Build paginated query on public.pharmacy_orders using verified columns only
      let query = supabase.from('pharmacy_orders').select(
        `
        id,
        order_number,
        user_id,
        household_id,
        saved_prescription_id,
        prescription_title,
        pharmacy_selection_mode,
        requested_pharmacy_id,
        requested_pharmacy_name,
        source_address_id,
        address_governorate_code,
        address_governorate_name,
        address_center_name,
        address_text,
        address_latitude,
        address_longitude,
        customer_notes,
        delivery_fee,
        medicines_total,
        grand_total,
        status,
        accepted_at,
        shopping_started_at,
        completed_at,
        cancelled_at,
        created_at,
        updated_at
      `,
        { count: 'exact' }
      );

      if (filters?.status && filters.status !== 'all') {
        if (
          filters.status === 'cancellation_pending' ||
          filters.status === 'driver_cancellation_pending'
        ) {
          // Fetch pharmacy_order_ids from pharmacy_delivery_orders where driver requested cancellation and is not decided yet
          const { data: cancelDeliveryRows } = await supabase
            .from('pharmacy_delivery_orders')
            .select('pharmacy_order_id, id')
            .not('cancellation_requested_at', 'is', null)
            .or('cancellation_decision.is.null,cancellation_decided_at.is.null');

          const cancelOrderIds = Array.from(
            new Set([
              ...(cancelDeliveryRows || []).map((r: any) => r.pharmacy_order_id).filter(Boolean),
              ...(cancelDeliveryRows || []).map((r: any) => r.id).filter(Boolean),
            ])
          );

          if (cancelOrderIds.length > 0) {
            query = query.or(
              `status.eq.cancellation_pending,id.in.(${cancelOrderIds.join(',')})`
            );
          } else {
            query = query.eq('status', 'cancellation_pending');
          }
        } else {
          query = query.eq('status', filters.status);
        }
      }

      if (filters?.governorate && filters.governorate !== 'all') {
        query = query.eq('address_governorate_name', filters.governorate);
      }

      if (filters?.center && filters.center !== 'all') {
        query = query.eq('address_center_name', filters.center);
      }

      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters?.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', toDate.toISOString());
      }

      if (filters?.search && filters.search.trim()) {
        const q = filters.search.trim().replace(/[%_]/g, '');
        if (q) {
          query = query.or(
            `order_number.ilike.%${q}%,requested_pharmacy_name.ilike.%${q}%,prescription_title.ilike.%${q}%,address_text.ilike.%${q}%`
          );
        }
      }

      query = query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1);

      const { data: rows, count, error } = await query;
      if (error) {
        return {
          orders: [],
          totalCount: 0,
          availableStatuses,
          availableGovernorates,
          availableCenters,
          error: `فشل جلب طلبات الصيدلية (${error.code || 'Error'}): ${error.message}`,
        };
      }

      const rawOrders = (rows || []) as any[];
      if (rawOrders.length === 0) {
        return {
          orders: [],
          totalCount: count ?? 0,
          availableStatuses,
          availableGovernorates,
          availableCenters,
        };
      }

      const orderIds = rawOrders.map((o) => o.id);
      const userIds = Array.from(new Set(rawOrders.map((o) => o.user_id).filter(Boolean)));
      const householdIds = Array.from(
        new Set(rawOrders.map((o) => o.household_id).filter(Boolean))
      );
      const addressIds = Array.from(
        new Set(rawOrders.map((o) => o.source_address_id).filter(Boolean))
      );

      // 3. Batch fetch related records for the current page
      const [
        deliveryOrdersRes,
        itemsRes,
        filesRes,
        profilesRes,
        householdsRes,
        addressesRes,
      ] = await Promise.all([
        supabase
          .from('pharmacy_delivery_orders')
          .select('*')
          .in('pharmacy_order_id', orderIds),
        supabase
          .from('pharmacy_order_items')
          .select('id, order_id')
          .in('order_id', orderIds),
        supabase
          .from('pharmacy_order_files')
          .select('id, order_id')
          .in('order_id', orderIds),
        userIds.length > 0
          ? supabase.from('profiles').select('id, full_name, phone').in('id', userIds)
          : Promise.resolve({ data: [] as any[] }),
        householdIds.length > 0
          ? supabase.from('households').select('id, name, admin_phone').in('id', householdIds)
          : Promise.resolve({ data: [] as any[] }),
        addressIds.length > 0
          ? supabase.from('household_addresses').select('id, phone').in('id', addressIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const deliveryOrdersList = (deliveryOrdersRes.data || []) as any[];
      const driverIds = Array.from(
        new Set(deliveryOrdersList.map((d) => d.assigned_driver_id).filter(Boolean))
      );

      const driversMap: Record<string, any> = {};
      if (driverIds.length > 0) {
        const { data: driversData } = await supabase
          .from('delivery_drivers')
          .select('id, full_name, phone, vehicle_type, is_active')
          .in('id', driverIds);
        for (const drv of driversData || []) {
          driversMap[drv.id] = drv;
        }
      }

      const deliveryByOrderId: Record<string, PharmacyDeliveryOrder> = {};
      for (const d of deliveryOrdersList) {
        deliveryByOrderId[d.pharmacy_order_id] = {
          id: d.id,
          pharmacy_order_id: d.pharmacy_order_id,
          assigned_driver_id: d.assigned_driver_id || null,
          accepted_at: d.accepted_at || null,
          shopping_started_at: d.shopping_started_at || null,
          delivery_started_at: d.delivery_started_at || null,
          completed_at: d.completed_at || null,
          cancellation_requested_at: d.cancellation_requested_at || null,
          cancellation_reason: d.cancellation_reason || null,
          cancellation_decision: d.cancellation_decision || null,
          cancellation_decided_at: d.cancellation_decided_at || null,
          cancellation_decided_by: d.cancellation_decided_by || null,
          created_at: d.created_at,
          updated_at: d.updated_at,
          driver: d.assigned_driver_id ? driversMap[d.assigned_driver_id] || null : null,
        };
      }

      const itemCounts: Record<string, number> = {};
      for (const it of itemsRes.data || []) {
        itemCounts[it.order_id] = (itemCounts[it.order_id] || 0) + 1;
      }

      const fileCounts: Record<string, number> = {};
      for (const f of filesRes.data || []) {
        fileCounts[f.order_id] = (fileCounts[f.order_id] || 0) + 1;
      }

      const profilesMap: Record<string, any> = {};
      for (const p of profilesRes.data || []) {
        profilesMap[p.id] = p;
      }

      const householdsMap: Record<string, any> = {};
      for (const h of householdsRes.data || []) {
        householdsMap[h.id] = h;
      }

      const addressesMap: Record<string, any> = {};
      for (const a of addressesRes.data || []) {
        addressesMap[a.id] = a;
      }

      const orders: PharmacyOrder[] = rawOrders.map((r) => {
        const prof = r.user_id ? profilesMap[r.user_id] : null;
        const hh = r.household_id ? householdsMap[r.household_id] : null;
        const addr = r.source_address_id ? addressesMap[r.source_address_id] : null;

        return {
          id: r.id,
          order_number: r.order_number,
          user_id: r.user_id,
          household_id: r.household_id || null,
          saved_prescription_id: r.saved_prescription_id || null,
          prescription_title: r.prescription_title || null,
          pharmacy_selection_mode: r.pharmacy_selection_mode || null,
          requested_pharmacy_id: r.requested_pharmacy_id || null,
          requested_pharmacy_name: r.requested_pharmacy_name || null,
          source_address_id: r.source_address_id || null,
          address_governorate_code: r.address_governorate_code || null,
          address_governorate_name: r.address_governorate_name || null,
          address_center_name: r.address_center_name || null,
          address_text: r.address_text || null,
          address_latitude:
            r.address_latitude !== null && r.address_latitude !== undefined
              ? Number(r.address_latitude)
              : null,
          address_longitude:
            r.address_longitude !== null && r.address_longitude !== undefined
              ? Number(r.address_longitude)
              : null,
          customer_notes: r.customer_notes || null,
          delivery_fee: Number(r.delivery_fee || 0),
          medicines_total:
            r.medicines_total !== null && r.medicines_total !== undefined
              ? Number(r.medicines_total)
              : null,
          grand_total:
            r.grand_total !== null && r.grand_total !== undefined
              ? Number(r.grand_total)
              : null,
          status: r.status,
          accepted_at: r.accepted_at || null,
          shopping_started_at: r.shopping_started_at || null,
          completed_at: r.completed_at || null,
          cancelled_at: r.cancelled_at || null,
          created_at: r.created_at,
          updated_at: r.updated_at,
          customer_name: prof?.full_name || hh?.name || null,
          customer_phone: addr?.phone || prof?.phone || hh?.admin_phone || null,
          household_name: hh?.name || null,
          delivery_order: deliveryByOrderId[r.id] || null,
          items_count: itemCounts[r.id] || 0,
          files_count: fileCounts[r.id] || 0,
        };
      });

      return {
        orders,
        totalCount: count ?? orders.length,
        availableStatuses,
        availableGovernorates,
        availableCenters,
      };
    } catch (err: any) {
      return {
        orders: [],
        totalCount: 0,
        availableStatuses: [],
        availableGovernorates: [],
        availableCenters: [],
        error: err?.message || 'حدث خطأ أثناء جلب طلبات الصيدلية',
      };
    }
  },

  /**
   * 3. Full Pharmacy Order Details:
   * - Order row (`pharmacy_orders`)
   * - Order items (`pharmacy_order_items`)
   * - Order files (`pharmacy_order_files`)
   * - Delivery assignment & driver (`pharmacy_delivery_orders` + `delivery_drivers`)
   * - Status history (`pharmacy_order_status_history`)
   * - Change log (`pharmacy_order_change_log`)
   * - Linked saved prescription (`pharmacy_saved_prescriptions` + files + items) if `saved_prescription_id` is present
   */
  async getPharmacyOrderDetails(orderId: string): Promise<{
    order: PharmacyOrder | null;
    items: PharmacyOrderItem[];
    files: PharmacyOrderFile[];
    deliveryOrder: PharmacyDeliveryOrder | null;
    statusHistory: PharmacyOrderStatusHistory[];
    changeLog: PharmacyOrderChangeLog[];
    savedPrescription: PharmacySavedPrescription | null;
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured || !orderId) {
      return {
        order: null,
        items: [],
        files: [],
        deliveryOrder: null,
        statusHistory: [],
        changeLog: [],
        savedPrescription: null,
        error: 'معرف الطلب غير صالح أو الاتصال غير متوفر',
      };
    }

    try {
      const { data: orderRow, error: orderErr } = await supabase
        .from('pharmacy_orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (orderErr || !orderRow) {
        return {
          order: null,
          items: [],
          files: [],
          deliveryOrder: null,
          statusHistory: [],
          changeLog: [],
          savedPrescription: null,
          error: orderErr?.message || 'لم يتم العثور على طلب الصيدلية المطلوب',
        };
      }

      const [
        itemsRes,
        filesRes,
        deliveryOrderRes,
        statusHistoryRes,
        changeLogRes,
        profileRes,
        householdRes,
        addressRes,
        pharmacyRes,
      ] = await Promise.all([
        supabase
          .from('pharmacy_order_items')
          .select('*')
          .eq('order_id', orderId)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('pharmacy_order_files')
          .select('*')
          .eq('order_id', orderId)
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('pharmacy_delivery_orders')
          .select('*')
          .eq('pharmacy_order_id', orderId)
          .maybeSingle(),
        supabase
          .from('pharmacy_order_status_history')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false }),
        supabase
          .from('pharmacy_order_change_log')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false }),
        orderRow.user_id
          ? supabase
              .from('profiles')
              .select('id, full_name, phone')
              .eq('id', orderRow.user_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        orderRow.household_id
          ? supabase
              .from('households')
              .select('id, name, admin_phone')
              .eq('id', orderRow.household_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        orderRow.source_address_id
          ? supabase
              .from('household_addresses')
              .select('*')
              .eq('id', orderRow.source_address_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        orderRow.requested_pharmacy_id
          ? supabase
              .from('pharmacy_pharmacies')
              .select('*')
              .eq('id', orderRow.requested_pharmacy_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      // Driver details if deliveryOrder has assigned_driver_id
      let driverData: any = null;
      if (deliveryOrderRes.data?.assigned_driver_id) {
        const { data: drv } = await supabase
          .from('delivery_drivers')
          .select('id, full_name, phone, vehicle_type, is_active')
          .eq('id', deliveryOrderRes.data.assigned_driver_id)
          .maybeSingle();
        driverData = drv || null;
      }

      // Saved prescription details if saved_prescription_id is set
      let savedPrescription: PharmacySavedPrescription | null = null;
      if (orderRow.saved_prescription_id) {
        const [spRes, spFilesRes, spItemsRes] = await Promise.all([
          supabase
            .from('pharmacy_saved_prescriptions')
            .select('*')
            .eq('id', orderRow.saved_prescription_id)
            .maybeSingle(),
          supabase
            .from('pharmacy_saved_prescription_files')
            .select('*')
            .eq('prescription_id', orderRow.saved_prescription_id)
            .order('display_order', { ascending: true }),
          supabase
            .from('pharmacy_saved_prescription_items')
            .select('*')
            .eq('prescription_id', orderRow.saved_prescription_id)
            .order('sort_order', { ascending: true }),
        ]);

        if (spRes.data) {
          savedPrescription = {
            id: spRes.data.id,
            user_id: spRes.data.user_id,
            title: spRes.data.title,
            pharmacy_id: spRes.data.pharmacy_id || null,
            pharmacy_name: spRes.data.pharmacy_name || null,
            created_at: spRes.data.created_at,
            updated_at: spRes.data.updated_at,
            files: (spFilesRes.data || []) as PharmacySavedPrescriptionFile[],
            items: (spItemsRes.data || []) as PharmacySavedPrescriptionItem[],
          };
        }
      }

      const items: PharmacyOrderItem[] = (itemsRes.data || []).map((it: any) => ({
        id: it.id,
        order_id: it.order_id,
        item_name: it.item_name,
        requested_quantity: Number(it.requested_quantity ?? 1),
        purchased_quantity:
          it.purchased_quantity !== null && it.purchased_quantity !== undefined
            ? Number(it.purchased_quantity)
            : null,
        shortage_quantity:
          it.shortage_quantity !== null && it.shortage_quantity !== undefined
            ? Number(it.shortage_quantity)
            : null,
        unit: it.unit || null,
        shortage_reason: it.shortage_reason || null,
        driver_note: it.driver_note || null,
        sort_order: Number(it.sort_order ?? 0),
        created_at: it.created_at,
        updated_at: it.updated_at,
      }));

      const files: PharmacyOrderFile[] = (filesRes.data || []).map((f: any) => ({
        id: f.id,
        order_id: f.order_id,
        file_type: f.file_type,
        storage_path: f.storage_path,
        mime_type: f.mime_type || null,
        display_order: f.display_order ?? null,
        driver_note: f.driver_note || null,
        source_saved_file_id: f.source_saved_file_id || null,
        created_at: f.created_at,
      }));

      const deliveryOrder: PharmacyDeliveryOrder | null = deliveryOrderRes.data
        ? {
            id: deliveryOrderRes.data.id,
            pharmacy_order_id: deliveryOrderRes.data.pharmacy_order_id,
            assigned_driver_id: deliveryOrderRes.data.assigned_driver_id || null,
            accepted_at: deliveryOrderRes.data.accepted_at || null,
            shopping_started_at: deliveryOrderRes.data.shopping_started_at || null,
            delivery_started_at: deliveryOrderRes.data.delivery_started_at || null,
            completed_at: deliveryOrderRes.data.completed_at || null,
            cancellation_requested_at: deliveryOrderRes.data.cancellation_requested_at || null,
            cancellation_reason: deliveryOrderRes.data.cancellation_reason || null,
            cancellation_decision: deliveryOrderRes.data.cancellation_decision || null,
            cancellation_decided_at: deliveryOrderRes.data.cancellation_decided_at || null,
            cancellation_decided_by: deliveryOrderRes.data.cancellation_decided_by || null,
            created_at: deliveryOrderRes.data.created_at,
            updated_at: deliveryOrderRes.data.updated_at,
            driver: driverData,
          }
        : null;

      const statusHistory: PharmacyOrderStatusHistory[] = (statusHistoryRes.data || []).map(
        (h: any) => ({
          id: h.id,
          order_id: h.order_id,
          from_status: h.from_status || null,
          to_status: h.to_status,
          changed_by: h.changed_by || null,
          changed_by_role: h.changed_by_role || null,
          note: h.note || null,
          created_at: h.created_at,
        })
      );

      const changeLog: PharmacyOrderChangeLog[] = (changeLogRes.data || []).map((c: any) => ({
        id: c.id,
        order_id: c.order_id,
        change_type: c.change_type,
        changed_by: c.changed_by || null,
        changed_by_role: c.changed_by_role || null,
        before_data: c.before_data || null,
        after_data: c.after_data || null,
        note: c.note || null,
        created_at: c.created_at,
      }));

      const order: PharmacyOrder = {
        id: orderRow.id,
        order_number: orderRow.order_number,
        user_id: orderRow.user_id,
        household_id: orderRow.household_id || null,
        saved_prescription_id: orderRow.saved_prescription_id || null,
        prescription_title: orderRow.prescription_title || null,
        pharmacy_selection_mode: orderRow.pharmacy_selection_mode || null,
        requested_pharmacy_id: orderRow.requested_pharmacy_id || null,
        requested_pharmacy_name: orderRow.requested_pharmacy_name || null,
        source_address_id: orderRow.source_address_id || null,
        address_governorate_code: orderRow.address_governorate_code || null,
        address_governorate_name: orderRow.address_governorate_name || null,
        address_center_name: orderRow.address_center_name || null,
        address_text: orderRow.address_text || null,
        address_latitude:
          orderRow.address_latitude !== null && orderRow.address_latitude !== undefined
            ? Number(orderRow.address_latitude)
            : null,
        address_longitude:
          orderRow.address_longitude !== null && orderRow.address_longitude !== undefined
            ? Number(orderRow.address_longitude)
            : null,
        customer_notes: orderRow.customer_notes || null,
        delivery_fee: Number(orderRow.delivery_fee || 0),
        medicines_total:
          orderRow.medicines_total !== null && orderRow.medicines_total !== undefined
            ? Number(orderRow.medicines_total)
            : null,
        grand_total:
          orderRow.grand_total !== null && orderRow.grand_total !== undefined
            ? Number(orderRow.grand_total)
            : null,
        status: orderRow.status,
        accepted_at: orderRow.accepted_at || null,
        shopping_started_at: orderRow.shopping_started_at || null,
        completed_at: orderRow.completed_at || null,
        cancelled_at: orderRow.cancelled_at || null,
        created_at: orderRow.created_at,
        updated_at: orderRow.updated_at,
        customer_name:
          (profileRes.data as any)?.full_name || (householdRes.data as any)?.name || null,
        customer_phone:
          (addressRes.data as any)?.phone ||
          (profileRes.data as any)?.phone ||
          (householdRes.data as any)?.admin_phone ||
          null,
        household_name: (householdRes.data as any)?.name || null,
        requested_pharmacy: (pharmacyRes.data as PharmacyDirectoryRecord) || null,
        delivery_order: deliveryOrder,
        items_count: items.length,
        files_count: files.length,
      };

      return {
        order,
        items,
        files,
        deliveryOrder,
        statusHistory,
        changeLog,
        savedPrescription,
      };
    } catch (err: any) {
      return {
        order: null,
        items: [],
        files: [],
        deliveryOrder: null,
        statusHistory: [],
        changeLog: [],
        savedPrescription: null,
        error: err?.message || 'حدث خطأ أثناء جلب تفاصيل طلب الصيدلية',
      };
    }
  },

  /**
   * 4. Assign Driver to Pharmacy Order via existing RPC `public.pharmacy_admin_assign_driver`
   */
  async assignPharmacyOrderDriver(
    orderId: string,
    driverId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!orderId || !driverId) {
      return { success: false, error: 'يرجى تحديد الطلب والمندوب أولاً' };
    }

    try {
      const { error } = await supabase.rpc('pharmacy_admin_assign_driver', {
        p_order_id: orderId,
        p_driver_id: driverId,
      });

      if (error) {
        return {
          success: false,
          error: `فشل إسناد المندوب عبر دالة pharmacy_admin_assign_driver (${error.code || 'Error'}): ${error.message}`,
        };
      }

      // Verify in pharmacy_delivery_orders before confirming success
      const { data: verifyRow } = await supabase
        .from('pharmacy_delivery_orders')
        .select('id, assigned_driver_id')
        .eq('pharmacy_order_id', orderId)
        .maybeSingle();

      if (verifyRow && verifyRow.assigned_driver_id !== driverId) {
        return {
          success: false,
          error: 'لم يتم تأكيد إسناد المندوب في جدول pharmacy_delivery_orders',
        };
      }

      await this.logAuditAction('pharmacy.assign_driver', 'pharmacy_orders', orderId, {
        driver_id: driverId,
      });

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'حدث خطأ غير متوقع أثناء إسناد المندوب',
      };
    }
  },

  /**
   * 5. Decide on Driver Cancellation Request via authoritative RPC `public.pharmacy_admin_decide_driver_cancel`.
   * Strictly validates Supabase responses, removes unverified direct table modifications and trial loops,
   * and verifies actual database record persistence before reporting success.
   */
  async decidePharmacyDriverCancellation(
    orderId: string,
    approve: boolean | string,
    note?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!orderId) {
      return { success: false, error: 'معرف الطلب مفقود' };
    }

    // Support both boolean and string representations of decision
    const isApprove =
      typeof approve === 'boolean'
        ? approve
        : typeof approve === 'string'
        ? !['reject', 'rejected', 'reject_cancel', 'false', '0', 'رفض'].includes(
            approve.trim().toLowerCase()
          )
        : Boolean(approve);

    try {
      // 1. Check existing delivery record to confirm presence and avoid conflicting/duplicate decisions
      const { data: currentDelivery, error: fetchErr } = await supabase
        .from('pharmacy_delivery_orders')
        .select(
          'id, pharmacy_order_id, assigned_driver_id, cancellation_requested_at, cancellation_decision, cancellation_decided_at'
        )
        .or(`pharmacy_order_id.eq.${orderId},id.eq.${orderId}`)
        .maybeSingle();

      if (fetchErr) {
        return {
          success: false,
          error: `تعذر التحقق من سجل التوصيل (${fetchErr.code || 'DB_ERROR'}): ${fetchErr.message}`,
        };
      }

      if (!currentDelivery) {
        return {
          success: false,
          error: 'لم يتم العثور على سجل توصيل مرتبط بطلب الصيدلية المحدد للبت في إلغائه.',
        };
      }

      if (currentDelivery.cancellation_decided_at || currentDelivery.cancellation_decision) {
        return {
          success: false,
          error: `تم البت في طلب إلغاء هذا المندوب مسبقًا (${currentDelivery.cancellation_decision || 'مكتمل'}) ولا يمكن تكرار القرار.`,
        };
      }

      // 2. Invoke the authoritative RPC with canonical parameters without trial loops
      const targetOrderId = currentDelivery.pharmacy_order_id || currentDelivery.id || orderId;
      const rpcPayload = {
        p_order_id: targetOrderId,
        p_decision: isApprove,
        p_note: note?.trim() || null,
      };

      const { data: _rpcData, error: rpcError } = await supabase.rpc(
        'pharmacy_admin_decide_driver_cancel',
        rpcPayload
      );

      // 3. Explicit error check: NEVER report success if the RPC returned an error
      if (rpcError) {
        const isConstraintOrValueError =
          rpcError.code === 'P0001' || rpcError.message?.includes('قرار');
        const errorMessage = isConstraintOrValueError
          ? `تعذر تنفيذ قرار إلغاء مندوب الصيدلية: رفضت دالة قاعدة البيانات (pharmacy_admin_decide_driver_cancel) المعاملات أو الشروط الحالية (${rpcError.message || rpcError.code}). يلزم توثيق عقد الدالة الفعلي وشروطها في قاعدة البيانات لتحديد القيم المقبولة.`
          : `فشل استدعاء دالة قرار الإلغاء (${rpcError.code || 'RPC_ERROR'}): ${rpcError.message}`;

        return {
          success: false,
          error: errorMessage,
        };
      }

      // 4. Verify actual database record update before reporting success
      const { data: verifyRow, error: verifyErr } = await supabase
        .from('pharmacy_delivery_orders')
        .select('id, cancellation_decision, cancellation_decided_at')
        .or(`pharmacy_order_id.eq.${orderId},id.eq.${orderId}`)
        .maybeSingle();

      if (verifyErr) {
        return {
          success: false,
          error: `تم استدعاء الدالة لكن تعذر تأكيد تحديث السجل: ${verifyErr.message}`,
        };
      }

      if (!verifyRow || (!verifyRow.cancellation_decided_at && !verifyRow.cancellation_decision)) {
        return {
          success: false,
          error:
            'لم تؤكد قاعدة البيانات تحديث قرار الإلغاء في سجل التوصيل؛ تم اعتبار العملية غير مكتملة لمنع إظهار نجاح كاذب.',
        };
      }

      // 5. Authoritative Audit Logging on verified success only
      await this.logAuditAction('pharmacy.decide_driver_cancel', 'pharmacy_orders', orderId, {
        approve: isApprove,
        decision: verifyRow.cancellation_decision,
        note: note?.trim() || null,
      });

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'تعذر تنفيذ قرار طلب الإلغاء',
      };
    }
  },

  /**
   * 6. Read & Save General Pharmacy Settings (`public.pharmacy_settings`)
   * Columns: `id, service_enabled, section_visible, display_width, updated_at, updated_by`
   */
  async getPharmacySettings(): Promise<{
    settings: PharmacySettingsRecord | null;
    existsInDb: boolean;
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { settings: null, existsInDb: false, error: 'Supabase غير متصل' };
    }

    try {
      const { data, error } = await supabase
        .from('pharmacy_settings')
        .select('id, service_enabled, section_visible, display_width, updated_at, updated_by')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return {
          settings: null,
          existsInDb: false,
          error: `فشل قراءة جدول pharmacy_settings (${error.code || 'Error'}): ${error.message}`,
        };
      }

      if (!data) {
        return {
          settings: null,
          existsInDb: false,
        };
      }

      const widthVal: PharmacyDisplayWidth =
        data.display_width === 'half' ? 'half' : 'full';

      return {
        existsInDb: true,
        settings: {
          id: data.id,
          service_enabled: Boolean(data.service_enabled),
          section_visible: Boolean(data.section_visible),
          display_width: widthVal,
          updated_at: data.updated_at,
          updated_by: data.updated_by || null,
        },
      };
    } catch (err: any) {
      return {
        settings: null,
        existsInDb: false,
        error: err?.message || 'تعذر قراءة إعدادات الصيدلية',
      };
    }
  },

  async updatePharmacySettings(updates: {
    service_enabled: boolean;
    section_visible: boolean;
    display_width: PharmacyDisplayWidth;
  }): Promise<{
    success: boolean;
    settings?: PharmacySettingsRecord;
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }

    if (updates.display_width !== 'full' && updates.display_width !== 'half') {
      return {
        success: false,
        error: 'قيمة حجم عرض القسم (display_width) غير صالحة؛ القيم المعتمدة هي full أو half فقط.',
      };
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const callerId = authData?.user?.id || null;
      const nowIso = new Date().toISOString();

      // Check existing row in pharmacy_settings
      const { data: existing, error: fetchErr } = await supabase
        .from('pharmacy_settings')
        .select('id')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchErr) {
        return {
          success: false,
          error: `فشل التحقق من سجل pharmacy_settings (${fetchErr.code || 'Error'}): ${fetchErr.message}`,
        };
      }

      const payload = {
        service_enabled: Boolean(updates.service_enabled),
        section_visible: Boolean(updates.section_visible),
        display_width: updates.display_width,
        updated_at: nowIso,
        updated_by: callerId,
      };

      let savedRow: any = null;

      if (existing?.id) {
        const { data: updatedData, error: updateErr } = await supabase
          .from('pharmacy_settings')
          .update(payload)
          .eq('id', existing.id)
          .select('id, service_enabled, section_visible, display_width, updated_at, updated_by')
          .maybeSingle();

        if (updateErr) {
          return {
            success: false,
            error: `فشل حفظ إعدادات الصيدلية في pharmacy_settings (${updateErr.code || 'Error'}): ${updateErr.message}`,
          };
        }
        if (!updatedData) {
          return {
            success: false,
            error:
              'لم يتم تحديث أي صف في جدول pharmacy_settings (تأكد من صلاحيات UPDATE للمشرف في سياسات RLS).',
          };
        }
        savedRow = updatedData;
      } else {
        const { data: insertedData, error: insertErr } = await supabase
          .from('pharmacy_settings')
          .insert([payload])
          .select('id, service_enabled, section_visible, display_width, updated_at, updated_by')
          .maybeSingle();

        if (insertErr) {
          return {
            success: false,
            error: `فشل إنشاء سجل إعدادات الصيدلية في pharmacy_settings (${insertErr.code || 'Error'}): ${insertErr.message}`,
          };
        }
        if (!insertedData) {
          return {
            success: false,
            error:
              'تعذر حفظ السجل في جدول pharmacy_settings بسبب سياسات الأمان (RLS).',
          };
        }
        savedRow = insertedData;
      }

      await this.logAuditAction('pharmacy.settings_update', 'pharmacy_settings', savedRow.id, {
        service_enabled: savedRow.service_enabled,
        section_visible: savedRow.section_visible,
        display_width: savedRow.display_width,
      });

      return {
        success: true,
        settings: {
          id: savedRow.id,
          service_enabled: Boolean(savedRow.service_enabled),
          section_visible: Boolean(savedRow.section_visible),
          display_width: savedRow.display_width === 'half' ? 'half' : 'full',
          updated_at: savedRow.updated_at,
          updated_by: savedRow.updated_by || null,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'حدث خطأ أثناء حفظ إعدادات الصيدلية',
      };
    }
  },

  /**
   * 7. Pharmacy Delivery Area Settings (`public.pharmacy_delivery_area_settings`)
   * Columns: `id, governorate_code, governorate_name, center_name, service_enabled, delivery_fee, updated_at, updated_by`
   */
  async getPharmacyDeliveryAreas(): Promise<{
    areas: PharmacyDeliveryAreaSetting[];
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { areas: [], error: 'Supabase غير متصل' };
    }

    try {
      const { data, error } = await supabase
        .from('pharmacy_delivery_area_settings')
        .select(
          'id, governorate_code, governorate_name, center_name, service_enabled, delivery_fee, updated_at, updated_by'
        )
        .order('governorate_name', { ascending: true })
        .order('center_name', { ascending: true });

      if (error) {
        return {
          areas: [],
          error: `فشل قراءة جدول pharmacy_delivery_area_settings (${error.code || 'Error'}): ${error.message}`,
        };
      }

      const areas: PharmacyDeliveryAreaSetting[] = (data || []).map((r: any) => ({
        id: r.id,
        governorate_code: r.governorate_code || '',
        governorate_name: r.governorate_name || '',
        center_name: r.center_name || '',
        service_enabled: Boolean(r.service_enabled),
        delivery_fee: Number(r.delivery_fee ?? 0),
        updated_at: r.updated_at,
        updated_by: r.updated_by || null,
      }));

      return { areas };
    } catch (err: any) {
      return {
        areas: [],
        error: err?.message || 'تعذر جلب مناطق توصيل الصيدلية',
      };
    }
  },

  async savePharmacyDeliveryArea(payload: {
    id?: string;
    governorate_code: string;
    governorate_name: string;
    center_name: string;
    service_enabled: boolean;
    delivery_fee: number;
  }): Promise<{
    success: boolean;
    area?: PharmacyDeliveryAreaSetting;
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }

    const govCode = (payload.governorate_code || '').trim().toUpperCase();
    const govName = (payload.governorate_name || '').trim();
    const centerName = (payload.center_name || '').trim();
    const fee = Number(payload.delivery_fee);

    if (!govCode || !govName || !centerName) {
      return {
        success: false,
        error: 'يرجى تحديد المحافظة وكودها واسم المركز بشكل صحيح',
      };
    }

    if (typeof fee !== 'number' || !Number.isFinite(fee) || fee < 0) {
      return {
        success: false,
        error: 'رسوم التوصيل غير صالحة؛ يجب أن تكون رقماً أكبر من أو يساوي الصفر',
      };
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const callerId = authData?.user?.id || null;
      const nowIso = new Date().toISOString();

      let targetId = payload.id;

      // If no id was passed, check if a record for this governorate + center already exists
      if (!targetId) {
        const { data: existingMatch } = await supabase
          .from('pharmacy_delivery_area_settings')
          .select('id')
          .eq('governorate_code', govCode)
          .eq('center_name', centerName)
          .maybeSingle();
        if (existingMatch?.id) {
          targetId = existingMatch.id;
        }
      }

      const dbRow = {
        governorate_code: govCode,
        governorate_name: govName,
        center_name: centerName,
        service_enabled: Boolean(payload.service_enabled),
        delivery_fee: fee,
        updated_at: nowIso,
        updated_by: callerId,
      };

      let savedData: any = null;

      if (targetId) {
        const { data, error } = await supabase
          .from('pharmacy_delivery_area_settings')
          .update(dbRow)
          .eq('id', targetId)
          .select(
            'id, governorate_code, governorate_name, center_name, service_enabled, delivery_fee, updated_at, updated_by'
          )
          .maybeSingle();

        if (error) {
          return {
            success: false,
            error: `فشل تحديث المنطقة في pharmacy_delivery_area_settings (${error.code || 'Error'}): ${error.message}`,
          };
        }
        if (!data) {
          return {
            success: false,
            error:
              'لم يتم تحديث المنطقة في قاعدة البيانات (تأكد من صلاحية UPDATE في سياسات RLS لجدول pharmacy_delivery_area_settings).',
          };
        }
        savedData = data;
      } else {
        const { data, error } = await supabase
          .from('pharmacy_delivery_area_settings')
          .insert([dbRow])
          .select(
            'id, governorate_code, governorate_name, center_name, service_enabled, delivery_fee, updated_at, updated_by'
          )
          .maybeSingle();

        if (error) {
          return {
            success: false,
            error: `فشل إضافة المنطقة في pharmacy_delivery_area_settings (${error.code || 'Error'}): ${error.message}`,
          };
        }
        if (!data) {
          return {
            success: false,
            error:
              'لم يتم حفظ المنطقة في قاعدة البيانات (تأكد من صلاحية INSERT في سياسات RLS لجدول pharmacy_delivery_area_settings).',
          };
        }
        savedData = data;
      }

      await this.logAuditAction(
        'pharmacy.area_save',
        'pharmacy_delivery_area_settings',
        savedData.id,
        dbRow
      );

      return {
        success: true,
        area: {
          id: savedData.id,
          governorate_code: savedData.governorate_code,
          governorate_name: savedData.governorate_name,
          center_name: savedData.center_name,
          service_enabled: Boolean(savedData.service_enabled),
          delivery_fee: Number(savedData.delivery_fee ?? 0),
          updated_at: savedData.updated_at,
          updated_by: savedData.updated_by || null,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'حدث خطأ أثناء حفظ إعدادات منطقة التوصيل',
      };
    }
  },

  async saveBulkPharmacyDeliveryAreas(payload: {
    governorate_code: string;
    governorate_name: string;
    centers: string[];
    service_enabled: boolean;
    delivery_fee: number;
  }): Promise<{
    success: boolean;
    savedCount: number;
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, savedCount: 0, error: 'Supabase غير متصل' };
    }
    const cleanCenters = Array.from(
      new Set((payload.centers || []).map((c) => c.trim()).filter(Boolean))
    );
    if (cleanCenters.length === 0) {
      return { success: false, savedCount: 0, error: 'يرجى اختيار مركز واحد على الأقل' };
    }

    let savedCount = 0;
    let firstError: string | undefined;

    for (const centerName of cleanCenters) {
      const res = await this.savePharmacyDeliveryArea({
        governorate_code: payload.governorate_code,
        governorate_name: payload.governorate_name,
        center_name: centerName,
        service_enabled: payload.service_enabled,
        delivery_fee: payload.delivery_fee,
      });
      if (res.success) {
        savedCount++;
      } else if (!firstError) {
        firstError = res.error;
      }
    }

    if (savedCount === 0) {
      return {
        success: false,
        savedCount: 0,
        error: firstError || 'فشل حفظ المراكز المحددة في جدول pharmacy_delivery_area_settings',
      };
    }

    return {
      success: true,
      savedCount,
      error: firstError,
    };
  },

  async deletePharmacyDeliveryArea(id: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !isSupabaseConfigured || !id) {
      return { success: false, error: 'معرف المنطقة غير صالح' };
    }

    try {
      const { data, error } = await supabase
        .from('pharmacy_delivery_area_settings')
        .delete()
        .eq('id', id)
        .select('id');

      if (error) {
        return {
          success: false,
          error: `فشل حذف المنطقة من pharmacy_delivery_area_settings (${error.code || 'Error'}): ${error.message}`,
        };
      }

      if (!data || data.length === 0) {
        return {
          success: false,
          error:
            'لم يتم حذف السجل من قاعدة البيانات (تأكد من صلاحية DELETE في سياسات RLS لجدول pharmacy_delivery_area_settings).',
        };
      }

      await this.logAuditAction('pharmacy.area_delete', 'pharmacy_delivery_area_settings', id, {});
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'تعذر حذف منطقة التوصيل',
      };
    }
  },

  /**
   * 8. Pharmacies Directory (`public.pharmacy_pharmacies`) & User-Linked Pharmacies (`public.pharmacy_user_pharmacies`)
   */
  async getPharmaciesAndUserLinks(): Promise<{
    pharmacies: PharmacyDirectoryRecord[];
    userPharmacies: PharmacyUserPharmacyRecord[];
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { pharmacies: [], userPharmacies: [], error: 'Supabase غير متصل' };
    }

    try {
      const [pharmRes, userPharmRes] = await Promise.all([
        supabase
          .from('pharmacy_pharmacies')
          .select(
            'id, name, phone, governorate_code, governorate_name, center_name, address, latitude, longitude, is_active, created_at, updated_at, created_by, updated_by'
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('pharmacy_user_pharmacies')
          .select(
            'id, user_id, pharmacy_id, pharmacy_name, phone, governorate_code, governorate_name, center_name, address, latitude, longitude, created_at, updated_at'
          )
          .order('updated_at', { ascending: false })
          .limit(100),
      ]);

      if (pharmRes.error) {
        return {
          pharmacies: [],
          userPharmacies: [],
          error: `فشل جلب جدول pharmacy_pharmacies (${pharmRes.error.code || 'Error'}): ${pharmRes.error.message}`,
        };
      }

      const pharmacies: PharmacyDirectoryRecord[] = (pharmRes.data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        phone: p.phone || null,
        governorate_code: p.governorate_code || null,
        governorate_name: p.governorate_name || null,
        center_name: p.center_name || null,
        address: p.address || null,
        latitude: p.latitude !== null && p.latitude !== undefined ? Number(p.latitude) : null,
        longitude: p.longitude !== null && p.longitude !== undefined ? Number(p.longitude) : null,
        is_active: Boolean(p.is_active),
        created_at: p.created_at,
        updated_at: p.updated_at,
        created_by: p.created_by || null,
        updated_by: p.updated_by || null,
      }));

      const pharmaciesById: Record<string, PharmacyDirectoryRecord> = {};
      for (const p of pharmacies) {
        pharmaciesById[p.id] = p;
      }

      const rawUserPharmacies = (userPharmRes.data || []) as any[];
      const userIds = Array.from(
        new Set(rawUserPharmacies.map((u) => u.user_id).filter(Boolean))
      );
      const profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone')
          .in('id', userIds);
        for (const pr of profs || []) {
          profilesMap[pr.id] = pr;
        }
      }

      const userPharmacies: PharmacyUserPharmacyRecord[] = rawUserPharmacies.map((u) => {
        const prof = u.user_id ? profilesMap[u.user_id] : null;
        return {
          id: u.id,
          user_id: u.user_id,
          pharmacy_id: u.pharmacy_id || null,
          pharmacy_name: u.pharmacy_name,
          phone: u.phone || null,
          governorate_code: u.governorate_code || null,
          governorate_name: u.governorate_name || null,
          center_name: u.center_name || null,
          address: u.address || null,
          latitude: u.latitude !== null && u.latitude !== undefined ? Number(u.latitude) : null,
          longitude: u.longitude !== null && u.longitude !== undefined ? Number(u.longitude) : null,
          created_at: u.created_at,
          updated_at: u.updated_at,
          user_name: prof?.full_name || null,
          user_email: prof?.email || null,
          linked_pharmacy: u.pharmacy_id ? pharmaciesById[u.pharmacy_id] || null : null,
        };
      });

      return { pharmacies, userPharmacies };
    } catch (err: any) {
      return {
        pharmacies: [],
        userPharmacies: [],
        error: err?.message || 'تعذر جلب بيانات الصيدليات',
      };
    }
  },

  async savePharmacyDirectoryRecord(payload: {
    id?: string;
    name: string;
    phone?: string | null;
    governorate_code?: string | null;
    governorate_name?: string | null;
    center_name?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    is_active: boolean;
  }): Promise<{
    success: boolean;
    pharmacy?: PharmacyDirectoryRecord;
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }

    const cleanName = (payload.name || '').trim();
    if (!cleanName) {
      return { success: false, error: 'اسم الصيدلية حقل إلزامي' };
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const callerId = authData?.user?.id || null;
      const nowIso = new Date().toISOString();

      // Address column is NOT NULL in PostgreSQL table pharmacy_pharmacies
      const fallbackAddress =
        [payload.center_name?.trim(), payload.governorate_name?.trim()].filter(Boolean).join(' - ') ||
        cleanName ||
        'العنوان غير محدد';
      const cleanAddress = payload.address?.trim() || fallbackAddress;

      const rowData: Record<string, any> = {
        name: cleanName,
        phone: payload.phone?.trim() || null,
        governorate_code: payload.governorate_code?.trim() || null,
        governorate_name: payload.governorate_name?.trim() || null,
        center_name: payload.center_name?.trim() || null,
        address: cleanAddress,
        latitude:
          payload.latitude !== null &&
          payload.latitude !== undefined &&
          !Number.isNaN(Number(payload.latitude))
            ? Number(payload.latitude)
            : null,
        longitude:
          payload.longitude !== null &&
          payload.longitude !== undefined &&
          !Number.isNaN(Number(payload.longitude))
            ? Number(payload.longitude)
            : null,
        is_active: Boolean(payload.is_active),
        updated_at: nowIso,
        updated_by: callerId,
      };

      let saved: any = null;

      if (payload.id) {
        const { data, error } = await supabase
          .from('pharmacy_pharmacies')
          .update(rowData)
          .eq('id', payload.id)
          .select('*')
          .maybeSingle();

        if (error) {
          return {
            success: false,
            error: `فشل تحديث الصيدلية في pharmacy_pharmacies (${error.code || 'Error'}): ${error.message}`,
          };
        }
        if (!data) {
          return {
            success: false,
            error:
              'لم يتم تحديث سجل الصيدلية في قاعدة البيانات (تأكد من صلاحيات UPDATE في سياسات RLS لجدول pharmacy_pharmacies).',
          };
        }
        saved = data;
      } else {
        if (callerId) {
          rowData.created_by = callerId;
        }

        let { data, error } = await supabase
          .from('pharmacy_pharmacies')
          .insert([rowData])
          .select('*')
          .maybeSingle();

        // If error occurred (e.g. column created_by / updated_by does not exist or FK constraint), retry with core fields
        if (error) {
          const cleanRow: Record<string, any> = {
            name: cleanName,
            phone: payload.phone?.trim() || null,
            address: cleanAddress,
            governorate_name: payload.governorate_name?.trim() || null,
            center_name: payload.center_name?.trim() || null,
            is_active: Boolean(payload.is_active),
            updated_at: nowIso,
          };
          if (rowData.latitude !== null) cleanRow.latitude = rowData.latitude;
          if (rowData.longitude !== null) cleanRow.longitude = rowData.longitude;
          if (payload.governorate_code) cleanRow.governorate_code = payload.governorate_code;

          const retryRes = await supabase
            .from('pharmacy_pharmacies')
            .insert([cleanRow])
            .select('*')
            .maybeSingle();

          if (!retryRes.error) {
            data = retryRes.data;
            error = null;
          } else {
            error = retryRes.error;
          }
        }

        // If still no data returned (often due to RLS SELECT policies suppressing the inserted row), recover gracefully
        if (!data) {
          const { data: foundRow } = await supabase
            .from('pharmacy_pharmacies')
            .select('*')
            .eq('name', cleanName)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (foundRow) {
            saved = foundRow;
          } else if (!error) {
            saved = {
              id: 'pharm-' + Date.now(),
              name: cleanName,
              phone: payload.phone || null,
              address: cleanAddress,
              governorate_code: payload.governorate_code || null,
              governorate_name: payload.governorate_name || null,
              center_name: payload.center_name || null,
              is_active: Boolean(payload.is_active),
              created_at: nowIso,
              updated_at: nowIso,
            };
          } else {
            return {
              success: false,
              error: `فشل إضافة الصيدلية (${error.code || 'Error'}): ${error.message}`,
            };
          }
        } else {
          saved = data;
        }
      }

      await this.logAuditAction('pharmacy.directory_save', 'pharmacy_pharmacies', saved.id, {
        name: saved.name,
        is_active: saved.is_active,
      });

      return {
        success: true,
        pharmacy: {
          id: saved.id,
          name: saved.name,
          phone: saved.phone || null,
          governorate_code: saved.governorate_code || null,
          governorate_name: saved.governorate_name || null,
          center_name: saved.center_name || null,
          address: saved.address || null,
          latitude:
            saved.latitude !== null && saved.latitude !== undefined ? Number(saved.latitude) : null,
          longitude:
            saved.longitude !== null && saved.longitude !== undefined
              ? Number(saved.longitude)
              : null,
          is_active: Boolean(saved.is_active),
          created_at: saved.created_at,
          updated_at: saved.updated_at,
          created_by: saved.created_by || null,
          updated_by: saved.updated_by || null,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'حدث خطأ أثناء حفظ بيانات الصيدلية',
      };
    }
  },

  /**
   * 9. Saved Prescriptions (`public.pharmacy_saved_prescriptions` + files + items)
   */
  async getPharmacySavedPrescriptions(limit: number = 50): Promise<{
    prescriptions: PharmacySavedPrescription[];
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { prescriptions: [], error: 'Supabase غير متصل' };
    }

    try {
      const { data: rows, error } = await supabase
        .from('pharmacy_saved_prescriptions')
        .select('id, user_id, title, pharmacy_id, pharmacy_name, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) {
        return {
          prescriptions: [],
          error: `فشل جلب الروشتات المحفوظة (${error.code || 'Error'}): ${error.message}`,
        };
      }

      const rawList = (rows || []) as any[];
      if (rawList.length === 0) {
        return { prescriptions: [] };
      }

      const prescIds = rawList.map((p) => p.id);
      const userIds = Array.from(new Set(rawList.map((p) => p.user_id).filter(Boolean)));

      const [filesRes, itemsRes, profilesRes] = await Promise.all([
        supabase
          .from('pharmacy_saved_prescription_files')
          .select('*')
          .in('prescription_id', prescIds)
          .order('display_order', { ascending: true }),
        supabase
          .from('pharmacy_saved_prescription_items')
          .select('*')
          .in('prescription_id', prescIds)
          .order('sort_order', { ascending: true }),
        userIds.length > 0
          ? supabase.from('profiles').select('id, full_name, email').in('id', userIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const filesByPresc: Record<string, PharmacySavedPrescriptionFile[]> = {};
      for (const f of filesRes.data || []) {
        if (!filesByPresc[f.prescription_id]) filesByPresc[f.prescription_id] = [];
        filesByPresc[f.prescription_id].push(f as PharmacySavedPrescriptionFile);
      }

      const itemsByPresc: Record<string, PharmacySavedPrescriptionItem[]> = {};
      for (const it of itemsRes.data || []) {
        if (!itemsByPresc[it.prescription_id]) itemsByPresc[it.prescription_id] = [];
        itemsByPresc[it.prescription_id].push({
          ...it,
          requested_quantity: Number(it.requested_quantity ?? 1),
          sort_order: Number(it.sort_order ?? 0),
        } as PharmacySavedPrescriptionItem);
      }

      const profilesMap: Record<string, any> = {};
      for (const pr of profilesRes.data || []) {
        profilesMap[pr.id] = pr;
      }

      const prescriptions: PharmacySavedPrescription[] = rawList.map((p) => {
        const prof = p.user_id ? profilesMap[p.user_id] : null;
        return {
          id: p.id,
          user_id: p.user_id,
          title: p.title,
          pharmacy_id: p.pharmacy_id || null,
          pharmacy_name: p.pharmacy_name || null,
          created_at: p.created_at,
          updated_at: p.updated_at,
          files: filesByPresc[p.id] || [],
          items: itemsByPresc[p.id] || [],
          user_name: prof?.full_name || null,
          user_email: prof?.email || null,
        };
      });

      return { prescriptions };
    } catch (err: any) {
      return {
        prescriptions: [],
        error: err?.message || 'تعذر جلب الروشتات المحفوظة',
      };
    }
  },
};



