import { Newable } from '@micro-fleet/common'

export const INVERSIFY_INJECTABLE = 'inversify:paramtypes'

export type ControllerExports = { [name: string]: Newable }

export enum ControllerCreationStrategy { SINGLETON, TRANSIENT }
