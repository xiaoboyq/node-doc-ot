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

  // add your user config here
  const userConfig = {
    // myAppName: 'egg',
  };

  config.rpc = {
    registry: {
      address: '192.168.20.157:2181/zp_dubbo/bosshi', // configure your real zk address
      protocol: 'dubbo',
    },
    server: {
      namespace: 'com.zhipin.bosshi.nodeapi',
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
