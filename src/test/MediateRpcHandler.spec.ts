import * as amqp from 'amqplib';
import * as chai from 'chai';
import * as spies from 'chai-spies';
import * as shortid from 'shortid';
import delay = require('lodash/delay');

import { MessageBrokerRpcHandler, BrokerMessage, IMessageBrokerConnector, IMediateRpcHandler,
	TopicMessageBrokerConnector, IRpcRequest, IRpcResponse, RpcHandlerFunction } from '../app';

import rabbitOpts from './rabbit-options';
import { MinorException } from '@micro-fleet/common';

chai.use(spies);
const expect = chai.expect;


const NAME = 'TestHandler';

let handlerMbConn: IMessageBrokerConnector,
	callerMbConn: IMessageBrokerConnector,
	rpcHandler: IMediateRpcHandler;

describe('MediateRpcHandler', function () {
	// this.timeout(5000);
	this.timeout(60000); // For debugging

	describe('init', () => {
		it('Should raise error if problems occur', done => {
			// Arrange
			const ERROR = 'Test error';

			handlerMbConn = new TopicMessageBrokerConnector();
			rpcHandler = new MessageBrokerRpcHandler(
				handlerMbConn
			);

			// Act
			// handler.module = MODULE;
			rpcHandler.name = NAME;
			rpcHandler.init();
			rpcHandler.onError(err => {
				// Assert
				expect(err).to.equal(ERROR);
				handlerMbConn.disconnect().then(() => done());
			});

			handlerMbConn.connect(rabbitOpts.handler)
				.then(() => {
					handlerMbConn['_emitter'].emit('error', ERROR);
				});
		});

	}); // END describe 'init'

	describe('handle', () => {
		
		beforeEach(done => {
			callerMbConn = new TopicMessageBrokerConnector();
			handlerMbConn = new TopicMessageBrokerConnector();
			rpcHandler = new MessageBrokerRpcHandler(handlerMbConn);
			
			handlerMbConn.onError((err) => {
				console.error('Handler error:\n', err);
			});
			
			callerMbConn.onError((err) => {
				console.error('Caller error:\n', err);
			});

			rpcHandler.name = NAME;
			Promise.all([
				handlerMbConn.connect(rabbitOpts.handler),
				callerMbConn.connect(rabbitOpts.caller)
			])
			.then(() => rpcHandler.init())
			.then(() => done());
		});

		afterEach(async () => {
			await rpcHandler.dispose();
			await handlerMbConn.deleteQueue();
			await Promise.all([
				handlerMbConn.disconnect(),
				callerMbConn.disconnect()
			]);
		});

		it('Should subscribe topic pattern on message broker.', (done) => {
			// Arrange
			const moduleName = 'accounts';
			const createAction = 'create';
			const correlationId = shortid.generate();
			const payload = {
				text: 'eeeechooooo'
			};
			const createHandler: RpcHandlerFunction = (payload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest) => {
				expect(payload).to.deep.equal(payload);
				resolve();
				done();
			};

			// Act
			rpcHandler.handle(moduleName, createAction, createHandler);

			const replyTo = `response.${moduleName}.${createAction}@${correlationId}`;
			
			rpcHandler.start()
				.then(() => {
					const req: IRpcRequest = {
						from: moduleName,
						to: '',
						payload
					};
					const topic = `request.${moduleName}.${createAction}`;
					// Manually publish request.
					callerMbConn.publish(topic, req, { correlationId, replyTo }
					);
				});

		});

		it('Should allow overriding topic subscription.', (done) => {
			// Arrange
			const moduleName = 'accounts';
			const createAction = 'create';
			const correlationId = shortid.generate();
			const payload = {
				text: 'eeeechooooo'
			};
			const oldHandler: RpcHandlerFunction = (payload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest) => {
				expect(false, 'Should not call old handler').to.be.true;
			};

			const newHandler: RpcHandlerFunction = (payload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest) => {
				expect(payload).to.deep.equal(payload);
				resolve();
				done();
			};

			// Act
			rpcHandler.handle(moduleName, createAction, oldHandler);

			// Intentionally override old handler
			rpcHandler.handle(moduleName, createAction, newHandler);

			const replyTo = `response.${moduleName}.${createAction}@${correlationId}`;
			
			rpcHandler.start()
				.then(() => {
					const req: IRpcRequest = {
						from: moduleName,
						to: '',
						payload
					};
					const topic = `request.${moduleName}.${createAction}`;
					// Manually publish request.
					callerMbConn.publish(topic, req, { correlationId, replyTo }
					);
				});

		});

		it('Should respond with expected result.', (done) => {
			// Arrange
			const moduleName = 'accounts';
			const createAction = 'create';
			const correlationId = shortid.generate();
			const result: any = {
				text: 'successsss'
			};
			const createHandler: RpcHandlerFunction = (payload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest) => {
				resolve(result);
			};

			// Act
			rpcHandler.handle(moduleName, createAction, createHandler);

			const replyTo = `response.${moduleName}.${createAction}@${correlationId}`;
			
			callerMbConn.subscribe(replyTo)
				.then(() => callerMbConn.listen((msg: BrokerMessage) => {
					// Assert
					const response: IRpcResponse = msg.data;
					expect(response).to.be.not.null;
					expect(response.isSuccess).to.be.true;
					expect(response.payload).to.deep.equal(result);
					done();
				}))
				.then(() => rpcHandler.start())
				.then(() => {
					const req: IRpcRequest = {
						from: moduleName,
						to: '',
						payload: {}
					};
					const topic = `request.${moduleName}.${createAction}`;
					// Manually publish response.
					callerMbConn.publish(topic, req, { correlationId, replyTo });
				});
		});

		it('Should send message back to queue (nack) if no matched handler is found.', (done) => {
			// Arrange
			const moduleName = 'accounts';
			const createAction = 'create';
			const correlationId = shortid.generate();
			const topic = `request.${moduleName}.${createAction}`;
			const result: any = {
				text: 'a message'
			};
			const spy = chai.spy();
			const replyTo = `response.${moduleName}.${createAction}@${correlationId}`;
			const createHandler: RpcHandlerFunction = (payload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest, rawBrokerMessage: BrokerMessage) => {
				spy();
				const rawAmqpMsg: amqp.Message = rawBrokerMessage.raw;
				expect(rawAmqpMsg.fields.redelivered).to.be.true;
				resolve(result);
			};

			// Act
			// Not register any handler (rpcHandler.handle(..));

			// Force subscribing without handling function
			handlerMbConn.subscribe(topic)
				.then(() => callerMbConn.subscribe(replyTo))
				.then(() => callerMbConn.listen((msg: BrokerMessage) => {
					// Assert
					const response: IRpcResponse = msg.data;
					expect(response).to.be.not.null;
					expect(response.isSuccess).to.be.true;
					expect(response.payload).to.deep.equal(result);
					// Wait for all async tasks inside RPC handler to finish
					delay(() => done(), 1000);
				}))
				.then(() => rpcHandler.start())
				.then(() => {
					const req: IRpcRequest = {
						from: moduleName,
						to: '',
						payload: {}
					};
					// Manually publish response.
					callerMbConn.publish(topic, req, { correlationId, replyTo });
				})
				// Register again... officially
				.then(() => delay(() => {
					rpcHandler.handle(moduleName, createAction, createHandler);
				}, 1000));
		});

		it('Should emit error and respond with falsey result and InternalErrorException if handler rejects with non-MinorException.', (done) => {
			// Arrange
			const moduleName = 'accounts';
			const createAction = 'create';
			const correlationId = shortid.generate();
			const spy = chai.spy();
			const createHandler: RpcHandlerFunction = (payload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest) => {
				reject('An error string');
			};

			// Act
			rpcHandler.handle(moduleName, createAction, createHandler);

			rpcHandler.onError(err => {
				expect(err).to.exist;
				spy();
			});

			const replyTo = `response.${moduleName}.${createAction}@${correlationId}`;
			
			callerMbConn.subscribe(replyTo)
				.then(() => callerMbConn.listen((msg: BrokerMessage) => {
					// Assert
					const response: IRpcResponse = msg.data;
					expect(response).to.be.not.null;
					expect(response.isSuccess).to.be.false;
					expect(response.payload.type).to.equal('InternalErrorException');
					expect(spy).to.be.called.once;
					done();
				}))
				.then(() => rpcHandler.start())
				.then(() => {
					const req: IRpcRequest = {
						from: moduleName,
						to: '',
						payload: {}
					};
					const topic = `request.${moduleName}.${createAction}`;
					// Manually publish response.
					callerMbConn.publish(topic, req, { correlationId, replyTo });
				});
		});

		it('Should not emit eror but respond with falsey result and error object if controller throws MinorException', (done) => {
			// Arrange
			const moduleName = 'accounts';
			const createAction = 'create';
			const correlationId = shortid.generate();
			const spy = chai.spy();
			const errMsg = 'createException';
			const createHandler: RpcHandlerFunction = (payload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest) => {
				throw new MinorException(errMsg);
			};

			// Act
			rpcHandler.handle(moduleName, createAction, createHandler);

			// Assert: No error thrown
			rpcHandler.onError(err => {
				spy();
			});

			const replyTo = `response.${moduleName}.${createAction}@${correlationId}`;
			
			callerMbConn.subscribe(replyTo)
				.then(() => callerMbConn.listen((msg: BrokerMessage) => {
					// Assert: Falsey response is returned
					const response: IRpcResponse = msg.data;
					expect(response).to.be.not.null;
					expect(response.isSuccess).to.be.false;
					expect(response.payload.type).to.equal('MinorException');
					expect(response.payload.message).to.equal(errMsg);
					expect(spy).to.be.called.exactly(0);
					done();
				}))
				.then(() => rpcHandler.start())
				.then(() => {
					const req: IRpcRequest = {
						from: moduleName,
						to: '',
						payload: {}
					};
					const topic = `request.${moduleName}.${createAction}`;
					// Manually publish response.
					callerMbConn.publish(topic, req, { correlationId, replyTo });
				});
		});

		it('Should not emit error but respond with status 500 and exception object if handler returns a promise which rejects with MinorException.', (done) => {
			// Arrange
			const moduleName = 'accounts';
			const createAction = 'create';
			const correlationId = shortid.generate();
			const spy = chai.spy();
			const errMsg = 'createException';
			const createHandler: RpcHandlerFunction = (payload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest) => {
				return Promise.reject(new MinorException(errMsg));
			};

			// Act
			rpcHandler.handle(moduleName, createAction, createHandler);

			// Assert: No error thrown
			rpcHandler.onError(err => {
				spy();
			});

			const replyTo = `response.${moduleName}.${createAction}@${correlationId}`;
			
			callerMbConn.subscribe(replyTo)
				.then(() => callerMbConn.listen((msg: BrokerMessage) => {
					// Assert: Falsey response is returned
					const response: IRpcResponse = msg.data;
					expect(response).to.be.not.null;
					expect(response.isSuccess).to.be.false;
					expect(response.payload.type).to.equal('MinorException');
					expect(response.payload.message).to.equal(errMsg);
					expect(spy).to.be.called.exactly(0);
					done();
				}))
				.then(() => rpcHandler.start())
				.then(() => {
					const req: IRpcRequest = {
						from: moduleName,
						to: '',
						payload: {}
					};
					const topic = `request.${moduleName}.${createAction}`;
					// Manually publish response.
					callerMbConn.publish(topic, req, { correlationId, replyTo });
				});
		});

		it('Should emit error and respond with falsey result and InternalErrorException if there is internal Error.', (done) => {
			// Arrange
			const moduleName = 'accounts';
			const deleteAction = 'delete';
			const errMsg = 'removeException';
			const correlationId = shortid.generate();
			const spy = chai.spy();
			const deleteHandler: RpcHandlerFunction = (payload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest) => {
				throw new Error(errMsg);
			};

			// Act
			rpcHandler.handle(moduleName, deleteAction, deleteHandler);

			rpcHandler.onError(err => {
				expect(err).to.exist;
				spy();
			});

			const replyTo = `response.${moduleName}.${deleteAction}@${correlationId}`;
			
			callerMbConn.subscribe(replyTo)
			.then(() => callerMbConn.listen((msg: BrokerMessage) => {
					// Assert
					const response: IRpcResponse = msg.data;
					expect(response).to.be.not.null;
					expect(response.isSuccess).to.be.false;
					expect(response.payload.type).to.equal('InternalErrorException');
					expect(spy).to.be.called.once;
					done();
				}))
				.then(() => rpcHandler.start())
				.then(() => {
					const req: IRpcRequest = {
						from: moduleName,
						to: '',
						payload: {}
					};
					const topic = `request.${moduleName}.${deleteAction}`;
					// Manually publish response.
					callerMbConn.publish(topic, req, { correlationId, replyTo });
				});
		});

	}); // END describe 'handle'
});