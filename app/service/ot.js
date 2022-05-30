'use strict';

const MockSocketStream = require('../../lib/stream/mockSocketStream');
const Service = require('egg').Service;
const EventEmitter = require('events').EventEmitter;
const Promise = require('bluebird');
const shortUuid = require('short-uuid');

const INITIAL_VALUE = [
  {
    type: "paragraph",
    id: shortUuid(),
    children: [
      {
        text: "",
      },
    ],
  },
];

class OTServer extends Service {
  // 注册客户端连接
  async listen({ presenceId, collection, docId }) {
    this.app.otLog('[service] [listen] 注册客户端连接 ', { docId, presenceId });
    // 检查是否需要在此进行文档初始化
    const initSuccess = await this.checkInItDoc({ collection, docId });
    if (!initSuccess) {
      this.app.otError('[service] [listen] 初始化文档失败 ', { docId, presenceId });
      return false;
    }
    this.app.wsMap[collection + docId] = this.app.wsMap[collection + docId] || {};
    const prevStream = this.app.wsMap[collection + docId][presenceId];
    if (!prevStream) {
      const ws = new EventEmitter();
      const mockStream = new MockSocketStream(ws, { app: this.app }, { presenceId, docId, collection });
      this.app.wsMap[collection + docId][presenceId] = mockStream;
      this.app.otLog('[service] [listen] 挂载实例  ', { docId, presenceId });
      this.app.backend.listen(mockStream);
    }
    return true;
  }
  async checkInItDoc({ collection, docId }) {
    if (!this.app.wsMap[collection + docId]) {
      const success = await this.initDoc({ collection, docId });
      return !!success;
    }
    return true;
  }
  hasSubscribed({ presenceId, collection, docId }) {
    const combineId = collection + docId;
    return this.app.wsMap[combineId] && this.app.wsMap[combineId][presenceId];
  }
  // 销毁客户端连接
  async leave({ presenceId, collection, docId }) {
    this.app.otLog('[service] [leave] 用户断连 ', { docId, presenceId });
    this.app.wsMap[collection + docId] = this.app.wsMap[collection + docId] || {};
    const stream = this.app.wsMap[collection + docId][presenceId];
    if (stream) {
      stream.destroy();
      delete this.app.wsMap[collection + docId][presenceId];
      if (Object.keys(this.app.wsMap[collection + docId]).length === 0) {
        // 当当前 docID 没有客户端时，清空 op、snapshot缓存
        this.app.lru.get('snapshot').delete(docId);
        this.app.lru.get('ops').delete(docId);
        this.app.otLog('[service] [leave] 清空缓存 ', { docId, presenceId });
        delete this.app.wsMap[collection + docId];
      }
      this.app.otLog('[service] [leave] 销毁订阅流 ', { docId, presenceId });
    }
  }
  // 将消息转发给shareDB
  async emitMessage({ data: op, presenceId, collection, docId }) {
    const combineId = collection + docId;
    if (combineId in this.app.wsMap && this.app.wsMap[combineId][presenceId]) {
      this.app.wsMap[collection + docId][presenceId].ws.emit("message", op);
    } else {
      this.app.otError('[service] [emitMessage] 本机未订阅该客户端 ', { docId, presenceId }, { docId, presenceId });
      this.app.otError('[service] [emitMessage] 忽略该条消息 ', { docId, presenceId }, op);
    }
  }
  // 初始化文档内容
  async initDoc({ collection, docId }) {
    const connection = this.app.backend.connect();
    const doc = Promise.promisifyAll(connection.get(collection, docId));
    try {
      await doc.fetchAsync();
    } catch (error) {
      this.app.otError('[service] [initDoc] 查询doc失败 ', { docId }, error);
    }
    // 进行初始化
    try {
      if (doc && doc.type === null) {
        this.app.otLog('[service] [initDoc] 开始初始化doc ', { docId });
        await doc.createAsync({ children: INITIAL_VALUE }, "slate-ot-type");
      }
      this.app.otLog('[service] [initDoc] 初始化doc成功 ', { docId }, { content: INITIAL_VALUE });
      return JSON.stringify(INITIAL_VALUE);
    } catch (error) {
      this.app.otError('[service] [initDoc] 初始化doc失败 ', { docId }, error);
      return undefined;
    }
  }
}

module.exports = OTServer;
