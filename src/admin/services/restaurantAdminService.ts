/**
 * Restaurant & Prepared Food Administration Service
 * Authoritative Supabase direct client queries using verified database schema
 * Strictly conforms to RBAC, RLS error handling, and exact table & column names
 */

import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  RestaurantSectionSettings,
  Restaurant,
  RestaurantCategory,
  RestaurantCategoryLink,
  RestaurantMenuCategory,
  RestaurantMenuItem,
  RestaurantItemOption,
  RestaurantItemOptionValue,
  RestaurantOffer,
  RestaurantOrder,
  RestaurantOrderItem,
  RestaurantOrderItemOption,
  RestaurantOrderStatusHistory,
  RestaurantDeliveryOrder,
  RestaurantDeliveryStatusHistory,
  RestaurantInvoice,
  RestaurantInvoiceItem,
  RestaurantFinancialTransaction,
  RestaurantSettlement,
  RestaurantSettlementItem,
  RestaurantCollectionReceipt,
  RestaurantComplaint,
  RestaurantOwnershipHistory,
  RestaurantOverviewStats,
  FoodGovernorate,
  FoodCenter,
  FoodArea,
  RestaurantServiceArea,
  RestaurantSectionServiceArea,
  RestaurantAreaDeliveryFee,
} from '../types/restaurantAdminTypes';

