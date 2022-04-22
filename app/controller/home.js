"use strict";

const Controller = require("egg").Controller;

const SlateOt = require("slate-ot");
const slateType = SlateOt.slateType;
slateType.transformPresence = () => {};
const ShareDB = require("sharedb");
ShareDB.types.register(slateType);

const events = require("events");
const MockSocketStream = require("../../lib/stream/mockSocketStream");


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

// collection => docId => useId => mockStream
// const wsMap = {};

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
        // db: new MessageDB({}, this.app),
        // pubsub: new AgentPubSub(this.app),
      });
      setInitDoc();
    }

    const op = this.ctx.request.body.data;
    const { userId, collection, docId } = this.ctx.request.body;
    this.app.wsMap[collection + docId] = this.app.wsMap[collection + docId] || {};
    const prevStream = this.app.wsMap[collection + docId][userId];
    if (!prevStream) {
      const ws = new events.EventEmitter();
      const mockStream = new MockSocketStream(ws, { userId, docId, collection });
      this.app.wsMap[collection + docId][userId] = mockStream;
      backend.listen(mockStream);
    }

    this.app.wsMap[collection + docId][userId].ws.emit("message", op);

    this.ctx.body = {
      data: {},
      code: 0,
    };
  }

  async leave() {
    const { userId, collection, docId } = this.ctx.request.body;
    this.app.wsMap[collection + docId] = this.app.wsMap[collection + docId] || {};
    const stream = this.app.wsMap[collection + docId][userId];
    if (stream) {
      stream.destroy();
    }
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
