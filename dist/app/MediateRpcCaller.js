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
const shortid = require("shortid");
const back_lib_common_util_1 = require("back-lib-common-util");
const Types_1 = require("./Types");
const rpc = require("./RpcCommon");
let MessageBrokerRpcCaller = class MessageBrokerRpcCaller extends rpc.RpcCallerBase {
    constructor(_msgBrokerConn) {
        super();
        this._msgBrokerConn = _msgBrokerConn;
        back_lib_common_util_1.Guard.assertDefined('_msgBrokerConn', _msgBrokerConn);
        this._emitter = new events_1.EventEmitter();
        this._msgBrokerConn.queue = ''; // Make sure we only use temporary unique queue.
    }
    /**
     * @see IRpcCaller.init
     */
    init(params) {
    }
    /**
     * @see IRpcCaller.call
     */
    call(moduleName, action, params) {
        back_lib_common_util_1.Guard.assertDefined('moduleName', moduleName);
        back_lib_common_util_1.Guard.assertDefined('action', action);
        return new Promise((resolve, reject) => {
            // There are many requests to same `requestTopic` and they listen to same `responseTopic`,
            // A request only cares about a response with same `correlationId`.
            const correlationId = shortid.generate(), replyTo = `response.${moduleName}.${action}`;
            this._msgBrokerConn.subscribe(replyTo, (msg) => {
                // Announce that we've got a response with this correlationId.
                this._emitter.emit(msg.properties.correlationId, msg);
            })
                .then(consumerTag => {
                // TODO: Should have a timeout to remove this listener, in case this request never has response.
                this._emitter.once(correlationId, (msg) => __awaiter(this, void 0, void 0, function* () {
                    // We got what we want, stop consuming.
                    yield this._msgBrokerConn.unsubscribe(consumerTag);
                    resolve(msg.data);
                }));
                let request = {
                    from: this._name,
                    to: moduleName,
                    params
                };
                // Send request, marking the message with correlationId.
                return this._msgBrokerConn.publish(`request.${moduleName}.${action}`, request, { correlationId, replyTo });
            })
                .catch(err => {
                reject(new back_lib_common_util_1.MinorException(`RPC error: ${err}`));
            });
        });
    }
};
MessageBrokerRpcCaller = __decorate([
    back_lib_common_util_1.injectable(),
    __param(0, back_lib_common_util_1.inject(Types_1.Types.MSG_BROKER_CONNECTOR)),
    __metadata("design:paramtypes", [Object])
], MessageBrokerRpcCaller);
exports.MessageBrokerRpcCaller = MessageBrokerRpcCaller;

//# sourceMappingURL=MediateRpcCaller.js.map
