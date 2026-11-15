import React, { useMemo, useState } from 'react';
import {
  CentralSectionServiceAreaRecord,
  CentralServiceType,
  DeliveryAreaTariff,
  ServiceSectionSummary,
} from '../../types';
import {
  getDeliveryOwnerLabelAr,
  getScopeLevelLabelAr,
  getServiceLabelAr,
} from '../../services/centralGeoDeliveryService';
import {
  AlertTriangle,
  CheckCircle2,
  Coins,
  Layers,
  MapPin,
  Power,
  RefreshCw,
  ShieldAlert,
  Store,
  XCircle,
} from 'lucide-react';

interface CentralServicesTabProps {
  summaries: ServiceSectionSummary[];
  tariffs: DeliveryAreaTariff[];
  sectionServiceAreas: CentralSectionServiceAreaRecord[];
  tariffsError?: string | null;
  sectionAreasError?: string | null;
  canManageAreas: boolean;
  canViewPricing: boolean;
  isBusy: boolean;
  onToggleTariffEnabled: (tariff: DeliveryAreaTariff, nextEnabled: boolean) => Promise<void>;
  onToggleSectionAreaActive: (id: string, nextActive: boolean) => Promise<void>;
  onGoToPricingForService: (serviceType: CentralServiceType) => void;
  onRefresh: () => void;
}

