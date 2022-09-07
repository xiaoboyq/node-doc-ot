"use strict";


const ShareDB = require("@boss/sharedb");
const slateType = require("@boss/slate-ot").slateType;
const sheetType = require("@bzl/sheet-ottype").SheetOTType;
const DubboDB = require("./lib/db/dubboDB");
const getDubbo = require('./lib/dubbo');
slateType.transformPresence = p => p;
ShareDB.types.register(slateType);
ShareDB.types.register(sheetType);

module.exports = app => {
  // 用于存储 订阅 DOC 的 stream 对象
  // key: collection + docId
  // value: key: userId  value: stream
  app.wsMap = {};
  app.dubbo = getDubbo(app.config.zkRegistry);
  // shareDB 实例
  app.backend = new ShareDB({
    presence: true,
    doNotForwardSendPresenceErrorsToClient: true,
    db: new DubboDB(app),
    // gzip: true,
  });

  // sharedb 中间件——注入handle op 逻辑
  app.backend.use('submit', function(context, next) {
    const docId = context.id;
    const op = context.op;
    app.backend.db.getSnapshot(context.collection, docId, null, null, function(err, snapshot) {
      if (err) {
        next(err);
      } else if (op.v < snapshot.rbv) {
        // 还原前的操作，返回 Error
        next({
          code: 'ERR_OP_BEFORE_RBV',
          message: "该文档已被还原，忽略该OP",
        });
      } else {
        next();
      }
    });
  });

  app.handleUserLeave = ({ docId, presenceId, ottype }) => {
    app.otLog('[service] [leave] 用户断连 ', { docId, presenceId });
    app.wsMap[ottype + docId] = app.wsMap[ottype + docId] || {};
    const stream = app.wsMap[ottype + docId][presenceId];
    if (stream) {
      stream.destroy();
      delete app.wsMap[ottype + docId][presenceId];
      if (Object.keys(app.wsMap[ottype + docId]).length === 0) {
        // 当当前 docID 没有客户端时，清空 op、snapshot缓存
        app.lru.get('snapshot').del(docId);
        app.lru.get('ops').del(docId);
        app.otLog('[service] [leave] 清空缓存 ', { docId, presenceId });
        delete app.wsMap[ottype + docId];
      }
    }
  };
};
