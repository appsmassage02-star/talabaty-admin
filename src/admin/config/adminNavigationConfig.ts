import React from 'react';
import {
  LayoutDashboard,
  Users,
  Home,
  Tag,
  ShoppingBag,
  Receipt,
  Bell,
  Shield,
  FileText,
  Settings,
  BarChart3,
  Send,
  Truck,
  PackageCheck,
  Bike,
  MapPin,
  Sliders,
  ListChecks,
  Archive,
  HeartPulse,
  Building2,
  FolderHeart,
  Image as ImageIcon,
} from 'lucide-react';
import { AdminPermission } from '../types';

export interface AdminNavGroup {
  id: string;
  title: string;
  icon: React.FC<{ className?: string }>;
  items: {
    id: string;
    label: string;
    icon: React.FC<{ className?: string }>;
    requiredPermission?: AdminPermission;
  }[];
}

export interface AdminManagementSubItem {
  id: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  permission?: AdminPermission;
  badgeKey?: string;
}

export interface AdminManagementGroup {
  groupId: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  groupIcon: React.FC<{ className?: string }>;
  items: AdminManagementSubItem[];
}

/**
 * Mobile-First & Tablet-Ready Operational Grouping for "طلبات البيت — لوحة التحكم الإدارية"
 * Reorganized into clear, task-oriented operational groups while preserving every existing page ID and permission.
 */
