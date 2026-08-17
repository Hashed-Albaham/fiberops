/**
 * FiberOps — غرفة التحكم الميدانية: أسطح تشغيل داكنة، أزرق نبض شبكي للحركة،
 * وألوان حالة محجوزة للمعنى. يحافظ هذا الملف على تسلسل: تنبيه، قرار، ثم تفاصيل.
 */
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpLeft,
  Bell,
  Boxes,
  Cable,
  CalendarClock,
  Check,
  ChevronLeft,
  CircleDotDashed,
  ClipboardCheck,
  Clock3,
  FileWarning,
  Gauge,
  HardHat,
  LayoutDashboard,
  Menu,
  Network,
  PackageCheck,
  Plus,
  RadioTower,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Truck,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";

type View = "dashboard" | "inventory" | "permits";
type InventoryTab = "drums" | "equipment";
type Tone = "good" | "warning" | "danger" | "info" | "neutral";
type ModalState =
  | { kind: "cable"; id: string }
  | { kind: "equipment"; id: string }
  | null;

type CableDrum = {
  id: string;
  spec: string;
  supplier: string;
  total: number;
  remaining: number;
  project: string;
  location: string;
};

type Equipment = {
  id: string;
  name: string;
  serial: string;
  calibration: string;
  tech: string;
  status: "جاهز" | "قيد الاستخدام" | "معايرة مطلوبة";
};

type Permit = {
  id: string;
  issuer: "الأشغال العامة" | "المرور" | "البلدية";
  route: string;
  start: string;
  end: string;
  status: "سارٍ" | "ينتهي قريباً" | "منتهي";
};

const assetUrls = {
  hero: "/manus-storage/fiberops-hero_a4709e7e.png",
  route: "/manus-storage/fiberops-route_1d0f64cf.png",
  diagnostics: "/manus-storage/fiberops-diagnostics_050bb87b.png",
  mark: "/manus-storage/fiberops-mark_fc6c0774.png",
};

const initialCableDrums: CableDrum[] = [
  {
    id: "DR-96-044",
    spec: "Corning 96-Core SM G.652D",
    supplier: "Corning Gulf",
    total: 4000,
    remaining: 1340,
    project: "FTTH — حي النخيل",
    location: "المستودع المركزي A2",
  },
  {
    id: "DR-48-118",
    spec: "Prysmian 48-Core ADSS",
    supplier: "Prysmian",
    total: 3000,
    remaining: 410,
    project: "FTTH — قطاع الروضة",
    location: "المستودع المركزي B1",
  },
  {
    id: "DR-24-203",
    spec: "Nexans 24-Core Underground",
    supplier: "Nexans Middle East",
    total: 2000,
    remaining: 1765,
    project: "صيانة شبكة الغرب",
    location: "مستودع فرعي — غرب 03",
  },
  {
    id: "DR-144-009",
    spec: "Corning 144-Core Micro Cable",
    supplier: "Corning Gulf",
    total: 5000,
    remaining: 2970,
    project: "ربط OLT الشمال",
    location: "المستودع المركزي A3",
  },
];

const initialEquipment: Equipment[] = [
  {
    id: "EQ-SP-090",
    name: "Fujikura 90S+ Fusion Splicer",
    serial: "FJK-90S-83941",
    calibration: "صالحة حتى 18 سبتمبر 2026",
    tech: "م. خالد العتيبي",
    status: "قيد الاستخدام",
  },
  {
    id: "EQ-OT-041",
    name: "EXFO MAX-730C OTDR",
    serial: "EXFO-MX-27104",
    calibration: "صالحة حتى 02 أكتوبر 2026",
    tech: "م. محمود سلمان",
    status: "جاهز",
  },
  {
    id: "EQ-PM-018",
    name: "EXFO FPM-602X Power Meter",
    serial: "EXF-PM-82496",
    calibration: "مطلوبة خلال 6 أيام",
    tech: "م. ناصر الحربي",
    status: "معايرة مطلوبة",
  },
  {
    id: "EQ-SP-072",
    name: "Sumitomo T-72C+ Splicer",
    serial: "SUM-T72-11837",
    calibration: "صالحة حتى 29 نوفمبر 2026",
    tech: "م. عادل الزهراني",
    status: "جاهز",
  },
];

