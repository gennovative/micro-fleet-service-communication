import 'reflect-metadata';
import { expect } from 'chai';
import * as express from 'express';
import * as requestMaker from 'request-promise';
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

describe('ExpressDirectRpcHandler', () => {
	describe('init', () => {
		it('Should use `name` property to init Router', () => {
			// Arrange
			let handler = new ExpressRpcHandler(null),
				app: express.Express = express();

			// Act
			handler.name = MODULE;
			handler.init({
				expressApp: app,
				router: express.Router()
			});

			// Assert
			expect(app._router.stack).to.be.not.null;

			let router = app._router.stack.find(entry => entry.name == 'router');
			expect(router).to.be.not.null;

			expect(`/${MODULE}`).to.match(router.regexp);
			expect(`/${handler.name}`).to.match(router.regexp);
		});
	});

	describe('handle', () => {
		it('Should add a route path in case action name is same with method name.', (done) => {
			// Arrange
			const ACTION = 'addProduct';

			let depContainer = new DependencyContainer(),
				handler = new ExpressRpcHandler(depContainer),
				app: express.Express = express(),
				router: express.Router = express.Router();

			depContainer.bind<NormalProductController>(CONTROLLER_NORM, NormalProductController);

			handler.name = MODULE;
			handler.init({
				expressApp: app,
				router: router
			});

			// Act
			handler.handle(ACTION, CONTROLLER_NORM);

			// Assert
			expect(router.stack[0].route.path).to.equal(`/${ACTION}`);

			let server = app.listen(3000, () => {
				let options = {
					method: 'POST',
					uri: `http://localhost:3000/${MODULE}/${ACTION}`,
					body: {},
					json: true
				};

				requestMaker(options).then((res: IRpcResponse) => {
					expect(res.from).to.equal(MODULE);
					expect(res.data).to.equal(SUCCESS_ADD_PRODUCT);
					done();
					server.close();
					server = null;
				})
				.catch(rawResponse => {
					console.error(rawResponse.error);
					server.close();
					server = null;
				});
			});
		});

		it('Should add a route path in case action name is resolved by factory.', (done) => {
			// Arrange
			const ACTION = 'deleteProduct';

			let depContainer = new DependencyContainer(),
				handler = new ExpressRpcHandler(depContainer),
				app: express.Express = express(),
				router: express.Router = express.Router();

			depContainer.bind<NormalProductController>(CONTROLLER_NORM, NormalProductController);

			handler.name = MODULE;
			handler.init({
				expressApp: app,
				router: router
			});

			// Act
			handler.handle(ACTION, CONTROLLER_NORM, (controller: NormalProductController) => controller.remove.bind(controller));

			// Assert
			expect(router.stack[0].route.path).to.equal(`/${ACTION}`);
			
			let server = app.listen(3000, () => {
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
					server.close();
					server = null;
				})
				.catch(rawResponse => {
					console.error(rawResponse.error);
					server.close();
					server = null;
				});
			});
		});

		it('Should parse and pass request parameters to action method.', (done) => {
			// Arrange
			const ACTION = 'echo',
				TEXT = 'echo...echooooo';

			let depContainer = new DependencyContainer(),
				handler = new ExpressRpcHandler(depContainer),
				app: express.Express = express(),
				router: express.Router = express.Router();

			depContainer.bind<NormalProductController>(CONTROLLER_NORM, NormalProductController);

			handler.name = MODULE;
			handler.init({
				expressApp: app,
				router: router
			});

			// Act
			handler.handle(ACTION, CONTROLLER_NORM);

			// Assert
			let server = app.listen(3000, () => {
				let request: IRpcRequest = {
					from: '',
					to: MODULE,
					params: {
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
					server.close();
					server = null;
				})
				.catch(rawResponse => {
					console.error(rawResponse.error);
					expect(true, 'Request should be successful!').to.be.not.false;
					server.close();
					server = null;
				});
			});
		});

		it('Should respond with status 200 if controller rejects.', (done) => {
			// Arrange
			const ACTION = 'addProduct';

			let depContainer = new DependencyContainer(),
				handler = new ExpressRpcHandler(depContainer),
				app: express.Express = express(),
				router: express.Router = express.Router();

			depContainer.bind<ErrorProductController>(CONTROLLER_ERR, ErrorProductController);

			handler.name = MODULE;
			handler.init({
				expressApp: app,
				router: router
			});

			// Act
			handler.handle(ACTION, CONTROLLER_ERR);

			// Assert
			let server = app.listen(3000, () => {
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
					server.close();
					server = null;
				})
				.catch(rawResponse => {
					// If status 500 or request error.

					console.error(rawResponse.error);
					expect(true, 'Request should be successful!').to.be.not.false;
					server.close();
					server = null;
				});
			});
		});

		it('Should respond with status 500 if controller throws error.', (done) => {
			// Arrange
			const ACTION = 'deleteProduct';

			let depContainer = new DependencyContainer(),
				handler = new ExpressRpcHandler(depContainer),
				app: express.Express = express(),
				router: express.Router = express.Router();

			depContainer.bind<ErrorProductController>(CONTROLLER_ERR, ErrorProductController);

			handler.name = MODULE;
			handler.init({
				expressApp: app,
				router: router
			});

			// Act
			handler.handle(ACTION, CONTROLLER_ERR, (controller: ErrorProductController) => controller.remove.bind(controller));

			// Assert
			let server = app.listen(3000, () => {
				let options = {
					method: 'POST',
					uri: `http://localhost:3000/${MODULE}/${ACTION}`,
					body: {},
					json: true
				};

				requestMaker(options).then((res: IRpcResponse) => {
					// If status 200

					expect(true, 'Request should NOT be successful!').to.be.not.false;
					server.close();
					server = null;
				})
				.catch(rawResponse => {
					// If status 500 or request error.

					expect(rawResponse.statusCode).to.equal(500);
					expect(rawResponse.error.data).to.equal(ERROR_DEL_PRODUCT);
					done();
					server.close();
					server = null;
				});
			});
		});
		
		it('Should respond with status 500 if registered controller cannot be resolved.', (done) => {
			// Arrange
			const ACTION = 'addProduct';

			let depContainer = new DependencyContainer(),
				handler = new ExpressRpcHandler(depContainer),
				app: express.Express = express(),
				router: express.Router = express.Router();

			// Intentionally not binding controller
			//depContainer.bind<NormalProductController>(CONTROLLER_NORM, NormalProductController);

			handler.name = MODULE;
			handler.init({
				expressApp: app,
				router: router
			});

			// Act
			handler.handle(ACTION, CONTROLLER_NORM);

			let server = app.listen(3000, () => {
				let request: IRpcRequest = {
					from: '',
					to: MODULE,
					params: {}
				},
				options = {
					method: 'POST',
					uri: `http://localhost:3000/${MODULE}/${ACTION}`,
					body: request,
					json: true
				};

				requestMaker(options).then((res: IRpcResponse) => {
					// If status 200

					expect(true, 'Request should NOT be successful!').to.be.not.false;
					server.close();
					server = null;
				})
				.catch(rawResponse => {
					// Assert
					expect(rawResponse.statusCode).to.equal(500);
					expect(rawResponse.error.data).to.contain('Cannot resolve dependency');
					done();
					server.close();
					server = null;
				});
			});

		});

		it('Should respond with status 500 if specified action does not exist in controller.', (done) => {
			// Arrange
			const UNEXIST_ACTION = 'editProduct';

			let depContainer = new DependencyContainer(),
				handler = new ExpressRpcHandler(depContainer),
				app: express.Express = express(),
				router: express.Router = express.Router();

			depContainer.bind<NormalProductController>(CONTROLLER_NORM, NormalProductController);

			handler.name = MODULE;
			handler.init({
				expressApp: app,
				router: router
			});

			// Act
			handler.handle(UNEXIST_ACTION, CONTROLLER_NORM);

			let server = app.listen(3000, () => {
				let request: IRpcRequest = {
					from: '',
					to: MODULE,
					params: {}
				},
				options = {
					method: 'POST',
					uri: `http://localhost:3000/${MODULE}/${UNEXIST_ACTION}`,
					body: request,
					json: true
				};

				requestMaker(options).then((res: IRpcResponse) => {
					// If status 200

					expect(true, 'Request should NOT be successful!').to.be.not.false;
					server.close();
					server = null;
				})
				.catch(rawResponse => {
					// Assert
					expect(rawResponse.statusCode).to.equal(500);
					expect(rawResponse.error.data).to.equal('Specified action does not exist in controller!');
					done();
					server.close();
					server = null;
				});
			});

		});

	});
});