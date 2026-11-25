import { iniciarServidorGrpc } from "./grpc";

const RETARDO_MS = Number(process.env.RETARDO_MS ?? 0);

const stock = new Map<string, number>([
    ['Secadora', 5],
    ['Lavadora', 40],
    ['Refrigerador', 12],
    ['Microondas', 0],
    ['MOUSE-USB', 40],
]);

iniciarServidorGrpc(stock, RETARDO_MS)
    .then(() => {
        console.log(`Servidor gRPC de inventario listo (retraso: ${RETARDO_MS}ms)`);
    })
    .catch((error) => {
        console.error("No se pudo iniciar el servidor gRPC:", error);
        process.exit(1);
    });