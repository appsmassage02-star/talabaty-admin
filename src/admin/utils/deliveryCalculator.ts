/**
 * Standard Delivery Fee Calculator and Location Availability Engine
 * Enforces the strict priority rules for Talabat Al-Bayt invoices and delivery orders.
 */

import { DeliveryGovernorateSetting, DeliveryServiceSettings } from '../types';
import { matchEgyptGovernorate, normalizeLocationText } from './egyptLocations';

export interface DeliveryCalculationResult {
  available: boolean;
  delivery_fee: number;
  source: 'governorate_custom' | 'general_default' | 'disabled';
  governorate_name?: string;
  governorate_code?: string;
  estimated_time?: string | null;
  errorMessage?: string;
}

/**
 * Calculates delivery fee and checks service availability based on customer's governorate.
 * 
 * Strict Rules:
 * 1. If governorate is configured in delivery_governorate_settings:
 *    - If is_active is true => ALWAYS use its custom delivery_fee.
 *    - If is_active is false => Delivery is strictly UNAVAILABLE. Never fallback to default fee!
 * 2. If governorate is NOT configured at all in delivery_governorate_settings:
 *    - Fallback to general default delivery fee (if delivery is enabled globally).
 */
export function calculateDeliveryFee(
  customerGovernorateInput: string,
  governorateSettings: DeliveryGovernorateSetting[],
  generalSettings: DeliveryServiceSettings | null
): DeliveryCalculationResult {
  // 1. Check global delivery status
  if (generalSettings && generalSettings.delivery_enabled === false) {
    return {
      available: false,
      delivery_fee: 0,
      source: 'disabled',
      errorMessage: 'خدمة التوصيل معطلة حالياً في النظام بالكامل.',
    };
  }

  const defaultFee = generalSettings?.default_delivery_fee ?? 20;

  if (!customerGovernorateInput || !customerGovernorateInput.trim()) {
    // If no governorate specified, fallback to general default
    return {
      available: true,
      delivery_fee: defaultFee,
      source: 'general_default',
      governorate_name: 'افتراضي عام',
      errorMessage: undefined,
    };
  }

  const rawInput = customerGovernorateInput.trim();
  const inputNorm = normalizeLocationText(rawInput);
  const matchedOfficialGov = matchEgyptGovernorate(rawInput);

  // 2. Find ALL matching settings in delivery_governorate_settings
  // Handles official codes, Arabic names, English names, and legacy/duplicate entries
  const isSettingMatch = (s: DeliveryGovernorateSetting): boolean => {
    if (!s) return false;

    // A. Check against official governorate match
    if (matchedOfficialGov) {
      const sCodeUpper = (s.governorate_code || '').trim().toUpperCase();
      if (sCodeUpper && sCodeUpper === matchedOfficialGov.code.toUpperCase()) {
        return true;
      }
      if (sCodeUpper && sCodeUpper === matchedOfficialGov.name_en.toUpperCase()) {
        return true;
      }
      const sGovByCode = matchEgyptGovernorate(s.governorate_code);
      if (sGovByCode && sGovByCode.code === matchedOfficialGov.code) {
        return true;
      }
      const sGovByName = matchEgyptGovernorate(s.governorate_name);
      if (sGovByName && sGovByName.code === matchedOfficialGov.code) {
        return true;
      }
    }

    // B. Direct raw code or name match
    if (s.governorate_code && s.governorate_code.trim().toUpperCase() === rawInput.toUpperCase()) {
      return true;
    }

    // C. Normalized Arabic string match
    const sNorm = normalizeLocationText(s.governorate_name);
    if (sNorm && (sNorm === inputNorm || inputNorm.includes(sNorm) || sNorm.includes(inputNorm))) {
      return true;
    }

    // D. Check against official Arabic name
    if (matchedOfficialGov) {
      const offNorm = normalizeLocationText(matchedOfficialGov.name_ar);
      if (sNorm && (sNorm === offNorm || offNorm.includes(sNorm) || sNorm.includes(offNorm))) {
        return true;
      }
    }

    return false;
  };

  const matchingSettings = governorateSettings.filter(isSettingMatch);

  // 3. Resolve matched setting
  let matchedSetting: DeliveryGovernorateSetting | undefined;

  if (matchingSettings.length > 0) {
    // CRITICAL RESOLUTION RULE FOR DUPLICATES:
    // If multiple entries exist for this governorate (e.g. SOHAG [active] and سوهاج [inactive]),
    // ALWAYS PREFER the ACTIVE record so customer orders and the simulator reflect active service!
    const activeSetting = matchingSettings.find((s) => s.is_active === true);
    if (activeSetting) {
      matchedSetting = activeSetting;
    } else {
      matchedSetting = matchingSettings[0];
    }
  }

  // 4. Evaluate matching result
  if (matchedSetting) {
    // Prefer official Arabic name if available or Arabic text over raw uppercase English
    const govDisplayName =
      matchedOfficialGov?.name_ar ||
      (matchedSetting.governorate_name && !/^[A-Z\s_-]+$/.test(matchedSetting.governorate_name)
        ? matchedSetting.governorate_name
        : matchedOfficialGov?.name_ar || matchedSetting.governorate_name || rawInput);

    // RULE 2: If configured and DISABLED (is_active === false)
    if (matchedSetting.is_active === false) {
      return {
        available: false,
        delivery_fee: 0,
        source: 'disabled',
        governorate_name: govDisplayName,
        governorate_code: matchedSetting.governorate_code,
        errorMessage: `عذراً، خدمة التوصيل غير متوفرة حالياً في محافظة ${govDisplayName}`,
      };
    }

    // RULE 1: If configured and ACTIVE (is_active === true)
    return {
      available: true,
      delivery_fee: Number(matchedSetting.delivery_fee),
      source: 'governorate_custom',
      governorate_name: govDisplayName,
      governorate_code: matchedSetting.governorate_code,
      estimated_time: matchedSetting.estimated_delivery_time,
      errorMessage: undefined,
    };
  }

  // RULE 3: Governorate is unlisted in delivery_governorate_settings
  // Fallback to general default delivery fee
  const fallbackGovName = matchedOfficialGov?.name_ar || rawInput;
  return {
    available: true,
    delivery_fee: defaultFee,
    source: 'general_default',
    governorate_name: fallbackGovName,
    governorate_code: matchedOfficialGov?.code,
    errorMessage: undefined,
  };
}
