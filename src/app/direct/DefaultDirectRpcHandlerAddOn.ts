/// <reference types="reflect-metadata" />

import { IConfigurationProvider, inject, injectable,
    IDependencyContainer, Guard, Types as cT } from '@micro-fleet/common'

import { IDirectRpcHandler } from './DirectRpcHandler'
import { DirectRpcHandlerAddOnBase } from './DirectRpcHandlerAddOnBase'
import { ControllerCreationStrategy } from '../constants/controller'
import { Types as T } from '../constants/Types'
import { MetaData } from '../constants/MetaData'
import { ControllerHunter } from '../ControllerHunter'


/**
 * Automatically registers classes decorated with `@directController()`
 */
@injectable()
export class DefaultDirectRpcHandlerAddOn
    extends DirectRpcHandlerAddOnBase {

    public name: string = 'DefaultDirectRpcHandlerAddOn'


    private _controllerHunter: ControllerHunter


    constructor(
        @inject(cT.CONFIG_PROVIDER) configProvider: IConfigurationProvider,
        @inject(cT.DEPENDENCY_CONTAINER) protected _depContainer: IDependencyContainer,
        @inject(T.DIRECT_RPC_HANDLER) rpcHandler: IDirectRpcHandler
    ) {
        super(configProvider, rpcHandler)
        Guard.assertArgDefined('_depContainer', _depContainer)

        this._controllerHunter = new ControllerHunter(
            _depContainer,
            rpcHandler,
            MetaData.CONTROLLER_DIRECT,
            ControllerCreationStrategy.SINGLETON
        )
    }


    /**
     * Gets or sets strategy when creating controller instance.
     */
    public get controllerCreation(): ControllerCreationStrategy {
        return this._controllerHunter.controllerCreation
    }

    public set controllerCreation(val: ControllerCreationStrategy) {
        this._controllerHunter.controllerCreation = val
    }

    /**
     * Gets or sets path to folder containing controller classes.
     */
    public get controllerPath(): string {
        return this._controllerHunter.controllerPath
    }

    public set controllerPath(val: string) {
        this._controllerHunter.controllerPath = val
    }


    /**
     * @see IServiceAddOn.deadLetter
     */
    public deadLetter(): Promise<void> {
        this._rpcHandler.pause()
        return Promise.resolve()
    }

    /**
     * @override
     */
    protected async handleRequests(): Promise<any> {
        await this._controllerHunter.hunt()
    }


    /**
     * Registers a listener to handle errors.
     */
    public onError(handler: (err: any) => void): void {
        this._rpcHandler.onError(handler)
    }
}
