import express, { Request, Response } from 'express';

const PORT = Number(process.env.PORT??3001);

const RETARDO_MS = Number(process.env.RETARDO_MS??0);
const stock = new Map<string, number>([

  ['Secadora', 5],
  ['Lavadora', 40],
  ['Refrigerador', 12],
  ['Microondas', 0],
  ['MOUSE-USB', 40],

]);

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const app = express();
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {

    res.status(200).send('OK');

});

app.get("/stock/:sku", async (req: Request<{ sku: string }>, res: Response) => {

    if (RETARDO_MS > 0) await esperar(RETARDO_MS);

    const disponible = stock.get(req.params.sku);

    if (disponible === undefined) {
        res.status(404).json({ error: `El producto con SKU ${req.params.sku} no existe` });
        return;
    } 
    res.json({ sku: req.params.sku, disponible: disponible });

});

app.post("/stock/:sku/reservar", async (req: Request<{ sku: string }>, res: Response) => {

    const cantidad = req.body?.cantidad;
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
        res.status(400).json({ error: "La cantidad debe ser un entero mayor que 0" });
        return;
    }

    if (RETARDO_MS > 0) await esperar(RETARDO_MS);

    const disponible = stock.get(req.params.sku);
    if (disponible === undefined) {
        res.status(404).json({ error: `El producto con SKU ${req.params.sku} no existe` });
        return;
    }
    if (disponible < cantidad) {
        res.status(409).json({
            error: "No hay stock suficiente",
            sku: req.params.sku,
            disponible,
            solicitado: cantidad,
        });
        return;
    }

    const restante = disponible - cantidad;
    stock.set(req.params.sku, restante);
    res.json({ sku: req.params.sku, reservado: cantidad, restante });

});

app.listen(PORT, () => {

    console.log(`Servidor de inventario escuchando en el puerto: ${PORT} retraso: ${RETARDO_MS}ms`);

});