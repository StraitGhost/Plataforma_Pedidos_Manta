
import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { contarPrimos } from './calculo';
import { medirLatencia, resumenMetricas } from './metricas';

const PORT = Number(process.env.PORT ?? 3000);
const INVENTARIO_URL = process.env.INVENTARIO_URL ?? 'http://localhost:3001';
const RETARDO_MS = Number(process.env.RETARDO_MS ?? 0);
const N_REPORTE = Number(process.env.N_REPORTE ?? 200000);

interface Pedido {
    id: string;
    sku: string;
    cantidad: number;
    creadoEn: string;
}

const pedidos: Pedido[] = [];
const app = express();

app.use(express.json());
app.use(medirLatencia);

app.get('/health', (_req: Request, res: Response) => {
    res.status(200).send('OK');
});

app.get('/health/ready', async (_req: Request, res: Response) => {
    const inicio = performance.now();

    try {
        const r = await fetch(`${INVENTARIO_URL}/health`, {
            signal: AbortSignal.timeout(1000),
        });

        const ms = Math.round(performance.now() - inicio);

        if (!r.ok) {
            res.status(503).json({
                status: 'no-listo',
                inventario: `HTTP ${r.status}`,
                ms,
            });
            return;
        }

        res.status(200).json({
            status: 'listo',
            inventario: 'ok',
            ms,
        });
    } catch (error) {
        const ms = Math.round(performance.now() - inicio);
        const e = error as Error & { cause?: { code?: string } };

        const motivo = e.name === 'TimeoutError'
            ? 'timeout'
            : (e.cause?.code ?? e.message);

        res.status(503).json({
            status: 'no-listo',
            inventario: motivo,
            ms,
        });
    }
});

app.get('/metricas', (_req: Request, res: Response) => {
    res.json(resumenMetricas());
});

app.get('/reporte/bloqueante', (_req: Request, res: Response) => {
    const inicio = performance.now();
    const primos = contarPrimos(N_REPORTE);

    res.json({
        n: N_REPORTE,
        primos,
        ms: Math.round(performance.now() - inicio),
    });
});

app.get('/reporte/worker', (_req: Request, res: Response) => {
    const inicio = performance.now();

    const worker = new Worker(
        path.join(__dirname, 'worker-reporte.js'),
        {
            workerData: { n: N_REPORTE },
        }
    );

    worker.once('message', (primos: number) => {
        res.json({
            n: N_REPORTE,
            primos,
            ms: Math.round(performance.now() - inicio),
        });
    });

    worker.once('error', (err: unknown) => {
        const detalle = err instanceof Error
            ? err.message
            : String(err);

        res.status(500).json({
            error: 'Falló el cálculo del reporte',
            detalle,
        });
    });
});

app.get('/pedidos', (_req: Request, res: Response) => {
    res.json(pedidos);
});

app.post('/pedidos', async (req: Request, res: Response) => {
    const { sku, cantidad } = req.body ?? {};

    if (
        typeof sku !== 'string' ||
        !Number.isInteger(cantidad) ||
        cantidad <= 0
    ) {
        res.status(400).json({
            error: 'Solicitud inválida. Se requiere un SKU válido y una cantidad entera mayor a cero.',
        });
        return;
    }

    const inicio = performance.now();

    try {
        const r = await fetch(
            `${INVENTARIO_URL}/stock/${encodeURIComponent(sku)}/reservar`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ cantidad }),
                signal: RETARDO_MS > 0
                    ? AbortSignal.timeout(RETARDO_MS)
                    : undefined,
            }
        );

        if (!r.ok) {
            const detalle = await r.json().catch(() => ({
                error: 'Inventario rechazó la reserva',
            }));

            res.status(r.status).json(detalle);
            return;
        }

        const pedido: Pedido = {
            id: randomUUID(),
            sku,
            cantidad,
            creadoEn: new Date().toISOString(),
        };

        pedidos.push(pedido);

        res.status(201).json(pedido);
    } catch (error) {
        const duracionMs = Math.round(performance.now() - inicio);
        const e = error as Error & { cause?: { code?: string } };

        const motivo = e.name === 'TimeoutError'
            ? `Inventario no contestó en ${RETARDO_MS}ms`
            : (e.cause?.code ?? e.message);

        console.error(`Reserva fallida: ${motivo}`);

        res.status(503).json({
            error: `Inventario no disponible: ${motivo}`,
            duracionMs,
        });
    }
});

app.listen(PORT, () => {
    console.log(
        `Servidor de pedidos escuchando en el puerto: ${PORT} retraso: ${RETARDO_MS}ms`
    );
});
