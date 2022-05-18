/* eslint valid-jsdoc: "off" */

'use strict';

module.exports = () => {
  /**
   * built-in config
   * @type {Egg.EggAppConfig}
   **/
  const config = exports = {};

  config.zkRegistry = '192.168.20.69:2181,192.168.20.74:2181,192.168.20.70:2181';

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
  };
};
