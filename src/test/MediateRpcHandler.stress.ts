import 'reflect-metadata';
import * as uuid from 'uuid';
import { injectable, DependencyContainer } from 'back-lib-common-util';

import { IMediateRpcHandler, MessageBrokerRpcHandler, IMessage, IConnectionOptions,
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
	handlerMbConn: TopicMessageBrokerConnector,
	callerMbConn: TopicMessageBrokerConnector,
	handler: MessageBrokerRpcHandler;

describe.skip('MediateRpcHandler', function() {
	// Disable timeout to let stress test run forever.
	this.timeout(0);

	// MediateRpcHandler.spec.js
	// MessageBrokerAdapter.js

	beforeEach(done => {
		depContainer = new DependencyContainer();
		callerMbConn = new TopicMessageBrokerConnector();
		handlerMbConn = new TopicMessageBrokerConnector();
		handler = new MessageBrokerRpcHandler(depContainer, handlerMbConn);

		handlerMbConn.onError((err) => {
				console.error('Handler error:\n' + JSON.stringify(err));
			});
			
			callerMbConn.onError((err) => {
				console.error('Caller error:\n' + JSON.stringify(err));
			});

			handler.name = MODULE;
			Promise.all([
				handlerMbConn.connect(handlerOpts),
				callerMbConn.connect(callerOpts)
			])
			.then(() => { done(); });
	});

	afterEach(done => {
		depContainer.dispose();
		Promise.all([
				handlerMbConn.disconnect(),
				callerMbConn.disconnect()
			])
		.then(() => { done(); });
	});

	it('Should handle requests as much as it could.', (done) => {
		// Arrange
		const ACTION = 'echo',
			TEXT = 'eeeechooooo';
		
		depContainer.bind<NormalProductController>(CONTROLLER_NORM, NormalProductController);

		// Act
		handler.handle(ACTION, CONTROLLER_NORM);

		// Assert
		let replyTo = `response.${MODULE}.${ACTION}`,
			start, end;
		
		callerMbConn.subscribe(replyTo, (msg: IMessage) => {
			let response: IRpcResponse = msg.data;
			end = new Date().getTime();
			console.log(`Response after ${end - start}ms`);
		})
		.then(() => {
			let req: IRpcRequest = {
				from: MODULE,
				to: '',
				params: {
					text: TEXT
				}
			};

			const SENDING_GAP = 100; //ms
			setInterval(() => {
				// Manually publish request.
				start = new Date().getTime();
				console.log('Request');
				callerMbConn.publish(`request.${MODULE}.${ACTION}`, req, { correlationId: uuid.v4(), replyTo });
			}, SENDING_GAP); // END setInterval
		});

	});
});