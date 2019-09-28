/// <reference types="debug" />
// const debug: debug.IDebugger = require('debug')('mcft:svccom:MessageBrokerRpcCaller')

import * as shortid from 'shortid'
import { decorators as d, Guard, MinorException, InternalErrorException } from '@micro-fleet/common'

import { Types as T } from '../constants/Types'
import { IMessageBrokerConnector, BrokerMessage } from '../MessageBrokerConnector'
import { IMessageBrokerConnectorProvider } from '../MessageBrokerProviderAddOn'
import * as rpc from '../RpcCommon'


export type MediateRpcCallerOptions = {
    /**
     * The name used in "from" property of sent messages.
     */
    callerName: string,

    /**
     * Message broker connector instance to reuse.
     */
    connector?: IMessageBrokerConnector,

    /**
     * Message broker connector name to create new,
     * if not reusing any existing connector.
     *
     * If neither `connector` nor `connectorName` is specified, a default name is used
     */
    connectorName?: string,

    /**
     * Time to live (in milliseconds) of the sent messages.
     */
    messageExpiredIn?: number

    /**
     * Number of milliseconds to wait for response before cancelling the request.
     * Must be between (inclusive) 1000 and 60000 (Min: 1s, Max: 60s).
     */
    timeout?: number
}

export interface IMediateRpcCaller extends rpc.IRpcCaller {
    /**
     * Gets the message broker connector instance used for making mediate RPC calls.
     */
    readonly msgBrokerConnector: IMessageBrokerConnector

    /**
     * Initializes this caller before use.
     */
    init(options: MediateRpcCallerOptions): Promise<void>
}

@d.injectable()
export class MessageBrokerRpcCaller
            extends rpc.RpcCallerBase
            implements IMediateRpcCaller {

    private _msgBrokerConn: IMessageBrokerConnector

    /**
     * @see IMediateRpcCaller.msgBrokerConnector
     */
    public get msgBrokerConnector(): IMessageBrokerConnector {
        return this._msgBrokerConn
    }

    private get _isInit(): boolean {
        return Boolean(this._msgBrokerConn)
    }

    constructor(
        @d.inject(T.MSG_BROKER_CONNECTOR_PROVIDER) private _msgBrokerConnProvider: IMessageBrokerConnectorProvider
    ) {
        super()
        Guard.assertArgDefined('_msgBrokerConnProvider', _msgBrokerConnProvider)
    }

    /**
     * @see IMediateRpcCaller.init
     */
    public async init(options: MediateRpcCallerOptions): Promise<void> {
        this.$name = options.callerName
        if (options.connector) {
            this._msgBrokerConn = options.connector
        }
        else {
            const name = options.connectorName || `Connector for RPC caller "${this.name}"`
            this._msgBrokerConn = await this._msgBrokerConnProvider.create(name)
            if (options.messageExpiredIn != null) {
                this._msgBrokerConn.messageExpiredIn = options.messageExpiredIn
            }
            this._msgBrokerConn.onError(err => this.$emitError(err))
        }

        if (options.timeout != null) {
            this.$timeout = options.timeout
        }
    }

    /**
     * @see IRpcCaller.dispose
     */
    public async dispose(): Promise<void> {
        // DO NOT disconnect the connector as other RPC handlers and callers
        // may share this very connector.
        this._msgBrokerConn && (this._msgBrokerConn = null)
        await super.dispose()
    }

    /**
     * @see IRpcCaller.call
     */
    public call({ moduleName, actionName, params, rawDest }: rpc.RpcCallerOptions): Promise<rpc.RpcResponse> {
        Guard.assertIsTruthy(this._isInit, 'Must call "init" before use.')
        if (!rawDest) {
            Guard.assertArgDefined('moduleName', moduleName)
            Guard.assertArgDefined('actionName', actionName)
        }

        return new Promise<rpc.RpcResponse>((resolve, reject) => {
            // There are many requests to same `requestTopic` and they listen to same `responseTopic`,
            // A request only cares about a response with same `correlationId`.
            const correlationId = shortid.generate(),
                replyTo = Boolean(rawDest)
                    ? `response.${rawDest}@${correlationId}`
                    : `response.${moduleName}.${actionName}@${correlationId}`,
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
                        if (!response.isSuccess) {
                            response.payload = this.$rebuildError(response.payload)
                            if (response.payload instanceof InternalErrorException) {
                                return reject(response.payload)
                            }
                        }
                        resolve(response)
                    }

                    // In case this request never has response.
                    token = setTimeout(() => {
                        this.$emitter && this.$emitter.removeListener(correlationId, onMessage)
                        conn && conn.unsubscribe(replyTo).catch(() => { /* Swallow */ })
                        reject(new MinorException('Response waiting timeout'))
                    }, this.timeout)

                    this.$emitter.once(correlationId, onMessage)

                    return conn.listen((msg: BrokerMessage) => {
                        // Announce that we've got a response with this correlationId.
                        this.$emitter.emit(msg.properties.correlationId, msg)
                    })
                })
                .then(() => {
                    const request: rpc.RpcRequest = {
                        from: this.name,
                        to: moduleName,
                        payload: params,
                    }

                    // Send request, marking the message with correlationId.
                    return conn.publish(rawDest || `request.${moduleName}.${actionName}`, request,
                        { correlationId, replyTo })
                })
                .catch(err => {
                    reject(new MinorException(`RPC error: ${err}`))
                })
        })
    }

    /**
     * @see IRpcCaller.callImpatient
     */
    public callImpatient({ moduleName, actionName, params, rawDest }: rpc.RpcCallerOptions): Promise<void> {
        Guard.assertIsTruthy(this._isInit, 'Must call "init" before use.')
        if (!rawDest) {
            Guard.assertArgDefined('moduleName', moduleName)
            Guard.assertArgDefined('actionName', actionName)
        }
        const request: rpc.RpcRequest = {
            from: this.name,
            to: moduleName,
            payload: params,
        }

        // Send request, marking the message with correlationId.
        return this._msgBrokerConn.publish(rawDest || `request.${moduleName}.${actionName}`, request)
            .catch(err => new MinorException(`RPC error: ${err}`)) as any
    }
}
