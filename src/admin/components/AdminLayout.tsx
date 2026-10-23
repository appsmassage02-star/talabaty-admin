import React, { useState, useMemo } from 'react';
import { useAdmin } from '../context/AdminContext';
import {
  ADMIN_MANAGEMENT_GROUPS,
  findNavGroupBySection,
} from '../config/adminNavigationConfig';
import {
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
  RefreshCw,
  LayoutDashboard,
  PackageCheck,
  HeartPulse,
  Bike,
  Search,
  Bell,
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const {
    adminUser,
    activeSection,
    setActiveSection,
    navigateToSection,
    adminSignOut,
    hasPermission,
    refreshStats,
    isStatsLoading,
    stats,
    headerAssetSrc,
  } = useAdmin();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [navSearchQuery, setNavSearchQuery] = useState('');
  const [headerImgError, setHeaderImgError] = useState(false);

  React.useEffect(() => {
    setHeaderImgError(false);
  }, [headerAssetSrc]);

  // Track collapsed state per management group (all expanded by default for instant access)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Compute live operational badge counts from real stats when available
  const sectionBadges = useMemo<Record<string, { count: number; tone: 'amber' | 'rose' | 'emerald' | 'sky' }>>(() => {
    if (!stats) return {};
    const badges: Record<string, { count: number; tone: 'amber' | 'rose' | 'emerald' | 'sky' }> = {};

    const pendingDelivery = stats.delivery_pending_review_orders ?? 0;
    if (pendingDelivery > 0) {
      badges['delivery_orders'] = { count: pendingDelivery, tone: 'amber' };
    }

    const pendingPharmacy = stats.pharmacy_pending_orders ?? 0;
    if (pendingPharmacy > 0) {
      badges['pharmacy_orders'] = { count: pendingPharmacy, tone: 'amber' };
    }

    const pendingDrivers = stats.delivery_pending_drivers ?? 0;
    if (pendingDrivers > 0) {
      badges['delivery_drivers'] = { count: pendingDrivers, tone: 'sky' };
    }

    const blockedUsers = stats.blocked_users ?? 0;
    if (blockedUsers > 0) {
      badges['users'] = { count: blockedUsers, tone: 'rose' };
    }

    const activeNotifications = stats.active_notifications_count ?? stats.total_notifications ?? 0;
    if (activeNotifications > 0) {
      badges['notifications'] = { count: activeNotifications, tone: 'emerald' };
    }

    const urgentTotal = pendingDelivery + pendingPharmacy + pendingDrivers;
    if (urgentTotal > 0) {
      badges['overview'] = { count: urgentTotal, tone: 'amber' };
    }

    return badges;
  }, [stats]);

  // Filter groups and items based on RBAC permissions and optional search inside menu
  const visibleGroups = useMemo(() => {
    const q = navSearchQuery.trim().toLowerCase();
    return ADMIN_MANAGEMENT_GROUPS.map((group) => {
      const allowedItems = group.items.filter((item) => {
        if (item.permission && !hasPermission(item.permission)) return false;
        if (!q) return true;
        return (
          item.label.toLowerCase().includes(q) ||
          group.titleAr.toLowerCase().includes(q) ||
          group.titleEn.toLowerCase().includes(q)
        );
      });
      return {
        ...group,
        items: allowedItems,
      };
    }).filter((group) => group.items.length > 0);
  }, [hasPermission, navSearchQuery]);

  const activeLocation = useMemo(
    () => findNavGroupBySection(activeSection),
    [activeSection]
  );

  const getRoleDisplayName = (r?: string) => {
    switch (r) {
      case 'SUPER_ADMIN':
        return 'مدير النظام الأعلى';
      case 'ADMIN':
        return 'مشرف عام';
      case 'CONTENT_MANAGER':
        return 'مدير محتوى';
      case 'SUPPORT':
        return 'دعم ومتابعة';
      default:
        return 'مشاهدة فقط';
    }
  };

  const getBadgeClasses = (tone: 'amber' | 'rose' | 'emerald' | 'sky', isActive: boolean) => {
    if (isActive) {
      return 'bg-slate-950/90 text-emerald-300 border border-slate-800';
    }
    switch (tone) {
      case 'amber':
        return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
      case 'rose':
        return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
      case 'sky':
        return 'bg-sky-500/20 text-sky-300 border border-sky-500/30';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-white pb-20 lg:pb-0"
      dir="rtl"
    >
      {/* Top Navbar — Optimized for Android WebView, Mobile & Desktop */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/90 px-3 sm:px-6 py-2.5 sm:py-3">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-2">
          {/* Right Side in RTL (Mobile Menu Trigger, Brand & Active Section Title) */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="فتح القائمة الجانبية"
              className="lg:hidden min-w-[42px] min-h-[42px] flex items-center justify-center rounded-2xl bg-slate-800/90 text-slate-200 hover:text-white active:scale-95 border border-slate-700/80 transition-all cursor-pointer shrink-0"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={() => navigateToSection('overview')}
              className="flex items-center gap-2.5 sm:gap-3 text-right cursor-pointer min-w-0"
            >
              {headerAssetSrc && !headerImgError ? (
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-950 border border-emerald-500/30 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                  <img
                    src={headerAssetSrc}
                    alt="طلبات البيت"
                    onError={() => setHeaderImgError(true)}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0">
                  ط
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-black text-sm sm:text-base text-white tracking-wide truncate">
                    طلبات البيت
                  </span>
                  <span className="hidden xs:inline text-xs text-slate-600">·</span>
                  <span className="hidden xs:inline text-[11px] sm:text-xs font-bold text-emerald-400 truncate">
                    مركز الإدارة
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                  <span className="hidden sm:inline truncate">
                    {activeLocation.group?.titleAr || 'مركز المتابعة'}
                  </span>
                  {activeLocation.item && (
                    <>
                      <ChevronLeft className="w-3 h-3 text-slate-600 hidden sm:inline shrink-0" />
                      <span className="text-slate-200 font-bold truncate">
                        {activeLocation.item.label}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </button>
          </div>

          {/* Left Side in RTL (Quick Actions, Notifications Shortcut & Admin Profile) */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Refresh Live Data Button (Visible on Mobile & Desktop) */}
            <button
              type="button"
              onClick={refreshStats}
              disabled={isStatsLoading}
              className="min-h-[40px] px-2.5 sm:px-3.5 py-1.5 bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl text-xs font-bold border border-slate-700/80 transition-all flex items-center gap-1.5 cursor-pointer"
              title="تحديث البيانات المباشرة"
            >
              <RefreshCw
                className={`w-4 h-4 text-emerald-400 shrink-0 ${
                  isStatsLoading ? 'animate-spin' : ''
                }`}
              />
              <span className="hidden md:inline">تحديث مباشر</span>
            </button>

            {/* Quick Notifications Access */}
            {hasPermission('notifications.send') && (
              <button
                type="button"
                onClick={() => navigateToSection('notifications')}
                className={`relative min-w-[40px] min-h-[40px] px-2.5 rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeSection === 'notifications'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title="سجل الإشعارات النشطة"
              >
                <Bell className="w-4 h-4" />
                {(stats?.active_notifications_count ?? stats?.total_notifications ?? 0) > 0 && (
                  <span className="text-[10px] font-black font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {stats?.active_notifications_count ?? stats?.total_notifications ?? 0}
                  </span>
                )}
              </button>
            )}

            {/* Admin Profile Pill */}
            <div className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-xs shrink-0">
                {adminUser?.full_name ? adminUser.full_name.charAt(0) : 'م'}
              </div>
              <div className="hidden sm:block text-right">
                <span className="text-xs font-bold text-white block truncate max-w-[130px]">
                  {adminUser?.full_name || adminUser?.email || 'المشرف'}
                </span>
                <span className="text-[10px] font-bold text-emerald-400 block">
                  {getRoleDisplayName(adminUser?.role)}
                </span>
              </div>
            </div>

            {/* Logout */}
            <button
              type="button"
              onClick={adminSignOut}
              className="min-h-[40px] px-2.5 sm:px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl text-xs font-bold border border-rose-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              title="تسجيل الخروج من لوحة التحكم"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content & Sidebar Container */}
      <div className="flex-1 flex max-w-[1440px] w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 gap-6">
        {/* Desktop & Large Tablet Sidebar */}
        <aside className="hidden lg:flex flex-col w-72 shrink-0 bg-slate-900/80 border border-slate-800/90 rounded-3xl p-4 space-y-4 self-start sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
          {/* Quick Filter inside Sidebar */}
          <div className="space-y-2.5 pb-3 border-b border-slate-800/80">
            <div className="flex items-center justify-between px-1">
              <div>
                <span className="text-xs font-black text-white block">أقسام الإدارة</span>
                <span className="text-[10px] text-slate-400">تنظيم تشغيلي سريع</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                {visibleGroups.length} مجموعات
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={navSearchQuery}
                onChange={(e) => setNavSearchQuery(e.target.value)}
                placeholder="ابحث عن قسم أو إدارة..."
                className="w-full bg-slate-950/90 border border-slate-800 focus:border-emerald-500/50 rounded-xl pr-8 pl-7 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
              {navSearchQuery && (
                <button
                  type="button"
                  onClick={() => setNavSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Operational Management Groups */}
          <nav className="space-y-3">
            {visibleGroups.map((group) => {
              const GroupIcon = group.groupIcon;
              const isGroupActive = group.items.some((it) => it.id === activeSection);
              const isCollapsed = Boolean(collapsedGroups[group.groupId]) && !navSearchQuery;

              return (
                <div
                  key={group.groupId}
                  className={`rounded-2xl border transition-colors ${
                    isGroupActive
                      ? 'bg-slate-950/80 border-emerald-500/30'
                      : 'bg-slate-950/35 border-slate-800/70 hover:border-slate-700/80'
                  }`}
                >
                  {/* Group Header */}
                  <button
                    type="button"
                    onClick={() => toggleGroupCollapse(group.groupId)}
                    className="w-full px-3 py-2.5 flex items-center justify-between text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                          isGroupActive
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                      >
                        <GroupIcon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span
                          className={`text-xs font-extrabold block truncate ${
                            isGroupActive ? 'text-white' : 'text-slate-200'
                          }`}
                        >
                          {group.titleAr}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {group.descriptionAr}
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 shrink-0 ${
                        isCollapsed ? 'rotate-90' : ''
                      }`}
                    />
                  </button>

                  {/* Sub-items */}
                  {!isCollapsed && (
                    <div className="px-2 pb-2 space-y-1 border-t border-slate-800/50 pt-1.5">
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        const isActive = activeSection === item.id;
                        const badge = sectionBadges[item.id];
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setActiveSection(item.id)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-colors text-right cursor-pointer ${
                              isActive
                                ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                                : 'text-slate-300 hover:text-white hover:bg-slate-800/70 font-semibold'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <ItemIcon
                                className={`w-4 h-4 shrink-0 ${
                                  isActive ? 'text-slate-950' : 'text-slate-400'
                                }`}
                              />
                              <span className="truncate">{item.label}</span>
                            </div>
                            {badge && badge.count > 0 && (
                              <span
                                className={`text-[10px] font-black font-mono px-1.5 py-0.5 rounded-lg shrink-0 ${getBadgeClasses(
                                  badge.tone,
                                  isActive
                                )}`}
                              >
                                {badge.count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Mobile & Tablet Slide-Over Navigation Drawer */}
        {isMobileMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 z-50 flex bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <div
              className="bg-slate-900 w-[320px] max-w-[88vw] h-full p-4 space-y-4 border-l border-slate-800 flex flex-col justify-between overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-4">
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <span className="font-black text-base text-white block">أقسام لوحة الإدارة</span>
                    <span className="text-xs text-slate-400">طلبات البيت — التنقل السريع</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Drawer Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={navSearchQuery}
                    onChange={(e) => setNavSearchQuery(e.target.value)}
                    placeholder="ابحث عن صفحة أو قسم..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl pr-9 pl-8 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                  />
                  {navSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setNavSearchQuery('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Drawer Groups */}
                <nav className="space-y-3">
                  {visibleGroups.map((group) => {
                    const GroupIcon = group.groupIcon;
                    const isGroupActive = group.items.some((it) => it.id === activeSection);
                    return (
                      <div
                        key={group.groupId}
                        className={`rounded-2xl border p-2.5 space-y-1.5 ${
                          isGroupActive
                            ? 'border-emerald-500/30 bg-slate-950/80'
                            : 'border-slate-800 bg-slate-950/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 px-1.5 py-1">
                          <GroupIcon
                            className={`w-4 h-4 shrink-0 ${
                              isGroupActive ? 'text-emerald-400' : 'text-slate-400'
                            }`}
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-extrabold text-white block truncate">
                              {group.titleAr}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {group.descriptionAr}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1 pt-1.5 border-t border-slate-800/60">
                          {group.items.map((item) => {
                            const ItemIcon = item.icon;
                            const isActive = activeSection === item.id;
                            const badge = sectionBadges[item.id];
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setActiveSection(item.id);
                                  setIsMobileMenuOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-colors text-right cursor-pointer ${
                                  isActive
                                    ? 'bg-emerald-500 text-slate-950 font-black'
                                    : 'text-slate-200 hover:text-white hover:bg-slate-800 font-semibold'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <ItemIcon
                                    className={`w-4 h-4 shrink-0 ${
                                      isActive ? 'text-slate-950' : 'text-slate-400'
                                    }`}
                                  />
                                  <span className="truncate">{item.label}</span>
                                </div>
                                {badge && badge.count > 0 && (
                                  <span
                                    className={`text-[10px] font-black font-mono px-2 py-0.5 rounded-lg shrink-0 ${getBadgeClasses(
                                      badge.tone,
                                      isActive
                                    )}`}
                                  >
                                    {badge.count}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-2">
                <div className="px-2 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 truncate">
                    {adminUser?.full_name || adminUser?.email || 'المشرف'}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400">
                    {getRoleDisplayName(adminUser?.role)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={adminSignOut}
                  className="w-full py-3 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-rose-500/20 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Mobile Bottom Quick-Access Bar (Android Phone First) */}
      <nav
        aria-label="التنقل السريع للهاتف"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl"
      >
        <button
          type="button"
          onClick={() => navigateToSection('overview')}
          className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors min-w-[60px] cursor-pointer ${
            activeSection === 'overview'
              ? 'text-emerald-400 font-black'
              : 'text-slate-400 hover:text-slate-200 font-semibold'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] mt-1">المهام</span>
          {sectionBadges['overview'] && sectionBadges['overview'].count > 0 && (
            <span className="absolute top-0.5 right-2 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black font-mono flex items-center justify-center">
              {sectionBadges['overview'].count}
            </span>
          )}
        </button>

        {hasPermission('delivery.view') && (
          <button
            type="button"
            onClick={() => navigateToSection('delivery_orders')}
            className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors min-w-[60px] cursor-pointer ${
              activeSection === 'delivery_orders'
                ? 'text-emerald-400 font-black'
                : 'text-slate-400 hover:text-slate-200 font-semibold'
            }`}
          >
            <PackageCheck className="w-5 h-5" />
            <span className="text-[10px] mt-1">الدليفري</span>
            {sectionBadges['delivery_orders'] && sectionBadges['delivery_orders'].count > 0 && (
              <span className="absolute top-0.5 right-2 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black font-mono flex items-center justify-center">
                {sectionBadges['delivery_orders'].count}
              </span>
            )}
          </button>
        )}

        {hasPermission('delivery.view') && (
          <button
            type="button"
            onClick={() => navigateToSection('pharmacy_orders')}
            className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors min-w-[60px] cursor-pointer ${
              activeSection.startsWith('pharmacy_')
                ? 'text-emerald-400 font-black'
                : 'text-slate-400 hover:text-slate-200 font-semibold'
            }`}
          >
            <HeartPulse className="w-5 h-5" />
            <span className="text-[10px] mt-1">الصيدلية</span>
            {sectionBadges['pharmacy_orders'] && sectionBadges['pharmacy_orders'].count > 0 && (
              <span className="absolute top-0.5 right-2 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black font-mono flex items-center justify-center">
                {sectionBadges['pharmacy_orders'].count}
              </span>
            )}
          </button>
        )}

        {hasPermission('delivery.view') && (
          <button
            type="button"
            onClick={() => navigateToSection('delivery_drivers')}
            className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors min-w-[60px] cursor-pointer ${
              activeSection === 'delivery_drivers'
                ? 'text-emerald-400 font-black'
                : 'text-slate-400 hover:text-slate-200 font-semibold'
            }`}
          >
            <Bike className="w-5 h-5" />
            <span className="text-[10px] mt-1">السائقون</span>
            {sectionBadges['delivery_drivers'] && sectionBadges['delivery_drivers'].count > 0 && (
              <span className="absolute top-0.5 right-2 min-w-[16px] h-4 px-1 rounded-full bg-sky-500 text-slate-950 text-[9px] font-black font-mono flex items-center justify-center">
                {sectionBadges['delivery_drivers'].count}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors min-w-[60px] cursor-pointer ${
            isMobileMenuOpen
              ? 'text-emerald-400 font-black'
              : 'text-slate-400 hover:text-slate-200 font-semibold'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-1">الأقسام</span>
        </button>
      </nav>
    </div>
  );
};
