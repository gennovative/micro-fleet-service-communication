import * as chai from 'chai'
import * as spies from 'chai-spies'
import * as express from 'express'
import * as requestMaker from 'request-promise-native'
import { MinorException } from '@micro-fleet/common'

import { ExpressRpcHandler, RpcRequest, RpcResponse,
    RpcHandlerFunction, RpcError} from '../app'

chai.use(spies)
const expect = chai.expect


const NAME = 'TestHandler'

// tslint:disable: no-floating-promises

describe('ExpressDirectRpcHandler', function () {
    this.timeout(5000)
    // this.timeout(60e3); // For debugging

    let handler: ExpressRpcHandler

    beforeEach(() => {
        handler = new ExpressRpcHandler()
        return handler.init({
            handlerName: NAME,
            port: 30e3,
        })
    })

    afterEach(() => {
        return handler.dispose()
    })

    describe('start', () => {
        it('Should raise error if problems occur', (done) => {
            // Arrange
            // Start this server to make a port conflict
            const app = express()
            const server = app.listen(handler.port, () => {

                handler.onError(err => {
                    // Assert
                    expect(err).to.exist
                    server.close(() => done())
                })

                // Act
                handler.start()
            })
        })
    })

    describe('handle', () => {

        it('Should add a router for each module name if not specify `rawDest`.', () => {
            // Arrange 1
            const accountModule = 'accounts'
            const createAction = 'create'
            const editAction = 'edit'

            const doCreate = () => { /* empty */ }
            const doEdit = () => {/* empty */ }

            // Act 1
            handler.handle({
                moduleName: accountModule,
                actionName: createAction,
                handler: doCreate,
            })
            handler.handle({
                moduleName: accountModule,
                actionName: editAction,
                handler: doEdit,
            })

            // Assert 1
            const routers: Map<string, express.Router> = handler['_routers']
            let router: express.Router
            expect(routers.has(accountModule)).to.be.true
            router = routers.get(accountModule)
            expect(router.stack.length).to.equal(2)
            expect(router.stack[0].route.path).to.equal(`/${createAction}`)
            expect(router.stack[1].route.path).to.equal(`/${editAction}`)

            // Arrange 2
            const productModule = 'products'
            const deleteAction = 'delete'
            // tslint:disable-next-line:no-empty
            const doDelete = () => { }

            // Act 2
            handler.handle({
                moduleName: productModule,
                actionName: deleteAction,
                handler: doDelete,
            })

            // Assert 2
            expect(routers.size).to.equal(2)
            expect(routers.has(productModule)).to.be.true
            router = routers.get(productModule)
            expect(router.stack.length).to.equal(1)
            expect(router.stack[0].route.path).to.equal(`/${deleteAction}`)
        })

        it('Should parse and pass request parameters to action method.', (done) => {
            // Arrange
            const text = 'echo...echooooo'
            const moduleName = 'accounts'
            const createAction = 'create'
            const createHandler: RpcHandlerFunction = function ({ payload, rpcRequest, resolve }) {
                expect(payload.text).to.equal(text)
                expect(rpcRequest.payload.text).to.equal(text)
                expect(rpcRequest.to).to.equal(moduleName)
                resolve()
                done()
            }

            // Act
            handler.handle({
                moduleName,
                actionName: createAction,
                handler: createHandler,
            })

            // Assert
            handler.start()
                .then(() => {
                    const request: RpcRequest = {
                        from: '',
                        to: moduleName,
                        payload: { text },
                    }
                    const options = {
                        method: 'POST',
                        uri: `http://localhost:${handler.port}/${moduleName}/${createAction}`,
                        body: request,
                        json: true,
                    }

                    return requestMaker(options)
                })
                .catch(rawResponse => {
                    console.dir(rawResponse, { depth: 3 })
                    expect(false, 'Request should be successful!').to.be.true
                })
        })

        it('Should respond with expected result', () => {
            // Arrange
            const moduleName = 'accounts'
            const createAction = 'create'
            const port = 10000
            const result: any = {
                text: 'successsss',
            }
            const createHandler: RpcHandlerFunction = function ({ resolve }) {
                resolve(result)
            }

            // Act
            handler.handle({
                moduleName,
                actionName: createAction,
                handler: createHandler,
            })

            return handler.start()
                .then(() => requestMaker({
                    method: 'POST',
                    uri: `http://localhost:${port}/${moduleName}/${createAction}`,
                    body: {},
                    json: true,
                }))
                .then((res: RpcResponse) => {
                    expect(res.payload).to.deep.equal(result)
                })
                .catch(rawResponse => {
                    console.dir(rawResponse, { depth: 3 })
                    expect(false, 'Request should be successful!').to.be.true
                })
        })

        it('Should respond with the custom error object for INTENDED rejection', () => {
            // Arrange
            const moduleName = 'accounts'
            const createAction = 'create'
            const spy = chai.spy()
            const REASON = new MinorException('IntendedException')
            REASON.details = {
                why: 'An error string',
            }
            const createHandler: RpcHandlerFunction = function ({ reject }) {
                reject(REASON)
            }

            // Act
            handler.handle({
                moduleName,
                actionName: createAction,
                handler: createHandler,
            })

            // Assert: Not handler's fault
            handler.onError(err => {
                err && console.log(err)
                expect(err).not.to.exist
                spy()
            })

            return handler.start()
                .then(() => requestMaker({
                    method: 'POST',
                    uri: `http://localhost:${handler.port}/${moduleName}/${createAction}`,
                    body: {},
                    json: true,
                }))
                .then((res: RpcResponse) => {
                    // Assert: Response still has status 200
                    expect(res.isSuccess).to.be.false
                    const rpcError: RpcError = res.payload
                    expect(rpcError).to.exist
                    expect(rpcError.type).to.equal('MinorException')
                    expect(rpcError.details).to.deep.equal(REASON.details)
                    expect(spy).not.to.be.called
                })
                .catch(httpResponse => {
                    console.dir(httpResponse, { depth: 3 })
                    expect(true, 'Request should be successful!').to.be.false
                })
        })

        it('Should respond with the exception instance for INTENDED rejection', () => {
            // Arrange
            const moduleName = 'products'
            const deleteAction = 'delete'
            const errMsg = 'removeException'
            const spy = chai.spy()
            const deleteHandler: RpcHandlerFunction = function ({ reject }) {
                reject(new MinorException(errMsg))
            }

            // Act
            handler.handle({
                moduleName,
                actionName: deleteAction,
                handler: deleteHandler,
            })

            // Assert: Not handler's fault
            handler.onError(err => {
                err && console.log(err)
                expect(err).not.to.exist
                spy()
            })

            return handler.start()
                .then(() => requestMaker({
                    method: 'POST',
                    uri: `http://localhost:${handler.port}/${moduleName}/${deleteAction}`,
                    body: {},
                    json: true,
                }))
                .then((res: RpcResponse) => {
                    // Assert: Response still has status 200
                    expect(res.isSuccess).to.be.false

                    const rpcError: RpcError = res.payload
                    expect(rpcError).to.exist
                    expect(rpcError.type).to.equal('MinorException')
                    expect(rpcError.message).to.equal(errMsg)
                    expect(spy).not.to.be.called
                })
                .catch(httpResponse => {
                    console.dir(httpResponse, { depth: 3 })
                    expect(true, 'Request should be successful!').to.be.false
                })
        })

        it('Should respond with status 500 when the handler returns rejected Promise', () => {
            // Arrange
            const moduleName = 'products'
            const deleteAction = 'delete'
            const errMsg = 'removeException'
            const spy = chai.spy()
            const deleteHandler: RpcHandlerFunction = function () {
                return Promise.reject(new MinorException(errMsg))
            }

            // Act
            handler.handle({
                moduleName,
                actionName: deleteAction,
                handler: deleteHandler,
            })

            // Assert: Catch handler's fault
            handler.onError(err => {
                expect(err).to.exist
                spy()
            })

            // Assert
            return handler.start()
                .then(() => requestMaker({
                    method: 'POST',
                    uri: `http://localhost:${handler.port}/${moduleName}/${deleteAction}`,
                    body: {},
                    json: true,
                }))
                .then((res: RpcResponse) => {
                    // If status 200
                    expect(res, 'Request should NOT be successful!').not.to.exist
                })
                .catch(httpResponse => {
                    // Assert: Falsey response is returned
                    expect(httpResponse.statusCode).to.equal(500)
                    expect(spy).to.be.called.once
                })
        })

        it('Should respond with status 500 when the handler throws Exception', () => {
            // Arrange
            const moduleName = 'products'
            const deleteAction = 'delete'
            const errMsg = 'removeException'
            const spy = chai.spy()
            const deleteHandler: RpcHandlerFunction = function () {
                throw new MinorException(errMsg)
            }

            // Act
            handler.handle({
                moduleName,
                actionName: deleteAction,
                handler: deleteHandler,
            })

            // Assert: Catch handler's fault
            handler.onError(err => {
                expect(err).to.exist
                spy()
            })

            return handler.start()
                .then(() => requestMaker({
                    method: 'POST',
                    uri: `http://localhost:${handler.port}/${moduleName}/${deleteAction}`,
                    body: {},
                    json: true,
                }))
                .then((res: RpcResponse) => {
                    // If status 200
                    expect(res, 'Request should NOT be successful!').not.to.exist
                })
                .catch(httpResponse => {
                    // Assert: Falsey response is returned
                    expect(httpResponse.statusCode).to.equal(500)
                    expect(spy).to.be.called.once
                })
        })

        it('Should respond with status 500 when the handler throws Error.', () => {
            // Arrange
            const moduleName = 'products'
            const editAction = 'edit'
            const errMsg = 'editError'
            const spy = chai.spy()
            const editHandler: RpcHandlerFunction = function () {
                throw new Error(errMsg)
            }

            // Act
            handler.handle({
                moduleName,
                actionName: editAction,
                handler: editHandler,
            })

            // Assert: Catch handler's fault
            handler.onError(err => {
                expect(err).to.exist
                spy()
            })

            return handler.start()
                .then(() => requestMaker({
                    method: 'POST',
                    uri: `http://localhost:${handler.port}/${moduleName}/${editAction}`,
                    body: {},
                    json: true,
                }))
                .then((res: RpcResponse) => {
                    // If status 200
                    expect(res, 'Request should NOT be successful!').not.to.exist
                })
                .catch(httpResponse => {
                    // If status 500 or request error.
                    expect(httpResponse.statusCode).to.equal(500)
                    expect(spy).to.be.called.once
                })
        })

    }) // END describe handle
})
