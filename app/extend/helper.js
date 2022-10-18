'use strict';
module.exports = {
  hasKeys(object) {
    for (const key in object) return true;
    return false;
  },
  pick(obj, arr) {
    return arr.reduce((iter, val) => (val in obj && (iter[val] = obj[val]), iter), {});
  },
  omit(obj, arr) {
    const newObj = {};
    for (const i in obj) {
      if (!arr.includes(i)) {
        newObj[i] = obj[i];
      }
    }
    return newObj;
  },
  desensitizeOp(op) {
    return {
      a: op.a,
      x: op.x,

    };
  },
  savePick(obj, path) {
    let value = obj;
    const pathArr = path.split('.');
    const res = pathArr.every(attr => {
      value = value[attr];
      return value !== null && value !== undefined;
    });
    return res ? value : undefined;
  },

};
