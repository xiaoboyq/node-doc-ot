'use strict';

/**
 * node OT dubbo 文档： https://wiki.kanzhun-inc.com/display/821/Node+OT
 */

const OTType = {
  1: 'doc',
  2: 'xls',
};

/**
 * 接收客户端消息
 * @param  { string } docId 文档ID
 * @param  { string } presenceId 用户在场ID
 * @param { string } data 消息主体
 * @param { number } ottype OT 类型：OTType
 * @return {string} bool
 */
exports.receive = async function(docId, presenceId, data, ottype = 1) {
  try {
    const message = JSON.parse(data || {});
    this.app.otLog(`[dubbo] [receive] 接收客户端消息 ottype = ${ottype}`, { docId, presenceId }, this.helper.omit(message, [ 'op' ]));
    const subscribed = this.service.ot.hasSubscribed({ docId, presenceId, ottype: OTType[ottype] });
    if (!subscribed) {
      // 进行 客户端连接注册
      const success = await this.service.ot.listen({ presenceId, ottype: OTType[ottype], docId });
      if (!success) {
        return {
          code: 2001,
          message: '客户端订阅失败',
          data: false,
        };
      }
      this.app.otLog('[dubbo] [receive] 用户订阅成功 ', { docId, presenceId });
    }
    // 未订阅状态不处理 op, 否则 op ack 时， op ack 对比的 v 和本地的 v（subscribe同步的） 可能不一致，会触发 fetch 同步
    if (subscribed || message.a !== 'op') {
      await this.service.ot.emitMessage({ data: message, presenceId, ottype: OTType[ottype], docId });
    }


  } catch (error) {
    this.app.otError('[dubbo] [receive] 处理客户端消息失败 ', { docId, presenceId }, error);
    return {
      code: 2002,
      message: '处理客户端消息失败',
      data: false,
    };
  }
  return {
    code: 0,
    message: '操作成功',
    data: true,
  };
};
/**
 * 创建文件
 * @param {string} docId 文档ID
 * @param {number} ottype
 */
exports.create = async function(docId, ottype = 1) {
  this.app.otLog('[dubbo] [create] 初始化文档 ', { docId });
  const docContent = await this.service.ot.initDoc({ docId });
  if (!docContent) {
    return {
      code: 2003,
      message: '初始化文档失败',
      data: '初始化文档失败',
    };
  }
  return {
    code: 0,
    message: '操作成功',
    data: docContent,
  };
};

/**
 * 客户端断连，销毁订阅流
 * @param { string } docId  文档ID
 * @param { string } presenceId  用户在场ID
 * @param { number } ottype
 * @return {string} bool
 */
exports.leave = async function(docId, presenceId, ottype = 1) {
  this.app.otLog('[dubbo] [leave] 用户断连 ', { docId, presenceId });
  try {
    await this.service.ot.leave({ presenceId, ottype: OTType[ottype], docId });
    return {
      code: 0,
      message: '操作成功',
      data: true,
    };
  } catch (error) {
    return {
      code: 2004,
      message: '离场失败',
      data: false,
    };
  }
};

// dubbo 健康检测
exports.ping = async function(docId, presenceId, ottype = 1) {
  const subscribed = this.service.ot.hasSubscribed({ docId, presenceId, ottype: OTType[ottype] });
  if (!subscribed) {
    // 进行 客户端连接注册
    const success = await this.service.ot.listen({ presenceId, ottype: OTType[ottype], docId });
    if (!success) {
      return {
        code: 2001,
        message: '客户端订阅失败',
        data: false,
      };
    }
    this.app.otLog('[dubbo] [ping] 用户订阅成功 ', { docId, presenceId });

  }

  return {
    code: 0,
    message: '',
    data: true,
  };
};

/**
 * revert 历史还原
 * @param {string} docId 轻文档ID/轻表格xlsId
 * @param {number} ottype ot 类型
 * @return
 */
exports.revert = async function(docId, ottype = 1) {
  // 清空缓存
  // TODO 轻表格的快照索引： sheetId +  docId
  const idx = `${OTType[ottype]}#${docId}`;// OTType[ottype] === 'doc' ? docId + 'zhishu' : docId;
  this.app.lru.get('snapshot').del(idx);
  this.app.lru.get('ops').del(idx);

  this.app.otLog(`[dubbo] [revert] 历史还原 清空缓存 `, { docId });
  return {
    code: 0,
    message: '',
    data: true,
  };
};

exports.interfaceName = 'com.zhipin.zhishu.dubbo.noteapi.OTService';
exports.version = '1.0.0';
exports.group = 'ws';
exports.generic = true;
exports.dubboVer = '2.6.1';
