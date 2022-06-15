"use strict";

const Controller = require("egg").Controller;
const packageJson = require('../../package.json');

class HomeController extends Controller {
  async health() {
    this.ctx.body = {
      message: '服务可用',
      data: packageJson.version,
      code: 0,
    };
  }
  async delCache() {
    const success1 = this.app.lru.get('snapshot').reset();
    const success2 = this.app.lru.get('ops').reset();
    this.ctx.body = {
      message: '清空缓存',
      data: success1 && success2,
      code: 0,
    };
  }
  // 处理 op
  async index() {
    const op = this.ctx.request.body.data;
    let { presenceId, collection, docId } = this.ctx.request.body;
    collection = collection || 'zhishu';
    if (op.a) {
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
