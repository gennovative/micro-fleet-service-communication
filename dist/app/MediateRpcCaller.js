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
const events_1 = require("events");
const uuid = require("uuid");
const back_lib_common_util_1 = require("back-lib-common-util");
const Types_1 = require("./Types");
const rpc = require("./RpcCommon");
let MessageBrokerRpcCaller = class MessageBrokerRpcCaller extends rpc.RpcCallerBase {
    constructor(_msgBrokerConn) {
        super();
        this._msgBrokerConn = _msgBrokerConn;
    }
    init(param) {
    }
    call(moduleName, action, params) {
        back_lib_common_util_1.Guard.assertDefined('moduleName', moduleName);
        back_lib_common_util_1.Guard.assertDefined('action', action);
        return new Promise((resolve, reject) => {
            // There are many requests to same `requestTopic` and they listen to same `responseTopic`,
            // A request only carea for a response with same `correlationId`.
            const correlationId = uuid.v4(), replyTo = `response.${moduleName}.${action}`;
            let emitter = new events_1.EventEmitter();
            this._msgBrokerConn.subscribe(replyTo, (msg) => {
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
                emitter.once(correlationId, (msg) => {
                    // We got what we want, stop consuming.
                    this._msgBrokerConn.unsubscribe(consumerTag);
                    resolve(msg.data);
                });
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
