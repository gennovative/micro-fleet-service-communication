import 'reflect-metadata';
import { expect } from 'chai';
import * as uuid from 'uuid';
import { injectable, DependencyContainer, MinorException } from 'back-lib-common-util';

import { MessageBrokerRpcHandler, IMessage, IConnectionOptions,
	TopicMessageBrokerConnector, IRpcRequest, IRpcResponse } from '../app';


const MODULE = 'TestHandler',
	CONTROLLER_NORM = Symbol('NormalProductController'),
	CONTROLLER_ERR = Symbol('ErrorProductController'),
	SUCCESS_ADD_PRODUCT = 'addProductOk',
	SUCCESS_DEL_PRODUCT = 'removeOk',
	ERROR_ADD_PRODUCT = 'addProductError',
	ERROR_DEL_PRODUCT = 'removeError';

const handlerOpts: IConnectionOptions = {
		hostAddress: '192.168.1.4',
		username: 'firstidea',
		password: 'gennova',
		queue: 'first-handler', // Queue for handler
		exchange: 'first-infras'
	},
	callerOpts: IConnectionOptions = {
		hostAddress: '192.168.1.4',
		username: 'firstidea',
		password: 'gennova',
		queue: 'first-caller', // Queue for handler
		exchange: 'first-infras'
	};

@injectable()
class NormalProductController {
	public addProduct(request: IRpcRequest, resolve: PromiseResolveFn, reject: PromiseRejectFn): void {
		resolve(SUCCESS_ADD_PRODUCT);
		console.log('Product added!');
	}

	public remove(request: IRpcRequest, resolve: PromiseResolveFn, reject: PromiseRejectFn): void {
		resolve(SUCCESS_DEL_PRODUCT);
		console.log('Product deleted!');
	}

	public echo(request: IRpcRequest, resolve: PromiseResolveFn, reject: PromiseRejectFn): void {
		resolve(request.params['text']);
	}
}

@injectable()
class ErrorProductController {
	public addProduct(request: IRpcRequest, resolve: PromiseResolveFn, reject: PromiseRejectFn): void {
		reject(ERROR_ADD_PRODUCT);
		console.log('Product adding failed!');
	}

	public remove(request: IRpcRequest, resolve: PromiseResolveFn, reject: PromiseRejectFn): void {
		console.log('Product deleting failed!');
		throw new MinorException(ERROR_DEL_PRODUCT);
	}
}

/*
class HandlerConfigurationProvider implements IConfigurationProvider {
	public enableRemote: boolean = false;

	public init(): Promise<void> {
		return Promise.resolve();
	}
	
	public dispose(): Promise<void> {
		return Promise.resolve();
	}

	public get(key: string): string {
		switch (key) {
			case S.MSG_BROKER_HOST:
				return '192.168.1.4';
			case S.MSG_BROKER_EXCHANGE:
				return 'first-infras';
			case S.MSG_BROKER_RECONN_TIMEOUT:
				return '3000';
			case S.MSG_BROKER_QUEUE:
				return 'first-handler'; // Queue for handler
			case S.MSG_BROKER_USERNAME:
				return 'firstidea';
			case S.MSG_BROKER_PASSWORD:
				return 'gennova';
			default:
				return null;
		}
	}

	public async fetch(): Promise<boolean> {
		return Promise.resolve(true);
	}
} // END HandlerConfigurationProvider

class CallerConfigurationProvider implements IConfigurationProvider {
	public enableRemote: boolean = false;

	public init(): Promise<void> {
		return Promise.resolve();
	}
	
	public dispose(): Promise<void> {
		return Promise.resolve();
	}

	public get(key: string): string {
		switch (key) {
			case S.MSG_BROKER_HOST:
				return '192.168.1.4';
			case S.MSG_BROKER_EXCHANGE:
				return 'first-infras';
			case S.MSG_BROKER_RECONN_TIMEOUT:
				return '3000';
			case S.MSG_BROKER_QUEUE:
				return 'first-caller'; // Queue for caller
			case S.MSG_BROKER_USERNAME:
				return 'firstidea';
			case S.MSG_BROKER_PASSWORD:
				return 'gennova';
			default:
				return null;
		}
	}

	public async fetch(): Promise<boolean> {
		return Promise.resolve(true);
	}
} // END CallerConfigurationProvider
//*/

let depContainer: DependencyContainer,
	handlerMbAdt: TopicMessageBrokerConnector,
	callerMbAdt: TopicMessageBrokerConnector,
	handler: MessageBrokerRpcHandler;

