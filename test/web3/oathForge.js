const Web3 = require('web3');
const ganache = require('ganache-cli');
const Resolver = require('truffle-resolver');
const chai = require('chai');
const chaiProm = require('chai-as-promised');
chai.use(chaiProm);
const expect = chai.expect;

// Initial Setup
const artifactsDirectory = `${__dirname}/artifacts`;
const resolver = new Resolver({
  'working_directory': artifactsDirectory,
  'contracts_build_directory': artifactsDirectory
});

// Global variables that should be set during test setup
let provider;
let accounts;
let OathForge;

// Constant values
const TOKEN_URI = "https://basic.uri.test";
const SECOND = 1;
const MINUTE = SECOND * 60;

// Create appropriate provider, depending on current environment
if (process.env.COVERAGE) {
  provider = new Web3.providers.HttpProvider('http://localhost:7545');
} else {
  provider = ganache.provider({
    gasLimit: 0xfffffffffff,
    gasPrice: 0x01
  });
}

const web3 = new Web3(provider);
web3.currentProvider.sendAsync = web3.currentProvider.send;

const get_block = async (block_number) => {
  return web3.eth.getBlock(block_number);
};

// Initial deployment of the smart contracts
const deploy = async () => {
  const OathForgeArtifact = await resolver.require('OathForge');
  OathForgeArtifact.setProvider(provider);
  OathForge = await OathForgeArtifact.new('OathForge', 'OAT', {from: accounts[0]});
};

// Creates a snapshot with the current state stored in the connected rpc (ganache only method)
// Returns the id of the snapshot (a snapshot is single use, cannot use an id twice)
const snapshot = async () => {
  return new Promise((ok, ko) => {
    web3.currentProvider.sendAsync({
      method: "evm_snapshot",
      params: [],
      jsonrpc: "2.0",
      id: new Date().getTime()
    }, (error, res) => {
      if (error) {
        return ko(error);
      } else {
        ok(res.result);
      }
    })
  })
};

// Sends a snapshot id to the rpc, restores state to previsously snapshotted version
const revert = async (snap_id) => {
  return new Promise((ok, ko) => {
    web3.currentProvider.sendAsync({
      method: "evm_revert",
      params: [snap_id],
      jsonrpc: "2.0",
      id: new Date().getTime()
    }, (error, res) => {
      if (error) {
        return ko(error);
      } else {
        ok(res.result);
      }
    })
  })
};

