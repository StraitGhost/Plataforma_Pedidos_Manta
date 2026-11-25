// servidor gRPC

import path from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const GRPC_PORT = Number(process.env.GRPC_PORT ?? 50051);

const definicion = protoLoader.loadSync(
    path.join(__dirname, "../inventario/proto/inventario.proto"),
    {
        keepCase: true,
        defaults: true,
        longs: String,
        enums: String,
        oneofs: true,
    },
);

const paquete = grpc.loadPackageDefinition(definicion) as any;

interface SolicitudStock {
    sku: string;
}

interface Stock {
    sku: string;
    disponible: number;
}

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function iniciarServidorGrpc(
    stock: Map<string, number>,
    retrasoMs: number,
): Promise<grpc.Server> {
    const servidor = new grpc.Server();

    const consultarStock = async (
        call: grpc.ServerUnaryCall<SolicitudStock, Stock>,
        callback: grpc.sendUnaryData<Stock>,
    ) => {
        if (retrasoMs > 0) {
            await esperar(retrasoMs);
        }

        const sku = call.request.sku;
        const disponible = stock.get(sku);

        if (disponible === undefined) {
            callback({
                code: grpc.status.NOT_FOUND,
                message: `El producto con SKU ${sku} no existe`,
            });
            return;
        }

        callback(null, { sku, disponible });
    };

    servidor.addService(paquete.inventario.Inventario.service, {
        ConsultarStock: consultarStock,
    });

    return new Promise<grpc.Server>((resolve, reject) => {
        servidor.bindAsync(
            `0.0.0.0:${GRPC_PORT}`,
            grpc.ServerCredentials.createInsecure(),
            (error, puerto) => {
                if (error) {
                    servidor.forceShutdown();
                    reject(error);
                    return;
                }
                console.log(`Servidor gRPC escuchando en el puerto: ${puerto}`);
                resolve(servidor);
            },
        );
    });
}