const initialPermits: Permit[] = [
  {
    id: "PW-FTTH-6814",
    issuer: "الأشغال العامة",
    route: "شارع الأمير سلطان — قطاع N-12",
    start: "12 أغسطس 2026",
    end: "19 أغسطس 2026",
    status: "ينتهي قريباً",
  },
  {
    id: "TR-ACT-2209",
    issuer: "المرور",
    route: "تقاطع الملك فهد × العليا",
    start: "09 أغسطس 2026",
    end: "26 أغسطس 2026",
    status: "سارٍ",
  },
  {
    id: "MUN-CIV-4791",
    issuer: "البلدية",
    route: "طريق المطار — غرف تفتيش MH-14",
    start: "01 أغسطس 2026",
    end: "15 أغسطس 2026",
    status: "منتهي",
  },
  {
    id: "PW-FTTH-6912",
    issuer: "الأشغال العامة",
    route: "حي الندى — المسار الدائري 3",
    start: "15 أغسطس 2026",
    end: "31 أغسطس 2026",
    status: "سارٍ",
  },
  {
    id: "TR-ACT-2247",
    issuer: "المرور",
    route: "شارع التحلية — منطقة الربط B",
    start: "14 أغسطس 2026",
    end: "20 أغسطس 2026",
    status: "ينتهي قريباً",
  },
];

const routes = [
  { sector: "حي النخيل / N-12", team: "أفق المقاولات — فرقة 03", stage: "تمديد وتمرير", progress: 78, tone: "info" as Tone },
  { sector: "قطاع الروضة / R-07", team: "مسارات الخليج — فرقة 11", stage: "لحام الألياف", progress: 56, tone: "good" as Tone },
  { sector: "طريق المطار / A-04", team: "منشآت الضوء — فرقة 02", stage: "فحص OTDR", progress: 92, tone: "good" as Tone },
  { sector: "حي الندى / D-03", team: "أفق المقاولات — فرقة 05", stage: "حفر وتجهيز", progress: 31, tone: "warning" as Tone },
];

const navItems: { id: View; label: string; icon: typeof LayoutDashboard; detail: string }[] = [
  { id: "dashboard", label: "لوحة التحكم", icon: LayoutDashboard, detail: "نظرة تنفيذية" },
  { id: "inventory", label: "الأصول والمخزون", icon: Boxes, detail: "بكرات ومعدات" },
  { id: "permits", label: "التصاريح والوصول", icon: ClipboardCheck, detail: "اعتمادات المسارات" },
];

const toneStyles: Record<Tone, string> = {
  good: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  warning: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  danger: "border-rose-400/20 bg-rose-400/10 text-rose-200",
  info: "border-sky-400/20 bg-sky-400/10 text-sky-200",
  neutral: "border-slate-500/30 bg-slate-700/40 text-slate-300",
};

function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneStyles[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone === "good" ? "bg-emerald-300" : tone === "warning" ? "bg-amber-300" : tone === "danger" ? "bg-rose-300" : tone === "info" ? "bg-sky-300" : "bg-slate-400"}`} />
      {label}
    </span>
  );
}

function SectionTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 text-[11px] font-bold tracking-[0.22em] text-sky-300/80">{eyebrow}</p>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">{description}</p>
      </div>
      {action}
    </div>
  );
}

function MetricCard({ label, value, unit, change, tone, icon: Icon, footer }: { label: string; value: string; unit: string; change: string; tone: Tone; icon: typeof Activity; footer: string }) {
  const iconStyle: Record<Tone, string> = {
    good: "bg-emerald-400/10 text-emerald-300",
    warning: "bg-amber-400/10 text-amber-300",
    danger: "bg-rose-400/10 text-rose-300",
    info: "bg-sky-400/10 text-sky-300",
    neutral: "bg-slate-500/20 text-slate-300",
  };
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101a25]/90 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)] transition duration-200 hover:-translate-y-0.5 hover:border-sky-400/20">
      <div className="absolute left-0 top-0 h-full w-[2px] bg-gradient-to-b from-transparent via-sky-400/50 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <div className="mt-4 flex items-baseline gap-2" dir="ltr">
            <strong className="font-mono text-3xl font-semibold tracking-tight text-white">{value}</strong>
            <span className="text-xs font-medium text-slate-400">{unit}</span>
          </div>
        </div>
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${iconStyle[tone]}`}>
          <Icon size={19} strokeWidth={1.8} />
        </span>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-3.5">
        <span className="text-[11px] text-slate-500">{footer}</span>
        <span className={`text-[11px] font-semibold ${tone === "danger" ? "text-rose-300" : tone === "warning" ? "text-amber-300" : "text-emerald-300"}`}>{change}</span>
      </div>
    </article>
  );
}

