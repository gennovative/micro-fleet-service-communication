import 'reflect-metadata';
import { expect } from 'chai';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as requestMaker from 'request-promise-native';
import { MinorException, Exception } from 'back-lib-common-util';

import { HttpRpcCaller, ExpressRpcHandler, IDirectRpcHandler, IRpcRequest, IRpcResponse } from '../app';


const HANDLER_ADDR = 'localhost:3000',
	HANDLER_NAME = 'handler',
	CALLER_NAME = 'caller',
	TEXT_REQUEST = 'Test request',
	TEXT_RESPONSE = 'Test response',
	ACTION = 'getMessage';

describe('ExpressDirectRpcHandler', () => {
	describe('init', () => {
		it('Should do nothing', () => {
			// Arrange
			let caller = new HttpRpcCaller();
			caller.baseAddress = HANDLER_ADDR;

			// Act
			caller.init();

			// Assert
			expect(caller.baseAddress).to.equal(HANDLER_ADDR);
		});
	}); // END describe 'init'

	describe('call', () => {

		let server;

		afterEach(done => {
			if (server) {
				server.close(() => done());
				server = null;
			} else {
				done();
			}
		});

		it('Should make request and wait for response', done => {
			// Arrange
			let caller = new HttpRpcCaller(),
				app = express(),
				router = express.Router();

			caller.name = CALLER_NAME;
			caller.baseAddress = HANDLER_ADDR;
			
			// Prepare mock handler
			app.use(bodyParser.json()); // Parse JSON in POST request
			app.use(`/${HANDLER_NAME}`, router);

			router.get('/', (req, res) => res.send('Hello! Postman'));

			router.post(`/${ACTION}`, (req: express.Request, res: express.Response) => {
				let request: IRpcRequest = req.body;
				// Assert
				expect(request).to.exist;
				expect(request.params.msg).to.equal(TEXT_REQUEST);

				res.status(200).send({
					isSuccess: true,
					from: HANDLER_NAME,
					to: CALLER_NAME,
					data: {
						text: TEXT_RESPONSE
					}
				});
			});

			server = app.listen(3000, () => {
				caller.call(HANDLER_NAME, ACTION, {
					msg: TEXT_REQUEST
				})
				.then((res: IRpcResponse) => {
					// Assert
					expect(res).to.exist;
					expect(res.data.text).to.equal(TEXT_RESPONSE);
					done();
				})
				.catch(err => {
					expect(err).to.not.exist;
				});
			});
		});

		it('Should reject if problem occur', done => {
			// Arrange
			let caller = new HttpRpcCaller();

			caller.name = CALLER_NAME;
			caller.baseAddress = HANDLER_ADDR;

			// DirectRpcCaller.spec.js
			caller.call(HANDLER_NAME, ACTION, {
				msg: TEXT_REQUEST
			})
			.then((res: IRpcResponse) => {
				// Assert
				expect(res).to.not.exist;
			})
			.catch((err: Error) => {
				expect(err).to.exist;
				expect(err).to.be.a('Error');
				expect(err.message).to.include('ECONNREFUSED');
				done();
			});
		});

	}); // END describe 'call'
});
