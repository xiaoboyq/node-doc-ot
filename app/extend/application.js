'use strict';
module.exports = {
  otLog(msg, { docId, presenceId } = {}, data) {
    let loggerInfo = `${msg} `;
    loggerInfo += `pid = ${process.pid} `;
    loggerInfo += docId ? `docId = ${docId} ` : '';
    loggerInfo += docId ? `presenceId = ${presenceId} ` : '';
    loggerInfo += data ? `${JSON.stringify(data)} ` : '';
    this.logger.info(loggerInfo);
  },
  otError(msg, error, { docId, presenceId } = {}) {
    let loggerInfo = `[error] pid = ${process.pid} ${msg} ${error} `;
    loggerInfo += docId ? `docId = ${docId} ` : '';
    loggerInfo += presenceId ? `presenceId = ${presenceId} ` : '';
    this.logger.error(loggerInfo);
  },
};
