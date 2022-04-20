"use strict";
module.exports = app => {
  app.messenger.on("test_action", data => {
    console.log("接收 agent 消息", data);
  });
};
