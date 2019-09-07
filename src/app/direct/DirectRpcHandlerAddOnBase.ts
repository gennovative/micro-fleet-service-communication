import { IConfigurationProvider, constants, decorators as d,
    Guard, IServiceAddOn } from '@micro-fleet/common'

import { IDirectRpcHandler } from './DirectRpcHandler'

const { RPC: R, Service: S } = constants


/**
 * Base class for DirectRpcAddOn.
 */
@d.injectable()
export abstract class DirectRpcHandlerAddOnBase implements IServiceAddOn {

    public abstract name: string

    protected _errorHandler: (err: any) => void

    constructor(
        @d.unmanaged() protected _configProvider: IConfigurationProvider,
        @d.unmanaged() protected _rpcHandler: IDirectRpcHandler
    ) {
        Guard.assertArgDefined('_configProvider', _configProvider)
        Guard.assertArgDefined('_rpcHandler', _rpcHandler)
    }

    /**
     * @see IServiceAddOn.init
     */
    public init(): Promise<void> {
        this._rpcHandler.name = this._configProvider.get(S.SERVICE_SLUG).value as string
        this._rpcHandler.port = this._configProvider.get(R.RPC_HANDLER_PORT).value as number
        this._errorHandler && this._rpcHandler.onError(this._errorHandler)
        this._rpcHandler.init()
        return this.handleRequests()
            .then(() => this._rpcHandler.start())
    }

    /**
     * @see IServiceAddOn.deadLetter
     */
    public deadLetter(): Promise<void> {
        return this._rpcHandler.pause()
            .then(() => this._rpcHandler.dispose())
    }

    /**
     * @see IServiceAddOn.dispose
     */
    public dispose(): Promise<void> {
        this._configProvider = null
        const handler = this._rpcHandler
        this._rpcHandler = null
        return handler.dispose()
    }

    /**
     * Registers a listener to handle errors.
     */
    public onError(handler: (err: any) => void): this {
        this._errorHandler = handler
        return this
    }

    protected abstract handleRequests(): Promise<any>
}
