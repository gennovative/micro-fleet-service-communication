import 'reflect-metadata';
import * as chai from 'chai';
import * as spies from 'chai-spies';
import * as express from 'express';
import * as requestMaker from 'request-promise';
import { MinorException } from '@micro-fleet/common';

import { ExpressRpcHandler, IRpcRequest, IRpcResponse, 
	RpcHandlerFunction } from '../app';

chai.use(spies);
const expect = chai.expect;


const NAME = 'TestHandler';


describe('ExpressDirectRpcHandler', function () {
	this.timeout(5000);
	// this.timeout(60000); // For debugging
	/*
	describe('init', () => {
		it('Should use provided express and router instances', () => {
			// Arrange
			const handler = new ExpressRpcHandler(new DependencyContainer()),
				app = express(),
				router = express.Router();

			// Act
			// handler.module = MODULE;
			handler.name = NAME;
			handler.init();

			// Assert
			expect(handler['_app']).to.equal(app);
			expect(handler['_router']).to.equal(router);
		});

		it('Should use `name` property to init Router', () => {
			// Arrange
			const handler = new ExpressRpcHandler(new DependencyContainer());

			// Act
			// handler.module = MODULE;
			handler.name = NAME;
			handler.init();

			// Assert
			const app: express.Express = handler['_app'];
			expect(app._router.stack).to.be.not.null;

			const router = app._router.stack.find((entry: any) => entry.name == 'router');
			expect(router).to.be.not.null;

			expect(`/${MODULE}`).to.match(router.regexp);
			expect(`/${handler.module}`).to.match(router.regexp);
		});
	});
	//*/

	describe('start', () => {
		it('Should raise error if problems occur', done => {
			// Arrange
			const handler = new ExpressRpcHandler(),
				app = express();

			handler.name = NAME;
			handler.init();

			// Start this server to make a port conflict
			const server = app.listen(handler.port, () => {

				handler.onError(err => {
					// Assert
					expect(err).to.exist;
					server.close(() => done());
				});

				// Act
				handler.start();
			});
		});
	});

	describe('handle', () => {
		let handler: ExpressRpcHandler;

		beforeEach(() => {
			handler = new ExpressRpcHandler();
			handler.name = NAME;
			handler.init();
		});

		afterEach(async () => {
			await handler.dispose();
		});

		it('Should add a router for each module name.', () => {
			// Arrange 1
			const accountModule = 'accounts';
			const createAction = 'create';
			const editAction = 'edit';
			const doCreate = () => { };
			const doEdit = () => { };

			// Act 1
			handler.handle(accountModule, createAction, doCreate);
			handler.handle(accountModule, editAction, doEdit);

			// Assert 1
			let routers: Map<string, express.Router> = handler['_routers'];
			let router: express.Router;
			expect(routers.has(accountModule)).to.be.true;
			router = routers.get(accountModule);
			expect(router.stack.length).to.equal(2);
			expect(router.stack[0].route.path).to.equal(`/${createAction}`);
			expect(router.stack[1].route.path).to.equal(`/${editAction}`);

			// Arrange 2
			const productModule = 'products';
			const deleteAction = 'delete';
			const doDelete = () => { };

			// Act 2
			handler.handle(productModule, deleteAction, doDelete);

			// Assert 2
			expect(routers.size).to.equal(2);
			expect(routers.has(productModule)).to.be.true;
			router = routers.get(productModule);
			expect(router.stack.length).to.equal(1);
			expect(router.stack[0].route.path).to.equal(`/${deleteAction}`);
		});

		it('Should parse and pass request parameters to action method.', done => {
			// Arrange
			const text = 'echo...echooooo';
			const moduleName = 'accounts';
			const createAction = 'create';
			const createHandler: RpcHandlerFunction = (payload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest) => {
				expect(payload.text).to.equal(text);
				expect(rawRequest.payload.text).to.equal(text);
				expect(rawRequest.to).to.equal(moduleName);
				resolve();
				done();
			};
				

			// Act
			handler.handle(moduleName, createAction, createHandler);

			// Assert
			handler.start()
				.then(() => {
					const request: IRpcRequest = {
						from: '',
						to: moduleName,
						payload: { text }
					};
					const options = {
						method: 'POST',
						uri: `http://localhost:${handler.port}/${moduleName}/${createAction}`,
						body: request,
						json: true
					};

					requestMaker(options)
						.catch(rawResponse => {
							console.error(rawResponse.error);
							expect(true, 'Request should be successful!').to.be.false;
						});
				});
		});

		it('Should respond with expected result', done => {
			// Arrange
			const moduleName = 'accounts';
			const createAction = 'create';
			const port = 10000;
			const result: any = {
				text: 'successsss'
			};
			const createHandler: RpcHandlerFunction = (payload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest) => {
				resolve(result);
			};

			// Act
			handler.port = port;
			handler.handle(moduleName, createAction, createHandler);

			handler.start()
				.then(() => {
					const options = {
						method: 'POST',
						uri: `http://localhost:${port}/${moduleName}/${createAction}`,
						body: {},
						json: true
					};

					requestMaker(options).then((res: IRpcResponse) => {
						expect(res.payload).to.deep.equal(result);
						done();
					})
					.catch(rawResponse => {
						expect(true, 'Request should be successful!').to.be.false;
					});
				});
		});

		it('Should emit error and respond with status 500 and InternalErrorException if handler rejects with non-MinorException.', done => {
			// Arrange
			const moduleName = 'accounts';
			const createAction = 'create';
			const spy = chai.spy();
			const createHandler: RpcHandlerFunction = (payload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest) => {
				reject('An error string');
			};

			// Act
			handler.handle(moduleName, createAction, createHandler);

			// Assert
			handler.onError(err => {
				expect(err).to.exist;
				spy();
			});

			handler.start()
				.then(() => {
					const options = {
						method: 'POST',
						uri: `http://localhost:${handler.port}/${moduleName}/${createAction}`,
						body: {},
						json: true
					};

					requestMaker(options).then((res: IRpcResponse) => {
						expect(res, 'Request should not be successful!').not.to.exist;
					})
					.catch(rawResponse => {
						expect(rawResponse.statusCode).to.equal(500);
						expect(rawResponse.error.payload.type).to.equal('InternalErrorException');
						expect(spy).to.be.called.once;
						done();
					});
				});
		});

		it('Should not emit error but respond with status 500 and exception object if handler throws MinorException.', done => {
			// Arrange
			const moduleName = 'products';
			const deleteAction = 'delete';
			const errMsg = 'removeException';
			const spy = chai.spy();
			const deleteHandler: RpcHandlerFunction = (payload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest) => {
				throw new MinorException(errMsg);
			};

			// Act
			handler.handle(moduleName, deleteAction, deleteHandler);

			// Assert
			handler.onError(err => {
				expect(err).to.exist;
				spy();
			});

			// Assert
			handler.start()
				.then(() => {
					const options = {
						method: 'POST',
						uri: `http://localhost:${handler.port}/${moduleName}/${deleteAction}`,
						body: {},
						json: true
					};

					requestMaker(options).then((res: IRpcResponse) => {
						// If status 200
						expect(res, 'Request should NOT be successful!').not.to.exist;
					})
					.catch(rawResponse => {
						// If status 500 or request error.
						expect(rawResponse.statusCode).to.equal(500);
						expect(rawResponse.error.payload.type).to.equal('MinorException');
						expect(rawResponse.error.payload.message).to.equal(errMsg);
						expect(spy).to.be.called.exactly(0);
						done();
					});
				});
		});

		it('Should not emit error but respond with status 500 and exception object if handler returns a promise which rejects with MinorException.', done => {
			// Arrange
			const moduleName = 'products';
			const deleteAction = 'delete';
			const errMsg = 'removeException';
			const spy = chai.spy();
			const deleteHandler: RpcHandlerFunction = (payload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest) => {
				return Promise.reject(new MinorException(errMsg));
			};

			// Act
			handler.handle(moduleName, deleteAction, deleteHandler);

			// Assert
			handler.onError(err => {
				expect(err).to.exist;
				spy();
			});

			// Assert
			handler.start()
				.then(() => {
					const options = {
						method: 'POST',
						uri: `http://localhost:${handler.port}/${moduleName}/${deleteAction}`,
						body: {},
						json: true
					};

					requestMaker(options).then((res: IRpcResponse) => {
						// If status 200
						expect(res, 'Request should NOT be successful!').not.to.exist;
					})
					.catch(rawResponse => {
						// If status 500 or request error.
						expect(rawResponse.statusCode).to.equal(500);
						expect(rawResponse.error.payload.type).to.equal('MinorException');
						expect(rawResponse.error.payload.message).to.equal(errMsg);
						expect(spy).to.be.called.exactly(0);
						done();
					});
				});
		});

		it('Should emit error and respond with status 500 and InternalErrorException if handler  throws Error.', done => {
			// Arrange
			const moduleName = 'products';
			const editAction = 'edit';
			const errMsg = 'editError';
			const spy = chai.spy();
			const editHandler: RpcHandlerFunction = (payload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest) => {
				throw new Error(errMsg);
			};

			// Act
			handler.handle(moduleName, editAction, editHandler);

			// Assert
			handler.onError(err => {
				expect(err).to.exist;
				spy();
			});

			handler.start()
				.then(() => {
					const options = {
						method: 'POST',
						uri: `http://localhost:${handler.port}/${moduleName}/${editAction}`,
						body: {},
						json: true
					};

					requestMaker(options).then((res: IRpcResponse) => {
						// If status 200
						expect(res, 'Request should NOT be successful!').not.to.exist;
					})
					.catch(rawResponse => {
						// If status 500 or request error.
						expect(rawResponse.statusCode).to.equal(500);
						expect(rawResponse.error.payload.type).to.equal('InternalErrorException');
						expect(spy).to.be.called.once;
						done();
					});
				});
		});

	}); // END describe handle
});