export const ADMIN_MANAGEMENT_GROUPS: AdminManagementGroup[] = [
  {
    groupId: 'command_center',
    titleAr: 'مركز المتابعة والمهام',
    titleEn: 'COMMAND & TASKS CENTER',
    descriptionAr: 'متابعة المهام الفورية والطلبات قيد المراجعة والإسناد والتقارير الفعلية',
    groupIcon: LayoutDashboard,
    items: [
      {
        id: 'overview',
        label: 'مركز المهام والمتابعة',
        icon: LayoutDashboard,
      },
      {
        id: 'analytics',
        label: 'التقارير والمؤشرات الفعلية',
        icon: BarChart3,
        permission: 'analytics.view',
      },
    ],
  },
  {
    groupId: 'delivery_management',
    titleAr: 'عمليات الدليفري والمناديب',
    titleEn: 'DELIVERY & FLEET OPS',
    descriptionAr: 'إدارة طلبات التوصيل، إسناد السائقين، طلبات الانضمام، وعناوين العملاء',
    groupIcon: Truck,
    items: [
      {
        id: 'delivery_orders',
        label: 'طلبات الدليفري',
        icon: PackageCheck,
        permission: 'delivery.view',
      },
      {
        id: 'delivery_drivers',
        label: 'السائقون وطلبات الانضمام',
        icon: Bike,
        permission: 'delivery.view',
      },
      {
        id: 'delivery_customers',
        label: 'عناوين وعملاء الدليفري',
        icon: MapPin,
        permission: 'delivery.view',
      },
      {
        id: 'delivery_settings',
        label: 'إعدادات ونطاقات التوصيل',
        icon: Sliders,
        permission: 'delivery.manage',
      },
    ],
  },
  {
    groupId: 'pharmacy_management',
    titleAr: 'عمليات الصيدلية والروشتات',
    titleEn: 'PHARMACY & PRESCRIPTIONS',
    descriptionAr: 'مراجعة طلبات الأدوية والروشتات، التسعير، الإسناد، ودليل الصيدليات',
    groupIcon: HeartPulse,
    items: [
      {
        id: 'pharmacy_orders',
        label: 'طلبات الصيدلية',
        icon: PackageCheck,
        permission: 'delivery.view',
      },
      {
        id: 'pharmacy_prescriptions',
        label: 'الروشتات المحفوظة',
        icon: FolderHeart,
        permission: 'delivery.view',
      },
      {
        id: 'pharmacy_pharmacies',
        label: 'دليل الصيدليات',
        icon: Building2,
        permission: 'delivery.view',
      },
      {
        id: 'pharmacy_settings',
        label: 'إعدادات ومناطق الصيدلية',
        icon: Sliders,
        permission: 'delivery.manage',
      },
    ],
  },
  {
    groupId: 'accounts_and_access',
    titleAr: 'الحسابات والأسر والمشرفون',
    titleEn: 'ACCOUNTS, HOUSEHOLDS & TEAM',
    descriptionAr: 'إدارة حسابات المستخدمين، حالات التفعيل والحظر، الأسر، وفريق المشرفين',
    groupIcon: Users,
    items: [
      {
        id: 'users',
        label: 'حسابات المستخدمين',
        icon: Users,
        permission: 'users.view',
      },
      {
        id: 'households',
        label: 'الأسر والمنازل',
        icon: Home,
        permission: 'households.view',
      },
      {
        id: 'team',
        label: 'فريق الإدارة والصلاحيات',
        icon: Shield,
        permission: 'admins.manage',
      },
    ],
  },
  {
    groupId: 'catalog_and_invoices',
    titleAr: 'الكتالوج والفواتير والمشتريات',
    titleEn: 'CATALOG, INVOICES & LISTS',
    descriptionAr: 'إدارة الأقسام والمنتجات وسجل الفواتير والنواقص والأرشيف',
    groupIcon: Receipt,
    items: [
      {
        id: 'categories',
        label: 'الأقسام والفئات',
        icon: Tag,
        permission: 'categories.view',
      },
      {
        id: 'products',
        label: 'المنتجات والسلع',
        icon: ShoppingBag,
        permission: 'products.view',
      },
      {
        id: 'invoices_overview',
        label: 'نظرة عامة على الفواتير',
        icon: BarChart3,
        permission: 'invoices.view',
      },
      {
        id: 'invoices_purchases',
        label: 'سجل الفواتير والمشتريات',
        icon: Receipt,
        permission: 'invoices.view',
      },
      {
        id: 'invoices_missing_items',
        label: 'النواقص وقوائم الطلبات',
        icon: ListChecks,
        permission: 'invoices.view',
      },
      {
        id: 'invoices_archive',
        label: 'أرشيف الفواتير',
        icon: Archive,
        permission: 'invoices.view',
      },
    ],
  },
  {
    groupId: 'communications_and_system',
    titleAr: 'الإشعارات والأصول والنظام',
    titleEn: 'NOTIFICATIONS, ASSETS & SYSTEM',
    descriptionAr: 'إرسال الإشعارات، إدارة صور التطبيقات المركزية، سجل الرقابة، والإعدادات',
    groupIcon: Settings,
    items: [
      {
        id: 'notifications',
        label: 'سجل الإشعارات النشطة',
        icon: Bell,
        permission: 'notifications.send',
      },
      {
        id: 'notifications_broadcast',
        label: 'إرسال إشعار عام',
        icon: Send,
        permission: 'notifications.send',
      },
      {
        id: 'app_assets',
        label: 'إدارة صور التطبيق',
        icon: ImageIcon,
        permission: 'settings.manage',
      },
      {
        id: 'audit_logs',
        label: 'سجل العمليات والرقابة',
        icon: FileText,
        permission: 'audit.view',
      },
      {
        id: 'settings',
        label: 'الإعدادات العامة',
        icon: Settings,
        permission: 'settings.manage',
      },
      {
        id: 'settings_rls',
        label: 'الأمان وصلاحيات RLS',
        icon: Shield,
        permission: 'settings.manage',
      },
    ],
  },
];

export const ADMIN_NAVIGATION_GROUPS: AdminNavGroup[] = ADMIN_MANAGEMENT_GROUPS.map((g) => ({
  id: g.groupId,
  title: g.titleAr,
  icon: g.groupIcon,
  items: g.items.map((item) => ({
    id: item.id,
    label: item.label,
    icon: item.icon,
    requiredPermission: item.permission,
  })),
}));

export function findNavGroupBySection(sectionId: string): {
  group: AdminManagementGroup | undefined;
  item: AdminManagementSubItem | undefined;
} {
  for (const group of ADMIN_MANAGEMENT_GROUPS) {
    const found = group.items.find((i) => i.id === sectionId);
    if (found) {
      return { group, item: found };
    }
  }
  return { group: undefined, item: undefined };
}
