import * as path from 'path'

import * as chai from 'chai'
import * as spies from 'chai-spies'

import { constants, DependencyContainer, MinorException,
    CriticalException } from '@micro-fleet/common'

import { IDirectRpcCaller, DefaultDirectRpcHandlerAddOn,
    RpcResponse, RpcError } from '../app'

import * as dc from './shared/direct-controllers'
import * as h from './shared/helper'


chai.use(spies)
const expect = chai.expect
const { RPC: R, Service: S } = constants
const {
    SERVICE_SLUG,
    HANDLER_PORT,
    CALLER_NAME,
} = h.constants

const TEXT_REQUEST = '1346468764131687'


let depContainer: DependencyContainer,
    caller: IDirectRpcCaller,
    addon: DefaultDirectRpcHandlerAddOn

// tslint:disable: no-floating-promises

describe('DefaultDirectRpcHandlerAddOn', function() {
    this.timeout(5000)
    // this.timeout(60e3) // For debugging

    beforeEach(async () => {
        const config = h.mockConfigProvider({
            [S.SERVICE_SLUG]: SERVICE_SLUG,
            [R.RPC_HANDLER_PORT]: HANDLER_PORT,
        })
        depContainer = h.mockDependencyContainer()
        caller = await h.mockDirectRpcCaller();

        [addon] = h.mockDefaultDirectRpcHandlerAddOn(config, depContainer)
        addon.controllerPath = path.join(process.cwd(), 'dist', 'test', 'shared', 'direct-controllers')
    })

    afterEach(async () => {
        await addon.dispose()
        await caller.dispose()
        depContainer.dispose()
    })

    describe('handleRequests', () => {
        it('Should call action method', async () => {
            // Arrange
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: dc.MODULE_NAME,
                    actionName: dc.ACT_DO_IT,
                    params: {
                        id: TEXT_REQUEST,
                    },
                })

                // Assert
                expect(res).to.exist
                const controller = depContainer.resolve<dc.DirectNamedController>(dc.DirectNamedController.name)
                expect(controller.spyFn).to.be.spy
                expect(controller.spyFn).to.be.called.with(TEXT_REQUEST, CALLER_NAME, dc.MODULE_NAME)
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
                    moduleName: dc.MODULE_NAME,
                    actionName: dc.ACT_GET_IT,
                })

                // Assert
                expect(res).to.exist
                expect(res.payload).to.equal(dc.RES_GET_IT)
                const controller = depContainer.resolve<dc.DirectNamedController>(dc.DirectNamedController.name)
                expect(controller.spyFn).to.be.spy
                expect(controller.spyFn).to.be.called.with(CALLER_NAME, dc.MODULE_NAME)
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }

        })

        it('Should respond with expected error message if unsuccessful', async () => {
            // Arrange
            const AUTO_MODULE_NAME = 'directAuto'
            let handlerError
            addon.onError((err) => {
                handlerError = err
            })
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: AUTO_MODULE_NAME,
                    actionName: dc.ACT_REFUSE_IT,
                })
                // Assert: Must have status 200 but isSuccess false
                expect(res).to.exist
                expect(res.isSuccess).to.be.false

                const resError: RpcError = res.payload
                expect(resError).is.instanceOf(MinorException)
                expect(resError.message).to.equal(dc.RES_REFUSE_IT)

                // Assert: Not handler's fault
                expect(handlerError).not.to.exist
                const controller = depContainer.resolve<dc.DirectAutoController>(dc.DirectAutoController.name)
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
            const AUTO_MODULE_NAME = 'directAuto'
            let handlerError
            addon.onError((err) => {
                handlerError = err
            })
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: AUTO_MODULE_NAME,
                    actionName: dc.ACT_EXCEPT_IT,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.false

                const resError: RpcError = res.payload
                expect(resError).is.instanceOf(CriticalException)
                expect(resError.message).to.equal(dc.RES_EXCEPT_IT)

                // Assert: Not handler's fault
                expect(handlerError).not.to.exist
                const controller = depContainer.resolve<dc.DirectAutoController>(dc.DirectAutoController.name)
                expect(controller.spyFn).to.be.called.with(CALLER_NAME, AUTO_MODULE_NAME)
            }
            catch (resError) {
                console.error(resError)
                expect(resError).not.to.exist
            }
        })

        it('Should rebuild the error object as MinorException if unsuccessful', async () => {
            // Arrange
            const AUTO_MODULE_NAME = 'directAuto'
            let handlerError
            addon.onError((err) => {
                handlerError = err
            })
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: AUTO_MODULE_NAME,
                    actionName: dc.ACT_OBJ_IT,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.false

                const resError: RpcError = res.payload
                expect(resError).is.instanceOf(MinorException)
                expect(resError.details).to.deep.equal(dc.RES_OBJ_IT)

                // Assert: Not handler's fault
                expect(handlerError).not.to.exist
                const controller = depContainer.resolve<dc.DirectAutoController>(dc.DirectAutoController.name)
                expect(controller.spyFn).to.be.called.with(CALLER_NAME, AUTO_MODULE_NAME)
            }
            catch (resError) {
                console.error(resError)
                expect(resError).not.to.exist
            }
        })
    }) // END describe 'handleRequests'


    describe('deadLetter', () => {
        it('Should stop accepting more request', function(done) {
            this.timeout(50000)
            // Arrange
            const CALL_NUM = 5
            let counter = 0

            addon.init()
                .then(async () => {
                    const controller = depContainer.resolve<dc.DirectNamedController>(dc.DirectNamedController.name)
                    controller.getSomethingCb = (resolve: Function) => {
                        ++counter
                        resolve()
                    }

                    // Act 1
                    for (let i = 0; i < CALL_NUM; ++i) {
                        await caller.call({
                            moduleName: dc.MODULE_NAME,
                            actionName: dc.ACT_GET_IT,
                        })
                    }
                    // return sleep(1000)
                })
                .then(() => addon.deadLetter())
                .then(async () => {
                    // Assert: Handler accepts requests
                    expect(counter).to.equal(CALL_NUM)

                    // Act 2
                    let exception: MinorException
                    try {
                        const res = await caller.call({
                            moduleName: dc.MODULE_NAME,
                            actionName: dc.ACT_GET_IT,
                        })
                        expect(res).not.to.exist
                    }
                    catch (err) {
                        exception = err
                    }
                    expect(exception).to.exist
                    expect(exception).to.be.instanceOf(MinorException)
                    expect(exception.message).to.include('ECONNREFUSED')
                    return h.sleep(1000)
                })
                .then(() => {
                    // Assert: "counter" not increased.
                    //          Handler no longer accepts requests
                    expect(counter).to.equal(CALL_NUM)
                })
                .catch(err => {
                    err && console.error(err)
                    expect(err).to.not.exist
                })
                .finally(() => {
                    done()
                })
        })
    }) // END describe 'deadLetter'
})
