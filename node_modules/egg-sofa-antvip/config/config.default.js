'use strict';

const path = require('path');

module.exports = appInfo => {
  return {
    sofaAntvip: {
      cacheDir: path.join(appInfo.root, 'conf/antvip-node-client-cache'),
    },
    customLogger: {
      antvipLogger: {
        consoleLevel: 'NONE',
        file: path.join(appInfo.root, 'logs/antvip.log'),
      },
    },
  };
};
