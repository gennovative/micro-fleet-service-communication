import * as chai from 'chai'
import { CriticalException } from '@micro-fleet/common'

import { decorators as d, RpcHandlerParams } from '../../app'

export const MODULE_NAME = 'direct-module'

export const SUCCESS_MESSAGE = 'Gotcha!'

export const FAIL_MESSAGE = 'Hatecha!'

export const FAIL_OBJ = {
    why: FAIL_MESSAGE,
}

export const ACT_DO_IT = 'doIt'
export const ACT_GET_IT = 'getIt'
export const ACT_REFUSE_IT = 'refuseIt'
export const ACT_EXCEPT_IT = 'exceptIt'
export const ACT_OBJ_IT = 'objectifyIt'


@d.directController(MODULE_NAME)
export class DirectNamedController {

    public spyFn: Function

    constructor() {
        this.spyFn = chai.spy()
    }

    @d.action('doIt')
    public doSomething({ payload, resolve, rpcRequest }: RpcHandlerParams): void {
        this.spyFn(payload.id, rpcRequest.from, rpcRequest.to)
        resolve()
    }

    @d.action('getIt')
    public getSomething({ resolve, rpcRequest }: RpcHandlerParams): void {
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
    public refuseIt({ reject, rpcRequest}: RpcHandlerParams): void {
        this.spyFn(rpcRequest.from, rpcRequest.to)
        reject(FAIL_MESSAGE)
    }

    @d.action()
    public exceptIt({ reject, rpcRequest }: RpcHandlerParams): void {
        this.spyFn(rpcRequest.from, rpcRequest.to)
        reject(new CriticalException(FAIL_MESSAGE))
    }

    @d.action()
    public objectifyIt({ reject, rpcRequest}: RpcHandlerParams): void {
        this.spyFn(rpcRequest.from, rpcRequest.to)
        reject(FAIL_OBJ)
    }
}
