"use strict";
// agent.js
// 模拟 DB server，提供 snapshot/op 的 存储/查询
const MemoryDB = require("sharedb").MemoryDB;
module.exports = agent => {
  // 在这里写你的初始化逻辑
  // 也可以通过 messenger 对象发送消息给 App Worker
  // 但需要等待 App Worker 启动成功后才能发送，不然很可能丢失
  const db = new MemoryDB();
  agent.messenger.on("egg-ready", () => {
    const data = { name: "z" };
    agent.messenger.sendToApp("test_action", data);
  });

  agent.messenger.on("commit", data => {
    const { collection, id, op, snapshot, options } = data;
    db.commit(collection, id, op, snapshot, options, (err, succeeded) => {
      if (err) throw new Error("commit error");
      succeeded && agent.messenger.sendToApp("commitSuccess", succeeded);
    });
  });

  agent.messenger.on("getSnapshot", data => {
    const { collection, id, fields, options } = data;
    db.getSnapshot(collection, id, fields, options, (err, snapshot) => {
      if (err) throw new Error("getSnapshot error");
      agent.messenger.sendToApp("returnSnapshot", snapshot);
    });
  });

  agent.messenger.on("getOps", data => {
    const { collection, id, from, to, options } = data;
    db.getOps(collection, id, from, to, options, (err, ops) => {
      if (err) throw new Error("getOps error");
      agent.messenger.sendToApp("returnOps", ops);
    });
  });

  // function MockDB(options) {
  //   if (!(this instanceof MockDB)) return new MockDB(options);
  //   DB.call(this, options);

  //   this.closed = false;

  // };
  // MockDB.prototype = Object.create(MockDB.prototype);
  // MockDB.prototype.close = function(callback) {
  //   this.closed = true;
  //   if (callback) callback();
  // };
};
