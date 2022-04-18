'use strict';

/**
 * echoUser
 * @param {String} user - userName
 * @return {String} userName
 * @rpc
 */
exports.echoUser = async function(user) {
  console.log(user);
  return 'hello' + user;
};

exports.interfaceName = 'com.zhipin.bosshi.nodeapi.TestNodeService';
exports.version = '1.0.0';
exports.group = 'ws';
exports.generic = true;
