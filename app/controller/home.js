"use strict";

const Controller = require("egg").Controller;
const ShareDB = require("@boss/sharedb");
const SlateOt = require("@boss/slate-ot");
const slateType = SlateOt.slateType;
slateType.transformPresence = p => p;
ShareDB.types.register(slateType);

const packageJson = require('../../package.json');

class HomeController extends Controller {
  async health() {

    this.ctx.body = {
      message: '服务可用',
      data: packageJson.version,
      code: 0,
    };
  }
  // 处理 op
  async index() {
    const op = this.ctx.request.body.data;
    let { presenceId, collection, docId } = this.ctx.request.body;
    // this.app.otLog('[controller] [receive] 接收客户端消息', { docId, presenceId }, op);
    // this.app.otError('[dubbo] [receive] 处理客户端消息失败 ', { docId, presenceId }, new Error(JSON.stringify(op)));
    collection = collection || 'zhishu';
    // const combineId = collection + docId;
    if (op.a === 'hs') {
      await this.service.ot.listen({ presenceId, collection, docId });
      await this.service.ot.initDoc({ collection, docId });
    }
    await this.service.ot.emitMessage({ data: op, presenceId, collection, docId });
    this.ctx.body = {
      data: {},
      code: 0,
    };
  }

  async leave() {
    const { presenceId, collection, docId } = this.ctx.request.body;
    this.app.wsMap[collection + docId] = this.app.wsMap[collection + docId] || {};
    const stream = this.app.wsMap[collection + docId][presenceId];
    if (stream) {
      stream.destroy();
    }
    this.ctx.body = {
      data: {},
      code: 0,
    };
  }

}

module.exports = HomeController;
