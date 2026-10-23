import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../context/AdminContext';
import { adminService } from '../services/adminService';
import { AdminCategory, GlobalCategorySubcategory } from '../types';
import { exportToCSV } from '../utils/exportUtils';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  MoveUp,
  MoveDown,
  RefreshCw,
  Download,
  Search,
  X,
  Package,
  Image as ImageIcon,
  FolderTree,
  Home,
} from 'lucide-react';

export const AdminCategories: React.FC = () => {
  const { hasPermission, showToast } = useAdmin();

  const canEdit = hasPermission('categories.edit') || hasPermission('categories.update');

  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Category Modal State (Add / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);

  // Form Fields matching exact columns of public.global_categories
  const [categoryId, setCategoryId] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [description, setDescription] = useState('');
  const [iconName, setIconName] = useState('🛒');
  const [imageUrl, setImageUrl] = useState('');
  const [color, setColor] = useState('emerald');
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [subcategories, setSubcategories] = useState<
    Array<{ id: string; nameAr: string; nameEn: string; itemsText: string }>
  >([]);
  const [isSaving, setIsSaving] = useState(false);

  // Delete Category Confirmation
  const [categoryToDelete, setCategoryToDelete] = useState<AdminCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Category Full Details Sheet
  const [selectedCategory, setSelectedCategory] = useState<AdminCategory | null>(null);

  const emojiPresets = ['🛒', '🥬', '🥩', '🧴', '🏠', '🍞', '🥤', '🧼', '🧀', '🍗', '🍎', '🥕', '🧃', '🍪'];
  const colorOptions = [
    { value: 'emerald', label: 'أخضر (Emerald)', dot: 'bg-emerald-500' },
    { value: 'amber', label: 'ذهبي (Amber)', dot: 'bg-amber-500' },
    { value: 'rose', label: 'وردي (Rose)', dot: 'bg-rose-500' },
    { value: 'orange', label: 'برتقالي (Orange)', dot: 'bg-orange-500' },
    { value: 'indigo', label: 'نيلي (Indigo)', dot: 'bg-indigo-500' },
    { value: 'cyan', label: 'سماوي (Cyan)', dot: 'bg-cyan-500' },
    { value: 'purple', label: 'بنفسجي (Purple)', dot: 'bg-purple-500' },
    { value: 'blue', label: 'أزرق (Blue)', dot: 'bg-blue-500' },
  ];

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getCategories();
      setCategories(data);
    } catch (e) {
      console.warn('Failed to load global_categories:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const filteredCategories = categories.filter(
    (c) =>
      (c.name_ar || c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.name_en || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.id || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetCreateCategoryDraft = () => {
    setCategoryId('');
    setNameAr('');
    setNameEn('');
    setDescription('');
    setIconName('🛒');
    setImageUrl('https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80');
    setColor('emerald');
    setSortOrder(categories.length + 1);
    setIsActive(true);
    setSubcategories([]);
  };

  const handleOpenAdd = () => {
    // Preserve draft if user was already in create mode and closed the sheet temporarily
    if (
      modalMode !== 'create' ||
      editingCategory !== null ||
      (!nameAr && !nameEn && !description && subcategories.length === 0)
    ) {
      resetCreateCategoryDraft();
    }
    setModalMode('create');
    setEditingCategory(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: AdminCategory) => {
    if (modalMode !== 'edit' || editingCategory?.id !== cat.id) {
      setModalMode('edit');
      setEditingCategory(cat);
      setCategoryId(cat.id);
      setNameAr(cat.name_ar || cat.name || '');
      setNameEn(cat.name_en || '');
      setDescription(cat.description || '');
      setIconName(cat.icon_name || cat.icon || '🛒');
      setImageUrl(cat.image_url || cat.image || '');
      setColor(cat.color || 'emerald');
      setSortOrder(cat.sort_order ?? 0);
      setIsActive(cat.is_active ?? true);

      const mappedSubs = Array.isArray(cat.subcategories)
        ? cat.subcategories.map((sc: GlobalCategorySubcategory) => ({
            id: sc.id || `sub_${Math.random().toString(36).slice(2, 6)}`,
            nameAr: sc.nameAr || sc.name_ar || '',
            nameEn: sc.nameEn || sc.name_en || '',
            itemsText: Array.isArray(sc.items) ? sc.items.join('، ') : '',
          }))
        : [];
      setSubcategories(mappedSubs);
    }
    setIsModalOpen(true);
  };

  const handleAddSubcategoryRow = () => {
    setSubcategories((prev) => [
      ...prev,
      {
        id: `sub_${Date.now().toString(36)}_${prev.length + 1}`,
        nameAr: '',
        nameEn: '',
        itemsText: '',
      },
    ]);
  };

  const handleUpdateSubcategoryRow = (
    index: number,
    field: 'id' | 'nameAr' | 'nameEn' | 'itemsText',
    val: string
  ) => {
    setSubcategories((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: val } : row)));
  };

  const handleRemoveSubcategoryRow = (index: number) => {
    setSubcategories((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      showToast('يرجى إدخال اسم القسم بالعربية', 'error');
      return;
    }

    const finalId =
      modalMode === 'edit' && editingCategory
        ? editingCategory.id
        : categoryId.trim() ||
          nameEn
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '') ||
          `cat_${Date.now()}`;

    const formattedSubcategories: GlobalCategorySubcategory[] = subcategories
      .filter((s) => s.nameAr.trim() || s.nameEn.trim())
      .map((s, idx) => ({
        id: s.id.trim() || `${finalId}_sub_${idx + 1}`,
        nameAr: s.nameAr.trim() || s.nameEn.trim(),
        nameEn: s.nameEn.trim() || s.nameAr.trim(),
        items: s.itemsText
          .split(/[،,]/)
          .map((item) => item.trim())
          .filter(Boolean),
      }));

    setIsSaving(true);
    try {
      const res = await adminService.upsertGlobalCategory({
        id: finalId,
        name_ar: nameAr.trim(),
        name_en: nameEn.trim() || nameAr.trim(),
        description: description.trim(),
        icon_name: iconName.trim() || '🛒',
        image_url:
          imageUrl.trim() ||
          'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
        color,
        subcategories: formattedSubcategories,
        sort_order: Number(sortOrder) || 0,
        is_active: isActive,
      });

      if (res.success) {
        showToast(
          modalMode === 'create'
            ? `تمت إضافة قسم "${nameAr}" في global_categories بنجاح`
            : `تم تحديث قسم "${nameAr}" في global_categories بنجاح`,
          'success'
        );
        if (modalMode === 'create') {
          resetCreateCategoryDraft();
        } else {
          setEditingCategory(null);
        }
        setIsModalOpen(false);
        loadCategories();
      } else {
        showToast(res.error || 'فشل حفظ القسم', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (cat: AdminCategory) => {
    try {
      const res = await adminService.toggleCategoryActive(cat.id, !cat.is_active);
      if (res.success) {
        showToast(
          cat.is_active ? `تم تعطيل قسم "${cat.name_ar}"` : `تم تفعيل قسم "${cat.name_ar}"`,
          'info'
        );
        loadCategories();
      } else {
        showToast(res.error || 'تعذر تغيير حالة القسم', 'error');
      }
    } catch (e: any) {
      showToast(e?.message || 'حدث خطأ', 'error');
    }
  };

  const handleMoveSortOrder = async (cat: AdminCategory, direction: 'up' | 'down') => {
    const newOrder = direction === 'up' ? Math.max(0, (cat.sort_order || 0) - 1) : (cat.sort_order || 0) + 1;
    const res = await adminService.upsertGlobalCategory({
      ...cat,
      sort_order: newOrder,
    });
    if (res.success) {
      loadCategories();
    } else {
      showToast(res.error || 'فشل تحديث ترتيب القسم', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await adminService.deleteGlobalCategory(categoryToDelete.id);
      if (res.success) {
        showToast(`تم حذف قسم "${categoryToDelete.name_ar}" بنجاح`, 'info');
        if (selectedCategory?.id === categoryToDelete.id) {
          setSelectedCategory(null);
        }
        setCategoryToDelete(null);
        loadCategories();
      } else {
        showToast(res.error || 'فشل حذف القسم', 'error');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = () => {
    exportToCSV('global_categories_export', categories);
  };

  const handleQuickAddReadyMeals = () => {
    setModalMode('create');
    setEditingCategory(null);
    setCategoryId('ready_meals');
    setNameAr('إدارة المأكولات الجاهزة');
    setNameEn('Ready Meals');
    setDescription('الوجبات السريعة، المشويات، الطواجن، والمأكولات الجاهزة للعائلة');
    setIconName('🍗');
    setImageUrl('https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80');
    setColor('orange');
    setSortOrder(categories.length + 1);
    setIsActive(true);
    setSubcategories([
      {
        id: 'grills_and_chicken',
        nameAr: 'مشويات ودجاج',
        nameEn: 'Grills & Chicken',
        itemsText: 'دجاج مشوي، دجاج بروستد، كفتة مشوية، مشويات مشكلة',
      },
      {
        id: 'traditional_and_pies',
        nameAr: 'كشري وطواجن وفطائر',
        nameEn: 'Traditional & Pies',
        itemsText: 'كشري، طاجن مكرونة، بيتزا، فطير مشلتت، سندوتشات',
      },
    ]);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <h2 className="text-lg font-bold text-white">الكتالوج المركزي للأقسام (global_categories)</h2>
              <span className="text-xs font-bold text-cyan-400 font-mono">
                · {categories.length} أقسام رئيسية
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              إدارة الأقسام المركزية، الأقسام الفرعية (subcategories)، وترتيب العرض المتزامن مع حسابات المنازل.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hasPermission('categories.create') && (
            <button
              type="button"
              onClick={handleQuickAddReadyMeals}
              className="px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 space-x-reverse cursor-pointer"
            >
              <span>🍗 + قالب المأكولات الجاهزة</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center space-x-1.5 space-x-reverse cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>تصدير CSV</span>
          </button>
          {hasPermission('categories.create') && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-1.5 space-x-reverse cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة قسم مركزي</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم القسم بالعربية أو الإنجليزية أو المعرف البرمجي (id)..."
            className="w-full pl-3 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
        </div>
        <button
          type="button"
          onClick={loadCategories}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 cursor-pointer"
          title="تحديث القائمة"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Categories Cards Grid */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3 bg-slate-900/40 rounded-3xl border border-slate-800">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-bold">جاري تحميل الأقسام من global_categories...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-slate-900/40 rounded-3xl border border-slate-800">
          <Layers className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">لا توجد أقسام مطابقة</h3>
          <p className="text-xs text-slate-500">يمكنك إضافة قسم مركزي جديد عبر زر الإضافة أعلاه.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => (
            <div
              key={cat.id}
              className={`bg-slate-900/90 rounded-3xl p-5 border transition-all space-y-4 relative flex flex-col justify-between ${
                cat.is_active ? 'border-slate-800 hover:border-cyan-500/40' : 'border-slate-800/40 opacity-70'
              }`}
            >
              <div className="space-y-3">
                {/* Card Top */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl shadow-inner shrink-0 overflow-hidden">
                      {cat.icon_name || cat.icon || '🛒'}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 space-x-reverse flex-wrap">
                        <h3 className="text-sm font-bold text-white">{cat.name_ar || cat.name}</h3>
                        {!cat.is_active && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold">
                            معطل
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                        <span>{cat.id}</span>
                        <span>·</span>
                        <span>{cat.name_en}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-1 space-x-reverse shrink-0">
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleMoveSortOrder(cat, 'up')}
                          className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-800 cursor-pointer"
                          title="تقديم في الترتيب"
                        >
                          <MoveUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSortOrder(cat, 'down')}
                          className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-800 cursor-pointer"
                          title="تأخير في الترتيب"
                        >
                          <MoveDown className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleActive(cat)}
                      className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                        cat.is_active
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                      title={cat.is_active ? 'تعطيل القسم' : 'تفعيل القسم'}
                    >
                      {cat.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(cat)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="تعديل القسم"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}

                    {hasPermission('categories.delete') && (
                      <button
                        type="button"
                        onClick={() => setCategoryToDelete(cat)}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors cursor-pointer"
                        title="حذف القسم"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {cat.description && (
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{cat.description}</p>
                )}

                {/* Subcategories Preview */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <FolderTree className="w-3.5 h-3.5 text-cyan-400" />
                    <span>الأقسام الفرعية ({Array.isArray(cat.subcategories) ? cat.subcategories.length : 0}):</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {Array.isArray(cat.subcategories) && cat.subcategories.length > 0 ? (
                      cat.subcategories.map((sc, idx) => (
                        <span
                          key={sc.id || idx}
                          className="text-[10px] px-2.5 py-1 bg-slate-950 text-cyan-300 rounded-lg border border-slate-800 font-medium"
                        >
                          {sc.nameAr || sc.name_ar}
                          {Array.isArray(sc.items) && sc.items.length > 0 && (
                            <span className="text-slate-500 mr-1 font-mono">({sc.items.length})</span>
                          )}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-500">لا توجد أقسام فرعية مسجلة</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer Stats */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 text-purple-300 font-bold">
                    <Package className="w-3.5 h-3.5 text-purple-400" />
                    <span>{cat.products_count || 0} منتج</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-300 font-bold">
                    <Home className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{cat.linked_households_count || 0} منزل مرتبط</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-slate-500">ترتيب #{cat.sort_order ?? 0}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-[10px] font-bold border border-slate-700 cursor-pointer"
                  >
                    عرض التفاصيل
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =================================================================== */}
      {/* 0. CATEGORY FULL DETAILS MODAL (Mobile Bottom Sheet)               */}
      {/* =================================================================== */}
      {selectedCategory && (
        <div
          onClick={() => setSelectedCategory(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full border-t sm:border border-slate-800 shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden text-right text-white animate-in slide-in-from-bottom-4 sm:zoom-in-95"
          >
            <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 shrink-0 bg-slate-900/95">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl shrink-0">
                  {selectedCategory.icon_name || selectedCategory.icon || '🛒'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white truncate">
                      {selectedCategory.name_ar || selectedCategory.name}
                    </h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        selectedCategory.is_active
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {selectedCategory.is_active ? 'نشط' : 'معطل'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono block truncate">
                    {selectedCategory.id} · {selectedCategory.name_en}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-4 text-xs">
              {(selectedCategory.image_url || selectedCategory.image) && (
                <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 h-40">
                  <img
                    src={selectedCategory.image_url || selectedCategory.image}
                    alt={selectedCategory.name_ar}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {selectedCategory.description && (
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 block">وصف القسم</span>
                  <p className="text-slate-200 leading-relaxed">{selectedCategory.description}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block mb-1">المنتجات المرتبطة</span>
                  <span className="font-mono font-bold text-purple-400">{selectedCategory.products_count || 0}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block mb-1">منازل مرتبطة</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {selectedCategory.linked_households_count || 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block mb-1">ترتيب العرض</span>
                  <span className="font-mono font-bold text-slate-200">#{selectedCategory.sort_order ?? 0}</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <FolderTree className="w-4 h-4" />
                  <span>
                    الأقسام الفرعية والأصناف المقترحة (
                    {Array.isArray(selectedCategory.subcategories) ? selectedCategory.subcategories.length : 0})
                  </span>
                </span>
                {Array.isArray(selectedCategory.subcategories) && selectedCategory.subcategories.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCategory.subcategories.map((sc, idx) => (
                      <div key={sc.id || idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">{sc.nameAr || sc.name_ar}</span>
                          <span className="text-[10px] font-mono text-cyan-400">{sc.id}</span>
                        </div>
                        {Array.isArray(sc.items) && sc.items.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {sc.items.map((item, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-300"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center text-slate-500">
                    لا توجد أقسام فرعية مسجلة لهذا القسم
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center flex-wrap gap-2 shrink-0">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    const c = selectedCategory;
                    setSelectedCategory(null);
                    handleOpenEdit(c);
                  }}
                  className="flex-1 py-2.5 px-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>تعديل القسم</span>
                </button>
              )}
              {hasPermission('categories.delete') && (
                <button
                  type="button"
                  onClick={() => {
                    const c = selectedCategory;
                    setSelectedCategory(null);
                    setCategoryToDelete(c);
                  }}
                  className="py-2.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 1. ADD / EDIT MODAL (Mobile Bottom Sheet / Desktop Modal)           */}
      {/* =================================================================== */}
      {isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full border-t sm:border border-slate-800 shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden text-right text-white animate-in slide-in-from-bottom-4 sm:zoom-in-95"
          >
            <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 shrink-0 bg-slate-900/95">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                {modalMode === 'create'
                  ? 'إضافة قسم جديد في الكتالوج المركزي (global_categories)'
                  : `تعديل القسم: ${editingCategory?.name_ar}`}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
              <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-4 text-xs">
                {/* ID, Name AR, Name EN */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">اسم القسم بالعربية (name_ar) *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: خضروات وفواكه"
                      value={nameAr}
                      onChange={(e) => setNameAr(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">الاسم بالإنجليزية (name_en) *</label>
                    <input
                      type="text"
                      required
                      placeholder="Vegetables & Fruits"
                      value={nameEn}
                      onChange={(e) => setNameEn(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">المعرف البرمجي (id)</label>
                    <input
                      type="text"
                      disabled={modalMode === 'edit'}
                      placeholder="vegetables_fruits"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 disabled:opacity-60 rounded-xl text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="font-bold text-slate-300 block mb-1">وصف القسم (description)</label>
                  <input
                    type="text"
                    placeholder="وصف مختصر يوضح محتويات القسم..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Icon, Color, Image URL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">الأيقونة (icon_name)</label>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <input
                        type="text"
                        value={iconName}
                        onChange={(e) => setIconName(e.target.value)}
                        className="w-14 px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-center text-base focus:outline-none focus:border-cyan-500"
                      />
                      <div className="flex flex-wrap gap-1">
                        {emojiPresets.map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => setIconName(em)}
                            className="w-7 h-7 rounded-lg bg-slate-950 hover:bg-slate-800 flex items-center justify-center text-sm border border-slate-800 transition-colors cursor-pointer"
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 block mb-1">السمة اللونية (color)</label>
                    <select
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                    >
                      {colorOptions.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>رابط صورة القسم (image_url) *</span>
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://images.unsplash.com/..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Subcategories JSONB Builder */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <label className="font-bold text-cyan-300 block flex items-center gap-1.5">
                        <FolderTree className="w-4 h-4" />
                        <span>الأقسام الفرعية والأصناف المقترحة (subcategories JSONB)</span>
                      </label>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        تُستخدم لربط المنتجات بالقسم الفرعي (subcategory_id) وعرض المقترحات داخل التطبيق.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddSubcategoryRow}
                      className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة قسم فرعي</span>
                    </button>
                  </div>

                  {subcategories.length === 0 ? (
                    <div className="text-center py-4 text-[11px] text-slate-500">
                      لا توجد أقسام فرعية مضافة بعد. اضغط على "إضافة قسم فرعي" لإضافة تصنيف فرعي.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {subcategories.map((sub, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 relative"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              placeholder="الاسم بالعربية (مثال: ألبان وأجبان)"
                              value={sub.nameAr}
                              onChange={(e) => handleUpdateSubcategoryRow(idx, 'nameAr', e.target.value)}
                              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-white"
                            />
                            <input
                              type="text"
                              placeholder="الاسم بالإنجليزية (Dairy)"
                              value={sub.nameEn}
                              onChange={(e) => handleUpdateSubcategoryRow(idx, 'nameEn', e.target.value)}
                              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                            />
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                placeholder="المعرف (subcategory_id)"
                                value={sub.id}
                                onChange={(e) => handleUpdateSubcategoryRow(idx, 'id', e.target.value)}
                                className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-cyan-300"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveSubcategoryRow(idx)}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg cursor-pointer"
                                title="حذف القسم الفرعي"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <input
                            type="text"
                            placeholder="الأصناف الشائعة مفصولة بفاصلة (مثال: حليب، جبنة بيضاء، زبادي، قشطة)"
                            value={sub.itemsText}
                            onChange={(e) => handleUpdateSubcategoryRow(idx, 'itemsText', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-slate-300"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sort Order & Is Active */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">ترتيب العرض (sort_order)</label>
                    <input
                      type="number"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse pt-2 sm:pt-5">
                    <input
                      type="checkbox"
                      id="isActiveCheck"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-950 border-slate-800"
                    />
                    <label htmlFor="isActiveCheck" className="font-bold text-slate-300 cursor-pointer">
                      تفعيل القسم في الكتالوج العام (is_active)
                    </label>
                  </div>
                </div>
              </div>

              {/* Sticky Actions Footer */}
              <div className="px-5 sm:px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center space-x-2 space-x-reverse shrink-0 text-xs">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  إغلاق والعودة
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold transition-all shadow-md shadow-cyan-600/30 cursor-pointer"
                >
                  {isSaving ? 'جاري الحفظ...' : modalMode === 'create' ? 'إضافة القسم' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. DELETE MODAL (Mobile Bottom Sheet / Desktop Modal)               */}
      {/* =================================================================== */}
      {categoryToDelete && (
        <div
          onClick={() => {
            if (!isDeleting) setCategoryToDelete(null);
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

              <div className="text-center space-y-1.5">
                <h3 className="text-base font-bold text-rose-400">حذف القسم المركزي</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  هل أنت متأكد من حذف قسم{' '}
                  <strong className="text-white">"{categoryToDelete.name_ar || categoryToDelete.name}"</strong>؟
                </p>
                {(categoryToDelete.products_count || 0) > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
                    تنبيه: هذا القسم مرتبط بـ ({categoryToDelete.products_count}) منتج في جدول{' '}
                    <code>global_products</code>. يجب نقل أو حذف المنتجات المرتبطة أولاً أو تعطيل القسم بدلاً من حذفه.
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center space-x-2 space-x-reverse shrink-0">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/30 cursor-pointer"
              >
                {isDeleting ? 'جاري الحذف...' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
