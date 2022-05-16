'use strict';
const Duplex = require("stream").Duplex;
const util = require("util");
// const { default: axios } = require("axios");

function MockSocketStream(ws, { dubbo, logger }, { presenceId, docId, collection = 'zhishu' }) {
  Duplex.call(this, { objectMode: true });
  this.ws = ws;
  this.presenceId = presenceId;
  this.docId = docId;
  this.collection = collection;
  this.dubbo = dubbo;
  this.logger = logger;
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
MockSocketStream.prototype._write = async function(msg, encoding, next) {
  const reply = {
    data: msg,
    presenceId: this.presenceId,
    docId: this.docId,
    collection: this.collection,
  };
  console.log('reply>>>', JSON.stringify(reply));
  // axios
  //   .post("http://127.0.0.1:8080/send", reply)
  //   .then(() => {
  //     // console.log("send success");
  //   })
  //   .catch(err => {
  //     console.log("send error", err);
  //   });
  // console.time('a');
  try {
    // this.logger.info()
    const res = await this.dubbo.OtServiceApi.reply({
      docId: this.docId,
      presenceId: this.presenceId,
      data: JSON.stringify(msg),
    });
    // console.timeEnd('a');
    const success = res && res.code === 0;
    if (!success) {
      console.error('[dubbo] [OtServiceApi.reply] fail', res);
    } else {
      console.log('[dubbo] [OtServiceApi.reply] success', res);
    }


  } catch (error) {
    console.error('[dubbo] [OtServiceApi.reply]', error);
  }
  next();
};

module.exports = MockSocketStream;
