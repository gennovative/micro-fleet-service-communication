import * as path from 'path'

import * as chai from 'chai'
import * as spies from 'chai-spies'
chai.use(spies)
const expect = chai.expect

import { constants, Types as CmT,
    DependencyContainer, serviceContext,
    InternalErrorException, MinorException,
    } from '@micro-fleet/common'

import { IDirectRpcHandler, IDirectRpcCaller, ExpressRpcHandler, HttpRpcCaller,
    DefaultDirectRpcHandlerAddOn, RpcResponse,
    } from '../../app'

import * as rc from '../shared/resolve-reject-controller'
import { mockConfigProvider } from '../shared/helper'


const { RPC: R, Service: S } = constants

const SERVICE_SLUG = 'test-service',
    HANDLER_PORT = 30e3,
    HANDLER_ADDR = `localhost:${HANDLER_PORT}`,
    CALLER_NAME = 'caller'


let depContainer: DependencyContainer,
    handler: IDirectRpcHandler,
    caller: IDirectRpcCaller,
    addon: DefaultDirectRpcHandlerAddOn


// tslint:disable: no-floating-promises

describe('@rejectFn() - direct', function() {
    this.timeout(5e3)
    // this.timeout(60e3) // For debugging

    beforeEach(() => {
        depContainer = new DependencyContainer()
        serviceContext.setDependencyContainer(depContainer)
        depContainer.bindConstant(CmT.DEPENDENCY_CONTAINER, depContainer)

        const config = mockConfigProvider({
            [S.SERVICE_SLUG]: SERVICE_SLUG,
            [R.RPC_HANDLER_PORT]: HANDLER_PORT,
        })

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
        addon.controllerPath = path.join(process.cwd(), 'dist', 'test', 'shared', 'resolve-reject-controller')
    })

    afterEach(async () => {
        await addon.dispose()
        await caller.dispose()
        depContainer.dispose()
    })

    describe('Auto', function() {
        it('Caller should throw SYNC error if @rejectFn is not present', async () => {
            // Arrange
            let handerError
            addon.onError((err) => {
                handerError = err
            })
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_AUTO_SYNC_ERROR,
                })

                // Assert
                expect(res).not.to.exist
            }
            catch (err) {
                expect(err).to.exist
                expect(err).to.be.instanceOf(InternalErrorException)
                expect(handerError).to.equal(rc.RES_AUTO_SYNC_ERROR)
                const controller = depContainer.resolve<rc.ResolveRejectController>(rc.ResolveRejectController.name)
                expect(controller.spyFn).to.be.called.once
            }
        })

        it('Caller should throw ASYNC error if @rejectFn is not present', async () => {
            // Arrange
            let handerError
            addon.onError((err) => {
                handerError = err
            })
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_AUTO_ASYNC_ERROR,
                })

                // Assert
                expect(res).not.to.exist
            }
            catch (err) {
                expect(err).to.exist
                expect(err).to.be.instanceOf(InternalErrorException)
                expect(handerError).to.equal(rc.RES_AUTO_ASYNC_ERROR)
                const controller = depContainer.resolve<rc.ResolveRejectController>(rc.ResolveRejectController.name)
                expect(controller.spyFn).to.be.called.once
            }
        })
    })

    describe('Manual', function() {
        it('Should respond SYNC-ly with isSuccess=false if @rejectFn is present', async () => {
            // Arrange
            let handerError
            addon.onError((err) => {
                handerError = err
            })
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_MANUAL_SYNC_REJECT,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.false
                expect(res.payload).to.be.instanceOf(MinorException)
                expect(res.payload.message).to.equal(rc.RES_MANUAL_SYNC_REJECT.message)
                expect(handerError).not.to.exist
                const controller = depContainer.resolve<rc.ResolveRejectController>(rc.ResolveRejectController.name)
                expect(controller.spyFn).to.be.called.once
            }
            catch (err) {
                console.error(err)
                expect(err).not.to.exist
            }
        })

        it('Should respond ASYNC-ly with isSuccess=false if @rejectFn is present', async () => {
            // Arrange
            let handerError
            addon.onError((err) => {
                handerError = err
            })
            await addon.init()

            // Act
            try {
                const res: RpcResponse = await caller.call({
                    moduleName: rc.MODULE_NAME,
                    actionName: rc.ACT_MANUAL_ASYNC_REJECT,
                })

                // Assert
                expect(res).to.exist
                expect(res.isSuccess).to.be.false
                expect(res.payload).to.be.instanceOf(MinorException)
                expect(res.payload.details).to.deep.equal(rc.RES_MANUAL_ASYNC_REJECT)
                expect(handerError).not.to.exist
                const controller = depContainer.resolve<rc.ResolveRejectController>(rc.ResolveRejectController.name)
                expect(controller.spyFn).to.be.called.once
            }
            catch (err) {
                console.error(err)
                expect(err).not.to.exist
            }
        })
    })


}) // describe '@rejectFn()'
