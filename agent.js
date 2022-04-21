"use strict";
// agent.js
// 模拟 DB server，提供 snapshot/op 的 存储/查询
const MemoryDB = require("sharedb").MemoryDB;
module.exports = agent => {
  agent.messenger.on('agent-sub', message => {
    // console.log('监听agent消息', message);
    agent.messenger.sendToApp('agent-pub', message);
  });

  agent.messenger.on("egg-ready", () => {
    const data = { name: "z" };
    agent.messenger.sendToApp("test_action", data);
  });

  const db = new MemoryDB();

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

};
