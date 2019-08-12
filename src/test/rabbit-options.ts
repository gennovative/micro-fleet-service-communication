import { MessageBrokerConnectionOptions } from '../app'

export default {
    handler: <MessageBrokerConnectionOptions> {
        hostAddress: 'localhost',
        username: 'guest',
        password: 'guest',
        handlerQueue: 'my-handler', // Queue for handler,
                                // in reality, each service must have its own queue
                                // (service instances of the same type can share same queue)
        exchange: 'gennovative',
        messageExpiredIn: 3000,
    },
    caller: <MessageBrokerConnectionOptions> {
        hostAddress: 'localhost',
        username: 'guest',
        password: 'guest',
        // handlerQueue: false, // Caller must use anonymous queue to receive responses
                    // for its own requests, which means each service instances must
                    // have a unique queue.
        exchange: 'gennovative',
        messageExpiredIn: 3000,
    },
}
