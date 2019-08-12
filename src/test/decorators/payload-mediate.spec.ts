import * as path from 'path'

import * as chai from 'chai'
import * as spies from 'chai-spies'
chai.use(spies)
const expect = chai.expect

import { IConfigurationProvider, constants, Maybe,
    DependencyContainer, serviceContext, Types as CmT, ValidationError,
    } from '@micro-fleet/common'

import { IMediateRpcHandler, IMediateRpcCaller, MessageBrokerRpcCaller,
    TopicMessageBrokerConnector, MessageBrokerRpcHandler, DefaultMediateRpcHandlerAddOn,
    RpcResponse,
    } from '../../app'
import * as rc from '../shared/payload-controller'
import { SampleModel } from '../shared/SampleModel'
import rabbitOpts from '../rabbit-options'


const { RpcSettingKeys: RpcS, SvcSettingKeys: SvcS } = constants

const SERVICE_SLUG = 'test-service',
    HANDLER_PORT = 30000,
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
    handlerMbConn: TopicMessageBrokerConnector,
    callerMbConn: TopicMessageBrokerConnector,
    handler: IMediateRpcHandler,
    caller: IMediateRpcCaller,
    addon: DefaultMediateRpcHandlerAddOn

describe('@payload() - mediate', function() {
    // this.timeout(5000)
    this.timeout(60000) // For debugging

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
            'dist', 'test', 'shared', 'payload-controller')
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

    describe('Resolve', function() {
        it('Should resolve the payload with @payload()', async () => {
            // Arrange
            const PAYLOAD = {
                name: 'Resolve me!',
            }
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_RESOLVE,
                    params: PAYLOAD,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.true
                const controller = depContainer.resolve<rc.PayloadController>(rc.PayloadController.name)
                expect(controller.spyFn).to.be.called.once
                expect(controller.spyFn).to.be.called.with(PAYLOAD.name)
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }
        })

        it('Should resolve the payload with @payload() using raw destination', async () => {
            // Arrange
            const PAYLOAD = {
                name: 'Resolve me!',
            }
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    rawDest: rc.ACT_RAW_DEST,
                    params: PAYLOAD,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.true
                const controller = depContainer.resolve<rc.PayloadController>(rc.PayloadController.name)
                expect(controller.spyFn).to.be.called.once
                expect(controller.spyFn).to.be.called.with(PAYLOAD.name)
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }
        })
    }) // describe 'Resolve'

    describe('Translation', function() {

        it('Should convert whole payload to model class', async () => {
            // Arrange
            const PAYLOAD = <SampleModel> {
                name: 'Valid name',
                age: 20,
                position: 'Coolie manager',
            }
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_TRANSLATE_WHOLE,
                    params: PAYLOAD,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.true
                const controller = depContainer.resolve<rc.PayloadController>(rc.PayloadController.name)
                expect(controller.spyFn).to.be.called.once
                expect(controller['spyFn']).to.be.called.with.exactly('SampleModel', PAYLOAD.name,
                    PAYLOAD.age, PAYLOAD.position)
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }
        })

        it('Should convert just some properties of the model class', async () => {
            // Arrange
            const PAYLOAD = <SampleModel> {
                // `name` (required) is skipped but still OK because of partial translation
                age: 20,
                position: 'Valid position',
            }
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_TRANSLATE_PARTIAL,
                    params: PAYLOAD,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.true
                const controller = depContainer.resolve<rc.PayloadController>(rc.PayloadController.name)
                expect(controller.spyFn).to.be.called.once
                expect(controller['spyFn']).to.be.called.with.exactly(
                    'SampleModel',
                    undefined,
                    PAYLOAD.age,
                    PAYLOAD.position,
                )
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }
        })

        it('Should extract payload with custom function then converting to model class', async () => {
            // Arrange
            const PAYLOAD = {
                one: <SampleModel> {
                    name: 'Valid name',
                    age: 20,
                    position: 'Coolie manager',
                },
                two: <SampleModel> {
                    name: 'Another valid name',
                    age: 30,
                    position: 'True coolie',
                },
            }
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_EXTRACT_FUNC,
                    params: PAYLOAD,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.true
                const controller = depContainer.resolve<rc.PayloadController>(rc.PayloadController.name)
                expect(controller.spyFn).to.be.called.once
                expect(controller['spyFn']).to.be.called.with.exactly(
                    'SampleModel', PAYLOAD.one.name, PAYLOAD.one.age, PAYLOAD.one.position,
                    'SampleModel', PAYLOAD.two.name, PAYLOAD.two.age, PAYLOAD.two.position,
                )
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }
        })

        it('Should translate payload with custom function', async () => {
            // Arrange
            const AGE = '31'
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_TRANSLATE_CUSTOM,
                    params: AGE,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.true
                const controller = depContainer.resolve<rc.PayloadController>(rc.PayloadController.name)
                expect(controller.spyFn).to.be.called.once
                expect(controller['spyFn']).to.be.called.with.exactly(
                    'number',
                    Number(AGE),
                    'boolean',
                    Boolean(AGE),
                )
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }
        })

    }) // describe 'Translation'

    describe('Validation', function() {

        it('Should respond with ValidationError', async () => {
            // Arrange
            const PAYLOAD = <SampleModel> {
                name: '',
                age: 18,
            }
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_VALIDATE,
                    params: PAYLOAD,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.false
                expect(res.payload).to.be.instanceOf(ValidationError)
                const vErr = res.payload as ValidationError
                expect(vErr.details.length).to.equal(3)
                const controller = depContainer.resolve<rc.PayloadController>(rc.PayloadController.name)
                expect(controller.spyFn).not.to.be.called
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }
        })
    }) // describe 'Validation'

}) // describe '@payload()'
