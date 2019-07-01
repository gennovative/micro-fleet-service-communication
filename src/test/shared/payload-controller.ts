import * as chai from 'chai'

import { decorators as d } from '../../app'
import { SampleModel } from './SampleModel'


//#region Exports

export const MODULE_NAME = 'payload'

export const ACT_RESOLVE = 'resolve'
export const ACT_TRANSLATE_WHOLE = 'translate-whole'
export const ACT_TRANSLATE_PARTIAL = 'translate-partial'
export const ACT_TRANSLATE_CUSTOM = 'translate-custom'
export const ACT_EXTRACT_FUNC = 'use-extractFn'
export const ACT_VALIDATE = 'validate'

//#endregion Exports


@d.directController(MODULE_NAME)
@d.mediateController(MODULE_NAME)
export class PayloadController {

    public spyFn: Function

    constructor() {
        this.spyFn = chai.spy()
    }

    @d.action(ACT_RESOLVE)
    public resolveMe(@d.payload() payload: object): void {
        this.spyFn(payload['name'])
    }

    @d.action(ACT_TRANSLATE_WHOLE)
    public translateWhole(
            @d.payload(SampleModel) payload: SampleModel
        ): void {

        this.spyFn(payload.constructor.name, payload.name, payload.age, payload.position)
    }

    @d.action(ACT_TRANSLATE_PARTIAL)
    public translatePartial(
            @d.payload({
                ModelClass: SampleModel,
                isPartial: true,
            })
            payload: Partial<SampleModel>
        ): void {

        this.spyFn(payload.constructor.name, payload.name, payload.age, payload.position)
    }

    @d.action(ACT_TRANSLATE_CUSTOM)
    public translateCustom(
            @d.payload({ extractFn: Number }) age: number,
            @d.payload({ extractFn: Boolean }) isMarried: boolean,
        ): void {

        this.spyFn(typeof age, age, typeof isMarried, isMarried)
    }

    @d.action(ACT_EXTRACT_FUNC)
    public useExtractFn(
            @d.payload({
                ModelClass: SampleModel,
                extractFn: (payload: any) => payload.one,
            })
            modelOne: SampleModel,
            @d.payload({
                ModelClass: SampleModel,
                extractFn: (payload: any) => payload.two,
            })
            modelTwo: SampleModel,
        ): void {

        this.spyFn(
            modelOne.constructor.name, modelOne.name, modelOne.age, modelOne.position,
            modelTwo.constructor.name, modelTwo.name, modelTwo.age, modelTwo.position,
        )
    }

    @d.action(ACT_VALIDATE)
    public validateFailed(
            @d.payload(SampleModel) invalidModel: SampleModel
        ): void {

        this.spyFn()
    }
}
