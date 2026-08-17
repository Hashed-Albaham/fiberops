import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatabaseZap, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const roleOptions = [
  { value: "admin", label: "مدير النظام", note: "إدارة المستخدمين وكامل الإجراءات" },
  { value: "operations_manager", label: "مدير العمليات", note: "إدارة العمالة والأصول والتصاريح" },
  { value: "field_supervisor", label: "مشرف ميداني", note: "تحديث السجلات والتكليفات التشغيلية" },
  { value: "viewer", label: "مشاهد", note: "عرض اللوحات والسجلات فقط" },
] as const;

type Role = (typeof roleOptions)[number]["value"];
type EditableAccount = { id: number; name: string; email: string; password: string; role: Role; active: "yes" | "no"; protected: boolean };

export default function UserManagement() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const usersQuery = trpc.users.list.useQuery(undefined, { enabled: user?.role === "admin" });
  const demoStatus = trpc.demo.status.useQuery(undefined, { enabled: user?.role === "admin" });
  const [form, setForm] = useState({ username: "", name: "", email: "", password: "", role: "viewer" as Role });
  const [editingAccount, setEditingAccount] = useState<EditableAccount | null>(null);
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
  const [demoConfirmation, setDemoConfirmation] = useState("");
  const createUser = trpc.users.create.useMutation({
    onSuccess: async () => {
      setForm({ username: "", name: "", email: "", password: "", role: "viewer" });
      await utils.users.list.invalidate();
      toast.success("تم إنشاء الحساب وإسناد الصلاحية.");
    },
    onError: error => toast.error(error.message || "تعذر إنشاء الحساب."),
  });
  const updateUser = trpc.users.update.useMutation({
    onSuccess: async () => {
      setEditingAccount(null);
      await utils.users.list.invalidate();
      toast.success("تم تحديث بيانات وصلاحيات المستخدم.");
    },
    onError: error => toast.error(error.message || "تعذر تحديث المستخدم."),
  });
  const seedDemo = trpc.demo.seed.useMutation({
    onSuccess: async result => {
      setDemoDialogOpen(false);
      setDemoConfirmation("");
      if (result.inserted) toast.success(result.message);
      else toast.message(result.message);
      await Promise.all([utils.users.list.invalidate(), utils.demo.status.invalidate(), utils.workforce.invalidate(), utils.operations.invalidate()]);
    },
    onError: error => toast.error(error.message || "تعذر تعبئة البيانات التجريبية."),
  });
  const repairArabic = trpc.demo.repairArabic.useMutation({
    onSuccess: async result => {
      if (result.repaired) toast.success(result.message);
      else toast.message(result.message);
      await Promise.all([utils.workforce.invalidate(), utils.operations.invalidate(), utils.demo.status.invalidate()]);
    },
    onError: error => toast.error(error.message || "تعذر إصلاح النص العربي."),
  });

  const roleSummary = useMemo(() => {
    const rows = usersQuery.data ?? [];
    return roleOptions.map(role => ({ ...role, count: rows.filter(row => row.role === role.value && row.active === "yes").length }));
  }, [usersQuery.data]);
  const openEditor = (account: NonNullable<typeof usersQuery.data>[number]) => setEditingAccount({ id: account.id, name: account.name || "", email: account.email || "", password: "", role: account.role, active: account.active, protected: account.openId === "fiberops-local-admin" });

  if (user?.role !== "admin") {
    return <section dir="rtl" className="mx-auto max-w-2xl rounded-2xl border border-rose-400/20 bg-rose-400/[0.05] p-8 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-rose-300" /><h1 className="mt-4 text-xl font-bold text-white">هذه الصفحة مخصصة لمدير النظام</h1><p className="mt-2 text-sm leading-7 text-slate-400">لا تملك صلاحية إدارة المستخدمين أو تغيير الأدوار.</p></section>;
  }

  return <div dir="rtl" className="mx-auto max-w-[1380px] space-y-6 pb-10">
    <section className="flex flex-col gap-4 rounded-3xl border border-[#2F9BFF]/20 bg-[radial-gradient(circle_at_85%_10%,rgba(47,155,255,0.16),transparent_38%)] bg-[#0b1723] p-6 sm:flex-row sm:items-end sm:justify-between">
      <div><span className="inline-flex items-center gap-2 rounded-full border border-[#2F9BFF]/20 bg-[#2F9BFF]/10 px-3 py-1 text-[11px] font-bold tracking-[0.14em] text-[#9fd4ff]"><ShieldCheck size={14} />التحكم في الوصول</span><h1 className="mt-4 text-3xl font-bold text-white">المستخدمون والصلاحيات</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">أنشئ حسابات فريقك وحدد نطاق العمل المناسب لكل مستخدم. تبقى كل عملية تغيير موثقة في السجل التشغيلي.</p></div>
      <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => setDemoDialogOpen(true)} disabled={demoStatus.data?.populated || seedDemo.isPending} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#2F9BFF]/25 bg-[#2F9BFF]/10 px-4 text-sm font-bold text-[#9fd4ff] transition hover:bg-[#2F9BFF]/20 disabled:cursor-not-allowed disabled:opacity-50"><DatabaseZap size={17} />{seedDemo.isPending ? "جارٍ التعبئة…" : demoStatus.data?.populated ? "البيانات موجودة" : "تعبئة بيانات تجريبية"}</button><button type="button" onClick={() => repairArabic.mutate()} disabled={!demoStatus.data?.populated || repairArabic.isPending} className="inline-flex h-11 items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 text-sm font-bold text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-50"><DatabaseZap size={17} />{repairArabic.isPending ? "جارٍ إصلاح العربية…" : "إصلاح النص العربي"}</button><div className="rounded-2xl border border-white/[0.08] bg-[#07111a]/75 px-5 py-3"><span className="block text-xs text-slate-500">الحسابات النشطة</span><strong className="mt-1 block font-mono text-2xl text-white">{(usersQuery.data ?? []).filter(row => row.active === "yes").length}</strong></div></div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{roleSummary.map(role => <article key={role.value} className="rounded-2xl border border-white/[0.07] bg-[#101a25] p-4"><p className="text-xs font-semibold text-[#9fd4ff]">{role.label}</p><strong className="mt-3 block font-mono text-3xl text-white">{role.count}</strong><p className="mt-2 text-[11px] leading-5 text-slate-500">{role.note}</p></article>)}</section>

    <section className="grid gap-6 xl:grid-cols-[0.86fr_1.4fr]">
      <form onSubmit={event => { event.preventDefault(); createUser.mutate({ ...form, email: form.email || null }); }} className="rounded-2xl border border-white/[0.07] bg-[#101a25] p-5">
        <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#2F9BFF]/10 text-[#7cc5ff]"><UserPlus size={18} /></span><div><h2 className="font-bold text-white">إضافة مستخدم</h2><p className="mt-1 text-xs text-slate-500">اختر كلمة مرور مؤقتة لا تقل عن 10 أحرف.</p></div></div>
        <div className="mt-5 grid gap-4"><Field label="الاسم الكامل"><input required value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className={inputStyle} placeholder="مثال: خالد مسؤول العمليات" /></Field><Field label="اسم المستخدم"><input required value={form.username} onChange={event => setForm(current => ({ ...current, username: event.target.value }))} className={inputStyle} placeholder="khalid.ops" /></Field><Field label="البريد الإلكتروني (اختياري)"><input type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} className={inputStyle} placeholder="name@company.com" /></Field><Field label="كلمة المرور المؤقتة"><input required type="password" minLength={10} value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} className={inputStyle} placeholder="10 أحرف على الأقل" /></Field><Field label="الدور"><select value={form.role} onChange={event => setForm(current => ({ ...current, role: event.target.value as Role }))} className={inputStyle}>{roleOptions.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}</select></Field><button disabled={createUser.isPending} className="mt-1 h-11 rounded-xl bg-[#2F9BFF] px-4 text-sm font-bold text-[#06111b] transition hover:bg-[#59b2ff] disabled:opacity-60">{createUser.isPending ? "جارٍ الإنشاء…" : "إنشاء الحساب"}</button></div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101a25]"><div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4"><div className="flex items-center gap-3"><UsersRound className="text-[#7cc5ff]" size={19} /><h2 className="font-bold text-white">الحسابات المسجلة</h2></div><span className="text-xs text-slate-500">{usersQuery.data?.length ?? 0} مستخدم</span></div><div className="overflow-x-auto"><table className="min-w-full text-right text-sm"><thead className="bg-white/[0.025] text-xs text-slate-500"><tr><th className="px-5 py-3 font-medium">المستخدم</th><th className="px-5 py-3 font-medium">الدور</th><th className="px-5 py-3 font-medium">الحالة</th><th className="px-5 py-3 font-medium">الإجراء</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{usersQuery.isLoading ? <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-500">جارٍ تحميل الحسابات…</td></tr> : usersQuery.data?.map(account => <tr key={account.id}><td className="px-5 py-4"><strong className="block text-white">{account.name || account.username || "مستخدم"}</strong><span className="mt-1 block font-mono text-xs text-slate-500">{account.username || "حساب أولي"}</span></td><td className="px-5 py-4"><span className="text-xs text-slate-300">{roleOptions.find(role => role.value === account.role)?.label}</span></td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${account.active === "yes" ? "bg-emerald-400/10 text-emerald-200" : "bg-slate-500/15 text-slate-400"}`}>{account.active === "yes" ? "نشط" : "معطل"}</span></td><td className="px-5 py-4"><button type="button" onClick={() => openEditor(account)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-[#2F9BFF]/50 hover:text-[#9fd4ff]">تعديل</button></td></tr>)}</tbody></table></div></section>
    </section>
    <Dialog open={demoDialogOpen} onOpenChange={setDemoDialogOpen}><DialogContent dir="rtl" className="border-white/10 bg-[#101a25] text-white"><DialogHeader><DialogTitle>تهيئة البيانات التجريبية</DialogTitle><DialogDescription className="leading-6 text-slate-400">سيُضاف سجل تجريبي معلن للأقسام والمشاريع والعمالة والإقامات والمخزون والتصاريح. لا يمكن تنفيذ هذه الخطوة إذا وُجدت ملفات عمالة في القاعدة.</DialogDescription></DialogHeader><Field label='اكتب العبارة التالية للتأكيد: "تهيئة بيانات تجريبية"'><input value={demoConfirmation} onChange={event => setDemoConfirmation(event.target.value)} className={inputStyle} /></Field><DialogFooter><button type="button" onClick={() => setDemoDialogOpen(false)} className="h-10 rounded-xl border border-white/10 px-4 text-sm font-bold text-slate-300">إلغاء</button><button type="button" onClick={() => seedDemo.mutate({ confirmation: "تهيئة بيانات تجريبية" })} disabled={demoConfirmation !== "تهيئة بيانات تجريبية" || seedDemo.isPending} className="h-10 rounded-xl bg-[#2F9BFF] px-4 text-sm font-bold text-[#06111b] disabled:opacity-50">تأكيد التهيئة</button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(editingAccount)} onOpenChange={open => !open && setEditingAccount(null)}><DialogContent dir="rtl" className="border-white/10 bg-[#101a25] text-white"><DialogHeader><DialogTitle>تعديل حساب المستخدم</DialogTitle><DialogDescription className="leading-6 text-slate-400">يمكن تغيير الاسم والبريد والدور والحالة. اترك كلمة المرور فارغة إذا لم ترد تغييرها.</DialogDescription></DialogHeader>{editingAccount && <form className="grid gap-4" onSubmit={event => { event.preventDefault(); const payload = { id: editingAccount.id, name: editingAccount.name, email: editingAccount.email || null, ...(editingAccount.password ? { password: editingAccount.password } : {}), role: editingAccount.role, active: editingAccount.active }; updateUser.mutate(payload); }}><Field label="الاسم الكامل"><input required value={editingAccount.name} onChange={event => setEditingAccount(current => current ? { ...current, name: event.target.value } : current)} className={inputStyle} /></Field><Field label="البريد الإلكتروني"><input type="email" value={editingAccount.email} onChange={event => setEditingAccount(current => current ? { ...current, email: event.target.value } : current)} className={inputStyle} /></Field><Field label="كلمة مرور جديدة (اختيارية)"><input type="password" minLength={10} value={editingAccount.password} onChange={event => setEditingAccount(current => current ? { ...current, password: event.target.value } : current)} className={inputStyle} placeholder="10 أحرف على الأقل" /></Field><Field label="الدور"><select value={editingAccount.role} onChange={event => setEditingAccount(current => current ? { ...current, role: event.target.value as Role } : current)} disabled={editingAccount.protected} className={inputStyle}>{roleOptions.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}</select></Field><Field label="الحالة"><select value={editingAccount.active} onChange={event => setEditingAccount(current => current ? { ...current, active: event.target.value as "yes" | "no" } : current)} disabled={editingAccount.protected} className={inputStyle}><option value="yes">نشط</option><option value="no">معطل</option></select></Field><DialogFooter><button type="button" onClick={() => setEditingAccount(null)} className="h-10 rounded-xl border border-white/10 px-4 text-sm font-bold text-slate-300">إلغاء</button><button disabled={updateUser.isPending} className="h-10 rounded-xl bg-[#2F9BFF] px-4 text-sm font-bold text-[#06111b] disabled:opacity-50">{updateUser.isPending ? "جارٍ الحفظ…" : "حفظ التغييرات"}</button></DialogFooter></form>}</DialogContent></Dialog>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-2"><span className="text-xs font-semibold text-slate-300">{label}</span>{children}</label>;
}

const inputStyle = "h-11 w-full rounded-xl border border-white/10 bg-[#0b1723] px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#2F9BFF] focus:ring-2 focus:ring-[#2F9BFF]/20";
