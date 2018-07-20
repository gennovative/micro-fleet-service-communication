import { injectable, inject, Guard, MinorException } from '@micro-fleet/common';

import { Types as T } from '../Types';
import { IMessageBrokerConnector, IMessage } from '../MessageBrokerConnector';
import * as rpc from '../RpcCommon';


export interface IMediateRpcHandler extends rpc.IRpcHandler {
	/**
	 * @override IRpcHandler.handle to return Promise<void>
	 */
	handle(module: string, action: string, handler: rpc.RpcHandlerFunction): Promise<void>;

	/**
	 * Handles countAll, create, delete, find, patch, update.
	 */
	// handleCRUD(dependencyIdentifier: string | symbol, actionFactory?: ActionFactory): Promise<void>;
}

@injectable()
export class MessageBrokerRpcHandler
	extends rpc.RpcHandlerBase
	implements IMediateRpcHandler {

	private _handlers: Map<string, rpc.RpcHandlerFunction>;

	constructor(
		@inject(T.MSG_BROKER_CONNECTOR) private _msgBrokerConn: IMessageBrokerConnector
	) {
		super();
		Guard.assertArgDefined('_msgBrokerConn', _msgBrokerConn);
	}


	/**
	 * @see IRpcHandler.init
	 */
	public init(params?: any): void {
		this._msgBrokerConn.onError(err => this.emitError(err));
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
	public async handle(moduleName: string, actionName: string, handler: rpc.RpcHandlerFunction): Promise<void> {
		Guard.assertIsDefined(this.name, '`name` property is required.');
		const key = `${moduleName}.${actionName}`;
		if (this._handlers.has(key)) {
			console.warn(`MediateRpcHandler Warning: Override existing subscription key ${key}`);
		}
		this._handlers.set(key, handler);
		return this._msgBrokerConn.subscribe(`request.${key}`);
		// return <any>Promise.all(
		// 	actions.map(a => {
		// 		this._container.register(a, dependencyIdentifier, actionFactory);
		// 	})
		// );
	}

	/**
	 * @see IMediateRpcHandler.handleCRUD
	 */
	// public handleCRUD(dependencyIdentifier: string, actionFactory?: ActionFactory): Promise<void> {
	// 	return this.handle(
	// 		['countAll', 'create', 'delete', 'find', 'patch', 'update'],
	// 		dependencyIdentifier, actionFactory
	// 	);
	// }


	private onMessage(msg: IMessage): void {
		const request: rpc.IRpcRequest = msg.data;
		const correlationId = msg.properties.correlationId;
		const replyTo: string = msg.properties.replyTo;
		
		(new Promise((resolve, reject) => {
			// Extract "module.action" out of "request.module.action"
			const routingKey: string = msg.raw.fields.routingKey;
			const key: string = routingKey.match(/[^\.]+\.[^\.]+$/)[0];
			try {
				if (!this._handlers.has(key)) {
					throw new MinorException(`No handlers for request ${routingKey}`);
				}

				const actionFn = this._handlers.get(key);
				// Execute controller's action
				const output: any = actionFn(request.payload, resolve, reject, request);
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
			let errObj = this.createError(error);
			// nack(); // Disable this, because we use auto-ack.
			return this._msgBrokerConn.publish(replyTo, this.createResponse(false, errObj, request.from), { correlationId });
		})
		// Catch error thrown by `createError()`
		.catch(this.emitError.bind(this));
	}

}