describe('OathForge', async () => {

  before(async () => {

    // Recover static data
    accounts = await web3.eth.getAccounts();

    // Deploy and setup everything
    await deploy();

    // Snapshot state
    this.snap_id = await snapshot();
  });

  beforeEach(async () => {
    await revert(this.snap_id);
    this.snap_id = await snapshot();
  });

  describe('Getter', () => {

    it('Total supply without any minting should return 0', async () => {

      expect((await OathForge.totalSupply()).toNumber()).to.equal(0);

    });

    it('Total supply with 1 minting before should return 1', async () => {

      await OathForge.mint(accounts[1], TOKEN_URI, 1 * MINUTE, {from: accounts[0]});

      expect((await OathForge.totalSupply()).toNumber()).to.equal(1);

    });

    it('Total supply with 2 mintings before should return 2', async () => {

      await OathForge.mint(accounts[1], TOKEN_URI, 1 * MINUTE, {from: accounts[0]});
      await OathForge.mint(accounts[1], TOKEN_URI, 1 * MINUTE, {from: accounts[0]});

      expect((await OathForge.totalSupply()).toNumber()).to.equal(2);

    });

    it('Next token id without any minting should be 0', async () => {

      expect((await OathForge.totalSupply()).toNumber()).to.equal(0);
      expect((await OathForge.nextTokenId()).toNumber()).to.equal(0);

    });

    it('Next token id with one minting should be 1', async () => {

      await OathForge.mint(accounts[1], TOKEN_URI, 1 * MINUTE, {from: accounts[0]});

      expect((await OathForge.totalSupply()).toNumber()).to.equal(1);
      expect((await OathForge.nextTokenId()).toNumber()).to.equal(1);

    });

    it('Get sunset initialization timestamp of non-existing token', async () => {

      expect((await OathForge.sunsetInitiatedAt(0)).toNumber()).to.equal(0);

    });

    it('Get sunset initialization timestamp of non-initialized token', async () => {

      await OathForge.mint(accounts[1], TOKEN_URI, 1 * MINUTE, {from: accounts[0]});

      expect((await OathForge.sunsetInitiatedAt(0)).toNumber()).to.equal(0);

    });

    it('Get sunset initialization timestamp', async () => {

      await OathForge.mint(accounts[1], TOKEN_URI, 1 * MINUTE, {from: accounts[0]});
      const res = await OathForge.initiateSunset(0, {from: accounts[0]});

      const blockNumber = res.receipt.blockNumber;
      const block = await get_block(blockNumber);
      const timestamp = block.timestamp;

      expect((await OathForge.sunsetInitiatedAt(0)).toNumber()).to.equal(timestamp);

    });

    it('Get sunset length of non-existing token', async () => {

      return expect((await OathForge.sunsetLength(0)).toNumber()).to.equal(0);

    });

    it('Get sunset length', async () => {

      await OathForge.mint(accounts[1], TOKEN_URI, 1 * MINUTE, {from: accounts[0]});

      expect((await OathForge.sunsetLength(0)).toNumber()).to.equal(1 * MINUTE);

    });

    it('Get redemption hash of non-existing token', async () => {

      return expect(OathForge.redemptionCodeHash(0)).to.eventually.equal('0x0000000000000000000000000000000000000000000000000000000000000000')

    });

    it('Get redemption hash of non-burned token', async () => {

      await OathForge.mint(accounts[1], TOKEN_URI, 1 * MINUTE, {from: accounts[0]});

      return expect(OathForge.redemptionCodeHash(0)).to.eventually.equal('0x0000000000000000000000000000000000000000000000000000000000000000')

    });

    it('Get redemption hash of token', async () => {

      await OathForge.mint(accounts[0], TOKEN_URI, 1 * MINUTE, {from: accounts[0]});
      const test_hash = '0xabcd00000000000000000000000000000000000000000000000000000000abcd';
      await OathForge.submitRedemptionCodeHash(0, test_hash, {from: accounts[0], gas: 0xffffff});
      return expect(OathForge.redemptionCodeHash(0)).to.eventually.equal(test_hash)

    });

    it('Get timestamp of redemption hash modification', async () => {
      await OathForge.mint(accounts[0], TOKEN_URI, 1 * MINUTE, {from: accounts[0]});
      const test_hash = '0xabcd00000000000000000000000000000000000000000000000000000000abcd';
      const res = await OathForge.submitRedemptionCodeHash(0, test_hash, {from: accounts[0], gas: 0xffffff});

      const blockNumber = res.receipt.blockNumber;
      const block = await get_block(blockNumber);
      const timestamp = block.timestamp;

      expect((await OathForge.redemptionCodeHashSubmittedAt(0)).toNumber()).to.equal(timestamp);

    })

  });

  describe('Actions', () => {

    it('Initiate Sunset of non-existing token', async () => {

      return expect(OathForge.initiateSunset(0, {from: accounts[0], gas: 0xffffff})).to.eventually.be.rejected;

    });

    it('Initiate Sunset of minted token', async () => {

      await OathForge.mint(accounts[0], TOKEN_URI, 1 * MINUTE, {from: accounts[0]});

      return expect(OathForge.initiateSunset(0, {from: accounts[0]})).to.eventually.be.fulfilled;

    });

    it('Initiate Sunset of minted token twice', async () => {

      await OathForge.mint(accounts[0], TOKEN_URI, 1 * MINUTE, {from: accounts[0]});

      await OathForge.initiateSunset(0, {from: accounts[0]});
      return expect(OathForge.initiateSunset(0, {from: accounts[0]})).to.eventually.be.rejected;
    });

    it('Initiate Sunset of minted token from non-owner account', async () => {

      await OathForge.mint(accounts[0], TOKEN_URI, 1 * MINUTE, {from: accounts[0]});

      return expect(OathForge.initiateSunset(0, {from: accounts[1]})).to.eventually.be.rejected;

    });

    it('Set tokenURI of existing token', async () => {

      await OathForge.mint(accounts[0], TOKEN_URI, 1 * MINUTE, {from: accounts[0]});
      const new_uri = 'https://new.basic.uri.test/test';
      await OathForge.setTokenURI(0, new_uri, {from: accounts[0]});

      return expect(OathForge.tokenURI(0)).to.eventually.equal(new_uri);

    });

    it('Set tokenURI of existing token from non-owner', async () => {

      await OathForge.mint(accounts[0], TOKEN_URI, 1 * MINUTE, {from: accounts[0]});
      const new_uri = 'https://new.basic.uri.test/test';
      return expect(OathForge.setTokenURI(0, new_uri, {from: accounts[1]})).to.eventually.be.rejected;

    });

    it('Set tokenURI of non-existing token', async () => {

      const new_uri = 'https://new.basic.uri.test/test';
      return expect(OathForge.setTokenURI(0, new_uri, {from: accounts[1]})).to.eventually.be.rejected;

    });

    it('Transfer freshly minted token', async () => {

      await OathForge.mint(accounts[0], TOKEN_URI, 1 * MINUTE, {from: accounts[0]});

      await OathForge.transferFrom(accounts[0], accounts[1], 0, {from: accounts[0], gas: 0xffffff});

      return expect(OathForge.ownerOf(0)).to.eventually.equal(accounts[1]);

    });

    it('Transfer token with initiated sunset', async () => {

      await OathForge.mint(accounts[0], TOKEN_URI, 10 * MINUTE, {from: accounts[0]});

      await OathForge.initiateSunset(0, {from: accounts[0]});

      await OathForge.transferFrom(accounts[0], accounts[1], 0, {from: accounts[0], gas: 0xffffff});

      return expect(OathForge.ownerOf(0)).to.eventually.equal(accounts[1]);

    });

    it('Transfer token with initiated sunset, too late', async () => {

      await OathForge.mint(accounts[0], TOKEN_URI, 1 * SECOND, {from: accounts[0]});

      await OathForge.initiateSunset(0, {from: accounts[0]});

      await new Promise((ok, ko) => setInterval(() => ok(), 2000));

      return expect(OathForge.transferFrom(accounts[0], accounts[1], 0, {from: accounts[0], gas: 0xffffff})).to.eventually.be.rejected;

    }).timeout(10000);

  });

});
