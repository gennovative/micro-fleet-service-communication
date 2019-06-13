"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* istanbul ignore next */
if (!Reflect || typeof Reflect['hasOwnMetadata'] !== 'function') {
    require('reflect-metadata');
}
const controller_1 = require("./controller");
const model_1 = require("./model");
const filter_1 = require("./filter");
const act = require("./action");
exports.decorators = {
    action: act.action,
    directController: controller_1.directController,
    mediateController: controller_1.mediateController,
    filter: filter_1.filter,
    model: model_1.model,
};
//# sourceMappingURL=index.js.map