function ActionModal({ modal, cableDrums, equipment, onClose, onConfirm }: { modal: ModalState; cableDrums: CableDrum[]; equipment: Equipment[]; onClose: () => void; onConfirm: (value: string) => void }) {
  const [value, setValue] = useState("250");
  if (!modal) return null;
  const cable = modal.kind === "cable" ? cableDrums.find((item) => item.id === modal.id) : undefined;
  const device = modal.kind === "equipment" ? equipment.find((item) => item.id === modal.id) : undefined;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#03080d]/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="إجراء تشغيلي">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#101a25] shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between border-b border-white/[0.07] p-6">
          <div>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/10 text-sky-300">
              {modal.kind === "cable" ? <Cable size={20} /> : <Wrench size={20} />}
            </div>
            <h2 className="text-lg font-bold text-white">{modal.kind === "cable" ? "صرف كابل للمسار" : "تعيين جهاز لفني"}</h2>
            <p className="mt-1 text-sm text-slate-400">{modal.kind === "cable" ? cable?.spec : device?.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white" aria-label="إغلاق النافذة"><X size={18} /></button>
        </div>
        <div className="space-y-5 p-6">
          {modal.kind === "cable" && cable ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/[0.035] p-3"><span className="block text-[10px] font-bold tracking-wider text-slate-500">البكرة</span><span className="mt-1 block font-mono text-sm text-white">{cable.id}</span></div>
                <div className="rounded-xl bg-white/[0.035] p-3"><span className="block text-[10px] font-bold tracking-wider text-slate-500">المتاح فعلياً</span><span className="mt-1 block font-mono text-sm text-emerald-300">{cable.remaining.toLocaleString("en-US")} م</span></div>
              </div>
              <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-300">الكمية المراد صرفها بالمتر</span><input value={value} onChange={(event) => setValue(event.target.value.replace(/\D/g, ""))} inputMode="numeric" className="w-full rounded-xl border border-white/10 bg-[#0a121b] px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/10" /></label>
              <p className="rounded-lg border border-sky-400/10 bg-sky-400/[0.05] p-3 text-xs leading-6 text-sky-100/80">سيُخصم الرصيد فوراً من البكرة ويُسجل ضمن مشروع <strong>{cable.project}</strong>.</p>
            </>
          ) : device ? (
            <>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4"><span className="text-xs text-slate-500">الرقم التسلسلي</span><p className="mt-1 font-mono text-sm text-white">{device.serial}</p><p className="mt-3 text-xs text-slate-400">حالة المعايرة: <span className="text-emerald-300">{device.calibration}</span></p></div>
              <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-300">الفني المسؤول</span><select value={value} onChange={(event) => setValue(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a121b] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/60"><option>م. خالد العتيبي</option><option>م. محمود سلمان</option><option>م. ناصر الحربي</option><option>م. عادل الزهراني</option></select></label>
            </>
          ) : null}
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-white/[0.07] p-5 sm:flex-row sm:justify-start">
          <button onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5">إلغاء</button>
          <button onClick={() => onConfirm(value)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2F9BFF] px-4 py-2.5 text-sm font-bold text-[#06111b] transition hover:bg-[#59b2ff] active:scale-[0.97]"><Check size={16} />تأكيد الإجراء</button>
        </div>
      </div>
    </div>
  );
}

function DashboardView({ goTo }: { goTo: (view: View) => void }) {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-[#2F9BFF]/20 bg-[#0b1723] px-6 py-8 sm:px-8">
        <div className="absolute inset-0 bg-cover bg-center opacity-45" style={{ backgroundImage: `url(${assetUrls.hero})` }} />
        <div className="absolute inset-0 bg-gradient-to-l from-[#0a1723]/20 via-[#0a1723]/80 to-[#0a1723]" />
        <div className="relative grid gap-7 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-400/[0.09] px-3 py-1.5 text-[11px] font-bold tracking-[0.16em] text-rose-100"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-300" />حالة الآن: قرار مطلوب</div>
            <h1 className="max-w-2xl text-3xl font-bold leading-[1.25] tracking-tight text-white sm:text-4xl">تصريح قطاع N-12 ينتهي غداً. جدّد الاعتماد قبل إرسال فرقة 03.</h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300/80">الأثر المباشر: توقف أعمال التمديد وتمرير الكابل في حي النخيل خلال أقل من 48 ساعة إن لم يتم التجديد.</p>
            <button onClick={() => goTo("permits")} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#2F9BFF] px-4 py-2.5 text-xs font-bold text-[#06111b] transition hover:bg-[#59b2ff] active:scale-[0.97]"><ClipboardCheck size={16} />راجع التصريح واتخذ الإجراء</button>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/[0.08] bg-[#08121b]/55 p-4 backdrop-blur-sm">
            <div><span className="block text-[10px] font-bold tracking-widest text-slate-500">أولوية القرار</span><strong className="mt-1.5 block text-sm text-rose-200">تجديد تصريح</strong></div>
            <div><span className="block text-[10px] font-bold tracking-widest text-slate-500">الفرقة المتأثرة</span><strong className="mt-1.5 block text-sm text-white">أفق — فرقة 03</strong></div>
            <div className="col-span-2 h-px bg-white/[0.08]" />
            <div><span className="block text-[10px] font-bold tracking-widest text-slate-500">نقطة الانقطاع</span><strong className="mt-1.5 block text-sm text-amber-200">بعد 42 ساعة</strong></div>
            <button onClick={() => goTo("permits")} className="flex items-end justify-between text-right text-xs font-semibold text-[#9fcfff] transition hover:text-white"><span>فتح سجل التصاريح</span><ChevronLeft size={15} /></button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="الكيلومترات المنجزة" value="142.8" unit="كم" change="+8.4% هذا الأسبوع" tone="good" icon={Network} footer="من المستهدف 168 كم" />
        <MetricCard label="حالة التصاريح" value="17" unit="تصريح نشط" change="2 تحتاج مراجعة" tone="warning" icon={ClipboardCheck} footer="منها 3 تصاريح حرجة" />
        <MetricCard label="رصيد الكابلات" value="6,485" unit="متر متاح" change="48-Core تحت الحد" tone="danger" icon={Cable} footer="4 بكرات ضمن الجرد" />
        <MetricCard label="جاهزية معدات الميدان" value="91" unit="%" change="3 أجهزة جاهزة" tone="info" icon={Gauge} footer="جهاز واحد للمعايرة" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.9fr]">
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101a25]">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4"><div><h2 className="font-bold text-white">تنبيهات تتطلب قراراً</h2><p className="mt-1 text-xs text-slate-500">الأولوية حسب قرب الأثر الميداني</p></div><Bell size={18} className="text-sky-300" /></div>
          <div className="divide-y divide-white/[0.06]">
            <div className="flex gap-3 p-5"><span className="mt-0.5 rounded-xl bg-rose-400/10 p-2 text-rose-300"><ShieldAlert size={18} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><StatusBadge label="حرج خلال 48 ساعة" tone="danger" /><span className="text-xs text-slate-500">PW-FTTH-6814</span></div><h3 className="mt-2 text-sm font-bold text-white">تصريح حفر قطاع N-12 ينتهي غداً</h3><p className="mt-1 text-xs leading-6 text-slate-400">تحتاج الفرقة 03 إلى تجديد اعتماد الأشغال العامة قبل استمرار التمديد.</p></div><button onClick={() => goTo("permits")} className="shrink-0 self-center text-xs font-bold text-sky-300 hover:text-white">فتح</button></div>
            <div className="flex gap-3 p-5"><span className="mt-0.5 rounded-xl bg-amber-400/10 p-2 text-amber-300"><FileWarning size={18} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><StatusBadge label="حد مخزون منخفض" tone="warning" /><span className="text-xs text-slate-500">DR-48-118</span></div><h3 className="mt-2 text-sm font-bold text-white">بكرة 48-Core وصلت إلى 410 م فقط</h3><p className="mt-1 text-xs leading-6 text-slate-400">مطلوب طلب توريد أو تحويل رصيد قبل استكمال قطاع الروضة.</p></div><button onClick={() => goTo("inventory")} className="shrink-0 self-center text-xs font-bold text-sky-300 hover:text-white">مراجعة</button></div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101a25] p-5">
          <div className="absolute inset-0 bg-cover bg-center opacity-[0.17]" style={{ backgroundImage: `url(${assetUrls.route})` }} />
          <div className="relative"><p className="text-[11px] font-bold tracking-[0.2em] text-sky-300">مؤشر المسارات</p><h2 className="mt-2 text-xl font-bold text-white">القطاع الأسرع تقدماً</h2><p className="mt-1 text-sm text-slate-400">طريق المطار / A-04</p><div className="mt-8"><div className="flex items-center justify-between text-xs"><span className="text-slate-400">فحص OTDR النهائي</span><span className="font-mono font-bold text-emerald-300">92%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full w-[92%] rounded-full bg-gradient-to-l from-emerald-300 to-sky-400" /></div></div><div className="mt-7 flex items-center gap-2 text-xs text-slate-300"><Truck size={15} className="text-sky-300" />جاهز لتسليم نتائج الفحص خلال 6 ساعات</div></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101a25]">
        <div className="flex flex-col gap-4 border-b border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-white">المسارات والقطاعات النشطة</h2><p className="mt-1 text-xs text-slate-500">متابعة المرحلة الحالية ونسبة الإنجاز الميداني</p></div><button onClick={() => toast.info("سيتم تصدير ملخص المسارات عند ربط خدمة التقارير.")} className="inline-flex items-center gap-2 self-start rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.05]"><ArrowDownLeft size={15} />تصدير الملخص</button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-right"><thead className="bg-white/[0.025] text-[10px] font-bold tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3.5">القطاع / المسار</th><th className="px-5 py-3.5">المقاول والفرقة</th><th className="px-5 py-3.5">مرحلة العمل</th><th className="px-5 py-3.5">نسبة الإنجاز</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{routes.map((route) => <tr key={route.sector} className="transition hover:bg-white/[0.025]"><td className="px-5 py-4 text-sm font-semibold text-slate-100">{route.sector}</td><td className="px-5 py-4 text-xs text-slate-400">{route.team}</td><td className="px-5 py-4"><StatusBadge label={route.stage} tone={route.tone} /></td><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/[0.08]"><div className={`h-full rounded-full ${route.tone === "good" ? "bg-emerald-300" : route.tone === "warning" ? "bg-amber-300" : "bg-sky-300"}`} style={{ width: `${route.progress}%` }} /></div><span className="font-mono text-xs font-bold text-white">{route.progress}%</span></div></td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}

