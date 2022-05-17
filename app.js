"use strict";

const sharedb = require("@boss/sharedb");
const DubboDB = require("./lib/db/dubboDB");
const getDubbo = require('./lib/dubbo');


module.exports = app => {
  // 用于存储 订阅 DOC 的 stream 对象
  // key: collection + docId
  // value: key: userId  value: stream
  app.wsMap = {};
  app.dubbo = getDubbo(app.config.zkRegistry);
  // shareDB 实例
  app.backend = new sharedb({
    presence: true,
    doNotForwardSendPresenceErrorsToClient: true,
    db: new DubboDB(app),
  });
};
