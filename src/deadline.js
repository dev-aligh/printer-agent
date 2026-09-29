"use strict";
async function withDeadline(operation, milliseconds, message) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })
    ]);
  } finally { clearTimeout(timer); }
}
module.exports = { withDeadline };