function InventoryView({ cableDrums, equipment, activeTab, setActiveTab, onAction }: { cableDrums: CableDrum[]; equipment: Equipment[]; activeTab: InventoryTab; setActiveTab: (tab: InventoryTab) => void; onAction: (modal: ModalState) => void }) {
  return (
    <div>
      <SectionTitle eyebrow="إدارة الأصول" title="المخزون والمعدات" description="قرار اليوم: راجع بكرة 48-Core قبل أن تؤثر على استكمال قطاع الروضة." action={<button onClick={() => toast.success("تم فتح نموذج استلام توريد جديد.")} className="inline-flex items-center gap-2 rounded-xl bg-[#2F9BFF] px-4 py-2.5 text-sm font-bold text-[#07111b] transition hover:bg-[#59b2ff] active:scale-[0.97]"><Plus size={17} />توريد جديد</button>} />
      <div className="mb-6 flex gap-2 border-b border-white/[0.07] pb-4"><button onClick={() => setActiveTab("drums")} className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${activeTab === "drums" ? "bg-sky-400/10 text-sky-200" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}><span className="inline-flex items-center gap-2"><Cable size={16} />بكرات الكابلات <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[10px]">{cableDrums.length}</span></span></button><button onClick={() => setActiveTab("equipment")} className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${activeTab === "equipment" ? "bg-sky-400/10 text-sky-200" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}><span className="inline-flex items-center gap-2"><Wrench size={16} />أجهزة الفحص واللحام <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[10px]">{equipment.length}</span></span></button></div>
      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101a25]">
        <div className="relative overflow-hidden border-b border-white/[0.07] px-5 py-5"><div className="absolute inset-0 bg-cover bg-right opacity-[0.08]" style={{ backgroundImage: `url(${assetUrls.diagnostics})` }} /><div className="relative flex items-center justify-between"><div><h2 className="font-bold text-white">{activeTab === "drums" ? "مخزون بكرات الألياف" : "الأجهزة الميدانية"}</h2><p className="mt-1 text-xs text-slate-500">{activeTab === "drums" ? "يتحدث الرصيد بعد كل عملية صرف معتمدة" : "حالة المعايرة والتعيين الحالية"}</p></div><span className="hidden rounded-lg border border-white/[0.08] bg-[#0c1620]/80 px-3 py-2 text-[11px] font-semibold text-slate-300 sm:inline-flex"><CircleDotDashed size={14} className="ml-1.5 text-sky-300" />مزامنة الجرد: اليوم 09:34</span></div></div>
        {activeTab === "drums" ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-right"><thead className="bg-white/[0.025] text-[10px] font-bold tracking-[0.1em] text-slate-500"><tr><th className="px-5 py-3.5">رقم البكرة</th><th className="px-5 py-3.5">النوع والمورد</th><th className="px-5 py-3.5">الإجمالي</th><th className="px-5 py-3.5">المتبقي الفعلي</th><th className="px-5 py-3.5">المشروع المخصص</th><th className="px-5 py-3.5" /></tr></thead><tbody className="divide-y divide-white/[0.06]">{cableDrums.map((drum) => { const isLow = drum.remaining / drum.total < 0.18; return <tr key={drum.id} className="transition hover:bg-white/[0.025]"><td className="px-5 py-4"><span className="font-mono text-xs font-bold text-sky-200">{drum.id}</span><span className="mt-1 block text-[10px] text-slate-500">{drum.location}</span></td><td className="px-5 py-4"><span className="block text-sm font-semibold text-slate-100">{drum.spec}</span><span className="mt-1 text-xs text-slate-500">{drum.supplier}</span></td><td className="px-5 py-4 font-mono text-xs text-slate-300">{drum.total.toLocaleString("en-US")} م</td><td className="px-5 py-4"><span className={`font-mono text-xs font-bold ${isLow ? "text-amber-300" : "text-emerald-300"}`}>{drum.remaining.toLocaleString("en-US")} م</span><div className="mt-2 h-1 w-20 overflow-hidden rounded-full bg-white/[0.08]"><div className={`h-full ${isLow ? "bg-amber-300" : "bg-emerald-300"}`} style={{ width: `${(drum.remaining / drum.total) * 100}%` }} /></div></td><td className="px-5 py-4 text-xs text-slate-400">{drum.project}</td><td className="px-5 py-4"><button onClick={() => onAction({ kind: "cable", id: drum.id })} className="rounded-lg border border-sky-400/20 bg-sky-400/[0.06] px-3 py-2 text-xs font-bold text-sky-200 transition hover:bg-sky-400/15">صرف كابل</button></td></tr> })}</tbody></table></div> : <div className="divide-y divide-white/[0.06]">{equipment.map((device) => { const tone: Tone = device.status === "جاهز" ? "good" : device.status === "معايرة مطلوبة" ? "warning" : "info"; return <article key={device.id} className="flex flex-col gap-4 px-5 py-5 transition hover:bg-white/[0.025] md:flex-row md:items-center"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-400/10 text-sky-300"><Wrench size={20} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-white">{device.name}</h3><StatusBadge label={device.status} tone={tone} /></div><p className="mt-1.5 font-mono text-xs text-slate-500">{device.serial}</p></div><div className="min-w-44"><span className="block text-[10px] font-bold tracking-wider text-slate-500">المعايرة</span><span className={`mt-1 block text-xs ${device.status === "معايرة مطلوبة" ? "text-amber-300" : "text-slate-300"}`}>{device.calibration}</span></div><div className="min-w-40"><span className="block text-[10px] font-bold tracking-wider text-slate-500">الفني المسؤول</span><span className="mt-1 block text-xs text-slate-300">{device.tech}</span></div><button onClick={() => onAction({ kind: "equipment", id: device.id })} className="self-start rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/[0.06] md:self-auto">تعيين</button></article> })}</div>}
      </section>
    </div>
  );
}

