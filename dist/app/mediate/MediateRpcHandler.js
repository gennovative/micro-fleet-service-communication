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
const common_1 = require("@micro-fleet/common");
const Types_1 = require("../Types");
const rpc = require("../RpcCommon");
let MessageBrokerRpcHandler = class MessageBrokerRpcHandler extends rpc.RpcHandlerBase {
    constructor(_msgBrokerConn) {
        super();
        this._msgBrokerConn = _msgBrokerConn;
        common_1.Guard.assertArgDefined('_msgBrokerConn', _msgBrokerConn);
    }
    /**
     * @see IRpcHandler.init
     */
    init(params) {
        this._msgBrokerConn.onError(err => this.emitError(err));
    }
    /**
     * @see IRpcHandler.start
     */
    start() {
        return this._msgBrokerConn.listen(this.onMessage.bind(this));
    }
    /**
     * @see IRpcHandler.dispose
     */
    dispose() {
        // Stop listening then unsbuscribe all topic patterns.
        return Promise.all([
            this._msgBrokerConn.stopListen(),
            this._msgBrokerConn.unsubscribeAll()
        ]);
    }
    /**
     * @see IMediateRpcHandler.handle
     */
    async handle(moduleName, actionName, handler) {
        common_1.Guard.assertIsDefined(this.name, '`name` property is required.');
        const key = `${moduleName}.${actionName}`;
        if (this._handlers.has(key)) {
            console.warn(`MediateRpcHandler Warning: Override existing subscription key ${key}`);
        }
        this._handlers.set(key, handler);
        return this._msgBrokerConn.subscribe(`request.${key}`);
        // return <any>Promise.all(
        // 	actions.map(a => {
        // 		this._container.register(a, dependencyIdentifier, actionFactory);
        // 	})
        // );
    }
    /**
     * @see IMediateRpcHandler.handleCRUD
     */
    // public handleCRUD(dependencyIdentifier: string, actionFactory?: ActionFactory): Promise<void> {
    // 	return this.handle(
    // 		['countAll', 'create', 'delete', 'find', 'patch', 'update'],
    // 		dependencyIdentifier, actionFactory
    // 	);
    // }
    onMessage(msg) {
        const request = msg.data;
        const correlationId = msg.properties.correlationId;
        const replyTo = msg.properties.replyTo;
        (new Promise((resolve, reject) => {
            // Extract "module.action" out of "request.module.action"
            const routingKey = msg.raw.fields.routingKey;
            const key = routingKey.match(/[^\.]+\.[^\.]+$/)[0];
            try {
                if (!this._handlers.has(key)) {
                    throw new common_1.MinorException(`No handlers for request ${routingKey}`);
                }
                const actionFn = this._handlers.get(key);
                // Execute controller's action
                const output = actionFn(request.payload, resolve, reject, request);
                if (output instanceof Promise) {
                    output.catch(reject); // Catch async exceptions.
                }
            }
            catch (err) { // Catch normal exceptions.
                reject(err);
            }
        }))
            .then(result => {
            // Sends response to reply topic
            return this._msgBrokerConn.publish(replyTo, this.createResponse(true, result, request.from), { correlationId });
        })
            .catch(error => {
            let errObj = this.createError(error);
            // nack(); // Disable this, because we use auto-ack.
            return this._msgBrokerConn.publish(replyTo, this.createResponse(false, errObj, request.from), { correlationId });
        })
            // Catch error thrown by `createError()`
            .catch(this.emitError.bind(this));
    }
};
MessageBrokerRpcHandler = __decorate([
    common_1.injectable(),
    __param(0, common_1.inject(Types_1.Types.MSG_BROKER_CONNECTOR)),
    __metadata("design:paramtypes", [Object])
], MessageBrokerRpcHandler);
exports.MessageBrokerRpcHandler = MessageBrokerRpcHandler;
//# sourceMappingURL=MediateRpcHandler.js.map