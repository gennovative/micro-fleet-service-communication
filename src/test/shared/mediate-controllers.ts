import * as chai from 'chai'
import { CriticalException } from '@micro-fleet/common'

import { decorators as d, RpcRequest } from '../../app'


export const MODULE_NAME = 'direct-module'

export const ACT_DO_IT = 'doIt'
export const ACT_GET_IT = 'getIt'
export const ACT_REFUSE_IT = 'refuseIt'
export const ACT_EXCEPT_IT = 'exceptIt'
export const ACT_OBJ_IT = 'objectifyIt'

export const RES_GET_IT = 'Gotcha!'
export const RES_EXCEPT_IT = 'Exceptcha!'
export const RES_REFUSE_IT = 'Hatecha!'
export const RES_OBJ_IT = {
    why: RES_REFUSE_IT,
}



@d.mediateController(MODULE_NAME)
export class MediateNamedController {

    public spyFn: Function

    /**
     * A callback invoked every time method `getSomething` is called.
     */
    public getSomethingCb: (resolve: PromiseResolveFn) => void

    constructor() {
        this.spyFn = chai.spy()
    }

    @d.action(ACT_DO_IT)
    public doSomething(
            @d.payload() payload: any,
            @d.resolveFn() resolve: PromiseResolveFn,
            @d.rpcRequest() rpcRequest: RpcRequest,
        ): void {

        this.spyFn(payload.id, rpcRequest.from, rpcRequest.to)
        resolve()
    }

    @d.action(ACT_GET_IT)
    public getSomething(
            @d.resolveFn() resolve: PromiseResolveFn,
            @d.rpcRequest() rpcRequest: RpcRequest,
        ): void {

        this.spyFn(rpcRequest.from, rpcRequest.to)
        Boolean(this.getSomethingCb) ? this.getSomethingCb(resolve) : resolve(RES_GET_IT)
    }
}

@d.mediateController()
export class MediateAutoController {
    public spyFn: Function

    constructor() {
        this.spyFn = chai.spy()
    }

    @d.action()
    public refuseIt(
            @d.rejectFn() reject: PromiseRejectFn,
            @d.rpcRequest() rpcRequest: RpcRequest,
        ): void {

        this.spyFn(rpcRequest.from, rpcRequest.to)
        reject(RES_REFUSE_IT)
    }

    @d.action()
    public exceptIt(
            @d.rejectFn() reject: PromiseRejectFn,
            @d.rpcRequest() rpcRequest: RpcRequest,
        ): void {

        this.spyFn(rpcRequest.from, rpcRequest.to)
        reject(new CriticalException(RES_EXCEPT_IT))
    }

    @d.action()
    public objectifyIt(
            @d.rejectFn() reject: PromiseRejectFn,
            @d.rpcRequest() rpcRequest: RpcRequest,
        ): void {

        this.spyFn(rpcRequest.from, rpcRequest.to)
        reject(RES_OBJ_IT)
    }
}
