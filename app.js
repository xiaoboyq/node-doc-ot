"use strict";

const sharedb = require("sharedb");
// const DubboDB = require("./lib/db/DubboDB");
const getDubbo = require('./lib/dubbo');
// const AgentPubSub = require("./lib/pubsub/agentPubsub");

module.exports = app => {
  app.messenger.on("test_action", data => {
    console.log("接收 agent 消息", data);
  });

  // 用于存储 订阅 DOC 的 stream 对象
  // key: collection + docId
  // value: key: userId  value: stream
  app.wsMap = {};
  app.dubbo = getDubbo(app.config.zkRegistry);
  // shareDB 实例
  app.backend = new sharedb({
    presence: true,
    doNotForwardSendPresenceErrorsToClient: true,
    // db: new DubboDB(app),
    // pubsub: new AgentPubSub(app),
  });
};
