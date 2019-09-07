import * as chai from 'chai'
import * as spies from 'chai-spies'
import * as path from 'path'

import { IConfigurationProvider, constants, Maybe,
    DependencyContainer, serviceContext, Types as CmT, MinorException, CriticalException,
    } from '@micro-fleet/common'

import { RpcResponse, IMediateRpcHandler, IMediateRpcCaller,
    IMessageBrokerConnector, TopicMessageBrokerConnector,
    MessageBrokerRpcHandler, MessageBrokerRpcCaller,
    DefaultMediateRpcHandlerAddOn,
    RpcError,
    } from '../app'

import rabbitOpts from './rabbit-options'
import * as mc from './shared/mediate-controllers'
import { sleep } from './shared/helper'


chai.use(spies)
const expect = chai.expect
const { Service: S } = constants

const SERVICE_SLUG = 'test-service',
    CALLER_NAME = 'caller',
    HANDLER_NAME = 'handler',
    TEXT_REQUEST = '1346468764131687'

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
    connectorCall: IMessageBrokerConnector,
    connectorHandle: IMessageBrokerConnector,
    handler: IMediateRpcHandler,
    caller: IMediateRpcCaller,
    addon: DefaultMediateRpcHandlerAddOn

describe('DefaultMediateRpcHandlerAddOn', function() {
    this.timeout(20000)
    // For debugging
    // this.timeout(60000)

    beforeEach(() => {
        depContainer = new DependencyContainer()
        serviceContext.setDependencyContainer(depContainer)
        depContainer.bindConstant(CmT.DEPENDENCY_CONTAINER, depContainer)

        connectorCall = new TopicMessageBrokerConnector()
        connectorHandle = new TopicMessageBrokerConnector()

        connectorCall.onError((err) => {
            console.error('Caller error:\n', err)
        })

        connectorHandle.onError((err) => {
            console.error('Handler error:\n', err)
        })

        caller = new MessageBrokerRpcCaller(connectorCall)
        caller.name = CALLER_NAME

        handler = new MessageBrokerRpcHandler(connectorHandle)
        handler.name = HANDLER_NAME
        addon = new DefaultMediateRpcHandlerAddOn(
            new MockConfigProvider(),
            depContainer,
            handler,
        )
        addon.controllerPath = path.join(process.cwd(), 'dist', 'test', 'shared', 'mediate-controllers')

        return Promise.all([
            connectorCall.connect(rabbitOpts.caller),
            connectorHandle.connect(rabbitOpts.handler),
        ])
    })

    afterEach(async () => {
        await Promise.all([
            addon.dispose(),
            caller.dispose(),
        ])
        await Promise.all([
            connectorCall.disconnect(),
            connectorHandle.disconnect(),
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

                    caller.timeout = 3000
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
                    caller.timeout = 3000
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
                .finally(async () => {
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

                    caller.timeout = 6000
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
                    caller.timeout = 3000
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
