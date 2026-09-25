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

`POST /v1/print` نمونه:

```json
{"printer":"Any installed printer","profile":"cargo_thermal","options":{"paper":"thermal-80","copies":1},"html":"<!doctype html><html>...</html>"}
```

برای همهٔ پرینترهای معمولی `html` الزامی و چاپ Chromium silent به Windows Spooler ارسال می‌شود. برای چاپ خام فقط در صورت ارسال صریح `rawMode: true`، مقدار `rawEscPosBase64` به RawPrint.exe فرستاده می‌شود؛ Agent برند پرینتر را حدس نمی‌زند. Raw mode تنها برای درایور/پرینتری که RAW یا ESC/POS را پشتیبانی می‌کند مناسب است. پنل باید پیش از ارسال از `/v1/printers` نام دقیق پرینتر را بگیرد.
