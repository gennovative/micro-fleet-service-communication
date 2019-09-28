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
const { Service: S, MessageBroker: MB, RPC, } = common_1.constants;
let MessageBrokerRpcCaller = class MessageBrokerRpcCaller extends rpc.RpcCallerBase {
    constructor(_config, _msgBrokerConnProvider) {
        super();
        this._config = _config;
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
    async init(options = {}) {
        this.$name = options.callerName || this._config.get(S.SERVICE_SLUG).value;
        if (options.connector) {
            this._msgBrokerConn = options.connector;
        }
        else {
            const name = options.connectorName || `Connector for RPC caller "${this.name}"`;
            this._msgBrokerConn = await this._msgBrokerConnProvider.create(name);
            this._msgBrokerConn.messageExpiredIn = this._config
                .get(MB.MSG_BROKER_MSG_EXPIRE, common_1.SettingItemDataType.Number)
                .tryGetValue(30e3);
            this._msgBrokerConn.onError(err => this.$emitError(err));
        }
        this.$timeout = this._config
            .get(RPC.RPC_CALLER_TIMEOUT, common_1.SettingItemDataType.Number)
            .tryGetValue(30e3);
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
            conn.subscribe(replyTo)
                .then(() => {
                let token;
                const onMessage = async (msg) => {
                    clearTimeout(token);
                    // We got what we want, stop consuming.
                    await conn.unsubscribe(replyTo);
                    await conn.stopListen();
                    const response = msg.data;
                    if (!response.isSuccess) {
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
                    conn && conn.unsubscribe(replyTo).catch(() => { });
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
    __param(0, common_1.decorators.inject(common_1.Types.CONFIG_PROVIDER)),
    __param(1, common_1.decorators.inject(Types_1.Types.MSG_BROKER_CONNECTOR_PROVIDER)),
    __metadata("design:paramtypes", [Object, Object])
], MessageBrokerRpcCaller);
exports.MessageBrokerRpcCaller = MessageBrokerRpcCaller;
//# sourceMappingURL=MediateRpcCaller.js.map