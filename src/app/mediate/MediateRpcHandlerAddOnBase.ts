import { IConfigurationProvider, constants, injectable, unmanaged,
    Guard } from '@micro-fleet/common'

import { IMediateRpcHandler } from './MediateRpcHandler'

const { SvcSettingKeys: S } = constants

/**
 * Base class for MediateRpcAddOn.
 */
@injectable()
export abstract class MediateRpcHandlerAddOnBase implements IServiceAddOn {

    public abstract name: string

    constructor(
        @unmanaged() protected _configProvider: IConfigurationProvider,
        @unmanaged() protected _rpcHandler: IMediateRpcHandler
    ) {
        Guard.assertArgDefined('_configProvider', _configProvider)
        Guard.assertArgDefined('_rpcHandler', _rpcHandler)
    }


    /**
     * @see IServiceAddOn.init
     */
    public async init(): Promise<void> {
        this._rpcHandler.name = this._configProvider.get(S.SERVICE_SLUG).value as string
        await this._rpcHandler.init()
        await this.handleRequests()
        await this._rpcHandler.start()
    }

    /**
     * @see IServiceAddOn.deadLetter
     */
    public deadLetter(): Promise<void> {
        return Promise.resolve()
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


    protected abstract handleRequests(): Promise<any>
}
