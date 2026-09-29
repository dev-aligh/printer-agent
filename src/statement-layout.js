"use strict";

// `statements-ui.hbs` is a portrait A5 template. When the selected Windows
// queue is Landscape, Chromium gives us a 210 × 148 mm page instead. Keep the
// backend template untouched and rotate its whole portrait canvas onto that
// page. Rotate counter-clockwise so the template top lands on the left edge
// of landscape paper; turning the physical sheet clockwise makes it a normal
// upright portrait statement.
const LANDSCAPE_STATEMENT_STYLE = `
<style id="mirocab-landscape-statement-layout">
  @page { size: A5 landscape !important; margin: 0 !important; }
  html { width: 210mm !important; height: 148mm !important; overflow: hidden !important; }
  body {
    position: absolute !important;
    top: 148mm !important;
    left: 0 !important;
    width: 148mm !important;
    min-height: 210mm !important;
    margin: 0 !important;
    transform: rotate(-90deg) !important;
    transform-origin: top left !important;
  }
</style>`;

function prepareHtmlForPrint(html, profile, device) {
  if (
    profile.id !== "statement_a5" ||
    device.orientation !== "landscape" ||
    html.includes("id=\"mirocab-landscape-statement-layout\"")
  ) return html;

  return /<\/head\s*>/i.test(html)
    ? html.replace(/<\/head\s*>/i, `${LANDSCAPE_STATEMENT_STYLE}</head>`)
    : `${LANDSCAPE_STATEMENT_STYLE}${html}`;
}

module.exports = { prepareHtmlForPrint };
