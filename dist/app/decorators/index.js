"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* istanbul ignore next */
if (!Reflect || typeof Reflect['hasOwnMetadata'] !== 'function') {
    require('reflect-metadata');
}
const controller_1 = require("./controller");
const action_1 = require("./action");
const filter_1 = require("./filter");
const rawMessage_1 = require("./rawMessage");
const resolveFn_1 = require("./resolveFn");
const rejectFn_1 = require("./rejectFn");
const rpcRequest_1 = require("./rpcRequest");
const payload_1 = require("./payload");
exports.decorators = {
    action: action_1.action,
    directController: controller_1.directController,
    mediateController: controller_1.mediateController,
    filter: filter_1.filter,
    rawMessage: rawMessage_1.rawMessage,
    resolveFn: resolveFn_1.resolveFn,
    rejectFn: rejectFn_1.rejectFn,
    rpcRequest: rpcRequest_1.rpcRequest,
    payload: payload_1.payload,
};
//# sourceMappingURL=index.js.map