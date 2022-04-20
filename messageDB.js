'use strict';

const DB = require("sharedb").DB;
function nextTick(callback) {
  if (typeof process !== "undefined" && process.nextTick) {
    return process.nextTick.apply(null, arguments);
  }

  const args = [];
  for (let i = 1; i < arguments.length; i++) {
    args[i - 1] = arguments[i];
  }

  setTimeout(function() {
    callback.apply(null, args);
  });
}

// In-memory ShareDB database
//
// This adapter is not appropriate for production use. It is intended for
// testing and as an API example for people implementing database adaptors. It
// is fully functional, except it stores all documents & operations forever in
// memory. As such, memory usage will grow without bound, it doesn't scale
// across multiple node processes and you'll lose all your data if the server
// restarts. Query APIs are adapter specific. Use with care.

function MessageDB(options, app) {
  if (!(this instanceof MessageDB)) return new MessageDB(options);
  DB.call(this, options);
  this.app = app;
  this.closed = false;
}
module.exports = MessageDB;

MessageDB.prototype = Object.create(DB.prototype);

MessageDB.prototype.close = function(callback) {
  this.closed = true;
  if (callback) callback();
};

// Persists an op and snapshot if it is for the next version. Calls back with
// callback(err, succeeded)
MessageDB.prototype.commit = function(
  collection,
  id,
  op,
  snapshot,
  options,
  callback
) {
  const db = this;
  if (typeof callback !== "function") throw new Error("Callback required");
  nextTick(function() {
    db.app.messenger.sendToAgent("commit", {
      collection,
      id,
      op,
      snapshot,
      options,
    });
    db.app.messenger.once("commitSuccess", succeeded => {
      console.log('commit保存结果', succeeded);
      callback(null, succeeded);
    });
  });
};

MessageDB.prototype.getSnapshot = function(
  collection,
  id,
  fields,
  options,
  callback
) {
  const db = this;
  if (typeof callback !== "function") throw new Error("Callback required");
  nextTick(function() {
    db.app.messenger.sendToAgent("getSnapshot", {
      collection,
      id,
      fields,
      options,
    });
    db.app.messenger.once("returnSnapshot", snapshot => {
      console.log('查询snapshot结果', snapshot, JSON.stringify((snapshot.data || {}).children || []));
      callback(null, snapshot);
    });
  });
};

// Get operations between [from, to) noninclusively. (Ie, the range should
// contain start but not end).
//
// If end is null, this function should return all operations from start onwards.
//
// The operations that getOps returns don't need to have a version: field.
// The version will be inferred from the parameters if it is missing.
//
// Callback should be called as callback(error, [list of ops]);
MessageDB.prototype.getOps = function(
  collection,
  id,
  from,
  to,
  options,
  callback
) {
  const db = this;
  if (typeof callback !== "function") throw new Error("Callback required");
  nextTick(function() {
    db.app.messenger.sendToAgent("getOps", {
      collection,
      id,
      from,
      to,
      options,
    });
    db.app.messenger.once("returnOps", ops => {
      console.log('查询 ops 结果', ops);
      callback(null, ops);
    });
  });
};
