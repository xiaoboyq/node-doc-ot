'use strict';

const DB = require("sharedb").DB;
const uuidV4 = require('uuid').v4;
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
function getDBSnapshot({ id, v, type, data, m }) {
  return {
    id,
    v,
    type,
    data,
    m,
  };
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

/**
 * 提交 ops 和 snapshot 到数据库
 * @param {*} collection 暂时不用
 * @param {*} id 文档ID
 * @param {*} op op对象
 * @param {*} snapshot 快照对象
 * @param {*} options 暂时不用
 * @param {*} callback 回调
 */
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
    const rid = uuidV4();
    db.app.otLog('[DubboDB] [saveDoc] 保存快照 ', { docId: id, rid }, { op, snapshot });
    let res;
    try {
      res = await db.app.dubbo.OtServiceApi.saveDoc({
        docId: id,
        op: JSON.stringify(op),
        snapshot: JSON.stringify(snapshot),
      });
    } catch (error) {
      db.app.otError('[DubboDB] [saveDoc] 保存快照失败 > dubbo 调用失败', { docId: id, rid }, error);
      return callback(error.message || '保存快照失败 > dubbo 调用失败');
    }

    const success = res && res.code === 0;
    if (success) {
      callback(null, true);
    } else {
      callback(JSON.stringify(res));
      db.app.otError('[DubboDB] [saveDoc] 保存快照失败 ', { docId: id, rid }, res);
    }
  });
};
/**
 * 获取最新快照
 * @param {*} collection 忽略
 * @param {*} id 文档ID
 * @param {*} fields 忽略
 * @param {*} options 忽略
 * @param {*} callback 回调
 */
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
    let res;
    try {
      res = await db.app.dubbo.OtServiceApi.getLatestSnapshot(id);
    } catch (error) {
      db.app.otError('[DubboDB] [getSnapshot] 查询快照失败 > dubbo 调用失败 ', { docId: id }, error);
      return callback(error.message || '查询快照失败 > dubbo 调用失败');
    }
    const success = res && res.code === 0;
    if (success) {
      let snapshot = parseJsonStr(res.data);
      if (!snapshot) {
        db.app.otLog('[DubboDB] [getSnapshot] 查询快照为空 ', { docId: id }, res.data);
        // 注意：查询为空，需要进行初始化版本
        snapshot = getDBSnapshot({
          id,
          v: 0,
          type: null,
          data: undefined,
          m: undefined,
        });
      } else {
        snapshot = getDBSnapshot({
          id: snapshot.id,
          v: snapshot.v,
          type: snapshot.type,
          data: parseJsonStr(snapshot.data),
          m: {
            cm: snapshot.createTime,
            um: snapshot.updateTime,
          },
        });
      }
      callback(null, snapshot);
    } else {
      callback(JSON.stringify(res));
      db.app.otError('[DubboDB] [getSnapshot] 查询快照失败 ', { docId: id }, res);
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
  const rid = uuidV4();
  if (typeof callback !== "function") throw new Error("Callback required");
  nextTick(async function() {
    let res;
    db.app.otLog('[DubboDB] [getOps] 查询ops ', { docId: id, rid }, { from, to });
    try {
      res = await db.app.dubbo.OtServiceApi.getOps({
        docId: id,
        from,
        to,
      });
    } catch (error) {
      db.app.otError('[DubboDB] [getOps] 查询ops失败 > dubbo 调用失败 ', { docId: id, rid }, error);
      return callback(error.message || '查询ops失败 > dubbo 调用失败');
    }

    const success = res && res.code === 0;
    if (success) {
      const ops = res.data.map(opstr => parseJsonStr(opstr)).filter(op => !!op);
      if (ops.length !== res.data.length) {
        db.app.otError('[DubboDB] [getOps] ops格式有误 ', { docId: id, rid }, res.data);
        callback('ops格式有误');
      } else {
        callback(null, ops);
      }
    } else {
      db.app.otError('[DubboDB] [getOps] 查询ops失败 ', { docId: id, rid }, res);
      callback(JSON.stringify(res));
    }

  });
};
