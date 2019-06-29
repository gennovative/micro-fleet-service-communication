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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const shortid = require("shortid");
const common_1 = require("@micro-fleet/common");
const Types_1 = require("../Types");
const rpc = require("../RpcCommon");
let MessageBrokerRpcCaller = class MessageBrokerRpcCaller extends rpc.RpcCallerBase {
    constructor(_msgBrokerConn) {
        super();
        this._msgBrokerConn = _msgBrokerConn;
        common_1.Guard.assertArgDefined('_msgBrokerConn', _msgBrokerConn);
        this._msgBrokerConn.queue = ''; // Make sure we only use temporary unique queue.
    }
    /**
     * @see IRpcCaller.init
     */
    init(params) {
        const expire = this._msgBrokerConn.messageExpiredIn;
        this._msgBrokerConn.messageExpiredIn = expire > 0 ? expire : 30000; // Make sure we only use temporary unique queue.
        this._msgBrokerConn.onError(err => this._emitError(err));
    }
    /**
     * @see IRpcCaller.dispose
     */
    async dispose() {
        // DO NOT disconnect the connector as other RPC handlers and callers
        // share this very connector.
        this._msgBrokerConn = null;
        await super.dispose();
    }
    /**
     * @see IRpcCaller.call
     */
    call(moduleName, action, params) {
        common_1.Guard.assertArgDefined('moduleName', moduleName);
        common_1.Guard.assertArgDefined('action', action);
        return new Promise((resolve, reject) => {
            // There are many requests to same `requestTopic` and they listen to same `responseTopic`,
            // A request only cares about a response with same `correlationId`.
            const correlationId = shortid.generate(), replyTo = `response.${moduleName}.${action}@${correlationId}`, conn = this._msgBrokerConn;
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
                        response.payload = this._rebuildError(response.payload);
                    }
                    resolve(response);
                };
                // In case this request never has response.
                token = setTimeout(() => {
                    this._emitter && this._emitter.removeListener(correlationId, onMessage);
                    this._msgBrokerConn && conn.unsubscribe(replyTo).catch(() => { });
                    reject(new common_1.MinorException('Response waiting timeout'));
                }, this.timeout);
                this._emitter.once(correlationId, onMessage);
                return conn.listen((msg) => {
                    // Announce that we've got a response with this correlationId.
                    this._emitter.emit(msg.properties.correlationId, msg);
                });
            })
                .then(() => {
                const request = {
                    from: this.name,
                    to: moduleName,
                    payload: params,
                };
                // Send request, marking the message with correlationId.
                return this._msgBrokerConn.publish(`request.${moduleName}.${action}`, request, { correlationId, replyTo });
            })
                .catch(err => {
                reject(new common_1.MinorException(`RPC error: ${err}`));
            });
        });
    }
};
MessageBrokerRpcCaller = __decorate([
    common_1.injectable(),
    __param(0, common_1.inject(Types_1.Types.MSG_BROKER_CONNECTOR)),
    __metadata("design:paramtypes", [Object])
], MessageBrokerRpcCaller);
exports.MessageBrokerRpcCaller = MessageBrokerRpcCaller;
//# sourceMappingURL=MediateRpcCaller.js.map