import { EventEmitter } from 'events'

import { expect } from 'chai'
import { instance, when, anyFunction } from 'ts-mockito'
import { MinorException, InternalErrorException } from '@micro-fleet/common'

import { MessageBrokerRpcCaller, BrokerMessage,
    RpcRequest, RpcResponse,
    IMessageBrokerConnectorProvider,
    IMediateRpcCaller,
    IMessageBrokerConnector,
} from '../app'
import * as h from './shared/helper'


const {
    CALLER_NAME,
    HANDLER_NAME,
} = h.constants

const CALLER_TIMEOUT = 3000, // Time to wait before cancel the request
    HANDLER_DELAY = 3500, // Enough to make caller's request time out
    CALLER_QUEUE_TTL = 1000 // Time to live of messages in caller's queue.


let globalHandlerMbConn: IMessageBrokerConnector,
    globalCallerMbConn: IMessageBrokerConnector,
    globalCaller: IMediateRpcCaller

// tslint:disable: no-floating-promises

describe('MessageBrokerRpcCaller', function() {
    this.timeout(10e3)
    // this.timeout(60e3) // For debugging

    describe('init', () => {

        afterEach(async () => {
            await globalCaller.dispose()
            globalCaller = null
        })

        it('Should use existing message broker connector', () => {
            // Arrange
            const ConnProviderClass = h.betterMock<IMessageBrokerConnectorProvider>()
            const ConnectorClass = h.betterMock<IMessageBrokerConnector>()
            when(ConnectorClass.queue).thenReturn('')
            const connector = instance(ConnectorClass)
            globalCaller = new MessageBrokerRpcCaller(instance(ConnProviderClass))

            // Act
            globalCaller.init({
                connector,
                callerName: CALLER_NAME,
                timeout: CALLER_TIMEOUT,
                messageExpiredIn: CALLER_QUEUE_TTL,
            })

            // Assert
            expect(globalCaller['_msgBrokerConn']).to.equal(connector)
        })

        it('Should raise error if problems occur', done => {

            const ERROR = 'Test error'

            const emitter = new EventEmitter()
            const ConnectorClass = h.betterMock<IMessageBrokerConnector>()
            when(ConnectorClass.queue).thenReturn('')
            when(ConnectorClass.onError(anyFunction())).thenCall((errorHandler: Function) => {
                emitter.on('error', errorHandler as any)
            })
            when(ConnectorClass.connect()).thenResolve()
            when(ConnectorClass.disconnect()).thenResolve()
            const connector = instance(ConnectorClass)

            h.mockMediateRpcCaller(false)
                .then(result => {
                    globalCaller = result[0]
                    connector.onError(err => globalCaller['$emitError'](err))
                    return globalCaller.init({
                        callerName: CALLER_NAME,
                        connector,
                    })
                })
                .then(() => {
                    // Act
                    globalCaller.onError(err => {
                        // Assert
                        expect(err).to.equal(ERROR)
                        connector.disconnect().then(() => done())
                    })

                    connector.connect()
                        .then(() => {
                            emitter.emit('error', ERROR)
                        })
                })
        })

    }) // END describe 'init'

    describe('call', function() {
        // Uncomment this to have longer time to step debug.
        // this.timeout(30e3);

        beforeEach(async () => {
            [globalCaller, globalCallerMbConn] = await h.mockMediateRpcCaller(false);
            [, globalHandlerMbConn] = await h.mockMediateRpcHandler(false)

            globalHandlerMbConn.onError((err) => {
                console.error('Handler error:\n' + JSON.stringify(err))
            })

            globalCaller.onError((err) => {
                console.error('Caller error:\n' + JSON.stringify(err))
            })

            await globalHandlerMbConn.connect()

            await globalCaller.init({
                connector: globalCallerMbConn,
                callerName: CALLER_NAME,
            })
        })

        afterEach(async function() {
            this.timeout(5000)
            await globalHandlerMbConn.stopListen()
            await Promise.all([
                globalHandlerMbConn.deleteQueue(),
                globalCaller.dispose(),
            ])
            await Promise.all([
                globalHandlerMbConn.disconnect(),
                globalCallerMbConn.disconnect(),
            ])
        })

        it('Should publish a topic pattern on message broker.', (done) => {
            // Arrange
            const ACTION = 'echo',
                TEXT = 'eeeechooooo'

            // This is the topic that caller should make
            const topic = `request.${HANDLER_NAME}.${ACTION}`

            globalHandlerMbConn.subscribe(topic)
                .then(() => globalHandlerMbConn.listen((msg: BrokerMessage) => {
                    const request: RpcRequest = msg.data

                    // Assert
                    expect(request).to.be.not.null
                    expect(request.from).to.equal(CALLER_NAME)
                    expect(request.to).to.equal(HANDLER_NAME)
                    expect(request.payload.text).to.equal(TEXT)
                    done()
                }))
                // Act
                .then(() => globalCaller.callImpatient({
                    moduleName: HANDLER_NAME,
                    actionName: ACTION,
                    params: { text: TEXT },
                }))
                .catch(err => {
                    if (err.message == 'Response waiting timeout') { return }
                    console.error(err)
                    expect(err).not.to.exist
                })
        })

        it('Should publish then wait for response.', (done) => {
            // Arrange
            const ACTION = 'echo',
                TEXT = 'eeeechooooo'

            // This is the topic that caller should make
            const topic = `request.${HANDLER_NAME}.${ACTION}`

            globalHandlerMbConn.subscribe(topic)
                .then(() => {
                    return globalHandlerMbConn.listen((msg: BrokerMessage) => {
                        const request: RpcRequest = msg.data,
                            props = msg.properties,
                            response: RpcResponse = {
                                isSuccess: true,
                                from: request.to,
                                to: request.from,
                                payload: {
                                    text: TEXT,
                                },
                            }
                        globalHandlerMbConn.publish(props.replyTo, response, { correlationId: props.correlationId })
                    })
                })
                .then(() => {
                    // Act
                    return globalCaller.call({
                        moduleName: HANDLER_NAME,
                        actionName: ACTION,
                    })
                })
                .then((res: RpcResponse) => {
                    // Assert
                    expect(res).to.be.not.null
                    expect(res.from).to.equal(HANDLER_NAME)
                    expect(res.to).to.equal(CALLER_NAME)
                    expect(res.payload.text).to.equal(TEXT)
                    done()
                })
                .catch(err => {
                    console.error(err)
                    expect(err).not.to.exist
                })
        })

        it('Should reject when response says it unsuccessful.', (done) => {
            // Arrange
            const ACTION = 'echo',
                ERROR_MSG = 'errrrorrr'

            // This is the topic that caller should make
            const topic = `request.${HANDLER_NAME}.${ACTION}`

            globalHandlerMbConn.subscribe(topic)
                .then(() => {
                    return globalHandlerMbConn.listen((msg: BrokerMessage) => {
                        const request: RpcRequest = msg.data,
                            props = msg.properties,
                            response: RpcResponse = {
                                isSuccess: false,
                                from: request.to,
                                to: request.from,
                                payload: {
                                    type: 'InternalErrorException',
                                    message: ERROR_MSG,
                                },
                            }
                        globalHandlerMbConn.publish(props.replyTo, response, { correlationId: props.correlationId })
                    })
                })
                .then(() => {
                    // Act
                    return globalCaller.call({
                        moduleName: HANDLER_NAME,
                        actionName: ACTION,
                    })
                })
                .then((res: RpcResponse) => {
                    // Assert
                    console.error(res)
                    expect(res, 'Should not be successful').not.to.exist
                })
                .catch(err => {
                    expect(err).to.be.instanceOf(InternalErrorException)
                    expect(err.message).to.equal(ERROR_MSG)
                    done()
                })
        })

        it('Should reject if an error occurs', done => {
            // Arrange
            const ACTION = 'echo'

            // This is the topic that caller should make
            const topic = `request.${HANDLER_NAME}.${ACTION}`

            globalHandlerMbConn.subscribe(topic)
                .then(() => {
                    return globalHandlerMbConn.listen((msg: BrokerMessage) => {
                        expect(true, 'Should NOT get any request!').to.be.false
                    })
                }).then(() => {
                    // Disconnect to cause error when making call.
                    return globalCallerMbConn.disconnect()
                })
                .then(() => {
                    // Act
                    return globalCaller.call({
                        moduleName: HANDLER_NAME,
                        actionName: ACTION,
                    })
                })
                .then((res: RpcResponse) => {
                    expect(res, 'Should NOT get any response!').not.to.exist
                })
                .catch(err => {
                    // Assert
                    expect(err).to.exist
                    expect(err).to.be.instanceOf(MinorException)
                    done()
                })
        })

    }) // END describe 'call'

    describe('call - timeout', () => {
        beforeEach(async () => {
            [globalCaller, globalCallerMbConn] = await h.mockMediateRpcCaller(false);
            [, globalHandlerMbConn] = await h.mockMediateRpcHandler(false)

            globalHandlerMbConn.onError((err) => {
                console.error('Handler error:\n' + JSON.stringify(err))
            })

            globalCaller.onError((err) => {
                console.error('Caller error:\n' + JSON.stringify(err))
            })

            globalCallerMbConn.messageExpiredIn = CALLER_QUEUE_TTL
            globalHandlerMbConn.messageExpiredIn = CALLER_QUEUE_TTL

            await globalHandlerMbConn.connect()

            await globalCaller.init({
                connector: globalCallerMbConn,
                callerName: CALLER_NAME,
                timeout: CALLER_TIMEOUT,
            })
        })

        afterEach(async function() {
            this.timeout(5000)
            await globalHandlerMbConn.stopListen()
            await Promise.all([
                globalHandlerMbConn.deleteQueue(),
                globalCaller.dispose(),
            ])
            await Promise.all([
                globalHandlerMbConn.disconnect(),
                globalCallerMbConn.disconnect(),
            ])
        })

        it('Should reject if request times out', function (done) {
            // Arrange
            const ACTION = 'echo',
                TEXT = 'eeeechooooo'


            // Unit test timeout
            this.timeout(CALLER_TIMEOUT + HANDLER_DELAY + 3000)

            // This is the topic that caller should make
            const topic = `request.${HANDLER_NAME}.${ACTION}`

            // Step 1: Caller sends a request, waits in CALLER_TIMEOUT millisecs,
            //         then stops waiting for response.
            // Step 2: Handler waits in HANDLER_DELAY millisecs to let caller time out, then sends response.
            // Step 3: The response stays in caller's queue for CALLER_QUEUE_TTL millisecs, then
            //         is deleted by broker.
            let replyTo: string
            globalHandlerMbConn.subscribe(topic)
                .then(() => {
                    return globalHandlerMbConn.listen((msg: BrokerMessage) => {
                        expect(msg).to.exist
                        replyTo = msg.properties.replyTo
                        // Step 2
                        setTimeout(() => {
                            globalHandlerMbConn.publish(
                                replyTo,
                                { text: TEXT },
                                {
                                    correlationId: msg.properties.correlationId,
                                }
                            )
                        }, HANDLER_DELAY)
                        // Do nothing and let request time out!
                    })
                })
                .then(() => {
                    // Act
                    // Step 1
                    globalCaller['$timeout'] = CALLER_TIMEOUT
                    return globalCaller.call({
                        moduleName: HANDLER_NAME,
                        actionName: ACTION,
                    })
                })
                .then((res: RpcResponse) => {
                    expect(res, 'Should NOT get any response!').not.to.exist
                })
                .catch(err => {
                    // Assert
                    expect(err).to.exist
                    expect(err).to.be.instanceOf(MinorException)
                    expect(err.message).to.equal('Response waiting timeout')

                    // Step 3: Waits for response message to die
                    setTimeout(async () => {
                        await globalCallerMbConn.subscribe(replyTo)
                        await globalCallerMbConn.listen(msg => {
                            expect(msg, 'No message should be in caller queue').not.to.exist
                        })

                        // Waits 1s to make sure no message is left
                        setTimeout(done, 1000)

                    }, CALLER_QUEUE_TTL + 500)
                })
        })
    }) // END describe 'Timeout'
})
