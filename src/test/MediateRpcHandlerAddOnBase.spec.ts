import { mock, instance, verify, when } from 'ts-mockito'

import { IConfigurationProvider, Types as ConT,
    decorators as d } from '@micro-fleet/common'

import { Types as ComT, IMediateRpcHandler, MediateRpcHandlerAddOnBase } from '../app'


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


describe('MediateRpcHandlerAddOnBase', () => {

    describe('init', () => {
        it('Should init RPC handler', async () => {
            // Arrange
            const MockConfigProviderClass = mock<IConfigurationProvider>()
            const config = instance(MockConfigProviderClass)

            const MockMediateRpcHandler = mock<IMediateRpcHandler>()
            const handler = instance(MockMediateRpcHandler)

            const addon = new CustomAddOn(config, handler)

            // Act
            await addon.init()

            // Assert
            verify(MockMediateRpcHandler.init()).once()
            verify(MockMediateRpcHandler.start()).once()
        })
    }) // END describe 'init'

    describe('deadLetter', () => {
        it('should call RPC handler.dispose', async () => {
            // Arrange
            const MockConfigProviderClass = mock<IConfigurationProvider>()
            const config = instance(MockConfigProviderClass)

            const MockMediateRpcHandler = mock<IMediateRpcHandler>()
            when(MockMediateRpcHandler.pause()).thenResolve()
            when(MockMediateRpcHandler.dispose()).thenResolve()
            const handler = instance(MockMediateRpcHandler)

            const addon = new CustomAddOn(config, handler)

            // Act
            await addon.deadLetter()

            // Assert
            verify(MockMediateRpcHandler.pause()).once()
            verify(MockMediateRpcHandler.dispose()).once()
        })
    }) // END describe 'deadLetter'
})
