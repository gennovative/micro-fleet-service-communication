import * as http from 'http';

import * as express from 'express';
import * as bodyParser from 'body-parser';

import { injectable, inject, IDependencyContainer, Guard, Exception, Types as CmT } from 'back-lib-common-util';

import * as rpc from './RpcCommon';


export interface ExpressRpcHandlerInitOptions {
	expressApp: express.Express;
	expressRouter: express.Router;
}

export interface IDirectRpcHandler extends rpc.IRpcHandler {
	/**
	 * @override
	 * @see IRpcHandler.init
	 */
	init(params?: ExpressRpcHandlerInitOptions): void;

	/**
	 * Starts internal Http server and listening to requests.
	 */
	start(): Promise<void>;

	/**
	 * Stops internal Http server.
	 */
	dispose(): Promise<void>;
}

@injectable()
export class ExpressRpcHandler
			extends rpc.RpcHandlerBase
			implements IDirectRpcHandler {

	private static URL_TESTER: RegExp = (function() {
			let regexp = new RegExp(/^[a-zA-Z0-9_-]*$/);
			regexp.compile();
			return regexp;
		})();

	private _server: http.Server;
	private _app: express.Express;
	private _router: express.Router;


	constructor(
		@inject(CmT.DEPENDENCY_CONTAINER) depContainer: IDependencyContainer
	) {
		super(depContainer);
	}


	/**
	 * @see IDirectRpcHandler.init
	 */
	public init(param?: ExpressRpcHandlerInitOptions): void {
		Guard.assertIsFalsey(this._router, 'This RPC Caller is already initialized!');
		Guard.assertIsTruthy(this._name, '`name` property must be set!');

		let app: express.Express;
		app = this._app = (param && param.expressApp) 
			? param.expressApp 
			: express();

		this._router = (param && param.expressRouter) ? param.expressRouter : express.Router();
		//app.use(bodyParser.urlencoded({extended: true})); // Parse Form values in POST request, but I don't think we need it in this case.
		app.use(bodyParser.json()); // Parse JSON in POST request
		app.use(`/${this._name}`, this._router);
		
	}

	/**
	 * @see IDirectRpcHandler.start
	 */
	public start(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this._server = this._app.listen(3000, resolve);
			this._server.on('error', err => this.emitError(err));
		});
	}

	/**
	 * @see IDirectRpcHandler.dispose
	 */
	public dispose(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this._server.close(() => {
				this._server = null;
				resolve();
			});
		});
	}

	/**
	 * @see IRpcHandler.handle
	 */
	public handle(action: string, dependencyIdentifier: string | symbol, actionFactory?: rpc.RpcActionFactory) {
		Guard.assertIsMatch(null, ExpressRpcHandler.URL_TESTER, action, `Route "${action}" is not URL-safe!`);
		Guard.assertIsTruthy(this._router, '`init` method must be called first!');

		this._router.post(`/${action}`, this.buildHandleFunc.apply(this, arguments));
	}


	private buildHandleFunc(action: string, dependencyIdentifier: string | symbol, actionFactory?: rpc.RpcActionFactory): express.RequestHandler {
		return (req: express.Request, res: express.Response) => {
			let request: rpc.IRpcRequest = req.body;

			(new Promise((resolve, reject) => {
				let actionFn = this.resolveActionFunc(action, dependencyIdentifier, actionFactory);
				// Execute controller's action
				actionFn(request, resolve, reject);
			}))
			.then(result => {
				res.status(200).send(this.createResponse(true, result, request.from));
			})
			.catch(error => {
				let errMsg = error,
					statusCode = 200;

				// If error is an uncaught Exception object, that means the action method
				// has a problem. We should response with error status code.
				if (error instanceof Exception) {
					// TODO: Should log this unexpected error.
					statusCode = 500;
					errMsg = error.message;
				}

				// If this is a reject error, which means the action method sends this error
				// back to caller on purpose.
				res.status(statusCode).send(this.createResponse(false, errMsg, request.from));
			});
		};
	}
}