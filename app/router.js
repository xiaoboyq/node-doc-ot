'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
  router.post('/', controller.home.index);
  router.post('/leave', controller.home.leave);
  router.get('/', controller.home.indexGet);
};
