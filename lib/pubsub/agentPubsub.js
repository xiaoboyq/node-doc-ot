"use strict";
const PubSub = require('sharedb').PubSub;
const util = require('../util');
const SUB_TOPIC = 'agent-pub';
const PUB_TOPIC = 'agent-sub';
function AgentPubSub(app, options) {
  if (!(this instanceof AgentPubSub)) return new AgentPubSub(options);
  PubSub.call(this, options);
  this.app = app;

}
module.exports = AgentPubSub;

AgentPubSub.prototype = Object.create(PubSub.prototype);

// 订阅 worker 消息
AgentPubSub.prototype._subscribe = function(channel, callback) {
  const pubsub = this;
  pubsub.subscribed[channel] = true;
  console.log('订阅 channel', process.pid, channel);
  util.nextTick(function() {
    pubsub.app.messenger.on(SUB_TOPIC, ({ channel, data }) => {
      if (pubsub.subscribed[channel]) {
        console.log('接收 agent 消息', process.pid, channel);
        pubsub._emit(channel, data);
      }
    });
    callback && callback();
  });
};

// 取消订阅 worker 消息
AgentPubSub.prototype._unsubscribe = function(channel, callback) {
  if (this.subscribed[channel]) {
    delete this.subscribed[channel];
  }
  util.nextTick(callback);
};

AgentPubSub.prototype._publish = function(channels, data, callback) {
  const pubsub = this;
  util.nextTick(function() {
    for (const channel of (channels || [])) {
      console.log('转发到agent', process.pid, channel);
      pubsub.app.messenger.sendToAgent(PUB_TOPIC, { channel, data });
    }
    callback();
  });
};


AgentPubSub.prototype.close = function(callback) {
  const pubsub = this;
  PubSub.prototype.close.call(this, err => {
    if (err) return callback(err);
    pubsub.app.messenger.close();
    if (callback) callback();
  });
};
