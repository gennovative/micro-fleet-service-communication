import 'reflect-metadata';
import { expect } from 'chai';
import * as express from 'express';
import * as requestMaker from 'request-promise-native';
import { inject, injectable, DependencyContainer, MinorException, Exception } from 'back-lib-common-util';

import { ExpressRpcHandler, IDirectRpcHandler, IRpcRequest, IRpcResponse } from '../app';

const MODULE = 'TestHandler',
	CONTROLLER_NORM = Symbol('NormalProductController'),
	CONTROLLER_ERR = Symbol('ErrorProductController'),
	SUCCESS_ADD_PRODUCT = 'addProductOk',
	SUCCESS_DEL_PRODUCT = 'removeOk',
	ERROR_ADD_PRODUCT = 'addProductError',
	ERROR_DEL_PRODUCT = 'removeError';

@injectable()
class NormalProductController {
	public addProduct(requestPayload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest): void {
		resolve(SUCCESS_ADD_PRODUCT);
		console.log('Product added!');
	}

	public remove(requestPayload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest): void {
		resolve(SUCCESS_DEL_PRODUCT);
		console.log('Product deleted!');
	}

	public echo(requestPayload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest): void {
		resolve(requestPayload['text']);
	}
}

@injectable()
class ErrorProductController {
	public addProduct(requestPayload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest): void {
		reject(ERROR_ADD_PRODUCT);
		console.log('Product adding failed!');
	}

	public remove(requestPayload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest): void {
		console.log('Product deleting failed!');
		throw new MinorException(ERROR_DEL_PRODUCT);
	}
}

