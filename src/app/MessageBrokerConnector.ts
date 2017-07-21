import { EventEmitter } from 'events';

import * as amqp from 'amqplib';
import * as uuid from 'uuid';
import * as _ from 'lodash';

import { injectable, inject, CriticalException, Guard } from 'back-lib-common-util';

export type MessageHandleFunction = (msg: IMessage, ack?: () => void, nack?: () => void) => void;
export type RpcHandleFunction = (msg: IMessage, reply: (response: any) => void, deny?: () => void) => void;

interface IQueueInfo {
	name: string;
	matchingPattern: string;
}

export interface IMessage {
	data: any;
	raw: amqp.Message;
	properties?: IPublishOptions;
}

export interface IPublishOptions {
	contentType?: string;
	contentEncoding?: string;
	correlationId?: string;
	replyTo?: string;
}

export interface IConnectionOptions {
	hostAddress: string;
	username: string;
	password: string;
	exchange: string;
	queue: string;
}

export interface IMessageBrokerConnector {
	/**
	 * Creates a connection to message broker engine.
	 * @param {IConnectionOptions} options
	 */
	connect(options: IConnectionOptions): Promise<void>;
	
	/**
	 * Closes all channels and the connection.
	 */
	disconnect(): Promise<void>;

	/**
	 * Sends `message` to the broker and label the message with `topic`.
	 * @param {string} topic - A name to label the message with. Should be in format "xxx.yyy.zzz".
	 * @param {string | Json | JsonArray} payload - A message to send to broker.
	 * @param {IPublishOptions} options - Options to add to message properties.
	 */
	publish(topic: string, payload: string | Json | JsonArray, options?: IPublishOptions): Promise<void>;

	/**
	 * Listens to messages whose label matches `matchingPattern`.
	 * @param {string} matchingPattern - Pattern to match with message label. Should be in format "xx.*" or "xx.#.#".
	 * @param {function} onMessage - Callback to invoke when there is an incomming message.
	 * @return {string} - A promise with resolve to a consumer tag, which is used to unsubscribe later.
	 */
	subscribe(matchingPattern: string, onMessage: MessageHandleFunction, noAck?: boolean): Promise<string>;

	/**
	 * Stop listening to a subscription that was made before.
	 */
	unsubscribe(consumerTag: string): Promise<void>;

	onError(handler: Function): void;
}

@injectable()
export class TopicMessageBrokerConnector implements IMessageBrokerConnector {
	
	private _connectionPrm: Promise<amqp.Connection>;
	
	// Each microservice has 2 channels, one for consuming and the other for publishing.
	private _publishChanPrm: Promise<amqp.Channel>;
	private _consumeChanPrm: Promise<amqp.Channel>;

	private _exchange: string;
	private _queue: string;
	private _subscriptions: Map<string, Set<string>>;
	private _emitter: EventEmitter;

	constructor() {
		this._subscriptions = new Map();
		this._emitter = new EventEmitter();
	}

	connect(options: IConnectionOptions): Promise<void> {
		let credentials = '';
		
		this._exchange = options.exchange;
		this._queue = options.queue;

		// Output:
		// - "usr@pass"
		// - "@pass"
		// - "usr@"
		// - ""
		if (!_.isEmpty(options.username) || !_.isEmpty(options.password)) {
			credentials = `${options.username || ''}:${options.password || ''}@`;
		}

		// URI format: amqp://usr:pass@10.1.2.3/vhost
		return this._connectionPrm = <any>amqp.connect(`amqp://${credentials}${options.hostAddress}`)
			.then((conn: amqp.Connection) => {
				conn.on('error', (err) => {
					this._emitter.emit('error', err);
				});
				return conn;
			})
			.catch(err => {
				return this.handleError(err, 'Connection creation error');
			});
	}

	public async disconnect(): Promise<void> {
		try {
			if (!this._connectionPrm || !this._consumeChanPrm) {
				return;
			}

			let ch: amqp.Channel,
				promises = [];

			if (this._consumeChanPrm) {
				ch = await this._consumeChanPrm;
				// Close consuming channel
				promises.push(ch.close());
			}

			if (this._publishChanPrm) {
				ch = await this._publishChanPrm;
				// Close publishing channel
				promises.push(ch.close());
			}

			// Make sure all channels are closed before we close connection.
			// Otherwise we will have dangling channels until application shuts down.
			await Promise.all(promises);

			if (this._connectionPrm) {
				let conn: amqp.Connection = await this._connectionPrm;
				// Close connection, causing all temp queues to be deleted.
				return conn.close();
			}

		} catch (err) {
			return this.handleError(err, 'Connection closing error');
		} finally {
			this._connectionPrm = null;
			this._publishChanPrm = null;
			this._consumeChanPrm = null;
		}
	}

	public async subscribe(matchingPattern: string, onMessage: MessageHandleFunction, noAck: boolean = true): Promise<string> {
		Guard.assertNotEmpty('matchingPattern', matchingPattern);
		Guard.assertIsFunction('onMessage', onMessage);
		try {
			let channelPromise = this._consumeChanPrm;
			if (!channelPromise) {
				// Create a new consuming channel if there is not already, and from now on we listen to this only channel.
				channelPromise = this._consumeChanPrm = this.createChannel();
			}

			let ch = await channelPromise;

			// The consuming channel should bind to only one queue, but that queue can be routed with multiple keys.
			let queueName = await this.bindQueue(channelPromise, matchingPattern);

			let conResult = await ch.consume(queueName,
				(msg: amqp.Message) => {
					let ack = () => ch.ack(msg),
						nack = () => ch.nack(msg);

					onMessage(this.parseMessage(msg), ack, nack);
				}, 
				{ noAck }
			);
			this.moreSub(matchingPattern, conResult.consumerTag);
			return conResult.consumerTag;

		} catch (err) {
			return this.handleError(err, 'Subscription error');
		}
	}

