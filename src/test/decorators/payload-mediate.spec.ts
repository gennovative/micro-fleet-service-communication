import * as path from 'path'

import * as chai from 'chai'
import * as spies from 'chai-spies'
chai.use(spies)
const expect = chai.expect

import { constants, Types as CmT,
    DependencyContainer, serviceContext, ValidationError,
    } from '@micro-fleet/common'

import { IMediateRpcHandler, IMediateRpcCaller,
    DefaultMediateRpcHandlerAddOn, RpcResponse, IMessageBrokerConnector,
} from '../../app'
import * as rc from '../shared/payload-controller'
import { SampleModel } from '../shared/SampleModel'
import { mockConfigProvider, mockMediateRpcCaller, mockMediateRpcHandler } from '../shared/helper'


const { RPC, Service: S } = constants

const SERVICE_SLUG = 'test-service',
    HANDLER_PORT = 30e3


let depContainer: DependencyContainer,
    handlerMbConn: IMessageBrokerConnector,
    callerMbConn: IMessageBrokerConnector,
    handler: IMediateRpcHandler,
    caller: IMediateRpcCaller,
    addon: DefaultMediateRpcHandlerAddOn

describe('@payload() - mediate', function() {
    this.timeout(5000)
    // this.timeout(60e3) // For debugging

    beforeEach(async () => {
        depContainer = new DependencyContainer()
        serviceContext.setDependencyContainer(depContainer)
        depContainer.bindConstant(CmT.DEPENDENCY_CONTAINER, depContainer)

        const config = mockConfigProvider({
            [S.SERVICE_SLUG]: SERVICE_SLUG,
            [RPC.RPC_HANDLER_PORT]: HANDLER_PORT,
        });

        [caller, callerMbConn] = await mockMediateRpcCaller();
        [handler, handlerMbConn] = await mockMediateRpcHandler(false)

        addon = new DefaultMediateRpcHandlerAddOn(
            config,
            depContainer,
            handler
        )
        addon.controllerPath = path.join(
            process.cwd(),
            'dist', 'test', 'shared', 'payload-controller')
        return handlerMbConn.connect()
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

        it('Should convert whole payload to model class of infered type', async () => {
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
                    actionName: rc.ACT_TRANSLATE_WHOLE_AUTO,
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

        it('Should convert whole payload to model class of specified type', async () => {
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
                    actionName: rc.ACT_TRANSLATE_WHOLE_MANUAL,
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
                two: [
                    <SampleModel> {
                        name: 'Another valid name',
                        age: 30,
                        position: 'True coolie',
                    },
                    <SampleModel> {
                        name: 'More name',
                        age: 40,
                        position: 'Seasoned coolie',
                    },
                ],
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
                    'SampleModel', PAYLOAD.one.name, PAYLOAD.one.age,
                    PAYLOAD.two.length,
                    'SampleModel', PAYLOAD.two[0].name, PAYLOAD.two[0].age,
                    'SampleModel', PAYLOAD.two[1].name, PAYLOAD.two[1].age,
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
