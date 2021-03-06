const assert = require('assert')
const rmrf = require('rimraf')
const fs = require('fs-extra')
import { Entry } from '../entry'
import { Log } from '../log'
import { Identities } from '@dao-xyz/orbit-db-identity-provider'
const Keystore = require('orbit-db-keystore')

// Test utils
const {
  config,
  testAPIs,
  startIpfs,
  stopIpfs
} = require('orbit-db-test-utils')

let ipfsd, ipfs, testIdentity, testIdentity2, testIdentity3, testIdentity4

const last = (arr) => {
  return arr[arr.length - 1]
}

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Log - Heads and Tails (' + IPFS + ')', function () {
    jest.setTimeout(config.timeout)

    const { identityKeyFixtures, signingKeyFixtures, identityKeysPath, signingKeysPath } = config

    let keystore, signingKeystore

    beforeAll(async () => {
      rmrf.sync(identityKeysPath)
      rmrf.sync(signingKeysPath)
      await fs.copy(identityKeyFixtures(__dirname), identityKeysPath)
      await fs.copy(signingKeyFixtures(__dirname), signingKeysPath)

      keystore = new Keystore(identityKeysPath)
      signingKeystore = new Keystore(signingKeysPath)

      testIdentity = await Identities.createIdentity({ id: 'userA', keystore, signingKeystore })
      testIdentity2 = await Identities.createIdentity({ id: 'userB', keystore, signingKeystore })
      testIdentity3 = await Identities.createIdentity({ id: 'userC', keystore, signingKeystore })
      testIdentity4 = await Identities.createIdentity({ id: 'userD', keystore, signingKeystore })
      ipfsd = await startIpfs(IPFS, config.defaultIpfsConfig)
      ipfs = ipfsd.api
    })

    afterAll(async () => {
      await stopIpfs(ipfsd)
      rmrf.sync(identityKeysPath)
      rmrf.sync(signingKeysPath)

      await keystore?.close()
      await signingKeystore?.close()
    })

    describe('heads', () => {
      test('finds one head after one entry', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        assert.strictEqual(log1.heads.length, 1)
      })

      test('finds one head after two entries', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        assert.strictEqual(log1.heads.length, 1)
      })

      test('log contains the head entry', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        assert.deepStrictEqual(log1.get(log1.heads[0].hash), log1.heads[0])
      })

      test('finds head after a join and append', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })

        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')

        await log2.join(log1)
        await log2.append('helloB2')
        const expectedHead = last(log2.values)

        assert.strictEqual(log2.heads.length, 1)
        assert.deepStrictEqual(log2.heads[0].hash, expectedHead.hash)
      })

      test('finds two heads after a join', async () => {
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })

        await log1.append('helloA1')
        await log1.append('helloA2')
        const expectedHead1 = last(log1.values)

        await log2.append('helloB1')
        await log2.append('helloB2')
        const expectedHead2 = last(log2.values)

        await log1.join(log2)

        const heads = log1.heads
        assert.strictEqual(heads.length, 2)
        assert.strictEqual(heads[0].hash, expectedHead2.hash)
        assert.strictEqual(heads[1].hash, expectedHead1.hash)
      })

      test('finds two heads after two joins', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })

        await log1.append('helloA1')
        await log1.append('helloA2')

        await log2.append('helloB1')
        await log2.append('helloB2')

        await log1.join(log2)

        await log2.append('helloB3')

        await log1.append('helloA3')
        await log1.append('helloA4')
        const expectedHead2 = last(log2.values)
        const expectedHead1 = last(log1.values)

        await log1.join(log2)

        const heads = log1.heads
        assert.strictEqual(heads.length, 2)
        assert.strictEqual(heads[0].hash, expectedHead1.hash)
        assert.strictEqual(heads[1].hash, expectedHead2.hash)
      })

      test('finds two heads after three joins', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log3 = new Log(ipfs, testIdentity, { logId: 'A' })

        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        await log1.append('helloA3')
        await log1.append('helloA4')
        const expectedHead1 = last(log1.values)
        await log3.append('helloC1')
        await log3.append('helloC2')
        await log2.join(log3)
        await log2.append('helloB3')
        const expectedHead2 = last(log2.values)
        await log1.join(log2)

        const heads = log1.heads
        assert.strictEqual(heads.length, 2)
        assert.strictEqual(heads[0].hash, expectedHead1.hash)
        assert.strictEqual(heads[1].hash, expectedHead2.hash)
      })

      test('finds three heads after three joins', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log3 = new Log(ipfs, testIdentity, { logId: 'A' })

        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        await log1.append('helloA3')
        await log1.append('helloA4')
        const expectedHead1 = last(log1.values)
        await log3.append('helloC1')
        await log2.append('helloB3')
        await log3.append('helloC2')
        const expectedHead2 = last(log2.values)
        const expectedHead3 = last(log3.values)
        await log1.join(log2)
        await log1.join(log3)

        const heads = log1.heads
        assert.strictEqual(heads.length, 3)
        assert.deepStrictEqual(heads[0].hash, expectedHead1.hash)
        assert.deepStrictEqual(heads[1].hash, expectedHead2.hash)
        assert.deepStrictEqual(heads[2].hash, expectedHead3.hash)
      })
    })

    describe('tails', () => {
      test('returns a tail', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        assert.strictEqual(log1.tails.length, 1)
      })

      test('tail is a Entry', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        assert.strictEqual(Entry.isEntry(log1.tails[0]), true)
      })

      test('returns tail entries', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log2.append('helloB1')
        await log1.join(log2)
        assert.strictEqual(log1.tails.length, 2)
        assert.strictEqual(Entry.isEntry(log1.tails[0]), true)
        assert.strictEqual(Entry.isEntry(log1.tails[1]), true)
      })

      test('returns tail hashes', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2, 2)
        assert.strictEqual(log1.tailHashes.length, 2)
      })

      test('returns no tail hashes if all entries point to empty nexts', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log2.append('helloB1')
        await log1.join(log2)
        assert.strictEqual(log1.tailHashes.length, 0)
      })

      test('returns tails after loading a partial log', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity2, { logId: 'A' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        const log4 = await Log.fromEntry(ipfs, testIdentity, log1.heads, { length: 2 })
        assert.strictEqual(log4.length, 2)
        assert.strictEqual(log4.tails.length, 2)
        assert.strictEqual(log4.tails[0].hash, log4.values[0].hash)
        assert.strictEqual(log4.tails[1].hash, log4.values[1].hash)
      })

      test('returns tails sorted by public key', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'XX' })
        const log2 = new Log(ipfs, testIdentity2, { logId: 'XX' })
        const log3 = new Log(ipfs, testIdentity3, { logId: 'XX' })
        const log4 = new Log(ipfs, testIdentity4, { logId: 'XX' })
        await log1.append('helloX1')
        await log2.append('helloB1')
        await log3.append('helloA1')
        await log3.join(log1)
        await log3.join(log2)
        await log4.join(log3)
        assert.strictEqual(log4.tails.length, 3)
        assert.strictEqual(log4.tails[0].id, 'XX')
        assert.strictEqual(log4.tails[0].clock.id, testIdentity3.publicKey)
        assert.strictEqual(log4.tails[1].clock.id, testIdentity2.publicKey)
        assert.strictEqual(log4.tails[2].clock.id, testIdentity.publicKey)
        assert.strictEqual(log4.clock.id, testIdentity4.publicKey)
      })
    })
  })
})
