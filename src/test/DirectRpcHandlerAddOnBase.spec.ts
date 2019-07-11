import * as chai from 'chai'
import * as spies from 'chai-spies'

import { IConfigurationProvider, Types as ConT, constants, Maybe,
    injectable, inject /*DependencyContainer*/ } from '@micro-fleet/common'
import { IDirectRpcHandler, ExpressRpcHandler,
    DirectRpcHandlerAddOnBase, Types as ComT } from '../app'

chai.use(spies)
const expect = chai.expect
const { RpcSettingKeys: RpcS, SvcSettingKeys: SvcS } = constants

const SERVICE_SLUG = 'test-service',
    HANDLER_PORT = 30000

class MockConfigProvider implements IConfigurationProvider {

    public readonly name: string = 'MockConfigProvider'
    public configFilePath: string

    get enableRemote(): boolean {
        return true
    }

    public init(): Promise<void> {
        return Promise.resolve()
    }

    public deadLetter(): Promise<void> {
        return Promise.resolve()
    }

    public dispose(): Promise<void> {
        return Promise.resolve()
    }

    public onUpdate(listener: (changedKeys: string[]) => void) {
        // Empty
    }

    public get(key: string): Maybe<number | boolean | string> {
        switch (key) {
            case RpcS.RPC_HANDLER_PORT: return Maybe.Just(HANDLER_PORT)
            case SvcS.SERVICE_SLUG: return Maybe.Just(SERVICE_SLUG)
            default: return Maybe.Nothing()
        }
    }

    public async fetch(): Promise<boolean> {
        return Promise.resolve(true)
    }
}


@injectable()
class CustomAddOn extends DirectRpcHandlerAddOnBase {

    public readonly name: string = 'CustomAddOn'

    constructor(
        @inject(ConT.CONFIG_PROVIDER) configProvider: IConfigurationProvider,
        @inject(ComT.DIRECT_RPC_HANDLER) rpcHandler: IDirectRpcHandler
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
        // depContainer = new DependencyContainer();
        handler = new ExpressRpcHandler()
        addon = new CustomAddOn(new MockConfigProvider(), handler)
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
