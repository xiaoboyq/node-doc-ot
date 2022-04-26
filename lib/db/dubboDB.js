'use strict';

const DB = require("sharedb").DB;
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
function parseJsonStr(jsonStr) {
  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    return null;
  }
}
function DubboDB(app, options) {
  if (!(this instanceof DubboDB)) return new DubboDB(options);
  DB.call(this, options);
  this.app = app;
  this.closed = false;
  this.collection = 'zhishu';
}
module.exports = DubboDB;

DubboDB.prototype = Object.create(DB.prototype);

DubboDB.prototype.close = function(callback) {
  this.closed = true;
  if (callback) callback();
};

DubboDB.prototype.commit = function(
  collection,
  id,
  op,
  snapshot,
  options,
  callback
) {
  // options， collection不需要
  const db = this;
  if (typeof callback !== "function") throw new Error("Callback required");
  nextTick(async function() {
    const res = await db.app.dubbo.OtServiceApi.saveDoc({
      docId: id,
      op: JSON.stringify(op),
      snapshot: JSON.stringify(snapshot),
    });
    const success = res.code === 0;
    if (success) {
      callback(null, true);
    } else {
      callback(res);
      db.app.logger.error('[DubboDB] [saveDoc] 保存快照失败 ', JSON.stringify(res));
    }
  });
};

DubboDB.prototype.getSnapshot = function(
  collection,
  id,
  fields,
  options,
  callback
) {
  const db = this;
  if (typeof callback !== "function") throw new Error("Callback required");
  nextTick(async function() {
    const res = await db.app.dubbo.OtServiceApi.getLatestSnapshot(id);
    const success = res.code === 0;
    if (success) {
      let snapshot = parseJsonStr(res.data);
      if (!snapshot) {
        db.app.logger.info('[DubboDB] [getSnapshot] 查询快照为空 ', res.data, ' docId = ', id);
        // 注意：查询为空，需要进行初始化版本
        snapshot = {
          id,
          v: 0,
          type: null,
          data: undefined,
          m: undefined,
        };
      }
      callback(null, snapshot);
    } else {
      callback(res);
      db.app.logger.error('[DubboDB] [getSnapshot] 保存快照失败 ', JSON.stringify(res));
    }
  });
};

DubboDB.prototype.getOps = function(
  collection,
  id,
  from,
  to,
  options,
  callback
) {
  const db = this;
  if (typeof callback !== "function") throw new Error("Callback required");
  nextTick(async function() {
    const res = await db.app.dubbo.OtServiceApi.getOps({
      docId: id,
      from,
      to,
    });
    const success = res.code === 0;
    if (success) {
      const ops = res.data.map(opstr => parseJsonStr(opstr)).filter(op => !!op);
      if (ops.length !== res.data.length) {
        db.app.logger.error('[DubboDB] [getOps] ops格式有误', JSON.stringify(res.data), ' id,from,to = ', id, from, to);
        callback('ops格式有误');
      } else {
        callback(null, ops);
      }
    } else {
      db.app.logger.error('[DubboDB] [getOps] 查询ops失败', JSON.stringify(res), ' id,from,to = ', id, from, to);
      callback(res);
    }

  });
};
