"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ModelFilter_1 = require("../filters/ModelFilter");
const filter_1 = require("./filter");
/**
 * Attempts to translate request body to desired model class.
 */
function model(opts) {
    return function (TargetClass, key) {
        TargetClass = filter_1.addFilterToTarget(ModelFilter_1.ModelFilter, TargetClass, key, filter_1.FilterPriority.MEDIUM, opts);
        return TargetClass;
    };
}
exports.model = model;
//# sourceMappingURL=model.js.map