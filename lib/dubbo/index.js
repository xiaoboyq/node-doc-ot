'use strict';

const NZD = require('node-zookeeper-dubbo-plus');

const opt = {
  application: { name: 'node-ot' },
  // registry: '192.168.20.157:2181',
  registry: '192.168.20.74:2181',
  // dubboVer: '2.0.2',
  root: 'zp_dubbo/bosshi',
  dependencies: {
    OtServiceApi: {
      interface: 'com.zhipin.zhishu.dubbo.OtServiceApi',
      version: '1.0.0',
      timeout: 6000,
      protocol: 'dubbo',
      group: 'ws',
      methodSignature: {
        reply: otMsg => [{ $class: 'com.zhipin.zhishu.dubbo.dto.OtMsg', $: {
          docId: {
            $class: 'java.lang.String',
            $: otMsg.docId,
          },
          data: {
            $class: 'java.lang.String',
            $: otMsg.data,
          },
          userId: {
            $class: 'java.lang.String',
            $: otMsg.userId,
          },
        } }],
        getOps: opsQuery => [{ $class: 'com.zhipin.zhishu.dubbo.dto.OpsQuery', $: {
          docId: {
            $class: 'java.lang.String',
            $: opsQuery.docId,
          },
          form: {
            $class: 'java.lang.Integer',
            $: opsQuery.from,
          },
          to: {
            $class: 'java.lang.Integer',
            $: opsQuery.to,
          },
        } }],
        getLatestSnapshot: docId => [{ $class: 'com.zhipin.zhishu.dubbo.dto.SnapshotQuery', $: {
          docId: {
            $class: 'java.lang.String',
            $: docId,
          },
        } }],
        saveDoc: docSaveData => [{ $class: 'com.zhipin.zhishu.dubbo.dto.DocSaveData', $: {
          docId: {
            $class: 'java.lang.String',
            $: docSaveData.docId,
          },
          op: {
            $class: 'java.lang.String',
            $: docSaveData.op,
          },
          snapshot: {
            $class: 'java.lang.String',
            $: docSaveData.snapshot,
          },
        } }],
      },
    },
  },
};

const Dubbo = new NZD(opt);
Dubbo.on('service:changed', event => {
  console.log('service changed');
  console.log(event);
});
module.exports = Dubbo;
