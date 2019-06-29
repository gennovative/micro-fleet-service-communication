import * as path from 'path'

import * as chai from 'chai'
import * as spies from 'chai-spies'
chai.use(spies)
const expect = chai.expect

import { IConfigurationProvider, constants, Maybe,
    DependencyContainer, serviceContext, Types as CmT, InternalErrorException,
    } from '@micro-fleet/common'

import { IDirectRpcHandler, IDirectRpcCaller, ExpressRpcHandler, HttpRpcCaller,
    DefaultDirectRpcHandlerAddOn, RpcResponse,
    } from '../../app'

import * as rc from '../shared/responding-controller'


const { RpcSettingKeys: RpcS, SvcSettingKeys: SvcS } = constants

const SERVICE_SLUG = 'test-service',
    HANDLER_PORT = 30000,
    HANDLER_ADDR = `localhost:${HANDLER_PORT}`,
    CALLER_NAME = 'caller'

class MockConfigProvider implements IConfigurationProvider {

    public readonly name: string = 'MockConfigProvider'

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



let depContainer: DependencyContainer,
    handler: IDirectRpcHandler,
    caller: IDirectRpcCaller,
    addon: DefaultDirectRpcHandlerAddOn


describe('@resolveFn()', function() {
    this.timeout(5000)
    // this.timeout(60000) // For debugging

    beforeEach(() => {
        depContainer = new DependencyContainer()
        serviceContext.setDependencyContainer(depContainer)
        depContainer.bindConstant(CmT.DEPENDENCY_CONTAINER, depContainer)

        caller = new HttpRpcCaller()
        caller.name = CALLER_NAME
        caller.baseAddress = HANDLER_ADDR

        handler = new ExpressRpcHandler()
        addon = new DefaultDirectRpcHandlerAddOn(
            new MockConfigProvider(),
            depContainer,
            handler
        )
        addon.controllerPath = path.join(process.cwd(), 'dist', 'test', 'shared', 'responding-controller')
    })

    afterEach(async () => {
        await addon.dispose()
        await caller.dispose()
        depContainer.dispose()
    })

    describe('Auto', function() {
        it('Should respond with sync value if @resolveFn is not present', async () => {
            // Arrange
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call(rc.MODULE_NAME, rc.ACT_AUTO_SYNC)

                // Assert
                expect(res).to.exist
                const controller = depContainer.resolve<rc.RespondingController>(rc.RespondingController.name)
                expect(controller.spyFn).to.be.called.once
                expect(res.isSuccess).to.be.true
                expect(res.payload).to.equal(rc.RES_AUTO_SYNC)
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }
        })

        it('Should respond with async value if @resolveFn is not present', async () => {
            // Arrange
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call(rc.MODULE_NAME, rc.ACT_AUTO_ASYNC)

                // Assert
                expect(res).to.exist
                const controller = depContainer.resolve<rc.RespondingController>(rc.RespondingController.name)
                expect(controller.spyFn).to.be.called.once
                expect(res.isSuccess).to.be.true
                expect(res.payload).to.deep.equal(rc.RES_AUTO_ASYNC)
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }
        })

        it('Should throw sync error despite @resolveFn presence', async () => {
            // Arrange
            let handerError
            addon.onError((err) => {
                handerError = err
            })
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call(rc.MODULE_NAME, rc.ACT_AUTO_SYNC_ERROR)

                // Assert
                expect(res).not.to.exist
            }
            catch (err) {
                expect(err).to.exist
                expect(err).to.be.instanceOf(InternalErrorException)
                expect(handerError).to.equal(rc.RES_AUTO_SYNC_ERROR)
                const controller = depContainer.resolve<rc.RespondingController>(rc.RespondingController.name)
                expect(controller.spyFn).to.be.called.once
            }
        })

        it('Should throw async error despite @resolveFn presence', async () => {
            // Arrange
            let handerError
            addon.onError((err) => {
                handerError = err
            })
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call(rc.MODULE_NAME, rc.ACT_AUTO_ASYNC_ERROR)

                // Assert
                expect(res).not.to.exist
            }
            catch (err) {
                expect(err).to.exist
                expect(err).to.be.instanceOf(InternalErrorException)
                expect(handerError).to.equal(rc.RES_AUTO_ASYNC_ERROR)
                const controller = depContainer.resolve<rc.RespondingController>(rc.RespondingController.name)
                expect(controller.spyFn).to.be.called.once
            }
        })
    })

    describe('Manual', function() {
        it('Should respond with sync value with injected @resolveFn', async () => {
            // Arrange
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call(rc.MODULE_NAME, rc.ACT_MANUAL_SYNC)

                // Assert
                expect(res).to.exist
                const controller = depContainer.resolve<rc.RespondingController>(rc.RespondingController.name)
                expect(controller.spyFn).to.be.called.once
                expect(res.isSuccess).to.be.true
                expect(res.payload).to.deep.equal(rc.RES_MANUAL_SYNC)
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }
        })

        it('Should respond with async value with injected @resolveFn', async () => {
            // Arrange
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call(rc.MODULE_NAME, rc.ACT_MANUAL_ASYNC)

                // Assert
                expect(res).to.exist
                const controller = depContainer.resolve<rc.RespondingController>(rc.RespondingController.name)
                expect(controller.spyFn).to.be.called.once
                expect(res.isSuccess).to.be.true
                expect(res.payload).to.deep.equal(rc.RES_MANUAL_ASYNC)
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }
        })

        it('Should throw sync error despite @resolveFn presence', async () => {
            // Arrange
            let handerError
            addon.onError((err) => {
                handerError = err
            })
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call(rc.MODULE_NAME, rc.ACT_MANUAL_SYNC_ERROR)

                // Assert
                expect(res).not.to.exist
            }
            catch (err) {
                expect(err).to.exist
                expect(err).to.be.instanceOf(InternalErrorException)
                expect(handerError).to.equal(rc.RES_MANUAL_SYNC_ERROR)
                const controller = depContainer.resolve<rc.RespondingController>(rc.RespondingController.name)
                expect(controller.spyFn).to.be.called.once
            }
        })

        it('Should throw async error despite @resolveFn presence', async () => {
            // Arrange
            let handerError
            addon.onError((err) => {
                handerError = err
            })
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call(rc.MODULE_NAME, rc.ACT_MANUAL_ASYNC_ERROR)

                // Assert
                expect(res).not.to.exist
            }
            catch (err) {
                expect(err).to.exist
                expect(err).to.be.instanceOf(InternalErrorException)
                expect(handerError).to.equal(rc.RES_MANUAL_ASYNC_ERROR)
                const controller = depContainer.resolve<rc.RespondingController>(rc.RespondingController.name)
                expect(controller.spyFn).to.be.called.once
            }
        })
    })


}) // describe '@resolveFn()'
