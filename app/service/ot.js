'use strict';

const MockSocketStream = require('../../lib/stream/mockSocketStream');
const Service = require('egg').Service;
const EventEmitter = require('events').EventEmitter;
const Promise = require('bluebird');
const shortUuid = require('short-uuid');


function getInitialValue() {
  return [
    {
      type: "paragraph",
      id: shortUuid.generate(),
      children: [
        {
          text: "",
        },
      ],
    },
  ];
}

class OTServer extends Service {
  // 注册客户端连接
  async listen({ presenceId, docId, ottype }) {
    this.app.otLog('[service] [listen] 注册客户端连接 ', { docId, presenceId });
    // 检查是否需要在此进行文档初始化(仅限轻文档)
    if (ottype === 'doc') {
      const initSuccess = await this.checkInItDoc({ ottype, docId });
      if (!initSuccess) {
        this.app.otError('[service] [listen] 初始化文档失败 ', { docId, presenceId });
        return false;
      }
    }
    this.app.wsMap[ottype + docId] = this.app.wsMap[ottype + docId] || {};
    const prevStream = this.app.wsMap[ottype + docId][presenceId];
    if (!prevStream) {
      const ws = new EventEmitter();
      const mockStream = new MockSocketStream(ws, { app: this.app }, { presenceId, docId, ottype });
      this.app.wsMap[ottype + docId][presenceId] = mockStream;
      this.app.otLog('[service] [listen] 挂载实例  ', { docId, presenceId });
      this.app.backend.listen(mockStream);
    }
    return true;
  }
  async checkInItDoc({ ottype, docId }) {
    if (!this.app.wsMap[ottype + docId]) {
      const success = await this.initDoc({ docId });
      return !!success;
    }
    return true;
  }
  hasSubscribed({ presenceId, ottype, docId }) {
    const combineId = ottype + docId;
    return this.app.wsMap[combineId] && this.app.wsMap[combineId][presenceId];
  }
  // 销毁客户端连接
  async leave({ presenceId, ottype, docId }) {
    this.app.handleUserLeave({ presenceId, docId, ottype });
  }
  // 将消息转发给shareDB
  async emitMessage({ data: op, presenceId, ottype, docId }) {
    const combineId = ottype + docId;
    if (combineId in this.app.wsMap && this.app.wsMap[combineId][presenceId]) {
      this.app.wsMap[combineId][presenceId].ws.emit("message", op);
    } else {
      this.app.otError('[service] [emitMessage] 本机未订阅该客户端 ', { docId, presenceId }, { docId, presenceId });
      this.app.otError('[service] [emitMessage] 忽略该条消息 ', { docId, presenceId }, op);
    }
    this.handleSubscribeOp({ op, ottype });
  }
  // 在订阅时 记录 xls - sheet 映射关系
  handleSubscribeOp({ op, ottype }) {
    if (ottype === 'xls' && op.a === 's') {
      const sheetId = op.d;
      const xlsId = op.c;
      this.cacheXlsSheetRelation(xlsId, sheetId);
    }
  }
  // 轻表格逻辑 —— 记录 xls / sheets 的映射关系
  cacheXlsSheetRelation(xlsId, sheetId) {
    const sheets = this.app.lru.get('xlsSheet').get(xlsId) || [];
    if (sheets.some(s => s === sheetId)) {
      return;
    }
    sheets.push(sheetId);
    this.app.lru.get('xlsSheet').set(xlsId, [ ...sheets ]);
  }
  // 初始化文档内容
  async initDoc({ docId }) {
    const connection = this.app.backend.connect();
    // todo 轻文档的collection为 zhishu
    const doc = Promise.promisifyAll(connection.get('zhishu', docId));
    try {
      await doc.fetchAsync();
    } catch (error) {
      this.app.otError('[service] [initDoc] 查询doc失败 ', { docId }, error);
    }
    // 进行初始化
    try {
      if (doc && doc.type === null) {
        this.app.otLog('[service] [initDoc] 开始初始化doc ', { docId });
        const initialValue = getInitialValue();
        await doc.createAsync({ children: initialValue }, "slate-ot-type");
        this.app.otLog('[service] [initDoc] 初始化doc成功 ', { docId }, { content: initialValue });
        return JSON.stringify(initialValue);
      }
      return JSON.stringify(doc.data);
    } catch (error) {
      this.app.otError('[service] [initDoc] 初始化doc失败 ', { docId }, error);
      return undefined;
    }
  }
}

module.exports = OTServer;
