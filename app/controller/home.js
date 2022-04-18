'use strict';

const Controller = require('egg').Controller;

const SlateOt = require('slate-ot');
const slateType = SlateOt.slateType;
slateType.transformPresence = () => {};
const ShareDB = require('sharedb');
ShareDB.types.register(slateType);
const backend = new ShareDB({ presence: true });
const Duplex = require('stream').Duplex;
const events = require('events');
// const ws = new events.EventEmitter();
const util = require('util');
const { default: axios } = require('axios');

console.log('testssssss');

const initialValue = [
  { type: "heading-one", children: [{ text: "2022年02月21日 会议纪要" }] },
  { type: "heading-two", children: [{ text: "1、会议基本信息" }] },
  { type: "paragraph", children: [{ text: "会议时间：" }] },
  { type: "paragraph", children: [{ text: "会议地点：" }] },
  { type: "paragraph", children: [
      { text: "参会人员：" },
      { type: "mention", character: "刘军", children: [{ text: "" }] },
      { text: "" },
      { type: "mention", character: "陈耀环", children: [{ text: "" }] },
      { text: "" },
    ] 
  },
];

function setInitDoc(callback = (() => {})) {
  const connection = backend.connect();
  const doc = connection.get('examples', 'richtext');
  doc.fetch(function(err) {
    if (err) throw err;
    if (doc.type === null) {
      console.log('Creating document');
      doc.create(
        {
          children: initialValue,
        },
        'slate-ot-type',
        callback
      );
      console.log('Doc.data in server');
      console.log(doc.data);
      return;
    }
    callback();
  });
}

setInitDoc();

function MockSocketStream(ws, userId) {
  Duplex.call(this, { objectMode: true });
  this.ws = ws;
  this.userId = userId;
  const self = this;

  ws.on('message', function(msg) {
    self.push(msg);
  });
  ws.on('close', function() {
    self.push(null); // end readable stream
    self.end(); // end writable stream

    self.emit('close');
    self.emit('end');
  });

  this.on('error', function() { console.log('error'); });
  this.on('end', function() { console.log('end'); });
}
util.inherits(MockSocketStream, Duplex);

MockSocketStream.prototype._read = function() {};
const msgMap = {};
MockSocketStream.prototype._write = function(msg, encoding, next) {
  console.log('send', msg);
  axios.post('http://127.0.0.1:8080/send', {
    data: msg,
    userId: this.userId,
  }).then(res => {
    console.log('send success');
  }).catch(err => {
    console.log('send error', err);
  });
  next();
};

// const mockStream = new MockSocketStream(ws);
// backend.listen(mockStream);

const wsMap = {};

class HomeController extends Controller {
  async index() {
    // const { ctx } = this;
    // const res = await ctx.dubbo.MqttChatApi.demo(11, 22);
    // console.log(res);
    // ctx.body = res;

    const op = this.ctx.request.body.data;
    const userId = this.ctx.request.body.userId;
    if (!wsMap[userId]) {
      const ws = new events.EventEmitter();
      const mockStream = new MockSocketStream(ws, userId);
      backend.listen(mockStream);
      wsMap[userId] = ws;
    }

    wsMap[userId].emit('message', op);

    this.ctx.body = {
      data: {},
      code: 0,
    };
  }

  async indexGet() {
    this.ctx.body = 'hi';
    console.log(this.ctx.dubbo.TestNodeService);
  }
}

module.exports = HomeController;