	public async publish(topic: string, payload: string | Json | JsonArray, options?: IPublishOptions): Promise<void> {
		Guard.assertNotEmpty('topic', topic);
		Guard.assertNotEmpty('message', payload);
		try {
			if (!this._publishChanPrm) {
				// Create a new publishing channel if there is not already, and from now on we publish to this only channel.
				this._publishChanPrm = this.createChannel();
			}
			let ch: amqp.Channel = await this._publishChanPrm,
				opt: amqp.Options.Publish;
			let [msg, opts] = this.buildMessage(payload, options);

			// We publish to exchange, then the exchange will route to appropriate consuming queue.
			ch.publish(this._exchange, topic, msg, opts);

		} catch (err) {
			return this.handleError(err, 'Publishing error');
		}
	}

	public async unsubscribe(consumerTag: string): Promise<void> {
		try {
			if (!this._consumeChanPrm) {
				return;
			}

			let ch = await this._consumeChanPrm;

			// onMessage callback will never be called again.
			await ch.cancel(consumerTag);
			
			let unusedPattern = this.lessSub(consumerTag);
			if (unusedPattern) {
				this.unbindQueue(this._consumeChanPrm, unusedPattern);
			}

		} catch (err) {
			return this.handleError(err, `Failed to unsubscribe tag "${consumerTag}"`);
		}
	}

	public onError(handler: (err: string) => void): void {
		this._emitter.on('error', handler);
	}


	private async createChannel(): Promise<amqp.Channel> {
		const EXCHANGE_TYPE = 'topic';

		try {
			let conn = await this._connectionPrm,
				ch = await conn.createChannel(),

				// Tell message broker to create an exchange with this name if there's not any already.
				// Setting exchange as "durable" means the exchange with same name will be re-created after the message broker restarts,
				// but all queues and waiting messages will be lost.
				exResult = await ch.assertExchange(this._exchange, EXCHANGE_TYPE, {durable: true});

			ch['queue'] = '';
			ch.on('error', (err) => {
				this._emitter.emit('error', err);
			});
			return ch;

		} catch (err) {
			return this.handleError(err, 'Channel creation error');
		}
	}

	/**
	 * If `queueName` is null, creates a queue and binds it to `matchingPattern`.
	 * If `queueName` is not null, binds `matchingPattern` to the queue with that name.
	 * @return {string} null if no queue is created, otherwise returns the new queue name.
	 */
	private async bindQueue(channelPromise: Promise<amqp.Channel>, matchingPattern: string): Promise<string> {
		try {
			let ch = await channelPromise,
				isTempQueue = (!this._queue),
				// If configuration doesn't provide queue name,
				// we provide empty string as queue name to tell message broker to choose a unique name for us.
				// Setting queue as "exclusive" to delete the temp queue when connection closes.
				quResult = await ch.assertQueue(this._queue || '', {exclusive: isTempQueue});

			await ch.bindQueue(quResult.queue, this._exchange, matchingPattern);

			// Store queue name for later use.
			// In our system, each channel is associated with only one queue.
			return ch['queue'] = quResult.queue;

		} catch (err) {
			return this.handleError(err, 'Queue binding error');
		}
	}

	private async unbindQueue(channelPromise: Promise<amqp.Channel>, matchingPattern: string): Promise<void> {
		try {
			let ch = await channelPromise,
				queueName = ch['queue'];

			await ch.unbindQueue(queueName, this._exchange, matchingPattern);

		} catch (err) {
			return this.handleError(err, 'Queue unbinding error');
		}
	}

	private handleError(err, message: string): Promise<never> {
		if (err instanceof CriticalException) {
			// If this is already a wrapped exception.
			return Promise.reject(err);
		}
		return Promise.reject(new CriticalException(`${message}: ${err}`));
	}
	
	private moreSub(matchingPattern: string, consumerTag: string): void {
		let consumers: Set<string> = this._subscriptions.get(matchingPattern);

		if (!consumers) {
			this._subscriptions.set(matchingPattern, new Set(consumerTag));
			return;
		}
		consumers.add(consumerTag);
	}

	/**
	 * @return {string} the pattern name which should be unbound, othewise return null.
	 */
	private lessSub(consumerTag: string): string {
		let subscriptions = this._subscriptions,
			matchingPattern = null;
		
		for (let sub of subscriptions) {
			if (!sub[1].has(consumerTag)) { continue; }

			// Remove this tag from consumer list.
			sub[1].delete(consumerTag);
			
			// If consumer list becomes empty.
			if (!sub[1].size) {
				// Mark this pattern as unused and should be unbound.
				matchingPattern = sub[0];
				subscriptions.delete(matchingPattern);
			}
			break;
		}

		return matchingPattern;
	}

	private buildMessage(payload: string | Json | JsonArray, options?: IPublishOptions): Array<any> {
		let msg: string;
		options = options || {};

		if (_.isString(payload)) {
			msg = payload;
			options.contentType = 'text/plain';
		} else {
			msg = JSON.stringify(payload);
			options.contentType = 'application/json';
		}

		return [Buffer.from(msg), options];
	}

	private parseMessage(raw: amqp.Message): IMessage {
		let msg: Partial<IMessage> = {
			raw,
			properties: raw.properties || {}
		};

		if (msg.properties.contentType == 'text/plain') {
			msg.data = raw.content.toString(msg.properties.contentEncoding);
		} else {
			msg.data = JSON.parse(<any>raw.content);
		}

		return <IMessage>msg;
	}
}