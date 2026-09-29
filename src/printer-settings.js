"use strict";
const { resolveProfile } = require("./profiles");

function driverSettings(profile) {
  const settings = { paper: profile.paper, orientation: profile.orientation };
  if (profile.paper !== "A5") settings.rollHeightMm = profile.rollHeightMm;
  if (profile.paper === "custom-roll") settings.rollWidthMm = profile.rollWidthMm;
  return settings;
}

function createPrinterSettings({ store, getPrinters, preferences }) {
  let pending = Promise.resolve();
  const serialize = (operation) => {
    const result = pending.then(operation);
    pending = result.catch(() => {});
    return result;
  };
  async function validate(printer) {
    if (typeof printer !== "string" || !(await getPrinters()).some((item) => item.name === printer))
      throw new Error("پرینتر انتخاب‌شده یافت نشد.");
  }
  return {
    save: (profileId, setting) => serialize(async () => {
      const profile = resolveProfile(profileId, setting);
      await validate(setting.printer);
      // No other printer is enumerated for mutation. Persist only after Windows accepts it.
      const actual = await preferences(setting.printer, "apply", driverSettings(profile));
      const config = store.get();
      return store.update({
        profileSettings: { ...config.profileSettings, [profileId]: { ...profile, printer: setting.printer } },
        printerSettings: { ...config.printerSettings, [setting.printer]: actual }
      });
    }),
    reset: (printer) => serialize(async () => {
      await validate(printer);
      const actual = await preferences(printer, "reset");
      const config = store.get();
      const profileSettings = { ...config.profileSettings };
      for (const [key, value] of Object.entries(profileSettings)) {
        if (value.printer === printer) profileSettings[key] = { ...value, copies: 1, scale: 100, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, cutMode: "none" };
      }
      return store.update({ profileSettings, printerSettings: { ...config.printerSettings, [printer]: actual } });
    })
  };
}
module.exports = { createPrinterSettings };
