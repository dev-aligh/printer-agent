# Mirocab Print Agent

Agent محلی مستقل برای چاپ بی‌دیالوگ از پنل شرکت روی Windows 7 SP1 و Windows 10. رابط تنظیمات فارسی داخل فایل exe اجرا می‌شود و Agent تنها روی `127.0.0.1:18443` گوش می‌دهد. انتخاب پرینتر، چاپ آزمایشی و کنترل صف چاپ برای تمام پرینترهایی که در Windows نصب شده‌اند از طریق Windows Print Spooler انجام می‌شود؛ وابستگی به Epson ندارد.

## قواعد قطعی سند

| پروفایل | قاعده |
| --- | --- |
| صورت‌وضعیت | همیشه A5 و Portrait |
| بارنامه A5 | همیشه A5 و Landscape |
| بلیت مسافر | A5 یا حرارتی 58/80؛ قالب توسط پنل ارسال می‌شود |
| بارنامه حرارتی | دو job مستقل برای هر نسخه؛ Cut پس از هر نسخه |
| گزارش عملکرد راننده | A5 یا حرارتی؛ Cut انتهایی برای ESC/POS |

## توسعه و ساخت

Node 16 را فقط روی ماشین توسعه/Build استفاده کنید (برای سازگاری ابزار build با Electron 22)؛ کاربر نهایی هیچ Node.jsای نصب نمی‌کند. روی Windows، ابتدا PowerShell را باز کنید:

```powershell
npm install
powershell -ExecutionPolicy Bypass -File .\scripts\build-raw-helper.ps1
npm test
npm run package:win
```

خروجی نصب‌کننده و portable exe در `release/` ساخته می‌شود. برای Windows 7 SP1 باید SHA-2 code-signing updates و .NET Framework 4.7.2 نصب باشد. Electron 22 آخرین شاخهٔ مورد هدف این پروژه برای Win7 است؛ قبل از ارتقای Electron، سازگاری Win7 را دوباره تأیید کنید.

## کنترل صف چاپ

در پنجرهٔ Agent، از بخش «صف چاپ ویندوز» یک پرینتر را انتخاب کنید. برای هر job حاضر در صف، عملیات توقف، ادامه و لغو در دسترس است. این عملیات به API استاندارد Windows Spooler فرستاده می‌شوند، بنابراین روی پرینتر USB، شبکه‌ای، PDF و درایورهای Epson، HP، Canon و دیگر برندها—تا جایی که درایور اجازه دهد—کار می‌کنند.

جزئیات نصب، pairing و قرارداد پنل در [docs/INSTALL.fa.md](docs/INSTALL.fa.md) و [docs/API.md](docs/API.md) هستند.
