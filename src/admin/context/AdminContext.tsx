import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { adminService } from '../services/adminService';
import {
  getConfirmedLocalAssetSync,
  getLatestConfirmedLocalAsset,
  initAppAssetBackgroundSync,
  subscribeToConfirmedAssets,
  syncAdminAssetsInBackground,
} from '../services/appAssetCacheService';
import {
  AdminUser,
  AdminRole,
  AdminPermission,
  AdminOverviewStats,
  AdminDateFilter,
  LocalConfirmedAppAsset,
  AdminSectionFilter,
} from '../types';

const CACHED_ADMIN_USER_KEY = 'talabat_admin_cached_session_user';

interface AdminContextType {
  // Auth & Admin Verification
  isAdminLoading: boolean;
  isAdminAuthenticated: boolean;
  adminUser: AdminUser | null;
  adminRole: AdminRole;
  hasPermission: (permission: AdminPermission) => boolean;
  adminAuthError: string | null;
  adminSignIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  adminSignOut: () => Promise<void>;

  // Navigation
  activeSection: string;
  setActiveSection: (section: string) => void;
  sectionFilter: AdminSectionFilter | null;
  navigateToSection: (section: string, filter?: AdminSectionFilter) => void;
  clearSectionFilter: () => void;
  dateFilter: AdminDateFilter;
  setDateFilter: (filter: AdminDateFilter) => void;
  customStartDate: string;
  setCustomStartDate: (date: string) => void;
  customEndDate: string;
  setCustomEndDate: (date: string) => void;

  // Stats & Real-time
  stats: AdminOverviewStats | null;
  isStatsLoading: boolean;
  statsError: string | null;
  refreshStats: () => Promise<void>;

