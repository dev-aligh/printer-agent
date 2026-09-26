# Local API v1

Base URL: `http://127.0.0.1:18443`. تمام درخواست‌ها هدر زیر را دارند:

```text
X-Mirocab-Pairing-Token: <secret>
```

`GET /v1/status` وضعیت Agent، پروفایل‌ها و انتخاب پیش‌فرض این سیستم را برمی‌گرداند. `GET /v1/printers` فهرست پرینترهای نصب‌شدهٔ ویندوز را برمی‌گرداند. اگر `printer` در درخواست چاپ حذف شود، Agent انتخاب ذخیره‌شدهٔ همان پروفایل را به کار می‌برد.

برای کنترل صف هر پرینتر (نام پرینتر باید URL-encode شود):

```text
GET  /v1/printers/{printerName}/jobs
POST /v1/printers/{printerName}/jobs/{jobId}/pause
POST /v1/printers/{printerName}/jobs/{jobId}/resume
POST /v1/printers/{printerName}/jobs/{jobId}/cancel
```

عملیات فوق به Windows Print Spooler ارسال می‌شوند و صرفاً job همان پرینتر را تغییر می‌دهند.

`POST /v1/print` از enum زیر برای تعیین نوع سند استفاده می‌کند:

```text
statement_a5        صورت‌وضعیت (همیشه A5 عمودی)
cargo_a5            بارنامه A5 (همیشه A5 افقی)
passenger_ticket    بلیت مسافر
cargo_thermal       بارنامه رول
driver_performance  گزارش عملکرد راننده
```

Agent پرینتر، کاغذ، جهت، تعداد نسخه، Scale، چهار حاشیه و ابعاد رول را از تنظیمات ذخیره‌شدهٔ همان `documentType` می‌گیرد؛ پنل فقط نوع سند و محتوای چاپ را می‌فرستد. این باعث می‌شود پنل نتواند تنظیمات محلی چاپ هر سیستم را تغییر دهد.

نمونه:

```json
{"documentType":"cargo_thermal","html":"<!doctype html><html>...</html>"}
```

برای همهٔ پرینترهای معمولی `html` الزامی و چاپ Chromium silent به Windows Spooler ارسال می‌شود. برای چاپ خام فقط در صورت ارسال صریح `rawMode: true`، مقدار `rawEscPosBase64` به RawPrint.exe فرستاده می‌شود؛ Agent برند پرینتر را حدس نمی‌زند. Raw mode تنها برای درایور/پرینتری که RAW یا ESC/POS را پشتیبانی می‌کند مناسب است.
