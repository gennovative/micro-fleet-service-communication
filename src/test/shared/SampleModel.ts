import * as joi from 'joi'

import { ModelAutoMapper, JoiModelValidator,
    IModelAutoMapper, IModelValidator } from '@micro-fleet/common'


export class SampleModel {
    public static validator: IModelValidator<SampleModel>
    public static translator: IModelAutoMapper<SampleModel>

    public readonly name: string = undefined

    public readonly age: number = undefined

    public readonly position: string = undefined
}


const validator = SampleModel.validator = JoiModelValidator.create({
    schemaMapModel: {
        name: joi.string().min(1).max(30).required(),
        age: joi.number().greater(18).required(),
        position: joi.string().min(1).optional(),
    },
})

SampleModel.translator = new ModelAutoMapper(SampleModel, validator)
