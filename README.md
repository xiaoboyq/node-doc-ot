# node-ot



## QuickStart

<!-- add docs here for user -->

see [egg docs][egg] for more detail.

### Development

```bash
$ npm i
$ npm run dev
$ open http://localhost:7001/
```

### Deploy

```bash
$ npm start
$ npm stop
```

### npm scripts

- Use `npm run lint` to check code style.
- Use `npm test` to run unit test.
- Use `npm run autod` to auto detect dependencies upgrade, see [autod](https://www.npmjs.com/package/autod) for more detail.


[egg]: https://eggjs.org

// jar 包生成
rm -rf build-jar && mkdir build-jar && javac -d build-jar /Users/ljy/node/node-ot/src/main/java/com/zhipin/bosshi/nodeapi/* && jar cvf build-jar/TestNodeService.jar build-jar src/*