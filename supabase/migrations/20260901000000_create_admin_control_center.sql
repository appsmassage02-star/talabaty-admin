-- ==============================================================================
-- TALABAT AL-BAYT (طلبات البيت) — SUPER ADMIN CONTROL CENTER & DATABASE MIGRATION
-- ==============================================================================
-- Migration: 20260901000000_create_admin_control_center.sql
-- Description: Creates the authoritative Super Admin model, Role-Based Access Control (RBAC),
-- global taxonomy categories, centralized product catalog, audit logs, global announcements,
-- system settings, user blocking columns, and secure SECURITY DEFINER administrative functions.
-- ==============================================================================

-- 1. EXTEND PROFILES TABLE WITH ADMIN & ACCOUNT STATUS COLUMNS
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. ADMIN USERS & RBAC TABLE
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'ADMIN', -- 'SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CONTENT_MANAGER', 'READ_ONLY'
  custom_permissions JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_admin_user_id UNIQUE (user_id)
);

-- 3. GLOBAL CATEGORIES TABLE (Central application taxonomy available to all users)
CREATE TABLE IF NOT EXISTS public.global_categories (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  image_url TEXT NOT NULL,
  color TEXT DEFAULT 'emerald',
  bg_light TEXT DEFAULT 'bg-emerald-50 text-emerald-800 border-emerald-200',
  badge_color TEXT DEFAULT 'bg-emerald-100 text-emerald-800',
  description TEXT,
  common_items JSONB DEFAULT '[]'::jsonb,
  subcategories JSONB DEFAULT '[]'::jsonb,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. GLOBAL PRODUCTS CATALOG TABLE
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  image_url TEXT,
  default_quantity TEXT DEFAULT '1',
  unit TEXT DEFAULT 'حبة',
  aliases JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ADMIN AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email TEXT,
  action TEXT NOT NULL, -- 'USER_BLOCKED', 'USER_UNBLOCKED', 'USER_DELETED', 'CATEGORY_CREATED', etc.
  entity_type TEXT NOT NULL, -- 'USER', 'HOUSEHOLD', 'CATEGORY', 'PRODUCT', 'NOTIFICATION', 'SETTINGS', 'ADMIN'
  entity_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. GLOBAL ANNOUNCEMENTS & REMOTE BROADCASTS
CREATE TABLE IF NOT EXISTS public.app_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'announcement', -- 'announcement', 'system', 'maintenance', 'promotion'
  target_type TEXT DEFAULT 'all', -- 'all', 'user', 'household', 'role'
  target_id TEXT,
  target_role TEXT,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. APPLICATION REMOTE SYSTEM CONFIGURATION & FEATURE FLAGS
CREATE TABLE IF NOT EXISTS public.app_system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. INDEXES FOR HIGH-PERFORMANCE ADMIN QUERIES
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users(role);
CREATE INDEX IF NOT EXISTS idx_global_categories_active ON public.global_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(is_featured);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.admin_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.app_announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_is_blocked ON public.profiles(is_blocked);

-- ==============================================================================
-- 9. SECURITY DEFINER ADMINISTRATIVE FUNCTIONS (Hardened search_path = public)
-- ==============================================================================

-- Check if current authenticated user is an active app administrator
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
      AND is_active = true
  );
$$;

-- Check if current authenticated user is a SUPER_ADMIN
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
      AND role = 'SUPER_ADMIN'
      AND is_active = true
  );
$$;

