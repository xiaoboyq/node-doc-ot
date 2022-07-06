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

  async testDubbo() {
    try {
      const { docId } = this.ctx.request.queries;
      const res = await this.app.dubbo.OtServiceApi.getLatestSnapshot(docId || "j4iloMJejPFraUnDZoc4Iw==");
      this.ctx.body = {
        data: res,
        code: 0,
      };
    } catch (error) {
      this.ctx.body = {
        data: error.message,
        code: -1,
      };
    }
  }

  async leave() {
    try {
      const { presenceId, docId } = this.ctx.request.body;
      this.app.otLog('[controller] [leave] 手动触发用户断连 ', { docId, presenceId });
      await this.service.ot.leave({ presenceId, collection: 'zhishu', docId });
      this.ctx.body = {
        code: 0,
        message: '操作成功',
        data: true,
      };
    } catch (error) {
      this.ctx.body = {
        code: 2004,
        message: '离场失败',
        data: false,
      };
    }
  }

}

module.exports = HomeController;
