"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* istanbul ignore next */
if (!Reflect || typeof Reflect['hasOwnMetadata'] !== 'function') {
    require('reflect-metadata');
}
const controller_1 = require("./controller");
// import { model, ModelDecorator } from './model'
const action_1 = require("./action");
const filter_1 = require("./filter");
const resolveFn_1 = require("./resolveFn");
exports.decorators = {
    action: action_1.action,
    directController: controller_1.directController,
    mediateController: controller_1.mediateController,
    filter: filter_1.filter,
    // model,
    resolveFn: resolveFn_1.resolveFn,
};
//# sourceMappingURL=index.js.map