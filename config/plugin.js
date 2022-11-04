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

exports.lru = {
  enable: true,
  package: 'egg-lru',
};

exports.exporter = {
  enable: true,
  package: 'egg-exporter',
};
