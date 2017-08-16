import { injectable, inject, IDependencyContainer, Guard, Exception, Types as CmT } from 'back-lib-common-util';

import { Types as T } from './Types';
import { IMessageBrokerConnector, IMessage, MessageHandleFunction } from './MessageBrokerConnector';
import * as rpc from './RpcCommon';


export interface IMediateRpcHandler extends rpc.IRpcHandler {
}

@injectable()
export class MessageBrokerRpcHandler
			extends rpc.RpcHandlerBase
			implements IMediateRpcHandler {
	
	constructor(
		@inject(CmT.DEPENDENCY_CONTAINER) depContainer: IDependencyContainer,
		@inject(T.MSG_BROKER_CONNECTOR) private _msgBrokerConn: IMessageBrokerConnector
	) {
		super(depContainer);
		Guard.assertArgDefined('_msgBrokerConn', _msgBrokerConn);
	}


	/**
	 * @see IRpcHandler.init
	 */
	public init(params?: any): void {
		this._msgBrokerConn && this._msgBrokerConn.onError(err => this.emitError(err));
	}

	/**
	 * @see IRpcHandler.handle
	 */
	public handle(action: string, dependencyIdentifier: string | symbol, actionFactory?: rpc.RpcActionFactory) {
		Guard.assertArgDefined('action', action);
		Guard.assertArgDefined('dependencyIdentifier', dependencyIdentifier);
		Guard.assertIsDefined(this._name, '`name` property is required.');
		
		this._msgBrokerConn.subscribe(`request.${this._name}.${action}`, this.buildHandleFunc.apply(this, arguments));
	}


	private buildHandleFunc(action: string, dependencyIdentifier: string | symbol, actionFactory?: rpc.RpcActionFactory): MessageHandleFunction {
		return (msg: IMessage) => {
			let request: rpc.IRpcRequest = msg.data,
				replyTo: string = msg.properties.replyTo,
				correlationId = msg.properties.correlationId;
			
			(new Promise((resolve, reject) => {
				let actionFn = this.resolveActionFunc(action, dependencyIdentifier, actionFactory);
				// Execute controller's action
				actionFn(request.payload, resolve, reject, request);
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
		};
	}
}