/* eslint valid-jsdoc: "off" */

'use strict';
/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
module.exports = appInfo => {
  /**
   * built-in config
   * @type {Egg.EggAppConfig}
   **/
  const config = exports = {};

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1649470071280_8264';

  // add your middleware config here
  config.middleware = [];
  config.logger = {
    dir: '/data/logs/zhipin-zhishu-node-ot', // path.join(appInfo.baseDir, 'logs'),
    appLogName: 'boss_info.log',
    coreLogName: 'egg-web.log',
    agentLogName: 'egg-agent.log',
    errorLogName: 'boss_error.log',
  };

  // add your user config here
  const userConfig = {
    zkRegistry: '192.168.20.69:2181,192.168.20.74:2181,192.168.20.70:2181',
  };

  config.rpc = {
    // 配置服务发现
    // 192.168.20.69:2181,192.168.20.74:2181,192.168.20.70:2181
    registry: {
      address: '192.168.20.69:2181/dubbo/zhishu_ot', // configure your real zk address
      protocol: 'dubbo',
    },
    // 接口的命名空间，所有的暴露的接口默认都在该命名空间下
    server: {
      namespace: 'com.zhipin.zhishu.dubbo.nodeapi',
    },
    client: {
      responseTimeout: 3000,
    },
  };

  return {
    ...config,
    ...userConfig,
  };
};
