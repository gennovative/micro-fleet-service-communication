import * as chai from 'chai'
import * as spies from 'chai-spies'
import * as path from 'path'

import { IConfigurationProvider, constants, Maybe,
    DependencyContainer, serviceContext, Types as CmT,
    CriticalException, MinorException,
    } from '@micro-fleet/common'

import { IDirectRpcHandler, IDirectRpcCaller, ExpressRpcHandler, HttpRpcCaller,
    DefaultDirectRpcHandlerAddOn,
    RpcResponse
    } from '../app'

import * as dc from './shared/direct-controllers'
import { sleep } from './shared/helper'


chai.use(spies)
const expect = chai.expect
const { RpcSettingKeys: RpcS, SvcSettingKeys: SvcS } = constants

const SERVICE_SLUG = 'test-service',
    HANDLER_PORT = 30000,
    HANDLER_ADDR = `localhost:${HANDLER_PORT}`,
    CALLER_NAME = 'caller',
    TEXT_REQUEST = '1346468764131687'

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
            case RpcS.RPC_HANDLER_PORT: return new Maybe(HANDLER_PORT)
            case SvcS.SERVICE_SLUG: return new Maybe(SERVICE_SLUG)
            default: return new Maybe
        }
    }

    public async fetch(): Promise<boolean> {
        return Promise.resolve(true)
    }
}



let depContainer: DependencyContainer,
    handler: IDirectRpcHandler,
    caller: IDirectRpcCaller,
    addon: DefaultDirectRpcHandlerAddOn

describe('DefaultDirectRpcHandlerAddOn', function() {
    this.timeout(5000)
    // For debugging
    // this.timeout(60000)

    beforeEach(() => {
        depContainer = new DependencyContainer()
        serviceContext.setDependencyContainer(depContainer)
        depContainer.bindConstant(CmT.DEPENDENCY_CONTAINER, depContainer)

        caller = new HttpRpcCaller()
        caller.name = CALLER_NAME
        caller.baseAddress = HANDLER_ADDR

        handler = new ExpressRpcHandler()
        addon = new DefaultDirectRpcHandlerAddOn(
            new MockConfigProvider(),
            depContainer,
            handler
        )
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
                const res: RpcResponse = await caller.call(dc.MODULE_NAME, dc.ACT_DO_IT, {
                    id: TEXT_REQUEST,
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
                const res: RpcResponse = await caller.call(dc.MODULE_NAME, dc.ACT_GET_IT)

                // Assert
                expect(res).to.exist
                expect(res.payload).to.equal(dc.SUCCESS_MESSAGE)
                const controller = depContainer.resolve<dc.DirectNamedController>(dc.DirectNamedController.name)
                expect(controller.spyFn).to.be.spy
                expect(controller.spyFn).to.be.called.with(CALLER_NAME, dc.MODULE_NAME)
            }
            catch (err) {
                err && console.error(err)
                expect(err).to.not.exist
            }

        })

        it('Should return expected error message', async () => {
            // Arrange
            const AUTO_MODULE_NAME = 'directAuto'
            let handlerError
            addon.onError((err) => {
                handlerError = err
            })
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call(AUTO_MODULE_NAME, dc.ACT_REFUSE_IT)

                // Assert: Must not success
                expect(res).not.to.exist
            }
            catch (resError) {
                // Assert: Must fail with exception
                expect(resError).to.exist
                expect(resError).to.be.instanceOf(MinorException)
                expect(resError['details']).to.equal(dc.FAIL_MESSAGE)
                // Assert: Not handler's fault
                expect(handlerError).not.to.exist
                const controller = depContainer.resolve<dc.DirectAutoController>(dc.DirectAutoController.name)
                expect(controller.spyFn).to.be.called.with(CALLER_NAME, AUTO_MODULE_NAME)
            }
        })

        it('Should rebuild the response exception', async () => {
            // Arrange
            const AUTO_MODULE_NAME = 'directAuto'
            let handlerError
            addon.onError((err) => {
                handlerError = err
            })
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call(AUTO_MODULE_NAME, dc.ACT_EXCEPT_IT)

                // Assert
                expect(res).not.to.exist
            }
            catch (resError) {
                expect(resError).to.exist
                expect(resError).to.be.instanceOf(CriticalException)
                expect(resError.message).to.equal(dc.FAIL_MESSAGE)
                // Assert: Not handler's fault
                expect(handlerError).not.to.exist
                const controller = depContainer.resolve<dc.DirectAutoController>(dc.DirectAutoController.name)
                expect(controller.spyFn).to.be.called.with(CALLER_NAME, AUTO_MODULE_NAME)
            }
        })
    }) // END describe 'handleRequests'


    describe('deadLetter', () => {
        it('Should stop accepting more request', (done) => {
            // Arrange
            const CALL_NUM = 5
            const resolvers: PromiseResolveFn[] = []
            let counter = 0

            addon.init()
                .then(() => {
                    const controller = depContainer.resolve<dc.DirectNamedController>(dc.DirectNamedController.name)
                    controller.doSomething = ({ resolve }) => {
                        ++counter
                        resolvers.push(resolve)
                    }

                    // Act 1
                    for (let i = 0; i < CALL_NUM; ++i) {
                        caller.call(dc.MODULE_NAME, dc.ACT_DO_IT)
                    }
                    return sleep(1000)
                })
                .then(() => addon.deadLetter())
                .then(async () => {
                    // Assert: Handler accepts requests
                    expect(counter).to.equal(CALL_NUM)

                    // Act 2
                    for (let i = 0; i < CALL_NUM; ++i) {
                        try {
                            const res = await caller.call(dc.MODULE_NAME, dc.ACT_DO_IT)
                            expect(res).not.to.exist
                        }
                        catch (err) {
                            expect(err).to.exist
                            expect(err.message).to.equal('Gone')
                        }
                    }
                    return sleep(1000)
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
                .finally(async () => {
                    resolvers.forEach(resolve => resolve())
                    done()
                })
        })
    }) // END describe 'deadLetter'
})
