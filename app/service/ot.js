'use strict';

const MockSocketStream = require('../../lib/stream/mockSocketStream');
const Service = require('egg').Service;
const EventEmitter = require('events').EventEmitter;
const Promise = require('bluebird');
const uuidV4 = require('uuid').v4;
// import { v4 as uuidV4 } from 'uuid';
const INITIAL_VALUE = [
  {
    type: "title",
    id: uuidV4(),
    children: [
      {
        text: "",
      },
    ],
  },
  {
    type: "paragraph",
    id: uuidV4(),
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
    this.app.wsMap[collection + docId] = this.app.wsMap[collection + docId] || {};
    const prevStream = this.app.wsMap[collection + docId][presenceId];
    if (!prevStream) {
      const ws = new EventEmitter();
      const mockStream = new MockSocketStream(ws, this.app.dubbo, { presenceId, docId, collection });
      this.app.wsMap[collection + docId][presenceId] = mockStream;
      this.app.otLog('[service] [listen] 挂载实例  ', { docId, presenceId });
      this.app.backend.listen(mockStream);
    }
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
      this.app.otError('[service] [emitMessage] 本机未订阅该客户端 ', { docId, presenceId });
      this.app.otError('[service] [emitMessage] 忽略该条消息 ', op, { docId, presenceId });
    }
  }
  // 初始化文档内容
  async initDoc({ collection, docId }) {
    const connection = this.app.backend.connect();
    const doc = Promise.promisifyAll(connection.get(collection, docId));
    try {
      await doc.fetchAsync();
    } catch (error) {
      this.app.otError('[service] [initDoc] 查询doc失败 ', error, { docId });
    }
    // 进行初始化
    try {
      if (doc && doc.type === null) {
        await doc.createAsync({ children: INITIAL_VALUE }, "slate-ot-type");
      }
    } catch (error) {
      this.app.otError('[service] [initDoc] 初始化doc失败 ', error, { docId });
      return undefined;
    }
    this.app.otLog('[service] [initDoc] 初始化doc成功 ', { docId });
    return JSON.stringify(INITIAL_VALUE);
  }
}

module.exports = OTServer;
