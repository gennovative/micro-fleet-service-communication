import * as path from 'path'

import * as chai from 'chai'
import * as spies from 'chai-spies'
chai.use(spies)
const expect = chai.expect

import { IConfigurationProvider, constants, Maybe, DependencyContainer,
    serviceContext, Types as CmT,
} from '@micro-fleet/common'

import { RpcResponse,
    IDirectRpcHandler, ExpressRpcHandler,
    IDirectRpcCaller, HttpRpcCaller,
    DefaultDirectRpcHandlerAddOn,
    DefaultMediateRpcHandlerAddOn, TopicMessageBrokerConnector,
    IMediateRpcHandler, MessageBrokerRpcHandler,
    IMediateRpcCaller, MessageBrokerRpcCaller,
} from '../../app'
import * as rc from '../shared/rpcRequest-rawMessage-controller'
import rabbitOpts from '../rabbit-options'


const { RpcSettingKeys: RpcS, SvcSettingKeys: SvcS } = constants

const CONTROLLER_NAME = 'rpcRequest-rawMessage-controller',
    SERVICE_SLUG = 'test-service',
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



describe('@rpcRequest()', function() {
    this.timeout(5000)
    // this.timeout(60000) // For debugging

    let depContainer: DependencyContainer

    beforeEach(() => {
        depContainer = new DependencyContainer()
        serviceContext.setDependencyContainer(depContainer)
        depContainer.bindConstant(CmT.DEPENDENCY_CONTAINER, depContainer)
    })

    afterEach(() => {
        depContainer.dispose()
    })

    describe('Direct', () => {

        let handler: IDirectRpcHandler,
        caller: IDirectRpcCaller,
        addon: DefaultDirectRpcHandlerAddOn

        beforeEach(() => {
            caller = new HttpRpcCaller()
            caller.name = CALLER_NAME
            caller.baseAddress = HANDLER_ADDR

            handler = new ExpressRpcHandler()
            addon = new DefaultDirectRpcHandlerAddOn(
                new MockConfigProvider(),
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
                const res: RpcResponse = await caller.call(rc.MODULE_NAME, rc.ACT_RPC_REQUEST_DIRECT)

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
                const res: RpcResponse = await caller.call(rc.MODULE_NAME, rc.ACT_RAW_MSG_DIRECT)

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
                const res: RpcResponse = await caller.call(rc.MODULE_NAME, rc.ACT_RPC_REQUEST_RAW_MSG_DIRECT)

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

        let handlerMbConn: TopicMessageBrokerConnector,
        callerMbConn: TopicMessageBrokerConnector,
        handler: IMediateRpcHandler,
        caller: IMediateRpcCaller,
        addon: DefaultMediateRpcHandlerAddOn

        beforeEach(() => {
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
                const res: RpcResponse = await caller.call(rc.MODULE_NAME, rc.ACT_RPC_REQUEST_MEDIATE)

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
                const res: RpcResponse = await caller.call(rc.MODULE_NAME, rc.ACT_RAW_MSG_MEDIATE)

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
                const res: RpcResponse = await caller.call(rc.MODULE_NAME, rc.ACT_RPC_REQUEST_RAW_MSG_MEDIATE)

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
