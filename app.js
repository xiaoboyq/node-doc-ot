"use strict";


const ShareDB = require("@boss/sharedb");
const slateType = require("@boss/slate-ot").slateType;
const DubboDB = require("./lib/db/dubboDB");
const getDubbo = require('./lib/dubbo');
slateType.transformPresence = p => p;
ShareDB.types.register(slateType);

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
    gzip: true,
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
};
