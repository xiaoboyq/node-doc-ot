'use strict';

module.exports = {
  services: [{
    appName: 'bosshi_chat',
    api: {
      UserChatApi: {
        interfaceName: 'com.zhipin.bosshi.api.UserChatApi',
        version: '1.0.0',
        group: '/zp_dubbo/bosshi',
      },
    },
  }],
};
