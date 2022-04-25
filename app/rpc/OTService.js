'use strict';

exports.echoUser = async function(user) {
  console.log(user);
  return user;
};

/**
 * node OT dubbo 文档： https://wiki.kanzhun-inc.com/display/821/Node+OT
 */
const COLLECTION = 'zhishu';

/**
 * 接收客户端消息
 * @param  { string } docId 文档ID
 * @param  { string } userId 用户ID
 * @param { json } data 消息主体
 * @return {string} bool
 */
exports.receive = async function(docId, userId, data) {
  const messageAction = data.a;
  if (messageAction === 'hs') {
    // 握手阶段 进行 客户端连接注册
    await this.service.ot.listen({ userId, collection: COLLECTION, docId });
  }
  const combineId = COLLECTION + docId;
  if (combineId in this.app.wsMap && this.app.wsMap[combineId][userId]) {
    this.app.wsMap[combineId][userId].ws.emit("message", data);
  }
  return 'true';
};

/**
 * 客户端断连，销毁订阅流
 * @param { string } docId  文档ID
 * @param { string } userId  用户ID
 * @return {string} bool
 */
exports.leave = async function(docId, userId) {
  this.app.wsMap[COLLECTION + docId] = this.app.wsMap[COLLECTION + docId] || {};
  const stream = this.app.wsMap[COLLECTION + docId][userId];
  if (stream) {
    stream.destroy();
  }
  return 'true';
};

exports.interfaceName = 'com.zhipin.bosshi.nodeapi.OTService';
exports.version = '1.0.0';
exports.group = 'ws';
exports.generic = true;
