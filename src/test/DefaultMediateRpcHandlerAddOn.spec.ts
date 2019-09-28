import * as path from 'path'

import * as chai from 'chai'
import * as spies from 'chai-spies'
chai.use(spies)
const expect = chai.expect

import { Types as cT, IConfigurationProvider, constants,
    DependencyContainer, MinorException, CriticalException, IServiceAddOn,
} from '@micro-fleet/common'
const {
    Service: S,
    RPC,
    MessageBroker: MB,
} = constants

import * as app from '../app'
const {
    Types: T,
} = app

import rabbitOpts from './rabbit-options'
import * as mc from './shared/mediate-controllers'
import * as h from './shared/helper'


const {
    SERVICE_SLUG,
    CALLER_NAME,
    CALLER_TIMEOUT,
} = h.constants

const TEXT_REQUEST = '1346468764131687'


let depContainer: DependencyContainer,
    // callerMbConn: app.IMessageBrokerConnector,
    // handlerMbConn: app.IMessageBrokerConnector,
    connProvider: IServiceAddOn,
    handler: app.IMediateRpcHandler,
    caller: app.IMediateRpcCaller,
    addon: app.DefaultMediateRpcHandlerAddOn,
    config: IConfigurationProvider

// tslint:disable: no-floating-promises

describe('DefaultMediateRpcHandlerAddOn', function() {
    this.timeout(20e3)
    // For debugging
    // this.timeout(60e3)

    beforeEach(async () => {
        /*
         * In this test, we resolve from dependency container
         * and not using mock for message broker connetor,
         * to test a real-life scenario.
         */
        config = h.mockConfigProvider({
            [S.SERVICE_SLUG]: SERVICE_SLUG,
            [RPC.RPC_CALLER_TIMEOUT]: CALLER_TIMEOUT,
            [MB.MSG_BROKER_HOST]: rabbitOpts.hostAddress,
            [MB.MSG_BROKER_USERNAME]: rabbitOpts.username,
            [MB.MSG_BROKER_PASSWORD]: rabbitOpts.password,
            [MB.MSG_BROKER_EXCHANGE]: rabbitOpts.exchange,
            [MB.MSG_BROKER_HANDLER_QUEUE]: rabbitOpts.queue,
            [MB.MSG_BROKER_MSG_EXPIRE]: rabbitOpts.messageExpiredIn,
        })
        depContainer = h.mockDependencyContainer()
        depContainer.bindConstant(cT.CONFIG_PROVIDER, config)

        app.registerMessageBrokerAddOn()
        app.registerMediateHandlerAddOn()
        app.registerMediateCaller()

        caller = depContainer.resolve<app.IMediateRpcCaller>(T.MEDIATE_RPC_CALLER)
        handler = depContainer.resolve<app.IMediateRpcHandler>(T.MEDIATE_RPC_HANDLER)

        caller.onError((err) => {
            console.error('Caller error:\n', err)
        })

        handler.onError((err) => {
            console.error('Handler error:\n', err)
        })

        addon = new app.DefaultMediateRpcHandlerAddOn(
            config,
            depContainer,
            handler,
        )
        addon.controllerPath = path.join(process.cwd(), 'dist', 'test', 'shared', 'mediate-controllers')

        connProvider = depContainer.resolve<IServiceAddOn>(T.MSG_BROKER_CONNECTOR_PROVIDER)
        await connProvider.init()
        await caller.init({
            callerName: CALLER_NAME,
            timeout: CALLER_TIMEOUT,
            messageExpiredIn: rabbitOpts.messageExpiredIn,
        })
    })

    afterEach(async () => {
        await Promise.all([
            addon.dispose(),
            caller.dispose(),
        ])
        await connProvider.dispose() // Will also disconnect all connectors
        depContainer.dispose()
    })

    describe('handleRequests', () => {
        it('Should call action method', async () => {
            // Arrange
            await addon.init()

            // Act
            try {
                const res: app.RpcResponse = await caller.call({
                    moduleName: mc.MODULE_NAME,
                    actionName: mc.ACT_DO_IT,
                    params: {
                        id: TEXT_REQUEST,
                    },
                })

                // Assert
                expect(res).to.exist
                const controller = depContainer.resolve<mc.MediateNamedController>(mc.MediateNamedController.name)
                expect(controller.spyFn).to.be.spy
                expect(controller.spyFn).to.be.called.with(TEXT_REQUEST, CALLER_NAME, mc.MODULE_NAME)
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }
        })

        it('Should return expected response', async () => {
            // Arrange
            await addon.init()

            // Act
            try {
                const res: app.RpcResponse = await caller.call({
                    moduleName: mc.MODULE_NAME,
                    actionName: mc.ACT_GET_IT,
                })

                // Assert
                expect(res).to.exist
                expect(res.payload).to.equal(mc.RES_GET_IT)
                const controller = depContainer.resolve<mc.MediateNamedController>(mc.MediateNamedController.name)
                expect(controller.spyFn).to.be.spy
                expect(controller.spyFn).to.be.called.with(CALLER_NAME, mc.MODULE_NAME)
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }

        })

        it('Should respond with expected error message if unsuccessful', async () => {
            // Arrange
            const AUTO_MODULE_NAME = 'mediateAuto'
            let handlerError
            addon.onError((err) => {
                handlerError = err
            })
            await addon.init()

            // Act
            try {
                const res: app.RpcResponse = await caller.call({
                    moduleName: AUTO_MODULE_NAME,
                    actionName: mc.ACT_REFUSE_IT,
                })

                // Assert: Must not success
                expect(res).to.exist
                expect(res.isSuccess).to.be.false

                const resError: app.RpcError = res.payload
                expect(resError).is.instanceOf(MinorException)
                expect(resError.message).to.equal(mc.RES_REFUSE_IT)

                // Assert: Not handler's fault
                expect(handlerError).not.to.exist
                const controller = depContainer.resolve<mc.MediateAutoController>(mc.MediateAutoController.name)
                expect(controller.spyFn).to.be.called.with(CALLER_NAME, AUTO_MODULE_NAME)
            }
            catch (resError) {
                // Assert: Must success
                console.error(resError)
                expect(resError).not.to.exist
            }
        })

        it('Should rebuild the correct Exception if unsuccessful', async () => {
            // Arrange
            const AUTO_MODULE_NAME = 'mediateAuto'
            let handlerError
            addon.onError((err) => {
                handlerError = err
            })
            await addon.init()

            // Act
            try {
                const res: app.RpcResponse = await caller.call({
                    moduleName: AUTO_MODULE_NAME,
                    actionName: mc.ACT_EXCEPT_IT,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.false

                const resError: app.RpcError = res.payload
                expect(resError).is.instanceOf(CriticalException)
                expect(resError.message).to.equal(mc.RES_EXCEPT_IT)

                // Assert: Not handler's fault
                expect(handlerError).not.to.exist
                const controller = depContainer.resolve<mc.MediateAutoController>(mc.MediateAutoController.name)
                expect(controller.spyFn).to.be.called.with(CALLER_NAME, AUTO_MODULE_NAME)
            }
            catch (resError) {
                console.error(resError)
                expect(resError).not.to.exist
            }
        })

        it('Should rebuild the error object as MinorException if unsuccessful', async () => {
            // Arrange
            const AUTO_MODULE_NAME = 'mediateAuto'
            let handlerError
            addon.onError((err) => {
                handlerError = err
            })
            await addon.init()

            // Act
            try {
                const res: app.RpcResponse = await caller.call({
                    moduleName: AUTO_MODULE_NAME,
                    actionName: mc.ACT_OBJ_IT,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.false

                const resError: app.RpcError = res.payload
                expect(resError).is.instanceOf(MinorException)
                expect(resError.details).to.deep.equal(mc.RES_OBJ_IT)

                // Assert: Not handler's fault
                expect(handlerError).not.to.exist
                const controller = depContainer.resolve<mc.MediateAutoController>(mc.MediateAutoController.name)
                expect(controller.spyFn).to.be.called.with(CALLER_NAME, AUTO_MODULE_NAME)
            }
            catch (resError) {
                console.error(resError)
                expect(resError).not.to.exist
            }
        })
    }) // END describe 'handleRequests'


    describe('deadLetter', () => {
        it('Should stop accepting more request', (done) => {
            // Arrange
            const INIT_CALL_NUM = 3
            const MORE_CALL_NUM = 2
            let acceptCounter = 0
            let rejectCounter = 0
            let i: number

            addon.init()
                .then(() => {
                    const controller = depContainer.resolve<mc.MediateNamedController>(mc.MediateNamedController.name)
                    controller.getSomethingCb = (resolve: Function) => {
                        const curCount = ++acceptCounter
                        console.log(`Accepted the ${curCount}-th request`)
                        resolve(curCount)
                    }

                    // Act 1
                    for (i = 1; i <= INIT_CALL_NUM; ++i) {
                        caller.call({
                            moduleName: mc.MODULE_NAME,
                            actionName: mc.ACT_GET_IT,
                        })
                    }
                    return h.sleep(3000) // Need more delay time than DirectHandler
                })
                .then(() => {
                    console.log('We\'re gotta close now!')
                    return addon.deadLetter()
                })
                .then(async () => {
                    // Assert: Handler accepts requests
                    expect(acceptCounter).to.equal(INIT_CALL_NUM)
                    console.log(`All ${INIT_CALL_NUM} requests accepted`)

                    const tasks = []
                    for (; i <= INIT_CALL_NUM + MORE_CALL_NUM; ++i) {
                        const cur = i
                        tasks.push(
                            caller.call({
                                moduleName: mc.MODULE_NAME,
                                actionName: mc.ACT_GET_IT,
                            })
                            .then(res => expect(res).not.to.exist)
                            .catch(err => {
                                expect(err).to.exist
                                expect(err.message).to.equal('Response waiting timeout')
                                ++rejectCounter
                                console.log(`Rejected the ${cur}-th request`)
                            })
                        )
                    }
                    return Promise.all(tasks)
                })
                .then(() => {
                    // Assert: "counter" not increased.
                    //          Handler no longer accepts requests
                    expect(acceptCounter).to.equal(INIT_CALL_NUM)
                    expect(rejectCounter).to.equal(MORE_CALL_NUM)
                    done()
                })
                .catch(err => {
                    // err && console.error(err)
                    expect(err).to.not.exist
                    done(err)
                })
        })

        it('Should continue processing existing requests', (done) => {
            // Arrange
            const INIT_CALL_NUM = 3
            const MORE_CALL_NUM = 2
            const resolvers: Function[] = []
            let acceptCounter = 0
            let resolveCounter = 0
            let i: number

            addon.init()
                .then(() => {
                    const controller = depContainer.resolve<mc.MediateNamedController>(mc.MediateNamedController.name)
                    controller.getSomethingCb = (resolve: Function) => {
                        const curCount = ++acceptCounter
                        console.log(`Accepted the ${curCount}-th request`)

                        resolvers.push(() => {
                            console.log(`Resolved the ${curCount}-th request`)
                            ++resolveCounter
                            resolve(curCount)
                        })
                    }

                    caller['$timeout'] = 6000
                    // Act 1
                    for (i = 1; i <= INIT_CALL_NUM; ++i) {
                        caller.call({
                            moduleName: mc.MODULE_NAME,
                            actionName: mc.ACT_GET_IT,
                        })
                        .then((res: app.RpcResponse) => {
                            console.log(`Got the ${res.payload}-th response`)
                        })
                        .catch(done)
                    }
                    return h.sleep(2000) // Need more delay time than DirectHandler
                })
                .then(() => {
                    console.log('We\'re gotta close now!')
                    return addon.deadLetter()
                })
                .then(async () => {
                    // Act 2
                    caller['$timeout'] = 1000
                    const tasks = []
                    for (; i <= INIT_CALL_NUM + MORE_CALL_NUM; ++i) {
                        tasks.push(
                            caller.call({
                                moduleName: mc.MODULE_NAME,
                                actionName: mc.ACT_GET_IT,
                            })
                            .then(res => expect(res).not.to.exist)
                            .catch(err => {
                                expect(err).to.exist
                                expect(err.message).to.equal('Response waiting timeout')
                                console.log(`Attempted 1 more requests but timed out`)
                            })
                        )
                    }
                    return Promise.all(tasks)
                })
                .then(() => {
                    // Assert: "counter" not increased.
                    //          Handler no longer accepts requests
                    expect(acceptCounter).to.equal(INIT_CALL_NUM)

                    resolvers.forEach(resolve => resolve())
                    return h.sleep(3000)
                })
                .then(() => {
                    expect(resolveCounter).to.equal(INIT_CALL_NUM)
                    done()
                })
                .catch(err => {
                    // err && console.error(err)
                    expect(err).to.not.exist
                    done(err)
                })
        })
    }) // END describe 'deadLetter'
})
