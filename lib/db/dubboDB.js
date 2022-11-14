'use strict';

const DB = require("@boss/sharedb").DB;
// const produce = require('immer').produce;
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
function getDBSnapshot({ id, v, type, data, m, rbv }) {
  // if (type === 'sheet-ot-type') {
  //   return {
  //     id,
  //     v,
  //     type,
  //     data: data || { },
  //     m,
  //     rbv: rbv || 0,
  //   };
  // }
  return {
    id,
    v,
    type,
    data,
    m,
    rbv: rbv || 0,
  };
}
/**
 * 返回错误
 * @param {*} res dubbo res
 * @return {json} error
 */
function getReplyErrorObject(res) {
  if (res) {
    return res;
  }
  return {
    code: 2100,
    message: 'dubbo接口返回null',
  };

}
function DubboDB(app, options) {
  if (!(this instanceof DubboDB)) return new DubboDB(options);
  DB.call(this, options);
  this.app = app;
  this.closed = false;
}
module.exports = DubboDB;

DubboDB.prototype = Object.create(DB.prototype);

DubboDB.prototype.close = function(callback) {
  this.closed = true;
  if (callback) callback();
};

/**
 * 缓存快照
 * @param {*} idx 索引：${otType} + # + (文档ID | sheetId)
 * @param {*} snapshot 快照
 */
DubboDB.prototype.setSnapshotCache = function(idx, snapshot) {
  this.app.lru.get('snapshot').set(idx, snapshot);
};
/**
 * 查询快照缓存
 * @param {*} idx 索引：${otType} + # + (文档ID | sheetId)
 */
DubboDB.prototype.getSnapshotCache = function(idx) {
  const s = this.app.lru.get('snapshot').get(idx);
  return s ? JSON.parse(JSON.stringify(s)) : undefined;
};

/**
 * 缓存op
 * @param {*} idx 索引：${otType} + # + (文档ID | sheetId)
 * @param {*} op op对象
 */
DubboDB.prototype.setOpCache = function(idx, op) {
  const ops = this.app.lru.get('ops').get(idx) || {};
  ops[op.v] = JSON.parse(JSON.stringify(op));
  this.app.lru.get('ops').set(idx, ops);
};

/**
 * 缓存区间 ops
 * @param {string} idx 索引：${otType} + # + (文档ID | sheetId)
 * @param {object[]} ops ops
 * @param {number} from 开始版本
 */
DubboDB.prototype.setOpBatchCache = function(idx, ops, from) {
  const cacheOps = this.app.lru.get('ops').get(idx) || {};
  for (let i = 0; i < ops.length; i++) {
    cacheOps[from + i] = ops[i];
  }
  this.app.lru.get('ops').set(idx, cacheOps);
};

/**
 * 查询缓存ops区间
 * @param {*} idx 索引：${otType} + # + (文档ID | sheetId)
 * @param {*} from 开始版本
 * @param {*} to 结束版本
 */
DubboDB.prototype.getOpsCache = function(idx, from, to) {
  const ops = this.app.lru.get('ops').get(idx);
  if (!ops) return undefined;
  let result;
  for (let i = from; i <= to; i++) {
    if (ops[i]) {
      result = result || [];
      result.push(ops[i]);
    } else {
      return undefined;
    }
  }
  return result;

};

/**
 * 提交 ops 和 snapshot 到数据库
 * @param {string} collection  轻文档：“zhishu” / 轻表格：xlsId
 * @param {string} id 索引：${otType} + # + (文档ID | sheetId)
 * @param {json} op op对象
 * @param {json} snapshot 快照对象
 * @param {json} options 暂时不用
 * @param {function} callback 回调
 */
DubboDB.prototype.commit = async function(
  collection,
  id,
  op,
  snapshot,
  options,
  callback
) {
  if (typeof callback !== "function") throw new Error("Callback required");
  const start = Date.now();
  const db = this;
  // nextTick(async function() {
  const rid = uuidV4();
  db.app.otLog('[DubboDB] [saveDoc] 保存快照 ', { docId: id, rid }, { op: { src: op.src, v: op.v, seq: op.seq, u: op.u }, snapshot: snapshot.v });
  try {
    const res = await db._saveDoc({
      collection,
      docId: id,
      op: JSON.stringify(op),
      snapshot: JSON.stringify(snapshot),
    });
    if (res && res.code === 0) {
      // 保存快照成功，更新缓存snapshot 和 ops
      db.setSnapshotCache(id, snapshot);
      db.setOpCache(id, op);
      db.app.otLog('[DubboDB] [saveDoc] 保存快照成功 ' + snapshot.v + ' 耗时 ', { docId: id, rid }, Date.now() - start);
      return callback(null, true);
    }
    db.app.otError('[DubboDB] [saveDoc] 保存快照失败 ', { docId: id, rid }, res);
    return callback(getReplyErrorObject(res));
  } catch (error) {
    db.app.otError('[DubboDB] [saveDoc] 保存快照失败 > dubbo 调用失败', { docId: id, rid }, error);
    return callback(error.message || '保存快照失败 > dubbo 调用失败');
  }
  // });
};


/**
 * 兼容 轻文档/轻表格 的 saveDoc dubbo 调用
 * @param {string} docId 轻文档：docId / 轻表格：sheetID
 *  {json} op op对象
 * {json} snapshot 快照对象
 * {string} collection  轻文档：“zhishu” / 轻表格：xlsId
 * @return {*} res
 */
