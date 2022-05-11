'use strict';
module.exports = {
  otLog(msg, { docId, presenceId } = {}, data) {
    // this 就是 app 对象，在其中可以调用 app 上的其他方法，或访问属性
    let loggerInfo = `${msg} `;
    // if (typeof data === 'object' && 'presenceId' in data || 'docId' in data) {
    //   docId = data.docId || docId;
    //   presenceId = data.presenceId || presenceId;
    //   data = undefined;
    // }
    loggerInfo += `pid = ${process.pid} `;
    loggerInfo += docId ? `docId = ${docId} ` : '';
    loggerInfo += docId ? `presenceId = ${presenceId} ` : '';
    loggerInfo += data ? `${JSON.stringify(data)} ` : '';
    this.logger.info(loggerInfo);
  },
  otError(msg, error, { docId, presenceId } = {}) {
    // this 就是 app 对象，在其中可以调用 app 上的其他方法，或访问属性
    let loggerInfo = `[error] pid = ${process.pid} ${msg} ${error} `;
    loggerInfo += docId ? `docId = ${docId} ` : '';
    loggerInfo += presenceId ? `presenceId = ${presenceId} ` : '';
    this.logger.error(loggerInfo);
  },
};
