<div align="center">

# 🧹 Cleanup

### Clean up your device and optimize storage in seconds

**إصنع بـ حب من الإمارات 🇦🇪**

[تصميم وتطوير: Binnoma](https://github.com/binnoma)

---

</div>

## 📖 نبذة عن المشروع

تطبيق **Cleanup** هو نسخة ويب مُعاد بناؤها من تطبيق iOS الشهير الذي يحمل نفس الاسم (by DevMeApp، تقييم 4.5★ على App Store). يساعد المستخدمين على استعادة مساحة التخزين من خلال العثور على الصور المكررة والضبابية ولقطات الشاشة غير الضرورية والفيديوهات الكبيرة وحذفها بسهولة عبر واجهة سحب أنيقة مستوحاة من Tinder.

الهدف الأساسي هو تقديم تجربة أصلية (native-like) على المتصفح مع إمكانية استيراد الصور الحقيقية من جهاز المستخدم وتصنيفها تلقائياً وحذفها فوراً مع استجابة بصرية لحظية.

---

## ✨ الميزات الرئيسية

| الميزة | الوصف |
|--------|-------|
| 🔍 **فحص ذكي** | فحص متحرك مع شريط تقدم لتحليل الصور والبحث عن المكررات والفوضى |
| 👆 **وضع السحب (Swipe)** | اسحب لليمين للحفظ ولليسار للحذف - مثل Tinder |
| ⚡ **تنظيف ذكي (Smart Clean)** | نظف كل الفئات دفعة واحدة بنقرة واحدة |
| 📂 **9 فئات تصنيف** | مكررات، لقطات شاشة، سيلفي، فيديوهات، متشابهة، ضبابية، حية، قديمة، جميع الصور |
| 🗑️ **حذف فوري مرئي** | الصور تختفي لحظياً مع حركات متحركة (AnimatePresence) |
| 📱 **حوار تأكيد iOS** | نافذة تأكيد حذف أصلية بأسلوب iOS مع خلفية ضبابية |
| 📥 **استيراد الصور** | سحب وإفلات أو تصفح الملفات مع دعم حتى 30,000 صورة |
| 🎨 **واجهة iOS داكنة** | تصميم أصلي مستوحى من iOS مع تأثيرات زجاجية وضبابية |
| 📊 **حلقة التخزين** | عرض دائري متحرك لنسبة استخدام التخزين |
| 🎯 **وضع الاختيار** | اختر صور متعددة أو الكل ثم احذف دفعة واحدة |

---

## 🏗️ هيكل المشروع

```
cleanup-app/
├── 📄 package.json              # تبعيات المشروع والسكريبتات
├── 📄 tsconfig.json             # إعدادات TypeScript
├── 📄 next.config.ts            # إعدادات Next.js
├── 📄 postcss.config.mjs        # إعدادات PostCSS مع Tailwind
├── 📄 eslint.config.mjs         # إعدادات ESLint
├── 📄 README.md                 # التوثيق (هذا الملف)
│
├── 📁 public/                   # الملفات الثابتة
│   ├── favicon.ico
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
│
└── 📁 src/                      # الكود المصدري
    ├── 📁 app/                  # Next.js App Router
    │   ├── 📄 layout.tsx        # التخطيط الرئيسي (35 سطر)
    │   ├── 📄 page.tsx          # الصفحة الرئيسية - كل المكونات (1,046 سطر)
    │   ├── 📄 globals.css       # الأنماط العامة بأسلوب iOS (139 سطر)
    │   └── 📄 favicon.ico
    │
    └── 📁 store/                # إدارة الحالة
        └── 📄 photoStore.ts     # Zustand store - الصور والفئات (320 سطر)
```

**إجمالي الأسطر:** ~1,540 سطر كود مكتوب يدوياً

---

## 🧩 المكونات الرئيسية

### `page.tsx` — الصفحة الرئيسية (1,046 سطر)

تحتوي على جميع المكونات والشاشات:

| المكون | الوصف |
|--------|-------|
| `CleanupApp` | المكوّن الرئيسي - يتحكم في التنقل بين الشاشات |
| `StorageRing` | حلقة دائرية SVG متحركة لعرض نسبة التخزين |
| `PhotoCard` | بطاقة صورة مع تحديد وحذف مع حركات خروج متحركة |
| `SwipeCard` | بطاقة سحب مع إيماءات Framer Motion و مؤشرات بصرية |
| `DeleteConfirmDialog` | حوار تأكيد حذف بأسلوب iOS مع خلفية ضبابية |
| `formatSize()` | تحويل البايتات إلى KB/MB/GB قابل للقراءة |
| `formatDate()` | تنسيق التواريخ بشكل مختصر |

### `photoStore.ts` — مخزن الحالة (320 سطر)

إدارة حالة مركزية باستخدام Zustand:

```typescript
interface PhotoState {
  photos: Photo[]                    // مصفوفة الصور (حتى 30,000)
  selectedPhotos: Set<string>        // الصور المحددة
  currentScreen: Screen              | الشاشة الحالية
  activeCategory: string | null      // الفئة النشطة
  scanComplete: boolean              | حالة الفحص
  // ... + 13 دالة تعديل
}
```

**9 فئات تصنيف الصور:**

| # | الفئة | الأيقونة | اللون | الوصف |
|---|-------|----------|-------|-------|
| 1 | `duplicates` | Copy | 🔴 #EF4444 | الصور المكررة |
| 2 | `screenshots` | Monitor | 🟡 #F59E0B | لقطات الشاشة |
| 3 | `selfies` | User | 🩷 #EC4899 | صور السيلفي |
| 4 | `videos` | Video | 🟣 #8B5CF6 | الفيديوهات |
| 5 | `similar` | Layers | 🔵 #3B82F6 | الصور المتشابهة |
| 6 | `blurry` | Droplet | 🟤 #6366F1 | الصور الضبابية |
| 7 | `livePhotos` | Sparkles | 🩵 #14B8A6 | الصور الحية |
| 8 | `oldPhotos` | Clock | ⚪ #78716C | الصور القديمة |
| 9 | `allPhotos` | Grid | 🟢 #10B981 | جميع الصور |

### `globals.css` — الأنماط (139 سطر)

- نظام ألوان iOS داكن مع متغيرات CSS
- تأثيرات زجاجية وضبابية (`ios-backdrop`, `glass-card`)
- رسوم متحركة مخصصة (`draw-ring`, `shimmer`, `fadeInUp`)
- دعم المنطقة الآمنة لـ iOS (`safe-bottom`, `safe-top`)
- إخفاء شريط التمرير

### `layout.tsx` — التخطيط (35 سطر)

- إعدادات Viewport للموبايل
- دعم PWA عبر Apple Web App metadata
- لون ثيم أسود

---

## 🖥️ الشاشات والتدفق

```
┌─────────────┐
│  Welcome /   │  ← الشاشة الأولى: Start Scan أو Load Demo
│  Scan Screen │
└──────┬───────┘
       │
       ▼
┌─────────────┐
│   Home       │  ← لوحة التحكم: حلقة التخزين + الإجراءات + الفئات
│  Dashboard   │
└──┬───┬───┬───┘
   │   │   │
   ▼   ▼   ▼
┌────┐┌────┐┌────────┐
│Cat ││Swipe││Smart   │  ← الشاشات الفرعية
│Gal ││Mode ││Clean   │
└────┘└────┘└────────┘
   │
   ▼
┌────────┐  ┌─────────┐
│Import  │  │Results  │  ← شاشات إضافية
│Screen  │  │Screen   │
└────────┘  └─────────┘
```

---

## ⚙️ التقنيات المستخدمة

| التقنية | الإصدار | الغرض |
|---------|---------|-------|
| **Next.js** | 16.2.4 | إطار عمل React مع App Router و SSR |
| **React** | 19.2.4 | مكتبة واجهة المستخدم |
| **TypeScript** | 5.x | لغة مكتوبة نوعياً |
| **Tailwind CSS** | 4.x | إطار عمل CSS utility-first |
| **Zustand** | 5.0.12 | إدارة حالة خفيفة وسريعة |
| **Framer Motion** | 12.38.0 | حركات وانتقالات متحركة |
| **Lucide React** | 1.8.0 | مكتبة أيقونات SVG |

---

## 🚀 التشغيل

### المتطلبات
- Node.js 18.17 أو أحدث
- npm أو bun

### التثبيت

```bash
# استنساخ المشروع
git clone https://github.com/binnoma/cleanup-app.git
cd cleanup-app

# تثبيت التبعيات
npm install
```

### التشغيل

```bash
# وضع التطوير
npm run dev

# بناء للإنتاج
npm run build

# تشغيل نسخة الإنتاج
npm start
```

### فتح التطبيق

افتح [http://localhost:3000](http://localhost:3000) في المتصفح

---

## 🔑 المعالم التقنية المهمة

### حذف فوري مرئي
أحد أهم المعالم في المشروع - عند حذف صورة، تختفي فوراً من الواجهة مع حركة انكماش وتلاشي:

```typescript
// في photoStore.ts - الحذف يزيل من الحالة مباشرة
deletePhotos: (ids: string[]) => {
  set((state) => ({
    photos: state.photos.filter((p: Photo) => !ids.includes(p.id)),
    selectedPhotos: new Set([...state.selectedPhotos]
      .filter((id: string) => !ids.includes(id)))
  }))
}

// في page.tsx - AnimatePresence يوفر حركة الخروج
<AnimatePresence mode="popLayout">
  {photos.map(photo => (
    <PhotoCard key={photo.id} ... />
  ))}
</AnimatePresence>
```

### حوار تأكيد iOS أصلي
نافذة تأكيد الحذف مصممة لتطابق تجربة iOS الأصلية:

- خلفية ضبابية (`backdrop-filter: blur(20px)`)
- أيقونة تحذير حمراء
- أزرار Cancel/Delete بنمط iOS
- حركة ظهور نابضية (spring animation)

### إيماءات السحب
بطاقات السحب تستخدم Framer Motion:

- سحب أفقي مع مرونة (elastic: 0.7)
- تدوير البطاقة أثناء السحب
- مؤشرات بصرية (DELETE/KEEP) تظهر بشفافية متغيرة
- عتبة 80px لتحديد اتجاه السحب

### دعم 30,000 صورة
المخزن مصمم للتعامل مع حجم كبير من الصور:

- حد أقصى 30,000 صورة
- استخدام `Set<string>` للتحديد السريع
- `useMemo` لحساب الإحصائيات
- تحميل كسول للصور (`loading="lazy"`)

---

## 📝 إعدادات TypeScript

```json
{
  "target": "ES2017",
  "strict": true,
  "module": "esnext",
  "moduleResolution": "bundler",
  "jsx": "react-jsx",
  "paths": { "@/*": ["./src/*"] }
}
```

---

## 📄 الترخيص

هذا المشروع خاص ومالكه **Binnoma**. جميع الحقوق محفوظة.

---

<div align="center">

**صُنع بـ ❤️ من الإمارات 🇦🇪**

**تصميم وتطوير: [Binnoma](https://github.com/binnoma)**

</div>
