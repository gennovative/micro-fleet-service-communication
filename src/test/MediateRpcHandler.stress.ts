import * as shortid from 'shortid'

import { MessageBrokerRpcHandler, BrokerMessage,
    TopicMessageBrokerConnector, RpcRequest, RpcHandlerFunction } from '../app'

import rabbitOpts from './rabbit-options'


const NAME = 'TestHandler'

let handlerMbConn: TopicMessageBrokerConnector,
    callerMbConn: TopicMessageBrokerConnector,
    rpcHandler: MessageBrokerRpcHandler

describe.skip('MediateRpcHandler', function() {
    // Disable timeout to let stress test run forever.
    this.timeout(0)

    beforeEach(done => {
        callerMbConn = new TopicMessageBrokerConnector()
        handlerMbConn = new TopicMessageBrokerConnector()
        rpcHandler = new MessageBrokerRpcHandler(handlerMbConn)

        handlerMbConn.onError((err) => {
                console.error('Handler error:\n' + JSON.stringify(err))
            })

            callerMbConn.onError((err) => {
                console.error('Caller error:\n' + JSON.stringify(err))
            })

            rpcHandler.name = NAME
            Promise.all([
                handlerMbConn.connect(rabbitOpts.handler),
                callerMbConn.connect(rabbitOpts.caller),
            ])
            .then(() => rpcHandler.init())
            .then(() => { done() })
    })

    afterEach(done => {
        Promise.all([
            handlerMbConn.disconnect(),
            callerMbConn.disconnect(),
        ])
        .then(() => { done() })
    })

    it('Should handle requests as much as it could.', (done) => {
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

        // Assert
        const replyTo = `response.${moduleName}.${createAction}@${correlationId}`
        let start: number, end: number

        callerMbConn.subscribe(replyTo)
            .then(() => {
                return handlerMbConn.listen((msg: BrokerMessage) => {
                    end = new Date().getTime()
                    console.log(`Response after ${end - start}ms`)
                })
            })
            .then(() => rpcHandler.start())
            .then(() => {
                const req: RpcRequest = {
                    from: moduleName,
                    to: '',
                    payload: {},
                }

                const SENDING_GAP = 100 // ms
                setInterval(() => {
                    // Manually publish request.
                    start = new Date().getTime()
                    console.log('Request')
                    const topic = `request.${moduleName}.${createAction}`
                    callerMbConn.publish(topic, req, { correlationId, replyTo })
                }, SENDING_GAP) // END setInterval
            })

    })
})
