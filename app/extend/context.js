// 'use strict';

// const DUBBO_SYMBOL = Symbol('Contenxt#bubbo');

// const NZD = require('node-zookeeper-dubbo-plus');

// const opt = {
//   application: { name: 'node-ot' },
//   // registry: '192.168.20.74:2181',
//   registry: '192.168.20.157:2181',
//   // dubboVer: '2.0.2',
//   root: 'zp_dubbo/bosshi',
//   dependencies: {
//     // MqttChatApi: {
//     //   interface: 'com.zhipin.bosshi.api.MqttChatApi',
//     //   version: '1.0.0',
//     //   timeout: 6000,
//     //   group: 'ws',
//     //   methodSignature: {
//     //     disconnect: (userId, cid) => [{ $class: 'long', $: userId }, { $class: 'long', $: cid }],
//     //   },
//     // },
//     TestNodeService: {
//       interface: 'com.zhipin.bosshi.nodeapi.TestNodeService',
//       version: '1.0.0',
//       timeout: 6000,
//       group: 'ws',
//       methodSignature: {
//         echoUser: userId => [{ $class: 'java.lang.string', $: userId }],
//       },
//     },
//   },
// };

// const Dubbo = new NZD(opt);
// Dubbo.on('service:changed', event => {
//   console.log('service changed');
//   console.log(event);
// });

// module.exports = {
//   get dubbo() {
//     if (!this[DUBBO_SYMBOL]) {
//       this[DUBBO_SYMBOL] = Dubbo;
//     }
//     return this[DUBBO_SYMBOL];
//   },
// };
