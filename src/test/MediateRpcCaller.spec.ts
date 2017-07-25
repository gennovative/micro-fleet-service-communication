import 'reflect-metadata';
import { expect } from 'chai';
import { MinorException } from 'back-lib-common-util';

import { MessageBrokerRpcCaller, IMessage,
	TopicMessageBrokerConnector, IRpcRequest, IRpcResponse } from '../app';

import rabbitOpts from './rabbit-options';


const CALLER_MODULE = 'TestCaller',
	HANDLER_MODULE = 'TestHandler';


let handlerMbConn: TopicMessageBrokerConnector,
	callerMbConn: TopicMessageBrokerConnector,
	caller: MessageBrokerRpcCaller;

describe('MessageBrokerRpcCaller', () => {
	describe('init', () => {
		it('Should do nothing', () => {
			// Arrange
			let caller = new MessageBrokerRpcCaller(new TopicMessageBrokerConnector());

			// Act
			caller.name = CALLER_MODULE;
			caller.init();

			// Assert
			expect(caller.name).to.equal(CALLER_MODULE);
		});
	}); // END describe 'init'
	
	describe('call', function() {
		// Uncomment this to have longer time to step debug.
		//this.timeout(30000);
		
		beforeEach(done => {
			callerMbConn = new TopicMessageBrokerConnector();
			handlerMbConn = new TopicMessageBrokerConnector();
			caller = new MessageBrokerRpcCaller(callerMbConn);
			
			handlerMbConn.onError((err) => {
				console.error('Handler error:\n' + JSON.stringify(err));
			});
			
			callerMbConn.onError((err) => {
				console.error('Caller error:\n' + JSON.stringify(err));
			});

			caller.name = CALLER_MODULE;
			Promise.all([
				handlerMbConn.connect(rabbitOpts.handler),
				callerMbConn.connect(rabbitOpts.caller)
			])
			.then(() => { done(); })
			.catch(err => {
				console.error(err);
			});
		});

		afterEach(done => {
			console.warn('After each: Trying to diconnect from message broker!');
			Promise.all([
				handlerMbConn.disconnect(),
				callerMbConn.disconnect()
			])
			.then(() => { 
				console.warn('After each: diconnected from message broker!');
				done(); 
			})
			.catch(err => {
				console.error(err);
			});
		});

		it('Should publish a topic pattern on message broker.', (done) => {
			// Arrange
			const ACTION = 'echo',
				TEXT = 'eeeechooooo';

			// This is the topic that caller should make
			let topic = `request.${HANDLER_MODULE}.${ACTION}`;

			handlerMbConn.subscribe(topic, (msg: IMessage) => {
				let request: IRpcRequest = msg.data;
			
				// Assert
				expect(request).to.be.not.null;
				expect(request.from).to.equal(CALLER_MODULE);
				expect(request.to).to.equal(HANDLER_MODULE);
				expect(request.params.text).to.equal(TEXT);
				done();
			})
			.then(() => {
				// Act
				caller.call(HANDLER_MODULE, ACTION, { text: TEXT });
			})
			.catch(err => {
				console.error(err);
			});
		});

		it('Should publish then wait for response.', (done) => {
			// Arrange
			const ACTION = 'echo',
				TEXT = 'eeeechooooo';

			// This is the topic that caller should make
			let topic = `request.${HANDLER_MODULE}.${ACTION}`;

			handlerMbConn.subscribe(topic, (msg: IMessage) => {
				let request: IRpcRequest = msg.data,
					props = msg.properties,
					response: IRpcResponse = {
					isSuccess: false,
					from: request.to,
					to: request.from,
					data: {
						text: TEXT
					}
				};
				handlerMbConn.publish(props.replyTo, response, { correlationId: props.correlationId });
			})
			.then(() => {
				// Act
				return caller.call(HANDLER_MODULE, ACTION);
			})
			.then((res: IRpcResponse) => {
				// Assert
				expect(res).to.be.not.null;
				expect(res.from).to.equal(HANDLER_MODULE);
				expect(res.to).to.equal(CALLER_MODULE);
				expect(res.data.text).to.equal(TEXT);
				console.warn('Got and checked response!');
				done();
			})
			.catch(err => {
				console.error(err);
			});
		});

		it('Should reject if an error occurs', done => {
			// Arrange
			const ACTION = 'echo',
				TEXT = 'eeeechooooo';

			// This is the topic that caller should make
			let topic = `request.${HANDLER_MODULE}.${ACTION}`;

			handlerMbConn.subscribe(topic, (msg: IMessage) => {
				expect(true, 'Should NOT get any request!').to.be.false;
			})
			.then(() => {
				return callerMbConn.disconnect();
			})
			.then(() => {
				// Act
				return caller.call(HANDLER_MODULE, ACTION);
			})
			.then((res: IRpcResponse) => {
				expect(true, 'Should NOT get any response!').to.be.false;
			})
			.catch(err => {
				// Assert
				expect(err).to.be.not.null;
				expect(err).to.be.instanceOf(MinorException);
				done();
			});
		});

	}); // END describe 'call'
});