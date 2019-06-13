import * as chai from 'chai'
import * as spies from 'chai-spies'
import * as path from 'path'

import { IConfigurationProvider, constants, Maybe,
    DependencyContainer, serviceContext, Types as CmT, InternalErrorException, CriticalException,
    } from '@micro-fleet/common'

import { IDirectRpcHandler, IDirectRpcCaller, ExpressRpcHandler, HttpRpcCaller,
    DefaultDirectRpcHandlerAddOn,
    RpcResponse
    } from '../app'

import * as dc from './shared/direct-controllers'


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

describe.skip('DefaultDirectRpcHandlerAddOn', function() {
    // this.timeout(5000)
    // For debugging
    this.timeout(60000)

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

    describe('handleRequests', () => {
        it('should call action method', async () => {
            // Arrange
            // const disconnectSpy = chai.spy.on(addon['_rpcHandler'], 'dispose')
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
            finally {
                await addon.dispose()
            }

        })

        it('should return expected response', async () => {
            // Arrange
            // const disconnectSpy = chai.spy.on(addon['_rpcHandler'], 'dispose')
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
            finally {
                await addon.dispose()
            }

        })

        it('should return expected error message', async () => {
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

                // Assert
                expect(res).not.to.exist
            }
            catch (resError) {
                expect(resError).to.exist
                expect(resError).to.be.instanceOf(InternalErrorException)
                expect(handlerError).to.exist
                const controller = depContainer.resolve<dc.DirectAutoController>(dc.DirectAutoController.name)
                expect(controller.spyFn).to.be.called.with(CALLER_NAME, AUTO_MODULE_NAME)
            }
            finally {
                await addon.dispose()
            }
        })

        it('should rebuild the response exception', async () => {
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
                expect(handlerError).to.exist
                const controller = depContainer.resolve<dc.DirectAutoController>(dc.DirectAutoController.name)
                expect(controller.spyFn).to.be.called.with(CALLER_NAME, AUTO_MODULE_NAME)
            }
            finally {
                await addon.dispose()
            }
        })

    }) // END describe 'handleRequests'
})
