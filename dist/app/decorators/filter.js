"use strict";
/// <reference types="reflect-metadata" />
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@micro-fleet/common");
const MetaData_1 = require("../constants/MetaData");
/**
 * Represents the order in which filters are invoked.
 */
var FilterPriority;
(function (FilterPriority) {
    FilterPriority[FilterPriority["LOW"] = 0] = "LOW";
    FilterPriority[FilterPriority["MEDIUM"] = 1] = "MEDIUM";
    FilterPriority[FilterPriority["HIGH"] = 2] = "HIGH";
})(FilterPriority = exports.FilterPriority || (exports.FilterPriority = {}));
/**
 * Used to add filter to controller class and controller action.
 * @param {class} FilterClass Filter class whose name must end with "Filter".
 * @param {FilterPriority} priority Filters with greater priority run before ones with less priority.
 */
function filter(FilterClass, priority = FilterPriority.MEDIUM, ...filterParams) {
    return function (TargetClass, key) {
        return addFilterToTarget(FilterClass, TargetClass, key, priority, ...filterParams);
    };
}
exports.filter = filter;
/**
 * Adds a filter to `TargetClass`. `TargetClass` can be a class or class prototype,
 * depending on whether the filter is meant to apply on class or class method.
 * @param FilterClass The filter class.
 * @param TargetClassOrPrototype A class or class prototype.
 * @param targetFunc Method name, if `TargetClass` is prototype object,
 * @param {FilterPriority} priority Filters with greater priority run before ones with less priority.
 */
function addFilterToTarget(FilterClass, TargetClassOrPrototype, targetFunc, priority = FilterPriority.MEDIUM, ...filterParams) {
    const isClassScope = (!targetFunc); // If `targetFunc` has value, `targetClass` is "prototype" object, otherwise it's a class.
    let metaKey;
    if (isClassScope) {
        metaKey = MetaData_1.MetaData.CONTROLLER_FILTER;
    }
    else {
        // If @filter is applied to class method, the given `TargetClass` is actually the class's prototype.
        TargetClassOrPrototype = TargetClassOrPrototype.constructor;
        metaKey = MetaData_1.MetaData.ACTION_FILTER;
    }
    let filters = isClassScope
        ? Reflect.getOwnMetadata(metaKey, TargetClassOrPrototype)
        : Reflect.getMetadata(metaKey, TargetClassOrPrototype, targetFunc);
    filters = filters || [];
    pushFilterToArray(filters, FilterClass, priority, ...filterParams);
    Reflect.defineMetadata(metaKey, filters, TargetClassOrPrototype, targetFunc);
    return TargetClassOrPrototype;
}
exports.addFilterToTarget = addFilterToTarget;
/**
 * Prepares a filter then push it to given array.
 */
function pushFilterToArray(filters, FilterClass, priority = FilterPriority.MEDIUM, ...filterParams) {
    common_1.Guard.assertIsTruthy(priority >= FilterPriority.LOW && priority <= FilterPriority.HIGH, 'Invalid filter priority.');
    // `filters` is a 2-dimensioned matrix, with indexes are priority value,
    //   values are array of Filter classes. Eg:
    // filters = [
    //        1: [ FilterClass, FilterClass ]
    //        3: [ FilterClass, FilterClass ]
    // ]
    filters[priority] = filters[priority] || [];
    filters[priority].push({ FilterClass, filterParams });
}
exports.pushFilterToArray = pushFilterToArray;
//# sourceMappingURL=filter.js.map