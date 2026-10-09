'use strict';

module.exports = app => {
  app.beforeStart(async () => {
    // 本地和开发环境允许 mock, 可以不启动 endpoint
    if ((app.config.env !== 'local' && app.config.env !== 'unittest' && app.config.sofaAntvip.endpoint)) {
      await app.sofaAntvip.ready();
    }
  });
};
