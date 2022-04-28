'use strict';

/**
 * node OT dubbo 文档： https://wiki.kanzhun-inc.com/display/821/Node+OT
 */
const COLLECTION = 'zhishu';

/**
 * 接收客户端消息
 * @param  { string } docId 文档ID
 * @param  { string } userId 用户ID
 * @param { string } data 消息主体
 * @return {string} bool
 */
exports.receive = async function(docId, userId, data) {
  try {
    this.logger.info('[dubbo] [receive] 接收参数 pid = ', process.pid, docId, userId, data);
    const message = JSON.parse(data || {});
    const messageAction = message.a;
    if (messageAction === 'hs') {
      // 握手阶段 进行 客户端连接注册
      await this.service.ot.listen({ userId, collection: COLLECTION, docId });
    }
    const combineId = COLLECTION + docId;
    if (combineId in this.app.wsMap && this.app.wsMap[combineId][userId]) {
      this.app.wsMap[combineId][userId].ws.emit("message", message);
    }
  } catch (error) {
    this.logger.error('[dubbo] [receive] ', error);
    // TODO 约定返回格式
    return 'false';
  }
  return 'true';
};
/**
 * 创建文件
 * @param {string} docId 文档ID
 */
exports.create = async function(docId) {
  this.logger.info('[dubbo] [create] 初始化文档 pid = ', process.pid, docId);
  const success = await this.service.ot.initDoc({ collection: COLLECTION, docId });
  return success ? 'true' : 'false';
};

/**
 * 客户端断连，销毁订阅流
 * @param { string } docId  文档ID
 * @param { string } userId  用户ID
 * @return {string} bool
 */
exports.leave = async function(docId, userId) {
  this.logger.info('[dubbo] [leave] 接收参数 pid = ', process.pid, ' docId = ', docId, 'userId', userId);
  await this.service.ot.leave({ userId, collection: COLLECTION, docId });
  return 'true';
};

exports.interfaceName = 'com.zhipin.bosshi.nodeapi.OTService';
exports.version = '1.0.0';
exports.group = 'ws';
exports.generic = true;
