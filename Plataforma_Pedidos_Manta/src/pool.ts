import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_TRABAJADORES = Number(process.env.MAX_TRABAJADORES ?? os.availableParallelism());
const MAX_COLA = Number(process.env.MAX_COLA ?? MAX_TRABAJADORES * 2);

interface Trabajo {
    n: number;
    resolve: (primos: number) => void;
    reject: (err: Error) => void;
}

const cola: Trabajo[] = [];
let activos = 0;
let rechazadas = 0;

function ejecutar(trabajo: Trabajo): void {
    activos++;
    let terminado = false;

    const worker = new Worker(path.join(__dirname, 'worker-reporte.js'), {
        workerData: { n: trabajo.n },
    });

    const finalizar = (accion: () => void) => {
        if (terminado) return;
        terminado = true;
        activos--;
        accion();
        siguiente();
    };

    worker.once('message', (primos: number) => finalizar(() => trabajo.resolve(primos)));
    worker.once('error', (err: Error) => finalizar(() => trabajo.reject(err)));
    worker.once('exit', (code: number) =>
        finalizar(() => trabajo.reject(new Error(`El worker terminó con código ${code}`)))
    );
}

function siguiente(): void {
    while (activos < MAX_TRABAJADORES && cola.length > 0) {
        ejecutar(cola.shift()!);
    }
}

export function contarPrimosEnPool(n: number): Promise<number> {
    return new Promise<number>((resolve, reject) => {
        const trabajo: Trabajo = { n, resolve, reject };

        if (activos < MAX_TRABAJADORES) {
            ejecutar(trabajo);
        } else if (cola.length < MAX_COLA) {
            cola.push(trabajo);
        } else {
            rechazadas++;
            const err = new Error('Pool lleno: cola de trabajos agotada');
            (err as any).name = 'PoolLleno';
            reject(err);
        }
    });
}

export function estadoPool() {
    return {
        maxTrabajadores: MAX_TRABAJADORES,
        activos,
        enCola: cola.length,
        maxCola: MAX_COLA,
        rechazadas,
    };
}