export const restaurantAdminService = {
  // ==========================================================================
  // 1. SECTION SETTINGS (public.restaurant_section_settings)
  // Columns: id, section_enabled, global_max_delivery_radius_km, no_driver_timeout_minutes, created_at, updated_at
  // ==========================================================================
  async getSectionSettings(): Promise<{
    settings: RestaurantSectionSettings | null;
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { settings: null, error: 'Supabase غير متصل' };
    }
    try {
      const { data, error } = await supabase
        .from('restaurant_section_settings')
        .select('id, section_enabled, global_max_delivery_radius_km, no_driver_timeout_minutes, section_visibility, disabled_display_mode, created_at, updated_at')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        return { settings: null, error: `فشل جلب إعدادات القسم: ${error.message}` };
      }
      return { settings: data as RestaurantSectionSettings | null };
    } catch (err: any) {
      return { settings: null, error: err?.message || 'حدث خطأ أثناء جلب إعدادات القسم' };
    }
  },

  async updateSectionSettings(
    id: string,
    updates: Partial<Pick<RestaurantSectionSettings, 'section_enabled' | 'global_max_delivery_radius_km' | 'no_driver_timeout_minutes' | 'section_visibility' | 'disabled_display_mode'>>
  ): Promise<{ success: boolean; settings?: RestaurantSectionSettings; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!id) {
      return { success: false, error: 'معرف سجل الإعدادات مطلوب' };
    }
    try {
      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.section_enabled !== undefined) payload.section_enabled = Boolean(updates.section_enabled);
      if (updates.global_max_delivery_radius_km !== undefined) {
        payload.global_max_delivery_radius_km = Number(updates.global_max_delivery_radius_km);
      }
      if (updates.no_driver_timeout_minutes !== undefined) {
        payload.no_driver_timeout_minutes = Number(updates.no_driver_timeout_minutes);
      }
      if (updates.section_visibility !== undefined) {
        payload.section_visibility = updates.section_visibility;
      }
      if (updates.disabled_display_mode !== undefined) {
        payload.disabled_display_mode = updates.disabled_display_mode;
      }

      const { data, error } = await supabase
        .from('restaurant_section_settings')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: `فشل تحديث إعدادات القسم: ${error.message}` };
      }
      return { success: true, settings: data as RestaurantSectionSettings };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر حفظ إعدادات القسم' };
    }
  },

  // ==========================================================================
  // 2. RESTAURANTS (public.restaurants & restaurant_category_links)
  // Columns: id, owner_user_id, name, description, phone, address, latitude, longitude,
  //          image_url, is_active, is_open, max_delivery_radius_km, commission_percent,
  //          delivery_fee, food_money_settlement_mode, created_at, updated_at
  // ==========================================================================
  async getRestaurants(filters?: {
    search?: string;
    isActive?: boolean | 'all';
    isOpen?: boolean | 'all';
    categoryId?: string;
  }): Promise<{
    restaurants: Restaurant[];
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { restaurants: [], error: 'Supabase غير متصل' };
    }
    try {
      let query = supabase
        .from('restaurants')
        .select(
          'id, owner_user_id, name, description, phone, address, latitude, longitude, image_url, is_active, is_open, max_delivery_radius_km, commission_percent, delivery_fee, food_money_settlement_mode, country_name, governorate_id, center_id, area_id, street, detailed_address, created_at, updated_at'
        )
        .order('created_at', { ascending: false });

      if (filters?.isActive !== undefined && filters.isActive !== 'all') {
        query = query.eq('is_active', Boolean(filters.isActive));
      }
      if (filters?.isOpen !== undefined && filters.isOpen !== 'all') {
        query = query.eq('is_open', Boolean(filters.isOpen));
      }
      if (filters?.search && filters.search.trim()) {
        const q = filters.search.trim().replace(/[%_]/g, '');
        if (q) {
          query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,address.ilike.%${q}%,street.ilike.%${q}%,detailed_address.ilike.%${q}%`);
        }
      }

      const { data: rows, error } = await query;
      if (error) {
        return { restaurants: [], error: `فشل جلب قائمة المطاعم: ${error.message}` };
      }

      const restaurants = (rows || []) as Restaurant[];

      // Load category links, categories & Egyptian address names
      if (restaurants.length > 0) {
        const restaurantIds = restaurants.map((r) => r.id);
        const govIds = Array.from(new Set(restaurants.map((r) => r.governorate_id).filter((g): g is string => Boolean(g))));
        const centerIds = Array.from(new Set(restaurants.map((r) => r.center_id).filter((c): c is string => Boolean(c))));
        const areaIds = Array.from(new Set(restaurants.map((r) => r.area_id).filter((a): a is string => Boolean(a))));

        const [linksRes, categoriesRes, itemsCountRes, govsRes, centersRes, areasRes] = await Promise.all([
          supabase
            .from('restaurant_category_links')
            .select('restaurant_id, category_id')
            .in('restaurant_id', restaurantIds),
          supabase
            .from('restaurant_categories')
            .select('id, name, image_url, sort_order, is_active, created_at'),
          supabase
            .from('restaurant_menu_items')
            .select('id, restaurant_id'),
          govIds.length > 0
            ? supabase.from('food_governorates').select('id, name_ar').in('id', govIds)
            : Promise.resolve({ data: [] }),
          centerIds.length > 0
            ? supabase.from('food_centers').select('id, name_ar').in('id', centerIds)
            : Promise.resolve({ data: [] }),
          areaIds.length > 0
            ? supabase.from('food_areas').select('id, name_ar').in('id', areaIds)
            : Promise.resolve({ data: [] }),
        ]);

        const categoriesMap = new Map<string, RestaurantCategory>();
        (categoriesRes.data || []).forEach((c: any) => categoriesMap.set(c.id, c));

        const linksMap = new Map<string, string[]>();
        (linksRes.data || []).forEach((l: any) => {
          const list = linksMap.get(l.restaurant_id) || [];
          list.push(l.category_id);
          linksMap.set(l.restaurant_id, list);
        });

        const itemsCountMap = new Map<string, number>();
        (itemsCountRes.data || []).forEach((item: any) => {
          itemsCountMap.set(item.restaurant_id, (itemsCountMap.get(item.restaurant_id) || 0) + 1);
        });

        const govMap = new Map<string, string>();
        (govsRes.data || []).forEach((g: any) => govMap.set(g.id, g.name_ar));

        const centerMap = new Map<string, string>();
        (centersRes.data || []).forEach((c: any) => centerMap.set(c.id, c.name_ar));

        const areaMap = new Map<string, string>();
        (areasRes.data || []).forEach((a: any) => areaMap.set(a.id, a.name_ar));

        restaurants.forEach((r) => {
          const catIds = linksMap.get(r.id) || [];
          r.categories = catIds
            .map((cid) => categoriesMap.get(cid))
            .filter((c): c is RestaurantCategory => Boolean(c));
          r.items_count = itemsCountMap.get(r.id) || 0;
          r.governorate_name = r.governorate_id ? govMap.get(r.governorate_id) || null : null;
          r.center_name = r.center_id ? centerMap.get(r.center_id) || null : null;
          r.area_name = r.area_id ? areaMap.get(r.area_id) || null : null;
        });

        // Filter by category if requested
        if (filters?.categoryId && filters.categoryId !== 'all') {
          return {
            restaurants: restaurants.filter((r) =>
              (linksMap.get(r.id) || []).includes(filters.categoryId!)
            ),
          };
        }
      }

      return { restaurants };
    } catch (err: any) {
      return { restaurants: [], error: err?.message || 'حدث خطأ أثناء جلب المطاعم' };
    }
  },

  async createRestaurant(data: {
    name: string;
    description?: string | null;
    phone: string;
    address?: string;
    latitude: number;
    longitude: number;
    image_url?: string | null;
    is_active?: boolean;
    is_open?: boolean;
    max_delivery_radius_km?: number;
    commission_percent?: number;
    delivery_fee?: number;
    food_money_settlement_mode?: string;
    owner_user_id?: string | null;
    category_ids?: string[];
    country_name?: string | null;
    governorate_id?: string | null;
    center_id?: string | null;
    area_id?: string | null;
    street?: string | null;
    detailed_address?: string | null;
  }): Promise<{
    success: boolean;
    restaurant?: Restaurant;
    isPartial?: boolean;
    partialWarning?: string;
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!data.name?.trim()) {
      return { success: false, error: 'اسم المطعم مطلوب' };
    }
    if (!data.phone?.trim()) {
      return { success: false, error: 'رقم هاتف المطعم مطلوب' };
    }

    const finalAddress = data.address?.trim() || [data.detailed_address, data.street].filter(Boolean).join(' - ') || 'مصر';
    if (!finalAddress) {
      return { success: false, error: 'عنوان المطعم مطلوب' };
    }

    const lat = Number(data.latitude);
    const lng = Number(data.longitude);
    if (
      data.latitude === undefined ||
      data.longitude === undefined ||
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return {
        success: false,
        error: 'إحداثيات الموقع غير صالحة. خط العرض يجب أن يكون بين -90 و 90 وخط الطول بين -180 و 180',
      };
    }

    const commission = Number(data.commission_percent ?? 10);
    if (isNaN(commission) || commission < 0 || commission > 100) {
      return { success: false, error: 'نسبة العمولة يجب أن تكون بين 0% و 100%' };
    }

    const radius = Number(data.max_delivery_radius_km ?? 15);
    if (isNaN(radius) || radius <= 0) {
      return { success: false, error: 'نطاق التوصيل يجب أن يكون أكبر من صفر كم' };
    }

    const fee = Number(data.delivery_fee ?? 0);
    if (isNaN(fee) || fee < 0) {
      return { success: false, error: 'رسوم التوصيل يجب أن تكون صفر أو قيمة موجبة' };
    }

    try {
      const nowIso = new Date().toISOString();
      const insertPayload = {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        phone: data.phone.trim(),
        address: finalAddress,
        latitude: lat,
        longitude: lng,
        image_url: data.image_url?.trim() || null,
        is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
        is_open: data.is_open !== undefined ? Boolean(data.is_open) : true,
        max_delivery_radius_km: radius,
        commission_percent: commission,
        delivery_fee: fee,
        food_money_settlement_mode:
          data.food_money_settlement_mode && ['per_order', 'daily', 'weekly', 'monthly'].includes(data.food_money_settlement_mode)
            ? data.food_money_settlement_mode
            : 'per_order',
        owner_user_id: data.owner_user_id || null,
        country_name: data.country_name || 'مصر',
        governorate_id: data.governorate_id || null,
        center_id: data.center_id || null,
        area_id: data.area_id || null,
        street: data.street?.trim() || null,
        detailed_address: data.detailed_address?.trim() || null,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const { data: created, error } = await supabase
        .from('restaurants')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        return { success: false, error: `فشل إنشاء المطعم: ${error.message}` };
      }

      // Link categories if provided with explicit error checking
      if (Array.isArray(data.category_ids) && data.category_ids.length > 0 && created?.id) {
        const linkRows = data.category_ids.map((catId) => ({
          restaurant_id: created.id,
          category_id: catId,
        }));
        const { error: catErr } = await supabase.from('restaurant_category_links').insert(linkRows);
        if (catErr) {
          return {
            success: true,
            isPartial: true,
            partialWarning: `تم حفظ المطعم ولكن تعذر ربط بعض التصنيفات: ${catErr.message}`,
            restaurant: created as Restaurant,
          };
        }
      }

      return { success: true, restaurant: created as Restaurant };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر إضافة المطعم' };
    }
  },

  async updateRestaurant(
    id: string,
    updates: Partial<Restaurant> & { category_ids?: string[] }
  ): Promise<{
    success: boolean;
    restaurant?: Restaurant;
    isPartial?: boolean;
    partialWarning?: string;
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!id) {
      return { success: false, error: 'معرف المطعم مفقود' };
    }

    try {
      const patch: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.name !== undefined) patch.name = updates.name.trim();
      if (updates.description !== undefined) patch.description = updates.description?.trim() || null;
      if (updates.phone !== undefined) patch.phone = updates.phone.trim();
      if (updates.address !== undefined) patch.address = updates.address.trim();

      if (updates.country_name !== undefined) patch.country_name = updates.country_name || 'مصر';
      if (updates.governorate_id !== undefined) patch.governorate_id = updates.governorate_id || null;
      if (updates.center_id !== undefined) patch.center_id = updates.center_id || null;
      if (updates.area_id !== undefined) patch.area_id = updates.area_id || null;
      if (updates.street !== undefined) patch.street = updates.street?.trim() || null;
      if (updates.detailed_address !== undefined) patch.detailed_address = updates.detailed_address?.trim() || null;

      if (updates.latitude !== undefined) {
        const lat = Number(updates.latitude);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          return { success: false, error: 'خط العرض يجب أن يكون بين -90 و 90' };
        }
        patch.latitude = lat;
      }

      if (updates.longitude !== undefined) {
        const lng = Number(updates.longitude);
        if (isNaN(lng) || lng < -180 || lng > 180) {
          return { success: false, error: 'خط الطول يجب أن يكون بين -180 و 180' };
        }
        patch.longitude = lng;
      }

      if (updates.commission_percent !== undefined) {
        const commission = Number(updates.commission_percent);
        if (isNaN(commission) || commission < 0 || commission > 100) {
          return { success: false, error: 'نسبة العمولة يجب أن تكون بين 0% و 100%' };
        }
        patch.commission_percent = commission;
      }

      if (updates.max_delivery_radius_km !== undefined) {
        const radius = Number(updates.max_delivery_radius_km);
        if (isNaN(radius) || radius <= 0) {
          return { success: false, error: 'نطاق التوصيل يجب أن يكون أكبر من صفر كم' };
        }
        patch.max_delivery_radius_km = radius;
      }

      if (updates.delivery_fee !== undefined) {
        const fee = Number(updates.delivery_fee);
        if (isNaN(fee) || fee < 0) {
          return { success: false, error: 'رسوم التوصيل يجب أن تكون صفر أو قيمة موجبة' };
        }
        patch.delivery_fee = fee;
      }

      if (updates.image_url !== undefined) patch.image_url = updates.image_url?.trim() || null;
      if (updates.is_active !== undefined) patch.is_active = Boolean(updates.is_active);
      if (updates.is_open !== undefined) patch.is_open = Boolean(updates.is_open);
      if (updates.food_money_settlement_mode !== undefined) {
        const mode = updates.food_money_settlement_mode;
        patch.food_money_settlement_mode =
          ['per_order', 'daily', 'weekly', 'monthly'].includes(mode)
            ? mode
            : 'per_order';
      }
      if (updates.owner_user_id !== undefined) patch.owner_user_id = updates.owner_user_id || null;

      const { data: updated, error } = await supabase
        .from('restaurants')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: `فشل تحديث بيانات المطعم: ${error.message}` };
      }

      // Update category links if specified with explicit error checking
      if (Array.isArray(updates.category_ids)) {
        const { error: delErr } = await supabase
          .from('restaurant_category_links')
          .delete()
          .eq('restaurant_id', id);

        if (delErr) {
          return {
            success: true,
            isPartial: true,
            partialWarning: `تم تعديل المطعم بنجاح ولكن تعذر مسح روابط التصنيفات السابقة: ${delErr.message}`,
            restaurant: updated as Restaurant,
          };
        }

        if (updates.category_ids.length > 0) {
          const links = updates.category_ids.map((cid) => ({
            restaurant_id: id,
            category_id: cid,
          }));
          const { error: insErr } = await supabase
            .from('restaurant_category_links')
            .insert(links);

          if (insErr) {
            return {
              success: true,
              isPartial: true,
              partialWarning: `تم تعديل بيانات المطعم ولكن تعذر ربط التصنيفات الجديدة: ${insErr.message}`,
              restaurant: updated as Restaurant,
            };
          }
        }
      }

      return { success: true, restaurant: updated as Restaurant };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر تعديل بيانات المطعم' };
    }
  },

  async toggleRestaurantActive(id: string, currentStatus: boolean): Promise<{ success: boolean; error?: string }> {
    return this.updateRestaurant(id, { is_active: !currentStatus });
  },

  async toggleRestaurantOpen(id: string, currentStatus: boolean): Promise<{ success: boolean; error?: string }> {
    return this.updateRestaurant(id, { is_open: !currentStatus });
  },

  async getRestaurantCategoryIds(restaurantId: string): Promise<string[]> {
    if (!supabase || !isSupabaseConfigured || !restaurantId) return [];
    try {
      const { data, error } = await supabase
        .from('restaurant_category_links')
        .select('category_id')
        .eq('restaurant_id', restaurantId);
      if (error || !data) return [];
      return data.map((d: any) => d.category_id).filter(Boolean);
    } catch {
      return [];
    }
  },


  // ==========================================================================
  // 3. RESTAURANT CATEGORIES (public.restaurant_categories & restaurant_category_links)
  // Columns: id, name, image_url, sort_order, is_active, created_at
  // ==========================================================================
  async getCategories(): Promise<{ categories: RestaurantCategory[]; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { categories: [], error: 'Supabase غير متصل' };
    }
    try {
      const [catRes, linksRes] = await Promise.all([
        supabase
          .from('restaurant_categories')
          .select('id, name, image_url, sort_order, is_active, created_at')
          .order('sort_order', { ascending: true }),
        supabase.from('restaurant_category_links').select('category_id'),
      ]);

      if (catRes.error) {
        return { categories: [], error: `فشل جلب تصنيفات المطاعم: ${catRes.error.message}` };
      }

      const countMap = new Map<string, number>();
      (linksRes.data || []).forEach((l: any) => {
        countMap.set(l.category_id, (countMap.get(l.category_id) || 0) + 1);
      });

      const categories: RestaurantCategory[] = (catRes.data || []).map((c: any) => ({
        ...c,
        restaurants_count: countMap.get(c.id) || 0,
      }));

      return { categories };
    } catch (err: any) {
      return { categories: [], error: err?.message || 'تعذر جلب تصنيفات المطاعم' };
    }
  },

  async createCategory(data: {
    name: string;
    image_url?: string | null;
    sort_order?: number;
    is_active?: boolean;
  }): Promise<{ success: boolean; category?: RestaurantCategory; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!data.name?.trim()) {
      return { success: false, error: 'اسم التصنيف مطلوب' };
    }
    try {
      const payload = {
        name: data.name.trim(),
        image_url: data.image_url?.trim() || null,
        sort_order: Number(data.sort_order || 0),
        is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
        created_at: new Date().toISOString(),
      };
      const { data: created, error } = await supabase
        .from('restaurant_categories')
        .insert(payload)
        .select()
        .single();

      if (error) {
        return { success: false, error: `فشل إضافة التصنيف: ${error.message}` };
      }
      return { success: true, category: created as RestaurantCategory };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر إنشاء التصنيف' };
    }
  },

  async updateCategory(
    id: string,
    updates: Partial<RestaurantCategory>
  ): Promise<{ success: boolean; category?: RestaurantCategory; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!id) return { success: false, error: 'معرف التصنيف مطلوب' };

    try {
      const patch: Record<string, any> = {};
      if (updates.name !== undefined) patch.name = updates.name.trim();
      if (updates.image_url !== undefined) patch.image_url = updates.image_url?.trim() || null;
      if (updates.sort_order !== undefined) patch.sort_order = Number(updates.sort_order);
      if (updates.is_active !== undefined) patch.is_active = Boolean(updates.is_active);

      const { data: updated, error } = await supabase
        .from('restaurant_categories')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: `فشل تعديل التصنيف: ${error.message}` };
      }
      return { success: true, category: updated as RestaurantCategory };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر تعديل التصنيف' };
    }
  },

  async deleteCategory(id: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!id) return { success: false, error: 'معرف التصنيف مطلوب' };

    try {
      // Check for linked restaurants first to prevent data inconsistency
      const { count, error: countErr } = await supabase
        .from('restaurant_category_links')
        .select('restaurant_id', { count: 'exact', head: true })
        .eq('category_id', id);

      if (countErr) {
        return { success: false, error: `تعذر فحص ارتباطات التصنيف: ${countErr.message}` };
      }
      if (count && count > 0) {
        return {
          success: false,
          error: `لا يمكن حذف هذا التصنيف لأنه مرتبط حالياً بـ (${count}) مطعم. يرجى إزالة الارتباطات أولاً.`,
        };
      }

      const { error: delErr } = await supabase
        .from('restaurant_categories')
        .delete()
        .eq('id', id);

      if (delErr) {
        return { success: false, error: `فشل حذف التصنيف: ${delErr.message}` };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر حذف التصنيف' };
    }
  },

  // ==========================================================================
  // 4. MENU CATEGORIES (public.restaurant_menu_categories)
  // Columns: id, restaurant_id, name, sort_order, is_active, created_at
  // ==========================================================================
  async getMenuCategories(restaurantId?: string): Promise<{
    menuCategories: RestaurantMenuCategory[];
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { menuCategories: [], error: 'Supabase غير متصل' };
    }
    try {
      let query = supabase
        .from('restaurant_menu_categories')
        .select('id, restaurant_id, name, sort_order, is_active, created_at')
        .order('sort_order', { ascending: true });

      if (restaurantId && restaurantId !== 'all') {
        query = query.eq('restaurant_id', restaurantId);
      }

      const { data, error } = await query;
      if (error) {
        return { menuCategories: [], error: `فشل جلب أقسام القائمة: ${error.message}` };
      }
      return { menuCategories: (data || []) as RestaurantMenuCategory[] };
    } catch (err: any) {
      return { menuCategories: [], error: err?.message || 'تعذر جلب أقسام القائمة' };
    }
  },

  async createMenuCategory(data: {
    restaurant_id: string;
    name: string;
    sort_order?: number;
    is_active?: boolean;
  }): Promise<{ success: boolean; menuCategory?: RestaurantMenuCategory; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!data.restaurant_id) return { success: false, error: 'المطعم مطلوب' };
    if (!data.name?.trim()) return { success: false, error: 'اسم قسم القائمة مطلوب' };

    try {
      const payload = {
        restaurant_id: data.restaurant_id,
        name: data.name.trim(),
        sort_order: Number(data.sort_order || 0),
        is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
        created_at: new Date().toISOString(),
      };
      const { data: created, error } = await supabase
        .from('restaurant_menu_categories')
        .insert(payload)
        .select()
        .single();

      if (error) {
        return { success: false, error: `فشل إنشاء قسم القائمة: ${error.message}` };
      }
      return { success: true, menuCategory: created as RestaurantMenuCategory };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر إضافة قسم القائمة' };
    }
  },

  async updateMenuCategory(
    id: string,
    updates: Partial<RestaurantMenuCategory>
  ): Promise<{ success: boolean; menuCategory?: RestaurantMenuCategory; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!id) return { success: false, error: 'معرف القسم مفقود' };

    try {
      const patch: Record<string, any> = {};
      if (updates.name !== undefined) patch.name = updates.name.trim();
      if (updates.sort_order !== undefined) patch.sort_order = Number(updates.sort_order);
      if (updates.is_active !== undefined) patch.is_active = Boolean(updates.is_active);

      const { data: updated, error } = await supabase
        .from('restaurant_menu_categories')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: `فشل تحديث قسم القائمة: ${error.message}` };
      }
      return { success: true, menuCategory: updated as RestaurantMenuCategory };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر تعديل قسم القائمة' };
    }
  },

  async deleteMenuCategory(id: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!id) return { success: false, error: 'معرف القسم مطلوب' };

    try {
      // Check for items linked to this category before deleting
      const { count, error: countErr } = await supabase
        .from('restaurant_menu_items')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', id);

      if (countErr) {
        return { success: false, error: `تعذر التحقق من الأصناف المرتبطة: ${countErr.message}` };
      }
      if (count && count > 0) {
        return {
          success: false,
          error: `لا يمكن حذف هذا القسم لاحتوائه على (${count}) صنف. يرجى نقل أو حذف الأصناف أولاً.`,
        };
      }

      const { error: delErr } = await supabase
        .from('restaurant_menu_categories')
        .delete()
        .eq('id', id);

      if (delErr) {
        return { success: false, error: `فشل حذف قسم القائمة: ${delErr.message}` };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر حذف قسم القائمة' };
    }
  },

  // ==========================================================================
  // 5. MENU ITEMS (public.restaurant_menu_items)
  // Columns: id, restaurant_id, category_id, name, description, image_url, price,
  //          is_available, sort_order, created_at, updated_at
  // ==========================================================================
  async getMenuItems(filters?: {
    restaurantId?: string;
    categoryId?: string;
    isAvailable?: boolean | 'all';
    search?: string;
  }): Promise<{ menuItems: RestaurantMenuItem[]; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { menuItems: [], error: 'Supabase غير متصل' };
    }
    try {
      let query = supabase
        .from('restaurant_menu_items')
        .select('id, restaurant_id, category_id, name, description, image_url, price, is_available, sort_order, created_at, updated_at')
        .order('sort_order', { ascending: true });

      if (filters?.restaurantId && filters.restaurantId !== 'all') {
        query = query.eq('restaurant_id', filters.restaurantId);
      }
      if (filters?.categoryId && filters.categoryId !== 'all') {
        query = query.eq('category_id', filters.categoryId);
      }
      if (filters?.isAvailable !== undefined && filters.isAvailable !== 'all') {
        query = query.eq('is_available', Boolean(filters.isAvailable));
      }
      if (filters?.search && filters.search.trim()) {
        const q = filters.search.trim().replace(/[%_]/g, '');
        if (q) {
          query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
        }
      }

      const { data: rows, error } = await query;
      if (error) {
        return { menuItems: [], error: `فشل جلب الأصناف: ${error.message}` };
      }

      const items = (rows || []) as RestaurantMenuItem[];

      // Enrich with category names and restaurant names
      if (items.length > 0) {
        const [catsRes, restsRes, optionsCountRes] = await Promise.all([
          supabase.from('restaurant_menu_categories').select('id, name'),
          supabase.from('restaurants').select('id, name'),
          supabase.from('restaurant_item_options').select('id, menu_item_id'),
        ]);

        const catsMap = new Map<string, string>();
        (catsRes.data || []).forEach((c: any) => catsMap.set(c.id, c.name));

        const restsMap = new Map<string, string>();
        (restsRes.data || []).forEach((r: any) => restsMap.set(r.id, r.name));

        const optsCountMap = new Map<string, number>();
        (optionsCountRes.data || []).forEach((o: any) => {
          optsCountMap.set(o.menu_item_id, (optsCountMap.get(o.menu_item_id) || 0) + 1);
        });

        items.forEach((item) => {
          item.category_name = catsMap.get(item.category_id) || 'قسم غير محدد';
          item.restaurant_name = restsMap.get(item.restaurant_id) || 'مطعم غير محدد';
          item.options_count = optsCountMap.get(item.id) || 0;
        });
      }

      return { menuItems: items };
    } catch (err: any) {
      return { menuItems: [], error: err?.message || 'تعذر جلب الأصناف' };
    }
  },

  async createMenuItem(data: {
    restaurant_id: string;
    category_id: string;
    name: string;
    description?: string | null;
    image_url?: string | null;
    price: number;
    is_available?: boolean;
    sort_order?: number;
  }): Promise<{ success: boolean; menuItem?: RestaurantMenuItem; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!data.restaurant_id) return { success: false, error: 'المطعم مطلوب' };
    if (!data.category_id) return { success: false, error: 'قسم القائمة مطلوب' };
    if (!data.name?.trim()) return { success: false, error: 'اسم الصنف مطلوب' };
    if (data.price === undefined || isNaN(Number(data.price)) || Number(data.price) < 0) {
      return { success: false, error: 'سعر الصنف يجب أن يكون رقمًا صحيحًا وموجبًا' };
    }

    try {
      const nowIso = new Date().toISOString();
      const payload = {
        restaurant_id: data.restaurant_id,
        category_id: data.category_id,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        image_url: data.image_url?.trim() || null,
        price: Number(data.price),
        is_available: data.is_available !== undefined ? Boolean(data.is_available) : true,
        sort_order: Number(data.sort_order || 0),
        created_at: nowIso,
        updated_at: nowIso,
      };

      const { data: created, error } = await supabase
        .from('restaurant_menu_items')
        .insert(payload)
        .select()
        .single();

      if (error) {
        return { success: false, error: `فشل إضافة الصنف: ${error.message}` };
      }
      return { success: true, menuItem: created as RestaurantMenuItem };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر إنشاء الصنف' };
    }
  },

  async updateMenuItem(
    id: string,
    updates: Partial<RestaurantMenuItem>
  ): Promise<{ success: boolean; menuItem?: RestaurantMenuItem; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!id) return { success: false, error: 'معرف الصنف مفقود' };

    try {
      const patch: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.name !== undefined) patch.name = updates.name.trim();
      if (updates.description !== undefined) patch.description = updates.description?.trim() || null;
      if (updates.image_url !== undefined) patch.image_url = updates.image_url?.trim() || null;
      if (updates.price !== undefined) patch.price = Number(updates.price);
      if (updates.category_id !== undefined) patch.category_id = updates.category_id;
      if (updates.is_available !== undefined) patch.is_available = Boolean(updates.is_available);
      if (updates.sort_order !== undefined) patch.sort_order = Number(updates.sort_order);

      const { data: updated, error } = await supabase
        .from('restaurant_menu_items')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: `فشل تحديث الصنف: ${error.message}` };
      }
      return { success: true, menuItem: updated as RestaurantMenuItem };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر تعديل الصنف' };
    }
  },

  async deleteMenuItem(id: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!id) return { success: false, error: 'معرف الصنف مطلوب' };

    try {
      const { error } = await supabase.from('restaurant_menu_items').delete().eq('id', id);
      if (error) {
        return { success: false, error: `فشل حذف الصنف: ${error.message}` };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر حذف الصنف' };
    }
  },

  // ==========================================================================
  // 6. ITEM OPTIONS & VALUES (public.restaurant_item_options & restaurant_item_option_values)
  // Columns:
  //   restaurant_item_options: id, restaurant_id, menu_item_id, name, required, min_select, max_select, sort_order
  //   restaurant_item_option_values: id, option_id, name, extra_price, is_available, sort_order
  // ==========================================================================
  async getItemOptions(menuItemId?: string, restaurantId?: string): Promise<{
    options: RestaurantItemOption[];
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { options: [], error: 'Supabase غير متصل' };
    }
    try {
      let query = supabase
        .from('restaurant_item_options')
        .select('id, restaurant_id, menu_item_id, name, required, min_select, max_select, sort_order')
        .order('sort_order', { ascending: true });

      if (menuItemId && menuItemId !== 'all') {
        query = query.eq('menu_item_id', menuItemId);
      }
      if (restaurantId && restaurantId !== 'all') {
        query = query.eq('restaurant_id', restaurantId);
      }

      const { data: optionRows, error: optErr } = await query;
      if (optErr) {
        return { options: [], error: `فشل جلب مجموعات الاختيارات: ${optErr.message}` };
      }

      const options = (optionRows || []) as RestaurantItemOption[];
      if (options.length > 0) {
        const optionIds = options.map((o) => o.id);
        const { data: valueRows, error: valErr } = await supabase
          .from('restaurant_item_option_values')
          .select('id, option_id, name, extra_price, is_available, sort_order')
          .in('option_id', optionIds)
          .order('sort_order', { ascending: true });

        if (!valErr && valueRows) {
          const valuesByOption = new Map<string, RestaurantItemOptionValue[]>();
          valueRows.forEach((v: any) => {
            const list = valuesByOption.get(v.option_id) || [];
            list.push(v);
            valuesByOption.set(v.option_id, list);
          });
          options.forEach((opt) => {
            opt.values = valuesByOption.get(opt.id) || [];
          });
        }
      }

      return { options };
    } catch (err: any) {
      return { options: [], error: err?.message || 'تعذر جلب مجموعات الاختيارات' };
    }
  },

  async createItemOption(data: {
    restaurant_id: string;
    menu_item_id: string;
    name: string;
    required?: boolean;
    min_select?: number;
    max_select?: number;
    sort_order?: number;
  }): Promise<{ success: boolean; option?: RestaurantItemOption; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!data.name?.trim()) return { success: false, error: 'اسم مجموعة الاختيار مطلوب' };
    if (!data.menu_item_id) return { success: false, error: 'معرف الصنف مطلوب' };
    if (!data.restaurant_id) return { success: false, error: 'معرف المطعم مطلوب' };

    const minSelect = Number(data.min_select || 0);
    const maxSelect = Number(data.max_select || 1);
    if (minSelect < 0 || maxSelect < 1 || minSelect > maxSelect) {
      return {
        success: false,
        error: 'حدود الاختيار غير صالحة: الحد الأدنى لا يمكن أن يتجاوز الحد الأقصى أو يكون سالبًا',
      };
    }

    try {
      const payload = {
        restaurant_id: data.restaurant_id,
        menu_item_id: data.menu_item_id,
        name: data.name.trim(),
        required: Boolean(data.required),
        min_select: minSelect,
        max_select: maxSelect,
        sort_order: Number(data.sort_order || 0),
      };

      const { data: created, error } = await supabase
        .from('restaurant_item_options')
        .insert(payload)
        .select()
        .single();

      if (error) {
        return { success: false, error: `فشل إنشاء مجموعة الاختيار: ${error.message}` };
      }
      return { success: true, option: created as RestaurantItemOption };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر إضافة مجموعة الاختيار' };
    }
  },

  async updateItemOption(
    id: string,
    updates: Partial<RestaurantItemOption>
  ): Promise<{ success: boolean; option?: RestaurantItemOption; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!id) return { success: false, error: 'معرف المجموعة مفقود' };

    try {
      const patch: Record<string, any> = {};
      if (updates.name !== undefined) patch.name = updates.name.trim();
      if (updates.required !== undefined) patch.required = Boolean(updates.required);
      if (updates.min_select !== undefined) patch.min_select = Number(updates.min_select);
      if (updates.max_select !== undefined) patch.max_select = Number(updates.max_select);
      if (updates.sort_order !== undefined) patch.sort_order = Number(updates.sort_order);

      const { data: updated, error } = await supabase
        .from('restaurant_item_options')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: `فشل تحديث مجموعة الاختيار: ${error.message}` };
      }
      return { success: true, option: updated as RestaurantItemOption };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر تعديل مجموعة الاختيار' };
    }
  },

  async deleteItemOption(id: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!id) return { success: false, error: 'معرف المجموعة مطلوب' };

    try {
      // Delete option values first with explicit error check
      const { error: valDelErr } = await supabase
        .from('restaurant_item_option_values')
        .delete()
        .eq('option_id', id);

      if (valDelErr) {
        return { success: false, error: `فشل حذف قيم مجموعة الاختيار: ${valDelErr.message}` };
      }

      const { error } = await supabase.from('restaurant_item_options').delete().eq('id', id);
      if (error) {
        return { success: false, error: `فشل حذف المجموعة: ${error.message}` };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر حذف المجموعة' };
    }
  },

  async createOptionValue(data: {
    option_id: string;
    name: string;
    extra_price?: number;
    is_available?: boolean;
    sort_order?: number;
  }): Promise<{ success: boolean; value?: RestaurantItemOptionValue; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!data.option_id) return { success: false, error: 'معرف مجموعة الاختيار مطلوب' };
    if (!data.name?.trim()) return { success: false, error: 'اسم الاختيار مطلوب' };

    try {
      const payload = {
        option_id: data.option_id,
        name: data.name.trim(),
        extra_price: Number(data.extra_price || 0),
        is_available: data.is_available !== undefined ? Boolean(data.is_available) : true,
        sort_order: Number(data.sort_order || 0),
      };

      const { data: created, error } = await supabase
        .from('restaurant_item_option_values')
        .insert(payload)
        .select()
        .single();

      if (error) {
        return { success: false, error: `فشل إضافة قيمة الاختيار: ${error.message}` };
      }
      return { success: true, value: created as RestaurantItemOptionValue };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر إضافة قيمة الاختيار' };
    }
  },

  async updateOptionValue(
    id: string,
    updates: Partial<RestaurantItemOptionValue>
  ): Promise<{ success: boolean; value?: RestaurantItemOptionValue; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!id) return { success: false, error: 'معرف قيمة الاختيار مطلوب' };

    try {
      const patch: Record<string, any> = {};
      if (updates.name !== undefined) patch.name = updates.name.trim();
      if (updates.extra_price !== undefined) patch.extra_price = Number(updates.extra_price);
      if (updates.is_available !== undefined) patch.is_available = Boolean(updates.is_available);
      if (updates.sort_order !== undefined) patch.sort_order = Number(updates.sort_order);

      const { data: updated, error } = await supabase
        .from('restaurant_item_option_values')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: `فشل تعديل قيمة الاختيار: ${error.message}` };
      }
      return { success: true, value: updated as RestaurantItemOptionValue };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر تعديل قيمة الاختيار' };
    }
  },

  async deleteOptionValue(id: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!id) return { success: false, error: 'معرف قيمة الاختيار مطلوب' };

    try {
      const { error } = await supabase.from('restaurant_item_option_values').delete().eq('id', id);
      if (error) {
        return { success: false, error: `فشل حذف قيمة الاختيار: ${error.message}` };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر حذف قيمة الاختيار' };
    }
  },

  // ==========================================================================
  // 7. OFFERS (public.restaurant_offers)
  // Columns: id, restaurant_id, title, description, discount_type, discount_value,
  //          starts_at, ends_at, is_active, created_at
  // ==========================================================================
  async getOffers(restaurantId?: string): Promise<{ offers: RestaurantOffer[]; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { offers: [], error: 'Supabase غير متصل' };
    }
    try {
      let query = supabase
        .from('restaurant_offers')
        .select('id, restaurant_id, title, description, discount_type, discount_value, starts_at, ends_at, is_active, created_at')
        .order('created_at', { ascending: false });

      if (restaurantId && restaurantId !== 'all') {
        query = query.eq('restaurant_id', restaurantId);
      }

      const { data: rows, error } = await query;
      if (error) {
        return { offers: [], error: `فشل جلب العروض: ${error.message}` };
      }

      const offers = (rows || []) as RestaurantOffer[];
      if (offers.length > 0) {
        const { data: restsData } = await supabase.from('restaurants').select('id, name');
        const restMap = new Map<string, string>();
        (restsData || []).forEach((r: any) => restMap.set(r.id, r.name));
        offers.forEach((o) => {
          o.restaurant_name = restMap.get(o.restaurant_id) || 'مطعم غير محدد';
        });
      }

      return { offers };
    } catch (err: any) {
      return { offers: [], error: err?.message || 'تعذر جلب العروض' };
    }
  },

  async createOffer(data: {
    restaurant_id: string;
    title: string;
    description?: string | null;
    discount_type: 'percentage' | 'fixed' | 'amount';
    discount_value: number;
    starts_at: string;
    ends_at: string;
    is_active?: boolean;
  }): Promise<{ success: boolean; offer?: RestaurantOffer; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!data.restaurant_id) return { success: false, error: 'المطعم مطلوب' };
    if (!data.title?.trim()) return { success: false, error: 'عنوان العرض مطلوب' };
    if (data.discount_value === undefined || Number(data.discount_value) <= 0) {
      return { success: false, error: 'قيمة الخصم يجب أن تكون أكبر من صفر' };
    }
    if (data.discount_type === 'percentage' && Number(data.discount_value) > 100) {
      return { success: false, error: 'نسبة الخصم لا يمكن أن تتجاوز 100%' };
    }
    if (!data.starts_at || !data.ends_at) {
      return { success: false, error: 'تاريخ بداية ونهاية العرض مطلوبان' };
    }
    if (new Date(data.ends_at).getTime() < new Date(data.starts_at).getTime()) {
      return { success: false, error: 'تاريخ نهاية العرض لا يمكن أن يكون قبل تاريخ البداية' };
    }

    try {
      const payload = {
        restaurant_id: data.restaurant_id,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        discount_type: data.discount_type || 'percentage',
        discount_value: Number(data.discount_value),
        starts_at: data.starts_at,
        ends_at: data.ends_at,
        is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
        created_at: new Date().toISOString(),
      };

      const { data: created, error } = await supabase
        .from('restaurant_offers')
        .insert(payload)
        .select()
        .single();

      if (error) {
        return { success: false, error: `فشل إضافة العرض: ${error.message}` };
      }
      return { success: true, offer: created as RestaurantOffer };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر إنشاء العرض' };
    }
  },

  async updateOffer(
    id: string,
    updates: Partial<RestaurantOffer>
  ): Promise<{ success: boolean; offer?: RestaurantOffer; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!id) return { success: false, error: 'معرف العرض مطلوب' };

    try {
      const patch: Record<string, any> = {};
      if (updates.title !== undefined) patch.title = updates.title.trim();
      if (updates.description !== undefined) patch.description = updates.description?.trim() || null;
      if (updates.discount_type !== undefined) patch.discount_type = updates.discount_type;
      if (updates.discount_value !== undefined) {
        const val = Number(updates.discount_value);
        if (isNaN(val) || val <= 0) {
          return { success: false, error: 'قيمة الخصم يجب أن تكون أكبر من صفر' };
        }
        const effectiveType = updates.discount_type || 'percentage';
        if (effectiveType === 'percentage' && val > 100) {
          return { success: false, error: 'نسبة الخصم لا يمكن أن تتجاوز 100%' };
        }
        patch.discount_value = val;
      }
      if (updates.starts_at !== undefined) patch.starts_at = updates.starts_at;
      if (updates.ends_at !== undefined) patch.ends_at = updates.ends_at;
      if (updates.is_active !== undefined) patch.is_active = Boolean(updates.is_active);

      const { data: updated, error } = await supabase
        .from('restaurant_offers')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: `فشل تعديل العرض: ${error.message}` };
      }
      return { success: true, offer: updated as RestaurantOffer };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر تعديل العرض' };
    }
  },

  async deleteOffer(id: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!id) return { success: false, error: 'معرف العرض مطلوب' };

    try {
      const { error } = await supabase.from('restaurant_offers').delete().eq('id', id);
      if (error) {
        return { success: false, error: `فشل حذف العرض: ${error.message}` };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر حذف العرض' };
    }
  },

  // ==========================================================================
  // 8. ORDERS & ORDER DETAILS (public.restaurant_orders & related snapshots)
  // Columns:
  //   restaurant_orders: id, order_number, customer_user_id, restaurant_id, fulfillment_route,
  //     status, restaurant_name_snapshot, restaurant_phone_snapshot, restaurant_latitude_snapshot,
  //     restaurant_longitude_snapshot, customer_name, customer_phone, delivery_address,
  //     delivery_latitude, delivery_longitude, food_subtotal, discount_amount, delivery_fee,
  //     customer_total, commission_percent_snapshot, driver_fee_share, admin_fee_share,
  //     restaurant_fee_share, payment_method, restaurant_confirmed_at, restaurant_rejected_at,
  //     restaurant_confirmation_method, cancellation_reason, idempotency_key, created_at, updated_at
  // ==========================================================================
  async getOrders(filters?: {
    status?: string;
    restaurantId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ orders: RestaurantOrder[]; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { orders: [], error: 'Supabase غير متصل' };
    }
    try {
      let query = supabase
        .from('restaurant_orders')
        .select(
          'id, order_number, customer_user_id, restaurant_id, fulfillment_route, status, restaurant_name_snapshot, restaurant_phone_snapshot, restaurant_latitude_snapshot, restaurant_longitude_snapshot, customer_name, customer_phone, delivery_address, delivery_latitude, delivery_longitude, food_subtotal, discount_amount, delivery_fee, customer_total, commission_percent_snapshot, driver_fee_share, admin_fee_share, restaurant_fee_share, payment_method, restaurant_confirmed_at, restaurant_rejected_at, restaurant_confirmation_method, cancellation_reason, idempotency_key, delivery_area_id, delivery_governorate_name_snapshot, delivery_center_name_snapshot, delivery_area_name_snapshot, created_at, updated_at'
        )
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.restaurantId && filters.restaurantId !== 'all') {
        query = query.eq('restaurant_id', filters.restaurantId);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        query = query.lte('created_at', to.toISOString());
      }
      if (filters?.search && filters.search.trim()) {
        const q = filters.search.trim().replace(/[%_]/g, '');
        if (q) {
          query = query.or(
            `order_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,delivery_address.ilike.%${q}%,restaurant_name_snapshot.ilike.%${q}%`
          );
        }
      }

      const { data, error } = await query;
      if (error) {
        return { orders: [], error: `فشل جلب الطلبات: ${error.message}` };
      }
      return { orders: (data || []) as RestaurantOrder[] };
    } catch (err: any) {
      return { orders: [], error: err?.message || 'تعذر جلب الطلبات' };
    }
  },

  async getOrderDetails(orderId: string): Promise<{ order: RestaurantOrder | null; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { order: null, error: 'Supabase غير متصل' };
    }
    if (!orderId) return { order: null, error: 'معرف الطلب مطلوب' };

    try {
      const [orderRes, itemsRes, statusHistoryRes, deliveryOrderRes, invoiceRes] = await Promise.all([
        supabase
          .from('restaurant_orders')
          .select('*')
          .eq('id', orderId)
          .maybeSingle(),
        supabase
          .from('restaurant_order_items')
          .select('id, order_id, menu_item_id, item_name_snapshot, unit_price_snapshot, quantity, discount_amount, line_total, customer_approved_price_change, created_at')
          .eq('order_id', orderId),
        supabase
          .from('restaurant_order_status_history')
          .select('id, order_id, old_status, new_status, changed_by, note, created_at')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false }),
        supabase
          .from('restaurant_delivery_orders')
          .select('*')
          .eq('order_id', orderId)
          .maybeSingle(),
        supabase
          .from('restaurant_invoices')
          .select('*')
          .eq('order_id', orderId)
          .maybeSingle(),
      ]);

      if (orderRes.error || !orderRes.data) {
        return { order: null, error: orderRes.error?.message || 'لم يتم العثور على الطلب' };
      }

      const order = orderRes.data as RestaurantOrder;
      const items = (itemsRes.data || []) as RestaurantOrderItem[];

      // Load item options snapshots
      if (items.length > 0) {
        const itemIds = items.map((i) => i.id);
        const { data: optRows } = await supabase
          .from('restaurant_order_item_options')
          .select('id, order_item_id, option_name_snapshot, value_name_snapshot, extra_price_snapshot')
          .in('order_item_id', itemIds);

        const optsByItem = new Map<string, RestaurantOrderItemOption[]>();
        (optRows || []).forEach((opt: any) => {
          const list = optsByItem.get(opt.order_item_id) || [];
          list.push(opt);
          optsByItem.set(opt.order_item_id, list);
        });

        items.forEach((item) => {
          item.options = optsByItem.get(item.id) || [];
        });
      }

      order.items = items;
      order.status_history = (statusHistoryRes.data || []) as RestaurantOrderStatusHistory[];
      order.delivery_order = (deliveryOrderRes.data as RestaurantDeliveryOrder) || null;
      order.invoice = (invoiceRes.data as RestaurantInvoice) || null;

      return { order };
    } catch (err: any) {
      return { order: null, error: err?.message || 'تعذر جلب تفاصيل الطلب' };
    }
  },

  // ==========================================================================
  // 9. DELIVERY ORDERS (public.restaurant_delivery_orders & status history)
  // Columns: id, order_id, driver_user_id, status, driver_commission,
  //          area_commission_rule_snapshot, restaurant_phone_confirmed_at,
  //          assigned_at, picked_up_at, delivered_at, created_at, updated_at
  // ==========================================================================
  async getDeliveryOrders(filters?: { status?: string }): Promise<{
    deliveryOrders: RestaurantDeliveryOrder[];
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { deliveryOrders: [], error: 'Supabase غير متصل' };
    }
    try {
      let query = supabase
        .from('restaurant_delivery_orders')
        .select(
          'id, order_id, driver_user_id, status, driver_commission, area_commission_rule_snapshot, restaurant_phone_confirmed_at, assigned_at, picked_up_at, delivered_at, created_at, updated_at'
        )
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      const { data: rows, error } = await query;
      if (error) {
        return { deliveryOrders: [], error: `فشل جلب عمليات التوصيل: ${error.message}` };
      }

      const deliveryOrders = (rows || []) as RestaurantDeliveryOrder[];
      if (deliveryOrders.length > 0) {
        const orderIds = deliveryOrders.map((d) => d.order_id);
        const { data: ordersData } = await supabase
          .from('restaurant_orders')
          .select('id, order_number, customer_name, delivery_address')
          .in('id', orderIds);

        const ordersMap = new Map<string, any>();
        (ordersData || []).forEach((o: any) => ordersMap.set(o.id, o));

        deliveryOrders.forEach((d) => {
          const ord = ordersMap.get(d.order_id);
          if (ord) {
            d.order_number = ord.order_number;
            d.customer_name = ord.customer_name;
            d.delivery_address = ord.delivery_address;
          }
        });
      }

      return { deliveryOrders };
    } catch (err: any) {
      return { deliveryOrders: [], error: err?.message || 'تعذر جلب عمليات التوصيل' };
    }
  },

  async getDeliveryStatusHistory(deliveryOrderId: string): Promise<{
    history: RestaurantDeliveryStatusHistory[];
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { history: [], error: 'Supabase غير متصل' };
    }
    try {
      const { data, error } = await supabase
        .from('restaurant_delivery_status_history')
        .select('id, delivery_order_id, old_status, new_status, changed_by, note, created_at')
        .eq('delivery_order_id', deliveryOrderId)
        .order('created_at', { ascending: false });

      if (error) {
        return { history: [], error: `فشل جلب سجل حالات التوصيل: ${error.message}` };
      }
      return { history: (data || []) as RestaurantDeliveryStatusHistory[] };
    } catch (err: any) {
      return { history: [], error: err?.message || 'تعذر جلب سجل التوصيل' };
    }
  },

  // ==========================================================================
  // 10. INVOICES (public.restaurant_invoices & restaurant_invoice_items)
  // Columns: id, order_id, invoice_number, status, food_subtotal, discount_amount,
  //          delivery_fee, total_amount, issued_at, created_at
  // ==========================================================================
  async getInvoices(filters?: {
    status?: string;
    search?: string;
  }): Promise<{ invoices: RestaurantInvoice[]; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { invoices: [], error: 'Supabase غير متصل' };
    }
    try {
      let query = supabase
        .from('restaurant_invoices')
        .select(
          'id, order_id, invoice_number, status, food_subtotal, discount_amount, delivery_fee, total_amount, issued_at, created_at'
        )
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.search && filters.search.trim()) {
        const q = filters.search.trim().replace(/[%_]/g, '');
        if (q) {
          query = query.or(`invoice_number.ilike.%${q}%`);
        }
      }

      const { data, error } = await query;
      if (error) {
        return { invoices: [], error: `فشل جلب الفواتير: ${error.message}` };
      }
      return { invoices: (data || []) as RestaurantInvoice[] };
    } catch (err: any) {
      return { invoices: [], error: err?.message || 'تعذر جلب الفواتير' };
    }
  },

  async getInvoiceItems(invoiceId: string): Promise<{ items: RestaurantInvoiceItem[]; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { items: [], error: 'Supabase غير متصل' };
    }
    try {
      const { data, error } = await supabase
        .from('restaurant_invoice_items')
        .select('id, invoice_id, item_name_snapshot, quantity, unit_price, discount_amount, line_total')
        .eq('invoice_id', invoiceId);

      if (error) {
        return { items: [], error: `فشل جلب عناصر الفاتورة: ${error.message}` };
      }
      return { items: (data || []) as RestaurantInvoiceItem[] };
    } catch (err: any) {
      return { items: [], error: err?.message || 'تعذر جلب بنود الفاتورة' };
    }
  },

  // ==========================================================================
  // 11. FINANCIAL TRANSACTIONS & SETTLEMENTS
  // Tables:
  //   restaurant_financial_transactions
  //   restaurant_settlements
  //   restaurant_settlement_items
  //   restaurant_collection_receipts
  // ==========================================================================
  async getFinancialTransactions(filters?: {
    restaurantId?: string;
    transactionType?: string;
  }): Promise<{ transactions: RestaurantFinancialTransaction[]; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { transactions: [], error: 'Supabase غير متصل' };
    }
    try {
      let query = supabase
        .from('restaurant_financial_transactions')
        .select(
          'id, order_id, restaurant_id, driver_user_id, transaction_type, amount, direction, status, idempotency_key, reverses_transaction_id, notes, created_by, created_at, confirmed_at'
        )
        .order('created_at', { ascending: false });

      if (filters?.restaurantId && filters.restaurantId !== 'all') {
        query = query.eq('restaurant_id', filters.restaurantId);
      }
      if (filters?.transactionType && filters.transactionType !== 'all') {
        query = query.eq('transaction_type', filters.transactionType);
      }

      const { data, error } = await query;
      if (error) {
        return { transactions: [], error: `فشل جلب الحركات المالية: ${error.message}` };
      }
      return { transactions: (data || []) as RestaurantFinancialTransaction[] };
    } catch (err: any) {
      return { transactions: [], error: err?.message || 'تعذر جلب الحركات المالية' };
    }
  },

  async getSettlements(filters?: {
    restaurantId?: string;
    status?: string;
  }): Promise<{ settlements: RestaurantSettlement[]; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { settlements: [], error: 'Supabase غير متصل' };
    }
    try {
      let query = supabase
        .from('restaurant_settlements')
        .select(
          'id, restaurant_id, driver_user_id, settlement_type, period_start, period_end, amount_due, amount_paid, status, agreement_snapshot, created_at, closed_at'
        )
        .order('created_at', { ascending: false });

      if (filters?.restaurantId && filters.restaurantId !== 'all') {
        query = query.eq('restaurant_id', filters.restaurantId);
      }
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) {
        return { settlements: [], error: `فشل جلب التسويات: ${error.message}` };
      }
      return { settlements: (data || []) as RestaurantSettlement[] };
    } catch (err: any) {
      return { settlements: [], error: err?.message || 'تعذر جلب سجل التسويات' };
    }
  },

  async getCollectionReceipts(filters?: {
    restaurantId?: string;
  }): Promise<{ receipts: RestaurantCollectionReceipt[]; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { receipts: [], error: 'Supabase غير متصل' };
    }
    try {
      let query = supabase
        .from('restaurant_collection_receipts')
        .select(
          'id, order_id, restaurant_id, driver_user_id, settlement_id, amount, receipt_image_path, received_by, notes, received_at'
        )
        .order('received_at', { ascending: false });

      if (filters?.restaurantId && filters.restaurantId !== 'all') {
        query = query.eq('restaurant_id', filters.restaurantId);
      }

      const { data, error } = await query;
      if (error) {
        return { receipts: [], error: `فشل جلب إيصالات التحصيل: ${error.message}` };
      }
      return { receipts: (data || []) as RestaurantCollectionReceipt[] };
    } catch (err: any) {
      return { receipts: [], error: err?.message || 'تعذر جلب إيصالات التحصيل' };
    }
  },

  // ==========================================================================
  // 12. COMPLAINTS (public.restaurant_complaints)
  // Columns: id, order_id, customer_user_id, restaurant_id, subject,
  //          description, status, resolution_note, resolved_by, created_at, resolved_at
  // ==========================================================================
  async getComplaints(filters?: {
    status?: string;
    restaurantId?: string;
  }): Promise<{ complaints: RestaurantComplaint[]; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { complaints: [], error: 'Supabase غير متصل' };
    }
    try {
      let query = supabase
        .from('restaurant_complaints')
        .select(
          'id, order_id, customer_user_id, restaurant_id, subject, description, status, resolution_note, resolved_by, created_at, resolved_at'
        )
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.restaurantId && filters.restaurantId !== 'all') {
        query = query.eq('restaurant_id', filters.restaurantId);
      }

      const { data: rows, error } = await query;
      if (error) {
        return { complaints: [], error: `فشل جلب الشكاوى: ${error.message}` };
      }

      const complaints = (rows || []) as RestaurantComplaint[];
      if (complaints.length > 0) {
        const [restsData, ordersData] = await Promise.all([
          supabase.from('restaurants').select('id, name'),
          supabase.from('restaurant_orders').select('id, order_number, customer_name'),
        ]);

        const restsMap = new Map<string, string>();
        (restsData.data || []).forEach((r: any) => restsMap.set(r.id, r.name));

        const ordersMap = new Map<string, any>();
        (ordersData.data || []).forEach((o: any) => ordersMap.set(o.id, o));

        complaints.forEach((c) => {
          if (c.restaurant_id) c.restaurant_name = restsMap.get(c.restaurant_id) || 'غير محدد';
          if (c.order_id) {
            const ord = ordersMap.get(c.order_id);
            if (ord) {
              c.order_number = ord.order_number;
              c.customer_name = ord.customer_name;
            }
          }
        });
      }

      return { complaints };
    } catch (err: any) {
      return { complaints: [], error: err?.message || 'تعذر جلب الشكاوى' };
    }
  },

  async resolveComplaint(
    id: string,
    resolutionNote: string,
    newStatus: string = 'resolved'
  ): Promise<{ success: boolean; complaint?: RestaurantComplaint; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!id) return { success: false, error: 'معرف الشكوى مطلوب' };
    if (!resolutionNote?.trim()) return { success: false, error: 'ملاحظة حل الشكوى مطلوبة' };

    try {
      const { data: authData } = await supabase.auth.getUser();
      const adminUserId = authData?.user?.id || null;
      const nowIso = new Date().toISOString();

      const patch = {
        status: newStatus,
        resolution_note: resolutionNote.trim(),
        resolved_by: adminUserId,
        resolved_at: nowIso,
      };

      const { data: updated, error } = await supabase
        .from('restaurant_complaints')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: `فشل تسجيل حل الشكوى: ${error.message}` };
      }
      return { success: true, complaint: updated as RestaurantComplaint };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر توثيق حل الشكوى' };
    }
  },

  // ==========================================================================
  // 13. OWNERSHIP HISTORY (public.restaurant_ownership_history)
  // Columns: id, restaurant_id, previous_owner_user_id, new_owner_user_id,
  //          approved_by, status, requested_at, approved_at, notes
  // ==========================================================================
  async getOwnershipHistory(restaurantId?: string): Promise<{
    history: RestaurantOwnershipHistory[];
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { history: [], error: 'Supabase غير متصل' };
    }
    try {
      let query = supabase
        .from('restaurant_ownership_history')
        .select('id, restaurant_id, previous_owner_user_id, new_owner_user_id, approved_by, status, requested_at, approved_at, notes')
        .order('requested_at', { ascending: false });

      if (restaurantId && restaurantId !== 'all') {
        query = query.eq('restaurant_id', restaurantId);
      }

      const { data, error } = await query;
      if (error) {
        return { history: [], error: `فشل جلب سجل تغيير الملكية: ${error.message}` };
      }
      return { history: (data || []) as RestaurantOwnershipHistory[] };
    } catch (err: any) {
      return { history: [], error: err?.message || 'تعذر جلب سجل الملكية' };
    }
  },

  // ==========================================================================
  // 14. OVERVIEW STATS (Aggregated from real Supabase records)
  // ==========================================================================
  async getOverviewStats(): Promise<{ stats: RestaurantOverviewStats; error?: string }> {
    const emptyStats: RestaurantOverviewStats = {
      totalRestaurants: 0,
      activeRestaurants: 0,
      openRestaurants: 0,
      totalCategories: 0,
      totalMenuItems: 0,
      availableMenuItems: 0,
      totalOrders: 0,
      pendingOrders: 0,
      activeOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      totalSales: 0,
      totalDeliveryFees: 0,
      pendingComplaints: 0,
      activeOffers: 0,
      pendingSettlements: 0,
    };

    if (!supabase || !isSupabaseConfigured) {
      return { stats: emptyStats, error: 'Supabase غير متصل' };
    }

    try {
      const [
        restaurantsRes,
        categoriesRes,
        menuItemsRes,
        ordersRes,
        complaintsRes,
        offersRes,
        settlementsRes,
      ] = await Promise.all([
        supabase.from('restaurants').select('id, is_active, is_open'),
        supabase.from('restaurant_categories').select('id', { count: 'exact', head: true }),
        supabase.from('restaurant_menu_items').select('id, is_available'),
        supabase.from('restaurant_orders').select('id, status, customer_total, delivery_fee'),
        supabase.from('restaurant_complaints').select('id, status'),
        supabase.from('restaurant_offers').select('id, is_active'),
        supabase.from('restaurant_settlements').select('id, status'),
      ]);

      const restaurants = restaurantsRes.data || [];
      const menuItems = menuItemsRes.data || [];
      const orders = ordersRes.data || [];
      const complaints = complaintsRes.data || [];
      const offers = offersRes.data || [];
      const settlements = settlementsRes.data || [];

      let completedOrders = 0;
      let pendingOrders = 0;
      let activeOrders = 0;
      let cancelledOrders = 0;
      let totalSales = 0;
      let totalDeliveryFees = 0;

      orders.forEach((o: any) => {
        const st = (o.status || '').toLowerCase();
        if (st === 'completed' || st === 'delivered') {
          completedOrders++;
          totalSales += Number(o.customer_total || 0);
          totalDeliveryFees += Number(o.delivery_fee || 0);
        } else if (st === 'pending' || st === 'new' || st === 'pending_review') {
          pendingOrders++;
        } else if (st === 'cancelled') {
          cancelledOrders++;
        } else {
          activeOrders++;
        }
      });

      const stats: RestaurantOverviewStats = {
        totalRestaurants: restaurants.length,
        activeRestaurants: restaurants.filter((r: any) => Boolean(r.is_active)).length,
        openRestaurants: restaurants.filter((r: any) => Boolean(r.is_open)).length,
        totalCategories: categoriesRes.count ?? 0,
        totalMenuItems: menuItems.length,
        availableMenuItems: menuItems.filter((i: any) => Boolean(i.is_available)).length,
        totalOrders: orders.length,
        pendingOrders,
        activeOrders,
        completedOrders,
        cancelledOrders,
        totalSales,
        totalDeliveryFees,
        pendingComplaints: complaints.filter((c: any) => c.status !== 'resolved' && c.status !== 'closed').length,
        activeOffers: offers.filter((o: any) => Boolean(o.is_active)).length,
        pendingSettlements: settlements.filter((s: any) => s.status === 'pending' || s.status === 'open').length,
      };

      return { stats };
    } catch (err: any) {
      return { stats: emptyStats, error: err?.message || 'تعذر حساب إحصاءات المطاعم' };
    }
  },

  // ==========================================================================
  // 15. EGYPTIAN ADMINISTRATIVE ADDRESS HIERARCHY
  // Tables: food_governorates, food_centers, food_areas
  // ==========================================================================
  async getFoodGovernorates(): Promise<{ governorates: FoodGovernorate[]; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { governorates: [], error: 'Supabase غير متصل' };
    }
    try {
      const { data, error } = await supabase
        .from('food_governorates')
        .select('id, country_name, name_ar, name_en, code, is_active, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name_ar', { ascending: true });

      if (error) {
        return { governorates: [], error: `فشل جلب قائمة المحافظات: ${error.message}` };
      }
      return { governorates: (data || []) as FoodGovernorate[] };
    } catch (err: any) {
      return { governorates: [], error: err?.message || 'تعذر جلب المحافظات' };
    }
  },

  async getFoodCenters(governorateId: string): Promise<{ centers: FoodCenter[]; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { centers: [], error: 'Supabase غير متصل' };
    }
    if (!governorateId) return { centers: [] };
    try {
      const { data, error } = await supabase
        .from('food_centers')
        .select('id, governorate_id, name_ar, name_en, is_active, sort_order, source_code')
        .eq('governorate_id', governorateId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name_ar', { ascending: true });

      if (error) {
        return { centers: [], error: `فشل جلب قائمة المراكز/الأقسام: ${error.message}` };
      }
      return { centers: (data || []) as FoodCenter[] };
    } catch (err: any) {
      return { centers: [], error: err?.message || 'تعذر جلب المراكز' };
    }
  },

  async getFoodAreas(centerId: string, governorateId?: string): Promise<{ areas: FoodArea[]; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { areas: [], error: 'Supabase غير متصل' };
    }
    if (!centerId) return { areas: [] };
    try {
      let query = supabase
        .from('food_areas')
        .select('id, governorate_id, center_id, name_ar, name_en, is_active, sort_order')
        .eq('center_id', centerId)
        .eq('is_active', true);

      if (governorateId) {
        query = query.eq('governorate_id', governorateId);
      }

      const { data, error } = await query
        .order('sort_order', { ascending: true })
        .order('name_ar', { ascending: true });

      if (error) {
        return { areas: [], error: `فشل جلب قائمة المناطق: ${error.message}` };
      }
      return { areas: (data || []) as FoodArea[] };
    } catch (err: any) {
      return { areas: [], error: err?.message || 'تعذر جلب المناطق' };
    }
  },

  // ==========================================================================
  // 16. RESTAURANT SERVICE AREAS & DELIVERY FEES
  // Tables: restaurant_service_areas & restaurant_area_delivery_fees
  // ==========================================================================
  async getRestaurantServiceAreas(restaurantId: string): Promise<{
    serviceAreas: RestaurantServiceArea[];
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { serviceAreas: [], error: 'Supabase غير متصل' };
    }
    if (!restaurantId) return { serviceAreas: [] };

    try {
      const [areasRes, feesRes] = await Promise.all([
        supabase
          .from('restaurant_service_areas')
          .select('id, restaurant_id, governorate_id, center_id, area_id, is_active, created_at, updated_at')
          .eq('restaurant_id', restaurantId)
          .order('created_at', { ascending: false }),
        supabase
          .from('restaurant_area_delivery_fees')
          .select('id, restaurant_id, area_id, delivery_fee, is_active')
          .eq('restaurant_id', restaurantId),
      ]);

      if (areasRes.error) {
        return { serviceAreas: [], error: `فشل جلب مناطق التوصيل: ${areasRes.error.message}` };
      }

      const rawAreas = (areasRes.data || []) as RestaurantServiceArea[];
      const feesMap = new Map<string, number>();
      (feesRes.data || []).forEach((f: any) => feesMap.set(f.area_id, Number(f.delivery_fee)));

      if (rawAreas.length === 0) {
        return { serviceAreas: [] };
      }

      // Collect unique area, center, and governorate IDs to fetch human-readable labels
      const areaIds = Array.from(new Set(rawAreas.map((a) => a.area_id).filter(Boolean)));
      const centerIds = Array.from(new Set(rawAreas.map((a) => a.center_id).filter((c): c is string => Boolean(c))));
      const govIds = Array.from(new Set(rawAreas.map((a) => a.governorate_id).filter((g): g is string => Boolean(g))));

      const [areasMeta, centersMeta, govsMeta] = await Promise.all([
        areaIds.length > 0
          ? supabase.from('food_areas').select('id, name_ar, center_id, governorate_id').in('id', areaIds)
          : Promise.resolve({ data: [] }),
        centerIds.length > 0
          ? supabase.from('food_centers').select('id, name_ar').in('id', centerIds)
          : Promise.resolve({ data: [] }),
        govIds.length > 0
          ? supabase.from('food_governorates').select('id, name_ar').in('id', govIds)
          : Promise.resolve({ data: [] }),
      ]);

      const aMap = new Map<string, any>();
      (areasMeta.data || []).forEach((item: any) => aMap.set(item.id, item));

      const cMap = new Map<string, any>();
      (centersMeta.data || []).forEach((item: any) => cMap.set(item.id, item));

      const gMap = new Map<string, any>();
      (govsMeta.data || []).forEach((item: any) => gMap.set(item.id, item));

      const enriched: RestaurantServiceArea[] = rawAreas.map((item) => {
        const areaInfo = aMap.get(item.area_id);
        const centerId = item.center_id || areaInfo?.center_id;
        const govId = item.governorate_id || areaInfo?.governorate_id;

        return {
          ...item,
          delivery_fee: feesMap.has(item.area_id) ? feesMap.get(item.area_id) : undefined,
          area_name_ar: areaInfo?.name_ar || '—',
          center_name_ar: cMap.get(centerId)?.name_ar || '—',
          governorate_name_ar: gMap.get(govId)?.name_ar || '—',
        };
      });

      return { serviceAreas: enriched };
    } catch (err: any) {
      return { serviceAreas: [], error: err?.message || 'تعذر جلب مناطق التوصيل' };
    }
  },

  async upsertRestaurantServiceAreaAndFee(data: {
    restaurant_id: string;
    governorate_id?: string | null;
    center_id?: string | null;
    area_id: string;
    is_active?: boolean;
    delivery_fee: number;
  }): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!data.restaurant_id) return { success: false, error: 'معرف المطعم مطلوب' };
    if (!data.area_id) return { success: false, error: 'يرجى اختيار المنطقة' };

    const fee = Number(data.delivery_fee);
    if (isNaN(fee) || fee < 0) {
      return { success: false, error: 'رسوم التوصيل للمنطقة يجب أن تكون صفر أو قيمة موجبة' };
    }

    const isActive = data.is_active !== undefined ? Boolean(data.is_active) : true;
    const nowIso = new Date().toISOString();

    try {
      // 1. Check if restaurant_service_areas already has this pair
      const { data: existingArea, error: findAreaErr } = await supabase
        .from('restaurant_service_areas')
        .select('id, restaurant_id, area_id')
        .eq('restaurant_id', data.restaurant_id)
        .eq('area_id', data.area_id)
        .maybeSingle();

      if (findAreaErr) {
        return { success: false, error: `فشل التحقق من نطاق التوصيل: ${findAreaErr.message}` };
      }

      if (existingArea?.id) {
        const { error: updateAreaErr } = await supabase
          .from('restaurant_service_areas')
          .update({
            is_active: isActive,
            governorate_id: data.governorate_id || null,
            center_id: data.center_id || null,
            updated_at: nowIso,
          })
          .eq('id', existingArea.id);

        if (updateAreaErr) {
          return { success: false, error: `فشل تحديث منطقة التوصيل: ${updateAreaErr.message}` };
        }
      } else {
        const { error: insertAreaErr } = await supabase
          .from('restaurant_service_areas')
          .insert({
            restaurant_id: data.restaurant_id,
            governorate_id: data.governorate_id || null,
            center_id: data.center_id || null,
            area_id: data.area_id,
            is_active: isActive,
            created_at: nowIso,
            updated_at: nowIso,
          });

        if (insertAreaErr) {
          return { success: false, error: `فشل إضافة منطقة التوصيل: ${insertAreaErr.message}` };
        }
      }

      // 2. Upsert in restaurant_area_delivery_fees
      const { data: existingFee, error: findFeeErr } = await supabase
        .from('restaurant_area_delivery_fees')
        .select('id')
        .eq('restaurant_id', data.restaurant_id)
        .eq('area_id', data.area_id)
        .maybeSingle();

      if (findFeeErr) {
        return { success: false, error: `فشل التحقق من رسوم المنطقة: ${findFeeErr.message}` };
      }

      if (existingFee?.id) {
        const { error: updateFeeErr } = await supabase
          .from('restaurant_area_delivery_fees')
          .update({
            delivery_fee: fee,
            is_active: isActive,
            updated_at: nowIso,
          })
          .eq('id', existingFee.id);

        if (updateFeeErr) {
          return { success: false, error: `فشل تحديث رسوم توصيل المنطقة: ${updateFeeErr.message}` };
        }
      } else {
        const { error: insertFeeErr } = await supabase
          .from('restaurant_area_delivery_fees')
          .insert({
            restaurant_id: data.restaurant_id,
            area_id: data.area_id,
            delivery_fee: fee,
            is_active: isActive,
            created_at: nowIso,
            updated_at: nowIso,
          });

        if (insertFeeErr) {
          return { success: false, error: `فشل حفظ رسوم توصيل المنطقة: ${insertFeeErr.message}` };
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر حفظ منطقة ورسوم التوصيل' };
    }
  },

  async toggleRestaurantServiceArea(
    serviceAreaId: string,
    isActive: boolean
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!serviceAreaId) return { success: false, error: 'معرف نطاق التوصيل مطلوب' };

    try {
      const nowIso = new Date().toISOString();
      const { data: current, error: getErr } = await supabase
        .from('restaurant_service_areas')
        .select('restaurant_id, area_id')
        .eq('id', serviceAreaId)
        .single();

      if (getErr || !current) {
        return { success: false, error: getErr?.message || 'لم يتم العثور على النطاق' };
      }

      const { error: areaErr } = await supabase
        .from('restaurant_service_areas')
        .update({ is_active: isActive, updated_at: nowIso })
        .eq('id', serviceAreaId);

      if (areaErr) {
        return { success: false, error: `فشل تحديث حالة المنطقة: ${areaErr.message}` };
      }

      // Keep is_active in delivery fees aligned
      await supabase
        .from('restaurant_area_delivery_fees')
        .update({ is_active: isActive, updated_at: nowIso })
        .eq('restaurant_id', current.restaurant_id)
        .eq('area_id', current.area_id);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر تحديث حالة منطقة التوصيل' };
    }
  },

  async deleteRestaurantServiceArea(
    serviceAreaId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!serviceAreaId) return { success: false, error: 'معرف نطاق التوصيل مطلوب' };

    try {
      const { data: current, error: getErr } = await supabase
        .from('restaurant_service_areas')
        .select('restaurant_id, area_id')
        .eq('id', serviceAreaId)
        .single();

      if (getErr || !current) {
        return { success: false, error: getErr?.message || 'لم يتم العثور على النطاق' };
      }

      const { error: delErr } = await supabase
        .from('restaurant_service_areas')
        .delete()
        .eq('id', serviceAreaId);

      if (delErr) {
        return { success: false, error: `فشل إزالة منطقة التوصيل: ${delErr.message}` };
      }

      await supabase
        .from('restaurant_area_delivery_fees')
        .delete()
        .eq('restaurant_id', current.restaurant_id)
        .eq('area_id', current.area_id);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر إزالة منطقة التوصيل' };
    }
  },

  async validateAndCalculateDeliverySnapshot(
    restaurantId: string,
    areaId: string
  ): Promise<{
    isServiced: boolean;
    delivery_fee: number;
    delivery_area_id: string;
    delivery_governorate_name_snapshot?: string | null;
    delivery_center_name_snapshot?: string | null;
    delivery_area_name_snapshot?: string | null;
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { isServiced: false, delivery_fee: 0, delivery_area_id: areaId, error: 'Supabase غير متصل' };
    }
    try {
      const { data: serviceArea, error: sErr } = await supabase
        .from('restaurant_service_areas')
        .select('id, is_active, governorate_id, center_id, area_id')
        .eq('restaurant_id', restaurantId)
        .eq('area_id', areaId)
        .maybeSingle();

      if (sErr) {
        return { isServiced: false, delivery_fee: 0, delivery_area_id: areaId, error: sErr.message };
      }

      if (!serviceArea || !serviceArea.is_active) {
        return { isServiced: false, delivery_fee: 0, delivery_area_id: areaId, error: 'المطعم لا يغطي هذه المنطقة حالياً' };
      }

      const [feeRes, restRes, areaInfoRes] = await Promise.all([
        supabase
          .from('restaurant_area_delivery_fees')
          .select('delivery_fee, is_active')
          .eq('restaurant_id', restaurantId)
          .eq('area_id', areaId)
          .maybeSingle(),
        supabase
          .from('restaurants')
          .select('delivery_fee')
          .eq('id', restaurantId)
          .single(),
        supabase
          .from('food_areas')
          .select('id, name_ar, center_id, governorate_id')
          .eq('id', areaId)
          .single(),
      ]);

      const defaultFee = Number(restRes.data?.delivery_fee || 15);
      const fee = (feeRes.data?.is_active && feeRes.data?.delivery_fee !== undefined)
        ? Number(feeRes.data.delivery_fee)
        : defaultFee;

      const areaData = areaInfoRes.data;
      let centerName: string | null = null;
      let govName: string | null = null;

      if (areaData?.center_id) {
        const { data: centerRow } = await supabase
          .from('food_centers')
          .select('name_ar')
          .eq('id', areaData.center_id)
          .single();
        centerName = centerRow?.name_ar || null;
      }
      if (areaData?.governorate_id) {
        const { data: govRow } = await supabase
          .from('food_governorates')
          .select('name_ar')
          .eq('id', areaData.governorate_id)
          .single();
        govName = govRow?.name_ar || null;
      }

      return {
        isServiced: true,
        delivery_fee: fee,
        delivery_area_id: areaId,
        delivery_governorate_name_snapshot: govName,
        delivery_center_name_snapshot: centerName,
        delivery_area_name_snapshot: areaData?.name_ar || null,
      };
    } catch (err: any) {
      return { isServiced: false, delivery_fee: 0, delivery_area_id: areaId, error: err?.message || 'تعذر التحقق من التوصيل' };
    }
  },

  // ==========================================================================
  // 17. SECTION SERVICE AREAS (public.restaurant_section_service_areas)
  // Columns: id, governorate_id, center_id, area_id, is_active, created_at, updated_at
  // Supports multi-level scopes:
  // - Governorate level (governorate_id set, center_id & area_id null)
  // - Center level (governorate_id & center_id set, area_id null)
  // - Area level (governorate_id, center_id & area_id set)
  // ==========================================================================
  async getSectionServiceAreas(): Promise<{
    sectionAreas: RestaurantSectionServiceArea[];
    error?: string;
  }> {
    if (!supabase || !isSupabaseConfigured) {
      return { sectionAreas: [], error: 'Supabase غير متصل' };
    }
    try {
      const { data: rows, error } = await supabase
        .from('restaurant_section_service_areas')
        .select('id, governorate_id, center_id, area_id, is_active, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) {
        return { sectionAreas: [], error: `فشل جلب نطاقات عمل قسم المطاعم: ${error.message}` };
      }

      const raw = (rows || []) as RestaurantSectionServiceArea[];
      if (raw.length === 0) {
        return { sectionAreas: [] };
      }

      // Collect unique IDs for enrichment
      const govIds = Array.from(new Set(raw.map((r) => r.governorate_id).filter((g): g is string => Boolean(g))));
      const centerIds = Array.from(new Set(raw.map((r) => r.center_id).filter((c): c is string => Boolean(c))));
      const areaIds = Array.from(new Set(raw.map((r) => r.area_id).filter((a): a is string => Boolean(a))));

      const [govsRes, centersRes, areasRes] = await Promise.all([
        govIds.length > 0
          ? supabase.from('food_governorates').select('id, name_ar').in('id', govIds)
          : Promise.resolve({ data: [] }),
        centerIds.length > 0
          ? supabase.from('food_centers').select('id, name_ar').in('id', centerIds)
          : Promise.resolve({ data: [] }),
        areaIds.length > 0
          ? supabase.from('food_areas').select('id, name_ar').in('id', areaIds)
          : Promise.resolve({ data: [] }),
      ]);

      const gMap = new Map<string, string>();
      (govsRes.data || []).forEach((g: any) => gMap.set(g.id, g.name_ar));

      const cMap = new Map<string, string>();
      (centersRes.data || []).forEach((c: any) => cMap.set(c.id, c.name_ar));

      const aMap = new Map<string, string>();
      (areasRes.data || []).forEach((a: any) => aMap.set(a.id, a.name_ar));

      const enriched: RestaurantSectionServiceArea[] = raw.map((item) => {
        let level: 'governorate' | 'center' | 'area' = 'governorate';
        if (item.area_id) {
          level = 'area';
        } else if (item.center_id) {
          level = 'center';
        }

        return {
          ...item,
          level,
          governorate_name_ar: item.governorate_id ? gMap.get(item.governorate_id) || '—' : '—',
          center_name_ar: item.center_id ? cMap.get(item.center_id) || '—' : '—',
          area_name_ar: item.area_id ? aMap.get(item.area_id) || '—' : '—',
        };
      });

      return { sectionAreas: enriched };
    } catch (err: any) {
      return { sectionAreas: [], error: err?.message || 'تعذر جلب نطاقات عمل قسم المطاعم' };
    }
  },

  async createSectionServiceArea(data: {
    governorate_id: string;
    center_id?: string | null;
    area_id?: string | null;
    is_active?: boolean;
  }): Promise<{ success: boolean; sectionArea?: RestaurantSectionServiceArea; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!data.governorate_id) {
      return { success: false, error: 'يرجى اختيار المحافظة على الأقل لتحديد نطاق التشغيل' };
    }

    const govId = data.governorate_id;
    const centerId = data.center_id || null;
    const areaId = data.area_id || null;
    const isActive = data.is_active !== undefined ? Boolean(data.is_active) : true;
    const nowIso = new Date().toISOString();

    try {
      // Deduplication check
      let dupQuery = supabase
        .from('restaurant_section_service_areas')
        .select('id')
        .eq('governorate_id', govId);

      if (centerId) {
        dupQuery = dupQuery.eq('center_id', centerId);
      } else {
        dupQuery = dupQuery.is('center_id', null);
      }

      if (areaId) {
        dupQuery = dupQuery.eq('area_id', areaId);
      } else {
        dupQuery = dupQuery.is('area_id', null);
      }

      const { data: existing, error: dupErr } = await dupQuery.maybeSingle();
      if (dupErr) {
        return { success: false, error: `فشل التحقق من عدم التكرار: ${dupErr.message}` };
      }
      if (existing) {
        return { success: false, error: 'هذا النطاق الجغرافي مضاف بالفعل في نطاقات عمل القسم' };
      }

      const payload = {
        governorate_id: govId,
        center_id: centerId,
        area_id: areaId,
        is_active: isActive,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const { data: created, error: insErr } = await supabase
        .from('restaurant_section_service_areas')
        .insert(payload)
        .select()
        .single();

      if (insErr) {
        return { success: false, error: `فشل إضافة نطاق تشغيل القسم: ${insErr.message}` };
      }

      return { success: true, sectionArea: created as RestaurantSectionServiceArea };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر إضافة نطاق تشغيل القسم' };
    }
  },

  async toggleSectionServiceArea(
    id: string,
    isActive: boolean
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!id) return { success: false, error: 'معرف نطاق تشغيل القسم مفقود' };

    try {
      const { error } = await supabase
        .from('restaurant_section_service_areas')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        return { success: false, error: `فشل تغيير حالة نطاق القسم: ${error.message}` };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر تحديث حالة نطاق القسم' };
    }
  },

  async deleteSectionServiceArea(id: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, error: 'Supabase غير متصل' };
    }
    if (!id) return { success: false, error: 'معرف نطاق تشغيل القسم مفقود' };

    try {
      const { error } = await supabase
        .from('restaurant_section_service_areas')
        .delete()
        .eq('id', id);

      if (error) {
        return { success: false, error: `فشل حذف نطاق تشغيل القسم: ${error.message}` };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر حذف نطاق تشغيل القسم' };
    }
  },
};
