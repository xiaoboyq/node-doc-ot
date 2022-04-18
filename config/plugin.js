'use strict';

/** @type Egg.EggPlugin */

exports.rpc = {
  enable: true,
  package: 'egg-rpc-base',
};

exports.dubboRpc = {
  enable: true,
  package: 'egg-dubbo-rpc',
};

exports.security = {
  enable: false,
};
