'use strict';
function nextTick(callback) {
  if (typeof process !== "undefined" && process.nextTick) {
    return process.nextTick.apply(null, arguments);
  }

  const args = [];
  for (let i = 1; i < arguments.length; i++) {
    args[i - 1] = arguments[i];
  }

  setTimeout(function() {
    callback.apply(null, args);
  });
}

module.exports = {
  nextTick,
};
