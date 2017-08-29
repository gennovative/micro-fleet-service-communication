# Gennova backend service communication library

Provides methods for microservices to communicate with each other.

See more examples and usage guide in unit test.

## INSTALLATION

`npm i`: To install dependencies.
`gulp` to transpile TypeScript.

## DEVELOPMENT

`gulp watch`: To transpile and watch for edit.

## RELEASE

`gulp release`: To transpile and create `app.d.ts` definition file.

---
## VERSIONS

### 0.2.0
- Moved **MessageBrokerAddOn**, **DirectRpcHandlerAddOnBase** and **MediateRpcHandlerAddOnBase** from `back-lib-foundation`.
- RPC Handlers have module name and service name.
- RPC Callers rebuild exception object received from handlers.
- Test coverage: 85%

### 0.1.0
- *HttpRpcCaller*: Makes direct RPC calls via HTTP to an *ExpressRpcHandler* endpoint.
- *ExpressRpcHandler*: Listens and handles requests from *HttpRpcCaller*.
- *MessageBrokerRpcCaller*: Sends RPC requests to message broker and waits for response.
- *MessageBrokerRpcHandler*: Listens and handles requests from message broker.
- *TopicMessageBrokerConnector*: Underlying class that supports *MessageBrokerRpcCaller* and *MessageBrokerRpcHandler* to connect to RabbitMQ message broker.
- Will be marked as v1.0.0 when test coverage >= 90%