"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TopicMessageBrokerConnector_1;
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const shortid = require("shortid");
const amqp = require("amqplib");
const common_1 = require("@micro-fleet/common");
exports.IDENTIFIER = 'service-communication.IMessageBrokerConnector';
let TopicMessageBrokerConnector = TopicMessageBrokerConnector_1 = class TopicMessageBrokerConnector {
    constructor(_options) {
        this._options = _options;
        this._subscribedPatterns = [];
        this._emitter = new events_1.EventEmitter();
        this._queueBound = false;
        this._isConnected = false;
        this._isConnecting = false;
        this._exchange = _options.exchange;
        this.queue = _options.queue;
        this.messageExpiredIn = _options.messageExpiredIn;
    }
    //#region Accessors
    /**
     * @see IMessageBrokerConnector.name
     */
    get name() {
        return this._options.name;
    }
    /**
     * @see IMessageBrokerConnector.queue
     */
    get queue() {
        return this._queue;
    }
    /**
     * @see IMessageBrokerConnector.queue
     */
    set queue(name) {
        if (this._queueBound) {
            throw new common_1.MinorException('Cannot change queue after binding!');
        }
        this._queue = name || `auto-gen-${shortid.generate()}`;
    }
    /**
     * @see IMessageBrokerConnector.messageExpiredIn
     */
    get messageExpiredIn() {
        return this._messageExpiredIn;
    }
    /**
     * @see IMessageBrokerConnector.messageExpiredIn
     */
    set messageExpiredIn(val) {
        if (this._queueBound) {
            throw new common_1.MinorException('Cannot change message expiration after queue has been bound!');
        }
        this._messageExpiredIn = (val >= 0) ? val : 0; // Unlimited
    }
    /**
     * @see IMessageBrokerConnector.subscribedPatterns
     */
    get subscribedPatterns() {
        return this._subscribedPatterns;
    }
    /**
     * @see IMessageBrokerConnector.isActive
     */
    get isActive() {
        return this._isConnecting || this._isConnected;
    }
    get isListening() {
        return this._consumerTag != null;
    }
    //#endregion Accessors
    /**
     * @see IMessageBrokerConnector.connect
     */
    connect() {
        const opts = this._options;
        let credentials = '';
        this._isConnecting = true;
        opts.reconnectDelay = (opts.reconnectDelay >= 0)
            ? opts.reconnectDelay
            : 3000; // 3s
        // Output:
        // - "usr@pass"
        // - "@pass"
        // - "usr@"
        // - ""
        if (!common_1.isEmpty(opts.username) || !common_1.isEmpty(opts.password)) {
            credentials = `${opts.username || ''}:${opts.password || ''}@`;
        }
        // URI format: amqp://usr:pass@10.1.2.3/vhost
        return this.createConnection(credentials, opts);
    }
    /**
     * @see IMessageBrokerConnector.disconnect
     */
    async disconnect() {
        try {
            if (!this._connectionPrm || (!this._isConnected && !this._isConnecting)) {
                return Promise.resolve();
            }
            const promises = [];
            let ch;
            if (this._consumeChanPrm) {
                ch = await this._consumeChanPrm;
                ch.removeAllListeners();
                // Close consuming channel
                promises.push(ch.close());
            }
            if (this._publishChanPrm) {
                ch = await this._publishChanPrm;
                ch.removeAllListeners();
                // Close publishing channel
                promises.push(ch.close());
            }
            // This causes `isListening` to be false
            this._consumerTag = null;
            // Make sure all channels are closed before we close connection.
            // Otherwise we will have dangling channels until application shuts down.
            await Promise.all(promises);
            if (this._connectionPrm) {
                const conn = await this._connectionPrm;
                conn.removeAllListeners();
                // Close connection, causing all temp queues to be deleted.
                return conn.close();
            }
        }
        catch (err) {
            return this.handleError(err, 'Connection closing error');
        }
        finally {
            this._connectionPrm = null;
            this._publishChanPrm = null;
            this._consumeChanPrm = null;
        }
    }
    /**
     * @see IMessageBrokerConnector.deleteQueue
     */
    async deleteQueue() {
        this.assertConnection();
        if (this.isListening) {
            throw new common_1.MinorException('Must stop listening before deleting queue');
        }
        try {
            const ch = await this._consumeChanPrm;
            await ch.deleteQueue(this.queue);
        }
        catch (err) {
            return this.handleError(err, 'Queue deleting failed');
        }
    }
    /**
     * @see IMessageBrokerConnector.emptyQueue
     */
    async emptyQueue() {
        this.assertConnection();
        try {
            const ch = await this._consumeChanPrm, result = await ch.purgeQueue(this.queue);
            return result.messageCount;
        }
        catch (err) {
            return this.handleError(err, 'Queue emptying failed');
        }
    }
    /**
     * @see IMessageBrokerConnector.listen
     */
    async listen(onMessage, noAck = true) {
        common_1.Guard.assertArgFunction('onMessage', onMessage);
        this.assertConnection();
        try {
            const ch = await this._consumeChanPrm;
            const conResult = await ch.consume(this.queue, (msg) => {
                const ack = () => ch.ack(msg), nack = () => ch.nack(msg, false, true);
                try {
                    onMessage(this.parseMessage(msg), ack, nack);
                }
                catch (err) {
                    this._emitter.emit('error', err);
                }
            }, { noAck });
            this._consumerTag = conResult.consumerTag;
        }
        catch (err) {
            return this.handleError(err, 'Error when start listening');
        }
    }
    /**
     * @see IMessageBrokerConnector.stopListen
     */
    async stopListen() {
        if (!this.isListening) {
            return Promise.resolve();
        }
        this.assertConnection();
        try {
            const ch = await this._consumeChanPrm;
            // onMessage callback will never be called again.
            await ch.cancel(this._consumerTag);
            this._consumerTag = null;
        }
        catch (err) {
            return this.handleError(err, 'Error when stop listening');
        }
    }
    /**
     * @see IMessageBrokerConnector.publish
     */
    async publish(topic, payload, options) {
        common_1.Guard.assertArgNotEmpty('topic', topic);
        common_1.Guard.assertArgNotEmpty('message', payload);
        this.assertConnection();
        try {
            if (!this._publishChanPrm) {
                // Create a new publishing channel if there is not already, and from now on we publish to this only channel.
                this._publishChanPrm = this.createPublishChannel();
            }
            const ch = await this._publishChanPrm;
            const [msg, opts] = this.buildMessage(payload, options);
            // We publish to exchange, then the exchange will route to appropriate consuming queue.
            ch.publish(this._exchange, topic, msg, opts);
        }
        catch (err) {
            return this.handleError(err, 'Publishing error');
        }
    }
    /**
     * @see IMessageBrokerConnector.subscribe
     */
    async subscribe(matchingPattern) {
        common_1.Guard.assertArgNotEmpty('matchingPattern', matchingPattern);
        this.assertConnection();
        try {
            let channelPromise = this._consumeChanPrm;
            if (!channelPromise) {
                // Create a new consuming channel if there is not already,
                // and from now on we listen to this only channel.
                channelPromise = this._consumeChanPrm = this.createConsumeChannel();
            }
            // The consuming channel should bind to only one queue,
            // but that queue can be routed with multiple keys.
            await this.bindQueue(await channelPromise, matchingPattern);
            this.moreSub(matchingPattern);
        }
        catch (err) {
            return this.handleError(err, 'Subscription error');
        }
    }
    /**
     * @see IMessageBrokerConnector.unsubscribe
     */
    async unsubscribe(matchingPattern) {
        this.assertConnection();
        try {
            if (!this._consumeChanPrm) {
                return;
            }
            this.lessSub(matchingPattern);
            const ch = await this._consumeChanPrm;
            await ch.unbindQueue(this._queue, this._exchange, matchingPattern);
        }
        catch (err) {
            return this.handleError(err, `Failed to unsubscribe pattern "${matchingPattern}"`);
        }
    }
    /**
     * @see IMessageBrokerConnector.unsubscribeAll
     */
    async unsubscribeAll() {
        return Promise.all(this._subscribedPatterns.map(this.unsubscribe.bind(this)));
    }
    /**
     * @see IMessageBrokerConnector.onError
     */
    onError(handler) {
        this._emitter.on('error', handler);
    }
    assertConnection() {
        common_1.Guard.assertIsDefined(this._connectionPrm, 'Connection to message broker is not established!');
        common_1.Guard.assertIsTruthy(this._isConnected || this._isConnecting, 'Connection to message broker is not established or has been disconnected!');
    }
    createConnection(credentials, options) {
        return this._connectionPrm = amqp.connect(`amqp://${credentials}${options.hostAddress}`)
            .then((conn) => {
            this._isConnected = true;
            this._isConnecting = false;
            conn.on('error', (err) => {
                this._emitter.emit('error', err);
            })
                .on('close', () => {
                this._isConnected = false;
                this.reconnect(credentials, options);
            });
            return conn;
        })
            .catch(err => {
            return this.handleError(err, 'Connection creation error');
        });
    }
    reconnect(credentials, options) {
        this._isConnecting = true;
        this._connectionPrm = new Promise((resolve, reject) => {
            setTimeout(() => {
                this.createConnection(credentials, options)
                    .then(resolve)
                    .catch(reject);
            }, options.reconnectDelay);
        });
        this.resetChannels();
    }
    resetChannels() {
        if (this._consumeChanPrm) {
            this._consumeChanPrm = this._consumeChanPrm
                .then(ch => ch.removeAllListeners())
                .then(() => {
                return this.createConsumeChannel();
            });
        }
        if (this._publishChanPrm) {
            this._publishChanPrm = this._publishChanPrm
                .then(ch => ch.removeAllListeners())
                .then(() => this.createPublishChannel());
        }
    }
    async createConsumeChannel() {
        return this.createChannel()
            .then(ch => {
            ch.once('close', () => {
                const oldCh = this._consumeChanPrm;
                // Delay a little bit to see if underlying connection is still alive
                setTimeout(() => {
                    // If connection has reset and already created new channels
                    if (this._consumeChanPrm !== oldCh) {
                        return;
                    }
                    this._consumeChanPrm = this.createConsumeChannel();
                }, TopicMessageBrokerConnector_1.CHANNEL_RECREATE_DELAY);
            });
            return ch;
        });
    }
    async createPublishChannel() {
        return this.createChannel()
            .then(ch => {
            ch.once('close', () => {
                const oldCh = this._publishChanPrm;
                // Delay a little bit to see if underlying connection is still alive
                setTimeout(() => {
                    // If connection has reset and already created new channels
                    if (this._publishChanPrm !== oldCh) {
                        return;
                    }
                    this._publishChanPrm = this.createPublishChannel();
                }, TopicMessageBrokerConnector_1.CHANNEL_RECREATE_DELAY);
            });
            return ch;
        });
    }
    async createChannel() {
        const EXCHANGE_TYPE = 'topic';
        try {
            const conn = await this._connectionPrm, ch = await conn.createChannel();
            // Tell message broker to create an exchange with this name if there's not any already.
            // Setting exchange as "durable" means the exchange with same name will be re-created after the message broker restarts,
            // but all queues and waiting messages will be lost.
            await ch.assertExchange(this._exchange, EXCHANGE_TYPE, { durable: true });
            ch.on('error', (err) => {
                this._emitter.emit('error', err);
            });
            return ch;
        }
        catch (err) {
            return this.handleError(err, 'Channel creation error');
        }
    }
    async bindQueue(channel, matchingPattern) {
        try {
            const queue = this.queue, isTempQueue = queue.startsWith('auto-gen');
            // Setting queue as "exclusive" to delete the temp queue when connection closes.
            await channel.assertQueue(queue, {
                exclusive: isTempQueue,
                messageTtl: this.messageExpiredIn,
                durable: false,
            });
            await channel.bindQueue(queue, this._exchange, matchingPattern);
            this._queueBound = true;
        }
        catch (err) {
            return this.handleError(err, 'Queue binding error');
        }
    }
    handleError(err, message) {
        if (err instanceof common_1.Exception) {
            // If this is already a wrapped exception.
            return Promise.reject(err);
        }
        return Promise.reject(new common_1.CriticalException(`${message}: ${err}`));
    }
    moreSub(pattern) {
        if (!this._subscribedPatterns.includes(pattern)) {
            this._subscribedPatterns.push(pattern);
        }
    }
    lessSub(pattern) {
        const pos = this._subscribedPatterns.indexOf(pattern);
        if (pos >= 0) {
            this._subscribedPatterns.splice(pos, 1);
        }
    }
    buildMessage(payload, options) {
        let msg;
        options = options || {};
        if (typeof payload === 'string') {
            msg = payload;
            options.contentType = 'text/plain';
        }
        else {
            msg = JSON.stringify(payload);
            options.contentType = 'application/json';
        }
        return [Buffer.from(msg), options];
    }
    parseMessage(raw) {
        const msg = {
            raw,
            properties: raw.properties || {},
        };
        const { contentType, contentEncoding } = msg.properties;
        if (raw.content instanceof Buffer) {
            const strContent = raw.content.toString(contentEncoding);
            if (contentType === 'application/json') {
                msg.data = JSON.parse(strContent);
            }
            else {
                msg.data = strContent;
            }
        }
        else {
            if (contentType === 'application/json') {
                msg.data = JSON.parse(String(raw.content));
            }
            else {
                msg.data = raw.content;
            }
        }
        return msg;
    }
};
TopicMessageBrokerConnector.CHANNEL_RECREATE_DELAY = 100; // Millisecs
TopicMessageBrokerConnector = TopicMessageBrokerConnector_1 = __decorate([
    common_1.decorators.injectable(),
    __metadata("design:paramtypes", [Object])
], TopicMessageBrokerConnector);
exports.TopicMessageBrokerConnector = TopicMessageBrokerConnector;
//# sourceMappingURL=MessageBrokerConnector.js.map