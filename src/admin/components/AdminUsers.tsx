import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../context/AdminContext';
import { adminService } from '../services/adminService';
import { AdminUserProfile, UserAccountStatus } from '../types';
import { exportToCSV } from '../utils/exportUtils';
import {
  Users,
  Search,
  UserCheck,
  UserX,
  ShieldCheck,
  Smartphone,
  Building,
  ClipboardList,
  Receipt,
  MoreVertical,
  Trash2,
  Lock,
  Unlock,
  ShieldAlert,
  Eye,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
  Phone,
  Mail,
  Calendar,
  KeyRound,
  Filter,
} from 'lucide-react';

export const AdminUsers: React.FC = () => {
  const { hasPermission, showToast, sectionFilter, clearSectionFilter } = useAdmin();

  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState<string>(() => sectionFilter?.search || '');
  const [statusFilter, setStatusFilter] = useState<string>(() => sectionFilter?.status || 'all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!sectionFilter) return;
    if (sectionFilter.status !== undefined) {
      setStatusFilter(sectionFilter.status);
    }
    if (sectionFilter.search !== undefined) {
      setSearchQuery(sectionFilter.search);
    }
    setPage(1);
    clearSectionFilter();
  }, [sectionFilter, clearSectionFilter]);
  const pageSize = 20;

  // Selected user for Detail Modal
  const [selectedUser, setSelectedUser] = useState<AdminUserProfile | null>(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Block Modal
  const [userToBlock, setUserToBlock] = useState<AdminUserProfile | null>(null);
  const [blockReason, setBlockReason] = useState('مخالفة شروط الاستخدام');
  const [isBlocking, setIsBlocking] = useState(false);

  // Delete Modal
  const [userToDelete, setUserToDelete] = useState<AdminUserProfile | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminService.getUsers({
        search: searchQuery,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        page,
        pageSize,
      });
      setUsers(res.users);
      setTotalCount(res.total);
    } catch (e) {
      console.warn('Failed to load users:', e);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, roleFilter, page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Open user details
  const handleOpenDetails = async (user: AdminUserProfile) => {
    setSelectedUser(user);
    setIsLoadingDetails(true);
    try {
      const details = await adminService.getUserDetails(user.id);
      setSelectedUserDetails(details);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Confirm Block
  const handleConfirmBlock = async () => {
    if (!userToBlock) return;
    setIsBlocking(true);
    try {
      const res = await adminService.blockUser(userToBlock.id, blockReason);
      if (res.success) {
        showToast(`تم حظر حساب ${userToBlock.full_name || userToBlock.email} بنجاح`, 'success');
        setUserToBlock(null);
        loadUsers();
      } else {
        showToast(res.error || 'فشل حظر المستخدم', 'error');
      }
    } finally {
      setIsBlocking(false);
    }
  };

  // Confirm Unblock
  const handleUnblock = async (user: AdminUserProfile) => {
    try {
      const res = await adminService.unblockUser(user.id);
      if (res.success) {
        showToast(`تم إلغاء حظر حساب ${user.full_name || user.email}`, 'success');
        loadUsers();
      } else {
        showToast(res.error || 'فشل إلغاء الحظر', 'error');
      }
    } catch (e: any) {
      showToast(e?.message || 'حدث خطأ', 'error');
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!userToDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await adminService.deleteUserAccount(userToDelete.id);
      if (res.success && res.profileDeleted) {
        if (res.authDeleted) {
          showToast(
            `تم حذف حساب المستخدم (${userToDelete.full_name || userToDelete.email}) بالكامل من profiles و auth.users مع الاحتفاظ بالسجلات التاريخية`,
            'success'
          );
        } else {
          showToast(
            res.authWarning ||
              `تم حذف سجل المستخدم (${userToDelete.full_name || userToDelete.email}) من جدول profiles فعليًا. حذف auth.users يحتاج إلى مسار Backend / Edge Function آمن.`,
            'info'
          );
        }
        if (selectedUser?.id === userToDelete.id) {
          setSelectedUser(null);
        }
        setUserToDelete(null);
        setDeleteError(null);
        await loadUsers();
      } else {
        const errMsg = res.error || 'فشل حذف حساب المستخدم';
        setDeleteError(errMsg);
        showToast(errMsg, 'error');
      }
    } catch (err: any) {
      const errMsg = err?.message || 'حدث خطأ أثناء حذف حساب المستخدم';
      setDeleteError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export Users to CSV
  const handleExport = () => {
    exportToCSV('users_export', users);
  };

  const getStatusBadge = (status: UserAccountStatus, isBlocked?: boolean) => {
    if (isBlocked) {
      return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">محظور</span>;
    }
    switch (status) {
      case 'active':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">نشط</span>;
      case 'admin':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">مشرف</span>;
      case 'unlinked':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">غير مرتبط بمنزل</span>;
      case 'incomplete':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">غير مكتمل</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">مستخدم</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Quick Action Bar */}
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <h2 className="text-lg font-bold text-white">إدارة المستخدمين</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                {totalCount} مستخدم
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">البحث، التحقق من الحسابات، الحظر، وفحص المنازل المرتبطة.</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 space-x-reverse">
          <button
            type="button"
            onClick={handleExport}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center space-x-1.5 space-x-reverse cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>تصدير CSV</span>
          </button>
          <button
            type="button"
            onClick={loadUsers}
            disabled={isLoading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors cursor-pointer"
            title="إعادة تحميل"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-6 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم، البريد الإلكتروني، الهاتف، أو User ID..."
              className="w-full pl-3 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-3 text-xs text-slate-500 hover:text-slate-300"
              >
                مسح
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="all">كافة الحالات</option>
              <option value="active">نشط (Active)</option>
              <option value="blocked">محظور (Blocked)</option>
            </select>
          </div>

          {/* Role Filter */}
          <div className="sm:col-span-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="all">كافة الأدوار</option>
              <option value="admin">مشرف أسرة (Admin)</option>
              <option value="guest">مستخدم عادي (User)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table / Cards */}
      <div className="bg-slate-900/90 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-bold">جاري تحميل قائمة المستخدمين من جدول profiles...</p>
          </div>
        ) : users.length === 0 ? (
          searchQuery || statusFilter !== 'all' || roleFilter !== 'all' ? (
            <div className="py-16 text-center space-y-3">
              <Users className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-white">لم يتم العثور على أي مستخدم يطابق البحث</h3>
              <p className="text-xs text-slate-500">جرب تعديل كلمات البحث أو الفلاتر أعلاه.</p>
            </div>
          ) : (
            <div className="py-12 px-6 max-w-xl mx-auto text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mx-auto">
                <Users className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">لا توجد حسابات مستخدمين مسجلة بعد</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  يتم استرداد المستخدمين مباشرة من جدول <code className="text-emerald-400 font-mono bg-slate-950 px-1.5 py-0.5 rounded">public.profiles</code> (مع استبعاد حسابات الإدارة).
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-right space-y-2.5 text-xs">
                <div className="flex items-center space-x-2 space-x-reverse text-amber-400 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>تنبيه سياسات الأمان (RLS) في Supabase:</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  إذا كان هناك مستخدمون في جدول <code className="font-mono text-emerald-300">profiles</code> في لوحة Supabase ولا يظهرون هنا، فإن سياسة الأمان الافتراضية تقصر القراءة على صاحب الحساب نفسه فقط. لتفعيل قراءة المشرفين لكافة المستخدمين، نفذ هذا الأمر في Supabase SQL Editor:
                </p>
                <div className="relative group">
                  <pre className="p-3 bg-slate-900 rounded-xl font-mono text-[11px] text-emerald-300 overflow-x-auto text-left ltr border border-slate-800">
                    CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (true);
                  </pre>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (true);');
                      showToast('تم نسخ أمر SQL للحافظة بنجاح', 'success');
                    }}
                    className="mt-2 w-full py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 space-x-reverse cursor-pointer"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>نسخ أمر SQL إلى الحافظة</span>
                  </button>
                </div>
              </div>
            </div>
          )
        ) : (
          <div>
            {/* Mobile Responsive Cards (< md) */}
            <div className="md:hidden divide-y divide-slate-800/70">
              {users.map((user) => (
                <div key={user.id} className="p-4 space-y-3.5 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3 space-x-reverse min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm">
                        {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-white text-sm block truncate">
                          {user.full_name || 'بدون اسم'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono truncate block">
                          {user.email}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {getStatusBadge(user.status, user.is_blocked)}
                      <span className="text-[10px] text-slate-400 font-bold">
                        {user.role === 'admin' ? 'مشرف أسرة' : 'مستخدم عادي'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">رقم الهاتف</span>
                      <span className="font-mono text-slate-200 font-bold">{user.phone || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">تاريخ التسجيل</span>
                      <span className="font-mono text-slate-300">
                        {new Date(user.created_at).toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="text-slate-500 text-[10px]">المعرف (ID):</span>
                      <span className="font-mono text-[10px] text-slate-400 truncate max-w-[200px]">
                        {user.id}
                      </span>
                    </div>
                  </div>

                  {/* Mobile Card Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenDetails(user)}
                      className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 space-x-reverse cursor-pointer border border-slate-700"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-400" />
                      <span>التفاصيل</span>
                    </button>

                    {user.is_blocked ? (
                      <button
                        type="button"
                        onClick={() => handleUnblock(user)}
                        className="flex-1 py-2 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-1.5 space-x-reverse"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>إلغاء الحظر</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setUserToBlock(user)}
                        className="flex-1 py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-1.5 space-x-reverse"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>حظر</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => {
                        if (isDeleting) return;
                        setDeleteError(null);
                        setUserToDelete(user);
                      }}
                      className="py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center"
                      title="حذف الحساب"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold">
                  <tr>
                    <th className="p-4">المستخدم</th>
                    <th className="p-4">البريد الإلكتروني</th>
                    <th className="p-4">الهاتف</th>
                    <th className="p-4">الحالة</th>
                    <th className="p-4">الدور</th>
                    <th className="p-4">تاريخ التسجيل</th>
                    <th className="p-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center space-x-3 space-x-reverse">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-xs shrink-0">
                            {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-white block truncate">{user.full_name || 'بدون اسم'}</span>
                            <span className="text-[10px] text-slate-500 font-mono truncate block max-w-[120px]">
                              {user.id}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-slate-300">{user.email}</td>
                      <td className="p-4 font-mono text-slate-400">{user.phone || '—'}</td>
                      <td className="p-4">{getStatusBadge(user.status, user.is_blocked)}</td>
                      <td className="p-4">
                        <span className="text-slate-300 font-medium">
                          {user.role === 'admin' ? 'مشرف أسرة' : 'مستخدم عادي'}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-slate-400">
                        {new Date(user.created_at).toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center space-x-2 space-x-reverse">
                          {/* View Details Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(user)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                            title="عرض تفاصيل المستخدم"
                          >
                            <Eye className="w-4 h-4 text-blue-400" />
                          </button>

                          {/* Explicit Block / Unblock Action Button */}
                          {user.is_blocked ? (
                            <button
                              type="button"
                              onClick={() => handleUnblock(user)}
                              className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 space-x-reverse shadow-sm"
                              title="إلغاء حظر المستخدم وإعادة تفعيل الحساب"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              <span>إلغاء الحظر</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setUserToBlock(user)}
                              className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 space-x-reverse shadow-sm"
                              title="حظر المستخدم وتعطيل وصوله للنظام"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>حظر</span>
                            </button>
                          )}

                          {/* Explicit Delete Account Button */}
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => {
                              if (isDeleting) return;
                              setDeleteError(null);
                              setUserToDelete(user);
                            }}
                            className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 space-x-reverse shadow-sm"
                            title="حذف الحساب"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف الحساب</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalCount > pageSize && (
              <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-slate-400 font-medium">
                  عرض <span className="font-bold text-white">{(page - 1) * pageSize + 1}</span> إلى{' '}
                  <span className="font-bold text-white">{Math.min(page * pageSize, totalCount)}</span> من{' '}
                  <span className="font-bold text-emerald-400">{totalCount}</span> مستخدم
                </div>

                <div className="flex items-center space-x-2 space-x-reverse">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 rounded-xl font-bold transition-colors cursor-pointer"
                  >
                    السابق
                  </button>

                  <div className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-xl font-mono text-slate-300">
                    صفحة {page} من {Math.ceil(totalCount / pageSize) || 1}
                  </div>

                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(prev + 1, Math.ceil(totalCount / pageSize) || 1))}
                    disabled={page >= Math.ceil(totalCount / pageSize)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 rounded-xl font-bold transition-colors cursor-pointer"
                  >
                    التالي
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 1. USER DETAILS MODAL (Mobile Bottom Sheet / Desktop Modal)        */}
      {/* =================================================================== */}
      {selectedUser && (
        <div
          onClick={() => setSelectedUser(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full border-t sm:border border-slate-800 shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 text-right text-white"
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            {/* Sticky Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 shrink-0 bg-slate-900/95">
              <div className="flex items-center space-x-3 space-x-reverse min-w-0">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-lg shrink-0">
                  {selectedUser.full_name ? selectedUser.full_name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-y-1">
                    <h3 className="text-sm sm:text-base font-bold text-white truncate">
                      {selectedUser.full_name || 'بدون اسم'}
                    </h3>
                    {getStatusBadge(selectedUser.status, selectedUser.is_blocked)}
                  </div>
                  <span className="text-xs text-slate-400 font-mono block truncate">{selectedUser.email}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-4">
              {isLoadingDetails ? (
                <div className="py-12 text-center">
                  <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
                  <span className="text-xs text-slate-400 mt-2 block">جاري تحميل سجلات المستخدم...</span>
                </div>
              ) : (
                <>
                  {/* Profile Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                      <span className="text-[10px] text-slate-500 block mb-1">User ID</span>
                      <span className="font-mono text-slate-300 break-all">{selectedUser.id}</span>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                      <span className="text-[10px] text-slate-500 block mb-1">رقم الهاتف</span>
                      <span className="font-mono text-slate-300">{selectedUser.phone || 'غير محدد'}</span>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                      <span className="text-[10px] text-slate-500 block mb-1">تاريخ التسجيل</span>
                      <span className="font-mono text-slate-300">
                        {new Date(selectedUser.created_at).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                  </div>

                  {/* Block status detail if blocked */}
                  {selectedUser.is_blocked && (
                    <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs space-y-1 text-rose-300">
                      <div className="flex items-center space-x-1.5 space-x-reverse font-bold text-rose-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span>الحساب محظور:</span>
                      </div>
                      <p>السبب: {selectedUser.blocked_reason || 'غير محدد'}</p>
                      {selectedUser.blocked_at && (
                        <p className="text-[10px] text-rose-400">
                          تاريخ الحظر: {new Date(selectedUser.blocked_at).toLocaleString('ar-EG')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Linked Households */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300 block">المنازل المرتبطة بالحساب:</span>
                    {selectedUserDetails?.households?.length > 0 ? (
                      <div className="space-y-2">
                        {selectedUserDetails.households.map((hh: any) => (
                          <div
                            key={hh.id}
                            className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center space-x-2 space-x-reverse">
                              <Building className="w-4 h-4 text-amber-400" />
                              <span className="font-bold text-white">{hh.name}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">رمز الربط: {hh.pair_code}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-950 rounded-xl text-center text-xs text-slate-500">
                        المستخدم غير مرتبط بأي منزل حالياً
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Sticky Action Footer */}
            {!isLoadingDetails && (
              <div className="px-5 sm:px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center flex-wrap gap-2 shrink-0">
                {selectedUser.is_blocked ? (
                  <button
                    type="button"
                    onClick={() => {
                      const u = selectedUser;
                      setSelectedUser(null);
                      handleUnblock(u);
                    }}
                    className="flex-1 py-2.5 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 space-x-reverse cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>إلغاء حظر المستخدم</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const u = selectedUser;
                      setSelectedUser(null);
                      setUserToBlock(u);
                    }}
                    className="flex-1 py-2.5 px-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 space-x-reverse cursor-pointer"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>حظر هذا المستخدم</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    if (isDeleting) return;
                    const u = selectedUser;
                    setDeleteError(null);
                    setUserToDelete(u);
                  }}
                  className="flex-1 py-2.5 px-3 bg-rose-600/20 hover:bg-rose-600/30 disabled:opacity-50 disabled:cursor-not-allowed text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 space-x-reverse cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف الحساب</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. BLOCK USER MODAL (Mobile Bottom Sheet / Desktop Modal)          */}
      {/* =================================================================== */}
      {userToBlock && (
        <div
          onClick={() => setUserToBlock(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full border-t sm:border border-rose-500/30 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden text-right text-white animate-in slide-in-from-bottom-4 sm:zoom-in-95"
          >
            <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="text-base font-bold text-white">حظر وصول المستخدم</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  هل أنت متأكد من حظر حساب{' '}
                  <strong className="text-white">{userToBlock.full_name || userToBlock.email}</strong>؟
                </p>
                <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-rose-300 text-right">
                  ⚠️ سيتم تحديث حالة المستخدم إلى <span className="font-mono font-bold text-white">"blocked"</span> في
                  جدول <code className="font-mono text-emerald-400">profiles</code> وسيتم منع المستخدم فورياً من الوصول
                  إلى التطبيق.
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">سبب الحظر:</label>
                <select
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="مخالفة شروط الاستخدام">مخالفة شروط الاستخدام</option>
                  <option value="حساب مكرر أو وهمي">حساب مكرر أو وهمي</option>
                  <option value="إساءة استخدام ومراسلات غير لائقة">إساءة استخدام ومراسلات غير لائقة</option>
                  <option value="نشاط غير طبيعي ومريب">نشاط غير طبيعي ومريب</option>
                  <option value="طلب من صاحب الحساب">طلب من صاحب الحساب</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center space-x-2 space-x-reverse shrink-0">
              <button
                type="button"
                onClick={() => setUserToBlock(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmBlock}
                disabled={isBlocking}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                {isBlocking ? 'جاري الحظر وتحديث profiles...' : 'تأكيد حظر المستخدم'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. USER ACCOUNT DELETION CONFIRMATION DIALOG (Bottom Sheet)        */}
      {/* =================================================================== */}
      {userToDelete && (
        <div
          onClick={() => {
            if (!isDeleting) {
              setUserToDelete(null);
              setDeleteError(null);
            }
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full border-t sm:border border-rose-500/30 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden text-right text-white animate-in slide-in-from-bottom-4 sm:zoom-in-95"
          >
            <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-base font-bold text-white">حذف حساب المستخدم</h3>
                <p className="text-xs font-bold text-slate-200">هل أنت متأكد من حذف هذا الحساب؟</p>
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-0.5">
                  <div className="font-bold text-white">{userToDelete.full_name || 'مستخدم بدون اسم'}</div>
                  <div className="text-[11px] font-mono text-slate-400">{userToDelete.email}</div>
                  {userToDelete.phone && <div className="text-[11px] font-mono text-slate-400">{userToDelete.phone}</div>}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-right">
                  سيتم حذف حساب المستخدم وبيانات الحساب الحالية،
                  <br />
                  لكن لن يتم حذف الفواتير أو الطلبات أو البيانات التاريخية المرتبطة به.
                </p>
                <p className="text-xs font-bold text-rose-400">هذا الإجراء لا يمكن التراجع عنه.</p>
              </div>

              {deleteError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2 text-right">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{deleteError}</span>
                </div>
              )}
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center space-x-2 space-x-reverse shrink-0">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setUserToDelete(null);
                  setDeleteError(null);
                }}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/30 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف الحساب</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
