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
function getDBSnapshot({ id, v, type, data, m }) {
  return {
    id,
    v,
    type,
    data,
    m,
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
  this.collection = 'zhishu';
}
module.exports = DubboDB;

DubboDB.prototype = Object.create(DB.prototype);

DubboDB.prototype.close = function(callback) {
  this.closed = true;
  if (callback) callback();
};

/**
 * 缓存快照
 * @param {*} id 文档ID
 * @param {*} snapshot 快照
 */
DubboDB.prototype.setSnapshotCache = function(id, snapshot) {
  this.app.lru.get('snapshot').set(id, snapshot);
};
/**
 * 查询快照缓存
 * @param {*} id 文档ID
 */
DubboDB.prototype.getSnapshotCache = function(id) {
  const s = this.app.lru.get('snapshot').get(id);
  return s ? JSON.parse(JSON.stringify(s)) : undefined;
};

/**
 * 缓存op
 * @param {*} id 文档ID
 * @param {*} op op对象
 */
DubboDB.prototype.setOpCache = function(id, op) {
  const ops = this.app.lru.get('ops').get(id) || {};
  ops[op.v] = JSON.parse(JSON.stringify(op));
  this.app.lru.get('ops').set(id, ops);
};

/**
 * 缓存区间 ops
 * @param {string} id 文档ID
 * @param {object[]} ops ops
 * @param {number} from 开始版本
 */
DubboDB.prototype.setOpBatchCache = function(id, ops, from) {
  const cacheOps = this.app.lru.get('ops').get(id) || {};
  for (let i = 0; i < ops.length; i++) {
    cacheOps[from + i] = ops[i];
  }
  this.app.lru.get('ops').set(id, cacheOps);
};

/**
 * 查询缓存ops区间
 * @param {*} id 文档ID
 * @param {*} from 开始版本
 * @param {*} to 结束版本
 */
DubboDB.prototype.getOpsCache = function(id, from, to) {
  const ops = this.app.lru.get('ops').get(id);
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
  const start = Date.now();
  const db = this;
  if (typeof callback !== "function") throw new Error("Callback required");
  nextTick(async function() {
    const rid = uuidV4();
    db.app.otLog('[DubboDB] [saveDoc] 保存快照 ', { docId: id, rid }, { op: { src: op.src, v: op.v, seq: op.seq, u: op.u }, snapshot: snapshot.v });
    try {
      const res = await db.app.dubbo.OtServiceApi.saveDoc({
        docId: id,
        op: JSON.stringify(op),
        snapshot: JSON.stringify(snapshot),
      });
      const success = res && res.code === 0;
      if (success) {
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
  const start = Date.now();
  const db = this;
  if (typeof callback !== "function") throw new Error("Callback required");
  nextTick(async function() {
    const rid = uuidV4();
    // 读取缓存snapshot
    const cacheSnapshot = db.getSnapshotCache(id);
    if (cacheSnapshot) {
      db.app.otLog(`[DubboDB] [getSnapshot] 获取缓存快照 版本 ${cacheSnapshot.v} 耗时 ${Date.now() - start}`, { docId: id, rid });
      return callback(null, cacheSnapshot);
    }
    // 缓存不存在。读取DB
    try {
      const res = await db.app.dubbo.OtServiceApi.getLatestSnapshot(id);
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
  const start = Date.now();
  const db = this;
  const rid = uuidV4();
  if (typeof callback !== "function") throw new Error("Callback required");
  nextTick(async function() {
    db.app.otLog('[DubboDB] [getOps] 查询ops ', { docId: id, rid }, { from, to });
    const cacheOps = db.getOpsCache(id, from, to);
    if (cacheOps) {
      db.app.otLog(`[DubboDB] [getOps] 获取缓存ops 耗时 ${Date.now() - start}`, { docId: id, rid });
      return callback(null, cacheOps);
    }
    try {
      const res = await db.app.dubbo.OtServiceApi.getOps({
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

  });
};
