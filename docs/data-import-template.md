# قالب استيراد بيانات FiberOps الفعلية

> استخدم ملفات **CSV بترميز UTF-8**، واحفظ تاريخ الحقول بصيغة `YYYY-MM-DD`. لا تستورد بيانات إنتاجية تجريبية إلى الجداول الفعلية دون مراجعة المدير.

## ترتيب الاستيراد

ابدأ بالأقسام والمشاريع، ثم الموظفين، وبعد ذلك الإقامات والمؤهلات والوثائق والتكليفات. تُستورد الأصول والتصاريح والمسارات بعد إنشاء المشاريع حتى تعمل العلاقات بصورة صحيحة.

| الملف | أعمدة مطلوبة |
| --- | --- |
| `departments.csv` | `code,name,managerName,active` |
| `projects.csv` | `code,name,clientName,status,startDate,targetDate` |
| `employees.csv` | `employeeNo,firstName,lastName,jobTitle,nationality,phone,email,joiningDate,employmentStatus,departmentCode,projectCode` |
| `residencies.csv` | `employeeNo,iqamaNumber,sponsorName,issueDate,expiryDate,status` |
| `qualifications.csv` | `employeeNo,name,issuer,certificateNumber,issuedDate,expiryDate,status` |
| `documents.csv` | `employeeNo,documentType,title,referenceNumber,expiryDate` |
| `assignments.csv` | `employeeNo,projectCode,roleOnProject,startDate,endDate,status` |
| `fiber-drums.csv` | `drumId,fiberSpec,coreCount,supplier,totalMeters,remainingMeters,minimumMeters,projectCode,storageLocation,status` |
| `equipment.csv` | `assetTag,name,category,serialNumber,calibrationDueAt,status,employeeNo` |
| `permits.csv` | `permitNo,issuer,routeName,projectCode,startDate,expiryDate,status,renewalReference` |
| `routes.csv` | `routeCode,name,projectCode,contractorName,stage,progressPercent,permitNo,status` |

## قواعد تحقق مختصرة

يجب أن يكون كل `employeeNo` و`projectCode` و`departmentCode` فريداً، وأن تشير حقول الربط إلى سجل موجود سبق استيراده. اترك الحقول الاختيارية فارغة بدلاً من وضع نص بديل. قبل الاستيراد النهائي، خذ نسخة احتياطية من القاعدة واختبر ملفاً صغيراً في بيئة تجريبية.
