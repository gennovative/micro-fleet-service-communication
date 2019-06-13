import * as chai from 'chai'
import { CriticalException } from '@micro-fleet/common'

import { decorators as d, RpcRequest } from '../../app'

export const MODULE_NAME = 'direct-module'

export const SUCCESS_MESSAGE = 'Gotcha!'

export const FAIL_MESSAGE = 'Hatecha!'

export const ACT_DO_IT = 'doIt'
export const ACT_GET_IT = 'getIt'
export const ACT_REFUSE_IT = 'refuseIt'
export const ACT_EXCEPT_IT = 'exceptIt'


@d.directController(MODULE_NAME)
export class DirectNamedController {

    public spyFn: Function

    constructor() {
        this.spyFn = chai.spy()
    }

    @d.action('doIt')
    public doSomething(payload: any, resolve: PromiseResolveFn,
            reject: PromiseRejectFn, rpcRequest: RpcRequest, rawMessage: any): void {
        this.spyFn(payload.id, rpcRequest.from, rpcRequest.to)
        resolve()
    }

    @d.action('getIt')
    public getSomething(payload: any, resolve: PromiseResolveFn,
            reject: PromiseRejectFn, rpcRequest: RpcRequest, rawMessage: any): void {
        this.spyFn(rpcRequest.from, rpcRequest.to)
        resolve(SUCCESS_MESSAGE)
    }
}

@d.directController()
export class DirectAutoController {
    public spyFn: Function

    constructor() {
        this.spyFn = chai.spy()
    }

    @d.action()
    public refuseIt(payload: any, resolve: PromiseResolveFn,
            reject: PromiseRejectFn, rpcRequest: RpcRequest, rawMessage: any): void {
        this.spyFn(rpcRequest.from, rpcRequest.to)
        reject(FAIL_MESSAGE)
    }

    @d.action()
    public exceptIt(payload: any, resolve: PromiseResolveFn,
            reject: PromiseRejectFn, rpcRequest: RpcRequest, rawMessage: any): void {
        this.spyFn(rpcRequest.from, rpcRequest.to)
        reject(new CriticalException(FAIL_MESSAGE))
    }
}
