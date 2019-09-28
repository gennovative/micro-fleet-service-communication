import * as path from 'path'

import * as chai from 'chai'
import * as spies from 'chai-spies'

import { Types as CmT, IConfigurationProvider, constants,
    DependencyContainer, serviceContext, MinorException, CriticalException,
    } from '@micro-fleet/common'

import { RpcResponse, IMediateRpcHandler, IMediateRpcCaller,
    IMessageBrokerConnector, TopicMessageBrokerConnector,
    DefaultMediateRpcHandlerAddOn, RpcError,
} from '../app'

import rabbitOpts from './rabbit-options'
import * as mc from './shared/mediate-controllers'
import { sleep, mockConfigProvider, mockMediateRpcCaller, mockMediateRpcHandler } from './shared/helper'


chai.use(spies)
const expect = chai.expect
const {
    Service: S,
    RPC,
} = constants

const SERVICE_SLUG = 'test-service',
    CALLER_NAME = 'caller',
    HANDLER_NAME = 'handler',
    TEXT_REQUEST = '1346468764131687'


let depContainer: DependencyContainer,
    callerMbConn: IMessageBrokerConnector,
    handlerMbConn: IMessageBrokerConnector,
    handler: IMediateRpcHandler,
    caller: IMediateRpcCaller,
    addon: DefaultMediateRpcHandlerAddOn,
    config: IConfigurationProvider

// tslint:disable: no-floating-promises

describe('DefaultMediateRpcHandlerAddOn', function() {
    this.timeout(20000)
    // For debugging
    // this.timeout(60e3)

    beforeEach(async () => {
        depContainer = new DependencyContainer()
        serviceContext.setDependencyContainer(depContainer)
        depContainer.bindConstant(CmT.DEPENDENCY_CONTAINER, depContainer)

        config = mockConfigProvider({
            [S.SERVICE_SLUG]: SERVICE_SLUG,
            [RPC.RPC_CALLER_TIMEOUT]: 3000,
        });
        [caller, callerMbConn] = await mockMediateRpcCaller(config);
        [handler, handlerMbConn] = await mockMediateRpcHandler(config, false)
        handlerMbConn = new TopicMessageBrokerConnector(HANDLER_NAME)

        callerMbConn.onError((err) => {
            console.error('Caller error:\n', err)
        })

        handlerMbConn.onError((err) => {
            console.error('Handler error:\n', err)
        })

        addon = new DefaultMediateRpcHandlerAddOn(
            config,
            depContainer,
            handler,
        )
        addon.controllerPath = path.join(process.cwd(), 'dist', 'test', 'shared', 'mediate-controllers')

        return Promise.all([
            callerMbConn.connect(rabbitOpts.caller),
            handlerMbConn.connect(rabbitOpts.handler),
        ])
    })

    afterEach(async () => {
        await Promise.all([
            addon.dispose(),
            caller.dispose(),
        ])
        await Promise.all([
            callerMbConn.disconnect(),
            handlerMbConn.disconnect(),
        ])
        depContainer.dispose()
    })

    describe('handleRequests', () => {
        it('Should call action method', async () => {
            // Arrange
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
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
                const res: RpcResponse = await caller.call({
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
                const res: RpcResponse = await caller.call({
                    moduleName: AUTO_MODULE_NAME,
                    actionName: mc.ACT_REFUSE_IT,
                })

                // Assert: Must not success
                expect(res).to.exist
                expect(res.isSuccess).to.be.false

                const resError: RpcError = res.payload
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
                const res: RpcResponse = await caller.call({
                    moduleName: AUTO_MODULE_NAME,
                    actionName: mc.ACT_EXCEPT_IT,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.false

                const resError: RpcError = res.payload
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
                const res: RpcResponse = await caller.call({
                    moduleName: AUTO_MODULE_NAME,
                    actionName: mc.ACT_OBJ_IT,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.false

                const resError: RpcError = res.payload
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
                    return sleep(3000) // Need more delay time than DirectHandler
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
                })
                .catch(err => {
                    err && console.error(err)
                    expect(err).to.not.exist
                })
                .finally(() => {
                    done()
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

                    caller['_timeout'] = 6000
                    // Act 1
                    for (i = 1; i <= INIT_CALL_NUM; ++i) {
                        caller.call({
                            moduleName: mc.MODULE_NAME,
                            actionName: mc.ACT_GET_IT,
                        })
                        .then((res: RpcResponse) => {
                            console.log(`Got the ${res.payload}-th response`)
                        })
                    }
                    return sleep(2000) // Need more delay time than DirectHandler
                })
                .then(() => {
                    console.log('We\'re gotta close now!')
                    return addon.deadLetter()
                })
                .then(async () => {
                    // Assert: Handler accepts requests
                    console.log(`All ${INIT_CALL_NUM} requests accepted`)

                    // Act 2
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
                            })
                        )
                    }
                    return Promise.all(tasks)
                })
                .then(() => {
                    // Assert: "counter" not increased.
                    //          Handler no longer accepts requests
                    expect(acceptCounter).to.equal(INIT_CALL_NUM)
                })
                .catch(err => {
                    err && console.error(err)
                    expect(err).to.not.exist
                })
                .finally(async () => {
                    resolvers.forEach(resolve => resolve())
                    return sleep(3000)
                })
                .then(() => {
                    expect(resolveCounter).to.equal(INIT_CALL_NUM)
                    done()
                })
        })
    }) // END describe 'deadLetter'
})
