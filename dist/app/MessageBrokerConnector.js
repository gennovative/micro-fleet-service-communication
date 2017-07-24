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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const amqp = require("amqplib");
const _ = require("lodash");
const back_lib_common_util_1 = require("back-lib-common-util");
let TopicMessageBrokerConnector = class TopicMessageBrokerConnector {
    constructor() {
        this._subscriptions = new Map();
        this._emitter = new events_1.EventEmitter();
        this._queueBound = false;
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
            throw new Error('Cannot change queue after binding!');
        }
        this._queue = name;
    }
    /**
     * @see IMessageBrokerConnector.connect
     */
    connect(options) {
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
        return this._connectionPrm = amqp.connect(`amqp://${credentials}${options.hostAddress}`)
            .then((conn) => {
            conn.on('error', (err) => {
                this._emitter.emit('error', err);
            });
            return conn;
        })
            .catch(err => {
            return this.handleError(err, 'Connection creation error');
        });
    }
    /**
     * @see IMessageBrokerConnector.disconnect
     */
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this._connectionPrm && !this._consumeChanPrm) {
                    return;
                }
                let ch, promises = [];
                if (this._consumeChanPrm) {
                    ch = yield this._consumeChanPrm;
                    // Close consuming channel
                    promises.push(ch.close());
                }
                if (this._publishChanPrm) {
                    ch = yield this._publishChanPrm;
                    // Close publishing channel
                    promises.push(ch.close());
                }
                // Make sure all channels are closed before we close connection.
                // Otherwise we will have dangling channels until application shuts down.
                yield Promise.all(promises);
                if (this._connectionPrm) {
                    let conn = yield this._connectionPrm;
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
        });
    }
    /**
     * @see IMessageBrokerConnector.subscribe
     */
    subscribe(matchingPattern, onMessage, noAck = true) {
        return __awaiter(this, void 0, void 0, function* () {
            back_lib_common_util_1.Guard.assertNotEmpty('matchingPattern', matchingPattern);
            back_lib_common_util_1.Guard.assertIsFunction('onMessage', onMessage);
            this.assertConnection();
            try {
                let channelPromise = this._consumeChanPrm;
                if (!channelPromise) {
                    // Create a new consuming channel if there is not already, and from now on we listen to this only channel.
                    channelPromise = this._consumeChanPrm = this.createChannel();
                }
                let ch = yield channelPromise;
                // The consuming channel should bind to only one queue, but that queue can be routed with multiple keys.
                let queueName = yield this.bindQueue(channelPromise, matchingPattern);
                let conResult = yield ch.consume(queueName, (msg) => {
                    let ack = () => ch.ack(msg), nack = () => ch.nack(msg);
                    onMessage(this.parseMessage(msg), ack, nack);
                }, { noAck });
                this.moreSub(matchingPattern, conResult.consumerTag);
                return conResult.consumerTag;
            }
            catch (err) {
                return this.handleError(err, 'Subscription error');
            }
        });
    }
    /**
     * @see IMessageBrokerConnector.publish
     */
    publish(topic, payload, options) {
        return __awaiter(this, void 0, void 0, function* () {
            back_lib_common_util_1.Guard.assertNotEmpty('topic', topic);
            back_lib_common_util_1.Guard.assertNotEmpty('message', payload);
            this.assertConnection();
            try {
                if (!this._publishChanPrm) {
                    // Create a new publishing channel if there is not already, and from now on we publish to this only channel.
                    this._publishChanPrm = this.createChannel();
                }
                let ch = yield this._publishChanPrm, opt;
                let [msg, opts] = this.buildMessage(payload, options);
                // We publish to exchange, then the exchange will route to appropriate consuming queue.
                ch.publish(this._exchange, topic, msg, opts);
            }
            catch (err) {
                return this.handleError(err, 'Publishing error');
            }
        });
    }
    /**
     * @see IMessageBrokerConnector.unsubscribe
     */
    unsubscribe(consumerTag) {
        return __awaiter(this, void 0, void 0, function* () {
            this.assertConnection();
            try {
                if (!this._consumeChanPrm) {
                    return;
                }
                let ch = yield this._consumeChanPrm;
                // onMessage callback will never be called again.
                yield ch.cancel(consumerTag);
                let unusedPattern = this.lessSub(consumerTag);
                if (unusedPattern) {
                    this.unbindQueue(this._consumeChanPrm, unusedPattern);
                }
            }
            catch (err) {
                return this.handleError(err, `Failed to unsubscribe tag "${consumerTag}"`);
            }
        });
    }
    /**
     * @see IMessageBrokerConnector.onError
     */
    onError(handler) {
        this._emitter.on('error', handler);
    }
    assertConnection() {
        back_lib_common_util_1.Guard.assertDefined('connection', this._connectionPrm, 'Connection to message broker is not established or has been disconnected!');
    }
    createChannel() {
        return __awaiter(this, void 0, void 0, function* () {
            const EXCHANGE_TYPE = 'topic';
            try {
                let conn = yield this._connectionPrm, ch = yield conn.createChannel(), 
                // Tell message broker to create an exchange with this name if there's not any already.
                // Setting exchange as "durable" means the exchange with same name will be re-created after the message broker restarts,
                // but all queues and waiting messages will be lost.
                exResult = yield ch.assertExchange(this._exchange, EXCHANGE_TYPE, { durable: true });
                ch.on('error', (err) => {
                    this._emitter.emit('error', err);
                });
                return ch;
            }
            catch (err) {
                return this.handleError(err, 'Channel creation error');
            }
        });
    }
    /**
     * If `queueName` is null, creates a queue and binds it to `matchingPattern`.
     * If `queueName` is not null, binds `matchingPattern` to the queue with that name.
     * @return {string} null if no queue is created, otherwise returns the new queue name.
     */
    bindQueue(channelPromise, matchingPattern) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let ch = yield channelPromise, isTempQueue = (!this._queue), 
                // If configuration doesn't provide queue name,
                // we provide empty string as queue name to tell message broker to choose a unique name for us.
                // Setting queue as "exclusive" to delete the temp queue when connection closes.
                quResult = yield ch.assertQueue(this._queue || '', { exclusive: isTempQueue });
                yield ch.bindQueue(quResult.queue, this._exchange, matchingPattern);
                // Store queue name for later use.
                // In our system, each channel is associated with only one queue.
                return this._queue = quResult.queue;
            }
            catch (err) {
                return this.handleError(err, 'Queue binding error');
            }
        });
    }
    unbindQueue(channelPromise, matchingPattern) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let ch = yield channelPromise;
                yield ch.unbindQueue(this._queue, this._exchange, matchingPattern);
            }
            catch (err) {
                return this.handleError(err, 'Queue unbinding error');
            }
        });
    }
    handleError(err, message) {
        if (err instanceof back_lib_common_util_1.CriticalException) {
            // If this is already a wrapped exception.
            return Promise.reject(err);
        }
        return Promise.reject(new back_lib_common_util_1.CriticalException(`${message}: ${err}`));
    }
    moreSub(matchingPattern, consumerTag) {
        let consumers = this._subscriptions.get(matchingPattern);
        if (!consumers) {
            this._subscriptions.set(matchingPattern, new Set(consumerTag));
            return;
        }
        consumers.add(consumerTag);
    }
    /**
     * @return {string} the pattern name which should be unbound, othewise return null.
     */
    lessSub(consumerTag) {
        let subscriptions = this._subscriptions, matchingPattern = null;
        for (let sub of subscriptions) {
            if (!sub[1].has(consumerTag)) {
                continue;
            }
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
    buildMessage(payload, options) {
        let msg;
        options = options || {};
        if (_.isString(payload)) {
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
        let msg = {
            raw,
            properties: raw.properties || {}
        };
        if (msg.properties.contentType == 'text/plain') {
            msg.data = raw.content.toString(msg.properties.contentEncoding);
        }
        else {
            msg.data = JSON.parse(raw.content);
        }
        return msg;
    }
};
TopicMessageBrokerConnector = __decorate([
    back_lib_common_util_1.injectable(),
    __metadata("design:paramtypes", [])
], TopicMessageBrokerConnector);
exports.TopicMessageBrokerConnector = TopicMessageBrokerConnector;

//# sourceMappingURL=MessageBrokerConnector.js.map
