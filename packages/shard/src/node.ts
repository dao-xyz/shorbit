
import OrbitDB from 'orbit-db';
import { Identity } from 'orbit-db-identity-provider';
import { CONTRACT_ACCESS_CONTROLLER } from './acl';
import { Peer, Shard, TypedBehaviours } from './shard';
import { IPFS as IPFSInstance } from 'ipfs-core-types'
import { Constructor, deserialize, serialize } from '@dao-xyz/borsh';
import { EncodedQueryResponse, QueryRequestV0, QueryResponse } from './query';
import { Message } from 'ipfs-core-types/types/src/pubsub'

export interface IPFSInstanceExtended extends IPFSInstance {
    libp2p: any
}

export const ROOT_CHAIN_SHARD_SIZE = 100;


export class ServerOptions {

    defaultOptions: ICreateOptions;
    behaviours: TypedBehaviours
    replicationCapacity: number;

    constructor(options: {
        id: string;
        behaviours: TypedBehaviours
        replicationCapacity: number;
    }) {

        Object.assign(this, options);
        this.replicationCapacity = options.replicationCapacity;
        this.behaviours = options.behaviours;
        if (!this.behaviours) {
            throw new Error("Expecting behaviours");
        }

        // Static behaviours
        this.behaviours.typeMap[Shard.name] = Shard;
        this.behaviours.typeMap[Peer.name] = Peer;


        this.defaultOptions = {
            accessController: {
                //write: [this.orbitDB.identity.id],
                type: CONTRACT_ACCESS_CONTROLLER
            } as any,
            replicate: true,
            directory: './orbit-db-stores/' + options.id
        }

    }


}


export const createOrbitDBInstance = (node: IPFSInstance | any, id: string, identity?: Identity) => OrbitDB.createInstance(node,
    {
        identity: identity,
        directory: './orbit-db/' + id
    })

export class AnyPeer {

    public rootAddress: string;

    public node: IPFSInstanceExtended = undefined;

    public orbitDB: OrbitDB = undefined;

    public options: ServerOptions;

    public id?: string;

    constructor(id?: string) {
        this.id = id;
    }

    async create(options: { rootAddress: string, orbitDB: OrbitDB, options: ServerOptions }): Promise<void> {
        this.orbitDB = options.orbitDB;
        this.options = options.options;
        this.rootAddress = options.rootAddress;
        this.node = options.orbitDB._ipfs;

        /*  if (this["onready"]) (this as any).onready(); */

    }


    get replicationTopic(): string {
        return this.rootAddress + "-" + "sharding";
    }

    async query<T>(topic: string, query: QueryRequestV0, clazz: Constructor<T>, responseHandler: (response: QueryResponse<T>) => void, maxAggregationTime: number = 30 * 1000) {
        // send query and wait for replies in a generator like behaviour
        let responseTopic = query.getResponseTopic(topic);
        await this.node.pubsub.subscribe(responseTopic, (msg: Message) => {
            const encoded = deserialize(Buffer.from(msg.data), EncodedQueryResponse);
            let result = QueryResponse.from(encoded, clazz);
            responseHandler(result);
        })
        await this.node.pubsub.publish(topic, serialize(query));

        // Unsubscrice after a while
        /*   setTimeout(() => {
              this.node.pubsub.unsubscribe(responseTopic);
          }, maxAggregationTime); */
    }

    async subscribeForReplication(): Promise<void> {
        await this.node.pubsub.subscribe(this.replicationTopic, async (msg: any) => {
            try {
                let shard = deserialize(msg.data, Shard);
                if (shard.shardSize.toNumber() > this.options.replicationCapacity) {
                    console.log(`Can not replicate shard size ${shard.shardSize.toNumber()} with peer capacity ${this.options.replicationCapacity}`)
                    return;
                }
                this.options.replicationCapacity -= shard.shardSize.toNumber();
                await shard.init(this);
                await shard.replicate();

            } catch (error) {
                console.error('Invalid replication request');
            }
        })
    }



    async disconnect(): Promise<void> {
        try {
            /*   await this.orbitDB.disconnect(); */
            let p = (await this.node.pubsub.ls()).map(topic => this.node.pubsub.unsubscribe(topic))
            await Promise.all(p);
            await this.node.stop();
            /*            
             */
        } catch (error) {

        }
        /*  
        /*  try {
             let p = (await this.node.pubsub.ls()).map(topic => this.node.pubsub.unsubscribe(topic))
             await Promise.all(p);
         } catch (error) {
 
         } */
        /*    */
    }
}


// we create a dummy shard chain just to be able to create a new Shard
/* let chain = new ShardChain<any>({
    name: request.shardChainName,
    remoteAddress: this.rootAddress,
    storeOptions: request.storeOptions,
    shardSize: request.shardSize // Does not have any effect

});


chain.init({
    defaultOptions: this.defaultOptions,
    db: this,
    behaviours: this.behaviours,
})

let shardToReplicate = new Shard({
    index: request.index,
    chain,
    defaultOptions: this.defaultOptions
});

await shardToReplicate.replicate({
    capacity: request.shardSize
});
 */
// this.handleMessageReceived.bind(this)
/*  
    this.node.libp2p.connectionManager.on('peer:connect', this.handlePeerConnected.bind(this))
    
    await this.node.pubsub.subscribe(peerInfo.id, (msg: any) => {
            this.latestMessages.set(peerInfo.id, msg);
            console.log('Got msg')
            this.handleMessageReceived(msg)
        }) // this.handleMessageReceived.bind(this)
    */

/*  handlePeerConnected(ipfsPeer) {
     const ipfsId = ipfsPeer.id
     if (this["onpeerconnect"]) (this as any).onpeerconnect(ipfsId)
 }
*/
/*  async sendMessage(topic: string, message: any) {
     try {
         const msgString = JSON.stringify(message)
         const messageBuffer = Buffer.from(msgString)
         await this.node.pubsub.publish(topic, messageBuffer)
     } catch (e) {
         throw (e)
     }
 } */

/* const Libp2p = require('libp2p')
const TCP = require('libp2p-tcp')
const Websockets = require('libp2p-websockets')
const WebrtcStar = require('libp2p-webrtc-star')
const wrtc = require('wrtc')
const Mplex = require('libp2p-mplex')
const { NOISE } = require('libp2p-noise')
const Secio = require('libp2p-secio')
const Bootstrap = require('libp2p-bootstrap')
const MDNS = require('libp2p-mdns')
const KadDHT = require('libp2p-kad-dht')
const Gossipsub = require('libp2p-gossipsub') */