"use strict";

const Controller = require("egg").Controller;

const SlateOt = require("slate-ot");
const slateType = SlateOt.slateType;
slateType.transformPresence = () => {};
const ShareDB = require("sharedb");
const EventEmitter = require('events').EventEmitter;
const Promise = require('bluebird');
const MockSocketStream = require("../../lib/stream/mockSocketStream");
ShareDB.types.register(slateType);
const INITIAL_VALUE = [
  { type: "paragraph", children: [{ text: "" }] },
];

// let backend = null;

console.log("testssssss");


class HomeController extends Controller {
  // 处理 op
  async index() {
    // const { ctx } = this;
    // const res = await ctx.dubbo.MqttChatApi.demo(11, 22);
    // console.log(res);
    // ctx.body = res;

    // if (!backend) {
    // console.log('\x1B[36m 初始化实例 ===== \x1B[0m', process.pid);
    // backend = new ShareDB({
    //   presence: true,
    //   db: new MessageDB({}, this.app),
    //   // pubsub: new AgentPubSub(this.app),
    // });
    // setInitDoc();
    // }

    const op = this.ctx.request.body.data;
    const { userId, collection, docId } = this.ctx.request.body;
    const combineId = collection + docId;
    // if (op.a === 'hs') {
    //   await this.service.ot.listen({ userId, collection, docId });
    // }
    if (combineId in this.app.wsMap && this.app.wsMap[combineId][userId]) {
      this.app.wsMap[collection + docId][userId].ws.emit("message", op);
    }


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

  // listen
  async listen() {
    const { userId, collection, docId } = this.ctx.request.body;
    // listen stream
    this.app.wsMap[collection + docId] = this.app.wsMap[collection + docId] || {};
    const prevStream = this.app.wsMap[collection + docId][userId];
    if (!prevStream) {
      const ws = new EventEmitter();
      const mockStream = new MockSocketStream(ws, { userId, docId, collection });
      this.app.wsMap[collection + docId][userId] = mockStream;
      console.log('挂载实例', process.pid, collection + docId, userId);
      this.app.backend.listen(mockStream);
    }

    // init Doc
    const connection = this.app.backend.connect();
    const doc = Promise.promisifyAll(connection.get(collection, docId));
    await doc.fetchAsync();
    if (doc.type === null) {
      await doc.createAsync({ children: INITIAL_VALUE }, "slate-ot-type");
      console.log("Doc.data in server");
      console.log(doc.data);
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