DubboDB.prototype._saveDoc = async function({ docId, op, snapshot, collection }) {
  // if (collection === 'zhishu') {
  // 轻文档
  if (docId.startsWith("doc#")) {
    return await this.app.dubbo.OtServiceApi.saveDoc({
      docId: docId.substring("doc#".length),
      op,
      snapshot,
    });
  }
  // 轻表格
  if (docId.startsWith("xls#")) {
    return await this.app.dubbo.XlsOtServiceApi.saveDoc({
      docId: collection,
      sheetId: docId.substring("xls#".length),
      op,
      snapshot,
    });
  }
};
/**
 * 获取最新快照
 * @param {*} collection
 * @param {*} id 索引：${otType} + # + (文档ID | sheetId)
 * @param {*} fields 忽略
 * @param {*} options 忽略
 * @param {*} callback 回调
 */
DubboDB.prototype.getSnapshot = async function(
  collection,
  id,
  fields,
  options,
  callback
) {
  const start = Date.now();
  const db = this;
  if (typeof callback !== "function") throw new Error("Callback required");
  // nextTick(async function() {
  const rid = uuidV4();
  // 读取缓存snapshot
  const cacheSnapshot = db.getSnapshotCache(id);
  if (cacheSnapshot) {
    db.app.otLog(`[DubboDB] [getSnapshot] 获取缓存快照 版本 ${cacheSnapshot.v} 耗时 ${Date.now() - start}`, { docId: id, rid });
    return callback(null, cacheSnapshot);
  }
  // 缓存不存在。读取DB
  try {
    const res = await db._getLatestSnapshot({ docId: id, collection });
    const success = res && res.code === 0;
    if (success) {
      let snapshot = parseJsonStr(res.data);
      if (!snapshot) {
        db.app.otLog('[DubboDB] [getSnapshot] 查询快照为空 ', { docId: id, rid }, res.data);
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
          rbv: snapshot.rbv,
          data: parseJsonStr(snapshot.data),
          m: {
            cm: snapshot.createTime,
            um: snapshot.updateTime,
          },
        });
      }
      // 缓存snapshot
      db.setSnapshotCache(id, snapshot);
      db.app.otLog('[DubboDB] [getSnapshot] 查询快照成功 ' + snapshot.v + ' 耗时 ', { docId: id, rid }, Date.now() - start);
      return callback(null, snapshot);
    }
    db.app.otError('[DubboDB] [getSnapshot] 查询快照失败 ', { docId: id, rid }, res);
    return callback(getReplyErrorObject(res));

  } catch (error) {
    db.app.otError('[DubboDB] [getSnapshot] 查询快照失败 > dubbo 调用失败 ', { docId: id, rid }, error);
    return callback(error.message || '查询快照失败 > dubbo 调用失败');
  }
  // });
};

DubboDB.prototype._getLatestSnapshot = async function({ docId, collection }) {
  // 轻表格
  if (docId.startsWith('xls#')) {
    const id = docId.substring('xls#'.length);
    return await this.app.dubbo.XlsOtServiceApi.getLatestSnapshot({ docId: collection, sheetId: id });
  }
  // 轻文档
  if (docId.startsWith('doc#')) {
    const id = docId.substring('doc#'.length);
    return await this.app.dubbo.OtServiceApi.getLatestSnapshot(id);
  }

};

DubboDB.prototype.getOps = async function(
  collection,
  id,
  from,
  to,
  options,
  callback
) {
  const start = Date.now();
  const db = this;
  const rid = uuidV4();
  if (typeof callback !== "function") throw new Error("Callback required");
  // nextTick(async function() {
  db.app.otLog('[DubboDB] [getOps] 查询ops ', { docId: id, rid }, { from, to });
  const cacheOps = db.getOpsCache(id, from, to);
  if (cacheOps) {
    db.app.otLog(`[DubboDB] [getOps] 获取缓存ops 耗时 ${Date.now() - start}`, { docId: id, rid });
    return callback(null, cacheOps);
  }
  try {
    const res = await db._getOps({
      collection,
      docId: id,
      from,
      to,
    });
    const success = res && res.code === 0;
    if (success) {
      const ops = res.data.map(opstr => parseJsonStr(opstr)).filter(op => !!op);
      if (ops.length !== res.data.length) {
        db.app.otError('[DubboDB] [getOps] ops格式有误 ', { docId: id, rid }, res.data);
        callback('ops格式有误');
      } else {
        // 查询成功，缓存ops区间
        db.setOpBatchCache(id, ops, from);
        db.app.otLog(`[DubboDB] [getOps] 查询ops成功 耗时 ${Date.now() - start}`, { docId: id, rid });
        callback(null, ops);
      }
    } else {
      db.app.otError('[DubboDB] [getOps] 查询ops失败 ', { docId: id, rid }, res);
      callback(getReplyErrorObject(res));
    }
  } catch (error) {
    db.app.otError('[DubboDB] [getOps] 查询ops失败 > dubbo 调用失败 ', { docId: id, rid }, error);
    callback(error.message || '查询ops失败 > dubbo 调用失败');
  }
  // });
};

DubboDB.prototype._getOps = async function({ docId, collection, from, to }) {
  // if (collection === 'zhishu') {
  // 轻文档
  if (docId.startsWith('doc#')) {
    return await this.app.dubbo.OtServiceApi.getOps({
      docId: docId.substring('doc#'.length),
      from,
      to,
    });
  }
  // 轻表格
  if (docId.startsWith('xls#')) {
    return await this.app.dubbo.XlsOtServiceApi.getOps({ docId: collection, sheetId: docId.substring('xls#'.length), from, to });
  }
};
