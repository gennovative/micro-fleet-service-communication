import * as chai from 'chai'
import { MinorException } from '@micro-fleet/common'

import { decorators as d } from '../../app'


//#region Exports

export const MODULE_NAME = 'resolve-reject'

export const ACT_AUTO_SYNC = 'auto-sync'
export const ACT_AUTO_SYNC_ERROR = 'auto-sync-error'
export const ACT_AUTO_ASYNC = 'auto-async'
export const ACT_AUTO_ASYNC_ERROR = 'auto-async-error'

export const ACT_MANUAL_SYNC = 'manual-sync'
export const ACT_MANUAL_SYNC_ERROR = 'manual-sync-error'
export const ACT_MANUAL_ASYNC = 'manual-async'
export const ACT_MANUAL_ASYNC_ERROR = 'manual-async-error'
export const ACT_MANUAL_SYNC_REJECT = 'manual-sync-reject'
export const ACT_MANUAL_ASYNC_REJECT = 'manual-async-reject'


export const RES_AUTO_SYNC = 'ResolveRejectController.getAutoSync'
export const RES_AUTO_ASYNC = {
    info: 'ResolveRejectController.getAutoAsync',
}
export const RES_AUTO_SYNC_ERROR = 1234567890
export const RES_AUTO_ASYNC_ERROR = {
    reason: 'ResolveRejectController.getAutoFailAsync',
}
export const RES_MANUAL_SYNC = 'ResolveRejectController.getManualSync'
export const RES_MANUAL_ASYNC = {
    info: 'ResolveRejectController.getManualAsync',
}
export const RES_MANUAL_SYNC_ERROR = new MinorException('Just a small exception')
export const RES_MANUAL_ASYNC_ERROR = {
    reason: 'ResolveRejectController.getManualFailAsync',
}
export const RES_MANUAL_SYNC_REJECT = new MinorException('Intended exception')
export const RES_MANUAL_ASYNC_REJECT = {
    reason: 'ResolveRejectController.getManualRejectAsync',
}

//#endregion Exports


@d.directController(MODULE_NAME)
@d.mediateController(MODULE_NAME)
export class ResolveRejectController {

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
    public getManualSync(@d.resolveFn() resolve: Function): void {
        this.spyFn()
        resolve(RES_MANUAL_SYNC)
    }

    @d.action(ACT_MANUAL_ASYNC)
    public getManualAsync(@d.resolveFn() resolve: Function): void {
        this.spyFn()
        setTimeout(() => {
            resolve(RES_MANUAL_ASYNC)
        }, 100)
    }

    @d.action(ACT_MANUAL_SYNC_ERROR)
    public getManualFailSync(
            @d.resolveFn() resolve: Function,
            @d.rejectFn() reject: Function,
        ): void {

        this.spyFn()
        throw RES_MANUAL_SYNC_ERROR
    }

    @d.action(ACT_MANUAL_ASYNC_ERROR)
    public async getManualFailAsync(
            @d.resolveFn() resolveFn: Function,
            @d.rejectFn() rejectFn: Function,
        ): Promise<void> {

        this.spyFn()
        await new Promise((_, reject) => {
            setTimeout(() => {
                reject(RES_MANUAL_ASYNC_ERROR)
            }, 100)
        })
    }

    @d.action(ACT_MANUAL_SYNC_REJECT)
    public getManualRejectSync(@d.rejectFn() reject: Function): void {
        this.spyFn()
        reject(RES_MANUAL_SYNC_REJECT)
    }

    @d.action(ACT_MANUAL_ASYNC_REJECT)
    public async getManualRejectAsync(@d.rejectFn() reject: Function): Promise<void> {
        this.spyFn()
        await setTimeout(() => {
            reject(RES_MANUAL_ASYNC_REJECT)
        }, 100)
    }
}
