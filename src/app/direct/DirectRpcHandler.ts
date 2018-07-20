import * as http from 'http';

import * as express from 'express';
import * as bodyParser from 'body-parser';
// import * as shortid from 'shortid';
import { injectable, Guard } from '@micro-fleet/common';

import * as rpc from '../RpcCommon';


export interface IDirectRpcHandler extends rpc.IRpcHandler {
	/**
	 * Http ports to listen
	 */
	port: number;

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
	// private _router: express.Router;
	private _port: number;
	// private _container: HandlerContainer;
	// private _instanceUid: string;
	private _routers: Map<string, express.Router>;


	constructor() {
		super();
		this._port = 30000;
		// this._container = HandlerContainer.instance;
	}


	public get port(): number {
		return this._port;
	}

	public set port(val: number) {
		/* istanbul ignore else */
		if (val > 0 && val <= 65535) {
			this._port = val;
		}
	}

	/**
	 * @see IDirectRpcHandler.init
	 */
	public init(): void {
		Guard.assertIsFalsey(this._routers, 'This RPC Handler is already initialized!');
		Guard.assertIsTruthy(this.name, '`name` property must be set!');

		// this._instanceUid = shortid.generate();
		let app: express.Express;
		app = this._app = express();

		// this._router = (param && param.expressRouter) ? param.expressRouter : express.Router();
		app.use(bodyParser.json()); // Parse JSON in POST request
		// app.use(`/${this.module}`, this._router);
		
		this._routers = new Map<string, express.Router>();
	}

	/**
	 * @see IRpcHandler.start
	 */
	public start(): Promise<void> {
		return new Promise<void>(resolve => {
			this._server = this._app.listen(this._port, resolve);
			this._server.on('error', err => this.emitError(err));
		});
	}

	/**
	 * @see IRpcHandler.dispose
	 */
	public dispose(): Promise<void> {
		return new Promise<void>((resolve) => {
			if (!this._server) {
				return resolve();
			}
			this._server.close(() => {
				this._server = null;
				resolve();
			});
		});
	}

	/**
	 * @see IRpcHandler.handle
	 */
	public handle(moduleName: string, actionName: string, handler: rpc.RpcHandlerFunction): void {
		Guard.assertIsDefined(this._routers, '`init` method must be called first!');
		Guard.assertIsMatch(ExpressRpcHandler.URL_TESTER, moduleName, `Module name "${moduleName}" is not URL-safe!`);
		Guard.assertIsMatch(ExpressRpcHandler.URL_TESTER, actionName, `Action name "${actionName}" is not URL-safe!`);

		let router: express.Router;
		if (this._routers.has(moduleName)) {
			router = this._routers.get(moduleName);
		} else {
			router = express.Router();
			this._routers.set(moduleName, router);
			this._app.use(`/${moduleName}`, router);
		}
		router.post(`/${actionName}`, this.wrapHandler(handler));
		// const depId = `${this._instanceUid}::module`;
		// this._container.register(actionName, depId);
	}


	private wrapHandler(handler: rpc.RpcHandlerFunction): express.RequestHandler {
		return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
			// const actionName = req.url.match(/[^\/]+$/)[0];
			const request: rpc.IRpcRequest = req.body;

			(new Promise((resolve, reject) => {
				// const depId = `${this._instanceUid}::module`;
				// const actionFn = this._container.resolve(actionName, depId);
				try {
					const output: any = handler(request.payload, resolve, reject, request);
					if (output instanceof Promise) {
						output.catch(reject); // Catch async exceptions.
					}
				} catch (err) { // Catch normal exceptions.
					reject(err);
				}
			}))
			.then(result => {
				res.status(200).send(this.createResponse(true, result, request.from));
			})
			.catch(error => {
				const errObj = this.createError(error);
				res.status(500).send(this.createResponse(false, errObj, request.from));
			})
			// Catch error thrown by `createError()`
			.catch(this.emitError.bind(this));
		};
	}
}