import { EventEmitter } from 'events';

import * as uuid from 'uuid';
import { injectable, inject, IDependencyContainer, Guard, MinorException } from 'back-lib-common-util';

import { Types as T } from './Types';
import { IMessageBrokerConnector, IMessage } from './MessageBrokerConnector';
import * as rpc from './RpcCommon';


export interface IMediateRpcCaller extends rpc.IRpcCaller {
}

@injectable()
export class MessageBrokerRpcCaller
			extends rpc.RpcCallerBase
			implements IMediateRpcCaller {

	private _emitter: EventEmitter;

	constructor(
		@inject(T.MSG_BROKER_CONNECTOR) private _msgBrokerConn: IMessageBrokerConnector
	) {
		super();
		Guard.assertDefined('_msgBrokerConn', _msgBrokerConn);

		this._emitter = new EventEmitter();
		this._msgBrokerConn.queue = ''; // Make sure we only use temporary unique queue.
	}

	/**
	 * @see IRpcCaller.init
	 */
	public init(params?: any): void {
	}

	/**
	 * @see IRpcCaller.call
	 */
	public call(moduleName: string, action: string, params?: any): Promise<rpc.IRpcResponse> {
		Guard.assertDefined('moduleName', moduleName);
		Guard.assertDefined('action', action);

		return new Promise<rpc.IRpcResponse>((resolve, reject) => {
			// There are many requests to same `requestTopic` and they listen to same `responseTopic`,
			// A request only carea for a response with same `correlationId`.
			const correlationId = uuid.v4(),
				replyTo = `response.${moduleName}.${action}`;

			this._msgBrokerConn.subscribe(replyTo, (msg: IMessage) => {
				// Announce that we've got a response with this correlationId.
				this._emitter.emit(msg.properties.correlationId, msg);
			})
			.then(consumerTag => {
				// TODO: Should have a timeout to remove this listener, in case this request never has response.
				this._emitter.once(correlationId, async (msg: IMessage) => {
					// We got what we want, stop consuming.
					await this._msgBrokerConn.unsubscribe(consumerTag);
					resolve(<rpc.IRpcResponse>msg.data);
				});

				let request: rpc.IRpcRequest = {
					from: this._name,
					to: moduleName,
					params
				};

				// Send request, marking the message with correlationId.
				return this._msgBrokerConn.publish(`request.${moduleName}.${action}`, request, 
					{ correlationId, replyTo });
			})
			.catch(err => {
				reject(new MinorException(`RPC error: ${err}`));
			});
		});
	}
}