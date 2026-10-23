import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../context/AdminContext';
import { adminService } from '../services/adminService';
import { AdminUser, AdminRole, AdminPermission } from '../types';
import { exportToCSV } from '../utils/exportUtils';
import {
  ShieldCheck,
  UserPlus,
  Shield,
  Edit2,
  Trash2,
  KeyRound,
  CheckCircle2,
  X,
  RefreshCw,
  Download,
  AlertTriangle,
  Lock,
  Unlock,
  Eye,
} from 'lucide-react';

export const AdminTeamManagement: React.FC = () => {
  const { adminUser, hasPermission, showToast } = useAdmin();

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);

  // Form Fields
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AdminRole>('ADMIN');
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Delete Admin
  const [adminToDelete, setAdminToDelete] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadAdmins = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getAdmins();
      setAdmins(data);
    } catch (e) {
      console.warn('Failed to load admins:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const handleOpenAdd = () => {
    if (modalMode === 'edit') {
      setUserId('');
      setEmail('');
      setFullName('');
      setRole('ADMIN');
      setIsActive(true);
    }
    setModalMode('create');
    setEditingAdmin(null);
    setIsModalOpen(true);
  };

  const handleResetCreateForm = () => {
    setUserId('');
    setEmail('');
    setFullName('');
    setRole('ADMIN');
    setIsActive(true);
  };

  const handleOpenEdit = (adm: AdminUser) => {
    setModalMode('edit');
    setEditingAdmin(adm);
    setUserId(adm.user_id);
    setEmail(adm.email);
    setFullName(adm.full_name || '');
    setRole(adm.role);
    setIsActive(adm.is_active);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !email.trim()) {
      showToast('يرجى إدخال معرف المستخدم (User ID) والبريد الإلكتروني', 'error');
      return;
    }

    setIsSaving(true);
    try {
      if (modalMode === 'create') {
        const res = await adminService.createAdmin({
          user_id: userId.trim(),
          email: email.trim(),
          full_name: fullName.trim() || undefined,
          role,
          is_active: isActive,
        });

        if (res.success) {
          showToast(`تمت ترقية ${email} إلى رتبة مشرف بنجاح`, 'success');
          handleResetCreateForm();
          setIsModalOpen(false);
          loadAdmins();
        } else {
          showToast(res.error || 'فشل إضافة المشرف', 'error');
        }
      } else if (editingAdmin) {
        const res = await adminService.updateAdminRole(editingAdmin.id, role, isActive);
        if (res.success) {
          showToast(`تم تحديث صلاحيات المشرف ${editingAdmin.email}`, 'success');
          setIsModalOpen(false);
          loadAdmins();
        } else {
          showToast(res.error || 'فشل تحديث الصلاحيات', 'error');
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!adminToDelete) return;
    setIsDeleting(true);
    try {
      const res = await adminService.removeAdmin(adminToDelete.id);
      if (res.success) {
        showToast(`تم إزالة رتبة المشرف عن ${adminToDelete.email}`, 'info');
        setAdminToDelete(null);
        loadAdmins();
      } else {
        showToast(res.error || 'فشل إزالة المشرف', 'error');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleBadge = (r: AdminRole) => {
    switch (r) {
      case 'SUPER_ADMIN':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">Super Admin (المدير الأعلى)</span>;
      case 'ADMIN':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">Admin (مشرف عام)</span>;
      case 'CONTENT_MANAGER':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">مدير محتوى وكتالوج</span>;
      case 'SUPPORT':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">دعم فني ومستخدمين</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">قراءة فقط (Read Only)</span>;
    }
  };

  const handleExport = () => {
    exportToCSV('admins_team_export', admins);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <h2 className="text-lg font-bold text-white">إدارة فريق المشرفين والصلاحيات</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
                {admins.length} مشرفين
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              تعيين المشرفين، تحديد الأدوار (Super Admin / Admin / Support)، وتخصيص الصلاحيات.
            </p>
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
          {hasPermission('admins.manage') && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-1.5 space-x-reverse cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة مشرف جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/90 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-rose-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-bold">جاري تحميل قائمة المشرفين...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold">
                <tr>
                  <th className="p-4">المشرف</th>
                  <th className="p-4">البريد الإلكتروني</th>
                  <th className="p-4">الرتبة والدور</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4">تاريخ التعيين</th>
                  <th className="p-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {admins.map((adm) => (
                  <tr key={adm.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center space-x-3 space-x-reverse">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                          {adm.full_name ? adm.full_name.charAt(0) : 'A'}
                        </div>
                        <div>
                          <span className="font-bold text-white block">{adm.full_name || 'مشرف'}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{adm.user_id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-slate-300">{adm.email}</td>
                    <td className="p-4">{getRoleBadge(adm.role)}</td>
                    <td className="p-4">
                      {adm.is_active ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          نشط
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          معطل
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-slate-400">
                      {new Date(adm.created_at).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center space-x-1.5 space-x-reverse">
                        {hasPermission('admins.manage') && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(adm)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                            title="تعديل الرتبة"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        {hasPermission('admins.delete') && adm.user_id !== adminUser?.user_id && (
                          <button
                            type="button"
                            onClick={() => setAdminToDelete(adm)}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors cursor-pointer"
                            title="إزالة رتبة المشرف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 1. ADD / EDIT ADMIN MODAL                                           */}
      {/* =================================================================== */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full border-t sm:border border-slate-800 shadow-2xl text-right text-white flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 shrink-0">
              <div>
                <h3 className="text-base font-bold text-white">
                  {modalMode === 'create' ? 'ترقية مستخدم إلى رتبة مشرف' : 'تعديل رتبة وصلاحيات المشرف'}
                </h3>
                {modalMode === 'create' && (
                  <p className="text-[11px] text-slate-400 mt-0.5">تُحفظ البيانات المدخلة تلقائياً عند الإغلاق</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 text-xs">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                {modalMode === 'create' && (
                  <>
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">معرف المستخدم (User ID UUID) *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 11111111-2222-3333-4444-555555555555"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">البريد الإلكتروني *</label>
                      <input
                        type="email"
                        required
                        placeholder="admin@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="font-bold text-slate-300 block mb-1">الاسم الكامل</label>
                  <input
                    type="text"
                    placeholder="الاسم الثلاثي أو الثنائي"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">الرتبة الإدارية (Admin Role) *</label>
                  <select
                    value={role}
                    onChange={(e: any) => setRole(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl font-bold text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="SUPER_ADMIN">مدير أعلى للنظام (Super Admin - كامل الصلاحيات)</option>
                    <option value="ADMIN">مشرف عام (Admin)</option>
                    <option value="CONTENT_MANAGER">مدير محتوى وكتالوج (Content Manager)</option>
                    <option value="SUPPORT">دعم فني وخدمة عملاء (Support)</option>
                    <option value="READ_ONLY">مشاهدة وقراءة فقط (Read Only)</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2 space-x-reverse pt-2">
                  <input
                    type="checkbox"
                    id="isActiveAdmin"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 bg-slate-950 border-slate-800"
                  />
                  <label htmlFor="isActiveAdmin" className="font-bold text-slate-300 cursor-pointer">
                    حساب المشرف نشط ومفعل
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 p-4 border-t border-slate-800 bg-slate-950/95 backdrop-blur shrink-0 sticky bottom-0 z-10">
                {modalMode === 'create' && (userId || email || fullName) && (
                  <button
                    type="button"
                    onClick={handleResetCreateForm}
                    className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-300 rounded-xl font-bold border border-slate-800"
                  >
                    مسح
                  </button>
                )}
                <div className="flex items-center space-x-2 space-x-reverse flex-1">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold"
                  >
                    إغلاق
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all shadow-md shadow-rose-600/30 cursor-pointer"
                  >
                    {isSaving ? 'جاري الحفظ...' : modalMode === 'create' ? 'ترقية المشرف' : 'حفظ التعديلات'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. REMOVE ADMIN MODAL                                               */}
      {/* =================================================================== */}
      {adminToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setAdminToDelete(null)}
        >
          <div
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full border-t sm:border border-rose-500/30 shadow-2xl text-right text-white flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-rose-400">إزالة رتبة المشرف</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  هل أنت متأكد من إزالة رتبة المشرف عن <strong className="text-white">"{adminToDelete.email}"</strong>؟
                  سيعود حسابه كمستخدم عادي ولن يتمكن من الدخول إلى لوحة التحكم.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse p-4 border-t border-slate-800 bg-slate-950/95 backdrop-blur shrink-0 sticky bottom-0 z-10">
              <button
                type="button"
                onClick={() => setAdminToDelete(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/30 cursor-pointer"
              >
                {isDeleting ? 'جاري الإزالة...' : 'تأكيد الإزالة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
