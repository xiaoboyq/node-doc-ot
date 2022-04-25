'use strict';
const Duplex = require("stream").Duplex;
const util = require("util");
const { default: axios } = require("axios");

function MockSocketStream(ws, { userId, docId, collection }) {
  Duplex.call(this, { objectMode: true });
  this.ws = ws;
  this.userId = userId;
  this.docId = docId;
  this.collection = collection;
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
  axios
    .post("http://127.0.0.1:8080/send", {
      data: msg,
      userId: this.userId,
      docId: this.docId,
      collection: this.collection,
    })
    .then(() => {
      // console.log("send success");
    })
    .catch(err => {
      console.log("send error", err);
    });
  next();
};

module.exports = MockSocketStream;
