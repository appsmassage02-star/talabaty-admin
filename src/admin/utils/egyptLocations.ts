/**
 * Official Egyptian Governorates and Markazes (Centers) Directory
 * Provides standardized codes, Arabic names, normalized search, and centers.
 */

export interface EgyptGovernorateData {
  code: string;
  name_ar: string;
  name_en: string;
  markazes: string[];
}

export const EGYPT_GOVERNORATES: EgyptGovernorateData[] = [
  {
    code: 'CAI',
    name_ar: 'القاهرة',
    name_en: 'Cairo',
    markazes: [
      'مدينة نصر',
      'مصر الجديدة',
      'المعادي',
      'التجمع الخامس',
      'شبرا',
      'وسط البلد',
      'الزمالك',
      'حلوان',
      'المقطم',
      'عين شمس',
      'المرج',
      'الزيتون',
      'روض الفرج',
      'بولاق',
    ],
  },
  {
    code: 'GZ',
    name_ar: 'الجيزة',
    name_en: 'Giza',
    markazes: [
      'الدقي',
      'المهندسين',
      'العجوزة',
      'الهرم',
      'فيصل',
      'مدينة 6 أكتوبر',
      'الشيخ زايد',
      'العمرانية',
      'بولاق الدكرور',
      'إمبابة',
      'البدرشين',
      'العياط',
      'أطفيح',
      'الصف',
      'أوسيم',
      'منشأة القناطر',
    ],
  },
  {
    code: 'ALX',
    name_ar: 'الإسكندرية',
    name_en: 'Alexandria',
    markazes: [
      'سموحة',
      'سيدي جابر',
      'محرم بك',
      'العطارين',
      'المنتزه',
      'الرمل',
      'سيدي بشر',
      'العجمي',
      'العامرية',
      'برج العرب',
    ],
  },
  {
    code: 'SHG',
    name_ar: 'سوهاج',
    name_en: 'Sohag',
    markazes: [
      'سوهاج',
      'أخميم',
      'المراغة',
      'طهطا',
      'طما',
      'المنشأة',
      'جرجا',
      'البلينا',
      'دار السلام',
      'جهينة',
      'ساقلتة',
    ],
  },
  {
    code: 'AST',
    name_ar: 'أسيوط',
    name_en: 'Asyut',
    markazes: [
      'أسيوط',
      'ديروط',
      'القوصية',
      'أبنوب',
      'منفلوط',
      'الفتح',
      'أبو تيج',
      'الغنايم',
      'ساحل سليم',
      'البداري',
      'صدفا',
    ],
  },
  {
    code: 'QN',
    name_ar: 'قنا',
    name_en: 'Qena',
    markazes: [
      'قنا',
      'نجع حمادي',
      'قوص',
      'دشنا',
      'أبو تشت',
      'فرشوط',
      'قفط',
      'نقادة',
      'الوقف',
    ],
  },
  {
    code: 'LX',
    name_ar: 'الأقصر',
    name_en: 'Luxor',
    markazes: [
      'الأقصر',
      'إسنا',
      'أرمنت',
      'البياضية',
      'الطود',
      'القرنة',
      'الزينية',
    ],
  },
  {
    code: 'ASW',
    name_ar: 'أسوان',
    name_en: 'Aswan',
    markazes: [
      'أسوان',
      'إدفو',
      'كوم أمبو',
      'دراو',
      'نصر النوبة',
    ],
  },
  {
    code: 'MN',
    name_ar: 'المنيا',
    name_en: 'Minya',
    markazes: [
      'المنيا',
      'ملوي',
      'مغاغة',
      'بني مزار',
      'سمالوط',
      'أبو قرقاص',
      'مطاي',
      'دير مواس',
      'العدوة',
    ],
  },
  {
    code: 'BNS',
    name_ar: 'بني سويف',
    name_en: 'Beni Suef',
    markazes: [
      'بني سويف',
      'الواسطى',
      'ناصر',
      'إهناسيا',
      'ببا',
      'الفشن',
      'سمسطا',
    ],
  },
  {
    code: 'FYM',
    name_ar: 'الفيوم',
    name_en: 'Fayoum',
    markazes: [
      'الفيوم',
      'سنورس',
      'إطسا',
      'طامية',
      'أبشواي',
      'يوسف الصديق',
    ],
  },
  {
    code: 'QLB',
    name_ar: 'القليوبية',
    name_en: 'Qalyubia',
    markazes: [
      'بنها',
      'شبرا الخيمة',
      'قليوب',
      'الخانكة',
      'القناطر الخيرية',
      'طوخ',
      'شبين القناطر',
      'كفر شكر',
      'العبور',
      'قها',
    ],
  },
  {
    code: 'SHR',
    name_ar: 'الشرقية',
    name_en: 'Sharqia',
    markazes: [
      'الزقازيق',
      'العاشر من رمضان',
      'بلبيس',
      'منيا القمح',
      'فاقوس',
      'أبو حماد',
      'ههيا',
      'أبو كبير',
      'الحسينية',
      'كفر صقر',
      'أولاد صقر',
      'ديرب نجم',
      'الإبراهيمية',
      'مشتول السوق',
      'القرين',
      'القنايات',
      'صان الحجر',
      'منشأة أبو عمر',
    ],
  },
  {
    code: 'DK',
    name_ar: 'الدقهلية',
    name_en: 'Dakahlia',
    markazes: [
      'المنصورة',
      'ميت غمر',
      'السنبلاوين',
      'دكرنس',
      'بلقاس',
      'أجا',
      'المنزلة',
      'طلخا',
      'شربين',
      'بني عبيد',
      'تمى الأمديد',
      'نبروه',
      'ميت سلسيل',
      'منية النصر',
    ],
  },
  {
    code: 'GH',
    name_ar: 'الغربية',
    name_en: 'Gharbia',
    markazes: [
      'طنطا',
      'المحلة الكبرى',
      'كفر الزيات',
      'زفتى',
      'السنطة',
      'سمنود',
      'بسيون',
      'قطور',
    ],
  },
  {
    code: 'MNF',
    name_ar: 'المنوفية',
    name_en: 'Monufia',
    markazes: [
      'شبين الكوم',
      'منوف',
      'أشمون',
      'سرس الليان',
      'قويسنا',
      'بركة السبع',
      'تلا',
      'الشهداء',
      'السادات',
    ],
  },
  {
    code: 'BH',
    name_ar: 'البحيرة',
    name_en: 'Beheira',
    markazes: [
      'دمنهور',
      'كفر الدوار',
      'رشيد',
      'إدكو',
      'أبو المطامير',
      'أبو حمص',
      'الدلنجات',
      'المحمودية',
      'حوش عيسى',
      'كوم حمادة',
      'بدر',
      'وادي النطرون',
      'إيتاي البارود',
      'شبراخيت',
    ],
  },
  {
    code: 'KFS',
    name_ar: 'كفر الشيخ',
    name_en: 'Kafr El Sheikh',
    markazes: [
      'كفر الشيخ',
      'دسوق',
      'فوه',
      'مطوبس',
      'قلين',
      'سيدي سالم',
      'الرياض',
      'بيلا',
      'الحامول',
      'بلطيم',
    ],
  },
  {
    code: 'DT',
    name_ar: 'دمياط',
    name_en: 'Damietta',
    markazes: [
      'دمياط',
      'رأس البر',
      'فارسكور',
      'الزرقا',
      'كفر سعد',
      'كفر البطيخ',
    ],
  },
  {
    code: 'PTS',
    name_ar: 'بورسعيد',
    name_en: 'Port Said',
    markazes: [
      'بورفؤاد',
      'حي الشرق',
      'حي العرب',
      'حي المناخ',
      'حي الضواحي',
      'حي الجنوب',
      'حي الزهور',
    ],
  },
  {
    code: 'ISM',
    name_ar: 'الإسماعيلية',
    name_en: 'Ismailia',
    markazes: [
      'الإسماعيلية',
      'فايد',
      'القنطرة شرق',
      'القنطرة غرب',
      'التل الكبير',
      'أبو صوير',
      'القصاصين',
    ],
  },
  {
    code: 'SUZ',
    name_ar: 'السويس',
    name_en: 'Suez',
    markazes: [
      'حي السويس',
      'حي الأربعين',
      'حي عتاقة',
      'حي الجناين',
      'حي فيصل',
    ],
  },
  {
    code: 'RS',
    name_ar: 'البحر الأحمر',
    name_en: 'Red Sea',
    markazes: [
      'الغردقة',
      'سفاجا',
      'القصير',
      'مرسى علم',
      'رأس غارب',
      'الشلاتين',
      'حلايب',
    ],
  },
  {
    code: 'NV',
    name_ar: 'الوادي الجديد',
    name_en: 'New Valley',
    markazes: [
      'الخارجة',
      'الداخلة',
      'الفرافرة',
      'باريس',
      'بلاط',
    ],
  },
  {
    code: 'MT',
    name_ar: 'مطروح',
    name_en: 'Matrouh',
    markazes: [
      'مرسى مطروح',
      'الحمام',
      'العلمين',
      'الضبعة',
      'النجيلة',
      'سيدي براني',
      'السلوم',
      'سيوة',
    ],
  },
  {
    code: 'SIN',
    name_ar: 'شمال سيناء',
    name_en: 'North Sinai',
    markazes: [
      'العريش',
      'الشيخ زويد',
      'رفح',
      'بئر العبد',
      'الحسنة',
      'نخل',
    ],
  },
  {
    code: 'SIS',
    name_ar: 'جنوب سيناء',
    name_en: 'South Sinai',
    markazes: [
      'شرم الشيخ',
      'طور سيناء',
      'دهب',
      'نويبع',
      'طابا',
      'رأس سدر',
      'أبو زنيمة',
      'أبو رديس',
      'سانت كاترين',
    ],
  },
];

