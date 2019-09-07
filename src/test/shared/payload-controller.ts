import * as chai from 'chai'

import { decorators as d } from '../../app'
import { SampleModel } from './SampleModel'


//#region Exports

export const MODULE_NAME = 'payload'

export const ACT_RESOLVE = 'resolve'
export const ACT_RAW_DEST = 'rawREq.loadpay.resolve'
export const ACT_TRANSLATE_WHOLE_AUTO = 'translate-whole-auto'
export const ACT_TRANSLATE_WHOLE_MANUAL = 'translate-whole-manual'
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

    @d.action(ACT_RAW_DEST, true)
    public rawDestMe(@d.payload() payload: object): void {
        this.spyFn(payload['name'])
    }

    @d.action(ACT_TRANSLATE_WHOLE_AUTO)
    public translateWholeAuto(
        @d.payload() payload: SampleModel
    ): void {
        this.spyFn(payload.constructor.name, payload.name, payload.age, payload.position)
    }

    @d.action(ACT_TRANSLATE_WHOLE_MANUAL)
    public translateWholeManual(
        @d.payload(SampleModel) payload: SampleModel
    ): void {
        this.spyFn(payload.constructor.name, payload.name, payload.age, payload.position)
    }

    @d.action(ACT_TRANSLATE_PARTIAL)
    public translatePartial(
            @d.payload({
                ItemClass: SampleModel,
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
            ItemClass: SampleModel,
            extractFn: (payload: any) => payload.one,
        })
        modelSingle: SampleModel,
        @d.payload({
            ItemClass: SampleModel,
            extractFn: (payload: any) => payload.two,
        })
        modelArr: SampleModel[],
    ): void {

        this.spyFn(
            modelSingle.constructor.name, modelSingle.name, modelSingle.age,
            modelArr.length,
            modelArr[0].constructor.name, modelArr[0].name, modelArr[0].age,
            modelArr[1].constructor.name, modelArr[1].name, modelArr[1].age,
        )
    }

    @d.action(ACT_VALIDATE)
    public validateFailed(
        @d.payload({
            ItemClass: SampleModel,
            enableValidation: true,
        })
        invalidModel: SampleModel
    ): void {

        this.spyFn()
    }
}
