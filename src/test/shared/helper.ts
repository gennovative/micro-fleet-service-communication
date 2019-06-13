
export function sleep(milisec: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milisec))
}
