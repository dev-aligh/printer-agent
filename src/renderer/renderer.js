const $ = (id) => document.getElementById(id);
async function load() {
  let config = await window.mirocab.getConfig(); $("enabled").checked = config.enabled; $("token").value = config.pairingToken;
  $("enabled").onchange = () => window.mirocab.saveConfig({ enabled: $("enabled").checked });
  $("copyToken").onclick = () => navigator.clipboard.writeText($("token").value);
  const printers = await window.mirocab.printers();
  let selectedPrinter = "";
  const updateRollControls = () => { $("rollSettings").hidden = false; $("customRollWidthField").hidden = false; };
  const renderSelectedPrinter = () => { $("selectedPrinter").textContent = selectedPrinter || "انتخاب پرینتر"; $("choosePrinter").classList.toggle("is-empty", !selectedPrinter); };
  let preferenceRequest = 0;
  const showPreferences = async () => {
    const request = ++preferenceRequest;
    const printer = selectedPrinter;
    $("printerPreferenceStatus").textContent = printer ? "در حال خواندن تنظیمات ویندوز…" : "ابتدا پرینتر را انتخاب کنید.";
    if (!printer) return;
    try {
      const actual = await window.mirocab.printerPreferences(printer);
      if (request !== preferenceRequest) return;
      $("printerPreferenceStatus").textContent = "تنظیم فعلی ویندوز: " + actual.paperName + " — " + actual.widthMm.toFixed(1) + " × " + actual.heightMm.toFixed(1) + " mm — " + (actual.orientation === "landscape" ? "افقی" : "عمودی");
    } catch (e) { if (request === preferenceRequest) $("printerPreferenceStatus").textContent = e.message; }
  };
  const syncProfile = () => { const item = config.profileSettings[$("profile").value] || {}; const defaultsToA5 = ["statement_a5", "cargo_a5"].includes($("profile").value); selectedPrinter = item.printer || ""; renderSelectedPrinter(); showPreferences(); $("profilePaper").value = item.paper || (defaultsToA5 ? "A5" : "thermal-80"); $("profileOrientation").value = item.orientation || (defaultsToA5 ? ($("profile").value === "cargo_a5" ? "landscape" : "portrait") : "portrait"); $("profileCopies").value = item.copies || 1; $("profileScale").value = item.scale || 100;["marginTop", "marginRight", "marginBottom", "marginLeft"].forEach((id) => { $(id).value = item[id] || 0; }); $("rollWidthMm").value = item.rollWidthMm || ($("profilePaper").value === "thermal-58" ? 58 : 80); $("rollHeightMm").value = item.rollHeightMm || 130; $("profileCutMode").value = item.cutMode || "none"; updateRollControls(); $("profileRule").textContent = "پرینتر، کاغذ، جهت، Scale، حاشیه و طول رول برای این نوع سند ذخیره می‌شود."; };
  const closePrinterModal = () => { $("printerModal").hidden = true; $("choosePrinter").focus(); };
  const openPrinterModal = () => { const profileName = $("profile").selectedOptions[0].textContent; $("printerModalDescription").textContent = `پرینتر مورد استفاده برای «${profileName}» را انتخاب کنید.`; const list = $("modalPrinterList"); list.replaceChildren(...printers.map((printer) => { const button = document.createElement("button"); button.type = "button"; button.className = "modal-printer"; button.classList.toggle("selected", printer.name === selectedPrinter); const name = document.createElement("b"); name.textContent = printer.name; button.append(name); if (printer.name === selectedPrinter) { const marker = document.createElement("span"); marker.textContent = "انتخاب‌شده"; button.append(marker); } button.onclick = () => { selectedPrinter = printer.name; renderSelectedPrinter(); showPreferences(); closePrinterModal(); }; return button; })); $("noPrinters").hidden = printers.length > 0; $("printerModal").hidden = false; (list.querySelector("button") || $("closePrinterModal")).focus(); };
  $("choosePrinter").onclick = openPrinterModal; $("closePrinterModal").onclick = closePrinterModal; document.querySelector("[data-close-printer-modal]").onclick = closePrinterModal;
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("printerModal").hidden) closePrinterModal(); });
  $("profile").onchange = syncProfile; $("profilePaper").onchange = updateRollControls; syncProfile();
  const setBusy = (busy) => { ["saveProfile", "resetPrinter", "testProfile", "profile", "choosePrinter"].forEach(id => { $(id).disabled = busy; }); };
  $("resetPrinter").onclick = async () => {
    if (!selectedPrinter) return alert("ابتدا پرینتر را انتخاب کنید.");
    setBusy(true);
    try { config = await window.mirocab.resetPrinter(selectedPrinter); await showPreferences(); alert("پیش‌فرض درایور همین پرینتر بازیابی شد. تنظیمات سایر پرینترها تغییر نکرد."); }
    catch (e) { alert("بازگردانی انجام نشد: " + e.message); }
    finally { setBusy(false); }
  };
  $("saveProfile").onclick = async () => { const key = $("profile").value; if (!selectedPrinter) return alert("ابتدا پرینتر این نوع سند را انتخاب کنید."); const setting = { printer: selectedPrinter, paper: $("profilePaper").value, orientation: $("profileOrientation").value, copies: Number($("profileCopies").value), scale: Number($("profileScale").value), marginTop: Number($("marginTop").value), marginRight: Number($("marginRight").value), marginBottom: Number($("marginBottom").value), marginLeft: Number($("marginLeft").value), rollWidthMm: Number($("rollWidthMm").value), rollHeightMm: Number($("rollHeightMm").value), cutMode: $("profileCutMode").value }; setBusy(true); try { config = await window.mirocab.saveProfile(key, setting); await showPreferences(); alert("تنظیمات روی همین پرینتر در ویندوز اعمال و ذخیره شد."); } catch (e) { alert("ذخیره انجام نشد: " + e.message); } finally { setBusy(false); } };
  $("testProfile").onclick = async () => { const button = $("testProfile"); button.disabled = true; try { await window.mirocab.testPrint($("profile").value); alert("چاپ آزمایشی با تنظیم فعلی پرینتر در ویندوز ارسال شد."); } catch (e) { alert(e.message); } finally { button.disabled = false; } };
} load();
