'use strict';
module.exports = {
  hasKeys(object) {
    for (const key in object) return true;
    return false;
  },
};
