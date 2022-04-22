"use strict";
module.exports = app => {
  app.messenger.on("test_action", data => {
    console.log("接收 agent 消息", data);
  });

  // 用于存储 订阅 DOC 的 stream 对象
  // key: collection + docId
  // value: stream
  app.wsMap = {};
};
