'use strict';

const AntvipClient = require('antfin-sofa-node-antvip');
const ANTVIP_CLIENT = Symbol.for('Application#antvip');

module.exports = {
  get sofaAntvip() {
    if (!this[ANTVIP_CLIENT]) {
      const logger = this.getLogger('antvipLogger');
      let shareConfig = {};
      if (this.config.instanceId) {
        shareConfig = {
          instanceId: this.config.instanceId,
          accessKey: this.config.accessKey,
          secretKey: this.config.secretKey,
        };
      }
      const client = new AntvipClient(Object.assign({
        httpclient: this.httpclient,
        appName: this.config.name,
        cluster: this.cluster,
        logger,
      }, shareConfig, this.config.sofaAntvip));

      client.on('error', err => {
        logger.error(err);
      });

      this.beforeClose(async function() {
        await client.close();
      });

      this[ANTVIP_CLIENT] = client;
    }
    return this[ANTVIP_CLIENT];
  },

  get antvip() {
    return this.sofaAntvip;
  },
};
