import * as path from 'path'

import * as chai from 'chai'
import * as spies from 'chai-spies'
chai.use(spies)
const expect = chai.expect

import { IConfigurationProvider, constants, DependencyContainer,
    serviceContext, Types as CmT,
} from '@micro-fleet/common'

import { RpcResponse,
    IDirectRpcHandler, ExpressRpcHandler,
    IDirectRpcCaller, HttpRpcCaller,
    DefaultDirectRpcHandlerAddOn, DefaultMediateRpcHandlerAddOn,
    IMediateRpcHandler, IMediateRpcCaller, IMessageBrokerConnector,
} from '../../app'
import * as rc from '../shared/rpcRequest-rawMessage-controller'
import rabbitOpts from '../rabbit-options'
import { mockConfigProvider, mockMediateRpcCaller, mockMediateRpcHandler } from '../shared/helper'


const { RPC: R, Service: S } = constants

const CONTROLLER_NAME = 'rpcRequest-rawMessage-controller',
    SERVICE_SLUG = 'test-service',
    HANDLER_PORT = 30e3,
    HANDLER_ADDR = `localhost:${HANDLER_PORT}`,
    CALLER_NAME = 'caller'

let config: IConfigurationProvider

// tslint:disable: no-floating-promises

describe('@rpcRequest()', function() {
    this.timeout(5e3)
    // this.timeout(60e3) // For debugging

    let depContainer: DependencyContainer

    beforeEach(() => {
        depContainer = new DependencyContainer()
        serviceContext.setDependencyContainer(depContainer)
        depContainer.bindConstant(CmT.DEPENDENCY_CONTAINER, depContainer)

        config = mockConfigProvider({
            [S.SERVICE_SLUG]: SERVICE_SLUG,
            [R.RPC_HANDLER_PORT]: HANDLER_PORT,
        })
    })

    afterEach(() => {
        depContainer.dispose()
    })

    describe('Direct', () => {

        let handler: IDirectRpcHandler,
        caller: IDirectRpcCaller,
        addon: DefaultDirectRpcHandlerAddOn

        beforeEach(() => {
            caller = new HttpRpcCaller(config)
            caller.init({
                callerName: CALLER_NAME,
                baseAddress: HANDLER_ADDR,
            })

            handler = new ExpressRpcHandler(config)
            handler.init()
            addon = new DefaultDirectRpcHandlerAddOn(
                config,
                depContainer,
                handler
            )
            addon.controllerPath = path.join(
                process.cwd(),
                'dist', 'test', 'shared', CONTROLLER_NAME,
            )
        })

        afterEach(async () => {
            await addon.dispose()
            await caller.dispose()
        })

        it('Should resolve RPC request with @rpcRequest()', async () => {
            // Arrange
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_RPC_REQUEST_DIRECT,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.true
                const controller = depContainer.resolve<rc.RawRequestController>(rc.RawRequestController.name)
                expect(controller.spyFn).to.be.called.once
                expect(controller.spyFn).to.be.called.with(CALLER_NAME, rc.MODULE_NAME)
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }
        })

        it('Should resolve raw HTTP message with @rawMessage()', async () => {
            // Arrange
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_RAW_MSG_DIRECT,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.true
                const controller = depContainer.resolve<rc.RawRequestController>(rc.RawRequestController.name)
                expect(controller.spyFn).to.be.called.once
                expect(controller.spyFn).to.be.called.with(true, `/${rc.MODULE_NAME}`)
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }
        })

        it('Should resolve both RPC request and raw HTTP message', async () => {
            // Arrange
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_RPC_REQUEST_RAW_MSG_DIRECT,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.true
                const controller = depContainer.resolve<rc.RawRequestController>(rc.RawRequestController.name)
                expect(controller.spyFn).to.be.called.once
                expect(controller.spyFn).to.be.called.with(
                    CALLER_NAME, rc.MODULE_NAME, // RPC request
                    true, `/${rc.MODULE_NAME}`, // Raw HTTP message
                )
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }
        })

    }) // describe 'Direct'

    describe('Mediate', () => {

        let handlerMbConn: IMessageBrokerConnector,
        callerMbConn: IMessageBrokerConnector,
        handler: IMediateRpcHandler,
        caller: IMediateRpcCaller,
        addon: DefaultMediateRpcHandlerAddOn

        beforeEach(async () => {
            [caller, callerMbConn] = await mockMediateRpcCaller(config);
            [handler, handlerMbConn] = await mockMediateRpcHandler(config, false)

            addon = new DefaultMediateRpcHandlerAddOn(
                config,
                depContainer,
                handler
            )
            addon.controllerPath = path.join(
                process.cwd(),
                'dist', 'test', 'shared', CONTROLLER_NAME,
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
        })

        it('Should resolve RPC request with @rpcRequest()', async () => {
            // Arrange
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_RPC_REQUEST_MEDIATE,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.true
                const controller = depContainer.resolve<rc.RawRequestController>(rc.RawRequestController.name)
                expect(controller.spyFn).to.be.called.once
                expect(controller.spyFn).to.be.called.with(CALLER_NAME, rc.MODULE_NAME)
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }
        })

        it('Should resolve raw RabbitMQ message with @rawMessage()', async () => {
            // Arrange
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_RAW_MSG_MEDIATE,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.true
                const controller = depContainer.resolve<rc.RawRequestController>(rc.RawRequestController.name)
                expect(controller.spyFn).to.be.called.once
                expect(controller.spyFn).to.be.called.with(true, rc.MODULE_NAME)
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }
        })

        it('Should resolve both RPC request and raw RabbitMQ message', async () => {
            // Arrange
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_RPC_REQUEST_RAW_MSG_MEDIATE,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.true
                const controller = depContainer.resolve<rc.RawRequestController>(rc.RawRequestController.name)
                expect(controller.spyFn).to.be.called.once
                expect(controller.spyFn).to.be.called.with(
                    CALLER_NAME, rc.MODULE_NAME, // RPC request
                    true, rc.MODULE_NAME, // Raw RabbitMQ message
                )
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }
        })

    }) // describe 'Mediate'


}) // describe '@rpcRequest()'
