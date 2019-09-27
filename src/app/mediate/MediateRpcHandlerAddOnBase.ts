import { IConfigurationProvider, decorators as d,
    Guard, IServiceAddOn} from '@micro-fleet/common'

import { IMediateRpcHandler } from './MediateRpcHandler'


/**
 * Base class for MediateRpcAddOn.
 */
@d.injectable()
export abstract class MediateRpcHandlerAddOnBase implements IServiceAddOn {

    public abstract name: string

    protected _errorHandler: (err: any) => void

    constructor(
        @d.unmanaged() protected _configProvider: IConfigurationProvider,
        @d.unmanaged() protected _rpcHandler: IMediateRpcHandler
    ) {
        Guard.assertArgDefined('_configProvider', _configProvider)
        Guard.assertArgDefined('_rpcHandler', _rpcHandler)
    }


    /**
     * @see IServiceAddOn.init
     */
    public async init(): Promise<void> {
        await this._rpcHandler.init()
        this._errorHandler && this._rpcHandler.onError(this._errorHandler)
        await this.handleRequests()
        await this._rpcHandler.start()
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
        this._rpcHandler = null
        return Promise.resolve()
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