-- Verify admin permission granularly
CREATE OR REPLACE FUNCTION public.admin_has_permission(required_perm TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  admin_rec RECORD;
BEGIN
  SELECT * INTO admin_rec FROM public.admin_users
  WHERE user_id = auth.uid() AND is_active = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Super admin has all permissions
  IF admin_rec.role = 'SUPER_ADMIN' THEN
    RETURN true;
  END IF;

  -- Standard role-based checks
  IF admin_rec.role = 'ADMIN' AND required_perm NOT IN ('admins.manage', 'admins.delete') THEN
    RETURN true;
  END IF;

  IF admin_rec.role = 'CONTENT_MANAGER' AND required_perm IN ('dashboard.view', 'categories.view', 'categories.create', 'categories.edit', 'products.view', 'products.create', 'products.edit', 'products.delete', 'notifications.send', 'analytics.view') THEN
    RETURN true;
  END IF;

  IF admin_rec.role = 'SUPPORT' AND required_perm IN ('dashboard.view', 'users.view', 'users.block', 'users.unblock', 'households.view', 'invoices.view', 'notifications.send', 'audit.view') THEN
    RETURN true;
  END IF;

  IF admin_rec.role = 'READ_ONLY' AND (required_perm LIKE '%.view' OR required_perm = 'dashboard.view') THEN
    RETURN true;
  END IF;

  -- Check custom permissions array in JSONB
  IF admin_rec.custom_permissions IS NOT NULL AND admin_rec.custom_permissions ? required_perm THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Log an administrative audit action safely
CREATE OR REPLACE FUNCTION public.admin_log_action(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email TEXT;
  v_log_id UUID;
BEGIN
  SELECT email INTO v_admin_email FROM public.admin_users WHERE user_id = auth.uid();
  
  INSERT INTO public.admin_audit_logs (
    admin_user_id,
    admin_email,
    action,
    entity_type,
    entity_id,
    details,
    created_at
  ) VALUES (
    auth.uid(),
    COALESCE(v_admin_email, 'system'),
    p_action,
    p_entity_type,
    p_entity_id,
    p_details,
    NOW()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Secure Overview Stats RPC
CREATE OR REPLACE FUNCTION public.admin_get_overview_stats(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_total_users INT;
  v_active_users INT;
  v_new_users INT;
  v_blocked_users INT;
  v_total_households INT;
  v_total_missing_items INT;
  v_total_invoices INT;
  v_total_purchases_sum NUMERIC;
  v_total_categories INT;
  v_total_products INT;
  v_total_notifications INT;
  v_start TIMESTAMPTZ := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
  v_end TIMESTAMPTZ := COALESCE(p_end_date, NOW());
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  SELECT COUNT(*) INTO v_total_users FROM public.profiles;
  SELECT COUNT(*) INTO v_active_users FROM public.profiles WHERE is_active = true AND (is_blocked IS NULL OR is_blocked = false);
  SELECT COUNT(*) INTO v_new_users FROM public.profiles WHERE updated_at >= v_start AND updated_at <= v_end;
  SELECT COUNT(*) INTO v_blocked_users FROM public.profiles WHERE is_blocked = true;
  SELECT COUNT(*) INTO v_total_households FROM public.households;
  SELECT COUNT(*) INTO v_total_missing_items FROM public.missing_items;
  SELECT COUNT(*), COALESCE(SUM(total_price), 0) INTO v_total_invoices, v_total_purchases_sum FROM public.invoices;
  SELECT COUNT(*) INTO v_total_categories FROM public.global_categories WHERE is_active = true;
  SELECT COUNT(*) INTO v_total_products FROM public.products WHERE is_active = true;
  SELECT COUNT(*) INTO v_total_notifications FROM public.notifications;

  RETURN jsonb_build_object(
    'total_users', v_total_users,
    'active_users', v_active_users,
    'new_users', v_new_users,
    'blocked_users', v_blocked_users,
    'total_households', v_total_households,
    'total_missing_items', v_total_missing_items,
    'total_invoices', v_total_invoices,
    'total_purchases_sum', v_total_purchases_sum,
    'total_categories', v_total_categories,
    'total_products', v_total_products,
    'total_notifications', v_total_notifications,
    'generated_at', NOW()
  );
END;
$$;

-- Secure Block User RPC
CREATE OR REPLACE FUNCTION public.admin_block_user(
  p_target_user_id UUID,
  p_reason TEXT DEFAULT 'مخالفة شروط الاستخدام'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_has_permission('users.block') THEN
    RAISE EXCEPTION 'Access denied. Insufficient permissions to block user.';
  END IF;

  -- Prevent blocking another Super Admin
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = p_target_user_id AND role = 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Cannot block a Super Administrator.';
  END IF;

  UPDATE public.profiles
  SET 
    is_blocked = true,
    blocked_reason = p_reason,
    blocked_at = NOW(),
    blocked_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_target_user_id;

  -- Log action
  PERFORM public.admin_log_action(
    'USER_BLOCKED',
    'USER',
    p_target_user_id::TEXT,
    jsonb_build_object('reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'user_id', p_target_user_id, 'is_blocked', true);
END;
$$;

-- Secure Unblock User RPC
CREATE OR REPLACE FUNCTION public.admin_unblock_user(
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_has_permission('users.unblock') THEN
    RAISE EXCEPTION 'Access denied. Insufficient permissions to unblock user.';
  END IF;

  UPDATE public.profiles
  SET 
    is_blocked = false,
    blocked_reason = NULL,
    blocked_at = NULL,
    blocked_by = NULL,
    updated_at = NOW()
  WHERE id = p_target_user_id;

  -- Log action
  PERFORM public.admin_log_action(
    'USER_UNBLOCKED',
    'USER',
    p_target_user_id::TEXT,
    jsonb_build_object('unblocked_at', NOW())
  );

  RETURN jsonb_build_object('success', true, 'user_id', p_target_user_id, 'is_blocked', false);
END;
$$;

-- Secure Delete User RPC
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  p_target_user_id UUID,
  p_confirmation TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_has_permission('users.delete') THEN
    RAISE EXCEPTION 'Access denied. Insufficient permissions to delete users.';
  END IF;

  IF p_confirmation <> 'DELETE' THEN
    RAISE EXCEPTION 'Invalid confirmation token. You must provide DELETE.';
  END IF;

  -- Prevent deleting the last active Super Admin
  IF EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = p_target_user_id AND role = 'SUPER_ADMIN'
  ) AND (
    SELECT COUNT(*) FROM public.admin_users WHERE role = 'SUPER_ADMIN' AND is_active = true
  ) <= 1 THEN
    RAISE EXCEPTION 'Cannot delete the last active Super Administrator.';
  END IF;

  -- Log action before deletion
  PERFORM public.admin_log_action(
    'USER_DELETED',
    'USER',
    p_target_user_id::TEXT,
    jsonb_build_object('deleted_by', auth.uid())
  );

  -- Delete from profiles & admin_users
  DELETE FROM public.admin_users WHERE user_id = p_target_user_id;
  DELETE FROM public.household_members WHERE user_id = p_target_user_id;
  DELETE FROM public.profiles WHERE id = p_target_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', p_target_user_id);
END;
$$;

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) FOR NEW ADMIN TABLES
-- ==============================================================================
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_system_settings ENABLE ROW LEVEL SECURITY;

-- ADMIN_USERS: Admins can view; Super Admins can manage
CREATE POLICY "admin_users_select" ON public.admin_users
  FOR SELECT USING (public.is_app_admin() OR auth.uid() = user_id);

CREATE POLICY "admin_users_insert" ON public.admin_users
  FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY "admin_users_update" ON public.admin_users
  FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "admin_users_delete" ON public.admin_users
  FOR DELETE USING (public.is_super_admin());

-- GLOBAL_CATEGORIES: All authenticated users can read active categories; Admins can manage
CREATE POLICY "global_categories_select" ON public.global_categories
  FOR SELECT USING (is_active = true OR public.is_app_admin());

CREATE POLICY "global_categories_insert" ON public.global_categories
  FOR INSERT WITH CHECK (public.admin_has_permission('categories.create'));

CREATE POLICY "global_categories_update" ON public.global_categories
  FOR UPDATE USING (public.admin_has_permission('categories.edit'))
  WITH CHECK (public.admin_has_permission('categories.edit'));

CREATE POLICY "global_categories_delete" ON public.global_categories
  FOR DELETE USING (public.admin_has_permission('categories.delete'));

-- PRODUCTS: All authenticated users can read active products; Admins can manage
CREATE POLICY "products_select" ON public.products
  FOR SELECT USING (is_active = true OR public.is_app_admin());

CREATE POLICY "products_insert" ON public.products
  FOR INSERT WITH CHECK (public.admin_has_permission('products.create'));

CREATE POLICY "products_update" ON public.products
  FOR UPDATE USING (public.admin_has_permission('products.edit'))
  WITH CHECK (public.admin_has_permission('products.edit'));

CREATE POLICY "products_delete" ON public.products
  FOR DELETE USING (public.admin_has_permission('products.delete'));

-- AUDIT LOGS: Only Admins with audit.view can read; system functions insert
CREATE POLICY "admin_audit_logs_select" ON public.admin_audit_logs
  FOR SELECT USING (public.admin_has_permission('audit.view'));

CREATE POLICY "admin_audit_logs_insert" ON public.admin_audit_logs
  FOR INSERT WITH CHECK (public.is_app_admin());

-- ANNOUNCEMENTS: All users can read active; Admins can manage
CREATE POLICY "app_announcements_select" ON public.app_announcements
  FOR SELECT USING (is_active = true OR public.is_app_admin());

CREATE POLICY "app_announcements_insert" ON public.app_announcements
  FOR INSERT WITH CHECK (public.admin_has_permission('notifications.send'));

CREATE POLICY "app_announcements_update" ON public.app_announcements
  FOR UPDATE USING (public.admin_has_permission('notifications.send'))
  WITH CHECK (public.admin_has_permission('notifications.send'));

CREATE POLICY "app_announcements_delete" ON public.app_announcements
  FOR DELETE USING (public.admin_has_permission('notifications.send'));

-- SYSTEM SETTINGS: All can read; Admins can update
CREATE POLICY "app_system_settings_select" ON public.app_system_settings
  FOR SELECT USING (true);

CREATE POLICY "app_system_settings_all" ON public.app_system_settings
  FOR ALL USING (public.admin_has_permission('settings.manage'))
  WITH CHECK (public.admin_has_permission('settings.manage'));

-- ==============================================================================
-- 11. DEFAULT GLOBAL CATEGORIES SEED DATA (Centrally Managed Taxonomy)
-- ==============================================================================
INSERT INTO public.global_categories (id, name_ar, name_en, image_url, color, bg_light, badge_color, description, common_items, subcategories, sort_order)
VALUES
  (
    'supermarket',
    'سوبرماركت ومؤن',
    'Supermarket & Pantry',
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
    'emerald',
    'bg-emerald-50 text-emerald-800 border-emerald-200',
    'bg-emerald-100 text-emerald-800',
    'المواد الغذائية الأساسية، الألبان، الأجبان، الحبوب والمشروبات',
    '["حليب طازج (كامل الدسم)", "جبنة بيضاء", "جبنة موزاريلا", "بيض طازج (كرتونة)", "خبز بلدي / توست", "زيت طبخ (ذرة أو عباد)", "زيت زيتون بكر", "سكر أبيض", "شاي أسود", "قهوة مطحونة", "أرز مصري / بسمتي", "مكرونة مشكلة", "دقيق أبيض فاخر", "صلصة طماطم", "فول مدمس", "تونة معلبة", "شوفان", "عسل نحل طبيعي", "مربى فواكه", "بسكويت وسناكس", "مياه معدنية", "عصائر طبيعية"]'::jsonb,
    '[{"id":"dairy","nameAr":"ألبان وأجبان","nameEn":"Dairy & Cheese","items":["حليب طازج (كامل الدسم)","جبنة بيضاء","جبنة موزاريلا","زبادي طبيعي","زبدة فلاحي","لبنة","قشطة","بيض طازج (كرتونة)"]},{"id":"legumes","nameAr":"بقوليات وحبوب","nameEn":"Legumes & Grains","items":["أرز مصري / بسمتي","مكرونة مشكلة","فول مدمس","عدس أصفر / بجبة","شوفان","حمص","لوبيا / فاصوليا بيضاء","دقيق أبيض فاخر"]},{"id":"oils_sugars","nameAr":"زيوت وسكريات","nameEn":"Oils & Sugar","items":["زيت طبخ (ذرة أو عباد)","زيت زيتون بكر","سكر أبيض","سمن بلدي / نباتي","عسل نحل طبيعي","مربى فواكه"]},{"id":"canned_beverages","nameAr":"معلبات ومشروبات","nameEn":"Canned & Drinks","items":["صلصة طماطم","تونة معلبة","شاي أسود","قهوة مطحونة","مياه معدنية","عصائر طبيعية"]}]'::jsonb,
    1
  ),
  (
    'vegetables_fruits',
    'خضروات وفواكه',
    'Vegetables & Fruits',
    'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=800&q=80',
    'amber',
    'bg-amber-50 text-amber-800 border-amber-200',
    'bg-amber-100 text-amber-800',
    'الخضار الطازج، الفواكه الموسمية والورقيات الخضراء',
    '["طماطم طازجة (للسلطة والطبخ)", "خيار بلدي", "بصل أحمر / أبيض", "بطاطس تحمير وطبخ", "ليمون أصفر وأخضر", "ثوم طازج", "فلفل رومي وألوان", "فلفل حار", "كوسة طازجة", "باذنجان رومي / عروس", "جزر مسكر", "موز بلدي", "تفاح أحمر / سكري", "برتقال عصير / بصرة", "فراولة طازجة", "خس كابوتشا / بلدي", "بقدونس وكزبرة وشبت", "نعناع أخضر طازج"]'::jsonb,
    '[{"id":"fresh_veg","nameAr":"خضروات طازجة","nameEn":"Fresh Vegetables","items":["طماطم طازجة (للسلطة والطبخ)","خيار بلدي","بصل أحمر / أبيض","بطاطس تحمير وطبخ","ثوم طازج","فلفل رومي وألوان","فلفل حار","كوسة طازجة","باذنجان رومي / عروس","جزر مسكر"]},{"id":"fruits","nameAr":"فواكه طازجة","nameEn":"Fruits","items":["موز بلدي","تفاح أحمر / سكري","برتقال عصير / بصرة","فراولة طازجة","عنب","بطيخ / شمام"]},{"id":"herbs_greens","nameAr":"ورقيات وأعشاب","nameEn":"Greens & Herbs","items":["خس كابوتشا / بلدي","بقدونس وكزبرة وشبت","نعناع أخضر طازج","جرجير طازج","ملوخية خضراء"]}]'::jsonb,
    2
  ),
  (
    'meat_poultry',
    'اللحوم والدواجن',
    'Meat, Poultry & Fish',
    'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=800&q=80',
    'rose',
    'bg-rose-50 text-rose-800 border-rose-200',
    'bg-rose-100 text-rose-800',
    'اللحوم الحمراء، الدواجن الطازجة، الأسماك والبحريات',
    '["لحم مفروم قليل الدهن", "لحم مكعبات للخضار", "ستيك / بفتيك لحم بقر", "ريش ضاني / بتلو", "كبدة بلدي طازجة", "دجاج كامل طازج", "صدور دجاج فيليه (بانيه)", "أوراك دجاج طازجة", "أجنحة دجاج", "شاورما دجاج متبلة", "سمك بلطي طازج", "سمك بوري / فيليه قشر بياض", "جمبري مقشر / جامبو", "سبيط وكاليماري"]'::jsonb,
    '[{"id":"fresh_meat","nameAr":"لحوم حمراء","nameEn":"Meat","items":["لحم مفروم قليل الدهن","لحم مكعبات للخضار","ستيك / بفتيك لحم بقر","ريش ضاني / بتلو","كبدة بلدي طازجة","كفتة جاهزة للطبخ"]},{"id":"poultry","nameAr":"دواجن وطيور","nameEn":"Poultry","items":["دجاج كامل طازج","صدور دجاج فيليه (بانيه)","أوراك دجاج طازجة","شيش طاووق متبل","كبد وقوانص دجاج"]},{"id":"seafood","nameAr":"أسماك ومأكولات بحرية","nameEn":"Fish & Seafood","items":["سمك بلطي طازج","سمك بوري / فيليه قشر بياض","جمبري مقشر / جامبو","سبيط وكاليماري","سمك سلمون"]}]'::jsonb,
    3
  ),
  (
    'spices',
    'توابل وبهارات',
    'Spices & Herbs',
    'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
    'orange',
    'bg-orange-50 text-orange-800 border-orange-200',
    'bg-orange-100 text-orange-800',
    'البهارات الأساسية، الأعشاب المجففة والمكسرات والتسالي',
    '["ملح طعام ناعم وبحري", "فلفل أسود حب ومطحون", "كمون بلدي ناعم", "كزبرة جافة مطحونة", "قرفة خشب ومطحونة", "حبهان (هيل) حب", "بابريكا مدخنة / حلوة", "كاري وكركم مطحون", "بهارات لحمة وفراخ مشكلة", "ورق لورا (غار)", "زعتر بري مجفف", "زنجبيل مطحون", "قرنفل مسمار", "جوزة الطيب", "سماق حامض", "مكسرات مشكلة (لوز، جوز، فستق)", "سمسم وفول سوداني"]'::jsonb,
    '[{"id":"basic_spices","nameAr":"بهارات أساسية","nameEn":"Basic Spices","items":["ملح طعام ناعم وبحري","فلفل أسود حب ومطحون","كمون بلدي ناعم","كزبرة جافة مطحونة","قرفة خشب ومطحونة","حبهان (هيل) حب","بابريكا مدخنة / حلوة","كاري وكركم مطحون"]},{"id":"special_blends","nameAr":"خلطات وأعشاب","nameEn":"Herbs & Blends","items":["بهارات لحمة وفراخ مشكلة","ورق لورا (غار)","زعتر بري مجفف","زنجبيل مطحون","سماق حامض","جوزة الطيب"]},{"id":"nuts","nameAr":"مكسرات وتسالي","nameEn":"Nuts & Snacks","items":["مكسرات مشكلة (لوز، جوز، فستق)","سمسم وفول سوداني","زبيب وجوز هند"]}]'::jsonb,
    4
  ),
  (
    'home_essentials',
    'مستلزمات المنزل',
    'Home Essentials',
    'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=800&q=80',
    'indigo',
    'bg-indigo-50 text-indigo-800 border-indigo-200',
    'bg-indigo-100 text-indigo-800',
    'الورقيات، أدوات التغليف، الأكياس والمستهلكات المنزلية',
    '["مناديل مطبخ رول قوية", "مناديل جيب وسحب للصالون", "ورق ألومنيوم (قصدير) ثقيل", "أكياس حفظ طعام وساندوتشات", "ورق زبدة للفرن والخبز", "أكياس قمامة أحجام مختلفة", "بطاريات قلم AA و AAA", "لمبات ليد موفرة", "أكواب وأطباق ورقية", "أعواد خشبية وشوك"]'::jsonb,
    '[{"id":"paper_tissue","nameAr":"ورقيات ومناديل","nameEn":"Tissues & Paper","items":["مناديل مطبخ رول قوية","مناديل جيب وسحب للصالون","مناديل مبللة معقمة"]},{"id":"wrapping_bags","nameAr":"تغليف وأكياس","nameEn":"Bags & Foil","items":["ورق ألومنيوم (قصدير) ثقيل","أكياس حفظ طعام وساندوتشات","ورق زبدة للفرن والخبز","أكياس قمامة أحجام مختلفة","بلاستيك رول تغليف (استريتش)"]},{"id":"consumables","nameAr":"مستهلكات دورية","nameEn":"Consumables","items":["بطاريات قلم AA و AAA","لمبات ليد موفرة","أكواب وأطباق ورقية","أعواد كبريت وشموع"]}]'::jsonb,
    5
  ),
  (
    'cleaning',
    'المنظفات والعناية',
    'Cleaning Supplies',
    'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=800&q=80',
    'cyan',
    'bg-cyan-50 text-cyan-800 border-cyan-200',
    'bg-cyan-100 text-cyan-800',
    'منظفات الغسيل، سوائل الجلي، المعقمات والعناية الشخصية',
    '["مسحوق غسيل أوتوماتيك / جل", "منعم ومعطر ملابس", "سائل غسيل الأطباق والصحون", "إسفنج وسلك مواعين ستانلس", "سائل مبيض ومعقم (كلور)", "مطهر ومعقم أرضيات وأسطح", "معطر جو يدوي وأوتوماتيك", "ملمع زجاج ومرايا", "صابون سائل لليدين", "شامبو وشاور جل"]'::jsonb,
    '[{"id":"laundry","nameAr":"منظفات الغسيل","nameEn":"Laundry","items":["مسحوق غسيل أوتوماتيك / جل","منعم ومعطر ملابس","مزيل بقع الملابس"]},{"id":"dish_kitchen","nameAr":"تنظيف المطبخ","nameEn":"Kitchen Cleaning","items":["سائل غسيل الأطباق والصحون","إسفنج وسلك مواعين ستانلس","منظف دهون وشوايات"]},{"id":"disinfection_floor","nameAr":"تطهير وأرضيات","nameEn":"Floors & Air","items":["سائل مبيض ومعقم (كلور)","مطهر ومعقم أرضيات وأسطح (ديتول)","معطر جو يدوي وأوتوماتيك","ملمع زجاج ومرايا","أكياس سلة مهملات"]}]'::jsonb,
    6
  )
ON CONFLICT (id) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  image_url = EXCLUDED.image_url,
  description = EXCLUDED.description,
  common_items = EXCLUDED.common_items,
  subcategories = EXCLUDED.subcategories,
  sort_order = EXCLUDED.sort_order;

-- Default System Settings Seed
INSERT INTO public.app_system_settings (key, value, description)
VALUES
  ('app_name', '"طلبات البيت"'::jsonb, 'الاسم الرسمي للتطبيق'),
  ('maintenance_mode', 'false'::jsonb, 'تفعيل وضع الصيانة العام للمستخدمين'),
  ('allow_new_registrations', 'true'::jsonb, 'السماح بتسجيل حسابات جديدة'),
  ('max_household_members', '10'::jsonb, 'الحد الأقصى لعدد أفراد المنزل الواحد'),
  ('ai_grocery_parsing_enabled', 'true'::jsonb, 'تفعيل المساعد الذكي Gemini لاستخراج النواقص'),
  ('default_currency', '"ج.م"'::jsonb, 'العملة الافتراضية للنظام'),
  ('announcement_banner', '{"enabled": false, "message": ""}'::jsonb, 'رسالة التنبيه العلوية العامة')
ON CONFLICT (key) DO NOTHING;
