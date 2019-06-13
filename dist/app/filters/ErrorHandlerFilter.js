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
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@micro-fleet/common");
/**
 * Catches unhandled exceptions from action methods.
 */
let ErrorHandlerFilter = class ErrorHandlerFilter {
    constructor(
    // @inject() private logProvider: ILogProvider
    ) {
        // Empty
    }
    execute(error, req, res, next) {
        const isDebugMode = Boolean(process.env['DEBUG']);
        //
        // TODO: Write error to file or logging service.
        //
        if (res.headersSent) {
            res.status(500).send(JSON.stringify(error, stringifyError));
            return;
        }
        res.setHeader('Content-Type', 'application/json');
        if (error.name === 'ValidationError') {
            // https://httpstatuses.com/422 (UNPROCESSABLE ENTITY)
            res.status(422).send(JSON.stringify(error['details'] || error, stringifyError));
        }
        else if (isDebugMode) {
            res.status(500).send(JSON.stringify(error, stringifyError));
            console.log(error);
        }
        else {
            res.status(500).end();
        }
        next();
    }
};
ErrorHandlerFilter = __decorate([
    common_1.injectable(),
    __metadata("design:paramtypes", [])
], ErrorHandlerFilter);
exports.ErrorHandlerFilter = ErrorHandlerFilter;
function stringifyError(key, value) {
    if (!(value instanceof Error)) {
        return value;
    }
    const error = {};
    Object.getOwnPropertyNames(value).forEach(function (prop) {
        error[prop] = value[prop];
    });
    return error;
}
//# sourceMappingURL=ErrorHandlerFilter.js.map