'use strict';

const NZD = require('node-zookeeper-dubbo-plus');
const DUBBO_SYMBOL = Symbol('Contenxt#bubbo');
const DUBBO_SINGLETON = {
  [DUBBO_SYMBOL]: null,
};
module.exports = function getDubbo(registry) {
  console.log('zk registry -----> ', registry);
  const opt = {
    application: { name: 'node-ot' },
    registry,
    // dubboVer: '2.0.2',
    root: 'dubbo/zhishu', // 'zp_dubbo/bosshi',
    dependencies: {
      OtServiceApi: {
        interface: 'com.zhipin.zhishu.dubbo.api.OtServiceApi', // 'com.zhipin.zhishu.dubbo.OtServiceApi',
        version: '1.0.0',
        timeout: 6000,
        protocol: 'dubbo',
        // group: 'ws',
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
            presenceId: {
              $class: 'java.lang.String',
              $: otMsg.presenceId,
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
      XlsOtServiceApi: {
        interface: 'com.zhipin.zhishu.dubbo.api.XlsOtServiceApi', // 'com.zhipin.zhishu.dubbo.OtServiceApi',
        version: '1.0.0',
        timeout: 6000,
        protocol: 'dubbo',
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
            presenceId: {
              $class: 'java.lang.String',
              $: otMsg.presenceId,
            },
          } }],
          getOps: opsQuery => [{ $class: 'com.zhipin.zhishu.dubbo.dto.XlsOpsQuery', $: {
            xlsId: {
              $class: 'java.lang.String',
              $: opsQuery.docId,
            },
            sheetId: {
              $class: 'java.lang.String',
              $: opsQuery.sheetId,
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
          getLatestSnapshot: opsQuery => [{ $class: 'com.zhipin.zhishu.dubbo.dto.SnapshotQuery', $: {
            docId: {
              $class: 'java.lang.String',
              $: opsQuery.docId,
            },
            sheetId: {
              $class: 'java.lang.String',
              $: opsQuery.sheetId,
            },
          } }],
          saveDoc: docSaveData => [{ $class: 'com.zhipin.zhishu.dubbo.dto.XlsSaveData', $: {
            xlsId: {
              $class: 'java.lang.String',
              $: docSaveData.docId,
            },
            sheetId: {
              $class: 'java.lang.String',
              $: docSaveData.sheetId,
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
  if (!DUBBO_SINGLETON[DUBBO_SYMBOL]) {
    const Dubbo = new NZD(opt);
    Dubbo.on('service:changed', event => {
      console.log('service changed');
      console.log(event);
    });
    DUBBO_SINGLETON[DUBBO_SYMBOL] = Dubbo;
  }
  return DUBBO_SINGLETON[DUBBO_SYMBOL];
};
