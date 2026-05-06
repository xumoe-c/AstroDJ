declare global {
    interface Window {
        Go: any
        validateChart: (json: string) => { ok: boolean; error?: string }
        judge: (rule: string, delta: number) => number
        convertOsu: (osuText: string) => { ok: boolean; json?: string; error?: string }
    }
}

let wasmReady = false

export async function initWasm(): Promise<void> {
    if (wasmReady) return

    // Inject wasm_exec.js
    await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = '/wasm/wasm_exec.js'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load wasm_exec.js'))
        document.head.appendChild(script)
    })

    // Load and run WASM
    const go = new window.Go()
    const result = await WebAssembly.instantiateStreaming(
        fetch('/wasm/main.wasm'),
        go.importObject,
    )
    go.run(result.instance)

    // Wait for judge to be registered (with timeout)
    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('WASM init timeout: judge not registered after 10s'))
        }, 10000)

        const check = () => {
            if (typeof window.judge === 'function') {
                clearTimeout(timeout)
                resolve()
            } else {
                setTimeout(check, 10)
            }
        }
        check()
    })

    wasmReady = true
}

export function validateChart(json: string): void {
    if (typeof window.validateChart !== 'function') {
        console.warn('validateChart not available in WASM, skipping validation')
        return
    }
    const result = window.validateChart(json)
    if (!result.ok) {
        throw new Error(result.error || 'Chart validation failed')
    }
}

export function judge(rule: string, delta: number): number {
    return window.judge(rule, delta)
}

export function convertOsu(osuText: string): { ok: boolean; json?: string; error?: string } {
    if (typeof window.convertOsu !== 'function') {
        return { ok: false, error: 'convertOsu not available in WASM' }
    }
    return window.convertOsu(osuText)
}
