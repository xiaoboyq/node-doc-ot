'use strict';

const MockSocketStream = require('../../lib/stream/mockSocketStream');
const Service = require('egg').Service;
const EventEmitter = require('events').EventEmitter;
const Promise = require('bluebird');
const INITIAL_VALUE = [
  {
    type: "title",
    children: [
      {
        text: "",
      },
    ],
  },
  {
    type: "paragraph",
    children: [
      {
        text: "",
      },
    ],
  },
];

// TODO presenceId
class OTServer extends Service {
  // 注册客户端连接
  async listen({ presenceId, collection, docId }) {
    this.logger.info('[listen] pid = ', process.pid, ' presenceId, docId = ', presenceId, docId);

    this.app.wsMap[collection + docId] = this.app.wsMap[collection + docId] || {};
    const prevStream = this.app.wsMap[collection + docId][presenceId];
    if (!prevStream) {
      const ws = new EventEmitter();
      const mockStream = new MockSocketStream(ws, this.app.dubbo, { presenceId, docId, collection });
      this.app.wsMap[collection + docId][presenceId] = mockStream;
      this.logger.info('[listen] 挂载实例 pid = ', process.pid, ' presenceId, docId = ', presenceId, docId);
      this.app.backend.listen(mockStream);
    }
  }
  // 销毁客户端连接
  async leave({ presenceId, collection, docId }) {
    this.logger.info('[leave] presenceId, docId = ', presenceId, docId);
    this.app.wsMap[collection + docId] = this.app.wsMap[collection + docId] || {};
    const stream = this.app.wsMap[collection + docId][presenceId];
    if (stream) {
      stream.destroy();
      delete this.app.wsMap[collection + docId][presenceId];
      if (Object.keys(this.app.wsMap[collection + docId]).length === 0) {
        delete this.app.wsMap[collection + docId];
      }
      this.logger.info('[leave] 销毁订阅流 presenceId, docId = ', presenceId, docId);
    }
  }
  // 将消息转发给shareDB
  async emitMessage({ data: op, presenceId, collection, docId }) {
    const combineId = collection + docId;
    if (combineId in this.app.wsMap && this.app.wsMap[combineId][presenceId]) {
      this.app.wsMap[collection + docId][presenceId].ws.emit("message", op);
    } else {
      this.logger.error('[emitMessage] 本机未订阅该客户端 presenceId, docId = ', presenceId, docId, 'pid = ', process.pid);
      this.logger.error('[emitMessage] 忽略该条消息 op = ', JSON.stringify(op), 'pid = ', process.pid);
    }
  }
  // 初始化文档内容
  async initDoc({ collection, docId }) {
    const connection = this.app.backend.connect();
    const doc = Promise.promisifyAll(connection.get(collection, docId));
    try {
      await doc.fetchAsync();
      if (doc.type === null) {
        this.logger.info('[initDoc] 初始化doc成功 pid = ', process.pid, ' docId = ', docId);
        await doc.createAsync({ children: INITIAL_VALUE }, "slate-ot-type");
      }
    } catch (error) {
      this.logger.error('[initDoc] 初始化doc失败 pid = ', process.pid, ' docId = ', docId, error);
      return false;
    }
    return true;
  }
}

module.exports = OTServer;
