# egg-sofa-antvip

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![Test coverage][codecov-image]][codecov-url]
[![David deps][david-image]][david-url]
[![Known Vulnerabilities][snyk-image]][snyk-url]
[![npm download][download-image]][download-url]

[npm-image]: https://img.shields.io/npm/v/egg-sofa-antvip.svg?style=flat-square
[npm-url]: https://npmjs.org/package/egg-sofa-antvip
[travis-image]: https://img.shields.io/travis/eggjs/egg-sofa-antvip.svg?style=flat-square
[travis-url]: https://travis-ci.org/eggjs/egg-sofa-antvip
[codecov-image]: https://img.shields.io/codecov/c/github/eggjs/egg-sofa-antvip.svg?style=flat-square
[codecov-url]: https://codecov.io/github/eggjs/egg-sofa-antvip?branch=master
[david-image]: https://img.shields.io/david/eggjs/egg-sofa-antvip.svg?style=flat-square
[david-url]: https://david-dm.org/eggjs/egg-sofa-antvip
[snyk-image]: https://snyk.io/test/npm/egg-sofa-antvip/badge.svg?style=flat-square
[snyk-url]: https://snyk.io/test/npm/egg-sofa-antvip
[download-image]: https://img.shields.io/npm/dm/egg-sofa-antvip.svg?style=flat-square
[download-url]: https://npmjs.org/package/egg-sofa-antvip

<!--
Description here.
-->

## Install

```bash
$ npm i egg-sofa-antvip --save
```

## Usage

```js
// {app_root}/config/plugin.js
exports.sofaAntvip = {
  enable: true,
  package: 'egg-sofa-antvip',
};
```

## Configuration

```js

// {app_root}/config/plugin.js

exports.sofaAntvip = {
  enable: true,
  package: 'egg-sofa-antvip',
};

// {app_root}/config/config.default.js

exports.instanceId = '111111';

exports.antvip = {
  endpoint: '11.11.11.11'
};

```

see [config/config.default.js](config/config.default.js) for more detail.

## Example

<!-- example here -->

## Questions & Suggestions

Please open an issue [here](https://github.com/eggjs/egg/issues).

## License

[MIT](LICENSE)
