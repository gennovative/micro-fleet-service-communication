import { injectable, inject, IDependencyContainer, Guard, Exception, Types as CmT } from 'back-lib-common-util';

import { Types as T } from './Types';
import { IMessageBrokerConnector, IMessage, MessageHandleFunction } from './MessageBrokerConnector';
import * as rpc from './RpcCommon';


export interface IHandlerDetails {
	dependencyIdentifier: string | symbol;
	actionFactory?: rpc.RpcActionFactory;
}

export interface IMediateRpcHandler extends rpc.IRpcHandler {
	/**
	 * @override IRpcHandler.handle to return Promise<void>
	 */
	handle(actions: string | string[], dependencyIdentifier: string | symbol, actionFactory?: rpc.RpcActionFactory): Promise<void>;
	
	/**
	 * Handles countAll, create, delete, find, patch, update.
	 */
	handleCRUD(dependencyIdentifier: string | symbol, actionFactory?: rpc.RpcActionFactory): Promise<void>;
}

@injectable()
export class MessageBrokerRpcHandler
			extends rpc.RpcHandlerBase
			implements IMediateRpcHandler {
	
	private _registeredHandlers: IHandlerDetails[];


	constructor(
		@inject(CmT.DEPENDENCY_CONTAINER) depContainer: IDependencyContainer,
		@inject(T.MSG_BROKER_CONNECTOR) private _msgBrokerConn: IMessageBrokerConnector
	) {
		super(depContainer);
		Guard.assertArgDefined('_msgBrokerConn', _msgBrokerConn);
		this._registeredHandlers = [];
	}


	/**
	 * @see IRpcHandler.init
	 */
	public init(params?: any): void {
		this._msgBrokerConn && this._msgBrokerConn.onError(err => this.emitError(err));
	}

	/**
	 * @see IRpcHandler.start
	 */
	public start(): Promise<void> {
		return this._msgBrokerConn.listen(this.onMessage.bind(this));
	}

	/**
	 * @see IRpcHandler.dispose
	 */
	public dispose(): Promise<void> {
		// Stop listening then unsbuscribe all topic patterns.
		return <any>Promise.all([
			this._msgBrokerConn.stopListen(),
			this._msgBrokerConn.unsubscribeAll()
		]);
	}

	/**
	 * @see IMediateRpcHandler.handle
	 */
	public async handle(actions: string | string[], dependencyIdentifier: string | symbol, actionFactory?: rpc.RpcActionFactory): Promise<void> {
		Guard.assertArgDefined('action', actions);
		Guard.assertArgDefined('dependencyIdentifier', dependencyIdentifier);
		Guard.assertIsDefined(this.name, '`name` property is required.');

		actions = Array.isArray(actions) ? actions : [actions];
		return <any>Promise.all(
			actions.map(a => {
				this._registeredHandlers[a] = { dependencyIdentifier, actionFactory };
				return this._msgBrokerConn.subscribe(`request.${this.name}.${a}`);
			})
		);
	}

	/**
	 * @see IMediateRpcHandler.handleCRUD
	 */
	public handleCRUD(dependencyIdentifier: string | symbol, actionFactory?: rpc.RpcActionFactory): Promise<void> {
		return this.handle(
			['countAll', 'create', 'delete', 'find', 'patch', 'update'],
			dependencyIdentifier, actionFactory
		);
	}


	private onMessage(msg: IMessage): void {
		let action = msg.raw.fields.routingKey.match(/[^\.]+$/)[0],
			handlerDetails = this._registeredHandlers[action];

		let request: rpc.IRpcRequest = msg.data,
			replyTo: string = msg.properties.replyTo,
			correlationId = msg.properties.correlationId;

		(new Promise((resolve, reject) => {
				let actionFn = this.resolveActionFunc(action, handlerDetails.dependencyIdentifier, handlerDetails.actionFactory);
				try {
					// Execute controller's action
					let output: any = actionFn(request.payload, resolve, reject, request);
					if (output instanceof Promise) {
						output.catch(reject); // Catch async exceptions.
					}
				} catch (err) { // Catch normal exceptions.
					reject(err);
				}
			}))
			.then(result => { // When `actionFn` calls `resolve` from inside.
				// Sends response to reply topic
				return this._msgBrokerConn.publish(replyTo, this.createResponse(true, result, request.from), { correlationId });
			})
			.catch(error => {
				let errMsg = error;
				// If error is an uncaught Exception/Error object, that means the action method
				// has a problem. We should nack to tell message broker to send this message to someone else.
				if (error instanceof Error) {
					// Clone to a plain object, as class Error has problem
					// with JSON.stringify.
					errMsg = {
						message: error.message
					};
				} else if (error instanceof Exception) {
					// TODO: Should log this unexpected error.
					delete error.stack;
					// nack(); // Disable this, because we use auto-ack.
				}

				// If this is a custom error, which means the action method sends this error
				// back to caller on purpose.
				return this._msgBrokerConn.publish(replyTo, this.createResponse(false, errMsg, request.from), { correlationId });
			});
	}

}