# FiberOps — تشخيص نشر Vercel

## 2026-08-17

- النشر الإنتاجي `J6BuSVaWziGvhgxzx3ea2nTDfAYh` استخدم المصدر `c62576f` والأمر `drizzle-kit migrate && vite build`.
- متغير `DATABASE_URL` موجود في بيئتي Production وPreview في Vercel.
- فشل النشر عند مرحلة ترحيلات Drizzle، قبل اكتمال بناء الواجهة.
- النشر السابق أظهر خطأ MySQL `ER_ACCESS_DENIED_ERROR` للحساب من مضيف Vercel؛ تم تحديث صلاحيات المستخدم في لوحة الاستضافة ثم أُعيد النشر للتحقق.
- لا تسجل كلمات المرور أو قيمة `DATABASE_URL` في هذا الملف.

## مراجعة لقطة cPanel

تكشف اللقطتان الأوليان عن أن لوحة التحكم هي cPanel، وأن شهادة SSL الخاصة بالنطاق الأساسي معروضة باعتبارها نشطة. لا تظهر هذه المناطق أي إعداد لخادم MySQL أو عبارة تفيد بأن SSL مطلوب للاتصالات الخارجية بقاعدة البيانات؛ لذلك لا يمكن اعتبار شهادة الموقع دليلاً على إعداد SSL الخاص بـMySQL.

تظهر اللقطتان الثالثة والرابعة عنوان IP مشتركاً وإحصاءات لحساب الاستضافة، ومنها عدد قواعد البيانات المتاحة. لا توجد كذلك إعدادات MySQL أو شهادات عميل أو خيار يفرض SSL لاتصالات قواعد البيانات في المناطق الظاهرة.

تظهر اللقطتان الخامسة والسادسة موارد الحساب وإحصاءً لقواعد PostgreSQL، ثم نهاية صفحة cPanel. وبفحص اللقطة كاملة، لا يوجد فيها قسم MySQL Databases أو Remote MySQL أو phpMyAdmin أو إعداد SSL خاص بقاعدة البيانات.

## التحقق من الوصول البعيد

قدم المستخدم لاحقاً شاشة Remote Database Access في cPanel. تظهر قائمة المضيفين المسموح بهم المضيف العام `%`، وهو ما يسمح بالوصول الخارجي إلى خدمة MySQL. بناءً على ذلك، لا يُرجَّح أن يكون رفض الاتصال الأصلي ناتجاً عن قائمة مضيفي cPanel، وتصبح قيمة `DATABASE_URL` أو كلمة المرور المشفرة داخلها موضع التحقق التالي.

## نتيجة النشر الإنتاجي

في النشر الإنتاجي `5H1rzoudrgvo1nFTc7oUcquYG9PX` اكتمل أمر البناء `drizzle-kit migrate && vite build` بنجاح. يسجل Vercel في 2026-08-17 العبارة `migrations applied successfully!` ثم `Deployment completed`، وتغيرت حالة النشر إلى Ready على النطاق `https://fiberops-operations.vercel.app`. يؤكد هذا تنفيذ ترحيلات Drizzle على قاعدة `hashdiri_fiberops` بنجاح.

## التحقق المباشر من الجداول

تم تنفيذ `SHOW TABLES;` من اتصال خارجي موثوق في 2026-08-17. ظهرت جداول FiberOps الثلاثة عشر: `users` و`employees` و`residencyPermits` و`employeeQualifications` و`employeeDocuments` و`employeeAssignments` و`departments` و`projects` و`fiberDrums` و`fieldEquipment` و`permits` و`workRoutes` و`operationalAuditLogs`، إضافة إلى `__drizzle_migrations` الخاص بسجل الترحيلات.
