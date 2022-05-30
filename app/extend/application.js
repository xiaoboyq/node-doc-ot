'use strict';
const moment = require('moment');
module.exports = {
  // get coreLogger() {
  //   console.log("重写 coreLogger 》〉》〉》");
  //   return this.getLogger('coreLogger');
  // },
  // get logger() {
  //   console.log("重写 logger 》〉》〉》");
  //   return this.getLogger('logger');
  // },
  otLog(msg, { docId, presenceId, rid } = {}, data) {
    const meta = {
      pid: process.pid,
      time: `${moment().format('YYYY-MM-DD HH:mm:ss.SSS')}`,
      traceId: docId,
      zpBenchId: rid || presenceId,
    };
    data = typeof data !== 'string' ? JSON.stringify(data || '') : data;
    return this.getLogger('otLog').log('INFO', data ? [ msg, data ] : [ msg ], meta);
  },
  otError(msg, { docId, presenceId, rid } = {}, error) {
    const meta = {
      pid: process.pid,
      time: `${moment().format('YYYY-MM-DD HH:mm:ss.SSS')}`,
      traceId: docId,
      zpBenchId: rid || presenceId,
      errorMsg: msg,
    };

    const errorInfo = [];
    if (error instanceof Error) {
      errorInfo.push(error.message);
      errorInfo.push(JSON.stringify(error.stack));
    } else {
      errorInfo.push(typeof error !== 'string' ? JSON.stringify(error || '') : error);
    }

    return this.getLogger('otLog').log('ERROR', errorInfo, meta);
  },
};
