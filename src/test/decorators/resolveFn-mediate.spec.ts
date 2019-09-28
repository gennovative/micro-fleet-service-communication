import * as path from 'path'

import * as chai from 'chai'
import * as spies from 'chai-spies'
chai.use(spies)
const expect = chai.expect

import { Types as CmT, constants, DependencyContainer, serviceContext,
    InternalErrorException,
} from '@micro-fleet/common'

import { IMediateRpcHandler, IMediateRpcCaller, DefaultMediateRpcHandlerAddOn,
    RpcResponse, IMessageBrokerConnector,
} from '../../app'
import * as rc from '../shared/resolve-reject-controller'
import rabbitOpts from '../rabbit-options'
import { mockConfigProvider, mockMediateRpcCaller, mockMediateRpcHandler } from '../shared/helper'


const { Service: S } = constants

const SERVICE_SLUG = 'test-service'


let depContainer: DependencyContainer,
    handlerMbConn: IMessageBrokerConnector,
    callerMbConn: IMessageBrokerConnector,
    handler: IMediateRpcHandler,
    caller: IMediateRpcCaller,
    addon: DefaultMediateRpcHandlerAddOn


describe('@resolveFn() - mediate', function() {
    this.timeout(5e3)
    // this.timeout(60e3) // For debugging

    beforeEach(async () => {
        depContainer = new DependencyContainer()
        serviceContext.setDependencyContainer(depContainer)
        depContainer.bindConstant(CmT.DEPENDENCY_CONTAINER, depContainer)

        const config = mockConfigProvider({
            [S.SERVICE_SLUG]: SERVICE_SLUG,
        });
        [caller, callerMbConn] = await mockMediateRpcCaller(config);
        [handler, handlerMbConn] = await mockMediateRpcHandler(config, false)

        addon = new DefaultMediateRpcHandlerAddOn(
            config,
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
