import { mock, instance, verify, when, anything } from 'ts-mockito'

import { IConfigurationProvider, Types as ConT, decorators as d, constants } from '@micro-fleet/common'

import { Types as ComT, IMediateRpcHandler, MediateRpcHandlerAddOnBase } from '../app'
import * as h from './shared/helper'

const {
    Service: S,
} = constants

const {
    SERVICE_SLUG,
} = h.constants

@d.injectable()
class CustomAddOn extends MediateRpcHandlerAddOnBase {

    public readonly name: string = 'CustomAddOn'

    constructor(
        @d.inject(ConT.CONFIG_PROVIDER) configProvider: IConfigurationProvider,
        @d.inject(ComT.MEDIATE_RPC_HANDLER) rpcHandler: IMediateRpcHandler
    ) {
        super(configProvider, rpcHandler)
    }

    /**
     * @see IServiceAddOn.init
     */
    public init(): Promise<void> {
        return super.init()
    }

    /**
     * @see IServiceAddOn.deadLetter
     */
    public deadLetter(): Promise<void> {
        return super.deadLetter()
    }

    /**
     * @see IServiceAddOn.dispose
     */
    public dispose(): Promise<void> {
        return super.dispose()
    }

    /**
     * @override
     */
    protected handleRequests(): Promise<void> {
        return Promise.resolve()
    }
}

let config: IConfigurationProvider

describe('MediateRpcHandlerAddOnBase', () => {

    before(() => {
        config = h.mockConfigProvider({
            [S.SERVICE_SLUG]: SERVICE_SLUG,
        })
    })

    describe('init', () => {
        it('Should init RPC handler', async () => {
            // Arrange
            const MockMediateRpcHandler = mock<IMediateRpcHandler>()
            const handler = instance(MockMediateRpcHandler)

            const addon = new CustomAddOn(config, handler)

            // Act
            await addon.init()

            // Assert
            verify(MockMediateRpcHandler.init(anything())).once()
            verify(MockMediateRpcHandler.start()).once()
        })
    }) // END describe 'init'

    describe('deadLetter', () => {
        it('should call RPC handler.dispose', async () => {
            // Arrange
            const MockMediateRpcHandler = mock<IMediateRpcHandler>()
            when(MockMediateRpcHandler.pause()).thenResolve()
            const handler = instance(MockMediateRpcHandler)

            const addon = new CustomAddOn(config, handler)

            // Act
            await addon.deadLetter()

            // Assert
            verify(MockMediateRpcHandler.pause()).once()
        })
    }) // END describe 'deadLetter'
})
