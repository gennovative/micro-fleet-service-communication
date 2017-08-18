import { EventEmitter } from 'events';

import * as express from 'express-serve-static-core';
import { injectable, IDependencyContainer, Guard, CriticalException } from 'back-lib-common-util';

// Interface - Service contract

export interface IRpcRequest extends Json {
	from: string;
	to: string;
	payload: any;
}

export interface IRpcResponse extends Json {
	isSuccess: boolean;
	from: string;
	to: string;
	data: any;
}

// Interface - RPC caller and handler

export interface IRpcCaller {
	/**
	 * A name used in "from" and "to" request property.
	 */
	name: string;

	/**
	 * Number of seconds to wait for response before cancelling the request.
	 */
	timeout: number;

	/**
	 * Sets up this RPC caller with specified `param`. Each implementation class requires
	 * different kinds of `param`.
	 */
	init(params?: any): any;

	/**
	 * Clear resources.
	 */
	dispose(): Promise<void>;

	/**
	 * Sends a request to `moduleName` to execute `action` with `params`.
	 * @param moduleName The module to send request.
	 * @param action The function name to call on `moduleName`.
	 * @param params Parameters to pass to function `action`.
	 */
	call(moduleName: string, action: string, params?: any): Promise<IRpcResponse>;

	/**
	 * Registers a listener to handle errors.
	 */
	onError(handler: (err) => void): void;
}


export type RpcControllerFunction = (requestPayload: any, resolve: PromiseResolveFn, reject: PromiseRejectFn, rawRequest: IRpcRequest) => any;
export type RpcActionFactory = (controller, action: string) => RpcControllerFunction;

export interface IRpcHandler {
	/**
	 * A name used in "from" and "to" request property.
	 */
	name: string;
	
	/**
	 * Sets up this RPC handler with specified `param`. Each implementation class requires
	 * different kinds of `param`.
	 */
	init(params?: any): any;

	/**
	 * Waits for incoming request, resolves an instance with `dependencyIdentifier`,
	 * calls instance's `action` method. If `customAction` is specified, 
	 * calls instance's `customAction` instead.
	 */
	handle(action: string | string[], dependencyIdentifier: string | symbol, actionFactory?: RpcActionFactory): any;

	/**
	 * Registers a listener to handle errors.
	 */
	onError(handler: (err) => void): void;

	/**
	 * Starts listening to requests.
	 */
	start(): Promise<void>;

	/**
	 * Stops handling requests and removes registered actions.
	 */
	dispose(): Promise<void>;
}


// RPC Base classes

@injectable()
export abstract class RpcCallerBase {

	/**
	 * @see IRpcCaller.name
	 */
	public name: string;

	/**
	 * @see IRpcCaller.timeout
	 */
	public timeout: number;

	protected _emitter: EventEmitter;


	constructor() {
		this._emitter = new EventEmitter();
		this.timeout = 30000;
	}
	
	public dispose(): Promise<void> {
		this._emitter.removeAllListeners();
		this._emitter = null;
		return Promise.resolve();
	}

	/**
	 * @see IRpcCaller.onError
	 */
	public onError(handler: (err) => void): void {
		this._emitter.on('error', handler);
	}


	protected emitError(err): void {
		this._emitter.emit('error', err);
	}
}

@injectable()
export abstract class RpcHandlerBase {

	/**
	 * @see IRpcHandler.name
	 */
	public name: string;

	protected _emitter: EventEmitter;


	constructor(protected _depContainer: IDependencyContainer) {
		Guard.assertArgDefined('_depContainer', _depContainer);
		this._emitter = new EventEmitter();
	}


	/**
	 * @see IRpcHandler.onError
	 */
	public onError(handler: (err) => void): void {
		this._emitter.on('error', handler);
	}


	protected emitError(err): void {
		this._emitter.emit('error', err);
	}

	protected resolveActionFunc(action: string, depId: string | symbol, actFactory?: RpcActionFactory): RpcControllerFunction {
		// Attempt to resolve controller instance
		let instance = this._depContainer.resolve<any>(depId);
		Guard.assertIsDefined(instance, `Cannot resolve dependency ${depId.toString()}!`);

		let actionFn = instance[action];
		
		// If default action is not available, attempt to get action from factory.
		if (!actionFn) {
			actionFn = (actFactory ? actFactory(instance, action) : null);
		}

		Guard.assertIsTruthy(actionFn, 'Specified action does not exist in controller!');

		return actionFn.bind(instance);
	}

	protected createResponse(isSuccess, data, replyTo: string): IRpcResponse {
		return {
			isSuccess,
			from: this.name,
			to: replyTo,
			data
		};
	}
}
