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
const back_lib_common_constants_1 = require("back-lib-common-constants");
const back_lib_common_contracts_1 = require("back-lib-common-contracts");
const back_lib_common_util_1 = require("back-lib-common-util");
const Types_1 = require("./Types");
let MessageBrokerAddOn = class MessageBrokerAddOn {
    constructor(_configProvider, _msgBrokerCnn) {
        this._configProvider = _configProvider;
        this._msgBrokerCnn = _msgBrokerCnn;
        back_lib_common_util_1.Guard.assertArgDefined('_configProvider', _configProvider);
        back_lib_common_util_1.Guard.assertArgDefined('_msgBrokerCnn', _msgBrokerCnn);
    }
    /**
     * @see IServiceAddOn.init
     */
    init() {
        let cfgAdt = this._configProvider, opts = {
            hostAddress: cfgAdt.get(back_lib_common_constants_1.MbSettingKeys.MSG_BROKER_HOST),
            username: cfgAdt.get(back_lib_common_constants_1.MbSettingKeys.MSG_BROKER_USERNAME),
            password: cfgAdt.get(back_lib_common_constants_1.MbSettingKeys.MSG_BROKER_PASSWORD),
            exchange: cfgAdt.get(back_lib_common_constants_1.MbSettingKeys.MSG_BROKER_EXCHANGE),
            queue: cfgAdt.get(back_lib_common_constants_1.MbSettingKeys.MSG_BROKER_QUEUE),
            reconnectDelay: cfgAdt.get(back_lib_common_constants_1.MbSettingKeys.MSG_BROKER_RECONN_TIMEOUT),
            messageExpiredIn: cfgAdt.get(back_lib_common_constants_1.MbSettingKeys.MSG_BROKER_RECONN_TIMEOUT),
        };
        return this._msgBrokerCnn.connect(opts);
    }
    /**
     * @see IServiceAddOn.deadLetter
     */
    deadLetter() {
        return Promise.resolve();
    }
    /**
     * @see IServiceAddOn.dispose
     */
    dispose() {
        return this._msgBrokerCnn.disconnect();
    }
};
MessageBrokerAddOn = __decorate([
    back_lib_common_util_1.injectable(),
    __param(0, back_lib_common_util_1.inject(back_lib_common_contracts_1.Types.CONFIG_PROVIDER)),
    __param(1, back_lib_common_util_1.inject(Types_1.Types.MSG_BROKER_CONNECTOR)),
    __metadata("design:paramtypes", [Object, Object])
], MessageBrokerAddOn);
exports.MessageBrokerAddOn = MessageBrokerAddOn;

//# sourceMappingURL=MessageBrokerAddOn.js.map
