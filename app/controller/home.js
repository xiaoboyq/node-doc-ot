"use strict";

const Controller = require("egg").Controller;
const MessageDB = require("../../messageDB");

const SlateOt = require("slate-ot");
const slateType = SlateOt.slateType;
slateType.transformPresence = () => {};
const ShareDB = require("sharedb");
ShareDB.types.register(slateType);
const Duplex = require("stream").Duplex;
const events = require("events");
// const ws = new events.EventEmitter();
const util = require("util");
const { default: axios } = require("axios");
const AgentPubSub = require("../../lib/pubsub/agentPubsub");

let backend = null;

console.log("testssssss");

const initialValue = [
  { type: "heading-one", children: [{ text: "123" }] },
  // { type: "heading-two", children: [{ text: "1、会议基本信息" }] },
  // { type: "paragraph", children: [{ text: "会议时间：" }] },
  // { type: "paragraph", children: [{ text: "会议地点：" }] },
  // {
  //   type: "paragraph",
  //   children: [
  //     { text: "参会人员：" },
  //     { type: "mention", character: "刘军", children: [{ text: "" }] },
  //     { text: "" },
  //     { type: "mention", character: "陈耀环", children: [{ text: "" }] },
  //     { text: "" },
  //   ],
  // },
];

function setInitDoc(callback = () => {}) {
  const connection = backend.connect();
  const doc = connection.get("examples", "richtext");
  doc.fetch(function(err) {
    if (err) throw err;
    if (doc.type === null) {
      console.log("Creating document");
      doc.create(
        {
          children: initialValue,
        },
        "slate-ot-type",
        callback
      );
      console.log("Doc.data in server");
      console.log(doc.data);
      return;
    }
    callback();
  });
}

function MockSocketStream(ws, userId) {
  Duplex.call(this, { objectMode: true });
  this.ws = ws;
  this.userId = userId;
  const self = this;

  ws.on("message", function(msg) {
    self.push(msg);
  });
  ws.on("close", function() {
    self.push(null); // end readable stream
    self.end(); // end writable stream

    self.emit("close");
    self.emit("end");
  });

  this.on("error", function() {
    console.log("error");
  });
  this.on("end", function() {
    console.log("end");
  });
}
util.inherits(MockSocketStream, Duplex);

MockSocketStream.prototype._read = function() {};
MockSocketStream.prototype._write = function(msg, encoding, next) {
  // console.log("send", msg);
  axios
    .post("http://127.0.0.1:8080/send", {
      data: msg,
      userId: this.userId,
    })
    .then(() => {
      // console.log("send success");
    })
    .catch(err => {
      console.log("send error", err);
    });
  next();
};

// const mockStream = new MockSocketStream(ws);
// backend.listen(mockStream);

const wsMap = {};

class HomeController extends Controller {
  async index() {
    // const { ctx } = this;
    // const res = await ctx.dubbo.MqttChatApi.demo(11, 22);
    // console.log(res);
    // ctx.body = res;

    if (!backend) {
      console.log('\x1B[36m 初始化实例 ===== \x1B[0m', process.pid);
      backend = new ShareDB({
        presence: true,
        db: new MessageDB({}, this.app),
        pubsub: new AgentPubSub(this.app),
      });
      setInitDoc();
    }

    const op = this.ctx.request.body.data;
    const userId = this.ctx.request.body.userId;
    if (!wsMap[userId]) {
      const ws = new events.EventEmitter();
      const mockStream = new MockSocketStream(ws, userId);
      backend.listen(mockStream);
      wsMap[userId] = ws;
    }
    // 获取用户信息，log 用户连接到哪个worker
    if (op.a === 'p') {
      const name = (op.p || {}).name || '';
      console.log('\x1B[36m message action ===== \x1B[0m', name, process.pid);
    }

    wsMap[userId].emit("message", op);

    this.ctx.body = {
      data: {},
      code: 0,
    };
  }

  async indexGet() {
    this.ctx.body = "hi";
    console.log(this.ctx.dubbo.TestNodeService);
  }
}

module.exports = HomeController;
