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
    // gzip: true,
  });
};
