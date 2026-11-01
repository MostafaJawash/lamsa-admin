/**
 * The single source of every UI string (Modern Standard Arabic, the backend's register).
 * No dialect anywhere. To add English later, create `en.ts` typed as `Messages` and pick
 * the catalog in `index.ts`; components never hold literal text.
 */
export const ar = {
  app: {
    name: "لمسة",
    adminTitle: "لوحة الإدارة",
    loading: "جارٍ التحميل…",
  },
  nav: {
    dashboard: "لوحة التحكم",
    products: "المنتجات",
    categories: "الأقسام",
    brands: "الماركات",
    orders: "الطلبات",
    customers: "العملاء",
    banners: "البانرات",
    notifications: "الإشعارات",
    settings: "الإعدادات",
    openMenu: "فتح القائمة",
    mainNavigation: "التنقل الرئيسي",
    breadcrumbs: "مسار التنقل",
  },
  pages: {
    placeholder: "هذه الصفحة قيد الإنشاء.",
    notFound: "الصفحة غير موجودة",
    notFoundHint: "الرابط الذي طلبته غير صحيح أو لم يعد متوفراً.",
    backToDashboard: "العودة إلى لوحة التحكم",
  },
  auth: {
    loginTitle: "تسجيل الدخول",
    loginHint: "أدخل بيانات حساب الإدارة للمتابعة.",
    phone: "رقم الهاتف",
    phonePlaceholder: "0933 123 456",
    password: "كلمة المرور",
    submit: "دخول",
    submitting: "جارٍ الدخول…",
    logout: "تسجيل الخروج",
    notAdmin: "هذا الحساب لا يملك صلاحية الدخول إلى لوحة الإدارة.",
    sessionEnded: "انتهت الجلسة. يرجى تسجيل الدخول من جديد.",
    mustChangePassword:
      "يجب تغيير كلمة المرور المؤقتة قبل المتابعة. غيّرها من تطبيق المتجر ثم سجّل الدخول من جديد.",
    validation: {
      phoneRequired: "أدخل رقم الهاتف.",
      passwordRequired: "أدخل كلمة المرور.",
    },
  },
  common: {
    retry: "إعادة المحاولة",
    cancel: "إلغاء",
    confirm: "تأكيد",
    close: "إغلاق",
    morePages: "المزيد من الصفحات",
    next: "التالي",
    previous: "السابق",
    page: "صفحة",
    of: "من",
    emptyTitle: "لا توجد بيانات",
    emptyHint: "لا توجد عناصر لعرضها حالياً.",
    errorTitle: "تعذر تحميل البيانات",
  },
  errors: {
    // Fallbacks by backend error code, used only when the backend sent no Arabic message.
    byCode: {
      VALIDATION_ERROR: "البيانات المدخلة غير صحيحة.",
      INTERNAL_ERROR: "حدث خطأ غير متوقع. حاول مرة أخرى لاحقاً.",
      NOT_FOUND: "العنصر المطلوب غير موجود.",
      METHOD_NOT_ALLOWED: "العملية غير مسموحة.",
      NOT_AUTHENTICATED: "يرجى تسجيل الدخول للمتابعة.",
      TOKEN_INVALID: "انتهت الجلسة. يرجى تسجيل الدخول من جديد.",
      TOKEN_EXPIRED: "انتهت الجلسة. يرجى تسجيل الدخول من جديد.",
      TOKEN_REUSED: "أُنهيت الجلسة لأسباب أمنية. يرجى تسجيل الدخول من جديد.",
      INVALID_CREDENTIALS: "رقم الهاتف أو كلمة المرور غير صحيحة.",
      TOO_MANY_ATTEMPTS: "محاولات كثيرة فاشلة. انتظر قليلاً ثم حاول مرة أخرى.",
      ACCOUNT_DISABLED: "هذا الحساب معطّل.",
      ADMIN_ONLY: "هذه العملية متاحة للإدارة فقط.",
      PASSWORD_CHANGE_REQUIRED: "يجب تغيير كلمة المرور المؤقتة أولاً.",
      SERVICE_BUSY: "الخدمة مشغولة حالياً. حاول مرة أخرى بعد قليل.",
      FILE_TOO_LARGE: "حجم الملف أكبر من المسموح.",
      INVALID_IMAGE: "الملف ليس صورة صالحة (JPEG أو PNG أو WEBP).",
      INVALID_STATUS_TRANSITION: "لا يمكن نقل الطلب إلى هذه الحالة.",
      HTTP_ERROR: "تعذر إكمال الطلب.",
    } as Readonly<Record<string, string>>,
    network: "تعذر الاتصال بالخادم. تحقق من الاتصال وحاول مرة أخرى.",
    timeout: "استغرق الطلب وقتاً طويلاً. حاول مرة أخرى.",
    unknown: "حدث خطأ غير متوقع.",
  },
  orderStatus: {
    pending: "تم استلام الطلب",
    preparing: "قيد التجهيز",
    shipped: "تم الشحن",
    delivered: "وصل",
    cancelled: "ملغى",
  },
} as const;

type Widen<T> = T extends string
  ? string
  : T extends Readonly<Record<string, infer V>>
    ? string extends keyof T
      ? Readonly<Record<string, V>>
      : { readonly [K in keyof T]: Widen<T[K]> }
    : T;

/** The shape every language catalog must have. */
export type Messages = Widen<typeof ar>;