function permitTone(status: Permit["status"]): Tone { return status === "سارٍ" ? "good" : status === "ينتهي قريباً" ? "warning" : "danger"; }

function PermitsView({ permits, search, setSearch, status, setStatus, issuer, setIssuer }: { permits: Permit[]; search: string; setSearch: (value: string) => void; status: string; setStatus: (value: string) => void; issuer: string; setIssuer: (value: string) => void }) {
  const filteredPermits = useMemo(() => permits.filter((permit) => {
    const matchesSearch = `${permit.id} ${permit.route}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === "الكل" || permit.status === status;
    const matchesIssuer = issuer === "الكل" || permit.issuer === issuer;
    return matchesSearch && matchesStatus && matchesIssuer;
  }), [permits, search, status, issuer]);

  return (
    <div>
      <SectionTitle eyebrow="الامتثال والوصول" title="التصاريح ومسارات الوصول" description="لا تبدأ أعمال السحب أو الأعمال المدنية قبل التحقق من صلاحية الاعتماد للمسار والجهة المصدرة." action={<div className="hidden items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2 text-xs font-semibold text-emerald-200 sm:flex"><ShieldCheck size={16} />محرك التحقق التشغيلي فعّال</div>} />
      <section className="mb-5 rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] p-4"><div className="flex gap-3"><CalendarClock className="mt-0.5 shrink-0 text-amber-300" size={19} /><div><h2 className="text-sm font-bold text-amber-100">يوجد تصريحان ينتهيان خلال 48 ساعة</h2><p className="mt-1 text-xs leading-6 text-amber-100/65">راجع التجديد مع الجهة المصدرة قبل جدولة سحب الكابل أو فتح الأعمال المدنية في القطاع المتأثر.</p></div></div></section>
      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101a25]">
        <div className="border-b border-white/[0.07] p-5"><div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr_0.7fr]"><label className="relative"><Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث برقم التصريح أو المسار..." className="w-full rounded-xl border border-white/10 bg-[#0a121b] py-2.5 pr-10 pl-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-400/60" /></label><label className="relative"><SlidersHorizontal className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} /><select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full appearance-none rounded-xl border border-white/10 bg-[#0a121b] py-2.5 pr-9 pl-3 text-sm text-slate-300 outline-none focus:border-sky-400/60"><option>الكل</option><option>سارٍ</option><option>ينتهي قريباً</option><option>منتهي</option></select></label><label className="relative"><Settings2 className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} /><select value={issuer} onChange={(event) => setIssuer(event.target.value)} className="w-full appearance-none rounded-xl border border-white/10 bg-[#0a121b] py-2.5 pr-9 pl-3 text-sm text-slate-300 outline-none focus:border-sky-400/60"><option>الكل</option><option>الأشغال العامة</option><option>المرور</option><option>البلدية</option></select></label></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-right"><thead className="bg-white/[0.025] text-[10px] font-bold tracking-[0.1em] text-slate-500"><tr><th className="px-5 py-3.5">رقم التصريح</th><th className="px-5 py-3.5">الجهة المصدرة</th><th className="px-5 py-3.5">القطاع / المسار</th><th className="px-5 py-3.5">سريان الاعتماد</th><th className="px-5 py-3.5">الحالة</th><th className="px-5 py-3.5">إجراء ميداني</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{filteredPermits.map((permit) => { const valid = permit.status === "سارٍ"; return <tr key={permit.id} className="transition hover:bg-white/[0.025]"><td className="px-5 py-4 font-mono text-xs font-bold text-sky-200">{permit.id}</td><td className="px-5 py-4 text-xs text-slate-300">{permit.issuer}</td><td className="px-5 py-4 text-sm font-semibold text-slate-100">{permit.route}</td><td className="px-5 py-4"><span className="block text-xs text-slate-300">{permit.start}</span><span className="mt-1 block text-[11px] text-slate-500">حتى {permit.end}</span></td><td className="px-5 py-4"><StatusBadge label={permit.status} tone={permitTone(permit.status)} /></td><td className="px-5 py-4"><button disabled={!valid} onClick={() => toast.success(`تم اعتماد بدء العمل للمسار: ${permit.route}`)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${valid ? "border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200 hover:bg-emerald-400/15" : "cursor-not-allowed border border-rose-400/10 bg-rose-400/[0.04] text-rose-200/60"}`}>{valid ? <><HardHat size={14} />السماح بالبدء</> : <><ShieldAlert size={14} />بدء محظور</>}</button></td></tr> })}</tbody></table></div>
        {filteredPermits.length === 0 && <div className="p-12 text-center"><Search className="mx-auto text-slate-600" size={24} /><p className="mt-3 text-sm font-semibold text-slate-300">لا توجد تصاريح مطابقة للفلاتر الحالية</p><button onClick={() => { setSearch(""); setStatus("الكل"); setIssuer("الكل"); }} className="mt-3 text-xs font-bold text-sky-300 hover:text-white">إعادة ضبط الفلاتر</button></div>}
      </section>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inventoryTab, setInventoryTab] = useState<InventoryTab>("drums");
  const [modal, setModal] = useState<ModalState>(null);
  const [cableDrums, setCableDrums] = useState(initialCableDrums);
  const [equipment, setEquipment] = useState(initialEquipment);
  const [permitSearch, setPermitSearch] = useState("");
  const [permitStatus, setPermitStatus] = useState("الكل");
  const [permitIssuer, setPermitIssuer] = useState("الكل");

  const currentView = navItems.find((item) => item.id === view)!;
  const CurrentIcon = currentView.icon;

  const selectView = (nextView: View) => { setView(nextView); setSidebarOpen(false); };
  const openModal = (nextModal: ModalState) => { setModal(nextModal); if (nextModal?.kind === "equipment") setTimeout(() => undefined, 0); };
  const confirmAction = (value: string) => {
    if (!modal) return;
    if (modal.kind === "cable") {
      const amount = Number(value);
      const drum = cableDrums.find((item) => item.id === modal.id);
      if (!amount || amount <= 0) { toast.error("أدخل كمية صرف صحيحة بالمتر."); return; }
      if (!drum || amount > drum.remaining) { toast.error("الكمية المطلوبة تتجاوز الرصيد المتاح في البكرة."); return; }
      setCableDrums((items) => items.map((item) => item.id === modal.id ? { ...item, remaining: item.remaining - amount } : item));
      toast.success(`تم صرف ${amount.toLocaleString("en-US")} م من البكرة ${modal.id}.`);
    } else {
      setEquipment((items) => items.map((item) => item.id === modal.id ? { ...item, tech: value, status: "قيد الاستخدام" } : item));
      toast.success(`تم تعيين الجهاز للفني ${value}.`);
    }
    setModal(null);
  };

  return (
    <div dir="rtl" className="min-h-screen overflow-x-hidden bg-[#081017] text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_75%_-15%,rgba(47,155,255,0.12),transparent_31%),radial-gradient(circle_at_5%_45%,rgba(15,118,110,0.08),transparent_26%)]" />
      {sidebarOpen && <button className="fixed inset-0 z-30 bg-black/60 lg:hidden" aria-label="إغلاق القائمة" onClick={() => setSidebarOpen(false)} />}
      <aside aria-label="التنقل التشغيلي" className={`fiberops-rail fixed inset-y-0 right-0 z-40 flex w-[270px] flex-col border-l border-white/[0.07] bg-[#0b141d]/95 p-4 backdrop-blur-xl transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-2 py-3"><div className="flex items-center gap-3"><img src={assetUrls.mark} alt="رمز FiberOps" className="h-11 w-11 rounded-xl object-contain" /><div><div className="flex items-baseline gap-1"><span className="font-mono text-base font-bold tracking-tight text-white">FiberOps</span><span className="text-[10px] font-bold text-sky-300">OS</span></div><p className="mt-0.5 text-[10px] font-semibold tracking-[0.12em] text-slate-500">FTTH FIELD CONTROL</p></div></div><button onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white lg:hidden"><X size={18} /></button></div>
        <div className="mt-6"><p className="px-3 text-[10px] font-bold tracking-[0.16em] text-slate-600">مساحة العمليات</p><nav className="mt-3 space-y-1.5">{navItems.map((item) => { const Icon = item.icon; const active = item.id === view; return <button key={item.id} onClick={() => selectView(item.id)} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right transition ${active ? "bg-sky-400/10 text-white shadow-[inset_0_0_0_1px_rgba(56,189,248,0.14)]" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"}`}><span className={`grid h-8 w-8 place-items-center rounded-lg ${active ? "bg-sky-400 text-[#06111b]" : "bg-white/[0.04] text-slate-400 group-hover:text-sky-200"}`}><Icon size={17} /></span><span className="min-w-0"><span className="block text-sm font-bold">{item.label}</span><span className={`mt-0.5 block text-[10px] ${active ? "text-sky-200/60" : "text-slate-600"}`}>{item.detail}</span></span>{active && <ArrowUpLeft size={14} className="mr-auto text-sky-300" />}</button> })}</nav></div>
        <div className="mt-auto"><div className="rounded-2xl border border-sky-400/10 bg-gradient-to-br from-sky-400/[0.08] to-transparent p-4"><div className="flex items-center gap-2 text-sky-200"><RadioTower size={16} /><span className="text-xs font-bold">حالة الشبكة الميدانية</span></div><div className="mt-4 flex items-end justify-between"><div><strong className="font-mono text-2xl text-white">98.7%</strong><p className="mt-1 text-[10px] text-slate-500">اكتمال تقارير الفرق</p></div><Activity size={20} className="text-emerald-300" /></div></div><div className="mt-4 flex items-center gap-2 px-2 text-[10px] text-slate-600"><Sparkles size={12} />إصدار العرض التشغيلي 1.0</div></div>
      </aside>
      <div className="lg:pr-[270px]">
        <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#081017]/85 backdrop-blur-xl"><div className="flex h-[68px] items-center justify-between gap-3 px-4 sm:px-6"><div className="flex items-center gap-3"><button onClick={() => setSidebarOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] text-slate-300 lg:hidden"><Menu size={18} /></button><div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex"><span>FiberOps</span><ChevronLeft size={14} /><span className="text-slate-300">{currentView.label}</span></div><div className="flex items-center gap-2 sm:hidden"><CurrentIcon size={16} className="text-[#2F9BFF]" /><span className="text-sm font-bold text-white">{currentView.label}</span></div></div><div className="flex items-center gap-2"><div className="hidden items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-[11px] font-semibold text-emerald-200 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />البيانات متصلة</div><button onClick={() => toast.info("لا توجد تنبيهات إضافية غير مقروءة.")} className="relative grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] text-slate-300 transition hover:bg-white/[0.05]"><Bell size={17} /><span className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-400" /></button><img src={assetUrls.mark} alt="رمز FiberOps" className="h-10 w-10 rounded-xl border border-[#2F9BFF]/20 bg-[#2F9BFF]/[0.06] object-contain p-1" /></div></div></header>
        <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">{view === "dashboard" && <DashboardView goTo={selectView} />}{view === "inventory" && <InventoryView cableDrums={cableDrums} equipment={equipment} activeTab={inventoryTab} setActiveTab={setInventoryTab} onAction={openModal} />}{view === "permits" && <PermitsView permits={initialPermits} search={permitSearch} setSearch={setPermitSearch} status={permitStatus} setStatus={setPermitStatus} issuer={permitIssuer} setIssuer={setPermitIssuer} />}</main>
      </div>
      <ActionModal modal={modal} cableDrums={cableDrums} equipment={equipment} onClose={() => setModal(null)} onConfirm={confirmAction} />
    </div>
  );
}