describe('ExpressDirectRpcHandler', () => {
	describe('init', () => {
		it('Should use provided express and router instances', () => {
			// Arrange
			let handler = new ExpressRpcHandler(new DependencyContainer()),
				app = express(),
				router = express.Router();

			// Act
			handler.name = MODULE;
			handler.init({
				expressApp: app,
				expressRouter: router
			});

			// Assert
			expect(handler['_app']).to.equal(app);
			expect(handler['_router']).to.equal(router);
		});

		it('Should use `name` property to init Router', () => {
			// Arrange
			let handler = new ExpressRpcHandler(new DependencyContainer());

			// Act
			handler.name = MODULE;
			handler.init();

			// Assert
			let app: express.Express = handler['_app'];
			expect(app._router.stack).to.be.not.null;

			let router = app._router.stack.find(entry => entry.name == 'router');
			expect(router).to.be.not.null;

			expect(`/${MODULE}`).to.match(router.regexp);
			expect(`/${handler.name}`).to.match(router.regexp);
		});
	});

	describe('start', () => {
		it('Should raise error if problems occur', done => {
			// Arrange
			let handler = new ExpressRpcHandler(new DependencyContainer()),
				app = express();

			handler.name = MODULE;
			handler.init({
				expressApp: app,
				expressRouter: express.Router()
			});

			let server = app.listen(3000, () => {

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
		let depContainer: DependencyContainer,
			handler: ExpressRpcHandler;

		beforeEach(() => {
			depContainer = new DependencyContainer();
			handler = new ExpressRpcHandler(depContainer);
			handler.name = MODULE;
			handler.init();
		});

		afterEach(async () => {
			depContainer.dispose();
			await handler.dispose();
		});

		it('Should add a route path in case action name is same with method name.', done => {
			// Arrange
			const ACTION = 'addProduct';

			depContainer.bind<NormalProductController>(CONTROLLER_NORM, NormalProductController);

			// Act
			handler.handle(ACTION, CONTROLLER_NORM);

			// Assert
			let app: express.Express = handler['_app'],
				router: express.Router = handler['_router'];
			expect(router.stack[0].route.path).to.equal(`/${ACTION}`);

			handler.start()
				.then(() => {
					let options: requestMaker.Options = {
						method: 'POST',
						uri: `http://localhost:3000/${MODULE}/${ACTION}`,
						body: {},
						json: true
					};

					requestMaker(options).then((res: IRpcResponse) => {
						expect(res.from).to.equal(MODULE);
						expect(res.data).to.equal(SUCCESS_ADD_PRODUCT);
						done();
					})
					.catch(rawResponse => {
						console.error(rawResponse.error);
					});
				});
		});

		it('Should add a route path in case action name is resolved by factory.', done => {
			// Arrange
			const ACTION = 'deleteProduct';

			depContainer.bind<NormalProductController>(CONTROLLER_NORM, NormalProductController);

			// Act
			let app: express.Express = handler['_app'],
				router: express.Router = handler['_router'];
			handler.handle(ACTION, CONTROLLER_NORM, (controller: NormalProductController) => controller.remove.bind(controller));

			// Assert
			expect(router.stack[0].route.path).to.equal(`/${ACTION}`);

			handler.start()
				.then(() => {
					let options = {
						method: 'POST',
						uri: `http://localhost:3000/${MODULE}/${ACTION}`,
						body: {},
						json: true
					};

					requestMaker(options).then((res: IRpcResponse) => {
						expect(res.from).to.equal(MODULE);
						expect(res.data).to.equal(SUCCESS_DEL_PRODUCT);
						done();
					})
					.catch(rawResponse => {
						console.error(rawResponse.error);
					});
				});
		});

		it('Should parse and pass request parameters to action method.', done => {
			// Arrange
			const ACTION = 'echo',
				TEXT = 'echo...echooooo';

			depContainer.bind<NormalProductController>(CONTROLLER_NORM, NormalProductController);

			// Act
			let app: express.Express = handler['_app'],
				router: express.Router = handler['_router'];
			handler.handle(ACTION, CONTROLLER_NORM);

			// Assert
			handler.start()
				.then(() => {
					let request: IRpcRequest = {
						from: '',
						to: MODULE,
						payload: {
							text: TEXT
						}
					},
					options = {
						method: 'POST',
						uri: `http://localhost:3000/${MODULE}/${ACTION}`,
						body: request,
						json: true
					};

					requestMaker(options).then((res: IRpcResponse) => {
						expect(res.data).to.equal(TEXT);
						done();
					})
					.catch(rawResponse => {
						console.error(rawResponse.error);
						expect(true, 'Request should be successful!').to.be.false;
					});
				});
		});

		it('Should respond with status 200 if controller rejects.', done => {
			// Arrange
			const ACTION = 'addProduct';

			depContainer.bind<ErrorProductController>(CONTROLLER_ERR, ErrorProductController);

			// Act
			handler.handle(ACTION, CONTROLLER_ERR);

			// Assert
			let app: express.Express = handler['_app'],
				router: express.Router = handler['_router'];

			handler.start()
				.then(() => {
					let options = {
						method: 'POST',
						uri: `http://localhost:3000/${MODULE}/${ACTION}`,
						body: {},
						json: true
					};

					requestMaker(options).then((res: IRpcResponse) => {
						// If status 200
						expect(res).to.be.not.null;
						expect(res.isSuccess).to.be.false;
						expect(res.data).to.equal(ERROR_ADD_PRODUCT);
						done();
					})
					.catch(rawResponse => {
						// If status 500 or request error.
						console.error(rawResponse.error);
						expect(true, 'Request should be successful!').to.be.false;
					});
				});
		});

		it('Should respond with status 500 if controller throws error.', done => {
			// Arrange
			const ACTION = 'deleteProduct';

			depContainer.bind<ErrorProductController>(CONTROLLER_ERR, ErrorProductController);

			// Act
			handler.handle(ACTION, CONTROLLER_ERR, (controller: ErrorProductController) => controller.remove.bind(controller));

			// Assert
			let app: express.Express = handler['_app'],
				router: express.Router = handler['_router'];

			handler.start()
				.then(() => {
					let options = {
						method: 'POST',
						uri: `http://localhost:3000/${MODULE}/${ACTION}`,
						body: {},
						json: true
					};

					requestMaker(options).then((res: IRpcResponse) => {
						// If status 200
						expect(true, 'Request should NOT be successful!').to.be.false;
					})
					.catch(rawResponse => {
						// If status 500 or request error.
						expect(rawResponse.statusCode).to.equal(500);
						expect(rawResponse.error.data.message).to.equal(ERROR_DEL_PRODUCT);
						done();
					});
				});
		});
		
		it('Should respond with status 500 if registered controller cannot be resolved.', done => {
			// Arrange
			const ACTION = 'addProduct';

			// Intentionally not binding controller
			//depContainer.bind<NormalProductController>(CONTROLLER_NORM, NormalProductController);

			// Act
			let app: express.Express = handler['_app'],
				router: express.Router = handler['_router'];
			handler.handle(ACTION, CONTROLLER_NORM);

			handler.start()
				.then(() => {
					let request: IRpcRequest = {
						from: '',
						to: MODULE,
						payload: {}
					},
					options = {
						method: 'POST',
						uri: `http://localhost:3000/${MODULE}/${ACTION}`,
						body: request,
						json: true
					};

					requestMaker(options).then((res: IRpcResponse) => {
						// If status 200
						expect(true, 'Request should NOT be successful!').to.be.false;
					})
					.catch(rawResponse => {
						// Assert
						expect(rawResponse.statusCode).to.equal(500);
						expect(rawResponse.error.data.message).to.contain('Cannot resolve dependency');
						done();
					});
				});
		});

		it('Should respond with status 500 if specified action does not exist in controller.', done => {
			// Arrange
			const UNEXIST_ACTION = 'editProduct';

			depContainer.bind<NormalProductController>(CONTROLLER_NORM, NormalProductController);

			// Act
			let app: express.Express = handler['_app'],
				router: express.Router = handler['_router'];
			handler.handle(UNEXIST_ACTION, CONTROLLER_NORM);

			handler.start()
				.then(() => {
					let request: IRpcRequest = {
							from: '',
							to: MODULE,
							payload: {}
						},
						options = {
							method: 'POST',
							uri: `http://localhost:3000/${MODULE}/${UNEXIST_ACTION}`,
							body: request,
							json: true
						};

					requestMaker(options).then((res: IRpcResponse) => {
						// If status 200
						expect(true, 'Request should NOT be successful!').to.be.false;
					})
					.catch(rawResponse => {
						// Assert
						expect(rawResponse.statusCode).to.equal(500);
						expect(rawResponse.error.data.message).to.equal('Specified action does not exist in controller!');
						done();
					});
				});
		});

	}); // END describe handle
});