import * as chai from 'chai'

import { decorators as d } from '../../app'
import { MinorException } from '@micro-fleet/common'


//#region Exports

export const MODULE_NAME = 'respond'

export const ACT_AUTO_SYNC = 'auto-sync'
export const ACT_AUTO_SYNC_ERROR = 'auto-sync-error'
export const ACT_AUTO_ASYNC = 'auto-async'
export const ACT_AUTO_ASYNC_ERROR = 'auto-async-error'

export const ACT_MANUAL_SYNC = 'manual-sync'
export const ACT_MANUAL_SYNC_ERROR = 'manual-sync-error'
export const ACT_MANUAL_ASYNC = 'manual-async'
export const ACT_MANUAL_ASYNC_ERROR = 'manual-async-error'

export const RES_AUTO_SYNC = 'RespondingController.getAutoSync'
export const RES_AUTO_ASYNC = {
    info: 'RespondingController.getAutoAsync',
}
export const RES_AUTO_SYNC_ERROR = 1234567890
export const RES_AUTO_ASYNC_ERROR = {
    reason: 'RespondingController.getAutoFailAsync',
}
export const RES_MANUAL_SYNC = 'RespondingController.getManualSync'
export const RES_MANUAL_ASYNC = {
    info: 'RespondingController.getManualAsync',
}
export const RES_MANUAL_SYNC_ERROR = new MinorException('Just a small exception')
export const RES_MANUAL_ASYNC_ERROR = {
    reason: 'RespondingController.getManualFailAsync',
}

//#endregion Exports


@d.directController(MODULE_NAME)
@d.mediateController(MODULE_NAME)
export class RespondingController {

    public spyFn: Function

    constructor() {
        this.spyFn = chai.spy()
    }

    @d.action(ACT_AUTO_SYNC)
    public getAutoSync(): string {
        this.spyFn()
        return RES_AUTO_SYNC
    }

    @d.action(ACT_AUTO_ASYNC)
    public getAutoAsync(): Promise<any> {
        this.spyFn()
        return Promise.resolve(RES_AUTO_ASYNC)
    }

    @d.action(ACT_AUTO_SYNC_ERROR)
    public getAutoFailSync(): string {
        this.spyFn()
        throw RES_AUTO_SYNC_ERROR
    }

    @d.action(ACT_AUTO_ASYNC_ERROR)
    public getAutoFailAsync(): Promise<any> {
        this.spyFn()
        return Promise.reject(RES_AUTO_ASYNC_ERROR)
    }


    @d.action(ACT_MANUAL_SYNC)
    public getManualSync(@d.resolveFn() resolve: PromiseResolveFn): void {
        this.spyFn()
        resolve(RES_MANUAL_SYNC)
    }

    @d.action(ACT_MANUAL_ASYNC)
    public getManualAsync(@d.resolveFn() resolve: PromiseResolveFn): void {
        this.spyFn()
        setTimeout(() => {
            resolve(RES_MANUAL_ASYNC)
        }, 100)
    }

    @d.action(ACT_MANUAL_SYNC_ERROR)
    public getManualFailSync(@d.resolveFn() resolve: PromiseResolveFn): void {
        this.spyFn()
        throw RES_MANUAL_SYNC_ERROR
    }

    @d.action(ACT_MANUAL_ASYNC_ERROR)
    public async getManualFailAsync(@d.resolveFn() resolve: PromiseResolveFn): Promise<void> {
        this.spyFn()
        await new Promise((_, reject) => {
            setTimeout(() => {
                reject(RES_MANUAL_ASYNC_ERROR)
            }, 100)
        })
    }
}
