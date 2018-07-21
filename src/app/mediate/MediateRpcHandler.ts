import { injectable, inject, Guard } from '@micro-fleet/common';

import { Types as T } from '../Types';
import { IMessageBrokerConnector, BrokerMessage } from '../MessageBrokerConnector';
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
	public init(): void {
		this._handlers = new Map<string, rpc.RpcHandlerFunction>();
		this._msgBrokerConn.onError(err => this.emitError(err));
	}

	/**
	 * @see IRpcHandler.start
	 */
	public start(): Promise<void> {
		return this._msgBrokerConn.listen(this.onMessage.bind(this), false);
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
	}


	private onMessage(msg: BrokerMessage, ack: Function, nack: Function): void {
		const routingKey: string = msg.raw.fields.routingKey;
		const key: string = routingKey.match(/[^\.]+\.[^\.]+$/)[0];
		if (!this._handlers.has(key)) {
			// Although we nack this message and re-queue it, it will come back
			// if it's not handled by any other service. And we jut keep nack-ing
			// it until the message expires.
			nack();
			return console.warn(`No handlers for request ${routingKey}`);
		}
		ack();

		const request: rpc.IRpcRequest = msg.data;
		const correlationId = msg.properties.correlationId;
		const replyTo: string = msg.properties.replyTo;

		(new Promise((resolve, reject) => {
			// Extract "module.action" out of "request.module.action"
			try {
				const actionFn = this._handlers.get(key);
				// Execute controller's action
				const output: any = actionFn(request.payload, resolve, reject, request, msg);
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