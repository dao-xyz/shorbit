

import { Constructor, deserialize, field, option, serialize, variant, vec } from "@dao-xyz/borsh";
import OrbitDB from "orbit-db";
import BN from 'bn.js';
import Store from "orbit-db-store";
import CounterStore from "orbit-db-counterstore";
import { BinaryKeyValueStore } from '@dao-xyz/orbit-db-bkvstore';
import { BinaryDocumentStoreOptions, BinaryKeyValueStoreOptions, StoreOptions, waitForReplicationEvents } from "./stores";
import { generateUUID } from "./id";
import { Message } from 'ipfs-core-types/types/src/pubsub'
import { EncodedQueryResponse, FilterQuery, query, Query, QueryRequestV0, QueryResponse, StringMatchQuery } from "./query";
import { BinaryDocumentStore } from "@dao-xyz/orbit-db-bdocstore";
import base58 from "bs58";
import { waitFor } from "./utils";
import { AnyPeer, IPFSInstanceExtended } from "./node";
import { Peer } from "./peer";
import { PublicKey } from "./key";
import { P2PTrust } from "./trust";
import { Shard } from "./shard";
import * as events from 'events';

export class DBInterface {

    get initialized(): boolean {
        throw new Error("Not implemented")
    }

    close() {
        throw new Error("Not implemented")

    }

    async init(_shard: Shard<any>) {
        throw new Error("Not implemented")
    }

    async load(): Promise<void> {
        throw new Error("Not implemented")
    }

    async query(_query: QueryRequestV0): Promise<any[]> {
        throw new Error("Not implemented")
    }


}

// Every interface has to have its own variant, else DBInterface can not be
// used as a deserialization target.
@variant(1)
export class SingleDBInterface<T, B extends Store<T, any>> extends DBInterface {

    @field({ type: 'String' })
    name: string;

    @field({ type: 'String' })
    address: string;

    @field({ type: StoreOptions })
    storeOptions: StoreOptions<B>;

    db: B;
    _shard: Shard<any>

    constructor(opts?: {
        name: string;
        address?: string;
        storeOptions: StoreOptions<B>;
    }) {
        super();
        if (opts) {
            Object.assign(this, opts);
        }
    }

    async init(shard: Shard<any>) {
        this._shard = shard;
    }


    async newStore(): Promise<B> {
        if (!this._shard) {
            throw new Error("Not initialized")
        }

        this.db = await this.storeOptions.newStore(this.address ? this.address : this.getDBName(), this._shard.peer.orbitDB, this._shard.peer.options.defaultOptions, this._shard.peer.options.behaviours);
        onReplicationMark(this.db);
        this.address = this.db.address.toString();
        return this.db;
    }

    async load(waitForReplicationEventsCount: number = 0): Promise<void> {
        if (!this._shard) {
            throw new Error("Not initialized")
        }

        if (!this.db) {
            await this.newStore() //await db.feed(this.getDBName('blocks'), this.chain.defaultOptions);

        }
        await this.db.load();
        await waitForReplicationEvents(this.db, waitForReplicationEventsCount);
    }

    getDBName(): string {
        return this._shard.getDBName(this.name);
    }
    close() {
        this.db = undefined;
        this._shard = undefined;
    }

    get initialized(): boolean {
        return !!this.db;
    }

    async query(q: QueryRequestV0): Promise<T[]> {
        return query(q, this.db)
    }


}


@variant(0)
export class RecursiveShardDBInterface<T extends DBInterface> extends DBInterface {

    @field({ type: SingleDBInterface })
    db: SingleDBInterface<Shard<T>, BinaryDocumentStore<Shard<T>>>;

    constructor(opts?: { db: SingleDBInterface<Shard<T>, BinaryDocumentStore<Shard<any>>> }) {
        super();
        if (opts) {
            Object.assign(this, opts);
        }
    }

    get initialized(): boolean {
        return this.db.initialized
    }

    close() {
        this.db.close();
    }

    async init(shard: Shard<any>) {
        await this.db.init(shard);
    }


    async load(waitForReplicationEventsCount = 0): Promise<void> {
        await this.db.load(waitForReplicationEventsCount);
    }



    async query(q: QueryRequestV0): Promise<Shard<any>[]> {
        return this.db.query(q)
    }

    async loadShard(index: number, options: { expectedPeerReplicationEvents?: number } = { expectedPeerReplicationEvents: 0 }): Promise<Shard<T>> {
        // Get the latest shard that have non empty peer
        await this.db.load(index + 1);
        let shard = this.db.db.get(index.toString())[0]
        await shard.init(this.db._shard.peer);
        await shard.loadPeers(options.expectedPeerReplicationEvents);
        return shard;
    }


}

export const onReplicationMark = (store: Store<any, any>) => store.events.on('replicated', () => {
    store["replicated"] = true // replicated once
});
