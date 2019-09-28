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
const MessageBrokerConnector_1 = require("./MessageBrokerConnector");
const { MessageBroker: S } = common_1.constants;
let MessageBrokerProviderAddOn = class MessageBrokerProviderAddOn {
    constructor(_createConnector, _configProvider) {
        this._createConnector = _createConnector;
        this._configProvider = _configProvider;
        this.name = 'MessageBrokerProviderAddOn';
        common_1.Guard.assertArgDefined('_configProvider', _configProvider);
        this._connectors = [];
    }
    //#region Implements IMessageBrokerConnectorProvider
    /**
     * @see IMessageBrokerConnectorProvider.create
     */
    create(name) {
        common_1.Guard.assertIsDefined(this._connectorOptions, 'MessageBrokerProviderAddOn must be initialized before creating connectors.');
        const connector = this._createConnector({
            ...this._connectorOptions,
            name,
        });
        this._connectors.push(connector);
        return connector;
    }
    /**
     * @see IMessageBrokerConnectorProvider.getAll
     */
    getAll() {
        return [...this._connectors];
    }
    /**
     * @see IMessageBrokerConnectorProvider.get
     */
    get(name) {
        return this._connectors.find(c => c.name === name);
    }
    //#endregion Implements IMessageBrokerConnectorProvider
    //#region Implements IServiceAddOn
    /**
     * @see IServiceAddOn.init
     */
    init() {
        const cfgAdt = this._configProvider;
        this._connectorOptions = {
            hostAddress: cfgAdt.get(S.MSG_BROKER_HOST).tryGetValue('localhost'),
            username: cfgAdt.get(S.MSG_BROKER_USERNAME).value,
            password: cfgAdt.get(S.MSG_BROKER_PASSWORD).value,
            exchange: cfgAdt.get(S.MSG_BROKER_EXCHANGE).value,
            queue: cfgAdt.get(S.MSG_BROKER_HANDLER_QUEUE).tryGetValue(null),
            reconnectDelay: cfgAdt.get(S.MSG_BROKER_RECONN_TIMEOUT).tryGetValue(3000),
            messageExpiredIn: cfgAdt.get(S.MSG_BROKER_MSG_EXPIRE).tryGetValue(50000),
        };
        return Promise.resolve();
    }
    /**
     * @see IServiceAddOn.deadLetter
     */
    deadLetter() {
        return Promise.all(this._connectors.map(c => c.stopListen()));
    }
    /**
     * @see IServiceAddOn.dispose
     */
    dispose() {
        return Promise
            .all(this._connectors.map(c => c.disconnect()))
            .then(() => this._connectors = []);
    }
};
MessageBrokerProviderAddOn = __decorate([
    common_1.decorators.injectable(),
    __param(0, common_1.decorators.inject(MessageBrokerConnector_1.IDENTIFIER)),
    __param(1, common_1.decorators.inject(common_1.Types.CONFIG_PROVIDER)),
    __metadata("design:paramtypes", [Function, Object])
], MessageBrokerProviderAddOn);
exports.MessageBrokerProviderAddOn = MessageBrokerProviderAddOn;
//# sourceMappingURL=MessageBrokerProviderAddOn.js.map