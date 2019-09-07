import * as path from 'path'

import * as chai from 'chai'
import * as spies from 'chai-spies'
chai.use(spies)
const expect = chai.expect

import { IConfigurationProvider, constants, Maybe,
    DependencyContainer, serviceContext, Types as CmT, InternalErrorException,
    } from '@micro-fleet/common'

import { IMediateRpcHandler, IMediateRpcCaller, MessageBrokerRpcCaller,
    TopicMessageBrokerConnector, MessageBrokerRpcHandler, DefaultMediateRpcHandlerAddOn,
    RpcResponse,
    } from '../../app'
import * as rc from '../shared/resolve-reject-controller'
import rabbitOpts from '../rabbit-options'


const { Service: S } = constants

const SERVICE_SLUG = 'test-service',
    CALLER_NAME = 'caller'

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
            case S.SERVICE_SLUG: return Maybe.Just(SERVICE_SLUG)
            default: return Maybe.Nothing()
        }
    }

    public async fetch(): Promise<boolean> {
        return Promise.resolve(true)
    }
}


let depContainer: DependencyContainer,
    handlerMbConn: TopicMessageBrokerConnector,
    callerMbConn: TopicMessageBrokerConnector,
    handler: IMediateRpcHandler,
    caller: IMediateRpcCaller,
    addon: DefaultMediateRpcHandlerAddOn


describe('@resolveFn() - mediate', function() {
    this.timeout(5000)
    // this.timeout(60000) // For debugging

    beforeEach(() => {
        depContainer = new DependencyContainer()
        serviceContext.setDependencyContainer(depContainer)
        depContainer.bindConstant(CmT.DEPENDENCY_CONTAINER, depContainer)

        callerMbConn = new TopicMessageBrokerConnector()
        handlerMbConn = new TopicMessageBrokerConnector()

        caller = new MessageBrokerRpcCaller(callerMbConn)
        caller.name = CALLER_NAME

        handler = new MessageBrokerRpcHandler(handlerMbConn)
        addon = new DefaultMediateRpcHandlerAddOn(
            new MockConfigProvider(),
            depContainer,
            handler
        )
        addon.controllerPath = path.join(
            process.cwd(),
            'dist', 'test', 'shared', 'resolve-reject-controller'
        )
        return Promise.all([
            callerMbConn.connect(rabbitOpts.caller),
            handlerMbConn.connect(rabbitOpts.handler),
        ])
    })

    afterEach(async () => {
        await handlerMbConn.stopListen()
        await handlerMbConn.deleteQueue()

        await caller.dispose()
        await addon.dispose() // Addon also disposes underlying RPC handler

        // Connection must be disconnect separately
        // Upper layers don't dispose connection when they are disposed.
        await Promise.all([
            handlerMbConn.disconnect(),
            callerMbConn.disconnect(),
        ])
        depContainer.dispose()
    })

    describe('Auto', function() {
        it('Should respond with sync value if @resolveFn is not present', async () => {
            // Arrange
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_AUTO_SYNC,
                })

                // Assert
                expect(res).to.exist
                const controller = depContainer.resolve<rc.ResolveRejectController>(rc.ResolveRejectController.name)
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
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_AUTO_ASYNC,
                })

                // Assert
                expect(res).to.exist
                const controller = depContainer.resolve<rc.ResolveRejectController>(rc.ResolveRejectController.name)
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
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_AUTO_SYNC_ERROR,
                })

                // Assert
                expect(res).not.to.exist
            }
            catch (err) {
                expect(err).to.exist
                expect(err).to.be.instanceOf(InternalErrorException)
                expect(handerError).to.equal(rc.RES_AUTO_SYNC_ERROR)
                const controller = depContainer.resolve<rc.ResolveRejectController>(rc.ResolveRejectController.name)
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
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_AUTO_ASYNC_ERROR,
                })

                // Assert
                expect(res).not.to.exist
            }
            catch (err) {
                expect(err).to.exist
                expect(err).to.be.instanceOf(InternalErrorException)
                expect(handerError).to.equal(rc.RES_AUTO_ASYNC_ERROR)
                const controller = depContainer.resolve<rc.ResolveRejectController>(rc.ResolveRejectController.name)
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
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_MANUAL_SYNC,
                })

                // Assert
                expect(res).to.exist
                const controller = depContainer.resolve<rc.ResolveRejectController>(rc.ResolveRejectController.name)
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
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_MANUAL_ASYNC,
                })

                // Assert
                expect(res).to.exist
                const controller = depContainer.resolve<rc.ResolveRejectController>(rc.ResolveRejectController.name)
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
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_MANUAL_SYNC_ERROR,
                })

                // Assert
                expect(res).not.to.exist
            }
            catch (err) {
                expect(err).to.exist
                expect(err).to.be.instanceOf(InternalErrorException)
                expect(handerError).to.equal(rc.RES_MANUAL_SYNC_ERROR)
                const controller = depContainer.resolve<rc.ResolveRejectController>(rc.ResolveRejectController.name)
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
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_MANUAL_ASYNC_ERROR,
                })

                // Assert
                expect(res).not.to.exist
            }
            catch (err) {
                expect(err).to.exist
                expect(err).to.be.instanceOf(InternalErrorException)
                expect(handerError).to.equal(rc.RES_MANUAL_ASYNC_ERROR)
                const controller = depContainer.resolve<rc.ResolveRejectController>(rc.ResolveRejectController.name)
                expect(controller.spyFn).to.be.called.once
            }
        })
    })


}) // describe '@resolveFn()'
