/// <reference types="debug" />
const debug: debug.IDebugger = require('debug')('mcft:svccom:MessageBrokerRpcHandler')

import { decorators as d, Guard, ValidationError } from '@micro-fleet/common'

import { Types as T } from '../constants/Types'
import { IMessageBrokerConnector, BrokerMessage } from '../MessageBrokerConnector'
import { IMessageBrokerConnectorProvider } from '../MessageBrokerProviderAddOn'
import * as rpc from '../RpcCommon'


export type MediateRpcHandlerOptions = {
    /**
     * The name used in "from" property of sent messages.
     */
    handlerName: string,

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
}

export interface IMediateRpcHandler extends rpc.IRpcHandler {
    /**
     * Gets the message broker connector instance used for handling mediate RPC request.
     */
    readonly msgBrokerConnector: IMessageBrokerConnector

    /**
     * Initializes this handler before use.
     */
    init(options: MediateRpcHandlerOptions): Promise<void>
}

@d.injectable()
export class MessageBrokerRpcHandler
    extends rpc.RpcHandlerBase
    implements IMediateRpcHandler {

    private _msgBrokerConn: IMessageBrokerConnector
    private _handlers: Array<{
        routingKey: string,
        handler: rpc.RpcHandlerFunction,
    }>


    /**
     * @see IMediateRpcHandler.msgBrokerConnector
     */
    public get msgBrokerConnector(): IMessageBrokerConnector {
        return this._msgBrokerConn
    }

    private get _isInit(): boolean {
        return Boolean(this._msgBrokerConn)
    }


    constructor(
        @d.inject(T.MSG_BROKER_CONNECTOR_PROVIDER) private _msgBrokerConnProvider: IMessageBrokerConnectorProvider,
    ) {
        super()
        Guard.assertArgDefined('_msgBrokerConnProvider', _msgBrokerConnProvider)
    }


    /**
     * @see IMediateRpcHandler.init
     */
    public async init(options: MediateRpcHandlerOptions): Promise<void> {
        this.$name = options.handlerName

        let conn
        if (options.connector) {
            conn = this._msgBrokerConn = options.connector
        }
        else {
            const name = options.connectorName || `Connector for RPC handler "${this.name}"`
            conn = this._msgBrokerConn = await this._msgBrokerConnProvider.create(name)
            conn.onError(err => this.$emitError(err))
        }

        if (!conn.isActive) {
            await conn.connect()
        }
        this._handlers = []
    }

    /**
     * @see IRpcHandler.start
     */
    public start(): Promise<void> {
        Guard.assertIsTruthy(this._isInit, 'Must call "init" before use.')
        return this._msgBrokerConn.listen(this.onMessage.bind(this), false)
    }

    /**
     * @see IRpcHandler.dispose
     */
    public dispose(): Promise<void> {
        // Stop listening then unsbuscribe all topic patterns.
        // DO NOT disconnect the connector as other RPC handlers and callers
        // share this very connector.
        return <any>Promise.all([
            this._msgBrokerConn.stopListen(),
            this._msgBrokerConn.unsubscribeAll(),
        ])
    }

    /**
     * @see IRpcHandler.pause
     */
    public pause(): Promise<void> {
        Guard.assertIsTruthy(this._isInit, 'Must call "init" before use.')
        return this._msgBrokerConn.stopListen()
    }

    /**
     * @see IRpcHandler.resume
     */
    public resume(): Promise<void> {
        return this.start()
    }

    /**
     * @see IRpcHandler.handle
     */
    public async handle({ moduleName, actionName, handler, rawDest }: rpc.RpcHandleOptions): Promise<void> {
        Guard.assertIsTruthy(this._isInit, 'Must call "init" before use.')
        Guard.assertIsDefined(this.name, '`name` property is required.')
        const dest = Boolean(rawDest)
            ? rawDest
            : `request.${moduleName}.${actionName}`
        if (this._hasHandler(dest, true)) {
            debug(`MediateRpcHandler Warning: Override existing subscription key ${dest}`)
        }
        this._addHandler(dest, handler)
        return this._msgBrokerConn.subscribe(dest)
    }


    private onMessage(msg: BrokerMessage, ack: Function, nack: Function): void {
        const routingKey: string = msg.raw.fields.routingKey
        const actionFnArr = this._getHandlers(routingKey)
        if (!actionFnArr.length) {
            // Although we nack this message and re-queue it, it will come back
            // if it's not handled by any other service. And we jut keep nack-ing
            // it until the message expires.
            nack()
            return debug(`No handlers for request ${routingKey}`)
        }
        ack()

        const request: rpc.RpcRequest = msg.data
        const correlationId = msg.properties.correlationId
        const replyTo: string = msg.properties.replyTo;

        (new Promise(async (resolve, reject) => {
            const wrappedReject = (isIntended: boolean) => (reason: any) => reject(<rpc.HandlerRejection>{
                isIntended,
                reason,
            })
            try {
                const rejectIntended = wrappedReject(true)
                // Execute controller's actions
                // Take the earliest response
                await Promise.race(actionFnArr.map(actionFn =>
                    actionFn({
                        payload: request.payload,
                        resolve,
                        reject: rejectIntended,
                        rpcRequest: request,
                        rawMessage: msg,
                    }),
                ))
            } catch (err) { // Catch normal exceptions.
                let isIntended = false
                if (err instanceof ValidationError) {
                    isIntended = true
                }
                wrappedReject(isIntended)(err)
            }
        }))
        .then(result => { // When `actionFn` calls `resolve` from inside.
            // Sends response to reply topic
            return this._msgBrokerConn.publish(replyTo, this.$createResponse(true, result, request.from), { correlationId })
        })
        .catch((error: rpc.HandlerRejection) => {
            // If error from `publish()`
            if (error.isIntended == null) {
                this.$emitError(error)
                return Promise.resolve()
            }
            else if (error.isIntended === false) {
                this.$emitError(error.reason)
            }

            // If HandlerRejection error, let caller know
            const errObj = this.$createError(error)
            return this._msgBrokerConn.publish(
                replyTo,
                this.$createResponse(false, errObj, request.from), { correlationId }
            )
        })
        // Catch error thrown by `createError()` or `publish()` in above catch
        .catch(this.$emitError.bind(this))
    }

    private _hasHandler(routingKey: string, exact = false) {
        return this._handlers.some(h => {
            if (exact) {
                return routingKey === h.routingKey
            }
            return this._routingKeyToRegExp(h.routingKey).test(routingKey)
        })
    }

    private _getHandlers(routingKey: string): rpc.RpcHandlerFunction[] {
        return this._handlers
            .filter(h =>
                this._routingKeyToRegExp(h.routingKey).test(routingKey),
            )
            .map(h => h.handler)
    }

    private _addHandler(routingKey: string, handler: rpc.RpcHandlerFunction) {
        this._handlers.push({ routingKey, handler })
    }

    private _routingKeyToRegExp(routingKey: string): RegExp {
        const routeWildcard = routingKey
            .replace(/\./g, '\\.')
            .replace(/\*/g, '[^\\.]+')
            .replace(/\#/g, '([^\\.]+\\.?)*')
        return new RegExp(`^${routeWildcard}$`)
    }
}
