'use strict';

const MockSocketStream = require('../../lib/stream/mockSocketStream');
const Service = require('egg').Service;
const EventEmitter = require('events').EventEmitter;
const Promise = require('bluebird');
const INITIAL_VALUE = [
  { type: "paragraph", children: [{ text: "" }] },
];

class OTServer extends Service {
  // 注册客户端连接
  async listen({ userId, collection, docId }) {
    this.logger.info('[listen] pid = ', process.pid, ' userId, docId = ', userId, docId);
    // listen stream
    this.app.wsMap[collection + docId] = this.app.wsMap[collection + docId] || {};
    const prevStream = this.app.wsMap[collection + docId][userId];
    if (!prevStream) {
      const ws = new EventEmitter();
      const mockStream = new MockSocketStream(ws, { userId, docId, collection });
      this.app.wsMap[collection + docId][userId] = mockStream;
      this.logger.info('[listen] 挂载实例 pid = ', process.pid, ' userId, docId = ', userId, docId);
      this.app.backend.listen(mockStream);
    }

    // init Doc
    const connection = this.app.backend.connect();
    const doc = Promise.promisifyAll(connection.get(collection, docId));
    await doc.fetchAsync();
    if (doc.type === null) {
      this.logger.info('[listen] initDoc pid = ', process.pid, ' userId, docId = ', userId, docId);
      await doc.createAsync({ children: INITIAL_VALUE }, "slate-ot-type");
    }
  }
  // 销毁客户端连接
  async leave({ userId, collection, docId }) {
    this.logger.info('[leave] userId, docId = ', userId, docId);
    this.app.wsMap[collection + docId] = this.app.wsMap[collection + docId] || {};
    const stream = this.app.wsMap[collection + docId][userId];
    if (stream) {
      this.logger.info('[leave] 销毁订阅流 userId, docId = ', userId, docId);
      stream.destroy();
    }
  }
  // 将消息转发给shareDB
  async emitMessage({ data: op, userId, collection, docId }) {
    const combineId = collection + docId;
    if (combineId in this.app.wsMap && this.app.wsMap[combineId][userId]) {
      this.app.wsMap[collection + docId][userId].ws.emit("message", op);
    } else {
      this.logger.error('[emitMessage] 本机未订阅该客户端 userId, docId = ', userId, docId, 'pid = ', process.pid);
      this.logger.error('[emitMessage] 忽略该条消息 op = ', JSON.stringify(op), 'pid = ', process.pid);
    }
  }
}

module.exports = OTServer;
