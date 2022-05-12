'use strict';
const moment = require('moment');
module.exports = {
  otLog(msg, { docId, presenceId } = {}, data) {
    // let loggerInfo = `${msg} `;
    // loggerInfo += `pid = ${process.pid} `;
    // loggerInfo += docId ? `docId = ${docId} ` : '';
    // loggerInfo += docId ? `presenceId = ${presenceId} ` : '';
    // loggerInfo += data ? `${JSON.stringify(data)} ` : '';
    // this.logger.info(loggerInfo);
    const meta = {
      pid: process.pid,
      date: `${moment().format('YYYY-MM-DD HH:mm:ss.SSS')}`,
      traceId: docId,
      zpBenchId: presenceId || docId,
    };
    return this.getLogger('otLog').log('INFO', data ? [ msg, JSON.stringify(data) ] : [ msg ], meta);
  },
  otError(msg, { docId, presenceId } = {}, error) {
    // let loggerInfo = `[error] pid = ${process.pid} ${msg} ${error} `;
    // loggerInfo += docId ? `docId = ${docId} ` : '';
    // loggerInfo += presenceId ? `presenceId = ${presenceId} ` : '';
    // this.logger.error(loggerInfo);
    const meta = {
      pid: process.pid,
      date: `${moment().format('YYYY-MM-DD HH:mm:ss.SSS')}`,
      traceId: docId,
      zpBenchId: presenceId || docId,
      errorMsg: msg,
    };

    const errorInfo = [];
    if (error instanceof Error) {
      errorInfo.push(error.message);
      errorInfo.push(JSON.stringify(error.stack));
    } else {
      errorInfo.push(JSON.stringify(error));
    }

    return this.getLogger('otLog').log('ERROR', errorInfo, meta);
  },
};
