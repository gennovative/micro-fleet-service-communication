import * as amqp from 'amqplib'
import * as chai from 'chai'
import * as spies from 'chai-spies'
import * as shortid from 'shortid'
import delay = require('lodash/delay')
import { MinorException } from '@micro-fleet/common'

import { MessageBrokerRpcHandler, BrokerMessage, IMessageBrokerConnector, IMediateRpcHandler,
    TopicMessageBrokerConnector, RpcRequest, RpcResponse, RpcHandlerFunction, RpcError } from '../app'

import rabbitOpts from './rabbit-options'

chai.use(spies)
const expect = chai.expect


const NAME = 'TestHandler'

let handlerMbConn: IMessageBrokerConnector,
    callerMbConn: IMessageBrokerConnector,
    rpcHandler: IMediateRpcHandler

describe('MediateRpcHandler', function () {
    this.timeout(5000)
    // this.timeout(60000) // For debugging

    describe('init', () => {
        it('Should raise error if problems occur', (done) => {
            // Arrange
            const ERROR = 'Test error'

            handlerMbConn = new TopicMessageBrokerConnector()
            rpcHandler = new MessageBrokerRpcHandler(
                handlerMbConn
            )

            // Act
            // handler.module = MODULE;
            rpcHandler.name = NAME
            rpcHandler.init()
            rpcHandler.onError(err => {
                // Assert
                expect(err).to.equal(ERROR)
                handlerMbConn.disconnect().then(() => done())
            })

            handlerMbConn.connect(rabbitOpts.handler)
                .then(() => {
                    handlerMbConn['_emitter'].emit('error', ERROR)
                })
        })

    }) // END describe 'init'

    describe('handle', () => {

        beforeEach((done) => {
            callerMbConn = new TopicMessageBrokerConnector()
            handlerMbConn = new TopicMessageBrokerConnector()
            rpcHandler = new MessageBrokerRpcHandler(handlerMbConn)

            handlerMbConn.onError((err) => {
                console.error('Handler error:\n', err)
            })

            callerMbConn.onError((err) => {
                console.error('Caller error:\n', err)
            })

            rpcHandler.name = NAME
            Promise.all([
                handlerMbConn.connect(rabbitOpts.handler),
                callerMbConn.connect(rabbitOpts.caller),
            ])
            .then(() => rpcHandler.init())
            .then(() => done())
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
            rpcHandler.handle(moduleName, createAction, createHandler)

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
            rpcHandler.handle(moduleName, createAction, oldHandler)

            // Intentionally override old handler
            rpcHandler.handle(moduleName, createAction, newHandler)

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
            rpcHandler.handle(moduleName, createAction, createHandler)

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
                    delay(() => done(), 200)
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
                .then(() => delay(() => {
                    rpcHandler.handle(moduleName, createAction, createHandler)
                }, 20)) // Delay time must be smaller than "messageExpiredIn"
        })

        it('Should respond with the custom error object for INTENDED rejection', (done) => {
            // Arrange
            const moduleName = 'accounts'
            const createAction = 'create'
            const correlationId = shortid.generate()
            const spy = chai.spy()
            const REASON = {
                why: 'An error string',
            }
            const createHandler: RpcHandlerFunction = function ({ reject }) {
                reject(REASON)
            }

            // Act
            rpcHandler.handle(moduleName, createAction, createHandler)

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
                    expect(rpcError.details.why).to.equal(REASON.why)
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
            rpcHandler.handle(moduleName, createAction, createHandler)

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

        it('Should respond with InternalErrorException when the handler returns rejected Promise', (done) => {
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
            rpcHandler.handle(moduleName, createAction, createHandler)

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

        it('Should respond with InternalErrorException when the handler throws Exception', (done) => {
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
            rpcHandler.handle(moduleName, createAction, createHandler)

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

        it('Should respond with InternalErrorException when the handler throws Error.', (done) => {
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
            rpcHandler.handle(moduleName, deleteAction, deleteHandler)

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