export const CentralServicesTab: React.FC<CentralServicesTabProps> = ({
  summaries,
  tariffs,
  sectionServiceAreas,
  tariffsError,
  sectionAreasError,
  canManageAreas,
  canViewPricing,
  isBusy,
  onToggleTariffEnabled,
  onToggleSectionAreaActive,
  onGoToPricingForService,
  onRefresh,
}) => {
  const [selectedService, setSelectedService] = useState<CentralServiceType>('household_shortages');

  const activeSummary = useMemo(
    () => summaries.find((s) => s.definition.type === selectedService) || summaries[0],
    [summaries, selectedService]
  );

  const serviceTariffs = useMemo(
    () => tariffs.filter((t) => t.service_type === selectedService),
    [tariffs, selectedService]
  );

  return (
    <div className="space-y-6">
      {/* Notice: Strictly 3 Authoritative Services */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-white">
              أقسام الخدمات المعتمدة وتغطيتها الجغرافية
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              تعمل المنظومة حصرياً على الأقسام الثلاثة المعتمدة: طلبات البيت والنواقص، الصيدلية، والمطاعم الجاهزة — دون إنشاء أي قيم service_type إضافية.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isBusy}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isBusy ? 'animate-spin' : ''}`} />
          <span>تحديث الحالة</span>
        </button>
      </div>

      {/* DB Diagnostic Warnings if tables are blocked */}
      {tariffsError && (
        <div className="bg-rose-950/50 border border-rose-500/40 rounded-2xl p-4 flex items-start gap-3 text-xs text-rose-200">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-rose-300">تعذر قراءة جدول delivery_area_tariffs من قاعدة البيانات</p>
            <p className="font-mono text-[11px] text-rose-200/90 break-words">{tariffsError}</p>
          </div>
        </div>
      )}

      {sectionAreasError && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-amber-300">تعذر قراءة جدول restaurant_section_service_areas</p>
            <p className="font-mono text-[11px] text-amber-200/90 break-words">{sectionAreasError}</p>
          </div>
        </div>
      )}

      {/* Three Service Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summaries.map((sum) => {
          const isSelected = sum.definition.type === selectedService;
          const isOperational = sum.enabledTariffsCount > 0;
          return (
            <button
              key={sum.definition.type}
              type="button"
              onClick={() => setSelectedService(sum.definition.type)}
              className={`text-right rounded-3xl p-5 border transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                isSelected
                  ? 'bg-slate-900 border-emerald-500/60 shadow-lg shadow-emerald-950/30'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-white">{sum.definition.labelAr}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      isOperational
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {isOperational ? 'به نطاقات مفعلة' : 'بدون نطاقات مفعلة'}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-emerald-400/90">{sum.definition.type}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{sum.definition.descriptionAr}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800/80 text-center">
                <div className="bg-slate-950/70 rounded-xl p-2 border border-slate-800/60">
                  <span className="text-base font-black text-emerald-400 font-mono block">
                    {sum.enabledTariffsCount}
                  </span>
                  <span className="text-[10px] text-slate-400">مفعّل</span>
                </div>
                <div className="bg-slate-950/70 rounded-xl p-2 border border-slate-800/60">
                  <span className="text-base font-black text-rose-400 font-mono block">
                    {sum.disabledTariffsCount}
                  </span>
                  <span className="text-[10px] text-slate-400">معطّل</span>
                </div>
                <div className="bg-slate-950/70 rounded-xl p-2 border border-slate-800/60">
                  <span className="text-base font-black text-sky-400 font-mono block">
                    {sum.coveredGovernorateIds.length}
                  </span>
                  <span className="text-[10px] text-slate-400">محافظات</span>
                </div>
              </div>

              {sum.discrepancies.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-2.5 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{sum.discrepancies.length} تعارض/تنبيه تغطية يتطلب المراجعة</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Service Coverage & Conflicts Detail */}
      {activeSummary && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-black text-white">{activeSummary.definition.labelAr}</h4>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-slate-800 text-emerald-300 border border-slate-700">
                  {activeSummary.definition.type}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                المحافظات المغطاة: <strong className="text-white font-mono">{activeSummary.coveredGovernorateIds.length}</strong> ·
                المراكز: <strong className="text-white font-mono">{activeSummary.coveredCenterIds.length}</strong> ·
                المناطق: <strong className="text-white font-mono">{activeSummary.coveredAreaIds.length}</strong> ·
                عروض توصيل مجاني: <strong className="text-emerald-300 font-mono">{activeSummary.freeDeliveryCount}</strong>
              </p>
            </div>
            {canViewPricing && (
              <button
                type="button"
                onClick={() => onGoToPricingForService(selectedService)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Coins className="w-4 h-4" />
                <span>إدارة تسعير وتغطية هذا القسم</span>
              </button>
            )}
          </div>

          {/* Discrepancy & Conflict Panel */}
          {activeSummary.discrepancies.length > 0 && (
            <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-black text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>تنبيهات التعارض أو التناقض بين الجداول ({activeSummary.discrepancies.length})</span>
              </div>
              <div className="space-y-1.5">
                {activeSummary.discrepancies.map((d) => (
                  <div
                    key={d.id}
                    className="bg-slate-950/70 border border-amber-500/20 rounded-xl p-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <span className="font-bold text-white">{d.location_label}</span>
                    <span className="text-amber-200/90 text-[11px]">{d.issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coverage Rows from delivery_area_tariffs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-black text-slate-200 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>سجلات التغطية الجغرافية الفعلية في delivery_area_tariffs ({serviceTariffs.length})</span>
              </h5>
            </div>

            {serviceTariffs.length === 0 ? (
              <div className="py-10 text-center bg-slate-950/50 rounded-2xl border border-slate-800/80 text-xs text-slate-400">
                لا توجد سجلات في جدول <span className="font-mono text-slate-300">delivery_area_tariffs</span> لهذا القسم حالياً.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">المستوى</th>
                      <th className="p-3">النطاق الجغرافي</th>
                      <th className="p-3">جهة التوصيل</th>
                      <th className="p-3">رسوم العميل</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3 text-center">التبديل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/30">
                    {serviceTariffs.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/30">
                        <td className="p-3 font-bold text-slate-200">{getScopeLevelLabelAr(t.scope_level)}</td>
                        <td className="p-3">
                          <div className="font-bold text-white">
                            {[t.governorate_name_ar, t.center_name_ar !== '—' ? t.center_name_ar : null, t.area_name_ar !== '—' ? t.area_name_ar : null]
                              .filter(Boolean)
                              .join(' / ')}
                          </div>
                          {t.geo_is_active === false && (
                            <span className="text-[10px] text-rose-400 block mt-0.5">
                              تحذير: السجل الجغرافي في geo_* معطّل
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-300">
                          {getDeliveryOwnerLabelAr(t.delivery_owner)}
                          {t.restaurant_name && (
                            <span className="block text-[10px] text-amber-300">{t.restaurant_name}</span>
                          )}
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-300">
                          {t.customer_delivery_fee} ج.م
                          {t.is_free_delivery && (
                            <span className="block text-[10px] text-sky-300">توصيل مجاني</span>
                          )}
                        </td>
                        <td className="p-3">
                          {t.is_enabled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> مفعّل
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                              <XCircle className="w-3 h-3" /> معطّل
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {canManageAreas ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => onToggleTariffEnabled(t, !t.is_enabled)}
                              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 border cursor-pointer transition-colors ${
                                t.is_enabled
                                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                              <span>{t.is_enabled ? 'تعطيل' : 'تفعيل'}</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500">عرض فقط</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Compare with restaurant_section_service_areas specifically when inspecting ready_food */}
          {selectedService === 'ready_food' && (
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h5 className="text-xs font-black text-amber-300 flex items-center gap-2">
                  <Store className="w-4 h-4" />
                  <span>
                    نطاقات تشغيل قسم المطاعم في جدول restaurant_section_service_areas ({sectionServiceAreas.length})
                  </span>
                </h5>
                <span className="text-[11px] text-slate-400">
                  للتأكد من عدم تعارض التشغيل بين جدول نطاق القسم وجدول delivery_area_tariffs
                </span>
              </div>

              {sectionServiceAreas.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 text-xs text-slate-400">
                  لا توجد سجلات في جدول <span className="font-mono">restaurant_section_service_areas</span>.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {sectionServiceAreas.map((sec) => (
                    <div
                      key={sec.id}
                      className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 block">
                          {getScopeLevelLabelAr(sec.scope_level)}
                        </span>
                        <span className="text-xs font-black text-white block truncate">
                          {[sec.governorate_name_ar, sec.center_name_ar !== '—' ? sec.center_name_ar : null, sec.area_name_ar !== '—' ? sec.area_name_ar : null]
                            .filter(Boolean)
                            .join(' / ')}
                        </span>
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            sec.is_active
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {sec.is_active ? 'مفعّل' : 'معطّل'}
                        </span>
                      </div>
                      {canManageAreas && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onToggleSectionAreaActive(sec.id, !sec.is_active)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer shrink-0 ${
                            sec.is_active
                              ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                          }`}
                        >
                          {sec.is_active ? 'تعطيل' : 'تفعيل'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
