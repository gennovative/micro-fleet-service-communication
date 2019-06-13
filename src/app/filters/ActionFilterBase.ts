import { injectable } from '@micro-fleet/common'


@injectable()
export abstract class ActionFilterBase {

    protected addReadonlyProp(obj: object, prop: string, value: any): void {
        Object.defineProperty(obj, prop,
            {
                writable: false,
                enumerable: true,
                configurable: false,
                value,
            }
        )
    }
}
