import express, { Request, Response } from 'express';
import {randomUUID} from "node:crypto"; //Generar Valores Aleatorios
import {contarPrimos} from "./calculo"; //Importar la función contarPrimos desde calculo.ts
import { medirLatencia, resumenMetricas } from "./metricas";
import {parentPort, workerData} from "node:worker_threads";
import path from "node:path"; //Importar el módulo path para manejar rutas de archivos
import {llamar, aHttp} from "./inventariogrpc"; //Importar la función llamar desde inventariogrpc.ts    


const PORT = Number(process.env.PORT ?? 3000);
const INVENTARIO_URL = process.env.INVENTARIO_URL ?? "http://localhost:3001";
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 2000);
const REPORTE_N = Number(process.env.REPORTE_N ?? 8_000_000); //Número de primos a contar para el reporte
import {Worker} from "node:worker_threads"; //Importar la clase Worker para crear hilos de trabajo

interface Pedido{
    id: string;
    sku: string;
    cantidad: number;
    creadoEn: string,
}
const pedidos : Pedido[] = [];


const app = express();
app.use(express.json());
app.use(medirLatencia);

//Salud Server
app.get("/health", (_req: Request, res: Response) =>{
    res.json({ status: "OK" , servicio: "pedidos"});
});

// Readiness: comprobar disponibilidad de Inventario
app.get("/health/ready", async (_req: Request, res: Response) => {
    const inicio = performance.now();

    try {
        const respuesta = await fetch(`${INVENTARIO_URL}/health`, {
            signal: AbortSignal.timeout(1000)
        });

        const ms = Math.round(performance.now() - inicio);

        if (!respuesta.ok) {
            res.status(503).json({
                status: "no-listo",
                inventario: `HTTP ${respuesta.status}`,
                ms
            });
            return;
        }

        res.status(200).json({
            status: "listo",
            inventario: "ok",
            ms
        });

    } catch (error) {
        const ms = Math.round(performance.now() - inicio);
        const e = error as Error;

        const motivo = e.name === "TimeoutError"
            ? "Tiempo de espera agotado"
            : `No se pudo conectar: ${e.message}`;

        res.status(503).json({
            status: "no-listo",
            inventario: motivo,
            ms
        });
    }
});

app.get("/pedidos", (_req: Request, res: Response) =>{
    res.json(pedidos);
});

app.post("/pedidos", async (req: Request, res: Response) =>{
    const {sku, cantidad} = req.body ?? {};
    if (typeof sku !== "string" || typeof cantidad !== "number" || cantidad <= 0){
        res.status(400).json({error: "Solicitud inválida, se requiere sku y cantidad"});
        return;
    }
  const inicio = performance.now(); //Toma el Tiempo de inicio

  // nueva llamada por grpc /* aqui esta comentado!!!!! */
  // /* se comenta todo el try anterior de la llamada a api REST*/
//   try{
//     /*
//     const r = await fetch(`${INVENTARIO_URL}/stock/${encodeURIComponent(sku)}`,{ //encodeURIComponent para codificar el SKU en caso de que tenga caracteres especiales
//         signal: AbortSignal.timeout(TIMEOUT_MS),
//     });
//     */
//     const r = await fetch(`${INVENTARIO_URL}/stock/${encodeURIComponent(sku)}/reservar`, {
//         method: "POST",
//         headers: {
// 
//             "Content-Type": "application/json"
//         },
//     body: JSON.stringify({ cantidad }),
//     signal: AbortSignal.timeout(TIMEOUT_MS),
//     });
// 
//     if(r.status === 404){
//         res.status(404).json({error: `SKU no encontrado ${sku}`});
//         return;
//     };
// 
//     if (r.status === 409) {
//     const detalle = await r.json();
//     res.status(409).json(detalle);
//     return;
// }
//     /*
//     const stock = (await r.json()) as {disponible: number};
// 
//     if(stock.disponible < cantidad){
//         res.status(409).json({error: `Stock insuficiente para ${sku}, disponible: ${stock.disponible}`});
//         return;
//     }
//      */
//     if (!r.ok) {
//         const detalle = await r.json();
//         res.status(r.status).json(detalle);
//         return;
//     }
// 
//     const pedido: Pedido = { 
// 
//         id: randomUUID(),
//         sku, cantidad,
//         creadoEn: new Date().toISOString()};
//         pedidos.push(pedido);
//         res.status(201).json(pedido);
// 
//   } catch (error){
//     const duracionMs =  Math.round(performance.now() - inicio);
//     const e = error as Error & {cause ?: {code?: string}};
//     const motivo = e.name === `TimeoutError` ? `Inventario no contestó en: ${TIMEOUT_MS} ms` : `No se pudo conectar a Inventario: ${e.cause?.code ?? e.message}`;
//     console.error(pedidos + " " + motivo);
//     res.status(503).json({error: "Inventario no disponible", motivo, duracionMs});
//     //res.status(500).json({error: "Error al consultar el inventario"});
//   }
// });

  try {
    const reserva = await llamar<{sku: string, reservado: number, restante: number}>("Reservar", {sku, cantidad});
    const pedido: Pedido = { id: randomUUID(), sku: reserva.sku, cantidad: reserva.reservado, creadoEn: new Date().toISOString() };
    pedidos.push(pedido);
    res.status(201).json(pedido);
  } catch (error) {
    const duracionMs = Math.round(performance.now() - inicio);
    const {status, cuerpo} = aHttp(error);
    console.error("[pedidos] " + cuerpo.error + ": " + cuerpo.motivo);
    res.status(status).json({...cuerpo, duracionMs});
  }
});


//Función Leer Primos
function leerN(req: Request): number {
    const n = Number(req.query.n ?? REPORTE_N);
    return Number.isInteger(n) && n> 0 && n <= 50_000_000 ? n : REPORTE_N;
};

app.get("/reporte/bloqueante", (req: Request, res: Response) => {
    const n = leerN(req);
    const inicio = performance.now();
    const primos = contarPrimos(n);
    const duracionMs = Math.round(performance.now() - inicio);
    res.json({modo: "bloqueando", n, primos, duracionMs})
});

//Con el hilo del worker
function contarPrimosEnWorker(n: number): Promise<number> {

    return new Promise ((resolver, reject) => {
        const archivo = path.join(__dirname, "worker-reporte.js");
        const w = new Worker(archivo, {workerData: {n}});
        w.once("message", (primos: number) => resolver(primos));
        w.once("error", reject);
        
        
    });
};

app.get("/reporte/worker", async (req: Request, res: Response) => {
    const n = leerN(req);
    const inicio = performance.now();
    const primos = await contarPrimosEnWorker(n); 
    const duracionMs = Math.round(performance.now() - inicio);
    res.json({modo: "worker", n, primos, duracionMs})
});
    
    





//Puerto en el que escucha
app.get("/metricas", (_req: Request, res: Response) => {
    res.json(resumenMetricas());
});

app.listen(PORT, () => {
    console.log(`Servicio de pedidos escuchando en el puerto: ${PORT} ` + `Inventario: ${INVENTARIO_URL}` + ` Timeout: ${TIMEOUT_MS} ms`);
});