'use strict';

/**
 * node OT dubbo 文档： https://wiki.kanzhun-inc.com/display/821/Node+OT
 */
const COLLECTION = 'zhishu';

/**
 * 接收客户端消息
 * @param  { string } docId 文档ID
 * @param  { string } presenceId 用户在场ID
 * @param { string } data 消息主体
 * @return {string} bool
 */
exports.receive = async function(docId, presenceId, data) {
  try {
    this.app.otLog('[dubbo] [receive] 接收客户端消息', { docId, presenceId }, data);
    const message = JSON.parse(data || {});
    const messageAction = message.a;
    if (messageAction === 'hs') {
      const subscribed = this.service.ot.hasSubscribed({ docId, presenceId, collection: COLLECTION });
      if (!subscribed) {
        // 握手阶段 进行 客户端连接注册
        await this.service.ot.listen({ presenceId, collection: COLLECTION, docId });
      }
    }
    await this.service.ot.emitMessage({ data: message, presenceId, collection: COLLECTION, docId });
  } catch (error) {
    this.app.otError('[dubbo] [receive] 处理客户端消息失败 ', { docId, presenceId }, error);
    return {
      code: 1,
      msg: '处理客户端消息失败',
      data: false,
    };
  }
  return {
    code: 0,
    msg: '操作成功',
    data: true,
  };
};
/**
 * 创建文件
 * @param {string} docId 文档ID
 */
exports.create = async function(docId) {
  this.app.otLog('[dubbo] [create] 初始化文档 ', { docId });
  const docContent = await this.service.ot.initDoc({ collection: COLLECTION, docId });
  if (!docContent) {
    return {
      code: 2,
      msg: '初始化文档失败',
      data: '初始化文档失败',
    };
  }
  return {
    code: 0,
    msg: '操作成功',
    data: docContent,
  };
};

/**
 * 客户端断连，销毁订阅流
 * @param { string } docId  文档ID
 * @param { string } presenceId  用户在场ID
 * @return {string} bool
 */
exports.leave = async function(docId, presenceId) {
  this.app.otLog('[dubbo] [leave] 用户断连 ', { docId, presenceId });
  try {
    await this.service.ot.leave({ presenceId, collection: COLLECTION, docId });
    return {
      code: 0,
      msg: '操作成功',
      data: true,
    };
  } catch (error) {
    return {
      code: 3,
      msg: '离场失败',
      data: false,
    };
  }
};

// dubbo 健康检测
// 注意：参数 docId 不能少
// eslint-disable-next-line no-unused-vars
exports.ping = async function(docId) {
  return {
    code: 0,
    msg: '',
    data: null,
  };
};

exports.interfaceName = 'com.zhipin.zhishu.dubbo.noteapi.OTService';
exports.version = '1.0.0';
exports.group = 'ws';
exports.generic = true;
exports.dubboVer = '2.6.1';
