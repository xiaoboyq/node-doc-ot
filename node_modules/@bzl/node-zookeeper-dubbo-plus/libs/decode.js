/**
 * Created by panzhichao on 16/8/18.
 */
"use strict";
const decoder = require("hessian.js").DecoderV2;
const Response = {
  OK: 20,
  CLIENT_TIMEOUT: 30,
  SERVER_TIMEOUT: 31,
  BAD_REQUEST: 40,
  BAD_RESPONSE: 50,
  SERVICE_NOT_FOUND: 60,
  SERVICE_ERROR: 70,
  SERVER_ERROR: 80,
  CLIENT_ERROR: 90
};

const RESPONSE_WITH_EXCEPTION = 0;
const RESPONSE_VALUE = 1;
const RESPONSE_NULL_VALUE = 2;
// dubbo 2.6.3+
const RESPONSE_WITH_EXCEPTION_WITH_ATTACHMENTS = 3;
const RESPONSE_VALUE_WITH_ATTACHMENTS = 4;
const RESPONSE_NULL_VALUE_WITH_ATTACHMENTS = 5;

function decode(heap, cb) {
  const result = new decoder(heap.slice(16, heap.length));
  if (heap[3] !== Response.OK) {
    return cb(result.readString());
  }
  try {
    const flag = result.readInt();

    switch (flag) {
      case RESPONSE_NULL_VALUE, RESPONSE_WITH_EXCEPTION_WITH_ATTACHMENTS:
        cb(null, null);
        break;
      case RESPONSE_VALUE, RESPONSE_VALUE_WITH_ATTACHMENTS:
        cb(null, result.read());
        break;
      case RESPONSE_WITH_EXCEPTION, RESPONSE_NULL_VALUE_WITH_ATTACHMENTS:
        let excep = result.read();
        !(excep instanceof Error) && (excep = new Error(excep));
        cb(excep);
        break;
      default:
        cb(new Error(`Unknown result flag, expect '0' '1' '2', get ${flag}`));
    }
  } catch (err) {
    cb(err);
  }
}

module.exports = decode;
