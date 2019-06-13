import { ModelFilter, ModelFilterOptions } from '../filters/ModelFilter'
import { addFilterToTarget, FilterPriority } from './filter'


export type ModelDecorator = (opts: ModelFilterOptions) => Function


/**
 * Attempts to translate request body to desired model class.
 */
export function model(opts: ModelFilterOptions): Function {
    return function (TargetClass: Newable, key: string): Function {
        TargetClass = addFilterToTarget<ModelFilter>(ModelFilter, TargetClass, key, FilterPriority.MEDIUM, opts) as Newable
        return TargetClass
    }
}
