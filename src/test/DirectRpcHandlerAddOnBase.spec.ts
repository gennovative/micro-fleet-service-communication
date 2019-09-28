import * as chai from 'chai'
import * as spies from 'chai-spies'

import { decorators as d, Types as ConT, constants, IConfigurationProvider } from '@micro-fleet/common'
import { IDirectRpcHandler, ExpressRpcHandler,
    DirectRpcHandlerAddOnBase, Types as ComT } from '../app'
import { mockConfigProvider } from './shared/helper'


chai.use(spies)
const expect = chai.expect
const { RPC, Service: S } = constants

const SERVICE_SLUG = 'test-service',
    HANDLER_PORT = 30e3


@d.injectable()
class CustomAddOn extends DirectRpcHandlerAddOnBase {

    public readonly name: string = 'CustomAddOn'

    constructor(
        @d.inject(ConT.CONFIG_PROVIDER) configProvider: IConfigurationProvider,
        @d.inject(ComT.DIRECT_RPC_HANDLER) rpcHandler: IDirectRpcHandler
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
    protected handleRequests(): Promise<any> {
        // Eg: this._rpcHandler.handle('add', '');
        return Promise.resolve()
    }
}


// let depContainer: DependencyContainer;
let handler: IDirectRpcHandler,
    addon: CustomAddOn

describe('DirectRpcHandlerAddOnBase', () => {

    beforeEach(() => {
        const config = mockConfigProvider({
            [S.SERVICE_SLUG]: SERVICE_SLUG,
            [RPC.RPC_HANDLER_PORT]: HANDLER_PORT,
        })
        handler = new ExpressRpcHandler()
        addon = new CustomAddOn(config, handler)
    })

    describe('init', () => {
        it('Should set RPC handler name and port', async () => {
            // Act
            await addon.init()

            // Assert
            expect(addon['_rpcHandler'].name).to.equal(SERVICE_SLUG)
            expect(addon['_rpcHandler'].port).to.equal(HANDLER_PORT)

            await addon.dispose()
        })
    }) // END describe 'init'

    describe('dispose', () => {
        it('should call RPC handler.dispose', async () => {
            // Arrange
            const disconnectSpy = chai.spy.on(addon['_rpcHandler'], 'dispose')
            await addon.init()

            // Act
            await addon.dispose()

            // Assert
            expect(disconnectSpy).to.be.spy
            expect(disconnectSpy).to.be.called.once
        })
    }) // END describe 'dispose'
})
