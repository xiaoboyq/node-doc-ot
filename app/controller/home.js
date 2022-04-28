"use strict";

const Controller = require("egg").Controller;
const ShareDB = require("sharedb");
const EventEmitter = require('events').EventEmitter;
const Promise = require('bluebird');
const MockSocketStream = require("../../lib/stream/mockSocketStream");
const SlateOt = require("slate-ot");
const slateType = SlateOt.slateType;
slateType.transformPresence = p => p;
ShareDB.types.register(slateType);
const INITIAL_VALUE = [
  { type: "paragraph", children: [{ text: "" }] },
];

console.log("testssssss");

class HomeController extends Controller {
  // 处理 op
  async index() {

    const op = this.ctx.request.body.data;
    const { userId, collection, docId } = this.ctx.request.body;
    const combineId = collection + docId;
    if (op.a === 'hs') {
      await this.service.ot.listen({ userId, collection, docId });
      await this.service.ot.initDoc({ collection, docId });
    }
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
      const mockStream = new MockSocketStream(ws, this.app.dubbo, { userId, docId, collection });
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
    console.log(this.dubbo.TestNodeService);
  }
  async dubboReply() {
    // const res = await this.app.dubbo.OtServiceApi.reply({
    //   docId: '1',
    //   userId: 'uid-1',
    //   data: '{a: "消息a"}',
    // });

    // const res = await this.app.dubbo.OtServiceApi.getOps({
    //   docId: '1',
    //   from: 0,
    //   to: 100,
    // });

    // const res = await this.app.dubbo.OtServiceApi.getLatestSnapshot('1');
    const res = await this.app.dubbo.OtServiceApi.saveDoc({
      docId: '1',
      op: '{"a":"hs","id":null}',
      snapshot: '[{"type":"paragraph","children":[{"text":""}]}]',

    });

    console.log('OtServiceApi.saveDoc>>', res);


    this.ctx.body = res;

  }
}

module.exports = HomeController;
