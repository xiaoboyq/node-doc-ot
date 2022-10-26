"use strict";


const ShareDB = require("@boss/sharedb");
const slateType = require("@boss/slate-ot").slateType;
const sheetType = require("@bzl/sheet-ottype").SheetOTType;
const DubboDB = require("./lib/db/dubboDB");
const getDubbo = require('./lib/dubbo');
slateType.transformPresence = p => p;
ShareDB.types.register(slateType);
ShareDB.types.register(sheetType);
const helper = require('./app/extend/helper');

module.exports = app => {

  console.log(`========== 当前环境：${app.config.env} ===========`);
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
  // backend.emit('submitRequestEnd', error, request);
  app.backend.on('submitRequestEnd', function(error, request) {
    app.otLog('[sharedb] 提交op ', { docId: request.id }, { error, op: helper.omit(request.op, [ 'op' ]) });
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
        if (ottype === 'xls') {
          // 找到 xls 下的所有 sheets
          const sheets = app.lru.get('xlsSheet').get(docId);
          // 删除 sheets 快照缓存
          sheets.foreach(sheetId => app.lru.get('snapshot').del(sheetId));
        }
        app.otLog('[service] [leave] 清空缓存 ', { docId, presenceId });
        delete app.wsMap[ottype + docId];
      }
    }
  };
};
