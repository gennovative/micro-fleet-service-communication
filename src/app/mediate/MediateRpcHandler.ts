/// <reference types="debug" />
const debug: debug.IDebugger = require('debug')('mcft:svccom:MessageBrokerRpcHandler')

import { Guard, ValidationError, decorators as d } from '@micro-fleet/common'

import { Types as T } from '../constants/Types'
import { IMessageBrokerConnector, BrokerMessage } from '../MessageBrokerConnector'
import * as rpc from '../RpcCommon'


export interface IMediateRpcHandler extends rpc.IRpcHandler {
}

@d.injectable()
export class MessageBrokerRpcHandler
    extends rpc.RpcHandlerBase
    implements IMediateRpcHandler {

    private _handlers: Map<string, rpc.RpcHandlerFunction>

    constructor(
        @d.inject(T.MSG_BROKER_CONNECTOR) private _msgBrokerConn: IMessageBrokerConnector
    ) {
        super()
        Guard.assertArgDefined('_msgBrokerConn', _msgBrokerConn)
    }


    /**
     * @see IRpcHandler.init
     */
    public init(): Promise<void> {
        this._handlers = new Map<string, rpc.RpcHandlerFunction>()
        this._msgBrokerConn.onError(err => this._emitError(err))
        return Promise.resolve()
    }

    /**
     * @see IRpcHandler.start
     */
    public start(): Promise<void> {
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
        Guard.assertIsDefined(this.name, '`name` property is required.')
        const dest = Boolean(rawDest)
            ? rawDest
            : `request.${moduleName}.${actionName}`
        if (this._handlers.has(dest)) {
            debug(`MediateRpcHandler Warning: Override existing subscription key ${dest}`)
        }
        this._handlers.set(dest, handler)
        return this._msgBrokerConn.subscribe(dest)
    }


    private onMessage(msg: BrokerMessage, ack: Function, nack: Function): void {
        const routingKey: string = msg.raw.fields.routingKey
        if (!this._handlers.has(routingKey)) {
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
                const actionFn = this._handlers.get(routingKey)
                // Execute controller's action
                await actionFn({
                    payload: request.payload,
                    resolve,
                    reject: wrappedReject(true),
                    rpcRequest: request,
                    rawMessage: msg,
                })
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
            return this._msgBrokerConn.publish(replyTo, this._createResponse(true, result, request.from), { correlationId })
        })
        .catch((error: rpc.HandlerRejection) => {
            // If error from `publish()`
            if (error.isIntended == null) {
                this._emitError(error)
                return Promise.resolve()
            }
            else if (error.isIntended === false) {
                this._emitError(error.reason)
            }

            // If HandlerRejection error, let caller know
            const errObj = this._createError(error)
            return this._msgBrokerConn.publish(
                replyTo,
                this._createResponse(false, errObj, request.from), { correlationId }
            )
        })
        // Catch error thrown by `createError()` or `publish()` in above catch
        .catch(this._emitError.bind(this))
    }

}
