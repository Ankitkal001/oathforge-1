module.exports = {
    port: 7545,
    compileCommand: 'node ./init.js && node ./compile.js',
    testCommand: 'mocha --bail --exit --timeout 20000 test/web3',
    buildDirPath: '/test/web3/artifacts'
};
