import * as joi from 'joi'

import { Translatable, decorators as d } from '@micro-fleet/common'


export class SampleModel extends Translatable {
    @d.required()
    @d.string({ minLength: 1, maxLength: 30 })
    public readonly name: string = undefined

    @d.validateProp(joi.number().greater(18).required())
    public readonly age: number = undefined

    @d.string({ minLength: 1 })
    public readonly position: string = undefined
}
