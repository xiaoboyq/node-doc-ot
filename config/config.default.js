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


  config.middleware = [];

  config.logger = {
    dir: `/data/logs/${appInfo.name}`, // path.join(appInfo.baseDir, 'logs'),
    appLogName: `app-web.log`,
    coreLogName: 'core-web.log',
    agentLogName: 'egg-agent.log',
    errorLogName: 'boss_error.log',
  };

  config.customLogger = {
    otLog: {
      file: appInfo.name + '.log',
      formatter: meta => {
        // console.log('meta>>>>', meta);
        const { traceId, zpBenchId, time, level, message, errorMsg } = meta;
        let prefix = `${time} ${traceId}#${zpBenchId} ${level} `;
        if (errorMsg) {
          prefix += `${errorMsg} `;
        }
        prefix += `${message} `;
        return prefix;
      },
    },
  };


  // config.zkRegistry = '192.168.20.69:2181,192.168.20.74:2181,192.168.20.70:2181';

  // config.rpc = {
  //   // 配置服务发现
  //   // 192.168.20.69:2181,192.168.20.74:2181,192.168.20.70:2181
  //   registry: {
  //     address: '192.168.20.69:2181/dubbo/zhishu_ot', // configure your real zk address
  //     protocol: 'dubbo',
  //   },
  //   // 接口的命名空间，所有的暴露的接口默认都在该命名空间下
  //   server: {
  //     namespace: 'com.zhipin.zhishu.dubbo.nodeapi',
  //   },
  //   client: {
  //     responseTimeout: 3000,
  //   },
  // };
  config.zkRegistry = '192.168.20.35:2181,192.168.20.230:2181,192.168.20.157:2181';

  config.rpc = {
    // 配置服务发现
    registry: {
      address: '192.168.20.35:2181/dubbo/zhishu_ot', // configure your real zk address
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


  // LRU 配置
  config.lru = {
    clients: {
      // 缓存快照
      snapshot: {
        max: 2000,
        maxAge: 1000 * 60 * 60, // 10 min cache
      },
      // 缓存历史ops
      ops: {
        max: 10000,
        maxAge: 1000 * 60 * 60, // 60 min cache
      },
      // 缓存 xls sheet 映射关系
      xlsSheet: {
        max: 2000,
        maxAge: 1000 * 60 * 60, // 60 min cache
      },
    },
    // load into app, default is open
    app: true,
    // load into agent, default is close
    agent: false,
  };

  return {
    ...config,
  };
};
