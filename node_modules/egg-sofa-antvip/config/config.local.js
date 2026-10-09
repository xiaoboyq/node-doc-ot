'use strict';

const path = require('path');

module.exports = appInfo => {
  return {
    sofaAntvip: {
      cacheDir: path.join(appInfo.baseDir, 'run/conf/antvip-node-client-cache'),
    },
  };
};