/**
 * Normalizes Arabic text for tolerant string matching:
 * - strips "محافظة"
 * - unifies Alef forms (أ, إ, آ -> ا)
 * - unifies Taa Marbuta and Haa (ة -> ه)
 * - unifies Yaa (ى -> ي)
 * - removes diacritics and excessive whitespace
 */
export function normalizeLocationText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/^محافظة\s+/g, '')
    .replace(/^مدينة\s+/g, '')
    .replace(/^مركز\s+/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // remove Arabic tashkeel
    .replace(/[-_/,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Finds the matching Egyptian governorate definition from any input
 * (code, arabic name, english name, or combined string like "سوهاج - مركز المراغة")
 */
export function matchEgyptGovernorate(input: string): EgyptGovernorateData | null {
  if (!input || !input.trim()) return null;
  const raw = input.trim();
  const rawUpper = raw.toUpperCase();

  // Common alternative code / English name aliases mapping to official codes
  const CODE_ALIASES: Record<string, string> = {
    SOHAG: 'SHG',
    CAIRO: 'CAI',
    ALEX: 'ALX',
    ALEXANDRIA: 'ALX',
    GIZA: 'GZ',
    ASYUT: 'AST',
    ASSIUT: 'AST',
    DAKAHLIA: 'DK',
    MANSOURA: 'DK',
    GHARBIA: 'GH',
    TANTA: 'GH',
    SHARQIA: 'SHR',
    ZAGAZIG: 'SHR',
    ISMAILIA: 'IS',
    SUEZ: 'SUZ',
    PORTSAID: 'PTS',
    ASWAN: 'ASW',
    LUXOR: 'LX',
    QENA: 'QNA',
    MINYA: 'MN',
    BENISUEF: 'BNS',
    FAYOUM: 'FYM',
    REDSEA: 'RS',
    HURGHADA: 'RS',
    MATROUH: 'MT',
    SINAI: 'SIN',
    MONUFIA: 'MNF',
    QALYUBIA: 'KB',
    KAFRELSHEIKH: 'KFS',
    BEHEIRA: 'BH',
    DAMIETTA: 'DT',
  };

  const resolvedCode = CODE_ALIASES[rawUpper] || rawUpper;

  // 1. Direct code match (or via alias)
  const byCode = EGYPT_GOVERNORATES.find(
    (g) => g.code.toUpperCase() === resolvedCode || g.code.toUpperCase() === rawUpper
  );
  if (byCode) return byCode;

  const normalized = normalizeLocationText(raw);

  // 2. Exact match by Arabic or English name
  const byExactName = EGYPT_GOVERNORATES.find(
    (g) =>
      normalizeLocationText(g.name_ar) === normalized ||
      g.name_en.toLowerCase() === raw.toLowerCase() ||
      rawUpper === g.name_en.toUpperCase()
  );
  if (byExactName) return byExactName;

  // 3. Substring / token matching (e.g. "محافظة سوهاج - مركز المراغة")
  for (const gov of EGYPT_GOVERNORATES) {
    const govNorm = normalizeLocationText(gov.name_ar);
    if (normalized.includes(govNorm) || govNorm.includes(normalized)) {
      return gov;
    }
  }

  // 4. Check if the input is a Markaz name that uniquely maps to a governorate
  for (const gov of EGYPT_GOVERNORATES) {
    for (const markaz of gov.markazes) {
      const markazNorm = normalizeLocationText(markaz);
      if (normalized.includes(markazNorm) || markazNorm.includes(normalized)) {
        return gov;
      }
    }
  }

  return null;
}