describe('MediateRpcHandler', () => {
	describe('init', () => {
		it('Should do nothing', () => {
			// Arrange
			let handler = new MessageBrokerRpcHandler(null, null);

			// Act
			handler.name = MODULE;
			handler.init();

			// Assert
			expect(handler.name).to.equal(MODULE);
		});
	}); // END describe 'init'

	describe('handle', function() {
		// Uncomment this to have longer time to step debug.
		//this.timeout(30000);
		
		beforeEach(done => {
			depContainer = new DependencyContainer();
			callerMbAdt = new TopicMessageBrokerConnector();
			handlerMbAdt = new TopicMessageBrokerConnector();
			handler = new MessageBrokerRpcHandler(depContainer, handlerMbAdt);
			
			handlerMbAdt.onError((err) => {
				console.error('Handler error:\n' + JSON.stringify(err));
			});
			
			callerMbAdt.onError((err) => {
				console.error('Caller error:\n' + JSON.stringify(err));
			});

			handler.name = MODULE;
			Promise.all([
				handlerMbAdt.connect(handlerOpts),
				callerMbAdt.connect(callerOpts)
			])
			.then(() => { done(); });
		});

		afterEach(done => {
			depContainer.dispose();
			Promise.all([
				handlerMbAdt.disconnect(),
				callerMbAdt.disconnect()
			])
			.then(() => { done(); });
		});

		it('Should subscribe topic pattern on message broker.', (done) => {
			// Arrange
			const ACTION = 'echo',
				TEXT = 'eeeechooooo';

			depContainer.bind<NormalProductController>(CONTROLLER_NORM, NormalProductController);

			// Act
			handler.handle(ACTION, CONTROLLER_NORM);

			// Assert
			let replyTo = `response.${MODULE}.${ACTION}`;

			callerMbAdt.subscribe(replyTo, (msg: IMessage) => {
				let response: IRpcResponse = msg.data;
				expect(response).to.be.not.null;
				expect(response.isSuccess).to.be.true;
				expect(response.data).to.equal(TEXT);
				done();
			})
			.then(() => {
				let req: IRpcRequest = {
					from: MODULE,
					to: '',
					params: {
						text: TEXT
					}
				};
				let topic = `request.${MODULE}.${ACTION}`;
				// Manually publish request.
				callerMbAdt.publish(topic, req, { correlationId: uuid.v4(), replyTo });
			});

		});

		it('Should respond with falsey result if controller rejects.', (done) => {
			// Arrange
			const ACTION = 'addProduct';
			
			depContainer.bind<ErrorProductController>(CONTROLLER_ERR, ErrorProductController);

			// Act
			handler.handle(ACTION, CONTROLLER_ERR);

			// Assert
			let replyTo = `response.${MODULE}.${ACTION}`;

			callerMbAdt.subscribe(replyTo, (msg: IMessage) => {
				let response: IRpcResponse = msg.data;
				expect(response).to.be.not.null;
				expect(response.isSuccess).to.be.false;
				expect(response.data).to.equal(ERROR_ADD_PRODUCT);
				done();
			})
			.then(() => {
				let req: IRpcRequest = {
					from: MODULE,
					to: '',
					params: {}
				};
				let topic = `request.${MODULE}.${ACTION}`;
				// Manually publish response.
				callerMbAdt.publish(topic, req, { correlationId: uuid.v4(), replyTo });
			});
		});

		it('Should respond with falsey result if there is internal error.', (done) => {
			// Arrange
			const ACTION = 'deleteProduct';

			depContainer.bind<ErrorProductController>(CONTROLLER_ERR, ErrorProductController);

			// Act
			handler.handle(ACTION, CONTROLLER_ERR, controller => controller.remove);

			// Assert
			let replyTo = `response.${MODULE}.${ACTION}`;

			callerMbAdt.subscribe(replyTo, (msg: IMessage) => {
				let response: IRpcResponse = msg.data;
				expect(response).to.be.not.null;
				expect(response.isSuccess).to.be.false;
				expect(response.data).to.equal(ERROR_DEL_PRODUCT);
				done();
			})
			.then(() => {
				let req: IRpcRequest = {
					from: MODULE,
					to: '',
					params: {}
				};
				let topic = `request.${MODULE}.${ACTION}`;
				// Manually publish response.
				callerMbAdt.publish(topic, req, { correlationId: uuid.v4(), replyTo });
			});
		});

	}); // END describe 'handle'
});