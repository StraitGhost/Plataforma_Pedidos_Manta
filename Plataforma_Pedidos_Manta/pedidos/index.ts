import express, { Request, Response } from 'express';
import {randomUUID} from 'node:crypto';

const PORT = Number(process.env.PORT??3000);
const INVENTARIO_URL = process.env.INVENTARIO_URL??'http://localhost:3001';
const RETARDO_MS = Number(process.env.RETARDO_MS??0);

interface Pedido {
    id: string;
    sku: string;
    cantidad: number;
    creadoEN: string;
}

const pedidos: Pedido[] = [];
const app = express();
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {

    res.status(200).send('OK');

});

app.get("/health/ready", async (_req: Request, res: Response) => {
    const inicio = performance.now();
    try {
        const r = await fetch(`${INVENTARIO_URL}/health`, {
            signal: AbortSignal.timeout(1000),
        });
        const ms = Math.round(performance.now() - inicio);
        if (!r.ok) {
            res.status(503).json({ status: "no-listo", inventario: `HTTP ${r.status}`, ms });
            return;
        }
        res.status(200).json({ status: "listo", inventario: "ok", ms });
    } catch (error) {
        const ms = Math.round(performance.now() - inicio);
        const e = error as Error & { cause?: { code?: string } };
        const motivo = e.name === "TimeoutError"
            ? "timeout"
            : (e.cause?.code ?? e.message);
        res.status(503).json({ status: "no-listo", inventario: motivo, ms });
    }
});

app.get("/pedidos", (req: Request, res: Response) => {

    res.json(pedidos);

});

app.listen(PORT, () => {

    console.log(`Servidor de pedidos escuchando en el puerto: ${PORT} retraso: ${RETARDO_MS}ms`);

});

app.post("/pedidos", async (req: Request, res: Response) => {

    const { sku, cantidad } = req.body??{};
    if (typeof sku !== 'string' || typeof cantidad !== 'number' || cantidad <= 0) {
        res.status(400).json({ error: 'Solicitud inválida. Se requiere un SKU válido y una cantidad mayor a cero.' });
        return;
    }
    
    const inicio = performance.now();

    try{
        const r = await fetch(`${INVENTARIO_URL}/stock/${encodeURIComponent(sku)}/reservar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cantidad }),
            signal: RETARDO_MS > 0 ? AbortSignal.timeout(RETARDO_MS) : undefined,
        });

        if (r.status === 404) {
            const detalle = await r.json();
            res.status(404).json(detalle);
            return;
        }
        if (r.status === 409) {
            const detalle = await r.json();
            res.status(409).json(detalle);
            return;
        }
        if (!r.ok) {
            const detalle = await r.json().catch(() => ({ error: "Inventario rechazó la reserva" }));
            res.status(r.status).json(detalle);
            return;
        }
        const pedido: Pedido = {
            id: randomUUID(),
            sku,
            cantidad,
            creadoEN: new Date().toISOString()
        };
        pedidos.push(pedido);
        res.status(201).json(pedido);

    }catch (error) {
        const duracionMs = Math.round(performance.now() - inicio);
        const e = error as Error & { cause ?: { code?: string } };
        const motivo = e.name === "TimeoutError" ? "Inventario no constestó en " + RETARDO_MS + "ms" : "NO SE PUDO CON TANTO INVENTARIO " + (e.cause?.code ?? e.message);
        console.error(pedidos + " " + motivo);
        res.status(503).json({error: "Inventario no disponible: " + motivo, duracionMs});
    }
});