  // Global Toast Feedback
  toastMessage: { text: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;

  // Search & Filters
  globalSearch: string;
  setGlobalSearch: (q: string) => void;

  // View Switcher (Between Admin Dashboard and Main App)
  viewMode: 'admin_control' | 'client_app';
  setViewMode: (mode: 'admin_control' | 'client_app') => void;

  // Theme & Layout
  adminTheme: 'dark' | 'light';
  setAdminTheme: (theme: 'dark' | 'light') => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (c: boolean | ((prev: boolean) => boolean)) => void;

  // App Assets (admin/header & admin/splash)
  headerAsset: LocalConfirmedAppAsset | null;
  splashAsset: LocalConfirmedAppAsset | null;
  headerAssetSrc: string | null;
  splashAssetSrc: string | null;
  refreshAppAssets: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdminLoading, setIsAdminLoading] = useState(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminRole, setAdminRole] = useState<AdminRole>('READ_ONLY');
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState('overview');
  const [sectionFilter, setSectionFilter] = useState<AdminSectionFilter | null>(null);
  const [dateFilter, setDateFilter] = useState<AdminDateFilter>('last_30_days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const navigateToSection = useCallback((section: string, filter?: AdminSectionFilter) => {
    if (filter) {
      setSectionFilter({ ...filter, timestamp: Date.now() });
    } else {
      setSectionFilter(null);
    }
    setActiveSection(section);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const clearSectionFilter = useCallback(() => {
    setSectionFilter(null);
  }, []);

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [viewMode, setViewMode] = useState<'admin_control' | 'client_app'>('admin_control');
  const [adminTheme, setAdminTheme] = useState<'dark' | 'light'>('dark');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Synchronously initialize from confirmed local assets at startup (never blocks on network)
  const [headerAsset, setHeaderAsset] = useState<LocalConfirmedAppAsset | null>(() =>
    getConfirmedLocalAssetSync('header')
  );
  const [splashAsset] = useState<LocalConfirmedAppAsset | null>(() =>
    getConfirmedLocalAssetSync('splash')
  );

  // Start background asset sync & subscribe to runtime header updates
  useEffect(() => {
    initAppAssetBackgroundSync();
    const unsubscribe = subscribeToConfirmedAssets((assetType, updatedAsset) => {
      if (assetType === 'header') {
        setHeaderAsset(updatedAsset);
      }
      // Note: Splash updates are saved to confirmed local storage and applied on the NEXT startup
    });
    return unsubscribe;
  }, []);

  const refreshAppAssets = useCallback(async () => {
    await syncAdminAssetsInBackground();
    const latestHeader = getLatestConfirmedLocalAsset('header');
    if (latestHeader) {
      setHeaderAsset({ ...latestHeader });
    }
  }, []);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  }, []);

  // Permission Check Logic
  const hasPermission = useCallback((permission: AdminPermission): boolean => {
    if (!adminUser) return false;
    if (adminUser.role === 'SUPER_ADMIN') return true;

    if (adminUser.role === 'ADMIN') {
      return permission !== 'admins.delete' && permission !== 'admins.manage';
    }

    if (adminUser.role === 'CONTENT_MANAGER') {
      return (
        permission.startsWith('categories.') ||
        permission.startsWith('products.') ||
        permission.startsWith('restaurants.') ||
        permission === 'notifications.send' ||
        permission === 'dashboard.view' ||
        permission === 'analytics.view'
      );
    }

    if (adminUser.role === 'SUPPORT') {
      return (
        permission === 'dashboard.view' ||
        permission.startsWith('users.') ||
        permission.startsWith('delivery.') ||
        permission.startsWith('restaurants.') ||
        permission === 'households.view' ||
        permission === 'invoices.view' ||
        permission === 'audit.view' ||
        permission === 'notifications.send'
      );
    }

    if (adminUser.role === 'READ_ONLY') {
      return permission.endsWith('.view') || permission === 'dashboard.view';
    }

    if (adminUser.custom_permissions && adminUser.custom_permissions.includes(permission)) {
      return true;
    }

    return false;
  }, [adminUser]);

  // Verify Session & Role (with offline fallback so opening offline never blocks or crashes)
  const verifyAdminSession = useCallback(async () => {
    const restoreCachedOfflineAdmin = (): boolean => {
      try {
        const cachedRaw = window.localStorage.getItem(CACHED_ADMIN_USER_KEY);
        if (cachedRaw) {
          const cachedAdmin = JSON.parse(cachedRaw) as AdminUser;
          if (cachedAdmin && cachedAdmin.id && cachedAdmin.is_active) {
            setIsAdminAuthenticated(true);
            setAdminUser(cachedAdmin);
            setAdminRole(cachedAdmin.role);
            setAdminAuthError(null);
            setIsAdminLoading(false);
            return true;
          }
        }
      } catch {}
      return false;
    };

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (restoreCachedOfflineAdmin()) return;
      setIsAdminLoading(false);
      return;
    }

    if (!supabase || !isSupabaseConfigured) {
      if (restoreCachedOfflineAdmin()) return;
      setIsAdminLoading(false);
      setAdminAuthError('Supabase configuration is missing or invalid.');
      return;
    }

    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData?.session?.user) {
        setIsAdminAuthenticated(false);
        setAdminUser(null);
        setIsAdminLoading(false);
        return;
      }

      const userId = sessionData.session.user.id;
      const { isAdmin, adminRecord, error: checkErr } = await adminService.checkAdminStatus(userId);

      if (isAdmin && adminRecord) {
        setIsAdminAuthenticated(true);
        setAdminUser(adminRecord);
        setAdminRole(adminRecord.role);
        setAdminAuthError(null);
        try {
          window.localStorage.setItem(CACHED_ADMIN_USER_KEY, JSON.stringify(adminRecord));
        } catch {}
        // Trigger non-blocking background sync once authenticated
        syncAdminAssetsInBackground().catch(() => {});
      } else {
        // If check failed due to network error while a cached admin exists for this user, preserve offline access
        if (checkErr && restoreCachedOfflineAdmin()) {
          return;
        }
        setIsAdminAuthenticated(false);
        setAdminUser(null);
        if (checkErr) {
          setAdminAuthError(checkErr);
        }
      }
    } catch (e: any) {
      console.warn('Session verification exception:', e);
      if (restoreCachedOfflineAdmin()) return;
      setIsAdminAuthenticated(false);
      setAdminUser(null);
    } finally {
      setIsAdminLoading(false);
    }
  }, []);

  // Stats Loader
  const refreshStats = useCallback(async () => {
    setIsStatsLoading(true);
    setStatsError(null);
    try {
      let start: string | undefined;
      let end: string | undefined;
      const now = new Date();

      if (dateFilter === 'today') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      } else if (dateFilter === 'yesterday') {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        start = new Date(y.getFullYear(), y.getMonth(), y.getDate()).toISOString();
        end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59).toISOString();
      } else if (dateFilter === 'last_7_days') {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        start = d.toISOString();
      } else if (dateFilter === 'last_30_days') {
        const d = new Date(now);
        d.setDate(d.getDate() - 30);
        start = d.toISOString();
      } else if (dateFilter === 'this_month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      } else if (dateFilter === 'last_month') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
      } else if (dateFilter === 'custom' && customStartDate) {
        start = new Date(customStartDate).toISOString();
        if (customEndDate) {
          end = new Date(customEndDate).toISOString();
        }
      }

      const res = await adminService.getOverviewStats(start, end);
      if (res) {
        setStats(res);
        setStatsError(null);
      } else {
        setStatsError('تعذر جلب المؤشرات العامة من قاعدة البيانات');
      }
    } catch (e: any) {
      console.warn('Failed to load admin stats:', e);
      setStatsError(e?.message || 'حدث خطأ أثناء تحميل الإحصائيات');
    } finally {
      setIsStatsLoading(false);
    }
  }, [dateFilter, customStartDate, customEndDate]);

  // Auth Lifecycle Hook
  useEffect(() => {
    verifyAdminSession();

    if (!supabase) return;
    const { data: listener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        await verifyAdminSession();
      } else if (event === 'SIGNED_OUT') {
        setIsAdminAuthenticated(false);
        setAdminUser(null);
      }
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, [verifyAdminSession]);

  // Auto-refresh stats when authenticated & dateFilter changes
  useEffect(() => {
    if (isAdminAuthenticated) {
      refreshStats();
    }
  }, [isAdminAuthenticated, refreshStats]);

  // Admin Login Action
  const adminSignIn = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    if (!supabase || !isSupabaseConfigured) {
      const msg = 'Supabase configuration is missing or invalid.';
      setAdminAuthError(msg);
      return { success: false, error: msg };
    }

    setIsAdminLoading(true);
    setAdminAuthError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });

      if (error) {
        setIsAdminLoading(false);
        setAdminAuthError(error.message);
        return { success: false, error: error.message };
      }

      if (!data?.user) {
        setIsAdminLoading(false);
        return { success: false, error: 'لم يتم العثور على الحساب' };
      }

      // Check admin status
      const { isAdmin, adminRecord, error: checkErr } = await adminService.checkAdminStatus(data.user.id);

      if (isAdmin && adminRecord) {
        setIsAdminAuthenticated(true);
        setAdminUser(adminRecord);
        setAdminRole(adminRecord.role);
        setIsAdminLoading(false);
        try {
          window.localStorage.setItem(CACHED_ADMIN_USER_KEY, JSON.stringify(adminRecord));
        } catch {}
        syncAdminAssetsInBackground().catch(() => {});
        showToast(`مرحباً بك، ${adminRecord.full_name || adminRecord.email}!`, 'success');
        return { success: true };
      } else {
        // Sign out if not an admin
        await supabase.auth.signOut();
        setIsAdminAuthenticated(false);
        setAdminUser(null);
        setIsAdminLoading(false);
        const errMsg = checkErr || 'عذراً! هذا الحساب لا يمتلك صلاحيات المشرفين للدخول إلى لوحة التحكم.';
        setAdminAuthError(errMsg);
        return { success: false, error: errMsg };
      }
    } catch (err: any) {
      setIsAdminLoading(false);
      setAdminAuthError(err?.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول');
      return { success: false, error: err?.message };
    }
  };

  // Admin Logout Action
  const adminSignOut = async () => {
    try {
      window.localStorage.removeItem(CACHED_ADMIN_USER_KEY);
    } catch {}
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.warn('Sign out error:', e);
    }
    setIsAdminAuthenticated(false);
    setAdminUser(null);
    showToast('تم تسجيل الخروج بنجاح', 'info');
  };

  const headerAssetSrc = headerAsset?.local_data_url || headerAsset?.public_url || null;
  const splashAssetSrc = splashAsset?.local_data_url || splashAsset?.public_url || null;

  return (
    <AdminContext.Provider
      value={{
        isAdminLoading,
        isAdminAuthenticated,
        adminUser,
        adminRole,
        hasPermission,
        adminAuthError,
        adminSignIn,
        adminSignOut,
        activeSection,
        setActiveSection,
        sectionFilter,
        navigateToSection,
        clearSectionFilter,
        dateFilter,
        setDateFilter,
        customStartDate,
        setCustomStartDate,
        customEndDate,
        setCustomEndDate,
        stats,
        isStatsLoading,
        statsError,
        refreshStats,
        toastMessage,
        showToast,
        globalSearch,
        setGlobalSearch,
        viewMode,
        setViewMode,
        adminTheme,
        setAdminTheme,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        headerAsset,
        splashAsset,
        headerAssetSrc,
        splashAssetSrc,
        refreshAppAssets,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
