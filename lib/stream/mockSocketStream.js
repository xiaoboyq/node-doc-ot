'use strict';
const Duplex = require("stream").Duplex;
const util = require("util");
const { default: axios } = require("axios");

function MockSocketStream(ws, dubbo, { presenceId, docId, collection = 'zhishu' }) {
  Duplex.call(this, { objectMode: true });
  this.ws = ws;
  this.presenceId = presenceId;
  this.docId = docId;
  this.collection = collection;
  this.dubbo = dubbo;
  const self = this;

  ws.on("message", function(msg) {
    self.push(msg);
  });
  ws.on("close", function() {
    self.push(null); // end readable stream
    self.end(); // end writable stream

    self.emit("close");
    self.emit("end");
  });

  this.on("error", function() {
    console.log("error");
  });
  this.on("end", function() {
    console.log("end");
  });
}
util.inherits(MockSocketStream, Duplex);

MockSocketStream.prototype._read = function() {};
MockSocketStream.prototype._write = function(msg, encoding, next) {
  // console.log("send", msg);
  // TODO 调用 dubbo 接口
  const reply = {
    data: msg,
    presenceId: this.presenceId,
    docId: this.docId,
    collection: this.collection,
  };
  console.log('reply>>>', reply);
  axios
    .post("http://127.0.0.1:8080/send", reply)
    .then(() => {
      // console.log("send success");
    })
    .catch(err => {
      console.log("send error", err);
    });
  // this.dubbo.OtServiceApi.reply({
  //   docId: this.docId,
  //   presenceId: this.presenceId,
  //   data: msg,
  // });
  next();
};

module.exports = MockSocketStream;
