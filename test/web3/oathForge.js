const _ = require('lodash')
const Account = require('ultralightbeam/lib/Account')
const amorphHex = require('amorph-hex')
const Web3 = require('web3')
const ganache = require('ganache-cli')
const output = require('../../output')
const Artifactor = require('truffle-artifactor')
const Resolver = require('truffle-resolver')
const assert = require('assert')

const artifactsDirectory = `${__dirname}/artifacts`

const artifactor = new Artifactor(artifactsDirectory)
const resolver = new Resolver({
  'working_directory': artifactsDirectory,
  'contracts_build_directory': artifactsDirectory
})
const accounts = [Account.generate(), Account.generate(), Account.generate(), Account.generate(), Account.generate()]
const addresses = accounts.map((account) => {
  return account.address.to(amorphHex.prefixed)
})

const provider = ganache.provider({
  gasPrice: 20000000000,
  gasLimit: 8000000,
  blocktime: 2,
  accounts: accounts.map((account) => {
    return {
      secretKey: account.privateKey.to(amorphHex.prefixed),
      balance: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    }
  })
})

async function testRevert(func) {
  let error
  try {
    await func();
  } catch(_error) {
    error = _error
  }
  assert.equal(error.message, 'VM Exception while processing transaction: revert')
}

const web3 = new Web3(provider)

describe('OathForge Contract', async (accounts) => {

  let OathForge
  let oathforge

  before(() => {
    return artifactor.save({
      contractName: 'OathForge',
      abi: JSON.parse(output.contracts['OathForge.sol:OathForge'].interface),
      unlinked_binary: `0x${output.contracts['OathForge.sol:OathForge'].bytecode}`
    }).then(() => {
      OathForge = resolver.require('OathForge')
      OathForge.setProvider(provider)
    })
  })

  it('Should correctly initialize constructor values of oathForge Contract', async () => {

    oathforge = await OathForge.new('OathForge', 'OathForge', { from: addresses[0] })
    let owner = await oathforge.owner.call();
    assert.equal(owner.toLowerCase(), addresses[0]);

  });

})
