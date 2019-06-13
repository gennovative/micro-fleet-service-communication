import * as shortid from 'shortid'
import { injectable, inject, Guard, MinorException } from '@micro-fleet/common'

import { Types as T } from '../Types'
import { IMessageBrokerConnector, BrokerMessage } from '../MessageBrokerConnector'
import * as rpc from '../RpcCommon'


export interface IMediateRpcCaller extends rpc.IRpcCaller {
}

@injectable()
export class MessageBrokerRpcCaller
            extends rpc.RpcCallerBase
            implements IMediateRpcCaller {

    constructor(
        @inject(T.MSG_BROKER_CONNECTOR) private _msgBrokerConn: IMessageBrokerConnector
    ) {
        super()
        Guard.assertArgDefined('_msgBrokerConn', _msgBrokerConn)

        this._msgBrokerConn.queue = '' // Make sure we only use temporary unique queue.

    }

    /**
     * @see IRpcCaller.init
     */
    public init(params?: any): void {
        const expire = this._msgBrokerConn.messageExpiredIn
        this._msgBrokerConn.messageExpiredIn = expire > 0 ? expire : 30000 // Make sure we only use temporary unique queue.
        this._msgBrokerConn.onError(err => this.emitError(err))
    }

    /**
     * @see IRpcCaller.dispose
     */
    public async dispose(): Promise<void> {
        // DO NOT disconnect the connector as other RPC handlers and callers
        // share this very connector.
        this._msgBrokerConn = null
        await super.dispose()
    }

    /**
     * @see IRpcCaller.call
     */
    public call(moduleName: string, action: string, params?: any): Promise<rpc.RpcResponse> {
        Guard.assertArgDefined('moduleName', moduleName)
        Guard.assertArgDefined('action', action)

        return new Promise<rpc.RpcResponse>((resolve, reject) => {
            // There are many requests to same `requestTopic` and they listen to same `responseTopic`,
            // A request only cares about a response with same `correlationId`.
            const correlationId = shortid.generate(),
                replyTo = `response.${moduleName}.${action}@${correlationId}`,
                conn = this._msgBrokerConn

            conn.subscribe(replyTo)
                .then(() => {
                    let token: NodeJS.Timer
                    const onMessage = async (msg: BrokerMessage) => {
                        clearTimeout(token)
                        // We got what we want, stop consuming.
                        await conn.unsubscribe(replyTo)
                        await conn.stopListen()

                        const response: rpc.RpcResponse = msg.data
                        if (response.isSuccess) {
                            resolve(response)
                        } else {
                            reject(this.rebuildError(response.payload))
                        }
                    }

                    // In case this request never has response.
                    token = setTimeout(() => {
                        this._emitter && this._emitter.removeListener(correlationId, onMessage)
                        this._msgBrokerConn && conn.unsubscribe(replyTo).catch(() => { /* Swallow */ })
                        reject(new MinorException('Response waiting timeout'))
                    }, this.timeout)

                    this._emitter.once(correlationId, onMessage)

                    return conn.listen((msg: BrokerMessage) => {
                        // Announce that we've got a response with this correlationId.
                        this._emitter.emit(msg.properties.correlationId, msg)
                    })
                })
                .then(() => {
                    const request: rpc.RpcRequest = {
                        from: this.name,
                        to: moduleName,
                        payload: params,
                    }

                    // Send request, marking the message with correlationId.
                    return this._msgBrokerConn.publish(`request.${moduleName}.${action}`, request,
                        { correlationId, replyTo })
                })
                .catch(err => {
                    reject(new MinorException(`RPC error: ${err}`))
                })
        })
    }
}
