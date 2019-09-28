"use strict";
/// <reference types="debug" />
// const debug: debug.IDebugger = require('debug')('mcft:svccom:MessageBrokerRpcCaller')
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const shortid = require("shortid");
const common_1 = require("@micro-fleet/common");
const Types_1 = require("../constants/Types");
const rpc = require("../RpcCommon");
let MessageBrokerRpcCaller = class MessageBrokerRpcCaller extends rpc.RpcCallerBase {
    constructor(_msgBrokerConnProvider) {
        super();
        this._msgBrokerConnProvider = _msgBrokerConnProvider;
        common_1.Guard.assertArgDefined('_msgBrokerConnProvider', _msgBrokerConnProvider);
    }
    /**
     * @see IMediateRpcCaller.msgBrokerConnector
     */
    get msgBrokerConnector() {
        return this._msgBrokerConn;
    }
    get _isInit() {
        return Boolean(this._msgBrokerConn);
    }
    /**
     * @see IMediateRpcCaller.init
     */
    async init(options) {
        this.$name = options.callerName;
        let conn;
        if (options.connector) {
            conn = this._msgBrokerConn = options.connector;
            isTempQueue(conn.queue) || console.warn('Mediate RPC Caller expects an auto-generated and temporary queue, '
                + `but gets queue name: "${conn.queue}"`);
        }
        else {
            const name = options.connectorName || `Connector for RPC caller "${this.name}"`;
            conn = this._msgBrokerConn = await this._msgBrokerConnProvider.create(name);
            if (options.messageExpiredIn != null) {
                conn.messageExpiredIn = options.messageExpiredIn;
            }
            conn.onError(err => this.$emitError(err));
            conn.queue = null;
        }
        if (options.timeout != null) {
            this.$timeout = options.timeout;
        }
        if (!conn.isActive) {
            await conn.connect();
        }
    }
    /**
     * @see IRpcCaller.dispose
     */
    async dispose() {
        // DO NOT disconnect the connector as other RPC handlers and callers
        // may share this very connector.
        this._msgBrokerConn && (this._msgBrokerConn = null);
        await super.dispose();
    }
    /**
     * @see IRpcCaller.call
     */
    call({ moduleName, actionName, params, rawDest }) {
        common_1.Guard.assertIsTruthy(this._isInit, 'Must call "init" before use.');
        if (!rawDest) {
            common_1.Guard.assertArgDefined('moduleName', moduleName);
            common_1.Guard.assertArgDefined('actionName', actionName);
        }
        return new Promise((resolve, reject) => {
            // There are many requests to same `requestTopic` and they listen to same `responseTopic`,
            // A request only cares about a response with same `correlationId`.
            const correlationId = shortid.generate(), replyTo = Boolean(rawDest)
                ? `response.${rawDest}@${correlationId}`
                : `response.${moduleName}.${actionName}@${correlationId}`, conn = this._msgBrokerConn;
            const stopWaiting = async () => {
                await conn.unsubscribe(replyTo);
                await conn.stopListen();
            };
            conn.subscribe(replyTo)
                .then(() => {
                let token;
                const onMessage = async (msg) => {
                    clearTimeout(token);
                    // We got what we want, stop consuming.
                    await stopWaiting();
                    const response = msg.data;
                    if (response.hasOwnProperty('isSuccess') && !response.isSuccess) {
                        response.payload = this.$rebuildError(response.payload);
                        if (response.payload instanceof common_1.InternalErrorException) {
                            return reject(response.payload);
                        }
                    }
                    resolve(response);
                };
                // In case this request never has response.
                token = setTimeout(() => {
                    this.$emitter && this.$emitter.removeListener(correlationId, onMessage);
                    stopWaiting().catch(() => { });
                    reject(new common_1.MinorException('Response waiting timeout'));
                }, this.timeout);
                this.$emitter.once(correlationId, onMessage);
                return conn.listen((msg) => {
                    // Announce that we've got a response with this correlationId.
                    this.$emitter.emit(msg.properties.correlationId, msg);
                });
            })
                .then(() => {
                const request = {
                    from: this.name,
                    to: moduleName,
                    payload: params,
                };
                // Send request, marking the message with correlationId.
                return conn.publish(rawDest || `request.${moduleName}.${actionName}`, request, { correlationId, replyTo });
            })
                .catch(err => {
                reject(new common_1.MinorException(`RPC error: ${err}`));
                return stopWaiting().catch(() => { });
            });
        });
    }
    /**
     * @see IRpcCaller.callImpatient
     */
    callImpatient({ moduleName, actionName, params, rawDest }) {
        common_1.Guard.assertIsTruthy(this._isInit, 'Must call "init" before use.');
        if (!rawDest) {
            common_1.Guard.assertArgDefined('moduleName', moduleName);
            common_1.Guard.assertArgDefined('actionName', actionName);
        }
        const request = {
            from: this.name,
            to: moduleName,
            payload: params,
        };
        // Send request, marking the message with correlationId.
        return this._msgBrokerConn.publish(rawDest || `request.${moduleName}.${actionName}`, request)
            .catch(err => new common_1.MinorException(`RPC error: ${err}`));
    }
};
MessageBrokerRpcCaller = __decorate([
    common_1.decorators.injectable(),
    __param(0, common_1.decorators.inject(Types_1.Types.MSG_BROKER_CONNECTOR_PROVIDER)),
    __metadata("design:paramtypes", [Object])
], MessageBrokerRpcCaller);
exports.MessageBrokerRpcCaller = MessageBrokerRpcCaller;
function isTempQueue(queue) {
    return (queue === '') || (typeof queue === 'string' && queue.startsWith('auto-gen'));
}
//# sourceMappingURL=MediateRpcCaller.js.map