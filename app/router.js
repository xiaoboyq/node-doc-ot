'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;

  if (app.config.env === 'local') {
    router.post('/', controller.home.index);
  }
  // router.post('/listen', controller.home.listen);
  router.get('/health', controller.home.health);
  router.get('/', controller.home.health);
  router.get('/delCache', controller.home.delCache);
  router.post('/leave', controller.home.leave);
  router.get('/testDubbo', controller.home.testDubbo);
};
