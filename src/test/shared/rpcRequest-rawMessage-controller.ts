import { IncomingMessage } from 'http'

import * as chai from 'chai'
import * as express from 'express'

import { decorators as d, RpcRequest, BrokerMessage } from '../../app'


//#region Exports

export const MODULE_NAME = 'rpcRequest-rawMessage'

export const ACT_RPC_REQUEST_DIRECT = 'rpc-request-direct'
export const ACT_RPC_REQUEST_MEDIATE = 'rpc-request-mediate'
export const ACT_RAW_MSG_DIRECT = 'raw-msg-direct'
export const ACT_RAW_MSG_MEDIATE = 'raw-msg-mediate'
export const ACT_RPC_REQUEST_RAW_MSG_DIRECT = 'rpc-request-raw-msg-direct'
export const ACT_RPC_REQUEST_RAW_MSG_MEDIATE = 'rpc-request-raw-msg-mediate'

//#endregion Exports


@d.directController(MODULE_NAME)
@d.mediateController(MODULE_NAME)
export class RawRequestController {

    public spyFn: Function

    constructor() {
        this.spyFn = chai.spy()
    }

    @d.action(ACT_RPC_REQUEST_DIRECT)
    public getRpcRequestDirect(
            @d.rpcRequest() request: RpcRequest,
        ): void {

        this.spyFn(request.from, request.to)
    }

    @d.action(ACT_RPC_REQUEST_MEDIATE)
    public getRpcRequestMediate(
            @d.rpcRequest() request: RpcRequest,
        ): void {

        this.spyFn(request.from, request.to)
    }

    @d.action(ACT_RAW_MSG_DIRECT)
    public getRawMessageDirect(
            @d.rawMessage() message: express.Request,
        ): void {

        // express.Request inherits http.IncomingMessage
        this.spyFn(message instanceof IncomingMessage, message.baseUrl)
    }

    @d.action(ACT_RAW_MSG_MEDIATE)
    public getRawMessageMediate(
            @d.rawMessage() message: BrokerMessage,
        ): void {

        const isBrokerMsg = (
            message.hasOwnProperty('data') &&
            message.hasOwnProperty('properties') &&
            message.hasOwnProperty('raw')
        )
        this.spyFn(isBrokerMsg, message.data['to'])
    }

    @d.action(ACT_RPC_REQUEST_RAW_MSG_DIRECT)
    public getRpcRequestRawMsgDirect(
            @d.rpcRequest() request: RpcRequest,
            @d.rawMessage() message: express.Request,
        ): void {

        this.spyFn(request.from, request.to,
            message instanceof IncomingMessage, message.baseUrl)
    }

    @d.action(ACT_RPC_REQUEST_RAW_MSG_MEDIATE)
    public getRpcRequestRawMsgMediate(
            @d.rpcRequest() request: RpcRequest,
            @d.rawMessage() message: BrokerMessage,
        ): void {

        const isBrokerMsg = (
            message.hasOwnProperty('data') &&
            message.hasOwnProperty('properties') &&
            message.hasOwnProperty('raw')
        )
        this.spyFn(request.from, request.to, isBrokerMsg, message.data['to'])
    }
}
