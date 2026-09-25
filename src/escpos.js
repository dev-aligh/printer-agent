"use strict";
const ESC = Buffer.from([0x1b, 0x40]);
const CUT = Buffer.from([0x1d, 0x56, 0x41, 0x03]);
function withCut(bytes) { return Buffer.concat([ESC, Buffer.from(bytes), Buffer.from("\n\n\n"), CUT]); }
module.exports = { CUT, withCut };
