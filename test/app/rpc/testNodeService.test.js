'use strict';

const mm = require('egg-mock');

describe('test/rpc/testNodeService.test.js', () => {
  let app;
  before(async function() {
    // app = mm.app({
    //   baseDir: 'apps/rpcserver',
    // });
    app = mm.app();
    await app.ready();
  });
  after(async function() {
    await app.close();
  });

  it('should invoke HelloService', done => {
    app.rpcRequest('com.zhipin.bosshi.nodeapi.TestNodeService')
      .invoke('echoUser')
      .send([ 'gxcsoccer' ])
      .expect('gxcsoccer', done);
  });
});
