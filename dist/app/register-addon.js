"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@micro-fleet/common");
const Types_1 = require("./constants/Types");
const DirectRpcHandler_1 = require("./direct/DirectRpcHandler");
const DefaultDirectRpcHandlerAddOn_1 = require("./direct/DefaultDirectRpcHandlerAddOn");
const DefaultMediateRpcHandlerAddOn_1 = require("./mediate/DefaultMediateRpcHandlerAddOn");
const MediateRpcHandler_1 = require("./mediate/MediateRpcHandler");
const MessageBrokerAddOn_1 = require("./MessageBrokerAddOn");
const MessageBrokerConnector_1 = require("./MessageBrokerConnector");
const DirectRpcCaller_1 = require("./direct/DirectRpcCaller");
const MediateRpcCaller_1 = require("./mediate/MediateRpcCaller");
function registerMessageBrokerAddOn() {
    const depCon = common_1.serviceContext.dependencyContainer;
    if (!depCon.isBound(Types_1.Types.MSG_BROKER_CONNECTOR)) {
        depCon.bind(Types_1.Types.MSG_BROKER_CONNECTOR, MessageBrokerConnector_1.TopicMessageBrokerConnector).asSingleton();
    }
    if (!depCon.isBound(Types_1.Types.BROKER_ADDON)) {
        depCon.bind(Types_1.Types.BROKER_ADDON, MessageBrokerAddOn_1.MessageBrokerAddOn).asSingleton();
    }
    return depCon.resolve(Types_1.Types.BROKER_ADDON);
}
exports.registerMessageBrokerAddOn = registerMessageBrokerAddOn;
function registerDirectHandlerAddOn() {
    const depCon = common_1.serviceContext.dependencyContainer;
    if (!depCon.isBound(Types_1.Types.DIRECT_RPC_HANDLER)) {
        depCon.bind(Types_1.Types.DIRECT_RPC_HANDLER, DirectRpcHandler_1.ExpressRpcHandler).asSingleton();
    }
    if (!depCon.isBound(Types_1.Types.DIRECT_RPC_HANDLER_ADDON)) {
        depCon.bind(Types_1.Types.DIRECT_RPC_HANDLER_ADDON, DefaultDirectRpcHandlerAddOn_1.DefaultDirectRpcHandlerAddOn).asSingleton();
    }
    return depCon.resolve(Types_1.Types.DIRECT_RPC_HANDLER_ADDON);
}
exports.registerDirectHandlerAddOn = registerDirectHandlerAddOn;
function registerDirectCaller() {
    const depCon = common_1.serviceContext.dependencyContainer;
    if (!depCon.isBound(Types_1.Types.DIRECT_RPC_CALLER)) {
        depCon.bind(Types_1.Types.DIRECT_RPC_CALLER, DirectRpcCaller_1.HttpRpcCaller).asSingleton();
        depCon.bind(Types_1.Types.RPC_CALLER, DirectRpcCaller_1.HttpRpcCaller).asSingleton();
    }
}
exports.registerDirectCaller = registerDirectCaller;
function registerMediateHandlerAddOn() {
    const depCon = common_1.serviceContext.dependencyContainer;
    common_1.Guard.assertIsTruthy(depCon.isBound(Types_1.Types.BROKER_ADDON), 'MessageBrokerAddOn must be registered before this one');
    if (!depCon.isBound(Types_1.Types.MEDIATE_RPC_HANDLER)) {
        depCon.bind(Types_1.Types.MEDIATE_RPC_HANDLER, MediateRpcHandler_1.MessageBrokerRpcHandler).asSingleton();
    }
    if (!depCon.isBound(Types_1.Types.MEDIATE_RPC_HANDLER_ADDON)) {
        depCon.bind(Types_1.Types.MEDIATE_RPC_HANDLER_ADDON, DefaultMediateRpcHandlerAddOn_1.DefaultMediateRpcHandlerAddOn).asSingleton();
    }
    return depCon.resolve(Types_1.Types.MEDIATE_RPC_HANDLER_ADDON);
}
exports.registerMediateHandlerAddOn = registerMediateHandlerAddOn;
function registerMediateCaller() {
    const depCon = common_1.serviceContext.dependencyContainer;
    common_1.Guard.assertIsTruthy(depCon.isBound(Types_1.Types.BROKER_ADDON), 'MessageBrokerAddOn must be registered before this one');
    if (!depCon.isBound(Types_1.Types.MEDIATE_RPC_CALLER)) {
        depCon.bind(Types_1.Types.MEDIATE_RPC_CALLER, MediateRpcCaller_1.MessageBrokerRpcCaller).asSingleton();
        depCon.bind(Types_1.Types.RPC_CALLER, MediateRpcCaller_1.MessageBrokerRpcCaller).asSingleton();
    }
}
exports.registerMediateCaller = registerMediateCaller;
//# sourceMappingURL=register-addon.js.map