import fs from "node:fs";
import path from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const PLAZO_MS = Number(process.env.PLAZO_MS ?? 1000);

const candidatosProto = [
    process.env.INVENTARIO_PROTO_PATH,
    path.join(__dirname, "inventario.proto"),
    path.join(__dirname, "..", "inventario.proto"),
    path.join(__dirname, "..", "proto", "inventario.proto"),
].filter((ruta): ruta is string => Boolean(ruta));

const rutaProto =
    candidatosProto.find((ruta) => fs.existsSync(ruta)) ??
    path.join(__dirname, "inventario.proto");

const definicion = protoLoader.loadSync(rutaProto, {
    keepCase: true,
    defaults: true,
});

const paquete = grpc.loadPackageDefinition(definicion) as any;
const Servicio = paquete.Inventario?.Inventario ?? paquete.inventario?.Inventario;

const destino = process.env.INVENTARIO_GRPC_URL ?? "127.0.0.1:50051";
const inventario = new Servicio(destino, grpc.credentials.createInsecure());

export function llamar<T>(metodo: string, peticion: object): Promise<T> {
    return new Promise((resolve, reject) => {
        const plazo = new Date(Date.now() + PLAZO_MS);
        inventario[metodo](
            peticion,
            { deadline: plazo },
            (error: grpc.ServiceError | null, respuesta: T) => {
                if (error) reject(error);
                else resolve(respuesta);
            },
        );
    });
}

const HTTP_DE: Record<number, number> = {
    [grpc.status.INVALID_ARGUMENT]: 400,
    [grpc.status.NOT_FOUND]: 404,
    [grpc.status.FAILED_PRECONDITION]: 409,
    [grpc.status.RESOURCE_EXHAUSTED]: 409,
    [grpc.status.DEADLINE_EXCEEDED]: 504,
    [grpc.status.UNAVAILABLE]: 503,
};

export function aHttp(e: unknown) {
    const error = e as grpc.ServiceError;
    const esGrpc = typeof error?.code === "number";

    return {
        status: esGrpc ? (HTTP_DE[error.code] ?? 502) : 500,
        cuerpo: {
            error: esGrpc ? grpc.status[error.code] : "ERROR_INTERNO",
            motivo: error?.details ?? String(e),
        },
    };
}
