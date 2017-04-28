import * as express from 'express-serve-static-core';
import { injectable, IDependencyContainer, Guard, CriticalException } from 'back-lib-common-util';

// Interface - Service contract

export interface IRpcRequest extends Json {
	from: string;
	to: string;
	params: any;
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
	 * Listens to `route`, resolves an instance with `dependencyIdentifier`
	 * when there is a request coming, calls instance's `action` method. If `actions`
	 * is not specified, RPC Caller tries to figure out an action method from `route`.
	 */
	call(moduleName: string, action: string, params: any): Promise<IRpcResponse>;

	/**
	 * Sets up this RPC caller with specified `param`. Each implementation class requires
	 * different kinds of `param`.
	 */
	init(param: any);
}


export type RpcControllerFunction = (request: IRpcRequest, resolve: PromiseResolveFn, reject: PromiseRejectFn) => void;
export type RpcActionFactory = (controller) => RpcControllerFunction;

export interface IRpcHandler {
	/**
	 * A name used in "from" and "to" request property.
	 */
	name: string;

	/**
	 * Waits for incoming request, resolves an instance with `dependencyIdentifier`,
	 * calls instance's `action` method. If `customAction` is specified, 
	 * calls instance's `customAction` instead.
	 */
	handle(action: string, dependencyIdentifier: string | symbol, actionFactory?: RpcActionFactory);
	
	/**
	 * Sets up this RPC handler with specified `param`. Each implementation class requires
	 * different kinds of `param`.
	 */
	init(param?: any): void;
}


// RPC Base classes

@injectable()
export abstract class RpcCallerBase {

	protected _name: string;

	public get name(): string {
		return this._name;
	}

	public set name(val: string) {
		this._name = val;
	}
}

@injectable()
export abstract class RpcHandlerBase {

	protected _name: string;

	public get name(): string {
		return this._name;
	}

	public set name(val: string) {
		this._name = val;
	}

	constructor(protected _depContainer: IDependencyContainer) {
	}
	

	protected resolveActionFunc(action: string, depId: string | symbol, actFactory?: RpcActionFactory): RpcControllerFunction {
		// Attempt to resolve controller instance
		let instance = this._depContainer.resolve<any>(depId);
		Guard.assertIsTruthy(instance, `Cannot resolve dependency ${depId.toString()}!`);

		let actionFn = instance[action];
		
		// If default action is not available, attempt to get action from factory.
		if (!actionFn) {
			actionFn = (actFactory ? actFactory(instance) : null);
		}

		Guard.assertIsTruthy(actionFn, 'Specified action does not exist in controller!');

		return actionFn.bind(instance);
	}

	protected createResponse(isSuccess, data, replyTo: string): IRpcResponse {
		return {
			isSuccess,
			from: this._name,
			to: replyTo,
			data
		};
	}
}
