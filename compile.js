const Artifactor = require('truffle-artifactor');

const artifactor = new Artifactor('./test/web3/artifacts');

const compile = require('./output');

const save = async () => {

    for (const contract of Object.keys(compile.contracts)) {

        console.log(`Saving ${contract} ...`);

        await artifactor.save({
            contractName: contract.slice(contract.indexOf(':') + 1),
            abi: JSON.parse(compile.contracts[contract].interface),
            unlinked_binary: `0x${compile.contracts[contract].bytecode}`
        });

        console.log(`Saved ${contract}`);
    }
};

save().then(() => console.log('Done'));
