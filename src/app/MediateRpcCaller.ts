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

	constructor(
		@inject(T.MSG_BROKER_CONNECTOR) private _msgBrokerConn: IMessageBrokerConnector
	) {
		super();
	}

	public init(param: any): void {
	}

	public call(moduleName: string, action: string, params: any): Promise<rpc.IRpcResponse> {
		Guard.assertDefined('moduleName', moduleName);
		Guard.assertDefined('action', action);

		return new Promise<rpc.IRpcResponse>((resolve, reject) => {
			// There are many requests to same `requestTopic` and they listen to same `responseTopic`,
			// A request only carea for a response with same `correlationId`.
			const correlationId = uuid.v4(),
				replyTo = `response.${moduleName}.${action}`;

			let emitter = new EventEmitter();

			this._msgBrokerConn.subscribe(replyTo, (msg: IMessage) => {
				let intervalId = setInterval(() => {
					// There are chances that the message comes before the below
					// `emitter.once` runs. So let's make sure we only emit event
					// when there is a listener.
					if (emitter.listenerCount(msg.properties.correlationId)) {
						clearInterval(intervalId);
						intervalId = null;

						// Announce that we've got a message with this correlationId.
						emitter.emit(msg.properties.correlationId, msg);
						emitter = null;
					}
				}, 100);
			})
			.then(consumerTag => {
				emitter.once(correlationId, (msg: IMessage) => {
					// We got what we want, stop consuming.
					this._msgBrokerConn.unsubscribe(consumerTag);
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