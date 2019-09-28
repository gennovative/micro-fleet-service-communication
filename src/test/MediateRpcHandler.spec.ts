import { EventEmitter } from 'events'

import * as amqp from 'amqplib'
import * as chai from 'chai'
import * as spies from 'chai-spies'
import * as shortid from 'shortid'
import { mock, instance, when, anyFunction, anything, reset } from 'ts-mockito'
import { constants, MinorException, IConfigurationProvider } from '@micro-fleet/common'

import { MessageBrokerRpcHandler, BrokerMessage, IMessageBrokerConnector, IMediateRpcHandler,
    TopicMessageBrokerConnector, RpcRequest, RpcResponse, RpcHandlerFunction,
    RpcError, IMessageBrokerConnectorProvider
} from '../app'

import rabbitOpts from './rabbit-options'
import * as h from './shared/helper'

chai.use(spies)
const expect = chai.expect
const {
    Service: S,
} = constants

const {
    SERVICE_SLUG,
    HANDLER_NAME,
} = h.constants


let handlerMbConn: IMessageBrokerConnector,
    callerMbConn: IMessageBrokerConnector,
    rpcHandler: IMediateRpcHandler,
    config: IConfigurationProvider

// tslint:disable: no-floating-promises

describe('MediateRpcHandler', function () {
    this.timeout(5000)
    // this.timeout(60e3) // For debugging

    beforeEach(() => {
        config = h.mockConfigProvider({
            [S.SERVICE_SLUG]: SERVICE_SLUG,
        })
    })

    describe('init', () => {
        it('Should use existing message broker connector', () => {
            // Arrange
            const ConnProviderClass = mock<IMessageBrokerConnectorProvider>()
            const connector = new TopicMessageBrokerConnector(SERVICE_SLUG)
            rpcHandler = new MessageBrokerRpcHandler(instance(ConnProviderClass))

            // Act
            rpcHandler.init({
                connector,
                handlerName: HANDLER_NAME,
            })

            // Assert
            expect(rpcHandler['_msgBrokerConn']).to.equal(connector)
        })

        it('Should raise error if problems occur', (done) => {
            // Arrange
            const ERROR = 'Test error'

            const emitter = new EventEmitter()
            const ConnectorClass = mock<IMessageBrokerConnector>()
            when(ConnectorClass.onError(anyFunction())).thenCall((errorHandler: Function) => {
                emitter.on('error', errorHandler as any)
            })
            when(ConnectorClass.connect(anything())).thenResolve()
            when(ConnectorClass.disconnect()).thenResolve()
            const connector = instance(ConnectorClass)

            const stubConnector = {
                onError(errorHandler: Function) {
                    emitter.on('error', errorHandler as any)
                },
            }

            let MockConnProviderHandler
            let handler: IMediateRpcHandler
            h.mockMediateRpcHandler(config, false)
                .then(result => {
                    handler = result[0]
                    MockConnProviderHandler = result[2]
                    reset(MockConnProviderHandler)
                    when(MockConnProviderHandler.create(anything()))
                        .thenResolve(stubConnector as any) // Cannot thenResolve(connector) because of ts-mockito's bug
                    return handler.init({ handlerName: HANDLER_NAME })
                })
                .then(() => {
                    // Act
                    handler.onError(err => {
                        // Assert
                        expect(err).to.equal(ERROR)
                        connector.disconnect().then(() => done())
                    })

                    connector.connect(rabbitOpts.handler)
                        .then(() => {
                            emitter.emit('error', ERROR)
                        })
                })
        })

    }) // END describe 'init'

    describe('handle', () => {

        beforeEach(async () => {
            callerMbConn = new TopicMessageBrokerConnector(SERVICE_SLUG);
            [rpcHandler, handlerMbConn] = await h.mockMediateRpcHandler(config, false)

            handlerMbConn.onError((err) => {
                console.error('Handler error:\n', err)
            })

            callerMbConn.onError((err) => {
                console.error('Caller error:\n', err)
            })

            await Promise.all([
                handlerMbConn.connect(rabbitOpts.handler),
                callerMbConn.connect(rabbitOpts.caller),
            ])
            await rpcHandler.init({
                connector: handlerMbConn,
                handlerName: HANDLER_NAME,
            })
        })

        afterEach(async () => {
            await rpcHandler.dispose()
            await handlerMbConn.deleteQueue()
            await Promise.all([
                handlerMbConn.disconnect(),
                callerMbConn.disconnect(),
            ])
        })

        it('Should subscribe topic pattern on message broker.', (done) => {
            // Arrange
            const moduleName = 'accounts'
            const createAction = 'create'
            const correlationId = shortid.generate()
            const samplePayload = {
                text: 'eeeechooooo',
            }
            const createHandler: RpcHandlerFunction = function ({ payload, resolve }) {
                expect(payload).to.deep.equal(samplePayload)
                resolve()
                done()
            }

            // Act
            rpcHandler.handle({
                moduleName,
                actionName: createAction,
                handler: createHandler,
            })

            const replyTo = `response.${moduleName}.${createAction}@${correlationId}`

            rpcHandler.start()
                .then(() => {
                    const req: RpcRequest = {
                        from: moduleName,
                        to: '',
                        payload: samplePayload,
                    }
                    const topic = `request.${moduleName}.${createAction}`
                    // Manually publish request.
                    callerMbConn.publish(topic, req, { correlationId, replyTo }
                    )
                })

        })

        it('Should allow overriding topic subscription.', (done) => {
            // Arrange
            const moduleName = 'accounts'
            const createAction = 'create'
            const correlationId = shortid.generate()
            const samplePayload = {
                text: 'eeeechooooo',
            }
            const oldHandler: RpcHandlerFunction = function () {
                expect(false, 'Should not call old handler').to.be.true
            }

            const newHandler: RpcHandlerFunction = function ({ payload, resolve }) {
                expect(payload).to.deep.equal(samplePayload)
                resolve()
                done()
            }

            // Act
            rpcHandler.handle({
                moduleName,
                actionName: createAction,
                handler: oldHandler,
            })

            // Intentionally override old handler
            rpcHandler.handle({
                moduleName,
                actionName: createAction,
                handler: newHandler,
            })

            const replyTo = `response.${moduleName}.${createAction}@${correlationId}`

            rpcHandler.start()
                .then(() => {
                    const req: RpcRequest = {
                        from: moduleName,
                        to: '',
                        payload: samplePayload,
                    }
                    const topic = `request.${moduleName}.${createAction}`
                    // Manually publish request.
                    callerMbConn.publish(topic, req, { correlationId, replyTo }
                    )
                })

        })

        it('Should respond with expected result.', (done) => {
            // Arrange
            const moduleName = 'accounts'
            const createAction = 'create'
            const correlationId = shortid.generate()
            const result: any = {
                text: 'successsss',
            }
            const createHandler: RpcHandlerFunction = function ({ resolve }) {
                resolve(result)
            }

            // Act
            rpcHandler.handle({
                moduleName,
                actionName: createAction,
                handler: createHandler,
            })

            const replyTo = `response.${moduleName}.${createAction}@${correlationId}`

            callerMbConn.subscribe(replyTo)
                .then(() => callerMbConn.listen((msg: BrokerMessage) => {
                    // Assert
                    const response: RpcResponse = msg.data
                    expect(response).to.be.not.null
                    expect(response.isSuccess).to.be.true
                    expect(response.payload).to.deep.equal(result)
                    done()
                }))
                .then(() => rpcHandler.start())
                .then(() => {
                    const req: RpcRequest = {
                        from: moduleName,
                        to: '',
                        payload: {},
                    }
                    const topic = `request.${moduleName}.${createAction}`
                    // Manually publish response.
                    callerMbConn.publish(topic, req, { correlationId, replyTo })
                })
        })

        it('Should send message back to queue (nack) if no matched handler is found.', (done) => {
            // Arrange
            const moduleName = 'accounts'
            const createAction = 'create'
            const correlationId = shortid.generate()
            const topic = `request.${moduleName}.${createAction}`
            const result: any = {
                text: 'a message',
            }
            const spy = chai.spy()
            const replyTo = `response.${moduleName}.${createAction}@${correlationId}`
            const createHandler: RpcHandlerFunction = function ({ resolve, rawMessage }) {
                spy()
                const rawAmqpMsg: amqp.Message = (<BrokerMessage>rawMessage).raw
                expect(rawAmqpMsg.fields.redelivered).to.be.true
                resolve(result)
            }

            // Act
            // Not register any handler (rpcHandler.handle(..));

            // Set small time-to-live to reduce number of warning messages:
            //      "No handlers for request request.accounts.create"
            handlerMbConn.messageExpiredIn = 50

            // Force subscribing without handling function
            handlerMbConn.subscribe(topic)
                .then(() => callerMbConn.subscribe(replyTo))
                .then(() => callerMbConn.listen((msg: BrokerMessage) => {
                    // Assert
                    const response: RpcResponse = msg.data
                    expect(response).to.be.not.null
                    expect(response.isSuccess).to.be.true
                    expect(response.payload).to.deep.equal(result)
                    // Wait for all async tasks inside RPC handler to finish
                    setTimeout(() => done(), 200)
                }))
                .then(() => rpcHandler.start())
                .then(() => {
                    const req: RpcRequest = {
                        from: moduleName,
                        to: '',
                        payload: {},
                    }
                    // Manually publish response.
                    callerMbConn.publish(topic, req, { correlationId, replyTo })
                })
                // Register again... officially
                .then(() => setTimeout(() => {
                    rpcHandler.handle({
                        moduleName,
                        actionName: createAction,
                        handler: createHandler,
                    })
                }, 20)) // Delay time must be smaller than "messageExpiredIn"
        })

        it('Should respond with the custom error object for INTENDED rejection', (done) => {
            // Arrange
            const moduleName = 'accounts'
            const createAction = 'create'
            const correlationId = shortid.generate()
            const spy = chai.spy()
            const REASON = new MinorException('IntendedException')
            REASON.details = {
                why: 'An error string',
            }
            const createHandler: RpcHandlerFunction = function ({ reject }) {
                reject(REASON)
            }

            // Act
            rpcHandler.handle({
                moduleName,
                actionName: createAction,
                handler: createHandler,
            })

            // Assert: Not handler's fault
            rpcHandler.onError(err => {
                err && console.log(err)
                expect(err).not.to.exist
                spy()
            })

            const replyTo = `response.${moduleName}.${createAction}@${correlationId}`

            callerMbConn.subscribe(replyTo)
                .then(() => callerMbConn.listen((msg: BrokerMessage) => {
                    // Assert
                    const response: RpcResponse = msg.data
                    expect(response).to.exist
                    expect(response.isSuccess).to.be.false

                    const rpcError: RpcError = response.payload
                    expect(rpcError).to.exist
                    expect(rpcError.type).to.equal('MinorException')
                    expect(rpcError.details).to.deep.equal(REASON.details)
                    expect(spy).not.to.be.called
                    done()
                }))
                .then(() => rpcHandler.start())
                .then(() => {
                    const req: RpcRequest = {
                        from: moduleName,
                        to: '',
                        payload: {},
                    }
                    const topic = `request.${moduleName}.${createAction}`
                    // Manually publish response.
                    callerMbConn.publish(topic, req, { correlationId, replyTo })
                })
        })

        it('Should respond with the exception instance for INTENDED rejection', (done) => {
            // Arrange
            const moduleName = 'accounts'
            const createAction = 'create'
            const correlationId = shortid.generate()
            const spy = chai.spy()
            const errMsg = 'createException'
            const createHandler: RpcHandlerFunction = function ({ reject }) {
                reject(new MinorException(errMsg))
            }

            // Act
            rpcHandler.handle({
                moduleName,
                actionName: createAction,
                handler: createHandler,
            })

            // Assert: Not handler's fault
            rpcHandler.onError(err => {
                err && console.log(err)
                expect(err).not.to.exist
                spy()
            })

            const replyTo = `response.${moduleName}.${createAction}@${correlationId}`

            callerMbConn.subscribe(replyTo)
                .then(() => callerMbConn.listen((msg: BrokerMessage) => {
                    // Assert: Falsey response is returned
                    const response: RpcResponse = msg.data
                    expect(response).to.exist
                    expect(response.isSuccess).to.be.false

                    const rpcError: RpcError = response.payload
                    expect(rpcError).to.exist
                    expect(rpcError.type).to.equal('MinorException')
                    expect(rpcError.message).to.equal(errMsg)
                    expect(spy).not.to.be.called
                    done()
                }))
                .then(() => rpcHandler.start())
                .then(() => {
                    const req: RpcRequest = {
                        from: moduleName,
                        to: '',
                        payload: {},
                    }
                    const topic = `request.${moduleName}.${createAction}`
                    // Manually publish response.
                    callerMbConn.publish(topic, req, { correlationId, replyTo })
                })
        })

        it('Should respond with error type="InternalErrorException" when the handler returns rejected Promise', (done) => {
            // Arrange
            const moduleName = 'accounts'
            const createAction = 'create'
            const correlationId = shortid.generate()
            const spy = chai.spy()
            const errMsg = 'createException'
            const createHandler: RpcHandlerFunction = function () {
                return Promise.reject(new MinorException(errMsg))
            }

            // Act
            rpcHandler.handle({
                moduleName,
                actionName: createAction,
                handler: createHandler,
            })

            // Assert: Catch handler's fault
            rpcHandler.onError(err => {
                expect(err).to.exist
                spy()
            })

            const replyTo = `response.${moduleName}.${createAction}@${correlationId}`

            callerMbConn.subscribe(replyTo)
                .then(() => callerMbConn.listen((msg: BrokerMessage) => {
                    // Assert: Falsey response is returned
                    const response: RpcResponse = msg.data
                    expect(response).to.exist
                    expect(response.isSuccess).to.be.false

                    const rpcError: RpcError = response.payload
                    expect(rpcError).to.exist
                    expect(rpcError.type).to.equal('InternalErrorException')
                    expect(spy).to.be.called.once
                    done()
                }))
                .then(() => rpcHandler.start())
                .then(() => {
                    const req: RpcRequest = {
                        from: moduleName,
                        to: '',
                        payload: {},
                    }
                    const topic = `request.${moduleName}.${createAction}`
                    // Manually publish response.
                    callerMbConn.publish(topic, req, { correlationId, replyTo })
                })
        })

        it('Should respond with error type="InternalErrorException" when the handler throws Exception', (done) => {
            // Arrange
            const moduleName = 'accounts'
            const createAction = 'create'
            const correlationId = shortid.generate()
            const spy = chai.spy()
            const errMsg = 'createException'
            const createHandler: RpcHandlerFunction = function () {
                throw new MinorException(errMsg)
            }

            // Act
            rpcHandler.handle({
                moduleName,
                actionName: createAction,
                handler: createHandler,
            })

            // Assert: Catch handler's fault
            rpcHandler.onError(err => {
                expect(err).to.exist
                spy()
            })

            const replyTo = `response.${moduleName}.${createAction}@${correlationId}`

            callerMbConn.subscribe(replyTo)
                .then(() => callerMbConn.listen((msg: BrokerMessage) => {
                    // Assert: Falsey response is returned
                    const response: RpcResponse = msg.data
                    expect(response).to.exist
                    expect(response.isSuccess).to.be.false

                    const rpcError: RpcError = response.payload
                    expect(rpcError).to.exist
                    expect(rpcError.type).to.equal('InternalErrorException')
                    expect(spy).to.be.called.once
                    done()
                }))
                .then(() => rpcHandler.start())
                .then(() => {
                    const req: RpcRequest = {
                        from: moduleName,
                        to: '',
                        payload: {},
                    }
                    const topic = `request.${moduleName}.${createAction}`
                    // Manually publish response.
                    callerMbConn.publish(topic, req, { correlationId, replyTo })
                })
        })

        it('Should respond with error type="InternalErrorException" when the handler throws Error.', (done) => {
            // Arrange
            const moduleName = 'accounts'
            const deleteAction = 'delete'
            const errMsg = 'removeException'
            const correlationId = shortid.generate()
            const spy = chai.spy()
            const deleteHandler: RpcHandlerFunction = function () {
                throw new Error(errMsg)
            }

            // Act
            rpcHandler.handle({
                moduleName,
                actionName: deleteAction,
                handler: deleteHandler,
            })

            // Assert: Catch handler's fault
            rpcHandler.onError(err => {
                expect(err).to.exist
                spy()
            })

            const replyTo = `response.${moduleName}.${deleteAction}@${correlationId}`

            callerMbConn.subscribe(replyTo)
            .then(() => callerMbConn.listen((msg: BrokerMessage) => {
                    // Assert
                    const response: RpcResponse = msg.data
                    expect(response).to.exist
                    expect(response.isSuccess).to.be.false

                    const rpcError: RpcError = response.payload
                    expect(rpcError).to.exist
                    expect(rpcError.type).to.equal('InternalErrorException')
                    expect(spy).to.be.called.once
                    done()
                }))
                .then(() => rpcHandler.start())
                .then(() => {
                    const req: RpcRequest = {
                        from: moduleName,
                        to: '',
                        payload: {},
                    }
                    const topic = `request.${moduleName}.${deleteAction}`
                    // Manually publish response.
                    callerMbConn.publish(topic, req, { correlationId, replyTo })
                })
        })

    }) // END describe 'handle'
})
